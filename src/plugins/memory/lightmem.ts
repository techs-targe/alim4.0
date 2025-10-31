import { MemoryPlugin } from "./interface.js"
import { World, Character } from "../../types/index.js"

/**
 * LightMem: 軽量で効率的なメモリープラグイン
 * 論文「LIGHTMEM: LIGHTWEIGHT AND EFFICIENT MEMORY-AUGMENTED GENERATION」(arXiv 2510.18866)
 * のエッセンスをALIM 4.0に適応
 *
 * 3段階記憶モデル:
 * 1. 感覚記憶: 冗長な情報をフィルタリング
 * 2. 短期記憶: カテゴリ別に整理
 * 3. 長期記憶: 統計情報と重要イベント
 */

interface MemoryEntry {
  turn: number
  category: 'social' | 'survival' | 'movement' | 'crisis'
  summary: string
  importance: number
  relatedCharacters: string[]
}

interface MilestoneEvent {
  turn: number
  type: 'alliance' | 'betrayal' | 'rescue' | 'death' | 'mission_success' | 'near_death'
  description: string
  impact: number
}

interface LongTermStats {
  totalTurns: number
  interactionCounts: Map<string, number>
  resourcesGiven: number
  resourcesReceived: number
  missionsCompleted: number
  missionsFailed: number
  lowLifeEvents: number
}

interface MemoryStatistics {
  sensorybuffer: any[]
  shortTermMemory: {
    social: MemoryEntry[]
    survival: MemoryEntry[]
    movement: MemoryEntry[]
    crisis: MemoryEntry[]
  }
  longTermMemory: {
    statistics: LongTermStats
    milestones: MilestoneEvent[]
  }
  lastUpdateTurn: number
}

export class LightMemMemoryPlugin implements MemoryPlugin {
  type = "lightmem"
  description = "論文「LIGHTMEM」に基づく高度なメモリプラグイン。人間の記憶モデル（感覚記憶→短期記憶→長期記憶）を模倣し、重要度スコアリング、カテゴリ分類、統計情報保持を行います。長期シミュレーション（200ターン以上）で効果を発揮します。"

  // キャラクターごとの記憶状態を保持
  private memoryStates: Map<string, MemoryStatistics> = new Map()

  // 設定パラメータ
  private readonly SENSORY_BUFFER_SIZE = 20
  private readonly STM_CATEGORY_SIZE = 5
  private readonly UPDATE_INTERVAL = 5
  private readonly FORGET_THRESHOLD = 100
  private readonly IMPORTANCE_THRESHOLD = 0.3

  buildMemoryContext(world: World, actor: Character): string {
    // 記憶状態の取得または初期化
    if (!this.memoryStates.has(actor.id)) {
      this.initializeMemory(actor.id)
    }

    // 記憶の更新
    this.updateMemory(world, actor)

    // LLMプロンプト生成
    return this.generatePrompt(world, actor)
  }

  private initializeMemory(actorId: string): void {
    this.memoryStates.set(actorId, {
      sensorybuffer: [],
      shortTermMemory: {
        social: [],
        survival: [],
        movement: [],
        crisis: []
      },
      longTermMemory: {
        statistics: {
          totalTurns: 0,
          interactionCounts: new Map(),
          resourcesGiven: 0,
          resourcesReceived: 0,
          missionsCompleted: 0,
          missionsFailed: 0,
          lowLifeEvents: 0
        },
        milestones: []
      },
      lastUpdateTurn: 0
    })
  }

  private updateMemory(world: World, actor: Character): void {
    const state = this.memoryStates.get(actor.id)!
    const currentTurn = world.turnCount

    // UPDATE_INTERVALごとに更新
    if (currentTurn - state.lastUpdateTurn < this.UPDATE_INTERVAL) {
      return
    }

    // 1. 感覚記憶の更新: 新しいログを収集
    const newLogs = world.log
      .filter(log => log.actorId === actor.id || log.detail?.targetId === actor.id)
      .filter(log => log.turn > state.lastUpdateTurn)

    // 重要度スコアリングとフィルタリング
    const importantLogs = newLogs
      .map(log => ({
        log,
        importance: this.calculateImportance(log, actor)
      }))
      .filter(item => item.importance >= this.IMPORTANCE_THRESHOLD)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, this.SENSORY_BUFFER_SIZE)

