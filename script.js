// 動物将棋のゲームロジック
class DobutsuShogi {
    constructor() {
        this.board = Array(4).fill(null).map(() => Array(3).fill(null));
        this.currentPlayer = 'sente';
        this.selectedCell = null;
        this.selectedCaptured = null;
        this.captured = { sente: [], gote: [] };
        this.positionHistory = []; // 千日手判定用の状態履歴
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
        this.positionHistory = []; // 状態履歴をリセット
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

    // 盤面状態を文字列化（千日手判定用）
    getPositionKey() {
        // 盤面を文字列化
        let boardStr = '';
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    boardStr += `${row},${col},${piece.type},${piece.player};`;
                } else {
                    boardStr += `${row},${col},null;`;
                }
            }
        }
        // 持ち駒をソートして文字列化（順序を統一）
        const senteCaptured = [...this.captured.sente].sort().join(',');
        const goteCaptured = [...this.captured.gote].sort().join(',');
        // 手番を含める
        return `${boardStr}|${senteCaptured}|${goteCaptured}|${this.currentPlayer}`;
    }

    checkWinCondition() {
        // ライオンが取られたかチェック
        let senteLionExists = false;
        let goteLionExists = false;
        let senteLionPos = null;
        let goteLionPos = null;

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                const piece = this.board[row][col];
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
        const currentPosition = this.getPositionKey();
        let repetitionCount = 0;
        for (const position of this.positionHistory) {
            if (position === currentPosition) {
                repetitionCount++;
            }
        }
        if (repetitionCount >= 2) { // 現在の状態を含めて3回（履歴に2回 + 現在）
            return 'draw';
        }

        // ライオンが相手陣地の最奥に入ったかチェック
        // 先手のライオンが後手陣地（row=0）に入った場合
        if (senteLionPos && senteLionPos.row === 0) {
            // 次の相手（後手）の番でライオンが取られる可能性をチェック
            const opponentMoves = this.getAllPossibleMoves('gote');
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

        // 後手のライオンが先手陣地（row=3）に入った場合
        if (goteLionPos && goteLionPos.row === 3) {
            // 次の相手（先手）の番でライオンが取られる可能性をチェック
            const opponentMoves = this.getAllPossibleMoves('sente');
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
            // にわとりを打つ場合はひよことして打つ
            const actualPieceType = pieceType === 'niwatori' ? 'hiyoko' : pieceType;
            for (const [row, col] of validPositions) {
                moves.push({ type: 'drop', pieceType: actualPieceType, row, col });
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
            // にわとりを打つ場合はひよことして打つ
            const actualPieceType = pieceType === 'niwatori' ? 'hiyoko' : pieceType;
            this.board[row][col] = { type: actualPieceType, player: this.currentPlayer };

            // 持ち駒から削除（niwatoriの場合はhiyokoとして削除）
            const index = this.captured[this.currentPlayer].indexOf(actualPieceType);
            if (index > -1) {
                this.captured[this.currentPlayer].splice(index, 1);
            }
        }

        this.switchPlayer();

        // 千日手判定用に状態を記録（手番交代後の状態）
        const positionKey = this.getPositionKey();
        this.positionHistory.push(positionKey);
        // 履歴が長くなりすぎないように、最新100手分のみ保持
        if (this.positionHistory.length > 100) {
            this.positionHistory.shift();
        }
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
        this.showEvaluation = false; // 評価表示のON/OFF
        this.moveHistory = []; // 手の履歴（感想戦用）
        this.currentReviewMove = 0; // 感想戦モードの現在の手
        this.isReviewMode = false; // 感想戦モードかどうか

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
        this.toggleEvalBtn = document.getElementById('toggle-eval-btn');
        this.positionEvaluation = document.getElementById('position-evaluation');
        this.evalValue = document.getElementById('eval-value');
        this.evalMethodInfo = document.getElementById('eval-method-info');
        this.gameRecord = document.getElementById('game-record');
        this.recordList = document.getElementById('record-list');
        this.recordToggleBtn = document.getElementById('record-toggle-btn');
        this.recordContent = document.getElementById('record-content');
        this.recordCollapsed = false;
        this.reviewPrevBtn = document.getElementById('review-prev-btn');
        this.reviewNextBtn = document.getElementById('review-next-btn');
        this.reviewMoveInfo = document.getElementById('review-move-info');
        this.reviewControlsPanel = document.getElementById('review-controls-panel');

        this.resetBtn.addEventListener('click', () => location.reload());
        this.rematchYesBtn.addEventListener('click', () => this.handleRematchYes());
        this.rematchNoBtn.addEventListener('click', () => this.handleRematchNo());
        if (this.toggleEvalBtn) {
            this.toggleEvalBtn.addEventListener('click', () => this.toggleEvaluation());
        }
        if (this.recordToggleBtn) {
            this.recordToggleBtn.addEventListener('click', () => this.toggleRecord());
        }
        if (this.reviewPrevBtn) {
            this.reviewPrevBtn.addEventListener('click', () => this.reviewPreviousMove());
        }
        if (this.reviewNextBtn) {
            this.reviewNextBtn.addEventListener('click', () => this.reviewNextMove());
        }
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

        // 手の履歴に追加（手を打つ前の状態を保存）
        const pieceAtDest = this.game.board[toRow][toCol];
        const moveData = {
            type: 'move',
            fromRow, fromCol, toRow, toCol,
            player: currentPlayer,
            captured: pieceAtDest ? pieceAtDest.type : null,
            boardState: this.game.board.map(row => row.map(cell => cell ? { ...cell } : null)),
            capturedState: {
                sente: [...this.game.captured.sente],
                gote: [...this.game.captured.gote]
            },
            evaluation: undefined // オンライン対戦では評価なし
        };
        this.moveHistory.push(moveData);

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

        // にわとりを打つ場合はひよことして打つ
        const actualPieceType = pieceType === 'niwatori' ? 'hiyoko' : pieceType;

        // 手の履歴に追加（手を打つ前の状態を保存）
        const moveData = {
            type: 'drop',
            pieceType: actualPieceType, row, col,
            player: currentPlayer,
            boardState: this.game.board.map(row => row.map(cell => cell ? { ...cell } : null)),
            capturedState: {
                sente: [...this.game.captured.sente],
                gote: [...this.game.captured.gote]
            },
            evaluation: undefined // オンライン対戦では評価なし
        };
        this.moveHistory.push(moveData);

        this.game.board[row][col] = { type: actualPieceType, player: this.game.currentPlayer };
        this.game.captured = captured;
        this.game.currentPlayer = currentPlayer;
        this.isMyTurn = (this.playerRole === currentPlayer);
        this.render();
    }

    handleGameOver(data) {
        if (data.winner === 'draw') {
            // 引き分け（千日手）
            const resultText = '引き分け（千日手）';
            this.messageElement.textContent = resultText;
            this.messageElement.style.color = '#667eea';

            // ゲーム終了後は操作不可にする
            this.canPlay = false;

            if (data.move) {
                this.applyMove({ ...data.move, currentPlayer: this.game.currentPlayer, captured: this.game.captured });
            } else if (data.drop) {
                this.applyDrop({ ...data.drop, currentPlayer: this.game.currentPlayer, captured: this.game.captured });
            }

            // 盤上に大きく引き分けを表示
            this.showGameOverAnnouncement(resultText, null);

            // 感想戦モードを開始（少し遅延を入れる）
            setTimeout(() => {
                this.startReviewMode();
            }, 2000);
            return;
        }

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

        // 感想戦モードを開始（少し遅延を入れる）
        setTimeout(() => {
            this.startReviewMode();
        }, 2000);
    }

    showGameOverAnnouncement(text, isWin) {
        this.announcementElement.textContent = text;
        if (isWin === null) {
            // 引き分け
            this.announcementElement.style.color = '#667eea';
            this.announcementElement.style.textShadow = '0 0 20px rgba(102, 126, 234, 0.8), 0 0 40px rgba(102, 126, 234, 0.6)';
        } else {
            this.announcementElement.style.color = isWin ? '#28a745' : '#dc3545';
            this.announcementElement.style.textShadow = isWin
                ? '0 0 20px rgba(40, 167, 69, 0.8), 0 0 40px rgba(40, 167, 69, 0.6)'
                : '0 0 20px rgba(220, 53, 69, 0.8), 0 0 40px rgba(220, 53, 69, 0.6)';
        }
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

                // 後手プレイヤーの場合、表示上の座標を反転
                let displayRow = row;
                let displayCol = col;
                if (this.playerRole === 'gote') {
                    displayRow = 3 - row;
                    displayCol = 2 - col;
                }

                cell.dataset.row = displayRow;
                cell.dataset.col = displayCol;
                cell.dataset.serverRow = row; // サーバー座標も保存
                cell.dataset.serverCol = col;

                const piece = this.game.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.player}`;
                    pieceElement.textContent = this.game.getPieceEmoji(piece.type);
                    cell.appendChild(pieceElement);
                }

                // クリックイベントには表示上の座標を渡す（後手の場合は反転済み）
                cell.addEventListener('click', () => this.handleCellClick(displayRow, displayCol));
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

    // 後手プレイヤーの場合、表示上の座標をサーバー座標系に変換
    convertToServerCoordinates(row, col) {
        if (this.playerRole === 'gote') {
            // 後手の場合は盤面が180度回転しているので、座標を反転
            return { row: 3 - row, col: 2 - col };
        }
        return { row, col };
    }

    handleCellClick(row, col) {
        if (!this.canPlay || !this.isMyTurn || !this.playerRole) return;

        // サーバー座標系に変換
        const serverCoords = this.convertToServerCoordinates(row, col);
        const serverRow = serverCoords.row;
        const serverCol = serverCoords.col;

        if (this.game.selectedCaptured !== null) {
            const validPositions = this.game.getValidDropPositions();
            const isValid = validPositions.some(([r, c]) => r === serverRow && c === serverCol);

            if (isValid) {
                this.ws.send(JSON.stringify({
                    type: 'drop',
                    pieceType: this.game.selectedCaptured.type,
                    row: serverRow,
                    col: serverCol
                }));
                this.game.selectedCaptured = null;
                this.render();
            }
            return;
        }

        const piece = this.game.board[serverRow][serverCol];

        if (this.game.selectedCell === null) {
            if (piece && piece.player === this.playerRole) {
                this.game.selectedCell = { row: serverRow, col: serverCol };
                this.highlightValidMoves(serverRow, serverCol);
            }
        } else {
            const validMoves = this.game.getValidMoves(this.game.selectedCell.row, this.game.selectedCell.col);
            const isValid = validMoves.some(([r, c]) => r === serverRow && c === serverCol);

            if (isValid) {
                this.ws.send(JSON.stringify({
                    type: 'move',
                    fromRow: this.game.selectedCell.row,
                    fromCol: this.game.selectedCell.col,
                    toRow: serverRow,
                    toCol: serverCol
                }));
                this.game.selectedCell = null;
                this.render();
            } else {
                if (piece && piece.player === this.playerRole) {
                    this.game.selectedCell = { row: serverRow, col: serverCol };
                    this.render();
                    this.highlightValidMoves(serverRow, serverCol);
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
            const serverRow = parseInt(cell.dataset.serverRow);
            const serverCol = parseInt(cell.dataset.serverCol);

            if (serverRow === row && serverCol === col) {
                cell.classList.add('selected');
            }
            if (validMoves.some(([r, c]) => r === serverRow && c === serverCol)) {
                cell.classList.add('valid-move');
            }
        });
    }

    highlightValidDrops() {
        const validPositions = this.game.getValidDropPositions();
        const cells = this.boardElement.querySelectorAll('.cell');

        cells.forEach(cell => {
            const serverRow = parseInt(cell.dataset.serverRow);
            const serverCol = parseInt(cell.dataset.serverCol);

            if (validPositions.some(([r, c]) => r === serverRow && c === serverCol)) {
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

    // 感想戦モードを開始
    startReviewMode() {
        if (this.moveHistory.length === 0) {
            alert('手の履歴がありません');
            return;
        }

        // 再戦確認を非表示
        if (this.rematchConfirmation) {
            this.rematchConfirmation.style.display = 'none';
        }

        // 棋譜を表示
        if (this.gameRecord) {
            this.gameRecord.style.display = 'block';
            this.updateGameRecordForReview();
        }

        // 左側のコントロールパネルを表示
        const reviewControlsPanel = document.getElementById('review-controls-panel');
        if (reviewControlsPanel) {
            reviewControlsPanel.style.display = 'flex';
        }

        // 勝敗表示を非表示にする
        if (this.announcementElement) {
            this.announcementElement.classList.remove('show', 'game-over');
            this.announcementElement.textContent = '';
        }

        // 感想戦モードを有効化
        this.isReviewMode = true;

        // 評価表示をONにする
        this.showEvaluation = true;
        if (this.toggleEvalBtn) {
            this.toggleEvalBtn.textContent = '評価表示: ON';
            this.toggleEvalBtn.classList.add('active');
        }
        this.updatePositionEvaluation();

        // 終局局面から開始（最後の手の状態）
        this.currentReviewMove = this.moveHistory.length - 1;
        this.restoreGameState(this.currentReviewMove);
        this.updateReviewMoveInfo();

        // 「感想戦」というメッセージを表示
        if (this.messageElement) {
            this.messageElement.textContent = '感想戦';
            this.messageElement.style.color = '#667eea';
        }
    }

    // 前の手に戻る
    reviewPreviousMove() {
        if (this.currentReviewMove >= 0) {
            this.currentReviewMove--;
            if (this.currentReviewMove < 0) {
                this.currentReviewMove = -1; // 初期局面
            }
            this.restoreGameState(this.currentReviewMove);
            this.updateReviewMoveInfo();
        }
    }

    // 次の手に進む
    reviewNextMove() {
        if (this.currentReviewMove < this.moveHistory.length - 1) {
            this.currentReviewMove++;
            this.restoreGameState(this.currentReviewMove);
            this.updateReviewMoveInfo();
        }
    }

    // 感想戦の手数情報を更新
    updateReviewMoveInfo() {
        if (this.reviewMoveInfo) {
            const currentMove = this.currentReviewMove === -1 ? 0 : this.currentReviewMove + 1;
            const totalMoves = this.moveHistory.length;
            this.reviewMoveInfo.textContent = `${currentMove}手目 / ${totalMoves}手`;
        }

        // ボタンの有効/無効を更新
        if (this.reviewPrevBtn) {
            this.reviewPrevBtn.disabled = this.currentReviewMove === -1;
        }
        if (this.reviewNextBtn) {
            this.reviewNextBtn.disabled = this.currentReviewMove >= this.moveHistory.length - 1;
        }
    }

    // 感想戦用の棋譜を更新（手数をクリック可能にする）
    updateGameRecordForReview() {
        if (!this.gameRecord || !this.recordList) return;

        this.recordList.innerHTML = '';

        // 初期局面も表示（0手目）
        const initialItem = document.createElement('div');
        initialItem.className = 'record-item initial-position';
        const initialRow = document.createElement('div');
        initialRow.className = 'record-item-row';
        const initialNumber = document.createElement('div');
        initialNumber.className = 'record-move-number clickable';
        initialNumber.textContent = '0';
        initialNumber.style.cursor = 'pointer';
        initialNumber.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.currentReviewMove = -1;
            this.restoreGameState(-1);
            this.updateReviewMoveInfo();
        }, true);
        initialRow.appendChild(initialNumber);
        const initialText = document.createElement('div');
        initialText.className = 'record-move-text';
        initialText.textContent = '開始局面';
        initialRow.appendChild(initialText);
        initialItem.appendChild(initialRow);
        this.recordList.appendChild(initialItem);

        // 各手を表示
        this.moveHistory.forEach((move, index) => {
            const recordItem = document.createElement('div');
            const isPlayerMove = move.player === this.playerRole;
            recordItem.className = `record-item ${isPlayerMove ? 'player-move' : 'ai-move'}`;

            const row = document.createElement('div');
            row.className = 'record-item-row';

            // 手数（クリック可能）
            const moveNumber = document.createElement('div');
            moveNumber.className = 'record-move-number clickable';
            moveNumber.textContent = `${index + 1}`;
            moveNumber.style.cursor = 'pointer';
            moveNumber.style.textDecoration = 'underline';
            moveNumber.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.currentReviewMove = index;
                this.restoreGameState(index);
                this.updateReviewMoveInfo();
            }, true);
            row.appendChild(moveNumber);

            // 手の内容（クリック可能）
            const moveText = document.createElement('div');
            moveText.className = 'record-move-text clickable';
            moveText.textContent = this.formatMove(move);
            moveText.style.cursor = 'pointer';
            moveText.style.textDecoration = 'underline';
            moveText.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.currentReviewMove = index;
                this.restoreGameState(index);
                this.updateReviewMoveInfo();
            }, true);
            row.appendChild(moveText);

            // 評価点（オンライン対戦では評価なし）
            const evalDiv = document.createElement('div');
            evalDiv.className = 'record-eval';
            evalDiv.textContent = '-';
            row.appendChild(evalDiv);

            recordItem.appendChild(row);
            this.recordList.appendChild(recordItem);
        });
    }

    // 指定した手の状態にゲームを復元
    restoreGameState(moveIndex) {
        // 初期局面（-1）の場合は初期状態に戻す
        if (moveIndex < 0) {
            this.game = new DobutsuShogi();
            this.game.currentPlayer = 'sente';
            this.render();
            return;
        }

        if (moveIndex >= this.moveHistory.length) {
            if (this.moveHistory.length > 0) {
                moveIndex = this.moveHistory.length - 1;
            } else {
                return;
            }
        }

        const move = this.moveHistory[moveIndex];
        if (!move || !move.boardState) {
            return;
        }

        // 手を打つ前の状態を復元
        const newBoard = move.boardState.map(row =>
            row.map(cell => cell ? { ...cell } : null)
        );
        const newCaptured = {
            sente: [...move.capturedState.sente],
            gote: [...move.capturedState.gote]
        };

        // 盤面と持ち駒を直接置き換え
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                this.game.board[row][col] = newBoard[row][col];
            }
        }
        this.game.captured.sente = newCaptured.sente;
        this.game.captured.gote = newCaptured.gote;
        this.game.currentPlayer = move.player || 'sente';

        // その手を適用して、手を打った後の状態にする
        try {
            if (move.type === 'move') {
                const { fromRow, fromCol, toRow, toCol } = move;
                const piece = this.game.board[fromRow][fromCol];

                if (!piece) {
                    return;
                }

                const captured = this.game.board[toRow][toCol];

                // 駒を取った場合
                if (captured) {
                    let capturedType = captured.type;
                    if (capturedType === 'niwatori') {
                        capturedType = 'hiyoko';
                    }
                    this.game.captured[this.game.currentPlayer].push(capturedType);
                }

                // 駒を移動
                this.game.board[toRow][toCol] = { ...piece };
                this.game.board[fromRow][fromCol] = null;

                // ひよこの成り判定
                if (piece.type === 'hiyoko') {
                    const promotionRow = piece.player === 'sente' ? 0 : 3;
                    if (toRow === promotionRow) {
                        this.game.board[toRow][toCol].type = 'niwatori';
                    }
                }

                this.game.switchPlayer();
            } else if (move.type === 'drop') {
                const { pieceType, row, col } = move;
                // にわとりを打つ場合はひよことして打つ
                const actualPieceType = pieceType === 'niwatori' ? 'hiyoko' : pieceType;
                this.game.board[row][col] = { type: actualPieceType, player: this.game.currentPlayer };

                const index = this.game.captured[this.game.currentPlayer].indexOf(actualPieceType);
                if (index > -1) {
                    this.game.captured[this.game.currentPlayer].splice(index, 1);
                }

                this.game.switchPlayer();
            }
        } catch (error) {
            console.error('Error restoring game state:', error);
            return;
        }

        // 盤面と持ち駒を再描画
        this.renderBoard();
        this.renderCaptured();
        this.updateTurnIndicator();
        if (this.showEvaluation) {
            this.updatePositionEvaluation();
        }
    }

    // 評価表示のON/OFF切り替え
    toggleEvaluation() {
        this.showEvaluation = !this.showEvaluation;
        if (this.toggleEvalBtn) {
            this.toggleEvalBtn.textContent = `評価表示: ${this.showEvaluation ? 'ON' : 'OFF'}`;
            this.toggleEvalBtn.classList.toggle('active', this.showEvaluation);
        }
        this.updatePositionEvaluation();
        if (!this.isReviewMode) {
            this.updateGameRecord();
        }
    }

    // 棋譜の折りたたみ/展開
    toggleRecord() {
        if (!this.recordContent) return;

        this.recordCollapsed = !this.recordCollapsed;
        this.recordContent.style.display = this.recordCollapsed ? 'none' : 'block';
        if (this.recordToggleBtn) {
            this.recordToggleBtn.textContent = this.recordCollapsed ? '展開' : '折りたたむ';
        }
    }

    // 局面評価を更新（簡易版 - オンライン対戦では評価関数なし）
    updatePositionEvaluation() {
        if (!this.showEvaluation || !this.positionEvaluation) return;

        // オンライン対戦では評価関数がないため、簡易的な表示のみ
        if (this.evalValue) {
            this.evalValue.textContent = '-';
        }
        if (this.evalMethodInfo) {
            this.evalMethodInfo.textContent = 'オンライン対戦では評価機能は利用できません';
        }
        this.positionEvaluation.style.display = 'flex';
    }

    // 手を文字列にフォーマット（正式な棋譜表記）
    formatMove(move) {
        const pieceNames = {
            'lion': 'ライオン', 'zou': 'ぞう', 'kirin': 'きりん',
            'hiyoko': 'ひよこ', 'niwatori': 'にわとり'
        };

        const playerSymbol = move.player === 'sente' ? '▲' : '△';
        const playerLabel = move.player === 'sente' ? '(先手)' : '(後手)';

        if (move.type === 'move') {
            const piece = move.boardState[move.fromRow][move.fromCol];
            if (!piece) return '';

            const pieceName = pieceNames[piece.type] || piece.type;
            const toSuji = 3 - move.toCol;
            const toDan = move.toRow + 1;

            let text = `${playerSymbol}${playerLabel}${pieceName}${toSuji}${toDan}`;

            if (move.captured) {
                text = text.replace(/(\d+)$/, '×$1');
            }

            if (piece.type === 'hiyoko') {
                const promotionRow = piece.player === 'sente' ? 0 : 3;
                if (move.toRow === promotionRow) {
                    text = text.replace(/(ひよこ)([×\d]+)$/, '$1ニ$2');
                }
            }

            return text;
        } else if (move.type === 'drop') {
            const pieceName = pieceNames[move.pieceType] || move.pieceType;
            const suji = 3 - move.col;
            const dan = move.row + 1;
            return `${playerSymbol}${playerLabel}${pieceName}打${suji}${dan}`;
        }
        return '';
    }

    // 再戦処理
    handleRematchAccepted(data) {
        // ゲームをリセット
        this.game = new DobutsuShogi();
        this.game.currentPlayer = 'sente';
        this.isMyTurn = (this.playerRole === 'sente');
        this.canPlay = false;
        this.moveHistory = [];
        this.isReviewMode = false;

        this.announcementElement.classList.remove('show', 'game-over');
        this.render();
        this.showGameStartAnnouncement();
    }
}

// AI対戦UI管理
class AIGameUI {
    constructor(aiType = 'binary-tree', customParams = null) {
        this.aiType = aiType; // 'binary-tree', 'deep-learning', 'hybrid', 'ultimate'
        this.game = new DobutsuShogi();
        this.playerRole = 'sente'; // プレイヤーは常に先手
        this.isMyTurn = true;
        this.canPlay = false;
        this.showEvaluation = false; // 評価表示のON/OFF
        this.moveHistory = []; // 手の履歴（感想戦用）
        this.currentReviewMove = 0; // 感想戦モードの現在の手
        this.isReviewMode = false; // 感想戦モードかどうか
        this.maxThinkingTime = 5000; // 最大考慮時間（ミリ秒）

        // AIパラメータを設定（カスタムパラメータがあれば使用、なければデフォルト）
        const defaultParams = this.getDefaultAIParams();
        this.aiParams = {};
        for (const key in defaultParams) {
            if (key === this.aiType && customParams) {
                // 現在のAIタイプのパラメータをカスタムパラメータで上書き
                this.aiParams[key] = { ...defaultParams[key], ...customParams };
            } else {
                this.aiParams[key] = defaultParams[key];
            }
        }

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
        this.toggleEvalBtn = document.getElementById('toggle-eval-btn');
        this.positionEvaluation = document.getElementById('position-evaluation');
        this.evalValue = document.getElementById('eval-value');
        this.evalMethodInfo = document.getElementById('eval-method-info');
        this.gameRecord = document.getElementById('game-record');
        this.recordList = document.getElementById('record-list');
        this.recordToggleBtn = document.getElementById('record-toggle-btn');
        this.recordContent = document.getElementById('record-content');
        this.recordCollapsed = false;

        // 感想戦モード用の要素（左側パネル）
        this.reviewPrevBtn = document.getElementById('review-prev-btn');
        this.reviewNextBtn = document.getElementById('review-next-btn');

        this.resetBtn.addEventListener('click', () => location.reload());
        this.rematchYesBtn.addEventListener('click', () => this.handleRematchYes());
        this.rematchNoBtn.addEventListener('click', () => this.handleRematchNo());
        this.toggleEvalBtn.addEventListener('click', () => this.toggleEvaluation());
        this.recordToggleBtn.addEventListener('click', () => this.toggleRecord());

        // 感想戦モードのボタン
        if (this.reviewPrevBtn) {
            this.reviewPrevBtn.addEventListener('click', () => this.reviewPreviousMove());
        }
        if (this.reviewNextBtn) {
            this.reviewNextBtn.addEventListener('click', () => this.reviewNextMove());
        }
        this.startGame();
    }

    startGame() {
        this.welcomeScreen.style.display = 'none';
        this.gameContainer.style.display = 'block';
        this.playerNameElement.textContent = '先手：あなた';

        // AIタイプに応じた名前を表示
        const aiNames = this.getAIName(this.aiType);
        this.opponentNameElement.textContent = `後手：${aiNames}`;
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
        this.updatePositionEvaluation();
        // 感想戦モードのときはupdateGameRecordを呼ばない（updateGameRecordForReviewを使う）
        if (!this.isReviewMode) {
            this.updateGameRecord();
        }
    }

    renderBoard() {
        if (!this.boardElement) {
            console.error('boardElement is null');
            return;
        }

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
        if (!this.playerCapturedElement || !this.opponentCapturedElement) {
            console.error('Captured elements are null');
            return;
        }

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
                this.render();
                this.highlightValidMoves(row, col);
            }
        } else {
            const validMoves = this.game.getValidMoves(this.game.selectedCell.row, this.game.selectedCell.col);
            const isValid = validMoves.some(([r, c]) => r === row && c === col);

            if (isValid) {
                this.executeMove(this.game.selectedCell.row, this.game.selectedCell.col, row, col);
                this.game.selectedCell = null;
            } else {
                // 別の自分の駒をクリックした場合は選択を変更
                if (piece && piece.player === this.playerRole) {
                    this.game.selectedCell = { row, col };
                    this.render();
                    this.highlightValidMoves(row, col);
                } else {
                    // 空白や相手の駒をクリックした場合は選択を解除
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

        // 手の履歴に追加（評価も含める）
        const gameCopyBefore = this.createGameCopy();
        const evaluationBefore = this.evaluatePosition(gameCopyBefore, 'gote');

        const moveData = {
            type: 'move',
            fromRow, fromCol, toRow, toCol,
            player: this.game.currentPlayer,
            captured: captured ? captured.type : null,
            boardState: this.game.board.map(row => row.map(cell => cell ? { ...cell } : null)),
            capturedState: {
                sente: [...this.game.captured.sente],
                gote: [...this.game.captured.gote]
            },
            evaluation: evaluationBefore
        };
        this.moveHistory.push(moveData);

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

        // 手番交代
        this.game.switchPlayer();

        // 千日手判定用に状態を記録（手番交代後の状態）
        const positionKey = this.game.getPositionKey();
        this.game.positionHistory.push(positionKey);
        // 履歴が長くなりすぎないように、最新100手分のみ保持
        if (this.game.positionHistory.length > 100) {
            this.game.positionHistory.shift();
        }

        // 勝利判定（手番交代後）
        const winner = this.game.checkWinCondition();
        if (winner) {
            this.handleGameOver(winner);
            return;
        }
        this.isMyTurn = false;
        this.render();

        setTimeout(() => {
            this.makeAIMove();
        }, 500);
    }

    executeDrop(pieceType, row, col) {
        // にわとりを打つ場合はひよことして打つ
        const actualPieceType = pieceType === 'niwatori' ? 'hiyoko' : pieceType;

        // 手の履歴に追加（評価も含める）
        const gameCopyBefore = this.createGameCopy();
        const evaluationBefore = this.evaluatePosition(gameCopyBefore, 'gote');

        const moveData = {
            type: 'drop',
            pieceType: actualPieceType, row, col,
            player: this.game.currentPlayer,
            boardState: this.game.board.map(row => row.map(cell => cell ? { ...cell } : null)),
            capturedState: {
                sente: [...this.game.captured.sente],
                gote: [...this.game.captured.gote]
            },
            evaluation: evaluationBefore
        };
        this.moveHistory.push(moveData);

        this.game.board[row][col] = { type: actualPieceType, player: this.game.currentPlayer };

        // 持ち駒から削除（niwatoriの場合はhiyokoとして削除）
        const index = this.game.captured[this.game.currentPlayer].indexOf(actualPieceType);
        if (index > -1) {
            this.game.captured[this.game.currentPlayer].splice(index, 1);
        }

        // 手番交代
        this.game.switchPlayer();

        // 千日手判定用に状態を記録（手番交代後の状態）
        const positionKey = this.game.getPositionKey();
        this.game.positionHistory.push(positionKey);
        // 履歴が長くなりすぎないように、最新100手分のみ保持
        if (this.game.positionHistory.length > 100) {
            this.game.positionHistory.shift();
        }

        // 勝利判定（手番交代後）
        const winner = this.game.checkWinCondition();
        if (winner) {
            this.handleGameOver(winner);
            return;
        }
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
            board: this.game.board.map(row => row.map(cell => cell ? { ...cell } : null)),
            captured: {
                sente: [...this.game.captured.sente],
                gote: [...this.game.captured.gote]
            },
            currentPlayer: this.game.currentPlayer
        }));

        // AIの手の履歴に追加
        const aiMoveData = {
            type: bestMove.type,
            ...bestMove,
            player: 'gote',
            boardState: this.game.board.map(row => row.map(cell => cell ? { ...cell } : null)),
            capturedState: {
                sente: [...this.game.captured.sente],
                gote: [...this.game.captured.gote]
            },
            evaluation: this.evaluatePosition(this.game, 'gote')
        };
        this.moveHistory.push(aiMoveData);

        this.game.makeMove(bestMove);

        const winner = this.game.checkWinCondition();
        if (winner) {
            this.handleGameOver(winner);
            return;
        }

        this.isMyTurn = true;
        this.render();
    }

    // AIタイプに応じた名前を取得
    getAIName(aiType) {
        const params = this.aiParams[aiType] || this.getDefaultAIParams()[aiType];

        switch (aiType) {
            case 'minimax':
                const depth = params?.depth || 3;
                return `ミニマックス探索（深さ${depth}）`;
            case 'montecarlo':
                const sims = params?.simulations || 1000;
                return `モンテカルロ（${sims.toLocaleString()}回）`;
            case 'evaluation':
                const pieceValues = params?.pieceValues;
                if (pieceValues) {
                    // 最も高い価値の駒を特定
                    const maxPiece = Object.entries(pieceValues).reduce((a, b) =>
                        pieceValues[a[0]] > pieceValues[b[0]] ? a : b
                    );
                    const pieceNames = {
                        lion: 'ライオン',
                        niwatori: 'にわとり',
                        kirin: 'きりん',
                        zou: 'ぞう',
                        hiyoko: 'ひよこ'
                    };
                    // ライオンが最高値でない場合、偏愛AIとして表示
                    if (maxPiece[0] !== 'lion' && pieceValues.lion < maxPiece[1]) {
                        return `評価関数（${pieceNames[maxPiece[0]]}偏愛）`;
                    }
                }
                return '評価関数';
            default:
                return 'コンピューター';
        }
    }

    // デフォルトのAIパラメータを取得
    getDefaultAIParams() {
        return {
            'minimax': { depth: 3 },
            'montecarlo': { simulations: 1000 },
            'evaluation': {
                pieceValues: {
                    lion: 1000,
                    niwatori: 600,
                    kirin: 400,
                    zou: 400,
                    hiyoko: 100
                }
            }
        };
    }

    // デフォルト値の定義（UI用）
    getDefaultParamValues() {
        return {
            'minimax': { depth: 3 },
            'montecarlo': { simulations: 1000 },
            'evaluation': {
                lion: 1000,
                niwatori: 600,
                kirin: 400,
                zou: 400,
                hiyoko: 100
            }
        };
    }

    selectBestMove(moves) {
        const params = this.aiParams[this.aiType] || this.getDefaultAIParams()[this.aiType];

        switch (this.aiType) {
            case 'minimax':
                return this.selectMoveWithMinimaxTimeLimited(moves, params.depth);
            case 'montecarlo':
                return this.selectMoveWithMonteCarlo(moves, params.simulations);
            case 'evaluation':
                return this.selectMoveWithDeepLearning(moves);
            default:
                return this.selectMoveWithMinimaxTimeLimited(moves, 3);
        }
    }

    // ゲーム状態の評価関数（ディープラーニング風の評価）
    evaluatePosition(game, player) {
        let score = 0;
        const opponent = player === 'sente' ? 'gote' : 'sente';

        // 駒の価値（カスタムパラメータがあれば使用、なければデフォルト）
        const defaultPieceValues = {
            lion: 1000,
            niwatori: 600,
            zou: 400,
            kirin: 400,
            hiyoko: 100
        };

        const customPieceValues = this.aiParams[this.aiType]?.pieceValues ||
            (this.aiType === 'evaluation' ? this.aiParams['evaluation']?.pieceValues : null);
        const pieceValues = customPieceValues || defaultPieceValues;

        // 盤上の駒を評価
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                const piece = game.board[row][col];
                if (piece) {
                    const value = pieceValues[piece.type] || 0;
                    if (piece.player === player) {
                        score += value;
                        // ライオンの位置ボーナス（相手陣地に近いほど良い）- 駒の価値の10%をボーナス
                        if (piece.type === 'lion') {
                            if (player === 'sente' && row === 0) score += pieceValues.lion * 0.1; // 勝利条件
                            if (player === 'gote' && row === 3) score += pieceValues.lion * 0.1;
                        }
                        // ひよこの成り位置ボーナス - 駒の価値の5%をボーナス
                        if (piece.type === 'hiyoko') {
                            if (player === 'sente' && row <= 1) score += pieceValues.hiyoko * 0.05;
                            if (player === 'gote' && row >= 2) score += pieceValues.hiyoko * 0.05;
                        }
                    } else {
                        score -= value;
                    }
                }
            }
        }

        // 持ち駒を評価
        game.captured[player].forEach(type => {
            score += pieceValues[type] || 0;
        });
        game.captured[opponent].forEach(type => {
            score -= pieceValues[type] || 0;
        });

        // 勝利条件チェック
        const winner = game.checkWinCondition();
        if (winner === player) score += pieceValues.lion * 10; // ライオンの価値の10倍
        if (winner === opponent) score -= pieceValues.lion * 10;

        return score;
    }

    // 2分木（ミニマックス）アルゴリズム（時間制限付き）
    selectMoveWithMinimaxTimeLimited(moves, maxDepth) {
        const startTime = performance.now();
        let bestMove = moves[0];
        let bestValue = -Infinity;
        let actualDepth = maxDepth;

        // 時間制限内で探索深さを動的に調整
        for (let depth = 1; depth <= maxDepth; depth++) {
            const testStartTime = performance.now();
            let foundBest = false;

            for (const move of moves) {
                if (performance.now() - startTime > this.maxThinkingTime * 0.8) {
                    // 時間がかかりすぎる場合は現在の深さで終了
                    break;
                }

                const gameCopy = this.createGameCopy();
                gameCopy.currentPlayer = 'gote';

                gameCopy.makeMove(move);
                const winner = gameCopy.checkWinCondition();

                if (winner === 'gote') {
                    return move; // 即座に勝利できる手
                }

                const value = this.minimaxTimeLimited(gameCopy, depth - 1, false, -Infinity, Infinity, startTime);

                if (value > bestValue) {
                    bestValue = value;
                    bestMove = move;
                    foundBest = true;
                }
            }

            if (foundBest) {
                actualDepth = depth;
            }

            // 時間がかかりすぎる場合は現在の深さで終了
            if (performance.now() - startTime > this.maxThinkingTime * 0.8) {
                break;
            }
        }

        return bestMove;
    }

    // 時間制限付きミニマックス（後方互換性のため残す）
    selectMoveWithMinimax(moves, depth) {
        return this.selectMoveWithMinimaxTimeLimited(moves, depth);
    }

    // ミニマックスアルゴリズムの実装（アルファベータ法で最適化、時間制限付き）
    minimaxTimeLimited(game, depth, isMaximizing, alpha, beta, startTime) {
        // 時間制限チェック
        if (performance.now() - startTime > this.maxThinkingTime) {
            return this.evaluatePosition(game, 'gote'); // 時間切れの場合は評価関数で評価
        }

        const winner = game.checkWinCondition();
        if (winner === 'gote') return 10000 - depth; // 勝利（早く勝つほど良い）
        if (winner === 'sente') return -10000 + depth; // 敗北
        if (depth === 0) {
            return this.evaluatePosition(game, 'gote');
        }

        const player = isMaximizing ? 'gote' : 'sente';
        const possibleMoves = game.getAllPossibleMoves(player);

        if (possibleMoves.length === 0) {
            return isMaximizing ? -10000 : 10000;
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of possibleMoves) {
                if (performance.now() - startTime > this.maxThinkingTime) break;

                const gameCopy = this.createGameCopyFromGame(game);
                gameCopy.currentPlayer = player;
                gameCopy.makeMove(move);
                const evaluation = this.minimaxTimeLimited(gameCopy, depth - 1, false, alpha, beta, startTime);
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break; // アルファベータカット
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of possibleMoves) {
                if (performance.now() - startTime > this.maxThinkingTime) break;

                const gameCopy = this.createGameCopyFromGame(game);
                gameCopy.currentPlayer = player;
                gameCopy.makeMove(move);
                const evaluation = this.minimaxTimeLimited(gameCopy, depth - 1, true, alpha, beta, startTime);
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break; // アルファベータカット
            }
            return minEval;
        }
    }

    // 時間制限なしミニマックス（後方互換性のため残す）
    minimax(game, depth, isMaximizing, alpha, beta) {
        const startTime = performance.now();
        return this.minimaxTimeLimited(game, depth, isMaximizing, alpha, beta, startTime);
    }

    // ディープラーニング風AI（評価関数ベース）
    selectMoveWithDeepLearning(moves) {
        let bestMove = moves[0];
        let bestScore = -Infinity;

        for (const move of moves) {
            const gameCopy = this.createGameCopy();
            gameCopy.currentPlayer = 'gote';

            gameCopy.makeMove(move);
            const winner = gameCopy.checkWinCondition();

            if (winner === 'gote') {
                return move;
            }

            // 評価関数でスコアを計算
            const score = this.evaluatePosition(gameCopy, 'gote');

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    // モンテカルロ法による手の選択
    selectMoveWithMonteCarlo(moves, simulations) {
        const startTime = performance.now();
        const moveStats = new Map();

        // 各手に対して統計を初期化
        moves.forEach(move => {
            moveStats.set(move, { wins: 0, total: 0 });
        });

        // 時間制限内でプレイアウトを実行
        let totalSimulations = 0;
        while (performance.now() - startTime < this.maxThinkingTime && totalSimulations < simulations) {
            // ランダムに手を選ぶ
            const move = moves[Math.floor(Math.random() * moves.length)];
            const stats = moveStats.get(move);

            // プレイアウトを実行
            const result = this.playout(move);
            stats.total++;
            totalSimulations++;

            if (result === 'gote') {
                stats.wins++;
            }
        }

        // 勝率が最も高い手を選ぶ（UCB1アルゴリズムの簡易版）
        let bestMove = moves[0];
        let bestScore = -1;

        moveStats.forEach((stats, move) => {
            if (stats.total === 0) return;

            const winRate = stats.wins / stats.total;
            // 探索と活用のバランスを取る（簡易版）
            const score = winRate + Math.sqrt(2 * Math.log(totalSimulations) / stats.total);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        });

        return bestMove;
    }

    // ランダムプレイアウトを実行
    playout(initialMove) {
        const gameCopy = this.createGameCopy();
        gameCopy.currentPlayer = 'gote';
        gameCopy.makeMove(initialMove);

        let moves = 0;
        const maxMoves = 200; // 無限ループ防止

        while (moves < maxMoves) {
            const winner = gameCopy.checkWinCondition();
            if (winner) {
                return winner;
            }

            const currentPlayer = gameCopy.currentPlayer;
            const possibleMoves = gameCopy.getAllPossibleMoves(currentPlayer);

            if (possibleMoves.length === 0) {
                // 手がない場合は相手の勝ち
                return currentPlayer === 'sente' ? 'gote' : 'sente';
            }

            // ランダムに手を選ぶ
            const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            gameCopy.makeMove(randomMove);
            gameCopy.switchPlayer();
            moves++;
        }

        // 最大手数に達した場合は評価関数で判定
        const evaluation = this.evaluatePosition(gameCopy, 'gote');
        return evaluation > 0 ? 'gote' : 'sente';
    }

    // ハイブリッドAI（2分木+ディープラーニング風、時間制限付き）
    selectMoveWithHybridTimeLimited(moves, preDepth, topN) {
        const startTime = performance.now();
        // 2分木で上位N手を選び、評価関数で最終決定
        const topMoves = this.getTopMovesWithMinimaxTimeLimited(moves, topN, preDepth, startTime);
        return this.selectMoveWithDeepLearning(topMoves);
    }

    // ハイブリッドAI（後方互換性のため残す）
    selectMoveWithHybrid(moves) {
        return this.selectMoveWithHybridTimeLimited(moves, 2, 3);
    }

    // 上位N手をミニマックスで選ぶ（時間制限付き）
    getTopMovesWithMinimaxTimeLimited(moves, topN, depth, startTime) {
        const scoredMoves = [];

        for (const move of moves) {
            if (performance.now() - startTime > this.maxThinkingTime * 0.7) {
                // 時間がかかりすぎる場合は途中で終了
                break;
            }

            const gameCopy = this.createGameCopy();
            gameCopy.currentPlayer = 'gote';
            gameCopy.makeMove(move);
            const score = this.minimaxTimeLimited(gameCopy, depth, false, -Infinity, Infinity, startTime);
            scoredMoves.push({ move, score });
        }

        scoredMoves.sort((a, b) => b.score - a.score);
        return scoredMoves.slice(0, Math.min(topN, scoredMoves.length)).map(item => item.move);
    }

    // ゲーム状態のコピーを作成
    createGameCopy() {
        const gameCopy = new DobutsuShogi();
        gameCopy.board = this.game.board.map(row =>
            row.map(cell => cell ? { ...cell } : null)
        );
        gameCopy.captured = {
            sente: [...this.game.captured.sente],
            gote: [...this.game.captured.gote]
        };
        gameCopy.currentPlayer = this.game.currentPlayer;
        return gameCopy;
    }

    // 別のゲーム状態からコピーを作成
    createGameCopyFromGame(game) {
        const gameCopy = new DobutsuShogi();
        gameCopy.board = game.board.map(row =>
            row.map(cell => cell ? { ...cell } : null)
        );
        gameCopy.captured = {
            sente: [...game.captured.sente],
            gote: [...game.captured.gote]
        };
        gameCopy.currentPlayer = game.currentPlayer;
        return gameCopy;
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
            const aiName = this.getAIName(this.aiType);
            this.turnElement.textContent = aiName || 'コンピューター';
            this.turnElement.style.color = '#dc3545';
        }
    }

    handleGameOver(winner) {
        if (winner === 'draw') {
            // 引き分け（千日手）
            const resultText = '引き分け（千日手）';
            this.messageElement.textContent = resultText;
            this.messageElement.style.color = '#667eea';
            this.canPlay = false;
            this.isMyTurn = false;

            // 盤上に大きく引き分けを表示
            this.showGameOverAnnouncement(resultText, null);

            // 2秒後に再戦確認を表示（感想戦モードへのボタンも追加）
            setTimeout(() => {
                this.showRematchConfirmation();
                // 感想戦モードへのボタンを追加
                this.addReviewModeButton();
            }, 2000);
            return;
        }

        const youWon = winner === this.playerRole;
        const resultText = youWon ? '勝利！' : '敗北...';

        this.messageElement.textContent = resultText;
        this.messageElement.style.color = youWon ? '#28a745' : '#dc3545';
        this.canPlay = false;
        this.isMyTurn = false;

        // 盤上に大きく勝敗を表示
        this.showGameOverAnnouncement(resultText, youWon);

        // 2秒後に再戦確認を表示（感想戦モードへのボタンも追加）
        setTimeout(() => {
            this.showRematchConfirmation();
            // 感想戦モードへのボタンを追加
            this.addReviewModeButton();
        }, 2000);
    }

    // 感想戦モードを開始（元の対局画面で）
    startReviewMode() {
        if (this.moveHistory.length === 0) {
            alert('手の履歴がありません');
            return;
        }

        // 再戦確認を非表示
        if (this.rematchConfirmation) {
            this.rematchConfirmation.style.display = 'none';
        }

        // 棋譜を表示
        if (this.gameRecord) {
            this.gameRecord.style.display = 'block';
            this.updateGameRecordForReview();
        }

        // 左側のコントロールパネルを表示
        const reviewControlsPanel = document.getElementById('review-controls-panel');
        if (reviewControlsPanel) {
            reviewControlsPanel.style.display = 'flex';
        }

        // 勝敗表示を非表示にする
        if (this.announcementElement) {
            this.announcementElement.classList.remove('show', 'game-over');
            this.announcementElement.textContent = '';
        }

        // 感想戦モードを有効化
        this.isReviewMode = true;

        // 評価表示をONにする
        this.showEvaluation = true;
        this.toggleEvalBtn.textContent = '評価表示: ON';
        this.toggleEvalBtn.classList.add('active');
        this.updatePositionEvaluation();
        // 感想戦モードではupdateGameRecordForReviewを使うので、updateGameRecordは呼ばない

        // 終局局面から開始（最後の手の状態）
        this.currentReviewMove = this.moveHistory.length - 1;
        this.restoreGameState(this.currentReviewMove);
        this.updateReviewMoveInfo();

        // 「感想戦」というメッセージを表示
        if (this.messageElement) {
            this.messageElement.textContent = '感想戦';
            this.messageElement.style.color = '#667eea';
        }
    }

    // 感想戦モードを終了
    closeReviewMode() {
        // 左側のコントロールパネルを非表示
        const reviewControlsPanel = document.getElementById('review-controls-panel');
        if (reviewControlsPanel) {
            reviewControlsPanel.style.display = 'none';
        }

        // 最後の状態に戻す
        if (this.moveHistory.length > 0) {
            this.restoreGameState(this.moveHistory.length - 1);
        }
    }

    // 前の手に戻る
    reviewPreviousMove() {
        if (this.currentReviewMove >= 0) {
            this.currentReviewMove--;
            if (this.currentReviewMove < 0) {
                this.currentReviewMove = -1; // 初期局面
            }
            this.restoreGameState(this.currentReviewMove);
            this.updateReviewMoveInfo();
        }
    }

    // 次の手に進む
    reviewNextMove() {
        if (this.currentReviewMove < this.moveHistory.length - 1) {
            this.currentReviewMove++;
            this.restoreGameState(this.currentReviewMove);
            this.updateReviewMoveInfo();
        }
    }

    // 感想戦の手数情報を更新
    updateReviewMoveInfo() {
        const reviewMoveInfo = document.getElementById('review-move-info');
        if (reviewMoveInfo) {
            const currentMove = this.currentReviewMove === -1 ? 0 : this.currentReviewMove + 1;
            const totalMoves = this.moveHistory.length;
            reviewMoveInfo.textContent = `${currentMove}手目 / ${totalMoves}手`;
        }

        // ボタンの有効/無効を更新
        const prevBtn = document.getElementById('review-prev-btn');
        const nextBtn = document.getElementById('review-next-btn');
        if (prevBtn) {
            prevBtn.disabled = this.currentReviewMove === -1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentReviewMove >= this.moveHistory.length - 1;
        }
    }

    // 感想戦用の棋譜を更新（手数をクリック可能にする）
    updateGameRecordForReview() {
        if (!this.gameRecord || !this.recordList) {
            console.warn('gameRecord or recordList is null:', { gameRecord: this.gameRecord, recordList: this.recordList });
            return;
        }

        this.recordList.innerHTML = '';

        // 初期局面も表示（0手目）
        const initialItem = document.createElement('div');
        initialItem.className = 'record-item initial-position';
        const initialRow = document.createElement('div');
        initialRow.className = 'record-item-row';
        const initialNumber = document.createElement('div');
        initialNumber.className = 'record-move-number clickable';
        initialNumber.textContent = '0';
        initialNumber.style.cursor = 'pointer';
        initialNumber.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.currentReviewMove = -1; // 初期局面
            this.restoreGameState(-1);
            this.updateReviewMoveInfo();
        }, true); // useCaptureをtrueにして、イベントを確実にキャッチ
        initialRow.appendChild(initialNumber);
        const initialText = document.createElement('div');
        initialText.className = 'record-move-text';
        initialText.textContent = '開始局面';
        initialRow.appendChild(initialText);
        initialItem.appendChild(initialRow);
        this.recordList.appendChild(initialItem);

        // 各手を表示
        this.moveHistory.forEach((move, index) => {
            const recordItem = document.createElement('div');
            recordItem.className = `record-item ${move.player === 'sente' ? 'player-move' : 'ai-move'}`;

            const row = document.createElement('div');
            row.className = 'record-item-row';

            // 手数（クリック可能）
            const moveNumber = document.createElement('div');
            moveNumber.className = 'record-move-number clickable';
            moveNumber.textContent = `${index + 1}`;
            moveNumber.style.cursor = 'pointer';
            moveNumber.style.textDecoration = 'underline';
            moveNumber.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.currentReviewMove = index;
                this.restoreGameState(index);
                this.updateReviewMoveInfo();
            }, true); // useCaptureをtrueにして、イベントを確実にキャッチ
            row.appendChild(moveNumber);

            // 手の内容（クリック可能）
            const moveText = document.createElement('div');
            moveText.className = 'record-move-text clickable';
            moveText.textContent = this.formatMove(move);
            moveText.style.cursor = 'pointer';
            moveText.style.textDecoration = 'underline';
            moveText.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.currentReviewMove = index;
                this.restoreGameState(index);
                this.updateReviewMoveInfo();
            }, true); // useCaptureをtrueにして、イベントを確実にキャッチ
            row.appendChild(moveText);

            // 評価点
            const evalDiv = document.createElement('div');
            evalDiv.className = 'record-eval';
            if (move.evaluation !== undefined) {
                const evalValue = move.evaluation;
                evalDiv.textContent = evalValue > 0 ? `+${evalValue}` : evalValue;
                if (evalValue > 500) {
                    evalDiv.classList.add('positive');
                } else if (evalValue < -500) {
                    evalDiv.classList.add('negative');
                }
            } else {
                evalDiv.textContent = '-';
            }
            row.appendChild(evalDiv);

            recordItem.appendChild(row);
            this.recordList.appendChild(recordItem);
        });
    }

    // 評価表示のON/OFF切り替え
    toggleEvaluation() {
        this.showEvaluation = !this.showEvaluation;
        this.toggleEvalBtn.textContent = `評価表示: ${this.showEvaluation ? 'ON' : 'OFF'}`;
        this.toggleEvalBtn.classList.toggle('active', this.showEvaluation);
        this.updatePositionEvaluation();
        this.updateGameRecord();
    }

    // 棋譜の折りたたみ/展開
    toggleRecord() {
        this.recordCollapsed = !this.recordCollapsed;
        if (this.recordCollapsed) {
            this.recordContent.classList.add('collapsed');
            this.recordToggleBtn.textContent = '展開';
        } else {
            this.recordContent.classList.remove('collapsed');
            this.recordToggleBtn.textContent = '折りたたむ';
        }
    }

    // 局面評価を更新
    updatePositionEvaluation() {
        if (!this.showEvaluation || !this.positionEvaluation) return;

        // 現在の局面評価を表示
        const evaluation = this.evaluatePosition(this.game, this.game.currentPlayer === 'sente' ? 'gote' : 'sente');
        this.evalValue.textContent = evaluation > 0 ? `+${evaluation}` : evaluation;
        this.positionEvaluation.style.display = 'flex';

        // 評価に応じて色を変更（AI視点なので、正の値はAI優勢、負の値はプレイヤー優勢）
        if (evaluation > 500) {
            this.evalValue.style.color = '#28a745'; // 緑（AI優勢）
        } else if (evaluation < -500) {
            this.evalValue.style.color = '#dc3545'; // 赤（プレイヤー優勢）
        } else {
            this.evalValue.style.color = '#667eea'; // 紫（互角）
        }

        // 評価方法の情報を表示
        this.updateEvalMethodInfo();
    }

    // 評価方法の情報を更新
    updateEvalMethodInfo() {
        if (!this.evalMethodInfo) return;

        const params = this.aiParams[this.aiType] || this.getDefaultAIParams()[this.aiType];
        let methodText = '';

        switch (this.aiType) {
            case 'minimax':
                const depth = params?.depth || 3;
                methodText = `ミニマックス探索（深さ${depth}）で評価`;
                break;
            case 'montecarlo':
                const sims = params?.simulations || 1000;
                methodText = `モンテカルロ法（${sims.toLocaleString()}回プレイアウト）で評価`;
                break;
            case 'evaluation':
                methodText = '評価関数で評価';
                break;
            default:
                methodText = '評価関数で評価';
        }

        this.evalMethodInfo.textContent = methodText;
    }

    // 棋譜を更新
    updateGameRecord() {
        // 感想戦モードのときはupdateGameRecordForReviewを使う
        if (this.isReviewMode) {
            return;
        }

        if (!this.showEvaluation || !this.gameRecord || !this.recordList) {
            if (this.gameRecord) {
                this.gameRecord.style.display = 'none';
            }
            return;
        }

        this.gameRecord.style.display = 'block';
        this.recordList.innerHTML = '';

        // 各手を表示（計算リソースを節約するため、評価は既に保存されているもののみ使用）
        this.moveHistory.forEach((move, index) => {
            const recordItem = document.createElement('div');
            recordItem.className = `record-item ${move.player === 'sente' ? 'player-move' : 'ai-move'}`;

            // 1行目: 手数、手の内容、評価点
            const row = document.createElement('div');
            row.className = 'record-item-row';

            // 手数
            const moveNumber = document.createElement('div');
            moveNumber.className = 'record-move-number';
            moveNumber.textContent = `${index + 1}`;
            row.appendChild(moveNumber);

            // 手の内容
            const moveText = document.createElement('div');
            moveText.className = 'record-move-text';
            moveText.textContent = this.formatMove(move);
            row.appendChild(moveText);

            // 評価点（既に計算済みのもののみ表示）
            const evalDiv = document.createElement('div');
            evalDiv.className = 'record-eval';
            if (move.evaluation !== undefined) {
                const evalValue = move.evaluation;
                evalDiv.textContent = evalValue > 0 ? `+${evalValue}` : evalValue;
                if (evalValue > 500) {
                    evalDiv.classList.add('positive');
                } else if (evalValue < -500) {
                    evalDiv.classList.add('negative');
                }
            } else {
                evalDiv.textContent = '-';
            }
            row.appendChild(evalDiv);

            recordItem.appendChild(row);
            this.recordList.appendChild(recordItem);
        });

        // 最新の手にスクロール
        if (this.recordList.lastElementChild) {
            this.recordList.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // 手を文字列にフォーマット（正式な棋譜表記）
    formatMove(move) {
        const pieceNames = {
            'lion': 'ライオン', 'zou': 'ぞう', 'kirin': 'きりん',
            'hiyoko': 'ひよこ', 'niwatori': 'にわとり'
        };

        // ▲は先手（sente）、△は後手（gote）
        const playerSymbol = move.player === 'sente' ? '▲' : '△';
        const playerLabel = move.player === 'sente' ? '(先手)' : '(後手)';

        if (move.type === 'move') {
            const piece = move.boardState[move.fromRow][move.fromCol];
            if (!piece) return '';

            const pieceName = pieceNames[piece.type] || piece.type;

            // 座標変換: 筋（列）は右から1,2,3、段（行）は後手側から1,2,3,4
            // col: 0,1,2（左から右） → 筋: 3,2,1（右から左）
            // row: 0,1,2,3（後手側から先手側） → 段: 1,2,3,4（後手側から）
            const toSuji = 3 - move.toCol;  // 行き先の筋（右から）
            const toDan = move.toRow + 1;   // 行き先の段（後手側から）

            let text = `${playerSymbol}${playerLabel}${pieceName}${toSuji}${toDan}`;

            // 取りの場合は×を追加（座標の前に×）
            if (move.captured) {
                text = text.replace(/(\d+)$/, '×$1');
            }

            // 成りの判定（ひよこが相手陣地に入った場合）
            if (piece.type === 'hiyoko') {
                const promotionRow = piece.player === 'sente' ? 0 : 3;
                if (move.toRow === promotionRow) {
                    // 成り（「ニ」を使用）
                    text = text.replace(/(ひよこ)([×\d]+)$/, '$1ニ$2');
                }
            }

            return text;
        } else if (move.type === 'drop') {
            const pieceName = pieceNames[move.pieceType] || move.pieceType;

            // 座標変換
            const suji = 3 - move.col;  // 筋（右から）
            const dan = move.row + 1;   // 段（後手側から）

            return `${playerSymbol}${playerLabel}${pieceName}打${suji}${dan}`;
        }
        return '';
    }

    // 手の状態からゲームコピーを作成
    createGameCopyFromMove(move) {
        const gameCopy = new DobutsuShogi();
        gameCopy.board = move.boardState.map(row =>
            row.map(cell => cell ? { ...cell } : null)
        );
        gameCopy.captured = {
            sente: [...move.capturedState.sente],
            gote: [...move.capturedState.gote]
        };
        gameCopy.currentPlayer = move.player === 'sente' ? 'gote' : 'sente';
        return gameCopy;
    }

    showGameOverAnnouncement(text, isWin) {
        this.announcementElement.textContent = text;
        if (isWin === null) {
            // 引き分け
            this.announcementElement.style.color = '#667eea';
            this.announcementElement.style.textShadow = '0 0 20px rgba(102, 126, 234, 0.8), 0 0 40px rgba(102, 126, 234, 0.6)';
        } else {
            this.announcementElement.style.color = isWin ? '#28a745' : '#dc3545';
            this.announcementElement.style.textShadow = isWin
                ? '0 0 20px rgba(40, 167, 69, 0.8), 0 0 40px rgba(40, 167, 69, 0.6)'
                : '0 0 20px rgba(220, 53, 69, 0.8), 0 0 40px rgba(220, 53, 69, 0.6)';
        }
        this.announcementElement.classList.add('show', 'game-over');

        // 2秒後に再戦確認を表示（感想戦モードへのボタンも追加）
        setTimeout(() => {
            this.showRematchConfirmation();
            // 感想戦モードへのボタンを追加
            this.addReviewModeButton();
        }, 2000);
    }

    // 感想戦モードボタンを追加
    addReviewModeButton() {
        const rematchContent = document.querySelector('.rematch-content');
        if (rematchContent && !document.getElementById('review-mode-btn')) {
            const reviewBtn = document.createElement('button');
            reviewBtn.id = 'review-mode-btn';
            reviewBtn.className = 'rematch-btn';
            reviewBtn.textContent = '感想戦モード';
            reviewBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            reviewBtn.addEventListener('click', () => {
                this.rematchConfirmation.style.display = 'none';
                this.startReviewMode();
            });
            const rematchButtons = rematchContent.querySelector('.rematch-buttons');
            if (rematchButtons) {
                rematchButtons.appendChild(reviewBtn);
            }
        }
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
        this.moveHistory = []; // 手の履歴もリセット

        // アナウンスを非表示
        this.announcementElement.classList.remove('show', 'game-over');

        // プレイヤー名を更新（AIタイプに応じた名前を再設定）
        this.playerNameElement.textContent = '先手：あなた';
        const aiName = this.getAIName(this.aiType);
        this.opponentNameElement.textContent = `後手：${aiName}`;

        this.render();
        this.showGameStartAnnouncement();
    }


    // 指定した手の状態にゲームを復元
    restoreGameState(moveIndex) {
        // 初期局面（-1）の場合は初期状態に戻す
        if (moveIndex < 0) {
            this.game = new DobutsuShogi();
            this.game.currentPlayer = 'sente';
            this.render();
            return;
        }

        if (moveIndex >= this.moveHistory.length) {
            // 最後の手以降の場合は、最後の手の状態を表示
            if (this.moveHistory.length > 0) {
                moveIndex = this.moveHistory.length - 1;
            } else {
                console.warn('No moves in history');
                return;
            }
        }

        const move = this.moveHistory[moveIndex];
        if (!move || !move.boardState) {
            console.warn('Invalid move or boardState:', move);
            return;
        }

        // 手を打つ前の状態を復元（深いコピーを作成）
        const newBoard = move.boardState.map(row =>
            row.map(cell => cell ? { ...cell } : null)
        );
        const newCaptured = {
            sente: [...move.capturedState.sente],
            gote: [...move.capturedState.gote]
        };

        // 盤面と持ち駒を直接置き換え
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                this.game.board[row][col] = newBoard[row][col];
            }
        }
        this.game.captured.sente = newCaptured.sente;
        this.game.captured.gote = newCaptured.gote;
        this.game.currentPlayer = move.player || 'sente';

        // その手を適用して、手を打った後の状態にする
        try {
            if (move.type === 'move') {
                // 移動手の場合
                const { fromRow, fromCol, toRow, toCol } = move;
                const piece = this.game.board[fromRow][fromCol];

                if (!piece) {
                    console.warn('Piece not found at:', fromRow, fromCol, 'move:', move);
                    return;
                }

                const captured = this.game.board[toRow][toCol];

                // 駒を取った場合
                if (captured) {
                    let capturedType = captured.type;
                    if (capturedType === 'niwatori') {
                        capturedType = 'hiyoko';
                    }
                    this.game.captured[this.game.currentPlayer].push(capturedType);
                }

                // 駒を移動
                this.game.board[toRow][toCol] = { ...piece };
                this.game.board[fromRow][fromCol] = null;

                // ひよこの成り判定
                if (piece.type === 'hiyoko') {
                    const promotionRow = piece.player === 'sente' ? 0 : 3;
                    if (toRow === promotionRow) {
                        this.game.board[toRow][toCol].type = 'niwatori';
                    }
                }

                // 次のプレイヤーに切り替え（手を打った後の状態）
                this.game.switchPlayer();
            } else if (move.type === 'drop') {
                // 打ち手の場合
                const { pieceType, row, col } = move;
                this.game.board[row][col] = { type: pieceType, player: this.game.currentPlayer };

                // 持ち駒から削除
                const index = this.game.captured[this.game.currentPlayer].indexOf(pieceType);
                if (index > -1) {
                    this.game.captured[this.game.currentPlayer].splice(index, 1);
                }

                // 次のプレイヤーに切り替え（手を打った後の状態）
                this.game.switchPlayer();
            }
        } catch (error) {
            console.error('Error restoring game state:', error, 'move:', move);
            return;
        }

        // 盤面と持ち駒を再描画
        this.renderBoard();
        this.renderCaptured();
        this.updateTurnIndicator();
        if (this.showEvaluation) {
            this.updatePositionEvaluation();
        }
    }

    // 感想戦モードの表示を更新
    updateReviewDisplay() {
        const move = this.moveHistory[this.currentReviewMove];
        this.reviewMoveInfo.textContent = `手目: ${this.currentReviewMove + 1} / ${this.moveHistory.length}`;

        // 分析を生成
        const analysis = this.analyzeMove(this.currentReviewMove);
        this.reviewAnalysis.innerHTML = analysis;

        // ボタンの有効/無効を更新
        this.reviewPrevBtn.disabled = this.currentReviewMove === 0;
        this.reviewNextBtn.disabled = this.currentReviewMove === this.moveHistory.length - 1;
    }

    // 手を分析
    analyzeMove(moveIndex) {
        if (moveIndex < 0 || moveIndex >= this.moveHistory.length) return '';

        const move = this.moveHistory[moveIndex];
        const isPlayerMove = move.player === 'sente';
        const playerName = isPlayerMove ? 'あなた' : 'AI';

        let html = `<div class="review-move ${isPlayerMove ? '' : 'best'}">`;
        html += `<div class="review-move-number">${moveIndex + 1}手目: ${playerName}の手</div>`;

        // 正式な棋譜表記を使用
        html += `<div class="review-move-description" style="font-size: 1.1em; font-weight: bold; margin-top: 5px;">`;
        html += this.formatMove(move);
        html += `</div>`;

        // 評価があれば表示
        if (move.evaluation !== undefined) {
            html += `<div class="review-move-description" style="margin-top: 10px; font-weight: bold; color: #667eea;">`;
            html += `局面評価: ${move.evaluation > 0 ? '+' : ''}${move.evaluation}`;
            html += `</div>`;
        }

        html += `</div>`;

        return html;
    }
}

// 開発者モードUI管理
class DeveloperModeUI {
    constructor() {
        this.dbConsoleBtn = document.getElementById('db-console-btn');
        this.serverStatusBtn = document.getElementById('server-status-btn');

        if (this.dbConsoleBtn) {
            this.dbConsoleBtn.addEventListener('click', () => {
                window.open('developmode/console.html', '_blank');
            });
        }

        if (this.serverStatusBtn) {
            this.serverStatusBtn.addEventListener('click', () => {
                alert('サーバー管理機能は開発中地です。');
            });
        }
    }
}

// ゲームモード管理
class GameModeManager {
    constructor() {
        this.modeSelection = document.getElementById('mode-selection');
        this.aiSelection = document.getElementById('ai-selection');
        this.devSelection = document.getElementById('dev-selection');
        this.onlineModeBtn = document.getElementById('online-mode-btn');
        this.aiModeBtn = document.getElementById('ai-mode-btn');
        this.devModeBtn = document.getElementById('dev-mode-btn');
        this.aiBackBtn = document.getElementById('ai-back-btn');
        this.devBackBtn = document.getElementById('dev-back-btn');
        this.waitingMessage = document.getElementById('waiting-message');

        this.onlineModeBtn.addEventListener('click', () => this.startOnlineMode());
        this.aiModeBtn.addEventListener('click', () => this.showAISelection());
        this.devModeBtn.addEventListener('click', () => this.showDevSelection());
        this.aiBackBtn.addEventListener('click', () => this.hideAISelection());
        this.devBackBtn.addEventListener('click', () => this.hideDevSelection());

        // パラメータ入力フィールドのイベントリスナー
        this.setupParamInputs();

        // AI選択ボタンにイベントリスナーを追加
        const aiOptionButtons = document.querySelectorAll('.ai-option-btn');
        aiOptionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const aiType = e.currentTarget.dataset.aiType;
                this.startAIMode(aiType);
            });
        });
    }

    setupParamInputs() {
        // パラメータ入力フィールドの値検証
        const paramInputs = document.querySelectorAll('.param-input');
        paramInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                const min = parseInt(e.target.min);
                const max = parseInt(e.target.max);

                if (value < min) {
                    e.target.value = min;
                } else if (value > max) {
                    e.target.value = max;
                }
            });
        });

        // スライダーのリアルタイム更新
        this.setupSliders();

        // 駒の価値スライダーのリアルタイム更新
        this.setupPieceValueSliders();

        // パラメータ調整ボタンのイベントリスナー
        const paramToggleButtons = document.querySelectorAll('.param-toggle-btn');
        paramToggleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const aiType = e.target.closest('.param-toggle-btn').dataset.aiType;
                const paramsDiv = document.querySelector(`.ai-params-inline[data-ai-type="${aiType}"]`);
                const toggleBtn = e.target.closest('.param-toggle-btn');

                if (paramsDiv) {
                    const isVisible = paramsDiv.style.display !== 'none';
                    paramsDiv.style.display = isVisible ? 'none' : 'block';
                    toggleBtn.classList.toggle('active', !isVisible);
                }
            });
        });

        // リセットボタンのイベントリスナー
        const resetButtons = document.querySelectorAll('.param-reset-btn');
        resetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const aiType = e.target.dataset.aiType;
                this.resetParamsToDefault(aiType);
            });
        });

        // 遊び方の例のトグル
        const examplesToggle = document.getElementById('examples-toggle-btn');
        if (examplesToggle) {
            examplesToggle.addEventListener('click', () => {
                const content = document.getElementById('examples-content');
                const isVisible = content.style.display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                examplesToggle.classList.toggle('active', !isVisible);
            });
        }
    }

    setupSliders() {
        // ミニマックス探索深さスライダー
        const minimaxDepth = document.getElementById('minimax-depth');
        const minimaxDepthDisplay = document.getElementById('minimax-depth-display');
        const minimaxDesc = document.getElementById('minimax-desc');

        if (minimaxDepth && minimaxDepthDisplay) {
            const initialValue = parseInt(minimaxDepth.value);
            minimaxDepthDisplay.textContent = initialValue;
            if (minimaxDesc) {
                minimaxDesc.textContent = `探索深さ: ${initialValue}手（1手だと目の前の駒を取るだけですが、10手を超えると人間でも勝つのが難しくなります）`;
            }

            minimaxDepth.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                minimaxDepthDisplay.textContent = value;
                if (minimaxDesc) {
                    minimaxDesc.textContent = `探索深さ: ${value}手（1手だと目の前の駒を取るだけですが、10手を超えると人間でも勝つのが難しくなります）`;
                }
            });
        }

        // モンテカルロプレイアウト回数スライダー
        const montecarloSim = document.getElementById('montecarlo-simulations');
        const montecarloSimDisplay = document.getElementById('montecarlo-simulations-display');
        const montecarloDesc = document.getElementById('montecarlo-desc');

        if (montecarloSim && montecarloSimDisplay) {
            const initialValue = parseInt(montecarloSim.value);
            montecarloSimDisplay.textContent = initialValue.toLocaleString();
            if (montecarloDesc) {
                montecarloDesc.textContent = `プレイアウト回数: ${initialValue.toLocaleString()}回（回数が少ないと「うっかりミス」が増え、多いと非常に堅実な指し回しになります）`;
            }

            montecarloSim.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                montecarloSimDisplay.textContent = value.toLocaleString();
                if (montecarloDesc) {
                    montecarloDesc.textContent = `プレイアウト回数: ${value.toLocaleString()}回（回数が少ないと「うっかりミス」が増え、多いと非常に堅実な指し回しになります）`;
                }
            });
        }
    }

    setupPieceValueSliders() {
        const pieces = ['lion', 'niwatori', 'kirin', 'zou', 'hiyoko'];

        pieces.forEach(piece => {
            const sliderId = `eval-${piece}-value`;
            const displayId = `eval-${piece}-display`;
            const slider = document.getElementById(sliderId);
            const display = document.getElementById(displayId);

            if (slider && display) {
                // 初期値を表示
                const initialValue = parseInt(slider.value);
                display.textContent = initialValue;

                // 変更時のイベントリスナー
                slider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    display.textContent = value;
                });
            }
        });
    }

    resetParamsToDefault(aiType) {
        const defaults = this.getDefaultParamValues();
        const defaultValues = defaults[aiType];
        const defaultPieceValues = {
            lion: 1000,
            niwatori: 600,
            kirin: 400,
            zou: 400,
            hiyoko: 100
        };

        switch (aiType) {
            case 'minimax':
                if (defaultValues) {
                    const depthSlider = document.getElementById('minimax-depth');
                    if (depthSlider) {
                        depthSlider.value = defaultValues.depth;
                        depthSlider.dispatchEvent(new Event('input'));
                    }
                }
                break;
            case 'montecarlo':
                if (defaultValues) {
                    const simSlider = document.getElementById('montecarlo-simulations');
                    if (simSlider) {
                        simSlider.value = defaultValues.simulations;
                        simSlider.dispatchEvent(new Event('input'));
                    }
                }
                break;
            case 'evaluation':
                if (defaultValues) {
                    ['lion', 'niwatori', 'kirin', 'zou', 'hiyoko'].forEach(piece => {
                        const slider = document.getElementById(`eval-${piece}-value`);
                        if (slider) {
                            slider.value = defaultValues[piece];
                            slider.dispatchEvent(new Event('input'));
                        }
                    });
                }
                break;
        }
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

    showAISelection() {
        if (!this.aiSelection) {
            console.error('aiSelection element not found');
            return;
        }
        this.modeSelection.style.display = 'none';
        this.aiSelection.style.display = 'block';
    }

    hideAISelection() {
        this.aiSelection.style.display = 'none';
        this.modeSelection.style.display = 'block';
    }

    showDevSelection() {
        if (!this.devSelection) {
            console.error('devSelection element not found');
            return;
        }
        this.modeSelection.style.display = 'none';
        this.devSelection.style.display = 'block';

        // 開発者モード用UIクラスの初期化
        if (!this.devUI) {
            this.devUI = new DeveloperModeUI();
        }
    }

    hideDevSelection() {
        this.devSelection.style.display = 'none';
        this.modeSelection.style.display = 'block';
    }

    startAIMode(aiType) {
        this.aiSelection.style.display = 'none';
        this.waitingMessage.textContent = '';

        // パラメータを取得
        const params = this.getAIParams(aiType);
        new AIGameUI(aiType, params);
    }

    getAIParams(aiType) {
        const getPieceValues = () => {
            return {
                lion: parseInt(document.getElementById('eval-lion-value')?.value || 1000),
                niwatori: parseInt(document.getElementById('eval-niwatori-value')?.value || 600),
                kirin: parseInt(document.getElementById('eval-kirin-value')?.value || 400),
                zou: parseInt(document.getElementById('eval-zou-value')?.value || 400),
                hiyoko: parseInt(document.getElementById('eval-hiyoko-value')?.value || 100)
            };
        };

        const params = {
            'minimax': {
                depth: parseInt(document.getElementById('minimax-depth')?.value || 3)
            },
            'montecarlo': {
                simulations: parseInt(document.getElementById('montecarlo-simulations')?.value || 1000)
            },
            'evaluation': {
                pieceValues: getPieceValues()
            }
        };
        return params[aiType] || params['minimax'];
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new GameModeManager();
});
