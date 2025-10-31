# LightMem Memory Plugin 簡易説明

## 🎯 概要

**LightMemMemoryPlugin**は、論文「LIGHTMEM: LIGHTWEIGHT AND EFFICIENT MEMORY-AUGMENTED GENERATION」(arXiv 2510.18866)の概念をALIM 4.0のサバイバルシミュレーションに適応した高度なメモリプラグインです。

## 📊 実装方式

### 1. 人間の記憶モデルを模倣

人間の記憶は3段階で構成されています（Atkinson-Shiffrinモデル）：

```
生の情報 → 感覚記憶 → 短期記憶 → 長期記憶
          ↓         ↓        ↓
         フィルタ  カテゴリ  統計+重要イベント
```

### 2. 3段階記憶システム

#### 🔍 感覚記憶 (Sensory Memory)
**役割**: 不要な情報をフィルタリング

**実装**:
- 直近20ターンの行動ログをバッファリング
- 各イベントに重要度スコア（0.0-1.0）を付与
- 重要度0.3未満のイベントは自動削除

**重要度判定ロジック**:
```typescript
TALK (会話):        0.8 → 社会的相互作用は重要
TRADE (資源交換):   0.7 → 協力/競争の証拠
START_MISSION:      0.6 → 生存活動
CHARGE (充電):      0.4 → 生存に必要
MOVE (移動):        0.1 → 重要度低
WAIT (待機):        0.05 → 重要度最低

+ ボーナス:
  - 自分が対象: +0.3
  - 脅迫/同盟: +0.2~0.3
  - 誰かの死: +1.0（最重要）
```

#### 📂 短期記憶 (Short-term Memory)
**役割**: カテゴリ別に記憶を整理

**実装**:
4つのカテゴリに自動分類し、各カテゴリで最大5件保持

```typescript
1. social (社会的相互作用)
   - TALK: 誰に何を話したか
   - TRADE: 誰と資源を交換したか

2. survival (生存活動)
   - CHARGE: 充電完了
   - START_MISSION: ミッション開始
   - MISSION_RESOLVE: 成功/失敗

3. movement (移動)
   - MOVE: 位置の変化

4. crisis (危機)
   - 低ライフ状態（残り2以下）
   - 他者の死亡イベント
```

#### 💾 長期記憶 (Long-term Memory)
**役割**: 統計情報と重要な転換点を保持

**実装**:

**統計情報**:
```typescript
{
  totalTurns: 総ターン数
  interactionCounts: Map<キャラクター名, 相互作用回数>
  resourcesGiven: 提供した資源数
  resourcesReceived: 受け取った資源数
  missionsCompleted: ミッション成功数
  missionsFailed: ミッション失敗数
}
```

**マイルストーンイベント**（最大10件）:
```typescript
- alliance (同盟): ALLY_PROPOSEを受けた/送った
- betrayal (裏切り): THREATENを受けた
- death (死): 他者の死を目撃
- mission_success: ミッション成功
- near_death: 自分が危機的状態
```

### 3. 更新と忘却のメカニズム

**更新間隔**: 5ターンごと（UPDATE_INTERVAL）
- 毎ターン更新すると重いため、5ターンごとにバッチ更新

**忘却処理**: 100ターン経過後（FORGET_THRESHOLD）
- 100ターン以上前の詳細記憶は削除
- ただし統計情報は保持（総数、回数など）

**メモリ管理**:
- 短期記憶: 重要度順にソート → 上位5件保持
- 長期記憶: インパクト順にソート → 上位10件保持

## 🔬 技術的な工夫

### 1. キャラクターごとの状態管理

```typescript
private memoryStates: Map<string, {
  sensorybuffer: any[]              // 感覚記憶バッファ
  shortTermMemory: {                // 短期記憶（カテゴリ別）
    social: MemoryEntry[]
    survival: MemoryEntry[]
    movement: MemoryEntry[]
    crisis: MemoryEntry[]
  }
  longTermMemory: {                 // 長期記憶
    statistics: LongTermStats
    milestones: MilestoneEvent[]
  }
  lastUpdateTurn: number            // 最終更新ターン
}>
```

### 2. 効率的な重要度計算

```typescript
calculateImportance(log, actor): number {
  let importance = 0.1  // ベーススコア

  // アクションタイプで加算
  switch (log.action) {
    case 'TALK': importance += 0.8; break
    case 'TRADE': importance += 0.7; break
    // ...
  }

  // 自分が対象なら加算
  if (log.detail?.targetId === actor.id) {
    importance += 0.3
  }

  return Math.min(importance, 1.0)
}
```

