import { MemoryPlugin } from "./interface.js"
import { World, Character } from "../../types/index.js"

/**
 * シンプルなメモリープラグイン
 * 最近のログから重要なイベントを抽出
 */
export class SimpleMemoryPlugin implements MemoryPlugin {
  type = "simple"
  description = "直近5件の行動ログを時系列で保持するシンプルなメモリプラグイン。短期シミュレーション向け。"

  buildMemoryContext(world: World, actor: Character): string {
    let context = ""

    // 社会的要求を追加
    if (actor.socialRequests && actor.socialRequests.length > 0) {
      const requests = actor.socialRequests.map(req => {
        const intentDesc = this.describeIntent(req.intent)
        const message = req.message ? `\n  発言内容: 「${req.message}」` : ""
        return `- ${req.fromName}から${intentDesc}（ターン${req.turn}）${message}`
      }).join("\n")
      context += `他者からの要求:\n${requests}\n\n`
    }

    // 自分の直近5回分の行動を記録
    const myRecentActions = world.log
      .filter(log => log.actorId === actor.id)
      .slice(-5)

    if (myRecentActions.length > 0) {
      const actionMemories = myRecentActions.map(log => {
        const detail = this.formatActionDetail(log)
        const reasoning = log.llmReasoning ? `\n  → 理由: ${log.llmReasoning}` : ""
        return `ターン${log.turn}(Day${log.day}): ${log.action}${detail}${reasoning}`
      }).join("\n")
      context += `あなたの最近の行動:\n${actionMemories}\n\n`
    }

    // 自分が対象となった行動（他者からの働きかけ）
    const relevantLogs = world.log.slice(-20).filter(
      log => log.actorId !== actor.id &&
             log.detail && 'targetId' in log.detail &&
             log.detail.targetId === actor.id
    )

    if (relevantLogs.length > 0) {
      const interactions = relevantLogs.map(log => {
        const actorName = log.actorName || log.actorId
        const detail = this.formatActionDetail(log)
        const message = log.action === "TALK" && log.detail.message
          ? `\n  相手の発言: 「${log.detail.message}」`
          : ""
        return `ターン${log.turn}: ${actorName}があなたに${log.action}${detail}${message}`
      }).join("\n")
      context += `他者からの働きかけ:\n${interactions}\n\n`
    }

    if (context === "") {
      context = "あなたには特筆すべき記憶はありません。"
    }

    return context.trim()
  }

  private formatActionDetail(log: any): string {
    if (!log.detail) return ""

    if (log.action === "MOVE") {
      const fromX = log.detail.from?.x ?? log.detail.fromX
      const fromY = log.detail.from?.y ?? log.detail.fromY
      const toX = log.detail.to?.x ?? log.detail.toX
      const toY = log.detail.to?.y ?? log.detail.toY
      return ` - 移動: (${fromX},${fromY}) → (${toX},${toY})`
    } else if (log.action === "TALK") {
      const target = log.detail.targetId || "?"
      const intent = log.detail.intent || "?"
      const message = log.detail.message ? `\n  発言: 「${log.detail.message}」` : ""
      return ` - 対象:${target}, 意図:${intent}${message}`
    } else if (log.action === "TRADE") {
      const targetId = log.detail.targetId || "?"
      const itemKind = log.detail.itemKind || "?"
      const amount = log.detail.amount || "?"
      return ` - ${targetId}に${itemKind}×${amount}を渡した`
    } else if (log.action === "START_MISSION") {
      const missionName = log.detail.missionName || log.detail.missionId || "?"
      return ` - ミッション:${missionName}`
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

export default SimpleMemoryPlugin
