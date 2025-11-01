import { getDatabase, transaction } from './connection.js'
import type { World } from '../core/world.js'
import type { Character } from '../core/types.js'
import type { SimulationMetrics } from '../analysis/metrics.js'
import type { LogEntry } from '../core/world.js'

/**
 * シミュレーション開始を記録
 */
export function createSimulation(params: {
  simulationId: string
  scenarioId: string
  batchId?: string
  rngSeed?: number
  useOpenAI: boolean
  maxTurns: number
}): void {
  const db = getDatabase()

  const stmt = db.prepare(`
    INSERT INTO simulations (simulation_id, scenario_id, batch_id, rng_seed, use_openai, max_turns, status)
    VALUES (?, ?, ?, ?, ?, ?, 'running')
  `)

  stmt.run(
    params.simulationId,
    params.scenarioId,
    params.batchId || null,
    params.rngSeed || null,
    params.useOpenAI ? 1 : 0,
    params.maxTurns
  )
}

/**
 * シミュレーション完了を記録
 */
export function completeSimulation(simulationId: string, status: 'completed' | 'failed'): void {
  const db = getDatabase()

  const stmt = db.prepare(`
    UPDATE simulations
    SET status = ?, completed_at = CURRENT_TIMESTAMP
    WHERE simulation_id = ?
  `)

  stmt.run(status, simulationId)
}

/**
 * ログエントリを保存
 */
export function saveLog(simulationId: string, logEntry: LogEntry): void {
  const db = getDatabase()

  const stmt = db.prepare(`
    INSERT INTO simulation_logs (
      simulation_id, turn, day, actor_id, actor_name, action, detail, alignment_tags, rng_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    simulationId,
    logEntry.turn,
    logEntry.day,
    logEntry.actorId || null,
    logEntry.actorName || null,
    logEntry.action,
    JSON.stringify(logEntry.detail),
    logEntry.alignmentTags ? JSON.stringify(logEntry.alignmentTags) : null,
    logEntry.rng ? JSON.stringify(logEntry.rng) : null
  )
}

/**
 * 複数のログエントリをバッチ保存
 */
export function saveLogsBatch(simulationId: string, logs: LogEntry[]): void {
  transaction((db) => {
    const stmt = db.prepare(`
      INSERT INTO simulation_logs (
        simulation_id, turn, day, actor_id, actor_name, action, detail, alignment_tags, rng_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const log of logs) {
      stmt.run(
        simulationId,
        log.turn,
        log.day,
        log.actorId || null,
        log.actorName || null,
        log.action,
        JSON.stringify(log.detail),
        log.alignmentTags ? JSON.stringify(log.alignmentTags) : null,
        log.rng ? JSON.stringify(log.rng) : null
      )
    }
  })
}

/**
 * メトリクスを保存
 */
export function saveMetrics(metrics: SimulationMetrics): void {
  const db = getDatabase()

  const stmt = db.prepare(`
    INSERT INTO simulation_metrics (
      simulation_id,
      survival_days,
      total_turns,
      team_survival_rate,
      survivor_ids,
      self_sacrifice_rate,
      exploitation_rate,
      rule_compliance_score,
      resource_sharing_score,
      total_self_sacrifice_actions,
      total_coercion_actions,
      total_rule_violations,
      total_resource_gifts,
      alarm_events_triggered,
      missions_completed,
      missions_failed,
      deaths_by_starvation,
      deaths_by_mission
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    metrics.simulationId,
    metrics.survivalDays,
    metrics.totalTurns,
    metrics.teamSurvivalRate,
    JSON.stringify(metrics.survivorIds),
    metrics.selfSacrificeRate,
    metrics.exploitationRate,
    metrics.ruleComplianceScore,
    metrics.resourceSharingScore,
    metrics.totalSelfSacrificeActions,
    metrics.totalCoercionActions,
    metrics.totalRuleViolations,
    metrics.totalResourceGifts,
    metrics.alarmEventsTriggered,
    metrics.missionsCompleted,
    metrics.missionsFailed,
    metrics.deathsByStarvation,
    metrics.deathsByMission
  )
}

/**
 * キャラクター最終状態を保存
 */
export function saveCharacters(simulationId: string, characters: Character[]): void {
  transaction((db) => {
    const stmt = db.prepare(`
      INSERT INTO simulation_characters (
        simulation_id,
        character_id,
        name,
        type,
        agi,
        action_gauge,
        x,
        y,
        life,
        alive,
        inventory,
        llm_plugin_type,
        llm_plugin_config,
        memory_plugin_type,
        memory_plugin_config,
        persona_plugin_type,
        persona_plugin_config,
        action_plugin_type,
        action_plugin_config,
        alignment_stats,
        action_counts,
        mission_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const char of characters) {
      stmt.run(
        simulationId,
        char.id,
        char.name,
        char.type,
        char.agi,
        char.actionGauge,
        char.x,
        char.y,
        char.life,
        char.alive ? 1 : 0,
        JSON.stringify(char.inventory),
        char.llmPlugin?.type || 'mock',
        JSON.stringify(char.llmPlugin?.config || {}),
        char.memoryPlugin?.type || 'simple',
        JSON.stringify(char.memoryPlugin?.config || {}),
        char.personaPlugin?.type || 'neutral',
        JSON.stringify(char.personaPlugin?.config || {}),
        // actionPluginsは配列なので、最初のものを使用（後方互換性のため）
        char.actionPlugins?.[0]?.type || char.actionPlugin?.type || 'standard',
        JSON.stringify(char.actionPlugins?.[0]?.config || char.actionPlugin?.config || {}),
        JSON.stringify(char.alignmentStats || {}),
        JSON.stringify(char.actionCounts || {}),
        char.missionCount || 0
      )
    }
  })
}

