// Tiny unified preferences helper
// Namespaced, versioned, schema-backed with init/save/restore and change events.
// JS-only, no external deps. Usage:
//   Prefs.defineNamespace('display.rc', { version: 1, defaults: { foo: 1 } })
//   const v = Prefs.get('display.rc', 'foo')
//   Prefs.set('display.rc', 'foo', 2)
//   Prefs.resetAll('display.rc')
//   window.addEventListener('ui:prefs-changed', (e) => console.log(e.detail))

const REGISTRY = new Map();
const KEY_DATA = (ns) => `mp:prefs:${ns}`;
const KEY_VERSION = (ns) => `mp:prefs:${ns}:version`;

function clone(obj) { try { return JSON.parse(JSON.stringify(obj)); } catch (_) { return obj; } }

function ensureNamespace(ns) {
  if (!REGISTRY.has(ns)) {
    // If never defined, create a minimal placeholder so consumers don't crash
    REGISTRY.set(ns, { version: 1, defaults: {}, migrate: null });
  }
  return REGISTRY.get(ns);
}

export function defineNamespace(ns, { version = 1, defaults = {}, migrate = null } = {}) {
  REGISTRY.set(ns, { version: Number(version) || 1, defaults: clone(defaults), migrate: typeof migrate === 'function' ? migrate : null });
  // Perform one-time migration/initialization if stored version differs
  try {
    const vStored = Number(localStorage.getItem(KEY_VERSION(ns)) || '0') || 0;
    if (vStored !== (Number(version) || 1)) {
      const loaded = _loadAllInternal(ns);
      const final = (vStored > 0 && typeof migrate === 'function')
        ? (migrate(loaded, vStored, Number(version) || 1) || {})
        : (Object.assign({}, defaults, loaded));
      _saveAllInternal(ns, final, Number(version) || 1, true);
    }
  } catch (_) { /* no-op */ }
}

function _loadAllInternal(ns) {
  try {
    const raw = localStorage.getItem(KEY_DATA(ns));
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (_) { return {}; }
}

function _saveAllInternal(ns, obj, version, silent) {
  try {
    localStorage.setItem(KEY_DATA(ns), JSON.stringify(obj || {}));
    localStorage.setItem(KEY_VERSION(ns), String(Number(version) || 1));
    if (!silent) {
      window.dispatchEvent(new CustomEvent('ui:prefs-changed', { detail: { ns, all: clone(obj) } }));
    }
  } catch (_) { /* no-op */ }
}

export function loadAll(ns) {
  const meta = ensureNamespace(ns);
  const data = _loadAllInternal(ns);
  // Fill defaults without mutating storage
  return Object.assign({}, meta.defaults, data);
}

export function get(ns, key, fallback) {
  const meta = ensureNamespace(ns);
  const data = _loadAllInternal(ns);
  if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];
  if (Object.prototype.hasOwnProperty.call(meta.defaults, key)) return meta.defaults[key];
  return fallback;
}

export function set(ns, key, value) {
  const meta = ensureNamespace(ns);
  const data = _loadAllInternal(ns);
  data[key] = value;
  _saveAllInternal(ns, data, meta.version, true);
  try { window.dispatchEvent(new CustomEvent('ui:prefs-changed', { detail: { ns, key, value } })); } catch (_) {}
}

export function setAll(ns, obj) {
  const meta = ensureNamespace(ns);
  const merged = Object.assign({}, meta.defaults, _loadAllInternal(ns), obj || {});
  _saveAllInternal(ns, merged, meta.version, false);
}

export function reset(ns, key) {
  const meta = ensureNamespace(ns);
  const data = _loadAllInternal(ns);
  if (Object.prototype.hasOwnProperty.call(meta.defaults, key)) {
    data[key] = meta.defaults[key];
    _saveAllInternal(ns, data, meta.version, true);
    try { window.dispatchEvent(new CustomEvent('ui:prefs-changed', { detail: { ns, key, value: data[key] } })); } catch (_) {}
  }
}

export function resetAll(ns) {
  const meta = ensureNamespace(ns);
  _saveAllInternal(ns, clone(meta.defaults), meta.version, false);
}

// Convenience global for quick debugging and incremental migration across modules
try { window.Prefs = { defineNamespace, loadAll, get, set, setAll, reset, resetAll }; } catch (_) {}
