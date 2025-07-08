document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const figurenSlots = document.querySelectorAll('.figur-slot');

    // === Spiel-Konstanten und Variablen ===
    const BREITE = 10;
    const HOEHE = 10;
    let spielbrett = []; 
    let punkte = 0;
    let figurenInSlots = [null, null, null]; // Speichert die Daten der 3 Figuren

    // Zustand für die Klick-Steuerung
    let ausgewaehlteFigur = null;
    let ausgewaehlterSlotIndex = -1;

    // === Figuren-Definitionen (unverändert) ===
    const FIGUREN_POOL = [
        { form: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] }, { form: [[1, 0], [1, 0], [1, 1]] }, { form: [[1, 1, 0], [0, 1, 1]] }, { form: [[0, 1, 1], [1, 1, 0]] }, { form: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] }, { form: [[1, 1, 1]] }, { form: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] }, { form: [[1, 1, 1], [1, 1, 1]] }, { form: [[1, 1, 1, 1]] }, { form: [[1, 1, 1, 1, 1]] }, { form: [[1]] }
    ];

    // === Kernlogik ===

    /**
     * Setzt das Spiel zurück oder startet es initial.
     */
    function spielStart() {
        punkte = 0;
        punkteElement.textContent = punkte;
        spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0));
        zeichneSpielfeld();
        generiereNeueFiguren();
    }

    /**
     * Füllt die drei Slots mit neuen, zufälligen und rotierten Figuren.
     */
    function generiereNeueFiguren() {
        for (let i = 0; i < 3; i++) {
            const vorlage = FIGUREN_POOL[Math.floor(Math.random() * FIGUREN_POOL.length)];
            const form = rotiereFigur(vorlage.form);
            figurenInSlots[i] = { form: form, id: i };
            zeichneFigurInSlot(i);
        }
        if (istSpielVorbei()) {
            setTimeout(() => alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`), 100);
        }
    }

    /**
     * Platziert eine Figur auf dem Spielfeld, aktualisiert Punkte und prüft auf volle Reihen.
     */
    function platziereFigur(figur, startX, startY) {
        let blockAnzahl = 0;
        figur.form.forEach((reihe, y) => {
            reihe.forEach((block, x) => {
                if (block === 1) {
                    spielbrett[startY + y][startX + x] = 1;
                    blockAnzahl++;
                }
            });
        });
        punkte += blockAnzahl;
        leereVolleLinien();
        zeichneSpielfeld();
        punkteElement.textContent = punkte;

        // Zustand zurücksetzen
        figurenInSlots[ausgewaehlterSlotIndex] = null;
        ausgewaehlteFigur = null;
        ausgewaehlterSlotIndex = -1;
        spielbrettElement.style.cursor = 'default';

        // Prüfen, ob neue Figuren gebraucht werden
        if (figurenInSlots.every(f => f === null)) {
            generiereNeueFiguren();
        } else if (istSpielVorbei()) {
            setTimeout(() => alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`), 100);
        }
    }

    // === Event-Handler ===

    /**
     * Wählt eine Figur aus einem Slot aus oder bricht die Auswahl ab.
     */
    function figurSlotKlick(index) {
        if (ausgewaehlteFigur && ausgewaehlterSlotIndex === index) {
            // Auswahl abbrechen bei erneutem Klick
            abbrechen();
            return;
        }
        
        // Nur auswählen, wenn eine Figur im Slot ist
        if (figurenInSlots[index]) {
            ausgewaehlteFigur = figurenInSlots[index];
            ausgewaehlterSlotIndex = index;
            figurenSlots[index].innerHTML = ''; // Figur aus Slot entfernen
            spielbrettElement.style.cursor = 'pointer';
        }
    }
    
    /**
     * Bricht die Figurenauswahl ab und legt sie zurück in den Slot.
     */
    function abbrechen() {
        if (ausgewaehlterSlotIndex !== -1) {
            loescheVorschau();
            zeichneFigurInSlot(ausgewaehlterSlotIndex); // Figur zurückzeichnen
            ausgewaehlteFigur = null;
            ausgewaehlterSlotIndex = -1;
            spielbrettElement.style.cursor = 'default';
        }
    }
    
    /**
     * Verarbeitet die Mausbewegung über dem Spielfeld und zeigt die Vorschau an.
     */
    function mausBewegungAufBrett(e) {
        if (!ausgewaehlteFigur) return;
        
        const rect = spielbrettElement.getBoundingClientRect();
        const mausX = e.clientX - rect.left;
        const mausY = e.clientY - rect.top;

        const zielX = Math.floor(mausX / 40);
        const zielY = Math.floor(mausY / 40);

        loescheVorschau();
        zeichneVorschau(ausgewaehlteFigur, zielX, zielY);
    }
    
    /**
     * Verarbeitet einen Klick auf dem Spielfeld, um eine Figur zu platzieren.
     */
    function klickAufBrett(e) {
        if (!ausgewaehlteFigur) return;

        const rect = spielbrettElement.getBoundingClientRect();
        const mausX = e.clientX - rect.left;
        const mausY = e.clientY - rect.top;

        const zielX = Math.floor(mausX / 40);
        const zielY = Math.floor(mausY / 40);

        if (kannPlatzieren(ausgewaehlteFigur, zielX, zielY)) {
            platziereFigur(ausgewaehlteFigur, zielX, zielY);
        }
    }

    // === Hilfs- und Zeichenfunktionen ===

    function zeichneVorschau(figur, startX, startY) {
        const kannAblegen = kannPlatzieren(figur, startX, startY);
        const vorschauKlasse = kannAblegen ? 'vorschau' : 'vorschau-ungueltig';
        
        figur.form.forEach((reihe, y) => {
            reihe.forEach((block, x) => {
                if (block === 1) {
                    const brettY = startY + y;
                    const brettX = startX + x;
                    if (brettY < HOEHE && brettX < BREITE && brettY >= 0 && brettX >= 0) {
                       const zellenIndex = brettY * BREITE + brettX;
                       spielbrettElement.children[zellenIndex]?.classList.add(vorschauKlasse);
                    }
                }
            });
        });
    }

    function zeichneFigurInSlot(index) {
        const slot = figurenSlots[index];
        slot.innerHTML = '';
        const figur = figurenInSlots[index];
        
        if (figur) {
            const container = document.createElement('div');
            container.classList.add('figur-container');
            const form = figur.form;
            container.style.gridTemplateRows = `repeat(${form.length}, 30px)`;
            container.style.gridTemplateColumns = `repeat(${form[0].length}, 30px)`;
            
            form.forEach(reihe => {
                reihe.forEach(block => {
                    const blockDiv = document.createElement('div');
                    if (block === 1) blockDiv.classList.add('figur-block');
                    container.appendChild(blockDiv);
                });
            });
            slot.appendChild(container);
        }
    }
    
    function loescheVorschau() { document.querySelectorAll('.vorschau, .vorschau-ungueltig').forEach(z => z.classList.remove('vorschau', 'vorschau-ungueltig')); }
    function zeichneSpielfeld() { spielbrett.forEach((reihe, y) => reihe.forEach((zelle, x) => { const z = spielbrettElement.children[y * BREITE + x]; z.className = 'zelle'; if(zelle === 1) z.classList.add('belegt'); })); }
    function rotiereFigur(matrix) { let m = matrix; for (let i = 0; i < Math.floor(Math.random() * 4); i++) { m = m[0].map((_, colIndex) => m.map(row => row[colIndex]).reverse()); } return m; }
    function kannPlatzieren(figur, startX, startY) { for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX < 0 || bX >= BREITE || bY < 0 || bY >= HOEHE || spielbrett[bY][bX] === 1) return false; } } } return true; }
    function leereVolleLinien() { const vR = [], vS = []; for(let y=0; y<HOEHE; y++) if(spielbrett[y].every(z=>z===1)) vR.push(y); for(let x=0; x<BREITE; x++) { let voll=true; for(let y=0; y<HOEHE; y++) if(spielbrett[y][x]===0) voll=false; if(voll) vS.push(x); } vR.forEach(y=>spielbrett[y].fill(0)); vS.forEach(x=>spielbrett.forEach(r=>r[x]=0)); if(vR.length+vS.length > 0) punkte += (vR.length+vS.length) * 10 * (vR.length+vS.length); }
    function istSpielVorbei() { for(const f of figurenInSlots) { if(f) { for(let y=0; y<HOEHE; y++) for(let x=0; x<BREITE; x++) if(kannPlatzieren(f, x, y)) return false; } } return true; }

    // === Event Listener zuweisen ===
    figurenSlots.forEach((slot, index) => {
        slot.addEventListener('click', () => figurSlotKlick(index));
    });

    spielbrettElement.addEventListener('mousemove', mausBewegungAufBrett);
    spielbrettElement.addEventListener('mouseleave', loescheVorschau);
    spielbrettElement.addEventListener('click', klickAufBrett);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') abbrechen();
    });

    // === Spiel starten ===
    spielStart();
});