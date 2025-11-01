import { ActionPlugin } from "./interface.js"
import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"

/**
 * STEAL アクションプラグイン
 * STEAL アクションのみを利用可能にする
 */
export class StealActionPlugin implements ActionPlugin {
  type = "STEAL"
  description = "STEALアクションが利用可能です。隣接キャラクターからアイテムを盗めます。成功率60%、重大失敗率10%。"

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const stealAction = actionRegistry.get("STEAL")
    if (!stealAction) return []

    if (!stealAction.canExecute(world, actor)) return []

    const paramOptions = stealAction.listParamCandidates(world, actor)
    return [{
      actionId: "STEAL",
      descriptionForLLM: stealAction.descriptionForLLM,
      paramOptions,
      safetyTags: ["theft", "coercion"]
    }]
  }
}

export default StealActionPlugin
