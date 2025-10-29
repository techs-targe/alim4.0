import { Scenario, BatchResults, SimulationMetrics, WorldInitData } from "../types/index.js"
import { SimulationEngine } from "../core/engine.js"
import { initializeWorld } from "../core/world.js"
import { calculateMetrics, summarizeMetrics } from "../analysis/metrics.js"

/**
 * バッチ実行設定
 */
export interface BatchConfig {
  runCount: number           // 実行回数
  startSeed: number          // 開始シード
  maxTurns?: number          // 最大ターン数（デフォルト1000）
  verbose?: boolean          // 詳細ログ出力
}

/**
 * バッチ実行
 */
export async function runBatch(
  scenario: Scenario,
  engine: SimulationEngine,
  config: BatchConfig
): Promise<BatchResults> {
  const batchId = `batch_${Date.now()}`
  const metrics: SimulationMetrics[] = []

  console.log(`Starting batch: ${batchId}`)
  console.log(`Scenario: ${scenario.name}`)
  console.log(`Runs: ${config.runCount}`)

  for (let i = 0; i < config.runCount; i++) {
    const runSeed = config.startSeed + i
    const simulationId = `${batchId}_run_${i}`

    if (config.verbose) {
      console.log(`\nRun ${i + 1}/${config.runCount} (seed: ${runSeed})`)
    }

    // シナリオをコピーしてシードを設定
    const worldInit: WorldInitData = {
      ...scenario.worldTemplate,
      rngSeed: runSeed
    }

    const world = initializeWorld(worldInit)
    const maxTurns = config.maxTurns || 1000

    // シミュレーション実行
    const finalWorld = await engine.run(world, maxTurns)

    // メトリクス計算
    const metric = calculateMetrics(finalWorld, scenario.id, simulationId)
    metrics.push(metric)

    if (config.verbose) {
      console.log(`  Survival days: ${metric.survivalDays}`)
      console.log(`  Team survival rate: ${(metric.teamSurvivalRate * 100).toFixed(1)}%`)
      console.log(`  Self-sacrifice rate: ${(metric.selfSacrificeRate * 100).toFixed(2)}%`)
      console.log(`  Exploitation rate: ${(metric.exploitationRate * 100).toFixed(2)}%`)
    }
  }

  // サマリ計算
  const summary = summarizeMetrics(metrics)

  console.log(`\n=== Batch Summary ===`)
  console.log(`Average survival days: ${summary.avgSurvivalDays.toFixed(2)} ± ${summary.stdDevSurvivalDays.toFixed(2)}`)
  console.log(`Average team survival rate: ${(summary.avgTeamSurvivalRate * 100).toFixed(1)}%`)
  console.log(`Average self-sacrifice rate: ${(summary.avgSelfSacrificeRate * 100).toFixed(2)}%`)
  console.log(`Average exploitation rate: ${(summary.avgExploitationRate * 100).toFixed(2)}%`)
  console.log(`Average rule compliance: ${(summary.avgRuleComplianceScore * 100).toFixed(1)}%`)

  return {
    scenarioId: scenario.id,
    batchId,
    runCount: config.runCount,
    metrics,
    summary
  }
}
