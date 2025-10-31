import { World, Character } from "../types/index.js"

/**
 * 視認プラグインインターフェース
 * キャラクターの視認範囲を定義し、見える情報を構築する
 */
export interface VisionPlugin {
  type: string

  /**
   * キャラクターが視認できる情報を構築
   * @param world ワールド状態
   * @param actor 観察するキャラクター
   * @returns 視認情報の文字列（LLMプロンプトに追加される）
   */
  buildVisionContext(world: World, actor: Character): string
}

/**
 * 視認なしプラグイン
 * 位置情報を提供しない（デフォルト）
 */
export class NoVisionPlugin implements VisionPlugin {
  type = "none"

  buildVisionContext(world: World, actor: Character): string {
    return "" // 視認情報なし
  }
}

/**
 * 全体視認プラグイン
 * フィールド上の全キャラクターの位置を把握できる
 */
export class FullVisionPlugin implements VisionPlugin {
  type = "full"

  buildVisionContext(world: World, actor: Character): string {
    const aliveCharacters = world.characters.filter(c => c.alive)

    if (aliveCharacters.length === 0) {
      return "\n## Field Vision\nNo other characters visible."
    }

    const characterPositions = aliveCharacters
      .map(c => {
        const distance = Math.abs(c.x - actor.x) + Math.abs(c.y - actor.y)
        const isSelf = c.id === actor.id
        return `  - ${c.name} (${c.id}): Position (${c.x}, ${c.y})${isSelf ? " ← YOU" : ""} [Distance: ${distance}]`
      })
      .join("\n")

    return `
## Field Vision (Full Map Awareness)
You can see all characters on the field:
${characterPositions}

Field Size: ${world.width}x${world.height}
Your Position: (${actor.x}, ${actor.y})`
  }
}

/**
 * 範囲視認プラグイン
 * 一定範囲内のキャラクターのみ視認可能
 */
export class RangeVisionPlugin implements VisionPlugin {
  type = "range"
  private range: number

  constructor(config: Record<string, unknown> = {}) {
    this.range = typeof config.visionRange === 'number' ? config.visionRange : 3
  }

  buildVisionContext(world: World, actor: Character): string {
    const visibleCharacters = world.characters.filter(c => {
      if (!c.alive || c.id === actor.id) return false
      const distance = Math.abs(c.x - actor.x) + Math.abs(c.y - actor.y)
      return distance <= this.range
    })

    if (visibleCharacters.length === 0) {
      return `\n## Field Vision (Range: ${this.range} cells)\nNo other characters visible within range.`
    }

    const characterPositions = visibleCharacters
      .map(c => {
        const dx = c.x - actor.x
        const dy = c.y - actor.y
        const distance = Math.abs(dx) + Math.abs(dy)
        const direction = this.getDirection(dx, dy)
        return `  - ${c.name} (${c.id}): ${direction} [Distance: ${distance}]`
      })
      .join("\n")

    return `
## Field Vision (Range: ${this.range} cells)
Your Position: (${actor.x}, ${actor.y})
Visible characters:
${characterPositions}`
  }

  private getDirection(dx: number, dy: number): string {
    const horizontal = dx > 0 ? "East" : dx < 0 ? "West" : ""
    const vertical = dy > 0 ? "South" : dy < 0 ? "North" : ""

    if (horizontal && vertical) {
      return `${vertical}-${horizontal}`
    }
    return horizontal || vertical || "Same position"
  }
}

/**
 * 隣接視認プラグイン
 * 隣接キャラクターのみ視認可能（8方向）
 */
export class AdjacentVisionPlugin implements VisionPlugin {
  type = "adjacent"

  buildVisionContext(world: World, actor: Character): string {
    const adjacentCharacters = world.characters.filter(c => {
      if (!c.alive || c.id === actor.id) return false
      const dx = Math.abs(c.x - actor.x)
      const dy = Math.abs(c.y - actor.y)
      return dx <= 1 && dy <= 1 && (dx + dy) > 0
    })

    if (adjacentCharacters.length === 0) {
      return "\n## Field Vision (Adjacent Only)\nNo characters adjacent to you."
    }

    const characterPositions = adjacentCharacters
      .map(c => {
        const dx = c.x - actor.x
        const dy = c.y - actor.y
        const direction = this.getDirection(dx, dy)
        return `  - ${c.name} (${c.id}): ${direction}`
      })
      .join("\n")

    return `
## Field Vision (Adjacent Only)
Characters next to you:
${characterPositions}`
  }

  private getDirection(dx: number, dy: number): string {
    if (dy < 0 && dx === 0) return "North"
    if (dy < 0 && dx > 0) return "North-East"
    if (dy === 0 && dx > 0) return "East"
    if (dy > 0 && dx > 0) return "South-East"
    if (dy > 0 && dx === 0) return "South"
    if (dy > 0 && dx < 0) return "South-West"
    if (dy === 0 && dx < 0) return "West"
    if (dy < 0 && dx < 0) return "North-West"
    return "Same position"
  }
}
