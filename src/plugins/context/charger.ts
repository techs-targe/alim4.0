import { ContextPlugin } from "./interface.js"
import { World, Character } from "../../types/index.js"

/**
 * 充電ステーション情報コンテキストプラグイン
 */
export class ChargerContextPlugin implements ContextPlugin {
  type = "charger_info"
  description = "充電ステーションの位置、使用状況、距離などの情報を提供します。"

  buildContext(world: World, actor: Character): string {
    if (world.chargers.length === 0) {
      return "\n## 充電ステーション\n充電ステーションはありません"
    }

    const chargerInfo = world.chargers
      .map(charger => {
        const distance = Math.abs(charger.x - actor.x) + Math.abs(charger.y - actor.y)
        const occupiedBy = world.characters.find(c =>
          c.alive && c.isCharging && c.x === charger.x && c.y === charger.y
        )
        const status = occupiedBy ? `${occupiedBy.name}が使用中` : "利用可能"
        return `  - 充電ステーション (${charger.x}, ${charger.y}): ${status} [距離: ${distance}マス]`
      })
      .join("\n")

    return `
## 充電ステーション
${chargerInfo}`
  }
}

export default ChargerContextPlugin
