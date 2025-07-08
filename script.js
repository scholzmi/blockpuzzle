document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente und Konstanten ===
    const spielbrettElement = document.getElementById('spielbrett');
    // ... (restliche Elemente bleiben gleich) ...
    
    const BREITE = 9, HOEHE = 9, MAX_FIGUR_GROESSE = 5;
    
    // === Spiel-Variablen ===
    let spielbrett = [], punkte = 0, rekord = 0, figurenInSlots = [null, null, null];
    let ausgewaehlteFigur = null, ausgewaehlterSlotIndex = -1, rundenZaehler = 0;
    let letztesZiel = {x: -1, y: -1};

    // === Konfigurations- und Figuren-Variablen ===
    let spielConfig = {}, normaleFiguren = [], zonkFiguren = [], jokerFiguren = [];

    // === Logik (angepasst) ===

    async function ladeKonfiguration() {
        try {
            const antwort = await fetch('config.json?v=' + new Date().getTime());
            if (!antwort.ok) throw new Error('Netzwerk-Antwort war nicht ok.');
            spielConfig = await antwort.json();
            
            // ... (Version laden bleibt gleich) ...
            
            // Figuren-Pools mit Farb-Informationen erstellen
            const erstelleFigurenPool = (pool) => 
                pool.map(f => ({ form: parseShape(f.shape), color: f.color || 'default' }));

            normaleFiguren = erstelleFigurenPool(spielConfig.figures.normal);
            zonkFiguren = erstelleFigurenPool(spielConfig.figures.zonk);
            jokerFiguren = erstelleFigurenPool(spielConfig.figures.joker);

        } catch (error) {
            // ... (Fehlerbehandlung bleibt gleich) ...
        }
    }

    function platziereFigur(figur, startX, startY) {
        let blockAnzahl = 0;
        figur.form.forEach((reihe, y) => {
            reihe.forEach((block, x) => {
                if (block === 1) {
                    // Speichert jetzt den Farbnamen statt einer 1
                    spielbrett[startY + y][startX + x] = figur.color; 
                    blockAnzahl++;
                }
            });
        });
        punkte += blockAnzahl;
        leereVolleLinien();
        zeichneSpielfeld();
        punkteElement.textContent = punkte;
        // ... (Rest der Funktion bleibt gleich) ...
    }

    function zeichneSpielfeld() {
        spielbrett.forEach((reihe, y) => {
            reihe.forEach((farbName, x) => {
                const zelle = spielbrettElement.children[y * BREITE + x];
                zelle.className = 'zelle';
                zelle.style.backgroundColor = ''; // Wichtig: alte Farbe zurücksetzen
                
                if (farbName !== 0) {
                    zelle.classList.add('belegt');
                    zelle.style.backgroundColor = spielConfig.colorThemes[farbName]?.placed || spielConfig.colorThemes['default'].placed;
                }
            });
        });
    }

    function zeichneVorschau(figur, startX, startY) {
        loescheVorschau();
        if (!figur) return;

        const kannAblegen = kannPlatzieren(figur, startX, startY);
        
        figur.form.forEach((reihe, y) => {
            reihe.forEach((block, x) => {
                if (block === 1) {
                    const brettY = startY + y;
                    const brettX = startX + x;
                    if (brettY < HOEHE && brettX < BREITE && brettY >= 0 && brettX >= 0) {
                       const zelle = spielbrettElement.children[brettY * BREITE + brettX];
                       if (kannAblegen) {
                           zelle?.classList.add('vorschau');
                           zelle.style.backgroundColor = spielConfig.colorThemes[figur.color]?.preview || spielConfig.colorThemes['default'].preview;
                       } else {
                           zelle?.classList.add('vorschau-ungueltig');
                       }
                    }
                }
            });
        });
    }

    function zeichneFigurInSlot(index) {
        const slot = figurenSlots[index];
        slot.innerHTML = '';
        const figur = figurenInSlots[index];
        if (figur) {
            const container = document.createElement('div');
            // ... (Container erstellen bleibt gleich) ...
            
            form.forEach(reihe => {
                reihe.forEach(block => {
                    const blockDiv = document.createElement('div');
                    if (block === 1) {
                        blockDiv.classList.add('figur-block');
                        // Setzt die Farbe für die Vorschau-Blöcke
                        blockDiv.style.backgroundColor = spielConfig.colorThemes[figur.color]?.placed || spielConfig.colorThemes['default'].placed;
                    }
                    container.appendChild(blockDiv);
                });
            });
            slot.appendChild(container);
        }
    }

    function kannPlatzieren(figur, startX, startY) {
        for (let y = 0; y < figur.form.length; y++) {
            for (let x = 0; x < figur.form[y].length; x++) {
                if (figur.form[y][x] === 1) {
                    const bX = startX + x, bY = startY + y;
                    if (bX < 0 || bX >= BREITE || bY < 0 || bY >= HOEHE || spielbrett[bY][bX] !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    function leereVolleLinien() {
        const vR = [], vS = [];
        for(let y=0; y<HOEHE; y++) {
            if(spielbrett[y].every(z => z !== 0)) vR.push(y);
        }
        for(let x=0; x<BREITE; x++) {
            let voll=true;
            for(let y=0; y<HOEHE; y++) if(spielbrett[y][x] === 0) voll=false;
            if(voll) vS.push(x);
        }
        // ... (Rest der Funktion bleibt gleich, da sie nur auf 0 prüft) ...
    }
    
    // ... (alle weiteren Funktionen und Listener bleiben unverändert) ...
});