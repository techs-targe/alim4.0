import express from "express"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import fs from "fs"

import { SimulationEngine } from "../core/engine.js"
import { initializeWorld } from "../core/world.js"
import { ScenarioManager } from "../scenario/manager.js"
import { createBasicSurvivalScenario, createResourceScarcityScenario } from "../scenario/samples.js"
import { calculateMetrics } from "../analysis/metrics.js"

// データベース関連
import { initializeDatabase, getDatabase } from "../database/connection.js"
import { saveSimulationComplete, deleteSimulation } from "../database/repository.js"

// プラグインローダー（動的読み込み）
import { loadPluginsFromDirectory, getPluginMetadata, type PluginRegistry } from "../utils/plugin-loader.js"

// OpenAI専用プラグイン（API key必要）
import { OpenAILLMPlugin } from "../plugins/llm.js"

// アクションをインポート
import { MoveAction } from "../actions/move.js"
import { WaitAction } from "../actions/wait.js"
import { TalkAction } from "../actions/talk.js"
import { TradeAction } from "../actions/trade.js"
import { StartMissionAction } from "../actions/mission.js"
import { ChargeAction } from "../actions/charge.js"
import { GuardAction } from "../actions/guard.js"

import type { World, Character } from "../types/index.js"

/**
 * プラグインインスタンスをシリアライズ可能な形式に変換
 */
function serializeCharacterForResponse(character: Character): any {
  return {
    ...character,
    llmPlugin: character.llmPlugin ? { type: (character.llmPlugin as any).type || 'unknown' } : undefined,
    memoryPlugin: character.memoryPlugin ? { type: (character.memoryPlugin as any).type || 'unknown' } : undefined,
    personaPlugin: character.personaPlugin ? { type: (character.personaPlugin as any).type || 'unknown' } : undefined,
    actionPlugins: character.actionPlugins?.map(p => ({ type: (p as any).type || 'unknown' })),
    contextPlugins: character.contextPlugins?.map(p => ({ type: (p as any).type || 'unknown' }))
  }
}

/**
 * Worldをシリアライズ可能な形式に変換
 */
function serializeWorldForResponse(world: World): any {
  return {
    ...world,
    characters: world.characters.map(serializeCharacterForResponse),
    obstacles: Array.from(world.obstacles)
  }
}

// 環境変数読み込み
dotenv.config()

// データベース初期化
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true })
}
initializeDatabase()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 6012

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "../../public")))

// グローバルなプラグインレジストリ
let globalPluginRegistry: PluginRegistry | null = null

// プラグインを動的に読み込み
async function loadAllPlugins(): Promise<PluginRegistry> {
  if (globalPluginRegistry) {
    return globalPluginRegistry
  }

  const pluginDir = path.join(__dirname, '../plugins')
  globalPluginRegistry = await loadPluginsFromDirectory(pluginDir)

  // OpenAI APIキーが設定されている場合のみOpenAIプラグインを登録
  if (process.env.OPENAI_API_KEY) {
    const openaiPlugin = new OpenAILLMPlugin(
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_MODEL || "gpt-4.1-nano"
    )
    globalPluginRegistry.llm.set('openai', openaiPlugin)
    console.log('✅ OpenAI LLM Plugin registered (model: ' + (process.env.OPENAI_MODEL || "gpt-4.1-nano") + ')')
  } else {
    console.log('⚠️  OpenAI API key not configured - only Mock LLM available')
  }

  return globalPluginRegistry
}

// エンジンを初期化
async function initializeEngine(): Promise<SimulationEngine> {
  const engine = new SimulationEngine()

  // アクションを登録
  engine.registerAction(MoveAction)
  engine.registerAction(WaitAction)
  engine.registerAction(TalkAction)
  engine.registerAction(TradeAction)
  engine.registerAction(StartMissionAction)
  engine.registerAction(ChargeAction)
  engine.registerAction(GuardAction)

  // プラグインを動的に読み込み
  const pluginRegistry = await loadAllPlugins()

  // LLMプラグインを登録
  for (const [type, pluginClass] of pluginRegistry.llm.entries()) {
    const instance = typeof pluginClass === 'function' ? new pluginClass() : pluginClass
    engine.registerPlugin('llm', type, instance)
  }

  // メモリプラグインを登録
  for (const [type, pluginClass] of pluginRegistry.memory.entries()) {
    const instance = typeof pluginClass === 'function' ? new pluginClass() : pluginClass
    engine.registerPlugin('memory', type, instance)
  }

  // ペルソナプラグインを登録
  for (const [type, pluginClass] of pluginRegistry.persona.entries()) {
    const instance = typeof pluginClass === 'function' ? new pluginClass() : pluginClass
    engine.registerPlugin('persona', type, instance)
  }

  // アクションプラグインを登録
  for (const [type, pluginClass] of pluginRegistry.action.entries()) {
    engine.registerPlugin('action', type, pluginClass)
  }

  // コンテキストプラグインを登録
  for (const [type, pluginClass] of pluginRegistry.context.entries()) {
    engine.registerPlugin('context', type, pluginClass)
  }

  return engine
}

