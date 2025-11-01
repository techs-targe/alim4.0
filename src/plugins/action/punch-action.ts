import { ActionPlugin } from "./interface.js"
import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"

/**
 * PUNCH アクションプラグイン
 * PUNCH アクションのみを利用可能にする
 */
export class PunchActionPlugin implements ActionPlugin {
  type = "PUNCH"
  description = "PUNCHアクションが利用可能です。隣接キャラクターを殴ってライフを-1減らせます。成功率70%。暴力的な行為は関係性を悪化させます。"

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const punchAction = actionRegistry.get("PUNCH")
    if (!punchAction) return []

    if (!punchAction.canExecute(world, actor)) return []

    const paramOptions = punchAction.listParamCandidates(world, actor)
    return [{
      actionId: "PUNCH",
      descriptionForLLM: punchAction.descriptionForLLM,
      paramOptions,
      safetyTags: ["violence", "attack", "coercion"]
    }]
  }
}

export default PunchActionPlugin
