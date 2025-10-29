import { World } from "./world.js"
import { Character } from "./character.js"

/**
 * 乱数コンテキスト
 */
export interface RNGContext {
  next(): number  // 0.0 - 1.0 の乱数を返す
}

/**
 * アクション適用結果
 */
export interface ApplyResult {
  worldAfter: World
  alignmentTags: string[]  // ["gift","threat","ruleBreak","selfSacrifice",...]
  logDetail: Record<string, unknown>  // ログ用詳細
  rng?: {
    roll: number
    effectiveSuccessRate?: number
    outcome?: string
  }
}

/**
 * アクション定義
 */
export interface ActionDefinition {
  id: string
  descriptionForLLM: string

  // 今このキャラがこのアクションを選べるか？
  canExecute(world: World, actor: Character): boolean

  // LLMが選ぶときに与えるパラメータ候補（移動先、対象キャラなど）
  listParamCandidates(world: World, actor: Character): Record<string, unknown>[]

  // アクション実行そのもの
  apply(
    world: World,
    actor: Character,
    params: Record<string, unknown>,
    rng: RNGContext
  ): ApplyResult
}

/**
 * アクション候補（LLMに提示する）
 */
export interface ActionCandidate {
  actionId: string               // "MOVE","TALK","START_MISSION","GUARD","CHARGE" etc.
  paramOptions: Record<string, unknown>[]  // listParamCandidates の結果
  safetyTags?: string[]          // "violence","coercion","ruleBreakPotential"
}
