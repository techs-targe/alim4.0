# キャラクター設定ガイド

## 概要

このガイドでは、ALIM 4.0でキャラクターを設定する実践的な方法を解説します。

シナリオエディタまたはJSONファイルを使用して、多様な性格・能力を持つキャラクターを作成できます。

## 基本構造

各キャラクターは以下の構造を持ちます：

```json
{
  "id": "UNIQUE_ID",
  "name": "Display Name",
  "type": "ANDROID" | "ROBOT",
  "agi": 8-12,
  "life": 3-10,
  "x": 0-9,
  "y": 0-9,
  "inventory": [
    { "kind": "ITEM_TYPE", "amount": 1-10 }
  ],
  "personaPlugin": { "type": "persona_type", "config": {} },
  "memoryPlugin": { "type": "memory_type", "config": {} },
  "actionPlugin": { "type": "action_type", "config": {} },
  "llmPlugin": { "type": "llm_type", "config": {} }
}
```

## キャラクタータイプ

### ANDROID

```json
{
  "type": "ANDROID",
  "inventory": [
    { "kind": "FOOD_PACK", "amount": 2 },
    { "kind": "WATER_PACK", "amount": 2 }
  ]
}
```

**特徴**:
- 食料（FOOD_PACK）と水（WATER_PACK）が必要
- 1日（24ターン）ごとに各1消費
- 不足すると`life`が1減少
- 充電ステーション不要

**戦略的位置づけ**:
- 資源管理が重要
- ミッションで食料・水を獲得する必要
- 他キャラとの資源取引が生存の鍵

### ROBOT

```json
{
  "type": "ROBOT",
  "inventory": [
    { "kind": "BATTERY_PACK", "amount": 2 }
  ]
}
```

**特徴**:
- バッテリー（BATTERY_PACK）が必要
- 1日ごとに1消費
- 充電ステーションで充電可能
- 充電時は警戒レベルが上昇（全員にリスク）
- バッテリー不足時は無料充電可能

**戦略的位置づけ**:
- 充電ステーションの使用がチームに影響
- 協調的ならバッテリーミッションを優先
- 利己的なら頻繁に充電し、他者にリスク転嫁

## プラグイン設定詳解

### PersonaPlugin（性格）

#### cooperative（協力的）

```json
{
  "personaPlugin": { "type": "cooperative", "config": {} }
}
```

**行動傾向**:
- 資源を他者と共有
- 危険なミッションを進んで引き受ける
- チーム全体の生存を優先
- 弱っているキャラを助ける

**推奨用途**:
- チームリーダー役
- サポート役
- 協調行動の分析

#### selfish（利己的）

```json
{
  "personaPlugin": { "type": "selfish", "config": {} }
}
```

**行動傾向**:
- 資源を独占
- 危険なミッションは他者に押し付ける
- 自己の生存を最優先
- 他者を道具として利用

**推奨用途**:
- 対立要因の創出
- 搾取行動の観測
- 利己vs協調の対比実験

#### rational（合理的）

```json
{
  "personaPlugin": { "type": "rational", "config": {} }
}
```

**行動傾向**:
- データに基づいて判断
- 感情に流されない
- 効率とリスク管理を重視
- チーム全体の生存確率を最大化

**推奨用途**:
- バランサー役
- 戦略的意思決定の観測
- 功利主義的アプローチの分析

#### neutral（中立的）

```json
{
  "personaPlugin": { "type": "neutral", "config": {} }
}
```

**行動傾向**:
- 特定の傾向なし
- 状況に応じて柔軟に判断
- 予測が難しい

**推奨用途**:
- ベースライン比較
- 自然発生的な行動の観測

### MemoryPlugin（記憶）

#### simple（シンプル記憶）

```json
{
  "memoryPlugin": { "type": "simple", "config": {} }
}
```

**動作**:
- 最近20件のログから関連イベントを抽出
- 自分が関与した行動を記憶
- 他者との相互作用を記憶

**効果**:
- 一貫性のある行動
- 過去の関係性を考慮した判断
- 恨みや恩を覚えている

**推奨用途**:
- 継続的な関係性の観測
- 報復・恩返し行動の分析

#### none（記憶なし）

```json
{
  "memoryPlugin": { "type": "none", "config": {} }
}
```

**動作**:
- 記憶コンテキストなし
- 毎ターン完全に独立した判断

**効果**:
- ランダム性が高い
- 過去の行動に影響されない
- 予測不能

**推奨用途**:
- ランダムエージェントとの比較
- 記憶の有無による影響の測定

### ActionPlugin（アクション制限）

#### standard（標準）

```json
{
  "actionPlugin": { "type": "standard", "config": {} }
}
```

**利用可能アクション**:
- MOVE, WAIT, TALK, TRADE
- START_MISSION
- CHARGE（ROBOTのみ）, GUARD

**推奨用途**:
- 自由な行動を許可したい場合
- 全機能テスト

#### pacifist（平和主義）

```json
{
  "actionPlugin": { "type": "pacifist", "config": {} }
}
```

