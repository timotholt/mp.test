// localStorage.js - central namespaced storage helper
// Purpose: ensure all game keys are consistently prefixed, e.g. 'grimDark.<key>'
// Usage:
//   import * as LS from '../core/localStorage.js';
//   LS.setItem('vol:MASTER', '0.8');
//   const v = LS.getItem('vol:MASTER', '1');

const NAMESPACE = 'grimDark.';

function ns(key) {
  try { return NAMESPACE + String(key || ''); } catch (_) { return NAMESPACE; }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(ns(key), String(value));
    return true;
  } catch (_) {
    return false;
  }
}

export function getItem(key, defaultValue = null) {
  try {
    const v = localStorage.getItem(ns(key));
    return v === null || v === undefined ? defaultValue : v;
  } catch (_) {
    return defaultValue;
  }
}

export function removeItem(key) {
  try { localStorage.removeItem(ns(key)); } catch (_) {}
}

// Optional JSON helpers for structured data
export function setJSON(key, obj) {
  try {
    const s = JSON.stringify(obj);
    return setItem(key, s);
  } catch (_) { return false; }
}

export function getJSON(key, defaultValue = null) {
  try {
    const s = getItem(key, null);
    if (s == null) return defaultValue;
    return JSON.parse(s);
  } catch (_) { return defaultValue; }
}
