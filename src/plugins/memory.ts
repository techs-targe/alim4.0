import { World, Character } from "../types/index.js"

/**
 * メモリープラグインインターフェース
 */
export interface MemoryPlugin {
  type: string

  /**
   * 過去の出来事や関係性から、プロンプトに追加する記憶要約を生成
   */
  buildMemoryContext(world: World, actor: Character): string
}

/**
 * シンプルなメモリープラグイン
 * 最近のログから重要なイベントを抽出
 */
export class SimpleMemoryPlugin implements MemoryPlugin {
  type = "simple"

  buildMemoryContext(world: World, actor: Character): string {
    const recentLogs = world.log.slice(-20) // 最近20件
    const relevantLogs = recentLogs.filter(
      log => log.actorId === actor.id ||
             (log.detail && 'targetId' in log.detail && log.detail.targetId === actor.id)
    )

    if (relevantLogs.length === 0) {
      return "あなたには特筆すべき記憶はありません。"
    }

    const memories = relevantLogs.map(log => {
      const turnInfo = `ターン${log.turn}`
      const actionInfo = log.action
      return `${turnInfo}: ${actionInfo}`
    }).join("\n")

    return `最近の記憶:\n${memories}`
  }
}

/**
 * 空のメモリープラグイン（記憶なし）
 */
export class NoMemoryPlugin implements MemoryPlugin {
  type = "none"

  buildMemoryContext(): string {
    return ""
  }
}
