const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 静的ファイルを提供
app.use(express.static(__dirname));

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// WebSocketサーバー
const wss = new WebSocket.Server({ server });

// ゲームルーム管理
const rooms = new Map();
const waitingPlayers = [];

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

    }
}

function handleJoin(ws, playerName) {
    ws.playerName = playerName;

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
            captured: { sente: [], gote: [] }
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

    // 勝利判定
    const winner = checkWinCondition(room);

    if (winner) {
        broadcastToRoom(room, {
            type: 'gameOver',
            winner: winner,
            move: { fromRow, fromCol, toRow, toCol }
        });
    } else {
        // ターン交代
        room.currentPlayer = room.currentPlayer === 'sente' ? 'gote' : 'sente';

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

    // 駒を配置
    room.board[row][col] = { type: pieceType, player: playerRole };

    // 持ち駒から削除
    const index = room.captured[playerRole].indexOf(pieceType);
    if (index > -1) {
        room.captured[playerRole].splice(index, 1);
    }

    // 勝利判定
    const winner = checkWinCondition(room);

    if (winner) {
        broadcastToRoom(room, {
            type: 'gameOver',
            winner: winner,
            drop: { pieceType, row, col }
        });
    } else {
        // ターン交代
        room.currentPlayer = room.currentPlayer === 'sente' ? 'gote' : 'sente';

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

function checkWinCondition(room) {
    const board = room.board;

    // ライオンが取られたかチェック
    let senteLionExists = false;
    let goteLionExists = false;

    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
            const piece = board[row][col];
            if (piece && piece.type === 'lion') {
                if (piece.player === 'sente') senteLionExists = true;
                if (piece.player === 'gote') goteLionExists = true;
            }
        }
    }

    if (!senteLionExists) return 'gote';
    if (!goteLionExists) return 'sente';

    // ライオンが相手陣地に入ったかチェック
    for (let col = 0; col < 3; col++) {
        if (board[0][col]?.type === 'lion' && board[0][col]?.player === 'sente') return 'sente';
        if (board[3][col]?.type === 'lion' && board[3][col]?.player === 'gote') return 'gote';
    }

    return null;
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 9);
}

console.log('Dobutsu Shogi WebSocket server initialized');
