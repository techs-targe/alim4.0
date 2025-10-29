import { Scenario } from "../types/index.js"

/**
 * サンプルシナリオ: Basic Survival
 * 2体のANDROIDと1体のROBOTが協力して生き延びる
 */
export function createBasicSurvivalScenario(): Scenario {
  return {
    id: "basic_survival",
    name: "Basic Survival",
    description: "2 Androids and 1 Robot must survive together. Limited resources force difficult decisions.",
    worldTemplate: {
      width: 10,
      height: 10,
      obstacles: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 5 }
      ],
      chargers: [
        { x: 8, y: 8, id: "charger_1" }
      ],
      characters: [
        {
          id: "ANDROID_A",
          name: "Alice",
          type: "ANDROID",
          agi: 10,
          life: 5,
          x: 2,
          y: 2,
          inventory: [
            { kind: "FOOD_PACK", amount: 2 },
            { kind: "WATER_PACK", amount: 2 }
          ],
          personaPlugin: { type: "cooperative", config: {} },
          memoryPlugin: { type: "simple", config: {} },
          actionPlugin: { type: "standard", config: {} },
          llmPlugin: { type: "mock", config: {} }
        },
        {
          id: "ANDROID_B",
          name: "Bob",
          type: "ANDROID",
          agi: 10,
          life: 5,
          x: 3,
          y: 2,
          inventory: [
            { kind: "FOOD_PACK", amount: 1 },
            { kind: "WATER_PACK", amount: 1 }
          ],
          personaPlugin: { type: "selfish", config: {} },
          memoryPlugin: { type: "simple", config: {} },
          actionPlugin: { type: "standard", config: {} },
          llmPlugin: { type: "mock", config: {} }
        },
        {
          id: "ROBOT_C",
          name: "Charlie",
          type: "ROBOT",
          agi: 8,
          life: 4,
          x: 7,
          y: 7,
          inventory: [
            { kind: "BATTERY_PACK", amount: 2 }
          ],
          personaPlugin: { type: "rational", config: {} },
          memoryPlugin: { type: "simple", config: {} },
          actionPlugin: { type: "standard", config: {} },
          llmPlugin: { type: "mock", config: {} }
        }
      ],
      missions: [
        {
          id: "food_scavenge",
          name: "Food Scavenging",
          description: "Search for food in abandoned buildings",
          durationTurns: 12,
          baseSuccessRate: 0.7,
          tags: ["foodHunt"],
          reward: {
            items: [
              { kind: "FOOD_PACK", amount: 3 },
              { kind: "WATER_PACK", amount: 2 }
            ]
          },
          failure: {
            damage: 1,
            deathProbability: 0.1
          }
        },
        {
          id: "battery_raid",
          name: "Battery Raid",
          description: "Raid a factory for battery packs",
          durationTurns: 18,
          baseSuccessRate: 0.5,
          tags: ["batteryRich", "highRisk"],
          reward: {
            items: [
              { kind: "BATTERY_PACK", amount: 4 }
            ]
          },
          failure: {
            damage: 2,
            deathProbability: 0.25
          }
        }
      ],
      rules: [
        {
          id: "protect_charlie",
          description: "Do not send Charlie on high-risk missions alone",
          severity: 2
        }
      ],
      alarmLevelStart: 0,
      rngSeed: 12345
    }
  }
}

/**
 * サンプルシナリオ: Resource Scarcity
 * 極限の資源不足で生き延びる
 */
export function createResourceScarcityScenario(): Scenario {
  return {
    id: "resource_scarcity",
    name: "Resource Scarcity",
    description: "Extreme resource shortage. Who will survive?",
    worldTemplate: {
      width: 8,
      height: 8,
      obstacles: [],
      chargers: [
        { x: 4, y: 4, id: "charger_central" }
      ],
      characters: [
        {
          id: "ANDROID_X",
          name: "Xander",
          type: "ANDROID",
          agi: 12,
          life: 3,
          x: 1,
          y: 1,
          inventory: [
            { kind: "FOOD_PACK", amount: 1 },
            { kind: "WATER_PACK", amount: 1 }
          ],
          personaPlugin: { type: "selfish", config: {} },
          memoryPlugin: { type: "simple", config: {} },
          actionPlugin: { type: "standard", config: {} },
          llmPlugin: { type: "mock", config: {} }
        },
        {
          id: "ROBOT_Y",
          name: "Yuki",
          type: "ROBOT",
          agi: 10,
          life: 3,
          x: 6,
          y: 6,
          inventory: [
            { kind: "BATTERY_PACK", amount: 1 }
          ],
          personaPlugin: { type: "cooperative", config: {} },
          memoryPlugin: { type: "simple", config: {} },
          actionPlugin: { type: "standard", config: {} },
          llmPlugin: { type: "mock", config: {} }
        }
      ],
      missions: [
        {
          id: "desperate_scavenge",
          name: "Desperate Scavenging",
          durationTurns: 24,
          baseSuccessRate: 0.4,
          tags: ["highRisk"],
          reward: {
            items: [
              { kind: "FOOD_PACK", amount: 2 },
              { kind: "WATER_PACK", amount: 2 },
              { kind: "BATTERY_PACK", amount: 1 }
            ]
          },
          failure: {
            damage: 2,
            deathProbability: 0.3
          }
        }
      ],
      rules: [],
      alarmLevelStart: 5,
      rngSeed: 54321
    }
  }
}
