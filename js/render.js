// Render functions - všechny render funkce pro zobrazení obrazovek
import { state } from './state.js';
import { showScreen, renderGameScreen, openModal } from './ui.js';
import {
    getGlobalPlayer, getTournament, getMatch, formatDate, isDoubleTournament,
    getDisplaySides, getSidePlayerIds, formatPlayersLabel, getTeamKey,
    getTournamentTypeIcon, getTournamentTypeColor, getTournamentTypeLabel,
    getCzechPlayerDeclension, getMatchResultForPlayers
} from './utils.js';
import { playerColors } from './constants.js';
import { calculateStats, calculateTeamStats, calculateOverallStats, calculateOverallTeamStats, getDisplayPos, isTied } from './stats.js';
import { checkWinCondition } from './game-logic.js';
import { showAlertModal } from './ui.js';
import { t as tr, t_plural as tr_plural } from './i18n.js';

export function getTournamentStatus(t) {
    const completedCount = t.matches.filter(m => m.completed).length;
    const totalMatches = t.matches.length;
    if (totalMatches > 0 && completedCount === totalMatches) {
        return { icon: 'fa-trophy', color: 'text-yellow-500', text: tr('tournament.status_finished') };
    }
    if (completedCount > 0 || t.matches.some(m => m.score1 > 0 || m.score2 > 0)) {
        return { icon: 'fa-person-running', color: 'text-blue-500', text: tr('tournament.status_in_progress') };
    }
    return { icon: 'fa-play-circle', color: 'text-gray-400', text: tr('tournament.status_ready') };
}

export function renderPlayerDbScreen() {
    const container = document.getElementById('player-db-list-container');
    if(state.playerDatabase.length === 0) { 
        container.innerHTML = `<div class="text-center text-muted p-8 card rounded-xl">${tr('player.db_empty')}</div>`; 
    } else {
        container.innerHTML = state.playerDatabase.sort((a,b) => a.name.localeCompare(b.name)).map(p => {
            const photo = p.photoUrl || `data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%2240%22%20height%3D%2240%22%20fill%3D%22%23e5e7eb%22%20rx%3D%2220%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%22%20font-size%3D%2216%22%20fill%3D%22%239ca3af%22%3E${p.name.charAt(0).toUpperCase()}%3C%2Ftext%3E%3C%2Fsvg%3E`;
            return `<div class="card p-3 rounded-xl shadow-sm flex items-center justify-between"><div class="flex items-center gap-3"><img src="${photo}" class="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-gray-600"><span class="font-semibold">${p.name}</span></div><div><button data-action="show-edit-player-modal" data-id="${p.id}" class="btn btn-secondary !p-2 h-10 w-10" title="Upravit hráče"><i class="fa-solid fa-pencil"></i></button><button data-action="delete-player" data-id="${p.id}" class="btn btn-danger !p-2 h-10 w-10" title="Smazat hráče"><i class="fa-solid fa-trash"></i></button></div></div>`;
        }).join('');
    }
    showScreen('playerDb');
}

