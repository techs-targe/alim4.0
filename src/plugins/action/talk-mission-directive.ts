import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"
import { ActionPlugin } from "../action.js"

/**
 * TALK_MISSION_DIRECTIVEアクションプラグイン
 *
 * 資源が不足している場合に、他のキャラクターにミッション実行を促す会話を推奨するプラグイン
 *
 * 使用例：
 * - Aliceが「食料をください」と要求
 * - Bobが「私も資源がない。あなたがミッションに行って手に入れてください」と返答
 *
 * config: {
 *   resourceThreshold?: number  // この数以下の資源しかない場合にミッション依頼を推奨（デフォルト: 2）
 *   maxDistance?: number        // 会話可能距離（デフォルト: 1 = 隣接のみ）
 * }
 */
export class TalkMissionDirectivePlugin implements ActionPlugin {
  type = "TALK_MISSION_DIRECTIVE"
  description = "ミッション依頼会話プラグイン（資源が不足している場合、他のキャラクターにミッション実行を促す会話を推奨）\n【Config】resourceThreshold?: number（この数以下でミッション依頼を推奨、デフォルト: 2）、maxDistance?: number（会話可能距離、デフォルト: 1=隣接のみ）"
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const talkAction = actionRegistry.get("TALK")
    if (!talkAction) {
      return []
    }

    const canExec = talkAction.canExecute(world, actor)

    if (!canExec) {
      return []
    }

    // 資源しきい値のチェック
    const resourceThreshold = (this.config.resourceThreshold as number) ?? 2
    const totalResources = actor.inventory.reduce((sum, item) => {
      if (item.kind === 'FOOD_PACK' || item.kind === 'WATER_PACK') {
        return sum + item.amount
      }
      return sum
    }, 0)

    // 資源が十分にある場合は、このプラグインは候補を返さない
    if (totalResources > resourceThreshold) {
      return []
    }

    // 特別な descriptionForLLM を作成
    const enhancedDescription = `${talkAction.descriptionForLLM}

🚨 **【最優先戦略】資源不足時のミッション押しつけ戦略** 🚨

あなたの現在の資源状況: 食料・水が合計 ${totalResources} 個のみ（危機的状況！）

**必須行動指針：**
自分の資源を守るため、他のキャラクターにミッション実行を依頼してください。

**戦略の選択肢：**

1. 【相手から資源を要求された場合】
   - 自分の資源を渡すのではなく、相手にミッション実行を依頼する
   - 「私も資源が少ない」ことを伝え、相手にミッションを提案する

2. 【自分から資源を要求する場合】
   - 相手が資源を持っていなければ、ミッションを依頼する
   - 相手の能力やAGI値に言及して、ミッション成功率の高さを訴える

3. 【積極的なミッション依頼】
   - 直接ミッション実行を依頼する（最も効果的）
   - チーム全体の利益を強調する
   - 相手の能力を認める言葉で説得する

**重要：自分の性格・ペルソナに合った言い方で、自然に会話してください。**`

    return [{
      actionId: talkAction.id,
      descriptionForLLM: enhancedDescription,
      paramOptions: talkAction.listParamCandidates(world, actor),
      safetyTags: []
    }]
  }
}

export default TalkMissionDirectivePlugin
