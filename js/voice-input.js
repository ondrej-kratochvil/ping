import { state } from './state.js';
import { getTournament, getMatch, getGlobalPlayer, getSidePlayerIds } from './utils.js';
import { showToast } from './ui.js';
import { speak } from './audio.js';
import { t, tRaw, currentLang } from './i18n.js';

class VoiceInputManager {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.keywords = new Map(); // word -> playerId
        this.actions = {}; // actionName -> callback
        this.context = 'game'; // 'game' | 'setup'
        this.lang = currentLang() === 'en' ? 'en-US' : 'cs-CZ';
        this.restartTimer = null;
        this.speakingInProgress = false;
        this.processedIndices = new Set();

        // Mapování příkazů na klíče akcí - načteno z překladů
        this.commandMap = this._buildCommandMap();

        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = this.lang;

            this.recognition.onresult = (event) => this.handleResult(event);
            this.recognition.onerror = (event) => this.handleError(event);
            this.recognition.onend = () => this.handleEnd();
        } else {
            console.warn('Web Speech API is not supported in this browser.');
        }
    }

    _buildCommandMap() {
        const gameCommands = tRaw('voice_commands.game') || {};
        const map = { game: {}, setup: {} };
        for (const [actionKey, phrases] of Object.entries(gameCommands)) {
            const action = actionKey === 'swap_sides' ? 'swapSides' : actionKey;
            if (Array.isArray(phrases)) {
                phrases.forEach(phrase => { map.game[phrase] = action; });
            }
        }
        return map;
    }

    init(actions) {
        // actions: { updateScore, undoLastPoint, setFirstServer, swapSides, suspendMatch }
        this.actions = actions;
    }

    setContext(context) {
        this.context = context;
        console.log('VoiceInput context set to:', context);
        this.updateKeywords();
    }

    isActive() {
        return this.isListening;
    }

    updateKeywords() {
        this.keywords.clear();
        const t = getTournament();
        const m = getMatch(t, state.activeMatchId);
        
        if (!t || !m) return;

        // Získáme všechny hráče v zápase
        const side1Ids = getSidePlayerIds(t, m, 1);
        const side2Ids = getSidePlayerIds(t, m, 2);
        const allIds = [...side1Ids, ...side2Ids];

        const tempMap = new Map(); // word -> Set(ids)

        allIds.forEach(id => {
            const player = getGlobalPlayer(id);
            if (!player) return;

            const terms = [];
            if (player.name) terms.push(player.name.toLowerCase());
            if (player.nickname) terms.push(player.nickname.toLowerCase());
            
            // Rozdělení jména na části (např. "Jan Novák" -> "jan", "novák")
            if (player.name) {
                 const parts = player.name.toLowerCase().split(/\s+/);
                 if (parts.length > 1) {
                     parts.forEach(p => {
                         if (p.length > 2) terms.push(p); // Ignorovat příliš krátké části
                     });
                 }
            }

            terms.forEach(term => {
                if (!tempMap.has(term)) {
                    tempMap.set(term, new Set());
                }
                tempMap.get(term).add(id);
            });
        });

        // Řešení kolizí - uložíme jen unikátní klíčová slova
        tempMap.forEach((ids, term) => {
            if (ids.size === 1) {
                this.keywords.set(term, [...ids][0]);
            } else {
                console.log(`VoiceInput: Nejednoznačný výraz '${term}' pro hráče IDs:`, [...ids]);
            }
        });
        
        console.log('VoiceInput keywords:', this.keywords);
    }

    handleResult(event) {
        if (!event.results) return;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (this.processedIndices.has(i)) continue;

            const result = event.results[i];
            const text = result[0].transcript.trim().toLowerCase();
            const isFinal = result.isFinal;

            console.log(`VoiceInput [${isFinal ? 'FINAL' : 'INTERIM'}]:`, text);

            if (this.processText(text)) {
                this.processedIndices.add(i);
                // Pokud jsme úspěšně zpracovali příkaz, můžeme volitelně restartovat pro vyčištění bufferu,
                // ale pro plynulost to zatím neděláme, spoléháme na processedIndices.
            }
        }
    }

    processText(text) {
        console.log('Processing text:', text, 'Context:', this.context);

        // 1. Kontrola příkazů pro daný kontext
        const contextCommands = this.commandMap[this.context] || {};
        for (const [phrase, actionKey] of Object.entries(contextCommands)) {
            // Použijeme regex pro přesnější shodu celých slov/frází, abychom se vyhnuli
            // částečným shodám v interim výsledcích (např. "pau" vs "pauza")
            // Ale pro víceslovné fráze jako "vyměnit strany" stačí includes, pokud je fráze unikátní.
            if (text.includes(phrase)) {
                this.executeAction(actionKey);
                return true;
            }
        }

        // 2. Logika pro 'game' kontext (bodování)
        if (this.context === 'game') {
             // Kontrola "bod [hráč]" nebo jen "[hráč]"
            let lookupTerm = text;
            if (text.startsWith('bod ')) {
                lookupTerm = text.substring(4).trim();
            }

            const playerId = this.findPlayerId(lookupTerm);
            if (playerId) {
                if (this.actions.updateScore) {
                    this.actions.updateScore(playerId, 1);
                    const player = getGlobalPlayer(playerId);
                    const name = player.nickname || player.name;
                    showToast(t('voice.score_for', { name }), 'success');
                    return true;
                }
            }
        } 
        // 3. Logika pro 'setup' kontext (výběr podání)
        else if (this.context === 'setup') {
            const playerId = this.findPlayerId(text);
            if (playerId) {
                if (this.actions.setFirstServer) {
                                        const t = getTournament();
                    const m = getMatch(t, state.activeMatchId);
                    const side1Ids = getSidePlayerIds(t, m, 1);
                    const side2Ids = getSidePlayerIds(t, m, 2);
                    const teamSide = side1Ids.includes(playerId) ? 1 : (side2Ids.includes(playerId) ? 2 : null);
                    this.actions.setFirstServer(playerId, teamSide);
                    const player = getGlobalPlayer(playerId);
                    showToast(t('voice.first_serve', { name: player.name }), 'success');
                    return true;
                }
            }
        }
        
        return false;
    }

    executeAction(actionKey) {
        console.log('VoiceInput executing action:', actionKey);
        switch (actionKey) {
            case 'undo':
                if (this.actions.undoLastPoint) {
                    this.actions.undoLastPoint();
                    showToast(t('voice.undo_toast'), 'info');
                    speak(t('voice.undo_speak'), state.settings.voiceInputEnabled);
                }
                break;
            case 'swapSides':
                if (this.actions.swapSides) {
                    this.actions.swapSides();
                    showToast(t('voice.swap_toast'), 'info');
                    speak(t('voice.swap_speak'), state.settings.voiceInputEnabled);
                }
                break;
            case 'suspend':
                if (this.actions.suspendMatch) {
                    this.actions.suspendMatch();
                    showToast(t('voice.suspended_toast'), 'info');
                }
                break;
        }
    }

    findPlayerId(term) {
        // 1. Zkusíme přesnou shodu
        let playerId = this.keywords.get(term);
        
        // 2. Pokud není přesná shoda, zkusíme najít, zda text obsahuje klíčové slovo
        if (!playerId) {
            for (const [key, id] of this.keywords.entries()) {
                 const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                 const regex = new RegExp("(?:^|[^\p{L}])" + escaped + "(?:[^\p{L}]|$)", 'u');
                 if (regex.test(term)) {
                     playerId = id;
                     break; 
                 }
            }
        }
        return playerId;
    }

    handleError(event) {
        console.error('VoiceInput error:', event.error);
        if (event.error === 'not-allowed') {
            this.stop();
            state.settings.voiceInputEnabled = false; // Vynutíme vypnutí v nastavení
            showToast(t('voice.mic_denied'), 'error');
            // Zde bychom ideálně měli aktualizovat i UI tlačítko, ale to se překreslí při dalším renderu
            // nebo musíme vyvolat překreslení. Pro teď stačí toast.
        }
    }

    handleEnd() {
        
        if (this.speakingInProgress) return;
        this.processedIndices.clear();
        if (this.isListening) {
             // Pokud má poslouchat, ale API se zastavilo (např. ticho), restartujeme
             this.restartTimer = setTimeout(() => {
                 try {
                    if (this.isListening && this.recognition) this.recognition.start();
                 } catch(e) { console.error('VoiceInput restart failed', e); }
             }, 100);
        }
    }

    start() {
        if (!this.recognition) {
            showToast(t('voice.not_supported'), 'error');
            return;
        }
        if (this.isListening) return;
        
        this.updateKeywords();
        try {
            this.recognition.start();
            this.isListening = true;
            showToast(t('voice.active'), 'info');
        } catch (e) {
            console.error('VoiceInput start error', e);
            this.isListening = false;
        }
    }
    pauseForSpeaking() {
        this.speakingInProgress = true;
        if (this.restartTimer) clearTimeout(this.restartTimer);
        this.restartTimer = null;
        if (this.recognition) try { this.recognition.stop(); } catch(e) { /* ignore */ }
    }

    resumeAfterSpeaking() {
        this.speakingInProgress = false;
        if (this.isListening && this.recognition) {
            try { this.recognition.start(); } catch(e) { console.error('VoiceInput resume failed', e); }
        }
    }


    stop() {
        if (!this.recognition) return;
        const wasListening = this.isListening;
        this.isListening = false;
        if (this.restartTimer) clearTimeout(this.restartTimer);
        try {
            this.recognition.stop();
        } catch(e) { /* ignore */ }
        if (wasListening) showToast(t('voice.disabled'), 'info');
    }

    toggle() {
        if (this.isListening) this.stop(); else this.start();
    }
}

export const voiceInput = new VoiceInputManager();
