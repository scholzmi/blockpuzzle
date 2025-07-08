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
    
    // ===================================================================================
    // KORRIGIERTE FUNKTION: Diese Funktion war fehlerhaft und wurde repariert.
    // ===================================================================================
    /**
     * Rotiert eine Figur (Matrix) eine zufällige Anzahl von Malen um 90 Grad.
     */
    function rotiereFigur(matrix) {
        let gedrehteMatrix = matrix;
        const anzahlRotationen = Math.floor(Math.random() * 4);

        for (let i = 0; i < anzahlRotationen; i++) {
            // Transponieren (Zeilen und Spalten tauschen)
            const transponiert = gedrehteMatrix[0].map((_, colIndex) => 
                gedrehteMatrix.map(row => row[colIndex])
            );
            // Jede neue Zeile umkehren, um die Drehung abzuschliessen
            gedrehteMatrix = transponiert.map(row => row.reverse());
        }
        return gedrehteMatrix;
    }
    // ===================================================================================


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
            abbrechen();
            return;
        }
        
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