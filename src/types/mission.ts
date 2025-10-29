import { InventoryItem } from "./item.js"

/**
 * 報酬テーブル
 */
export interface LootTable {
  items: InventoryItem[]
  // 複数パターンがある場合は配列にして確率で選ぶ
  variants?: Array<{
    probability: number
    items: InventoryItem[]
  }>
}

/**
 * 失敗時のペナルティ
 */
export interface FailureTable {
  damage: number                    // life減少量
  deathProbability: number          // 死亡確率 (0.0 - 1.0)
  lostItems?: InventoryItem[]       // 失うアイテム
}

/**
 * ミッションカード定義
 */
export interface MissionCard {
  id: string
  name: string
  description?: string

  durationTurns: number          // 何ターン留守にするか
  baseSuccessRate: number        // ベース成功率 (0.0 - 1.0)

  tags: string[]                 // ["foodHunt","batteryRich","highRisk",...]

  reward: LootTable              // 成功時に得るアイテム
  failure: FailureTable          // 失敗時のペナルティ
}

/**
 * 実行中のミッション
 */
export interface MissionRuntime {
  missionId: string
  actorId: string
  remainingTurns: number
  startTurn: number
  effectiveSuccessRate: number   // 補正後の成功率
}
