document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente und Konstanten ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const rekordElement = document.getElementById('rekord');
    const versionElement = document.getElementById('version-impressum'); // Verweist auf die neue ID
    const figurenSlots = document.querySelectorAll('.figur-slot');

    const BREITE = 9;
    const HOEHE = 9;
    const MAX_FIGUR_GROESSE = 5;

    // === Spiel-Variablen ===
    let spielbrett = [], punkte = 0, rekord = 0, figurenInSlots = [null, null, null];
    let ausgewaehlteFigur = null, ausgewaehlterSlotIndex = -1, rundenZaehler = 0;
    let letztesZiel = {x: -1, y: -1};

    // === Konfigurations- und Figuren-Variablen ===
    let spielConfig = {};
    let normaleFiguren = [];
    let zonkFiguren = [];
    let jokerFiguren = [];

    /**
     * Lädt die gesamte Spielkonfiguration aus der config.json
     */
    async function ladeKonfiguration() {
        try {
            const antwort = await fetch('config.json?v=' + new Date().getTime());
            if (!antwort.ok) throw new Error('Netzwerk-Antwort war nicht ok.');
            spielConfig = await antwort.json();
            
            // KORREKTUR: Prüfen, ob das Element existiert, bevor darauf zugegriffen wird.
            if (versionElement) {
                versionElement.textContent = spielConfig.version;
            } else {
                console.error("Element für Versionsanzeige nicht gefunden!");
            }
            
            normaleFiguren = spielConfig.figures.normal.map(f => ({ form: parseShape(f.shape) }));
            zonkFiguren = spielConfig.figures.zonk.map(f => ({ form: parseShape(f.shape) }));
            jokerFiguren = spielConfig.figures.joker.map(f => ({ form: parseShape(f.shape) }));

        } catch (error) {
            console.error('Fehler beim Laden der Konfigurationsdatei:', error);
            if(versionElement) versionElement.textContent = "Error!";
        }
    }
    
    // ... (alle weiteren Funktionen bleiben unverändert) ...
    function parseShape(shapeCoords) { if (!shapeCoords || shapeCoords.length === 0) return [[]]; let tempMatrix = Array.from({ length: MAX_FIGUR_GROESSE }, () => Array(MAX_FIGUR_GROESSE).fill(0)); let minRow = MAX_FIGUR_GROESSE, maxRow = -1, minCol = MAX_FIGUR_GROESSE, maxCol = -1; shapeCoords.forEach(coord => { const row = Math.floor((coord - 1) / MAX_FIGUR_GROESSE); const col = (coord - 1) % MAX_FIGUR_GROESSE; if (row < MAX_FIGUR_GROESSE && col < MAX_FIGUR_GROESSE) { tempMatrix[row][col] = 1; minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row); minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col); } }); const croppedMatrix = []; for (let y = minRow; y <= maxRow; y++) { croppedMatrix.push(tempMatrix[y].slice(minCol, maxCol + 1)); } return croppedMatrix; }
    function generiereNeueFiguren() { rundenZaehler++; const jokerProb = spielConfig.probabilities.joker; const zonkProb = spielConfig.probabilities.zonk; const reductionInterval = spielConfig.probabilities.jokerProbabilityReductionInterval || 5; const jokerReduktion = Math.floor((rundenZaehler - 1) / reductionInterval) * 0.01; const aktuelleJokerProb = Math.max(0.03, jokerProb - jokerReduktion); for (let i = 0; i < 3; i++) { let zufallsFigur; const zufallsZahl = Math.random(); if (zufallsZahl < zonkProb) { zufallsFigur = zonkFiguren[Math.floor(Math.random() * zonkFiguren.length)]; } else if (zufallsZahl < zonkProb + aktuelleJokerProb) { zufallsFigur = jokerFiguren[Math.floor(Math.random() * jokerFiguren.length)]; } else { zufallsFigur = normaleFiguren[Math.floor(Math.random() * normaleFiguren.length)]; } figurenInSlots[i] = { form: zufallsFigur.form, id: i }; zeichneFigurInSlot(i); } if (istSpielVorbei()) { setTimeout(pruefeUndSpeichereRekord, 100); } }
    async function spielStart() { await ladeKonfiguration(); const gespeicherterRekord = getCookie("rekord"); rekord = gespeicherterRekord ? parseInt(gespeicherterRekord, 10) || 0 : 0; rekordElement.textContent = rekord; punkte = 0; punkteElement.textContent = punkte; rundenZaehler = 0; erstelleSpielfeld(); zeichneSpielfeld(); generiereNeueFiguren(); }
    function dreheFigur90Grad(matrix) { const transponiert = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex])); return transponiert.map(row => row.reverse()); }
    function istSpielVorbei() { for (const figurSlot of figurenInSlots) { if (figurSlot) { let aktuelleForm = figurSlot.form; for (let i = 0; i < 4; i++) { const tempFigur = { form: aktuelleForm }; for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { if (kannPlatzieren(tempFigur, x, y)) return false; } } aktuelleForm = dreheFigur90Grad(aktuelleForm); } } } return true; }
    function setCookie(name, value, days) { let expires = ""; if (days) { const date = new Date(); date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); expires = "; expires=" + date.toUTCString(); } document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax"; }
    function getCookie(name) { const nameEQ = name + "="; const ca = document.cookie.split(';'); for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) == ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length); } return null; }
    function pruefeUndSpeichereRekord() { if (punkte > rekord) { rekord = punkte; rekordElement.textContent = rekord; setCookie("rekord", rekord, 365); alert(`Neuer Rekord: ${rekord} Punkte!`); } else { alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`); } spielStart(); }
    function erstelleSpielfeld() { spielbrettElement.innerHTML = ''; spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0)); for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const zelle = document.createElement('div'); zelle.classList.add('zelle'); spielbrettElement.appendChild(zelle); } } }
    function platziereFigur(figur, startX, startY) { let blockAnzahl = 0; figur.form.forEach((reihe, y) => { reihe.forEach((block, x) => { if (block === 1) { spielbrett[startY + y][startX + x] = 1; blockAnzahl++; } }); }); punkte += blockAnzahl; leereVolleLinien(); zeichneSpielfeld(); punkteElement.textContent = punkte; figurenInSlots[ausgewaehlterSlotIndex] = null; ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; spielbrettElement.style.cursor = 'default'; if (figurenInSlots.every(f => f === null)) { generiereNeueFiguren(); } else if (istSpielVorbei()) { setTimeout(pruefeUndSpeichereRekord, 100); } }
    function figurSlotKlick(index) { if (ausgewaehlteFigur && ausgewaehlterSlotIndex === index) { abbrechen(); return; } if (figurenInSlots[index]) { if(ausgewaehlteFigur) { abbrechen(); } ausgewaehlteFigur = figurenInSlots[index]; ausgewaehlterSlotIndex = index; figurenSlots[index].innerHTML = ''; spielbrettElement.style.cursor = 'pointer'; } }
    function abbrechen() { if (ausgewaehlterSlotIndex === -1) return; loescheVorschau(); zeichneFigurInSlot(ausgewaehlterSlotIndex); ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; spielbrettElement.style.cursor = 'default'; }
    function mausBewegungAufBrett(e) { if (!ausgewaehlteFigur) return; const rect = spielbrettElement.getBoundingClientRect(); const mausX = e.clientX - rect.left; const mausY = e.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); letztesZiel = {x: zielX, y: zielY}; zeichneVorschau(ausgewaehlteFigur, zielX, zielY); }
    function klickAufBrett(e) { if (!ausgewaehlteFigur) return; const rect = spielbrettElement.getBoundingClientRect(); const mausX = e.clientX - rect.left; const mausY = e.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); if (kannPlatzieren(ausgewaehlteFigur, zielX, zielY)) { platziereFigur(ausgewaehlteFigur, zielX, zielY); } }
    function zeichneVorschau(figur, startX, startY) { loescheVorschau(); if (!figur) return; const kannAblegen = kannPlatzieren(figur, startX, startY); const vorschauKlasse = kannAblegen ? 'vorschau' : 'vorschau-ungueltig'; figur.form.forEach((reihe, y) => { reihe.forEach((block, x) => { if (block === 1) { const brettY = startY + y; const brettX = startX + x; if (brettY < HOEHE && brettX < BREITE && brettY >= 0 && brettX >= 0) { const zellenIndex = brettY * BREITE + brettX; spielbrettElement.children[zellenIndex]?.classList.add(vorschauKlasse); } } }); }); }
    function zeichneFigurInSlot(index) { const slot = figurenSlots[index]; slot.innerHTML = ''; const figur = figurenInSlots[index]; if (figur) { const container = document.createElement('div'); container.classList.add('figur-container'); const form = figur.form; container.style.gridTemplateRows = `repeat(${form.length}, 20px)`; container.style.gridTemplateColumns = `repeat(${form[0].length}, 20px)`; form.forEach(reihe => { reihe.forEach(block => { const blockDiv = document.createElement('div'); if (block === 1) blockDiv.classList.add('figur-block'); container.appendChild(blockDiv); }); }); slot.appendChild(container); } }
    function loescheVorschau() { document.querySelectorAll('.vorschau, .vorschau-ungueltig').forEach(z => z.classList.remove('vorschau', 'vorschau-ungueltig')); }
    function zeichneSpielfeld() { spielbrett.forEach((reihe, y) => reihe.forEach((zelle, x) => { const z = spielbrettElement.children[y * BREITE + x]; z.className = 'zelle'; if(zelle === 1) z.classList.add('belegt'); })); }
    function kannPlatzieren(figur, startX, startY) { for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX < 0 || bX >= BREITE || bY < 0 || bY >= HOEHE || spielbrett[bY][bX] === 1) return false; } } } return true; }
    function leereVolleLinien() { const vR = [], vS = []; for(let y=0; y<HOEHE; y++) if(spielbrett[y].every(z=>z===1)) vR.push(y); for(let x=0; x<BREITE; x++) { let voll=true; for(let y=0; y<HOEHE; y++) if(spielbrett[y][x]===0) voll=false; if(voll) vS.push(x); } vR.forEach(y=>spielbrett[y].fill(0)); vS.forEach(x=>spielbrett.forEach(r=>r[x]=0)); const linien = vR.length + vS.length; if(linien > 0) punkte += linien * 10 * linien; }
    function eventListenerZuweisen() { const istTouchGeraet = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); if (istTouchGeraet) { figurenSlots.forEach(slot => { slot.addEventListener('touchstart', dragStartTouch, { passive: false }); slot.addEventListener('touchmove', dragMoveTouch, { passive: false }); slot.addEventListener('touchend', dropTouch); }); } else { figurenSlots.forEach((slot, index) => { slot.addEventListener('click', () => figurSlotKlick(index)); }); spielbrettElement.addEventListener('mousemove', mausBewegungAufBrett); spielbrettElement.addEventListener('mouseleave', loescheVorschau); spielbrettElement.addEventListener('click', klickAufBrett); window.addEventListener('keydown', (e) => { if (e.key === 'Escape') abbrechen(); }); spielbrettElement.addEventListener('contextmenu', e => { e.preventDefault(); if (ausgewaehlteFigur) { ausgewaehlteFigur.form = dreheFigur90Grad(ausgewaehlteFigur.form); zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y); } }); } }
    function dragStartTouch(e) { e.preventDefault(); const slot = e.currentTarget; ausgewaehlterSlotIndex = parseInt(slot.dataset.slotId, 10); if (figurenInSlots[ausgewaehlterSlotIndex]) { ausgewaehlteFigur = figurenInSlots[ausgewaehlterSlotIndex]; gezogenesElement = slot.querySelector('.figur-container'); if (gezogenesElement) { gezogenesElement.style.opacity = '0.5'; } } }
    function dragMoveTouch(e) { e.preventDefault(); if (!ausgewaehlteFigur) return; const touch = e.touches[0]; const elementUnterTouch = document.elementFromPoint(touch.clientX, touch.clientY); const zelle = elementUnterTouch?.closest('.zelle'); loescheVorschau(); if (zelle) { const rect = spielbrettElement.getBoundingClientRect(); const mausX = touch.clientX - rect.left; const mausY = touch.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); zeichneVorschau(ausgewaehlteFigur, zielX, zielY); } }
    function dropTouch(e) { if (!ausgewaehlteFigur) return; if (gezogenesElement) { gezogenesElement.style.opacity = '1'; } const touch = e.changedTouches[0]; const elementUnterTouch = document.elementFromPoint(touch.clientX, touch.clientY); const zelle = elementUnterTouch?.closest('.zelle'); loescheVorschau(); if (zelle) { const rect = spielbrettElement.getBoundingClientRect(); const mausX = touch.clientX - rect.left; const mausY = touch.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); if (kannPlatzieren(ausgewaehlteFigur, zielX, zielY)) { const slot = e.currentTarget; slot.innerHTML = ''; platziereFigur(ausgewaehlteFigur, zielX, zielY); } } ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; gezogenesElement = null; }
    
    // === Spiel starten ===
    spielStart();
});