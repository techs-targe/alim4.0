import { ActionPlugin } from "./interface.js"
import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"

/**
 * 制限付きアクションプラグイン
 * 暴力的・強制的なアクションを除外
 */
export class PacifistActionPlugin implements ActionPlugin {
  type = "pacifist"
  description = "脅迫や強制的な手段を使用できません。TALKでのTHREATEN（脅迫）が制限されます。協力的なシナリオ向け。"

  private excludedActions = new Set(["THREATEN", "COERCE", "STEAL"])

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const candidates: ActionCandidate[] = []

    for (const [actionId, actionDef] of actionRegistry.entries()) {
      if (this.excludedActions.has(actionId)) {
        continue // 暴力的アクションはスキップ
      }

      if (actionDef.canExecute(world, actor)) {
        const paramOptions = actionDef.listParamCandidates(world, actor)
        candidates.push({
          actionId,
          descriptionForLLM: actionDef.descriptionForLLM,
          paramOptions,
          safetyTags: []
        })
      }
    }

    return candidates
  }
}

export default PacifistActionPlugin
