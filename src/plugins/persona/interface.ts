import { Character } from "../../types/index.js"

/**
 * ペルソナプラグインインターフェース
 * キャラクターの性格・価値観を定義し、LLMプロンプトに注入する
 */
export interface PersonaPlugin {
  type: string
  description?: string

  /**
   * システムプロンプトに注入する性格・価値観の説明
   */
  buildSystemPrompt(actor: Character): string
}