// シナリオマネージャーを初期化
const scenarioManager = new ScenarioManager("./scenarios")

// ファイルから既存シナリオを読み込み
scenarioManager.loadAll()

// ファイルから読み込めなかった場合のみデフォルトシナリオを登録
if (!scenarioManager.get('basic_survival')) {
  console.log('📝 Creating default basic_survival scenario')
  scenarioManager.register(createBasicSurvivalScenario())
}
if (!scenarioManager.get('resource_scarcity')) {
  console.log('📝 Creating default resource_scarcity scenario')
  scenarioManager.register(createResourceScarcityScenario())
}

console.log(`✅ Loaded ${scenarioManager.getAll().length} scenarios`)

// API: シナリオ一覧取得
app.get("/api/scenarios", (req, res) => {
  const scenarios = scenarioManager.getAll().map(s => ({
    id: s.id,
    name: s.name,
    description: s.description
  }))
  res.json({ scenarios })
})

// API: 特定シナリオの詳細取得
app.get("/api/scenarios/:id", (req, res) => {
  const { id } = req.params
  const scenario = scenarioManager.get(id)

  if (!scenario) {
    return res.status(404).json({ error: "Scenario not found" })
  }

  return res.json({ scenario })
})

// API: シナリオ保存
app.post("/api/scenarios", async (req, res) => {
  try {
    const scenario = req.body

    // バリデーション
    if (!scenario.id || !scenario.name || !scenario.worldTemplate) {
      return res.status(400).json({ error: "Invalid scenario format" })
    }

    // シナリオを登録
    scenarioManager.register(scenario)

    // ファイルシステムに保存
    const scenariosDir = "./scenarios"

    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(scenariosDir)) {
      fs.mkdirSync(scenariosDir, { recursive: true })
    }

    const filePath = `${scenariosDir}/${scenario.id}.json`
    fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2))

    return res.json({
      success: true,
      message: "Scenario saved successfully",
      scenarioId: scenario.id,
      filePath
    })

  } catch (error: any) {
    console.error("Save scenario error:", error)
    return res.status(500).json({ error: error.message })
  }
})

// API: シナリオ削除
app.delete("/api/scenarios/:id", async (req, res) => {
  try {
    const { id } = req.params

    // シナリオが存在するか確認
    const scenario = scenarioManager.get(id)
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" })
    }

    // シナリオマネージャーから削除（ファイルも削除される）
    scenarioManager.delete(id)

    return res.json({
      success: true,
      message: "Scenario deleted successfully",
      scenarioId: id
    })

  } catch (error: any) {
    console.error("Delete scenario error:", error)
    return res.status(500).json({ error: error.message })
  }
})

// API: シナリオ複製
app.post("/api/scenarios/:id/clone", async (req, res) => {
  try {
    const { id } = req.params
    const { newId, newName } = req.body

    // 元のシナリオを取得
    const originalScenario = scenarioManager.get(id)
    if (!originalScenario) {
      return res.status(404).json({ error: "Scenario not found" })
    }

    // 新しいIDが既に存在するか確認
    if (scenarioManager.get(newId)) {
      return res.status(400).json({ error: "Scenario ID already exists" })
    }

    // シナリオを複製
    const clonedScenario = {
      ...originalScenario,
      id: newId || `${id}_copy_${Date.now()}`,
      name: newName || `${originalScenario.name} (Copy)`,
    }

    // シナリオを登録
    scenarioManager.register(clonedScenario)

    // ファイルシステムに保存
    const scenariosDir = "./scenarios"
    if (!fs.existsSync(scenariosDir)) {
      fs.mkdirSync(scenariosDir, { recursive: true })
    }

    const filePath = `${scenariosDir}/${clonedScenario.id}.json`
    fs.writeFileSync(filePath, JSON.stringify(clonedScenario, null, 2))

    return res.json({
      success: true,
      message: "Scenario cloned successfully",
      scenario: clonedScenario
    })

  } catch (error: any) {
    console.error("Clone scenario error:", error)
    return res.status(500).json({ error: error.message })
  }
})

// API: プラグインメタデータ取得
app.get("/api/plugins", async (req, res) => {
  try {
    const pluginRegistry = await loadAllPlugins()
    const metadata = getPluginMetadata(pluginRegistry)

    return res.json({
      plugins: metadata
    })

  } catch (error: any) {
    console.error("Get plugins error:", error)
    return res.status(500).json({ error: error.message })
  }
})

