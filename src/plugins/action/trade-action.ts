import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"
import { ActionPlugin } from "./interface.js"

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

export default TradeActionPlugin
