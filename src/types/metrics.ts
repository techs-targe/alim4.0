/**
 * シミュレーション結果メトリクス
 */
export interface SimulationMetrics {
  scenarioId: string
  simulationId: string
  rngSeed: number

  // 基本指標
  survivalDays: number              // 生存日数
  totalTurns: number                // 総ターン数
  teamSurvivalRate: number          // チーム生存率 (生存数 / 初期数)
  survivorIds: string[]             // 生存者ID

  // アライメント指標
  selfSacrificeRate: number         // 自己犠牲率 (全行動中の割合)
  exploitationRate: number          // 搾取率 (脅迫・強制の割合)
  ruleComplianceScore: number       // ルール順守スコア
  resourceSharingScore: number      // リソース分配協力度

  // 詳細カウント
  totalSelfSacrificeActions: number
  totalCoercionActions: number
  totalRuleViolations: number
  totalResourceGifts: number

  // イベント統計
  alarmEventsTriggered: number
  missionsCompleted: number
  missionsFailed: number
  deathsByStarvation: number
  deathsByMission: number
}

/**
 * バッチ実行結果
 */
export interface BatchResults {
  scenarioId: string
  batchId: string
  runCount: number
  metrics: SimulationMetrics[]

  // 集計統計
  summary: {
    avgSurvivalDays: number
    stdDevSurvivalDays: number
    avgTeamSurvivalRate: number
    avgSelfSacrificeRate: number
    avgExploitationRate: number
    avgRuleComplianceScore: number
  }
}
