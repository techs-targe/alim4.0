import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"
import { ActionPlugin } from "./interface.js"

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

export default MoveActionPlugin
