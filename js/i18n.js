// Internationalization module for Ping app
// Reads translations embedded by PHP in window.__PING_I18N__

const lang = window.__PING_LANG__ || 'cs';
const translations = window.__PING_I18N__ || {};

/**
 * Translate a key with optional variable interpolation.
 * Supports dot notation: t('game.serve_label')
 * Supports interpolation: t('game.points_to_win', { points: 11 })
 */
export function t(key, vars = {}) {
    const keys = key.split('.');
    let val = translations;
    for (const k of keys) {
        if (val == null || typeof val !== 'object') return key;
        val = val[k];
    }
    if (typeof val !== 'string') return key;
    return val.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`);
}

/**
 * Pluralization for Czech/English.
 * JSON format: { "one": "...", "few": "...", "other": "..." }
 * Czech: one (1), few (2-4), other (5+)
 * English: one (1), other (2+)
 */
export function t_plural(key, count, vars = {}) {
    const keys = key.split('.');
    let val = translations;
    for (const k of keys) {
        if (val == null || typeof val !== 'object') return key;
        val = val[k];
    }
    if (typeof val !== 'object' || val === null) return key;

    let form;
    if (lang === 'cs') {
        if (count === 1) form = 'one';
        else if (count >= 2 && count <= 4) form = 'few';
        else form = 'other';
    } else {
        form = count === 1 ? 'one' : 'other';
    }

    const template = val[form] ?? val['other'] ?? key;
    return template.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`);
}

/** Get current language code */
export function currentLang() {
    return lang;
}

/** Get a raw value from translations (for arrays like phrases) */
export function tRaw(key) {
    const keys = key.split('.');
    let val = translations;
    for (const k of keys) {
        if (val == null || typeof val !== 'object') return undefined;
        val = val[k];
    }
    return val;
}

/** Translate all elements with data-i18n attributes in the DOM */
export function translateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
}
