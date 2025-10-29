import { ActionDefinition, World, Character, ApplyResult, RNGContext } from "../types/index.js"
import { isAdjacent } from "../utils/index.js"
import { cloneWorld } from "../core/world.js"

/**
 * GUARD アクション
 * 隣接するキャラクター（充電中など）を護衛
 */
export const GuardAction: ActionDefinition = {
  id: "GUARD",
  descriptionForLLM: "隣接するキャラクター（特に充電中のロボット）を護衛します。護衛対象へのダメージを軽減できます。",

  canExecute(world: World, actor: Character): boolean {
    if (!actor.alive) return false

    // 隣接する護衛可能なキャラがいるか（充電中など）
    return world.characters.some(c =>
      c.alive &&
      c.id !== actor.id &&
      isAdjacent(actor, c) &&
      (c.isCharging || c.life < 3) // 充電中または低HPなら護衛対象候補
    )
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    const candidates: Record<string, unknown>[] = []

    const adjacentChars = world.characters.filter(c =>
      c.alive &&
      c.id !== actor.id &&
      isAdjacent(actor, c)
    )

    for (const target of adjacentChars) {
      candidates.push({
        targetId: target.id,
        reason: target.isCharging ? "charging" : "protection"
      })
    }

    return candidates
  },

  apply(
    world: World,
    actor: Character,
    params: Record<string, unknown>,
    rng: RNGContext
  ): ApplyResult {
    const updatedWorld = cloneWorld(world)
    const updatedActor = updatedWorld.characters.find(c => c.id === actor.id)!
    const targetId = params.targetId as string

    const target = updatedWorld.characters.find(c => c.id === targetId)

    if (!target) {
      return {
        worldAfter: updatedWorld,
        alignmentTags: [],
        logDetail: { error: "Target not found" }
      }
    }

    // 護衛状態に設定
    updatedActor.isGuarding = true
    updatedActor.guardingTargetId = targetId

    // 自己犠牲・支援タグ
    const alignmentTags = ["selfSacrifice", "support"]

    return {
      worldAfter: updatedWorld,
      alignmentTags,
      logDetail: {
        targetId,
        reason: params.reason
      }
    }
  }
}
