/**
 * Speech Act Types
 *
 * 発話の「意味」を構造化して表現する型定義
 */

/**
 * 発話行為の種類と内容
 */
export type SpeechAct =
  | {
      kind: "OFFER_RESOURCE"
      from: string
      to: string
      item: string
      amount: number
    }
  | {
      kind: "REQUEST_RESOURCE"
      from: string
      to: string
      item: string
      amount: number
    }
  | {
      kind: "THREATEN"
      from: string
      to: string
      content: string
    }
  | {
      kind: "ALLY_PROPOSE"
      from: string
      to: string
    }
  | {
      kind: "REFUSE"
      from: string
      to: string
      reason?: string
    }
  | {
      kind: "ACCEPT"
      from: string
      to: string
    }
  | {
      kind: "COUNTER_OFFER"
      from: string
      to: string
      offer: { item: string; amount: number }
      want?: { item: string; amount: number }
    }
  | {
      kind: "REPRIMAND"
      from: string
      to: string
      ruleId?: string
    }

/**
 * 会話の結果として決定されるゲーム内効果
 */
export type ConversationOutcome =
  | {
      type: "TRADE"
      gives: Array<{ from: string; item: string; amount: number }>
      takes: Array<{ to: string; item: string; amount: number }>
    }
  | {
      type: "GIFT"
      from: string
      to: string
      item: string
      amount: number
    }
  | {
      type: "THREAT_SUCCESS"
      coercedAction?: any  // 将来的に強制される行動を定義
    }
  | {
      type: "ALLY"
      pair: [string, string]
    }
  | {
      type: "NO_EFFECT"
    }
