// Konstanty aplikace
import { tRaw } from './i18n.js';

export const TOURNAMENT_TYPES = { SINGLE: 'single', DOUBLE: 'double' };
export const playerColors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
export const STORAGE_KEY = 'pingPongTournamentData';
export const API_URL = 'api.php';
export const APP_VERSION = '1.2.0';

// Motivační hlášky - načítají se z překladu
export function getEncouragingPhrases() {
    const phrases = tRaw('phrases');
    return phrases || { general: [], nearEnd: [], speedPhrases: [], longRallyPhrases: [], afterLoss: [] };
}

export function getWinningPhrases() {
    return tRaw('phrases.winning') || [];
}

// Zpětná kompatibilita - statický fallback pro případ, že překlady nejsou načtené
export const encouragingPhrases = {
    get general() { return getEncouragingPhrases().general || []; },
    get nearEnd() { return getEncouragingPhrases().nearEnd || []; },
    get speedPhrases() { return getEncouragingPhrases().speedPhrases || []; },
    get longRallyPhrases() { return getEncouragingPhrases().longRallyPhrases || []; },
    get afterLoss() { return getEncouragingPhrases().afterLoss || []; }
};

export const winningPhrases = new Proxy([], {
    get(target, prop) {
        const phrases = getWinningPhrases();
        if (prop === 'length') return phrases.length;
        if (typeof prop === 'string' && !isNaN(prop)) return phrases[parseInt(prop)];
        if (prop === Symbol.iterator) return phrases[Symbol.iterator].bind(phrases);
        return Reflect.get(phrases, prop);
    }
});
