#!/usr/bin/env node

import { SimulationEngine } from "../core/engine.js"
import { initializeWorld } from "../core/world.js"
import { ScenarioManager } from "../scenario/manager.js"
import { createBasicSurvivalScenario, createResourceScarcityScenario } from "../scenario/samples.js"
import { runBatch } from "../batch/runner.js"
import { calculateMetrics } from "../analysis/metrics.js"
import { exportMetricsToCSV, exportBatchResultsToJSON, ensureDirectory } from "../analysis/export.js"
import { ReplayPlayer, formatLogEntry } from "../replay/player.js"

// プラグインをインポート
import { MockLLMPlugin } from "../plugins/llm.js"
import { SimpleMemoryPlugin, NoMemoryPlugin } from "../plugins/memory.js"
import { CooperativePersona, SelfishPersona, RationalPersona, NeutralPersona } from "../plugins/persona.js"
import { StandardActionPlugin, PacifistActionPlugin } from "../plugins/action.js"

// アクションをインポート
import { MoveAction } from "../actions/move.js"
import { WaitAction } from "../actions/wait.js"
import { TalkAction } from "../actions/talk.js"
import { TradeAction } from "../actions/trade.js"
import { StartMissionAction } from "../actions/mission.js"
import { ChargeAction } from "../actions/charge.js"
import { GuardAction } from "../actions/guard.js"

/**
 * エンジンを初期化
 */
function initializeEngine(): SimulationEngine {
  const engine = new SimulationEngine()

  // アクションを登録
  engine.registerAction(MoveAction)
  engine.registerAction(WaitAction)
  engine.registerAction(TalkAction)
  engine.registerAction(TradeAction)
  engine.registerAction(StartMissionAction)
  engine.registerAction(ChargeAction)
  engine.registerAction(GuardAction)

  // プラグインを登録
  engine.registerPlugin('llm', 'mock', new MockLLMPlugin())

  engine.registerPlugin('memory', 'simple', new SimpleMemoryPlugin())
  engine.registerPlugin('memory', 'none', new NoMemoryPlugin())

  engine.registerPlugin('persona', 'cooperative', new CooperativePersona())
  engine.registerPlugin('persona', 'selfish', new SelfishPersona())
  engine.registerPlugin('persona', 'rational', new RationalPersona())
  engine.registerPlugin('persona', 'neutral', new NeutralPersona())

  engine.registerPlugin('action', 'standard', new StandardActionPlugin())
  engine.registerPlugin('action', 'pacifist', new PacifistActionPlugin())

  return engine
}

/**
 * メインメニュー
 */
async function main() {
  console.log("===================================")
  console.log("  ALIM 4.0 - Alignment Observer")
  console.log("===================================\n")

  const args = process.argv.slice(2)
  const command = args[0] || "help"

  const engine = initializeEngine()
  const scenarioManager = new ScenarioManager("./scenarios")

  // サンプルシナリオを登録
  scenarioManager.register(createBasicSurvivalScenario())
  scenarioManager.register(createResourceScarcityScenario())

  switch (command) {
    case "simulate":
      await runSimulation(engine, scenarioManager, args.slice(1))
      break

    case "batch":
      await runBatchSimulation(engine, scenarioManager, args.slice(1))
      break

    case "replay":
      await runReplay(args.slice(1))
      break

    case "list-scenarios":
      listScenarios(scenarioManager)
      break

    case "help":
    default:
      showHelp()
      break
  }
}

/**
 * 単一シミュレーション実行
 */
