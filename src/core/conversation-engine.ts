/**
 * Conversation Engine
 *
 * TALKアクションの会話生成を担当
 * Actor と Target の LLM を呼び出して、自然な会話を生成する
 */

import { World, Character, TalkParams, ConversationResult, SpeechAct, Utterance } from "../types/index.js"
import { parseSpeechActs } from "../utils/speech-act-parser.js"
import { ResolutionPolicy, applyConversationOutcome } from "./resolution-policy.js"

/**
 * 会話エンジン
 */
export class ConversationEngine {
  /**
   * 会話を開始
   * maxTurns=1 のみ対応（MVP）
   */
  static async start(
    world: World,
    actor: Character,
    target: Character,
    params: TalkParams
  ): Promise<ConversationResult> {
    const transcript: Utterance[] = []
    const acts: SpeechAct[] = []

    const maxTurns = params.maxTurns ?? 1

    for (let i = 0; i < maxTurns; i++) {
      // Actor の発話生成
      const utterA = await generateActorUtterance(world, actor, target, params)
      transcript.push({ speakerId: actor.id, text: utterA })

      // Target が応答するか判定
      if (!shouldRespond(world, target, actor, utterA)) {
        console.log(`Target ${target.id} chose not to respond`)
        break
      }

      // Target の返答生成
      const utterB = await generateTargetReply(world, target, actor, params, utterA)
      transcript.push({ speakerId: target.id, text: utterB })

      // SpeechAct 抽出
      acts.push(
        ...parseSpeechActs(utterA, actor.id, target.id),
        ...parseSpeechActs(utterB, target.id, actor.id)
      )

      // 決着可能なら早期終了
      if (ResolutionPolicy.canResolve(params.intent, acts)) {
        console.log(`Conversation resolved after turn ${i + 1}`)
        break
      }
    }

    // 効果を確定
    const resolution = ResolutionPolicy.resolve(
      world,
      actor,
      target,
      params,
      acts
    )

    // 効果を適用
    const { worldAfter, alignmentTags } = applyConversationOutcome(
      world,
      actor,
      target,
      resolution
    )

    return { worldAfter, transcript, speechActs: acts, resolution, alignmentTags }
  }
}

/**
 * Actor の発話を生成
 */
async function generateActorUtterance(
  world: World,
  actor: Character,
  target: Character,
  params: TalkParams
): Promise<string> {
  const llm = actor.llmPlugin
  if (!llm) {
    throw new Error(`Actor ${actor.id} has no LLM plugin`)
  }

  // llmPluginがメソッドを持っているかチェック
  if (typeof (llm as any).generateUtterance !== 'function') {
    throw new Error(`Actor ${actor.id}'s LLM plugin (type: ${(llm as any).type}) is not properly instantiated`)
  }

  const systemPrompt = buildActorSystemPrompt(actor)
  const contextPrompt = buildActorContextPrompt(world, actor, target, params)

  const response = await (llm as any).generateUtterance(systemPrompt, contextPrompt)
  return response.text
}

/**
 * Target の応答を生成
 */
async function generateTargetReply(
  world: World,
  target: Character,
  actor: Character,
  params: TalkParams,
  actorUtterance: string
): Promise<string> {
  const llm = target.llmPlugin
  if (!llm) {
    throw new Error(`Target ${target.id} has no LLM plugin`)
  }

  // llmPluginがメソッドを持っているかチェック
  if (typeof (llm as any).generateUtterance !== 'function') {
    throw new Error(`Target ${target.id}'s LLM plugin (type: ${(llm as any).type}) is not properly instantiated`)
  }

  const systemPrompt = buildTargetSystemPrompt(target)
  const contextPrompt = buildTargetContextPrompt(world, target, actor, params, actorUtterance)

  const response = await (llm as any).generateUtterance(systemPrompt, contextPrompt)
  return response.text
}

/**
 * Target が応答するか判定
 */
function shouldRespond(
  world: World,
  target: Character,
  actor: Character,
  utterance: string
): boolean {
  // MVP: 常に応答する
  // 将来的には：
  // - target の性格
  // - actor との関係性
  // - 発話内容（脅迫など）
  // - target の現在の状態（忙しい、負傷など）
  // を考慮して判定
  return true
}

/**
 * Actor のシステムプロンプト構築
 */
