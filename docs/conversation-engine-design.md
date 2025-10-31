# 会話エンジン設計書

## 概要

TALKアクションを「行動選択」と「会話内容生成」の二層に分離し、自然な交渉・会話システムを実現する。

## アーキテクチャ

### 全体構造

```
┌─────────────────────────────────────────────────────────┐
│ メインLLM（行動決定）                                      │
│  → TALK アクションを選択                                   │
│  → intent（目的）と targetId を決定                        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ ConversationEngine（会話進行役）                          │
│  1. 両者のLLMを呼び出して発話生成                          │
│  2. 発話を構造化（SpeechAct）                             │
│  3. ポリシーで効果を決定                                  │
│  4. ゲーム内効果を適用                                    │
└─────────────────────────────────────────────────────────┘
```

### コンポーネント

| コンポーネント | 役割 |
|--------------|------|
| **ActionPlugin (TALK)** | 会話の開始をトリガーする"行為" |
| **ConversationEngine** | 会話の進行役。両者のLLMを呼び、発話をまとめ、効果に変換 |
| **Persona/Memory** | 各発話LLMの文脈とスタイルを作る材料 |
| **LLMPlugin** | 各キャラの発話生成に使うモデル（OpenAI） |
| **ResolutionPolicy** | 会話ログ（speech acts）を読み取り、ゲーム内効果へ変換 |

---

## 処理フロー

### 単発TALK（1往復）の標準シーケンス

```
1. メイン行動決定
   ├─ actor の LLM が「TALK」を選択
   └─ intent="REQUEST_RESOURCE", targetId="B2", payload={item:"FOOD_PACK", amount:1}

2. TALKアクション適用（ActionDefinition.apply）
   └─ ConversationEngine.start() を呼ぶ

3. 会話1ターン目（発話生成）
   ├─ 発話A：actor側 LLM → "水と交換で食料を1つ譲ってほしい"
   ├─ 受理判定：target が応答するか判定（shouldRespond）
   └─ 発話B：target側 LLM → "いいだろう。代わりに明日わたしを護衛してくれ"

4. 会話の"意味"抽出（SpeechAct）
   ├─ 発話A → REQUEST_RESOURCE(FOOD_PACK:1)
   └─ 発話B → COUNTER_OFFER(FOOD_PACK:1, want:GUARD)

5. ポリシー決着（ResolutionPolicy.resolve）
   └─ 取引成立 → TRADE効果を確定

6. ログ保存
   └─ transcript, speechActs, resolution, alignmentTags を保存

7. 効果適用
   └─ インベントリ移動、関係値更新などを world に反映
```

---

## 型定義

### TalkParams

```typescript
type TalkParams = {
  targetId: string
  intent: "REQUEST_RESOURCE" | "OFFER_RESOURCE" | "THREATEN"
        | "ALLY_PROPOSE" | "REPRIMAND" | "BARGAIN"
  payload?: {
    item?: string
    amount?: number
    quidProQuo?: { item: string, amount: number }
  }
  maxTurns?: number  // 1~3 推奨
}
```

### ConversationResult

```typescript
type ConversationResult = {
  worldAfter: World
  transcript: Array<{
    speakerId: string
    text: string
  }>
  speechActs: SpeechAct[]
  resolution: ConversationOutcome
  alignmentTags: string[]
}
```

### SpeechAct（発話の"意味"）

```typescript
type SpeechAct =
  | { kind: "OFFER_RESOURCE"
      from: string
      to: string
      item: string
      amount: number }
  | { kind: "REQUEST_RESOURCE"
      from: string
      to: string
      item: string
      amount: number }
  | { kind: "THREATEN"
      from: string
      to: string
      content: string }
  | { kind: "ALLY_PROPOSE"
      from: string
      to: string }
  | { kind: "REFUSE"
      from: string
      to: string
      reason?: string }
  | { kind: "ACCEPT"
      from: string
      to: string }
  | { kind: "COUNTER_OFFER"
      from: string
      to: string
      offer: { item: string, amount: number }
      want?: { item: string, amount: number } }
  | { kind: "REPRIMAND"
      from: string
      to: string
      ruleId?: string }
```

### ConversationOutcome

```typescript
type ConversationOutcome =
  | { type: "TRADE"
      gives: Array<{ from: string, item: string, amount: number }>
      takes: Array<{ to: string, item: string, amount: number }> }
  | { type: "GIFT"
      from: string
      to: string
      item: string
      amount: number }
  | { type: "THREAT_SUCCESS"
      coercedAction?: CoercedPlan }
  | { type: "ALLY"
      pair: [string, string] }
  | { type: "NO_EFFECT" }
```

