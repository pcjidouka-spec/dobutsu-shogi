// 動物将棋のゲームロジック
class DobutsuShogi {
    constructor() {
        this.board = Array(4).fill(null).map(() => Array(3).fill(null));
        this.currentPlayer = 'sente';
        this.selectedCell = null;
        this.selectedCaptured = null;
        this.captured = { sente: [], gote: [] };
        this.initBoard();
    }

    initBoard() {
        // 盤面をクリア
        this.board = Array(4).fill(null).map(() => Array(3).fill(null));

        this.board[0][0] = { type: 'kirin', player: 'gote' };
        this.board[0][1] = { type: 'lion', player: 'gote' };
        this.board[0][2] = { type: 'zou', player: 'gote' };
        this.board[1][1] = { type: 'hiyoko', player: 'gote' };

        this.board[3][0] = { type: 'zou', player: 'sente' };
        this.board[3][1] = { type: 'lion', player: 'sente' };
        this.board[3][2] = { type: 'kirin', player: 'sente' };
        this.board[2][1] = { type: 'hiyoko', player: 'sente' };

        this.captured = { sente: [], gote: [] };
        this.currentPlayer = 'sente';
    }

    getPieceEmoji(type) {
        const pieces = {
            lion: '🦁', zou: '🐘', kirin: '🦒',
            hiyoko: '🐥', niwatori: '🐔'
        };
        return pieces[type] || '';
    }

    getValidMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece || piece.player !== this.currentPlayer) return [];

        const moves = [];
        const directions = this.getPieceDirections(piece.type, piece.player);

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < 4 && newCol >= 0 && newCol < 3) {
                const target = this.board[newRow][newCol];
                if (!target || target.player !== piece.player) {
                    moves.push([newRow, newCol]);
                }
            }
        }
        return moves;
    }

    getPieceDirections(type, player) {
        const forward = player === 'sente' ? -1 : 1;
        const directions = {
            lion: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
            zou: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
            kirin: [[-1, 0], [0, -1], [0, 1], [1, 0]],
            hiyoko: [[forward, 0]],
            niwatori: [[forward, -1], [forward, 0], [forward, 1], [0, -1], [0, 1], [-forward, 0]]
        };
        return directions[type] || [];
    }

    getValidDropPositions() {
        const positions = [];
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                if (!this.board[row][col]) positions.push([row, col]);
            }
        }
        return positions;
    }

    // 駒を動かす
    move(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const target = this.board[toRow][toCol];

        // 駒を取る処理
        if (target) {
            let capturedType = target.type;
            if (capturedType === 'niwatori') capturedType = 'hiyoko';
            this.captured[this.currentPlayer].push(capturedType);
        }

        // 盤面の更新
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // 成り判定
        if (piece.type === 'hiyoko') {
            const promotionRow = this.currentPlayer === 'sente' ? 0 : 3;
            if (toRow === promotionRow) {
                piece.type = 'niwatori';
            }
        }

        this.switchPlayer();
        return { winner: this.checkWinner() };
    }

    // 持ち駒を打つ
    drop(pieceType, row, col) {
        const index = this.captured[this.currentPlayer].indexOf(pieceType);
        if (index === -1) return false;

        this.captured[this.currentPlayer].splice(index, 1);
        this.board[row][col] = { type: pieceType, player: this.currentPlayer };

        this.switchPlayer();
        return { winner: this.checkWinner() };
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'sente' ? 'gote' : 'sente';
    }

    checkWinner() {
        // ライオンがいなくなったか
        let senteLion = false;
        let goteLion = false;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 3; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'lion') {
                    if (p.player === 'sente') senteLion = true;
                    if (p.player === 'gote') goteLion = true;
                }
            }
        }
        if (!senteLion) return 'gote';
        if (!goteLion) return 'sente';

        // トライ（ライオンが相手陣地の一番奥に到達）
        for (let c = 0; c < 3; c++) {
            const p1 = this.board[0][c];
            if (p1 && p1.type === 'lion' && p1.player === 'sente') return 'sente';
            const p2 = this.board[3][c];
            if (p2 && p2.type === 'lion' && p2.player === 'gote') return 'gote';
        }

        return null;
    }

    // コンピュータの思考ルーチン
    makeComputerMove() {
        const validMoves = [];

        // 盤上の駒の移動
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 3; c++) {
                const p = this.board[r][c];
                if (p && p.player === this.currentPlayer) {
                    const moves = this.getValidMoves(r, c);
                    moves.forEach(([tr, tc]) => {
                        validMoves.push({ type: 'move', from: [r, c], to: [tr, tc] });
                    });
                }
            }
        }

        // 持ち駒の使用
        const emptyCells = this.getValidDropPositions();
        const uniqueCaptured = [...new Set(this.captured[this.currentPlayer])];
        if (emptyCells.length > 0) {
            uniqueCaptured.forEach(type => {
                emptyCells.forEach(([r, c]) => {
                    validMoves.push({ type: 'drop', piece: type, to: [r, c] });
                });
            });
        }

        if (validMoves.length === 0) return null;

        // 簡単な評価関数付きAI: 王手や取る手を優先する
        // ここでは単純に「取れる駒があるなら取る」「勝てるなら勝つ」くらいの実装にする

        // 勝つ手があればそれを選ぶ
        for (const move of validMoves) {
            const simulatedGame = this.clone();
            if (move.type === 'move') {
                simulatedGame.move(move.from[0], move.from[1], move.to[0], move.to[1]);
            } else {
                simulatedGame.drop(move.piece, move.to[0], move.to[1]);
            }
            if (simulatedGame.checkWinner() === this.currentPlayer) {
                return move;
            }
        }

        // 駒を取れる手があれば優先（ランダムに選ぶ）
        const captureMoves = validMoves.filter(m => m.type === 'move' && this.board[m.to[0]][m.to[1]] !== null);
        if (captureMoves.length > 0) {
            return captureMoves[Math.floor(Math.random() * captureMoves.length)];
        }

        // それ以外はランダム
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    clone() {
        const newGame = new DobutsuShogi();
        newGame.board = JSON.parse(JSON.stringify(this.board));
        newGame.currentPlayer = this.currentPlayer;
        newGame.captured = JSON.parse(JSON.stringify(this.captured));
        return newGame;
    }
}

