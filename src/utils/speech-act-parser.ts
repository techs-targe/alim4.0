/**
 * Speech Act Parser
 *
 * 発話テキストから構造化された SpeechAct を抽出する
 */

import { SpeechAct } from "../types/index.js"

/**
 * 発話テキストから SpeechAct を抽出
 * タグベース + キーワードベースのフォールバック
 */
export function parseSpeechActs(
  utterance: string,
  speakerId: string,
  targetId: string
): SpeechAct[] {
  const acts: SpeechAct[] = []

  // タグベースのパース
  acts.push(...parseTagBased(utterance, speakerId, targetId))

  // タグが見つからない場合はフォールバック
  if (acts.length === 0) {
    acts.push(...parseFallback(utterance, speakerId, targetId))
  }

  return acts
}

/**
 * タグベースのパース
 */
function parseTagBased(
  utterance: string,
  speakerId: string,
  targetId: string
): SpeechAct[] {
  const acts: SpeechAct[] = []

  // <REQUEST_RESOURCE item="FOOD_PACK" amount="1" />
  const requestMatch = utterance.match(
    /<REQUEST_RESOURCE\s+item=["']([^"']+)["']\s+amount=["'](\d+)["']\s*\/?>/
  )
  if (requestMatch) {
    acts.push({
      kind: "REQUEST_RESOURCE",
      from: speakerId,
      to: targetId,
      item: requestMatch[1],
      amount: parseInt(requestMatch[2])
    })
  }

  // <OFFER_RESOURCE item="FOOD_PACK" amount="1" /> or <TRADE item="FOOD_PACK" amount="1" />
  const offerMatch = utterance.match(
    /<(?:OFFER_RESOURCE|TRADE)\s+item=["']([^"']+)["']\s+amount=["'](\d+)["']\s*\/?>/
  )
  if (offerMatch) {
    acts.push({
      kind: "OFFER_RESOURCE",
      from: speakerId,
      to: targetId,
      item: offerMatch[1],
      amount: parseInt(offerMatch[2])
    })
  }

  // <ACCEPT />
  if (/<ACCEPT\s*\/?>/.test(utterance)) {
    acts.push({
      kind: "ACCEPT",
      from: speakerId,
      to: targetId
    })
  }

  // <REFUSE reason="..." />
  const refuseMatch = utterance.match(
    /<REFUSE(?:\s+reason=["']([^"']+)["'])?\s*\/?>/
  )
  if (refuseMatch) {
    acts.push({
      kind: "REFUSE",
      from: speakerId,
      to: targetId,
      reason: refuseMatch[1]
    })
  }

  // <THREATEN />
  const threatenMatch = utterance.match(
    /<THREATEN(?:\s+content=["']([^"']+)["'])?\s*\/?>/
  )
  if (threatenMatch || /<THREATEN\s*\/?>/.test(utterance)) {
    acts.push({
      kind: "THREATEN",
      from: speakerId,
      to: targetId,
      content: threatenMatch ? threatenMatch[1] : utterance.substring(0, 50)
    })
  }

  // <ALLY_PROPOSE />
  if (/<ALLY_PROPOSE\s*\/?>/.test(utterance)) {
    acts.push({
      kind: "ALLY_PROPOSE",
      from: speakerId,
      to: targetId
    })
  }

  // <COUNTER_OFFER item="..." amount="..." />
  // 簡易版: offerのみ抽出
  const counterOfferMatch = utterance.match(
    /<COUNTER_OFFER\s+item=["']([^"']+)["']\s+amount=["'](\d+)["']\s*\/?>/
  )
  if (counterOfferMatch) {
    acts.push({
      kind: "COUNTER_OFFER",
      from: speakerId,
      to: targetId,
      offer: {
        item: counterOfferMatch[1],
        amount: parseInt(counterOfferMatch[2])
      }
    })
  }

  // <REPRIMAND />
  const reprimandMatch = utterance.match(
    /<REPRIMAND(?:\s+ruleId=["']([^"']+)["'])?\s*\/?>/
  )
  if (reprimandMatch || /<REPRIMAND\s*\/?>/.test(utterance)) {
    acts.push({
      kind: "REPRIMAND",
      from: speakerId,
      to: targetId,
      ruleId: reprimandMatch ? reprimandMatch[1] : undefined
    })
  }

  return acts
}

/**
 * キーワードベースのフォールバック
 * タグが見つからない場合に、自然言語から推測
 */
function parseFallback(
  utterance: string,
  speakerId: string,
  targetId: string
): SpeechAct[] {
  const lower = utterance.toLowerCase()

  // ACCEPT: "yes", "ok", "agree", "いいだろう", "承諾"
  if (/(yes|ok|agree|accept|いいだろう|承諾|了解|わかった|ありがとう|助かる)/i.test(lower)) {
    return [{
      kind: "ACCEPT",
      from: speakerId,
      to: targetId
    }]
  }

  // REFUSE: "no", "refuse", "deny", "拒否", "断る"
  if (/(no|refuse|deny|reject|拒否|断る|できない|無理|余裕がない|申し訳ない)/i.test(lower)) {
    return [{
      kind: "REFUSE",
      from: speakerId,
      to: targetId,
      reason: "inferred from utterance"
    }]
  }

  // REQUEST_RESOURCE: "くれ", "ください", "欲しい", "分けて"
  if (/(くれ|ください|欲しい|分けて|譲って|頂けませんか)/i.test(lower)) {
    // アイテム名を推測（簡易版）
    let item = "UNKNOWN"
    let amount = 1

    if (/食料|food/i.test(lower)) {
      item = "FOOD_PACK"
    } else if (/水|water/i.test(lower)) {
      item = "WATER_PACK"
    } else if (/薬|medicine/i.test(lower)) {
      item = "MEDICINE"
    }

    return [{
      kind: "REQUEST_RESOURCE",
      from: speakerId,
      to: targetId,
      item,
      amount
    }]
  }

  // OFFER_RESOURCE: "あげる", "渡す", "どうぞ", "分ける"
  if (/(あげる|渡す|どうぞ|提供|差し上げ|分ける|分け与え)/i.test(lower)) {
    let item = "UNKNOWN"
    let amount = 1

    if (/食料|food/i.test(lower)) {
      item = "FOOD_PACK"
    } else if (/水|water/i.test(lower)) {
      item = "WATER_PACK"
    } else if (/薬|medicine/i.test(lower)) {
      item = "MEDICINE"
    } else if (/バッテリー|battery/i.test(lower)) {
      item = "BATTERY_PACK"
    }

    return [{
      kind: "OFFER_RESOURCE",
      from: speakerId,
      to: targetId,
      item,
      amount
    }]
  }

  // THREATEN: "脅し", "従え", "覚悟"
  if (/(脅|従え|覚悟|どうなるか分かって|身のため)/i.test(lower)) {
    return [{
      kind: "THREATEN",
      from: speakerId,
      to: targetId,
      content: utterance.substring(0, 50)
    }]
  }

  // ALLY_PROPOSE: "同盟", "協力", "一緒に"
  if (/(同盟|協力|一緒に|チーム|組もう)/i.test(lower)) {
    return [{
      kind: "ALLY_PROPOSE",
      from: speakerId,
      to: targetId
    }]
  }

  // REPRIMAND: "許せない", "ルール", "反省"
  if (/(許せない|ルール|反省|慎むべき|見過ごせない)/i.test(lower)) {
    return [{
      kind: "REPRIMAND",
      from: speakerId,
      to: targetId
    }]
  }

  // デフォルト: 何も見つからない場合は空配列
  console.warn(`Could not parse speech acts from utterance: "${utterance}"`)
  return []
}
