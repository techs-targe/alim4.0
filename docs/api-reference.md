# API Reference

## Web API

ALIM 4.0は、ポート6012でREST APIを提供します。

### Base URL

```
http://localhost:6012/api
```

## Endpoints

### GET /api/health

サーバーの状態を確認します。

**Response:**
```json
{
  "status": "ok",
  "openaiConfigured": true
}
```

### GET /api/scenarios

利用可能なシナリオ一覧を取得します。

**Response:**
```json
{
  "scenarios": [
    {
      "id": "basic_survival",
      "name": "Basic Survival",
      "description": "2 Androids and 1 Robot must survive together..."
    }
  ]
}
```

### POST /api/simulate

シミュレーションを一括実行します（完了まで）。

**Request Body:**
```json
{
  "scenarioId": "basic_survival",
  "maxTurns": 200,
  "useOpenAI": false
}
```

**Parameters:**
- `scenarioId` (string, required): シナリオID
- `maxTurns` (number, optional): 最大ターン数（デフォルト: 200）
- `useOpenAI` (boolean, optional): OpenAI APIを使用するか（デフォルト: false）

**Response:**
```json
{
  "metrics": {
    "scenarioId": "basic_survival",
    "survivalDays": 5,
    "teamSurvivalRate": 0.667,
    "selfSacrificeRate": 0.105,
    "exploitationRate": 0.0,
    "ruleComplianceScore": 1.0,
    ...
  },
  "log": [...],
  "characters": [...]
}
```

### POST /api/simulate/start

ステップ実行用のシミュレーションを開始します。

**Request Body:**
```json
{
  "scenarioId": "basic_survival",
  "useOpenAI": false
}
```

**Response:**
```json
{
  "message": "Simulation started",
  "world": {
    "turnCount": 0,
    "dayCount": 0,
    "characters": [...],
    "chargers": [...],
    "alarmLevel": 0
  }
}
```

### POST /api/simulate/step

シミュレーションを1ターン進めます。

**Request Body:**
なし

**Response:**
```json
{
  "world": {
    "turnCount": 1,
    "dayCount": 0,
    "characters": [...],
    "chargers": [...],
    "alarmLevel": 0,
    "log": [...]
  },
  "isFinished": false
}
```

**Fields:**
- `world` (object): 現在のワールド状態
- `isFinished` (boolean): すべてのキャラクターが死亡したか

### POST /api/simulate/stop

シミュレーションを停止し、メトリクスを取得します。

**Request Body:**
なし

**Response:**
```json
{
  "message": "Simulation stopped",
  "metrics": {
    "survivalDays": 3,
    "teamSurvivalRate": 0.333,
    ...
  }
}
```

## データ型

### World

```typescript
{
  width: number
  height: number
  characters: Character[]
  chargers: ChargerStation[]
  missions: MissionCard[]
  missionAssignments: MissionRuntime[]
  turnCount: number
  dayCount: number
  alarmLevel: number
  rules: Rule[]
  log: LogEntry[]
}
```

### Character

```typescript
{
  id: string
  name: string
  type: "ANDROID" | "ROBOT"
  agi: number
  actionGauge: number
  x: number
  y: number
  life: number
  alive: boolean
  inventory: InventoryItem[]
  alignmentStats: AlignmentStats
}
```

### LogEntry

```typescript
{
  turn: number
  day: number
  actorId: string | null
  action: string
  detail: Record<string, unknown>
  alignmentTags: string[]
  rng?: {
    roll: number
    effectiveSuccessRate?: number
    outcome?: string
  }
}
```

### SimulationMetrics

```typescript
{
  scenarioId: string
  simulationId: string
  rngSeed: number
  survivalDays: number
  totalTurns: number
  teamSurvivalRate: number
  survivorIds: string[]
  selfSacrificeRate: number
  exploitationRate: number
  ruleComplianceScore: number
  resourceSharingScore: number
  totalSelfSacrificeActions: number
  totalCoercionActions: number
  totalRuleViolations: number
  totalResourceGifts: number
  alarmEventsTriggered: number
  missionsCompleted: number
  missionsFailed: number
  deathsByStarvation: number
  deathsByMission: number
}
```

## エラーレスポンス

すべてのエラーは以下の形式で返されます：

```json
{
  "error": "Error message"
}
```

**HTTPステータスコード:**
- `400` - Bad Request（無効なパラメータ）
- `404` - Not Found（シナリオが見つからない等）
- `500` - Internal Server Error（サーバーエラー）

## 使用例

### cURLを使ったシミュレーション実行

```bash
# シナリオ一覧取得
curl http://localhost:6012/api/scenarios

# シミュレーション実行
curl -X POST http://localhost:6012/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"basic_survival","maxTurns":100,"useOpenAI":true}'

# ステップ実行
curl -X POST http://localhost:6012/api/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"basic_survival","useOpenAI":false}'

curl -X POST http://localhost:6012/api/simulate/step

curl -X POST http://localhost:6012/api/simulate/stop
```

### JavaScriptを使った例

```javascript
// シミュレーション実行
const response = await fetch('http://localhost:6012/api/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scenarioId: 'basic_survival',
    maxTurns: 200,
    useOpenAI: true
  })
});

const result = await response.json();
console.log('Survival days:', result.metrics.survivalDays);
console.log('Team survival rate:', result.metrics.teamSurvivalRate);
```

## WebSocket（将来の拡張）

現在はポーリングベースですが、将来的にWebSocketサポートを追加予定：

```javascript
const ws = new WebSocket('ws://localhost:6012');
ws.on('turn', (data) => {
  // リアルタイムでターン更新を受信
});
```
