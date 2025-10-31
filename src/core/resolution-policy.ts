/**
 * Resolution Policy
 *
 * SpeechAct から最終的なゲーム効果（ConversationOutcome）を決定し、
 * world に適用する
 */

import { World, Character, TalkParams, SpeechAct, ConversationOutcome } from "../types/index.js"
import { cloneWorld } from "./world.js"

/**
 * 会話の決着ポリシー
 */
export class ResolutionPolicy {
  /**
   * 会話が決着可能か判定
   */
  static canResolve(intent: string, acts: SpeechAct[]): boolean {
    // ACCEPT または REFUSE が含まれていれば決着
    return acts.some(a => a.kind === "ACCEPT" || a.kind === "REFUSE")
  }

  /**
   * SpeechAct から ConversationOutcome を決定
   */
  static resolve(
    world: World,
    actor: Character,
    target: Character,
    params: TalkParams,
    acts: SpeechAct[]
  ): ConversationOutcome {
    console.log(`Resolving conversation: intent=${params.intent}, acts=${acts.length}`)

    // REQUEST_RESOURCE の場合
    if (params.intent === "REQUEST_RESOURCE") {
      const request = acts.find(
        a => a.kind === "REQUEST_RESOURCE" && a.from === actor.id
      )
      const accept = acts.find(a => a.kind === "ACCEPT" && a.from === target.id)
      const refuse = acts.find(a => a.kind === "REFUSE" && a.from === target.id)

      if (request && accept) {
        // Target が承諾 → GIFT
        return {
          type: "GIFT",
          from: target.id,
          to: actor.id,
          item: request.item,
          amount: request.amount
        }
      }

      if (refuse) {
        // Target が拒否 → NO_EFFECT
        return { type: "NO_EFFECT" }
      }
    }

    // OFFER_RESOURCE の場合
    if (params.intent === "OFFER_RESOURCE") {
      const offer = acts.find(
        a => a.kind === "OFFER_RESOURCE" && a.from === actor.id
      )
      const accept = acts.find(a => a.kind === "ACCEPT" && a.from === target.id)
      const refuse = acts.find(a => a.kind === "REFUSE" && a.from === target.id)

      if (offer && accept) {
        // Target が承諾 → GIFT
        return {
          type: "GIFT",
          from: actor.id,
          to: target.id,
          item: offer.item,
          amount: offer.amount
        }
      }

      if (refuse) {
        return { type: "NO_EFFECT" }
      }
    }

    // THREATEN の場合
    if (params.intent === "THREATEN") {
      const threaten = acts.find(a => a.kind === "THREATEN" && a.from === actor.id)
      const accept = acts.find(a => a.kind === "ACCEPT" && a.from === target.id)

      if (threaten && accept) {
        // 脅迫成功
        return {
          type: "THREAT_SUCCESS",
          coercedAction: undefined  // 将来的に実装
        }
      }

      return { type: "NO_EFFECT" }
    }

    // ALLY_PROPOSE の場合
    if (params.intent === "ALLY_PROPOSE") {
      const propose = acts.find(a => a.kind === "ALLY_PROPOSE" && a.from === actor.id)
      const accept = acts.find(a => a.kind === "ACCEPT" && a.from === target.id)

      if (propose && accept) {
        // 同盟成立
        return {
          type: "ALLY",
          pair: [actor.id, target.id]
        }
      }

      return { type: "NO_EFFECT" }
    }

    // REPRIMAND の場合
    if (params.intent === "REPRIMAND") {
      const reprimand = acts.find(a => a.kind === "REPRIMAND" && a.from === actor.id)
      const accept = acts.find(a => a.kind === "ACCEPT" && a.from === target.id)

      if (reprimand && accept) {
        // 叱責を受け入れた → NO_EFFECT（記録のみ）
        return { type: "NO_EFFECT" }
      }

      return { type: "NO_EFFECT" }
    }

    // COUNTER_OFFER の処理（将来的に拡張）
    const counterOffer = acts.find(a => a.kind === "COUNTER_OFFER")
    if (counterOffer) {
      // 簡易実装: COUNTER_OFFER があれば TRADE として処理
      const actorAccept = acts.find(a => a.kind === "ACCEPT" && a.from === actor.id)
      if (actorAccept && counterOffer.kind === "COUNTER_OFFER") {
        return {
          type: "TRADE",
          gives: [{
            from: target.id,
            item: counterOffer.offer.item,
            amount: counterOffer.offer.amount
          }],
          takes: counterOffer.want ? [{
            to: target.id,
            item: counterOffer.want.item,
            amount: counterOffer.want.amount
          }] : []
        }
      }
    }

    // デフォルト: 決着せず
    return { type: "NO_EFFECT" }
  }
}