export function renderMainScreen() {
    const container = document.getElementById('tournaments-list-container');
    const showLocked = state.settings.showLockedTournaments || false;
    const visibleTournaments = showLocked ? state.tournaments : state.tournaments.filter(t => !t.isLocked);
    const lockedTournaments = state.tournaments.filter(t => t.isLocked);
    const hasLockedTournaments = lockedTournaments.length > 0;

    if (visibleTournaments.length === 0) {
        let emptyStateHTML = `<div class="text-center py-10 px-6 card rounded-xl shadow-sm"><i class="fa-solid fa-trophy text-5xl text-muted"></i>`;

        if (hasLockedTournaments && !showLocked) {
            emptyStateHTML += `<h2 class="text-xl font-semibold mt-4">${tr('tournament.no_tournaments_to_show')}</h2><p class="text-muted mt-1">${tr_plural('tournament.locked_count', lockedTournaments.length, { count: lockedTournaments.length })}</p><button data-action="show-locked-tournaments" class="btn btn-secondary mt-4"><i class="fa-solid fa-lock"></i> ${tr('tournament.show_locked')}</button>`;
        } else {
            emptyStateHTML += `<h2 class="text-xl font-semibold mt-4">${tr('tournament.no_tournaments')}</h2><p class="text-muted mt-1">${tr('tournament.create_first')}</p>`;
        }

        emptyStateHTML += `<button data-action="show-new-tournament-modal" class="btn btn-primary mt-4 flex items-center gap-2"><i class="fa-solid fa-plus"></i> ${tr('nav.new_tournament')}</button></div>`;
        container.innerHTML = emptyStateHTML;
    } else {
        container.innerHTML = visibleTournaments.sort((a,b) => b.id - a.id).map(t => {
            const completedCount = t.matches.filter(m => m.completed).length; 
            const totalMatches = t.matches.length;
            const isFinished = totalMatches > 0 && completedCount === totalMatches;
            let winnerInfo = '';
            if (isFinished) { 
                const stats = calculateStats(t); 
                const firstPlace = stats.length > 0 && stats[0].wins > 0
                    ? stats.filter(s => isTied(s, stats[0]))
                    : [];
                winnerInfo = firstPlace.length > 0
                    ? firstPlace.map(s => `<p class="font-bold text-yellow-500"><i class="fa-solid fa-trophy"></i> ${s.player.name}</p>`).join('')
                    : `<p class="font-bold text-yellow-500">${tr('tournament.draw')}</p>`;
            }
            const status = getTournamentStatus(t);
            const nameClass = t.isLocked ? 'text-muted' : '';

            let buttonText = tr('tournament.view_results');
            let buttonClass = "btn-secondary";

            if (status.text === tr('tournament.status_ready')) {
                buttonText = tr('tournament.start');
                buttonClass = "btn-primary";
            } else if (status.text === tr('tournament.status_in_progress')) {
                buttonText = tr('tournament.continue');
                buttonClass = "bg-blue-500 hover:bg-blue-600 text-white";
            } else if (status.text === tr('tournament.status_finished')) {
                buttonText = tr('tournament.view_results');
                buttonClass = "bg-yellow-400 hover:bg-yellow-500 text-black";
            }

            const typeIcon = getTournamentTypeIcon(t);
            const typeColor = getTournamentTypeColor(t);
            const typeLabel = getTournamentTypeLabel(t);
            const statusIcon = isFinished
                ? `<button data-action="open-tournament-stats" data-id="${t.id}" class="text-xl ${status.color}" title="${status.text}"><i class="fa-solid ${status.icon}"></i></button>`
                : `<i class="fa-solid ${status.icon} ${status.color}" title="${status.text}"></i>`;
            return `<div class="card p-4 rounded-xl shadow-sm space-y-3 ${isDoubleTournament(t) ? 'border-l-4 border-blue-500' : 'border-l-4 border-green-500'}" data-test-id="tournament-card-${t.id}"><div class="flex justify-between items-start"><div><h2 class="text-xl font-bold ${nameClass}">${t.name}</h2><p class="text-sm text-muted"><span class="${typeColor} font-semibold"><i class="fa-solid ${typeIcon}"></i> ${typeLabel}</span> &bull; ${t.playerIds.length} ${getCzechPlayerDeclension(t.playerIds.length)} &bull; ${tr('tournament.matches_progress', { completed: completedCount, total: totalMatches })} &bull; ${tr('tournament.created')}: ${formatDate(t.createdAt)}</p>${winnerInfo}</div><div class="flex items-center gap-3 text-xl text-muted">${statusIcon}<button data-action="toggle-lock-main" data-id="${t.id}" data-test-id="toggle-lock-${t.id}" class="text-xl" title="${t.isLocked ? 'Odemknout turnaj' : 'Zamknout turnaj'}">${t.isLocked ? '🔒' : '🔓'}</button></div></div>${!t.isLocked ? `<button data-action="open-tournament" data-id="${t.id}" data-test-id="open-tournament-${t.id}" class="btn ${buttonClass} w-full">${buttonText}</button>`: ''}</div>`;
        }).join('');
    }
    showScreen('main');
}

