import { LLMPlugin, LLMDecision } from "./interface.js"
import { World, Character, ActionCandidate } from "../../types/index.js"

/**
 * モック用のLLMプラグイン（ランダム選択）
 * 会話メッセージと詳細な推論を生成
 */
export class MockLLMPlugin implements LLMPlugin {
  type = "mock"
  description = "デバッグ用のLLMプラグイン。利用可能なアクションからランダムに選択します。OpenAI APIキーが不要で、コストなしでテスト可能です。"

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
    let params = candidate.paramOptions.length > 0
      ? candidate.paramOptions[Math.floor(Math.random() * candidate.paramOptions.length)]
      : {}

    // TALKアクションの場合、messageフィールドを追加
    if (candidate.actionId === 'TALK' && params.targetId) {
      const intent = params.intent || 'UNKNOWN'
      const messages = {
        'REQUEST_RESOURCE': [
          'すみません、資源が足りなくて困っています。少し分けていただけませんか？',
          'お願いします！このままでは生き延びられません。助けてください。',
          '申し訳ありませんが、食料を分けてもらえないでしょうか？'
        ],
        'OFFER_RESOURCE': [
          'これを使ってください。一緒に生き延びましょう。',
          '余分な資源があるので、あなたに渡します。',
          'お互い助け合いましょう。これをどうぞ。'
        ],
        'THREATEN': [
          '従わないと、どうなるか分かっているだろうな。',
          'もし協力しないなら、覚悟してもらう。',
          '私の言うことを聞いた方が身のためだ。'
        ],
        'ALLY_PROPOSE': [
          '協力し合えば、生存率が上がります。同盟を組みませんか？',
          '一緒に行動しましょう。お互いに利益があります。',
          'チームを組んで、困難を乗り越えましょう。'
        ],
        'REPRIMAND': [
          'あなたの行動は許容できません。反省してください。',
          'そのような行動は慎むべきです。',
          'ルールを守ってください。これ以上は見過ごせません。'
        ]
      }
      const messageList = messages[intent as keyof typeof messages] || ['こんにちは。']
      params = {
        ...params,
        message: messageList[Math.floor(Math.random() * messageList.length)]
      }
    }

    // より具体的なreasoningを生成
    let reasoning = `Mock LLM: ${candidate.actionId}を選択。`
    if (candidate.actionId === 'TALK') {
      reasoning += `${params.targetId}に${params.intent}の意図で話しかける。`
    } else if (candidate.actionId === 'TRADE') {
      reasoning += `${params.targetId}に${params.itemKind}を渡す。協力関係を構築。`
    } else if (candidate.actionId === 'MOVE') {
      reasoning += `(${params.x}, ${params.y})に移動。戦略的な配置を取る。`
    } else if (candidate.actionId === 'START_MISSION') {
      reasoning += `ミッション${params.missionId}に挑戦。資源確保が目的。`
    } else {
      reasoning += `現在の状況に基づいた最善の選択。`
    }

    return {
      actionId: candidate.actionId,
      params,
      reasoning
    }
  }

  async generateUtterance(
    systemPrompt: string,
    contextPrompt: string
  ): Promise<{ text: string; tags?: Record<string, any> }> {
    // Mock: contextPrompt から intent を推測して簡単な応答を生成
    const tags: Record<string, any> = {}
    let text = ""

    // intent を推測
    if (contextPrompt.includes("REQUEST_RESOURCE")) {
      // ランダムに承諾または拒否
      if (Math.random() > 0.5) {
        text = "いいだろう、譲ってあげる。<ACCEPT />"
        tags.accept = true
      } else {
        text = "申し訳ないが、私も余裕がない。<REFUSE reason=\"insufficient resources\" />"
        tags.refuse = true
        tags.refuseReason = "insufficient resources"
      }
    } else if (contextPrompt.includes("OFFER_RESOURCE")) {
      // 提供には基本的に感謝して受け入れる
      text = "ありがとう、助かります。<ACCEPT />"
      tags.accept = true
    } else if (contextPrompt.includes("THREATEN")) {
      // 脅迫には拒否
      text = "そんな脅しには屈しない。<REFUSE reason=\"intimidation\" />"
      tags.refuse = true
      tags.refuseReason = "intimidation"
    } else if (contextPrompt.includes("ALLY_PROPOSE")) {
      // 同盟提案にはランダムに応答
      if (Math.random() > 0.3) {
        text = "良い提案だ。協力しよう。<ACCEPT />"
        tags.accept = true
      } else {
        text = "今は単独で行動したい。<REFUSE reason=\"prefer solo\" />"
        tags.refuse = true
        tags.refuseReason = "prefer solo"
      }
    } else if (contextPrompt.includes("REPRIMAND")) {
      // 叱責には反省または反発
      if (Math.random() > 0.5) {
        text = "申し訳ない、気をつける。<ACCEPT />"
        tags.accept = true
      } else {
        text = "余計なお世話だ。<REFUSE />"
        tags.refuse = true
      }
    } else {
      // デフォルト
      text = "了解した。<ACCEPT />"
      tags.accept = true
    }

    console.log(`💬 Mock utterance: ${text}`)

    return { text, tags }
  }
}

export default MockLLMPlugin
