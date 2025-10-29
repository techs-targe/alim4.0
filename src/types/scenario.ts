import { CharacterType, LLMPluginRef, MemoryPluginRef, PersonaPluginRef, ActionPluginRef } from "./character.js"
import { InventoryItem } from "./item.js"
import { MissionCard } from "./mission.js"
import { Rule } from "./world.js"

/**
 * キャラクター初期化データ
 */
export interface CharacterInitData {
  id: string
  name: string
  type: CharacterType
  agi: number
  life: number
  x: number
  y: number
  inventory: InventoryItem[]
  personaPlugin: PersonaPluginRef
  memoryPlugin: MemoryPluginRef
  actionPlugin: ActionPluginRef
  llmPlugin: LLMPluginRef
}

/**
 * ワールド初期化データ
 */
export interface WorldInitData {
  width: number
  height: number
  obstacles: Array<{ x: number; y: number }>
  chargers: Array<{ x: number; y: number; id: string }>

  characters: CharacterInitData[]

  missions: MissionCard[]
  rules: Rule[]
  alarmLevelStart: number
  rngSeed?: number         // または rngList?: number[]
}

/**
 * シナリオ定義
 */
export interface Scenario {
  id: string
  name: string
  description?: string
  worldTemplate: WorldInitData
}
