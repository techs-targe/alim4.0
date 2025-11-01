import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"
import { ActionPlugin } from "./interface.js"

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

export default GuardActionPlugin
