/**
 * プラグインファクトリー
 * 設定オブジェクト {type, config} から実際のプラグインインスタンスを生成
 */

import { MockLLMPlugin } from "./llm/mock.js"
import { OpenAILLMPlugin } from "./llm/openai.js"
import { CooperativePersona } from "./persona/cooperative.js"
import { SelfishPersona } from "./persona/selfish.js"
import { RationalPersona } from "./persona/rational.js"
import { NeutralPersona } from "./persona/neutral.js"
import { ProviderPersona } from "./persona/provider.js"
import { ChildlikePersona } from "./persona/childlike.js"
import { DefaultPersona } from "./persona/default.js"
import { SimpleMemoryPlugin } from "./memory/simple.js"
import { NoMemoryPlugin } from "./memory/none.js"
import { LightMemMemoryPlugin } from "./memory/lightmem.js"

export interface PluginConfig {
  type: string
  config?: Record<string, unknown>
}

/**
 * LLMプラグインをインスタンス化
 */
export function createLLMPlugin(pluginConfig: PluginConfig): any {
  const { type, config = {} } = pluginConfig

  switch (type) {
    case "mock":
      return new MockLLMPlugin()

    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY || ""
      const model = (config.model as string) || process.env.OPENAI_MODEL || "gpt-4-1106-preview"
      const temperature = (config.temperature as number) || 0.7
      return new OpenAILLMPlugin(apiKey, model, temperature)
    }

    default:
      console.warn(`Unknown LLM plugin type: ${type}, falling back to mock`)
      return new MockLLMPlugin()
  }
}

/**
 * ペルソナプラグインをインスタンス化
 */
export function createPersonaPlugin(pluginConfig: PluginConfig): any {
  const { type } = pluginConfig

  switch (type) {
    case "cooperative":
      return new CooperativePersona()

    case "selfish":
      return new SelfishPersona()

    case "rational":
      return new RationalPersona()

    case "neutral":
      return new NeutralPersona()

    case "provider":
      return new ProviderPersona()

    case "childlike":
      return new ChildlikePersona()

    case "default":
      return new DefaultPersona()

    default:
      console.warn(`Unknown persona plugin type: ${type}, falling back to neutral`)
      return new NeutralPersona()
  }
}

/**
 * メモリプラグインをインスタンス化
 */
export function createMemoryPlugin(pluginConfig: PluginConfig): any {
  const { type, config = {} } = pluginConfig

  switch (type) {
    case "simple":
      return new SimpleMemoryPlugin()

    case "none":
      return new NoMemoryPlugin()

    case "lightmem": {
      const memorySize = (config.memorySize as number) || 100
      return new LightMemMemoryPlugin(memorySize)
    }

    default:
      console.warn(`Unknown memory plugin type: ${type}, falling back to simple`)
      return new SimpleMemoryPlugin()
  }
}

/**
 * アクションプラグインをインスタンス化（既存のコードと互換性を保つため設定オブジェクトを返す）
 */
export function createActionPlugins(pluginConfigs: PluginConfig[]): PluginConfig[] {
  // アクションプラグインは現在設定オブジェクトとして扱われているため、
  // そのまま返す（将来的にインスタンス化が必要になった場合はここで処理）
  return pluginConfigs
}

/**
 * コンテキストプラグインをインスタンス化（既存のコードと互換性を保つため設定オブジェクトを返す）
 */
export function createContextPlugins(pluginConfigs?: PluginConfig[]): PluginConfig[] | undefined {
  // コンテキストプラグインは現在設定オブジェクトとして扱われているため、
  // そのまま返す（将来的にインスタンス化が必要になった場合はここで処理）
  return pluginConfigs
}
