document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente und Konstanten ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const rekordElement = document.getElementById('rekord');
    const versionElement = document.getElementById('version');
    const figurenSlots = document.querySelectorAll('.figur-slot');

    const BREITE = 9;
    const HOEHE = 9;
    
    let spielbrett = [], punkte = 0, rekord = 0, figurenInSlots = [null, null, null];
    let ausgewaehlteFigur = null, ausgewaehlterSlotIndex = -1, rundenZaehler = 0;
    let letztesZiel = {x: -1, y: -1};
    
    const ZONK_FIGUREN_POOL = [ { form: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]] }, { form: [[1, 1, 1, 1, 1]] }, { form: [[1], [1], [1], [1], [1]] } ];
    const JOKER_FIGUR = { form: [[1]] };
    const NORMALE_FIGUREN_POOL = [ { form: [[1, 1], [1, 1]] }, { form: [[1, 1, 1], [1, 1, 1]] }, { form: [[1, 1], [1, 1], [1, 1]] }, { form: [[0, 1, 0], [1, 1, 1]] }, { form: [[1, 0], [1, 1], [1, 0]] }, { form: [[1, 1, 1], [0, 1, 0]] }, { form: [[0, 1], [1, 1], [0, 1]] }, { form: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] }, { form: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] }, { form: [[1, 1, 1, 1]] }, { form: [[1], [1], [1], [1]] }, { form: [[1, 1, 1]] }, { form: [[1], [1], [1]] }, { form: [[1, 1, 0], [0, 1, 1]] }, { form: [[0, 1], [1, 1], [1, 0]] }, { form: [[0, 1, 1], [1, 1, 0]] }, { form: [[1, 0], [1, 1], [0, 1]] }, { form: [[1, 0], [1, 0], [1, 1]] }, { form: [[1, 1, 1], [1, 0, 0]] }, { form: [[1, 1], [0, 1], [0, 1]] }, { form: [[0, 0, 1], [1, 1, 1]] }, { form: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] }, { form: [[1, 1, 1, 1], [1, 0, 0, 0]] }, { form: [[1, 1, 1], [0, 0, 1], [0, 0, 1]] }, { form: [[0, 0, 0, 1], [1, 1, 1, 1]] } ];
    
    // === KORRIGIERTE FUNKTIONEN ===

    /**
     * Zeichnet die Vorschau. Säubert jetzt als Erstes immer das Brett.
     */
    function zeichneVorschau(figur, startX, startY) {
        loescheVorschau(); // KORREKTUR: Diese Zeile stellt sicher, dass alte Vorschauen immer entfernt werden.
        
        if (!figur) return; // Sicherheitscheck

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
    
    /**
     * Verarbeitet die Mausbewegung und aktualisiert die Vorschau.
     */
    function mausBewegungAufBrett(e) {
        if (!ausgewaehlteFigur) return;
        const rect = spielbrettElement.getBoundingClientRect();
        const mausX = e.clientX - rect.left;
        const mausY = e.clientY - rect.top;
        const zielX = Math.floor(mausX / 40);
        const zielY = Math.floor(mausY / 40);
        
        letztesZiel = {x: zielX, y: zielY};
        
        // Die Logik ist jetzt komplett in zeichneVorschau(), was den Code sauberer macht.
        zeichneVorschau(ausgewaehlteFigur, zielX, zielY);
    }
    
    // ... (alle weiteren Funktionen bleiben unverändert) ...
    function dreheFigur90Grad(matrix) { const transponiert = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex])); return transponiert.map(row => row.reverse()); }
    function istSpielVorbei() { for (const figurSlot of figurenInSlots) { if (figurSlot) { let aktuelleForm = figurSlot.form; for (let i = 0; i < 4; i++) { const tempFigur = { form: aktuelleForm }; for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { if (kannPlatzieren(tempFigur, x, y)) { return false; } } } aktuelleForm = dreheFigur90Grad(aktuelleForm); } } } return true; }
    async function ladeKonfiguration() { try { const antwort = await fetch('config.json'); if (!antwort.ok) throw new Error('Netzwerk-Antwort war nicht ok.'); const config = await antwort.json(); versionElement.textContent = config.version; } catch (error) { console.error('Fehler beim Laden der Konfigurationsdatei:', error); versionElement.textContent = "?.??"; } }
    async function spielStart() { await ladeKonfiguration(); const gespeicherterRekord = getCookie("rekord"); rekord = gespeicherterRekord ? parseInt(gespeicherterRekord, 10) || 0 : 0; rekordElement.textContent = rekord; punkte = 0; punkteElement.textContent = punkte; rundenZaehler = 0; erstelleSpielfeld(); zeichneSpielfeld(); generiereNeueFiguren(); }
    function setCookie(name, value, days) { let expires = ""; if (days) { const date = new Date(); date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); expires = "; expires=" + date.toUTCString(); } document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax"; }
    function getCookie(name) { const nameEQ = name + "="; const ca = document.cookie.split(';'); for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) == ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length); } return null; }
    function pruefeUndSpeichereRekord() { if (punkte > rekord) { rekord = punkte; rekordElement.textContent = rekord; setCookie("rekord", rekord, 365); alert(`Neuer Rekord: ${rekord} Punkte!`); } else { alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`); } spielStart(); }
    function erstelleSpielfeld() { spielbrettElement.innerHTML = ''; spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0)); for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const zelle = document.createElement('div'); zelle.classList.add('zelle'); spielbrettElement.appendChild(zelle); } } }
    function generiereNeueFiguren() { rundenZaehler++; const jokerReduktion = Math.floor((rundenZaehler - 1) / 5) * 0.01; const aktuelleJokerWahrscheinlichkeit = Math.max(0.03, 0.20 - jokerReduktion); const zonkWahrscheinlichkeit = 0.05; for (let i = 0; i < 3; i++) { let zufallsFigur; const zufallsZahl = Math.random(); if (zufallsZahl < zonkWahrscheinlichkeit) { zufallsFigur = ZONK_FIGUREN_POOL[Math.floor(Math.random() * ZONK_FIGUREN_POOL.length)]; } else if (zufallsZahl < zonkWahrscheinlichkeit + aktuelleJokerWahrscheinlichkeit) { zufallsFigur = JOKER_FIGUR; } else { zufallsFigur = NORMALE_FIGUREN_POOL[Math.floor(Math.random() * NORMALE_FIGUREN_POOL.length)]; } figurenInSlots[i] = { form: zufallsFigur.form, id: i }; zeichneFigurInSlot(i); } if (istSpielVorbei()) { setTimeout(pruefeUndSpeichereRekord, 100); } }
    function platziereFigur(figur, startX, startY) { let blockAnzahl = 0; figur.form.forEach((reihe, y) => { reihe.forEach((block, x) => { if (block === 1) { spielbrett[startY + y][startX + x] = 1; blockAnzahl++; } }); }); punkte += blockAnzahl; leereVolleLinien(); zeichneSpielfeld(); punkteElement.textContent = punkte; figurenInSlots[ausgewaehlterSlotIndex] = null; ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; spielbrettElement.style.cursor = 'default'; if (figurenInSlots.every(f => f === null)) { generiereNeueFiguren(); } else if (istSpielVorbei()) { setTimeout(pruefeUndSpeichereRekord, 100); } }
    function figurSlotKlick(index) { if (ausgewaehlteFigur && ausgewaehlterSlotIndex === index) { abbrechen(); return; } if (figurenInSlots[index]) { ausgewaehlteFigur = figurenInSlots[index]; ausgewaehlterSlotIndex = index; figurenSlots[index].innerHTML = ''; spielbrettElement.style.cursor = 'pointer'; } }
    function abbrechen() { if (ausgewaehlterSlotIndex !== -1) { loescheVorschau(); zeichneFigurInSlot(ausgewaehlterSlotIndex); ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; spielbrettElement.style.cursor = 'default'; } }
    function klickAufBrett(e) { if (!ausgewaehlteFigur) return; const rect = spielbrettElement.getBoundingClientRect(); const mausX = e.clientX - rect.left; const mausY = e.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); if (kannPlatzieren(ausgewaehlteFigur, zielX, zielY)) { platziereFigur(ausgewaehlteFigur, zielX, zielY); } }
    function zeichneFigurInSlot(index) { const slot = figurenSlots[index]; slot.innerHTML = ''; const figur = figurenInSlots[index]; if (figur) { const container = document.createElement('div'); container.classList.add('figur-container'); const form = figur.form; container.style.gridTemplateRows = `repeat(${form.length}, 30px)`; container.style.gridTemplateColumns = `repeat(${form[0].length}, 30px)`; form.forEach(reihe => { reihe.forEach(block => { const blockDiv = document.createElement('div'); if (block === 1) blockDiv.classList.add('figur-block'); container.appendChild(blockDiv); }); }); slot.appendChild(container); } }
    function loescheVorschau() { document.querySelectorAll('.vorschau, .vorschau-ungueltig').forEach(z => z.classList.remove('vorschau', 'vorschau-ungueltig')); }
    function zeichneSpielfeld() { spielbrett.forEach((reihe, y) => reihe.forEach((zelle, x) => { const z = spielbrettElement.children[y * BREITE + x]; z.className = 'zelle'; if(zelle === 1) z.classList.add('belegt'); })); }
    function kannPlatzieren(figur, startX, startY) { for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX < 0 || bX >= BREITE || bY < 0 || bY >= HOEHE || spielbrett[bY][bX] === 1) return false; } } } return true; }
    function leereVolleLinien() { const vR = [], vS = []; for(let y=0; y<HOEHE; y++) if(spielbrett[y].every(z=>z===1)) vR.push(y); for(let x=0; x<BREITE; x++) { let voll=true; for(let y=0; y<HOEHE; y++) if(spielbrett[y][x]===0) voll=false; if(voll) vS.push(x); } vR.forEach(y=>spielbrett[y].fill(0)); vS.forEach(x=>spielbrett.forEach(r=>r[x]=0)); const linien = vR.length + vS.length; if(linien > 0) punkte += linien * 10 * linien; }
    
    // === Event Listener Zuweisung ===
    function eventListenerZuweisen() {
        const istTouchGeraet = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (istTouchGeraet) {
            // Touch-Steuerung für mobile Geräte (hier nicht implementiert)
        } else {
            // Klick-Steuerung für Desktop
            figurenSlots.forEach((slot, index) => { slot.addEventListener('click', () => figurSlotKlick(index)); });
            spielbrettElement.addEventListener('mousemove', mausBewegungAufBrett);
            spielbrettElement.addEventListener('mouseleave', loescheVorschau);
            spielbrettElement.addEventListener('click', klickAufBrett);
            window.addEventListener('keydown', (e) => { if (e.key === 'Escape') abbrechen(); });
            spielbrettElement.addEventListener('contextmenu', e => { e.preventDefault(); if (ausgewaehlteFigur) { ausgewaehlteFigur.form = dreheFigur90Grad(ausgewaehlteFigur.form); zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y); } });
        }
    }

    // === Spiel starten ===
    eventListenerZuweisen();
    spielStart();
});