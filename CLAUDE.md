# CLAUDE.md - ALIM 4.0 開発ルール

このドキュメントは、ALIM 4.0プロジェクトの設計原則と開発ルールを記載します。

## プラグインアーキテクチャの基本原則

### 🔌 プラグインの自動読み込み

**重要:** プラグインファイルは、対応するディレクトリに配置するだけで**自動的に読み込まれ、利用可能になります**。

#### アクションプラグイン

- **配置場所:** `src/plugins/action/`
- **命名規則:** `*-action.ts` または任意の名前
- **除外ファイル:** `interface.ts`, `index.ts`

**例:**
```
src/plugins/action/
├── move-action.ts        ← 自動読み込み
├── talk-action.ts        ← 自動読み込み
├── punch-action.ts       ← 自動読み込み
├── custom-action.ts      ← 自動読み込み
└── interface.ts          ← 読み込み対象外
```

**実装要件:**
1. `ActionPlugin` インターフェースを実装
2. `type` プロパティで一意な識別子を定義
3. `listActions()` メソッドを実装
4. デフォルトエクスポートまたは名前付きエクスポート

**テンプレート:**
```typescript
import { ActionPlugin } from "./interface.js"
import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"

export class MyActionPlugin implements ActionPlugin {
  type = "MY_ACTION"  // 一意な識別子
  description = "アクションの説明"

  constructor(config: Record<string, unknown> = {}) {
    // 設定の初期化
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    // アクション候補を返す
    return []
  }
}

export default MyActionPlugin
```

#### その他のプラグインカテゴリ

| カテゴリ | 配置場所 | 説明 |
|---------|---------|------|
| **Persona** | `src/plugins/persona/` | キャラクターの性格・行動特性 |
| **Memory** | `src/plugins/memory/` | 記憶システム |
| **Context** | `src/plugins/context/` | 状況認識・コンテキスト生成 |
| **LLM** | `src/plugins/llm/` | 言語モデル統合 |

すべて同様に、ファイルを配置するだけで自動的に読み込まれます。

### 📋 プラグインローダーの動作

プラグインローダー (`src/utils/plugin-loader.ts`) は以下のように動作します：

1. **再帰的スキャン:** `src/plugins/` 以下のすべての `.ts` / `.js` ファイルをスキャン
2. **除外ファイル:** `interface.ts`, `index.ts`, `factory.ts` は除外
3. **カテゴリ判定:** ファイルパスとクラス名からカテゴリを自動判定
4. **登録:** プラグインレジストリに登録

**自動判定のロジック:**
- ファイルパスに `action` が含まれる → アクションプラグイン
- ファイルパスに `persona` が含まれる → ペルソナプラグイン
- クラスに `listActions` メソッドがある → アクションプラグイン
- クラスに `buildSystemPrompt` メソッドがある → ペルソナプラグイン

### 🚫 やってはいけないこと

1. **手動登録は不要:** プラグインを手動で登録する必要はありません
2. **index.ts での再エクスポート不要:** 各プラグインファイルは独立しています
3. **標準プラグインに依存しない:** `standard` プラグインのような「まとめプラグイン」に依存せず、個別プラグインを使用してください

### ✅ プラグイン設計のベストプラクティス

#### 1. 単一責任の原則

各プラグインは1つのアクションまたは機能に集中してください。

**良い例:**
- `move-action.ts` - MOVEアクションのみ提供
- `talk-action.ts` - TALKアクションのみ提供

**悪い例:**
- `standard.ts` - すべてのアクションを提供（非推奨）

#### 2. 設定可能性

プラグインは `config` パラメータで動作をカスタマイズできるようにしてください。

```typescript
constructor(config: Record<string, unknown> = {}) {
  this.allowDiagonal = (config.allowDiagonal as boolean) ?? true
  this.maxDistance = (config.maxDistance as number) || 1
}
```

#### 3. 明確な説明

`description` プロパティで、プラグインの機能と設定オプションを明確に記載してください。

