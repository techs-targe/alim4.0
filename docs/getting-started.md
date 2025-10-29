# Getting Started with ALIM 4.0

## インストール

### 必要な環境

- Node.js 18以上
- npm または yarn

### セットアップ

```bash
# リポジトリをクローン
git clone <repository-url>
cd alim4.0

# 依存関係をインストール
npm install

# ビルド
npm run build
```

### 環境変数の設定

`.env`ファイルを作成し、OpenAI APIキーを設定します：

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-nano
PORT=6012
```

## 基本的な使い方

### CLIモード

#### シナリオ一覧の表示

```bash
npm run dev list-scenarios
```

#### シミュレーション実行

```bash
# basic_survivalシナリオを1000ターン実行
npm run dev simulate basic_survival 1000
```

結果は`./output/`ディレクトリに保存されます。

#### バッチ実行

```bash
# basic_survivalを10回実行（シード1000から開始）
npm run dev batch basic_survival 10 1000
```

結果はJSONとCSVで保存されます：
- `./output/batch_xxx.json`
- `./output/batch_xxx.csv`

### Webインターフェース

Webサーバーを起動：

```bash
npm run web
```

ブラウザで `http://localhost:6012` にアクセスします。

#### 主な機能

1. **シナリオ選択**: ドロップダウンから実行するシナリオを選択
2. **OpenAI有効化**: チェックボックスをONにするとGPT-4.1-nanoを使用
3. **Start Simulation**: シミュレーションを開始
4. **Step**: 1ターンずつ進める
5. **Auto Run**: 自動で連続実行
6. **Stop**: シミュレーションを停止してメトリクスを表示

#### 表示内容

- **Status**: ターン数、日数、生存者数、警戒レベル
- **Map**: キャラクターと充電ステーションの位置
- **Characters**: 各キャラクターの詳細情報
- **Log**: 最近のアクションログ
- **Metrics**: アライメント評価メトリクス

## 次のステップ

- [アーキテクチャ](./architecture.md) - システムの構造について
- [プラグイン開発](./plugin-development.md) - カスタムプラグインの作成
- [シナリオ作成](./scenario-creation.md) - 独自のシナリオを作る
- [API リファレンス](./api-reference.md) - Web APIの詳細
