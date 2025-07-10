document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const rekordNormalElement = document.getElementById('rekord-normal');
    const rekordSchwerElement = document.getElementById('rekord-schwer');
    const versionElement = document.getElementById('version-impressum');
    const aenderungsElement = document.getElementById('letzte-aenderung');
    const figurenSlots = document.querySelectorAll('.figur-slot');
    const jokerBoxenContainer = document.getElementById('dreh-joker-leiste');
    const hardModeSchalter = document.getElementById('hard-mode-schalter');
    const hardModeLabel = document.getElementById('hard-mode-label');
    const timerBar = document.getElementById('timer-bar');
    const refreshFigurenButton = document.getElementById('refresh-figuren-button');
    const rotateButton = document.getElementById('rotate-button');
    const punkteAnimationElement = document.getElementById('punkte-animation');
    const gameOverContainer = document.getElementById('game-over-container');
    const gameOverTitel = document.getElementById('game-over-titel');
    const gameOverText = document.getElementById('game-over-text');
    const neustartNormalBtn = document.getElementById('neustart-normal-btn');
    const neustartSchwerBtn = document.getElementById('neustart-schwer-btn');
    const confirmContainer = document.getElementById('confirm-container');
    const confirmJaBtn = document.getElementById('confirm-ja-btn');
    const confirmNeinBtn = document.getElementById('confirm-nein-btn');
    const anleitungModalContainer = document.getElementById('anleitung-modal-container');
    const anleitungModalInhalt = document.getElementById('anleitung-modal-inhalt');
    const anleitungLink = document.getElementById('anleitung-link');
    const anleitungSchliessenBtn = document.getElementById('anleitung-schliessen-btn');

    // === Spiel-Zustand ===
    let spielbrett = [], punkte = 0, rekordNormal = 0, rekordSchwer = 0, figurenInSlots = [null, null, null];
    let ausgewaehlteFigur = null, aktiverSlotIndex = -1, rundenZaehler = 0;
    let letztesZiel = { x: 4, y: 4 }, verbrauchteJoker = 0;
    let hatFigurGedreht = false, penaltyAktiviert = false;
    let istHardMode = false, timerInterval = null, verbleibendeZeit;
    let ersterZugGemacht = false;
    let lastMausEvent = null;
    let anzahlJoker;
    const isTouchDevice = 'ontouchstart' in window;

    // === Konfiguration ===
    let spielConfig = {};

    // ===================================================================================
    // INITIALISIERUNG
    // ===================================================================================

    async function spielStart() {
        stopTimer();
        istHardMode = hardModeSchalter.checked;
        updateHardModeLabel();
        abbrechen();

        const configGeladen = await ladeKonfiguration();
        if (!configGeladen) {
            spielbrettElement.innerHTML = '<p style="color:red;text-align:center;padding:20px;">Fehler: config.json konnte nicht geladen werden!</p>';
            return;
        }
        await ladeAnleitung();

        if (document.body.classList.contains('boss-key-aktiv')) toggleBossKey();

        rekordNormal = parseInt(getCookie('rekordNormal') || '0', 10);
        rekordSchwer = parseInt(getCookie('rekordSchwer') || '0', 10);
        rekordNormalElement.textContent = rekordNormal;
        rekordSchwerElement.textContent = rekordSchwer;

        punkte = 0;
        punkteElement.textContent = punkte;
        rundenZaehler = 0;
        verbrauchteJoker = 0;
        hatFigurGedreht = false;
        penaltyAktiviert = false;
        ersterZugGemacht = false;
        lastMausEvent = null;

        erstelleJokerLeiste();
        zeichneJokerLeiste();
        erstelleSpielfeld();
        zeichneSpielfeld();
        generiereNeueFiguren();
        
        timerBar.style.setProperty('--timer-progress', '1');
    }

    function updateHardModeLabel() {
        hardModeLabel.textContent = hardModeSchalter.checked ? 'schwer' : 'normal';
    }

    async function ladeKonfiguration() {
        try {
            const antwort = await fetch('config.json?v=' + new Date().getTime());
            if (!antwort.ok) throw new Error(`Netzwerk-Antwort war nicht ok`);
            spielConfig = await antwort.json();
            if (versionElement) versionElement.textContent = spielConfig.version || "?.??";
            if (aenderungsElement && spielConfig.letzteAenderung) aenderungsElement.textContent = spielConfig.letzteAenderung;
            anzahlJoker = getGameSetting('numberOfJokers');
            const erstellePool = (p) => Array.isArray(p) ? p.map(f => ({ form: parseShape(f.shape), color: f.color || 'default', symmetrisch: f.symmetrisch || false })) : [];
            spielConfig.figures.normalPool = erstellePool(spielConfig.figures.normal);
            spielConfig.figures.zonkPool = erstellePool(spielConfig.figures.zonk);
            spielConfig.figures.jokerPool = erstellePool(spielConfig.figures.joker);
            if (spielConfig.figures.normalPool.length === 0) throw new Error("Keine Figuren in config.json gefunden.");
            return true;
        } catch (error) {
            console.error('Fehler beim Laden der Konfiguration:', error);
            if (versionElement) versionElement.textContent = "Config Error!";
            return false;
        }
    }
    
    function getGameSetting(key) {
        const modus = istHardMode ? 'hard' : 'normal';
        return spielConfig.gameSettings[modus][key];
    }

    async function ladeAnleitung() {
        if (!anleitungModalInhalt) return;
        try {
            const antwort = await fetch('anleitung.txt?v=' + new Date().getTime());
            if (!antwort.ok) throw new Error('Anleitung nicht gefunden');
            const text = await antwort.text();
            anleitungModalInhalt.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        } catch (error) {
            anleitungModalInhalt.textContent = 'Anleitung konnte nicht geladen werden.';
        }
    }

    // ===================================================================================
    // EVENT LISTENERS
    // ===================================================================================

    function eventListenerZuweisen() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') abbrechen();
            else if (e.key.toLowerCase() === 'b') toggleBossKey();
        });
        hardModeSchalter.addEventListener('change', () => {
            if (punkte > 0) confirmContainer.classList.add('sichtbar'), confirmContainer.classList.remove('versteckt');
            else spielStart();
        });
        confirmJaBtn.addEventListener('click', () => {
            confirmContainer.classList.add('versteckt'), confirmContainer.classList.remove('sichtbar');
            spielStart();
        });
        confirmNeinBtn.addEventListener('click', () => {
            hardModeSchalter.checked = !hardModeSchalter.checked;
            confirmContainer.classList.add('versteckt'), confirmContainer.classList.remove('sichtbar');
        });
        anleitungLink.addEventListener('click', (e) => {
            e.preventDefault();
            anleitungModalContainer.classList.add('sichtbar'), anleitungModalContainer.classList.remove('versteckt');
        });
        anleitungSchliessenBtn.addEventListener('click', () => {
            anleitungModalContainer.classList.add('versteckt'), anleitungModalContainer.classList.remove('sichtbar');
        });
        refreshFigurenButton.addEventListener('click', figurenNeuAuslosen);
        neustartNormalBtn.addEventListener('click', () => {
            hardModeSchalter.checked = false;
            gameOverContainer.classList.add('versteckt'), gameOverContainer.classList.remove('sichtbar');
            spielStart();
        });
        neustartSchwerBtn.addEventListener('click', () => {
            hardModeSchalter.checked = true;
            gameOverContainer.classList.add('versteckt'), gameOverContainer.classList.remove('sichtbar');
            spielStart();
        });

        if (isTouchDevice) {
            const spielWrapper = document.querySelector('.spiel-wrapper');
            spielWrapper.insertBefore(jokerBoxenContainer, spielbrettElement);
            figurenSlots.forEach((slot, index) => slot.addEventListener('click', () => waehleFigur(index)));
            rotateButton.addEventListener('click', dreheFigurMobile);
            spielbrettElement.addEventListener('touchstart', handleBoardMove);
            spielbrettElement.addEventListener('touchmove', handleBoardMove);
            spielbrettElement.addEventListener('click', handleBoardClick); 
        } else {
            spielbrettElement.addEventListener('mouseenter', handleBoardEnter);
            spielbrettElement.addEventListener('click', handleBoardClick);
            spielbrettElement.addEventListener('mousemove', handleBoardMove);
            spielbrettElement.addEventListener('mouseleave', handleBoardLeave);
            spielbrettElement.addEventListener('wheel', wechsleFigurPerScroll);
            spielbrettElement.addEventListener('contextmenu', dreheFigurPC);
        }
    }

    // ===================================================================================
    // STEUERUNG & SPIEL-LOGIK
    // ===================================================================================
    
    function waehleFigur(slotIndex) {
        if (aktiverSlotIndex === slotIndex) {
            abbrechen();
            return;
        }

        if (hatFigurGedreht) {
            verbrauchteJoker--;
            zeichneJokerLeiste();
        }

        if (slotIndex < 0 || slotIndex > 2 || !figurenInSlots[slotIndex]) {
            abbrechen();
            return;
        }

        aktiverSlotIndex = slotIndex;
        ausgewaehlteFigur = JSON.parse(JSON.stringify(figurenInSlots[aktiverSlotIndex]));
        hatFigurGedreht = false;
        if(isTouchDevice) rotateButton.classList.remove('versteckt');
        zeichneSlotHighlights();
        spielbrettElement.style.cursor = 'none';
        zeichneSpielfeld();
        zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y);
    }
    
    function dreheAktiveFigur() {
        if (!ausgewaehlteFigur) return;
        if (!ausgewaehlteFigur.symmetrisch && !hatFigurGedreht) {
            if (verbrauchteJoker >= anzahlJoker) return;
            verbrauchteJoker++;
            hatFigurGedreht = true;
            zeichneJokerLeiste();
            if (verbrauchteJoker >= anzahlJoker) penaltyAktiviert = true;
        }
        ausgewaehlteFigur.form = dreheFigur90Grad(ausgewaehlteFigur.form);
    }

    function dreheFigurPC(e) { e.preventDefault(); dreheAktiveFigur(); handleBoardMove(e); }
    function dreheFigurMobile() { dreheAktiveFigur(); zeichneSpielfeld(); zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y); }
    function handleBoardEnter(e) { if (!ausgewaehlteFigur) wechsleZuNaechsterFigur(); handleBoardMove(e); }
    function handleBoardLeave() { if (ausgewaehlteFigur) zeichneSpielfeld(); }
    
    function wechsleFigurPerScroll(e) {
        e.preventDefault();
        if (!ausgewaehlteFigur) return;
        const richtung = e.deltaY > 0 ? 1 : -1;
        const verfuegbareIndices = figurenInSlots.map((fig, index) => fig ? index : -1).filter(index => index !== -1);
        if (verfuegbareIndices.length <= 1) return;
        
        const aktuellePosition = verfuegbareIndices.indexOf(aktiverSlotIndex);
        const neuePosition = (aktuellePosition + richtung + verfuegbareIndices.length) % verfuegbareIndices.length;
        waehleFigur(verfuegbareIndices[neuePosition]);
        handleBoardMove(lastMausEvent);
    }
    
    function wechsleZuNaechsterFigur() {
        let naechsterIndex = figurenInSlots.findIndex(fig => fig !== null);
        if (naechsterIndex !== -1) {
            waehleFigur(naechsterIndex);
            if(lastMausEvent) handleBoardMove(lastMausEvent);
        } else {
            abbrechen();
        }
    }

    function zeichneSlotHighlights() {
        figurenSlots.forEach((slot, index) => slot.classList.toggle('aktiver-slot', index === aktiverSlotIndex));
    }

    function figurenNeuAuslosen() {
        abbrechen();
        const penaltyPoints = getGameSetting('refreshPenaltyPoints') || 0;
        zeigePunkteAnimation(-penaltyPoints);
        setTimeout(() => {
            punkte = Math.max(0, punkte - penaltyPoints);
            punkteElement.textContent = punkte;
        }, 500);
        generiereNeueFiguren();
    }

    function generiereNeueFiguren() {
        rundenZaehler++;
        const jokerProb = getGameSetting('jokerProbability'), zonkProb = getGameSetting('zonkProbability'),
              reductionInterval = getGameSetting('jokerProbabilityReductionInterval'), minimumJokerProb = getGameSetting('jokerProbabilityMinimum');
        const jokerReduktion = Math.floor((rundenZaehler - 1) / reductionInterval) * 0.01;
        const aktuelleJokerProb = Math.max(minimumJokerProb, jokerProb - jokerReduktion);
        for (let i = 0; i < 3; i++) {
            let zufallsFigur = null, kategorie = 'normal', zufallsZahl = Math.random();
            if (spielConfig.figures.zonkPool.length > 0 && zufallsZahl < zonkProb) {
                zufallsFigur = spielConfig.figures.zonkPool[Math.floor(Math.random() * spielConfig.figures.zonkPool.length)];
                kategorie = 'zonk';
            } else if (spielConfig.figures.jokerPool.length > 0 && zufallsZahl < zonkProb + aktuelleJokerProb) {
                zufallsFigur = spielConfig.figures.jokerPool[Math.floor(Math.random() * spielConfig.figures.jokerPool.length)];
                kategorie = 'joker';
            } else if (spielConfig.figures.normalPool.length > 0) {
                zufallsFigur = spielConfig.figures.normalPool[Math.floor(Math.random() * spielConfig.figures.normalPool.length)];
            }
            if (zufallsFigur) {
                let form = zufallsFigur.form;
                const anzahlRotationen = Math.floor(Math.random() * 4);
                for (let r = 0; r < anzahlRotationen; r++) form = dreheFigur90Grad(form);
                figurenInSlots[i] = { form, color: zufallsFigur.color, symmetrisch: zufallsFigur.symmetrisch, kategorie: kategorie, id: i };
                zeichneFigurInSlot(i);
            } else {
                figurenInSlots[i] = null;
            }
        }
        if (istSpielVorbei()) setTimeout(pruefeUndSpeichereRekord, 100);
    }

    function abbrechen() {
        if (ausgewaehlteFigur && hatFigurGedreht) {
            verbrauchteJoker--;
            zeichneJokerLeiste();
        }
        aktiverSlotIndex = -1;
        ausgewaehlteFigur = null;
        hatFigurGedreht = false;
        if (isTouchDevice) rotateButton.classList.add('versteckt');
        zeichneSlotHighlights();
        zeichneSpielfeld();
        spielbrettElement.style.cursor = 'default';
    }

    function platziereFigur(figur, startX, startY) {
        if (!figur) return;
        const figurHoehe = figur.form.length, figurBreite = figur.form[0].length;
        const offsetX = Math.floor(figurBreite / 2), offsetY = Math.floor(figurHoehe / 2);
        const platziereX = startX - offsetX, platziereY = startY - offsetY;
        if (!kannPlatzieren(figur, platziereX, platziereY)) return;

        if (!ersterZugGemacht) {
            ersterZugGemacht = true;
            startTimer();
        } else if (!timerInterval) {
            startTimer();
        }
        if (navigator.vibrate) navigator.vibrate(50);

        figur.form.forEach((reihe, y) => reihe.forEach((block, x) => {
            if (block === 1) spielbrett[platziereY + y][platziereX + x] = figur.color;
        }));
        
        const blockAnzahl = figur.form.flat().reduce((a, b) => a + b, 0);
        let punktMultiplier = 1;
        if (figur.kategorie === 'normal') punktMultiplier = 2;
        else if (figur.kategorie === 'zonk') punktMultiplier = 5;
        const figurenPunkte = blockAnzahl * punktMultiplier;
        
        const alterSlotIndex = aktiverSlotIndex;
        
        if (penaltyAktiviert) {
            aktiviereJokerPenalty();
            verbrauchteJoker = 0;
            zeichneJokerLeiste();
            penaltyAktiviert = false;
        }
        
        const linienPunkte = leereVolleLinien();
        const gesamtPunkteGewinn = figurenPunkte + linienPunkte;
        
        punkte += gesamtPunkteGewinn;
        punkteElement.textContent = punkte;
        zeigePunkteAnimation(gesamtPunkteGewinn);
        
        figurenInSlots[alterSlotIndex] = null;
        zeichneFigurInSlot(alterSlotIndex);
        
        aktiverSlotIndex = -1;
        ausgewaehlteFigur = null;
        hatFigurGedreht = false;
        if (isTouchDevice) rotateButton.classList.add('versteckt');
        zeichneSlotHighlights();
        zeichneSpielfeld();
        spielbrettElement.style.cursor = 'default';

        if (figurenInSlots.every(f => f === null)) {
            generiereNeueFiguren();
        }

        if (istSpielVorbei()) {
            setTimeout(pruefeUndSpeichereRekord, 100);
        } else if (!isTouchDevice) {
            wechsleZuNaechsterFigur();
        }
    }

    function handleBoardMove(e) {
        if (isTouchDevice && ausgewaehlteFigur) e.preventDefault();
        if (!e || !ausgewaehlteFigur) return;
        lastMausEvent = e;
        letztesZiel = getZielKoordinaten(e);
        zeichneSpielfeld();
        zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y);
    }

    function handleBoardClick(e) {
        if (!ausgewaehlteFigur) return;
        platziereFigur(ausgewaehlteFigur, getZielKoordinaten(e).x, getZielKoordinaten(e).y);
    }
    
    function toggleBossKey() { document.body.classList.toggle('boss-key-aktiv'); if (document.body.classList.contains('boss-key-aktiv')) { stopTimer(); abbrechen(); } else { resumeTimer(); } }
    function startTimer() { const timerDuration = getGameSetting('timerDuration'); verbleibendeZeit = timerDuration; if (timerInterval) clearInterval(timerInterval); timerInterval = setInterval(() => { verbleibendeZeit--; const progress = (verbleibendeZeit / timerDuration); timerBar.style.setProperty('--timer-progress', `${progress}`); if (verbleibendeZeit <= 0) { platziereStrafsteine(getGameSetting('timerPenaltyCount')); stopTimer(); timerBar.style.setProperty('--timer-progress', '1'); } }, 1000); }
    function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
    function resumeTimer() { if (ersterZugGemacht && !timerInterval) startTimer(); }
    
    function platziereStrafsteine(anzahl) {
        const leereZellen = [];
        spielbrett.forEach((reihe, y) => reihe.forEach((zelle, x) => { if (zelle === 0) leereZellen.push({ x, y }); }));
        leereZellen.sort(() => 0.5 - Math.random());
        const anzahlZuPlatzieren = Math.min(anzahl, leereZellen.length);
        for (let i = 0; i < anzahlZuPlatzieren; i++) spielbrett[leereZellen[i].y][leereZellen[i].x] = 'blocker';
        zeichneSpielfeld();
    }
    
    function parseShape(shapeCoords) { if (!shapeCoords || shapeCoords.length === 0) return [[]]; let tempMatrix = Array.from({ length: 5 }, () => Array(5).fill(0)); let minRow = 5, maxRow = -1, minCol = 5, maxCol = -1; shapeCoords.forEach(coord => { const row = Math.floor((coord - 1) / 5); const col = (coord - 1) % 5; if (row < 5 && col < 5) { tempMatrix[row][col] = 1; minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row); minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col); } }); if (maxRow === -1) return []; return tempMatrix.slice(minRow, maxRow + 1).map(row => row.slice(minCol, maxCol + 1)); }
    function dreheFigur90Grad(matrix) { return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex])).map(row => row.reverse()); }
    function istSpielVorbei() { for (const figurSlot of figurenInSlots) { if (figurSlot && figurSlot.form.length > 0 && figurSlot.form[0].length > 0) { let aktuelleForm = figurSlot.form; for (let i = 0; i < 4; i++) { const tempFigur = { form: aktuelleForm }; for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (kannPlatzieren(tempFigur, x, y)) return false; aktuelleForm = dreheFigur90Grad(aktuelleForm); } } } return true; }
    function kannPlatzieren(figur, startX, startY) { if (!figur || !figur.form || figur.form.length === 0 || figur.form[0].length === 0) return false; for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX < 0 || bX >= 9 || bY < 0 || bY >= 9 || spielbrett[bY][bX] !== 0) return false; } } } return true; }
    
    function leereVolleLinien() {
        let vR = [], vS = [];
        for (let y = 0; y < 9; y++) if (spielbrett[y].every(zelle => zelle !== 0)) vR.push(y);
        for (let x = 0; x < 9; x++) { let spalteVoll = true; for (let y = 0; y < 9; y++) if (spielbrett[y][x] === 0) { spalteVoll = false; break; } if (spalteVoll) vS.push(x); }
        const linien = vR.length + vS.length;
        if (linien > 0) { vR.forEach(y => spielbrett[y].fill(0)); vS.forEach(x => spielbrett.forEach(reihe => reihe[x] = 0)); }
        zeichneSpielfeld();
        return Math.pow(linien, 3) * 10;
    }

    function zeichneSpielfeld() {
        spielbrett.forEach((reihe, y) => {
            reihe.forEach((inhalt, x) => {
                const zelle = spielbrettElement.children[y * 9 + x];
                zelle.className = 'zelle';
                zelle.style.backgroundColor = '';
                if (inhalt === 'blocker') zelle.classList.add('belegt', 'blocker');
                else if (inhalt !== 0) {
                    zelle.classList.add('belegt');
                    zelle.style.backgroundColor = spielConfig.colorThemes[inhalt]?.placed || spielConfig.colorThemes['default'].placed;
                }
            });
        });
    }

    function zeichneVorschau(figur, startX, startY) {
        if (!figur) return;
        const figurHoehe = figur.form.length, figurBreite = figur.form[0].length;
        const offsetX = Math.floor(figurBreite / 2), offsetY = Math.floor(figurHoehe / 2);
        const platziereX = startX - offsetX, platziereY = startY - offsetY;
        const kannFigurPlatzieren = kannPlatzieren(figur, platziereX, platziereY);
        if (kannFigurPlatzieren) {
            const tempSpielbrett = spielbrett.map(row => [...row]);
            figur.form.forEach((reihe, y) => reihe.forEach((block, x) => { if (block === 1) { const bY = platziereY + y, bX = platziereX + x; if (bY < 9 && bX < 9) tempSpielbrett[bY][bX] = 1; } }));
            zeichneLinienVorschau(tempSpielbrett);
        }
        figur.form.forEach((reihe, y) => reihe.forEach((block, x) => {
            if (block === 1) {
                const brettY = platziereY + y, brettX = platziereX + x;
                if (brettY < 9 && brettX < 9 && brettY >= 0 && brettX >= 0) {
                    const zelle = spielbrettElement.children[brettY * 9 + brettX];
                    zelle.style.backgroundColor = kannFigurPlatzieren ? (spielConfig.colorThemes[figur.color] || spielConfig.colorThemes['default']).preview : 'rgba(234, 67, 53, 0.5)';
                }
            }
        }));
    }

    function zeichneLinienVorschau(tempSpielbrett) {
        let vR = [], vS = [];
        for (let y = 0; y < 9; y++) if (tempSpielbrett[y].every(zelle => zelle !== 0)) vR.push(y);
        for (let x = 0; x < 9; x++) { let spalteVoll = true; for (let y = 0; y < 9; y++) if (tempSpielbrett[y][x] === 0) { spalteVoll = false; break; } if (spalteVoll) vS.push(x); }
        vR.forEach(y => { for (let x = 0; x < 9; x++) spielbrettElement.children[y * 9 + x].classList.add('linie-vorschau'); });
        vS.forEach(x => { for (let y = 0; y < 9; y++) spielbrettElement.children[y * 9 + x].classList.add('linie-vorschau'); });
    }

    function zeigePunkteAnimation(wert) {
        if (!punkteAnimationElement || wert === 0) return;
        punkteAnimationElement.classList.remove('animieren');
        void punkteAnimationElement.offsetWidth;
        const text = wert > 0 ? `+${wert}` : wert;
        const farbe = wert > 0 ? '#34A853' : '#EA4335';
        punkteAnimationElement.textContent = text;
        punkteAnimationElement.style.color = farbe;
        const brettRect = spielbrettElement.getBoundingClientRect();
        const randX = brettRect.width * 0.2 + Math.random() * brettRect.width * 0.6;
        const randY = brettRect.height * 0.1 + Math.random() * brettRect.height * 0.2;
        punkteAnimationElement.style.left = `${randX}px`;
        punkteAnimationElement.style.top = `${randY}px`;
        punkteAnimationElement.classList.add('animieren');
    }

    function erstelleJokerLeiste() { jokerBoxenContainer.innerHTML = ''; for (let i = 0; i < anzahlJoker; i++) { const jokerBox = document.createElement('div'); jokerBox.classList.add('joker-box'); jokerBoxenContainer.appendChild(jokerBox); } }
    function zeichneJokerLeiste() { const jokerBoxen = jokerBoxenContainer.children; for (let i = 0; i < jokerBoxen.length; i++) { jokerBoxen[i].classList.toggle('verbraucht', i < verbrauchteJoker); jokerBoxen[i].classList.toggle('voll', i >= verbrauchteJoker); } }
    function zeichneFigurInSlot(index) { const slot = figurenSlots[index], figur = figurenInSlots[index]; slot.innerHTML = ''; if (figur) { const container = document.createElement('div'); container.classList.add('figur-container'); const form = figur.form; container.style.gridTemplateRows = `repeat(${form.length}, 20px)`; container.style.gridTemplateColumns = `repeat(${form[0].length}, 20px)`; form.forEach(reihe => reihe.forEach(block => { const blockDiv = document.createElement('div'); if (block === 1) { blockDiv.classList.add('figur-block'); blockDiv.style.backgroundColor = spielConfig.colorThemes[figur.color]?.placed || spielConfig.colorThemes['default'].placed; } container.appendChild(blockDiv); })); slot.appendChild(container); } }
    function aktiviereJokerPenalty() { platziereStrafsteine(getGameSetting('jokerPenaltyCount')); }
    function getZielKoordinaten(e) { const rect = spielbrettElement.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; const mausX = clientX - rect.left; const mausY = clientY - rect.top; return { x: Math.floor(mausX / 40), y: Math.floor(mausY / 40) }; }
    function setCookie(name, value, days) { let expires = ""; if (days) { const date = new Date(); date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); expires = "; expires=" + date.toUTCString(); } document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax"; }
    function getCookie(name) { const nameEQ = name + "="; const ca = document.cookie.split(';'); for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) == ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length); } return null; }
    
    function pruefeUndSpeichereRekord() {
        stopTimer();
        let rekord = istHardMode ? rekordSchwer : rekordNormal, rekordCookieName = istHardMode ? 'rekordSchwer' : 'rekordNormal';
        if (punkte > rekord) {
            rekord = punkte;
            if (istHardMode) { rekordSchwerElement.textContent = rekord; rekordSchwer = rekord; }
            else { rekordNormalElement.textContent = rekord; rekordNormal = rekord; }
            setCookie(rekordCookieName, rekord, 365);
            gameOverTitel.textContent = 'Neuer Rekord!';
            gameOverText.textContent = `Du hast ${rekord} Punkte erreicht!`;
        } else {
            gameOverTitel.textContent = 'Spiel vorbei!';
            gameOverText.textContent = `Deine Punktzahl: ${punkte}`;
        }
        gameOverContainer.classList.add('sichtbar'), gameOverContainer.classList.remove('versteckt');
    }
    
    function erstelleSpielfeld() { spielbrettElement.innerHTML = ''; spielbrett = Array.from({ length: 9 }, () => Array(9).fill(0)); for (let y = 0; y < 9; y++) { for (let x = 0; x < 9; x++) { const zelle = document.createElement('div'); zelle.classList.add('zelle'); spielbrettElement.appendChild(zelle); } } }

    eventListenerZuweisen();
    spielStart();
});