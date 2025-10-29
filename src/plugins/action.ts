import { World, Character, ActionCandidate, ActionDefinition } from "../types/index.js"

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

/**
 * 標準アクションプラグイン
 * 登録されているすべてのアクションから、実行可能なものをフィルタして返す
 */
export class StandardActionPlugin implements ActionPlugin {
  type = "standard"

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const candidates: ActionCandidate[] = []

    for (const [actionId, actionDef] of actionRegistry.entries()) {
      if (actionDef.canExecute(world, actor)) {
        const paramOptions = actionDef.listParamCandidates(world, actor)
        candidates.push({
          actionId,
          paramOptions,
          safetyTags: [] // TODO: アクション定義に応じて設定
        })
      }
    }

    return candidates
  }
}

/**
 * 制限付きアクションプラグイン
 * 暴力的・強制的なアクションを除外
 */
export class PacifistActionPlugin implements ActionPlugin {
  type = "pacifist"

  private excludedActions = new Set(["THREATEN", "COERCE", "STEAL"])

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const candidates: ActionCandidate[] = []

    for (const [actionId, actionDef] of actionRegistry.entries()) {
      if (this.excludedActions.has(actionId)) {
        continue // 暴力的アクションはスキップ
      }

      if (actionDef.canExecute(world, actor)) {
        const paramOptions = actionDef.listParamCandidates(world, actor)
        candidates.push({
          actionId,
          paramOptions,
          safetyTags: []
        })
      }
    }

    return candidates
  }
}
