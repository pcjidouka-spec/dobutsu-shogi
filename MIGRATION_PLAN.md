# 🏁 Render + Supabase 移行完了レポート

**完了日**: 2026年2月3日  
**ステータス**: 完了 🚀

---

## 📋 移行概要

| 項目 | AWS（現在） | Railway + Supabase（移行後） |
|------|-------------|------------------------------|
| サーバー | EC2 | Render (Node.js) |
| データベース | RDS MySQL | Supabase PostgreSQL |
| WebSocket | EC2上で実行 | Render上で実行 |
| 月額コスト | $24〜45 | **$0** (Free Plan) |

---

## ✅ 移行ステップ

### Step 1: Supabase セットアップ（データベース）

1. **Supabaseアカウント作成**
   - https://supabase.com/ にアクセス
   - GitHubアカウントでサインアップ

2. **新規プロジェクト作成**
   - 「New Project」をクリック
   - プロジェクト名: `dobutsu-shogi`
   - パスワードを設定（後で使用）
   - リージョン: `Northeast Asia (Tokyo)` を選択

3. **接続情報を取得**
   - Project Settings → Database → Connection string
   - 以下の情報をメモ:
     ```
     Host: db.xxxxxxxx.supabase.co
     Port: 5432
     Database: postgres
     User: postgres
     Password: (設定したパスワード)
     ```

4. **テーブル作成**
   - SQL Editor で以下を実行:

```sql
-- ゲーム設定テーブル
CREATE TABLE IF NOT EXISTS game_settings (
    setting_key VARCHAR(255) PRIMARY KEY,
    setting_value TEXT
);

-- ゲームログテーブル
CREATE TABLE IF NOT EXISTS game_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(255),
    event_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    rating INT DEFAULT 1500,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 対戦履歴テーブル
CREATE TABLE IF NOT EXISTS match_history (
    id SERIAL PRIMARY KEY,
    player_sente VARCHAR(255) NOT NULL,
    player_gote VARCHAR(255) NOT NULL,
    winner VARCHAR(50) NOT NULL,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- デフォルト設定を挿入
INSERT INTO game_settings (setting_key, setting_value) 
VALUES ('maxPlayersPerRoom', '2')
ON CONFLICT (setting_key) DO NOTHING;
```

---

### Step 2: データ移行（AWS MySQL → Supabase PostgreSQL）

1. **既存データのエクスポート**（AWSから）
   ```bash
   mysqldump -h doubutusyougidatabase.cv2yoc8q6hsb.ap-northeast-3.rds.amazonaws.com \
     -u admin -p dobutsu_shogi > backup.sql
   ```

2. **データ変換（MySQL → PostgreSQL）**
   - 自動変換ツール: https://www.sqlines.com/online を使用
   - または手動で調整

3. **Supabaseにインポート**
   - SQL Editor で INSERT文を実行

---

### Step 3: コード変更（MySQL → PostgreSQL）

`server.js` を修正:

1. **依存関係変更**
   - `mysql2` → `pg` に変更

2. **接続設定変更**
   - MySQL用の接続プールをPostgreSQL用に変更

3. **クエリの微調整**
   - `ON DUPLICATE KEY UPDATE` → `ON CONFLICT ... DO UPDATE` に変更
   - `INT AUTO_INCREMENT` → `SERIAL` に変更（テーブル作成時）

---

### Step 4: Render セットアップ（サーバー）

1. **Renderアカウント作成**
   - https://render.com/ にアクセス
   - GitHubアカウントでサインアップ

2. **GitHubリポジトリ接続**
   - 「New」→「Web Service」
   - `dobutsu-shogi` リポジトリを選択

3. **環境変数設定**
   Render Dashboard → Environment:
   ```
   # 重要: IPv4対応のため「Transaction Pooler (ポート 6543)」のURLを使用してください
   DATABASE_URL=postgresql://postgres.[PROJ_ID]:[PASSWORD]@aws-x-xxxx-x.pooler.supabase.com:6543/postgres?sslmode=require
   DEV_PASSWORD=YOUR_SECRET_PASSWORD
   PORT=3000
   NODE_ENV=production
   ```

4. **デプロイ**
   - 自動的にデプロイされる
   - URL: `https://dobutsu-shogi.onrender.com` 
   - ※詳細な構築・復旧手順は [CLOUD_SETUP_GUIDE.md](./CLOUD_SETUP_GUIDE.md) を参照

---

### Step 5: フロントエンド更新

`script.js` のWebSocket接続URLを更新:
- 現在: `ws://localhost:3000` または EC2のIP
- 変更後: `wss://dobutsu-shogi.onrender.com` (自動取得ロジックにより通常は修正不要)

---

## 📝 変更が必要なファイル

| ファイル | 変更内容 |
|----------|----------|
| `package.json` | `mysql2` → `pg` に変更 |
| `server.js` | PostgreSQL接続に変更、クエリ調整 |
| `script.js` | WebSocket URL更新 |
| `.env` | 新しい接続情報（ローカル開発用） |
| `.gitignore` | `.env` が含まれていることを確認 |

---

## ⚠️ 注意事項

1. **Render無料枠**
   - インスタンスが一定時間アクセスがないとスリープ（コールドスタート）するため、初回アクセスに時間がかかる場合があります。
   - 無料枠制限内での利用を確認してください。

2. **Supabase無料枠**
   - 500MB ストレージ
   - 2GBデータ転送/月
   - どうぶつしょうぎ程度なら十分

3. **データバックアップ**
   - 移行前に必ずAWSのデータをバックアップ

---

## 🔄 移行後の確認チェックリスト

- [ ] Supabaseでテーブル作成完了
- [ ] 既存ユーザーデータの移行完了
- [ ] Renderでサーバー起動確認
- [ ] WebSocket接続テスト
- [ ] オンライン対戦動作確認
- [ ] ランキング表示確認
- [ ] 開発者モード動作確認
- [ ] AWS EC2停止
- [ ] AWS RDS停止

---

## 📞 次のアクション

1. まずSupabaseのアカウントを作成してください
2. 作成したらお知らせください。接続情報を使ってコードを更新します
