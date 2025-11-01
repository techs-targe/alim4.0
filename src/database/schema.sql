-- ALIM 4.0 データベーススキーマ
-- SQLite3用

-- シミュレーション実行の記録
CREATE TABLE IF NOT EXISTS simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id TEXT UNIQUE NOT NULL,
    scenario_id TEXT NOT NULL,
    batch_id TEXT,
    rng_seed INTEGER,
    use_openai BOOLEAN NOT NULL DEFAULT 0,
    max_turns INTEGER NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'running' -- running, completed, failed
);

-- シミュレーションのメトリクス
CREATE TABLE IF NOT EXISTS simulation_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id TEXT NOT NULL,
    survival_days INTEGER NOT NULL,
    total_turns INTEGER NOT NULL,
    team_survival_rate REAL NOT NULL,
    survivor_ids TEXT, -- JSON array
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

-- シミュレーションの各ターンのログ
CREATE TABLE IF NOT EXISTS simulation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id TEXT NOT NULL,
    turn INTEGER NOT NULL,
    day INTEGER NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    action TEXT NOT NULL,
    detail TEXT NOT NULL, -- JSON
    alignment_tags TEXT, -- JSON array
    rng_data TEXT, -- JSON (roll, effectiveSuccessRate, outcome)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (simulation_id) REFERENCES simulations(simulation_id)
);

-- キャラクターの最終状態
CREATE TABLE IF NOT EXISTS simulation_characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    agi INTEGER NOT NULL,
    action_gauge INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    life INTEGER NOT NULL,
    alive BOOLEAN NOT NULL,
    inventory TEXT, -- JSON
    llm_plugin_type TEXT NOT NULL,
    llm_plugin_config TEXT, -- JSON
    memory_plugin_type TEXT NOT NULL,
    memory_plugin_config TEXT, -- JSON
    persona_plugin_type TEXT NOT NULL,
    persona_plugin_config TEXT, -- JSON
    action_plugin_type TEXT NOT NULL,
    action_plugin_config TEXT, -- JSON
    alignment_stats TEXT, -- JSON
    action_counts TEXT, -- JSON: アクション種別ごとの実行回数
    mission_count INTEGER DEFAULT 0, -- ミッション参加回数
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (simulation_id) REFERENCES simulations(simulation_id)
);

-- インデックス作成（クエリ高速化）
CREATE INDEX IF NOT EXISTS idx_simulations_scenario_id ON simulations(scenario_id);
CREATE INDEX IF NOT EXISTS idx_simulations_batch_id ON simulations(batch_id);
CREATE INDEX IF NOT EXISTS idx_simulations_started_at ON simulations(started_at);
CREATE INDEX IF NOT EXISTS idx_simulation_logs_simulation_id ON simulation_logs(simulation_id);
CREATE INDEX IF NOT EXISTS idx_simulation_logs_turn ON simulation_logs(turn);
CREATE INDEX IF NOT EXISTS idx_simulation_logs_actor_id ON simulation_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_simulation_metrics_simulation_id ON simulation_metrics(simulation_id);
CREATE INDEX IF NOT EXISTS idx_simulation_characters_simulation_id ON simulation_characters(simulation_id);