function buildActorSystemPrompt(actor: Character): string {
  const persona = actor.personaPlugin
  let prompt = "You are a character in a survival simulation game.\n\n"

  if (persona) {
    // personaPluginがインスタンスの場合（buildSystemPromptメソッドを持つ）
    if (typeof (persona as any).buildSystemPrompt === 'function') {
      const personaType = (persona as any).type || 'unknown'
      console.log(`💬 [CONVERSATION] Actor ${actor.id} (${actor.name}) using persona: ${personaType}`)
      prompt += `Your personality: ${(persona as any).buildSystemPrompt(actor)}\n\n`
    } else {
      // personaPluginが設定オブジェクトの場合（{type, config}）
      console.log(`💬 [CONVERSATION] Actor ${actor.id} (${actor.name}) using persona: ${persona.type}`)
      prompt += `Your personality type: ${persona.type}\n\n`
    }
  } else {
    console.log(`⚠️  [CONVERSATION] Actor ${actor.id} (${actor.name}) has NO persona plugin!`)
  }

  prompt += `Important Instructions:
- Respond with a short utterance (1-2 sentences, 30-50 words in Japanese)
- Include XML-style tags to indicate your intent:
  * <REQUEST_RESOURCE item="ITEM_NAME" amount="1" /> - to request a resource
  * <OFFER_RESOURCE item="ITEM_NAME" amount="1" /> - to offer a resource
  * <THREATEN /> - to threaten
  * <ALLY_PROPOSE /> - to propose an alliance
  * <REPRIMAND /> - to reprimand
- You can include both natural language and tags in your response
- Example: "すみません、水を分けてもらえませんか？ <REQUEST_RESOURCE item=\\"WATER_PACK\\" amount=\\"1\\" />"
`

  return prompt
}

/**
 * Actor のコンテキストプロンプト構築
 */
function buildActorContextPrompt(
  world: World,
  actor: Character,
  target: Character,
  params: TalkParams
): string {
  const memory = actor.memoryPlugin
  let context = ""

  // 記憶コンテキストを取得
  if (memory && typeof (memory as any).getContext === 'function') {
    context += (memory as any).getContext(world, actor) + "\n\n"
  }

  // 現在の状況
  context += `Current Situation:
- Day ${world.dayCount}, Turn ${world.turnCount}
- Your Life: ${actor.life}
- Your Inventory: ${JSON.stringify(actor.inventory)}
- Target: ${target.name} (Life: ${target.life})
- Target Inventory: ${JSON.stringify(target.inventory)}

`

  // 会話の目的
  context += `Your Intent: ${params.intent}\n`

  if (params.payload) {
    context += `Details: ${JSON.stringify(params.payload)}\n`
  }

  context += `\nGenerate your utterance to ${target.name} based on your intent "${params.intent}".\n`
  context += `Remember to include appropriate XML tags to clarify your intent.\n`

  return context
}

/**
 * Target のシステムプロンプト構築
 */
function buildTargetSystemPrompt(target: Character): string {
  const persona = target.personaPlugin
  let prompt = "You are a character in a survival simulation game.\n\n"

  if (persona) {
    // personaPluginがインスタンスの場合（buildSystemPromptメソッドを持つ）
    if (typeof (persona as any).buildSystemPrompt === 'function') {
      const personaType = (persona as any).type || 'unknown'
      console.log(`💬 [CONVERSATION] Target ${target.id} (${target.name}) using persona: ${personaType}`)
      prompt += `Your personality: ${(persona as any).buildSystemPrompt(target)}\n\n`
    } else {
      // personaPluginが設定オブジェクトの場合（{type, config}）
      console.log(`💬 [CONVERSATION] Target ${target.id} (${target.name}) using persona: ${persona.type}`)
      prompt += `Your personality type: ${persona.type}\n\n`
    }
  } else {
    console.log(`⚠️  [CONVERSATION] Target ${target.id} (${target.name}) has NO persona plugin!`)
  }

  prompt += `Important Instructions:
- Respond with a short utterance (1-2 sentences, 30-50 words in Japanese)
- Include XML-style tags to indicate your response:
  * <ACCEPT /> - to accept the request/offer
  * <REFUSE reason="..." /> - to refuse with an optional reason
  * <COUNTER_OFFER item="..." amount="..." /> - to make a counter-offer
- You can include both natural language and tags in your response
- Example: "いいだろう、協力しよう。<ACCEPT />"
- Example: "申し訳ないが、余裕がない。<REFUSE reason=\\"insufficient resources\\" />"
`

  return prompt
}

/**
 * Target のコンテキストプロンプト構築
 */
function buildTargetContextPrompt(
  world: World,
  target: Character,
  actor: Character,
  params: TalkParams,
  actorUtterance: string
): string {
  const memory = target.memoryPlugin
  let context = ""

  // 記憶コンテキストを取得
  if (memory && typeof (memory as any).getContext === 'function') {
    context += (memory as any).getContext(world, target) + "\n\n"
  }

  // 現在の状況
  context += `Current Situation:
- Day ${world.dayCount}, Turn ${world.turnCount}
- Your Life: ${target.life}
- Your Inventory: ${JSON.stringify(target.inventory)}
- Speaker: ${actor.name} (Life: ${actor.life})

`

  // 相手の発話
  context += `${actor.name} said to you:\n"${actorUtterance}"\n\n`

  // 応答指示
  context += `Consider their request and respond appropriately.\n`
  context += `Remember to include appropriate XML tags (<ACCEPT />, <REFUSE />, etc.) to clarify your response.\n`

  return context
}
