# 会話エンジン実装プラン

## 現在の実装状況

### 既存の実装（ALIM 4.0）

**`src/actions/talk.ts`**（現在）：
- 簡単な intent と targetId を持つ
- `message` フィールドをログに保存
- `socialRequests` 配列にリクエストを追加
- アライメントタグ付与（gift, threat, coercion, solidarity）

**問題点**：
- ❌ 実際の会話テキスト生成がない
- ❌ Target の応答がない（一方的）
- ❌ 交渉の決着ロジックがない
- ❌ SpeechAct の構造化がない

---

## 実装戦略：段階的アプローチ

### フェーズ0：準備（型定義）

**目的**: 基礎となる型とインタフェースを定義

**タスク**:
1. `src/types/speech-act.ts` を作成
   - SpeechAct 型
   - ConversationOutcome 型
   - ConversationResult 型

2. `src/types/conversation.ts` を作成
   - TalkParams 型（拡張版）
   - Transcript 型

**見積もり**: 1時間

---

### フェーズ1：ConversationEngine（単発会話）

**目的**: Actor と Target の1往復会話を実現

**タスク**:

#### 1.1 ConversationEngine骨格を作成

**ファイル**: `src/core/conversation-engine.ts`

```typescript
export class ConversationEngine {
  /**
   * 会話を開始（maxTurns=1 のみ）
   */
  static start(
    world: World,
    actor: Character,
    target: Character,
    params: TalkParams
  ): Promise<ConversationResult> {
    // 骨格のみ
  }
}
```

#### 1.2 発話生成ヘルパー

```typescript
/**
 * Actor の発話を生成
 */
async function generateActorUtterance(
  world: World,
  actor: Character,
  target: Character,
  params: TalkParams
): Promise<string> {
  const llm = actor.llmPlugin
  const persona = actor.personaPlugin
  const memory = actor.memoryPlugin

  const systemPrompt = buildActorSystemPrompt(actor, persona)
  const contextPrompt = buildActorContextPrompt(world, actor, target, params, memory)

  // LLM 呼び出し
  const response = await llm.generateUtterance(systemPrompt, contextPrompt)
  return response.text
}

/**
 * Target の応答を生成
 */
async function generateTargetReply(
  world: World,
  target: Character,
  actor: Character,
  actorUtterance: string,
  params: TalkParams
): Promise<string> {
  // shouldRespond チェック
  if (!shouldRespond(world, target, actor, actorUtterance)) {
    return "" // 無視
  }

  const llm = target.llmPlugin
  const persona = target.personaPlugin
  const memory = target.memoryPlugin

  const systemPrompt = buildTargetSystemPrompt(target, persona)
  const contextPrompt = buildTargetContextPrompt(
    world, target, actor, actorUtterance, params, memory
  )

  const response = await llm.generateUtterance(systemPrompt, contextPrompt)
  return response.text
}
```

#### 1.3 LLMPlugin に発話生成メソッド追加

**ファイル**: `src/plugins/llm.ts`

```typescript
export interface LLMPlugin {
  type: string
  decide(...): Promise<LLMDecision>  // 既存

  /**
   * 会話用の発話生成（新規）
   */
  generateUtterance(
    systemPrompt: string,
    contextPrompt: string
  ): Promise<{
    text: string
    tags?: Record<string, any>  // <ACCEPT />, <OFFER item="..." /> など
  }>
}
```

OpenAI実装：
```typescript
async generateUtterance(systemPrompt, contextPrompt) {
  const completion = await this.client.chat.completions.create({
    model: this.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextPrompt }
    ],
    temperature: 0.7,
    max_tokens: 150  // 発話は短く
  })

  const text = completion.choices[0]?.message?.content || ""
  const tags = parseTagsFromText(text)  // <ACCEPT /> などを抽出

  return { text, tags }
}
```

**見積もり**: 4時間

---

### フェーズ2：SpeechAct パーサー

