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
            niwatori: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]]
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

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'sente' ? 'gote' : 'sente';
    }
}

// オンライン対戦UI管理
class OnlineGameUI {
    constructor() {
        this.game = new DobutsuShogi();
        this.ws = null;
        this.playerRole = null;
        this.playerName = null;
        this.opponentName = null;
        this.isMyTurn = false;
        this.canPlay = false; // ゲーム開始アナウンス後に操作可能になる

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
        this.waitingMessage = document.getElementById('waiting-message');
        this.matchCountElement = null; // 削除

        this.resetBtn.addEventListener('click', () => location.reload());
        this.showNamePrompt();
    }

    showNamePrompt() {
        const name = prompt('プレイヤー名を入力してください:');
        if (name) {
            this.playerName = name;
            // ウェルカム画面は表示したまま、待機メッセージを表示
            this.waitingMessage.textContent = '対戦相手を探しています...';
            this.connectToServer();
        } else {
            this.showNamePrompt();
        }
    }

    connectToServer() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Connected to server');
            this.messageElement.textContent = '対戦相手を探しています...';
            this.ws.send(JSON.stringify({
                type: 'join',
                playerName: this.playerName
            }));
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.messageElement.textContent = 'サーバー接続エラー';
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.messageElement.textContent = 'サーバーから切断されました';
        };
    }

    handleServerMessage(data) {
        switch (data.type) {
            case 'waiting':
                this.waitingMessage.textContent = '対戦相手を待っています...';
                break;

            case 'gameStart':
                // ウェルカム画面を非表示にしてゲーム画面を表示
                this.welcomeScreen.style.display = 'none';
                this.gameContainer.style.display = 'block';

                this.playerRole = data.role;
                this.opponentName = data.opponent;
                this.isMyTurn = (this.playerRole === 'sente');
                this.messageElement.textContent = `対戦開始！ vs ${this.opponentName}`;
                this.resetBtn.textContent = 'タイトルに戻る';
                // matchCount関連削除
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

            // rematch case 削除

            case 'opponentDisconnected':
                this.messageElement.textContent = '相手が切断しました';
                break;
        }
    }

    applyMove(data) {
        const { fromRow, fromCol, toRow, toCol, currentPlayer, captured } = data;

        const piece = this.game.board[fromRow][fromCol];
        this.game.board[toRow][toCol] = piece;
        this.game.board[fromRow][fromCol] = null;

        if (piece.type === 'hiyoko') {
            const promotionRow = piece.player === 'sente' ? 0 : 3;
            if (toRow === promotionRow) {
                this.game.board[toRow][toCol].type = 'niwatori';
            }
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
        const winnerText = data.winner === 'sente' ? '先手' : '後手';
        const youWon = data.winner === this.playerRole;
        this.messageElement.textContent = youWon ? '勝利！' : '敗北...';
        this.messageElement.style.color = youWon ? '#28a745' : '#dc3545';

        // ゲーム終了後は操作不可にする
        this.canPlay = false;

        if (data.move) {
            this.applyMove({ ...data.move, currentPlayer: this.game.currentPlayer, captured: this.game.captured });
        } else if (data.drop) {
            this.applyDrop({ ...data.drop, currentPlayer: this.game.currentPlayer, captured: this.game.captured });
        }
    }

    render() {
        this.renderBoard();
        this.renderCaptured();
        this.updateTurnIndicator();
    }

    updatePlayerNames() {
        if (this.playerName && this.opponentName && this.playerRole) {
            const playerRoleText = this.playerRole === 'sente' ? '先手' : '後手';
            const opponentRoleText = this.playerRole === 'sente' ? '後手' : '先手';

            this.playerNameElement.textContent = `${playerRoleText}：${this.playerName}`;
            this.opponentNameElement.textContent = `${opponentRoleText}：${this.opponentName}`;
        }
    }



    showGameStartAnnouncement() {
        this.canPlay = false; // アナウンス中は操作不可

        // 先手・後手の表示
        const roleText = this.playerRole === 'sente' ? '先手' : '後手';
        this.showAnnouncement(`あなたは${roleText}です`, 2000, () => {
            // 対局開始の表示と同時に操作可能にする
            this.canPlay = true; // 対局開始の表示と同時に操作可能
            this.showAnnouncement('対局開始！', 2000);
        });
    }

    showAnnouncement(text, duration, callback) {
        this.announcementElement.textContent = text;
        this.announcementElement.classList.add('show');

        setTimeout(() => {
            this.announcementElement.classList.remove('show');
            setTimeout(() => {
                if (callback) callback();
            }, 500); // フェードアウトの時間
        }, duration);
    }


    renderBoard() {
        this.boardElement.innerHTML = '';

        // Flip the board if player is gote
        if (this.playerRole === 'gote') {
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

                const piece = this.game.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.player}`;
                    pieceElement.textContent = this.game.getPieceEmoji(piece.type);
                    cell.appendChild(pieceElement);
                }

                cell.addEventListener('click', () => this.handleCellClick(row, col));
                this.boardElement.appendChild(cell);
            }
        }
    }

    renderCaptured() {
        if (!this.playerRole) return;

        this.playerCapturedElement.innerHTML = '';
        this.opponentCapturedElement.innerHTML = '';

        const opponentRole = this.playerRole === 'sente' ? 'gote' : 'sente';

        // 自分の持ち駒を表示
        this.game.captured[this.playerRole].forEach((type, index) => {
            const piece = document.createElement('div');
            piece.className = 'captured-piece';
            piece.textContent = this.game.getPieceEmoji(type);
            piece.addEventListener('click', () => this.handleCapturedClick(this.playerRole, index, type));
            this.playerCapturedElement.appendChild(piece);
        });

        // 相手の持ち駒を表示
        this.game.captured[opponentRole].forEach((type, index) => {
            const piece = document.createElement('div');
            piece.className = 'captured-piece';
            piece.textContent = this.game.getPieceEmoji(type);
            // 相手の持ち駒はクリックできない
            this.opponentCapturedElement.appendChild(piece);
        });
    }

    handleCellClick(row, col) {
        if (!this.canPlay || !this.isMyTurn || !this.playerRole) return;

        if (this.game.selectedCaptured !== null) {
            const validPositions = this.game.getValidDropPositions();
            const isValid = validPositions.some(([r, c]) => r === row && c === col);

            if (isValid) {
                this.ws.send(JSON.stringify({
                    type: 'drop',
                    pieceType: this.game.selectedCaptured.type,
                    row, col
                }));
                this.game.selectedCaptured = null;
                this.render();
            }
            return;
        }

        const piece = this.game.board[row][col];

        if (this.game.selectedCell === null) {
            if (piece && piece.player === this.playerRole) {
                this.game.selectedCell = { row, col };
                this.highlightValidMoves(row, col);
            }
        } else {
            const validMoves = this.game.getValidMoves(this.game.selectedCell.row, this.game.selectedCell.col);
            const isValid = validMoves.some(([r, c]) => r === row && c === col);

            if (isValid) {
                this.ws.send(JSON.stringify({
                    type: 'move',
                    fromRow: this.game.selectedCell.row,
                    fromCol: this.game.selectedCell.col,
                    toRow: row,
                    toCol: col
                }));
                this.game.selectedCell = null;
                this.render();
            } else {
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
        this.game.selectedCaptured = { player, index, type };
        this.render();
        this.highlightValidDrops();
    }

    highlightValidMoves(row, col) {
        const validMoves = this.game.getValidMoves(row, col);
        const cells = this.boardElement.querySelectorAll('.cell');

        cells.forEach(cell => {
            const cellRow = parseInt(cell.dataset.row);
            const cellCol = parseInt(cell.dataset.col);

            if (cellRow === row && cellCol === col) {
                cell.classList.add('selected');
            }
            if (validMoves.some(([r, c]) => r === cellRow && c === cellCol)) {
                cell.classList.add('valid-move');
            }
        });
    }

    highlightValidDrops() {
        const validPositions = this.game.getValidDropPositions();
        const cells = this.boardElement.querySelectorAll('.cell');

        cells.forEach(cell => {
            const cellRow = parseInt(cell.dataset.row);
            const cellCol = parseInt(cell.dataset.col);

            if (validPositions.some(([r, c]) => r === cellRow && c === cellCol)) {
                cell.classList.add('valid-move');
            }
        });

        // プレイヤーの持ち駒エリア内の駒のみをハイライト
        const playerCapturedPieces = this.playerCapturedElement.querySelectorAll('.captured-piece');
        playerCapturedPieces.forEach((piece, idx) => {
            if (this.game.selectedCaptured &&
                this.game.captured[this.playerRole][idx] === this.game.selectedCaptured.type) {
                piece.classList.add('selected');
            }
        });
    }

    updateTurnIndicator() {
        if (!this.playerName || !this.opponentName) return;

        // 現在の手番のプレイヤー名を取得
        const currentPlayerName = this.game.currentPlayer === this.playerRole
            ? this.playerName
            : this.opponentName;

        this.turnElement.textContent = currentPlayerName;

        if (this.isMyTurn) {
            this.turnElement.style.color = '#28a745';
        } else {
            this.turnElement.style.color = '#dc3545';
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new OnlineGameUI();
});
