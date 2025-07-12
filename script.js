document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const context = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const highscoreElement = document.getElementById('highscore');
    const highscoreHardElement = document.getElementById('highscoreHard');
    const difficultyToggle = document.getElementById('difficultyToggle');
    const vibrationToggle = document.getElementById('vibrationToggle'); // NEU: Referenz zum Vibrations-Schalter

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 30;

    context.canvas.width = COLS * BLOCK_SIZE;
    context.canvas.height = ROWS * BLOCK_SIZE;
    context.scale(BLOCK_SIZE, BLOCK_SIZE);

    let score = 0;
    let highscore = getCookie('highscore') || 0;
    let highscoreHard = getCookie('highscoreHard') || 0;
    let isHardMode = false; // Wird jetzt durch Cookie überschrieben
    let isVibrationEnabled = true; // NEU: Wird jetzt durch Cookie überschrieben

    const COLORS = [
        null, 'cyan', 'blue', 'orange', 'yellow', 'green', 'purple', 'red'
    ];

    const SHAPES = [
        [], // Empty
        [[1, 1, 1, 1]], // I
        [[2, 0, 0], [2, 2, 2]], // J
        [[0, 0, 3], [3, 3, 3]], // L
        [[4, 4], [4, 4]], // O
        [[0, 5, 5], [5, 5, 0]], // S
        [[0, 6, 0], [6, 6, 6]], // T
        [[7, 7, 0], [0, 7, 7]]  // Z
    ];

    let grid = createGrid();
    let piece;
    let nextPiece;

    function createGrid() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    function newPiece() {
        if (!nextPiece) {
            nextPiece = createPiece();
        }
        piece = nextPiece;
        nextPiece = createPiece();
        // Setzt das Piece an die richtige Startposition, besonders im schweren Modus
        piece.x = Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2);
        piece.y = isHardMode ? -1 : 0; // Im schweren Modus startet das Piece einen Block höher

        if (checkCollision()) {
            gameOver();
        }
    }

    function createPiece() {
        const typeId = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
        const shape = SHAPES[typeId];
        return {
            x: 0, y: 0, shape: shape, color: COLORS[typeId], typeId: typeId
        };
    }

    function checkCollision() {
        const { shape, x, y } = piece;
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col] && (grid[y + row] && grid[y + row][x + col]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    function placePiece() {
        const { shape, x, y, typeId } = piece;
        shape.forEach((row, rIdx) => {
            row.forEach((value, cIdx) => {
                if (value) {
                    grid[y + rIdx][x + cIdx] = typeId;
                }
            });
        });
        
        // NEU: Vibration beim Ablegen auslösen
        doVibrate();
        
        clearLines();
    }
    
    // NEU: Funktion für die Vibration
    function doVibrate() {
        if (isVibrationEnabled && navigator.vibrate) {
            navigator.vibrate(50); // Vibriert für 50 Millisekunden
        }
    }

    function clearLines() {
        let linesCleared = 0;
        outer: for (let r = ROWS - 1; r >= 0; r--) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] === 0) {
                    continue outer;
                }
            }
            const row = grid.splice(r, 1)[0].fill(0);
            grid.unshift(row);
            r++;
            linesCleared++;
        }
        if (linesCleared > 0) {
            score += linesCleared * 10;
        }
    }

    function draw() {
        context.fillStyle = '#000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        drawPiece();
        updateScore();
    }

    function drawGrid() {
        grid.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    context.fillStyle = COLORS[value];
                    context.fillRect(x, y, 1, 1);
                }
            });
        });
    }

    function drawPiece() {
        const { shape, x, y, color } = piece;
        context.fillStyle = color;
        shape.forEach((row, rIdx) => {
            row.forEach((value, cIdx) => {
                if (value) {
                    context.fillRect(x + cIdx, y + rIdx, 1, 1);
                }
            });
        });
    }

    function updateScore() {
        scoreElement.textContent = score;
        highscoreElement.textContent = highscore;
        highscoreHardElement.textContent = highscoreHard;
    }

    function gameOver() {
        if (isHardMode) {
            if (score > highscoreHard) {
                highscoreHard = score;
                setCookie('highscoreHard', highscoreHard, 365);
            }
        } else {
            if (score > highscore) {
                highscore = score;
                setCookie('highscore', highscore, 365);
            }
        }
        resetGame();
    }

    function resetGame() {
        score = 0;
        grid = createGrid();
        newPiece();
    }

    function rotate() {
        const { shape } = piece;
        const newShape = shape[0].map((_, colIndex) => shape.map(row => row[colIndex]).reverse());
        
        const originalX = piece.x;
        const originalShape = piece.shape;
        piece.shape = newShape;

        // Wandkollisions-Prüfung
        let offset = 1;
        while(checkCollision()) {
            piece.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > piece.shape[0].length) {
                piece.shape = originalShape; // Rotation rückgängig machen
                piece.x = originalX;
                return;
            }
        }
    }
    
    // Spiel-Loop
    let dropCounter = 0;
    let dropInterval = 1000;
    let lastTime = 0;

    function update(time = 0) {
        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;

        if (dropCounter > dropInterval) {
            dropPiece();
        }

        draw();
        requestAnimationFrame(update);
    }

    function dropPiece() {
        piece.y++;
        if (checkCollision()) {
            piece.y--;
            placePiece();
            newPiece();
        }
        dropCounter = 0;
    }

    // --- Steuerung ---
    document.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft') {
            piece.x--;
            if (checkCollision()) piece.x++;
        } else if (event.key === 'ArrowRight') {
            piece.x++;
            if (checkCollision()) piece.x--;
        } else if (event.key === 'ArrowDown') {
            dropPiece();
        } else if (event.key === 'ArrowUp') {
            rotate();
        }
    });

    // --- Cookie Funktionen ---
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    // --- NEU: Einstellungen laden und speichern ---
    function loadSettings() {
        const savedDifficulty = getCookie('difficultyMode');
        const savedVibration = getCookie('vibrationEnabled');

        // Schwierigkeitsgrad laden
        if (savedDifficulty === 'true') {
            difficultyToggle.checked = true;
            isHardMode = true;
            dropInterval = 200; // Schneller im schweren Modus
        } else {
            difficultyToggle.checked = false;
            isHardMode = false;
            dropInterval = 1000;
        }

        // Vibrationseinstellung laden
        if (savedVibration === 'false') {
            vibrationToggle.checked = false;
            isVibrationEnabled = false;
        } else {
            // Standard ist an
            vibrationToggle.checked = true;
            isVibrationEnabled = true;
        }
    }
    
    // Event-Listener für den Schwierigkeits-Schalter
    difficultyToggle.addEventListener('change', () => {
        isHardMode = difficultyToggle.checked;
        setCookie('difficultyMode', isHardMode, 365);
        dropInterval = isHardMode ? 200 : 1000;
        resetGame(); // Spiel beim Wechsel zurücksetzen
    });
    
    // NEU: Event-Listener für den Vibrations-Schalter
    vibrationToggle.addEventListener('change', () => {
        isVibrationEnabled = vibrationToggle.checked;
        setCookie('vibrationEnabled', isVibrationEnabled, 365);
    });

    // --- Spielstart ---
    loadSettings(); // NEU: Einstellungen beim Start laden
    updateScore();
    newPiece();
    update();
});
