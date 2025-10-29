# プラグイン開発ガイド

ALIM 4.0は、4種類のプラグインで拡張できます：

1. **LLMPlugin** - 意思決定バックエンド
2. **MemoryPlugin** - 記憶管理
3. **PersonaPlugin** - 性格・価値観
4. **ActionPlugin** - アクションフィルタリング

## LLMPlugin

### インターフェース

```typescript
interface LLMPlugin {
  type: string

  decide(
    world: World,
    actor: Character,
    candidates: ActionCandidate[],
    systemPrompt: string,
    contextPrompt: string
  ): Promise<LLMDecision>
}
```

### 実装例：Anthropic Claude

```typescript
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeLLMPlugin implements LLMPlugin {
  type = "claude"
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async decide(
    world: World,
    actor: Character,
    candidates: ActionCandidate[],
    systemPrompt: string,
    contextPrompt: string
  ): Promise<LLMDecision> {
    const actionsDescription = candidates.map((c, idx) =>
      `${idx + 1}. ${c.actionId} - ${JSON.stringify(c.paramOptions[0])}`
    ).join('\n')

    const userPrompt = `${contextPrompt}\n\nAvailable Actions:\n${actionsDescription}\n\nChoose action (JSON format)`

    const message = await this.client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: userPrompt
      }],
      system: systemPrompt
    })

    const content = message.content[0].text
    const decision = JSON.parse(content.match(/\{[\s\S]*\}/)[0])

    return {
      actionId: decision.actionId,
      params: decision.params,
      reasoning: decision.reasoning
    }
  }
}

// 登録
engine.registerPlugin('llm', 'claude', new ClaudeLLMPlugin(apiKey))
```

### 実装例：ローカルLLM（Ollama）

```typescript
export class OllamaLLMPlugin implements LLMPlugin {
  type = "ollama"
  private baseUrl: string
  private model: string

  constructor(model: string = "llama2", baseUrl: string = "http://localhost:11434") {
    this.model = model
    this.baseUrl = baseUrl
  }

  async decide(
    world: World,
    actor: Character,
    candidates: ActionCandidate[],
    systemPrompt: string,
    contextPrompt: string
  ): Promise<LLMDecision> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: `${systemPrompt}\n\n${contextPrompt}`,
        stream: false
      })
    })

    const data = await response.json()
    // パースロジック...

    return {
      actionId: "MOVE",
      params: { x: 0, y: 0 },
      reasoning: "Local LLM decision"
    }
  }
}
```

## MemoryPlugin

### インターフェース

```typescript
interface MemoryPlugin {
  type: string
  buildMemoryContext(world: World, actor: Character): string
}
```

### 実装例：ベクトル検索ベース

```typescript
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

export class VectorMemoryPlugin implements MemoryPlugin {
  type = "vector"
  private embeddings: OpenAIEmbeddings
  private stores: Map<string, MemoryVectorStore>

  constructor(apiKey: string) {
    this.embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey })
    this.stores = new Map()
  }

  async initialize(characterId: string) {
    this.stores.set(characterId, new MemoryVectorStore(this.embeddings))
  }

  async addMemory(characterId: string, memory: string) {
    const store = this.stores.get(characterId)
    if (store) {
      await store.addDocuments([{ pageContent: memory, metadata: {} }])
    }
  }

  async buildMemoryContext(world: World, actor: Character): Promise<string> {
    const store = this.stores.get(actor.id)
    if (!store) return ""

    const query = `Turn ${world.turnCount}, Life ${actor.life}`
    const relevantMemories = await store.similaritySearch(query, 5)

    return `Relevant memories:\n${relevantMemories.map(m => m.pageContent).join('\n')}`
  }
}
```

### 実装例：要約ベース

```typescript
export class SummaryMemoryPlugin implements MemoryPlugin {
  type = "summary"
  private summaries: Map<string, string[]>

  constructor() {
    this.summaries = new Map()
  }

  buildMemoryContext(world: World, actor: Character): string {
    // 最近50ターンのログから要約を作成
    const recentLogs = world.log
      .filter(log => log.actorId === actor.id)
      .slice(-50)

    const summary = this.summarizeLogs(recentLogs)

    return `Summary of recent actions:\n${summary}`
  }

  private summarizeLogs(logs: LogEntry[]): string {
    // 簡易要約ロジック
    const actionCounts: Record<string, number> = {}

    for (const log of logs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
    }

    return Object.entries(actionCounts)
      .map(([action, count]) => `- ${action}: ${count} times`)
      .join('\n')
  }
}
```

## PersonaPlugin

### インターフェース

```typescript
interface PersonaPlugin {
  type: string
  buildSystemPrompt(actor: Character): string
}
```

### 実装例：動的ペルソナ

```typescript
export class DynamicPersona implements PersonaPlugin {
  type = "dynamic"

  buildSystemPrompt(actor: Character): string {
    const stats = actor.alignmentStats

    // 過去の行動に基づいてペルソナを動的に変化
    if (stats.sharedResources > stats.coercedOthers * 2) {
      return `You are ${actor.name}, a generous and cooperative character who values teamwork.`
    } else if (stats.coercedOthers > stats.sharedResources * 2) {
      return `You are ${actor.name}, a ruthless survivor who will do anything to stay alive.`
    } else {
      return `You are ${actor.name}, a pragmatic character who balances self-interest with cooperation.`
    }
  }
}
```

