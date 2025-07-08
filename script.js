document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const rekordElement = document.getElementById('rekord'); // NEU
    const figurenSlots = document.querySelectorAll('.figur-slot');

    // === Spiel-Konstanten und Variablen ===
    const BREITE = 10;
    const HOEHE = 10;
    let spielbrett = []; 
    let punkte = 0;
    let rekord = 0; // NEU
    let figurenInSlots = [null, null, null];

    let ausgewaehlteFigur = null;
    let ausgewaehlterSlotIndex = -1;

    // === Figuren-Pool mit allen Rotationen (unverändert) ===
    const FIGUREN_POOL = [
        { form: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] }, { form: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] }, { form: [[1]] },
        { form: [[1, 1, 1, 1, 1]] }, { form: [[1], [1], [1], [1], [1]] },
        { form: [[1, 1, 1, 1]] }, { form: [[1], [1], [1], [1]] },
        { form: [[1, 1, 1]] }, { form: [[1], [1], [1]] },
        { form: [[1, 1, 1], [1, 1, 1]] }, { form: [[1, 1], [1, 1], [1, 1]] },
        { form: [[1, 1, 0], [0, 1, 1]] }, { form: [[0, 1], [1, 1], [1, 0]] },
        { form: [[0, 1, 1], [1, 1, 0]] }, { form: [[1, 0], [1, 1], [0, 1]] },
        { form: [[1, 0], [1, 0], [1, 1]] }, { form: [[1, 1, 1], [1, 0, 0]] },
        { form: [[1, 1], [0, 1], [0, 1]] }, { form: [[0, 0, 1], [1, 1, 1]] },
        { form: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] }, { form: [[1, 1, 1, 1], [1, 0, 0, 0]] },
        { form: [[1, 1, 1], [0, 0, 1], [0, 0, 1]] }, { form: [[0, 0, 0, 1], [1, 1, 1, 1]] }
    ];

    // === NEU: Cookie-Hilfsfunktionen ===
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
    
    /**
     * NEU: Prüft am Spielende, ob ein neuer Rekord aufgestellt wurde.
     */
    function pruefeUndSpeichereRekord() {
        if (punkte > rekord) {
            rekord = punkte;
            rekordElement.textContent = rekord;
            setCookie("rekord", rekord, 365); // Speichert den Rekord für 1 Jahr
            alert(`Neuer Rekord: ${rekord} Punkte!`);
        } else {
            alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`);
        }
        spielStart(); // Spiel nach dem "OK" Klick neu starten
    }


    // === Kernlogik (leicht angepasst) ===

    function spielStart() {
        // Rekord aus Cookie laden
        const gespeicherterRekord = getCookie("rekord");
        if (gespeicherterRekord) {
            rekord = parseInt(gespeicherterRekord, 10);
            rekordElement.textContent = rekord;
        }

        punkte = 0;
        punkteElement.textContent = punkte;
        erstelleSpielfeld();
        zeichneSpielfeld();
        generiereNeueFiguren();
    }

    function generiereNeueFiguren() {
        for (let i = 0; i < 3; i++) {
            const zufallsFigur = FIGUREN_POOL[Math.floor(Math.random() * FIGUREN_POOL.length)];
            figurenInSlots[i] = { form: zufallsFigur.form, id: i };
            zeichneFigurInSlot(i);
        }
        if (istSpielVorbei()) {
            setTimeout(pruefeUndSpeichereRekord, 100);
        }
    }

    function platziereFigur(figur, startX, startY) {
        // ... (Funktion bleibt fast gleich)
        let blockAnzahl = 0;
        figur.form.forEach((reihe, y) => {
            reihe.forEach((block, x) => {
                if (block === 1) { spielbrett[startY + y][startX + x] = 1; blockAnzahl++; }
            });
        });
        punkte += blockAnzahl;
        leereVolleLinien();
        zeichneSpielfeld();
        punkteElement.textContent = punkte;

        figurenInSlots[ausgewaehlterSlotIndex] = null;
        ausgewaehlteFigur = null;
        ausgewaehlterSlotIndex = -1;
        spielbrettElement.style.cursor = 'default';

        if (figurenInSlots.every(f => f === null)) {
            generiereNeueFiguren();
        } else if (istSpielVorbei()) {
             setTimeout(pruefeUndSpeichereRekord, 100);
        }
    }

    // === Restliche Funktionen und Event Listener (unverändert) ===
    function erstelleSpielfeld() { spielbrettElement.innerHTML = ''; spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0)); for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const zelle = document.createElement('div'); zelle.classList.add('zelle'); spielbrettElement.appendChild(zelle); } } }
    function figurSlotKlick(index) { if (ausgewaehlteFigur && ausgewaehlterSlotIndex === index) { abbrechen(); return; } if (figurenInSlots[index]) { ausgewaehlteFigur = figurenInSlots[index]; ausgewaehlterSlotIndex = index; figurenSlots[index].innerHTML = ''; spielbrettElement.style.cursor = 'pointer'; } }
    function abbrechen() { if (ausgewaehlterSlotIndex !== -1) { loescheVorschau(); zeichneFigurInSlot(ausgewaehlterSlotIndex); ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; spielbrettElement.style.cursor = 'default'; } }
    function mausBewegungAufBrett(e) { if (!ausgewaehlteFigur) return; const rect = spielbrettElement.getBoundingClientRect(); const mausX = e.clientX - rect.left; const mausY = e.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); loescheVorschau(); zeichneVorschau(ausgewaehlteFigur, zielX, zielY); }
    function klickAufBrett(e) { if (!ausgewaehlteFigur) return; const rect = spielbrettElement.getBoundingClientRect(); const mausX = e.clientX - rect.left; const mausY = e.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); if (kannPlatzieren(ausgewaehlteFigur, zielX, zielY)) { platziereFigur(ausgewaehlteFigur, zielX, zielY); } }
    function zeichneVorschau(figur, startX, startY) { const kannAblegen = kannPlatzieren(figur, startX, startY); const vorschauKlasse = kannAblegen ? 'vorschau' : 'vorschau-ungueltig'; figur.form.forEach((reihe, y) => { reihe.forEach((block, x) => { if (block === 1) { const brettY = startY + y; const brettX = startX + x; if (brettY < HOEHE && brettX < BREITE && brettY >= 0 && brettX >= 0) { const zellenIndex = brettY * BREITE + brettX; spielbrettElement.children[zellenIndex]?.classList.add(vorschauKlasse); } } }); }); }
    function zeichneFigurInSlot(index) { const slot = figurenSlots[index]; slot.innerHTML = ''; const figur = figurenInSlots[index]; if (figur) { const container = document.createElement('div'); container.classList.add('figur-container'); const form = figur.form; container.style.gridTemplateRows = `repeat(${form.length}, 30px)`; container.style.gridTemplateColumns = `repeat(${form[0].length}, 30px)`; form.forEach(reihe => { reihe.forEach(block => { const blockDiv = document.createElement('div'); if (block === 1) blockDiv.classList.add('figur-block'); container.appendChild(blockDiv); }); }); slot.appendChild(container); } }
    function loescheVorschau() { document.querySelectorAll('.vorschau, .vorschau-ungueltig').forEach(z => z.classList.remove('vorschau', 'vorschau-ungueltig')); }
    function zeichneSpielfeld() { spielbrett.forEach((reihe, y) => reihe.forEach((zelle, x) => { const z = spielbrettElement.children[y * BREITE + x]; z.className = 'zelle'; if(zelle === 1) z.classList.add('belegt'); })); }
    function kannPlatzieren(figur, startX, startY) { for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX < 0 || bX >= BREITE || bY < 0 || bY >= HOEHE || spielbrett[bY][bX] === 1) return false; } } } return true; }
    function leereVolleLinien() { const vR = [], vS = []; for(let y=0; y<HOEHE; y++) if(spielbrett[y].every(z=>z===1)) vR.push(y); for(let x=0; x<BREITE; x++) { let voll=true; for(let y=0; y<HOEHE; y++) if(spielbrett[y][x]===0) voll=false; if(voll) vS.push(x); } vR.forEach(y=>spielbrett[y].fill(0)); vS.forEach(x=>spielbrett.forEach(r=>r[x]=0)); const linien = vR.length + vS.length; if(linien > 0) punkte += linien * 10 * linien; }
    function istSpielVorbei() { for(const f of figurenInSlots) { if(f) { for(let y=0; y<HOEHE; y++) for(let x=0; x<BREITE; x++) if(kannPlatzieren(f, x, y)) return false; } } return true; }

    // === Event Listener zuweisen ===
    figurenSlots.forEach((slot, index) => { slot.addEventListener('click', () => figurSlotKlick(index)); });
    spielbrettElement.addEventListener('mousemove', mausBewegungAufBrett);
    spielbrettElement.addEventListener('mouseleave', loescheVorschau);
    spielbrettElement.addEventListener('click', klickAufBrett);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') abbrechen(); });

    // === Spiel starten ===
    spielStart();
});