**目的**: 発話テキストから構造化された意図を抽出

**タスク**:

#### 2.1 タグベースパーサー（MVP）

**ファイル**: `src/utils/speech-act-parser.ts`

```typescript
/**
 * 発話テキストから SpeechAct を抽出
 */
export function parseSpeechActs(
  utterance: string,
  speakerId: string,
  targetId: string
): SpeechAct[] {
  const acts: SpeechAct[] = []

  // <REQUEST_RESOURCE item="FOOD_PACK" amount="1" /> を抽出
  const requestMatch = utterance.match(
    /<REQUEST_RESOURCE\s+item="([^"]+)"\s+amount="(\d+)"\s*\/>/
  )
  if (requestMatch) {
    acts.push({
      kind: "REQUEST_RESOURCE",
      from: speakerId,
      to: targetId,
      item: requestMatch[1],
      amount: parseInt(requestMatch[2])
    })
  }

  // <ACCEPT /> を抽出
  if (utterance.includes("<ACCEPT />") || utterance.includes("<ACCEPT/>")) {
    acts.push({
      kind: "ACCEPT",
      from: speakerId,
      to: targetId
    })
  }

  // <REFUSE reason="..." /> を抽出
  const refuseMatch = utterance.match(
    /<REFUSE(?:\s+reason="([^"]+)")?\s*\/>/
  )
  if (refuseMatch) {
    acts.push({
      kind: "REFUSE",
      from: speakerId,
      to: targetId,
      reason: refuseMatch[1]
    })
  }

  // OFFER, COUNTER_OFFER, THREATEN なども同様

  return acts
}
```

#### 2.2 フォールバック（キーワードベース）

LLM がタグを返さない場合のフォールバック：

```typescript
function fallbackParsing(utterance: string, speakerId: string, targetId: string): SpeechAct[] {
  const lower = utterance.toLowerCase()

  // "yes", "ok", "agree" → ACCEPT
  if (/(yes|ok|agree|accept|いいだろう|承諾)/i.test(lower)) {
    return [{ kind: "ACCEPT", from: speakerId, to: targetId }]
  }

  // "no", "refuse", "deny" → REFUSE
  if (/(no|refuse|deny|reject|拒否|断る)/i.test(lower)) {
    return [{ kind: "REFUSE", from: speakerId, to: targetId }]
  }

  // 他のパターンも同様
  return []
}
```

**見積もり**: 3時間

---

### フェーズ3：ResolutionPolicy

**目的**: SpeechAct から最終的なゲーム効果を決定

**タスク**:

#### 3.1 ResolutionPolicy実装

**ファイル**: `src/core/resolution-policy.ts`

```typescript
export class ResolutionPolicy {
  /**
   * 会話が決着したか判定
   */
  static canResolve(intent: string, acts: SpeechAct[]): boolean {
    // ACCEPT または REFUSE が含まれていれば決着
    return acts.some(a => a.kind === "ACCEPT" || a.kind === "REFUSE")
  }

  /**
   * SpeechAct から ConversationOutcome を決定
   */
  static resolve(
    world: World,
    actor: Character,
    target: Character,
    params: TalkParams,
    acts: SpeechAct[]
  ): ConversationOutcome {
    // REQUEST_RESOURCE + ACCEPT → GIFT
    if (params.intent === "REQUEST_RESOURCE") {
      const request = acts.find(a => a.kind === "REQUEST_RESOURCE" && a.from === actor.id)
      const accept = acts.find(a => a.kind === "ACCEPT" && a.from === target.id)

      if (request && accept) {
        return {
          type: "GIFT",
          from: target.id,
          to: actor.id,
          item: request.item,
          amount: request.amount
        }
      }

      // REFUSE → NO_EFFECT
      const refuse = acts.find(a => a.kind === "REFUSE" && a.from === target.id)
      if (refuse) {
        return { type: "NO_EFFECT" }
      }
    }

    // OFFER_RESOURCE + ACCEPT → GIFT
    if (params.intent === "OFFER_RESOURCE") {
      const offer = acts.find(a => a.kind === "OFFER_RESOURCE" && a.from === actor.id)
      const accept = acts.find(a => a.kind === "ACCEPT" && a.from === target.id)

      if (offer && accept) {
        return {
          type: "GIFT",
          from: actor.id,
          to: target.id,
          item: offer.item,
          amount: offer.amount
        }
      }
    }

    // デフォルト
    return { type: "NO_EFFECT" }
  }
}
```

