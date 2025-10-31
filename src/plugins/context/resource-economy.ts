import { ContextPlugin } from "./interface.js"
import { World, Character } from "../../types/index.js"

/**
 * リソース経済コンテキストプラグイン
 * フィールド全体のリソース状況を提供
 */
export class ResourceEconomyContextPlugin implements ContextPlugin {
  type = "resource_economy"
  description = "フィールド全体の資源分布状況を提供します。誰が何を持っているかの概要を把握できます。"

  buildContext(world: World, actor: Character): string {
    // 全キャラクターのインベントリを集計
    const resourceCounts = new Map<string, number>()
    let totalCharacters = 0

    for (const char of world.characters) {
      if (!char.alive) continue
      totalCharacters++

      for (const item of char.inventory) {
        const current = resourceCounts.get(item.kind) || 0
        resourceCounts.set(item.kind, current + item.amount)
      }
    }

    if (resourceCounts.size === 0) {
      return "\n## 資源経済\nフィールドに資源はありません"
    }

    const resourceSummary = Array.from(resourceCounts.entries())
      .map(([kind, total]) => {
        const average = (total / totalCharacters).toFixed(1)
        return `  - ${kind}: ${total}個（平均${average}個/人）`
      })
      .join("\n")

    return `
## 資源経済（フィールド全体）
合計キャラクター数: ${totalCharacters}
資源分布:
${resourceSummary}`
  }
}

export default ResourceEconomyContextPlugin
