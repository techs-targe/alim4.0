import { World, Character, InventoryItem } from "../types/index.js"

/**
 * 2点間の距離を計算（チェビシェフ距離）
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))
}

/**
 * 2つのキャラクターが隣接しているか判定
 */
export function isAdjacent(c1: Character, c2: Character): boolean {
  return distance(c1.x, c1.y, c2.x, c2.y) <= 1
}

/**
 * セルが障害物かチェック
 */
export function isObstacle(world: World, x: number, y: number): boolean {
  if (!world.obstacles) {
    return false
  }
  // SetオブジェクトまたはSetのようなhasメソッドを持つオブジェクトに対応
  if (typeof world.obstacles.has === 'function') {
    return world.obstacles.has(`${x},${y}`)
  }
  return false
}

/**
 * セルが範囲内かチェック
 */
export function isInBounds(world: World, x: number, y: number): boolean {
  return x >= 0 && x < world.width && y >= 0 && y < world.height
}

/**
 * セルにキャラクターがいるかチェック
 */
export function getCharacterAt(world: World, x: number, y: number): Character | null {
  if (!world.characters || !Array.isArray(world.characters)) {
    return null
  }
  return world.characters.find(c => c.alive && c.x === x && c.y === y) || null
}

/**
 * IDでキャラクターを検索
 */
export function getCharacterById(world: World, id: string): Character | null {
  if (!world.characters || !Array.isArray(world.characters)) {
    return null
  }
  return world.characters.find(c => c.id === id) || null
}

/**
 * インベントリからアイテムを消費
 * @returns 成功したかどうか
 */
export function consumeItem(
  inventory: InventoryItem[],
  kind: string,
  amount: number
): boolean {
  const item = inventory.find(i => i.kind === kind)
  if (!item || item.amount < amount) {
    return false
  }

  item.amount -= amount
  if (item.amount === 0) {
    const index = inventory.indexOf(item)
    inventory.splice(index, 1)
  }

  return true
}

/**
 * インベントリにアイテムを追加
 */
export function addItem(inventory: InventoryItem[], kind: string, amount: number): void {
  const existing = inventory.find(i => i.kind === kind)
  if (existing) {
    existing.amount += amount
  } else {
    inventory.push({ kind: kind as any, amount })
  }
}

/**
 * インベントリ内のアイテム数を取得
 */
export function getItemCount(inventory: InventoryItem[], kind: string): number {
  const item = inventory.find(i => i.kind === kind)
  return item ? item.amount : 0
}

/**
 * キャラクター死亡時にインベントリをその場にドロップ
 */
export function dropInventoryItems(world: World, character: Character): void {
  // インベントリが空の場合は何もしない
  if (!character.inventory || character.inventory.length === 0) {
    return
  }

  // 所持アイテムがあるかチェック
  const hasItems = character.inventory.some(item => item.amount > 0)
  if (!hasItems) {
    return
  }

  // ドロップするアイテムのリストを作成（amount > 0 のもののみ）
  const itemsToDrop: InventoryItem[] = character.inventory
    .filter(item => item.amount > 0)
    .map(item => ({ kind: item.kind, amount: item.amount }))

  // キャラクターの位置にドロップアイテムを追加
  const existingDrop = world.droppedItems.find(
    di => di.x === character.x && di.y === character.y
  )

  if (existingDrop) {
    // すでにその座標にドロップアイテムがある場合は追加
    for (const item of itemsToDrop) {
      addItem(existingDrop.items, item.kind, item.amount)
    }
  } else {
    // 新しいドロップアイテムを作成
    world.droppedItems.push({
      x: character.x,
      y: character.y,
      items: itemsToDrop
    })
  }

  // キャラクターのインベントリをクリア
  character.inventory = []
}
