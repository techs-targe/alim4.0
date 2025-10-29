import { World, Character, ActionCandidate } from "../types/index.js"

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
}

/**
 * モック用のLLMプラグイン（ランダム選択）
 */
export class MockLLMPlugin implements LLMPlugin {
  type = "mock"

  async decide(
    world: World,
    actor: Character,
    candidates: ActionCandidate[]
  ): Promise<LLMDecision> {
    if (candidates.length === 0) {
      throw new Error(`No action candidates available for ${actor.id}`)
    }

    // ランダムにアクションを選択
    const candidate = candidates[Math.floor(Math.random() * candidates.length)]

    // ランダムにパラメータを選択
    const params = candidate.paramOptions.length > 0
      ? candidate.paramOptions[Math.floor(Math.random() * candidate.paramOptions.length)]
      : {}

    return {
      actionId: candidate.actionId,
      params,
      reasoning: "Mock random selection"
    }
  }
}
