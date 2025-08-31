// UI helpers for Controls tab
// Small, shared utilities for key labeling and event-to-binding conversion.

export function normalizeKey(k) {
  if (!k) return '';
  if (k === ' ' || k === 'Spacebar') return 'Space';
  // Preserve case for shifted bindings (e.g., 'a' vs 'A', '<', '>')
  if (k.length === 1) return k;
  return k;
}

export function prettyKey(k) {
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ' ': 'Space', Delete: 'Del' };
  if (!k) return 'Unbound';
  if (map[k]) return map[k];
  // Humanize Numpad tokens
  if (k && typeof k === 'string' && k.startsWith('Num')) {
    if (/^Num[0-9]$/.test(k)) return k; // Num0..Num9
    if (k === 'NumEnter') return 'Num Enter';
    if (k === 'Num+') return 'Num +';
    if (k === 'Num-') return 'Num -';
    if (k === 'Num*') return 'Num *';
    if (k === 'Num/') return 'Num /';
    return k;
  }
  return k;
}

export function isMovementActionId(id) {
  return id === 'waitTurn' || id === 'waitTurn2' || /^move(Up|Down|Left|Right)/.test(id);
}

// Build a normalized label from a KeyboardEvent, including Ctrl/Alt chords.
// Returns '' to indicate "ignore and keep listening" (e.g., invalid chord for movement).
export function keyFromEvent(e, actId) {
  const code = e.code || '';
  let base = normalizeKey(e.key);
  const ctrl = !!e.ctrlKey; // treat Meta as unsupported for now
  const alt = !!e.altKey;
  const shift = !!e.shiftKey;

  // Distinguish Numpad keys from their main-row counterparts
  if (code && code.startsWith('Numpad')) {
    const opMap = { NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*', NumpadDivide: 'Num/', NumpadEnter: 'NumEnter' };
    if (opMap[code]) base = opMap[code];
    else if (/^Numpad[0-9]$/.test(code)) base = 'Num' + code.slice(6); // Numpad0..9 -> Num0..9
    // otherwise leave base as-is for other numpad codes
  }

  // Disallow multiple cording (Ctrl+Alt)
  if (ctrl && alt) return '';

  // Ignore pure modifier presses so Shift+Key works via case/symbols
  // (allow CapsLock as a bindable key); disallow NumLock entirely
  if (base === 'Shift' || base === 'Control' || base === 'Alt' || base === 'Meta' || base === 'OS' || base === 'NumLock') return '';

  // Movement actions do not accept chords (Ctrl/Alt)
  if (isMovementActionId(actId) && (ctrl || alt)) return '';
  // Extended letter commands (ext*) must be non-chorded (plain single key)
  if (actId && /^ext/.test(actId) && (ctrl || alt)) return '';

  // Special-case restrictions
  // Space: only plain Space allowed (no Ctrl/Alt/Shift)
  if (base === 'Space') {
    if (ctrl || alt || shift) return '';
    return base;
  }
  // Tab: Shift+Tab binds distinctly; Ctrl/Alt+Tab disallowed
  if (base === 'Tab') {
    if (ctrl || alt) return '';
    if (shift) return 'Shift+Tab';
    return base;
  }
  // Enter: allow Shift+Enter distinct; Ctrl/Alt handled below
  if (base === 'Enter') {
    if (shift && !ctrl && !alt) return 'Shift+Enter';
  }
  // Insert/Delete/PageUp/PageDown/Home/End and Numpad keys: allowed with modifiers by default

  if (ctrl) return `Ctrl+${base}`;
  if (alt) return `Alt+${base}`;
  return base;
}

export function splitChord(k) {
  if (!k || typeof k !== 'string') return null;
  const m = k.match(/^(Ctrl|Alt|Shift)\+(.+)$/);
  return m ? { prefix: m[1], base: m[2] } : null;
}
