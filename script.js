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

    checkWinCondition() {
        // ライオンが取られたかチェック
        let senteLionExists = false;
        let goteLionExists = false;

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                const piece = this.board[row][col];
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
            if (this.board[0][col]?.type === 'lion' && this.board[0][col]?.player === 'sente') return 'sente';
            if (this.board[3][col]?.type === 'lion' && this.board[3][col]?.player === 'gote') return 'gote';
        }

        return null;
    }

    getAllPossibleMoves(player) {
        const moves = [];
        const originalPlayer = this.currentPlayer;
        this.currentPlayer = player;
        
        // 盤上の駒の移動
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                const piece = this.board[row][col];
                if (piece && piece.player === player) {
                    const validMoves = this.getValidMoves(row, col);
                    for (const [toRow, toCol] of validMoves) {
                        moves.push({ type: 'move', fromRow: row, fromCol: col, toRow, toCol });
                    }
                }
            }
        }

        // 持ち駒の打ち
        const captured = this.captured[player];
        const uniquePieces = [...new Set(captured)];
        const validPositions = this.getValidDropPositions();
        
        for (const pieceType of uniquePieces) {
            for (const [row, col] of validPositions) {
                moves.push({ type: 'drop', pieceType, row, col });
            }
        }

        this.currentPlayer = originalPlayer;
        return moves;
    }

    makeMove(move) {
        if (move.type === 'move') {
            const { fromRow, fromCol, toRow, toCol } = move;
            const piece = this.board[fromRow][fromCol];
            const captured = this.board[toRow][toCol];

            // 駒を取った場合
            if (captured) {
                let capturedType = captured.type;
                if (capturedType === 'niwatori') {
                    capturedType = 'hiyoko';
                }
                this.captured[this.currentPlayer].push(capturedType);
            }

            // 駒を移動
            this.board[toRow][toCol] = piece;
            this.board[fromRow][fromCol] = null;

            // ひよこの成り判定
            if (piece.type === 'hiyoko') {
                const promotionRow = piece.player === 'sente' ? 0 : 3;
                if (toRow === promotionRow) {
                    this.board[toRow][toCol].type = 'niwatori';
                }
            }
        } else if (move.type === 'drop') {
            const { pieceType, row, col } = move;
            this.board[row][col] = { type: pieceType, player: this.currentPlayer };
            
            // 持ち駒から削除
            const index = this.captured[this.currentPlayer].indexOf(pieceType);
            if (index > -1) {
                this.captured[this.currentPlayer].splice(index, 1);
            }
        }

        this.switchPlayer();
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
        this.rematchConfirmation = document.getElementById('rematch-confirmation');
        this.rematchYesBtn = document.getElementById('rematch-yes-btn');
        this.rematchNoBtn = document.getElementById('rematch-no-btn');

        this.resetBtn.addEventListener('click', () => location.reload());
        this.rematchYesBtn.addEventListener('click', () => this.handleRematchYes());
        this.rematchNoBtn.addEventListener('click', () => this.handleRematchNo());
    }

    connectToServer() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Connected to server');
            this.messageElement.textContent = '対戦相手を探しています...';
            if (this.playerName) {
                this.ws.send(JSON.stringify({
                    type: 'join',
                    playerName: this.playerName
                }));
            }
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

            case 'rematchRequested':
                // 相手が再戦を希望している
                this.messageElement.textContent = '相手が再戦を希望しています';
                break;

            case 'rematchAccepted':
                this.handleRematchAccepted(data);
                break;

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
        const resultText = youWon ? '勝利！' : '敗北...';
        
        this.messageElement.textContent = resultText;
        this.messageElement.style.color = youWon ? '#28a745' : '#dc3545';

        // ゲーム終了後は操作不可にする
        this.canPlay = false;

        if (data.move) {
            this.applyMove({ ...data.move, currentPlayer: this.game.currentPlayer, captured: this.game.captured });
        } else if (data.drop) {
            this.applyDrop({ ...data.drop, currentPlayer: this.game.currentPlayer, captured: this.game.captured });
        }

        // 盤上に大きく勝敗を表示
        this.showGameOverAnnouncement(resultText, youWon);
    }

    showGameOverAnnouncement(text, isWin) {
        this.announcementElement.textContent = text;
        this.announcementElement.style.color = isWin ? '#28a745' : '#dc3545';
        this.announcementElement.style.textShadow = isWin 
            ? '0 0 20px rgba(40, 167, 69, 0.8), 0 0 40px rgba(40, 167, 69, 0.6)' 
            : '0 0 20px rgba(220, 53, 69, 0.8), 0 0 40px rgba(220, 53, 69, 0.6)';
        this.announcementElement.classList.add('show', 'game-over');
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

// AI対戦UI管理
class AIGameUI {
    constructor() {
        this.game = new DobutsuShogi();
        this.playerRole = 'sente'; // プレイヤーは常に先手
        this.isMyTurn = true;
        this.canPlay = false;

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
        this.rematchConfirmation = document.getElementById('rematch-confirmation');
        this.rematchYesBtn = document.getElementById('rematch-yes-btn');
        this.rematchNoBtn = document.getElementById('rematch-no-btn');

        this.resetBtn.addEventListener('click', () => location.reload());
        this.rematchYesBtn.addEventListener('click', () => this.handleRematchYes());
        this.rematchNoBtn.addEventListener('click', () => this.handleRematchNo());
        this.startGame();
    }

    startGame() {
        this.welcomeScreen.style.display = 'none';
        this.gameContainer.style.display = 'block';
        this.playerNameElement.textContent = '先手：あなた';
        this.opponentNameElement.textContent = '後手：コンピューター';
        this.resetBtn.textContent = 'タイトルに戻る';
        this.render();
        this.showGameStartAnnouncement();
    }

    showGameStartAnnouncement() {
        this.canPlay = false;
        this.showAnnouncement('あなたは先手です', 2000, () => {
            this.canPlay = true;
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
            }, 500);
        }, duration);
    }

    render() {
        this.renderBoard();
        this.renderCaptured();
        this.updateTurnIndicator();
    }

    renderBoard() {
        this.boardElement.innerHTML = '';
        this.boardElement.classList.remove('flipped');

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
        this.playerCapturedElement.innerHTML = '';
        this.opponentCapturedElement.innerHTML = '';

        // 自分の持ち駒を表示
        this.game.captured.sente.forEach((type, index) => {
            const piece = document.createElement('div');
            piece.className = 'captured-piece';
            piece.textContent = this.game.getPieceEmoji(type);
            piece.addEventListener('click', () => this.handleCapturedClick('sente', index, type));
            this.playerCapturedElement.appendChild(piece);
        });

        // AIの持ち駒を表示
        this.game.captured.gote.forEach((type, index) => {
            const piece = document.createElement('div');
            piece.className = 'captured-piece';
            piece.textContent = this.game.getPieceEmoji(type);
            this.opponentCapturedElement.appendChild(piece);
        });
    }

    handleCellClick(row, col) {
        if (!this.canPlay || !this.isMyTurn) return;

        if (this.game.selectedCaptured !== null) {
            const validPositions = this.game.getValidDropPositions();
            const isValid = validPositions.some(([r, c]) => r === row && c === col);

            if (isValid) {
                this.executeDrop(this.game.selectedCaptured.type, row, col);
                this.game.selectedCaptured = null;
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
                this.executeMove(this.game.selectedCell.row, this.game.selectedCell.col, row, col);
                this.game.selectedCell = null;
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

    executeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.game.board[fromRow][fromCol];
        const captured = this.game.board[toRow][toCol];

        if (captured) {
            let capturedType = captured.type;
            if (capturedType === 'niwatori') {
                capturedType = 'hiyoko';
            }
            this.game.captured[this.game.currentPlayer].push(capturedType);
        }

        this.game.board[toRow][toCol] = piece;
        this.game.board[fromRow][fromCol] = null;

        if (piece.type === 'hiyoko') {
            const promotionRow = piece.player === 'sente' ? 0 : 3;
            if (toRow === promotionRow) {
                this.game.board[toRow][toCol].type = 'niwatori';
            }
        }

        const winner = this.game.checkWinCondition();
        if (winner) {
            this.handleGameOver(winner);
            return;
        }

        this.game.switchPlayer();
        this.isMyTurn = false;
        this.render();
        
        setTimeout(() => {
            this.makeAIMove();
        }, 500);
    }

    executeDrop(pieceType, row, col) {
        this.game.board[row][col] = { type: pieceType, player: this.game.currentPlayer };
        
        const index = this.game.captured[this.game.currentPlayer].indexOf(pieceType);
        if (index > -1) {
            this.game.captured[this.game.currentPlayer].splice(index, 1);
        }

        const winner = this.game.checkWinCondition();
        if (winner) {
            this.handleGameOver(winner);
            return;
        }

        this.game.switchPlayer();
        this.isMyTurn = false;
        this.render();
        
        setTimeout(() => {
            this.makeAIMove();
        }, 500);
    }

    makeAIMove() {
        const possibleMoves = this.game.getAllPossibleMoves('gote');
        if (possibleMoves.length === 0) {
            this.handleGameOver('sente');
            return;
        }

        // AIの手を選択（より良い手を選ぶ）
        const bestMove = this.selectBestMove(possibleMoves);
        
        // ゲーム状態を保存
        const gameCopy = JSON.parse(JSON.stringify({
            board: this.game.board.map(row => row.map(cell => cell ? {...cell} : null)),
            captured: {
                sente: [...this.game.captured.sente],
                gote: [...this.game.captured.gote]
            },
            currentPlayer: this.game.currentPlayer
        }));

        this.game.makeMove(bestMove);

        const winner = this.game.checkWinCondition();
        if (winner) {
            this.handleGameOver(winner);
            return;
        }

        this.isMyTurn = true;
        this.render();
    }

    selectBestMove(moves) {
        // 勝利できる手を探す
        for (const move of moves) {
            const gameCopy = new DobutsuShogi();
            // initBoard()で初期化されたboardを上書き
            gameCopy.board = this.game.board.map(row => 
                row.map(cell => cell ? {...cell} : null)
            );
            gameCopy.captured = {
                sente: [...this.game.captured.sente],
                gote: [...this.game.captured.gote]
            };
            gameCopy.currentPlayer = 'gote'; // AIは後手

            gameCopy.makeMove(move);
            const winner = gameCopy.checkWinCondition();
            if (winner === 'gote') {
                return move;
            }
        }

        // 相手のライオンを取れる手を探す
        for (const move of moves) {
            if (move.type === 'move') {
                const targetPiece = this.game.board[move.toRow][move.toCol];
                if (targetPiece && targetPiece.type === 'lion' && targetPiece.player === 'sente') {
                    return move;
                }
            }
        }

        // 自分のライオンを守る手を優先
        const defensiveMoves = [];
        for (const move of moves) {
            if (move.type === 'move') {
                const piece = this.game.board[move.fromRow][move.fromCol];
                if (piece && piece.type === 'lion') {
                    // ライオンを安全な場所に移動
                    const isSafe = this.isSafePosition(move.toRow, move.toCol, 'gote');
                    if (isSafe) {
                        defensiveMoves.push(move);
                    }
                }
            }
        }
        if (defensiveMoves.length > 0) {
            return defensiveMoves[Math.floor(Math.random() * defensiveMoves.length)];
        }

        // 相手の駒を取れる手を優先
        const captureMoves = moves.filter(move => {
            if (move.type === 'move') {
                return this.game.board[move.toRow][move.toCol] !== null;
            }
            return false;
        });
        if (captureMoves.length > 0) {
            return captureMoves[Math.floor(Math.random() * captureMoves.length)];
        }

        // ランダムに選択
        return moves[Math.floor(Math.random() * moves.length)];
    }

    isSafePosition(row, col, player) {
        // その位置が相手の攻撃範囲内かチェック
        const opponent = player === 'sente' ? 'gote' : 'sente';
        const originalPlayer = this.game.currentPlayer;
        this.game.currentPlayer = opponent;
        
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 3; c++) {
                const piece = this.game.board[r][c];
                if (piece && piece.player === opponent) {
                    const validMoves = this.game.getValidMoves(r, c);
                    if (validMoves.some(([toR, toC]) => toR === row && toC === col)) {
                        this.game.currentPlayer = originalPlayer;
                        return false;
                    }
                }
            }
        }
        
        this.game.currentPlayer = originalPlayer;
        return true;
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

        const playerCapturedPieces = this.playerCapturedElement.querySelectorAll('.captured-piece');
        playerCapturedPieces.forEach((piece, idx) => {
            if (this.game.selectedCaptured &&
                this.game.captured[this.playerRole][idx] === this.game.selectedCaptured.type) {
                piece.classList.add('selected');
            }
        });
    }

    updateTurnIndicator() {
        if (this.isMyTurn) {
            this.turnElement.textContent = 'あなた';
            this.turnElement.style.color = '#28a745';
        } else {
            this.turnElement.textContent = 'コンピューター';
            this.turnElement.style.color = '#dc3545';
        }
    }

    handleGameOver(winner) {
        const youWon = winner === this.playerRole;
        const resultText = youWon ? '勝利！' : '敗北...';
        
        this.messageElement.textContent = resultText;
        this.messageElement.style.color = youWon ? '#28a745' : '#dc3545';
        this.canPlay = false;
        this.isMyTurn = false;

        // 盤上に大きく勝敗を表示
        this.showGameOverAnnouncement(resultText, youWon);
    }

    showGameOverAnnouncement(text, isWin) {
        this.announcementElement.textContent = text;
        this.announcementElement.style.color = isWin ? '#28a745' : '#dc3545';
        this.announcementElement.style.textShadow = isWin 
            ? '0 0 20px rgba(40, 167, 69, 0.8), 0 0 40px rgba(40, 167, 69, 0.6)' 
            : '0 0 20px rgba(220, 53, 69, 0.8), 0 0 40px rgba(220, 53, 69, 0.6)';
        this.announcementElement.classList.add('show', 'game-over');
        
        // 2秒後に再戦確認を表示
        setTimeout(() => {
            this.showRematchConfirmation();
        }, 2000);
    }

    showRematchConfirmation() {
        this.rematchConfirmation.style.display = 'flex';
    }

    handleRematchYes() {
        this.rematchConfirmation.style.display = 'none';
        // AI対戦の場合は即座に再戦開始
        this.startRematch();
    }

    handleRematchNo() {
        this.rematchConfirmation.style.display = 'none';
        // タイトルに戻る
        location.reload();
    }

    startRematch() {
        // ゲームをリセット
        this.game.initBoard();
        this.game.currentPlayer = 'sente';
        this.isMyTurn = true;
        this.canPlay = false;
        
        // アナウンスを非表示
        this.announcementElement.classList.remove('show', 'game-over');
        
        // プレイヤー名を更新
        this.playerNameElement.textContent = '先手：あなた';
        this.opponentNameElement.textContent = '後手：コンピューター';
        
        this.render();
        this.showGameStartAnnouncement();
    }
}

// ゲームモード管理
class GameModeManager {
    constructor() {
        this.modeSelection = document.getElementById('mode-selection');
        this.onlineModeBtn = document.getElementById('online-mode-btn');
        this.aiModeBtn = document.getElementById('ai-mode-btn');
        this.waitingMessage = document.getElementById('waiting-message');

        this.onlineModeBtn.addEventListener('click', () => this.startOnlineMode());
        this.aiModeBtn.addEventListener('click', () => this.startAIMode());
    }

    startOnlineMode() {
        this.modeSelection.style.display = 'none';
        const name = prompt('プレイヤー名を入力してください:');
        if (name) {
            this.waitingMessage.textContent = '対戦相手を探しています...';
            const ui = new OnlineGameUI();
            ui.playerName = name;
            ui.connectToServer();
        } else {
            // キャンセルされた場合はモード選択に戻る
            this.modeSelection.style.display = 'block';
            this.waitingMessage.textContent = '';
        }
    }

    startAIMode() {
        this.modeSelection.style.display = 'none';
        this.waitingMessage.textContent = '';
        new AIGameUI();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new GameModeManager();
});
