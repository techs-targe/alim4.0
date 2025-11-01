import { PersonaPlugin } from "./interface.js"
import { Character } from "../../types/index.js"

/**
 * デフォルト（ペルソナなし）
 * LLMの素の判断に完全に任せる
 */
export class DefaultPersona implements PersonaPlugin {
  type = "default"
  description = "ペルソナ指示なし。LLMの素の判断に完全に任せます。性格的な制約や指針を与えず、純粋にLLMの推論能力で行動します。実験的な設定として有用です。"

  buildSystemPrompt(actor: Character): string {
    const resourceInfo = actor.type === 'ROBOT'
      ? `\n**重要：あなたはROBOTです。**\n- あなたに必要な資源は BATTERY_PACK のみです（24ターンごとに1個消費）\n- FOOD_PACK と WATER_PACK はあなたには不要です（ANDROIDのみ必要）\n- **充電について**: CHARGEアクションで充電ステーション（6ターン）を使うとBATTERY_PACKを1個取得できますが、初期保有数（${actor.maxBatteryPack}個）以上は持てません。警戒度が上昇するため注意してください。\n`
      : `\n**重要：あなたはANDROIDです。**\n- あなたに必要な資源は FOOD_PACK と WATER_PACK です\n- BATTERY_PACK はあなたには不要です（ROBOTのみ必要）\n- 24ターン（1日）ごとに FOOD_PACK×1 と WATER_PACK×1 を消費します\n`

    return `あなたは${actor.name}です。サバイバルシミュレーションの参加者です。
${resourceInfo}

あなたの目標は生き延びることです。状況を判断し、最善と思われる行動を選択してください。`
  }
}

export default DefaultPersona
