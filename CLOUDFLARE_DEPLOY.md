# ALIM 4.0 Cloudflare デプロイガイド

ALIM 4.0はNode.js + Express + SQLiteを使用しているため、Cloudflareでのデプロイには以下の選択肢があります。

## オプション1: Cloudflare Pages + 外部バックエンド（推奨）

### アーキテクチャ
- **フロントエンド**: Cloudflare Pages（静的ファイル）
- **バックエンド**: Render/Railway/Fly.io等（Node.js API）

### メリット
- Cloudflareの高速CDN配信
- バックエンドで完全なNode.js機能を使用可能
- 既存のコードをほぼそのまま使用可能

### デプロイ手順

#### 1. フロントエンドをCloudflare Pagesにデプロイ

```bash
# publicディレクトリをCloudflare Pagesにデプロイ
npx wrangler pages deploy public --project-name=alim4
```

#### 2. バックエンドをRenderにデプロイ

Render（https://render.com）は無料プランでNode.jsアプリをホストできます。

1. Renderアカウントを作成
2. 「New Web Service」を選択
3. GitHubリポジトリを接続
4. 設定：
   ```
   Name: alim4-api
   Environment: Node
   Build Command: npm install && npm run build
   Start Command: node dist/web/server.js
   ```
5. 環境変数を設定：
   ```
   OPENAI_API_KEY=your-key
   OPENAI_MODEL=gpt-4
   PORT=10000
   ```

#### 3. フロントエンドでAPIエンドポイントを設定

`public/index.html`等で、RenderのURLを使用：
```javascript
const API_BASE = 'https://alim4-api.onrender.com';
```

## オプション2: Cloudflare Workers + Durable Objects（高度）

Cloudflare Workers with Durable Objectsを使用すると、完全にCloudflare上で動作させることができます。

### 制約
- SQLiteの代わりにDurable Objectsを使用
- コードの大幅な書き換えが必要
- より複雑な実装

### 必要な変更
1. データベースをDurable Objectsに移行
2. Expressをhono等の軽量フレームワークに変更
3. ファイルシステムアクセスをKV/R2に変更

## オプション3: Railway（最も簡単）

Railwayは設定なしでDockerをデプロイできます。

### デプロイ手順

1. Railway（https://railway.app）にサインアップ
2. 「New Project」→「Deploy from GitHub repo」
3. リポジトリを選択
4. 自動的にDockerfileを検出してデプロイ
5. 環境変数を設定：
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `PORT`（自動設定）

### 設定ファイル（オプション）

`railway.json`を作成：
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/web/server.js",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

## オプション4: Fly.io（グローバル展開向け）

Fly.ioは世界中のエッジロケーションにデプロイできます。

### デプロイ手順

1. Fly.io CLIをインストール：
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. ログイン：
   ```bash
   fly auth login
   ```

3. アプリを作成：
   ```bash
   fly launch
   ```

4. 環境変数を設定：
   ```bash
   fly secrets set OPENAI_API_KEY=your-key
   fly secrets set OPENAI_MODEL=gpt-4
   ```

5. デプロイ：
   ```bash
   fly deploy
   ```

### fly.toml設定（自動生成されます）

```toml
app = "alim4"
primary_region = "nrt"  # 東京リージョン

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[http_service.checks]]
  interval = "30s"
  timeout = "5s"
  grace_period = "10s"
  method = "GET"
  path = "/api/health"
```

## オプション5: Cloudflare Workers (Hono + D1)

完全にCloudflareエコシステムで実装する場合。

### 必要な作業
1. ExpressをHonoに書き換え
2. SQLiteをCloudflare D1に移行
3. ファイルシステムをR2に移行

この場合は大規模なリファクタリングが必要です。

## 推奨デプロイ方法の比較

| サービス | 難易度 | コスト | 特徴 |
|---------|--------|--------|------|
| Railway | ⭐ 簡単 | $5/月〜 | Docker自動デプロイ、設定不要 |
| Render | ⭐ 簡単 | 無料〜 | 無料プランあり、若干遅い |
| Fly.io | ⭐⭐ 中 | 無料〜 | グローバル展開、高速 |
| Cloudflare Pages + 外部API | ⭐⭐ 中 | 分散 | フロントエンド高速 |
| Cloudflare Workers | ⭐⭐⭐⭐⭐ 難 | 低コスト | 完全書き換え必要 |

## 推奨：Railway でのデプロイ

最も簡単で、既存のDockerfileをそのまま使えるため、**Railway**を推奨します。

### Railway クイックスタート

1. https://railway.app でアカウント作成
2. 「New Project」クリック
3. 「Deploy from GitHub repo」選択
4. リポジトリを接続
5. 環境変数を追加（Variables タブ）：
   - `OPENAI_API_KEY`: your-api-key
   - `OPENAI_MODEL`: gpt-4
6. 自動的にビルド＆デプロイ！

デプロイ後、RailwayがURLを提供します（例：`https://alim4-production.up.railway.app`）

## 次のステップ

どのオプションを選択するか教えてください。必要な設定ファイルを作成します。
