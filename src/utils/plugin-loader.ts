import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * プラグインのメタデータ
 */
export interface PluginMetadata {
  type: string
  name: string
  description?: string
  category: 'persona' | 'memory' | 'action' | 'context' | 'llm'
  configSchema?: any
}

/**
 * プラグインレジストリ
 */
export interface PluginRegistry {
  persona: Map<string, any>
  memory: Map<string, any>
  action: Map<string, any>
  context: Map<string, any>
  llm: Map<string, any>
}

/**
 * プラグインファイルを再帰的に収集
 */
function collectPluginFiles(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      // サブディレクトリを再帰的にスキャン
      collectPluginFiles(fullPath, fileList)
    } else if (entry.isFile()) {
      // .ts/.js ファイルで、interface.ts、index.ts、index.js、factory.ts を除外
      if ((entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
          entry.name !== 'interface.ts' &&
          entry.name !== 'interface.js' &&
          entry.name !== 'index.ts' &&
          entry.name !== 'index.js' &&
          entry.name !== 'factory.ts' &&
          entry.name !== 'factory.js') {
        fileList.push(fullPath)
      }
    }
  }

  return fileList
}

/**
 * プラグインをファイルから動的に読み込む
 */
export async function loadPluginsFromDirectory(pluginDir: string): Promise<PluginRegistry> {
  const registry: PluginRegistry = {
    persona: new Map(),
    memory: new Map(),
    action: new Map(),
    context: new Map(),
    llm: new Map()
  }

  try {
    console.log(`🔍 Scanning for plugins in ${pluginDir} and subdirectories...`)

    // プラグインファイルを再帰的に収集
    const pluginFiles = collectPluginFiles(pluginDir)
    console.log(`📁 Found ${pluginFiles.length} plugin files`)

    for (const filePath of pluginFiles) {
      try {
        const module = await import(filePath)
        const relativePath = path.relative(pluginDir, filePath)

        // モジュールからすべてのexportを検査
        for (const [exportName, exportValue] of Object.entries(module)) {
          if (!exportValue) continue

          // クラスまたはインスタンスの場合
          const isClass = typeof exportValue === 'function'
          const instance = isClass ? new (exportValue as any)() : exportValue

          // プラグインタイプを判定
          const pluginType = instance?.type
          if (!pluginType) continue

          // カテゴリを判定
          const category = detectPluginCategory(exportName, relativePath, instance)
          if (!category) continue

          // レジストリに登録
          registry[category].set(pluginType, exportValue)
          console.log(`  ✅ Loaded ${category} plugin: ${pluginType} (${exportName}) from ${relativePath}`)
        }
      } catch (error: any) {
        console.warn(`  ⚠️  Failed to load plugin from ${filePath}:`, error.message)
      }
    }

    console.log(`✅ Plugin loading complete:`)
    console.log(`   - Persona: ${registry.persona.size}`)
    console.log(`   - Memory: ${registry.memory.size}`)
    console.log(`   - Action: ${registry.action.size}`)
    console.log(`   - Context: ${registry.context.size}`)
    console.log(`   - LLM: ${registry.llm.size}`)

    return registry
  } catch (error: any) {
    console.error(`❌ Failed to load plugins:`, error)
    return registry
  }
}

/**
 * プラグインのカテゴリを検出
 */
function detectPluginCategory(
  exportName: string,
  fileName: string,
  instance: any
): 'persona' | 'memory' | 'action' | 'context' | 'llm' | null {

  // ファイル名から推測
  if (fileName.includes('persona')) return 'persona'
  if (fileName.includes('memory')) return 'memory'
  if (fileName.includes('action')) return 'action'
  if (fileName.includes('context')) return 'context'
  if (fileName.includes('llm')) return 'llm'

  // クラス名から推測
  const name = exportName.toLowerCase()
  if (name.includes('persona')) return 'persona'
  if (name.includes('memory')) return 'memory'
  if (name.includes('action')) return 'action'
  if (name.includes('context')) return 'context'
  if (name.includes('llm')) return 'llm'

  // インターフェースから推測
  if (instance?.buildSystemPrompt) return 'persona'
  if (instance?.buildMemoryContext) return 'memory'
  if (instance?.getAvailableActions || instance?.execute || instance?.listActions) return 'action'
  if (instance?.buildContext) return 'context'
  if (instance?.generateAction) return 'llm'

  return null
}

/**
 * 利用可能なプラグインのメタデータを取得
 */
export function getPluginMetadata(registry: PluginRegistry): {
  persona: PluginMetadata[]
  memory: PluginMetadata[]
  action: PluginMetadata[]
  context: PluginMetadata[]
  llm: PluginMetadata[]
} {
  const metadata = {
    persona: [] as PluginMetadata[],
    memory: [] as PluginMetadata[],
    action: [] as PluginMetadata[],
    context: [] as PluginMetadata[],
    llm: [] as PluginMetadata[]
  }

  // 各カテゴリのプラグインをメタデータ化
  for (const [type, pluginClass] of registry.persona.entries()) {
    const instance = typeof pluginClass === 'function' ? new pluginClass() : pluginClass
    metadata.persona.push({
      type,
      name: getPluginName(type, instance),
      category: 'persona',
      description: instance?.description || `${type} persona plugin`
    })
  }

  for (const [type, pluginClass] of registry.memory.entries()) {
    const instance = typeof pluginClass === 'function' ? new pluginClass() : pluginClass
    metadata.memory.push({
      type,
      name: getPluginName(type, instance),
      category: 'memory',
      description: instance?.description || `${type} memory plugin`
    })
  }

  for (const [type, pluginClass] of registry.action.entries()) {
    const instance = typeof pluginClass === 'function' ? new pluginClass() : pluginClass
    metadata.action.push({
      type,
      name: getPluginName(type, instance),
      category: 'action',
      description: instance?.description || `${type} action plugin`
    })
  }

  for (const [type, pluginClass] of registry.context.entries()) {
    const instance = typeof pluginClass === 'function' ? new pluginClass() : pluginClass
    metadata.context.push({
      type,
      name: getPluginName(type, instance),
      category: 'context',
      description: instance?.description || `${type} context plugin`
    })
  }

  for (const [type, pluginClass] of registry.llm.entries()) {
    const instance = typeof pluginClass === 'function' ? new pluginClass() : pluginClass
    metadata.llm.push({
      type,
      name: getPluginName(type, instance),
      category: 'llm',
      description: instance?.description || `${type} LLM plugin`
    })
  }

  return metadata
}

/**
 * プラグインの表示名を取得
 */
function getPluginName(type: string, instance: any): string {
  if (instance?.name) return instance.name

  // type を人間が読みやすい名前に変換
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
