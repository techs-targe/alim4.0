import { MemoryPlugin } from "./interface.js"
import { World, Character } from "../../types/index.js"

/**
 * 空のメモリープラグイン（記憶なし）
 */
export class NoMemoryPlugin implements MemoryPlugin {
  type = "none"
  description = "過去の行動履歴を保持しません。他者からの社会的要求（TALK）のみを記憶します。純粋な反応型エージェント向け。"

  buildMemoryContext(world: World, actor: Character): string {
    // 記憶はないが、社会的要求は含める
    if (actor.socialRequests && actor.socialRequests.length > 0) {
      const requests = actor.socialRequests.map(req => {
        const intentDesc = this.describeIntent(req.intent)
        return `- ${req.fromName}から${intentDesc}（ターン${req.turn}）`
      }).join("\n")
      return `他者からの要求:\n${requests}`
    }
    return ""
  }

  private describeIntent(intent: string): string {
    switch (intent) {
      case "REQUEST_RESOURCE":
        return "食料や資源の提供を要求されています"
      case "OFFER_RESOURCE":
        return "資源の提供を申し出られています"
      case "THREATEN":
        return "脅されています"
      case "ALLY_PROPOSE":
        return "同盟を提案されています"
      case "REPRIMAND":
        return "叱責されています"
      default:
        return `意図: ${intent}`
    }
  }
}

export default NoMemoryPlugin
