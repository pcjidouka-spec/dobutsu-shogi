# dobutsu-shogi — どうぶつしょうぎ Online (アプリ本体)

ブラウザでリアルタイムに対局・観戦できるオンライン版「どうぶつしょうぎ」。
Node.js + Express + WebSocket (`ws`)。思考エンジン (Minimax / Monte Carlo) を自作している。
本番は **Render** (アプリ) + **Supabase / PostgreSQL** (データ)。
公開 URL: https://dobutsu-shogi.onrender.com/ (無料プランのため無アクセスでスリープする)
**このファイルが AI エージェント向け指示の正本**で、Claude Code も Codex も同じものを読む
(`CLAUDE.md` は `@AGENTS.md` で取り込んでいる)。

★**このリポジトリは beads を使わない。**issue は親ディレクトリ側のリポジトリで管理する。

## ★このリポジトリの位置づけ (最初に読むこと)

★**ここは親ディレクトリとは別の独立した git リポジトリ**である。

```
<親ディレクトリ>/         ← 別リポジトリ。ドキュメントだけを持つ
└── program/             ← ★ここ。アプリの実装全部。独立した git リポジトリ
```

- ★**親の `AGENTS.md` / `CLAUDE.md` はこのディレクトリでは読み込まれない**
  (エージェントは git リポジトリのルートまでしか遡らない。実測で確認済み)。
  だからこのファイルが要る
- ★**手順書・移行の経緯・デプロイ手順は親側にある。**
  `../CLOUD_SETUP_GUIDE.md` / `../MIGRATION_PLAN.md` / `../デプロイ手順.txt` /
  `../GIT_USAGE.md`。★ただし同名の文書が**このリポジトリにもあり内容が食い違う**
  (`MIGRATION_PLAN.md` / `CLOUD_SETUP_GUIDE.md` は md5 不一致)。**参照時は両方を確認する**
- ★**コミットはこのディレクトリで行う。**親で `git status` を見てもここの変更は出ない

## ディレクトリ構造

