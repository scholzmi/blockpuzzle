document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const figurenAuswahlElement = document.getElementById('figuren-auswahl');

    // === Spiel-Konstanten ===
    const BREITE = 10;
    const HOEHE = 10;
    let spielbrett = []; // 2D-Array, das den Zustand des Spielfelds speichert (0 = frei, 1 = belegt)
    let punkte = 0;
    let aktuelleFiguren = []; // Die drei Figuren zur Auswahl
    let gezogeneFigur = null; // Die Figur, die gerade per Drag-and-Drop bewegt wird

    // === Figuren-Definitionen ===
    // Die Formen werden als 2D-Arrays aus 0 und 1 definiert.
    // Dies macht Rotationen und Kollisionsprüfungen einfacher.
    const FIGUREN_POOL = [
        // großes L (1,4,7,8,9) -> 3x3
        { name: 'grossesL', form: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] },
        // kleines L (1,4,7,8) -> 3x2
        { name: 'kleinesL', form: [[1, 0], [1, 0], [1, 1]] },
        // Z (1,2,5,6) -> 2x3
        { name: 'zForm1', form: [[1, 1, 0], [0, 1, 1]] },
        // Z (2,3,4,5) -> 2x3 (gedreht)
        { name: 'zForm2', form: [[0, 1, 1], [1, 1, 0]] },
        // Plus (2,4,5,6,8) -> 3x3
        { name: 'plus', form: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] },
        // I (1,2,3) -> 1x3
        { name: 'i3', form: [[1, 1, 1]] },
        // 3x3 Block (1-9)
        { name: 'block3x3', form: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
        // 2x3 Block (1-6)
        { name: 'block2x3', form: [[1, 1, 1], [1, 1, 1]] },
        // Gerade 4
        { name: 'gerade4', form: [[1, 1, 1, 1]] },
        // Gerade 5
        { name: 'gerade5', form: [[1, 1, 1, 1, 1]] },
        // Einzelner Punkt (Joker)
        { name: 'punkt', form: [[1]] }
    ];

    /**
     * Rotiert eine gegebene Figur (Matrix) um 90, 180 oder 270 Grad.
     * @param {Array<Array<number>>} matrix - Die Form der Figur.
     * @returns {Array<Array<number>>} Die rotierte Form.
     */
    function rotiereFigur(matrix) {
        const rotationen = Math.floor(Math.random() * 4); // 0, 1, 2 oder 3 Rotationen
        let rotierteMatrix = matrix;
        for (let i = 0; i < rotationen; i++) {
            rotierteMatrix = rotierteMatrix[0].map((val, index) => rotierteMatrix.map(row => row[index]).reverse());
        }
        return rotierteMatrix;
    }

    /**
     * Erstellt das leere Spielfeld im Speicher und im DOM.
     */
    function erstelleSpielfeld() {
        spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0));
        spielbrettElement.innerHTML = '';
        for (let y = 0; y < HOEHE; y++) {
            for (let x = 0; x < BREITE; x++) {
                const zelle = document.createElement('div');
                zelle.classList.add('zelle');
                zelle.dataset.x = x;
                zelle.dataset.y = y;
                spielbrettElement.appendChild(zelle);
            }
        }
    }

    /**
     * Zeichnet das Spielfeld basierend auf dem 'spielbrett'-Array neu.
     */
    function zeichneSpielfeld() {
        for (let y = 0; y < HOEHE; y++) {
            for (let x = 0; x < BREITE; x++) {
                const zelle = spielbrettElement.children[y * BREITE + x];
                if (spielbrett[y][x] === 1) {
                    zelle.classList.add('belegt');
                } else {
                    zelle.classList.remove('belegt');
                }
            }
        }
    }

    /**
     * Wählt drei neue, zufällige Figuren aus und zeigt sie an.
     */
    function generiereNeueFiguren() {
        figurenAuswahlElement.innerHTML = '';
        aktuelleFiguren = [];

        for (let i = 0; i < 3; i++) {
            const zufallsFigurVorlage = FIGUREN_POOL[Math.floor(Math.random() * FIGUREN_POOL.length)];
            const rotierteForm = rotiereFigur(zufallsFigurVorlage.form);
            const figur = { id: i, form: rotierteForm };
            aktuelleFiguren.push(figur);
            
            const figurElement = erstelleFigurElement(figur);
            figurenAuswahlElement.appendChild(figurElement);
        }
        
        if (istSpielVorbei()) {
            alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`);
        }
    }

    /**
     * Erstellt das HTML-Element für eine Figur, damit es angezeigt werden kann.
     * @param {object} figur - Das Figur-Objekt.
     * @returns {HTMLElement} Das erstellte div-Element für die Figur.
     */
    function erstelleFigurElement(figur) {
        const container = document.createElement('div');
        container.classList.add('figur-container');
        container.setAttribute('draggable', 'true');
        container.dataset.figurId = figur.id;

        const form = figur.form;
        container.style.gridTemplateRows = `repeat(${form.length}, 20px)`;
        container.style.gridTemplateColumns = `repeat(${form[0].length}, 20px)`;

        for (let y = 0; y < form.length; y++) {
            for (let x = 0; x < form[0].length; x++) {
                const block = document.createElement('div');
                if (form[y][x] === 1) {
                    block.classList.add('figur-block');
                }
                container.appendChild(block);
            }
        }
        return container;
    }
    
    /**
     * Prüft, ob eine Figur an einer bestimmten Position platziert werden kann.
     * @param {object} figur - Die zu platzierende Figur.
     * @param {number} startX - Die X-Koordinate auf dem Brett.
     * @param {number} startY - Die Y-Koordinate auf dem Brett.
     * @returns {boolean} True, wenn die Platzierung gültig ist.
     */
    function kannPlatzieren(figur, startX, startY) {
        const form = figur.form;
        for (let y = 0; y < form.length; y++) {
            for (let x = 0; x < form[0].length; x++) {
                if (form[y][x] === 1) {
                    const brettX = startX + x;
                    const brettY = startY + y;

                    // Prüfen, ob außerhalb des Bretts
                    if (brettX >= BREITE || brettY >= HOEHE) return false;
                    // Prüfen, ob das Feld bereits belegt ist
                    if (spielbrett[brettY][brettX] === 1) return false;
                }
            }
        }
        return true;
    }
    
    /**
     * Platziert eine Figur auf dem Spielfeld im Datenmodell.
     * @param {object} figur - Die zu platzierende Figur.
     * @param {number} startX - Die X-Koordinate.
     * @param {number} startY - Die Y-Koordinate.
     */
    function platziereFigur(figur, startX, startY) {
         const form = figur.form;
         let blockAnzahl = 0;
         for (let y = 0; y < form.length; y++) {
            for (let x = 0; x < form[0].length; x++) {
                if (form[y][x] === 1) {
                    spielbrett[startY + y][startX + x] = 1;
                    blockAnzahl++;
                }
            }
        }
        punkte += blockAnzahl; // Punkte für jeden platzierten Block
    }

    /**
     * Überprüft und leert volle Reihen und Spalten.
     */
    function leereVolleLinien() {
        let volleReihen = [];
        let volleSpalten = [];
        let linienGeleert = 0;

        // Volle Reihen finden
        for (let y = 0; y < HOEHE; y++) {
            if (spielbrett[y].every(zelle => zelle === 1)) {
                volleReihen.push(y);
                linienGeleert++;
            }
        }

        // Volle Spalten finden
        for (let x = 0; x < BREITE; x++) {
            let spalteVoll = true;
            for (let y = 0; y < HOEHE; y++) {
                if (spielbrett[y][x] === 0) {
                    spalteVoll = false;
                    break;
                }
            }
            if (spalteVoll) {
                volleSpalten.push(x);
                linienGeleert++;
            }
        }

        // Reihen leeren
        volleReihen.forEach(y => {
            for (let x = 0; x < BREITE; x++) spielbrett[y][x] = 0;
        });

        // Spalten leeren
        volleSpalten.forEach(x => {
            for (let y = 0; y < HOEHE; y++) spielbrett[y][x] = 0;
        });
        
        // Bonuspunkte für geleerte Linien
        if(linienGeleert > 0) {
            punkte += linienGeleert * 10 * linienGeleert; // Multiplikator-Bonus
        }

        zeichneSpielfeld();
        punkteElement.textContent = punkte;
    }

    /**
     * Prüft, ob das Spiel vorbei ist (keine Figur kann mehr platziert werden).
     * @returns {boolean} True, wenn das Spiel vorbei ist.
     */
    function istSpielVorbei() {
        for(const figur of aktuelleFiguren) {
            if (!figur) continue; // Falls eine Figur schon gespielt wurde
            // Prüfe jede mögliche Position auf dem Brett
            for(let y = 0; y < HOEHE; y++) {
                for(let x = 0; x < BREITE; x++) {
                    if (kannPlatzieren(figur, x, y)) {
                        return false; // Mindestens ein Zug ist möglich
                    }
                }
            }
        }
        return true; // Keine Figur kann platziert werden
    }

    // === Event Listener ===
    figurenAuswahlElement.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('figur-container')) {
            const figurId = parseInt(e.target.dataset.figurId);
            gezogeneFigur = aktuelleFiguren.find(f => f.id === figurId);
        }
    });

    spielbrettElement.addEventListener('dragover', (e) => {
        e.preventDefault(); // Erlaubt das Droppen
    });

    spielbrettElement.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!gezogeneFigur || !e.target.classList.contains('zelle')) return;

        const x = parseInt(e.target.dataset.x);
        const y = parseInt(e.target.dataset.y);
        
        if (kannPlatzieren(gezogeneFigur, x, y)) {
            platziereFigur(gezogeneFigur, x, y);
            leereVolleLinien();
            
            // Gezogene Figur aus Auswahl entfernen
            const figurElement = document.querySelector(`[data-figur-id="${gezogeneFigur.id}"]`);
            if(figurElement) figurElement.remove();
            
            aktuelleFiguren[gezogeneFigur.id] = null;
            gezogeneFigur = null;
            
            // Wenn alle 3 Figuren gespielt wurden, neue generieren
            if (aktuelleFiguren.every(f => f === null)) {
                generiereNeueFiguren();
            }
        }
    });

    /**
     * Startet das Spiel
     */
    function spielStart() {
        erstelleSpielfeld();
        zeichneSpielfeld();
        generiereNeueFiguren();
    }

    spielStart();
});