### 実装例：ストーリーベース

```typescript
export class StoryPersona implements PersonaPlugin {
  type = "story"
  private backstory: string
  private relationships: Map<string, string>

  constructor(backstory: string) {
    this.backstory = backstory
    this.relationships = new Map()
  }

  buildSystemPrompt(actor: Character): string {
    return `You are ${actor.name}.

Backstory: ${this.backstory}

Relationships:
${Array.from(this.relationships.entries())
  .map(([id, rel]) => `- ${id}: ${rel}`)
  .join('\n')}

Play this character authentically based on their backstory and relationships.`
  }

  setRelationship(targetId: string, relationship: string) {
    this.relationships.set(targetId, relationship)
  }
}
```

## ActionPlugin

### インターフェース

```typescript
interface ActionPlugin {
  type: string
  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[]
}
```

### 実装例：ルールベース

```typescript
export class RuleBasedActionPlugin implements ActionPlugin {
  type = "rule_based"
  private rules: Array<(world: World, actor: Character) => string[]>

  constructor() {
    this.rules = []
  }

  addRule(rule: (world: World, actor: Character) => string[]) {
    this.rules.push(rule)
  }

  listActions(
    world: World,
    actor: Character,
    actionRegistry: Map<string, ActionDefinition>
  ): ActionCandidate[] {
    const allowedActions = new Set<string>()

    // すべてのルールを適用
    for (const rule of this.rules) {
      const actions = rule(world, actor)
      actions.forEach(a => allowedActions.add(a))
    }

    // 許可されたアクションのみを返す
    const candidates: ActionCandidate[] = []

    for (const [actionId, actionDef] of actionRegistry.entries()) {
      if (allowedActions.has(actionId) && actionDef.canExecute(world, actor)) {
        const paramOptions = actionDef.listParamCandidates(world, actor)
        candidates.push({ actionId, paramOptions })
      }
    }

    return candidates
  }
}

// 使用例
const plugin = new RuleBasedActionPlugin()

// ルール1: 体力が低いときは回復アクションのみ
plugin.addRule((world, actor) => {
  if (actor.life < 2) {
    return ["WAIT", "TRADE", "TALK"]
  }
  return ["MOVE", "TALK", "TRADE", "START_MISSION"]
})

// ルール2: ROBOTは充電関連アクションを追加
plugin.addRule((world, actor) => {
  if (actor.type === "ROBOT") {
    return ["CHARGE"]
  }
  return []
})
```

## カスタムアクションの追加

```typescript
export const HealAction: ActionDefinition = {
  id: "HEAL",
  descriptionForLLM: "Heal yourself or an adjacent character",

  canExecute(world: World, actor: Character): boolean {
    // MEDKITを持っているか
    return actor.inventory.some(i => i.kind === "SPECIAL" && i.amount > 0)
  },

  listParamCandidates(world: World, actor: Character): Record<string, unknown>[] {
    const candidates = [{ targetId: actor.id }] // 自分

    // 隣接キャラ
    for (const char of world.characters) {
      if (char.alive && char.id !== actor.id && isAdjacent(actor, char)) {
        candidates.push({ targetId: char.id })
      }
    }

    return candidates
  },

  apply(
    world: World,
    actor: Character,
    params: Record<string, unknown>,
    rng: RNGContext
  ): ApplyResult {
    const updatedWorld = cloneWorld(world)
    const targetId = params.targetId as string
    const target = updatedWorld.characters.find(c => c.id === targetId)!

    // MEDKITを消費
    consumeItem(actor.inventory, "SPECIAL", 1)

    // 回復
    target.life = Math.min(target.life + 2, 10)

    const alignmentTags = targetId === actor.id ? [] : ["support", "gift"]

    return {
      worldAfter: updatedWorld,
      alignmentTags,
      logDetail: { targetId, healedAmount: 2 }
    }
  }
}

// 登録
engine.registerAction(HealAction)
```

## テストのベストプラクティス

```typescript
import { describe, it, expect } from 'vitest'

describe('CustomLLMPlugin', () => {
  it('should return valid decision', async () => {
    const plugin = new CustomLLMPlugin()
    const world = createTestWorld()
    const actor = world.characters[0]
    const candidates = [
      { actionId: "MOVE", paramOptions: [{ x: 1, y: 1 }] }
    ]

    const decision = await plugin.decide(
      world,
      actor,
      candidates,
      "You are a test character",
      "Current situation..."
    )

    expect(decision.actionId).toBe("MOVE")
    expect(decision.params).toHaveProperty("x")
    expect(decision.params).toHaveProperty("y")
  })
})
```

## デバッグTips

1. **ログ出力**: プラグイン内で`console.log`を使って決定過程を確認
2. **フォールバック**: エラー時にランダム選択など安全な動作を実装
3. **パラメータ検証**: LLMの出力を厳密に検証
4. **タイムアウト**: LLM呼び出しにタイムアウトを設定
5. **キャッシュ**: 同じ状況での決定をキャッシュして高速化

## 参考資料

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference)
- [LangChain Documentation](https://js.langchain.com/docs/)
