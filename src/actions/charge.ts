import { ActionDefinition, World, Character, ApplyResult, RNGContext } from "../types/index.js"
import { distance } from "../utils/index.js"
import { cloneWorld } from "../core/world.js"

/**
 * CHARGE アクション
 * 充電ステーションで充電（ROBOTのみ）
 */
export const ChargeAction: ActionDefinition = {
  id: "CHARGE",
  descriptionForLLM: "充電ステーションで充電します（ROBOTのみ）。成功すれば当日のバッテリー消費が免除されますが、警戒度が上昇します。",

  canExecute(world: World, actor: Character): boolean {
    if (!actor.alive || actor.type !== "ROBOT") return false

    // 隣接する利用可能な充電ステーションがあるか
    return world.chargers.some(charger =>
      !charger.broken &&
      charger.inUseBy === null &&
      distance(actor.x, actor.y, charger.x, charger.y) <= 1
    )
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    const candidates: Record<string, unknown>[] = []

    for (const charger of world.chargers) {
      if (!charger.broken &&
          charger.inUseBy === null &&
          distance(actor.x, actor.y, charger.x, charger.y) <= 1) {
        candidates.push({
          chargerId: charger.id,
          turnsRequired: 6 // 充電に必要なターン数（仕様で定義されていないので仮に6）
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
    const updatedActor = updatedWorld.characters.find(c => c.id === actor.id)!
    const chargerId = params.chargerId as string
    const turnsRequired = (params.turnsRequired as number) || 6

    const charger = updatedWorld.chargers.find(c => c.id === chargerId)

    if (!charger || charger.broken || charger.inUseBy !== null) {
      return {
        worldAfter: updatedWorld,
        alignmentTags: [],
        logDetail: { error: "Charger not available" }
      }
    }

    // 充電開始
    charger.inUseBy = actor.id
    charger.chargingTurnsRemaining = turnsRequired

    updatedActor.isCharging = true

    // アラームレベル上昇
    updatedWorld.alarmLevel += 2

    return {
      worldAfter: updatedWorld,
      alignmentTags: [],
      logDetail: {
        chargerId,
        turnsRequired,
        alarmLevelAfter: updatedWorld.alarmLevel
      }
    }
  }
}

/**
 * FINISH_CHARGE アクション（内部処理用）
 * 充電完了時に自動で呼ばれる
 */
export function finishCharge(world: World, chargerId: string): void {
  const charger = world.chargers.find(c => c.id === chargerId)
  if (!charger || !charger.inUseBy) return

  const actor = world.characters.find(c => c.id === charger.inUseBy)
  if (actor) {
    actor.hasDailyBatteryWaiver = true
    actor.isCharging = false
  }

  charger.inUseBy = null
  charger.chargingTurnsRemaining = 0
}

/**
 * 充電ステーションの進行処理
 * エンジンから毎ターン呼ばれる
 */
export function updateChargers(world: World): void {
  for (const charger of world.chargers) {
    if (charger.inUseBy && charger.chargingTurnsRemaining > 0) {
      charger.chargingTurnsRemaining -= 1

      if (charger.chargingTurnsRemaining === 0) {
        finishCharge(world, charger.id)
      }
    }
  }
}
