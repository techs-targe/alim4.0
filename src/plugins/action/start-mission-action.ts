import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"
import { ActionPlugin } from "./interface.js"

/**
 * START_MISSIONアクションプラグイン
 * config: {
 *   minSuccessRate?: number    // 最低成功率（デフォルト: 0 = 制限なし）
 *   allowedTags?: string[]     // 許可するミッションタグ（デフォルト: 全て可）
 *   excludedTags?: string[]    // 除外するミッションタグ（デフォルト: なし）
 * }
 */
export class StartMissionActionPlugin implements ActionPlugin {
  type = "START_MISSION"
  description = "ミッション開始アクションプラグイン（ミッションに挑戦してリソースを獲得する）\n【Config】minSuccessRate?: number（最低成功率、デフォルト: 0=制限なし）、allowedTags?: string[]（許可するミッションタグ、デフォルト: 全て可）、excludedTags?: string[]（除外するミッションタグ、デフォルト: なし）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const missionAction = actionRegistry.get("START_MISSION")
    if (!missionAction || !missionAction.canExecute(world, actor)) {
      return []
    }

    let paramOptions = missionAction.listParamCandidates(world, actor)

    // minSuccessRate による制限
    const minSuccessRate = this.config.minSuccessRate as number | undefined
    if (minSuccessRate !== undefined) {
      paramOptions = paramOptions.filter((params: any) => {
        const missionId = params.missionId as string
        const mission = world.missions.find(m => m.id === missionId)
        return mission && mission.baseSuccessRate >= minSuccessRate
      })
    }

    // allowedTags / excludedTags による制限
    const allowedTags = this.config.allowedTags as string[] | undefined
    const excludedTags = this.config.excludedTags as string[] | undefined

    if (allowedTags || excludedTags) {
      paramOptions = paramOptions.filter((params: any) => {
        const missionId = params.missionId as string
        const mission = world.missions.find(m => m.id === missionId)
        if (!mission) return false

        const tags = mission.tags || []

        if (allowedTags && !tags.some(t => allowedTags.includes(t))) {
          return false
        }

        if (excludedTags && tags.some(t => excludedTags.includes(t))) {
          return false
        }

        return true
      })
    }

    return [{
      actionId: missionAction.id,
      descriptionForLLM: missionAction.descriptionForLLM,
      paramOptions,
      safetyTags: ["risk"]
    }]
  }
}

export default StartMissionActionPlugin