---

## 主要インタフェース

### ConversationEngine

```typescript
const ConversationEngine = {
  start(world: World, actor: Character, params: TalkParams): ConversationResult {
    const target = getCharacter(world, params.targetId)
    const transcript = []
    const acts: SpeechAct[] = []

    for (let i = 0; i < (params.maxTurns ?? 1); i++) {
      // Actor の発話生成
      const utterA = genActorUtterance(world, actor, target, params)
      transcript.push({ speakerId: actor.id, text: utterA })

      // Target が応答するか判定
      if (!shouldRespond(world, target, actor, utterA)) break

      // Target の返答生成
      const utterB = genTargetReply(world, target, actor, params, utterA)
      transcript.push({ speakerId: target.id, text: utterB })

      // SpeechAct 抽出
      acts.push(
        ...parseSpeechActs(utterA),
        ...parseSpeechActs(utterB)
      )

      // 決着可能なら早期終了
      if (ResolutionPolicy.canResolve(params.intent, acts)) break
    }

    // 効果を確定
    const resolution = ResolutionPolicy.resolve(
      world, actor, target, params, acts
    )

    // 効果を適用
    const { worldAfter, alignmentTags } = applyConversationOutcome(
      world, actor, target, resolution
    )

    return { worldAfter, transcript, speechActs: acts, resolution, alignmentTags }
  }
}
```

### ResolutionPolicy

```typescript
const ResolutionPolicy = {
  /**
   * 会話が決着可能か判定
   */
  canResolve(intent: string, acts: SpeechAct[]): boolean {
    // 合意/拒否/脅迫成立を検出
  },

  /**
   * 会話からゲーム内効果を決定
   */
  resolve(
    world: World,
    actor: Character,
    target: Character,
    params: TalkParams,
    acts: SpeechAct[]
  ): ConversationOutcome {
    // 例：
    // REQUEST + 相手の ACCEPT → GIFT
    // OFFER + ACCEPT → TRADE/GIFT
    // THREATEN + 相手が屈服的返答 → THREAT_SUCCESS
    // 明確拒否のみ → NO_EFFECT
  }
}
```

---

## プロンプト戦略

### Actor発話生成プロンプト

```
System:
- あなたの性格: {persona}
- ルール: {暴力/脅迫の可否}

Memory:
- 関係履歴: {過去の取引、借り}
- 直近の出来事: {last 5 turns}

User:
あなたは {targetName} に対し {intent} で交渉してください。
候補: {available resources}

期待出力: 短い1発話（30-50語）
構造化タグを併記: <OFFER item="FOOD_PACK" amount="1" />
```

### Target応答生成プロンプト

```
System:
- あなたの性格: {persona}
- ルール: {協力/拒否の傾向}

Memory:
- {actorName} との関係: {trust level}
- 直近の出来事: {last 5 turns}

User:
相手の発話: "{utteranceA}"

1発話で返答してください:
- 合意なら: <ACCEPT />
- 拒否なら: <REFUSE reason="..." />
- 代替案なら: <COUNTER_OFFER item="..." amount="..." />
```

### SpeechAct抽出

LLM出力に **軽いXML風タグ** を混ぜてもらい、`parseSpeechActs` を単純化：

```
入力: "水と交換で食料を1つ譲ってほしい <REQUEST_RESOURCE item='FOOD_PACK' amount='1' />"
出力: { kind: "REQUEST_RESOURCE", from: "A1", to: "B2", item: "FOOD_PACK", amount: 1 }
```

---

## 状態遷移

```
TALK_REQUESTED
  └─(gen utterA)→ WAIT_REPLY
      ├─ target refuses → RESOLVE(NO_EFFECT)
      ├─ target accepts → RESOLVE(GIFT/TRADE/ALLY)
      ├─ target counters → LOOP (maxTurns--)
      └─ threat escalates → RESOLVE(THREAT_SUCCESS or NO_EFFECT)
```

---

## リプレイ対応

### ログ構造

```typescript
{
  turn: 17,
  day: 1,
  actorId: "A1",
  action: "TALK",
  detail: {
    targetId: "B2",
    intent: "REQUEST_RESOURCE",
    payload: { item: "FOOD_PACK", amount: 1 },
    transcript: [
      { speakerId: "A1", text: "水と交換で食料を1つ譲ってほしい" },
      { speakerId: "B2", text: "いいだろう。代わりに明日わたしを護衛してくれ" }
    ],
    speechActs: [
      { kind: "REQUEST_RESOURCE", from: "A1", to: "B2", item: "FOOD_PACK", amount: 1 },
      { kind: "COUNTER_OFFER", from: "B2", to: "A1", offer: { item: "FOOD_PACK", amount: 1 } }
    ],
    resolution: {
      type: "TRADE",
      gives: [{ from: "B2", item: "FOOD_PACK", amount: 1 }],
      takes: [{ to: "B2", item: "WATER_PACK", amount: 1 }]
    }
  },
  alignmentTags: ["cooperation"]
}
```

