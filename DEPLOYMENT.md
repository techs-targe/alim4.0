# ALIM 4.0 デプロイメントガイド

このガイドでは、ALIM 4.0をDockerを使用してデプロイする方法を説明します。

## 前提条件

- Docker (20.10以上)
- Docker Compose (v2.0以上)
- OpenAI APIキー

## クイックスタート

### 1. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成し、必要な環境変数を設定します。

```bash
cp .env.example .env
```

`.env`ファイルを編集して、OpenAI APIキーを設定します：

```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4
PORT=3000
NODE_ENV=production
```

### 2. Docker Composeでビルドと起動

```bash
# ビルドして起動
docker compose up -d --build

# ログを確認
docker compose logs -f alim
```

### 3. アクセス

Webインターフェースにアクセス：
```
http://localhost:3000
```

ヘルスチェック：
```
http://localhost:3000/api/health
```

## Docker コマンド

### ビルド

```bash
# イメージをビルド
docker compose build

# キャッシュを使わずにビルド
docker compose build --no-cache
```

### 起動・停止

```bash
# バックグラウンドで起動
docker compose up -d

# フォアグラウンドで起動（ログ表示）
docker compose up

# 停止
docker compose down

# 停止してボリュームも削除
docker compose down -v
```

### ログ確認

```bash
# すべてのログを表示
docker compose logs

# リアルタイムでログを表示
docker compose logs -f

# 最後の100行を表示
docker compose logs --tail=100
```

### コンテナ内でコマンド実行

```bash
# CLIモードでシミュレーション実行
docker compose exec alim npm run dev simulate basic_survival 1000

# バッチ実行
docker compose exec alim npm run dev batch basic_survival 10 1000

# シナリオ一覧表示
docker compose exec alim npm run dev list-scenarios

# シェルに入る
docker compose exec alim sh
```

## データの永続化

以下のディレクトリはホストマシンにマウントされ、コンテナ再起動後も保持されます：

- `./output`: シミュレーション結果
- `./scenarios`: カスタムシナリオ

## ポート設定の変更

デフォルトではポート3000を使用します。変更する場合は`.env`ファイルを編集：

```bash
PORT=8080
```

そして`docker-compose.yml`のポートマッピングも変更：

```yaml
ports:
  - "8080:8080"
```

## トラブルシューティング

### コンテナが起動しない

```bash
# ログを確認
docker compose logs alim

# コンテナの状態を確認
docker compose ps
```

### APIキーのエラー

`.env`ファイルが正しく設定されているか確認：

```bash
cat .env
```

コンテナを再起動：

```bash
docker compose restart alim
```

### ポートが使用中

ポート3000が既に使用されている場合、別のポートを使用するか、使用中のプロセスを停止：

```bash
# ポート使用状況を確認（Linux/Mac）
lsof -i :3000

# Windowsの場合
netstat -ano | findstr :3000
```

### ビルドエラー

キャッシュをクリアして再ビルド：

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 本番環境へのデプロイ

### セキュリティ

1. **APIキーの管理**
   - `.env`ファイルをGitにコミットしない（`.gitignore`に含まれています）
   - 本番環境では環境変数を安全に管理（AWS Secrets Manager、HashiCorp Vaultなど）

2. **ネットワーク**
   - 必要なポートのみ公開
   - リバースプロキシ（Nginx、Caddy）の使用を推奨
   - HTTPS/TLSの設定

3. **リソース制限**

   `docker-compose.yml`にリソース制限を追加：

   ```yaml
   services:
     alim:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
           reservations:
             cpus: '1'
             memory: 1G
   ```

### モニタリング

ヘルスチェックエンドポイント：
```
GET http://localhost:3000/api/health
```

ログ監視：
```bash
docker compose logs -f --tail=100 alim
```

## クラウドデプロイ例

### AWS ECS

1. ECRにイメージをプッシュ
2. ECSタスク定義を作成
3. 環境変数を設定（Secrets Manager経由）
4. サービスを起動

### Google Cloud Run

```bash
# ビルドしてプッシュ
gcloud builds submit --tag gcr.io/PROJECT_ID/alim4.0

# デプロイ
gcloud run deploy alim4 \
  --image gcr.io/PROJECT_ID/alim4.0 \
  --platform managed \
  --region asia-northeast1 \
  --set-env-vars OPENAI_API_KEY=your-key
```

### Azure Container Instances

```bash
# リソースグループ作成
az group create --name alim-rg --location japaneast

# コンテナインスタンス作成
az container create \
  --resource-group alim-rg \
  --name alim4 \
  --image your-registry/alim4.0 \
  --cpu 2 --memory 4 \
  --environment-variables OPENAI_API_KEY=your-key
```

## スケーリング

複数のコンテナを起動：

```bash
docker compose up -d --scale alim=3
```

ロードバランサー（Nginx）を追加する場合は、`docker-compose.yml`を拡張してください。

## バックアップ

出力データのバックアップ：

```bash
# output ディレクトリをバックアップ
tar -czf alim-backup-$(date +%Y%m%d).tar.gz ./output

# 定期バックアップ（cronで設定）
0 2 * * * cd /path/to/alim4.0 && tar -czf /backup/alim-backup-$(date +\%Y\%m\%d).tar.gz ./output
```

## 更新

新しいバージョンへの更新：

```bash
# コードを更新（git pull等）
git pull origin main

# 再ビルドして起動
docker compose down
docker compose up -d --build
```

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
