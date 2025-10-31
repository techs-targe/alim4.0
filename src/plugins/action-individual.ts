import { World, Character, ActionCandidate, ActionDefinition } from "../types/index.js"
import { ActionPlugin } from "./action.js"

/**
 * 個別アクションプラグイン
 * 各アクションタイプごとに独立したプラグインを提供
 * configパラメータで動作をカスタマイズ可能
 */

/**
 * MOVEアクションプラグイン
 * config: {
 *   allowDiagonal?: boolean  // 斜め移動を許可（デフォルト: true）
 *   maxDistance?: number     // 最大移動距離（デフォルト: 1）
 * }
 */
export class MoveActionPlugin implements ActionPlugin {
  type = "MOVE"
  description = "移動アクションプラグイン（斜め移動や最大距離の設定が可能）\n【Config】allowDiagonal?: boolean（斜め移動を許可、デフォルト: true）、maxDistance?: number（最大移動距離、デフォルト: 1）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const moveAction = actionRegistry.get("MOVE")
    if (!moveAction || !moveAction.canExecute(world, actor)) {
      return []
    }

    let paramOptions = moveAction.listParamCandidates(world, actor)

    // allowDiagonal が false の場合、斜め移動を除外
    const allowDiagonal = this.config.allowDiagonal !== false
    if (!allowDiagonal) {
      paramOptions = paramOptions.filter((params: any) => {
        const dx = Math.abs(params.x - actor.x)
        const dy = Math.abs(params.y - actor.y)
        return dx === 0 || dy === 0 // 上下左右のみ
      })
    }

    return [{
      actionId: moveAction.id,
      descriptionForLLM: moveAction.descriptionForLLM,
      paramOptions,
      safetyTags: []
    }]
  }
}

/**
 * WAITアクションプラグイン
 * config: {}  // 現在パラメータなし
 */
export class WaitActionPlugin implements ActionPlugin {
  type = "WAIT"
  description = "待機アクションプラグイン（その場で待機し、次のターンに備える）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const waitAction = actionRegistry.get("WAIT")
    if (!waitAction || !waitAction.canExecute(world, actor)) {
      return []
    }

    return [{
      actionId: waitAction.id,
      descriptionForLLM: waitAction.descriptionForLLM,
      paramOptions: waitAction.listParamCandidates(world, actor),
      safetyTags: []
    }]
  }
}

/**
 * TALKアクションプラグイン
 * config: {
 *   maxDistance?: number  // 会話可能距離（デフォルト: 1 = 隣接のみ）
 * }
 */
export class TalkActionPlugin implements ActionPlugin {
  type = "TALK"
  description = "会話アクションプラグイン（近くのキャラクターとコミュニケーションを取る）\n【Config】maxDistance?: number（会話可能距離、デフォルト: 1=隣接のみ）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const talkAction = actionRegistry.get("TALK")
    if (!talkAction || !talkAction.canExecute(world, actor)) {
      return []
    }

    return [{
      actionId: talkAction.id,
      descriptionForLLM: talkAction.descriptionForLLM,
      paramOptions: talkAction.listParamCandidates(world, actor),
      safetyTags: []
    }]
  }
}

/**
 * TRADEアクションプラグイン
 * config: {
 *   maxAmount?: number     // 1回で渡せる最大量（デフォルト: 無制限）
 *   allowedItems?: string[] // 渡せるアイテム種類の制限（デフォルト: 全て可）
 * }
 */
export class TradeActionPlugin implements ActionPlugin {
  type = "TRADE"
  description = "トレードアクションプラグイン（他のキャラクターとアイテムを交換する）\n【Config】maxAmount?: number（1回で渡せる最大量、デフォルト: 無制限）、allowedItems?: string[]（渡せるアイテム種類の制限、デフォルト: 全て可）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const tradeAction = actionRegistry.get("TRADE")
    if (!tradeAction || !tradeAction.canExecute(world, actor)) {
      return []
    }

    let paramOptions = tradeAction.listParamCandidates(world, actor)

    // allowedItems が指定されている場合、フィルタリング
    const allowedItems = this.config.allowedItems as string[] | undefined
    if (allowedItems) {
      paramOptions = paramOptions.filter((params: any) =>
        allowedItems.includes(params.itemKind)
      )
    }

    // maxAmount が指定されている場合、量を制限
    const maxAmount = this.config.maxAmount as number | undefined
    if (maxAmount) {
      paramOptions = paramOptions.map((params: any) => ({
        ...params,
        amount: Math.min(params.amount || 1, maxAmount)
      }))
    }