```
server.js              本番のサーバ (926 行)。Express の静的配信 + REST API + ws のリレー
server_postgresql.js   ★2 行の転送シム (require('./server.js'))。
                       Render の Start Command がこの名前を参照しているためだけに存在する。
                       ★DB 関連も含め実装は server.js にある。ここを編集しない
script.js              クライアント側のロジックと思考エンジン (3020 行)
index.html             エントリ
style.css              スタイル
hana/                  別バージョンの画面 (index.html / menu.html / Info.html / style.css / css/ / images/)
developmode/           開発用コンソール (console.html)。`/api/*` を叩く管理画面
db_schema.mmd          DB スキーマ (Mermaid)。db_diagram.html / system_diagrams.html は図の HTML 版
(.github/workflows/ は 2026-09-10 に削除。下の「デプロイの実態」を読む)
package.json           npm start = node server.js / engines node >= 18
```

★**ビルド工程が無い。**`index.html` / `script.js` / `style.css` は `express.static(__dirname)` が
そのまま配信する。**バンドラもトランスパイラも通らない**ので、書いたものがそのまま本番のブラウザで動く。

## アーキテクチャ

```
ブラウザ ──HTTP──> Express (静的配信 + /api/*) ──> PostgreSQL (Supabase, pg プール)
   |
   +────ws────> WebSocket.Server (同一 HTTP サーバに相乗り) ──> rooms: Map<roomId, room>
   |
   +── 思考エンジン (Minimax / Monte Carlo) は ★ブラウザ側 (script.js) で動く
```

- ★**AI はサーバに無い。**`server.js` に minimax / montecarlo の実装は 1 行も無く、
  探索はすべてクライアント (`script.js`) で回る。既定値は minimax = 深さ 3、
  Monte Carlo = 1000 プレイアウト。**AI を直すなら `script.js`**
- **対局状態はサーバのメモリ上の `rooms` (Map)** に持つ。★プロセスを再起動すると進行中の対局は消える。
  Render の無料プランはスリープするため、これは日常的に起きる
- ws のメッセージ種別は `join` / `move` / `drop` / `rematch` の 4 つ (`server.js` の `switch`)
- REST API は `/api/verify-password` 以外すべて `requireAuth` を通る。
  認証は**リクエストヘッダ `x-dev-password` と環境変数 `DEV_PASSWORD` の一致だけ** (セッションもトークンも無い)
- テーブルは起動時の `initDB()` が `CREATE TABLE IF NOT EXISTS` で作る:
  `game_settings` / `game_logs` / `users` / `match_history`。★マイグレーションの仕組みは無い

## ビルド・実行

```bash
npm install
npm start          # = node server.js。既定 PORT=3000、.env の DATABASE_URL が要る
```

★**テストは存在しない** (`package.json` の `scripts` は `start` のみ)。
テストを足す場合は別の作業として扱う。
壊れていないことの最低限の確認は構文チェックで行う (`.migration-test.txt` にも記載):

```bash
node --check server.js && node --check script.js && node --check server_postgresql.js
# 移行前ベースライン (2026-09-10): exit 0 / 約 0.5 秒 (node v25.8.2)
```

## デプロイの実態 (★食い違いがあるので注意)

- **本番は Render の GitHub 連携**。`main` に push すると Render が自動でビルド・再起動する
  (手順は親の `../デプロイ手順.txt`)
- ★**GitHub Actions は無い。**`.github/workflows/deploy.yml` (AWS EC2 時代の残骸) は
  **2026-09-10 に人間の判断で削除した**。`main` への push のたびに起動して毎回失敗し
  (直近 5 回すべて failure・EC2 の secrets がもう無い)、CI の赤が常態化していたため。
  ★**本番には影響していなかった** — Render のデプロイは GitHub 連携という別経路で走る。
  ★EC2 に戻すことになったら、この履歴から復元する: `git log --diff-filter=D -- .github/workflows/deploy.yml`

## AI エージェントが変更してはいけないもの

- ★`node_modules/` に手を入れない
- ★`server_postgresql.js` (転送シム)。名前も中身も変えると Render の起動が壊れる
- ★`.env` (git 管理外)。値を書き換えると本番 DB への接続が壊れる。追加する変数は `.env.example` に例だけ書く
- 本番接続情報 (Supabase の URL / キー) は `.env` から読む。**コードに直書きしない**

## 既知の課題 (直す前に人間に確認する)

- ★**`server.js` 冒頭の `NODE_TLS_REJECT_UNAUTHORIZED = '0'`** (★[issue #1](https://github.com/pcjidouka-spec/dobutsu-shogi/issues/1))。
  ★これは Supabase 接続だけでなく**プロセス全体**の TLS 証明書検証を無効にする。
  つまり外部 API 呼び出しを足したとき、そちらの検証も黙って無効になる。
  直し方は決まっている (pg Pool に `ssl: { rejectUnauthorized: false }` を渡し、
  この行を消す) が、★**実際に Render で接続が続くか確認が要るので独立した作業にする。**
  ★**ついでに直さない。**
- ★`/api/sql` (任意 SQL 実行) は **2026-09-10 に削除済み**。★**再追加しない。**
  DB を直接見たいときは Supabase のコンソールを使う
- ★認証は `x-dev-password` ヘッダと `DEV_PASSWORD` の一致だけ (セッションもトークンも無い)。
  ★**この認証だけを頼りに、破壊的な操作ができるエンドポイントを増やさない。**

## セキュリティ上の禁止事項

- 秘密情報 (Supabase のキー・DB のパスワード) をこのファイル・`CLAUDE.md`・
  ソースコードに書かない。`.env` か Render の環境変数に置く
- `*.pem` / `*.key` / `*token*` / `*password*` / `*api_key*` という名前を使わない
  (夜間バックアップの除外パターンに一致して失われるため。
  理由と詳細はユーザー共通ルール側の「バックアップの前提」にある)

## Codex 固有

- ファイル操作は必ず非対話フラグで (`cp -f` / `rm -rf` / `apt-get -y`)
- ページャを起動しない (`git --no-pager` / `PAGER=cat`)

## 詳細ドキュメント

- AI モデルの解説: `AI_MODEL_EXPLANATION.md`
- 教育向けコンテンツ計画: `EDUCATIONAL_CONTENT_PLAN.md`
- 構築・復旧、移行の経緯、デプロイ手順: ★親ディレクトリ側 (上記「位置づけ」参照)
