/**
 * Conversation Types
 *
 * 会話エンジンで使用する型定義
 */

import { World } from "./world.js"
import { SpeechAct, ConversationOutcome } from "./speech-act.js"

/**
 * TALK アクションのパラメータ
 */
export interface TalkParams {
  targetId: string
  intent:
    | "REQUEST_RESOURCE"
    | "OFFER_RESOURCE"
    | "THREATEN"
    | "ALLY_PROPOSE"
    | "REPRIMAND"
    | "BARGAIN"
  payload?: {
    item?: string
    amount?: number
    quidProQuo?: { item: string; amount: number }
  }
  maxTurns?: number  // 1~3 推奨
}

/**
 * 会話の結果
 */
export interface ConversationResult {
  worldAfter: World
  transcript: Array<{
    speakerId: string
    text: string
  }>
  speechActs: SpeechAct[]
  resolution: ConversationOutcome
  alignmentTags: string[]
}

/**
 * 発話記録（transcript の要素）
 */
export interface Utterance {
  speakerId: string
  text: string
}
