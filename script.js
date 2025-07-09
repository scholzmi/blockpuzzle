document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente ===
    const spielbrettElement = document.getElementById('spielbrett');
    const punkteElement = document.getElementById('punkte');
    const rekordNormalElement = document.getElementById('rekord-normal');
    const rekordSchwerElement = document.getElementById('rekord-schwer');
    const versionElement = document.getElementById('version-impressum');
    const aenderungsElement = document.getElementById('letzte-aenderung');
    const figurenSlots = document.querySelectorAll('.figur-slot');
    const jokerBoxen = document.querySelectorAll('.joker-box');
    const anleitungContainer = document.getElementById('anleitung-container');
    const anleitungInhalt = document.getElementById('anleitung-inhalt');
    const anleitungToggleIcon = document.getElementById('anleitung-toggle-icon');
    const hardModeSchalter = document.getElementById('hard-mode-schalter');
    const hardModeLabel = document.getElementById('hard-mode-label');
    const timerBox = document.getElementById('timer-box');
    const timerAnzeige = document.getElementById('timer');
    const refreshFigurenButton = document.getElementById('refresh-figuren-button');
    const punkteAnimationElement = document.getElementById('punkte-animation');
    const originalerTitel = document.title;

    // === Konstanten ===
    const BREITE = 9, HOEHE = 9, MAX_FIGUR_GROESSE = 5, ANZAHL_JOKER = 5;
    
    // === Spiel-Zustand ===
    let spielbrett = [], punkte = 0, rekordNormal = 0, rekordSchwer = 0, figurenInSlots = [null, null, null];
    let ausgewaehlteFigur = null, aktiverSlotIndex = -1, rundenZaehler = 0;
    let letztesZiel = { x: -1, y: -1 }, verbrauchteJoker = 0;
    let hatFigurGedreht = false, penaltyAktiviert = false;
    let istHardMode = false, timerInterval = null, verbleibendeZeit;
    let ersterZugGemacht = false;
    let lastMausEvent = null;

    // === Konfiguration ===
    let spielConfig = {};

    // ===================================================================================
    // INITIALISIERUNG
    // ===================================================================================

    async function spielStart(neustartBestaetigen = false) {
        if (neustartBestaetigen) {
            if (!confirm("Modus wechseln? Das aktuelle Spiel wird beendet und ein neues gestartet.")) {
                hardModeSchalter.checked = !hardModeSchalter.checked;
                return;
            }
        }
        stopTimer();
        istHardMode = hardModeSchalter.checked;
        updateHardModeLabel();

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
        aktiverSlotIndex = -1;
        ausgewaehlteFigur = null;
        lastMausEvent = null;

        if (getCookie('anleitungVersteckt') === 'true') anleitungContainer.classList.add('versteckt');

        zeichneJokerLeiste();
        erstelleSpielfeld();
        zeichneSpielfeld();
        generiereNeueFiguren();
        startTimer(); // Timer startet jetzt immer
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
        if (!anleitungInhalt) return;
        try {
            const antwort = await fetch('anleitung.txt?v=' + new Date().getTime());
            if (!antwort.ok) throw new Error('Anleitung nicht gefunden');
            const text = await antwort.text();
            anleitungInhalt.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        } catch (error) {
            anleitungInhalt.textContent = 'Anleitung konnte nicht geladen werden.';
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

        window.addEventListener('beforeunload', (e) => {
            if (punkte > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        spielbrettElement.addEventListener('mouseenter', spielbrettBetreten);
        spielbrettElement.addEventListener('click', klickAufBrett);
        spielbrettElement.addEventListener('mousemove', mausBewegungAufBrett);
        spielbrettElement.addEventListener('mouseleave', spielbrettVerlassen);
        spielbrettElement.addEventListener('wheel', wechsleFigurPerScroll);
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
                mausBewegungAufBrett(e);
            }
        });
        hardModeSchalter.addEventListener('change', () => spielStart(true));
        if (anleitungToggleIcon) {
            anleitungToggleIcon.addEventListener('click', () => {
                const istVersteckt = anleitungContainer.classList.toggle('versteckt');
                setCookie('anleitungVersteckt', istVersteckt, 365);
            });
        }
        if (refreshFigurenButton) {
            refreshFigurenButton.addEventListener('click', figurenNeuAuslosen);
        }
    }

    // ===================================================================================
    // STEUERUNG & SPIEL-LOGIK
    // ===================================================================================

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

    function spielbrettBetreten(e) {
        if (!ausgewaehlteFigur) {
            wechsleZuNaechsterFigur();
        }
        mausBewegungAufBrett(e);
    }

    function spielbrettVerlassen() {
        if (ausgewaehlteFigur) {
            zeichneSpielfeld();
        }
    }

    function wechsleFigurPerScroll(e) {
        e.preventDefault();
        if (!ausgewaehlteFigur) return;

        const richtung = e.deltaY > 0 ? 1 : -1;
        const verfuegbareIndices = figurenInSlots
            .map((fig, index) => fig ? index : -1)
            .filter(index => index !== -1);

        if (verfuegbareIndices.length <= 1) return;

        if (hatFigurGedreht) {
            verbrauchteJoker--;
            zeichneJokerLeiste();
        }
        
        const aktuellePosition = verfuegbareIndices.indexOf(aktiverSlotIndex);
        const neuePosition = (aktuellePosition + richtung + verfuegbareIndices.length) % verfuegbareIndices.length;
        
        aktiverSlotIndex = verfuegbareIndices[neuePosition];
        ausgewaehlteFigur = figurenInSlots[aktiverSlotIndex];
        hatFigurGedreht = false;

        zeichneSlotHighlights();
        mausBewegungAufBrett(lastMausEvent);
    }

    function wechsleZuNaechsterFigur() {
        if (ausgewaehlteFigur) return;

        let naechsterIndex = figurenInSlots.findIndex(fig => fig !== null);

        if (naechsterIndex !== -1) {
            aktiverSlotIndex = naechsterIndex;
            ausgewaehlteFigur = figurenInSlots[aktiverSlotIndex];
            hatFigurGedreht = false;
            spielbrettElement.style.cursor = 'none';
        } else {
            aktiverSlotIndex = -1;
            ausgewaehlteFigur = null;
            spielbrettElement.style.cursor = 'default';
            if (figurenInSlots.every(f => f === null)) {
                generiereNeueFiguren();
                wechsleZuNaechsterFigur();
            }
        }
        zeichneSlotHighlights();
    }

    function zeichneSlotHighlights() {
        figurenSlots.forEach((slot, index) => {
            if (index === aktiverSlotIndex) {
                slot.classList.add('aktiver-slot');
            } else {
                slot.classList.remove('aktiver-slot');
            }
        });
    }

    function figurenNeuAuslosen() {
        if (verbrauchteJoker >= ANZAHL_JOKER) return;
        abbrechen();
        
        const penaltyPoints = getGameSetting('refreshPenaltyPoints') || 0;
        
        zeigePunkteAnimation(-penaltyPoints);

        setTimeout(() => {
            punkte = Math.max(0, punkte - penaltyPoints);
            punkteElement.textContent = punkte;
        }, 500);

        verbrauchteJoker++;
        zeichneJokerLeiste();

        if (verbrauchteJoker >= ANZAHL_JOKER) {
            aktiviereJokerPenalty();
            verbrauchteJoker = 0;
            zeichneJokerLeiste();
            penaltyAktiviert = false;
        }
        generiereNeueFiguren();
    }

    function generiereNeueFiguren() {
        rundenZaehler++;
        const probs = spielConfig.probabilities || {};
        const jokerProb = probs.joker || 0.20;
        const zonkProb = probs.zonk || 0.05;
        const reductionInterval = probs.jokerProbabilityReductionInterval || 5;
        const minimumJokerProb = probs.jokerProbabilityMinimum || 0.03;
        const jokerReduktion = Math.floor((rundenZaehler - 1) / reductionInterval) * 0.01;
        const aktuelleJokerProb = Math.max(minimumJokerProb, jokerProb - jokerReduktion);
        for (let i = 0; i < 3; i++) {
            let zufallsFigur = null;
            let kategorie = 'normal';
            const zufallsZahl = Math.random();

            if (spielConfig.figures.zonkPool.length > 0 && zufallsZahl < zonkProb) {
                zufallsFigur = spielConfig.figures.zonkPool[Math.floor(Math.random() * spielConfig.figures.zonkPool.length)];
                kategorie = 'zonk';
            } else if (spielConfig.figures.jokerPool.length > 0 && zufallsZahl < zonkProb + aktuelleJokerProb) {
                zufallsFigur = spielConfig.figures.jokerPool[Math.floor(Math.random() * spielConfig.figures.jokerPool.length)];
                kategorie = 'joker';
            } else if (spielConfig.figures.normalPool.length > 0) {
                zufallsFigur = spielConfig.figures.normalPool[Math.floor(Math.random() * spielConfig.figures.normalPool.length)];
                kategorie = 'normal';
            }

            if (zufallsFigur) {
                let form = zufallsFigur.form;
                const anzahlRotationen = Math.floor(Math.random() * 4);
                for (let r = 0; r < anzahlRotationen; r++) { form = dreheFigur90Grad(form); }
                figurenInSlots[i] = { form, color: zufallsFigur.color, symmetrisch: zufallsFigur.symmetrisch, kategorie: kategorie, id: i };
                zeichneFigurInSlot(i);
            } else {
                figurenInSlots[i] = null;
            }
        }
        if (istSpielVorbei()) {
            setTimeout(pruefeUndSpeichereRekord, 100);
        }
    }

    function abbrechen() {
        if (!ausgewaehlteFigur) return;

        if (hatFigurGedreht) {
            verbrauchteJoker--;
            penaltyAktiviert = false;
            zeichneJokerLeiste();
        }

        aktiverSlotIndex = -1;
        ausgewaehlteFigur = null;
        zeichneSlotHighlights();
        zeichneSpielfeld();
        spielbrettElement.style.cursor = 'default';
    }

    function platziereFigur(figur, startX, startY) {
        if (!ersterZugGemacht) {
            ersterZugGemacht = true;
        }

        const figurHoehe = figur.form.length;
        const figurBreite = figur.form[0].length;
        const offsetX = Math.floor(figurBreite / 2);
        const offsetY = Math.floor(figurHoehe / 2);
        const platziereX = startX - offsetX;
        const platziereY = startY - offsetY;

        if (!kannPlatzieren(figur, platziereX, platziereY)) return;

        figur.form.forEach((reihe, y) => {
            reihe.forEach((block, x) => {
                if (block === 1) spielbrett[platziereY + y][platziereX + x] = figur.color;
            });
        });

        const blockAnzahl = figur.form.flat().reduce((a, b) => a + b, 0);
        let punktMultiplier = 1;
        if (figur.kategorie === 'normal') {
            punktMultiplier = 2;
        } else if (figur.kategorie === 'zonk') {
            punktMultiplier = 5;
        }
        const figurenPunkte = blockAnzahl * punktMultiplier;
        
        const alterSlotIndex = aktiverSlotIndex;
        figurenInSlots[alterSlotIndex] = null;
        zeichneFigurInSlot(alterSlotIndex);

        ausgewaehlteFigur = null;
        aktiverSlotIndex = -1;
        hatFigurGedreht = false;

        if (penaltyAktiviert) {
            aktiviereJokerPenalty();
            verbrauchteJoker = 0;
            zeichneJokerLeiste();
            penaltyAktiviert = false;
        }

        const linienPunkte = leereVolleLinien();
        const gesamtPunkteGewinn = figurenPunkte + linienPunkte;

        zeigePunkteAnimation(gesamtPunkteGewinn);

        setTimeout(() => {
            punkte += gesamtPunkteGewinn;
            punkteElement.textContent = punkte;
        }, 500);

        wechsleZuNaechsterFigur();

        if (istSpielVorbei()) {
            setTimeout(pruefeUndSpeichereRekord, 100);
        }
    }

    function mausBewegungAufBrett(e) {
        if (!e) return;
        lastMausEvent = e;
        if (!ausgewaehlteFigur) return;
        letztesZiel = getZielKoordinaten(e);
        zeichneSpielfeld();
        zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y);
    }

    function klickAufBrett(e) {
        if (!ausgewaehlteFigur) return;
        const ziel = getZielKoordinaten(e);
        platziereFigur(ausgewaehlteFigur, ziel.x, ziel.y);
    }

    function toggleBossKey() {
        document.body.classList.toggle('boss-key-aktiv');
        if (document.body.classList.contains('boss-key-aktiv')) {
            document.title = "Photo Gallery";
            if (istHardMode) stopTimer();
            abbrechen();
        } else {
            document.title = originalerTitel;
            if (istHardMode) resumeTimer();
        }
    }

    function startTimer() {
        verbleibendeZeit = getGameSetting('timerDuration');
        timerAnzeige.textContent = verbleibendeZeit;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            verbleibendeZeit--;
            timerAnzeige.textContent = verbleibendeZeit;
            if (verbleibendeZeit <= 0) {
                const anzahl = getGameSetting('timerPenaltyCount');
                platziereStrafsteine(anzahl);
                verbleibendeZeit = getGameSetting('timerDuration');
            }
        }, 1000);
    }

    function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
    function resumeTimer() {
        if (timerInterval || !istHardMode) return;
        startTimer();
    }

    function platziereStrafsteine(anzahl) {
        const leereZellen = [];
        spielbrett.forEach((reihe, y) => {
            reihe.forEach((zelle, x) => {
                if (zelle === 0) leereZellen.push({ x, y });
            });
        });
        leereZellen.sort(() => 0.5 - Math.random());
        const anzahlZuPlatzieren = Math.min(anzahl, leereZellen.length);
        for (let i = 0; i < anzahlZuPlatzieren; i++) {
            const zelle = leereZellen[i];
            spielbrett[zelle.y][zelle.x] = 'blocker';
        }
        zeichneSpielfeld();
    }

    function parseShape(shapeCoords) { if (!shapeCoords || shapeCoords.length === 0) return [[]]; let tempMatrix = Array.from({ length: MAX_FIGUR_GROESSE }, () => Array(MAX_FIGUR_GROESSE).fill(0)); let minRow = MAX_FIGUR_GROESSE, maxRow = -1, minCol = MAX_FIGUR_GROESSE, maxCol = -1; shapeCoords.forEach(coord => { const row = Math.floor((coord - 1) / MAX_FIGUR_GROESSE); const col = (coord - 1) % MAX_FIGUR_GROESSE; if (row < MAX_FIGUR_GROESSE && col < MAX_FIGUR_GROESSE) { tempMatrix[row][col] = 1; minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row); minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col); } }); if (maxRow === -1) return []; const croppedMatrix = []; for (let y = minRow; y <= maxRow; y++) { croppedMatrix.push(tempMatrix[y].slice(minCol, maxCol + 1)); } return croppedMatrix; }
    function dreheFigur90Grad(matrix) { const transponiert = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex])); return transponiert.map(row => row.reverse()); }
    function istSpielVorbei() { for (const figurSlot of figurenInSlots) { if (figurSlot && figurSlot.form.length > 0 && figurSlot.form[0].length > 0) { let aktuelleForm = figurSlot.form; for (let i = 0; i < 4; i++) { const tempFigur = { form: aktuelleForm, color: figurSlot.color }; for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { if (kannPlatzieren(tempFigur, x, y)) return false; } } aktuelleForm = dreheFigur90Grad(aktuelleForm); } } } return true; }
    function kannPlatzieren(figur, startX, startY) { if (!figur || !figur.form || figur.form.length === 0 || figur.form[0].length === 0) return false; for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX = startX + x, bY = startY + y; if (bX < 0 || bX >= BREITE || bY < 0 || bY >= HOEHE || spielbrett[bY][bX] !== 0) return false; } } } return true; }
    
    function leereVolleLinien() {
        let vR = [], vS = [];
        for (let y = 0; y < HOEHE; y++) {
            if (spielbrett[y].every(zelle => zelle !== 0)) vR.push(y);
        }
        for (let x = 0; x < BREITE; x++) {
            let spalteVoll = true;
            for (let y = 0; y < HOEHE; y++) {
                if (spielbrett[y][x] === 0) {
                    spalteVoll = false;
                    break;
                }
            }
            if (spalteVoll) vS.push(x);
        }
        
        const linien = vR.length + vS.length;
        if (linien > 0) {
            vR.forEach(y => spielbrett[y].fill(0));
            vS.forEach(x => spielbrett.forEach(reihe => reihe[x] = 0));
        }
        
        zeichneSpielfeld();
        return linien * 10 * linien;
    }

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

    function zeichneVorschau(figur, startX, startY) {
        if (!figur) return;

        const figurHoehe = figur.form.length;
        const figurBreite = figur.form[0].length;
        const offsetX = Math.floor(figurBreite / 2);
        const offsetY = Math.floor(figurHoehe / 2);
        const platziereX = startX - offsetX;
        const platziereY = startY - offsetY;

        const kannFigurPlatzieren = kannPlatzieren(figur, platziereX, platziereY);

        if (kannFigurPlatzieren) {
            const tempSpielbrett = spielbrett.map(row => [...row]);
            figur.form.forEach((reihe, y) => {
                reihe.forEach((block, x) => {
                    if (block === 1) {
                        const bY = platziereY + y;
                        const bX = platziereX + x;
                        if (bY < HOEHE && bX < BREITE) tempSpielbrett[bY][bX] = 1;
                    }
                });
            });
            zeichneLinienVorschau(tempSpielbrett);
        }

        figur.form.forEach((reihe, y) => {
            reihe.forEach((block, x) => {
                if (block === 1) {
                    const brettY = platziereY + y;
                    const brettX = platziereX + x;
                    if (brettY < HOEHE && brettX < BREITE && brettY >= 0 && brettX >= 0) {
                        const zelle = spielbrettElement.children[brettY * BREITE + brettX];
                        if (kannFigurPlatzieren) {
                            const farbTheme = spielConfig.colorThemes[figur.color] || spielConfig.colorThemes['default'];
                            zelle.style.backgroundColor = farbTheme.preview;
                        } else {
                            zelle.style.backgroundColor = 'rgba(234, 67, 53, 0.5)';
                        }
                    }
                }
            });
        });
    }

    function zeichneLinienVorschau(tempSpielbrett) {
        let vR = [], vS = [];
        for (let y = 0; y < HOEHE; y++) {
            if (tempSpielbrett[y].every(zelle => zelle !== 0)) vR.push(y);
        }
        for (let x = 0; x < BREITE; x++) {
            let spalteVoll = true;
            for (let y = 0; y < HOEHE; y++) {
                if (tempSpielbrett[y][x] === 0) { spalteVoll = false; break; }
            }
            if (spalteVoll) vS.push(x);
        }

        vR.forEach(y => {
            for (let x = 0; x < BREITE; x++) {
                spielbrettElement.children[y * BREITE + x].classList.add('linie-vorschau');
            }
        });
        vS.forEach(x => {
            for (let y = 0; y < HOEHE; y++) {
                spielbrettElement.children[y * BREITE + x].classList.add('linie-vorschau');
            }
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
            container.style.gridTemplateRows = `repeat(${form.length}, 20px)`;
            container.style.gridTemplateColumns = `repeat(${form[0].length}, 20px)`;
            form.forEach(reihe => {
                reihe.forEach(block => {
                    const blockDiv = document.createElement('div');
                    if (block === 1) {
                        blockDiv.classList.add('figur-block');
                        blockDiv.style.backgroundColor = spielConfig.colorThemes[figur.color]?.placed || spielConfig.colorThemes['default'].placed;
                    }
                    container.appendChild(blockDiv);
                });
            });
            slot.appendChild(container);
        }
    }
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
        refreshFigurenButton.disabled = verbrauchteJoker >= ANZAHL_JOKER;
    }

    function aktiviereJokerPenalty() {
        const anzahl = getGameSetting('jokerPenaltyCount');
        platziereStrafsteine(anzahl);
    }

    function getZielKoordinaten(e) { const rect = spielbrettElement.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; const mausX = clientX - rect.left; const mausY = clientY - rect.top; return { x: Math.floor(mausX / 40), y: Math.floor(mausY / 40) }; }
    function setCookie(name, value, days) { let expires = ""; if (days) { const date = new Date(); date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); expires = "; expires=" + date.toUTCString(); } document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax"; }
    function getCookie(name) { const nameEQ = name + "="; const ca = document.cookie.split(';'); for (let i = 0; i < ca.length; i++) { let c = ca[i]; while (c.charAt(0) == ' ') c = c.substring(1, c.length); if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length); } return null; }
    function pruefeUndSpeichereRekord() {
        if (istHardMode) {
            if (punkte > rekordSchwer) {
                rekordSchwer = punkte;
                rekordSchwerElement.textContent = rekordSchwer;
                setCookie('rekordSchwer', rekordSchwer, 365);
                alert(`Neuer Rekord im schweren Modus: ${rekordSchwer} Punkte!`);
            } else {
                alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`);
            }
        } else {
            if (punkte > rekordNormal) {
                rekordNormal = punkte;
                rekordNormalElement.textContent = rekordNormal;
                setCookie('rekordNormal', rekordNormal, 365);
                alert(`Neuer Rekord im normalen Modus: ${rekordNormal} Punkte!`);
            } else {
                alert(`Spiel vorbei! Deine Punktzahl: ${punkte}`);
            }
        }
        spielStart();
    }
    function erstelleSpielfeld() { spielbrettElement.innerHTML = ''; spielbrett = Array.from({ length: HOEHE }, () => Array(BREITE).fill(0)); for (let y = 0; y < HOEHE; y++) { for (let x = 0; x < BREITE; x++) { const zelle = document.createElement('div'); zelle.classList.add('zelle'); spielbrettElement.appendChild(zelle); } } }

    eventListenerZuweisen();
    spielStart();
});