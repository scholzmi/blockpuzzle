document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const rekordElement = document.getElementById('rekord');
    const versionElement = document.getElementById('version');
    const figurenSlots = document.querySelectorAll('.figur-slot');

    // === Spiel-Konstanten und Variablen ===
    const BREITE = 10, HOEHE = 10;
    let spielbrett = [], punkte = 0, rekord = 0, figurenInSlots = [null, null, null];
    let ausgewaehlteFigur = null, ausgewaehlterSlotIndex = -1;
    
    // NEU: Rundenzähler für dynamische Wahrscheinlichkeit
    let rundenZaehler = 0;

    // ===================================================================================
    // NEU: Aufgeteilte Figuren-Pools für die neue Wahrscheinlichkeitslogik
    // ===================================================================================
    const ZONK_FIGUREN_POOL = [
        { form: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]] }, // 4x4
        { form: [[1, 1, 1, 1, 1]] }, // 1x5
        { form: [[1], [1], [1], [1], [1]] }  // 5x1
    ];

    const JOKER_FIGUR = { form: [[1]] };

    const NORMALE_FIGUREN_POOL = [
        // Neue Figuren
        { form: [[1, 1], [1, 1]] }, // 2x2
        { form: [[1, 1, 1], [1, 1, 1]] }, // 2x3
        { form: [[1, 1], [1, 1], [1, 1]] }, // 3x2
        // T-Form (5,7,8,9) und ihre 3 Rotationen
        { form: [[0, 1, 0], [1, 1, 1]] },
        { form: [[1, 0], [1, 1], [1, 0]] },
        { form: [[1, 1, 1], [0, 1, 0]] },
        { form: [[0, 1], [1, 1], [0, 1]] },
        
        // Bisherige normale Figuren
        { form: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] }, { form: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] },
        { form: [[1, 1, 1, 1]] }, { form: [[1], [1], [1], [1]] },
        { form: [[1, 1, 1]] }, { form: [[1], [1], [1]] },
        { form: [[1, 1, 0], [0, 1, 1]] }, { form: [[0, 1], [1, 1], [1, 0]] },
        { form: [[0, 1, 1], [1, 1, 0]] }, { form: [[1, 0], [1, 1], [0, 1]] },
        { form: [[1, 0], [1, 0], [1, 1]] }, { form: [[1, 1, 1], [1, 0, 0]] },
        { form: [[1, 1], [0, 1], [0, 1]] }, { form: [[0, 0, 1], [1, 1, 1]] },
        { form: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] }, { form: [[1, 1, 1, 1], [1, 0, 0, 0]] },
        { form: [[1, 1, 1], [0, 0, 1], [0, 0, 1]] }, { form: [[0, 0, 0, 1], [1, 1, 1, 1]] }
    ];
    // ===================================================================================

    async function ladeKonfiguration() {
        try {
            const antwort = await fetch('config.json');
            if (!antwort.ok) throw new Error('Netzwerk-Antwort war nicht ok.');
            const config = await antwort.json();
            versionElement.textContent = config.version;
        } catch (error) {
            console.error('Fehler beim Laden der Konfigurationsdatei:', error);
            versionElement.textContent = "?.??";
        }
    }

    // === Kernlogik (angepasst) ===
    async function spielStart() {
        await ladeKonfiguration();
        
        const gespeicherterRekord = getCookie("rekord");
        rekord = gespeicherterRekord ? parseInt(gespeicherterRekord, 10) || 0 : 0;
        rekordElement.textContent = rekord;

        punkte = 0;
        punkteElement.textContent = punkte;
        rundenZaehler = 0; // Rundenzähler zurücksetzen
        erstelleSpielfeld();
        zeichneSpielfeld();
        generiereNeueFiguren();
    }
    
    // ===================================================================================
    // GEÄNDERT: Diese Funktion nutzt nun die neue, komplexe Wahrscheinlichkeitslogik.
    // ===================================================================================
    function generiereNeueFiguren() {
        rundenZaehler++;
        
        // Dynamische Wahrscheinlichkeit für den Joker berechnen
        const jokerReduktion = Math.floor((rundenZaehler - 1) / 5) * 0.01;
        const aktuelleJokerWahrscheinlichkeit = Math.max(0.03, 0.20 - jokerReduktion);

        const zonkWahrscheinlichkeit = 0.05; // 5%

        for (let i = 0; i < 3; i++) {
            let zufallsFigur;
            const zufallsZahl = Math.random();

            if (zufallsZahl < zonkWahrscheinlichkeit) {
                // 5% Chance für eine Zonk-Figur
                zufallsFigur = ZONK_FIGUREN_POOL[Math.floor(Math.random() * ZONK_FIGUREN_POOL.length)];
            } else if (zufallsZahl < zonkWahrscheinlichkeit + aktuelleJokerWahrscheinlichkeit) {
                // (z.B. 20%) Chance für den Joker
                zufallsFigur = JOKER_FIGUR;
            } else {
                // Restliche Chance für eine normale Figur
                zufallsFigur = NORMALE_FIGUREN_POOL[Math.floor(Math.random() * NORMALE_FIGUREN_POOL.length)];
            }
            
            figurenInSlots[i] = { form: zufallsFigur.form, id: i };
            zeichneFigurInSlot(i);
        }

        if (istSpielVorbei()) {
            setTimeout(pruefeUndSpeichereRekord, 100);
        }
    }
    // ===================================================================================

    // ... (alle anderen Funktionen und Event-Handler bleiben unverändert) ...
    function setCookie(name, value, days) { let expires = ""; if (days) { const date = new Date(); date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); expires = "; expires=" + date.toUTCString(); } document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax"; }
    function getCookie(name) { const nameEQ = name + "="; const ca = document.cookie.split(';'); for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) == ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length); } return null; }
    function pruefeUndSpeichereRekord() { if (punkte > rekord) { rekord = punkte; rekordElement.textContent = rekord; setCookie("rekord", rekord, 365); alert(`Neuer Rekord: ${rekord} Punkte!`); } else { alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`); } spielStart(); }
    function erstelleSpielfeld() { spielbrettElement.innerHTML = ''; spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0)); for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const zelle = document.createElement('div'); zelle.classList.add('zelle'); spielbrettElement.appendChild(zelle); } } }
    function platziereFigur(figur, startX, startY) { let blockAnzahl = 0; figur.form.forEach((reihe, y) => { reihe.forEach((block, x) => { if (block === 1) { spielbrett[startY + y][startX + x] = 1; blockAnzahl++; } }); }); punkte += blockAnzahl; leereVolleLinien(); zeichneSpielfeld(); punkteElement.textContent = punkte; figurenInSlots[ausgewaehlterSlotIndex] = null; ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; spielbrettElement.style.cursor = 'default'; if (figurenInSlots.every(f => f === null)) { generiereNeueFiguren(); } else if (istSpielVorbei()) { setTimeout(pruefeUndSpeichereRekord, 100); } }
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

    // === Event Listener Zuweisung (unverändert) ===
    const istTouchGeraet = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    // ... (der Rest der Event-Listener-Logik bleibt gleich)
    function eventListenerZuweisen() { if (istTouchGeraet) { figurenSlots.forEach(slot => { slot.addEventListener('touchstart', dragStartTouch, { passive: false }); slot.addEventListener('touchmove', dragMoveTouch, { passive: false }); slot.addEventListener('touchend', dropTouch); }); } else { figurenSlots.forEach((slot, index) => { slot.addEventListener('click', () => figurSlotKlick(index)); }); spielbrettElement.addEventListener('mousemove', mausBewegungAufBrett); spielbrettElement.addEventListener('mouseleave', loescheVorschau); spielbrettElement.addEventListener('click', klickAufBrett); window.addEventListener('keydown', (e) => { if (e.key === 'Escape') abbrechen(); }); } }
    function dragStartTouch(e) { e.preventDefault(); const slot = e.currentTarget; ausgewaehlterSlotIndex = parseInt(slot.dataset.slotId, 10); if (figurenInSlots[ausgewaehlterSlotIndex]) { ausgewaehlteFigur = figurenInSlots[ausgewaehlterSlotIndex]; gezogenesElement = slot.querySelector('.figur-container'); if (gezogenesElement) { gezogenesElement.style.opacity = '0.5'; } } }
    function dragMoveTouch(e) { e.preventDefault(); if (!ausgewaehlteFigur) return; const touch = e.touches[0]; const elementUnterTouch = document.elementFromPoint(touch.clientX, touch.clientY); const zelle = elementUnterTouch?.closest('.zelle'); loescheVorschau(); if (zelle) { const rect = spielbrettElement.getBoundingClientRect(); const mausX = touch.clientX - rect.left; const mausY = touch.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); zeichneVorschau(ausgewaehlteFigur, zielX, zielY); } }
    function dropTouch(e) { if (!ausgewaehlteFigur) return; if (gezogenesElement) { gezogenesElement.style.opacity = '1'; } const touch = e.changedTouches[0]; const elementUnterTouch = document.elementFromPoint(touch.clientX, touch.clientY); const zelle = elementUnterTouch?.closest('.zelle'); loescheVorschau(); if (zelle) { const rect = spielbrettElement.getBoundingClientRect(); const mausX = touch.clientX - rect.left; const mausY = touch.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); if (kannPlatzieren(ausgewaehlteFigur, zielX, zielY)) { const slot = e.currentTarget; slot.innerHTML = ''; platziereFigur(ausgewaehlteFigur, zielX, zielY); } } ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; gezogenesElement = null; }
    
    // === Spiel starten ===
    eventListenerZuweisen();
    spielStart();
});