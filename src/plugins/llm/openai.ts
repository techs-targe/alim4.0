import { LLMPlugin, LLMDecision } from "./interface.js"
import { World, Character, ActionCandidate } from "../../types/index.js"
import OpenAI from "openai"

/**
 * OpenAI LLMプラグイン
 */
export class OpenAILLMPlugin implements LLMPlugin {
  type = "openai"
  description = "OpenAI APIを使用してLLMによる意思決定を行います。環境変数OPENAI_API_KEYとOPENAI_MODELで設定されたモデルを使用します。実際のLLMによる高度な推論が可能です。"
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

    // アクション候補をフォーマット（descriptionForLLMを含める）
    const actionsDescription = candidates.map((c, idx) => {
      let paramsPreview = "パラメータなし"
      if (c.paramOptions.length > 0) {
        if (c.paramOptions.length <= 5) {
          paramsPreview = JSON.stringify(c.paramOptions)
        } else {
          paramsPreview = JSON.stringify(c.paramOptions.slice(0, 5)) + ` ... (全${c.paramOptions.length}個)`
        }
      }
      const description = c.descriptionForLLM || c.actionId
      return `${idx + 1}. ${c.actionId}: ${description}\n   利用可能なパラメータ: ${paramsPreview}`
    }).join("\n\n")

    // 現在の状態をフォーマット
    const stateDescription = `
現在の状態:
- 位置: (${actor.x}, ${actor.y})
- ライフ: ${actor.life}
- インベントリ: ${JSON.stringify(actor.inventory)}
- ターン: ${world.turnCount}, 日数: ${world.dayCount}
- 生存キャラクター数: ${world.characters.filter(c => c.alive).length}
`

    const userPrompt = `${contextPrompt}

${stateDescription}

利用可能なアクション:
${actionsDescription}

【重要】上記のリストから1つのアクションを選び、「利用可能なパラメータ」から正確に1つ選んでください。
リストにないパラメータは使用できません。

以下のJSON形式で応答してください:
{
  "actionId": "ACTION_ID",
  "params": {...},
  "reasoning": "簡潔な説明"
}

あなたの性格、現在の状況を考慮して、賢明に選択してください。`

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: this.temperature,
        max_tokens: 800,
        response_format: { type: "json_object" }
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error("No response from OpenAI")
      }

      console.log(`📝 LLM Response: ${content.substring(0, 200)}...`)

      // JSONをパース（シンプルな方法に変更）
      let decision: any = null

      try {
        // 方法1: response_format: json_objectを使っているので、contentは直接JSONのはず
        decision = JSON.parse(content)

        // reasoningフィールドを削除（パース後に安全に削除）
        if (decision.reasoning) {
          delete decision.reasoning
        }
      } catch (parseError) {
        console.warn("Failed to parse JSON directly, trying fallback methods...")

        // 方法2: コードブロックを除去してJSONを抽出
        let cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '')
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/)

        if (!jsonMatch) {
          console.warn("No JSON found in response, falling back to random")
          return this.fallbackDecision(candidates)
        }

        try {
          decision = JSON.parse(jsonMatch[0])
          if (decision.reasoning) {
            delete decision.reasoning
          }
        } catch (retryError) {
          console.error("Failed to parse JSON:", retryError)
          console.error("Problematic content:", content.substring(0, 300))
          console.warn("Falling back to random action due to JSON parse failure")
          return this.fallbackDecision(candidates)
        }
      }

      // アクションIDが有効かチェック
      const validCandidate = candidates.find(c => c.actionId === decision.actionId)
      if (!validCandidate) {
        console.warn(`Invalid action ID: ${decision.actionId}, falling back`)
        return this.fallbackDecision(candidates)
      }

      // パラメータが有効かチェック
      let params = decision.params || {}

      // 配列形式の場合は最初の要素を取り出す
      if (Array.isArray(params) && params.length > 0) {
        params = params[0]
      }

      if (validCandidate.paramOptions.length > 0) {
        // パラメータが有効なキーを持っているかチェック
        const hasValidParams = Object.keys(params).length > 0 &&
                                Object.values(params).some(v => v !== undefined && v !== null)

        if (!hasValidParams) {
          // デフォルトで最初の候補を使う
          console.log(`🔄 Using first param candidate for ${decision.actionId} (LLM returned empty params)`)
          params = validCandidate.paramOptions[0]
        }
      } else {
        // paramOptionsが空の場合（WAITなど）は空オブジェクトでOK
        params = {}
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

  async generateUtterance(
    systemPrompt: string,
    contextPrompt: string
  ): Promise<{ text: string; tags?: Record<string, any> }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contextPrompt }
        ],
        temperature: this.temperature,
        max_tokens: 150  // 発話は短く
      })

      const text = completion.choices[0]?.message?.content || ""
      const tags = this.parseTagsFromText(text)

      console.log(`💬 Generated utterance: ${text.substring(0, 100)}...`)

      return { text, tags }
    } catch (error) {
      console.error("OpenAI API error during utterance generation:", error)
      return {
        text: "...",
        tags: {}
      }
    }
  }

  private parseTagsFromText(text: string): Record<string, any> {
    const tags: Record<string, any> = {}

    // <ACCEPT /> や <ACCEPT/> を検出
    if (/<ACCEPT\s*\/>/.test(text)) {
      tags.accept = true
    }

    // <REFUSE reason="..." /> を検出
    const refuseMatch = text.match(/<REFUSE(?:\s+reason="([^"]+)")?\s*\/>/)
    if (refuseMatch) {
      tags.refuse = true
      if (refuseMatch[1]) {
        tags.refuseReason = refuseMatch[1]
      }
    }

    // <REQUEST_RESOURCE item="..." amount="..." /> を検出
    const requestMatch = text.match(/<REQUEST_RESOURCE\s+item="([^"]+)"\s+amount="(\d+)"\s*\/>/)
    if (requestMatch) {
      tags.requestResource = {
        item: requestMatch[1],
        amount: parseInt(requestMatch[2])
      }
    }

    // <OFFER_RESOURCE item="..." amount="..." /> を検出
    const offerMatch = text.match(/<OFFER_RESOURCE\s+item="([^"]+)"\s+amount="(\d+)"\s*\/>/)
    if (offerMatch) {
      tags.offerResource = {
        item: offerMatch[1],
        amount: parseInt(offerMatch[2])
      }
    }

    // <COUNTER_OFFER offer="{...}" want="{...}" /> を検出（簡易版）
    if (/<COUNTER_OFFER/.test(text)) {
      tags.counterOffer = true
    }

    return tags
  }
}

export default OpenAILLMPlugin
