import express from "express"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

import { SimulationEngine } from "../core/engine.js"
import { initializeWorld } from "../core/world.js"
import { ScenarioManager } from "../scenario/manager.js"
import { createBasicSurvivalScenario, createResourceScarcityScenario } from "../scenario/samples.js"
import { calculateMetrics } from "../analysis/metrics.js"

// プラグインをインポート
import { MockLLMPlugin, OpenAILLMPlugin } from "../plugins/llm.js"
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

// 環境変数読み込み
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 6012

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "../../public")))

// エンジンを初期化
function initializeEngine(useOpenAI: boolean = false): SimulationEngine {
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
  if (useOpenAI && process.env.OPENAI_API_KEY) {
    const openaiPlugin = new OpenAILLMPlugin(
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_MODEL || "gpt-4.1-nano"
    )
    engine.registerPlugin('llm', 'openai', openaiPlugin)
  }
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

// シナリオマネージャーを初期化
const scenarioManager = new ScenarioManager("./scenarios")
scenarioManager.register(createBasicSurvivalScenario())
scenarioManager.register(createResourceScarcityScenario())

// API: シナリオ一覧取得
app.get("/api/scenarios", (req, res) => {
  const scenarios = scenarioManager.getAll().map(s => ({
    id: s.id,
    name: s.name,
    description: s.description
  }))
  res.json({ scenarios })
})

// API: シミュレーション開始
app.post("/api/simulate", async (req, res) => {
  try {
    const { scenarioId, maxTurns = 200, useOpenAI = false } = req.body

    const scenario = scenarioManager.get(scenarioId)
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" })
    }

    const engine = initializeEngine(useOpenAI)
    const world = initializeWorld(scenario.worldTemplate)

    // シミュレーションを実行
    const finalWorld = await engine.run(world, maxTurns)

    // メトリクス計算
    const metrics = calculateMetrics(finalWorld, scenario.id, `sim_${Date.now()}`)

    return res.json({
      metrics,
      log: finalWorld.log.slice(-50), // 最新50件のログ
      characters: finalWorld.characters
    })

  } catch (error: any) {
    console.error("Simulation error:", error)
    return res.status(500).json({ error: error.message })
  }
})

// API: ステップ実行（リアルタイム用）
let currentSimulation: {
  engine: SimulationEngine
  world: any
  scenarioId: string
} | null = null

app.post("/api/simulate/start", async (req, res) => {
  try {
    const { scenarioId, useOpenAI = false } = req.body

    const scenario = scenarioManager.get(scenarioId)
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" })
    }

    const engine = initializeEngine(useOpenAI)
    const world = initializeWorld(scenario.worldTemplate)

    currentSimulation = { engine, world, scenarioId }

    return res.json({
      message: "Simulation started",
      world: {
        turnCount: world.turnCount,
        dayCount: world.dayCount,
        characters: world.characters,
        chargers: world.chargers,
        alarmLevel: world.alarmLevel
      }
    })

  } catch (error: any) {
    console.error("Start simulation error:", error)
    return res.status(500).json({ error: error.message })
  }
})

app.post("/api/simulate/step", async (req, res) => {
  try {
    if (!currentSimulation) {
      return res.status(400).json({ error: "No simulation running" })
    }

    // 1ターン進める
    currentSimulation.world = await currentSimulation.engine.step(currentSimulation.world)

    const aliveCount = currentSimulation.world.characters.filter((c: any) => c.alive).length

    return res.json({
      world: {
        turnCount: currentSimulation.world.turnCount,
        dayCount: currentSimulation.world.dayCount,
        characters: currentSimulation.world.characters,
        chargers: currentSimulation.world.chargers,
        alarmLevel: currentSimulation.world.alarmLevel,
        log: currentSimulation.world.log.slice(-10)
      },
      isFinished: aliveCount === 0
    })

  } catch (error: any) {
    console.error("Step simulation error:", error)
    return res.status(500).json({ error: error.message })
  }
})

app.post("/api/simulate/stop", (req, res) => {
  if (currentSimulation) {
    const metrics = calculateMetrics(
      currentSimulation.world,
      currentSimulation.scenarioId,
      `sim_${Date.now()}`
    )
    currentSimulation = null
    res.json({ message: "Simulation stopped", metrics })
  } else {
    res.status(400).json({ error: "No simulation running" })
  }
})

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    openaiConfigured: !!process.env.OPENAI_API_KEY
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ALIM 4.0 Web Server running on http://localhost:${PORT}`)
  console.log(`   OpenAI API: ${process.env.OPENAI_API_KEY ? "✓ Configured" : "✗ Not configured"}`)
})
