const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { Pool } = require('pg');

const app = express();
app.use(express.json()); // JSONボディを解析するために必要
app.use(express.static(__dirname)); // 静的ファイルの配信
const PORT = process.env.PORT || 3000;

// PostgreSQL Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // SupabaseはSSL必須のため、URLにsupabaseが含まれる場合や本番環境ではSSLを有効にする
    ssl: (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase.co')) || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false
});

// プールエラーの監視
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

// Initialize Database Tables
async function initDB() {
    try {
        const client = await pool.connect();
        console.log('Connected to PostgreSQL database');

        await client.query(`
            CREATE TABLE IF NOT EXISTS game_settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value TEXT
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS game_logs (
                id SERIAL PRIMARY KEY,
                event_type VARCHAR(255),
                event_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                rating INT DEFAULT 1500,
                wins INT DEFAULT 0,
                losses INT DEFAULT 0,
                draws INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 対戦履歴テーブル作成（ランキング用）
        await client.query(`
            CREATE TABLE IF NOT EXISTS match_history (
                id SERIAL PRIMARY KEY,
                player_sente VARCHAR(255) NOT NULL,
                player_gote VARCHAR(255) NOT NULL,
                winner VARCHAR(50) NOT NULL,
                played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default settings if not exists
        const result = await client.query('SELECT * FROM game_settings WHERE setting_key = $1', ['maxPlayersPerRoom']);
        if (result.rows.length === 0) {
            await client.query('INSERT INTO game_settings (setting_key, setting_value) VALUES ($1, $2)', ['maxPlayersPerRoom', '2']);
        }

        client.release();
    } catch (error) {
        console.error('Error initializing database:', error.message);
    }
}

initDB();

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// --- Developer Mode API (PostgreSQL Version) ---

// Auth Middleware
const requireAuth = (req, res, next) => {
    const password = req.headers['x-dev-password'];
    if (password === process.env.DEV_PASSWORD) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Incorrect password' });
    }
};

// Password Verify Endpoint
app.post('/api/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === process.env.DEV_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Incorrect password' });
    }
});


// データベース取得 (設定とログを表示)
app.get('/api/db', requireAuth, async (req, res) => {
    try {
        const settingsResult = await pool.query('SELECT * FROM game_settings');
        const logsResult = await pool.query('SELECT * FROM game_logs ORDER BY created_at DESC LIMIT 50');

        const dbData = {
            settings: settingsResult.rows.reduce((acc, row) => {
                acc[row.setting_key] = row.setting_value;
                return acc;
            }, {}),
            logs: logsResult.rows
        };
        res.json(dbData);
    } catch (error) {
        res.status(500).send('Database error: ' + error.message);
    }
});

// データベース更新 (設定のみ更新可能)
app.post('/api/db', requireAuth, async (req, res) => {
    try {
        const { settings } = req.body;
        if (settings) {
            for (const [key, value] of Object.entries(settings)) {
                await pool.query(
                    'INSERT INTO game_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2',
                    [key, String(value)]
                );
            }
            res.send('Settings updated');
        } else {
            res.status(400).send('No settings provided');
        }
    } catch (error) {
        res.status(500).send('Database error: ' + error.message);
    }
});

// 任意のSQL実行 (開発者用)
app.post('/api/sql', requireAuth, async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).send('Query is required');

        const result = await pool.query(query);
        res.json({ rows: result.rows, fields: result.fields });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- User Management API ---

