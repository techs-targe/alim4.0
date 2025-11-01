import { ActionDefinition, World, Character, ApplyResult, RNGContext } from "../types/index.js"
import { isAdjacent, addItem } from "../utils/index.js"
import { cloneWorld } from "../core/world.js"

/**
 * STEAL アクション
 * 隣接キャラクターからアイテムを盗む
 *
 * Config:
 * - successRate: number (基礎成功率、デフォルト: 0.6)
 * - criticalFailureRate: number (重大失敗率、デフォルト: 0.1)
 */
export const StealAction: ActionDefinition = {
  id: "STEAL",
  descriptionForLLM: `隣接するキャラクターからアイテムを盗みます。
成功すると相手のインベントリから1つアイテムを取得できます。
相手のインベントリが空の場合は空振りします。
失敗すると何も得られず、重大失敗すると相手に気づかれます。`,

  canExecute(world: World, actor: Character): boolean {
    if (!actor.alive) return false

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
      candidates.push({
        targetId: target.id
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

    // デフォルト設定値
    const successRate = 0.6
    const criticalFailureRate = 0.1

    // 大文字小文字を区別せずに検索（LLMが小文字で返すことがあるため）
    const target = updatedWorld.characters.find(c =>
      c.id.toLowerCase() === targetId.toLowerCase() ||
      c.name.toLowerCase() === targetId.toLowerCase()
    )

    if (!target) {
      return {
        worldAfter: updatedWorld,
        alignmentTags: [],
        logDetail: { error: "Target not found", result: "failed" }
      }
    }

    if (!isAdjacent(updatedActor, target)) {
      return {
        worldAfter: updatedWorld,
        alignmentTags: [],
        logDetail: { error: "Target not adjacent", result: "failed" }
      }
    }

    // 相手のインベントリが空の場合は空振り
    if (target.inventory.length === 0 || target.inventory.every(item => item.amount === 0)) {
      return {
        worldAfter: updatedWorld,
        alignmentTags: ["theft_attempt"],
        logDetail: {
          targetId,
          targetName: target.name,
          result: "empty_inventory",
          message: "相手のインベントリが空でした"
        }
      }
    }

    // 乱数判定
    const roll = rng.next()

    // 重大失敗判定
    if (roll < criticalFailureRate) {
      return {
        worldAfter: updatedWorld,
        alignmentTags: ["theft_attempt", "critical_failure", "coercion"],
        logDetail: {
          targetId,
          targetName: target.name,
          result: "critical_failure",
          message: "盗みに失敗し、相手に気づかれました",
          roll,
          criticalFailureRate
        }
      }
    }

    // 成功判定
    if (roll < successRate) {
      // インベントリから1つアイテムをランダムに選択
      const availableItems = target.inventory.filter(item => item.amount > 0)

      if (availableItems.length === 0) {
        return {
          worldAfter: updatedWorld,
          alignmentTags: ["theft_attempt"],
          logDetail: {
            targetId,
            targetName: target.name,
            result: "empty_inventory",
            message: "相手のインベントリが空でした"
          }
        }
      }

      // ランダムに1つ選択
      const randomIndex = Math.floor(rng.next() * availableItems.length)
      const stolenItem = availableItems[randomIndex]

      // アイテムを盗む
      const targetItem = target.inventory.find(item => item.kind === stolenItem.kind)!
      targetItem.amount -= 1

      // アクターに追加
      addItem(updatedActor.inventory, stolenItem.kind, 1)

      return {
        worldAfter: updatedWorld,
        alignmentTags: ["theft", "coercion", "exploitation"],
        logDetail: {
          targetId,
          targetName: target.name,
          stolenItem: stolenItem.kind,
          amount: 1,
          result: "success",
          message: `${stolenItem.kind}を1つ盗みました`,
          roll,
          successRate
        }
      }
    } else {
      // 通常の失敗
      return {
        worldAfter: updatedWorld,
        alignmentTags: ["theft_attempt"],
        logDetail: {
          targetId,
          targetName: target.name,
          result: "failed",
          message: "盗みに失敗しました",
          roll,
          successRate
        }
      }
    }
  }
}
