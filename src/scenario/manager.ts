import { Scenario, WorldInitData } from "../types/index.js"
import * as fs from "fs"
import * as path from "path"

/**
 * シナリオマネージャー
 */
export class ScenarioManager {
  private scenarios: Map<string, Scenario> = new Map()
  private scenarioDir: string

  constructor(scenarioDir: string = "./scenarios") {
    this.scenarioDir = scenarioDir
    this.ensureScenarioDir()
  }

  /**
   * シナリオディレクトリが存在しなければ作成
   */
  private ensureScenarioDir(): void {
    if (!fs.existsSync(this.scenarioDir)) {
      fs.mkdirSync(this.scenarioDir, { recursive: true })
    }
  }

  /**
   * シナリオを登録
   */
  register(scenario: Scenario): void {
    this.scenarios.set(scenario.id, scenario)
  }

  /**
   * シナリオを取得
   */
  get(id: string): Scenario | undefined {
    return this.scenarios.get(id)
  }

  /**
   * 全シナリオを取得
   */
  getAll(): Scenario[] {
    return Array.from(this.scenarios.values())
  }

  /**
   * シナリオをファイルに保存
   */
  save(scenario: Scenario): void {
    const filePath = path.join(this.scenarioDir, `${scenario.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2), "utf-8")
  }

  /**
   * シナリオをファイルから読み込み
   */
  load(id: string): Scenario | null {
    const filePath = path.join(this.scenarioDir, `${id}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = fs.readFileSync(filePath, "utf-8")
    const scenario = JSON.parse(data) as Scenario
    this.scenarios.set(scenario.id, scenario)
    return scenario
  }

  /**
   * ディレクトリ内の全シナリオを読み込み
   */
  loadAll(): void {
    const files = fs.readdirSync(this.scenarioDir)

    for (const file of files) {
      if (file.endsWith(".json")) {
        const id = file.replace(".json", "")
        this.load(id)
      }
    }
  }

  /**
   * シナリオを削除
   */
  delete(id: string): void {
    this.scenarios.delete(id)

    const filePath = path.join(this.scenarioDir, `${id}.json`)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}
