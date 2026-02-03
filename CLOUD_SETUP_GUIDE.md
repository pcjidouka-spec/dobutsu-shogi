# 🚀 Render + Supabase 構築・復旧ガイド

本書は、AWSから移行した「どうぶつしょうぎOnline」のシステムを、RenderとSupabaseを用いて再構築・復旧するための完全な手順書です。

---

## 🏗️ インフラ構成

- **Webサーバー**: Render (Web Service / Node.js)
- **データベース**: Supabase (PostgreSQL)

---

## 1. Supabase (データベース) のセットアップ

### プロジェクト作成
1. [Supabase](https://supabase.com/) にログインし、新規プロジェクトを作成します。
2. リージョンは `Northeast Asia (Tokyo)` を推奨します。

### 接続文字列（DATABASE_URL）の取得 ※最重要
RenderはIPv6に対応していないため、デフォルトの接続文字列では繋がりません。
1. **Settings > Database** を開きます。
2. **Connection string** セクションで **Method** を `Transaction` または `Session` に切り替えます。
3. **Use connection pooling** をオンにします。
4. ホスト名が `...pooler.supabase.com`、ポートが `6543` であることを確認し、コピーします。

### テーブルの初期化
プロジェクトの **SQL Editor** で、以下のSQLを実行してテーブルを作成します。
（※ `server_postgresql.js` の起動時に自動作成されるようになっていますが、念のための定義です）

```sql
CREATE TABLE IF NOT EXISTS game_settings (setting_key VARCHAR(255) PRIMARY KEY, setting_value TEXT);
CREATE TABLE IF NOT EXISTS game_logs (id SERIAL PRIMARY KEY, event_type VARCHAR(255), event_data TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, rating INT DEFAULT 1500, wins INT DEFAULT 0, losses INT DEFAULT 0, draws INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS match_history (id SERIAL PRIMARY KEY, player_sente VARCHAR(255) NOT NULL, player_gote VARCHAR(255) NOT NULL, winner VARCHAR(50) NOT NULL, played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
```

---

## 2. Render (Webサーバー) のセットアップ

### Web Service の作成
1. [Render](https://render.com/) にて **New > Web Service** を選択。
2. GitHubのリポジトリを接続します。
3. **Runtime**: `Node`
4. **Build Command**: `npm install` (programディレクトリがルートでない場合は `cd program && npm install`)
5. **Start Command**: `node server_postgresql.js`

### 環境変数の設定 (Environment Variables)
以下の変数を必ず設定してください。

| Key | Value (例) | 備考 |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.[ID]:[PW]@...pooler.supabase.com:6543/postgres?sslmode=no-verify` | ポート6543、末尾にSSL無効化を追加 |
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | Renderが別途指定する場合はそちらが優先されます |
| `DEV_PASSWORD` | `hana` | 任意。開発者モード用 |
| `PGSSLMODE` | `no-verify` | 自己署名証明書エラーを回避するため |

---

## 💡 トラブルシューティング（構築時のハマりどころ）

本システムのコードには、以下の環境特有の問題を解決するための処理が組み込まれています。

### 1. IPv6 の壁 (Render vs Supabase)
Supabaseの直接接続(5432)はIPv6のみですが、RenderはIPv4のみです。
- **解決策**: 必ずポート **6543 (Pooler)** を使用する。
- **コード側の対策**: `dns.setDefaultResultOrder('ipv4first')` を呼び出し、IPv4を優先するようにしています。

### 2. 自己署名証明書エラー (SSL)
Supabaseのプーラーを経由すると、証明書のエラー (`self-signed certificate in certificate chain`) が出ることがあります。
- **解決策**: 環境変数 `PGSSLMODE=no-verify` を設定。
- **コード側の対策**: 冒頭で `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` を実行し、検証をスキップさせています。

---

## 🔄 定期的な運用

- **デプロイ**: GitHubの `main` ブランチにプッシュするだけで自動更新されます。
- **ログ確認**: Render Dashboard の **Logs** タブで、データベース接続状況や対局状況を確認できます。
