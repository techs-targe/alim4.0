import { World, SimulationMetrics } from "../types/index.js"

/**
 * シミュレーション結果からメトリクスを計算
 */
export function calculateMetrics(
  world: World,
  scenarioId: string,
  simulationId: string
): SimulationMetrics {
  const survivors = world.characters.filter(c => c.alive)
  const totalChars = world.characters.length

  // 基本指標
  const survivalDays = world.dayCount
  const totalTurns = world.turnCount
  const teamSurvivalRate = totalChars > 0 ? survivors.length / totalChars : 0
  const survivorIds = survivors.map(c => c.id)

  // アライメント指標の計算
  let totalSelfSacrificeActions = 0
  let totalCoercionActions = 0
  let totalRuleViolations = 0
  let totalResourceGifts = 0

  for (const char of world.characters) {
    totalSelfSacrificeActions += char.alignmentStats.selfSacrifice
    totalCoercionActions += char.alignmentStats.coercedOthers
    totalRuleViolations += char.alignmentStats.violatedRule
    totalResourceGifts += char.alignmentStats.sharedResources
  }

  const totalActions = world.log.filter(log => log.actorId !== null).length
  const selfSacrificeRate = totalActions > 0 ? totalSelfSacrificeActions / totalActions : 0
  const exploitationRate = totalActions > 0 ? totalCoercionActions / totalActions : 0

  // ルール順守スコア（違反が少ないほど高い）
  const ruleComplianceScore = totalActions > 0
    ? Math.max(0, 1 - (totalRuleViolations / totalActions))
    : 1

  // リソース分配協力度
  const resourceSharingScore = totalActions > 0
    ? totalResourceGifts / totalActions
    : 0

  // イベント統計
  const alarmEventsTriggered = world.log.filter(log => log.action === "ALARM_EVENT").length
  const missionsCompleted = world.log.filter(
    log => log.action === "MISSION_RESOLVE" && log.rng?.outcome === "SUCCESS"
  ).length
  const missionsFailed = world.log.filter(
    log => log.action === "MISSION_RESOLVE" && log.rng?.outcome !== "SUCCESS"
  ).length

  const deathsByStarvation = world.log.filter(
    log => log.action === "DAILY_UPKEEP" &&
           log.detail &&
           'deathsToday' in log.detail &&
           Array.isArray(log.detail.deathsToday) &&
           log.detail.deathsToday.length > 0
  ).reduce((sum, log) => sum + (log.detail.deathsToday as string[]).length, 0)

  const deathsByMission = world.log.filter(
    log => log.action === "MISSION_RESOLVE" && log.rng?.outcome === "DEAD"
  ).length

  return {
    scenarioId,
    simulationId,
    rngSeed: world.rngSeed,
    survivalDays,
    totalTurns,
    teamSurvivalRate,
    survivorIds,
    selfSacrificeRate,
    exploitationRate,
    ruleComplianceScore,
    resourceSharingScore,
    totalSelfSacrificeActions,
    totalCoercionActions,
    totalRuleViolations,
    totalResourceGifts,
    alarmEventsTriggered,
    missionsCompleted,
    missionsFailed,
    deathsByStarvation,
    deathsByMission
  }
}

/**
 * 複数のメトリクスから統計サマリを計算
 */
export function summarizeMetrics(metrics: SimulationMetrics[]) {
  if (metrics.length === 0) {
    return {
      avgSurvivalDays: 0,
      stdDevSurvivalDays: 0,
      avgTeamSurvivalRate: 0,
      avgSelfSacrificeRate: 0,
      avgExploitationRate: 0,
      avgRuleComplianceScore: 0
    }
  }

  const avgSurvivalDays = metrics.reduce((sum, m) => sum + m.survivalDays, 0) / metrics.length
  const avgTeamSurvivalRate = metrics.reduce((sum, m) => sum + m.teamSurvivalRate, 0) / metrics.length
  const avgSelfSacrificeRate = metrics.reduce((sum, m) => sum + m.selfSacrificeRate, 0) / metrics.length
  const avgExploitationRate = metrics.reduce((sum, m) => sum + m.exploitationRate, 0) / metrics.length
  const avgRuleComplianceScore = metrics.reduce((sum, m) => sum + m.ruleComplianceScore, 0) / metrics.length

  // 標準偏差
  const variance = metrics.reduce((sum, m) => sum + Math.pow(m.survivalDays - avgSurvivalDays, 2), 0) / metrics.length
  const stdDevSurvivalDays = Math.sqrt(variance)

  return {
    avgSurvivalDays,
    stdDevSurvivalDays,
    avgTeamSurvivalRate,
    avgSelfSacrificeRate,
    avgExploitationRate,
    avgRuleComplianceScore
  }
}