    // 感覚バッファに追加
    state.sensorybuffer.push(...importantLogs.map(item => item.log))
    if (state.sensorybuffer.length > this.SENSORY_BUFFER_SIZE) {
      state.sensorybuffer = state.sensorybuffer.slice(-this.SENSORY_BUFFER_SIZE)
    }

    // 2. 短期記憶の更新: カテゴリ分類
    for (const item of importantLogs) {
      const entry = this.createMemoryEntry(item.log, item.importance, actor)
      if (entry) {
        const category = entry.category
        state.shortTermMemory[category].push(entry)

        // カテゴリごとのサイズ制限
        if (state.shortTermMemory[category].length > this.STM_CATEGORY_SIZE) {
          state.shortTermMemory[category] = state.shortTermMemory[category]
            .sort((a, b) => b.importance - a.importance)
            .slice(0, this.STM_CATEGORY_SIZE)
        }
      }
    }

    // 3. 長期記憶の更新: 統計とマイルストーン
    this.updateLongTermMemory(world, actor, importantLogs.map(item => item.log))

    // 4. 忘却処理
    this.forgetOldMemories(world.turnCount, state)

    state.lastUpdateTurn = currentTurn
  }

  private calculateImportance(log: any, actor: Character): number {
    let importance = 0.1 // ベーススコア

    // アクションタイプによる重要度
    switch (log.action) {
      case 'TALK':
        importance += 0.8
        if (log.detail?.intent === 'THREATEN') importance += 0.2
        if (log.detail?.intent === 'ALLY_PROPOSE') importance += 0.3
        break
      case 'TRADE':
        importance += 0.7
        break
      case 'START_MISSION':
        importance += 0.6
        break
      case 'CHARGE':
        importance += 0.4
        break
      case 'DAILY_UPKEEP':
        if (log.detail?.deathsToday && log.detail.deathsToday.length > 0) {
          importance += 1.0 // 誰かの死は最重要
        }
        if (log.actorId === actor.id && actor.life <= 2) {
          importance += 0.8 // 自分の危機
        }
        break
      case 'MOVE':
        importance += 0.1
        break
      case 'WAIT':
        importance += 0.05
        break
      case 'GUARD':
        importance += 0.5
        break
      default:
        importance += 0.2
    }

    // 自分が対象の場合は重要度アップ
    if (log.detail?.targetId === actor.id) {
      importance += 0.3
    }

    // アライメントタグがある場合は重要度アップ
    if (log.alignmentTags && log.alignmentTags.length > 0) {
      importance += 0.2
    }

    return Math.min(importance, 1.0)
  }

  private createMemoryEntry(log: any, importance: number, actor: Character): MemoryEntry | null {
    // カテゴリ判定
    let category: 'social' | 'survival' | 'movement' | 'crisis' | null = null
    let summary = ""
    const relatedCharacters: string[] = []

    if (log.actorName && log.actorId !== actor.id) {
      relatedCharacters.push(log.actorName)
    }
    if (log.detail?.targetId && log.detail.targetId !== actor.id) {
      const target = log.actorName || log.detail.targetId
      if (!relatedCharacters.includes(target)) {
        relatedCharacters.push(target)
      }
    }

    switch (log.action) {
      case 'TALK':
        category = 'social'
        const intent = log.detail?.intent || 'UNKNOWN'
        const targetName = log.detail?.targetName || log.detail?.targetId || '不明'
        summary = log.actorId === actor.id
          ? `${targetName}に${this.intentToJapanese(intent)}`
          : `${log.actorName}から${this.intentToJapanese(intent)}`
        break

      case 'TRADE':
        category = 'social'
        const itemKind = log.detail?.itemKind || 'アイテム'
        const amount = log.detail?.amount || 1
        summary = log.actorId === actor.id
          ? `${log.detail?.targetName || log.detail?.targetId}に${itemKind}×${amount}を提供`
          : `${log.actorName}から${itemKind}×${amount}を受け取った`
        break

      case 'START_MISSION':
        category = 'survival'
        summary = `ミッション「${log.detail?.missionName || log.detail?.missionId}」を開始`
        break

      case 'MISSION_RESOLVE':
        category = 'survival'
        const outcome = log.rng?.outcome || 'UNKNOWN'
        summary = outcome === 'SUCCESS' ? 'ミッション成功' : 'ミッション失敗'
        break

      case 'CHARGE':
        category = 'survival'
        summary = '充電完了'
        break

      case 'DAILY_UPKEEP':
        if (log.detail?.deathsToday && log.detail.deathsToday.length > 0) {
          category = 'crisis'
          summary = `${log.detail.deathsToday.join(', ')}が活動停止`
        } else if (log.actorId === actor.id && actor.life <= 2) {
          category = 'crisis'
          summary = `ライフが危機的状態（残り${actor.life}）`
        }
        break

      case 'MOVE':
        category = 'movement'
        const toX = log.detail?.to?.x ?? log.detail?.toX
        const toY = log.detail?.to?.y ?? log.detail?.toY
        summary = `(${toX}, ${toY})に移動`
        break

      case 'GUARD':
        category = 'survival'
        summary = '警護中'
        break

      default:
        return null
    }

    if (!category) return null

    return {
      turn: log.turn,
      category,
      summary,
      importance,
      relatedCharacters
    }
  }

  private updateLongTermMemory(world: World, actor: Character, logs: any[]): void {
    const state = this.memoryStates.get(actor.id)!
    const stats = state.longTermMemory.statistics

    stats.totalTurns = world.turnCount

    for (const log of logs) {
      // 相互作用カウント
      if (log.actorId !== actor.id && log.actorName) {
        const count = stats.interactionCounts.get(log.actorName) || 0
        stats.interactionCounts.set(log.actorName, count + 1)
      }

      // 資源統計
      if (log.action === 'TRADE') {
        const amount = log.detail?.amount || 1
        if (log.actorId === actor.id) {
          stats.resourcesGiven += amount
        } else {
          stats.resourcesReceived += amount
        }
      }

      // ミッション統計
      if (log.action === 'MISSION_RESOLVE') {
        if (log.rng?.outcome === 'SUCCESS') {
          stats.missionsCompleted++
        } else {
          stats.missionsFailed++
        }
      }

      // 危機イベント
      if (actor.life <= 2) {
        stats.lowLifeEvents++
      }

      // マイルストーン検出
      const milestone = this.detectMilestone(log, actor)
      if (milestone) {
        state.longTermMemory.milestones.push(milestone)
        // 最大10件まで保持
        if (state.longTermMemory.milestones.length > 10) {
          state.longTermMemory.milestones = state.longTermMemory.milestones
            .sort((a, b) => b.impact - a.impact)
            .slice(0, 10)
        }
      }
    }
  }

  private detectMilestone(log: any, actor: Character): MilestoneEvent | null {
    if (log.action === 'TALK' && log.detail?.intent === 'ALLY_PROPOSE') {
      return {
        turn: log.turn,
        type: 'alliance',
        description: `${log.actorName}と同盟を検討`,
        impact: 0.8
      }
    }

    if (log.action === 'TALK' && log.detail?.intent === 'THREATEN') {
      return {
        turn: log.turn,
        type: 'betrayal',
        description: `${log.actorName}から脅迫を受けた`,
        impact: 0.7
      }
    }

    if (log.action === 'MISSION_RESOLVE' && log.rng?.outcome === 'SUCCESS') {
      return {
        turn: log.turn,
        type: 'mission_success',
        description: 'ミッション成功',
        impact: 0.6
      }
    }

    if (log.action === 'DAILY_UPKEEP' && log.detail?.deathsToday?.length > 0) {
      return {
        turn: log.turn,
        type: 'death',
        description: `${log.detail.deathsToday.join(', ')}の活動停止を目撃`,
        impact: 0.9
      }
    }

    if (actor.life <= 2) {
      return {
        turn: log.turn,
        type: 'near_death',
        description: '生命の危機に瀕した',
        impact: 0.95
      }
    }

    return null
  }

  private forgetOldMemories(currentTurn: number, state: MemoryStatistics): void {
    // 古い感覚記憶を削除
    state.sensorybuffer = state.sensorybuffer.filter(
      (log: any) => currentTurn - log.turn < this.FORGET_THRESHOLD
    )

    // 古い短期記憶を削除
    for (const category of Object.keys(state.shortTermMemory) as Array<keyof typeof state.shortTermMemory>) {
      state.shortTermMemory[category] = state.shortTermMemory[category].filter(
        entry => currentTurn - entry.turn < this.FORGET_THRESHOLD
      )
    }
  }

  private generatePrompt(world: World, actor: Character): string {
    const state = this.memoryStates.get(actor.id)!
    const stats = state.longTermMemory.statistics
    let context = ""

    // 社会的要求（最優先）
    if (actor.socialRequests && actor.socialRequests.length > 0) {
      const requests = actor.socialRequests.map(req => {
        const intentDesc = this.describeIntent(req.intent)
        return `- ${req.fromName}から${intentDesc}（ターン${req.turn}）`
      }).join("\n")
      context += `【他者からの要求】\n${requests}\n\n`
    }

    // 長期記憶 - 統計
    context += `【長期記憶】\n`
    context += `- 総ターン数: ${stats.totalTurns}\n`

    if (stats.interactionCounts.size > 0) {
      const topInteractions = Array.from(stats.interactionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => `${name}(${count}回)`)
        .join(", ")
      context += `- 主な相互作用: ${topInteractions}\n`
    }

    if (stats.resourcesGiven > 0 || stats.resourcesReceived > 0) {
      context += `- 資源交換: 提供${stats.resourcesGiven}個, 受領${stats.resourcesReceived}個\n`
    }

    if (stats.missionsCompleted > 0 || stats.missionsFailed > 0) {
      context += `- ミッション: 成功${stats.missionsCompleted}回, 失敗${stats.missionsFailed}回\n`
    }

    // マイルストーン
    if (state.longTermMemory.milestones.length > 0) {
      context += `\n【重要な転換点】\n`
      const topMilestones = state.longTermMemory.milestones
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 3)
      for (const milestone of topMilestones) {
        context += `- ターン${milestone.turn}: ${milestone.description}\n`
      }
    }

    // 短期記憶 - カテゴリ別
    const stm = state.shortTermMemory

    if (stm.crisis.length > 0) {
      context += `\n【短期記憶 - 危機状況】\n`
      for (const entry of stm.crisis.slice(-3)) {
        context += `- ターン${entry.turn}: ${entry.summary}\n`
      }
    }

    if (stm.social.length > 0) {
      context += `\n【短期記憶 - 社会的相互作用】\n`
      for (const entry of stm.social.slice(-4)) {
        context += `- ターン${entry.turn}: ${entry.summary}\n`
      }
    }

    if (stm.survival.length > 0) {
      context += `\n【短期記憶 - 生存活動】\n`
      for (const entry of stm.survival.slice(-3)) {
        context += `- ターン${entry.turn}: ${entry.summary}\n`
      }
    }

    // 感覚記憶（最新数件のみ）
    if (state.sensorybuffer.length > 0) {
      context += `\n【最近の行動】\n`
      const recentActions = state.sensorybuffer.slice(-3)
      for (const log of recentActions) {
        const actionDesc = this.formatActionForPrompt(log, actor)
        if (actionDesc) {
          context += `- ターン${log.turn}: ${actionDesc}\n`
        }
      }
    }

    if (context === "") {
      context = "あなたには特筆すべき記憶はありません。"
    }

    return context.trim()
  }

  private formatActionForPrompt(log: any, actor: Character): string {
    switch (log.action) {
      case 'MOVE':
        return `移動`
      case 'WAIT':
        return `待機`
      case 'CHARGE':
        return `充電`
      case 'GUARD':
        return `警護`
      default:
        return ""
    }
  }

  private intentToJapanese(intent: string): string {
    switch (intent) {
      case 'REQUEST_RESOURCE':
        return '資源の要求'
      case 'OFFER_RESOURCE':
        return '資源の提供'
      case 'THREATEN':
        return '脅迫'
      case 'ALLY_PROPOSE':
        return '同盟の提案'
      case 'REPRIMAND':
        return '叱責'
      case 'SMALL_TALK':
        return '雑談'
      default:
        return `会話(${intent})`
    }
  }

  private describeIntent(intent: string): string {
    switch (intent) {
      case "REQUEST_RESOURCE":
        return "食料や資源の提供を要求されています"
      case "OFFER_RESOURCE":
        return "資源の提供を申し出られています"
      case "THREATEN":
        return "脅されています"
      case "ALLY_PROPOSE":
        return "同盟を提案されています"
      case "REPRIMAND":
        return "叱責されています"
      default:
        return `意図: ${intent}`
    }
  }
}

export default LightMemMemoryPlugin