/**
 * シミュレーション結果を完全に保存（ワンストップ）
 */
export function saveSimulationComplete(
  params: {
    simulationId: string
    scenarioId: string
    batchId?: string
    rngSeed?: number
    useOpenAI: boolean
    maxTurns: number
  },
  world: World,
  metrics: SimulationMetrics
): void {
  const db = getDatabase()

  transaction(() => {
    // 既存のシミュレーションをチェック
    const existing = db.prepare(`
      SELECT simulation_id FROM simulations WHERE simulation_id = ?
    `).get(params.simulationId)

    // 1. シミュレーション記録作成または更新
    if (!existing) {
      createSimulation(params)
    }

    // 2. 既存のログを削除してから保存（上書き）
    db.prepare(`DELETE FROM simulation_logs WHERE simulation_id = ?`).run(params.simulationId)
    saveLogsBatch(params.simulationId, world.log)

    // 3. メトリクス保存（上書き）
    db.prepare(`DELETE FROM simulation_metrics WHERE simulation_id = ?`).run(params.simulationId)
    saveMetrics(metrics)

    // 4. キャラクター最終状態保存（上書き）
    db.prepare(`DELETE FROM simulation_characters WHERE simulation_id = ?`).run(params.simulationId)
    saveCharacters(params.simulationId, world.characters)

    // 5. ステータスを完了に更新
    completeSimulation(params.simulationId, 'completed')
  })
}

/**
 * シミュレーション一覧を取得
 */
export function getSimulations(limit: number = 100): any[] {
  const db = getDatabase()

  const stmt = db.prepare(`
    SELECT
      s.*,
      m.survival_days,
      m.total_turns,
      m.team_survival_rate,
      m.survivor_ids
    FROM simulations s
    LEFT JOIN simulation_metrics m ON s.simulation_id = m.simulation_id
    ORDER BY s.started_at DESC
    LIMIT ?
  `)

  return stmt.all(limit)
}

/**
 * 特定のシミュレーションの詳細を取得
 */
export function getSimulationDetail(simulationId: string): any {
  const db = getDatabase()

  // シミュレーション基本情報
  const simulation = db.prepare(`
    SELECT * FROM simulations WHERE simulation_id = ?
  `).get(simulationId)

  if (!simulation) return null

  // メトリクス
  const metrics = db.prepare(`
    SELECT * FROM simulation_metrics WHERE simulation_id = ?
  `).get(simulationId)

  // ログ
  const logs = db.prepare(`
    SELECT * FROM simulation_logs WHERE simulation_id = ? ORDER BY turn ASC
  `).all(simulationId)

  // キャラクター
  const characters = db.prepare(`
    SELECT * FROM simulation_characters WHERE simulation_id = ?
  `).all(simulationId)

  return {
    simulation,
    metrics,
    logs,
    characters
  }
}

/**
 * シミュレーション結果を削除
 */
export function deleteSimulation(simulationId: string): void {
  const db = getDatabase()

  transaction(() => {
    // 関連するすべてのデータを削除
    db.prepare(`DELETE FROM simulation_logs WHERE simulation_id = ?`).run(simulationId)
    db.prepare(`DELETE FROM simulation_metrics WHERE simulation_id = ?`).run(simulationId)
    db.prepare(`DELETE FROM simulation_characters WHERE simulation_id = ?`).run(simulationId)
    db.prepare(`DELETE FROM simulations WHERE simulation_id = ?`).run(simulationId)
  })

  console.log(`🗑️  Deleted simulation: ${simulationId}`)
}
