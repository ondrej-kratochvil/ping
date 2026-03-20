// Konstanty aplikace
export const TOURNAMENT_TYPES = { SINGLE: 'single', DOUBLE: 'double' };
export const playerColors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
export const STORAGE_KEY = 'pingPongTournamentData';
export const API_URL = 'api.php';
export const APP_VERSION = '1.2.0';

// Motivační hlášky rozdělené podle situace
export const encouragingPhrases = {
    // Obecné hlášky - vhodné kdykoliv během zápasu
    general: [
        "Pojď, draku!", "To byl úder!", "Skvělá práce!", "Jen tak dál!", "To je ono!",
        "Paráda!", "Zaber!", "Soustřeď se.",
        "Máš na to!", "Výborně!", "Neskutečné!", "Jak z partesu.", "Tohle se povedlo.",
        "To je bojovník.", "Krásný bod.", "Ten má formu.",
        "Nádhera.", "Neuvěřitelný reflex.", "To se cení.", "Hraje jako bůh.", "Z toho se nevyhrabe.",
        "Bomba!", "Wow!", "Masakr!", "Precizní.", "Bez pardonu.",
        "Kam se podíváš, samá kvalita.", "Ten má ruku jako chirurg.",
        "Jako přes kopírák.", "Kdepak, tohle nechytíš.",
        "Tenhle bod se líbil.", "Už skoro nedýchá.",
        "To šlo do rohu jak na povel.", "Nepřečetl tenhle míč.",
        "Parádní top-spin!", "Pěkný servis.",
        "To se jen tak nevidí.", "Přesnost jako hodinky.",
        "Tenhle bod byl dar z nebes!", "Bodík přidán.",
        "Rychlý jako blesk.", "Bez dovolení!", "Bez šance."
    ],
    // Hlášky jen když zbývá poslední bod
    nearEnd: [
        "Ještě jeden!", "Téměř tam!", "Poslední bod!", "Finální úder!", "Na dosah vítězství!",
        "Teď nebo nikdy!", "Jeden krok od slávy!", "Tohle je ten moment!",
        "Nikdo to nezastaví!", "Dej to tam!"
    ],
    // Body rychle po sobě (< 3 s)
    speedPhrases: [
        "To byla rychlost!", "Blesk!", "Rychlé to bylo!", "Žádná úleva!",
        "Bleskový protiútok!", "Ani nestihl mrknout!",
        "To šlo rychle!", "Turbo!"
    ],
    // Body dlouho po sobě (> 15 s)
    longRallyPhrases: [
        "Krásná hra.", "Skvělá výměna!", "To byl zápas!", "Respekt!",
        "Výměna jako z učebnice.", "Skoro se nezastavil.",
        "Hustá přehazovaná!", "To byl úlet!"
    ],
    // Hlášky pro situaci, kdy hráč prohrál bod (pro budoucí použití)
    afterLoss: [
        "Nevadí, další míč je tvůj.", "Soustřeď se na další bod.", "Ještě to není konec."
    ]
};

export const winningPhrases = [
    "To byla jízda!", "Gratulujeme vítězi!", "Nádherný výkon.", "Absolutně zasloužené vítězství.",
    "A je to tam!", "Klobouk dolů.", "Tohle byl koncert.", "Bez šance.", "Famózní!",
    "Champion!", "Nezastavitelný.", "Tenhle turnaj patřil jemu.",
    "Vítěz bere vše!", "Legendární výkon.", "Vítěz dne!"
];