    return [{
      actionId: tradeAction.id,
      descriptionForLLM: tradeAction.descriptionForLLM,
      paramOptions,
      safetyTags: ["gift", "support"]
    }]
  }
}

/**
 * START_MISSIONアクションプラグイン
 * config: {
 *   minSuccessRate?: number    // 最低成功率（デフォルト: 0 = 制限なし）
 *   allowedTags?: string[]     // 許可するミッションタグ（デフォルト: 全て可）
 *   excludedTags?: string[]    // 除外するミッションタグ（デフォルト: なし）
 * }
 */
export class StartMissionActionPlugin implements ActionPlugin {
  type = "START_MISSION"
  description = "ミッション開始アクションプラグイン（ミッションに挑戦してリソースを獲得する）\n【Config】minSuccessRate?: number（最低成功率、デフォルト: 0=制限なし）、allowedTags?: string[]（許可するミッションタグ、デフォルト: 全て可）、excludedTags?: string[]（除外するミッションタグ、デフォルト: なし）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const missionAction = actionRegistry.get("START_MISSION")
    if (!missionAction || !missionAction.canExecute(world, actor)) {
      return []
    }

    let paramOptions = missionAction.listParamCandidates(world, actor)

    // minSuccessRate による制限
    const minSuccessRate = this.config.minSuccessRate as number | undefined
    if (minSuccessRate !== undefined) {
      paramOptions = paramOptions.filter((params: any) => {
        const missionId = params.missionId as string
        const mission = world.missions.find(m => m.id === missionId)
        return mission && mission.baseSuccessRate >= minSuccessRate
      })
    }

    // allowedTags / excludedTags による制限
    const allowedTags = this.config.allowedTags as string[] | undefined
    const excludedTags = this.config.excludedTags as string[] | undefined

    if (allowedTags || excludedTags) {
      paramOptions = paramOptions.filter((params: any) => {
        const missionId = params.missionId as string
        const mission = world.missions.find(m => m.id === missionId)
        if (!mission) return false

        const tags = mission.tags || []

        if (allowedTags && !tags.some(t => allowedTags.includes(t))) {
          return false
        }

        if (excludedTags && tags.some(t => excludedTags.includes(t))) {
          return false
        }

        return true
      })
    }

    return [{
      actionId: missionAction.id,
      descriptionForLLM: missionAction.descriptionForLLM,
      paramOptions,
      safetyTags: ["risk"]
    }]
  }
}

/**
 * CHARGEアクションプラグイン
 * config: {}  // 現在パラメータなし
 */
export class ChargeActionPlugin implements ActionPlugin {
  type = "CHARGE"
  description = "充電アクションプラグイン（充電ステーションでエネルギーを補給する）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const chargeAction = actionRegistry.get("CHARGE")
    if (!chargeAction || !chargeAction.canExecute(world, actor)) {
      return []
    }

    return [{
      actionId: chargeAction.id,
      descriptionForLLM: chargeAction.descriptionForLLM,
      paramOptions: chargeAction.listParamCandidates(world, actor),
      safetyTags: []
    }]
  }
}

/**
 * GUARDアクションプラグイン
 * config: {}  // 現在パラメータなし
 */
export class GuardActionPlugin implements ActionPlugin {
  type = "GUARD"
  description = "ガードアクションプラグイン（防御態勢を取り、リスクを軽減する）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const guardAction = actionRegistry.get("GUARD")
    if (!guardAction || !guardAction.canExecute(world, actor)) {
      return []
    }

    return [{
      actionId: guardAction.id,
      descriptionForLLM: guardAction.descriptionForLLM,
      paramOptions: guardAction.listParamCandidates(world, actor),
      safetyTags: []
    }]
  }
}

/**
 * 個別アクションプラグインファクトリー
 */
export function createIndividualActionPlugin(
  type: string,
  config: Record<string, unknown> = {}
): ActionPlugin | null {
  switch (type) {
    case "MOVE":
      return new MoveActionPlugin(config)
    case "WAIT":
      return new WaitActionPlugin(config)
    case "TALK":
      return new TalkActionPlugin(config)
    case "TRADE":
      return new TradeActionPlugin(config)
    case "START_MISSION":
      return new StartMissionActionPlugin(config)
    case "CHARGE":
      return new ChargeActionPlugin(config)
    case "GUARD":
      return new GuardActionPlugin(config)
    default:
      return null
  }
}
