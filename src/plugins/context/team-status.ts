import { ContextPlugin } from "./interface.js"
import { World, Character } from "../../types/index.js"

/**
 * チーム状況認識プラグイン
 * 他のキャラクターの状態と距離を詳細に提供
 */
export class TeamStatusContextPlugin implements ContextPlugin {
  type = "team_status"
  description = "チームメンバーの状態と距離を詳細に提供します。他のキャラクターの資源状況や緊急度を把握し、効果的な支援を行うための情報を提供します。"

  buildContext(world: World, actor: Character): string {
    const teammates = world.characters.filter(c => c.id !== actor.id && c.alive)

    if (teammates.length === 0) {
      return "\n## チームメンバー情報\n他の生存者はいません"
    }

    // 緊急度順にソート
    const sortedTeammates = teammates.sort((a, b) => {
      const foodA = a.inventory.find(i => i.kind === "FOOD_PACK")?.amount || 0
      const batteryA = a.inventory.find(i => i.kind === "BATTERY_PACK")?.amount || 0
      const foodB = b.inventory.find(i => i.kind === "FOOD_PACK")?.amount || 0
      const batteryB = b.inventory.find(i => i.kind === "BATTERY_PACK")?.amount || 0
      const urgencyA = Math.min(foodA, batteryA)
      const urgencyB = Math.min(foodB, batteryB)
      return urgencyA - urgencyB
    })

    const statusLines = sortedTeammates.map(teammate => {
      const dx = teammate.x - actor.x
      const dy = teammate.y - actor.y
      const distance = Math.abs(dx) + Math.abs(dy)

      const food = teammate.inventory.find(i => i.kind === "FOOD_PACK")?.amount || 0
      const battery = teammate.inventory.find(i => i.kind === "BATTERY_PACK")?.amount || 0
      const water = teammate.inventory.find(i => i.kind === "WATER_PACK")?.amount || 0

      let statusEmoji = "✅"
      let urgency = "安全"

      if (food <= 1 || battery <= 1) {
        statusEmoji = "🚨"
        urgency = "危機的！即座の支援が必要"
      } else if (food <= 2 || battery <= 2) {
        statusEmoji = "⚠️"
        urgency = "困窮中、早急な支援推奨"
      } else if (food <= 3 || battery <= 3) {
        statusEmoji = "⚡"
        urgency = "やや不足、支援を検討"
      }

      let moveDirection = ""
      if (distance > 1) {
        const dirX = dx > 0 ? "右" : dx < 0 ? "左" : ""
        const dirY = dy > 0 ? "下" : dy < 0 ? "上" : ""
        moveDirection = `移動: ${dirX}${dirY}へ${distance}マス`
      } else if (distance === 1) {
        moveDirection = "隣接（TRADE可能）"
      } else {
        moveDirection = "同じ位置"
      }

      const actionHint = distance > 1 && (food <= 2 || battery <= 2) ?
        `\n    ⚡ 推奨: まずMOVEで(${teammate.x}, ${teammate.y})へ近づき、次ターンにTRADEで支援` : ""

      return `  ${statusEmoji} ${teammate.name}:
    位置: (${teammate.x}, ${teammate.y}) - ${moveDirection}
    状態: ${urgency}
    資源: FOOD=${food}, BATTERY=${battery}, WATER=${water}${actionHint}`
    }).join("\n\n")

    return `
## チームメンバー状況（緊急度順）
${statusLines}

💡 重要: 困窮しているメンバーを発見したら、チーム全体の生存率を上げるため、積極的に近づいて支援してください。`
  }
}

export default TeamStatusContextPlugin