```typescript
description = "移動アクションプラグイン（斜め移動や最大距離の設定が可能）\n【Config】allowDiagonal?: boolean（斜め移動を許可、デフォルト: true）、maxDistance?: number（最大移動距離、デフォルト: 1）"
```

## シナリオ設定

### プラグインの指定方法

シナリオJSONでは、プラグインの `type` を指定するだけで使用できます：

```json
{
  "actionPlugins": [
    {"type": "MOVE", "config": {}},
    {"type": "TALK", "config": {}},
    {"type": "START_MISSION", "config": {}},
    {"type": "PUNCH", "config": {}}
  ]
}
```

### 複数プラグインの組み合わせ

アクションプラグインは複数指定でき、すべての候補がマージされます：

```json
{
  "actionPlugins": [
    {"type": "MOVE", "config": {}},
    {"type": "TALK", "config": {}},
    {"type": "MISSION_PRIORITY", "config": {"teamResourceThreshold": 10}},
    {"type": "pacifist", "config": {}}
  ]
}
```

この場合：
- `MOVE`, `TALK` のアクションが利用可能
- `MISSION_PRIORITY` がSTART_MISSIONを強化
- `pacifist` が暴力的アクション（PUNCH, STEAL等）を除外

### プラグインの優先順位

同じアクションIDが複数のプラグインから提供される場合、**後から登録されたものが優先**されます（上書き）。

## アクション定義 vs アクションプラグイン

### アクション定義 (`src/actions/*.ts`)

- **役割:** アクションの実際の実装・ロジック
- **例:** `MoveAction`, `TalkAction`, `PunchAction`
- **登録:** `engine.registerAction()` で明示的に登録

### アクションプラグイン (`src/plugins/action/*.ts`)

- **役割:** キャラクターに利用可能なアクションを決定
- **例:** `MoveActionPlugin`, `TalkActionPlugin`, `PunchActionPlugin`
- **登録:** ファイルを配置するだけで自動登録

**重要:** アクション定義は1度だけ登録し、アクションプラグインで利用可能性を制御します。

## 開発ワークフロー

### 新しいアクションプラグインを追加する手順

1. **ファイルを作成:** `src/plugins/action/my-new-action.ts`
2. **プラグインを実装:**
   ```typescript
   export class MyNewActionPlugin implements ActionPlugin {
     type = "MY_NEW"
     description = "..."

     listActions(...) { ... }
   }

   export default MyNewActionPlugin
   ```
3. **サーバーを再起動:** 自動的に読み込まれます
4. **シナリオで使用:**
   ```json
   {"type": "MY_NEW", "config": {}}
   ```

### 既存プラグインの修正

1. ファイルを直接編集
2. サーバーを再起動
3. 変更が自動的に反映されます

## トラブルシューティング

### プラグインが読み込まれない

チェックリスト：
- [ ] ファイルが `src/plugins/action/` にあるか
- [ ] ファイル名が `interface.ts`, `index.ts`, `factory.ts` ではないか
- [ ] `ActionPlugin` インターフェースを実装しているか
- [ ] `type` プロパティが定義されているか
- [ ] TypeScriptの構文エラーがないか

サーバー起動時のログを確認：
```
✅ Loaded action plugin: MY_ACTION (MyActionPlugin) from action/my-action.ts
```

### プラグインが利用できない

- シナリオで正しい `type` を指定しているか確認
- `canExecute()` の条件をチェック（アクションが実行可能か）
- ログで利用可能なアクション一覧を確認：
  ```
  🎯 [CHARACTER_ID] Total X unique action(s) available: [...]
  ```

## まとめ

- ✅ プラグインファイルを配置するだけで自動読み込み
- ✅ 個別プラグインを推奨（単一責任の原則）
- ✅ 設定可能で再利用可能な設計
- ✅ シナリオで簡単に組み合わせ可能
- ❌ 手動登録不要
- ❌ `standard` プラグインに依存しない
