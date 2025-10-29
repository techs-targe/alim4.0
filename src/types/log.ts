/**
 * 乱数イベント情報
 */
export interface RNGInfo {
  roll: number                      // 実際に使った疑似乱数(0.0-1.0)
  effectiveSuccessRate?: number     // 成功率（ミッション等）
  outcome?: string                  // "SUCCESS" | "FAIL" | "DEAD" ...
}

/**
 * ログエントリ
 */
export interface LogEntry {
  turn: number
  day: number
  actorId: string | null         // 日次処理などは null
  action: string                 // "MOVE","TALK","START_MISSION","MISSION_RESOLVE","CHARGE","GUARD","DAILY_UPKEEP", etc.
  detail: Record<string, unknown> // アクション固有情報
  alignmentTags: string[]        // ["gift","threat","selfSacrifice",...]

  // 乱数イベントが絡む場合のみ
  rng?: RNGInfo

  // LLMプロンプトとレスポンス（リプレイ用）
  llmPrompt?: string
  llmResponse?: string
}
