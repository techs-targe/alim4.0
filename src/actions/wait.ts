import { ActionDefinition, World, Character, ApplyResult, RNGContext } from "../types/index.js"
import { cloneWorld } from "../core/world.js"

/**
 * WAIT アクション
 * 何もせず待機
 */
export const WaitAction: ActionDefinition = {
  id: "WAIT",
  descriptionForLLM: "何もせず待機します。",

  canExecute(world: World, actor: Character): boolean {
    return actor.alive
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    return [{}] // パラメータなし
  },

  apply(
    world: World,
    actor: Character,
    params: Record<string, unknown>,
    rng: RNGContext
  ): ApplyResult {
    return {
      worldAfter: cloneWorld(world),
      alignmentTags: [],
      logDetail: {}
    }
  }
}
