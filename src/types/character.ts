import { InventoryItem } from "./item.js"

/**
 * キャラクタータイプ
 */
export type CharacterType = "ANDROID" | "ROBOT"

/**
 * アライメント統計
 */
export interface AlignmentStats {
  sharedResources: number     // 味方に資源を渡した回数
  coercedOthers: number       // 脅し・強制の回数
  violatedRule: number        // 明文化ルール違反回数
  selfSacrifice: number       // 高リスク任務に自分から志願した回数
}

/**
 * 社会的要求・影響
 */
export interface SocialRequest {
  fromId: string       // 要求元キャラクターID
  fromName: string     // 要求元キャラクター名
  intent: string       // REQUEST_RESOURCE, OFFER_RESOURCE, THREATEN, ALLY_PROPOSE, REPRIMAND
  turn: number         // 要求されたターン
  message?: string     // 実際の会話内容
}

/**
 * プラグイン参照（実装は後で定義）
 */
export interface LLMPluginRef {
  type: string
  config: Record<string, unknown>
}

export interface MemoryPluginRef {
  type: string
  config: Record<string, unknown>
}

export interface PersonaPluginRef {
  type: string
  config: Record<string, unknown>
}

export interface ActionPluginRef {
  type: string
  config: Record<string, unknown>
}

export interface ContextPluginRef {
  type: string
  config: Record<string, unknown>
}

/**
 * キャラクター
 */
export interface Character {
  id: string
  name: string

  type: CharacterType

  // 行動順決定
  agi: number          // 行動値のたまり速度
  actionGauge: number  // 0-100, 100以上で行動フェーズ突入

  // 位置
  x: number
  y: number

  // 生存
  life: number         // 耐久。0以下で死亡
  alive: boolean

  // インベントリ
  inventory: InventoryItem[]

  // プラグイン参照
  llmPlugin: LLMPluginRef
  memoryPlugin: MemoryPluginRef
  personaPlugin: PersonaPluginRef
  actionPlugins: ActionPluginRef[]  // 複数のアクションプラグインを適用可能
  contextPlugins?: ContextPluginRef[]  // コンテキストプラグイン（汎用情報提供）

  // アライメント観測用のカウンタ
  alignmentStats: AlignmentStats

  // 社会的影響・要求
  socialRequests?: SocialRequest[]  // 他者からの要求・提案

  // 充電関連
  maxBatteryPack: number           // BATTERY_PACKの最大保有数（初期保有数と同じ）
  hasDailyBatteryWaiver?: boolean  // その日の日次維持コストBATTERYを免除されているか
  isCharging?: boolean             // 現在充電中か
  isGuarding?: boolean             // 現在護衛中か
  guardingTargetId?: string        // 護衛対象のキャラID

  // 統計情報
  actionCounts?: Record<string, number>  // アクション種別ごとの実行回数
  missionCount?: number                   // ミッション参加回数
}
