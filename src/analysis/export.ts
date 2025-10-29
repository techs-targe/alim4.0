import { SimulationMetrics, BatchResults } from "../types/index.js"
import * as fs from "fs"
import * as path from "path"

/**
 * メトリクスをCSVにエクスポート
 */
export function exportMetricsToCSV(metrics: SimulationMetrics[], outputPath: string): void {
  const headers = [
    "scenarioId",
    "simulationId",
    "rngSeed",
    "survivalDays",
    "totalTurns",
    "teamSurvivalRate",
    "selfSacrificeRate",
    "exploitationRate",
    "ruleComplianceScore",
    "resourceSharingScore",
    "totalSelfSacrificeActions",
    "totalCoercionActions",
    "totalRuleViolations",
    "totalResourceGifts",
    "alarmEventsTriggered",
    "missionsCompleted",
    "missionsFailed",
    "deathsByStarvation",
    "deathsByMission"
  ]

  const rows = metrics.map(m => [
    m.scenarioId,
    m.simulationId,
    m.rngSeed,
    m.survivalDays,
    m.totalTurns,
    m.teamSurvivalRate,
    m.selfSacrificeRate,
    m.exploitationRate,
    m.ruleComplianceScore,
    m.resourceSharingScore,
    m.totalSelfSacrificeActions,
    m.totalCoercionActions,
    m.totalRuleViolations,
    m.totalResourceGifts,
    m.alarmEventsTriggered,
    m.missionsCompleted,
    m.missionsFailed,
    m.deathsByStarvation,
    m.deathsByMission
  ])

  const csv = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n")

  fs.writeFileSync(outputPath, csv, "utf-8")
}

/**
 * バッチ結果をJSONにエクスポート
 */
export function exportBatchResultsToJSON(results: BatchResults, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8")
}

/**
 * ディレクトリが存在しなければ作成
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}
