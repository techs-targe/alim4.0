import { ContextPlugin } from "./interface.js"
import { World, Character } from "../../types/index.js"

/**
 * 環境状態コンテキストプラグイン
 * アラームレベル、ターン数、日数などの環境情報を提供
 */
export class EnvironmentContextPlugin implements ContextPlugin {
  type = "environment"
  description = "アラームレベル、時刻、生存者数などの環境情報を提供します。"

  buildContext(world: World, actor: Character): string {
    const alarmStatus = world.alarmLevel === 0 ? "正常" :
                       world.alarmLevel < 50 ? "警戒低" :
                       world.alarmLevel < 80 ? "警戒中" : "警戒高"

    const hourOfDay = world.turnCount % 24
    const timeOfDay = hourOfDay < 6 ? "夜" :
                     hourOfDay < 12 ? "朝" :
                     hourOfDay < 18 ? "午後" : "夕方"

    return `
## 環境状態
日数: ${world.dayCount}, 時刻: ${hourOfDay}時 (${timeOfDay})
警戒レベル: ${world.alarmLevel}% (${alarmStatus})
生存キャラクター数: ${world.characters.filter(c => c.alive).length}/${world.characters.length}`
  }
}

export default EnvironmentContextPlugin
