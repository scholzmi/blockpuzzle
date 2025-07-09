document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const rekordElement = document.getElementById('rekord');
    const versionElement = document.getElementById('version-impressum');
    const figurenSlots = document.querySelectorAll('.figur-slot');
    const jokerBoxen = document.querySelectorAll('.joker-box');
    const anleitungContainer = document.getElementById('anleitung-container');
    const infoContainer = document.getElementById('info-container');
    const anleitungToggleIcon = document.getElementById('anleitung-toggle-icon');
    const infoToggleIcon = document.getElementById('info-toggle-icon');
    const originalerTitel = document.title;

    // === Konstanten ===
    const BREITE = 9, HOEHE = 9, MAX_FIGUR_GROESSE = 5, ANZAHL_JOKER = 5;

    // === Spiel-Zustand ===
    let spielbrett = [], punkte = 0, rekord = 0, figurenInSlots = [null, null, null];
    let ausgewaehlteFigur = null, ausgewaehlterSlotIndex = -1, rundenZaehler = 0;
    let letztesZiel = {x: -1, y: -1}, verbrauchteJoker = 0;
    let hatFigurGedreht = false, penaltyAktiviert = false;

    // === Konfiguration ===
    let spielConfig = {}, normaleFiguren = [], zonkFiguren = [], jokerFiguren = [];

    /**
     * Startet das gesamte Spiel.
     */
    async function spielStart() {
        const configGeladen = await ladeKonfiguration();
        if (!configGeladen) {
            spielbrettElement.innerHTML = '<p style="color:red;text-align:center;padding:20px;">Fehler: config.json konnte nicht geladen werden!</p>';
            return;
        }
        await ladeAnleitung();
        
        if (document.body.classList.contains('boss-key-aktiv')) toggleBossKey();
        
        const gespeicherterRekord = getCookie("rekord");
        rekord = gespeicherterRekord ? parseInt(gespeicherterRekord, 10) || 0 : 0;
        rekordElement.textContent = rekord;
        punkte = 0;
        punkteElement.textContent = punkte;
        rundenZaehler = 0;
        verbrauchteJoker = 0;
        hatFigurGedreht = false;
        penaltyAktiviert = false;
        
        zeichneJokerLeiste();
        erstelleSpielfeld();
        zeichneSpielfeld();
        generiereNeueFiguren();
    }
    
    /**
     * Lädt und verarbeitet die config.json.
     */
    async function ladeKonfiguration() {
        try {
            const antwort = await fetch('config.json?v=' + new Date().getTime());
            if (!antwort.ok) throw new Error(`Netzwerk-Antwort war nicht ok: ${antwort.statusText}`);
            spielConfig = await antwort.json();
            
            if (versionElement) versionElement.textContent = spielConfig.version || "?.??";
            
            const erstelleFigurenPool = (pool) => 
                Array.isArray(pool) ? pool.map(f => ({ form: parseShape(f.shape), color: f.color || 'default', symmetrisch: f.symmetrisch || false })) : [];

            normaleFiguren = erstelleFigurenPool(spielConfig?.figures?.normal);
            zonkFiguren = erstelleFigurenPool(spielConfig?.figures?.zonk);
            jokerFiguren = erstelleFigurenPool(spielConfig?.figures?.joker);
            
            if (normaleFiguren.length === 0) throw new Error("Keine 'normalen' Figuren in config.json gefunden.");
            return true;
        } catch (error) {
            console.error('Fehler beim Laden der Konfigurationsdatei:', error);
            if(versionElement) versionElement.textContent = "Config Error!";
            return false;
        }
    }
    
    /**
     * Lädt die Anleitung aus der anleitung.txt
     */
    async function ladeAnleitung() {
        const anleitungInhalt = document.getElementById('anleitung-inhalt');
        if(!anleitungInhalt) return;
        try {
            const antwort = await fetch('anleitung.txt?v=' + new Date().getTime());
            if (!antwort.ok) throw new Error('Anleitung nicht gefunden');
            const text = await antwort.text();
            anleitungInhalt.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        } catch(error) {
            anleitungInhalt.textContent = 'Anleitung konnte nicht geladen werden.';
            console.error(error);
        }
    }

    /**
     * Weist alle Event-Listener zu.
     */
    function eventListenerZuweisen() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') abbrechen();
            else if (e.key.toLowerCase() === 'b') toggleBossKey();
        });
        figurenSlots.forEach((slot, index) => {
            slot.addEventListener('click', () => figurSlotKlick(index));
        });
        spielbrettElement.addEventListener('click', klickAufBrett);
        spielbrettElement.addEventListener('mousemove', mausBewegungAufBrett);
        spielbrettElement.addEventListener('mouseleave', () => { if (ausgewaehlteFigur) zeichneSpielfeld(); });
        spielbrettElement.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (ausgewaehlteFigur) {
                if (!ausgewaehlteFigur.symmetrisch && !hatFigurGedreht) {
                    if (verbrauchteJoker >= ANZAHL_JOKER) return;
                    verbrauchteJoker++;
                    hatFigurGedreht = true;
                    zeichneJokerLeiste();
                    if (verbrauchteJoker >= ANZAHL_JOKER) {
                        penaltyAktiviert = true;
                    }
                }
                ausgewaehlteFigur.form = dreheFigur90Grad(ausgewaehlteFigur.form);
                zeichneSpielfeld();
                zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y);
            }
        });
        if(anleitungToggleIcon) {
            anleitungToggleIcon.addEventListener('click', () => {
                anleitungContainer.classList.toggle('versteckt');
            });
        }
        if(infoToggleIcon) {
            infoToggleIcon.addEventListener('click', () => {
                infoContainer.classList.toggle('versteckt');
            });
        }
    }

    // === Alle weiteren Funktionen... ===
    function generiereNeueFiguren() { rundenZaehler++; const probs = spielConfig.probabilities || {}; const jokerProb = probs.joker || 0; const zonkProb = probs.zonk || 0; const reductionInterval = probs.jokerProbabilityReductionInterval || 5; const jokerReduktion = Math.floor((rundenZaehler - 1) / reductionInterval) * 0.01; const aktuelleJokerProb = Math.max(0.03, jokerProb - jokerReduktion); for (let i = 0; i < 3; i++) { let zufallsFigur = null; const zufallsZahl = Math.random(); if (zonkFiguren.length > 0 && zufallsZahl < zonkProb) { zufallsFigur = zonkFiguren[Math.floor(Math.random() * zonkFiguren.length)]; } else if (jokerFiguren.length > 0 && zufallsZahl < zonkProb + aktuelleJokerProb) { zufallsFigur = jokerFiguren[Math.floor(Math.random() * jokerFiguren.length)]; } else if (normaleFiguren.length > 0) { zufallsFigur = normaleFiguren[Math.floor(Math.random() * normaleFiguren.length)]; } if (zufallsFigur) { let form = zufallsFigur.form; const anzahlRotationen = Math.floor(Math.random() * 4); for (let r = 0; r < anzahlRotationen; r++) { form = dreheFigur90Grad(form); } figurenInSlots[i] = { form, color: zufallsFigur.color, symmetrisch: zufallsFigur.symmetrisch, id: i }; zeichneFigurInSlot(i); } else { figurenInSlots[i] = null; } } if (istSpielVorbei()) { setTimeout(pruefeUndSpeichereRekord, 100); } }
    function figurSlotKlick(index) { if (ausgewaehlterSlotIndex === index) { abbrechen(); return; } if (figurenInSlots[index]) { if (ausgewaehlterSlotIndex !== -1) { zeichneFigurInSlot(ausgewaehlterSlotIndex); } ausgewaehlteFigur = figurenInSlots[index]; ausgewaehlterSlotIndex = index; hatFigurGedreht = false; figurenSlots[index].innerHTML = ''; spielbrettElement.style.cursor = 'pointer'; } }
    function abbrechen() { if (ausgewaehlterSlotIndex === -1) return; if (hatFigurGedreht) { verbrauchteJoker--; zeichneJokerLeiste(); } const index = ausgewaehlterSlotIndex; ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; hatFigurGedreht = false; penaltyAktiviert = false; zeichneSpielfeld(); zeichneFigurInSlot(index); spielbrettElement.style.cursor = 'default'; }
    function platziereFigur(figur, startX, startY) { figur.form.forEach((reihe, y) => { reihe.forEach((block, x) => { if (block === 1) spielbrett[startY + y][startX + x] = figur.color; }); }); punkte += figur.form.flat().reduce((a, b) => a + b, 0); punkteElement.textContent = punkte; const alterSlotIndex = ausgewaehlterSlotIndex; figurenInSlots[alterSlotIndex] = null; ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; hatFigurGedreht = false; leereVolleLinien(); if (penaltyAktiviert) { aktiviereJokerPenalty(); verbrauchteJoker = 0; zeichneJokerLeiste(); penaltyAktiviert = false; } spielbrettElement.style.cursor = 'default'; if (figurenInSlots.every(f => f === null)) { generiereNeueFiguren(); } else if (istSpielVorbei()) { setTimeout(pruefeUndSpeichereRekord, 100); } }
    function mausBewegungAufBrett(e) { if (!ausgewaehlteFigur) return; const ziel = getZielKoordinaten(e); letztesZiel = {x: ziel.x, y: ziel.y}; zeichneSpielfeld(); zeichneVorschau(ausgewaehlteFigur, ziel.x, ziel.y); }
    function klickAufBrett(e) { if (!ausgewaehlteFigur) return; const ziel = getZielKoordinaten(e); if (kannPlatzieren(ausgewaehlteFigur, ziel.x, ziel.y)) { platziereFigur(ausgewaehlteFigur, ziel.x, ziel.y); } }
    function toggleBossKey() { document.body.classList.toggle('boss-key-aktiv'); if (document.body.classList.contains('boss-key-aktiv')) { document.title = "Photo Gallery"; if (ausgewaehlteFigur) abbrechen(); } else { document.title = originalerTitel; } }
    function parseShape(shapeCoords) { if (!shapeCoords || shapeCoords.length === 0) return [[]]; let tempMatrix = Array.from({ length: MAX_FIGUR_GROESSE }, () => Array(MAX_FIGUR_GROESSE).fill(0)); let minRow = MAX_FIGUR_GROESSE, maxRow = -1, minCol = MAX_FIGUR_GROESSE, maxCol = -1; shapeCoords.forEach(coord => { const row = Math.floor((coord - 1) / MAX_FIGUR_GROESSE); const col = (coord - 1) % MAX_FIGUR_GROESSE; if (row < MAX_FIGUR_GROESSE && col < MAX_FIGUR_GROESSE) { tempMatrix[row][col] = 1; minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row); minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col); } }); if(maxRow === -1) return []; const croppedMatrix = []; for (let y = minRow; y <= maxRow; y++) { croppedMatrix.push(tempMatrix[y].slice(minCol, maxCol + 1)); } return croppedMatrix; }
    function dreheFigur90Grad(matrix) { const transponiert = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex])); return transponiert.map(row => row.reverse()); }
    function istSpielVorbei() { for (const figurSlot of figurenInSlots) { if (figurSlot && figurSlot.form.length > 0 && figurSlot.form[0].length > 0) { let aktuelleForm = figurSlot.form; for (let i = 0; i < 4; i++) { const tempFigur = { form: aktuelleForm, color: figurSlot.color }; for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { if (kannPlatzieren(tempFigur, x, y)) return false; } } aktuelleForm = dreheFigur90Grad(aktuelleForm); } } } return true; }
    function kannPlatzieren(figur, startX, startY) { if (!figur || !figur.form || figur.form.length === 0 || figur.form[0].length === 0) return false; for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX < 0 || bX >= BREITE || bY < 0 || bY >= HOEHE || spielbrett[bY][bX] !== 0) return false; } } } return true; }
    function leereVolleLinien() { let vR = [], vS = []; for(let y=0; y<HOEHE; y++) { if(spielbrett[y].every(zelle => zelle !== 0)) vR.push(y); } for(let x=0; x<BREITE; x++) { let spalteVoll = true; for(let y=0; y<HOEHE; y++) { if(spielbrett[y][x] === 0) { spalteVoll = false; break; } } if(spalteVoll) vS.push(x); } if (vR.length > 0 || vS.length > 0) { vR.forEach(y => spielbrett[y].fill(0)); vS.forEach(x => spielbrett.forEach(reihe => reihe[x] = 0)); const linien = vR.length + vS.length; punkte += linien * 10 * linien; punkteElement.textContent = punkte; } zeichneSpielfeld(); }
    function zeichneSpielfeld() { spielbrett.forEach((reihe, y) => { reihe.forEach((inhalt, x) => { const zelle = spielbrettElement.children[y * BREITE + x]; zelle.className = 'zelle'; zelle.style.backgroundColor = ''; if (inhalt === 'blocker') { zelle.classList.add('belegt', 'blocker'); } else if (inhalt !== 0) { zelle.classList.add('belegt'); zelle.style.backgroundColor = spielConfig.colorThemes[inhalt]?.placed || spielConfig.colorThemes['default'].placed; } }); }); }
    function zeichneVorschau(figur, startX, startY) { if (!figur) return; figur.form.forEach((reihe, y) => { reihe.forEach((block, x) => { if (block === 1) { const brettY = startY + y; const brettX = startX + x; if (brettY < HOEHE && brettX < BREITE && brettY >= 0 && brettX >= 0) { const zelle = spielbrettElement.children[brettY * BREITE + brettX]; const zustandDarunter = spielbrett[brettY][brettX]; zelle.classList.add('vorschau'); if (zustandDarunter === 0) { const farbTheme = spielConfig.colorThemes[figur.color] || spielConfig.colorThemes['default']; zelle.style.backgroundColor = farbTheme.preview; } else { const farbThemeDarunter = spielConfig.colorThemes[zustandDarunter] || spielConfig.colorThemes['default']; zelle.style.backgroundColor = farbThemeDarunter.preview; } } } }); }); }
    function zeichneFigurInSlot(index) { const slot = figurenSlots[index]; slot.innerHTML = ''; const figur = figurenInSlots[index]; if (figur) { const container = document.createElement('div'); container.classList.add('figur-container'); const form = figur.form; container.style.gridTemplateRows = `repeat(${form.length}, 20px)`; container.style.gridTemplateColumns = `repeat(${form[0].length}, 20px)`; form.forEach(reihe => { reihe.forEach(block => { const blockDiv = document.createElement('div'); if (block === 1) { blockDiv.classList.add('figur-block'); blockDiv.style.backgroundColor = spielConfig.colorThemes[figur.color]?.placed || spielConfig.colorThemes['default'].placed; } container.appendChild(blockDiv); }); }); slot.appendChild(container); } }
    function zeichneJokerLeiste() { jokerBoxen.forEach((box, index) => { if (index < verbrauchteJoker) { box.classList.add('verbraucht'); box.classList.remove('voll'); } else { box.classList.add('voll'); box.classList.remove('verbraucht'); } }); }
    function aktiviereJokerPenalty() { const leereZellen = []; spielbrett.forEach((reihe, y) => { reihe.forEach((zelle, x) => { if (zelle === 0) leereZellen.push({x, y}); }); }); leereZellen.sort(() => 0.5 - Math.random()); const anzahlBlocker = Math.min(5, leereZellen.length); for(let i = 0; i < anzahlBlocker; i++) { const zelle = leereZellen[i]; spielbrett[zelle.y][zelle.x] = 'blocker'; } zeichneSpielfeld(); }
    function getZielKoordinaten(e) { const rect = spielbrettElement.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; const mausX = clientX - rect.left; const mausY = clientY - rect.top; return { x: Math.floor(mausX / 40), y: Math.floor(mausY / 40) }; }
    function setCookie(name, value, days) { let expires = ""; if (days) { const date = new Date(); date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); expires = "; expires=" + date.toUTCString(); } document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax"; }
    function getCookie(name) { const nameEQ = name + "="; const ca = document.cookie.split(';'); for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) == ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length); } return null; }
    function pruefeUndSpeichereRekord() { if (punkte > rekord) { rekord = punkte; rekordElement.textContent = rekord; setCookie("rekord", rekord, 365); alert(`Neuer Rekord: ${rekord} Punkte!`); } else { alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`); } spielStart(); }
    function erstelleSpielfeld() { spielbrettElement.innerHTML = ''; spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0)); for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const zelle = document.createElement('div'); zelle.classList.add('zelle'); spielbrettElement.appendChild(zelle); } } }
    
    // Initialisiere alle Event-Listener
    eventListenerZuweisen();
    // Starte das Spiel
    spielStart();
});