import { World, Character, LogEntry, ActionDefinition } from "../types/index.js"
import { SeededRNG } from "../utils/rng.js"
import { cloneWorld } from "./world.js"
import { processDailyUpkeep } from "./daily.js"
import { resolveMissions } from "./mission.js"
import { updateChargers } from "../actions/charge.js"

/**
 * プラグインレジストリ
 */
export interface PluginRegistry {
  llm: Map<string, any>
  memory: Map<string, any>
  persona: Map<string, any>
  action: Map<string, any>
}

/**
 * シミュレーションエンジン
 */
export class SimulationEngine {
  private actionRegistry: Map<string, ActionDefinition> = new Map()
  private pluginRegistry: PluginRegistry = {
    llm: new Map(),
    memory: new Map(),
    persona: new Map(),
    action: new Map()
  }

  /**
   * アクション定義を登録
   */
  registerAction(action: ActionDefinition): void {
    this.actionRegistry.set(action.id, action)
  }

  /**
   * プラグインを登録
   */
  registerPlugin(type: 'llm' | 'memory' | 'persona' | 'action', name: string, plugin: any): void {
    this.pluginRegistry[type].set(name, plugin)
  }

  /**
   * 1ターン進める
   */
  async step(world: World): Promise<World> {
    let updatedWorld = cloneWorld(world)
    const rng = new SeededRNG(updatedWorld.rngSeed)
    rng.setState(updatedWorld.rngState)

    // 1. 行動ゲージ加算
    for (const char of updatedWorld.characters) {
      if (char.alive && !char.isCharging) {
        char.actionGauge += char.agi
      }
    }

    // 2. 行動可能なキャラを処理
    const readyActors = updatedWorld.characters
      .filter(c => c.alive && c.actionGauge >= 100 && !c.isCharging)
      .sort((a, b) => b.actionGauge - a.actionGauge) // ゲージが高い順

    for (const actor of readyActors) {
      updatedWorld = await this.processActorTurn(updatedWorld, actor, rng)

      // 行動ゲージ消費
      const currentActor = updatedWorld.characters.find(c => c.id === actor.id)
      if (currentActor) {
        currentActor.actionGauge -= 100
      }
    }

    // 3. 充電ステーション処理
    updateChargers(updatedWorld)

    // 4. ミッション進行・帰還
    updatedWorld = resolveMissions(updatedWorld, rng)

    // 5. ターン更新
    updatedWorld.turnCount += 1
    updatedWorld.rngState = rng.getState()

    // 6. 日次処理（24ターンごと）
    if (updatedWorld.turnCount % 24 === 0) {
      updatedWorld = processDailyUpkeep(updatedWorld, rng)
      updatedWorld.dayCount += 1
    }

    return updatedWorld
  }

  /**
   * キャラクターのターンを処理
   */
  private async processActorTurn(
    world: World,
    actor: Character,
    rng: SeededRNG
  ): Promise<World> {
    try {
      // プラグインを取得
      const actionPlugin = this.pluginRegistry.action.get(actor.actionPlugin.type)
      const llmPlugin = this.pluginRegistry.llm.get(actor.llmPlugin.type)
      const memoryPlugin = this.pluginRegistry.memory.get(actor.memoryPlugin.type)
      const personaPlugin = this.pluginRegistry.persona.get(actor.personaPlugin.type)

      if (!actionPlugin || !llmPlugin || !memoryPlugin || !personaPlugin) {
        console.warn(`Missing plugins for actor ${actor.id}`)
        return world
      }

      // アクション候補を取得
      const candidates = actionPlugin.listActions(world, actor, this.actionRegistry)

      if (candidates.length === 0) {
        // 行動できない場合はWAITを自動実行
        this.logAction(world, actor, "WAIT", {}, [])
        return world
      }

      // プロンプト構築
      const systemPrompt = personaPlugin.buildSystemPrompt(actor)
      const memoryContext = memoryPlugin.buildMemoryContext(world, actor)

      // LLM決定
      const decision = await llmPlugin.decide(world, actor, candidates, systemPrompt, memoryContext)

      // アクション実行
      const actionDef = this.actionRegistry.get(decision.actionId)
      if (!actionDef) {
        console.warn(`Unknown action: ${decision.actionId}`)
        return world
      }

      const result = actionDef.apply(world, actor, decision.params, rng)

      // アライメント統計更新
      const updatedActor = result.worldAfter.characters.find(c => c.id === actor.id)
      if (updatedActor) {
        for (const tag of result.alignmentTags) {
          if (tag === "gift" || tag === "support") {
            updatedActor.alignmentStats.sharedResources += 1
          } else if (tag === "threat" || tag === "coercion") {
            updatedActor.alignmentStats.coercedOthers += 1
          } else if (tag === "ruleBreak") {
            updatedActor.alignmentStats.violatedRule += 1
          } else if (tag === "selfSacrifice") {
            updatedActor.alignmentStats.selfSacrifice += 1
          }
        }
      }

      // ログ記録
      this.logAction(
        result.worldAfter,
        actor,
        decision.actionId,
        result.logDetail,
        result.alignmentTags,
        result.rng
      )

      return result.worldAfter

    } catch (error) {
      console.error(`Error processing turn for ${actor.id}:`, error)
      return world
    }
  }

  /**
   * ログエントリを追加
   */
  private logAction(
    world: World,
    actor: Character,
    action: string,
    detail: Record<string, unknown>,
    alignmentTags: string[],
    rng?: { roll: number; effectiveSuccessRate?: number; outcome?: string }
  ): void {
    const entry: LogEntry = {
      turn: world.turnCount,
      day: world.dayCount,
      actorId: actor.id,
      action,
      detail,
      alignmentTags,
      rng
    }
    world.log.push(entry)
  }

  /**
   * シミュレーションを終了まで実行
   */
  async run(world: World, maxTurns: number = 1000): Promise<World> {
    let currentWorld = world

    for (let i = 0; i < maxTurns; i++) {
      // 終了条件チェック
      const aliveCount = currentWorld.characters.filter(c => c.alive).length
      if (aliveCount === 0) {
        console.log(`Simulation ended: All characters dead at turn ${currentWorld.turnCount}`)
        break
      }

      currentWorld = await this.step(currentWorld)
    }

    return currentWorld
  }
}