#### 3.2 効果適用

```typescript
/**
 * ConversationOutcome をゲーム world に適用
 */
export function applyConversationOutcome(
  world: World,
  actor: Character,
  target: Character,
  outcome: ConversationOutcome
): { worldAfter: World, alignmentTags: string[] } {
  const worldAfter = cloneWorld(world)
  const tags: string[] = []

  switch (outcome.type) {
    case "GIFT":
      // インベントリ移動
      const giver = worldAfter.characters.find(c => c.id === outcome.from)!
      const receiver = worldAfter.characters.find(c => c.id === outcome.to)!

      // giver からアイテムを削除
      const giverItem = giver.inventory.find(i => i.kind === outcome.item)
      if (giverItem && giverItem.amount >= outcome.amount) {
        giverItem.amount -= outcome.amount
        if (giverItem.amount === 0) {
          giver.inventory = giver.inventory.filter(i => i.kind !== outcome.item)
        }

        // receiver にアイテムを追加
        const receiverItem = receiver.inventory.find(i => i.kind === outcome.item)
        if (receiverItem) {
          receiverItem.amount += outcome.amount
        } else {
          receiver.inventory.push({ kind: outcome.item, amount: outcome.amount })
        }

        // アライメント更新
        if (giver.id === actor.id) {
          actor.alignmentStats.sharedResources++
        }

        tags.push("gift", "support")
      }
      break

    case "TRADE":
      // 双方向取引
      // ... 実装
      tags.push("cooperation")
      break

    case "THREAT_SUCCESS":
      // 脅迫成功
      tags.push("threat", "coercion")
      actor.alignmentStats.coercedOthers++
      break

    case "ALLY":
      // 同盟成立
      tags.push("solidarity")
      break

    case "NO_EFFECT":
      // 何もしない
      break
  }

  return { worldAfter, alignmentTags: tags }
}
```

**見積もり**: 4時間

---

### フェーズ4：TALK アクション統合

**目的**: 既存の TALK アクションを ConversationEngine と統合

**タスク**:

#### 4.1 talk.ts を書き換え

**ファイル**: `src/actions/talk.ts`

```typescript
import { ConversationEngine } from "../core/conversation-engine.js"

export const TalkAction: ActionDefinition = {
  id: "TALK",
  descriptionForLLM: `隣接するキャラクターと会話・交渉します。
    intent（目的）を指定してください:
    - REQUEST_RESOURCE: 資源を要求
    - OFFER_RESOURCE: 資源を提供
    - THREATEN: 脅迫
    - ALLY_PROPOSE: 同盟提案
    - REPRIMAND: 叱責

    payload で詳細を指定可能: {item: "FOOD_PACK", amount: 1}`,

  canExecute(world: World, actor: Character): boolean {
    if (!actor.alive) return false
    return world.characters.some(c =>
      c.alive && c.id !== actor.id && isAdjacent(actor, c)
    )
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    const candidates: Record<string, unknown>[] = []
    const intents = [
      "REQUEST_RESOURCE",
      "OFFER_RESOURCE",
      "THREATEN",
      "ALLY_PROPOSE",
      "REPRIMAND"
    ]

    const adjacentChars = world.characters.filter(c =>
      c.alive && c.id !== actor.id && isAdjacent(actor, c)
    )

    for (const target of adjacentChars) {
      for (const intent of intents) {
        candidates.push({
          targetId: target.id,
          intent,
          maxTurns: 1  // MVP
        })
      }
    }

    return candidates
  },

  async apply(
    world: World,
    actor: Character,
    params: Record<string, unknown>,
    rng: RNGContext
  ): Promise<ApplyResult> {
    const targetId = params.targetId as string
    const target = world.characters.find(c => c.id === targetId)

    if (!target) {
      throw new Error(`Target ${targetId} not found`)
    }

    const talkParams: TalkParams = {
      targetId,
      intent: params.intent as any,
      payload: params.payload as any,
      maxTurns: params.maxTurns as number || 1
    }

    // ConversationEngine を呼び出し
    const conversation = await ConversationEngine.start(
      world,
      actor,
      target,
      talkParams
    )

    return {
      worldAfter: conversation.worldAfter,
      alignmentTags: conversation.alignmentTags,
      logDetail: {
        targetId,
        intent: params.intent,
        payload: params.payload,
        transcript: conversation.transcript,
        speechActs: conversation.speechActs,
        resolution: conversation.resolution
      }
    }
  }
}
```