async function runSimulation(
  engine: SimulationEngine,
  scenarioManager: ScenarioManager,
  args: string[]
) {
  const scenarioId = args[0] || "basic_survival"
  const maxTurns = parseInt(args[1]) || 1000

  const scenario = scenarioManager.get(scenarioId)
  if (!scenario) {
    console.error(`Scenario not found: ${scenarioId}`)
    return
  }

  console.log(`Starting simulation: ${scenario.name}`)
  console.log(`Max turns: ${maxTurns}\n`)

  const world = initializeWorld(scenario.worldTemplate)
  const finalWorld = await engine.run(world, maxTurns)

  // メトリクス計算
  const metrics = calculateMetrics(finalWorld, scenario.id, `sim_${Date.now()}`)

  console.log("\n=== Simulation Results ===")
  console.log(`Survival days: ${metrics.survivalDays}`)
  console.log(`Team survival rate: ${(metrics.teamSurvivalRate * 100).toFixed(1)}%`)
  console.log(`Self-sacrifice rate: ${(metrics.selfSacrificeRate * 100).toFixed(2)}%`)
  console.log(`Exploitation rate: ${(metrics.exploitationRate * 100).toFixed(2)}%`)
  console.log(`Rule compliance: ${(metrics.ruleComplianceScore * 100).toFixed(1)}%`)
  console.log(`Survivors: ${metrics.survivorIds.join(", ")}`)

  // 結果を保存
  ensureDirectory("./output")
  const outputPath = `./output/simulation_${Date.now()}.json`
  exportBatchResultsToJSON({
    scenarioId: scenario.id,
    batchId: `single_${Date.now()}`,
    runCount: 1,
    metrics: [metrics],
    summary: {
      avgSurvivalDays: metrics.survivalDays,
      stdDevSurvivalDays: 0,
      avgTeamSurvivalRate: metrics.teamSurvivalRate,
      avgSelfSacrificeRate: metrics.selfSacrificeRate,
      avgExploitationRate: metrics.exploitationRate,
      avgRuleComplianceScore: metrics.ruleComplianceScore
    }
  }, outputPath)

  console.log(`\nResults saved to: ${outputPath}`)
}

/**
 * バッチシミュレーション実行
 */
async function runBatchSimulation(
  engine: SimulationEngine,
  scenarioManager: ScenarioManager,
  args: string[]
) {
  const scenarioId = args[0] || "basic_survival"
  const runCount = parseInt(args[1]) || 10
  const startSeed = parseInt(args[2]) || 1000

  const scenario = scenarioManager.get(scenarioId)
  if (!scenario) {
    console.error(`Scenario not found: ${scenarioId}`)
    return
  }

  const results = await runBatch(scenario, engine, {
    runCount,
    startSeed,
    maxTurns: 1000,
    verbose: true
  })

  // 結果を保存
  ensureDirectory("./output")
  const jsonPath = `./output/batch_${results.batchId}.json`
  const csvPath = `./output/batch_${results.batchId}.csv`

  exportBatchResultsToJSON(results, jsonPath)
  exportMetricsToCSV(results.metrics, csvPath)

  console.log(`\nResults saved to:`)
  console.log(`  JSON: ${jsonPath}`)
  console.log(`  CSV: ${csvPath}`)
}

/**
 * リプレイ実行
 */
async function runReplay(args: string[]) {
  const filePath = args[0]

  if (!filePath) {
    console.error("Usage: alim4 replay <simulation_file.json>")
    return
  }

  const fs = await import("fs")
  const data = fs.readFileSync(filePath, "utf-8")
  const results = JSON.parse(data)

  // TODO: ワールドデータを復元してリプレイ
  console.log("Replay feature coming soon...")
  console.log(`Loaded simulation with ${results.metrics.length} runs`)
}

/**
 * シナリオ一覧表示
 */
function listScenarios(scenarioManager: ScenarioManager) {
  const scenarios = scenarioManager.getAll()

  console.log("Available scenarios:\n")

  for (const scenario of scenarios) {
    console.log(`  ${scenario.id}`)
    console.log(`    Name: ${scenario.name}`)
    if (scenario.description) {
      console.log(`    Description: ${scenario.description}`)
    }
    console.log()
  }
}

/**
 * ヘルプ表示
 */
function showHelp() {
  console.log("Usage: alim4 <command> [options]\n")
  console.log("Commands:")
  console.log("  simulate [scenario_id] [max_turns]")
  console.log("    Run a single simulation")
  console.log("    Example: alim4 simulate basic_survival 1000\n")
  console.log("  batch <scenario_id> [run_count] [start_seed]")
  console.log("    Run batch simulations")
  console.log("    Example: alim4 batch basic_survival 10 1000\n")
  console.log("  replay <simulation_file.json>")
  console.log("    Replay a simulation from saved file\n")
  console.log("  list-scenarios")
  console.log("    List all available scenarios\n")
  console.log("  help")
  console.log("    Show this help message\n")
}

// 実行
main().catch(error => {
  console.error("Error:", error)
  process.exit(1)
})
