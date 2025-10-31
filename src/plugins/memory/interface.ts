import { World, Character } from "../../types/index.js"

/**
 * メモリープラグインインターフェース
 */
export interface MemoryPlugin {
  type: string

  /**
   * 過去の出来事や関係性から、プロンプトに追加する記憶要約を生成
   */
  buildMemoryContext(world: World, actor: Character): string
}
