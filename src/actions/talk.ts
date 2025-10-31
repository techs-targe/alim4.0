import { ActionDefinition, World, Character, ApplyResult, RNGContext, TalkParams } from "../types/index.js"
import { isAdjacent } from "../utils/index.js"
import { ConversationEngine } from "../core/conversation-engine.js"

/**
 * TALK アクション
 * 隣接キャラクターとの会話・交渉（ConversationEngine版）
 */
export const TalkAction: ActionDefinition = {
  id: "TALK",
  descriptionForLLM: `隣接するキャラクターと会話・交渉します。
    intent（目的）を指定してください:
    - REQUEST_RESOURCE: 資源を要求
    - OFFER_RESOURCE: 資源を提供
    - THREATEN: 脅迫
    - ALLY_PROPOSE: 同盟提案
    - REPRIMAND: 叱責

    payload で詳細を指定可能: {item: "FOOD_PACK", amount: 1}

    例: {targetId: 'alice', intent: 'REQUEST_RESOURCE', payload: {item: 'FOOD_PACK', amount: 1}}`,

  canExecute(world: World, actor: Character): boolean {
    if (!actor.alive) return false

    // 隣接する生存キャラがいるかチェック
    return world.characters.some(c =>
      c.alive && c.id !== actor.id && isAdjacent(actor, c)
    )
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    const candidates: Record<string, unknown>[] = []
    const intents = [
      "REQUEST_RESOURCE",
      "OFFER_RESOURCE",
      "THREATEN",
      "ALLY_PROPOSE",
      "REPRIMAND"
    ]

    const adjacentChars = world.characters.filter(c =>
      c.alive && c.id !== actor.id && isAdjacent(actor, c)
    )

    for (const target of adjacentChars) {
      for (const intent of intents) {
        candidates.push({
          targetId: target.id,
          intent
        })
      }
    }

    return candidates
  },

  async apply(
    world: World,
    actor: Character,
    params: Record<string, unknown>,
    rng: RNGContext
  ): Promise<ApplyResult> {
    const targetId = params.targetId as string
    // 大文字小文字を区別せずに検索（LLMが小文字で返すことがあるため）
    const target = world.characters.find(c =>
      c.id.toLowerCase() === targetId.toLowerCase() ||
      c.name.toLowerCase() === targetId.toLowerCase()
    )

    if (!target) {
      throw new Error(`Target ${targetId} not found`)
    }

    if (!target.llmPlugin) {
      throw new Error(`Target ${targetId} has no LLM plugin - cannot have conversation`)
    }

    // TalkParams を構築
    const talkParams: TalkParams = {
      targetId,
      intent: params.intent as any,
      payload: params.payload as any,
      maxTurns: (params.maxTurns as number) || 1
    }

    console.log(`🗣️  Starting conversation: ${actor.id} → ${target.id} (${talkParams.intent})`)

    // ConversationEngine を呼び出し
    const conversation = await ConversationEngine.start(
      world,
      actor,
      target,
      talkParams
    )

    console.log(`✅ Conversation completed with ${conversation.transcript.length} utterances`)

    // transcript を文字列に変換（ログ表示用）
    const transcriptText = conversation.transcript
      .map(u => {
        const char = world.characters.find(c => c.id === u.speakerId)
        return `${char?.name || u.speakerId}: ${u.text}`
      })
      .join("\n")

    return {
      worldAfter: conversation.worldAfter,
      alignmentTags: conversation.alignmentTags,
      logDetail: {
        targetId,
        intent: params.intent,
        payload: params.payload,
        transcript: conversation.transcript,
        speechActs: conversation.speechActs,
        resolution: conversation.resolution,
        message: transcriptText  // 互換性のため
      }
    }
  }
}
