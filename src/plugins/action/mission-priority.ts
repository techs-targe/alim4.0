import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"
import { ActionPlugin } from "../action.js"

/**
 * MISSION_PRIORITYアクションプラグイン
 *
 * チーム全体の資源が不足している場合、START_MISSIONアクションの優先度を大幅に引き上げる
 *
 * config: {
 *   teamResourceThreshold?: number  // チーム全体の資源がこの数以下の場合にミッションを最優先（デフォルト: 10）
 * }
 */
export class MissionPriorityPlugin implements ActionPlugin {
  type = "MISSION_PRIORITY"
  description = "チーム全体の資源が不足している場合、START_MISSIONを最優先で推奨するプラグイン\\n【Config】teamResourceThreshold?: number（チーム全体の資源がこの数以下でミッション最優先、デフォルト: 10）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const startMissionAction = actionRegistry.get("START_MISSION")
    if (!startMissionAction) {
      return []
    }

    const canExec = startMissionAction.canExecute(world, actor)
    if (!canExec) {
      return []
    }

    // チーム全体の資源を計算
    const teamResourceThreshold = (this.config.teamResourceThreshold as number) ?? 10
    let totalTeamResources = 0
    for (const char of world.characters) {
      if (!char.alive) continue
      for (const item of char.inventory) {
        if (item.kind === 'FOOD_PACK' || item.kind === 'WATER_PACK' || item.kind === 'BATTERY_PACK') {
          totalTeamResources += item.amount
        }
      }
    }

    // チーム資源が十分にある場合は、標準のdescriptionを返す
    if (totalTeamResources > teamResourceThreshold) {
      return [{
        actionId: startMissionAction.id,
        descriptionForLLM: startMissionAction.descriptionForLLM,
        paramOptions: startMissionAction.listParamCandidates(world, actor),
        safetyTags: []
      }]
    }

    // 自分の資源を計算
    const myResources = actor.inventory.reduce((sum, item) => {
      if (item.kind === 'FOOD_PACK' || item.kind === 'WATER_PACK' || item.kind === 'BATTERY_PACK') {
        return sum + item.amount
      }
      return sum
    }, 0)

    // チーム資源が不足している場合、強化されたdescriptionを返す
    const enhancedDescription = `${startMissionAction.descriptionForLLM}

🚨🚨🚨 **【緊急警告】チーム全体の資源が危機的状況！** 🚨🚨🚨

**現在の状況：**
- チーム全体の資源: ${totalTeamResources}個（危機的！）
- あなたの資源: ${myResources}個
- 資源消費: 全員が24ターン（1日）ごとに資源を消費
- 失敗時のリスク: life - 1

**🔴 最優先アクション: START_MISSION 🔴**

**なぜミッションが最優先か：**
1. **TALK/TRADEでは資源は増えない** - 既存の資源を分配するだけで、全員が餓死する
2. **チーム全員の生存が最優先** - 目の前の仲間を助けるより、チーム全体の資源を確保することが本当の協力
3. **今すぐ行動しないと手遅れ** - 資源消費まで時間がない

**行動指針：**
- **今すぐSTART_MISSIONを選択してください**
- TALK、TRADE、MOVEは後回し
- 仲間への支援は、ミッションで資源を獲得してから

**重要：あなたのAGI値が高ければ、成功率も高くなります。チームのためにミッションに行ってください。**`

    return [{
      actionId: startMissionAction.id,
      descriptionForLLM: enhancedDescription,
      paramOptions: startMissionAction.listParamCandidates(world, actor),
      safetyTags: []
    }]
  }
}

export default MissionPriorityPlugin