export function renderTournamentScreen() {
    const t = getTournament(); 
    if (!t) { 
        renderMainScreen(); 
        return; 
    }
    document.getElementById('tournament-title').innerHTML = `<div class="flex items-center gap-2"><span id="tournament-name-text">${t.name}</span><button data-action="quick-edit-name" class="btn btn-secondary !p-0 w-8 h-8 text-xs flex-shrink-0" title="${tr('tournament.quick_edit_name')}"><i class="fa-solid fa-pencil"></i></button></div>`;
    document.getElementById('tournament-progress').textContent = tr('tournament.matches_progress', { completed: t.matches.filter(m => m.completed).length, total: t.matches.length });

    const renderMatch = (m, isCompleted, index) => {
        const sides = getDisplaySides(t, m);
        if (!sides.left.playerIds.length || !sides.right.playerIds.length) return '';
        const isSuspended = !isCompleted && m.firstServer !== null;
        const servingIndicator = ' <span class="text-base">🏓</span>';
        const servingPlayerId = m.servingPlayer;
        const serveBadge = (side) => (isSuspended && servingPlayerId && side.playerIds.includes(servingPlayerId)) ? servingIndicator : '';
        const makeBadge = (side, alignRight = false, highlight = false) => `
            <div class="flex ${alignRight ? 'justify-end text-right' : 'justify-start'} items-center gap-1 sm:gap-2 flex-1 min-w-0 ${highlight ? 'font-extrabold' : ''}">
                ${alignRight ? '' : `<div class="w-5 h-5 sm:w-6 sm:h-6 ${side.colorClass} rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">${side.label.charAt(0).toUpperCase()}</div>`}
                <div class="flex flex-col ${alignRight ? 'items-end' : 'items-start'} min-w-0 flex-1">
                    <span class="text-sm sm:text-base break-words">${side.label}${serveBadge(side)}</span>
                    ${isDoubleTournament(t) ? `<span class="text-xs text-muted break-words">${side.playerIds.map(id => getGlobalPlayer(id)?.name || '???').join(' • ')}</span>` : ''}
                </div>
                ${alignRight ? `<div class="w-5 h-5 sm:w-6 sm:h-6 ${side.colorClass} rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">${side.label.charAt(0).toUpperCase()}</div>` : ''}
            </div>
        `;
        const upcomingMatches = t.matches.filter(x => !x.completed);
        if (isCompleted) {
            const winnerSide = m.score1 === m.score2 ? null : (m.score1 > m.score2 ? 1 : 2);
            const scoreDisplay = m.sidesSwapped ? `${m.score2} : ${m.score1}` : `${m.score1} : ${m.score2}`;
            const leftHighlight = (m.sidesSwapped ? winnerSide === 2 : winnerSide === 1);
            const rightHighlight = (m.sidesSwapped ? winnerSide === 1 : winnerSide === 2);
            return `<div class="card p-2 sm:p-3 rounded-xl shadow-sm flex items-center justify-between mt-2 gap-1 sm:gap-2">
                <div class="flex items-center gap-1 sm:gap-2 flex-grow min-w-0">
                    ${makeBadge(sides.left, false, leftHighlight)}
                    <div class="font-bold text-sm sm:text-lg flex-shrink-0">${scoreDisplay}</div>
                    ${makeBadge(sides.right, true, rightHighlight)}
                </div>
                <button data-action="edit-match" data-id="${m.id}" class="btn bg-yellow-400 hover:bg-yellow-500 text-white aspect-square !p-0 w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0" title="${tr('match.edit_result_title')}" ${t.isLocked ? 'disabled' : ''}>
                    <i class="fa-solid fa-pencil text-xs sm:text-base"></i>
                </button>
            </div>`;
        }

        const scoreOrVs = isSuspended
            ? `<div class="font-bold text-lg">${m.sidesSwapped ? m.score2 : m.score1} : ${m.sidesSwapped ? m.score1 : m.score2}</div>`
            : `<div class="text-muted">vs</div>`;

        return `<div class="card p-2 sm:p-3 rounded-xl shadow-sm flex items-center justify-between mt-2 gap-1 sm:gap-2">
            <div class="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                <button data-action="move-match" data-id="${m.id}" data-dir="up" class="btn btn-secondary !p-0 w-5 h-5 sm:w-6 sm:h-6 text-xs" ${index === 0 ? 'disabled' : ''} title="${tr('match.move_up')}">▲</button>
                <button data-action="move-match" data-id="${m.id}" data-dir="down" class="btn btn-secondary !p-0 w-5 h-5 sm:w-6 sm:h-6 text-xs" ${index === upcomingMatches.length - 1 ? 'disabled' : ''} title="${tr('match.move_down')}">▼</button>
            </div>
            <button data-action="swap-sides" data-id="${m.id}" data-test-id="swap-sides-${m.id}" class="btn btn-secondary !p-0 w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 text-xs sm:text-sm" title="${tr('match.swap_sides')}"><i class="fa-solid fa-right-left"></i></button>
            <div class="flex items-center gap-1 sm:gap-2 flex-grow min-w-0">
                ${makeBadge(sides.left, false, false)}
                <div class="flex-shrink-0 text-sm sm:text-lg">${scoreOrVs}</div>
                ${makeBadge(sides.right, true, false)}
            </div>
            <button data-action="play-match" data-id="${m.id}" data-test-id="play-match-${m.id}" class="btn btn-primary aspect-square !p-0 w-8 h-8 sm:w-10 sm:h-10 text-base sm:text-lg flex-shrink-0" title="${isSuspended ? tr('match.continue_match') : tr('match.play_match')}" ${t.isLocked ? 'disabled' : ''}>
                ${isSuspended ? '<i class="fa-solid fa-clock-rotate-left"></i>' : '<i class="fa-solid fa-play"></i>'}
            </button>
        </div>`;
    };

    const upcomingContainer = document.getElementById('upcoming-matches-container');
    const completedContainer = document.getElementById('completed-matches-container');
    const finalResultsContainer = document.getElementById('final-results-container');

    const completedCount = t.matches.filter(m => m.completed).length;
    const totalMatches = t.matches.length;
    const isFinished = totalMatches > 0 && completedCount === totalMatches;

    upcomingContainer.innerHTML = ''; 
    completedContainer.innerHTML = ''; 
    finalResultsContainer.innerHTML = '';

    if(isFinished) {
        const stats = calculateStats(t);
        const firstPlace = stats.length > 0 && stats[0].wins > 0
            ? stats.filter(s => isTied(s, stats[0]))
            : [];
        const rest = stats.slice(firstPlace.length);
        const trophyByPlace = { 1: '🏆', 2: '🥈', 3: '🥉' };
        const firstPlaceHtml = firstPlace.length > 0
            ? `<p class="text-muted">${firstPlace.length > 1 ? tr('tournament.winners_are') : tr('tournament.winner_is')}</p>${firstPlace.map(s => `<p class="text-3xl font-bold my-2">🏆 ${s.player.name}</p>`).join('')}`
            : '';
        const restHtml = rest.length > 0
            ? `<ol class="space-y-3 mt-4 text-left inline-block">${rest.map((s, i) => {
                const idx = firstPlace.length + i;
                const pos = getDisplayPos(stats, idx);
                const label = (s.wins > 0 && trophyByPlace[pos]) ? trophyByPlace[pos] : `#${pos}`;
                return `<li class="flex items-center text-lg"><span class="font-bold w-10 text-center">${label}</span><span>${s.player.name}</span></li>`;
            }).join('')}</ol>`
            : '';
        finalResultsContainer.innerHTML = `<div class="card p-6 rounded-xl shadow-sm text-center"><h2 class="text-2xl font-bold mb-2">${tr('tournament.finished')}</h2>${firstPlaceHtml}${restHtml}</div>`;
    } else {
        const upcoming = t.matches.filter(m => !m.completed);
        upcomingContainer.innerHTML = upcoming.length > 0 ? `<h2 class="text-xl font-bold">${tr('match.upcoming')}</h2>${upcoming.map((m,i) => renderMatch(m, false, i)).join('')}` : (t.matches.length > 0 ? '' : `<div class="text-center p-4 card rounded-xl text-muted">${tr('match.no_matches')}</div>`);
    }

    const completed = t.matches.filter(m => m.completed);
    completedContainer.innerHTML = completed.length > 0 ? `<h2 class="text-xl font-bold">${tr('match.completed')}</h2>${completed.map(m => renderMatch(m, true, -1)).join('')}` : '';
    showScreen('tournament');
}

export const templates = {
    leaderboardTable: (stats, t) => {
        const isFirstPlace = (s, i) => s.wins > 0 && getDisplayPos(stats, i) === 1;
        return `<div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="border-b"><th class="p-2">${tr('stats.col_pos')}</th><th class="p-2">${tr('stats.col_player')}</th><th class="p-2 text-center" title="${tr('stats.col_played')}">${tr('stats.col_played')}</th><th class="p-2 text-center" title="${tr('stats.col_wins')}">${tr('stats.col_wins')}</th><th class="p-2 text-center" title="${tr('stats.col_losses')}">${tr('stats.col_losses')}</th><th class="p-2 text-center" title="${tr('stats.col_diff')}">${tr('stats.col_diff')}</th><th class="p-2 text-center">${tr('stats.col_score')}</th><th class="p-2 text-center">${tr('stats.col_success')}</th></tr></thead><tbody>${stats.map((s, i) => { const r = s.wins - s.losses; const rStr = (r >= 0 ? '+' : '') + r; const diff = s.scoreFor - s.scoreAgainst; const diffStr = (diff >= 0 ? '+' : '') + diff; return `<tr class="border-b last:border-none"><td class="p-2 font-bold">${isFirstPlace(s, i) ? '🏆' : `#${getDisplayPos(stats, i)}`}</td><td class="p-2 flex items-center gap-2"><div class="w-4 h-4 rounded-full ${playerColors[t.playerIds.indexOf(s.player.id) % playerColors.length]}"></div> ${s.player.name}</td><td class="p-2 text-center">${s.played}</td><td class="p-2 text-center font-bold text-green-600">${s.wins}</td><td class="p-2 text-center text-red-500">${s.losses}</td><td class="p-2 text-center font-semibold ${r >= 0 ? 'text-green-600' : 'text-red-500'}">${rStr}</td><td class="p-2 text-center">${s.scoreFor}:${s.scoreAgainst} <span class="text-muted text-xs">(${diffStr})</span></td><td class="p-2 text-center font-semibold">${s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0}%</td></tr>`; }).join('')}</tbody></table></div>`;
    },
    teamLeaderboard: (stats) => {
        if (!stats.length) return '';
        const isFirst = (s, i) => s.wins > 0 && getDisplayPos(stats, i) === 1;
        return `<div class="mt-4"><h3 class="text-lg font-semibold mb-2">${tr('stats.teams_title')}</h3><div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="border-b"><th class="p-2">${tr('stats.col_pos')}</th><th class="p-2">${tr('stats.teams_title')}</th><th class="p-2 text-center">${tr('stats.col_wins')}</th><th class="p-2 text-center">${tr('stats.col_losses')}</th><th class="p-2 text-center">${tr('stats.col_played')}</th><th class="p-2 text-center">${tr('stats.col_score')}</th></tr></thead><tbody>${stats.map((s, i) => `<tr class="border-b last:border-none"><td class="p-2 font-bold">${isFirst(s, i) ? '🥇' : `#${getDisplayPos(stats, i)}`}</td><td class="p-2">${s.label}</td><td class="p-2 text-center text-green-600 font-semibold">${s.wins}</td><td class="p-2 text-center text-red-500">${s.losses}</td><td class="p-2 text-center">${s.played}</td><td class="p-2 text-center">${s.scoreFor}:${s.scoreAgainst}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
};

export function renderStatsScreen() {
    const t = getTournament();
    document.getElementById('stats-tournament-name').textContent = t.name;
    const stats = calculateStats(t);
    document.getElementById('stats-leaderboard').innerHTML = templates.leaderboardTable(stats, t);

    // Team leaderboard pro čtyřhru
    const teamStats = calculateTeamStats(t);
    const teamLeaderboardEl = document.getElementById('stats-team-leaderboard');
    if (teamLeaderboardEl) {
        if (teamStats.length > 0) {
            teamLeaderboardEl.innerHTML = templates.teamLeaderboard(teamStats);
            teamLeaderboardEl.classList.remove('hidden');
        } else {
            teamLeaderboardEl.innerHTML = '';
            teamLeaderboardEl.classList.add('hidden');
        }
    }

    // Matrix vzájemných zápasů
    const matrixContainer = document.getElementById('stats-matrix');
    const players = stats.map(s => s.player);
    let matrixHTML = `<table class="w-full text-center border-collapse"><thead><tr class="surface-alt"><th class="border p-2"></th>${players.map(p => `<th class="border p-2"><div class="flex items-center justify-center gap-1"><div class="w-3 h-3 rounded-full ${playerColors[t.playerIds.indexOf(p.id) % playerColors.length]}"></div> ${p.name}</div></th>`).join('')}</tr></thead><tbody>`;
    players.forEach(p1 => {
        matrixHTML += `<tr><td class="border p-2 font-bold surface-alt"><div class="flex items-center gap-1"><div class="w-3 h-3 rounded-full ${playerColors[t.playerIds.indexOf(p1.id) % playerColors.length]}"></div> ${p1.name}</div></td>`;
        players.forEach(p2 => {
            if (p1.id === p2.id) {
                matrixHTML += `<td class="border p-2 bg-gray-200 dark:bg-gray-700"></td>`;
            } else {
                const match = t.matches.find(m => {
                    if (!m.completed) return false;
                    const side1Players = getSidePlayerIds(t, m, 1);
                    const side2Players = getSidePlayerIds(t, m, 2);
                    return (side1Players.includes(p1.id) && side2Players.includes(p2.id)) ||
                           (side1Players.includes(p2.id) && side2Players.includes(p1.id));
                });
                if (match) {
                    const side1Players = getSidePlayerIds(t, match, 1);
                    const p1Score = side1Players.includes(p1.id) ? match.score1 : match.score2;
                    const p2Score = side1Players.includes(p1.id) ? match.score2 : match.score1;
                    matrixHTML += `<td class="border p-2 font-bold ${p1Score > p2Score ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}">${p1Score}:${p2Score}</td>`;
                } else {
                    matrixHTML += `<td class="border p-2 text-muted">?</td>`;
                }
            }
        });
        matrixHTML += `</tr>`;
    });
    matrixHTML += `</tbody></table>`;
    matrixContainer.innerHTML = matrixHTML;
    showScreen('stats');
}

export function renderOverallStatsScreen() {
    const stats = calculateOverallStats();
    const teamStats = calculateOverallTeamStats();
    const container = document.getElementById('overall-stats-container');
    let html = `<p class="text-xs text-muted mb-2">${tr('stats.ranking_note')}</p><table class="w-full text-left">
        <thead class="text-xs uppercase surface-alt">
            <tr>
                <th class="px-2 py-3">${tr('stats.col_player')}</th><th class="px-2 py-3 text-center" title="${tr('stats.col_tournaments')}">${tr('stats.col_tournaments')}</th><th class="px-2 py-3 text-center" title="${tr('stats.col_played')}">${tr('stats.col_played')}</th><th class="px-2 py-3 text-center" title="${tr('stats.col_wins')}">${tr('stats.col_wins')}</th><th class="px-2 py-3 text-center" title="${tr('stats.col_losses')}">${tr('stats.col_losses')}</th><th class="px-2 py-3 text-center" title="${tr('stats.col_diff')}">${tr('stats.col_diff')}</th><th class="px-2 py-3 text-center" title="${tr('stats.col_score')}">${tr('stats.col_score')}</th><th class="px-2 py-3 text-center">🏆</th><th class="px-2 py-3 text-center">🥈</th><th class="px-2 py-3 text-center">🥉</th>
            </tr>
        </thead>
        <tbody>${stats.map(s => { const r = s.wins - s.losses; const rStr = (r >= 0 ? '+' : '') + r; const diff = s.scoreFor - s.scoreAgainst; const diffStr = (diff >= 0 ? '+' : '') + diff; return `<tr class="card border-b"><td class="px-2 py-4 font-semibold">${s.player.name}</td><td class="px-2 py-4 text-center">${s.tournaments}</td><td class="px-2 py-4 text-center">${s.matches}</td><td class="px-2 py-4 text-center text-green-600">${s.wins}</td><td class="px-2 py-4 text-center text-red-600">${s.losses}</td><td class="px-2 py-4 text-center font-semibold ${r >= 0 ? 'text-green-600' : 'text-red-600'}">${rStr}</td><td class="px-2 py-4 text-center">${s.scoreFor}:${s.scoreAgainst} <span class="text-muted text-xs">(${diffStr})</span></td><td class="px-2 py-4 text-center">${s.places[1]}</td><td class="px-2 py-4 text-center">${s.places[2]}</td><td class="px-2 py-4 text-center">${s.places[3]}</td></tr>`; }).join('')}</tbody>
    </table>`;
    if (teamStats.length) {
        html += `<div class="mt-6">
            <h2 class="text-lg font-semibold mb-2">${tr('stats.teams_all')}</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs uppercase surface-alt">
                        <tr>
                            <th class="px-2 py-3">${tr('stats.teams_title')}</th><th class="px-2 py-3 text-center">${tr('stats.col_tournaments')}</th><th class="px-2 py-3 text-center">${tr('stats.col_played')}</th><th class="px-2 py-3 text-center">${tr('stats.col_wins')}</th><th class="px-2 py-3 text-center">${tr('stats.col_losses')}</th><th class="px-2 py-3 text-center">${tr('stats.col_score')}</th>
                        </tr>
                    </thead>
                    <tbody>${teamStats.map(s => `<tr class="card border-b"><td class="px-2 py-3 font-semibold">${s.label}</td><td class="px-2 py-3 text-center">${s.tournaments}</td><td class="px-2 py-3 text-center">${s.matches}</td><td class="px-2 py-3 text-center text-green-600">${s.wins}</td><td class="px-2 py-3 text-center text-red-500">${s.losses}</td><td class="px-2 py-3 text-center">${s.scoreFor}:${s.scoreAgainst}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>`;
    }
    container.innerHTML = html;
    showScreen('overallStats');
}

export function renderStartMatchModal(match) {
    const t = getTournament();
    const sides = getDisplaySides(t, match);
    const isDouble = isDoubleTournament(t);

    let modalContent = '';
    if (isDouble) {
        // Pro čtyřhru - výběr týmu
        modalContent = `
            <div class="modal-backdrop">
                <div class="modal-content space-y-6 text-center">
                    <h1 class="text-2xl font-bold">${sides.left.label} vs ${sides.right.label}</h1>
                    <p class="text-muted">${tr('game.playing_to', { points: t.pointsToWin })}</p>
                    ${state.settings.voiceInputEnabled ? `<p class="text-sm text-green-600 animate-pulse"><i class="fa-solid fa-microphone"></i> ${tr('game.voice_say_name')}</p>` : ''}
                    <div>
                        <h2 class="text-lg font-semibold mb-3">${tr('game.first_serve')}</h2>
                        <div class="grid grid-cols-2 gap-4">
                            <button data-action="set-first-server" data-team-side="1" data-test-id="set-first-server-team-1" class="p-4 rounded-lg font-bold text-white ${sides.left.colorClass}">
                                ${sides.left.label}
                            </button>
                            <button data-action="set-first-server" data-team-side="2" data-test-id="set-first-server-team-2" class="p-4 rounded-lg font-bold text-white ${sides.right.colorClass}">
                                ${sides.right.label}
                            </button>
                </div>
                </div>
                    <button data-action="back-to-tournament" data-test-id="back-to-tournament-from-first-server" class="btn btn-secondary w-full mt-4">${tr('common.back')}</button>
                </div>
                </div>
        `;
    } else {
        // Pro dvouhru - výběr hráče
        const p1Id = sides.left.playerIds[0];
        const p2Id = sides.right.playerIds[0];
        const p1 = getGlobalPlayer(p1Id);
        const p2 = getGlobalPlayer(p2Id);
        const p1Color = playerColors[t.playerIds.indexOf(p1Id) % playerColors.length];
        const p2Color = playerColors[t.playerIds.indexOf(p2Id) % playerColors.length];

        modalContent = `
            <div class="modal-backdrop">
                <div class="modal-content space-y-6 text-center">
                    <h1 class="text-2xl font-bold">${p1.name} vs ${p2.name}</h1>
                    <p class="text-muted">${tr('game.playing_to', { points: t.pointsToWin })}</p>
                    ${state.settings.voiceInputEnabled ? `<p class="text-sm text-green-600 animate-pulse"><i class="fa-solid fa-microphone"></i> ${tr('game.voice_say_name')}</p>` : ''}
                    <div>
                        <h2 class="text-lg font-semibold mb-3">${tr('game.first_serve')}</h2>
                        <div class="grid grid-cols-2 gap-4">
                            <button data-action="set-first-server" data-player-id="${p1Id}" data-test-id="set-first-server-player-${p1Id}" class="p-4 rounded-lg font-bold text-white ${p1Color}">
                                ${p1.name}
                            </button>
                            <button data-action="set-first-server" data-player-id="${p2Id}" data-test-id="set-first-server-player-${p2Id}" class="p-4 rounded-lg font-bold text-white ${p2Color}">
                                ${p2.name}
                            </button>
            </div>
                    </div>
                    <button data-action="back-to-tournament" data-test-id="back-to-tournament-from-first-server-single" class="btn btn-secondary w-full mt-4">${tr('common.back')}</button>
                </div>
            </div>
        `;
    }

    openModal(modalContent);
}

export function renderGameBoard() {
    const t = getTournament();
    const m = getMatch(t, state.activeMatchId);
    if (!m) {
        console.error("Match not found!", state.activeMatchId);
        renderTournamentScreen();
        return;
    }
    const sides = getDisplaySides(t, m);
    const rawSidePlayers = {
        1: getSidePlayerIds(t, m, 1),
        2: getSidePlayerIds(t, m, 2)
    };
    const leftRawSide = m.sidesSwapped ? 2 : 1;
    const rightRawSide = m.sidesSwapped ? 1 : 2;
    const leftScore = m.sidesSwapped ? m.score2 : m.score1;
    const rightScore = m.sidesSwapped ? m.score1 : m.score2;
    const winnerSide = checkWinCondition(m, t.pointsToWin);
    const canAddPoints = !winnerSide;
    const servingRawSide = rawSidePlayers[1].includes(m.servingPlayer) ? 1 : (rawSidePlayers[2].includes(m.servingPlayer) ? 2 : null);
    const servingLabel = m.servingPlayer
        ? (isDoubleTournament(t)
            ? (getGlobalPlayer(m.servingPlayer)?.name || '...')
            : (getGlobalPlayer(m.servingPlayer)?.name || '...'))
        : '...';

    const makeScoreBox = (sideDescriptor, currentScore, rawSide) => {
        const playerNames = sideDescriptor.playerIds.map(id => getGlobalPlayer(id)?.name || '???').filter(Boolean);
        const playerIdsStr = sideDescriptor.playerIds.join(',');
        const playerNamesStr = playerNames.length > 0 ? playerNames.join(',') : 'unknown';
        const testId = `score-box-${rawSide}-${playerIdsStr}`;
        const dataAttrs = canAddPoints 
            ? `data-action="add-point" data-side="${rawSide}" data-player-ids="${playerIdsStr}" data-player-names="${playerNamesStr}" data-test-id="${testId}"`
            : `data-test-id="${testId}"`;
        return `
        <div ${dataAttrs} class="player-score-box ${sideDescriptor.colorClass} p-2 md:p-4 text-white relative flex flex-col items-center justify-center flex-1 w-1/2 h-full ${canAddPoints ? 'active-pointer cursor-pointer' : ''}">
            ${sideDescriptor.playerIds.includes(m.servingPlayer) ? `<div class="absolute top-2 left-2 md:top-4 md:left-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-yellow-400/90 text-xl md:text-2xl flex items-center justify-center">🏓</div>` : ''}
            <button data-action="subtract-point" data-side="${rawSide}" data-test-id="subtract-point-${rawSide}" class="absolute top-2 right-2 md:top-4 md:right-4 w-10 h-10 md:w-12 md:h-12 bg-black/20 rounded-full text-xl md:text-2xl">-1</button>
            <div class="text-xl md:text-2xl lg:text-3xl font-bold text-center">${sideDescriptor.label}</div>
            ${isDoubleTournament(t) ? `<div class="text-xs md:text-sm opacity-90">${playerNames.join(' • ')}</div>` : ''}
            <div class="text-7xl md:text-8xl lg:text-9xl font-extrabold my-2 md:my-4">${currentScore}</div>
            <div class="text-xs md:text-sm opacity-80">${canAddPoints ? tr('game.tap_for_point') : '&nbsp;'}</div>
        </div>
    `;
    };

    renderGameScreen(`
        <div class="h-screen flex flex-col w-full">
            <header class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-2 md:p-3 shadow-sm text-center flex justify-between items-center w-full z-10 flex-shrink-0">
                <button data-action="back-to-tournament" data-test-id="back-to-tournament" class="btn btn-secondary !p-1 md:!p-2 text-sm md:text-base w-20 md:w-24">${tr('game.suspend')}</button>
                <div class="flex-grow px-2">
                    <p class="text-xs md:text-sm text-muted">${tr('game.playing_to', { points: t.pointsToWin })}</p>
                    <p class="text-sm md:text-base font-semibold">${tr('game.serve_label')}: ${servingLabel}</p>
                </div>
                <div class="w-28 md:w-40 flex justify-end gap-1 md:gap-2">
                    <button data-action="toggle-voice-input-ingame" class="btn btn-secondary !p-0 h-8 w-8 md:h-10 md:w-10 text-base md:text-lg ${state.settings.voiceInputEnabled ? 'text-red-600' : 'text-muted'}" title="${tr('game.voice_input_title')}">${state.settings.voiceInputEnabled ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>'}</button>
                    <button data-action="toggle-voice-assist-ingame" class="btn btn-secondary !p-0 h-8 w-8 md:h-10 md:w-10 text-base md:text-lg" title="${tr('game.voice_assist_title')}">${state.settings.voiceAssistEnabled ? '<i class="fa-solid fa-comment-dots"></i>' : '<i class="fa-solid fa-comment-slash"></i>'}</button>
                    <button data-action="toggle-motivational-phrases-ingame" class="btn btn-secondary !p-0 h-8 w-8 md:h-10 md:w-10 text-base md:text-lg" title="${tr('game.motivational_title')}">${state.settings.motivationalPhrasesEnabled ? '<i class="fa-solid fa-comments"></i>' : '<i class="fa-solid fa-comment-slash"></i>'}</button>
                    <button data-action="toggle-sound-ingame" class="btn btn-secondary !p-0 h-8 w-8 md:h-10 md:w-10 text-base md:text-lg" title="${tr('game.sounds_title')}">${state.settings.soundsEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>'}</button>
                </div>
            </header>
            <div class="flex-1 flex flex-row w-full min-h-0">
                ${makeScoreBox(sides.left, leftScore, leftRawSide)}
                ${makeScoreBox(sides.right, rightScore, rightRawSide)}
            </div>
            ${winnerSide ? `<div class="absolute inset-0 flex items-center justify-center z-20 bg-black/30"><div class="card p-6 rounded-xl shadow-lg text-center space-y-3 mx-4 w-full max-w-sm"><div class="text-3xl">🏆</div><h2 class="text-2xl font-bold">${tr('game.winner', { name: formatPlayersLabel(winnerSide === 1 ? getSidePlayerIds(t, m, 1) : getSidePlayerIds(t, m, 2)) })}</h2><p class="text-muted">${tr('game.result', { score1: m.score1, score2: m.score2 })}</p><div class="flex gap-2"><button data-action="undo-last-point" class="btn btn-secondary flex-1" ${state.scoreHistory.length === 0 ? 'disabled' : ''}>${tr('game.undo')}</button><button data-action="save-match-result" class="btn btn-primary flex-1">${tr('game.save_result')}</button></div></div></div>` : ''}
        </div>`
    );

    // Hláška o vítězi se ozve jen v updateScore při zápisu posledního bodu – zde by duplikovala
    // a při voiceAssistEnabled by druhé volání zrušilo první (synth.cancel) a způsobilo přerušení.
}

function escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

export function exportToCSV() {
    const t = getTournament();
    const stats = calculateStats(t);
    const players = t.playerIds.map(getGlobalPlayer).filter(Boolean);

    let csv = `${tr('export.tournament_label')}: ${t.name}\n`;
    csv += `${tr('export.created_label')}: ${t.createdAt ? formatDate(t.createdAt) : tr('export.unknown_date')}\n`;
    csv += `${tr('export.points_to_win')}: ${t.pointsToWin}\n`;
    csv += `\n--- ${tr('export.leaderboard').toUpperCase()} ---\n`;
    csv += `${tr('export.col_position')},${tr('export.col_name')},${tr('export.col_victories')},${tr('export.col_defeats')},${tr('export.col_played')},${tr('export.col_success_rate')} (%)\n`;
    stats.forEach((s, i) => {
        csv += `${i + 1},${escapeCsv(s.player.name)},${s.wins},${s.losses},${s.played},${s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0}\n`;
    });

    csv += `\n--- ${tr('export.h2h_matches').toUpperCase()} ---\n`;
    csv += `${tr('stats.col_player')},${players.map(p => escapeCsv(p.name)).join(',')}\n`;
    players.forEach(p1 => {
        const row = [escapeCsv(p1.name)];
        players.forEach(p2 => {
            if (p1.id === p2.id) {
                row.push('-');
            } else {
                const match = t.matches.find(m => {
                    const result = getMatchResultForPlayers(t, m, p1.id, p2.id);
                    return result && m.completed;
                });
                if (match) {
                    const result = getMatchResultForPlayers(t, match, p1.id, p2.id);
                    row.push(`${result.aScore}:${result.bScore}`);
                } else {
                    row.push('?');
                }
            }
        });
        csv += row.join(',') + '\n';
    });

    csv += `\n--- ${tr('export.match_list').toUpperCase()} ---\n`;
    csv += `${tr('export.col_player1')},${tr('export.col_player2')},${tr('export.col_score1')},${tr('export.col_score2')},${tr('export.col_completed')}\n`;
    t.matches.forEach(m => {
        const team1Label = formatPlayersLabel(getSidePlayerIds(t, m, 1));
        const team2Label = formatPlayersLabel(getSidePlayerIds(t, m, 2));
        csv += `${escapeCsv(team1Label)},${escapeCsv(team2Label)},${m.score1},${m.score2},${m.completed ? tr('export.yes') : tr('export.no')}\n`;
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `turnaj_${t.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const t = getTournament();
    const stats = calculateStats(t);
    const players = t.playerIds.map(getGlobalPlayer).filter(Boolean);

    // Vytvoříme HTML element pro renderování
    const pdfContent = document.createElement('div');
    pdfContent.style.width = '210mm';
    pdfContent.style.padding = '20mm';
    pdfContent.style.fontFamily = 'Inter, sans-serif';
    pdfContent.style.backgroundColor = 'white';
    pdfContent.style.color = 'black';
    pdfContent.style.position = 'absolute';
    pdfContent.style.top = '-9999px';
    pdfContent.style.left = '0';

    let html = `
        <h1 class="pdf-title">${t.name}</h1>
        <p class="pdf-meta">${tr('export.created_label')}: ${t.createdAt ? formatDate(t.createdAt) : tr('export.unknown_date')}</p>
        <p class="pdf-meta-last">${tr('export.points_to_win')}: ${t.pointsToWin}</p>

        <h2 class="pdf-section-title">${tr('export.leaderboard')}</h2>
        <table class="pdf-table">
            <thead>
                <tr class="pdf-table-header">
                    <th>${tr('export.col_position')}</th>
                    <th>${tr('export.col_name')}</th>
                    <th class="pdf-table-cell-center">${tr('export.col_victories')}</th>
                    <th class="pdf-table-cell-center">${tr('export.col_defeats')}</th>
                    <th class="pdf-table-cell-center">${tr('export.col_played')}</th>
                    <th class="pdf-table-cell-center">${tr('export.col_success_rate')}</th>
                </tr>
            </thead>
            <tbody>
    `;

    stats.forEach((s, i) => {
        html += `
            <tr class="pdf-table-row">
                <td class="pdf-table-cell">${i + 1}</td>
                <td class="pdf-table-cell" style="font-weight: ${i === 0 && s.wins > 0 ? 'bold' : 'normal'}">${s.player.name}</td>
                <td class="pdf-wins">${s.wins}</td>
                <td class="pdf-losses">${s.losses}</td>
                <td class="pdf-table-cell-center">${s.played}</td>
                <td class="pdf-success-rate">${s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0}%</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>

        <h2 class="pdf-section-title">${tr('export.h2h_matches')}</h2>
        <table class="pdf-table-small">
            <thead>
                <tr class="pdf-matrix-header">
                    <th></th>
    `;

    players.forEach(p => {
        html += `<th>${p.name}</th>`;
    });

    html += `
                </tr>
            </thead>
            <tbody>
    `;

    players.forEach(p1 => {
        html += `<tr><td class="pdf-matrix-row-label">${p1.name}</td>`;
        players.forEach(p2 => {
            if (p1.id === p2.id) {
                html += `<td class="pdf-matrix-cell-empty">-</td>`;
            } else {
                const match = t.matches.find(m => m.completed && ((m.player1Id === p1.id && m.player2Id === p2.id) || (m.player1Id === p2.id && m.player2Id === p1.id)));
                if (match) {
                    const p1Score = match.player1Id === p1.id ? match.score1 : match.score2;
                    const p2Score = match.player1Id === p1.id ? match.score2 : match.score1;
                    const bgColor = p1Score > p2Score ? '#dcfce7' : '#fee2e2';
                    const textColor = p1Score > p2Score ? '#166534' : '#991b1b';
                    html += `<td class="pdf-matrix-cell" style="background-color: ${bgColor}; color: ${textColor}; font-weight: bold;">${p1Score}:${p2Score}</td>`;
                } else {
                    html += `<td class="pdf-matrix-cell-unknown">?</td>`;
                }
            }
        });
        html += `</tr>`;
    });

    html += `
            </tbody>
        </table>
    `;

    pdfContent.innerHTML = html;
    document.body.appendChild(pdfContent);

    // Použijeme html2canvas přímo a pak přidáme obrázek do PDF
    setTimeout(() => {
        html2canvas(pdfContent, {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            backgroundColor: '#ffffff',
            width: pdfContent.scrollWidth,
            height: pdfContent.scrollHeight
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            let position = 0;

            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            doc.save(`turnaj_${t.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.removeChild(pdfContent);
        }).catch(async error => {
            console.error('❌ [PDF] Chyba při generování PDF:', error);
            document.body.removeChild(pdfContent);
            await showAlertModal(tr('export.pdf_error', { msg: error.message }), 'Chyba');
        });
    }, 500);
}
