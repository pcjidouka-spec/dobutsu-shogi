# 動物将棋 オンライン対戦版

WebSocketを使用したオンライン対戦可能な動物将棋ゲームです。

## 必要な環境

- Node.js (v14以上推奨)
- npm

## ローカルでのテスト

1. 依存パッケージをインストール:
```bash
npm install
```

2. サーバーを起動:
```bash
npm start
```

3. ブラウザで `http://localhost:3000` にアクセス

4. 複数のブラウザタブまたはウィンドウを開いて対戦をテスト

## AWS EC2へのデプロイ手順

### 1. EC2インスタンスの準備

1. EC2インスタンスを作成（Ubuntu 22.04 LTS推奨）
2. セキュリティグループで以下のポートを開放:
   - SSH: 22
   - HTTP: 80
   - カスタムTCP: 3000（または任意のポート）

### 2. EC2インスタンスにSSH接続

```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

### 3. Node.jsのインストール

```bash
# Node.jsとnpmをインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# インストール確認
node --version
npm --version
```

### 4. アプリケーションのデプロイ

```bash
# アプリケーションディレクトリを作成
mkdir -p ~/dobutsu-shogi
cd ~/dobutsu-shogi

# ファイルをアップロード（ローカルマシンから実行）
scp -i your-key.pem index.html style.css script.js server.js package.json ubuntu@your-ec2-public-ip:~/dobutsu-shogi/
```

### 5. 依存パッケージのインストールとサーバー起動

```bash
# EC2インスタンス上で実行
cd ~/dobutsu-shogi
npm install

# サーバーを起動
node server.js
```

### 6. PM2を使用した永続化（推奨）

```bash
# PM2をグローバルインストール
sudo npm install -g pm2

# アプリケーションを起動
pm2 start server.js --name dobutsu-shogi

# 起動時に自動起動するよう設定
pm2 startup
pm2 save

# ステータス確認
pm2 status

# ログ確認
pm2 logs dobutsu-shogi
```

### 7. Nginxをリバースプロキシとして使用（オプション）

```bash
# Nginxをインストール
sudo apt-get update
sudo apt-get install -y nginx

# Nginx設定ファイルを作成
sudo nano /etc/nginx/sites-available/dobutsu-shogi
```

以下の内容を追加:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # またはEC2のパブリックIP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 設定を有効化
sudo ln -s /etc/nginx/sites-available/dobutsu-shogi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. アクセス

ブラウザで以下のURLにアクセス:
- Nginxを使用する場合: `http://your-ec2-public-ip`
- 直接アクセスする場合: `http://your-ec2-public-ip:3000`

## ゲームの遊び方

1. ページを開くとプレイヤー名の入力を求められます
2. 入力後、自動的にマッチメイキングが開始されます
3. 2人のプレイヤーが揃うとゲームが開始されます
4. 先手（下側）から交互に駒を動かします
5. 勝利条件:
   - 相手のライオンを取る
   - 自分のライオンを相手陣地の最奥列に到達させる

## トラブルシューティング

### ポート3000が使用中の場合

`server.js`の以下の行を変更:
```javascript
const PORT = process.env.PORT || 3000;
```

環境変数で指定:
```bash
PORT=8080 node server.js
```

### WebSocket接続エラー

- セキュリティグループでポートが開放されているか確認
- ファイアウォール設定を確認
- ブラウザのコンソールでエラーメッセージを確認

## ライセンス

MIT License
