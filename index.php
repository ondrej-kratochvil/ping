<?php
// Auth: přesměrovat na sensio-auth login pokud není přihlášen
$_sensioAuthPath = rtrim($_ENV['SENSIO_AUTH_PATH'] ?? getenv('SENSIO_AUTH_PATH') ?: __DIR__ . '/../sensio-auth', '/');
require_once $_sensioAuthPath . '/gatekeeper.php';
// $currentUser, $sessionId, $pdo nyní dostupné

// Zákaz cachování
header("Content-Type: text/html; charset=utf-8");
$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
$routerBase = ($path === '/a/ping' || strpos($path, '/a/ping/') === 0) ? '/a/ping/' : '/';
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");

// i18n: load Ping-specific translations
require_once $_sensioAuthPath . '/src/I18n.php';
$currentLang = i18nCurrentLang();
$pingI18nPath = __DIR__ . '/i18n/' . $currentLang . '.json';
$pingI18n = is_file($pingI18nPath) ? file_get_contents($pingI18nPath) : '{}';
$pingT = json_decode($pingI18n, true) ?: [];
// Simple dot-notation translation helper for Ping
function tp(string $key, array $vars = []): string {
    global $pingT;
    $keys = explode('.', $key);
    $val = $pingT;
    foreach ($keys as $k) {
        if (!is_array($val) || !isset($val[$k])) return $key;
        $val = $val[$k];
    }
    if (!is_string($val)) return $key;
    foreach ($vars as $name => $value) {
        $val = str_replace('{{' . $name . '}}', $value, $val);
    }
    return $val;
}
?>
<!DOCTYPE html>
<html lang="<?= $currentLang ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="<?= htmlspecialchars($routerBase) ?>">
    <title><?= htmlspecialchars(tp('app.page_title')) ?></title>
    
    <script type="importmap">
    {
        "imports": {
            "./js/actions.js": "./js/actions.js?v=1.1.3",
            "./js/api.js": "./js/api.js?v=1.1.3",
            "./js/audio.js": "./js/audio.js?v=1.1.3",
            "./js/autocomplete.js": "./js/autocomplete.js?v=1.1.3",
            "./js/constants.js": "./js/constants.js?v=1.1.3",
            "./js/game-logic.js": "./js/game-logic.js?v=1.1.3",
            "./js/main.js": "./js/main.js?v=1.1.3",
            "./js/render.js": "./js/render.js?v=1.1.3",
            "./js/state.js": "./js/state.js?v=1.1.3",
            "./js/stats.js": "./js/stats.js?v=1.1.3",
            "./js/ui.js": "./js/ui.js?v=1.1.3",
            "./js/utils.js": "./js/utils.js?v=1.1.3",
            "./js/router.js": "./js/router.js?v=1.1.3",
            "./js/voice-input.js": "./js/voice-input.js?v=1.1.3",
            "./js/utils/tournament-utils.js": "./js/utils/tournament-utils.js?v=1.1.3",
            "./js/i18n.js": "./js/i18n.js?v=1.1.3"
        }
    }
    </script>
    <script>
        window.__PING_LANG__ = '<?= $currentLang ?>';
        window.__PING_I18N__ = <?= $pingI18n ?>;
    </script>
    <script>
        // Potlačení varování a chyb o produkčním použití Tailwind CSS CDN a CSP - MUSÍ být před načtením Tailwind CDN
        (function() {
            const shouldSuppress = (message) => {
                if (!message || typeof message !== 'string') return false;
                return message.includes('cdn.tailwindcss.com should not be used in production') ||
                       message.includes("Content Security Policy of your site blocks the use of 'eval'") ||
                       (message.includes("Content Security Policy") && message.includes("blocks the use of 'eval'")) ||
                       message.includes("Executing inline script violates the following Content Security Policy directive") ||
                       (message.includes("Loading the font") && message.includes("violates the following Content Security Policy directive"));
            };

            if (typeof console !== 'undefined') {
                if (console.warn) {
                    const originalWarn = console.warn;
                    console.warn = function(...args) {
                        if (!shouldSuppress(args[0])) {
                            originalWarn.apply(console, args);
                        }
                    };
                }
                if (console.error) {
                    const originalError = console.error;
                    console.error = function(...args) {
                        if (!shouldSuppress(args[0])) {
                            originalError.apply(console, args);
                        }
                    };
                }
            }
        })();
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: ['selector', '[data-theme="dark"]'],
            corePlugins: {
                preflight: true,
            }
        };
    </script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    <link rel="stylesheet" href="<?= htmlspecialchars($config['base_url']) ?>/assets/css/common.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <link rel="stylesheet" type="text/css" href="style.css">
    <!-- Import modulů a zpřístupnění do window, aby stávající inline kód postupně fungoval přes moduly -->
    <script type="module">
        // Zpřístupnění modulů do window pro přechodné období refaktoringu
        import * as Constants from './js/constants.js';
        import { state } from './js/state.js';
        import * as Api from './js/api.js';
        import * as Utils from './js/utils.js';
        import * as Audio from './js/audio.js';
        import * as UI from './js/ui.js';
        import * as Render from './js/render.js';
        import * as Stats from './js/stats.js';
        import * as GameLogic from './js/game-logic.js';
        import * as Actions from './js/actions.js';
        import { setupAutocomplete } from './js/autocomplete.js';
        import { generateUniqueTournamentName } from './js/utils/tournament-utils.js';

        // Explicitně nastavíme verzi zde, pokud by main.js selhal
        document.getElementById('app-version').textContent = '1.1.3';

        Object.assign(window, {
            // konstanty a state
            ...Constants,
            state,
            // API
            apiCall: Api.apiCall,
            loadState: Api.loadState,
            // util / UI / další moduly
            ...Utils,
            ...Audio,
            ...UI,
            ...Render,
            ...Stats,
            ...GameLogic,
            ...Actions,
            // speciální utilita
            generateUniqueTournamentName,
            setupAutocomplete,
        });
    </script>
    <script>
        // Testovací režim - aktivuje se pomocí ?test=true v URL
        window.TESTING_MODE = window.location.search.includes('test=true');
    </script>