// 共通UI基底クラス
class BaseGameUI {
    constructor() {
        this.boardElement = document.getElementById('board');
        this.messageElement = document.getElementById('message');
        this.turnElement = document.getElementById('current-turn');
        this.resetBtn = document.getElementById('reset-btn');
        this.playerCapturedElement = document.getElementById('captured-pieces-player');
        this.opponentCapturedElement = document.getElementById('captured-pieces-opponent');
        this.playerNameElement = document.getElementById('player-name');
        this.opponentNameElement = document.getElementById('opponent-name');
        this.announcementElement = document.getElementById('game-announcement');
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.gameContainer = document.getElementById('game-container');

        this.resetBtn.addEventListener('click', () => location.reload());
    }

    getPieceEmoji(type) {
        const pieces = {
            lion: '🦁', zou: '🐘', kirin: '🦒',
            hiyoko: '🐥', niwatori: '🐔'
        };
        return pieces[type] || '';
    }

    renderBoard(game, playerRole) {
        this.boardElement.innerHTML = '';
        if (playerRole === 'gote') {
            this.boardElement.classList.add('flipped');
        } else {
            this.boardElement.classList.remove('flipped');
        }

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                const piece = game.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.player}`;
                    pieceElement.textContent = this.getPieceEmoji(piece.type);
                    cell.appendChild(pieceElement);
                }

                cell.addEventListener('click', () => this.handleCellClick(row, col));
                this.boardElement.appendChild(cell);
            }
        }
    }

    renderCaptured(game, playerRole) {
        this.playerCapturedElement.innerHTML = '';
        this.opponentCapturedElement.innerHTML = '';

        const opponentRole = playerRole === 'sente' ? 'gote' : 'sente';

        // 自分の持ち駒
        game.captured[playerRole].forEach((type, index) => {
            const piece = document.createElement('div');
            piece.className = 'captured-piece';
            piece.textContent = this.getPieceEmoji(type);
            piece.addEventListener('click', () => this.handleCapturedClick(playerRole, index, type));
            this.playerCapturedElement.appendChild(piece);
        });

        // 相手の持ち駒
        game.captured[opponentRole].forEach((type) => {
            const piece = document.createElement('div');
            piece.className = 'captured-piece';
            piece.textContent = this.getPieceEmoji(type);
            this.opponentCapturedElement.appendChild(piece);
        });
    }

    showAnnouncement(text, duration = 2000, callback) {
        this.announcementElement.textContent = text;
        this.announcementElement.classList.add('show');
        setTimeout(() => {
            this.announcementElement.classList.remove('show');
            if (callback) setTimeout(callback, 500);
        }, duration);
    }

    // Abstract methods to be implemented by subclasses
    handleCellClick(row, col) { }
    handleCapturedClick(player, index, type) { }
}

// オンライン対戦UI
class OnlineGameUI extends BaseGameUI {
    constructor() {
        super();
        this.game = new DobutsuShogi();
        this.ws = null;
        this.playerRole = null;
        this.playerName = null;
        this.opponentName = null;
        this.isMyTurn = false;
        this.canPlay = false;
        this.waitingMessage = document.getElementById('waiting-message');

        this.setup();
    }

    setup() {
        const name = prompt('プレイヤー名を入力してください:');
        if (name) {
            this.playerName = name;
            // モード選択画面などを非表示にして待機メッセージを表示
            document.getElementById('mode-selection').style.display = 'none';
            this.waitingMessage.style.display = 'block';
            this.waitingMessage.textContent = '対戦相手を探しています...';
            this.connectToServer();
        } else {
            location.reload(); // 名前入力キャンセルの場合
        }
    }

    connectToServer() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({ type: 'join', playerName: this.playerName }));
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };

        this.ws.onclose = () => {
            this.messageElement.textContent = 'サーバーから切断されました';
        };
    }

    handleServerMessage(data) {
        switch (data.type) {
            case 'waiting':
                this.waitingMessage.textContent = '対戦相手を待っています...';
                break;
            case 'gameStart':
                this.welcomeScreen.style.display = 'none';
                this.gameContainer.style.display = 'block';
                this.playerRole = data.role;
                this.opponentName = data.opponent;
                this.isMyTurn = (this.playerRole === 'sente');
                this.messageElement.textContent = `対戦開始！ vs ${this.opponentName}`;
                this.updatePlayerNames();
                this.render();
                this.showGameStartAnnouncement();
                break;
            case 'move':
                this.applyMove(data);
                break;
            case 'drop':
                this.applyDrop(data);
                break;
            case 'gameOver':
                this.handleGameOver(data);
                break;
            case 'opponentDisconnected':
                this.messageElement.textContent = '相手が切断しました';
                this.canPlay = false;
                break;
        }
    }

    applyMove(data) {
        // サーバーからの情報で同期
        const { fromRow, fromCol, toRow, toCol, currentPlayer, captured } = data;
        const piece = this.game.board[fromRow][fromCol];
        this.game.board[toRow][toCol] = piece;
        this.game.board[fromRow][fromCol] = null;

        // 成り
        if (piece.type === 'hiyoko') {
            const promotionRow = piece.player === 'sente' ? 0 : 3;
            if (toRow === promotionRow) this.game.board[toRow][toCol].type = 'niwatori';
        }

        this.game.captured = captured;
        this.game.currentPlayer = currentPlayer;
        this.isMyTurn = (this.playerRole === currentPlayer);
        this.render();
    }

    applyDrop(data) {
        const { pieceType, row, col, currentPlayer, captured } = data;
        this.game.board[row][col] = { type: pieceType, player: this.game.currentPlayer };
        this.game.captured = captured;
        this.game.currentPlayer = currentPlayer;
        this.isMyTurn = (this.playerRole === currentPlayer);
        this.render();
    }

    handleGameOver(data) {
        if (data.move) {
            const { fromRow, fromCol, toRow, toCol } = data.move;
            // 最後の動きを適用(簡易的)
            const piece = this.game.board[fromRow][fromCol];
            this.game.board[toRow][toCol] = piece;
            this.game.board[fromRow][fromCol] = null;
        } else if (data.drop) {
            const { pieceType, row, col } = data.drop;
            this.game.board[row][col] = { type: pieceType, player: this.game.currentPlayer };
        }

        const youWon = data.winner === this.playerRole;
        this.messageElement.textContent = youWon ? '勝利！' : '敗北...';
        this.messageElement.style.color = youWon ? '#28a745' : '#dc3545';
        this.canPlay = false;
        this.render();
    }

    render() {
        this.renderBoard(this.game, this.playerRole);
        this.renderCaptured(this.game, this.playerRole);
        this.updateTurnIndicator();
    }

    updatePlayerNames() {
        const playerRoleText = this.playerRole === 'sente' ? '先手' : '後手';
        const opponentRoleText = this.playerRole === 'sente' ? '後手' : '先手';
        this.playerNameElement.textContent = `${playerRoleText}：${this.playerName}`;
        this.opponentNameElement.textContent = `${opponentRoleText}：${this.opponentName}`;
    }

    updateTurnIndicator() {
        const isMyTurnTotal = this.game.currentPlayer === this.playerRole;
        const name = isMyTurnTotal ? this.playerName : this.opponentName;
        this.turnElement.textContent = name;
        this.turnElement.style.color = isMyTurnTotal ? '#28a745' : '#dc3545';
    }

    showGameStartAnnouncement() {
        this.canPlay = false;
        const roleText = this.playerRole === 'sente' ? '先手' : '後手';
        this.showAnnouncement(`あなたは${roleText}です`, 2000, () => {
            this.canPlay = true;
            this.showAnnouncement('対局開始！', 1000);
        });
    }

    handleCellClick(row, col) {
        if (!this.canPlay || !this.isMyTurn) return;

        // 持ち駒選択中の場合
        if (this.game.selectedCaptured) {
            const validDrops = this.game.getValidDropPositions();
            if (validDrops.some(p => p[0] === row && p[1] === col)) {
                this.ws.send(JSON.stringify({
                    type: 'drop',
                    pieceType: this.game.selectedCaptured.type,
                    row, col
                }));
                this.game.selectedCaptured = null;
            }
            return;
        }

        const piece = this.game.board[row][col];
        // 駒選択
        if (!this.game.selectedCell) {
            if (piece && piece.player === this.playerRole) {
                this.game.selectedCell = { row, col };
                this.render();
                this.highlightValidMoves(row, col);
            }
        } else {
            // 移動実行
            const moves = this.game.getValidMoves(this.game.selectedCell.row, this.game.selectedCell.col);
            if (moves.some(m => m[0] === row && m[1] === col)) {
                this.ws.send(JSON.stringify({
                    type: 'move',
                    fromRow: this.game.selectedCell.row,
                    fromCol: this.game.selectedCell.col,
                    toRow: row,
                    toCol: col
                }));
                this.game.selectedCell = null;
            } else {
                // 選択変更
                if (piece && piece.player === this.playerRole) {
                    this.game.selectedCell = { row, col };
                    this.render();
                    this.highlightValidMoves(row, col);
                } else {
                    this.game.selectedCell = null;
                    this.render();
                }
            }
        }
    }

    handleCapturedClick(player, index, type) {
        if (!this.canPlay || !this.isMyTurn || player !== this.playerRole) return;
        this.game.selectedCell = null;
        this.game.selectedCaptured = { type, player };
        this.render();
        this.highlightValidDrops();
    }

    highlightValidMoves(row, col) {
        const moves = this.game.getValidMoves(row, col);
        const cells = this.boardElement.querySelectorAll('.cell');
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);
            if (r === row && c === col) cell.classList.add('selected');
            if (moves.some(m => m[0] === r && m[1] === c)) cell.classList.add('valid-move');
        });
    }

    highlightValidDrops() {
        const drops = this.game.getValidDropPositions();
        const cells = this.boardElement.querySelectorAll('.cell');
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);
            if (drops.some(d => d[0] === r && d[1] === c)) cell.classList.add('valid-move');
        });

        // 持ち駒のハイライト
        const capturedPieces = this.playerCapturedElement.querySelectorAll('.captured-piece');
        // 簡易実装: typeが一致するものをハイライト
        capturedPieces.forEach(el => {
            if (el.textContent === this.getPieceEmoji(this.game.selectedCaptured.type)) {
                el.classList.add('selected');
            }
        });
    }
}

// ローカル対戦（vs コンピュータ）UI
class LocalGameUI extends BaseGameUI {
    constructor() {
        super();
        this.game = new DobutsuShogi();
        this.playerRole = 'sente'; // プレイヤーは常に先手とする（後でランダム化も可）
        this.computerRole = 'gote';
        this.playerName = 'あなた';
        this.opponentName = 'コンピュータ';
        this.canPlay = false;

        this.setup();
    }

    setup() {
        this.welcomeScreen.style.display = 'none';
        this.gameContainer.style.display = 'block';
        this.playerNameElement.textContent = `先手：${this.playerName}`;
        this.opponentNameElement.textContent = `後手：${this.opponentName}`;
        this.messageElement.textContent = '対戦開始！';

        this.render();
        this.showAnnouncement('あなたは先手です', 2000, () => {
            this.canPlay = true;
            this.showAnnouncement('対局開始！', 1000);
        });
    }

    render() {
        this.renderBoard(this.game, this.playerRole);
        this.renderCaptured(this.game, this.playerRole);

        const isPlayerTurn = this.game.currentPlayer === this.playerRole;
        this.turnElement.textContent = isPlayerTurn ? this.playerName : this.opponentName;
        this.turnElement.style.color = isPlayerTurn ? '#28a745' : '#dc3545';

        if (this.game.currentPlayer === this.computerRole) {
            this.canPlay = false;
            setTimeout(() => this.computerMove(), 1000); // 少し待ってから動く
        }
    }

    computerMove() {
        const move = this.game.makeComputerMove();
        if (move) {
            let result;
            if (move.type === 'move') {
                result = this.game.move(move.from[0], move.from[1], move.to[0], move.to[1]);
            } else {
                result = this.game.drop(move.piece, move.to[0], move.to[1]);
            }

            if (result.winner) {
                this.render();
                this.handleGameOver(result.winner);
            } else {
                this.canPlay = true;
                this.render();
            }
        } else {
            // 投了？
            this.handleGameOver(this.playerRole);
        }
    }

    handleCellClick(row, col) {
        if (!this.canPlay || this.game.currentPlayer !== this.playerRole) return;

        // 持ち駒選択中
        if (this.game.selectedCaptured) {
            const validDrops = this.game.getValidDropPositions();
            if (validDrops.some(p => p[0] === row && p[1] === col)) {
                const result = this.game.drop(this.game.selectedCaptured.type, row, col);
                this.game.selectedCaptured = null;
                if (result.winner) {
                    this.render();
                    this.handleGameOver(result.winner);
                } else {
                    this.render();
                }
            } else {
                // キャンセル
                this.game.selectedCaptured = null;
                this.render();
            }
            return;
        }

        const piece = this.game.board[row][col];
        if (!this.game.selectedCell) {
            if (piece && piece.player === this.playerRole) {
                this.game.selectedCell = { row, col };
                this.render();
                this.highlightValidMoves(row, col);
            }
        } else {
            const moves = this.game.getValidMoves(this.game.selectedCell.row, this.game.selectedCell.col);
            if (moves.some(m => m[0] === row && m[1] === col)) {
                const result = this.game.move(
                    this.game.selectedCell.row,
                    this.game.selectedCell.col,
                    row, col
                );
                this.game.selectedCell = null;
                if (result.winner) {
                    this.render();
                    this.handleGameOver(result.winner);
                } else {
                    this.render();
                }
            } else {
                // 選択変更
                if (piece && piece.player === this.playerRole) {
                    this.game.selectedCell = { row, col };
                    this.render();
                    this.highlightValidMoves(row, col);
                } else {
                    this.game.selectedCell = null;
                    this.render();
                }
            }
        }
    }

    handleCapturedClick(player, index, type) {
        if (!this.canPlay || this.game.currentPlayer !== this.playerRole) return;
        this.game.selectedCell = null;
        this.game.selectedCaptured = { type, player };
        this.render();
        this.highlightValidDrops();
    }

    // オンラインと同じハイライトロジック（共通化できればベストだが今回はコピペで）
    highlightValidMoves(row, col) {
        const moves = this.game.getValidMoves(row, col);
        const cells = this.boardElement.querySelectorAll('.cell');
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);
            if (r === row && c === col) cell.classList.add('selected');
            if (moves.some(m => m[0] === r && m[1] === c)) cell.classList.add('valid-move');
        });
    }

    highlightValidDrops() {
        const drops = this.game.getValidDropPositions();
        const cells = this.boardElement.querySelectorAll('.cell');
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);
            if (drops.some(d => d[0] === r && d[1] === c)) cell.classList.add('valid-move');
        });
        const capturedPieces = this.playerCapturedElement.querySelectorAll('.captured-piece');
        capturedPieces.forEach(el => {
            if (el.textContent === this.getPieceEmoji(this.game.selectedCaptured.type)) {
                el.classList.add('selected');
            }
        });
    }

    handleGameOver(winner) {
        this.canPlay = false;
        const youWon = winner === this.playerRole;
        this.messageElement.textContent = youWon ? 'あなたの勝利！' : 'コンピュータの勝利';
        this.messageElement.style.color = youWon ? '#28a745' : '#dc3545';
    }
}


// エントリーポイント
window.addEventListener('DOMContentLoaded', () => {
    const vsComputerBtn = document.getElementById('vs-computer-btn');
    const vsOnlineBtn = document.getElementById('vs-online-btn');

    vsComputerBtn.addEventListener('click', () => {
        new LocalGameUI();
    });

    vsOnlineBtn.addEventListener('click', () => {
        new OnlineGameUI();
    });
});
