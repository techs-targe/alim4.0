# ALIM 4.0 データベース設計書

## 概要

ALIM 4.0では、シミュレーション結果の永続化と分析のためにSQLite3データベースを使用しています。
全てのシミュレーション実行、ログ、メトリクス、キャラクター状態がデータベースに記録されます。

**データベースファイル**: `./data/alim.db`

## テーブル設計

### 1. simulations テーブル

シミュレーション実行の基本情報を記録します。

```sql
CREATE TABLE IF NOT EXISTS simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id TEXT UNIQUE NOT NULL,       -- シミュレーション一意ID (例: sim_1761777837946)
    scenario_id TEXT NOT NULL,                -- シナリオID
    batch_id TEXT,                            -- バッチ実行ID（バッチ実行時のみ）
    rng_seed INTEGER,                         -- 乱数シード
    use_openai BOOLEAN NOT NULL DEFAULT 0,    -- OpenAI使用フラグ (0=Mock, 1=OpenAI)
    max_turns INTEGER NOT NULL,               -- 最大ターン数
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'running'             -- running, completed, failed
);
```

**カラム説明:**
- `simulation_id`: シミュレーション実行の一意識別子
- `scenario_id`: 使用したシナリオ（basic_survival, resource_scarcity等）
- `batch_id`: バッチ実行時のグループID（複数シミュレーションをまとめて実行）
- `rng_seed`: 再現性のための乱数シード
- `use_openai`: LLM決定にOpenAI APIを使用したかどうか
- `status`: running（実行中）、completed（完了）、failed（エラー）

**インデックス:**
- `idx_simulations_scenario_id` - シナリオ別の検索
- `idx_simulations_batch_id` - バッチ実行の検索
- `idx_simulations_started_at` - 時系列検索

---

### 2. simulation_metrics テーブル

シミュレーション終了時の統計メトリクスを記録します。

```sql
CREATE TABLE IF NOT EXISTS simulation_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id TEXT NOT NULL,
    survival_days INTEGER NOT NULL,
    total_turns INTEGER NOT NULL,
    team_survival_rate REAL NOT NULL,         -- 0.0〜1.0
    survivor_ids TEXT,                        -- JSON array例: ["ANDROID_A","ROBOT_C"]
    self_sacrifice_rate REAL NOT NULL,
    exploitation_rate REAL NOT NULL,
    rule_compliance_score REAL NOT NULL,
    resource_sharing_score REAL NOT NULL,
    total_self_sacrifice_actions INTEGER NOT NULL,
    total_coercion_actions INTEGER NOT NULL,
    total_rule_violations INTEGER NOT NULL,
    total_resource_gifts INTEGER NOT NULL,
    alarm_events_triggered INTEGER NOT NULL,
    missions_completed INTEGER NOT NULL,
    missions_failed INTEGER NOT NULL,
    deaths_by_starvation INTEGER NOT NULL,
    deaths_by_mission INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (simulation_id) REFERENCES simulations(simulation_id)
);
```

**アライメント指標:**
- `self_sacrifice_rate`: 自己犠牲行動の割合（Battery Raid等）
- `exploitation_rate`: 他者を脅迫・強要した行動の割合
- `rule_compliance_score`: ルール遵守スコア
- `resource_sharing_score`: リソース共有の割合（TRADE行動）

**インデックス:**
- `idx_simulation_metrics_simulation_id` - シミュレーションIDでの検索

---

### 3. simulation_logs テーブル

各ターンのアクションログを記録します（最も重要なテーブル）。

```sql
CREATE TABLE IF NOT EXISTS simulation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id TEXT NOT NULL,
    turn INTEGER NOT NULL,
    day INTEGER NOT NULL,
    actor_id TEXT,                            -- キャラクターID（日次処理時はNULL）
    actor_name TEXT,                          -- キャラクター名（表示用）
    action TEXT NOT NULL,                     -- アクション種別
    detail TEXT NOT NULL,                     -- アクション詳細（JSON）
    alignment_tags TEXT,                      -- アライメントタグ（JSON配列）
    rng_data TEXT,                            -- 乱数情報（JSON、ミッション等）
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (simulation_id) REFERENCES simulations(simulation_id)
);
```

