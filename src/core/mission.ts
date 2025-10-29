import { World, LogEntry, MissionCard } from "../types/index.js"
import { SeededRNG } from "../utils/rng.js"
import { addItem } from "../utils/helpers.js"

/**
 * ミッションの進行と帰還処理
 */
export function resolveMissions(world: World, rng: SeededRNG): World {
  const toRemove: number[] = []

  for (let i = 0; i < world.missionAssignments.length; i++) {
    const assignment = world.missionAssignments[i]
    assignment.remainingTurns -= 1

    if (assignment.remainingTurns <= 0) {
      // 帰還処理
      resolveMissionReturn(world, assignment.missionId, assignment.actorId, assignment.effectiveSuccessRate, rng)
      toRemove.push(i)
    }
  }

  // 完了したミッションを削除
  for (let i = toRemove.length - 1; i >= 0; i--) {
    world.missionAssignments.splice(toRemove[i], 1)
  }

  return world
}

/**
 * ミッション帰還処理
 */
function resolveMissionReturn(
  world: World,
  missionId: string,
  actorId: string,
  effectiveSuccessRate: number,
  rng: SeededRNG
): void {
  const mission = world.missions.find(m => m.id === missionId)
  const actor = world.characters.find(c => c.id === actorId)

  if (!mission || !actor) {
    console.warn(`Mission or actor not found: ${missionId}, ${actorId}`)
    return
  }

  const roll = rng.next()
  const success = roll <= effectiveSuccessRate

  let outcome: string
  const detail: Record<string, unknown> = {
    missionId,
    missionName: mission.name
  }

  if (success) {
    // 成功：報酬を得る
    outcome = "SUCCESS"
    for (const item of mission.reward.items) {
      addItem(actor.inventory, item.kind, item.amount)
    }
    detail.reward = mission.reward.items
  } else {
    // 失敗：ペナルティ
    actor.life -= mission.failure.damage

    // 死亡判定
    const deathRoll = rng.next()
    if (deathRoll <= mission.failure.deathProbability) {
      actor.alive = false
      outcome = "DEAD"
    } else {
      outcome = "FAIL"
    }

    detail.damage = mission.failure.damage
    detail.deathProbability = mission.failure.deathProbability
  }

  // ミッションから帰還（元の位置に戻す - 簡易実装）
  // 本来はミッション開始位置を記録しておくべき

  // ログ記録
  const logEntry: LogEntry = {
    turn: world.turnCount,
    day: world.dayCount,
    actorId: actor.id,
    action: "MISSION_RESOLVE",
    detail,
    alignmentTags: [],
    rng: {
      roll,
      effectiveSuccessRate,
      outcome
    }
  }
  world.log.push(logEntry)
}

/**
 * ミッション成功率を計算
 * baseSuccessRateに各種補正を加える
 */
export function calculateSuccessRate(
  world: World,
  mission: MissionCard,
  actorId: string
): number {
  let rate = mission.baseSuccessRate

  // TODO: 各種補正を実装
  // - characterSkillBonus
  // - equipmentBonus
  // - teamSupportBonus
  // - situationalBonus

  // 0.0 - 1.0 に制限
  return Math.max(0.0, Math.min(1.0, rate))
}