</head>
<body>
<?php
define('APP_ID', (int)($_ENV['SENSIO_APP_ID'] ?? getenv('SENSIO_APP_ID') ?: 0));
require_once $_sensioAuthPath . '/header.php';
?>
    <div id="toast-container" class="fixed bottom-4 right-4 z-50 space-y-2"></div>
    <div id="app" class="max-w-3xl mx-auto p-4">
        <div id="main-screen" class="screen space-y-6">
            <header class="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h1 class="text-3xl font-bold flex items-center gap-3"><i class="fa-solid fa-trophy text-yellow-400"></i><span data-i18n="app.title"><?= htmlspecialchars(tp('app.title')) ?></span></h1>
                <div class="flex items-center gap-2 flex-wrap justify-end md:justify-start">
                    <button data-action="show-new-tournament-modal" data-test-id="new-tournament-button" class="btn btn-primary flex items-center gap-2"><i class="fa-solid fa-plus"></i> <span data-i18n="nav.new_tournament"><?= htmlspecialchars(tp('nav.new_tournament')) ?></span></button>
                    <div class="relative">
                        <button data-action="toggle-settings-menu" class="btn btn-secondary !p-0 h-12 w-12 flex items-center justify-center text-xl" data-i18n-title="nav.settings" title="<?= htmlspecialchars(tp('nav.settings')) ?>"><i class="fa-solid fa-gear"></i></button>
                        <div id="settings-menu" class="settings-menu hidden">
                            <button data-action="show-player-db"><i class="fa-solid fa-database w-6 mr-2"></i><span data-i18n="nav.player_db"><?= htmlspecialchars(tp('nav.player_db')) ?></span></button>
                            <button data-action="show-overall-stats"><i class="fa-solid fa-chart-line w-6 mr-2"></i><span data-i18n="nav.overall_stats"><?= htmlspecialchars(tp('nav.overall_stats')) ?></span></button>
                            <button data-action="export-data"><i class="fa-solid fa-file-export w-6 mr-2"></i><span data-i18n="nav.export_data"><?= htmlspecialchars(tp('nav.export_data')) ?></span></button>
                            <label for="import-file" class="cursor-pointer inline-flex items-center"><i class="fa-solid fa-file-import w-6 mr-2"></i><span data-i18n="nav.import_data"><?= htmlspecialchars(tp('nav.import_data')) ?></span></label>
                            <input type="file" id="import-file" class="hidden" accept=".json">
                            <label for="sound-toggle" class="cursor-pointer flex items-center justify-between">
                                <span class="flex items-center"><i class="fa-solid fa-volume-high w-6 mr-2"></i><span data-i18n="nav.sounds"><?= htmlspecialchars(tp('nav.sounds')) ?></span></span>
                                <input type="checkbox" id="sound-toggle" data-action="toggle-sound" class="sr-only">
                                <div class="relative w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full transition-colors toggle-checkbox">
                                    <div class="absolute left-0 top-0 w-5 h-5 bg-white dark:bg-gray-200 rounded-full shadow transform transition-transform toggle-label"></div>
                                </div>
                            </label>
                            <label for="voice-assist-toggle" class="cursor-pointer flex items-center justify-between">
                                <span class="flex items-center"><i class="fa-solid fa-comment-dots w-6 mr-2"></i><span data-i18n="nav.voice"><?= htmlspecialchars(tp('nav.voice')) ?></span></span>
                                <input type="checkbox" id="voice-assist-toggle" data-action="toggle-voice-assist" class="sr-only">
                                <div class="relative w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full transition-colors toggle-checkbox">
                                    <div class="absolute left-0 top-0 w-5 h-5 bg-white dark:bg-gray-200 rounded-full shadow transform transition-transform toggle-label"></div>
                                </div>
                            </label>
                            <label class="cursor-pointer flex flex-col gap-2">
                                <span class="flex items-center text-sm text-muted"><i class="fa-solid fa-volume-low w-6 mr-2"></i><span data-i18n="nav.voice_volume"><?= htmlspecialchars(tp('nav.voice_volume')) ?></span></span>
                                <input type="range" min="0" max="1" step="0.1" value="1" data-action="change-voice-volume" class="w-full">
                            </label>
                            <label for="motivational-phrases-toggle" class="cursor-pointer flex items-center justify-between">
                                <span class="flex items-center"><i class="fa-solid fa-comments w-6 mr-2"></i><span data-i18n="nav.motivational"><?= htmlspecialchars(tp('nav.motivational')) ?></span></span>
                                <input type="checkbox" id="motivational-phrases-toggle" data-action="toggle-motivational-phrases" class="sr-only">
                                <div class="relative w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full transition-colors toggle-checkbox">
                                    <div class="absolute left-0 top-0 w-5 h-5 bg-white dark:bg-gray-200 rounded-full shadow transform transition-transform toggle-label"></div>
                                </div>
                            </label>
                            <label for="show-locked-toggle" class="cursor-pointer flex items-center justify-between">
                                <span class="flex items-center"><i class="fa-solid fa-lock w-6 mr-2"></i><span data-i18n="nav.show_locked"><?= htmlspecialchars(tp('nav.show_locked')) ?></span></span>
                                <input type="checkbox" id="show-locked-toggle" data-action="toggle-show-locked" class="sr-only">
                                <div class="relative w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full transition-colors toggle-checkbox">
                                    <div class="absolute left-0 top-0 w-5 h-5 bg-white dark:bg-gray-200 rounded-full shadow transform transition-transform toggle-label"></div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </header>
            <main id="tournaments-list-container" class="space-y-4"></main>
        </div>

        <div id="player-db-screen" class="screen space-y-6">
             <header><h1 class="text-3xl font-bold" data-i18n="player.db_title"><?= htmlspecialchars(tp('player.db_title')) ?></h1><p class="text-muted" data-i18n="player.db_subtitle"><?= htmlspecialchars(tp('player.db_subtitle')) ?></p></header>
            <div class="flex gap-2"><button data-action="show-edit-player-modal" data-id="new" class="btn btn-primary w-full"><i class="fa-solid fa-plus mr-2"></i><span data-i18n="player.add_new"><?= htmlspecialchars(tp('player.add_new')) ?></span></button><button data-action="back-to-main" class="btn btn-secondary w-full" data-i18n="common.back"><?= htmlspecialchars(tp('common.back')) ?></button></div>
            <main id="player-db-list-container" class="space-y-2"></main>
        </div>
        <div id="tournament-screen" class="screen space-y-6">
            <header><div id="tournament-title" class="text-3xl font-bold"></div><p id="tournament-progress" class="text-muted"></p></header>
            <div class="flex items-center gap-2 flex-wrap"><button data-action="back-to-main" class="btn btn-secondary flex items-center justify-center gap-2"><i class="fa-solid fa-list-ul"></i> <span data-i18n="stats.tournaments"><?= htmlspecialchars(tp('stats.tournaments')) ?></span></button><button data-action="show-stats" class="btn btn-secondary flex items-center justify-center gap-2"><i class="fa-solid fa-chart-simple"></i> <span data-i18n="stats.statistics"><?= htmlspecialchars(tp('stats.statistics')) ?></span></button><button data-action="show-settings-modal" class="btn btn-secondary flex items-center justify-center gap-2 md:ml-auto"><i class="fa-solid fa-gear"></i> <span data-i18n="settings.title"><?= htmlspecialchars(tp('settings.title')) ?></span></button></div>
            <main class="space-y-6"><div id="final-results-container"></div><div id="upcoming-matches-container"></div><div id="completed-matches-container"></div></main>
        </div>
        <div id="game-screen" class="screen"></div>
        <div id="stats-screen" class="screen space-y-6">
            <header><h1 class="text-3xl font-bold" data-i18n="stats.title"><?= htmlspecialchars(tp('stats.title')) ?></h1><p id="stats-tournament-name" class="text-muted"></p></header>
            <div class="flex gap-2">
                <button data-action="back-to-tournament" class="btn btn-secondary flex-1" data-i18n="common.back"><?= htmlspecialchars(tp('common.back')) ?></button>
                <button data-action="export-csv" class="btn btn-primary flex-1"><i class="fa-solid fa-file-csv"></i> <span data-i18n="export.csv"><?= htmlspecialchars(tp('export.csv')) ?></span></button>
                <button data-action="export-pdf" class="btn btn-primary flex-1"><i class="fa-solid fa-file-pdf"></i> <span data-i18n="export.pdf"><?= htmlspecialchars(tp('export.pdf')) ?></span></button>
            </div>
            <div id="stats-leaderboard" class="card p-4 rounded-xl shadow-sm"></div>
            <div id="stats-team-leaderboard" class="card p-4 rounded-xl shadow-sm hidden"></div>
            <div class="space-y-2"><h2 class="text-xl font-bold" data-i18n="stats.h2h_title"><?= htmlspecialchars(tp('stats.h2h_title')) ?></h2><div id="stats-matrix" class="card p-4 rounded-xl shadow-sm overflow-x-auto"></div></div>
        </div>
        <div id="overall-stats-screen" class="screen space-y-6">
            <header><h1 class="text-3xl font-bold" data-i18n="stats.overall_title"><?= htmlspecialchars(tp('stats.overall_title')) ?></h1></header>
            <button data-action="back-to-main" data-test-id="back-to-main" class="btn btn-secondary w-full" data-i18n="common.back"><?= htmlspecialchars(tp('common.back')) ?></button>
            <div id="overall-stats-container" class="card p-4 rounded-xl shadow-sm overflow-x-auto"></div>
        </div>
        <div id="modals-container"></div>
        <footer class="text-center text-xs text-muted py-4 mt-8 border-t border-subtle">
            &copy; <?= htmlspecialchars(tp('app.copyright')) ?> | <?= htmlspecialchars(tp('app.version')) ?>: v<span id="app-version"></span>
        </footer>
    </div>

<script type="module" src="js/main.js?v=1.1.3"></script>
</body>
</html>
