import { ContextPlugin } from "./interface.js"
import { World, Character } from "../../types/index.js"

/**
 * 社会関係コンテキストプラグイン
 * キャラクター間の社会的関係（同盟、敵対など）を提供
 */
export class SocialContextPlugin implements ContextPlugin {
  type = "social"
  description = "キャラクター間の社会的関係（同盟、要求、提案など）を提供します。"

  buildContext(world: World, actor: Character): string {
    // 社会的要求がある場合、それを表示
    if (!actor.socialRequests || actor.socialRequests.length === 0) {
      return ""
    }

    const requests = actor.socialRequests
      .map(req => {
        const turnsSince = world.turnCount - req.turn
        return `  - ${req.fromName}: ${req.intent} (${turnsSince}ターン前)`
      })
      .join("\n")

    return `
## 社会的コンテキスト
他のキャラクターとの最近の交流:
${requests}`
  }
}

export default SocialContextPlugin