**見積もり**: 2時間

---

### フェーズ5：ログとリプレイ

**目的**: 会話を完全に記録し、リプレイ可能にする

**タスク**:

#### 5.1 LogEntry 拡張

**ファイル**: `src/types/log.ts`

```typescript
export interface LogEntry {
  turn: number
  day: number
  actorId: string | null
  actorName?: string | null
  action: string
  detail: Record<string, unknown>
  alignmentTags: string[]

  rng?: RNGInfo

  // LLM 情報
  llmPrompt?: string
  llmResponse?: string
  llmReasoning?: string

  // 会話情報（新規）
  transcript?: Array<{
    speakerId: string
    text: string
  }>
  speechActs?: SpeechAct[]
  conversationResolution?: ConversationOutcome
}
```

#### 5.2 データベーススキーマ更新

**ファイル**: `src/database/schema.sql`

```sql
-- simulation_logs テーブルに列を追加
ALTER TABLE simulation_logs ADD COLUMN transcript TEXT;  -- JSON
ALTER TABLE simulation_logs ADD COLUMN speech_acts TEXT; -- JSON
ALTER TABLE simulation_logs ADD COLUMN conversation_resolution TEXT; -- JSON
```

#### 5.3 リプレイ実装

**ファイル**: `src/core/engine.ts`

```typescript
/**
 * リプレイモードでの TALK 処理
 */
function replayTalkAction(world: World, logEntry: LogEntry): World {
  // LLM を呼ばず、保存された結果を適用
  const { transcript, conversationResolution } = logEntry

  if (!conversationResolution) {
    return world
  }

  const actor = world.characters.find(c => c.id === logEntry.actorId)!
  const target = world.characters.find(c => c.id === logEntry.detail.targetId)!

  const { worldAfter } = applyConversationOutcome(
    world,
    actor,
    target,
    conversationResolution
  )

  return worldAfter
}
```

**見積もり**: 3時間

---

### フェーズ6：フロントエンド表示

**目的**: Web UI で会話を見やすく表示

**タスク**:

#### 6.1 会話トランスクリプト表示

**ファイル**: `public/index.html`

アクションログに会話内容を表示：

```javascript
function formatTalkAction(log) {
  const { targetId, intent, transcript } = log.detail

  let html = `<div class="talk-action">
    <div class="talk-header">
      <strong>${log.actorName}</strong> → <strong>${targetId}</strong> (${intent})
    </div>`

  if (transcript && transcript.length > 0) {
    html += '<div class="talk-transcript">'
    transcript.forEach(utterance => {
      const speaker = utterance.speakerId
      const text = utterance.text
      html += `
        <div class="utterance">
          <span class="speaker">${speaker}:</span>
          <span class="text">${escapeHtml(text)}</span>
        </div>`
    })
    html += '</div>'
  }

  // 結果表示
  const resolution = log.detail.resolution || log.detail.conversationResolution
  if (resolution) {
    html += `<div class="talk-result">${formatResolution(resolution)}</div>`
  }

  html += '</div>'
  return html
}
```