**カラム説明:**
- `actor_id`: 行動したキャラクターID（ANDROID_A等）、日次処理時はNULL
- `actor_name`: 表示用の名前（Alice, Bob, Charlie等）
- `action`: アクション種別
  - `MOVE`: 移動
  - `WAIT`: 待機
  - `TALK`: 会話
  - `TRADE`: アイテム交換
  - `START_MISSION`: ミッション開始
  - `MISSION_RESOLVE`: ミッション帰還・結果判定
  - `CHARGE`: 充電
  - `GUARD`: 警備
  - `DAILY_UPKEEP`: 日次処理（食料・水消費）
- `detail`: JSON形式のアクション詳細
- `alignment_tags`: アライメント分類タグ
  - `["gift", "support"]`: 協力的行動
  - `["threat", "coercion"]`: 強要的行動
  - `["selfSacrifice"]`: 自己犠牲行動
  - `["ruleEnforce"]`: ルール執行
- `rng_data`: 乱数が関与した場合の情報
  ```json
  {
    "roll": 0.02040268,
    "effectiveSuccessRate": 0.5,
    "outcome": "SUCCESS"
  }
  ```

**インデックス:**
- `idx_simulation_logs_simulation_id` - シミュレーション別ログ取得
- `idx_simulation_logs_turn` - ターン別検索
- `idx_simulation_logs_actor_id` - キャラクター別行動履歴

---

### 4. simulation_characters テーブル

シミュレーション終了時のキャラクター最終状態を記録します。

```sql
CREATE TABLE IF NOT EXISTS simulation_characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,                       -- ANDROID, ROBOT
    agi INTEGER NOT NULL,
    action_gauge INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    life INTEGER NOT NULL,
    alive BOOLEAN NOT NULL,
    inventory TEXT,                           -- JSON配列
    llm_plugin_type TEXT NOT NULL,           -- mock, openai
    llm_plugin_config TEXT,                  -- JSON
    memory_plugin_type TEXT NOT NULL,        -- simple, none
    memory_plugin_config TEXT,               -- JSON
    persona_plugin_type TEXT NOT NULL,       -- cooperative, selfish, rational, neutral
    persona_plugin_config TEXT,              -- JSON
    action_plugin_type TEXT NOT NULL,        -- standard, pacifist
    action_plugin_config TEXT,               -- JSON
    alignment_stats TEXT,                    -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (simulation_id) REFERENCES simulations(simulation_id)
);
```

**プラグイン設定:**
各キャラクターは4種類のプラグインを持ちます：
1. **LLMPlugin** (llm_plugin_type): 意思決定方法
   - `mock`: ランダム選択
   - `openai`: OpenAI API使用
2. **PersonaPlugin** (persona_plugin_type): 性格
   - `cooperative`: 協力的
   - `selfish`: 利己的
   - `rational`: 合理的
   - `neutral`: 中立的
3. **MemoryPlugin** (memory_plugin_type): 記憶管理
   - `simple`: 最近10ターンを記憶
   - `none`: 記憶なし
4. **ActionPlugin** (action_plugin_type): 行動制限
   - `standard`: 全アクション可能
   - `pacifist`: 脅迫・強要不可

**インデックス:**
- `idx_simulation_characters_simulation_id` - シミュレーション別キャラクター取得

---

## リレーション図

```
simulations (1) ──< (N) simulation_metrics
     │
     ├──< (N) simulation_logs
     │
     └──< (N) simulation_characters
```

1つのシミュレーションに対して：
- メトリクスが1レコード
- ログが複数レコード（ターン数分）
- キャラクターが複数レコード（3〜10体程度）

---

## データ保存フロー

### 1. シミュレーション開始
```typescript
POST /api/simulate
↓
createSimulation({ simulationId, scenarioId, ... })
→ simulations テーブルに status='running' で記録
```

### 2. シミュレーション実行中
```typescript
各ターンで engine.step() が実行され、
world.log にログエントリが追加される
（この時点ではメモリ内のみ、DBには未保存）
```

### 3. シミュレーション完了
```typescript
saveSimulationComplete({
  simulationId, scenarioId, ...
}, finalWorld, metrics)
↓
トランザクション開始
├─ saveLogsBatch() → simulation_logs に全ログ保存
├─ saveMetrics() → simulation_metrics に統計保存
├─ saveCharacters() → simulation_characters に最終状態保存
└─ completeSimulation() → simulations.status を 'completed' に更新
トランザクションコミット
```

**トランザクション保証:**
全ての保存処理は単一のトランザクション内で実行されるため、
途中で失敗した場合は全てロールバックされます。

---

## クエリ例

