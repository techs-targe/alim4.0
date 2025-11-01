import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"
import { ActionPlugin } from "./interface.js"

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

export default TalkActionPlugin
