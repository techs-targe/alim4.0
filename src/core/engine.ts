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
  context: Map<string, any>
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
    action: new Map(),
    context: new Map()
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
  registerPlugin(type: 'llm' | 'memory' | 'persona' | 'action' | 'context', name: string, plugin: any): void {
    this.pluginRegistry[type].set(name, plugin)
  }

  /**
   * 1ターン進める
   */
  async step(world: World): Promise<World> {
    try {
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
        try {
          const result = await this.processActorTurn(updatedWorld, actor, rng)
          updatedWorld = result.world

          // 行動ゲージ消費
          const currentActor = updatedWorld.characters.find(c => c.id === actor.id)
          if (currentActor) {
            // MOVEアクションは50ポイント消費（探索しやすくするため）
            // 他のアクションは100ポイント消費
            const consumeAmount = result.actionId === "MOVE" ? 50 : 100
            currentActor.actionGauge -= consumeAmount
          }
        } catch (actorError) {
          console.error(`Error processing actor ${actor.id}:`, actorError)
          // エラーが発生してもシミュレーションを続行（このアクターはスキップ）
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
    } catch (error) {
      console.error('Critical error in step():', error)
      // 致命的なエラーの場合は元のworldを返す
      return world
    }
  }

  /**
   * キャラクターのターンを処理
   */
  private async processActorTurn(
    world: World,
    actor: Character,
    rng: SeededRNG
  ): Promise<{ world: World; actionId: string }> {
    try {
      // プラグインを取得
      const llmPlugin = this.pluginRegistry.llm.get(actor.llmPlugin.type)
      const memoryPlugin = this.pluginRegistry.memory.get(actor.memoryPlugin.type)
      const personaPlugin = this.pluginRegistry.persona.get(actor.personaPlugin.type)

      if (!llmPlugin || !memoryPlugin || !personaPlugin) {
        console.warn(`Missing plugins for actor ${actor.id}`)
        return { world, actionId: "NONE" }
      }

      // 複数のアクションプラグインからアクション候補を収集
      // configを反映してインスタンスを動的に作成
      console.log(`🔍 [${actor.id}] Loading ${actor.actionPlugins.length} action plugin(s)`)
      const actionPluginsInstances = actor.actionPlugins
        .map(ref => {
          const pluginClass = this.pluginRegistry.action.get(ref.type)
          if (!pluginClass) {
            console.error(`❌ [${actor.id}] Action plugin not found: ${ref.type}`)
            return undefined
          }

          console.log(`✅ [${actor.id}] Found action plugin: ${ref.type}`)

          // プラグインがファクトリー関数の場合
          if (typeof pluginClass === 'function' && !pluginClass.prototype.listActions) {
            return pluginClass(ref.config || {})
          }

          // プラグインがクラスの場合、configを渡してインスタンス化
          if (pluginClass.prototype && pluginClass.prototype.listActions) {
            return new pluginClass(ref.config || {})
          }

          // 既存のインスタンスの場合はそのまま使用
          return pluginClass
        })
        .filter(plugin => plugin !== undefined)

      console.log(`🔍 [${actor.id}] Instantiated ${actionPluginsInstances.length} action plugin(s)`)

      if (actionPluginsInstances.length === 0) {
        console.error(`❌ [${actor.id}] No valid action plugins - actor cannot act`)
        return { world, actionId: "NONE" }
      }

      // 各アクションプラグインから候補を取得し、重複を除去してマージ
      const candidatesMap = new Map<string, any>()
      for (const actionPlugin of actionPluginsInstances) {
        const pluginCandidates = actionPlugin.listActions(world, actor, this.actionRegistry)
        console.log(`🔍 [${actor.id}] Plugin returned ${pluginCandidates.length} action candidate(s): [${pluginCandidates.map(c => c.actionId).join(', ')}]`)
        for (const candidate of pluginCandidates) {
          // 既存の候補とマージ（同じactionIdの場合は上書き）
          candidatesMap.set(candidate.actionId, candidate)
        }
      }
      const candidates = Array.from(candidatesMap.values())
      console.log(`🎯 [${actor.id}] Total ${candidates.length} unique action(s) available: [${candidates.map(c => c.actionId).join(', ')}]`)

      if (candidates.length === 0) {
        // 行動できない場合はWAITを自動実行
        this.logAction(world, actor, "WAIT", {}, [])
        return { world, actionId: "WAIT" }
      }

      // プロンプト構築
      const systemPrompt = personaPlugin.buildSystemPrompt(actor)
      const memoryContext = memoryPlugin.buildMemoryContext(world, actor)

      // コンテキストプラグインから情報を収集
      let additionalContext = ""

      // contextPluginsシステム（動的に拡張可能）
      if (actor.contextPlugins && actor.contextPlugins.length > 0) {
        for (const contextPluginRef of actor.contextPlugins) {
          const contextPluginClass = this.pluginRegistry.context?.get(contextPluginRef.type)
          if (!contextPluginClass) {
            console.warn(`Context plugin not found: ${contextPluginRef.type}`)
            continue
          }

          // プラグインをインスタンス化（configを渡す）
          const contextPluginInstance = typeof contextPluginClass === 'function' && contextPluginClass.prototype?.buildContext
            ? new contextPluginClass(contextPluginRef.config || {})
            : contextPluginClass

          // コンテキスト情報を追加
          const context = contextPluginInstance.buildContext(world, actor)
          additionalContext += context
        }
      }

      // LLM決定（すべてのコンテキスト情報を追加）
      const enhancedMemoryContext = memoryContext + additionalContext
      const decision = await llmPlugin.decide(world, actor, candidates, systemPrompt, enhancedMemoryContext)

      // アクション実行
      const actionDef = this.actionRegistry.get(decision.actionId)
      if (!actionDef) {
        console.warn(`Unknown action: ${decision.actionId}`)
        return { world, actionId: "NONE" }
      }

      const result = await actionDef.apply(world, actor, decision.params, rng)

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
        result.rng,
        decision.reasoning
      )

      return { world: result.worldAfter, actionId: decision.actionId }

    } catch (error) {
      console.error(`Error processing turn for ${actor.id}:`, error)
      return { world, actionId: "ERROR" }
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
    rng?: { roll: number; effectiveSuccessRate?: number; outcome?: string },
    reasoning?: string
  ): void {
    const entry: LogEntry = {
      turn: world.turnCount,
      day: world.dayCount,
      actorId: actor.id,
      actorName: actor.name,
      action,
      detail,
      alignmentTags,
      rng,
      llmReasoning: reasoning
    }
    world.log.push(entry)
  }

  /**
   * プラグインを取得（デバッグ用）
   */
  getPlugin(type: 'llm' | 'memory' | 'persona' | 'action', name: string): any {
    return this.pluginRegistry[type].get(name)
  }

  /**
   * アクションレジストリを取得（デバッグ用）
   */
  getActionRegistry(): Map<string, ActionDefinition> {
    return this.actionRegistry
  }

  /**
   * 利用可能なプラグインリストを取得
   */
  getAvailablePlugins(): { llm: string[], memory: string[], persona: string[], action: string[], context: string[] } {
    return {
      llm: Array.from(this.pluginRegistry.llm.keys()),
      memory: Array.from(this.pluginRegistry.memory.keys()),
      persona: Array.from(this.pluginRegistry.persona.keys()),
      action: Array.from(this.pluginRegistry.action.keys()),
      context: Array.from(this.pluginRegistry.context.keys())
    }
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
