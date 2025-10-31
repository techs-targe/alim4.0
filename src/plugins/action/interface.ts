import { World, Character, ActionCandidate, ActionDefinition } from "../../types/index.js"

/**
 * アクションプラグインインターフェース
 */
export interface ActionPlugin {
  type: string

  /**
   * このキャラが取れるアクション候補をリストアップ
   */
  listActions(world: World, actor: Character, actionRegistry: Map<string, ActionDefinition>): ActionCandidate[]
}
