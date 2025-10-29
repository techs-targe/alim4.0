import { World, Character, ActionCandidate } from "../types/index.js"
import OpenAI from "openai"

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
 * OpenAI LLMプラグイン
 */
export class OpenAILLMPlugin implements LLMPlugin {
  type = "openai"
  private client: OpenAI
  private model: string
  private temperature: number

  constructor(apiKey: string, model: string = "gpt-4.1-nano", temperature: number = 0.7) {
    this.client = new OpenAI({ apiKey })
    this.model = model
    this.temperature = temperature
  }

  async decide(
    world: World,
    actor: Character,
    candidates: ActionCandidate[],
    systemPrompt: string,
    contextPrompt: string
  ): Promise<LLMDecision> {
    if (candidates.length === 0) {
      throw new Error(`No action candidates available for ${actor.id}`)
    }

    // アクション候補をフォーマット
    const actionsDescription = candidates.map((c, idx) => {
      const paramsPreview = c.paramOptions.length > 0
        ? JSON.stringify(c.paramOptions.slice(0, 3))
        : "No parameters"
      return `${idx + 1}. ${c.actionId} - ${paramsPreview}`
    }).join("\n")

    // 現在の状態をフォーマット
    const stateDescription = `
Current State:
- Position: (${actor.x}, ${actor.y})
- Life: ${actor.life}
- Inventory: ${JSON.stringify(actor.inventory)}
- Turn: ${world.turnCount}, Day: ${world.dayCount}
- Alive Characters: ${world.characters.filter(c => c.alive).length}
`

    const userPrompt = `${contextPrompt}

${stateDescription}

Available Actions:
${actionsDescription}

You must choose one action from the list above and specify the exact parameters.
Respond in the following JSON format:
{
  "actionId": "ACTION_ID",
  "params": {...},
  "reasoning": "brief explanation"
}

Consider your personality, the current situation, and choose wisely.`

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: this.temperature,
        max_tokens: 500
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error("No response from OpenAI")
      }

      // JSONをパース
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.warn("No JSON found in response, falling back to random")
        return this.fallbackDecision(candidates)
      }

      const decision = JSON.parse(jsonMatch[0])

      // アクションIDが有効かチェック
      const validCandidate = candidates.find(c => c.actionId === decision.actionId)
      if (!validCandidate) {
        console.warn(`Invalid action ID: ${decision.actionId}, falling back`)
        return this.fallbackDecision(candidates)
      }

      // パラメータが有効かチェック
      let params = decision.params || {}
      if (validCandidate.paramOptions.length > 0) {
        // パラメータが候補に含まれるかチェック（緩いチェック）
        const hasValidParams = Object.keys(params).length > 0
        if (!hasValidParams) {
          // デフォルトで最初の候補を使う
          params = validCandidate.paramOptions[0]
        }
      }

      return {
        actionId: decision.actionId,
        params,
        reasoning: decision.reasoning || "No reasoning provided"
      }

    } catch (error) {
      console.error("OpenAI API error:", error)
      return this.fallbackDecision(candidates)
    }
  }

  private fallbackDecision(candidates: ActionCandidate[]): LLMDecision {
    const candidate = candidates[Math.floor(Math.random() * candidates.length)]
    const params = candidate.paramOptions.length > 0
      ? candidate.paramOptions[Math.floor(Math.random() * candidate.paramOptions.length)]
      : {}

    return {
      actionId: candidate.actionId,
      params,
      reasoning: "Fallback: random selection due to API error"
    }
  }
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
