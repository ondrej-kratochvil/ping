// Akce aplikace (allActions) – přesunuto z index.html

import { state } from './state.js';
import { voiceInput } from './voice-input.js';
import { TOURNAMENT_TYPES, playerColors, encouragingPhrases, winningPhrases } from './constants.js';
import { apiCall, loadState } from './api.js';
import { openModal, closeModal, showAlertModal, showConfirmModal, showToast, renderGameScreen } from './ui.js';
import { 
    getGlobalPlayer, getTournament, getMatch, formatDate, cloneState, isDoubleTournament,
    getPlayerColor, getTeamById, getTeamPlayerIds, getSidePlayerIds, formatPlayersLabel,
    buildSideDescriptor, getDisplaySides, getTournamentTypeLabel, getTournamentTypeIcon,
    getTournamentTypeColor, getPlayerLimitForType, getMinPlayersForType, getTeamKey,
    getMatchResultForPlayers, getCzechPlayerDeclension
} from './utils.js';
import { generateUniqueTournamentName } from './utils/tournament-utils.js';
import { initializeAudio, playSound, speak } from './audio.js';
import { checkWinCondition, initializeDoubleRotationState, advanceDoubleServeState, reverseDoubleServeState, recalculateServiceState } from './game-logic.js';
import { setupAutocomplete } from './autocomplete.js';
import { calculateStats, calculateTeamStats, calculateOverallStats, calculateOverallTeamStats } from './stats.js';
import { 
    renderPlayerDbScreen, renderMainScreen, renderTournamentScreen,
    renderStatsScreen, renderOverallStatsScreen, renderGameBoard, renderStartMatchModal,
    templates
} from './render.js';
import { navigateTo, back, isModalRoute, parseRoute, getPath } from './router.js';

// Dočasný stav pro modaly (nový turnaj / nastavení turnaje)
export let tempPlayerIds = [];
export let tempTournamentType = TOURNAMENT_TYPES.SINGLE;

// undoLastPoint a updateScore – přesunuto z index.html (beze změn logiky)
export const undoLastPoint = async () => {
    const t = getTournament();
    const m = getMatch(t, state.activeMatchId);
    if (!t || !m || state.scoreHistory.length === 0) return;

    // Získáme poslední stav z historie
    const lastState = state.scoreHistory.pop();

    // Ověříme, že historie patří k aktuálnímu zápasu
    if (lastState.matchId !== m.id) {
        state.scoreHistory.push(lastState); // Vrátíme zpět, pokud to není správný zápas
        return;
    }

    // Obnovíme stav
    m.score1 = lastState.score1;
    m.score2 = lastState.score2;
    m.servingPlayer = lastState.servingPlayer;
    m.firstServer = lastState.firstServer;
    m.doubleRotationState = cloneState(lastState.doubleRotationState);

    // Znovu vypočítáme stav podání
    if (m.firstServer) {
        recalculateServiceState(m, t);
    }

    // Aktualizujeme v databázi
    const matchPayload = { ...m, tournament_id: t.id, match_order: t.matches.findIndex(match => match.id == m.id) };
    await apiCall('updateMatch', { id: m.id, data: matchPayload });

    // Znovu vykreslíme obrazovku
    renderGameBoard();
};

export const updateScore = async (playerId, delta, sideOverride = null) => {
    const t = getTournament();
    const m = getMatch(t, state.activeMatchId);
    if (!t || !m) return;

    const sidePlayers = {
        1: getSidePlayerIds(t, m, 1),
        2: getSidePlayerIds(t, m, 2)
    };
    const scoringSide = sideOverride ?? (playerId !== null
        ? (sidePlayers[1].includes(playerId) ? 1 : (sidePlayers[2].includes(playerId) ? 2 : null))
        : null);
    if (scoringSide === null) return;
    const scoreProp = scoringSide === 1 ? 'score1' : 'score2';

    if (delta > 0 && checkWinCondition(m, t.pointsToWin)) return;

    const currentScore = m[scoreProp];
    if (currentScore + delta >= 0) {
        let prevTimestamp = null;
        let now = Date.now();
        if (delta > 0) {
            prevTimestamp = state.lastPointTimestamp;
            state.lastPointTimestamp = now;
            state.scoreHistory.push({
                matchId: m.id,
                score1: m.score1,
                score2: m.score2,
                servingPlayer: m.servingPlayer,
                firstServer: m.firstServer,
                doubleRotationState: cloneState(m.doubleRotationState)
            });
        }
        m[scoreProp] += delta;

        if (isDoubleTournament(t)) {
            if (!m.doubleRotationState) {
                // Při prvním bodu inicializujeme doubleRotationState
                initializeDoubleRotationState(t, m, m.firstServer || 1);
                // Po prvním bodu: pointsServedThisTurn = 0 (první bod prvního bloku byl právě odehrán)
                // servingPlayer už je nastaven v initializeDoubleRotationState
            } else {
                if (delta > 0) {
                    advanceDoubleServeState(m, t);
                } else if (delta < 0) {
                    reverseDoubleServeState(m, t);
                }
            }
            // Vždy přepočítáme stav podání podle aktuálního skóre
            recalculateServiceState(m, t);
        } else {
            recalculateServiceState(m, t);
        }
        playSound(scoringSide);

        const shouldReportScore = state.settings.voiceAssistEnabled || state.settings.voiceInputEnabled;

        if (shouldReportScore) {
            const side1Players = getSidePlayerIds(t, m, 1);
            const side2Players = getSidePlayerIds(t, m, 2);
            const servingSide = side1Players.includes(m.servingPlayer) ? 1 : (side2Players.includes(m.servingPlayer) ? 2 : null);
            const servingLabel = m.servingPlayer ? (getGlobalPlayer(m.servingPlayer)?.name || '') : '';  // Zobrazujeme jméno konkrétního hráče, ne tým
            const servingPlayerScore = servingSide === 1 ? m.score1 : m.score2;
            const otherPlayerScore = servingSide === 1 ? m.score2 : m.score1;

            if (m.completed) { // This state je nastaveno po checkWinCondition
                const winnerSide = checkWinCondition(m, t.pointsToWin);
                if (winnerSide) {
                    const winnerLabel = formatPlayersLabel(winnerSide === 1 ? side1Players : side2Players);
                    const winnerScore = Math.max(m.score1, m.score2);
                    const loserScore = Math.min(m.score1, m.score2);
                    const randomPhrase = winningPhrases[Math.floor(Math.random() * winningPhrases.length)];
                    speak(`Konec zápasu. Vítěz je ${winnerLabel} s výsledkem ${winnerScore} : ${loserScore}. ${randomPhrase}`, true);
                }
            } else if (servingLabel) {
                let speechText = `${servingLabel}, ${servingPlayerScore} : ${otherPlayerScore}`;
                // Motivační hlášky jen při přidání bodu (delta > 0)
                if (delta > 0 && state.settings.motivationalPhrasesEnabled) {
                    let selectedPhrase = '';
                    const maxScore = Math.max(servingPlayerScore, otherPlayerScore);
                    const pointsToWin = t.pointsToWin;
                    const pointsNeeded = pointsToWin - maxScore;
                    const intervalMs = prevTimestamp ? (now - prevTimestamp) : 99999;
                    const intervalSec = intervalMs / 1000;

                    // "Ještě jeden" jen když zbývá poslední bod
                    if (pointsNeeded === 1) {
                        selectedPhrase = encouragingPhrases.nearEnd[Math.floor(Math.random() * encouragingPhrases.nearEnd.length)];
                    } else if (intervalSec < 3 && prevTimestamp) {
                        // Body rychle po sobě
                        selectedPhrase = encouragingPhrases.speedPhrases[Math.floor(Math.random() * encouragingPhrases.speedPhrases.length)];
                    } else if (intervalSec > 15) {
                        // Body dlouho po sobě (dlouhá výměna)
                        selectedPhrase = encouragingPhrases.longRallyPhrases[Math.floor(Math.random() * encouragingPhrases.longRallyPhrases.length)];
                    } else {
                        selectedPhrase = encouragingPhrases.general[Math.floor(Math.random() * encouragingPhrases.general.length)];
                    }

                    if (selectedPhrase) {
                        speechText += `, ${selectedPhrase}`;
                    }
                }
                speak(speechText, state.settings.voiceInputEnabled);
            }
        }

        const matchPayload = { ...m, tournament_id: t.id, match_order: t.matches.findIndex(match => match.id == m.id) };
        await apiCall('updateMatch', { id: m.id, data: matchPayload });

        renderGameBoard();
    }
};

