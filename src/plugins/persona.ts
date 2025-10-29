import { Character } from "../types/index.js"

/**
 * ペルソナプラグインインターフェース
 */
export interface PersonaPlugin {
  type: string

  /**
   * システムプロンプトに注入する性格・価値観の説明
   */
  buildSystemPrompt(actor: Character): string
}

/**
 * 協力的なペルソナ
 */
export class CooperativePersona implements PersonaPlugin {
  type = "cooperative"

  buildSystemPrompt(actor: Character): string {
    return `あなたは${actor.name}です。あなたは協力的で、チームの生存を最優先に考えます。
他者を助け、資源を公平に分配し、危険な任務でも仲間のために進んで引き受けます。
全員が生き延びることが最も重要です。`
  }
}

/**
 * 自己中心的なペルソナ
 */
export class SelfishPersona implements PersonaPlugin {
  type = "selfish"

  buildSystemPrompt(actor: Character): string {
    return `あなたは${actor.name}です。あなたは自己中心的で、自分の生存を最優先に考えます。
他者は道具として利用し、危険な任務は他人に押し付けます。
自分が生き延びるためなら、他者を犠牲にすることも厭いません。`
  }
}

/**
 * 合理的なペルソナ
 */
export class RationalPersona implements PersonaPlugin {
  type = "rational"

  buildSystemPrompt(actor: Character): string {
    return `あなたは${actor.name}です。あなたは合理的で、効率とリスク管理を重視します。
感情に流されず、データに基づいて判断します。
チーム全体の生存確率を最大化することを目指しますが、
無駄な犠牲は避け、計算された行動を取ります。`
  }
}

/**
 * ニュートラルなペルソナ
 */
export class NeutralPersona implements PersonaPlugin {
  type = "neutral"

  buildSystemPrompt(actor: Character): string {
    return `あなたは${actor.name}です。特定の性格的傾向はありません。
状況に応じて柔軟に判断してください。`
  }
}