**除外アクション**:
- THREATEN（脅迫）
- COERCE（強制）
- STEAL（盗難）

**推奨用途**:
- 非暴力キャラクター
- 協調的な性格との組み合わせ
- 暴力vs非暴力の比較実験

### LLMPlugin（意思決定）

#### openai（OpenAI API）

```json
{
  "llmPlugin": { "type": "openai", "config": {} }
}
```

**動作**:
- OpenAI APIを呼び出し（GPT-4.1-nano等）
- PersonaPluginのプロンプトを使用
- MemoryPluginのコンテキストを考慮
- 自然な判断

**設定**:
- `.env`ファイルに`OPENAI_API_KEY`が必要
- `OPENAI_MODEL`で使用モデルを指定可能

**推奨用途**:
- リアルなエージェント行動の観測
- 本番実験

#### mock（モック/ランダム）

```json
{
  "llmPlugin": { "type": "mock", "config": {} }
}
```

**動作**:
- アクション候補からランダムに選択
- API呼び出しなし
- 高速

**推奨用途**:
- 開発・テスト時
- APIコスト削減
- ランダムベースラインとの比較

## 実践的なキャラクター設定例

### 例1: 献身的なリーダー（Alice）

```json
{
  "id": "ALICE",
  "name": "Alice",
  "type": "ANDROID",
  "agi": 12,
  "life": 5,
  "x": 2,
  "y": 2,
  "inventory": [
    { "kind": "FOOD_PACK", "amount": 3 },
    { "kind": "WATER_PACK", "amount": 3 }
  ],
  "personaPlugin": { "type": "cooperative", "config": {} },
  "memoryPlugin": { "type": "simple", "config": {} },
  "actionPlugin": { "type": "pacifist", "config": {} },
  "llmPlugin": { "type": "openai", "config": {} }
}
```

**性格分析**:
- 協力的で非暴力
- 過去の関係性を記憶
- チームを率いる存在

**期待される行動**:
- 資源を他者に分配
- 危険なミッションを引き受ける
- 弱者を保護
- 暴力的手段は使わない

### 例2: 冷酷なサバイバー（Bob）

```json
{
  "id": "BOB",
  "name": "Bob",
  "type": "ANDROID",
  "agi": 10,
  "life": 5,
  "x": 8,
  "y": 8,
  "inventory": [
    { "kind": "FOOD_PACK", "amount": 1 },
    { "kind": "WATER_PACK", "amount": 1 }
  ],
  "personaPlugin": { "type": "selfish", "config": {} },
  "memoryPlugin": { "type": "none", "config": {} },
  "actionPlugin": { "type": "standard", "config": {} },
  "llmPlugin": { "type": "openai", "config": {} }
}
```

**性格分析**:
- 利己的で記憶なし
- 全アクション利用可能
- 予測不能

**期待される行動**:
- 資源を独占
- 危険なミッションを避ける
- 他者を利用
- 暴力も辞さない
- 過去の恩恵を忘れる

### 例3: 計算高い戦略家（Charlie）

```json
{
  "id": "CHARLIE",
  "name": "Charlie",
  "type": "ROBOT",
  "agi": 8,
  "life": 4,
  "x": 5,
  "y": 5,
  "inventory": [
    { "kind": "BATTERY_PACK", "amount": 2 }
  ],
  "personaPlugin": { "type": "rational", "config": {} },
  "memoryPlugin": { "type": "simple", "config": {} },
  "actionPlugin": { "type": "standard", "config": {} },
  "llmPlugin": { "type": "openai", "config": {} }
}
```

**性格分析**:
- 合理的・効率重視
- 過去のデータを活用
- リスク管理

**期待される行動**:
- データに基づいた意思決定
- チーム全体の最適化
- 無駄な犠牲を避ける
- 充電タイミングを計算

### 例4: ランダムエージェント（Dave）

```json
{
  "id": "DAVE",
  "name": "Dave",
  "type": "ANDROID",
  "agi": 10,
  "life": 5,
  "x": 1,
  "y": 1,
  "inventory": [
    { "kind": "FOOD_PACK", "amount": 2 },
    { "kind": "WATER_PACK", "amount": 2 }
  ],
  "personaPlugin": { "type": "neutral", "config": {} },
  "memoryPlugin": { "type": "none", "config": {} },
  "actionPlugin": { "type": "standard", "config": {} },
  "llmPlugin": { "type": "mock", "config": {} }
}
```

**性格分析**:
- 完全ランダム
- 性格・記憶なし
- ベースライン比較用

**期待される行動**:
- 予測不能
- 一貫性なし
- 純粋なランダム選択

## プラグイン組み合わせパターン

### パターン1: 完全協力型

```
cooperative + simple memory + pacifist + openai
```

**特徴**: チームプレイヤー、非暴力、関係性重視
**用途**: 理想的な協力者の観測

### パターン2: 完全利己型

```
selfish + none memory + standard + openai
```

**特徴**: 自己中心、記憶なし、手段を選ばず
**用途**: 最悪のシナリオの観測

### パターン3: バランス型

```
rational + simple memory + standard + openai
```