export const allActions = {
    'show-player-db': () => navigateTo({ name: 'players' }),
    'show-edit-player-modal': (target) => {
        const id = target.dataset.id;
        if (id === 'new') {
            navigateTo({ name: 'player-new' });
            return;
        }
        navigateTo({ name: 'player-edit', playerId: parseInt(id) });
    },
    'open-edit-player-modal': (playerId) => {
        const p = playerId ? getGlobalPlayer(playerId) : { name: '', nickname: '', photoUrl: '', strengths: '', weaknesses: '' };
        openModal(`
            <div id="edit-player-modal" class="modal-backdrop">
                <div class="modal-content space-y-4">
                    <div class="flex justify-between items-center">
                        <h2 class="text-xl font-bold">${playerId?'Upravit hráče':'Nový hráč'}</h2>
                        <button data-action="close-modal" class="text-gray-400 text-2xl hover:text-gray-700">&times;</button>
                    </div>
                    <div class="text-center">
                        <img src="${p.photoUrl||`data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2280%22%20height%3D%2280%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20fill%3D%22%23e5e7eb%22%20rx%3D%2240%22%2F%3E${p.name?`%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%22%20font-size%3D%2232%22%20fill%3D%22%239ca3af%22%3E${p.name.charAt(0).toUpperCase()}%3C%2Ftext%3E`:''}%3C%2Fsvg%3E`}" class="w-20 h-20 rounded-full object-cover bg-gray-200 inline-block">
                    </div>
                    <div>
                        <label for="player-name" class="text-sm font-medium">Jméno</label>
                        <input id="player-name" value="${p.name}" class="w-full mt-1 p-2 border rounded-md">
                    </div>
                    <div>
                        <label for="player-nickname" class="text-sm font-medium">Přezdívka (pro hlasové ovládání)</label>
                        <input id="player-nickname" value="${p.nickname||''}" placeholder="Např. Marťas" class="w-full mt-1 p-2 border rounded-md">
                        <p class="text-xs text-gray-500 mt-1">Použije se pro hlasové povely. Pokud je prázdná, použije se jméno.</p>
                    </div>
                    <div>
                        <label for="player-photo" class="text-sm font-medium">URL fotografie</label>
                        <input id="player-photo" value="${p.photoUrl||''}" placeholder="https://..." class="w-full mt-1 p-2 border rounded-md">
                    </div>
                    <div>
                        <label for="player-strengths" class="text-sm font-medium">Silné stránky</label>
                        <textarea id="player-strengths" class="w-full mt-1 p-2 border rounded-md h-20">${p.strengths||''}</textarea>
                    </div>
                    <div>
                        <label for="player-weaknesses" class="text-sm font-medium">Slabé stránky</label>
                        <textarea id="player-weaknesses" class="w-full mt-1 p-2 border rounded-md h-20">${p.weaknesses||''}</textarea>
                    </div>
                    <div class="flex gap-2">
                        <button data-action="close-modal" class="btn btn-secondary w-full">Zrušit</button>
                        <button data-action="save-player" data-id="${playerId||''}" class="btn btn-primary w-full">Uložit</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('edit-player-modal').addEventListener('keydown', (e)=>{ if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); document.querySelector('[data-action="save-player"]').click(); } });
        document.getElementById('player-name').focus();
    },
    'save-player': async (target) => {
        const playerId = target.dataset.id ? parseInt(target.dataset.id) : null;
        const name = document.getElementById('player-name').value.trim();
        if (!name) { await showAlertModal('Jméno je povinné.', 'Chyba'); return; }
        const payload = {
            id: playerId,
            data: {
                name,
                nickname: document.getElementById('player-nickname').value.trim(),
                photoUrl: document.getElementById('player-photo').value.trim(),
                strengths: document.getElementById('player-strengths').value.trim(),
                weaknesses: document.getElementById('player-weaknesses').value.trim(),
            }
        };
        await apiCall('savePlayer', payload);
        closeModal();
        navigateTo({ name: 'players' });
    },
    'delete-player': async (target) => {
        const playerId = parseInt(target.dataset.id);
        const isPlayerInTournament = state.tournaments.some(t => t.playerIds.includes(playerId));
        if (isPlayerInTournament) { await showAlertModal('Hráče nelze smazat, protože je součástí jednoho nebo více turnajů.', 'Chyba'); return; }
        if (await showConfirmModal('Opravdu chcete smazat tohoto hráče z databáze?', 'Smazat hráče')) {
            await apiCall('deletePlayer', { id: playerId });
            navigateTo({ name: 'players' });
        }
    },
    'show-new-tournament-modal': () => navigateTo({ name: 'tournament-new' }),
    '_show-new-tournament-modal-inner': () => { tempPlayerIds=[];tempTournamentType=TOURNAMENT_TYPES.SINGLE;const defaultName = `Turnaj ${new Date().toLocaleDateString('cs-CZ')}`; const renderAddedPlayers=()=>{const list=document.getElementById('new-players-list');if(list){list.innerHTML=tempPlayerIds.map((id,index)=>{const player=getGlobalPlayer(id);return`<div class="flex items-center gap-2 bg-gray-100 p-2 rounded-md"><div class="w-5 h-5 rounded-full ${playerColors[index%playerColors.length]}"></div><span class="flex-grow">${player.name}</span><button data-action="remove-temp-player" data-id="${id}" data-test-id="remove-player-${id}" class="text-red-500 font-bold">&times;</button></div>`}).join('')||`<div class="text-sm text-gray-500 text-center p-2">Zatím žádní hráči</div>`;}const countLabel=document.getElementById('player-count-text');if(countLabel){countLabel.textContent=`Hráči (${tempPlayerIds.length}/${getPlayerLimitForType(tempTournamentType)})`;const note=document.getElementById('player-count-note');if(note){note.textContent=tempTournamentType===TOURNAMENT_TYPES.DOUBLE&&tempPlayerIds.length%2!==0?'Čtyřhra vyžaduje sudý počet hráčů.':'';}}};const renderTypeToggle=()=>{document.querySelectorAll('[data-tournament-type]').forEach(btn=>{const isActive=btn.dataset.tournamentType===tempTournamentType;btn.classList.toggle('bg-blue-500',isActive);btn.classList.toggle('text-white',isActive);btn.classList.toggle('border-blue-500',isActive);btn.classList.toggle('bg-gray-100',!isActive);btn.classList.toggle('text-gray-700',!isActive);});const hint=document.getElementById('tournament-type-hint');if(hint){hint.textContent=tempTournamentType===TOURNAMENT_TYPES.DOUBLE?'Čtyřhra vyžaduje 4–16 hráčů a sudý počet (týmy po dvou).':'Dvouhra vyžaduje 2–8 hráčů.';}};openModal(`<div id="new-tournament-modal" class="modal-backdrop" data-test-id="new-tournament-modal"><div class="modal-content space-y-4"><div class="flex justify-between items-center"><h2 class="text-xl font-bold">Nový turnaj</h2><button data-action="close-modal" data-test-id="close-new-tournament-modal" class="text-gray-400 text-2xl hover:text-gray-700">&times;</button></div><div><label for="new-tournament-name" class="text-sm font-medium">Název turnaje</label><input id="new-tournament-name" data-test-id="tournament-name-input" type="text" value="${defaultName}" class="w-full mt-1 p-2 border rounded-md"></div><div><span class="text-sm font-medium">Typ zápasu</span><div class="flex gap-2 mt-1"><button type="button" data-tournament-type="single" data-test-id="tournament-type-single" class="flex-1 p-3 border rounded-md text-center">Dvouhra</button><button type="button" data-tournament-type="double" data-test-id="tournament-type-double" class="flex-1 p-3 border rounded-md text-center">Čtyřhra</button></div><p class="text-xs text-gray-500 mt-1" id="tournament-type-hint"></p></div><div><label for="add-player-input" id="player-count-text" class="text-sm font-medium">Hráči (0/${getPlayerLimitForType(tempTournamentType)})</label><div id="new-players-list" class="space-y-2 my-2">${tempPlayerIds.length>0?'':'<div class="text-sm text-gray-500 text-center p-2">Zatím žádní hráči</div>'}</div><p id="player-count-note" class="text-xs text-red-500"></p><div class="relative"><input id="add-player-input" data-test-id="add-player-input" type="text" placeholder="Klikněte pro výběr hráče..." class="w-full p-2 border rounded-md"><div id="autocomplete-container"></div></div></div><div><span class="text-sm font-medium">Typ setu</span><div class="flex gap-2 mt-1"> <label class="flex-1 p-3 border rounded-md cursor-pointer has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 text-center"><input type="radio" name="points-to-win" value="11" data-test-id="points-to-win-11" class="sr-only" checked><span>Malý set (11)</span></label> <label class="flex-1 p-3 border rounded-md cursor-pointer has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 text-center"><input type="radio" name="points-to-win" value="21" data-test-id="points-to-win-21" class="sr-only"><span>Velký set (21)</span></label></div></div><button data-action="create-tournament" data-test-id="create-tournament-button" class="btn btn-primary w-full">Vytvořit turnaj</button></div></div>`);let showSuggestionsFn=null;showSuggestionsFn=setupAutocomplete('add-player-input','autocomplete-container',async (id)=>{const maxPlayers=getPlayerLimitForType(tempTournamentType);if(tempPlayerIds.length<maxPlayers&&!tempPlayerIds.includes(id)){tempPlayerIds.push(id);renderAddedPlayers();}else if(tempPlayerIds.includes(id)){await showAlertModal('Hráč je již v seznamu.', 'Upozornění');}else{await showAlertModal(`Maximální počet hráčů pro tento formát je ${maxPlayers}.`, 'Upozornění');}},tempPlayerIds,{getMinPlayers:()=>getMinPlayersForType(tempTournamentType),getCurrentIds:()=>tempPlayerIds,onPlayerAdded:()=>renderAddedPlayers()});document.querySelectorAll('[data-tournament-type]').forEach(btn=>{btn.addEventListener('click',async ()=>{const selectedType=btn.dataset.tournamentType;const maxPlayers=getPlayerLimitForType(selectedType);if(tempPlayerIds.length>maxPlayers){await showAlertModal(`Pro tento formát je povoleno maximálně ${maxPlayers} hráčů. Nejprve hráče odeberte.`, 'Upozornění');return;}tempTournamentType=selectedType;const newMinPlayers=getMinPlayersForType(tempTournamentType);renderTypeToggle();renderAddedPlayers();if(tempPlayerIds.length<newMinPlayers&&showSuggestionsFn){setTimeout(()=>showSuggestionsFn(),100);}});});renderTypeToggle();renderAddedPlayers();document.getElementById('new-tournament-modal').addEventListener('keydown', (e)=>{ if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); document.querySelector('[data-action="create-tournament"]').click(); } });},
    'remove-temp-player':(target)=>{const idToRemove=parseInt(target.dataset.id);tempPlayerIds=tempPlayerIds.filter(id=>id!==idToRemove);const list=document.getElementById('new-players-list');if(list){list.innerHTML=tempPlayerIds.map((id,index)=>{const player=getGlobalPlayer(id);return`<div class="flex items-center gap-2 bg-gray-100 p-2 rounded-md"><div class="w-5 h-5 rounded-full ${playerColors[index%playerColors.length]}"></div><span class="flex-grow">${player.name}</span><button data-action="remove-temp-player" data-id="${id}" class="text-red-500 font-bold">&times;</button></div>`}).join('')||`<div class="text-sm text-gray-500 text-center p-2">Zatím žádní hráči</div>`;const countLabel=document.getElementById('player-count-text');if(countLabel){countLabel.textContent=`Hráči (${tempPlayerIds.length}/${getPlayerLimitForType(tempTournamentType)})`;const note=document.getElementById('player-count-note');if(note){note.textContent=tempTournamentType===TOURNAMENT_TYPES.DOUBLE&&tempPlayerIds.length%2!==0?'Čtyřhra vyžaduje sudý počet hráčů.':'';}}}},
    'create-tournament': async () => {
        const name = document.getElementById('new-tournament-name').value.trim();
        const minPlayers = getMinPlayersForType(tempTournamentType);
        const maxPlayers = getPlayerLimitForType(tempTournamentType);
        if (!name) {
            await showAlertModal('Zadejte název turnaje.', 'Chyba');
            return;
        }
        if (tempPlayerIds.length < minPlayers) {
            await showAlertModal(`Pro tento formát je potřeba alespoň ${minPlayers} hráčů.`, 'Chyba');
            return;
        }
        if (tempTournamentType === TOURNAMENT_TYPES.DOUBLE && tempPlayerIds.length % 2 !== 0) {
            await showAlertModal('Čtyřhra vyžaduje sudý počet hráčů.', 'Chyba');
            return;
        }
        if (tempPlayerIds.length > maxPlayers) {
            await showAlertModal(`Maximální počet hráčů je ${maxPlayers}.`, 'Chyba');
            return;
        }
        const existingNames = state.tournaments.map(t => t.name);
        const uniqueName = generateUniqueTournamentName(name, existingNames);
        const now = new Date();
        const mysqlDate = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');
        const payload = {
            name: uniqueName,
            pointsToWin: parseInt(document.querySelector('input[name="points-to-win"]:checked').value),
            createdAt: mysqlDate,
            playerIds: tempPlayerIds,
            type: tempTournamentType
        };
        await apiCall('createTournament', payload);
        closeModal();
        navigateTo({ name: 'main' });
        showToast('Turnaj byl úspěšně vytvořen', 'success');
    },
    'show-settings-modal': () => navigateTo({ name: 'tournament-settings', tournamentId: getTournament()?.id }),
    '_show-settings-modal-inner': () => { const t = getTournament();const maxPlayersForTournament=getPlayerLimitForType(t.type||TOURNAMENT_TYPES.SINGLE);const matchIncludesPlayer=(match,playerId)=>{return getSidePlayerIds(t,match,1).includes(playerId)||getSidePlayerIds(t,match,2).includes(playerId);};tempPlayerIds=[...t.playerIds];const renderAddedPlayers=()=>{const list=document.getElementById('settings-players-list');if(list){list.innerHTML=tempPlayerIds.map((id,index)=>{const player=getGlobalPlayer(id);const hasActivity=t.matches.some(m=>(m.completed||m.score1>0||m.score2>0)&&matchIncludesPlayer(m,id));return`<div class="flex items-center gap-2 bg-gray-100 p-2 rounded-md"><div class="w-6 h-6 ${playerColors[index%playerColors.length]} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">${player.name.charAt(0).toUpperCase()}</div><span class="flex-grow">${player.name}</span><button data-action="remove-player-settings" data-id="${id}" class="text-red-500 font-bold text-xl disabled:opacity-25" ${hasActivity?'disabled title="Hráč již má odehraný nebo rozehraný zápas"':''}>&times;</button></div>`}).join('')||`<div class="text-sm text-gray-500 text-center p-2">Žádní hráči</div>`;document.getElementById('settings-player-count').textContent=`Hráči (${tempPlayerIds.length}/${maxPlayersForTournament})`;}};openModal(`<div id="settings-modal" class="modal-backdrop"><div class="modal-content space-y-4"><div class="flex justify-between items-center"><h2 class="text-xl font-bold">Nastavení turnaje</h2><button data-action="close-modal" class="text-gray-400 text-2xl hover:text-gray-700">&times;</button></div><p class="text-sm text-gray-500">Formát: ${getTournamentTypeLabel(t)}</p><div><label for="edit-tournament-name" class="text-sm font-medium">Název turnaje</label><input id="edit-tournament-name" value="${t.name}" class="w-full mt-1 p-2 border rounded-md" ${t.isLocked?'disabled':''}></div><div><label for="add-player-input-settings" id="settings-player-count" class="text-sm font-medium">Hráči</label><div id="settings-players-list" class="space-y-2 my-2"></div><div class="relative"${t.isLocked?'hidden':''}><input id="add-player-input-settings" type="text" placeholder="Klikněte pro přidání hráče..." class="w-full p-2 border rounded-md"><div id="autocomplete-container-settings"></div></div></div><button data-action="save-settings" class="btn btn-primary w-full">Uložit změny</button><div class="border-t pt-4 mt-4 space-y-2"><span class="text-sm font-medium text-gray-500">Servisní akce</span><div class="flex gap-2 flex-wrap"><button data-action="copy-tournament" class="btn btn-secondary w-full text-sm"><i class="fa-solid fa-copy"></i> Kopírovat turnaj</button><button data-action="toggle-lock-settings" class="btn btn-secondary w-full text-sm">${t.isLocked?'🔓 Odemknout':'🔒 Zamknout'}</button><button data-action="delete-tournament-settings" class="btn btn-danger w-full text-sm">Smazat turnaj</button></div></div></div></div>`);renderAddedPlayers();setupAutocomplete('add-player-input-settings','autocomplete-container-settings',(id)=>{if(tempPlayerIds.length<maxPlayersForTournament&&!tempPlayerIds.includes(id)){tempPlayerIds.push(id);renderAddedPlayers();}},tempPlayerIds,{minPlayers:0,getCurrentIds:()=>tempPlayerIds});document.getElementById('settings-modal').addEventListener('keydown',(e)=>{if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();document.querySelector('[data-action="save-settings"]').click();}});},
    'remove-player-settings':(target)=>{const idToRemove=parseInt(target.dataset.id);tempPlayerIds=tempPlayerIds.filter(id=>id!==idToRemove);const t=getTournament();const maxPlayersForTournament=getPlayerLimitForType(t.type||TOURNAMENT_TYPES.SINGLE);const matchIncludesPlayer=(match,playerId)=>{return getSidePlayerIds(t,match,1).includes(playerId)||getSidePlayerIds(t,match,2).includes(playerId);};const renderAddedPlayers=()=>{const list=document.getElementById('settings-players-list');if(list){list.innerHTML=tempPlayerIds.map((id,index)=>{const player=getGlobalPlayer(id);const hasActivity=t.matches.some(m=>(m.completed||m.score1>0||m.score2>0)&&matchIncludesPlayer(m,id));return`<div class="flex items-center gap-2 bg-gray-100 p-2 rounded-md"><div class="w-6 h-6 ${playerColors[index%playerColors.length]} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">${player.name.charAt(0).toUpperCase()}</div><span class="flex-grow">${player.name}</span><button data-action="remove-player-settings" data-id="${id}" class="text-red-500 font-bold text-xl disabled:opacity-25" ${hasActivity?'disabled title="Hráč již má odehraný nebo rozehraný zápas"':''}>&times;</button></div>`}).join('')||`<div class="text-sm text-gray-500 text-center p-2">Žádní hráči</div>`;document.getElementById('settings-player-count').textContent=`Hráči (${tempPlayerIds.length}/${maxPlayersForTournament})`;}};renderAddedPlayers();},
    'save-settings': async () => {
        const t = getTournament();
        if (t.isLocked) { closeModal(); return; }
        const originalPlayerIds = [...t.playerIds];
        t.name = document.getElementById('edit-tournament-name').value.trim() || t.name;
        t.playerIds = tempPlayerIds;
        const minPlayers = getMinPlayersForType(t.type || TOURNAMENT_TYPES.SINGLE);
        const maxPlayers = getPlayerLimitForType(t.type || TOURNAMENT_TYPES.SINGLE);
        if (t.playerIds.length < minPlayers) {
            await showAlertModal(`Minimální počet hráčů pro tento formát je ${minPlayers}.`, 'Chyba');
            return;
        }
        if (isDoubleTournament(t) && t.playerIds.length % 2 !== 0) {
            await showAlertModal('Čtyřhra vyžaduje sudý počet hráčů.', 'Chyba');
            return;
        }
        if (t.playerIds.length > maxPlayers) {
            await showAlertModal(`Maximální počet hráčů je ${maxPlayers}.`, 'Chyba');
            return;
        }
        const playersChanged = originalPlayerIds.length !== t.playerIds.length || originalPlayerIds.some(id => !t.playerIds.includes(id));
        if (playersChanged) {
            t.matches = t.matches.filter(m => {
                const participants = [...getSidePlayerIds(t, m, 1), ...getSidePlayerIds(t, m, 2)];
                return participants.every(id => t.playerIds.includes(id));
            });
        }
        const payload = { id: t.id, data: t };
        await apiCall('updateTournament', payload);
        closeModal();
        navigateTo({ name: 'tournament', tournamentId: t.id });
        showToast('Nastavení turnaje bylo uloženo', 'success');
    },
    'toggle-lock-settings': (target) => {
        const t = getTournament();
        if (t) {
            t.isLocked = !t.isLocked;
            allActions['_show-settings-modal-inner']();
            apiCall('toggleTournamentLock', { id: t.id });
        }
    },
    'copy-tournament': async () => {
        const t = getTournament();
        if (!t) {
            console.error('❌ [COPY] Turnaj nenalezen!');
            return;
        }
        const tournamentId = t.id;
        await loadState();
        const currentTournament = getTournament(tournamentId);
        if (!currentTournament) {
            console.error('❌ [COPY] Turnaj nenalezen po načtení stavu!');
            return;
        }
        const now = new Date();
        const todayStr = `${now.getDate()}. ${now.getMonth() + 1}. ${now.getFullYear()}`;
        const hasTodayDate = currentTournament.name.includes(todayStr);
        let baseName;
        if (hasTodayDate) {
            baseName = currentTournament.name;
        } else {
            baseName = currentTournament.name.replace(/\d+\.\s*\d+\.\s*\d{4}/, '').trim();
            baseName = baseName.replace(/\s+[IVX]+\.?\s*$/, '').trim();
            baseName = `${baseName} ${todayStr}`;
        }
        let cleanBaseNameForCopy = baseName.replace(/\s*\(\d+\)\s*$/, '').trim();
        const existingNames = state.tournaments.map(t => ({ id: t.id, name: t.name }));
        const newName = generateUniqueTournamentName(cleanBaseNameForCopy, existingNames, currentTournament.id);
        const mysqlDate = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');
        let newPlayerIds = [...currentTournament.playerIds];
        if (isDoubleTournament(currentTournament) && newPlayerIds.length >= 4) {
            const teamSize = newPlayerIds.length / 2;
            const team1Players = newPlayerIds.slice(0, teamSize);
            const team2Players = newPlayerIds.slice(teamSize);
            const reversedTeam1Players = [...team1Players].reverse();
            const reversedTeam2Players = [...team2Players].reverse();
            newPlayerIds = [...reversedTeam1Players, ...reversedTeam2Players];
        }
        const payload = {
            name: newName,
            pointsToWin: currentTournament.pointsToWin,
            createdAt: mysqlDate,
            playerIds: newPlayerIds,
            type: currentTournament.type || TOURNAMENT_TYPES.SINGLE
        };
        let newTournament = null;
        try {
            const apiResponse = await apiCall('createTournament', payload);
            if (apiResponse && apiResponse.tournaments) {
                newTournament = apiResponse.tournaments.find(tour => tour.name === newName);
                if (!newTournament && apiResponse.tournaments.length > 0) {
                    const sortedTournaments = [...apiResponse.tournaments].sort((a, b) => parseInt(b.id) - parseInt(a.id));
                    const newestTournament = sortedTournaments[0];
                    if (newestTournament.id != currentTournament.id) {
                        newTournament = newestTournament;
                    }
                }
            }
            if (!newTournament) {
                newTournament = state.tournaments.find(tour => tour.name === newName);
                if (!newTournament && state.tournaments.length > 0) {
                    const sortedTournaments = [...state.tournaments].sort((a, b) => parseInt(b.id) - parseInt(a.id));
                    const newestTournament = sortedTournaments[0];
                    if (newestTournament.id != currentTournament.id) {
                        newTournament = newestTournament;
                    }
                }
            }
            if (!newTournament) {
                await loadState();
                newTournament = state.tournaments.find(tour => tour.name === newName);
                if (!newTournament && state.tournaments.length > 0) {
                    const sortedTournaments = [...state.tournaments].sort((a, b) => parseInt(b.id) - parseInt(a.id));
                    const newestTournament = sortedTournaments[0];
                    if (newestTournament.id != currentTournament.id) {
                        newTournament = newestTournament;
                    }
                }
            }
        } catch (error) {
            console.error('❌ [COPY] Chyba při vytváření turnaje:', error);
            await showAlertModal('Chyba při vytváření kopie turnaje: ' + error.message, 'Chyba');
            return;
        }
        if (newTournament) {
            await loadState();
            const refreshedTournament = getTournament(newTournament.id);
            if (!refreshedTournament) {
                console.error('❌ [COPY] Nový turnaj nebyl nalezen po načtení stavu!');
                await showAlertModal('Turnaj byl vytvořen, ale nepodařilo se ho najít. Obnovte stránku.', 'Upozornění');
                return;
            }
            for (let matchOrder = 0; matchOrder < refreshedTournament.matches.length; matchOrder++) {
                const match = refreshedTournament.matches[matchOrder];
                const matchEntityId = match.id || match.entity_id;
                const matchPayload = {
                    tournament_id: parseInt(refreshedTournament.id),
                    player1Id: match.player1Id || match.player1_id,
                    player2Id: match.player2Id || match.player2_id,
                    team1Id: match.team1Id || match.team1_id || null,
                    team2Id: match.team2Id || match.team2_id || null,
                    score1: match.score1 || 0,
                    score2: match.score2 || 0,
                    completed: match.completed || 0,
                    firstServer: match.firstServer || match.first_server || null,
                    servingPlayer: match.servingPlayer || match.serving_player || null,
                    match_order: matchOrder,
                    sidesSwapped: true,
                    doubleRotationState: match.doubleRotationState || match.double_rotation_state || null
                };
                try {
                    await apiCall('updateMatch', { id: matchEntityId, data: matchPayload });
                } catch (err) {
                    console.error('❌ [COPY] Chyba při úpravě zápasu:', matchEntityId, err);
                }
            }
            await loadState();
        } else {
            console.error('❌ [COPY] Nový turnaj nebyl nalezen po vytvoření!');
            await showAlertModal('Turnaj byl vytvořen, ale nepodařilo se ho najít. Obnovte stránku.', 'Upozornění');
        }
        closeModal();
        navigateTo({ name: 'main' });
    },
    'delete-tournament-settings': async () => { const t = getTournament(); if(await showConfirmModal(`Opravdu chcete trvale smazat turnaj "${t.name}"?`, 'Smazat turnaj')){ closeModal();
            await apiCall('deleteTournament', { id: t.id });
            navigateTo({ name: 'main' }); } },
    'toggle-lock-main': (target) => {
        const tournamentId = parseInt(target.dataset.id);
        const t = getTournament(tournamentId);
        if (t) {
            t.isLocked = !t.isLocked;
            navigateTo({ name: 'main' });
            apiCall('toggleTournamentLock', { id: tournamentId });
        }
    },
    'open-tournament': (target) => navigateTo({ name: 'tournament', tournamentId: parseInt(target.dataset.id) }),
    'show-locked-tournaments':()=>{
        state.settings.showLockedTournaments = true;
        apiCall('saveSettings', { key: 'showLockedTournaments', value: true });
        navigateTo({ name: 'main' });
    },
    'delete-tournament': async (target) => {
        if (await showConfirmModal('Opravdu smazat?', 'Smazat turnaj')) {
            const tournamentId = parseInt(target.dataset.id);
            await apiCall('deleteTournament', { id: tournamentId });
            navigateTo({ name: 'main' });
        }
    },
    'back-to-main': () => navigateTo({ name: 'main' }),
    'back-to-tournament':()=>{
        voiceInput.stop();
        closeModal();
        navigateTo({ name: 'tournament', tournamentId: state.activeTournamentId });
    },
    'show-stats': () => navigateTo({ name: 'tournament-stats', tournamentId: state.activeTournamentId }),
    'export-csv':()=>exportToCSV(),
    'export-pdf':()=>exportToPDF(),
    'show-overall-stats': () => navigateTo({ name: 'stats-overall' }),
    'play-match': (target) => {
        const matchId = parseInt(target.dataset.id, 10);
        navigateTo({ name: 'match', tournamentId: state.activeTournamentId, matchId });
    },
    'set-first-server': async (target) => {
        const t = getTournament();
        const m = getMatch(t, state.activeMatchId);
        if (!m || !t) {
            return;
        }
        const teamSide = target.dataset.teamSide ? parseInt(target.dataset.teamSide, 10) : null;
        let selectedPlayerId = null;
        if (teamSide && isDoubleTournament(t)) {
            m.firstServer = teamSide;
            initializeDoubleRotationState(t, m, teamSide);
        } else {
            selectedPlayerId = parseInt(target.dataset.playerId, 10);
            m.firstServer = (selectedPlayerId === m.player1Id) ? 1 : 2;
            m.servingPlayer = selectedPlayerId;
            m.doubleRotationState = null;
        }
        const matchOrder = t.matches.findIndex(match => match.id == m.id);
        const matchPayload = {
            tournament_id: t.id,
            player1Id: m.player1Id !== undefined ? m.player1Id : (m.player1_id !== undefined ? m.player1_id : null),
            player2Id: m.player2Id !== undefined ? m.player2Id : (m.player2_id !== undefined ? m.player2_id : null),
            team1Id: m.team1Id !== undefined ? m.team1Id : (m.team1_id !== undefined ? m.team1_id : null),
            team2Id: m.team2Id !== undefined ? m.team2Id : (m.team2_id !== undefined ? m.team2_id : null),
            score1: m.score1 !== undefined ? m.score1 : 0,
            score2: m.score2 !== undefined ? m.score2 : 0,
            completed: m.completed !== undefined ? m.completed : false,
            firstServer: m.firstServer !== undefined ? m.firstServer : (m.first_server !== undefined ? m.first_server : null),
            servingPlayer: m.servingPlayer !== undefined ? m.servingPlayer : (m.serving_player !== undefined ? m.serving_player : null),
            match_order: matchOrder >= 0 ? matchOrder : 0,
            sidesSwapped: m.sidesSwapped !== undefined ? m.sidesSwapped : (m.sides_swapped !== undefined ? m.sides_swapped : false),
            doubleRotationState: m.doubleRotationState !== undefined ? m.doubleRotationState : (m.double_rotation_state !== undefined ? m.double_rotation_state : null)
        };
        await apiCall('updateMatch', { id: m.id, data: matchPayload });
        if (state.settings.voiceAssistEnabled || state.settings.voiceInputEnabled) {
            let servingPlayerName = '';
            if (isDoubleTournament(t)) {
                if (m.doubleRotationState && m.doubleRotationState.order && m.doubleRotationState.order.length > 0) {
                    const firstServingPlayerId = m.doubleRotationState.order[0]?.playerId;
                    if (firstServingPlayerId) {
                        const firstPlayer = getGlobalPlayer(firstServingPlayerId);
                        servingPlayerName = firstPlayer ? firstPlayer.name : '';
                    }
                }
                if (!servingPlayerName) {
                    const servingTeamSide = m.firstServer;
                    const servingTeamPlayers = getSidePlayerIds(t, m, servingTeamSide);
                    if (servingTeamPlayers.length > 0) {
                        const firstPlayer = getGlobalPlayer(servingTeamPlayers[0]);
                        servingPlayerName = firstPlayer ? firstPlayer.name : '';
                    }
                }
            } else {
                if (selectedPlayerId) {
                    const selectedPlayer = getGlobalPlayer(selectedPlayerId);
                    servingPlayerName = selectedPlayer ? selectedPlayer.name : '';
                }
            }
            if (servingPlayerName) {
                speak(servingPlayerName, state.settings.voiceInputEnabled);
            }
        }
        closeModal();
        renderGameBoard();
        if (state.settings.voiceInputEnabled) {
            voiceInput.setContext('game');
            voiceInput.start();
        }
    },
    'add-point': (target) => {
        const playerId = target.dataset.playerId ? parseInt(target.dataset.playerId) : null;
        const side = target.dataset.side ? parseInt(target.dataset.side) : null;
        updateScore(playerId, 1, side);
    },
    'subtract-point': (target, evt) => {
        evt?.stopPropagation();
        const side = target.dataset.side ? parseInt(target.dataset.side) : null;
        updateScore(null, -1, side);
    },
    'undo-last-point': undoLastPoint,
    'suspend-match':()=>{
        voiceInput.stop();
        navigateTo({ name: 'tournament', tournamentId: state.activeTournamentId });
    },
    'save-match-result': async () => {
        voiceInput.stop();
        const t = getTournament();
        const m = getMatch(t, state.activeMatchId);
        m.completed = true;
        const matchPayload = { ...m, tournament_id: t.id, match_order: t.matches.findIndex(match => match.id == m.id) };
        await apiCall('updateMatch', { id: m.id, data: matchPayload });
        const completedCount = t.matches.filter(m => m.completed).length;
        if (completedCount === t.matches.length) {
            openModal(`<div class="modal-backdrop"><div class="modal-content modal-lg space-y-4"><h2 class="text-2xl font-bold text-center">🏆 Konečné výsledky 🏆</h2>${templates.leaderboardTable(calculateStats(t),t)}<div class="flex gap-2"><button data-action="close-and-home" class="btn btn-secondary flex-1">Zavřít</button><button data-action="copy-tournament" class="btn btn-primary flex-1">Kopírovat turnaj</button></div></div></div>`);
        } else {
            openModal(`<div id="post-match-modal" class="modal-backdrop"><div class="modal-content modal-lg space-y-4"><h2 class="text-xl font-bold text-center">Průběžné pořadí</h2>${templates.leaderboardTable(calculateStats(t),t)}<button data-action="close-and-refresh" class="btn btn-primary w-full">Pokračovat</button></div></div>`);
        }
    },
    'edit-match':(target)=>{const t=getTournament();const m=getMatch(t,target.dataset.id);const team1Label=formatPlayersLabel(getSidePlayerIds(t,m,1));const team2Label=formatPlayersLabel(getSidePlayerIds(t,m,2));openModal(`<div id="edit-match-modal" class="modal-backdrop"><div class="modal-content space-y-4"><h2 class="text-xl font-bold">Úprava výsledku</h2><div class="flex items-center justify-between gap-2"><span class="font-bold">${team1Label}</span><input id="edit-score1" data-test-id="edit-score1" type="number" value="${m.score1}" class="w-20 text-center text-xl p-2 border rounded"><span class="text-xl">:</span><input id="edit-score2" data-test-id="edit-score2" type="number" value="${m.score2}" class="w-20 text-center text-xl p-2 border rounded"><span class="font-bold">${team2Label}</span></div><div class="flex gap-2"><button data-action="close-modal" data-test-id="edit-match-cancel" class="btn btn-secondary w-full">Zrušit</button><button data-action="save-edited-match" data-test-id="edit-match-save" data-match-id="${m.id}" class="btn btn-primary w-full">Uložit</button></div></div></div>`);document.getElementById('edit-match-modal').addEventListener('keydown', (e)=>{ if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); document.querySelector('[data-action="save-edited-match"]').click(); } });},
    'save-edited-match': async (target) => {
        const t = getTournament();
        const matchId = target.dataset.matchId;
        const m = getMatch(t, matchId);
        if (!m) {
            console.error("Zápas pro editaci nenalezen:", matchId);
            await showAlertModal("Došlo k chybě, zápas nebyl nalezen.", 'Chyba');
            return;
        }
        m.score1 = parseInt(document.getElementById('edit-score1').value) || 0;
        m.score2 = parseInt(document.getElementById('edit-score2').value) || 0;
        const matchPayload = { ...m, tournament_id: t.id, match_order: t.matches.findIndex(match => match.id == m.id) };
        await apiCall('updateMatch', { id: m.id, data: matchPayload });
        closeModal();
        navigateTo({ name: 'tournament', tournamentId: t.id });
    },
    'close-and-refresh':()=>{closeModal();navigateTo({ name: 'tournament', tournamentId: state.activeTournamentId });},
    'close-and-home':()=>{
        voiceInput.stop();
        closeModal();
        navigateTo({ name: 'main' });
    },
    'export-data':async ()=>{if(state.tournaments.length===0&&state.playerDatabase.length===0){await showAlertModal("Není co exportovat.", 'Upozornění');return;}const dataStr=JSON.stringify(state,null,2);const dataBlob=new Blob([dataStr],{type:'application/json'});const url=URL.createObjectURL(dataBlob);const a=document.createElement('a');a.href=url;a.download='ping-pong-turnaje.json';a.click();URL.revokeObjectURL(url);},
    'close-modal': () => {
        const route = parseRoute(getPath());
        if (isModalRoute(route)) {
            back();
        } else {
            closeModal();
        }
    },
    'toggle-settings-menu': () => {
        const menu = document.getElementById('settings-menu');
        menu.classList.toggle('hidden');
        if(!menu.classList.contains('hidden')) {
            document.getElementById('sound-toggle').checked = state.settings.soundsEnabled;
            document.getElementById('voice-assist-toggle').checked = state.settings.voiceAssistEnabled;
            document.getElementById('show-locked-toggle').checked = state.settings.showLockedTournaments || false;
            document.getElementById('motivational-phrases-toggle').checked = !!state.settings.motivationalPhrasesEnabled;
        }
    },
    'toggle-voice-input-ingame': () => {
        state.settings.voiceInputEnabled = !state.settings.voiceInputEnabled;
        apiCall('saveSettings', { key: 'voiceInputEnabled', value: state.settings.voiceInputEnabled });
        if (state.settings.voiceInputEnabled) {
            voiceInput.setContext('game');
            voiceInput.start();
        } else {
            voiceInput.stop();
        }
        renderGameBoard();
    },
    'toggle-sound-ingame': () => {
        state.settings.soundsEnabled = !state.settings.soundsEnabled;
        apiCall('saveSettings', { key: 'soundsEnabled', value: state.settings.soundsEnabled });
        renderGameBoard();
    },
    'toggle-voice-assist-ingame': () => {
        state.settings.voiceAssistEnabled = !state.settings.voiceAssistEnabled;
        apiCall('saveSettings', { key: 'voiceAssistEnabled', value: state.settings.voiceAssistEnabled });
        if (state.settings.voiceAssistEnabled) {
            speak("Hlasový asistent zapnut.");
        } else {
            speak("Hlasový asistent vypnut.", true);
        }
        renderGameBoard();
    },
    'toggle-motivational-phrases-ingame': () => {
        state.settings.motivationalPhrasesEnabled = !state.settings.motivationalPhrasesEnabled;
        apiCall('saveSettings', { key: 'motivationalPhrasesEnabled', value: state.settings.motivationalPhrasesEnabled });
        renderGameBoard();
    },
    'quick-edit-name': (target) => { const textEl = document.getElementById('tournament-name-text'); const oldName = textEl.textContent; const input = document.createElement('input'); input.type = 'text'; input.value = oldName; input.className = 'text-3xl font-bold bg-white border rounded w-full'; textEl.parentElement.replaceChild(input, textEl); input.focus(); const save = async () => { const newName = input.value.trim(); const t = getTournament(); if(newName) { t.name = newName; } await apiCall('updateTournament', { id: t.id, data: t }); navigateTo({ name: 'tournament', tournamentId: t.id }); }; input.addEventListener('blur', save); input.addEventListener('keydown', (e) => { if(e.key === 'Enter') save(); if(e.key === 'Escape') { input.value = oldName; save(); } }); },
    'move-match': async (target) => {
        const t = getTournament();
        const { id, dir } = target.dataset;
        const upcoming = t.matches.filter(m => !m.completed);
        const index = upcoming.findIndex(m => m.id == id);
        if (index === -1) return;
        const otherIndex = dir === 'up' ? index - 1 : index + 1;
        if (otherIndex < 0 || otherIndex >= upcoming.length) return;
        const matchIdToMove = upcoming[index].id;
        const otherMatchId = upcoming[otherIndex].id;
        const originalIndex = t.matches.findIndex(m => m.id == matchIdToMove);
        const otherOriginalIndex = t.matches.findIndex(m => m.id == otherMatchId);
        [t.matches[originalIndex], t.matches[otherOriginalIndex]] = [t.matches[otherOriginalIndex], t.matches[originalIndex]];
        const upcomingMatchIds = t.matches.filter(m => !m.completed).map(m => m.id);
        await apiCall('reorderMatches', { matchIds: upcomingMatchIds });
        navigateTo({ name: 'tournament', tournamentId: t.id });
    },
    'swap-sides': async (target) => {
        const t = getTournament();
        const matchId = target.dataset.id;
        const m = getMatch(t, matchId);
        if (m && !t.isLocked) {
            const entityId = m.id;
            m.sidesSwapped = !m.sidesSwapped;
            await apiCall('swapSides', { matchId: entityId });
            const updatedT = getTournament();
            const updatedM = getMatch(updatedT, entityId);
            if (!updatedM) {
                console.error("Match not found after swapSides!", entityId);
            }
            navigateTo({ name: 'tournament', tournamentId: t.id });
        }
    }
};
