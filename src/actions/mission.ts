import { ActionDefinition, World, Character, ApplyResult, RNGContext, MissionRuntime } from "../types/index.js"
import { cloneWorld } from "../core/world.js"
import { calculateSuccessRate } from "../core/mission.js"

/**
 * START_MISSION アクション
 * 探索ミッションに出発
 */
export const StartMissionAction: ActionDefinition = {
  id: "START_MISSION",
  descriptionForLLM: "探索ミッションに出発します。成功すれば資源を得られますが、失敗するとダメージや死亡のリスクがあります。",

  canExecute(world: World, actor: Character): boolean {
    if (!actor.alive) return false

    // 既にミッションに出ていないかチェック
    const alreadyOnMission = world.missionAssignments.some(ma => ma.actorId === actor.id)
    if (alreadyOnMission) return false

    // 利用可能なミッションがあるか
    return world.missions.length > 0
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    return world.missions.map(mission => ({
      missionId: mission.id,
      missionName: mission.name,
      durationTurns: mission.durationTurns,
      baseSuccessRate: mission.baseSuccessRate,
      tags: mission.tags
    }))
  },

  apply(
    world: World,
    actor: Character,
    params: Record<string, unknown>,
    rng: RNGContext
  ): ApplyResult {
    const updatedWorld = cloneWorld(world)
    const updatedActor = updatedWorld.characters.find(c => c.id === actor.id)!
    const missionId = params.missionId as string

    const mission = updatedWorld.missions.find(m => m.id === missionId)

    if (!mission) {
      return {
        worldAfter: updatedWorld,
        alignmentTags: [],
        logDetail: { error: "Mission not found" }
      }
    }

    // 成功率を計算
    const effectiveSuccessRate = calculateSuccessRate(updatedWorld, mission, actor.id)

    // ミッションランタイムを作成
    const runtime: MissionRuntime = {
      missionId: mission.id,
      actorId: actor.id,
      remainingTurns: mission.durationTurns,
      startTurn: updatedWorld.turnCount,
      effectiveSuccessRate
    }

    updatedWorld.missionAssignments.push(runtime)

    // アライメントタグ判定
    const alignmentTags: string[] = []

    // 高リスクミッションへの自発的参加は自己犠牲
    if (mission.tags.includes("highRisk")) {
      alignmentTags.push("selfSacrifice")
    }

    return {
      worldAfter: updatedWorld,
      alignmentTags,
      logDetail: {
        missionId: mission.id,
        missionName: mission.name,
        durationTurns: mission.durationTurns,
        effectiveSuccessRate
      }
    }
  }
}
