import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"
import { ActionPlugin } from "./interface.js"

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

export default ChargeActionPlugin
