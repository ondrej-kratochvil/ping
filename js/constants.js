// Konstanty aplikace
export const TOURNAMENT_TYPES = { SINGLE: 'single', DOUBLE: 'double' };
export const playerColors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
export const STORAGE_KEY = 'pingPongTournamentData';
export const API_URL = 'api.php';
export const APP_VERSION = '1.1.3';

// Motivační hlášky rozdělené podle situace
export const encouragingPhrases = {
    // Obecné hlášky - vhodné kdykoliv během zápasu
    general: [
        "Pojď, draku!", "To byl úder!", "Skvělá práce!", "Jen tak dál!", "To je ono!",
        "Paráda!", "Zaber!", "Soustřeď se.",
        "Máš na to!", "Výborně!", "Neskutečné!", "Jak z partesu.", "Tohle se povedlo.",
        "To je bojovník.", "Krásný bod.", "Ten má formu.",
        "Nádhera.", "Neuvěřitelný reflex.", "To se cení.", "Hraje jako bůh.", "Z toho se nevyhrabe."
    ],
    // Hlášky jen když zbývá poslední bod
    nearEnd: [
        "Ještě jeden!", "Téměř tam!", "Poslední bod!", "Finální úder!", "Na dosah vítězství!"
    ],
    // Body rychle po sobě (< 3 s)
    speedPhrases: [
        "To byla rychlost!", "Blesk!", "Rychlé to bylo!", "Žádná úleva!"
    ],
    // Body dlouho po sobě (> 15 s)
    longRallyPhrases: [
        "Krásná hra.", "Skvělá výměna!", "To byl zápas!", "Respekt!"
    ],
    // Hlášky pro situaci, kdy hráč prohrál bod (pro budoucí použití)
    afterLoss: [
        "Nevadí, další míč je tvůj.", "Soustřeď se na další bod.", "Ještě to není konec."
    ]
};

export const winningPhrases = [
    "To byla jízda!", "Gratulujeme vítězi!", "Nádherný výkon.", "Absolutně zasloužené vítězství.",
    "A je to tam!", "Klobouk dolů.", "Tohle byl koncert.", "Bez šance.", "Famózní!"
];
