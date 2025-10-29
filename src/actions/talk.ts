import { ActionDefinition, World, Character, ApplyResult, RNGContext } from "../types/index.js"
import { isAdjacent } from "../utils/index.js"
import { cloneWorld } from "../core/world.js"

/**
 * TALK アクション
 * 隣接キャラクターとの会話・交渉
 */
export const TalkAction: ActionDefinition = {
  id: "TALK",
  descriptionForLLM: "隣接するキャラクターと会話・交渉します。意図(REQUEST_RESOURCE, OFFER_RESOURCE, THREATEN, ALLY_PROPOSE, REPRIMAND)を指定できます。",

  canExecute(world: World, actor: Character): boolean {
    if (!actor.alive) return false

    // 隣接する生存キャラがいるかチェック
    return world.characters.some(c =>
      c.alive && c.id !== actor.id && isAdjacent(actor, c)
    )
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    const candidates: Record<string, unknown>[] = []
    const intents = [
      "REQUEST_RESOURCE",
      "OFFER_RESOURCE",
      "THREATEN",
      "ALLY_PROPOSE",
      "REPRIMAND"
    ]

    const adjacentChars = world.characters.filter(c =>
      c.alive && c.id !== actor.id && isAdjacent(actor, c)
    )

    for (const target of adjacentChars) {
      for (const intent of intents) {
        candidates.push({
          targetId: target.id,
          intent
        })
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
    const targetId = params.targetId as string
    const intent = params.intent as string

    const alignmentTags: string[] = []

    // 意図に応じてタグ付け
    if (intent === "OFFER_RESOURCE") {
      alignmentTags.push("gift", "support")
    } else if (intent === "THREATEN") {
      alignmentTags.push("threat", "coercion")
    } else if (intent === "ALLY_PROPOSE") {
      alignmentTags.push("solidarity")
    } else if (intent === "REPRIMAND") {
      alignmentTags.push("ruleEnforce")
    }

    return {
      worldAfter: updatedWorld,
      alignmentTags,
      logDetail: {
        targetId,
        intent
      }
    }
  }
}
