# 🔰 初心者向け：どうぶつしょうぎOnline 完全公開マニュアル

本マニュアルは、プログラミングやインフラの知識が全くない方でも、**「GitHub」「Render」「Supabase」**という仕組みを組み合わせて、自分の対戦サーバーを**完全無料**で公開するためのガイドです。

---

## 📋 このマニュアルでできること
- 自分のGitHubリポジトリにコードを保存し、更新する。
- データベース（Supabase）を無料で手に入れる。
- サーバー（Render）を無料で立ち上げ、世界中に公開する。
- **GitHub Pages**（静的サイト）と **Render**（動的なサーバー）の違いを理解し、使い分ける。

---

## 🛠️ ステップ 1：Git のインストールと準備

GitHubにコードをアップロードするためのツール「Git」を準備します。

1. **Gitのダウンロード**
   - [Git公式サイト](https://git-scm.com/) にアクセス。
   - Windowsの方は「Download for Windows」、Macの方は「Download for macOS」をクリックしてインストールします。
   - インストール時の設定はすべて「Next（デフォルト）」でOKです。

2. **GitHubアカウントの作成**
   - [GitHub](https://github.com/) でアカウントを作成してください。

---

## 🚀 ステップ 2：コードを自分のGitHubへ同期する

1. **リポジトリの作成**
   - GitHubのトップで「New repository」をクリック。
   - 名前に `dobutsu-shogi` と入力し、「Create repository」をクリック。

2. **コードのアップロード**（コマンドプロンプトやターミナルで実行）
   ```bash
   # フォルダへ移動
   cd [あなたのフォルダパス]
   
   # Gitの初期設定（初回のみ）
   git init
   git add .
   git commit -m "初回コミット"
   
   # GitHubと連携して送信
   git remote add origin [あなたのGitHubのURL]
   git push -u origin main
   ```

---

## 🗄️ ステップ 3：データベース（Supabase）の準備

1. [Supabase](https://supabase.com/) にGitHubアカウントでログインします。
2. **New Project** を作成。
   - 名前: `shogi-db` など
   - パスワード: **忘れないようにメモしてください。**
   - 地域: `Tokyo` を選択。
3. **重要：接続URLの取得**
   - 「Settings」>「Database」>「Connection string」を開く。
   - **Method** を必ず **「Transaction」** に変更してください。
   - ポート番号が **`6543`** のURLをコピーします。

---

## ☁️ ステップ 4：サーバー（Render）の公開

Renderは、GitHubにコードがプッシュされると**自動的に最新版に更新（自動ビルド）**してくれる便利なサービスです。

1. [Render](https://render.com/) にGitHubアカウントでログイン。
2. **New > Web Service** を選択し、先ほど作った `dobutsu-shogi` リポジトリを接続。
3. **設定を入力**:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node server_postgresql.js`
4. **Environment Variables（環境変数）** を追加:
   - `DATABASE_URL`: ステップ3で取得したポート6543のURL（パスワードを埋める）
   - `NODE_ENV`: `production`
   - `PGSSLMODE`: `no-verify`

---

## 📖 解説：無料で公開し続けるための知識

### 1. GitHub Pages と Render の違い
- **GitHub Pages**: 画像やHTMLファイルなど「動かないもの」を表示する。今回のゲーム画面（フロントエンド）はこちらでも公開できますが、対戦機能（サーバー）は動きません。
- **Render**: プログラム自体を動かす「脳」の部分を担います。今回のオンライン対戦には必須です。

### 2. 無料枠の制限
- **Render**: 15分間アクセスがないと「居眠り」します。次に誰かがアクセスしたとき、起動に50秒ほどかかります。
- **Supabase**: 1ヶ月間全くアクセスがないとデータベースが停止することがありますが、無料で一生使えます。

---

## 🤖 ステップ 5：AIにこのシステムを再現させるプロンプト

もしあなたが、AI（ChatGPT, Claude, Cursorなど）を使って別の似たようなシステムを作りたい場合は、以下のプロンプトをAIに渡してください。

> **AI再現用プロンプト:**
> 「Node.jsとWebSocketを使用したオンライン対戦ゲームのサーバーを構築したいです。以下の条件でコードを生成してください。
> 1. データベースはSupabase (PostgreSQL) を使用し、接続には pg ライブラリを使います。
> 2. インフラは Render を想定し、IPv4環境での接続エラーを回避するために `dns.setDefaultResultOrder('ipv4first')` と `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` を設定に含めてください。
> 3. データベース接続にはポート6543の接続プーラーを使用する前提で、SSL設定を `rejectUnauthorized: false` にしてください。
> 4. GitHubにプッシュすると自動ビルドされるような package.json の構成にしてください。」

---

## 🌟 最後に
これで、あなたの「どうぶつしょうぎOnline」が世界中に公開されました！
コードを書き換えて GitHub に `push` するだけで、Render が自動で読み込み、数分後にはネット上のゲームに反映されます。
楽しい開発を！