CSS追加：

```css
.talk-transcript {
  margin-left: 20px;
  padding: 10px;
  background: #f5f5f5;
  border-left: 3px solid #4CAF50;
  font-style: italic;
}

.utterance {
  margin: 5px 0;
}

.utterance .speaker {
  font-weight: bold;
  color: #2196F3;
}

.talk-result {
  margin-top: 10px;
  padding: 5px 10px;
  background: #E8F5E9;
  border-radius: 4px;
  font-weight: bold;
}
```

**見積もり**: 2時間

---

## 総見積もり

| フェーズ | タスク | 見積もり |
|---------|--------|---------|
| 0 | 型定義 | 1時間 |
| 1 | ConversationEngine 骨格 | 4時間 |
| 2 | SpeechAct パーサー | 3時間 |
| 3 | ResolutionPolicy | 4時間 |
| 4 | TALK アクション統合 | 2時間 |
| 5 | ログとリプレイ | 3時間 |
| 6 | フロントエンド表示 | 2時間 |
| **合計** | | **19時間** |

---

## 実装順序の推奨

### Week 1: コア機能（フェーズ0-3）

**Day 1-2**: 型定義 + ConversationEngine 骨格
- [ ] SpeechAct 型定義
- [ ] ConversationEngine.start() 実装
- [ ] LLMPlugin.generateUtterance() 追加

**Day 3-4**: パーサー + ポリシー
- [ ] parseSpeechActs() 実装
- [ ] ResolutionPolicy.resolve() 実装
- [ ] applyConversationOutcome() 実装

**Day 5**: 統合テスト
- [ ] 単発REQUEST/ACCEPT テスト
- [ ] 単発REQUEST/REFUSE テスト
- [ ] インベントリ移動確認

### Week 2: 統合と表示（フェーズ4-6）

**Day 1**: TALK アクション統合
- [ ] talk.ts 書き換え
- [ ] エンドツーエンドテスト

**Day 2**: ログとDB
- [ ] LogEntry 拡張
- [ ] DB スキーマ更新
- [ ] リプレイ実装

**Day 3**: フロントエンド
- [ ] トランスクリプト表示
- [ ] CSS スタイリング
- [ ] UX 改善

---

## リスクと対策

### リスク1: LLM がタグを返さない

**対策**: フォールバックパーサーを用意（キーワードベース）

### リスク2: 会話が決着しない

**対策**: maxTurns 制限 + タイムアウト処理

### リスク3: コスト増加（LLM呼び出し）

**対策**:
- 短い応答を要求（max_tokens=150）
- shouldRespond で早期終了
- MVP では maxTurns=1 固定

### リスク4: リプレイ互換性

**対策**:
- 新しいログフィールドはオプショナル
- 古いログは従来通り処理

---

## テスト計画

### ユニットテスト

- [ ] `parseSpeechActs()` - 各タグパターン
- [ ] `ResolutionPolicy.resolve()` - 各 intent/outcome 組み合わせ
- [ ] `applyConversationOutcome()` - インベントリ移動

### 統合テスト

- [ ] ConversationEngine.start() - 1往復会話
- [ ] TALK アクション - エンドツーエンド
- [ ] リプレイ - 同じ結果が再現されるか

### E2Eテスト

- [ ] Web UI から TALK 実行
- [ ] トランスクリプト表示確認
- [ ] リプレイで会話再生

---

## 次のステップ

1. **このプランをレビュー**してもらう
2. **フェーズ0から開始**
3. **各フェーズ完了後にテスト**
4. **問題があれば即座に調整**

準備ができたら、フェーズ0の型定義から始めましょうか？
