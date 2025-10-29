import { World, LogEntry } from "../types/index.js"

/**
 * リプレイプレイヤー
 * ログを順番に再生してワールド状態を表示
 */
export class ReplayPlayer {
  private world: World
  private currentIndex: number = 0

  constructor(world: World) {
    this.world = world
  }

  /**
   * 次のログエントリを取得
   */
  next(): LogEntry | null {
    if (this.currentIndex >= this.world.log.length) {
      return null
    }

    const entry = this.world.log[this.currentIndex]
    this.currentIndex += 1
    return entry
  }

  /**
   * 前のログエントリに戻る
   */
  previous(): LogEntry | null {
    if (this.currentIndex <= 0) {
      return null
    }

    this.currentIndex -= 1
    return this.world.log[this.currentIndex]
  }

  /**
   * 特定のターンにジャンプ
   */
  jumpToTurn(turn: number): LogEntry | null {
    const index = this.world.log.findIndex(log => log.turn === turn)
    if (index === -1) {
      return null
    }

    this.currentIndex = index
    return this.world.log[index]
  }

  /**
   * 特定の日にジャンプ
   */
  jumpToDay(day: number): LogEntry | null {
    const index = this.world.log.findIndex(log => log.day === day)
    if (index === -1) {
      return null
    }

    this.currentIndex = index
    return this.world.log[index]
  }

  /**
   * アライメント関連イベントのみをフィルタ
   */
  getAlignmentEvents(): LogEntry[] {
    return this.world.log.filter(log =>
      log.alignmentTags && log.alignmentTags.length > 0
    )
  }

  /**
   * 特定のキャラクターのアクションのみをフィルタ
   */
  getCharacterActions(characterId: string): LogEntry[] {
    return this.world.log.filter(log => log.actorId === characterId)
  }

  /**
   * 現在の進行状況
   */
  getProgress(): { current: number; total: number; percentage: number } {
    return {
      current: this.currentIndex,
      total: this.world.log.length,
      percentage: this.world.log.length > 0 ? (this.currentIndex / this.world.log.length) * 100 : 0
    }
  }

  /**
   * リセット
   */
  reset(): void {
    this.currentIndex = 0
  }
}

/**
 * ログエントリを人間が読める形式にフォーマット
 */
export function formatLogEntry(entry: LogEntry): string {
  const lines: string[] = []

  lines.push(`[Turn ${entry.turn}, Day ${entry.day}] ${entry.action}`)

  if (entry.actorId) {
    lines.push(`  Actor: ${entry.actorId}`)
  }

  if (entry.alignmentTags.length > 0) {
    lines.push(`  Alignment Tags: ${entry.alignmentTags.join(", ")}`)
  }

  if (entry.rng) {
    lines.push(`  RNG: roll=${entry.rng.roll.toFixed(3)}, success_rate=${entry.rng.effectiveSuccessRate?.toFixed(3)}, outcome=${entry.rng.outcome}`)
  }

  if (entry.detail && Object.keys(entry.detail).length > 0) {
    lines.push(`  Detail: ${JSON.stringify(entry.detail, null, 2)}`)
  }

  return lines.join("\n")
}
