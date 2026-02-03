# 🤖 AI自動構築・システム再現プロンプト & 構築マニュアル

本ドキュメントは、AI（ChatGPT, Claude, Cursor等）に対してこのプロジェクトのシステム構成を伝え、**別の環境や新しいプロジェクトとして同様の仕組みを自動再現させるための「プロンプト」**、およびその構築手順をまとめたものです。

---

## 🎯 1. AIへの命令用プロンプト（完全再現用）

新しいシステムを構築する際、AIに以下のプロンプトをそのまま入力してください。このプロジェクトで解決した「RenderとSupabaseの接続問題」などの技術的知見がすべて含まれています。

> **AI再現・構築プロンプト:**
> 「Node.jsとWebSocketを使用したオンライン対戦ゲームのサーバーを構築したいです。以下の条件で環境構築とコード生成を行ってください。
> 
> **1. 技術スタック:**
> - Node.js (v18+), Express, WebSocket (wsライブラリ)
> - データベース: Supabase (PostgreSQL)
> - ホスティング: Render (Web Service)
> 
> **2. 接続トラブル回避策（必須設定）:**
> - Render（IPv4のみ）からSupabase（デフォルトIPv6）への接続エラーを回避するため、コード冒頭に `dns.setDefaultResultOrder('ipv4first')` を含めること。
> - 自己署名証明書エラーを回避するため、グローバル設定で `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` を指定すること。
> 
> **3. データベース接続設定:**
> - Supabaseの『Transaction Pooler (ポート 6543)』を使用する前提の接続文字列（DATABASE_URL）に対応させること。
> - pgライブラリのPool設定で、`ssl: { rejectUnauthorized: false }` を含めること。
> 
> **4. インフラ連携:**
> - GitHubへのプッシュと同時にRenderで自動ビルド（npm install & node server.js）が走る構成にすること。
> - 必要な環境変数: `DATABASE_URL`, `NODE_ENV=production`, `PGSSLMODE=no-verify`」

---

## 🛠️ 2. 手動でのインフラ構築ステップ

AIが生成したコードを実際に動かすための、最短構築ガイドです。

### ステップ 1：Git と GitHub の準備
1. **Gitのインストール**: [Git公式サイト](https://git-scm.com/) からダウンロード。
2. **コードの同期**: 
   ```bash
   git init
   git add .
   git commit -m "Reproduction"
   git remote add origin [自分のGitHubパス]
   git push -u origin main
   ```

### ステップ 2：Supabase の準備
1. [Supabase](https://supabase.com/) でプロジェクト作成。
2. **重要：接続URLの取得**
   - 「Settings」>「Database」を開く。
   - **Method** を必ず **「Transaction」** (Pooler) に変更。
   - 表示された **ポート 6543** のURLをメモする。

### ステップ 3：Render の準備
1. [Render](https://render.com/) で **New > Web Service** を選択し、リポジトリを接続。
2. **環境変数（Environment Variables）** を設定：
   - `DATABASE_URL`: ステップ2のURL（パスワードを埋める）
   - `NODE_ENV`: `production`
   - `PGSSLMODE`: `no-verify`

---

## 📖 3. 仕組みの解説（AIへの説明用）

- **自動ビルドとGitHub同期**: GitHubに更新をプッシュするだけで、Renderがそれを検知して最新の状態に自動で書き換えます。
- **Render vs GitHub Pages**:
  - **GitHub Pages**: HTML/CSS/JSの表示のみ（無料）。
  - **Render**: プログラム（Node.jsサーバー）の実行（無料枠あり）。
- **無料公開のメリット**: 制限（15分でスリープ等）はあるものの、維持費0円でフルスタックなWebアプリを世界中に公開し続けることが可能です。

---

## 🌟 まとめ
このマニュアルを使うことで、AIは「ネットワーク規格の違い（IPv4/IPv6）」や「証明書の検証問題」といった**クラウド移行特有の落とし穴**を最初から回避した状態で、新しいシステムを組み上げることができます。
