import { World, Character } from "../../types/index.js"

/**
 * コンテキストプラグインインターフェース
 * LLMプロンプトに追加情報を提供する汎用インターフェース
 */
export interface ContextPlugin {
  type: string

  /**
   * キャラクターのためのコンテキスト情報を構築
   * @param world ワールド状態
   * @param actor 対象キャラクター
   * @returns コンテキスト情報の文字列（LLMプロンプトに追加される）
   */
  buildContext(world: World, actor: Character): string
}
