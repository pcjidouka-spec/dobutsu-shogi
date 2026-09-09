# dobutsu-shogi — どうぶつしょうぎ Online (アプリ本体)

ブラウザでリアルタイムに対局・観戦できるオンライン版「どうぶつしょうぎ」。
Node.js + Express + WebSocket (`ws`)。思考エンジン (Minimax / Monte Carlo) を自作している。
本番は **Render** (アプリ) + **Supabase / PostgreSQL** (データ)。
**このファイルが AI エージェント向け指示の正本**で、Claude Code も Codex も同じものを読む
(`CLAUDE.md` は `@AGENTS.md` で取り込んでいる)。

## ★このリポジトリの位置づけ (最初に読むこと)

★**ここは親ディレクトリとは別の独立した git リポジトリ**である。

```
C:\code\doubutusyougi\          ← 別リポジトリ。ドキュメントだけを持つ
└── program\                    ← ★ここ。アプリの実装全部。独立した git リポジトリ
```

- ★**親の `AGENTS.md` / `CLAUDE.md` はこのディレクトリでは読み込まれない**
  (エージェントは git リポジトリのルートまでしか遡らない。実測で確認済み)。
  だからこのファイルが要る
- ★**手順書・移行の経緯・デプロイ手順は親側にある。**
  `..\CLOUD_SETUP_GUIDE.md` / `..\MIGRATION_PLAN.md` / `..\デプロイ手順.txt` /
  `..\GIT_USAGE.md`。★ただし同名の文書が**このリポジトリにもあり内容が食い違う**
  (`MIGRATION_PLAN.md` / `CLOUD_SETUP_GUIDE.md` は md5 不一致)。**参照時は両方を確認する**
- ★**コミットはこのディレクトリで行う。**親で `git status` を見てもここの変更は出ない

## ディレクトリ構造

```
server.js              本番のサーバ (Express で静的配信 + 対局・観戦のリレー、ws)
server_postgresql.js   ★2 行の転送シム (require('./server.js'))。
                       Render の Start Command がこの名前を参照しているためだけに存在する。
                       ★DB 関連も含め実装は server.js にある。ここを編集しない
script.js              クライアント側のロジックと思考エンジン (Minimax / Monte Carlo)
index.html             エントリ
hana/                  別バージョンの画面 (css / images / index.html / Info.html)
developmode/           開発用コンソール (console.html)
db_schema.mmd          DB スキーマ (Mermaid)
package.json           npm start = node server.js / node >= 18
```

## ビルド・実行

```bash
npm install
npm start          # = node server.js
```

★**テストは存在しない** (`package.json` の `scripts` は `start` のみ)。
テストを足す場合は別の作業として扱う。

## AI エージェントが変更してはいけないもの

- ★`node_modules/` に手を入れない
- ★`server_postgresql.js` (転送シム)。名前も中身も変えると Render の起動が壊れる
- 本番接続情報 (Supabase の URL / キー) は `.env` から読む。**コードに直書きしない**

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
