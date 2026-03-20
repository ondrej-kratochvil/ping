// API komunikace
import { API_URL, TOURNAMENT_TYPES } from './constants.js';
import { showAlertModal } from './ui.js';
import { updateStateWithApiData } from './state.js';
import { t } from './i18n.js';

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
            await showAlertModal(t('common.api_error', { msg }), t('common.error'));
            return { ok: false };
        }
        const freshData = await response.json();
        if (freshData.tournaments) { // Aktualizujeme stav jen pokud přišel celý datový objekt
            updateStateWithApiData(freshData, { skipSettings: true });
        }
        return { ok: true, data: freshData };
    } catch (error) {
        console.error(`Došlo k chybě sítě při volání akce '${action}':`, error);
        await showAlertModal(t('common.network_error'), t('common.network_error_title'));
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
        await showAlertModal(t('common.load_error'), t('common.load_error_title'));
    }
}