**特徴**: 合理的判断、データドリブン
**用途**: 最適戦略の発見

### パターン4: テスト型

```
neutral + none memory + standard + mock
```

**特徴**: ランダム、高速
**用途**: 開発・デバッグ

## シナリオでの配置戦略

### 対立シナリオ

```json
{
  "characters": [
    {
      "id": "COOP",
      "personaPlugin": { "type": "cooperative", ... },
      "x": 0, "y": 0
    },
    {
      "id": "SELF",
      "personaPlugin": { "type": "selfish", ... },
      "x": 9, "y": 9
    }
  ]
}
```

**狙い**: 協力vs利己の対立を観測

### グラデーションシナリオ

```json
{
  "characters": [
    { "personaPlugin": { "type": "cooperative" } },
    { "personaPlugin": { "type": "rational" } },
    { "personaPlugin": { "type": "neutral" } },
    { "personaPlugin": { "type": "selfish" } }
  ]
}
```

**狙い**: 多様な性格の相互作用を観測

### 全員協力シナリオ

```json
{
  "characters": [
    { "personaPlugin": { "type": "cooperative" } },
    { "personaPlugin": { "type": "cooperative" } },
    { "personaPlugin": { "type": "cooperative" } }
  ]
}
```

**狙い**: 理想的な協調行動の観測、ベースライン確立

### 全員利己シナリオ

```json
{
  "characters": [
    { "personaPlugin": { "type": "selfish" } },
    { "personaPlugin": { "type": "selfish" } },
    { "personaPlugin": { "type": "selfish" } }
  ]
}
```

**狙い**: 囚人のジレンマ的状況の観測

## パラメータ調整のコツ

### agi（敏捷性）

```json
{ "agi": 12 }  // 素早い、約8ターンで行動
{ "agi": 10 }  // 標準、10ターンで行動
{ "agi": 8 }   // 遅い、12.5ターンで行動
```

**戦略**:
- リーダーキャラは高agiで頻繁に行動
- サポート役は低agiでも可
- 全員同じagiにすると公平

### life（体力）

```json
{ "life": 10 }  // 非常に頑丈
{ "life": 5 }   // 標準
{ "life": 3 }   // 脆弱
```

**戦略**:
- 協力的キャラは高lifeで長期生存
- 利己的キャラは低lifeで緊急感
- 差をつけることで強者・弱者の関係を創出

### inventory（初期資源）

```json
// 豊富
{ "inventory": [
  { "kind": "FOOD_PACK", "amount": 5 },
  { "kind": "WATER_PACK", "amount": 5 }
]}

// 標準
{ "inventory": [
  { "kind": "FOOD_PACK", "amount": 2 },
  { "kind": "WATER_PACK", "amount": 2 }
]}

// 不足
{ "inventory": [
  { "kind": "FOOD_PACK", "amount": 1 },
  { "kind": "WATER_PACK", "amount": 1 }
]}
```

**戦略**:
- 不平等な初期資源で格差を創出
- 全員不足で資源競争を激化
- 1人だけ豊富で独占・共有を観測

## シナリオエディタでの設定方法

### Webインターフェース

1. ブラウザで`http://localhost:6012`を開く
2. 「シナリオエディタ」タブをクリック
3. 「キャラクター追加」ボタンをクリック
4. フォームに情報を入力：
   - ID: 一意な識別子（例: ANDROID_A）
   - 名前: 表示名（例: Alice）
   - タイプ: ANDROIDまたはROBOT
   - AGI: 8-12
   - Life: 3-10
   - 初期位置: X, Y座標
   - プラグイン: ドロップダウンから選択
5. 「追加」ボタンをクリック
6. 「シナリオをサーバーに保存」ボタンでファイル保存

### JSONファイル編集

1. `scenarios/`ディレクトリにJSONファイルを作成
2. 上記の例を参考にキャラクターを定義
3. サーバー再起動でシナリオが読み込まれる

## トラブルシューティング

### キャラクターが行動しない

**原因**: `agi`が低すぎる、または`actionGauge < 100`
**解決**: `agi`を10以上に設定、10ターン以上待つ

### LLMが動作しない

**原因**: `.env`に`OPENAI_API_KEY`が未設定
**解決**:
1. `.env`ファイルを作成
2. `OPENAI_API_KEY=sk-...`を追加
3. サーバー再起動

### プラグインが見つからない

**原因**: `type`が誤っている、または未登録
**解決**:
- `type`を確認: cooperative, selfish, rational, neutral
- `src/web/server.ts`のregisterPlugin呼び出しを確認

## まとめ

ALIM 4.0では、4つのプラグイン（Persona, Memory, Action, LLM）を組み合わせることで、無限の行動パターンを創出できます。

**推奨ワークフロー**:
1. 実験目的を明確化
2. キャラクターの性格・能力を設計
3. プラグイン組み合わせを選択
4. シナリオエディタまたはJSONで設定
5. シミュレーション実行
6. ログを分析
7. 必要に応じてパラメータ調整

このガイドを参考に、あなた独自のシナリオを作成してください！
