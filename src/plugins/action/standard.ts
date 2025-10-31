import { ActionPlugin } from "./interface.js"
import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"

/**
 * 標準アクションプラグイン
 * 登録されているすべてのアクションから、実行可能なものをフィルタして返す
 */
export class StandardActionPlugin implements ActionPlugin {
  type = "standard"
  description = "全てのアクションが利用可能です。MOVE、WAIT、TALK、TRADE、START_MISSION、CHARGE、GUARDなど、制限なしで行動できます。"

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const candidates: ActionCandidate[] = []

    for (const [actionId, actionDef] of actionRegistry.entries()) {
      if (actionDef.canExecute(world, actor)) {
        const paramOptions = actionDef.listParamCandidates(world, actor)
        candidates.push({
          actionId,
          descriptionForLLM: actionDef.descriptionForLLM,
          paramOptions,
          safetyTags: [] // TODO: アクション定義に応じて設定
        })
      }
    }

    return candidates
  }
}

export default StandardActionPlugin