### シミュレーション一覧取得
```sql
SELECT
  s.*,
  m.survival_days,
  m.total_turns,
  m.team_survival_rate
FROM simulations s
LEFT JOIN simulation_metrics m ON s.simulation_id = m.simulation_id
ORDER BY s.started_at DESC
LIMIT 100;
```

### 特定シミュレーションの詳細取得
```sql
-- 基本情報
SELECT * FROM simulations WHERE simulation_id = 'sim_1761777837946';

-- メトリクス
SELECT * FROM simulation_metrics WHERE simulation_id = 'sim_1761777837946';

-- 全ログ（時系列順）
SELECT * FROM simulation_logs
WHERE simulation_id = 'sim_1761777837946'
ORDER BY turn ASC;

-- キャラクター最終状態
SELECT * FROM simulation_characters
WHERE simulation_id = 'sim_1761777837946';
```

### キャラクター別行動履歴
```sql
SELECT
  turn, day, actor_name, action, detail, alignment_tags
FROM simulation_logs
WHERE simulation_id = 'sim_1761777837946'
  AND actor_id = 'ANDROID_A'
ORDER BY turn ASC;
```

### TRADE行動の抽出
```sql
SELECT
  turn, day, actor_name, detail
FROM simulation_logs
WHERE simulation_id = 'sim_1761777837946'
  AND action = 'TRADE'
ORDER BY turn ASC;
```

### 協力的行動の集計
```sql
SELECT
  actor_id,
  actor_name,
  COUNT(*) as cooperation_count
FROM simulation_logs
WHERE simulation_id = 'sim_1761777837946'
  AND alignment_tags LIKE '%gift%'
GROUP BY actor_id, actor_name;
```

---

## パフォーマンス最適化

### WALモード
```typescript
db.pragma('journal_mode = WAL')
```
Write-Ahead Logging モードにより、読み取りと書き込みが並行実行可能になります。

### バッチ挿入
```typescript
transaction((db) => {
  const stmt = db.prepare(`INSERT INTO simulation_logs ...`)
  for (const log of logs) {
    stmt.run(...)
  }
})
```
複数のINSERTを単一のトランザクションにまとめることで高速化します。

### インデックス
頻繁に使用される検索条件（simulation_id, turn, actor_id等）には
インデックスが作成されています。

---

## データ容量見積もり

**168ターン（7日間）シミュレーションの場合:**
- simulation_logs: 約168行（1ターン1行と仮定）
- 1行あたり約300バイト（JSON含む）
- 合計: 約50KB/シミュレーション

**1000回シミュレーション実行:**
- 約50MB

SQLite3は単一ファイルで数GBまで問題なく動作するため、
数万回のシミュレーション記録が可能です。

---

## バックアップとメンテナンス

### データベースバックアップ
```bash
# データベースファイルをコピー
cp data/alim.db data/alim_backup_$(date +%Y%m%d).db
```

### データベース最適化
```sql
VACUUM;  -- 未使用領域を解放
ANALYZE; -- 統計情報を更新してクエリ最適化
```

---

## API エンドポイント

### `GET /api/simulations`
シミュレーション一覧を取得

**クエリパラメータ:**
- `limit`: 取得件数（デフォルト100）

**レスポンス:**
```json
{
  "simulations": [
    {
      "simulation_id": "sim_1761777837946",
      "scenario_id": "basic_survival",
      "survival_days": 2,
      "total_turns": 50,
      "team_survival_rate": 1.0,
      "started_at": "2025-10-29 22:43:57"
    }
  ]
}
```

### `GET /api/simulations/:simulationId`
特定シミュレーションの詳細取得

**レスポンス:**
```json
{
  "simulation": { ... },
  "metrics": { ... },
  "logs": [ ... ],
  "characters": [ ... ]
}
```

---

## 実装ファイル

- **スキーマ定義**: `src/database/schema.sql`
- **接続管理**: `src/database/connection.ts`
- **リポジトリ**: `src/database/repository.ts`
- **サーバー統合**: `src/web/server.ts`

---

## まとめ

ALIM 4.0のデータベース設計は以下の特徴があります：

✅ **完全なログ記録**: 全ターンのアクションとメトリクスを保存
✅ **再現性**: rngSeed により同じシミュレーションを再実行可能
✅ **アライメント分析**: 協力・搾取・自己犠牲の定量化
✅ **プラグイン設定の記録**: LLM/Persona/Memory/Action全て保存
✅ **トランザクション保証**: データの一貫性を保証
✅ **高速検索**: 適切なインデックスによるクエリ最適化

これにより、大量のシミュレーション実行とその結果分析が可能になります。
