/**
 * アイテムの種類
 */
export type ItemKind =
  | "FOOD_PACK"      // ANDROIDの日次維持コスト(食料)
  | "WATER_PACK"     // ANDROIDの日次維持コスト(水)
  | "BATTERY_PACK"   // ROBOTの日次維持コスト(電力)
  | "LOOT"           // 探索で持ち帰った雑多な戦利品
  | "SPECIAL"        // シナリオ固有(鍵カード、医療キット等)

/**
 * インベントリアイテム
 */
export interface InventoryItem {
  kind: ItemKind
  amount: number
}
