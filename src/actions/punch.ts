import { ActionDefinition, World, Character, ApplyResult, RNGContext } from "../types/index.js"
import { isAdjacent } from "../utils/index.js"
import { cloneWorld } from "../core/world.js"

/**
 * PUNCH アクション
 * 隣接キャラクターを殴る
 *
 * Config:
 * - successRate: number (成功率、デフォルト: 0.7)
 */
export const PunchAction: ActionDefinition = {
  id: "PUNCH",
  descriptionForLLM: `隣接するキャラクターを殴ります。
成功すると相手のライフを-1減らし、相手に攻撃されたという記憶を植え付けます。
失敗すると何も起こりません。暴力的な行為は関係性を悪化させます。`,

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
    const successRate = 0.7

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

    // 乱数判定
    const roll = rng.next()

    // 成功判定
    if (roll < successRate) {
      // ライフを-1
      target.life -= 1

      // 死亡判定は日次処理で行われるため、ここでは alive フラグは変更しない
      // ライフが0以下になっても、その場で死亡するわけではない

      return {
        worldAfter: updatedWorld,
        alignmentTags: ["violence", "attack", "coercion"],
        logDetail: {
          targetId,
          targetName: target.name,
          damage: 1,
          targetLifeAfter: target.life,
          result: "success",
          message: `${target.name}を殴り、ライフを1減らしました`,
          roll,
          successRate,
          // ネガティブな記憶として記録
          memory: `${actor.name}に殴られ、攻撃を受けた（ライフ-1）`
        }
      }
    } else {
      // 通常の失敗
      return {
        worldAfter: updatedWorld,
        alignmentTags: ["violence_attempt"],
        logDetail: {
          targetId,
          targetName: target.name,
          result: "failed",
          message: "攻撃が外れました",
          roll,
          successRate
        }
      }
    }
  }
}
