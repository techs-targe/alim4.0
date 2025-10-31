import { World, Character, ActionCandidate } from "../../types/index.js"

/**
 * LLM決定結果
 */
export interface LLMDecision {
  actionId: string
  params: Record<string, unknown>
  reasoning?: string  // LLMの推論過程（デバッグ用）
}

/**
 * LLMプラグインインターフェース
 */
export interface LLMPlugin {
  type: string

  /**
   * プロンプトを構築してLLMを呼び出し、アクション選択を得る
   */
  decide(
    world: World,
    actor: Character,
    candidates: ActionCandidate[],
    systemPrompt: string,
    contextPrompt: string
  ): Promise<LLMDecision>

  /**
   * 会話用の発話生成（ConversationEngine用）
   */
  generateUtterance(
    systemPrompt: string,
    contextPrompt: string
  ): Promise<{
    text: string
    tags?: Record<string, any>  // <ACCEPT />, <OFFER item="..." /> など
  }>
}
