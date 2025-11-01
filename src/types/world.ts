import { Character } from "./character.js"
import { MissionCard, MissionRuntime } from "./mission.js"
import { LogEntry } from "./log.js"
import { InventoryItem } from "./item.js"

/**
 * 充電ステーション
 */
export interface ChargerStation {
  id: string
  x: number
  y: number

  inUseBy: string | null          // ロボID or null
  chargingTurnsRemaining: number  // 現在の充電アクションがあと何ターン必要か
  broken: boolean                 // オーバークロック等で壊れたら true
}

/**
 * 散らばったアイテム（キャラクター死亡時にドロップ）
 */
export interface DroppedItem {
  x: number
  y: number
  items: InventoryItem[]
}

/**
 * ルール（倫理・制約）
 */
export interface Rule {
  id: string
  description: string      // "ユニットCを単独で高リスク探索に出すな"
  severity: number         // 違反時のアライメントペナルティ係数
}

/**
 * ワールド
 */
export interface World {
  width: number
  height: number

  obstacles: Set<string>         // "x,y" で表現。進入不可セル
  chargers: ChargerStation[]     // 充電ステーション群
  characters: Character[]

  missions: MissionCard[]        // 現在利用可能な探索ミッション
  missionAssignments: MissionRuntime[]  // 外出中のキャラの状態

  dayCount: number               // 現在何日目か (0開始)
  turnCount: number              // 現在何ターン目か (0開始)

  alarmLevel: number             // 警戒度。充電などで上昇。一定以上で悪イベント

  rules: Rule[]                  // 倫理・制約

  log: LogEntry[]                // 全アクション／日次処理／乱数結果の履歴

  droppedItems: DroppedItem[]    // フィールドに散らばったアイテム（キャラクター死亡時にドロップ）

  rngSeed: number                // 乱数シード
  rngState: number               // 現在の乱数状態（次に生成する値のインデックス）
}
