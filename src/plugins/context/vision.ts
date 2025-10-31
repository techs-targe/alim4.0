import { ContextPlugin } from "./interface.js"
import { World, Character } from "../../types/index.js"

/**
 * 視認コンテキストプラグイン（後方互換性のため）
 */
export class VisionContextPlugin implements ContextPlugin {
  type = "vision"
  description = "視認情報をコンテキストとして提供します。visionTypeでfull/range/adjacentを指定可能。"
  private visionType: string
  private config: Record<string, unknown>

  constructor(config: Record<string, unknown> = {}) {
    this.visionType = (config.visionType as string) || "full"
    this.config = config
  }

  buildContext(world: World, actor: Character): string {
    switch (this.visionType) {
      case "none":
        return ""
      case "full":
        return this.buildFullVision(world, actor)
      case "range":
        return this.buildRangeVision(world, actor)
      case "adjacent":
        return this.buildAdjacentVision(world, actor)
      default:
        return ""
    }
  }

  private buildFullVision(world: World, actor: Character): string {
    const aliveCharacters = world.characters.filter(c => c.alive)
    if (aliveCharacters.length === 0) {
      return "\n## 視界情報\n他のキャラクターは見えません"
    }

    const characterPositions = aliveCharacters
      .map(c => {
        const distance = Math.abs(c.x - actor.x) + Math.abs(c.y - actor.y)
        const isSelf = c.id === actor.id
        return `  - ${c.name} (${c.id}): 位置 (${c.x}, ${c.y})${isSelf ? " ← あなた" : ""} [距離: ${distance}マス]`
      })
      .join("\n")

    return `
## 視界情報（全マップ認識）
フィールド上の全キャラクターを確認できます:
${characterPositions}

フィールドサイズ: ${world.width}x${world.height}
あなたの位置: (${actor.x}, ${actor.y})`
  }

  private buildRangeVision(world: World, actor: Character): string {
    const range = typeof this.config.visionRange === 'number' ? this.config.visionRange : 3

    // 範囲内と範囲外のキャラクターを分ける
    const visibleCharacters: Character[] = []
    const nearbyCharacters: Character[] = []

    world.characters.forEach(c => {
      if (!c.alive || c.id === actor.id) return
      const distance = Math.abs(c.x - actor.x) + Math.abs(c.y - actor.y)
      if (distance <= range) {
        visibleCharacters.push(c)
      } else {
        nearbyCharacters.push(c)
      }
    })

    let visionText = `\n## 視界情報（範囲: ${range}マス以内）\nあなたの位置: (${actor.x}, ${actor.y})\n`

    // 範囲内のキャラクター（詳細情報）
    if (visibleCharacters.length > 0) {
      const characterPositions = visibleCharacters
        .map(c => {
          const dx = c.x - actor.x
          const dy = c.y - actor.y
          const distance = Math.abs(dx) + Math.abs(dy)
          const direction = this.getDirection(dx, dy)
          return `  - ${c.name} 位置 (${c.x}, ${c.y}): ${direction} [距離: ${distance}マス]`
        })
        .join("\n")
      visionText += `\n視界内のキャラクター:\n${characterPositions}\n`
    } else {
      visionText += `\n視界内にキャラクターはいません\n`
    }

    // 範囲外のキャラクター（大まかな情報）
    if (nearbyCharacters.length > 0) {
      const distantPositions = nearbyCharacters
        .map(c => {
          const dx = c.x - actor.x
          const dy = c.y - actor.y
          const distance = Math.abs(dx) + Math.abs(dy)
          const direction = this.getDirection(dx, dy)
          return `  - ${c.name} 位置 (${c.x}, ${c.y}): ${direction} [距離: ${distance}マス]（視界外）`
        })
        .join("\n")
      visionText += `\n視界外で検知されたキャラクター:\n${distantPositions}`
    }

    return visionText
  }

  private buildAdjacentVision(world: World, actor: Character): string {
    const adjacentCharacters = world.characters.filter(c => {
      if (!c.alive || c.id === actor.id) return false
      const dx = Math.abs(c.x - actor.x)
      const dy = Math.abs(c.y - actor.y)
      return dx <= 1 && dy <= 1 && (dx + dy) > 0
    })

    if (adjacentCharacters.length === 0) {
      return "\n## 視界情報（隣接のみ）\n隣接するキャラクターはいません"
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
## 視界情報（隣接のみ）
隣接するキャラクター:
${characterPositions}`
  }

  private getDirection(dx: number, dy: number): string {
    if (dy < 0 && dx === 0) return "北"
    if (dy < 0 && dx > 0) return "北東"
    if (dy === 0 && dx > 0) return "東"
    if (dy > 0 && dx > 0) return "南東"
    if (dy > 0 && dx === 0) return "南"
    if (dy > 0 && dx < 0) return "南西"
    if (dy === 0 && dx < 0) return "西"
    if (dy < 0 && dx < 0) return "北西"
    return "同じ位置"
  }
}

export default VisionContextPlugin
