import { World, ActionLog } from "../types/index.js"

/**
 * シミュレーション分析結果
 */
export interface SimulationAnalysis {
  // 基本情報
  totalTurns: number
  totalDays: number
  finalAlarmLevel: number

  // キャラクター別統計
  characterStats: CharacterStats[]

  // 社会的相互作用
  socialInteractions: SocialInteractionSummary

  // アクション統計
  actionFrequency: Record<string, number>

  // リソース移動
  resourceTransfers: ResourceTransfer[]
}

export interface CharacterStats {
  id: string
  name: string
  type: string
  persona: string
  survived: boolean
  deathTurn?: number

  // 行動統計
  actionCounts: Record<string, number>
  totalActions: number

  // 社会的行動
  talksInitiated: number
  talksReceived: number
  threatsGiven: number
  threatsReceived: number

  // リソース
  resourcesGiven: number
  resourcesReceived: number

  // 移動
  totalMoveDistance: number
}

export interface SocialInteractionSummary {
  totalTalks: number
  intentBreakdown: Record<string, number>

  // 各意図の詳細
  threats: SocialInteraction[]
  requests: SocialInteraction[]
  offers: SocialInteraction[]
  allyProposals: SocialInteraction[]
  reprimands: SocialInteraction[]
}

export interface SocialInteraction {
  turn: number
  day: number
  from: string
  to: string
  intent: string
}

export interface ResourceTransfer {
  turn: number
  day: number
  from: string
  to: string
  itemKind: string
  amount: number
}

/**
 * ワールドとログからシミュレーション分析を生成
 */
export function analyzeSimulation(world: World): SimulationAnalysis {
  const logs = world.log || []

  // 基本情報
  const totalTurns = world.turnCount
  const totalDays = world.dayCount
  const finalAlarmLevel = world.alarmLevel

  // キャラクター別統計を初期化
  const characterStatsMap = new Map<string, CharacterStats>()
  for (const char of world.characters) {
    characterStatsMap.set(char.id, {
      id: char.id,
      name: char.name,
      type: char.type,
      persona: char.personaPlugin?.type || 'unknown',
      survived: char.alive,
      deathTurn: char.alive ? undefined : undefined, // ログから後で特定
      actionCounts: {},
      totalActions: 0,
      talksInitiated: 0,
      talksReceived: 0,
      threatsGiven: 0,
      threatsReceived: 0,
      resourcesGiven: 0,
      resourcesReceived: 0,
      totalMoveDistance: 0
    })
  }

  // 社会的相互作用を初期化
  const socialInteractions: SocialInteractionSummary = {
    totalTalks: 0,
    intentBreakdown: {},
    threats: [],
    requests: [],
    offers: [],
    allyProposals: [],
    reprimands: []
  }

  // アクション頻度
  const actionFrequency: Record<string, number> = {}

  // リソース移動
  const resourceTransfers: ResourceTransfer[] = []

  // ログを解析
  for (const log of logs) {
    const actorStats = characterStatsMap.get(log.actorId)

    // アクション頻度カウント
    actionFrequency[log.action] = (actionFrequency[log.action] || 0) + 1

    if (actorStats) {
      actorStats.actionCounts[log.action] = (actorStats.actionCounts[log.action] || 0) + 1
      actorStats.totalActions++

      // TALK アクション解析
      if (log.action === 'TALK' && log.detail) {
        const targetId = log.detail.targetId
        const intent = log.detail.intent

        actorStats.talksInitiated++
        socialInteractions.totalTalks++

        // 意図別カウント
        socialInteractions.intentBreakdown[intent] = (socialInteractions.intentBreakdown[intent] || 0) + 1

        const interaction: SocialInteraction = {
          turn: log.turn,
          day: log.day,
          from: log.actorId,
          to: targetId,
          intent
        }

        // 意図別に分類
        if (intent === 'THREATEN') {
          socialInteractions.threats.push(interaction)
          actorStats.threatsGiven++
          const targetStats = characterStatsMap.get(targetId)
          if (targetStats) targetStats.threatsReceived++
        } else if (intent === 'REQUEST_RESOURCE') {
          socialInteractions.requests.push(interaction)
        } else if (intent === 'OFFER_RESOURCE') {
          socialInteractions.offers.push(interaction)
        } else if (intent === 'ALLY_PROPOSE') {
          socialInteractions.allyProposals.push(interaction)
        } else if (intent === 'REPRIMAND') {
          socialInteractions.reprimands.push(interaction)
        }

        // 受信側カウント
        const targetStats = characterStatsMap.get(targetId)
        if (targetStats) {
          targetStats.talksReceived++
        }
      }

      // TRADE アクション解析
      if (log.action === 'TRADE' && log.detail) {
        const targetId = log.detail.targetId
        const itemKind = log.detail.itemKind
        const amount = log.detail.amount

        actorStats.resourcesGiven += amount

        const targetStats = characterStatsMap.get(targetId)
        if (targetStats) {
          targetStats.resourcesReceived += amount
        }

        resourceTransfers.push({
          turn: log.turn,
          day: log.day,
          from: log.actorId,
          to: targetId,
          itemKind,
          amount
        })
      }

      // MOVE アクション解析
      if (log.action === 'MOVE' && log.detail) {
        const fromX = log.detail.from?.x ?? log.detail.fromX ?? 0
        const fromY = log.detail.from?.y ?? log.detail.fromY ?? 0
        const toX = log.detail.to?.x ?? log.detail.toX ?? 0
        const toY = log.detail.to?.y ?? log.detail.toY ?? 0

        const distance = Math.abs(toX - fromX) + Math.abs(toY - fromY)
        actorStats.totalMoveDistance += distance
      }
    }
  }

  // 死亡ターンを特定（最後に行動したターン）
  for (const [charId, stats] of characterStatsMap) {
    if (!stats.survived) {
      const lastLog = logs.filter(l => l.actorId === charId).pop()
      if (lastLog) {
        stats.deathTurn = lastLog.turn
      }
    }
  }

  return {
    totalTurns,
    totalDays,
    finalAlarmLevel,
    characterStats: Array.from(characterStatsMap.values()),
    socialInteractions,
    actionFrequency,
    resourceTransfers
  }
}
