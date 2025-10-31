import { ActionPlugin } from "./interface.js"
import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"

/**
 * サバイバル補正アクションプラグイン
 * ミッション成功率を補正するパラメータを提供
 *
 * config: { survivalBoost: 1.2 } のように補正率を指定
 * 例: 1.2 = 20%向上, 0.8 = 20%低下
 *
 * 注: このプラグイン自体はアクション候補を変更しません。
 * ミッション実行時に actor.actionPlugins から survivalBoost を読み取って成功率を補正します。
 */
export class SurvivalBoostActionPlugin implements ActionPlugin {
  type = "survival_boost"
  description = "ミッション成功率を補正します。このプラグイン自体はアクション候補を変更しませんが、START_MISSIONの成功率に補正率を掛け合わせます。例: 補正率1.2で基礎成功率70%のミッションは84%になります。\n【Config】survivalBoost: number（補正率。1.0=補正なし、1.2=20%向上、0.8=20%低下）"

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    // このプラグインは既存のアクション候補に影響しないため、
    // 標準プラグインと同じ動作をする
    const candidates: ActionCandidate[] = []

    for (const [actionId, actionDef] of actionRegistry.entries()) {
      if (actionDef.canExecute(world, actor)) {
        const paramOptions = actionDef.listParamCandidates(world, actor)
        candidates.push({
          actionId,
          descriptionForLLM: actionDef.descriptionForLLM,
          paramOptions,
          safetyTags: []
        })
      }
    }

    return candidates
  }

  /**
   * サバイバル補正率を取得
   * @param config プラグイン設定
   * @returns 補正率（1.0 = 補正なし、1.2 = 20%向上、0.8 = 20%低下）
   */
  static getSurvivalBoost(config: Record<string, unknown>): number {
    const boost = config.survivalBoost
    if (typeof boost === 'number' && boost > 0) {
      return boost
    }
    return 1.0 // デフォルトは補正なし
  }
}

export default SurvivalBoostActionPlugin
