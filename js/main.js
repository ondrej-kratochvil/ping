// Vstupní bod aplikace – inicializace a obsluha událostí

import { initUI, getModalsContainer, getScreens, closeModal, showConfirmModal, showAlertModal } from './ui.js';
import { loadState, apiCall } from './api.js';
import {
    renderMainScreen, renderTournamentScreen, renderPlayerDbScreen, renderStatsScreen,
    renderOverallStatsScreen, renderGameBoard, renderStartMatchModal
} from './render.js';
import { allActions, updateScore, undoLastPoint } from './actions.js';
import { state } from './state.js';
import { getTournament, getMatch } from './utils.js';
import { checkWinCondition } from './game-logic.js';
import { initializeAudio, speak } from './audio.js';
import { voiceInput } from './voice-input.js';
import { initRouter, parseRoute, getPath, navigateTo, back } from './router.js';
// APP_VERSION definujeme zde, abychom se vyhnuli problémům s cachováním constants.js
const APP_VERSION = '1.1.3';

async function applyRoute(route) {
    closeModal();
    if (route.name !== 'match' && voiceInput.isActive()) {
        voiceInput.stop();
    }
    switch (route.name) {
        case 'main':
            renderMainScreen();
            break;
        case 'tournament-new':
            renderMainScreen();
            allActions['_show-new-tournament-modal-inner']();
            break;
        case 'tournament':
        case 'tournament-settings':
        case 'tournament-stats': {
            const t = getTournament(route.tournamentId);
            if (!t) {
                renderMainScreen();
                await showAlertModal('Turnaj nebyl nalezen.', 'Chyba');
                return;
            }
            state.activeTournamentId = route.tournamentId;
            renderTournamentScreen();
            if (route.name === 'tournament-settings') {
                allActions['_show-settings-modal-inner']();
            } else if (route.name === 'tournament-stats') {
                renderStatsScreen();
            }
            break;
        }
        case 'match': {
            const t = getTournament(route.tournamentId);
            if (!t) {
                renderMainScreen();
                await showAlertModal('Turnaj nebyl nalezen.', 'Chyba');
                return;
            }
            const m = getMatch(t, route.matchId);
            if (!m) {
                state.activeTournamentId = route.tournamentId;
                renderTournamentScreen();
                await showAlertModal('Zápas nebyl nalezen.', 'Chyba');
                return;
            }
            state.activeTournamentId = route.tournamentId;
            state.activeMatchId = String(route.matchId);
            state.scoreHistory = [];
            state.lastPointTimestamp = null;
            const match = getMatch(t, route.matchId);
            match.score1 = match.score1 || 0;
            match.score2 = match.score2 || 0;
            if (!match.firstServer) {
                renderTournamentScreen();
                renderStartMatchModal(match);
                if (state.settings.voiceInputEnabled) {
                    voiceInput.setContext('setup');
                    voiceInput.start();
                }
            } else {
                renderGameBoard();
                if (state.settings.voiceInputEnabled) {
                    voiceInput.setContext('game');
                    voiceInput.start();
                }
            }
            break;
        }
        case 'players':
            renderPlayerDbScreen();
            break;
        case 'player-new':
            renderPlayerDbScreen();
            allActions['open-edit-player-modal'](null);
            break;
        case 'player-edit': {
            const p = state.playerDatabase.find(pl => pl.id === route.playerId);
            if (!p) {
                renderPlayerDbScreen();
                await showAlertModal('Hráč nebyl nalezen.', 'Chyba');
                return;
            }
            renderPlayerDbScreen();
            allActions['open-edit-player-modal'](route.playerId);
            break;
        }
        case 'stats-overall':
            renderOverallStatsScreen();
            break;
        default:
            renderMainScreen();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initRouter(applyRoute); // před listenery – navigateTo musí mít _applyRoute při prvním kliknutí

    // Znovu nastavíme verzi pro jistotu
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.textContent = APP_VERSION;

    // Inicializace voice input s potřebnými akcemi
    voiceInput.init({
        updateScore,
        undoLastPoint,
        setFirstServer: (playerId, teamSide) => {
             allActions['set-first-server']({ dataset: { playerId, teamSide } });
        },
        swapSides: () => {
             const t = getTournament();
             const m = getMatch(t, state.activeMatchId);
             if (m) allActions['swap-sides']({ dataset: { id: m.id } });
        },
        suspendMatch: () => allActions['suspend-match']()
    });

    const app = document.getElementById('app');
    const modalsContainer = getModalsContainer();
    const screens = getScreens();

    app.addEventListener('click', (e) => {
        initializeAudio();
        const target = e.target.closest('[data-action]');
        if (!e.target.closest('#settings-menu') && !e.target.closest('[data-action="toggle-settings-menu"]')) {
            document.getElementById('settings-menu').classList.add('hidden');
        }
        if (target && allActions[target.dataset.action]) allActions[target.dataset.action](target, e);
    });

    app.addEventListener('change', (e) => {
        const soundToggle = e.target.closest('[data-action="toggle-sound"]');
        if (soundToggle) {
            state.settings.soundsEnabled = soundToggle.checked;
            apiCall('saveSettings', { key: 'soundsEnabled', value: state.settings.soundsEnabled });
        }
        const voiceToggle = e.target.closest('[data-action="toggle-voice-assist"]');
        if (voiceToggle) {
            state.settings.voiceAssistEnabled = voiceToggle.checked;
            apiCall('saveSettings', { key: 'voiceAssistEnabled', value: state.settings.voiceAssistEnabled });
            if (state.settings.voiceAssistEnabled) {
                setTimeout(() => speak("Hlasový asistent zapnut."), 100);
            }
        }
        const showLockedToggle = e.target.closest('[data-action="toggle-show-locked"]');
        if (showLockedToggle) {
            state.settings.showLockedTournaments = showLockedToggle.checked;
            apiCall('saveSettings', { key: 'showLockedTournaments', value: state.settings.showLockedTournaments });
            navigateTo({ name: 'main' }, true);
        }
        const motivationalPhrasesToggle = e.target.closest('[data-action="toggle-motivational-phrases"]');
        if (motivationalPhrasesToggle) {
            state.settings.motivationalPhrasesEnabled = motivationalPhrasesToggle.checked;
            apiCall('saveSettings', { key: 'motivationalPhrasesEnabled', value: state.settings.motivationalPhrasesEnabled });
        }
    });

    app.addEventListener('input', (e) => {
        const volumeSlider = e.target.closest('[data-action="change-voice-volume"]');
        if (volumeSlider) {
            const newVolume = parseFloat(volumeSlider.value);
            state.settings.voiceVolume = newVolume;
            apiCall('saveSettings', { key: 'voiceVolume', value: newVolume });
            speak(`Hlasitost ${Math.round(newVolume * 100)} procent`, true);
        }
    });

    document.getElementById('import-file').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if ((state.tournaments.length > 0 || state.playerDatabase.length > 0) && !(await showConfirmModal("Opravdu chcete importovat nová data? Všechna stávající data budou přepsána.", 'Import dat'))) {
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData && (Array.isArray(importedData.tournaments) && Array.isArray(importedData.playerDatabase))) {
                    state.tournaments = importedData.tournaments;
                    state.playerDatabase = importedData.playerDatabase;
                    state.settings = importedData.settings || { soundsEnabled: true };
                    await showAlertModal("Import dat v databázové verzi není zatím podporován.", 'Upozornění');
                } else {
                    throw new Error("Invalid data format");
                }
            } catch (error) {
                await showAlertModal("Chyba: Soubor je poškozený nebo má nesprávný formát.", 'Chyba');
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modalsContainer.children.length > 0) {
                const top = modalsContainer.lastElementChild;
                const tid = top?.getAttribute?.('data-test-id');
                if (tid === 'alert-modal' || tid === 'confirm-modal') {
                    closeModal();
                } else {
                    allActions['close-modal']();
                }
                return;
            }
            const route = parseRoute(getPath());
            if (route.name === 'tournament-stats' || route.name === 'stats-overall') {
                back();
                return;
            }
        }

        const activeElement = document.activeElement;
        const isInputActive = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );
        if (isInputActive) return;

        if (screens.game.classList.contains('active') && modalsContainer.children.length === 0) {
            const t = getTournament();
            const m = getMatch(t, state.activeMatchId);
            if (m && !m.completed) {
                const winnerSide = checkWinCondition(m, t.pointsToWin);
                if (!winnerSide) {
                    const leftRawSide = m.sidesSwapped ? 2 : 1;
                    const rightRawSide = m.sidesSwapped ? 1 : 2;
                    if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        updateScore(null, 1, leftRawSide);
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        updateScore(null, 1, rightRawSide);
                    }
                } else {
                    if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const undoBtn = document.querySelector('[data-action="undo-last-point"]:not([disabled])');
                        if (undoBtn) undoBtn.click();
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        const saveBtn = document.querySelector('[data-action="save-match-result"]');
                        if (saveBtn) saveBtn.click();
                    }
                }
            }
            return;
        }

        if (modalsContainer.children.length > 0) {
            const modal = modalsContainer.lastElementChild;
            const firstServerBtns = modal.querySelectorAll('[data-action="set-first-server"]');
            if (firstServerBtns.length === 2) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    firstServerBtns[0].click();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    firstServerBtns[1].click();
                }
                return;
            }
            const continueBtn = modal.querySelector('[data-action="close-and-refresh"]');
            if (continueBtn && e.key === 'ArrowRight') {
                e.preventDefault();
                continueBtn.click();
                return;
            }
            const closeBtn = modal.querySelector('[data-action="close-and-home"]');
            const copyBtn = modal.querySelector('[data-action="copy-tournament"]');
            if (closeBtn && copyBtn) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    closeBtn.click();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    copyBtn.click();
                }
                return;
            }
        }

        if (screens.tournament.classList.contains('active')) {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const firstPlayBtn = document.querySelector('#upcoming-matches-container [data-action="play-match"]:not([disabled])');
                if (firstPlayBtn) {
                    firstPlayBtn.click();
                }
            }
            return;
        }

        if (screens.main.classList.contains('active')) {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const firstStartBtn = document.querySelector('#tournaments-list-container [data-action="open-tournament"]');
                if (firstStartBtn && firstStartBtn.textContent.includes('Start turnaje')) {
                    firstStartBtn.click();
                }
            }
        }
    });

    (async () => {
        await loadState();
        const route = parseRoute(getPath());
        await applyRoute(route);
    })();
});
