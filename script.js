document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente und Konstanten ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const rekordElement = document.getElementById('rekord');
    const versionElement = document.getElementById('version-impressum');
    const figurenSlots = document.querySelectorAll('.figur-slot');

    const BREITE = 9;
    const HOEHE = 9;
    const MAX_FIGUR_GROESSE = 5;

    // === Spiel-Variablen ===
    let spielbrett = [], punkte = 0, rekord = 0, figurenInSlots = [null, null, null];
    let ausgewaehlteFigur = null, ausgewaehlterSlotIndex = -1, rundenZaehler = 0;
    let letztesZiel = {x: -1, y: -1};

    // === Konfigurations- und Figuren-Variablen ===
    let spielConfig = {}, normaleFiguren = [], zonkFiguren = [], jokerFiguren = [];
    
    // ===================================================================================
    // KORRIGIERTE FUNKTION
    // ===================================================================================
    /**
     * Löscht die Vorschau-Hervorhebung vom Spielfeld.
     */
    function loescheVorschau() {
        document.querySelectorAll('.vorschau, .vorschau-ungueltig').forEach(zelle => {
            zelle.classList.remove('vorschau', 'vorschau-ungueltig');
            
            // WICHTIG: Setzt den Hintergrund nur zurück, wenn die Zelle nicht
            // permanent belegt ist, um gelegte Steine nicht zu löschen.
            if (!zelle.classList.contains('belegt')) {
                zelle.style.backgroundColor = '';
            }
        });
    }
    // ===================================================================================

    /**
     * Lädt die gesamte Spielkonfiguration aus der config.json
     */
    async function ladeKonfiguration() {
        try {
            const antwort = await fetch('config.json?v=' + new Date().getTime());
            if (!antwort.ok) throw new Error('Netzwerk-Antwort war nicht ok.');
            spielConfig = await antwort.json();
            
            if (versionElement) {
                versionElement.textContent = spielConfig.version || "?.??";
            }
            
            const erstelleFigurenPool = (pool) => 
                Array.isArray(pool) ? pool.map(f => ({ form: parseShape(f.shape), color: f.color || 'default' })) : [];

            normaleFiguren = erstelleFigurenPool(spielConfig?.figures?.normal);
            zonkFiguren = erstelleFigurenPool(spielConfig?.figures?.zonk);
            jokerFiguren = erstelleFigurenPool(spielConfig?.figures?.joker);

        } catch (error) {
            console.error('Fehler beim Laden oder Verarbeiten der Konfigurationsdatei:', error);
            if(versionElement) versionElement.textContent = "Error!";
        }
    }

    /**
     * Wählt eine Figur basierend auf den Wahrscheinlichkeiten aus der Konfiguration.
     */
    function generiereNeueFiguren() {
        rundenZaehler++;
        const probs = spielConfig.probabilities || {};
        const jokerProb = probs.joker || 0;
        const zonkProb = probs.zonk || 0;
        const reductionInterval = probs.jokerProbabilityReductionInterval || 5;
        const jokerReduktion = Math.floor((rundenZaehler - 1) / reductionInterval) * 0.01;
        const aktuelleJokerProb = Math.max(0.03, jokerProb - jokerReduktion);
        for (let i = 0; i < 3; i++) {
            let zufallsFigur = null;
            const zufallsZahl = Math.random();
            if (zonkFiguren.length > 0 && zufallsZahl < zonkProb) {
                zufallsFigur = zonkFiguren[Math.floor(Math.random() * zonkFiguren.length)];
            } else if (jokerFiguren.length > 0 && zufallsZahl < zonkProb + aktuelleJokerProb) {
                zufallsFigur = jokerFiguren[Math.floor(Math.random() * jokerFiguren.length)];
            } else if (normaleFiguren.length > 0) {
                zufallsFigur = normaleFiguren[Math.floor(Math.random() * normaleFiguren.length)];
            }
            if (zufallsFigur) {
                figurenInSlots[i] = { form: zufallsFigur.form, color: zufallsFigur.color, id: i };
                zeichneFigurInSlot(i);
            }
        }
        if (istSpielVorbei()) {
            setTimeout(pruefeUndSpeichereRekord, 100);
        }
    }

    async function spielStart() {
        await ladeKonfiguration();
        const gespeicherterRekord = getCookie("rekord");
        rekord = gespeicherterRekord ? parseInt(gespeicherterRekord, 10) || 0 : 0;
        rekordElement.textContent = rekord;
        punkte = 0;
        punkteElement.textContent = punkte;
        rundenZaehler = 0;
        erstelleSpielfeld();
        zeichneSpielfeld();
        generiereNeueFiguren();
    }
    
    function figurSlotKlick(index) {
        if (ausgewaehlterSlotIndex === index) {
            abbrechen();
            return;
        }
        if (figurenInSlots[index]) {
            if (ausgewaehlterSlotIndex !== -1) {
                zeichneFigurInSlot(ausgewaehlterSlotIndex);
            }
            ausgewaehlteFigur = figurenInSlots[index];
            ausgewaehlterSlotIndex = index;
            figurenSlots[index].innerHTML = '';
            spielbrettElement.style.cursor = 'pointer';
        }
    }

    function abbrechen() {
        if (ausgewaehlterSlotIndex === -1) return;
        loescheVorschau();
        zeichneFigurInSlot(ausgewaehlterSlotIndex);
        ausgewaehlteFigur = null;
        ausgewaehlterSlotIndex = -1;
        spielbrettElement.style.cursor = 'default';
    }

    function platziereFigur(figur, startX, startY) {
        let blockAnzahl = 0;
        figur.form.forEach((reihe, y) => {
            reihe.forEach((block, x) => {
                if (block === 1) { spielbrett[startY + y][startX + x] = figur.color; blockAnzahl++; }
            });
        });
        punkte += blockAnzahl;
        leereVolleLinien();
        // zeichneSpielfeld() wird in leereVolleLinien aufgerufen oder hier, falls nichts geleert wurde.
        if (!vR.length && !vS.length) {
             zeichneSpielfeld();
        }
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
    
    function mausBewegungAufBrett(e) {
        if (!ausgewaehlteFigur) return;
        const rect = spielbrettElement.getBoundingClientRect();
        const mausX = e.clientX - rect.left;
        const mausY = e.clientY - rect.top;
        const zielX = Math.floor(mausX / 40);
        const zielY = Math.floor(mausY / 40);
        letztesZiel = {x: zielX, y: zielY};
        zeichneVorschau(ausgewaehlteFigur, zielX, zielY);
    }
    
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

    function dreheFigur90Grad(matrix) { const transponiert = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex])); return transponiert.map(row => row.reverse()); }
    function istSpielVorbei() { for (const figurSlot of figurenInSlots) { if (figurSlot) { let aktuelleForm = figurSlot.form; for (let i = 0; i < 4; i++) { const tempFigur = { form: aktuelleForm, color: figurSlot.color }; for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { if (kannPlatzieren(tempFigur, x, y)) return false; } } aktuelleForm = dreheFigur90Grad(aktuelleForm); } } } return true; }
    function setCookie(name, value, days) { let expires = ""; if (days) { const date = new Date(); date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); expires = "; expires=" + date.toUTCString(); } document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax"; }
    function getCookie(name) { const nameEQ = name + "="; const ca = document.cookie.split(';'); for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) == ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length); } return null; }
    function pruefeUndSpeichereRekord() { if (punkte > rekord) { rekord = punkte; rekordElement.textContent = rekord; setCookie("rekord", rekord, 365); alert(`Neuer Rekord: ${rekord} Punkte!`); } else { alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`); } spielStart(); }
    function erstelleSpielfeld() { spielbrettElement.innerHTML = ''; spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0)); for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const zelle = document.createElement('div'); zelle.classList.add('zelle'); spielbrettElement.appendChild(zelle); } } }
    function zeichneSpielfeld() { spielbrett.forEach((reihe, y) => { reihe.forEach((farbName, x) => { const zelle = spielbrettElement.children[y * BREITE + x]; zelle.className = 'zelle'; zelle.style.backgroundColor = ''; if (farbName !== 0) { zelle.classList.add('belegt'); zelle.style.backgroundColor = spielConfig.colorThemes[farbName]?.placed || spielConfig.colorThemes['default'].placed; } }); }); }
    function zeichneFigurInSlot(index) { const slot = figurenSlots[index]; slot.innerHTML = ''; const figur = figurenInSlots[index]; if (figur) { const container = document.createElement('div'); container.classList.add('figur-container'); const form = figur.form; container.style.gridTemplateRows = `repeat(${form.length}, 20px)`; container.style.gridTemplateColumns = `repeat(${form[0].length}, 20px)`; form.forEach(reihe => { reihe.forEach(block => { const blockDiv = document.createElement('div'); if (block === 1) { blockDiv.classList.add('figur-block'); blockDiv.style.backgroundColor = spielConfig.colorThemes[figur.color]?.placed || spielConfig.colorThemes['default'].placed; } container.appendChild(blockDiv); }); }); slot.appendChild(container); } }
    function kannPlatzieren(figur, startX, startY) { for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX < 0 || bX >= BREITE || bY < 0 || bY >= HOEHE || spielbrett[bY][bX] !== 0) return false; } } } return true; }
    function leereVolleLinien() { let vR = [], vS = []; for(let y=0; y<HOEHE; y++) if(spielbrett[y].every(z => z !== 0)) vR.push(y); for(let x=0; x<BREITE; x++) { let voll=true; for(let y=0; y<HOEHE; y++) if(spielbrett[y][x] === 0) voll=false; if(voll) vS.push(x); } vR.forEach(y=>spielbrett[y].fill(0)); vS.forEach(x=>spielbrett.forEach(r=>r[x]=0)); zeichneSpielfeld(); const linien = vR.length + vS.length; if(linien > 0) punkte += linien * 10 * linien; }
    function eventListenerZuweisen() { const istTouchGeraet = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); if (istTouchGeraet) { figurenSlots.forEach(slot => { slot.addEventListener('touchstart', dragStartTouch, { passive: false }); }); window.addEventListener('touchmove', dragMoveTouch, { passive: false }); window.addEventListener('touchend', dropTouch); } else { figurenSlots.forEach((slot, index) => { slot.addEventListener('click', () => figurSlotKlick(index)); }); spielbrettElement.addEventListener('mousemove', mausBewegungAufBrett); spielbrettElement.addEventListener('mouseleave', loescheVorschau); spielbrettElement.addEventListener('click', klickAufBrett); window.addEventListener('keydown', (e) => { if (e.key === 'Escape') abbrechen(); }); spielbrettElement.addEventListener('contextmenu', e => { e.preventDefault(); if (ausgewaehlteFigur) { ausgewaehlteFigur.form = dreheFigur90Grad(ausgewaehlteFigur.form); zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y); } }); } }
    function dragStartTouch(e) { e.preventDefault(); const slot = e.currentTarget; const index = parseInt(slot.dataset.slotId, 10); if (figurenInSlots[index]) { ausgewaehlteFigur = figurenInSlots[index]; ausgewaehlterSlotIndex = index; gezogenesElement = slot.querySelector('.figur-container'); if (gezogenesElement) { gezogenesElement.style.opacity = '0.5'; } } }
    function dragMoveTouch(e) { if (!ausgewaehlteFigur) return; e.preventDefault(); const touch = e.touches[0]; const elementUnterTouch = document.elementFromPoint(touch.clientX, touch.clientY); const zelle = elementUnterTouch?.closest('.zelle'); loescheVorschau(); if (zelle) { const rect = spielbrettElement.getBoundingClientRect(); const mausX = touch.clientX - rect.left; const mausY = touch.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); zeichneVorschau(ausgewaehlteFigur, zielX, zielY); } }
    function dropTouch(e) { if (!ausgewaehlteFigur) return; if (gezogenesElement) { gezogenesElement.style.opacity = '1'; } const touch = e.changedTouches[0]; const elementUnterTouch = document.elementFromPoint(touch.clientX, touch.clientY); const zelle = elementUnterTouch?.closest('.zelle'); loescheVorschau(); if (zelle) { const rect = spielbrettElement.getBoundingClientRect(); const mausX = touch.clientX - rect.left; const mausY = touch.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); if (kannPlatzieren(ausgewaehlteFigur, zielX, zielY)) { platziereFigur(ausgewaehlteFigur, zielX, zielY); } } ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; gezogenesElement = null; }
    
    // === Spiel starten ===
    spielStart();
});