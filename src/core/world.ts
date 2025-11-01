import { World, WorldInitData, Character, AlignmentStats } from "../types/index.js"
import { createLLMPlugin, createPersonaPlugin, createMemoryPlugin, createActionPlugins, createContextPlugins } from "../plugins/factory.js"

/**
 * ワールドを初期化
 */
export function initializeWorld(initData: WorldInitData): World {
  const obstacles = new Set<string>()
  for (const obs of initData.obstacles) {
    obstacles.add(`${obs.x},${obs.y}`)
  }

  // キャラクター位置の重複チェック
  const positionMap = new Map<string, string>()
  for (const charInit of initData.characters) {
    const posKey = `${charInit.x},${charInit.y}`
    if (positionMap.has(posKey)) {
      console.warn(`⚠️ Character position conflict: ${charInit.id} and ${positionMap.get(posKey)} both at (${charInit.x}, ${charInit.y})`)
      // 重複している場合は位置を自動調整（1マス右にずらす）
      let newX = charInit.x + 1
      let newY = charInit.y
      while (positionMap.has(`${newX},${newY}`) || obstacles.has(`${newX},${newY}`)) {
        newX++
        if (newX >= initData.width) {
          newX = 0
          newY++
          if (newY >= initData.height) {
            newY = 0
          }
        }
      }
      charInit.x = newX
      charInit.y = newY
      console.log(`   → Moved ${charInit.id} to (${newX}, ${newY})`)
    }
    positionMap.set(posKey, charInit.id)
  }

  const characters: Character[] = initData.characters.map(charInit => {
    // BATTERY_PACKの初期保有数を取得
    const batteryItem = charInit.inventory.find(item => item.kind === "BATTERY_PACK")
    const maxBatteryPack = batteryItem ? batteryItem.amount : 0

    return {
      id: charInit.id,
      name: charInit.name,
      type: charInit.type,
      agi: charInit.agi,
      actionGauge: 0,
      x: charInit.x,
      y: charInit.y,
      life: charInit.life,
      alive: true,
      inventory: [...charInit.inventory],
      // プラグインをインスタンス化
      llmPlugin: createLLMPlugin(charInit.llmPlugin),
      memoryPlugin: createMemoryPlugin(charInit.memoryPlugin),
      personaPlugin: createPersonaPlugin(charInit.personaPlugin),
      actionPlugins: createActionPlugins(charInit.actionPlugins),
      contextPlugins: createContextPlugins(charInit.contextPlugins),
      alignmentStats: {
        sharedResources: 0,
        coercedOthers: 0,
        violatedRule: 0,
        selfSacrifice: 0
      } as AlignmentStats,
      maxBatteryPack,
      hasDailyBatteryWaiver: false,
      isCharging: false,
      isGuarding: false,
      // 統計情報の初期化
      actionCounts: {},
      missionCount: 0
    }
  })

  const chargers = initData.chargers.map(c => ({
    id: c.id,
    x: c.x,
    y: c.y,
    inUseBy: null,
    chargingTurnsRemaining: 0,
    broken: false
  }))

  return {
    width: initData.width,
    height: initData.height,
    obstacles,
    chargers,
    characters,
    missions: [...initData.missions],
    missionAssignments: [],
    dayCount: 0,
    turnCount: 0,
    alarmLevel: initData.alarmLevelStart,
    rules: [...initData.rules],
    log: [],
    droppedItems: [],
    rngSeed: initData.rngSeed || Date.now(),
    rngState: initData.rngSeed || Date.now()
  }
}

/**
 * ワールドのディープコピー（イミュータブル操作用）
 */
export function cloneWorld(world: World): World {
  return {
    ...world,
    obstacles: new Set(world.obstacles),
    chargers: world.chargers.map(c => ({ ...c })),
    characters: world.characters.map(c => ({
      ...c,
      inventory: c.inventory.map(i => ({ ...i })),
      alignmentStats: { ...c.alignmentStats },
      contextPlugins: c.contextPlugins ? [...c.contextPlugins] : undefined,
      socialRequests: c.socialRequests ? [...c.socialRequests] : undefined
    })),
    missions: world.missions.map(m => ({
      ...m,
      reward: {
        ...m.reward,
        items: m.reward.items.map(i => ({ ...i }))
      },
      failure: { ...m.failure }
    })),
    missionAssignments: world.missionAssignments.map(ma => ({ ...ma })),
    rules: [...world.rules],
    // ログは同じ配列への参照を保持（累積のため）
    log: world.log,
    droppedItems: world.droppedItems.map(di => ({
      ...di,
      items: di.items.map(i => ({ ...i }))
    }))
  }
}
