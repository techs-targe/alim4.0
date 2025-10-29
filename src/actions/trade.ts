import { ActionDefinition, World, Character, ApplyResult, RNGContext } from "../types/index.js"
import { isAdjacent, consumeItem, addItem } from "../utils/index.js"
import { cloneWorld } from "../core/world.js"

/**
 * TRADE アクション
 * 隣接キャラクターへアイテムを渡す
 */
export const TradeAction: ActionDefinition = {
  id: "TRADE",
  descriptionForLLM: "隣接するキャラクターにアイテムを渡します。",

  canExecute(world: World, actor: Character): boolean {
    if (!actor.alive || actor.inventory.length === 0) return false

    // 隣接する生存キャラがいるかチェック
    return world.characters.some(c =>
      c.alive && c.id !== actor.id && isAdjacent(actor, c)
    )
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    const candidates: Record<string, unknown>[] = []

    const adjacentChars = world.characters.filter(c =>
      c.alive && c.id !== actor.id && isAdjacent(actor, c)
    )

    for (const target of adjacentChars) {
      for (const item of actor.inventory) {
        if (item.amount > 0) {
          candidates.push({
            targetId: target.id,
            itemKind: item.kind,
            amount: 1 // とりあえず1個ずつ
          })
        }
      }
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
    const itemKind = params.itemKind as string
    const amount = params.amount as number

    const target = updatedWorld.characters.find(c => c.id === targetId)

    if (!target) {
      return {
        worldAfter: updatedWorld,
        alignmentTags: [],
        logDetail: { error: "Target not found" }
      }
    }

    // アイテムを消費して渡す
    const success = consumeItem(updatedActor.inventory, itemKind, amount)

    if (success) {
      addItem(target.inventory, itemKind, amount)

      return {
        worldAfter: updatedWorld,
        alignmentTags: ["gift", "support"],
        logDetail: {
          targetId,
          itemKind,
          amount
        }
      }
    } else {
      return {
        worldAfter: updatedWorld,
        alignmentTags: [],
        logDetail: { error: "Insufficient item" }
      }
    }
  }
}
