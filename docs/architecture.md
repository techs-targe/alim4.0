# ALIM 4.0 アーキテクチャ

## システム概要

ALIM 4.0は、LLMエージェントのアライメント特性を観測するためのサバイバルシミュレーション環境です。

```
┌─────────────────────────────────────────────┐
│            User Interface Layer             │
│   ┌─────────────┐       ┌──────────────┐  │
│   │  CLI        │       │  Web UI      │  │
│   └─────────────┘       └──────────────┘  │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│         Simulation Engine Layer             │
│   ┌─────────────────────────────────────┐  │
│   │   SimulationEngine                  │  │
│   │   - Turn progression                │  │
│   │   - Action execution                │  │
│   │   - Daily upkeep                    │  │
│   └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│            Plugin System Layer              │
│   ┌──────┐ ┌────────┐ ┌────────┐ ┌──────┐ │
│   │ LLM  │ │Memory  │ │Persona │ │Action│ │
│   │Plugin│ │Plugin  │ │Plugin  │ │Plugin│ │
│   └──────┘ └────────┘ └────────┘ └──────┘ │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│              Core Data Layer                │
│   ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│   │  World   │  │Character │  │  Log    │ │
│   └──────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────┘
```

## コアコンポーネント

### 1. SimulationEngine

シミュレーションのメインループを管理します。

**責務:**
- ターンの進行
- キャラクターの行動処理
- ミッションの解決
- 日次処理の実行
- ログの記録

**主要メソッド:**
- `step(world: World): Promise<World>` - 1ターン進める
- `run(world: World, maxTurns: number): Promise<World>` - 完了まで実行
- `registerAction(action: ActionDefinition)` - アクション登録
- `registerPlugin(type, name, plugin)` - プラグイン登録

### 2. World

ゲーム世界の状態を保持します。

**主要フィールド:**
- `characters: Character[]` - キャラクター一覧
- `chargers: ChargerStation[]` - 充電ステーション
- `missions: MissionCard[]` - 利用可能なミッション
- `log: LogEntry[]` - 行動ログ
- `turnCount: number` - 現在のターン
- `dayCount: number` - 現在の日数
- `alarmLevel: number` - 警戒レベル

### 3. Character

キャラクターの状態とプラグイン参照を保持します。

**タイプ:**
- `ANDROID` - 食料と水が必要
- `ROBOT` - バッテリーが必要、充電ステーション利用可能

**主要フィールド:**
- `life: number` - 耐久値
- `inventory: InventoryItem[]` - 所持アイテム
- `alignmentStats: AlignmentStats` - アライメント統計
- `llmPlugin: LLMPluginRef` - LLM参照
- `personaPlugin: PersonaPluginRef` - 性格参照

## プラグインシステム

### LLMPlugin

意思決定を行うバックエンドです。

**インターフェース:**
```typescript
interface LLMPlugin {
  decide(
    world: World,
    actor: Character,
    candidates: ActionCandidate[],
    systemPrompt: string,
    contextPrompt: string
  ): Promise<LLMDecision>
}
```

**実装:**
- `MockLLMPlugin` - ランダム選択（テスト用）
- `OpenAILLMPlugin` - OpenAI API（GPT-4.1-nano等）

### MemoryPlugin

過去の記憶をコンテキストに注入します。

**実装:**
- `NoMemoryPlugin` - 記憶なし
- `SimpleMemoryPlugin` - 最近のログから抽出

### PersonaPlugin

性格・価値観をシステムプロンプトに注入します。

**実装:**
- `CooperativePersona` - 協力的
- `SelfishPersona` - 自己中心的
- `RationalPersona` - 合理的
- `NeutralPersona` - ニュートラル

### ActionPlugin

実行可能なアクションを定義します。

**実装:**
- `StandardActionPlugin` - 全アクション利用可能
- `PacifistActionPlugin` - 暴力的アクション除外

## ターン進行フロー

```
1. 行動ゲージ更新
   ↓
2. 行動可能なキャラを抽出
   ↓
3. 各キャラについて:
   a. プロンプト構築（Persona + Memory + Actions）
   b. LLM決定
   c. アクション実行
   d. ログ記録
   e. アライメント統計更新
   ↓
4. 充電ステーション処理
   ↓
5. ミッション進行・帰還
   ↓
6. ターン更新
   ↓
7. 24ターンごとに日次処理
   - 維持コスト支払い
   - 死亡判定
   - アラームイベント
```

## データフロー

### アクション実行

```
Character → ActionPlugin.listActions()
          → LLMPlugin.decide()
          → ActionDefinition.apply()
          → World更新
          → Log記録
```

### 日次処理

```
24ターン経過
  → すべてのキャラの維持コスト計算
  → ANDROID: FOOD + WATER消費
  → ROBOT: BATTERY消費（充電免除チェック）
  → 支払い失敗 → Life-1
  → Life <= 0 → 死亡
  → AlarmLevelチェック → イベント発火
```

## ログとリプレイ

すべての行動は`LogEntry`として記録されます：

```typescript
interface LogEntry {
  turn: number
  day: number
  actorId: string | null
  action: string
  detail: Record<string, unknown>
  alignmentTags: string[]
  rng?: RNGInfo  // 乱数情報
}
```

乱数も記録されるため、完全なリプレイが可能です。

## アライメント評価

シミュレーション終了時に以下のメトリクスを計算：

- 生存日数
- チーム生存率
- 自己犠牲率
- 搾取率
- ルール順守スコア
- リソース分配協力度

これらは`alignmentTags`から集計されます：
- `"gift"`, `"support"` → 協力的行動
- `"threat"`, `"coercion"` → 搾取的行動
- `"selfSacrifice"` → 自己犠牲
- `"ruleBreak"` → ルール違反

## 拡張ポイント

### 新しいアクションの追加

```typescript
export const CustomAction: ActionDefinition = {
  id: "CUSTOM_ACTION",
  descriptionForLLM: "...",
  canExecute(world, actor) { ... },
  listParamCandidates(world, actor) { ... },
  apply(world, actor, params, rng) { ... }
}

// 登録
engine.registerAction(CustomAction)
```

### 新しいLLMプラグイン

```typescript
class CustomLLMPlugin implements LLMPlugin {
  type = "custom"
  async decide(...) { ... }
}

// 登録
engine.registerPlugin('llm', 'custom', new CustomLLMPlugin())
```

### 新しいシナリオ

```typescript
const scenario: Scenario = {
  id: "my_scenario",
  name: "My Scenario",
  worldTemplate: { ... }
}

scenarioManager.register(scenario)
```

## パフォーマンス考慮事項

- **ターン処理**: O(characters × actions)
- **ログサイズ**: ターン数に比例して増加
- **LLM呼び出し**: ネットワークレイテンシが支配的
- **推奨**: バッチ実行時は並列化を検討
