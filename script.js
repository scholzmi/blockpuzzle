document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const figurenAuswahlElement = document.getElementById('figuren-auswahl');

    // === Spiel-Konstanten und Variablen ===
    const BREITE = 10;
    const HOEHE = 10;
    let spielbrett = []; 
    let punkte = 0;
    let aktuelleFiguren = []; 
    
    // Variablen für die Drag-Interaktion
    let gezogeneFigur = null; 
    let gezogenesElement = null;
    let letzteVorschauKoordinaten = { x: -1, y: -1 };

    // === Figuren-Definitionen (unverändert) ===
    const FIGUREN_POOL = [
        { name: 'grossesL', form: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] }, { name: 'kleinesL', form: [[1, 0], [1, 0], [1, 1]] }, { name: 'zForm1', form: [[1, 1, 0], [0, 1, 1]] }, { name: 'zForm2', form: [[0, 1, 1], [1, 1, 0]] }, { name: 'plus', form: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] }, { name: 'i3', form: [[1, 1, 1]] }, { name: 'block3x3', form: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] }, { name: 'block2x3', form: [[1, 1, 1], [1, 1, 1]] }, { name: 'gerade4', form: [[1, 1, 1, 1]] }, { name: 'gerade5', form: [[1, 1, 1, 1, 1]] }, { name: 'punkt', form: [[1]] }
    ];

    /**
     * Erstellt das HTML-Element für eine Figur
     */
    function erstelleFigurElement(figur) {
        const container = document.createElement('div');
        container.classList.add('figur-container');
        container.setAttribute('draggable', 'true');
        container.dataset.figurId = figur.id;
        const form = figur.form;
        container.style.gridTemplateRows = `repeat(${form.length}, 40px)`;
        container.style.gridTemplateColumns = `repeat(${form[0].length}, 40px)`;
        for (let y = 0; y < form.length; y++) {
            for (let x = 0; x < form[0].length; x++) {
                const block = document.createElement('div');
                if (form[y][x] === 1) block.classList.add('figur-block');
                container.appendChild(block);
            }
        }
        return container;
    }

    /**
     * Löscht alle Vorschau-Hervorhebungen vom Spielfeld.
     */
    function loescheVorschau() {
        document.querySelectorAll('.vorschau, .vorschau-ungueltig').forEach(z => {
            z.classList.remove('vorschau', 'vorschau-ungueltig');
        });
    }

    /**
     * Zeigt die Vorschau an (blau für gültig, rot für ungültig).
     */
    function zeigeVorschau(startX, startY) {
        loescheVorschau();
        if (!gezogeneFigur) return;

        const kannAblegen = kannPlatzieren(gezogeneFigur, startX, startY);
        const vorschauKlasse = kannAblegen ? 'vorschau' : 'vorschau-ungueltig';
        
        const form = gezogeneFigur.form;
        for (let y = 0; y < form.length; y++) {
            for (let x = 0; x < form[0].length; x++) {
                if (form[y][x] === 1) {
                    const brettY = startY + y;
                    const brettX = startX + x;
                    if (brettY < HOEHE && brettX < BREITE) {
                       const zellenIndex = brettY * BREITE + brettX;
                       spielbrettElement.children[zellenIndex]?.classList.add(vorschauKlasse);
                    }
                }
            }
        }
    }


    // === Event Listener ===
    
    figurenAuswahlElement.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('figur-container')) {
            const figurId = parseInt(e.target.dataset.figurId);
            gezogeneFigur = aktuelleFiguren.find(f => f.id === figurId);
            gezogenesElement = e.target;

            // Den Standard-"Geist" des Browsers durch ein leeres Bild ersetzen
            const ghost = new Image();
            ghost.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            e.dataTransfer.setDragImage(ghost, 0, 0);

            // Figur im Auswahlbereich unsichtbar machen
            setTimeout(() => e.target.style.visibility = 'hidden', 0);
        }
    });
    
    figurenAuswahlElement.addEventListener('dragend', (e) => {
        if(gezogenesElement) {
            // Figur im Auswahlbereich wieder sichtbar machen
            gezogenesElement.style.visibility = 'visible';
        }
        loescheVorschau();
        gezogeneFigur = null;
        gezogenesElement = null;
    });

    spielbrettElement.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        const zielZelle = e.target.closest('.zelle');
        
        if (zielZelle) {
            const x = parseInt(zielZelle.dataset.x);
            const y = parseInt(zielZelle.dataset.y);
            
            if (x !== letzteVorschauKoordinaten.x || y !== letzteVorschauKoordinaten.y) {
                 zeigeVorschau(x, y);
                 letzteVorschauKoordinaten = { x, y };
            }
        }
    });

    spielbrettElement.addEventListener('dragleave', (e) => {
        loescheVorschau();
        letzteVorschauKoordinaten = { x: -1, y: -1 };
    });

    spielbrettElement.addEventListener('drop', (e) => {
        e.preventDefault();
        loescheVorschau();

        if (!gezogeneFigur || !e.target.classList.contains('zelle')) return;

        const x = parseInt(e.target.dataset.x);
        const y = parseInt(e.target.dataset.y);
        
        if (kannPlatzieren(gezogeneFigur, x, y)) {
            platziereFigur(gezogeneFigur, x, y);
            leereVolleLinien();
            
            gezogenesElement.remove(); // Figur aus der Auswahl entfernen
            
            aktuelleFiguren[gezogeneFigur.id] = null;
            
            // Wenn alle 3 Figuren gespielt wurden, neue generieren
            if (aktuelleFiguren.every(f => f === null)) {
                setTimeout(generiereNeueFiguren, 100);
            }
            // KORREKTUR: Die "istSpielVorbei"-Prüfung wurde von hier entfernt.
        }
    });


    // --- Unveränderte Kernfunktionen ---
    function rotiereFigur(matrix) { const r = Math.floor(Math.random() * 4); let m = matrix; for (let i = 0; i < r; i++) { m = m[0].map((v, i) => m.map(row => row[i]).reverse()); } return m; }
    function erstelleSpielfeld() { spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0)); spielbrettElement.innerHTML = ''; for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const z = document.createElement('div'); z.classList.add('zelle'); z.dataset.x = x; z.dataset.y = y; spielbrettElement.appendChild(z); } } }
    function zeichneSpielfeld() { for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const z = spielbrettElement.children[y * BREITE + x]; if (spielbrett[y][x] === 1) { z.classList.add('belegt'); } else { z.classList.remove('belegt'); } } } }
    function generiereNeueFiguren() { figurenAuswahlElement.innerHTML = ''; aktuelleFiguren = []; for (let i = 0; i < 3; i++) { const v = FIGUREN_POOL[Math.floor(Math.random() * FIGUREN_POOL.length)]; const f = rotiereFigur(v.form); const figur = { id: i, form: f }; aktuelleFiguren.push(figur); const fe = erstelleFigurElement(figur); figurenAuswahlElement.appendChild(fe); } if (istSpielVorbei()) { setTimeout(() => alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`), 100); } }
    function kannPlatzieren(figur, startX, startY) { const form = figur.form; for (let y = 0; y < form.length; y++) { for (let x = 0; x < form[0].length; x++) { if (form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX >= BREITE || bY >= HOEHE || bY < 0 || bX < 0 || spielbrett[bY][bX] === 1) return false; } } } return true; }
    function platziereFigur(figur, startX, startY) { const form = figur.form; let blockAnzahl = 0; for (let y = 0; y < form.length; y++) { for (let x = 0; x < form[0].length; x++) { if (form[y][x] === 1) { spielbrett[startY + y][startX + x] = 1; blockAnzahl++; } } } punkte += blockAnzahl; }
    function leereVolleLinien() { let vR = [], vS = [], lG = 0; for (let y = 0; y < HOEHE; y++) { if (spielbrett[y].every(z => z === 1)) { vR.push(y); lG++; } } for (let x = 0; x < BREITE; x++) { let sV = true; for (let y = 0; y < HOEHE; y++) { if (spielbrett[y][x] === 0) { sV = false; break; } } if (sV) { vS.push(x); lG++; } } vR.forEach(y => { for (let x = 0; x < BREITE; x++) spielbrett[y][x] = 0; }); vS.forEach(x => { for (let y = 0; y < HOEHE; y++) spielbrett[y][x] = 0; }); if(lG > 0) { punkte += lG * 10 * lG; } zeichneSpielfeld(); punkteElement.textContent = punkte; }
    function istSpielVorbei() { for(const f of aktuelleFiguren) { if (!f) continue; for(let y = 0; y < HOEHE; y++) { for(let x = 0; x < BREITE; x++) { if (kannPlatzieren(f, x, y)) return false; } } } return true; }
    function spielStart() { erstelleSpielfeld(); zeichneSpielfeld(); generiereNeueFiguren(); }

    spielStart();
});