// 全ユーザー取得
app.get('/api/users', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users ORDER BY rating DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ユーザー作成
app.post('/api/users', requireAuth, async (req, res) => {
    try {
        const { username, rating } = req.body;
        if (!username) return res.status(400).json({ error: 'Username is required' });

        await pool.query(
            'INSERT INTO users (username, rating) VALUES ($1, $2)',
            [username, rating || 1500]
        );
        res.json({ success: true });
    } catch (error) {
        if (error.code === '23505') { // PostgreSQL unique_violation
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// ユーザー更新
app.put('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, wins, losses, draws, created_at } = req.body;

        await pool.query(
            'UPDATE users SET rating=$1, wins=$2, losses=$3, draws=$4, created_at=$5 WHERE id=$6',
            [rating, wins, losses, draws, created_at, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ユーザー削除
app.delete('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM users WHERE id=$1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// サーバーステータス取得
app.get('/api/status', requireAuth, (req, res) => {
    const status = {
        activeRooms: rooms.size,
        waitingPlayers: waitingPlayers.length,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    };
    res.json(status);
});

// ランキング取得API
app.get('/api/rankings', async (req, res) => {
    try {
        // --- 1. 通算ランキング (All-Time) ---
        // 既存の users テーブルから累積データを取得
        const usersResult = await pool.query('SELECT username, wins, losses, draws, created_at FROM users');
        const users = usersResult.rows;

        const createAllTimeRanking = (type) => {
            return users
                .filter(u => {
                    const total = u.wins + u.losses + u.draws;
                    return type === 'wins' ? u.wins > 0 : total >= 3;
                })
                .map(u => {
                    const total = u.wins + u.losses + u.draws;
                    return {
                        username: u.username,
                        wins: u.wins,
                        total: total,
                        winRate: total > 0 ? (u.wins / total) * 100 : 0,
                        created_at: new Date(u.created_at)
                    };
                })
                .sort((a, b) => {
                    if (type === 'wins') {
                        if (b.wins !== a.wins) return b.wins - a.wins;
                    } else {
                        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                    }
                    return b.created_at - a.created_at; // タイブレーク: 新しい順
                })
                .slice(0, 3);
        };

        // --- 2. 月間ランキング (Monthly) ---
        // match_history から今月のデータを集計
        const historyResult = await pool.query('SELECT * FROM match_history');
        const history = historyResult.rows;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyStats = {};
        // ユーザー情報のマップ（タイブレーク用）
        const userMap = new Map();
        users.forEach(u => userMap.set(u.username, new Date(u.created_at)));

        history.forEach(match => {
            const date = new Date(match.played_at);
            if (date < startOfMonth) return; // 今月以前はスキップ

            const updateStats = (statsObj, player, winner) => {
                if (!statsObj[player]) statsObj[player] = { wins: 0, total: 0 };
                statsObj[player].total++;
                if (winner === 'sente' && player === match.player_sente) statsObj[player].wins++;
                if (winner === 'gote' && player === match.player_gote) statsObj[player].wins++;
            };

            updateStats(monthlyStats, match.player_sente, match.winner);
            updateStats(monthlyStats, match.player_gote, match.winner);
        });

        const createMonthlyRanking = (type) => {
            return Object.keys(monthlyStats).map(username => ({
                username,
                wins: monthlyStats[username].wins,
                total: monthlyStats[username].total,
                winRate: monthlyStats[username].total > 0 ? (monthlyStats[username].wins / monthlyStats[username].total) * 100 : 0,
                created_at: userMap.get(username) || new Date(0)
            })).filter(u => type === 'wins' ? u.wins > 0 : u.total >= 3)
                .sort((a, b) => {
                    if (type === 'wins') {
                        if (b.wins !== a.wins) return b.wins - a.wins;
                    } else {
                        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                    }
                    return b.created_at - a.created_at;
                })
                .slice(0, 3);
        };

        res.json({
            allTime: {
                wins: createAllTimeRanking('wins'),
                rates: createAllTimeRanking('rates')
            },
            monthly: {
                wins: createMonthlyRanking('wins'),
                rates: createMonthlyRanking('rates')
            }
        });

    } catch (error) {
        console.error('Ranking API Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// --------------------------

// WebSocketサーバー
const wss = new WebSocket.Server({ server });

// ゲームルーム管理
const rooms = new Map();
const waitingPlayers = [];
const rematchRequests = new Map(); // roomId -> Set of players who requested rematch

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        handleDisconnect(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function handleMessage(ws, data) {
    switch (data.type) {
        case 'join':
            handleJoin(ws, data.playerName);
            break;
        case 'move':
            handleMove(ws, data);
            break;
        case 'drop':
            handleDrop(ws, data);
            break;
        case 'rematch':
            handleRematch(ws);
            break;
    }
}

// ユーザー登録（非同期）
async function registerUser(username) {
    try {
        await pool.query(
            'INSERT INTO users (username, rating) VALUES ($1, 1500) ON CONFLICT (username) DO NOTHING',
            [username]
        );
        console.log(`User registered/verified: ${username}`);
    } catch (error) {
        console.error(`Error registering user ${username}:`, error);
    }
}

// 戦績更新（非同期）
async function updateGameStats(winner, senteName, goteName) {
    try {
        // ユーザー戦績更新
        if (winner === 'draw') {
            await pool.query('UPDATE users SET draws = draws + 1 WHERE username = $1', [senteName]);
            await pool.query('UPDATE users SET draws = draws + 1 WHERE username = $1', [goteName]);
        } else if (winner === 'sente') {
            await pool.query('UPDATE users SET wins = wins + 1 WHERE username = $1', [senteName]);
            await pool.query('UPDATE users SET losses = losses + 1 WHERE username = $1', [goteName]);
        } else if (winner === 'gote') {
            await pool.query('UPDATE users SET losses = losses + 1 WHERE username = $1', [senteName]);
            await pool.query('UPDATE users SET wins = wins + 1 WHERE username = $1', [goteName]);
        }

        // 対戦履歴保存
        await pool.query(
            'INSERT INTO match_history (player_sente, player_gote, winner) VALUES ($1, $2, $3)',
            [senteName, goteName, winner]
        );

        console.log(`Stats updated for game: ${senteName} vs ${goteName} (Winner: ${winner})`);
    } catch (error) {
        console.error('Error updating game stats:', error);
    }
}

function handleJoin(ws, playerName) {
    ws.playerName = playerName;
    // ユーザー登録を非同期で実行（ゲーム進行をブロックしない）
    registerUser(playerName);

    // 待機中のプレイヤーがいるかチェック
    if (waitingPlayers.length > 0) {
        const opponent = waitingPlayers.shift();
        const roomId = generateRoomId();

        // ランダムに先手・後手を決定
        const isFirstPlayerSente = Math.random() < 0.5;
        const sentePlayer = isFirstPlayerSente ? opponent : ws;
        const gotePlayer = isFirstPlayerSente ? ws : opponent;

        // ルーム作成
        const room = {
            id: roomId,
            players: {
                sente: sentePlayer,
                gote: gotePlayer
            },
            currentPlayer: 'sente',
            board: initializeBoard(),
            captured: { sente: [], gote: [] },
            positionHistory: [] // 千日手判定用の状態履歴
        };

        rooms.set(roomId, room);
        opponent.roomId = roomId;
        ws.roomId = roomId;

        // 両プレイヤーにゲーム開始を通知
        sentePlayer.send(JSON.stringify({
            type: 'gameStart',
            role: 'sente',
            opponent: gotePlayer.playerName,
            roomId: roomId
        }));

        gotePlayer.send(JSON.stringify({
            type: 'gameStart',
            role: 'gote',
            opponent: sentePlayer.playerName,
            roomId: roomId
        }));

        console.log(`Game started in room ${roomId} - Sente: ${sentePlayer.playerName}, Gote: ${gotePlayer.playerName}`);
    } else {
        // 待機リストに追加
        waitingPlayers.push(ws);
        ws.send(JSON.stringify({
            type: 'waiting'
        }));
        console.log(`Player ${playerName} is waiting for opponent`);
    }
}

function handleMove(ws, data) {
    const room = rooms.get(ws.roomId);
    if (!room) return;

    const playerRole = getPlayerRole(ws, room);
    if (playerRole !== room.currentPlayer) return;

    // 移動を実行
    const { fromRow, fromCol, toRow, toCol } = data;
    const piece = room.board[fromRow][fromCol];
    const captured = room.board[toRow][toCol];

    // 駒を取った場合
    if (captured) {
        let capturedType = captured.type;
        if (capturedType === 'niwatori') {
            capturedType = 'hiyoko';
        }
        room.captured[playerRole].push(capturedType);
    }

    // 駒を移動
    room.board[toRow][toCol] = piece;
    room.board[fromRow][fromCol] = null;

    // ひよこの成り判定
    if (piece.type === 'hiyoko') {
        const promotionRow = piece.player === 'sente' ? 0 : 3;
        if (toRow === promotionRow) {
            room.board[toRow][toCol].type = 'niwatori';
        }
    }

    // ターン交代
    room.currentPlayer = room.currentPlayer === 'sente' ? 'gote' : 'sente';

    // 千日手判定用に状態を記録（手番交代後の状態）
    if (!room.positionHistory) {
        room.positionHistory = [];
    }
    const positionKey = getPositionKey(room.board, room.captured, room.currentPlayer);
    room.positionHistory.push(positionKey);
    // 履歴が長くなりすぎないように、最新100手分のみ保持
    if (room.positionHistory.length > 100) {
        room.positionHistory.shift();
    }

    // 勝利判定
    const winner = checkWinCondition(room);

    if (winner) {
        // 再戦リクエストをリセット
        rematchRequests.delete(room.id);

        // 戦績更新
        updateGameStats(winner, room.players.sente.playerName, room.players.gote.playerName);

        broadcastToRoom(room, {
            type: 'gameOver',
            winner: winner,
            move: { fromRow, fromCol, toRow, toCol }
        });
    } else {
        broadcastToRoom(room, {
            type: 'move',
            fromRow,
            fromCol,
            toRow,
            toCol,
            currentPlayer: room.currentPlayer,
            captured: room.captured
        });
    }
}

function handleDrop(ws, data) {
    const room = rooms.get(ws.roomId);
    if (!room) return;

    const playerRole = getPlayerRole(ws, room);
    if (playerRole !== room.currentPlayer) return;

    const { pieceType, row, col } = data;

    // にわとりを打つ場合はひよことして打つ
    const actualPieceType = pieceType === 'niwatori' ? 'hiyoko' : pieceType;

    // 駒を配置
    room.board[row][col] = { type: actualPieceType, player: playerRole };

    // 持ち駒から削除（niwatoriの場合はhiyokoとして削除）
    const index = room.captured[playerRole].indexOf(actualPieceType);
    if (index > -1) {
        room.captured[playerRole].splice(index, 1);
    }

    // ターン交代
    room.currentPlayer = room.currentPlayer === 'sente' ? 'gote' : 'sente';

    // 千日手判定用に状態を記録（手番交代後の状態）
    if (!room.positionHistory) {
        room.positionHistory = [];
    }
    const positionKey = getPositionKey(room.board, room.captured, room.currentPlayer);
    room.positionHistory.push(positionKey);
    // 履歴が長くなりすぎないように、最新100手分のみ保持
    if (room.positionHistory.length > 100) {
        room.positionHistory.shift();
    }

    // 勝利判定
    const winner = checkWinCondition(room);

    if (winner) {
        // 再戦リクエストをリセット
        rematchRequests.delete(room.id);

        // 戦績更新
        updateGameStats(winner, room.players.sente.playerName, room.players.gote.playerName);

        broadcastToRoom(room, {
            type: 'gameOver',
            winner: winner,
            drop: { pieceType, row, col }
        });
    } else {
        broadcastToRoom(room, {
            type: 'drop',
            pieceType,
            row,
            col,
            currentPlayer: room.currentPlayer,
            captured: room.captured
        });
    }
}



function handleDisconnect(ws) {
    // 待機リストから削除
    const waitingIndex = waitingPlayers.indexOf(ws);
    if (waitingIndex > -1) {
        waitingPlayers.splice(waitingIndex, 1);
    }

    // ルームから削除
    if (ws.roomId) {
        const room = rooms.get(ws.roomId);
        if (room) {
            // 相手に通知
            const opponent = room.players.sente === ws ? room.players.gote : room.players.sente;
            if (opponent && opponent.readyState === WebSocket.OPEN) {
                opponent.send(JSON.stringify({
                    type: 'opponentDisconnected'
                }));
            }
            rooms.delete(ws.roomId);
        }
    }
}

function getPlayerRole(ws, room) {
    return room.players.sente === ws ? 'sente' : 'gote';
}

function broadcastToRoom(room, message) {
    const messageStr = JSON.stringify(message);
    if (room.players.sente.readyState === WebSocket.OPEN) {
        room.players.sente.send(messageStr);
    }
    if (room.players.gote.readyState === WebSocket.OPEN) {
        room.players.gote.send(messageStr);
    }
}

function initializeBoard() {
    const board = Array(4).fill(null).map(() => Array(3).fill(null));

    // 後手の駒配置
    board[0][0] = { type: 'kirin', player: 'gote' };
    board[0][1] = { type: 'lion', player: 'gote' };
    board[0][2] = { type: 'zou', player: 'gote' };
    board[1][1] = { type: 'hiyoko', player: 'gote' };

    // 先手の駒配置
    board[3][0] = { type: 'zou', player: 'sente' };
    board[3][1] = { type: 'lion', player: 'sente' };
    board[3][2] = { type: 'kirin', player: 'sente' };
    board[2][1] = { type: 'hiyoko', player: 'sente' };

    return board;
}

// 駒の移動方向を取得
function getPieceDirections(type, player) {
    const forward = player === 'sente' ? -1 : 1;
    const directions = {
        'lion': [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
        'zou': [[-1, -1], [-1, 1], [1, -1], [1, 1]],
        'kirin': [[-1, 0], [0, -1], [0, 1], [1, 0]],
        'hiyoko': [[forward, 0]],
        'niwatori': [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]]
    };
    return directions[type] || [];
}

// 盤面状態を文字列化（千日手判定用）
function getPositionKey(board, captured, currentPlayer) {
    // 盤面を文字列化
    let boardStr = '';
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
            const piece = board[row][col];
            if (piece) {
                boardStr += `${row},${col},${piece.type},${piece.player};`;
            } else {
                boardStr += `${row},${col},null;`;
            }
        }
    }
    // 持ち駒をソートして文字列化（順序を統一）
    const senteCaptured = [...(captured.sente || [])].sort().join(',');
    const goteCaptured = [...(captured.gote || [])].sort().join(',');
    // 手番を含める
    return `${boardStr}|${senteCaptured}|${goteCaptured}|${currentPlayer}`;
}

// 特定のプレイヤーの可能な手を取得
function getAllPossibleMoves(board, captured, player) {
    const moves = [];

    // 盤上の駒の移動
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
            const piece = board[row][col];
            if (piece && piece.player === player) {
                const directions = getPieceDirections(piece.type, piece.player);
                for (const [dr, dc] of directions) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    if (newRow >= 0 && newRow < 4 && newCol >= 0 && newCol < 3) {
                        const target = board[newRow][newCol];
                        if (!target || target.player !== piece.player) {
                            moves.push({ type: 'move', fromRow: row, fromCol: col, toRow: newRow, toCol: newCol });
                        }
                    }
                }
            }
        }
    }

    // 持ち駒の打ち（簡易版：空いているマスに打てる）
    const uniquePieces = [...new Set(captured[player] || [])];
    for (const pieceType of uniquePieces) {
        // にわとりを打つ場合はひよことして打つ
        const actualPieceType = pieceType === 'niwatori' ? 'hiyoko' : pieceType;
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                if (!board[row][col]) {
                    moves.push({ type: 'drop', pieceType: actualPieceType, row, col });
                }
            }
        }
    }

    return moves;
}

function checkWinCondition(room) {
    const board = room.board;

    // ライオンが取られたかチェック
    let senteLionExists = false;
    let goteLionExists = false;
    let senteLionPos = null;
    let goteLionPos = null;

    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
            const piece = board[row][col];
            if (piece && piece.type === 'lion') {
                if (piece.player === 'sente') {
                    senteLionExists = true;
                    senteLionPos = { row, col };
                }
                if (piece.player === 'gote') {
                    goteLionExists = true;
                    goteLionPos = { row, col };
                }
            }
        }
    }

    if (!senteLionExists) return 'gote';
    if (!goteLionExists) return 'sente';

    // 千日手判定（同じ状態が3回現れたら引き分け）
    const currentPosition = getPositionKey(board, room.captured, room.currentPlayer);
    if (!room.positionHistory) {
        room.positionHistory = [];
    }
    let repetitionCount = 0;
    for (const position of room.positionHistory) {
        if (position === currentPosition) {
            repetitionCount++;
        }
    }
    if (repetitionCount >= 2) { // 現在の状態を含めて3回（履歴に2回 + 現在）
        return 'draw';
    }

    // ライオンが相手陣地の最奥に入ったかチェック
    // 先手のライオンが後手陣地の最奥（row=0）に入った場合
    if (senteLionPos && senteLionPos.row === 0) {
        // 次の相手（後手）の番でライオンが取られる可能性をチェック
        const opponentMoves = getAllPossibleMoves(board, room.captured, 'gote');
        const canCaptureLion = opponentMoves.some(move => {
            if (move.type === 'move') {
                return move.toRow === senteLionPos.row && move.toCol === senteLionPos.col;
            }
            return false;
        });
        // 取られない場合のみ勝利
        if (!canCaptureLion) {
            return 'sente';
        }
    }

    // 後手のライオンが先手陣地の最奥（row=3）に入った場合
    if (goteLionPos && goteLionPos.row === 3) {
        // 次の相手（先手）の番でライオンが取られる可能性をチェック
        const opponentMoves = getAllPossibleMoves(board, room.captured, 'sente');
        const canCaptureLion = opponentMoves.some(move => {
            if (move.type === 'move') {
                return move.toRow === goteLionPos.row && move.toCol === goteLionPos.col;
            }
            return false;
        });
        // 取られない場合のみ勝利
        if (!canCaptureLion) {
            return 'gote';
        }
    }

    return null;
}

function handleRematch(ws) {
    const room = rooms.get(ws.roomId);
    if (!room) return;

    const playerRole = getPlayerRole(ws, room);

    // 再戦リクエストを記録
    if (!rematchRequests.has(room.id)) {
        rematchRequests.set(room.id, new Set());
    }
    rematchRequests.get(room.id).add(playerRole);

    // 両プレイヤーが再戦を希望しているかチェック
    const requests = rematchRequests.get(room.id);
    if (requests.size === 2) {
        // 両方が再戦を希望している場合、ゲームをリセット
        room.board = initializeBoard();
        room.captured = { sente: [], gote: [] };
        room.positionHistory = []; // 千日手判定用の状態履歴をリセット

        // 先手・後手を入れ替える
        const temp = room.players.sente;
        room.players.sente = room.players.gote;
        room.players.gote = temp;
        room.currentPlayer = 'sente';

        // 再戦リクエストをリセット
        rematchRequests.delete(room.id);

        // 両プレイヤーに再戦開始を通知（正しい役割を送信）
        const senteWs = room.players.sente;
        const goteWs = room.players.gote;

        if (senteWs && senteWs.readyState === WebSocket.OPEN) {
            senteWs.send(JSON.stringify({
                type: 'rematchAccepted',
                role: 'sente',
                opponent: goteWs.playerName
            }));
        }

        if (goteWs && goteWs.readyState === WebSocket.OPEN) {
            goteWs.send(JSON.stringify({
                type: 'rematchAccepted',
                role: 'gote',
                opponent: senteWs.playerName
            }));
        }
    } else {
        // 片方だけが再戦を希望している場合、相手に通知
        const opponent = room.players.sente === ws ? room.players.gote : room.players.sente;
        if (opponent && opponent.readyState === WebSocket.OPEN) {
            opponent.send(JSON.stringify({
                type: 'rematchRequested'
            }));
        }
    }
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 9);
}

console.log('Dobutsu Shogi WebSocket server initialized (PostgreSQL version)');

// Graceful Shutdown Logic
const shutdown = async () => {
    console.log('Received kill signal, shutting down gracefully');
    server.close(() => {
        console.log('Closed out remaining connections');
        pool.end().then(() => {
            console.log('Database pool closed');
            process.exit(0);
        }).catch(err => {
            console.error('Error closing database pool', err);
            process.exit(1);
        });
    });

    // Force close after 10s
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
