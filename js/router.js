// Router – History API, konfigurovatelný base path

/**
 * Vrací base path podle prostředí (stejné jako PHP <base href>).
 * Localhost: /a/ping/, Produkce (root): /
 */
export function getBase() {
    return window.location.pathname.startsWith('/a/ping') ? '/a/ping/' : '/';
}

/** Pro path operace – base bez koncové lomítka (nebo '' pro root). */
function getBaseForPath() {
    const base = getBase();
    return base === '/' ? '' : base.replace(/\/$/, '');
}

/**
 * Vrací aktuální cestu bez base path.
 */
export function getPath() {
    const base = getBaseForPath();
    let path = window.location.pathname;
    if (base && path.startsWith(base)) {
        path = path.slice(base.length) || '/';
    }
    return path;
}

/**
 * Parsuje cestu na objekt route.
 * @returns {{ name: string, tournamentId?: number, matchId?: number, playerId?: number }}
 */
export function parseRoute(path) {
    const base = getBaseForPath();
    let p = path || getPath();
    if (base && p.startsWith(base)) {
        p = p.slice(base.length) || '/';
    }
    p = '/' + p.replace(/^\/+/, '');

    const segments = p.split('/').filter(Boolean);

    if (segments.length === 0 || (segments.length === 1 && segments[0] === '')) {
        return { name: 'main' };
    }

    if (segments[0] === 'tournament') {
        if (segments[1] === 'new') {
            return { name: 'tournament-new' };
        }
        const tournamentId = parseInt(segments[1], 10);
        if (isNaN(tournamentId)) return { name: 'main' };
        if (segments[2] === 'settings') {
            return { name: 'tournament-settings', tournamentId };
        }
        if (segments[2] === 'stats') {
            return { name: 'tournament-stats', tournamentId };
        }
        if (segments[2] === 'match' && segments[3]) {
            const matchId = parseInt(segments[3], 10);
            return { name: 'match', tournamentId, matchId: isNaN(matchId) ? null : matchId };
        }
        return { name: 'tournament', tournamentId };
    }

    if (segments[0] === 'players') {
        if (segments[1] === 'new') {
            return { name: 'player-new' };
        }
        if (segments[1]) {
            const playerId = parseInt(segments[1], 10);
            return { name: 'player-edit', playerId: isNaN(playerId) ? null : playerId };
        }
        return { name: 'players' };
    }

    if (segments[0] === 'stats' && segments[1] === 'overall') {
        return { name: 'stats-overall' };
    }

    return { name: 'main' };
}

/**
 * Sestaví plnou cestu včetně base.
 */
export function buildPath(route) {
    const base = getBaseForPath();
    let path = '';
    switch (route.name) {
        case 'main': path = '/'; break;
        case 'tournament-new': path = '/tournament/new'; break;
        case 'tournament': path = `/tournament/${route.tournamentId}`; break;
        case 'tournament-settings': path = `/tournament/${route.tournamentId}/settings`; break;
        case 'tournament-stats': path = `/tournament/${route.tournamentId}/stats`; break;
        case 'match': path = `/tournament/${route.tournamentId}/match/${route.matchId}`; break;
        case 'players': path = '/players'; break;
        case 'player-new': path = '/players/new'; break;
        case 'player-edit': path = `/players/${route.playerId}`; break;
        case 'stats-overall': path = '/stats/overall'; break;
        default: path = '/';
    }
    return base + path;
}

/**
 * Naviguje na cestu (pushState nebo replaceState).
 */
export function navigate(routeOrPath, replace = false) {
    const route = typeof routeOrPath === 'string' ? parseRoute(routeOrPath) : routeOrPath;
    const path = buildPath(route);
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ route }, '', path);
    return route;
}

/**
 * Naviguje zpět v historii.
 */
export function back() {
    window.history.back();
}

let _applyRoute = null;

const MODAL_ROUTES = ['tournament-new', 'tournament-settings', 'player-new', 'player-edit'];

export function isModalRoute(route) {
    return route && MODAL_ROUTES.includes(route.name);
}

/**
 * Inicializuje router – poslouchá popstate a volá applyRoute při změně URL.
 * @param {Function} applyRoute - async (route) => void – vykreslí obrazovku podle route
 */
export function initRouter(applyRoute) {
    _applyRoute = applyRoute;
    window.addEventListener('popstate', () => {
        _applyRoute(parseRoute(getPath()));
    });
}

/**
 * Naviguje na cestu a vykreslí obrazovku (pushState + applyRoute).
 */
export async function navigateTo(routeOrPath, replace = false) {
    const route = typeof routeOrPath === 'string' ? parseRoute(routeOrPath) : routeOrPath;
    navigate(route, replace);
    if (_applyRoute) {
        await _applyRoute(route);
    }
}
