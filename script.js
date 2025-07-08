document.addEventListener('DOMContentLoaded', () => {
    // === DOM-Elemente ===
    const anleitungContainer = document.getElementById('anleitung-container');
    const anleitungInhalt = document.getElementById('anleitung-inhalt');
    const anleitungToggleBtn = document.getElementById('anleitung-toggle-btn');
    // ... (restliche Elemente bleiben gleich) ...
    
    // ... (alle anderen Variablen bleiben gleich) ...

    /**
     * Lädt die Anleitung aus der anleitung.txt
     */
    async function ladeAnleitung() {
        try {
            const antwort = await fetch('anleitung.txt?v=' + new Date().getTime());
            if (!antwort.ok) throw new Error('Anleitung nicht gefunden');
            const text = await antwort.text();
            // Ersetzt Zeilenumbrüche durch <br> und formatiert Titel fett
            anleitungInhalt.innerHTML = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
        } catch(error) {
            anleitungInhalt.textContent = 'Anleitung konnte nicht geladen werden.';
            console.error(error);
        }
    }

    /**
     * Startet das gesamte Spiel.
     */
    async function spielStart() {
        // Lädt Konfiguration und Anleitung gleichzeitig für mehr Geschwindigkeit
        await Promise.all([ladeKonfiguration(), ladeAnleitung()]);

        // ... (Rest von spielStart bleibt gleich) ...
    }

    // === Event Listener Zuweisung ===
    function eventListenerZuweisen() {
        // ... (bisherige Listener bleiben gleich) ...

        // Listener für den Anleitung-Button
        if(anleitungToggleBtn) {
            anleitungToggleBtn.addEventListener('click', () => {
                anleitungContainer.classList.toggle('versteckt');
                anleitungToggleBtn.textContent = anleitungContainer.classList.contains('versteckt') ? 'Anleitung anzeigen' : 'Verbergen';
            });
        }
    }

    // ... (alle weiteren Funktionen bleiben unverändert) ...
});