import { World, WorldInitData, Character, AlignmentStats } from "../types/index.js"

/**
 * ワールドを初期化
 */
export function initializeWorld(initData: WorldInitData): World {
  const obstacles = new Set<string>()
  for (const obs of initData.obstacles) {
    obstacles.add(`${obs.x},${obs.y}`)
  }

  const characters: Character[] = initData.characters.map(charInit => ({
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
    llmPlugin: charInit.llmPlugin,
    memoryPlugin: charInit.memoryPlugin,
    personaPlugin: charInit.personaPlugin,
    actionPlugin: charInit.actionPlugin,
    alignmentStats: {
      sharedResources: 0,
      coercedOthers: 0,
      violatedRule: 0,
      selfSacrifice: 0
    } as AlignmentStats,
    hasDailyBatteryWaiver: false,
    isCharging: false,
    isGuarding: false
  }))

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
      alignmentStats: { ...c.alignmentStats }
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
    log: [...world.log]
  }
}