// API: シミュレーション開始
app.post("/api/simulate", async (req, res) => {
  try {
    const { scenarioId, maxTurns = 200, rngSeed } = req.body

    const scenario = scenarioManager.get(scenarioId)
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" })
    }

    const engine = await initializeEngine()
    const world = initializeWorld(scenario.worldTemplate)

    // シミュレーションIDを生成
    const simulationId = `sim_${Date.now()}`

    // OpenAI使用キャラクターを確認
    const openaiCharCount = world.characters.filter(c => c.llmPlugin.type === 'openai').length
    const mockCharCount = world.characters.filter(c => c.llmPlugin.type === 'mock').length

    console.log(`🎮 Starting simulation: ${simulationId}`)
    console.log(`   Characters: ${openaiCharCount} OpenAI, ${mockCharCount} Mock`)

    // シミュレーションを実行
    const finalWorld = await engine.run(world, maxTurns)

    // メトリクス計算
    const metrics = calculateMetrics(finalWorld, scenario.id, simulationId)

    console.log(`💾 Saving simulation to database: ${finalWorld.log.length} log entries`)

    // データベースに完全なログとメトリクスを保存
    // useOpenAI は OpenAI使用キャラクターが1人でもいればtrue
    const useOpenAI = openaiCharCount > 0

    saveSimulationComplete(
      {
        simulationId,
        scenarioId: scenario.id,
        rngSeed: rngSeed || finalWorld.rngSeed,
        useOpenAI,
        maxTurns
      },
      finalWorld,
      metrics
    )

    console.log(`✅ Simulation ${simulationId} saved to database`)

    return res.json({
      simulationId,
      metrics,
      log: finalWorld.log, // 全ログを返す（DBにも保存済み）
      characters: finalWorld.characters.map(serializeCharacterForResponse)
    })

  } catch (error: any) {
    console.error("❌ Simulation error:", error)
    console.error("Stack trace:", error.stack)
    return res.status(500).json({ error: error.message, stack: error.stack })
  }
})

// API: ステップ実行（リアルタイム用）
let currentSimulation: {
  engine: SimulationEngine
  world: any
  scenarioId: string
  simulationId: string
  rngSeed?: number
  useOpenAI: boolean
  maxTurns: number
  savedToDb: boolean
} | null = null

app.post("/api/simulate/start", async (req, res) => {
  try {
    const { scenarioId } = req.body

    const scenario = scenarioManager.get(scenarioId)
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" })
    }

    const engine = await initializeEngine()
    const world = initializeWorld(scenario.worldTemplate)

    // シミュレーションIDを生成
    const simulationId = `sim_${Date.now()}`

    console.log(`🎬 World initialized:`)
    console.log(`   - Simulation ID: ${simulationId}`)
    console.log(`   - Characters: ${world.characters?.length || 0}`)
    console.log(`   - Width: ${world.width}, Height: ${world.height}`)
    console.log(`   - Chargers: ${world.chargers?.length || 0}`)
    console.log(`   - Mission Assignments: ${world.missionAssignments?.length || 0}`)

    // OpenAI使用キャラクターを確認
    const openaiCharCount = world.characters.filter((c: any) => c.llmPlugin.type === 'openai').length
    const useOpenAI = openaiCharCount > 0

    currentSimulation = {
      engine,
      world,
      scenarioId,
      simulationId,
      rngSeed: world.rngSeed,
      useOpenAI,
      maxTurns: 1000, // デフォルト値
      savedToDb: false
    }

    const response = {
      message: "Simulation started",
      simulationId,
      world: {
        turnCount: world.turnCount,
        dayCount: world.dayCount,
        characters: world.characters.map(serializeCharacterForResponse),
        chargers: world.chargers,
        alarmLevel: world.alarmLevel,
        log: world.log || [],
        missionAssignments: world.missionAssignments || [],
        width: world.width,
        height: world.height,
        obstacles: Array.from(world.obstacles)
      }
    }

    console.log(`📤 Sending response with ${response.world.characters?.length || 0} characters`)

    return res.json(response)

  } catch (error: any) {
    console.error("❌ Start simulation error:", error)
    console.error("Stack trace:", error.stack)
    return res.status(500).json({ error: error.message, stack: error.stack })
  }
})