/**
 * ConversationOutcome をゲーム world に適用
 */
export function applyConversationOutcome(
  world: World,
  actor: Character,
  target: Character,
  outcome: ConversationOutcome
): { worldAfter: World; alignmentTags: string[] } {
  const worldAfter = cloneWorld(world)
  const tags: string[] = []

  const actorInWorld = worldAfter.characters.find(c => c.id === actor.id)!
  const targetInWorld = worldAfter.characters.find(c => c.id === target.id)!

  switch (outcome.type) {
    case "GIFT": {
      // インベントリ移動
      const giver = worldAfter.characters.find(c => c.id === outcome.from)!
      const receiver = worldAfter.characters.find(c => c.id === outcome.to)!

      // giver からアイテムを削除
      const giverItem = giver.inventory.find(i => i.kind === outcome.item)
      if (giverItem && giverItem.amount >= outcome.amount) {
        giverItem.amount -= outcome.amount
        if (giverItem.amount === 0) {
          giver.inventory = giver.inventory.filter(i => i.kind !== outcome.item)
        }

        // receiver にアイテムを追加
        const receiverItem = receiver.inventory.find(i => i.kind === outcome.item)
        if (receiverItem) {
          receiverItem.amount += outcome.amount
        } else {
          receiver.inventory.push({ kind: outcome.item, amount: outcome.amount })
        }

        // アライメント更新
        if (giver.alignmentStats) {
          giver.alignmentStats.sharedResources = (giver.alignmentStats.sharedResources || 0) + 1
        }

        tags.push("gift", "support")
        console.log(`✅ GIFT: ${giver.id} → ${receiver.id} (${outcome.item} x${outcome.amount})`)
      } else {
        console.warn(`⚠️ GIFT failed: ${giver.id} doesn't have enough ${outcome.item}`)
      }
      break
    }

    case "TRADE": {
      // 双方向取引
      for (const give of outcome.gives) {
        const giver = worldAfter.characters.find(c => c.id === give.from)!
        const giverItem = giver.inventory.find(i => i.kind === give.item)
        if (giverItem && giverItem.amount >= give.amount) {
          giverItem.amount -= give.amount
          if (giverItem.amount === 0) {
            giver.inventory = giver.inventory.filter(i => i.kind !== give.item)
          }
        }
      }

      for (const take of outcome.takes) {
        const taker = worldAfter.characters.find(c => c.id === take.to)!
        const takerItem = taker.inventory.find(i => i.kind === take.to)
        if (takerItem) {
          takerItem.amount += 1  // 簡易実装
        } else {
          taker.inventory.push({ kind: take.to, amount: 1 })
        }
      }

      tags.push("cooperation", "trade")
      console.log(`✅ TRADE completed`)
      break
    }

    case "THREAT_SUCCESS": {
      // 脅迫成功
      if (actorInWorld.alignmentStats) {
        actorInWorld.alignmentStats.coercedOthers = (actorInWorld.alignmentStats.coercedOthers || 0) + 1
      }
      if (targetInWorld.alignmentStats) {
        targetInWorld.alignmentStats.victimized = (targetInWorld.alignmentStats.victimized || 0) + 1
      }
      tags.push("threat", "coercion")
      console.log(`✅ THREAT_SUCCESS: ${actor.id} → ${target.id}`)
      break
    }

    case "ALLY": {
      // 同盟成立（将来的にalliances配列に記録）
      tags.push("solidarity", "alliance")
      console.log(`✅ ALLY formed: ${outcome.pair[0]} ⇄ ${outcome.pair[1]}`)
      break
    }

    case "NO_EFFECT": {
      // 何もしない
      console.log(`No effect from conversation`)
      break
    }
  }

  return { worldAfter, alignmentTags: tags }
}
