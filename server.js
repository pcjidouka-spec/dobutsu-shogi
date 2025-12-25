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
    // 初期配置では先手のライオンはrow=3（先手の陣地の最奥）にいるので、row=0に入った場合は敵陣地に入ったことになる
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
    // 初期配置では後手のライオンはrow=0（後手の陣地の最奥）にいるので、row=3に入った場合は敵陣地に入ったことになる
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

console.log('Dobutsu Shogi WebSocket server initialized');