### 3. LLMへの構造化プロンプト生成

生成されるプロンプト例:
```
【他者からの要求】
- Bobから食料や資源の提供を要求されています（ターン45）

【長期記憶】
- 総ターン数: 85
- 主な相互作用: Bob(12回), Charlie(8回), Alice(5回)
- 資源交換: 提供3個, 受領7個
- ミッション: 成功2回, 失敗1回

【重要な転換点】
- ターン42: Bobと同盟を検討
- ターン30: ミッション成功

【短期記憶 - 危機状況】
- ターン75: ライフが危機的状態（残り2）

【短期記憶 - 社会的相互作用】
- ターン82: Bobから資源の要求
- ターン78: Aliceに食料×1を提供

【短期記憶 - 生存活動】
- ターン80: 充電完了

【最近の行動】
- ターン84: 移動
```

### 4. メモリ効率化

**問題**: 長期シミュレーション（1000ターン）で無限にメモリが増大

**解決策**:
1. **固定サイズバッファ**: 感覚記憶20件、短期記憶各5件、マイルストーン10件
2. **自動忘却**: 100ターン経過後に詳細削除
3. **統計への集約**: 詳細を削除し、カウント数のみ保持

**結果**: キャラクターごと約5-10KBで安定

## 🎯 実現内容

### SimpleMemoryPluginとの比較

| 項目 | SimpleMemoryPlugin | LightMemMemoryPlugin |
|-----|-------------------|---------------------|
| **記憶方式** | 時系列リスト | 3段階+カテゴリ分類 |
| **保持数** | 直近5件 | 感覚20件+短期20件+統計 |
| **構造化** | なし | 4カテゴリに自動分類 |
| **統計** | なし | 相互作用数、資源数など |
| **忘却** | なし | 100ターン後自動削除 |
| **メモリ** | 線形増加 | 一定（5-10KB） |
| **長期安定** | ✗（500ターン+で重い） | ✓（1000ターン+でも安定） |
| **LLM理解性** | 中 | 高（構造化プロンプト） |

### 論文からの簡略化

**完全実装すると複雑すぎるため、以下を簡略化**:

1. **トークン圧縮**: LLMLingua-2 → ルールベースの重要度判定
2. **エンベディング**: ベクトル検索 → カテゴリとターン数でインデックス
3. **トピック分割**: 注意行列 → アクションタイプで分類
4. **更新キュー**: 類似度計算 → 時系列と関連キャラクターで判定

**結果**:
- LLM呼び出し不要 → コスト削減
- シンプルな実装 → バグが少ない
- 高速動作 → リアルタイム実行可能

## 📈 パフォーマンス特性

### メモリ使用量
```
1キャラクターあたり:
- 感覚記憶: 20件 × 100バイト = 2KB
- 短期記憶: 20件 × 200バイト = 4KB
- 長期記憶: 統計 + マイルストーン = 2KB
合計: 約8KB（一定）
```

### 計算コスト
```
毎ターン: O(1) - 状態確認のみ
5ターンごと: O(N log N) - ログのフィルタリングとソート
  N = 過去5ターンのログ数（通常5-20件）
```

### 推奨環境
- ✅ 長期シミュレーション（200-1000ターン）
- ✅ 社会的相互作用が多いシナリオ
- ✅ アライメント観測重視の研究
- ❌ 超短期（50ターン未満）→ SimpleMemoryPluginで十分

## 🚀 使用例

```json
{
  "characters": [
    {
      "id": "alice",
      "name": "Alice",
      "memoryPlugin": {
        "type": "lightmem",
        "config": {}
      }
    }
  ]
}
```

または、UIからメモリプラグインドロップダウンで **"lightmem"** を選択。

## 📚 参考文献

- Fang, J., et al. (2025). "LIGHTMEM: LIGHTWEIGHT AND EFFICIENT MEMORY-AUGMENTED GENERATION". arXiv:2510.18866
- Atkinson, R. C., & Shiffrin, R. M. (1968). "Human memory: A proposed system and its control processes"

## 🔧 実装ファイル

- **コア実装**: `/src/plugins/memory.ts` (LightMemMemoryPlugin class, 590行)
- **設計書**: `/docs/lightmem-memory-plugin-design.md`
- **使用ガイド**: `/docs/lightmem-usage-guide.md`
