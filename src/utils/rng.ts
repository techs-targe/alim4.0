import { RNGContext } from "../types/index.js"

/**
 * 線形合同法による疑似乱数生成器
 * リプレイ可能性を保証するため、決定的な乱数列を生成
 */
export class SeededRNG implements RNGContext {
  private seed: number
  private state: number

  constructor(seed: number) {
    this.seed = seed
    this.state = seed
  }

  /**
   * 0.0 - 1.0 の乱数を生成
   */
  next(): number {
    // LCG parameters (from Numerical Recipes)
    const a = 1664525
    const c = 1013904223
    const m = 2 ** 32

    this.state = (a * this.state + c) % m
    return this.state / m
  }

  /**
   * 現在の状態を取得（保存用）
   */
  getState(): number {
    return this.state
  }

  /**
   * 状態を復元（リプレイ用）
   */
  setState(state: number): void {
    this.state = state
  }

  /**
   * シードを取得
   */
  getSeed(): number {
    return this.seed
  }
}
