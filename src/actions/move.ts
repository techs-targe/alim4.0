import { ActionDefinition, World, Character, ApplyResult, RNGContext } from "../types/index.js"
import { isInBounds, isObstacle, getCharacterAt } from "../utils/index.js"
import { cloneWorld } from "../core/world.js"

/**
 * MOVE アクション
 * キャラクターを隣接セルに移動
 */
export const MoveAction: ActionDefinition = {
  id: "MOVE",
  descriptionForLLM: "隣接する空いているセルに移動します。",

  canExecute(world: World, actor: Character): boolean {
    // 生きていれば移動可能
    return actor.alive
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    const candidates: Record<string, unknown>[] = []

    // 8方向の隣接セルをチェック
    const directions = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },                      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
    ]

    for (const dir of directions) {
      const newX = actor.x + dir.dx
      const newY = actor.y + dir.dy

      if (isInBounds(world, newX, newY) &&
          !isObstacle(world, newX, newY) &&
          !getCharacterAt(world, newX, newY)) {
        candidates.push({ x: newX, y: newY })
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

    const x = params.x as number
    const y = params.y as number

    // パラメータの検証
    if (x === undefined || y === null || isNaN(x) || y === undefined || y === null || isNaN(y)) {
      console.warn(`⚠️ Move cancelled: ${actor.id} has invalid coordinates (${x}, ${y})`)
      return {
        worldAfter: updatedWorld,
        alignmentTags: [],
        logDetail: {
          from: { x: actor.x, y: actor.y },
          to: { x: actor.x, y: actor.y },
          cancelled: true,
          reason: "Invalid coordinates"
        }
      }
    }

    // 移動前に再度チェック（他のキャラクターが同時に移動した可能性があるため）
    const occupyingCharacter = getCharacterAt(updatedWorld, x, y)
    if (occupyingCharacter && occupyingCharacter.id !== actor.id) {
      // 移動先が既に占有されている場合は移動をキャンセル（元の位置に留まる）
      console.warn(`⚠️ Move cancelled: ${actor.id} tried to move to (${x}, ${y}) but occupied by ${occupyingCharacter.id}`)
      return {
        worldAfter: updatedWorld,
        alignmentTags: [],
        logDetail: {
          from: { x: actor.x, y: actor.y },
          to: { x: actor.x, y: actor.y },
          cancelled: true,
          reason: "Position occupied"
        }
      }
    }

    // 移動実行
    updatedActor.x = x
    updatedActor.y = y

    return {
      worldAfter: updatedWorld,
      alignmentTags: [],
      logDetail: {
        from: { x: actor.x, y: actor.y },
        to: { x, y }
      }
    }
  }
}
