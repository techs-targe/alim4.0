import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"
import { ActionPlugin } from "./interface.js"

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

export default WaitActionPlugin
