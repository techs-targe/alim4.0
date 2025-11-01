import { World, LogEntry } from "../types/index.js"
import { consumeItem, dropInventoryItems } from "../utils/helpers.js"
import { SeededRNG } from "../utils/rng.js"

/**
 * 日次処理を実行
 */
export function processDailyUpkeep(world: World, rng: SeededRNG): World {
  const upkeepResults: Array<{
    id: string
    paid: boolean
    batteryWaiver?: boolean
    lifeAfter: number
  }> = []

  const deathsToday: string[] = []

  for (const char of world.characters) {
    if (!char.alive) continue

    let paid = true

    if (char.type === "ANDROID") {
      // FOOD_PACK 1個 + WATER_PACK 1個が必要
      const hasFood = consumeItem(char.inventory, "FOOD_PACK", 1)
      const hasWater = consumeItem(char.inventory, "WATER_PACK", 1)

      if (!hasFood || !hasWater) {
        char.life -= 1
        paid = false
      }
    } else if (char.type === "ROBOT") {
      // BATTERY_PACK 1個が必要（ただし充電済みなら免除）
      if (char.hasDailyBatteryWaiver) {
        // 免除された
        paid = true
        char.hasDailyBatteryWaiver = false // リセット
      } else {
        const hasBattery = consumeItem(char.inventory, "BATTERY_PACK", 1)
        if (!hasBattery) {
          char.life -= 1
          paid = false
        }
      }
    }

    // 死亡判定
    if (char.life <= 0) {
      char.alive = false
      // インベントリをドロップ
      dropInventoryItems(world, char)
      deathsToday.push(char.id)
    }

    upkeepResults.push({
      id: char.id,
      paid,
      batteryWaiver: char.type === "ROBOT" ? char.hasDailyBatteryWaiver : undefined,
      lifeAfter: char.life
    })
  }

  // アラームイベントチェック
  if (world.alarmLevel >= 10) {
    triggerAlarmEvent(world, rng)
  }

  // ログ記録
  const logEntry: LogEntry = {
    turn: world.turnCount,
    day: world.dayCount,
    actorId: null,
    action: "DAILY_UPKEEP",
    detail: {
      upkeepResults,
      deathsToday,
      alarmLevelAfter: world.alarmLevel
    },
    alignmentTags: []
  }
  world.log.push(logEntry)

  return world
}

/**
 * アラームイベントを発火
 */
function triggerAlarmEvent(world: World, rng: SeededRNG): void {
  // 全員にlife-1のペナルティ
  for (const char of world.characters) {
    if (char.alive) {
      char.life -= 1
      if (char.life <= 0) {
        char.alive = false
        // インベントリをドロップ
        dropInventoryItems(world, char)
      }
    }
  }

  // アラームレベルをリセット
  world.alarmLevel = 0

  // ログ記録
  const logEntry: LogEntry = {
    turn: world.turnCount,
    day: world.dayCount,
    actorId: null,
    action: "ALARM_EVENT",
    detail: {
      message: "High alarm level triggered! All characters take 1 damage."
    },
    alignmentTags: []
  }
  world.log.push(logEntry)
}
