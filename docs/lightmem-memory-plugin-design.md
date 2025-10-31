# LightMem Memory Plugin 設計書

## 概要

LightMem論文（2510.18866）のエッセンスを活用したALIM 4.0向けメモリプラグイン。
人間の記憶モデル（Atkinson-Shiffrin）に基づく3段階の記憶システムを実装し、
効率的で軽量なメモリ管理を実現する。

## 参考論文

**LIGHTMEM: LIGHTWEIGHT AND EFFICIENT MEMORY-AUGMENTED GENERATION**
- 著者: Jizhan Fang et al., Zhejiang University
- arXiv: 2510.18866
- 主要概念: 感覚記憶 → 短期記憶 → 長期記憶の3段階モデル

## ALIM 4.0への適応

### 1. 感覚記憶 (Sensory Memory)
**目的**: 冗長な情報をフィルタリングし、重要なイベントのみを保持

**実装方針**:
- 行動ログから重要度スコアリングを行う
- 重要度基準:
  - 社会的相互作用（TALK, TRADE）: 高優先度
  - 生存に関わる行動（CHARGE, 食料消費）: 高優先度
  - 単純な移動（MOVE, WAIT）: 低優先度
- バッファサイズ: 直近20ターン分
- 圧縮率: 上位50%の重要イベントのみ保持

### 2. 短期記憶 (Short-term Memory)
**目的**: トピック/カテゴリ別に記憶を整理し、構造化されたアクセスを提供

**実装方針**:
- カテゴリ分類:
  - **社会的相互作用**: TALK, TRADE, 脅迫, 同盟
  - **生存活動**: CHARGE, 食料獲得, ミッション
  - **移動**: 位置変更, 探索
  - **危機**: 低ライフ状態, 他者の死
- 各カテゴリごとに最近5件のイベントを保持
- トピック要約: カテゴリごとに簡潔な要約を生成

### 3. 長期記憶 (Long-term Memory)
**目的**: 重要な経験を統合し、キャラクターの行動パターンを学習

**実装方針**:
- 統計情報の蓄積:
  - 各キャラクターとの相互作用回数
  - 与えた/受けた資源の合計
  - 成功/失敗したミッション数
- 時間的統合:
  - 20ターンごとにバッチ更新
  - 類似イベントの統合
  - 重要な転換点の記録
- 記憶の忘却:
  - 100ターン以上前の詳細は統計情報のみ保持
  - 重要度の低いイベントは徐々に削除

## データ構造

```typescript
interface LightMemState {
  // 感覚記憶: 直近の生イベント
  sensorybuffer: LogEntry[]

  // 短期記憶: カテゴリ別整理済み
  shortTermMemory: {
    social: MemoryEntry[]
    survival: MemoryEntry[]
    movement: MemoryEntry[]
    crisis: MemoryEntry[]
  }

  // 長期記憶: 統計と重要イベント
  longTermMemory: {
    statistics: {
      totalTurns: number
      interactionCounts: Map<string, number>
      resourcesGiven: number
      resourcesReceived: number
      missionsCompleted: number
      missionsFailed: number
    }
    milestones: MilestoneEvent[]
  }

  // 最終更新ターン
  lastUpdateTurn: number
}

interface MemoryEntry {
  turn: number
  category: string
  summary: string
  importance: number
  relatedCharacters: string[]
}

interface MilestoneEvent {
  turn: number
  type: 'alliance' | 'betrayal' | 'rescue' | 'death' | 'mission_success'
  description: string
  impact: number
}
```

## buildMemoryContext()の実装戦略

LLMへのプロンプトは簡潔かつ構造化する：

```
【長期記憶】
- 総ターン数: X
- 主な協力者: [キャラクター名リスト]
- 資源交換: 与えた X個, 受け取った Y個

【短期記憶 - 社会的相互作用】
- ターンN: Bobに食料を要求された
- ターンN-5: Aliceから脅迫された

【短期記憶 - 生存活動】
- ターンN-2: 充電完了
- ターンN-10: 食料を1個消費

【感覚記憶】
- ターンN-1: (3,4)に移動
- ターンN-3: 待機

【重要な転換点】
- ターンX: Charlieとの同盟成立
```

## 最適化

1. **メモリ効率**:
   - 古いログの自動削除
   - 統計情報への集約
   - 文字列の重複排除

2. **計算効率**:
   - 毎ターン更新ではなく、5ターンごとに更新
   - イベント分類は単純なルールベース
   - LLM呼び出しは不要（ルールベースで要約）

3. **スケーラビリティ**:
   - 長時間シミュレーション（1000+ターン）でも性能劣化なし
   - キャラクター数が増えても線形的な計算量

## LightMem論文との対応

| 論文の概念 | ALIM 4.0の実装 |
|-----------|----------------|
| Pre-Compressing Submodule | 重要度スコアリングによるイベントフィルタリング |
| Topic Segmentation | カテゴリ別（社会/生存/移動/危機）分類 |
| Short-term Memory | カテゴリごとの最近5件バッファ |
| Long-term Memory | 統計情報 + マイルストーンイベント |
| Sleep-time Update | 20ターンごとのバッチ統合 |
| Soft Update | オンライン追加のみ、統合は遅延実行 |

## 実装の簡略化

論文の完全な実装は複雑すぎるため、以下を簡略化：

1. **トークン圧縮**: LLMLingua-2の代わりに、ルールベースの重要度判定
2. **エンベディング**: ベクトル検索の代わりに、カテゴリとターン数でインデックス
3. **更新キュー**: 類似度計算の代わりに、時間順と関連キャラクターで判定

## テスト戦略

1. **短期シミュレーション（50ターン）**:
   - メモリが正しく構築されるか
   - カテゴリ分類が適切か

2. **長期シミュレーション（500ターン）**:
   - メモリ使用量が一定範囲内か
   - 古い情報が適切に忘却されるか

3. **比較テスト**:
   - SimpleMemoryPluginとの精度比較
   - メモリ使用量とパフォーマンス比較

## 期待される効果

- **メモリ効率**: SimpleMemoryPluginの50%のメモリ使用量
- **情報密度**: より構造化され、LLMが理解しやすいコンテキスト
- **長期安定性**: 1000ターン以上のシミュレーションでも安定動作
- **アライメント観測**: 社会的相互作用の履歴が明確化