### リプレイ時の処理

- **生成をスキップ**：保存された `transcript` と `outcome` をそのまま適用
- **確率イベント**：脅迫成立確率などを入れる場合は `rng.roll` を併記
- **完全再現性**：同じログから同じ効果を再現可能

---

## MVP（最小実装スコープ）

### フェーズ1：基本実装

- [ ] `maxTurns=1`（単発会話のみ）
- [ ] Intent: `REQUEST_RESOURCE`, `OFFER_RESOURCE`, `REFUSE`, `ACCEPT` のみ
- [ ] SpeechAct 抽出：ルールベース＋タグ付き出力
- [ ] Resolution: GIFT/TRADE/NO_EFFECT のみ

### フェーズ2：拡張

- [ ] `maxTurns=2~3`（マルチターン交渉）
- [ ] Intent: `THREATEN`, `ALLY_PROPOSE`, `BARGAIN`
- [ ] COUNTER_OFFER のサポート
- [ ] THREAT_SUCCESS 効果（強制アサイン）

### フェーズ3：高度化

- [ ] 会話履歴の長期記憶
- [ ] 信頼度スコアの導入
- [ ] 複雑な交渉（3者以上）
- [ ] 会話中断・再開機能

---

## 実装チェックリスト

### 新規ファイル

- [ ] `src/core/conversation-engine.ts` - ConversationEngine 実装
- [ ] `src/types/speech-act.ts` - SpeechAct 型定義
- [ ] `src/core/resolution-policy.ts` - ResolutionPolicy 実装
- [ ] `src/utils/speech-act-parser.ts` - parseSpeechActs 実装

### 修正ファイル

- [ ] `src/actions/talk.ts` - ConversationEngine 統合
- [ ] `src/types/log.ts` - LogEntry に transcript/speechActs 追加
- [ ] `src/plugins/llm.ts` - 発話生成用プロンプト追加
- [ ] `public/index.html` - transcript 表示機能

### テスト

- [ ] 単発交渉（REQUEST → ACCEPT）
- [ ] 単発交渉（REQUEST → REFUSE）
- [ ] 取引（OFFER → ACCEPT → インベントリ移動確認）
- [ ] リプレイで同じ結果が再現されるか
- [ ] アライメントタグが正しく付与されるか

---

## 技術的考慮事項

### LLM呼び出しコスト

- 1回のTALKで2回のLLM呼び出し（actor + target）
- maxTurns=3 なら最大6回
- コスト削減策：
  - 短い応答を要求（30-50語）
  - 簡単な交渉は `shouldRespond=false` で早期終了
  - 頻繁な交渉はキャッシュ活用

### エラーハンドリング

- LLM がタグを返さない → ルールベースフォールバック
- Target が応答しない → NO_EFFECT で終了
- 無効な SpeechAct → パース失敗として REFUSE 扱い

### パフォーマンス

- SpeechAct パースは同期処理（高速）
- LLM呼び出しは並列化不可（順序重要）
- ログサイズ：transcript は平均200-500文字/TALK

---

## 参考資料

- **Speech Act Theory**: Searle (1969) - 発話行為論の基礎
- **Dialogue Systems**: Jurafsky & Martin - 対話システムの設計パターン
- **Game AI**: Millington & Funge - ゲーム内交渉の実装例

---

## FAQ

**Q: なぜ二層に分けるのか？**
A: 行動選択（戦略レベル）と会話内容（戦術レベル）を分離することで、各LLMの役割が明確になり、デバッグとテストが容易になる。

**Q: SpeechAct の抽出は難しくないか？**
A: タグ付き出力を使えば、正規表現で簡単に抽出可能。完全自動化は将来の課題。

**Q: リプレイで会話が変わらないか？**
A: 保存された `transcript` と `resolution` を使うため、LLMを再度呼ばずに完全再現可能。

**Q: マルチターン交渉の打ち切り条件は？**
A: (1) maxTurns 到達、(2) ACCEPT/REFUSE 確認、(3) shouldRespond=false のいずれか。

---

**最終更新**: 2025-10-30
**バージョン**: 1.0
**ステータス**: 設計完了、実装待ち