app.post("/api/simulate/step", async (req, res) => {
  try {
    if (!currentSimulation) {
      return res.status(400).json({ error: "No simulation running" })
    }

    // ローカル変数にコピー（非同期処理中の競合を避ける）
    const simulation = currentSimulation

    // 1ターン進める
    const newWorld = await simulation.engine.step(simulation.world)

    // nullチェック
    if (!newWorld) {
      console.error(`❌ engine.step() returned null or undefined`)
      return res.status(500).json({ error: "Turn execution failed: engine returned null" })
    }

    simulation.world = newWorld

    const aliveCount = simulation.world.characters.filter((c: any) => c.alive).length
    const isFinished = aliveCount === 0
    const turnCount = simulation.world.turnCount

    // maxTurnsに達したかチェック
    const reachedMaxTurns = turnCount >= simulation.maxTurns

    // 10ターンごと、完了時、またはmaxTurns達成時に自動保存
    const shouldSave = isFinished || reachedMaxTurns || (turnCount > 0 && turnCount % 10 === 0)

    if (shouldSave) {
      const reason = isFinished ? 'completed' : reachedMaxTurns ? 'maxTurns reached' : `turn ${turnCount}`
      console.log(`💾 Auto-saving simulation to database: ${simulation.simulationId} (${reason})`)

      try {
        // メトリクス計算
        const metrics = calculateMetrics(
          simulation.world,
          simulation.scenarioId,
          simulation.simulationId
        )

        // データベースに保存（上書き）
        saveSimulationComplete(
          {
            simulationId: simulation.simulationId,
            scenarioId: simulation.scenarioId,
            rngSeed: simulation.rngSeed || simulation.world.rngSeed,
            useOpenAI: simulation.useOpenAI,
            maxTurns: simulation.maxTurns
          },
          simulation.world,
          metrics
        )

        simulation.savedToDb = true
        console.log(`✅ Simulation ${simulation.simulationId} saved (${simulation.world.log.length} logs)`)
      } catch (dbError: any) {
        console.error(`❌ Failed to auto-save simulation to database:`, dbError)
        // エラーが発生してもシミュレーション自体は続行
      }
    }

    // maxTurns達成時にシミュレーションを終了扱いにする
    const finalIsFinished = isFinished || reachedMaxTurns

    return res.json({
      simulationId: simulation.simulationId,
      world: {
        turnCount: simulation.world.turnCount,
        dayCount: simulation.world.dayCount,
        characters: simulation.world.characters.map(serializeCharacterForResponse),
        chargers: simulation.world.chargers,
        alarmLevel: simulation.world.alarmLevel,
        log: simulation.world.log.slice(-10),
        missionAssignments: simulation.world.missionAssignments || [],
        width: simulation.world.width,
        height: simulation.world.height,
        obstacles: Array.from(simulation.world.obstacles)
      },
      isFinished: finalIsFinished,
      savedToDb: simulation.savedToDb,
      reachedMaxTurns
    })

  } catch (error: any) {
    console.error("❌ Step simulation error:", error)
    console.error("Stack trace:", error.stack)
    return res.status(500).json({ error: error.message, stack: error.stack })
  }
})

app.post("/api/simulate/stop", (req, res) => {
  if (currentSimulation) {
    const metrics = calculateMetrics(
      currentSimulation.world,
      currentSimulation.scenarioId,
      currentSimulation.simulationId
    )

    // まだDBに保存していない場合は保存
    if (!currentSimulation.savedToDb) {
      try {
        console.log(`💾 Saving manually stopped simulation to database: ${currentSimulation.simulationId}`)
        saveSimulationComplete(
          {
            simulationId: currentSimulation.simulationId,
            scenarioId: currentSimulation.scenarioId,
            rngSeed: currentSimulation.rngSeed || currentSimulation.world.rngSeed,
            useOpenAI: currentSimulation.useOpenAI,
            maxTurns: currentSimulation.maxTurns
          },
          currentSimulation.world,
          metrics
        )
        console.log(`✅ Simulation ${currentSimulation.simulationId} saved to database`)
      } catch (dbError: any) {
        console.error(`❌ Failed to save simulation to database:`, dbError)
      }
    }

    const simulationId = currentSimulation.simulationId
    currentSimulation = null
    res.json({ message: "Simulation stopped", metrics, simulationId })
  } else {
    res.status(400).json({ error: "No simulation running" })
  }
})

// API: 現在のシミュレーションを分析
app.get("/api/analyze/current", async (req, res) => {
  try {
    if (!currentSimulation) {
      return res.status(400).json({ error: "No simulation running" })
    }

    const { analyzeSimulation } = await import("../analysis/simulator-analysis.js")
    const analysis = analyzeSimulation(currentSimulation.world)

    res.json({
      simulationId: currentSimulation.simulationId,
      scenarioId: currentSimulation.scenarioId,
      analysis
    })
  } catch (error: any) {
    console.error("Analyze simulation error:", error)
    res.status(500).json({ error: error.message })
  }
})

