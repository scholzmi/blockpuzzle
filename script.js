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
    let ersterZug = true;
    const isTouchDevice = 'ontouchstart' in window;

    // Mobile Steuerung Zustand
    let longPressTimer = null;
    let touchStartX, touchStartY, touchOffsetX, touchOffsetY;
    const longPressDuration = 200; 
    const touchMoveTolerance = 15;
    let lastTap = 0;

    // === Konfiguration ===
    let spielConfig = {};

    // ===================================================================================
    // INITIALISIERUNG
    // ===================================================================================

    async function spielStart() {
        spielbrettElement.classList.remove('zerbroeselt', 'panic-blinken');
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
        aktiverSlotIndex = -1;
        ausgewaehlteFigur = null;
        ersterZug = true;

        erstelleJokerLeiste();
        zeichneJokerLeiste();
        erstelleSpielfeld();
        zeichneSpielfeld();
        updatePanicButtonStatus();
        generiereNeueFiguren();
        wechsleZuNaechsterFigur();
        
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
            const erstellePool = (p) => Array.isArray(p) ? p.map(f => ({ ...f, form: parseShape(f.shape) })) : [];
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
        return spielConfig.gameSettings[modus][key] ?? spielConfig.gameSettings[key];
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
        refreshFigurenButton.addEventListener('click', () => figurenNeuAuslosen(false));
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
            rotateButton.style.display = 'none'; 
            figurenSlots.forEach((slot, index) => slot.addEventListener('click', () => waehleFigur(index)));
            spielbrettElement.addEventListener('touchstart', handleTouchStart);
            spielbrettElement.addEventListener('touchmove', handleTouchMove);
            spielbrettElement.addEventListener('touchend', handleTouchEnd);
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
    // TOUCH-SPEZIFISCHE HANDLER
    // ===================================================================================

    function handleTouchStart(e) {
        if (!ausgewaehlteFigur) return;
        e.preventDefault();
        
        const now = new Date().getTime();
        const timeSinceLastTap = now - lastTap;

        if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
            clearTimeout(longPressTimer);
            dreheAktiveFigur();
            zeichneSpielfeld();
            zeichneVorschau(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y);
            lastTap = 0; 
            return;
        }
        lastTap = now;

        const rect = spielbrettElement.getBoundingClientRect();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        
        const zellenGroesse = 40;
        let figurMittelpunktX = (letztesZiel.x * zellenGroesse) + (zellenGroesse / 2);
        let figurMittelpunktY = (letztesZiel.y * zellenGroesse) + (zellenGroesse / 2);

        touchOffsetX = figurMittelpunktX - (touchStartX - rect.left);
        touchOffsetY = figurMittelpunktY - (touchStartY - rect.top);

        handleBoardMove(e, true);
        
        longPressTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            platziereFigur(ausgewaehlteFigur, letztesZiel.x, letztesZiel.y);
        }, longPressDuration);
    }
    
    function handleTouchMove(e) {
        if (!ausgewaehlteFigur) return;
        e.preventDefault();
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;

        const diffX = Math.abs(touchX - touchStartX);
        const diffY = Math.abs(touchY - touchStartY);

        if (diffX > touchMoveTolerance || diffY > touchMoveTolerance) {
            clearTimeout(longPressTimer);
        }
        handleBoardMove(e, true);
    }

    function handleTouchEnd(e) {
        clearTimeout(longPressTimer);
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
        if (ausgewaehlteFigur.isKolossFigur) return;
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
        if (ausgewaehlteFigur.isKolossFigur) return; 
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

    function updatePanicButtonStatus() {
        const cost = getGameSetting('refreshPenaltyPoints') || 0;
        refreshFigurenButton.disabled = punkte < cost;
    }

    function figurenNeuAuslosen(isAutoPanic = false) {
        abbrechen();
        stopTimer();
        const penaltyPoints = getGameSetting('refreshPenaltyPoints') || 0;
        zeigePunkteAnimation(-penaltyPoints);
        
        punkte = Math.max(0, punkte - penaltyPoints);
        punkteElement.textContent = punkte;
        updatePanicButtonStatus();

        const blinkDuration = getGameSetting('panicBlinkDuration') || 1000;
        const blinkFrequency = getGameSetting('panicBlinkFrequency') || '0.2s';
        
        if (isAutoPanic) {
            refreshFigurenButton.classList.add('auto-panic');
        }
        spielbrettElement.style.setProperty('--panic-blink-frequenz', blinkFrequency);
        spielbrettElement.classList.add('panic-blinken');
        
        setTimeout(() => {
            if (isAutoPanic) {
                refreshFigurenButton.classList.remove('auto-panic');
            }
            spielbrettElement.classList.remove('panic-blinken');
            
            const kolossFigur = berechneKolossFigur();
            
            if (kolossFigur) {
                figurenInSlots[0] = { ...kolossFigur, id: 0 };
                for(let i = 1; i < 3; i++) {
                     if (spielConfig.figures.jokerPool.length > 0) {
                        let zufallsFigur = spielConfig.figures.jokerPool[Math.floor(Math.random() * spielConfig.figures.jokerPool.length)];
                        figurenInSlots[i] = { ...zufallsFigur, kategorie: 'joker', id: i };
                     } else {
                        figurenInSlots[i] = null;
                     }
                }
            } else { // Fallback, falls absolut kein Loch gefunden wurde
                for(let i = 0; i < 3; i++) {
                     if (spielConfig.figures.jokerPool.length > 0) {
                        let zufallsFigur = spielConfig.figures.jokerPool[Math.floor(Math.random() * spielConfig.figures.jokerPool.length)];
                        figurenInSlots[i] = { ...zufallsFigur, kategorie: 'joker', id: i };
                     } else {
                        figurenInSlots[i] = null;
                     }
                }
            }
            for(let i = 0; i < 3; i++) zeichneFigurInSlot(i);
            wechsleZuNaechsterFigur();
        }, blinkDuration);
    }
    
    function berechneKolossFigur() {
        const leereZellen = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (spielbrett[r][c] === 0) {
                    leereZellen.push({r, c});
                }
            }
        }

        if (leereZellen.length === 0) return null;

        const visited = Array.from({length: 9}, () => Array(9).fill(false));
        let alleLoecher = [];

        for (const zelle of leereZellen) {
            if (!visited[zelle.r][zelle.c]) {
                const aktuellesLoch = [];
                const queue = [zelle];
                visited[zelle.r][zelle.c] = true;

                while (queue.length > 0) {
                    const { r, c } = queue.shift();
                    aktuellesLoch.push({r, c});

                    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && spielbrett[nr][nc] === 0 && !visited[nr][nc]) {
                            visited[nr][nc] = true;
                            queue.push({r: nr, c: nc});
                        }
                    });
                }
                alleLoecher.push(aktuellesLoch);
            }
        }
        
        const validLoecher = alleLoecher.filter(loch => {
            if (loch.length === 0) return false;
            let minR = 8, maxR = 0, minC = 8, maxC = 0;
            loch.forEach(({r, c}) => {
                minR = Math.min(minR, r);
                maxR = Math.max(maxR, r);
                minC = Math.min(minC, c);
                maxC = Math.max(maxC, c);
            });
            return (maxR - minR + 1) <= 5 && (maxC - minC + 1) <= 5;
        });

        if(validLoecher.length === 0) return null;

        let groesstesLoch = validLoecher.reduce((groesstes, aktuelles) => aktuelles.length > groestes.length ? aktuelles : groesstes, []);

        if (groesstesLoch.length === 0) return null;

        let minR = 8, maxR = 0, minC = 8, maxC = 0;
        groesstesLoch.forEach(({r, c}) => {
            minR = Math.min(minR, r);
            maxR = Math.max(maxR, r);
            minC = Math.min(minC, c);
            maxC = Math.max(maxC, c);
        });

        const hoehe = maxR - minR + 1;
        const breite = maxC - minC + 1;
        const form = Array.from({length: hoehe}, () => Array(breite).fill(0));
        
        groesstesLoch.forEach(({r, c}) => {
            form[r - minR][c - minC] = 1;
        });

        return { form, isKolossFigur: true, color: 'super' };
    }


    function generiereNeueFiguren() {
        if (ersterZug) {
            if (spielConfig.figures.zonkPool.length > 0) {
                let zonkFigur = spielConfig.figures.zonkPool[Math.floor(Math.random() * spielConfig.figures.zonkPool.length)];
                figurenInSlots[0] = { ...zonkFigur, kategorie: 'zonk', id: 0 };
            }
            for (let i = 1; i < 3; i++) {
                 let normalFigur = spielConfig.figures.normalPool[Math.floor(Math.random() * spielConfig.figures.normalPool.length)];
                 figurenInSlots[i] = { ...normalFigur, kategorie: 'normal', id: i };
            }
            ersterZug = false;
        } else {
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
                    figurenInSlots[i] = { ...zufallsFigur, kategorie: kategorie, id: i };
                } else {
                    figurenInSlots[i] = null;
                }
            }
        }
        for (let i = 0; i < 3; i++) zeichneFigurInSlot(i);
        checkGameState();
    }

    function abbrechen() {
        if (ausgewaehlteFigur && hatFigurGedreht) {
            verbrauchteJoker--;
            zeichneJokerLeiste();
        }
        aktiverSlotIndex = -1;
        ausgewaehlteFigur = null;
        hatFigurGedreht = false;
        zeichneSlotHighlights();
        zeichneSpielfeld();
        spielbrettElement.style.cursor = 'default';
    }

    function platziereFigur(figur, startX, startY) {
        if (!figur) return;
        const figurHoehe = figur.form.length;
        const figurBreite = figur.form[0].length;
        const offsetX = Math.floor(figurBreite / 2);
        const offsetY = Math.floor(figurHoehe / 2);
        const platziereX = startX - offsetX;
        const platziereY = startY - offsetY;

        if (!kannPlatzieren(figur, platziereX, platziereY)) return;

        if (!ersterZugGemacht) {
            ersterZugGemacht = true;
            startTimer();
        } else if (!timerInterval) {
            resumeTimer();
        }
        if (navigator.vibrate && !isTouchDevice) navigator.vibrate(50);

        figur.form.forEach((reihe, y) => reihe.forEach((block, x) => {
            if (block === 1) {
                if(figur.isKolossFigur) {
                    spielbrett[platziereY + y][platziereX + x] = getGradientColor(x, y, figurBreite, figurHoehe);
                } else {
                    spielbrett[platziereY + y][platziereX + x] = figur.color;
                }
            }
        }));
        
        const blockAnzahl = figur.form.flat().reduce((a, b) => a + b, 0);
        let punktMultiplier = 1;
        if (figur.kategorie === 'normal') punktMultiplier = 2;
        else if (figur.kategorie === 'zonk' || figur.isKolossFigur) punktMultiplier = 5;
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
        updatePanicButtonStatus();
        
        figurenInSlots[alterSlotIndex] = null;
        zeichneFigurInSlot(alterSlotIndex);
        
        aktiverSlotIndex = -1;
        ausgewaehlteFigur = null;
        hatFigurGedreht = false; 
        if (isTouchDevice) rotateButton.style.display = 'none';
        zeichneSlotHighlights();
        zeichneSpielfeld();
        spielbrettElement.style.cursor = 'default';

        if (figurenInSlots.every(f => f === null)) {
            generiereNeueFiguren();
        } else {
            checkGameState();
        }
    }
    
    // NEU: Stabile Game-State-Prüfung
    function checkGameState() {
        if (istSpielVorbei()) {
            const cost = getGameSetting('refreshPenaltyPoints') || 0;
            if (punkte >= cost) {
                figurenNeuAuslosen(true); // Auto-Panic
            } else {
                triggerGameOver(); // Echtes Game Over
            }
        } else {
            wechsleZuNaechsterFigur();
        }
    }

    function handleBoardMove(e, mitOffset = false) {
        if (!ausgewaehlteFigur) return;
        lastMausEvent = e;
    
        let { x, y } = mitOffset ? getZielKoordinatenMitOffset(e) : getZielKoordinaten(e);
    
        const figurHoehe = ausgewaehlteFigur.form.length;
        const figurBreite = ausgewaehlteFigur.form[0].length;
        const offsetX = Math.floor(figurBreite / 2);
        const offsetY = Math.floor(figurHoehe / 2);
    
        x = Math.max(offsetX, x);
        y = Math.max(offsetY, y);
    
        x = Math.min(8 - (figurBreite - 1 - offsetX), x);
        y = Math.min(8 - (figurHoehe - 1 - offsetY), y);
    
        letztesZiel = { x, y };
    
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
    function resumeTimer() { if (ersterZugGemacht && !timerInterval && punkte > 0) startTimer(); }
    
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
    function istSpielVorbei() { for (const figur of figurenInSlots) { if (figur) { for (let r = 0; r < 4; r++) { for (let y = 0; y < 9; y++) { for (let x = 0; x < 9; x++) { if (kannPlatzieren(figur, x, y)) return false; } } figur.form = dreheFigur90Grad(figur.form); } } } return true; }
    function kannPlatzieren(figur, startX, startY) { if (!figur || !figur.form || figur.form.length === 0 || figur.form[0].length === 0) return false; for (let y = 0; y < figur.form.length; y++) { for (let x = 0; x < figur.form[y].length; x++) { if (figur.form[y][x] === 1) { const bX =
