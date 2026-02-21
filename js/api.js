// API komunikace
import { API_URL, TOURNAMENT_TYPES } from './constants.js';
import { showAlertModal } from './ui.js';
import { updateStateWithApiData } from './state.js';

/**
 * Volá API akci. Při chybě zobrazí modal a vrátí { ok: false }.
 * @returns {{ ok: true, data: object } | { ok: false }}
 */
export async function apiCall(action, payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.error || `HTTP ${response.status}`;
            console.error(`Chyba při volání akce '${action}':`, msg);
            await showAlertModal(`Chyba při operaci: ${msg}`, 'Chyba');
            return { ok: false };
        }
        const freshData = await response.json();
        if (freshData.tournaments) { // Aktualizujeme stav jen pokud přišel celý datový objekt
            updateStateWithApiData(freshData, { skipSettings: true });
        }
        return { ok: true, data: freshData };
    } catch (error) {
        console.error(`Došlo k chybě sítě při volání akce '${action}':`, error);
        await showAlertModal('Nepodařilo se provést operaci. Zkontrolujte připojení.', 'Chyba připojení');
        return { ok: false };
    }
}

export async function loadState() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        updateStateWithApiData(data);
    } catch (error) {
        console.error('Error loading data from API:', error);
        await showAlertModal('Nepodařilo se načíst data ze serveru. Aplikace nemusí fungovat správně.', 'Chyba načítání');
    }
}