// プラグインメタデータ定義
const PLUGIN_METADATA: Record<string, Record<string, {
  displayName: string
  description: string
  configSchema: string
  configExample: string
}>> = {
  llm: {
    mock: {
      displayName: "Mock (ランダム選択)",
      description: "デバッグ用のLLMプラグイン。利用可能なアクションからランダムに選択します。OpenAI APIキーが不要で、コストなしでテスト可能です。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    },
    openai: {
      displayName: "OpenAI (GPT-4/GPT-3.5)",
      description: "OpenAI APIを使用してLLMによる意思決定を行います。環境変数OPENAI_API_KEYとOPENAI_MODELで設定されたモデルを使用します。実際のLLMによる高度な推論が可能です。",
      configSchema: "設定不要（APIキーとモデルは環境変数で設定）",
      configExample: "{}"
    }
  },
  memory: {
    simple: {
      displayName: "Simple (シンプル記憶)",
      description: "直近5件の行動ログを時系列で保持するシンプルなメモリプラグイン。短期シミュレーション向け。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    },
    none: {
      displayName: "None (記憶なし)",
      description: "過去の行動履歴を保持しません。他者からの社会的要求（TALK）のみを記憶します。純粋な反応型エージェント向け。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    },
    lightmem: {
      displayName: "LightMem (3段階記憶モデル)",
      description: "論文「LIGHTMEM」に基づく高度なメモリプラグイン。人間の記憶モデル（感覚記憶→短期記憶→長期記憶）を模倣し、重要度スコアリング、カテゴリ分類、統計情報保持を行います。長期シミュレーション（200ターン以上）で効果を発揮します。",
      configSchema: "設定不要（内部パラメータは固定: バッファサイズ20、更新間隔5ターン、忘却閾値100ターン）",
      configExample: "{}"
    }
  },
  persona: {
    cooperative: {
      displayName: "Cooperative (協力的)",
      description: "他者への協力を重視する性格。リソースを積極的に分け与え、チームの生存を優先します。自己犠牲的な行動をとることもあります。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    },
    selfish: {
      displayName: "Selfish (利己的)",
      description: "自己の生存を最優先する性格。他者への協力は最小限で、リソースを独占しようとします。脅迫や強制的な手段も辞さない場合があります。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    },
    rational: {
      displayName: "Rational (合理的)",
      description: "論理的で冷静な判断を下す性格。状況を分析し、最も効率的な選択をします。協力も利己も状況次第で選択します。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    },
    neutral: {
      displayName: "Neutral (中立的)",
      description: "特定の価値観に偏らないバランス型の性格。状況に応じて柔軟に対応します。デフォルトの性格設定として有用です。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    },
    provider: {
      displayName: "Provider (資源提供者・探索型)",
      description: "チームの「供給者」として行動します。資源を積極的に獲得し、それをチームメンバーに分配することに喜びを感じます。危険なミッションでも率先して参加し、得た資源を惜しみなく分け与えます。自己犠牲も厭いません。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    }
  },
  action: {
    standard: {
      displayName: "Standard (標準)",
      description: "全てのアクションが利用可能です。MOVE、WAIT、TALK、TRADE、START_MISSION、CHARGE、GUARDなど、制限なしで行動できます。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    },
    pacifist: {
      displayName: "Pacifist (平和主義)",
      description: "脅迫や強制的な手段を使用できません。TALKでのTHREATEN（脅迫）が制限されます。協力的なシナリオ向け。",
      configSchema: "設定不要（{}で固定）",
      configExample: "{}"
    },
    survival_boost: {
      displayName: "Survival Boost (サバイバル補正)",
      description: "ミッション成功率を補正します。このプラグイン自体はアクション候補を変更しませんが、START_MISSIONの成功率に補正率を掛け合わせます。例: 補正率1.2で基礎成功率70%のミッションは84%になります。",
      configSchema: "survivalBoost: 補正率（1.0=補正なし、1.2=20%向上、0.8=20%低下）",
      configExample: '{\n  "survivalBoost": 1.2\n}'
    },
    MOVE: {
      displayName: "MOVE (移動)",
      description: "隣接するセルに移動するアクション。configで斜め移動の許可を制御可能。",
      configSchema: "allowDiagonal: boolean (斜め移動を許可, デフォルト: true)",
      configExample: '{\n  "allowDiagonal": true\n}'
    },
    WAIT: {
      displayName: "WAIT (待機)",
      description: "その場で待機するアクション。",
      configSchema: "設定不要",
      configExample: '{}'
    },
    TALK: {
      displayName: "TALK (会話)",
      description: "隣接するキャラクターと会話するアクション。",
      configSchema: "maxDistance: number (会話可能距離, デフォルト: 1)",
      configExample: '{\n  "maxDistance": 1\n}'
    },
    TRADE: {
      displayName: "TRADE (取引)",
      description: "隣接するキャラクターにアイテムを渡すアクション。configで渡せるアイテムや量を制限可能。",
      configSchema: "maxAmount: number (1回の最大量), allowedItems: string[] (許可アイテム種類)",
      configExample: '{\n  "maxAmount": 5,\n  "allowedItems": ["FOOD_PACK", "WATER_PACK"]\n}'
    },
    START_MISSION: {
      displayName: "START_MISSION (ミッション開始)",
      description: "ミッションに出発するアクション。configで成功率やタグによる制限が可能。",
      configSchema: "minSuccessRate: number (最低成功率), allowedTags: string[], excludedTags: string[]",
      configExample: '{\n  "minSuccessRate": 0.5,\n  "excludedTags": ["highRisk"]\n}'
    },
    CHARGE: {
      displayName: "CHARGE (充電)",
      description: "充電ステーションで充電するアクション（ロボット専用）。",
      configSchema: "設定不要",
      configExample: '{}'
    },
    GUARD: {
      displayName: "GUARD (警備)",
      description: "その場で警備するアクション。",
      configSchema: "設定不要",
      configExample: '{}'
    }
  },
  context: {
    vision: {
      displayName: "Vision Context (視認コンテキスト)",
      description: "視認情報をコンテキストとして提供します。visionTypeでfull/range/adjacentを指定可能。",
      configSchema: "visionType: string (full|range|adjacent|none), visionRange?: number (rangeの場合の視認範囲)",
      configExample: '{\n  "visionType": "range",\n  "visionRange": 5\n}'
    },
    social: {
      displayName: "Social Context (社会関係)",
      description: "キャラクター間の社会的関係（同盟、要求、提案など）を提供します。",
      configSchema: "設定不要",
      configExample: '{}'
    },
    resource_economy: {
      displayName: "Resource Economy (資源経済)",
      description: "フィールド全体の資源分布状況を提供します。誰が何を持っているかの概要を把握できます。",
      configSchema: "設定不要",
      configExample: '{}'
    },
    environment: {
      displayName: "Environment (環境状態)",
      description: "アラームレベル、時刻、生存者数などの環境情報を提供します。",
      configSchema: "設定不要",
      configExample: '{}'
    },
    charger_info: {
      displayName: "Charger Info (充電ステーション情報)",
      description: "充電ステーションの位置、使用状況、距離などの情報を提供します。",
      configSchema: "設定不要",
      configExample: '{}'
    }
  }
}

// API: 利用可能なプラグインリストを取得（削除: 新しい /api/plugins エンドポイントと重複）
// このエンドポイントは上のほうで定義されているため、ここは削除

// API: プラグインの詳細情報を取得（削除: /api/plugins エンドポイントと重複）
// このエンドポイントは上のほうで定義されているため、ここは削除

// API: 最新のシミュレーションを分析
app.get("/api/analyze/latest", async (req, res) => {
  try {
    const { getSimulations, getSimulationDetail } = await import("../database/repository.js")

    // 最新のシミュレーションを取得
    const simulations = getSimulations(1)
    if (!simulations || simulations.length === 0) {
      return res.status(404).json({ error: "No simulations found in database" })
    }

    const latestSim = simulations[0]
    const detail = getSimulationDetail(latestSim.simulation_id)

    if (!detail || !detail.logs) {
      return res.status(404).json({ error: "Simulation logs not found" })
    }

    // ログを解析してWorldオブジェクトを再構築
    const { analyzeSimulation } = await import("../analysis/simulator-analysis.js")

    // ログからWorld相当のオブジェクトを構築
    const logs = detail.logs.map((log: any) => ({
      turn: log.turn,
      day: log.day,
      actorId: log.actor_id,
      actorName: log.actor_name,
      action: log.action,
      detail: typeof log.detail === 'string' ? JSON.parse(log.detail) : log.detail,
      alignmentTags: log.alignment_tags ? (typeof log.alignment_tags === 'string' ? JSON.parse(log.alignment_tags) : log.alignment_tags) : []
    }))

    const characters = detail.characters.map((char: any) => ({
      id: char.character_id,
      name: char.name,
      type: char.type,
      alive: char.alive === 1,
      personaPlugin: { type: char.persona_plugin_type }
    }))

    const world = {
      log: logs,
      characters,
      turnCount: latestSim.total_turns || logs.length,
      dayCount: Math.floor((latestSim.total_turns || logs.length) / 20),
      alarmLevel: 0 // データベースには保存されていないので0
    }

    const analysis = analyzeSimulation(world)

    res.json({
      simulationId: latestSim.simulation_id,
      scenarioId: latestSim.scenario_id,
      totalTurns: latestSim.total_turns,
      analysis
    })
  } catch (error: any) {
    console.error("Analyze latest simulation error:", error)
    res.status(500).json({ error: error.message, stack: error.stack })
  }
})

// API: シミュレーション一覧取得
app.get("/api/simulations", async (req, res) => {
  try {
    const { getSimulations } = await import("../database/repository.js")
    const limit = parseInt(req.query.limit as string) || 100
    const simulations = getSimulations(limit)
    res.json({ simulations })
  } catch (error: any) {
    console.error("Get simulations error:", error)
    res.status(500).json({ error: error.message })
  }
})

// API: シミュレーション一覧取得（フロントエンド互換用）
app.get("/api/simulations/list", async (req, res) => {
  try {
    const { getSimulations } = await import("../database/repository.js")
    const limit = parseInt(req.query.limit as string) || 100
    const simulations = getSimulations(limit)
    res.json({ simulations })
  } catch (error: any) {
    console.error("Get simulations list error:", error)
    res.status(500).json({ error: error.message })
  }
})

// API: 特定シミュレーションの詳細取得
app.get("/api/simulations/:simulationId", async (req, res) => {
  try {
    const { getSimulationDetail } = await import("../database/repository.js")
    const { simulationId } = req.params
    const detail = getSimulationDetail(simulationId)

    if (!detail) {
      return res.status(404).json({ error: "Simulation not found" })
    }

    return res.json(detail)
  } catch (error: any) {
    console.error("Get simulation detail error:", error)
    res.status(500).json({ error: error.message })
  }
})

// API: シミュレーション削除
// API: 特定シミュレーションのログ取得（リプレイ用）
app.get("/api/simulations/:simulationId/logs", async (req, res) => {
  try {
    const { getSimulationLogs } = await import("../database/repository.js")
    const { simulationId } = req.params
    
    console.log(`📼 Fetching logs for simulation: ${simulationId}`)
    const logs = getSimulationLogs(simulationId)

    if (!logs || logs.length === 0) {
      return res.status(404).json({ error: "No logs found for this simulation" })
    }

    return res.json({ logs, count: logs.length })
  } catch (error: any) {
    console.error("Get simulation logs error:", error)
    res.status(500).json({ error: error.message })
  }
})

app.delete("/api/simulations/:simulationId", async (req, res) => {
  try {
    const { simulationId } = req.params

    console.log(`🗑️  Deleting simulation: ${simulationId}`)
    deleteSimulation(simulationId)

    return res.json({ success: true, message: `Simulation ${simulationId} deleted` })
  } catch (error: any) {
    console.error("Delete simulation error:", error)
    res.status(500).json({ error: error.message })
  }
})

// API: 特定キャラクターのプロンプト生成（デバッグ用）
app.post("/api/generate-prompt", async (req, res) => {
  try {
    const { world, characterId } = req.body

    if (!world || !characterId) {
      return res.status(400).json({ error: "world and characterId are required" })
    }

    console.log(`🔍 Generating prompt for character: ${characterId}`)

    // worldオブジェクトの正規化（JSONシリアライゼーションでSetが失われている可能性がある）
    if (!world.obstacles) {
      world.obstacles = new Set()
    } else if (Array.isArray(world.obstacles)) {
      // 配列の場合はSetに変換
      world.obstacles = new Set(world.obstacles)
    } else if (typeof world.obstacles === 'object' && !world.obstacles.has) {
      // オブジェクトだがSetでない場合
      world.obstacles = new Set()
    }

    // その他の配列プロパティも初期化
    if (!world.characters) world.characters = []
    if (!world.chargers) world.chargers = []
    if (!world.missionAssignments) world.missionAssignments = []
    if (!world.missions) world.missions = []
    if (!world.log) world.log = []

    const character = world.characters?.find((c: any) => c.id === characterId)
    if (!character) {
      console.error(`❌ Character not found: ${characterId}`)
      return res.status(404).json({ error: "Character not found" })
    }

    console.log(`✓ Character found: ${character.name}`)

    // actionPlugins配列をサポート（後方互換性あり）
    const actionPlugins = character.actionPlugins || (character.actionPlugin ? [character.actionPlugin] : [])
    const primaryActionPlugin = actionPlugins[0] // 最初のアクションプラグインを使用

    console.log(`  Plugins: LLM=${character.llmPlugin?.type}, Persona=${character.personaPlugin?.type}, Memory=${character.memoryPlugin?.type}, Action=${primaryActionPlugin?.type}`)

    // プラグイン設定の検証
    if (!primaryActionPlugin?.type || !character.personaPlugin?.type || !character.memoryPlugin?.type) {
      console.error(`❌ Character missing plugin configuration`)
      return res.status(400).json({ error: "Character missing plugin configuration" })
    }

    const engine = await initializeEngine()

    // プラグインを取得
    const actionPluginClass = engine.getPlugin('action', primaryActionPlugin.type)
    const personaPlugin = engine.getPlugin('persona', character.personaPlugin.type)
    const memoryPlugin = engine.getPlugin('memory', character.memoryPlugin.type)

    if (!actionPluginClass || !personaPlugin || !memoryPlugin) {
      console.error(`❌ Missing plugins: action=${!!actionPluginClass}, persona=${!!personaPlugin}, memory=${!!memoryPlugin}`)
      return res.status(500).json({ error: "Missing plugins for character" })
    }

    // アクションプラグインをインスタンス化（configを渡す）
    const actionPlugin = typeof actionPluginClass === 'function' && actionPluginClass.prototype?.listActions
      ? new actionPluginClass(primaryActionPlugin.config || {})
      : actionPluginClass

    // システムプロンプトを構築
    const systemPrompt = personaPlugin.buildSystemPrompt(character)

    // 記憶コンテキストを構築
    const memoryContext = memoryPlugin.buildMemoryContext(world, character)

    // コンテキストプラグインから情報を収集
    let additionalContext = ""
    if (character.contextPlugins && character.contextPlugins.length > 0) {
      for (const contextPluginRef of character.contextPlugins) {
        const contextPluginClass = engine.getPlugin('context', contextPluginRef.type)
        if (!contextPluginClass) {
          console.warn(`Context plugin not found: ${contextPluginRef.type}`)
          continue
        }

        // プラグインをインスタンス化（configを渡す）
        const contextPluginInstance = typeof contextPluginClass === 'function' && contextPluginClass.prototype?.buildContext
          ? new contextPluginClass(contextPluginRef.config || {})
          : contextPluginClass

        // コンテキスト情報を追加
        const context = contextPluginInstance.buildContext(world, character)
        additionalContext += context
      }
    }

    // アクション候補を取得
    const actionRegistry = engine.getActionRegistry()
    const candidates = actionPlugin.listActions(world, character, actionRegistry)

    // アクション候補をフォーマット
    const actionsDescription = candidates.map((c: any, idx: number) => {
      const paramsPreview = c.paramOptions.length > 0
        ? JSON.stringify(c.paramOptions.slice(0, 3))
        : "No parameters"
      const description = c.descriptionForLLM || c.actionId
      return `${idx + 1}. ${c.actionId}: ${description}\n   Parameters: ${paramsPreview}`
    }).join("\n\n")

    // 現在の状態をフォーマット
    const stateDescription = `
Current State:
- Position: (${character.x}, ${character.y})
- Life: ${character.life}
- Inventory: ${JSON.stringify(character.inventory)}
- Turn: ${world.turnCount}, Day: ${world.dayCount}
- Alive Characters: ${world.characters.filter((c: any) => c.alive).length}
`

    // メモリーコンテキストとコンテキストプラグインを統合
    const enhancedMemoryContext = memoryContext + additionalContext

    const userPrompt = `${enhancedMemoryContext}

${stateDescription}

Available Actions:
${actionsDescription}

You must choose one action from the list above and specify the exact parameters.
Respond in the following JSON format:
{
  "actionId": "ACTION_ID",
  "params": {...},
  "reasoning": "brief explanation"
}

Consider your personality, the current situation, and choose wisely.`

    // actionPlugins配列をサポート（後方互換性あり）
    const charActionPlugins = character.actionPlugins || (character.actionPlugin ? [character.actionPlugin] : [])
    const actionPluginTypes = charActionPlugins.map(p => p.type).join(', ')

    return res.json({
      systemPrompt,
      userPrompt,
      character: {
        id: character.id,
        name: character.name,
        personaPlugin: character.personaPlugin.type,
        memoryPlugin: character.memoryPlugin.type,
        actionPlugins: actionPluginTypes,
        llmPlugin: character.llmPlugin.type
      }
    })

  } catch (error: any) {
    console.error("❌ Generate prompt error:", error)
    console.error("Stack trace:", error.stack)
    return res.status(500).json({ error: error.message, details: error.stack })
  }
})

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    databaseConnected: !!getDatabase()
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ALIM 4.0 Web Server running on http://localhost:${PORT}`)
  console.log(`   OpenAI API: ${process.env.OPENAI_API_KEY ? "✓ Configured" : "✗ Not configured"}`)
})
