// Audio a voice funkce
import { state } from './state.js';

let audioContext;
let synth = window.speechSynthesis;
let _listenersRegistered = false;

export function initializeAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_listenersRegistered) return;
    _listenersRegistered = true;
    const resumeAudio = () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resumeAudio();
    });
    window.addEventListener('pageshow', resumeAudio);
    window.addEventListener('focus', resumeAudio);
}

export function playSound(playerIndex) {
    if (!state.settings.soundsEnabled || !audioContext) return;
    if (audioContext.state === 'suspended') { audioContext.resume(); }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode); gainNode.connect(audioContext.destination);
    const frequency = playerIndex === 1 ? 880 : 659.25;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.1);
    oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.1);
}

export function speak(text, force = false, onEnd = null) {
    if ((!state.settings.voiceAssistEnabled && !force) || !synth) return;
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    synth.cancel();
    let utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'cs-CZ';
    utterance.volume = state.settings.voiceVolume ?? 1;
    if (onEnd && typeof onEnd === 'function') { utterance.onend = () => onEnd(); }
    synth.speak(utterance);
}
