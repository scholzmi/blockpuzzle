document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente und Konstanten ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const rekordElement = document.getElementById('rekord');
    const versionElement = document.getElementById('version-impressum');
    const figurenSlots = document.querySelectorAll('.figur-slot');
    const jokerBoxen = document.querySelectorAll('.joker-box'); // NEU
    const originalerTitel = document.title;

    const BREITE = 9, HOEHE = 9, MAX_FIGUR_GROESSE = 5;
    const ANZAHL_JOKER = 5;

    // === Spiel-Variablen ===
    let spielbrett = [], punkte = 0, rekord = 0, figurenInSlots = [null, null, null];
    let ausgewaehlteFigur = null, ausgewaehlterSlotIndex = -1, rundenZaehler = 0;
    let letztesZiel = {x: -1, y: -1};
    let gezogenesElement = null;
    let verbrauchteJoker = 0; // NEU

    // === Konfigurations-Variablen ===
    let spielConfig = {}, normaleFiguren = [], zonkFiguren = [], jokerFiguren = [];

    // ===================================================================================
    // KERNLOGIK
    // ===================================================================================

    async function spielStart() {
        // ... (Anfang von spielStart bleibt gleich) ...
        punkte = 0;
        punkteElement.textContent = punkte;
        rundenZaehler = 0;
        verbrauchteJoker = 0; // Joker zurücksetzen
        zeichneJokerLeiste();   // Joker-Leiste initial zeichnen
        erstelleSpielfeld();
        zeichneSpielfeld();
        generiereNeueFiguren();
    }
    
    // ... (ladeKonfiguration und generiereNeueFiguren bleiben unverändert) ...
    
    // ===================================================================================
    // NEUE FUNKTIONEN FÜR JOKER-LOGIK
    // ===================================================================================

    /**
     * Aktualisiert die Anzeige der Joker-Leiste.
     */
    function zeichneJokerLeiste() {
        jokerBoxen.forEach((box, index) => {
            if (index < verbrauchteJoker) {
                box.classList.add('verbraucht');
                box.classList.remove('voll');
            } else {
                box.classList.add('voll');
                box.classList.remove('verbraucht');
            }
        });
    }

    /**
     * Platziert 5 schwarze Blocker-Steine auf zufälligen leeren Feldern.
     */
    function aktiviereJokerPenalty() {
        const leereZellen = [];
        spielbrett.forEach((reihe, y) => {
            reihe.forEach((zelle, x) => {
                if (zelle === 0) leereZellen.push({x, y});
            });
        });

        leereZellen.sort(() => 0.5 - Math.random()); // Mischen

        const anzahlBlocker = Math.min(5, leereZellen.length); // Nicht mehr Blocker als freie Felder

        for(let i = 0; i < anzahlBlocker; i++) {
            const zelle = leereZellen[i];
            spielbrett[zelle.y][zelle.x] = 'blocker'; // Spezieller Zustand für Blocker
        }
        zeichneSpielfeld();
    }
    
    // ===================================================================================
    // ANGEPASSTE FUNKTIONEN
    // ===================================================================================

    function zeichneSpielfeld() {
        spielbrett.forEach((reihe, y) => {
            reihe.forEach((inhalt, x) => {
                const zelle = spielbrettElement.children[y * BREITE + x];
                zelle.className = 'zelle';
                zelle.style.backgroundColor = '';
                
                if (inhalt === 'blocker') {
                    zelle.classList.add('belegt', 'blocker');
                } else if (inhalt !== 0) {
                    zelle.classList.add('belegt');
                    zelle.style.backgroundColor = spielConfig.colorThemes[inhalt]?.placed || spielConfig.colorThemes['default'].placed;
                }
            });
        });
    }

    // Die anderen Funktionen werden über den EventListener unten angepasst
    
    // ===================================================================================
    // EVENT LISTENER ZUWEISUNG (angepasst)
    // ===================================================================================
    
    function eventListenerZuweisen() {
        // ... (Globale Listener bleiben gleich) ...

        // Klick-Steuerung für Desktop
        // ... (andere Desktop-Listener bleiben gleich) ...
        
        spielbrettElement.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (ausgewaehlteFigur) {
                // Prüfen, ob noch Joker verfügbar sind
                if (verbrauchteJoker >= ANZAHL_JOKER) return;

                ausgewaehlteFigur.form = dreheFigur90Grad(ausgewaehlteFigur.form);
                zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y);
                
                verbrauchteJoker++;
                zeichneJokerLeiste();

                // Wenn alle Joker verbraucht sind -> Penalty und Reset
                if (verbrauchteJoker >= ANZAHL_JOKER) {
                    setTimeout(() => {
                        aktiviereJokerPenalty();
                        verbrauchteJoker = 0;
                        // Kurze Verzögerung, damit man den Reset sieht
                        setTimeout(zeichneJokerLeiste, 200);
                    }, 300);
                }
            }
        });
        
        // ... (Touch-Logik bleibt gleich) ...
    }

    // ... (Restlicher Code zur Vollständigkeit)
    async function ladeKonfiguration() { try { const antwort = await fetch('config.json?v=' + new Date().getTime()); if (!antwort.ok) throw new Error(`Netzwerk-Antwort war nicht ok: ${antwort.statusText}`); spielConfig = await antwort.json(); if (versionElement) { versionElement.textContent = spielConfig.version || "?.??"; } const erstelleFigurenPool = (pool) => Array.isArray(pool) ? pool.map(f => ({ form: parseShape(f.shape), color: f.color || 'default' })) : []; normaleFiguren = erstelleFigurenPool(spielConfig?.figures?.normal); zonkFiguren = erstelleFigurenPool(spielConfig?.figures?.zonk); jokerFiguren = erstelleFigurenPool(spielConfig?.figures?.joker); if (normaleFiguren.length === 0 && zonkFiguren.length === 0 && jokerFiguren.length === 0) { throw new Error("Keine Figuren aus der Konfiguration geladen. Bitte config.json prüfen."); } return true; } catch (error) { console.error('Fehler beim Laden oder Verarbeiten der Konfigurationsdatei:', error); if(versionElement) versionElement.textContent = "Config Error!"; return false; } }
    function generiereNeueFiguren() { rundenZaehler++; const probs = spielConfig.probabilities || {}; const jokerProb = probs.joker || 0; const zonkProb = probs.zonk || 0; const reductionInterval = probs.jokerProbabilityReductionInterval || 5; const jokerReduktion = Math.floor((rundenZaehler - 1) / reductionInterval) * 0.01; const aktuelleJokerProb = Math.max(0.03, jokerProb - jokerReduktion); for (let i = 0; i < 3; i++) { let zufallsFigur = null; const zufallsZahl = Math.random(); if (zonkFiguren.length > 0 && zufallsZahl < zonkProb) { zufallsFigur = zonkFiguren[Math.floor(Math.random() * zonkFiguren.length)]; } else if (jokerFiguren.length > 0 && zufallsZahl < zonkProb + aktuelleJokerProb) { zufallsFigur = jokerFiguren[Math.floor(Math.random() * jokerFiguren.length)]; } else if (normaleFiguren.length > 0) { zufallsFigur = normaleFiguren[Math.floor(Math.random() * normaleFiguren.length)]; } if (zufallsFigur) { figurenInSlots[i] = { form: zufallsFigur.form, color: zufallsFigur.color, id: i }; zeichneFigurInSlot(i); } else { figurenInSlots[i] = null; } } if (istSpielVorbei()) { setTimeout(pruefeUndSpeichereRekord, 100); } }
    function figurSlotKlick(index) { if (ausgewaehlterSlotIndex === index) { abbrechen(); return; } if (figurenInSlots[index]) { if (ausgewaehlterSlotIndex !== -1) { zeichneFigurInSlot(ausgewaehlterSlotIndex); } ausgewaehlteFigur = figurenInSlots[index]; ausgewaehlterSlotIndex = index; figurenSlots[index].innerHTML = ''; spielbrettElement.style.cursor = 'pointer'; } }
    function abbrechen() { if (ausgewaehlterSlotIndex === -1) return; zeichneSpielfeld(); zeichneFigurInSlot(ausgewaehlterSlotIndex); ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; spielbrettElement.style.cursor = 'default'; }
    function platziereFigur(figur, startX, startY) { let blockAnzahl = 0; figur.form.forEach((reihe, y) => { reihe.forEach((block, x) => { if (block === 1) { spielbrett[startY + y][startX + x] = figur.color; blockAnzahl++; } }); }); punkte += blockAnzahl; punkteElement.textContent = punkte; leereVolleLinien(); figurenInSlots[ausgewaehlterSlotIndex] = null; ausgewaehlteFigur = null; ausgewaehlterSlotIndex = -1; spielbrettElement.style.cursor = 'default'; if (figurenInSlots.every(f => f === null)) { generiereNeueFiguren(); } else if (istSpielVorbei()) { setTimeout(pruefeUndSpeichereRekord, 100); } }
    function mausBewegungAufBrett(e) { if (!ausgewaehlteFigur) return; const rect = spielbrettElement.getBoundingClientRect(); const mausX = e.clientX - rect.left; const mausY = e.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); letztesZiel = {x: zielX, y: zielY}; zeichneSpielfeld(); zeichneVorschau(ausgewaehlteFigur, zielX, zielY); }
    function klickAufBrett(e) { if (!ausgewaehlteFigur) return; const rect = spielbrettElement.getBoundingClientRect(); const mausX = e.clientX - rect.left; const mausY = e.clientY - rect.top; const zielX = Math.floor(mausX / 40); const zielY = Math.floor(mausY / 40); if (kannPlatzieren(ausgewaehlteFigur, zielX, zielY)) { platziereFigur(ausgewaehlteFigur, zielX, zielY); } }
    function toggleBossKey() { document.body.classList.toggle('boss-key-aktiv'); if (document.body.classList.contains('boss-key-aktiv')) { document.title = "Photo Gallery"; if (ausgewaehlteFigur) abbrechen(); } else { document.title = originalerTitel; } }
    function parseShape(shapeCoords) { if (!shapeCoords || shapeCoords.length === 0) return [[]]; let tempMatrix = Array.from({ length: MAX_FIGUR_GROESSE }, () => Array(MAX_FIGUR_GROESSE).fill(0)); let minRow = MAX_FIGUR_GROESSE, maxRow = -1, minCol = MAX_FIGUR_GROESSE, maxCol = -1; shapeCoords.forEach(coord => { const row = Math.floor((coord - 1) / MAX_FIGUR_GROESSE); const col = (coord - 1) % MAX_FIGUR_GROESSE; if (row < MAX_FIGUR_GROESSE && col < MAX_FIGUR_GROESSE) { tempMatrix[row][col] = 1; minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row); minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col); } }); const croppedMatrix = []; for (let y = minRow; y <= maxRow; y++) { croppedMatrix.push(tempMatrix[y].slice(minCol, maxCol + 1)); } return croppedMatrix; }
    function dreheFigur90Grad(matrix) { const transponiert = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex])); return transponiert.map(row => row.reverse()); }
    function istSpielVorbei() { for (const figurSlot of figurenInSlots) { if (figurSlot && figurSlot.form.length > 0 && figurSlot.form[0].length > 0) { let aktuelleForm = figurSlot.form; for (let i = 0; i < 4; i++) { const tempFigur = { form: aktuelleForm, color: figurSlot.color }; for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { if (kannPlatzieren(tempFigur, x, y)) return false; } } aktuelleForm = dreheFigur90Grad(aktuelleForm); } } } return true; }
    function setCookie(name, value, days) { let expires = ""; if (days) { const date = new Date(); date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); expires = "; expires=" + date.toUTCString(); } document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax"; }
    function getCookie(name) { const nameEQ = name + "="; const ca = document.cookie.split(';'); for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) == ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length); } return null; }
    function pruefeUndSpeichereRekord() { if (punkte > rekord) { rekord = punkte; rekordElement.textContent = rekord; setCookie("rekord", rekord, 365); alert(`Neuer Rekord: ${rekord} Punkte!`); } else { alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`); } spielStart(); }
    function erstelleSpielfeld() { spielbrettElement.innerHTML = ''; spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0)); for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const zelle = document.createElement('div'); zelle.classList.add('zelle'); spielbrettElement.appendChild(zelle); } } }
    function zeichneFigurInSlot(index) { const slot = figurenSlots[index]; slot.innerHTML = ''; const figur = figurenInSlots[index]; if (figur) { const container = document.createElement('div'); container.classList.add('figur-container'); const form = figur.form; container.style.gridTemplateRows = `repeat(${form.length}, 20px)`; container.style.gridTemplateColumns = `repeat(${form[0].length}, 20px)`; form.forEach(reihe => { reihe.forEach(block => { const blockDiv = document.createElement('div'); if (block === 1) { blockDiv.classList.add('figur-block'); blockDiv.style.backgroundColor = spielConfig.colorThemes[figur.color]?.placed || spielConfig.colorThemes['default'].placed; } container.appendChild(blockDiv); }); }); slot.appendChild(container); } }
    function kannPlatzieren(figur, startX, startY) { if (!figur || !figur.form || figur.form.length === 0 || figur.form[0].length === 0) return false; for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX < 0 || bX >= BREITE || bY < 0 || bY >= HOEHE || spielbrett[bY][bX] !== 0) return false; } } } return true; }
    function leereVolleLinien() { let vR = [], vS = []; for(let y=0; y<HOEHE; y++) if(spielbrett[y].every(z => z !== 0)) vR.push(y); for(let x=0; x<BREITE; x++) { let voll=true; for(let y=0; y<HOEHE; y++) if(spielbrett[y][x] === 0) voll=false; if(voll) vS.push(x); } if (vR.length > 0 || vS.length > 0) { vR.forEach(y=>spielbrett[y].fill(0)); vS.forEach(x=>spielbrett.forEach(r=>r[x]=0)); const linien = vR.length + vS.length; punkte += linien * 10 * linien; } zeichneSpielfeld(); }
    
    // === Spiel starten ===
    eventListenerZuweisen();
    spielStart();
});