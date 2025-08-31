// Controls Tab: renders Controls settings for panel and overlay
// Human-readable, commented, and variant-aware per project conventions.
// Adds a themed, minimal keybinding editor with presets, conflict handling,
// and reset. JS-only changes; no external CSS/HTML files touched.

import { createDropdown } from '../../../core/ui/controls.js';
import { updateTooltip } from '../../../core/ui/tooltip.js';
import { ensureKeycapStyle, buildKeycap } from '../../../core/ui/keycap.js';
import * as LS from '../../../core/localStorage.js';

// Storage keys (namespaced via LS helper)
const STORAGE_KEY = 'keybinds.map';
const PRESET_KEY = 'keybinds.preset';

// Presets kept intentionally small for v1; expandable later
const PRESETS = {
  arrows: {
    moveUp: 'ArrowUp',
    moveDown: 'ArrowDown',
    moveLeft: 'ArrowLeft',
    moveRight: 'ArrowRight',
  },
  wasd: {
    moveUp: 'w',
    moveDown: 's',
    moveLeft: 'a',
    moveRight: 'd',
  },
  vim: {
    moveUp: 'k',
    moveDown: 'j',
    moveLeft: 'h',
    moveRight: 'l',
  },
};

const PRESET_ITEMS = [
  { label: 'Arrow Keys', value: 'arrows' },
  { label: 'WASD', value: 'wasd' },
  { label: 'Vim (HJKL)', value: 'vim' },
];

// Arrow glyphs for movement ring and wait
const MOVE_GLYPHS = {
  moveUpLeft: '↖',
  moveUp: '↑',
  moveUpRight: '↗',
  moveLeft: '←',
  waitTurn: '•',
  moveRight: '→',
  moveDownLeft: '↙',
  moveDown: '↓',
  moveDownRight: '↘',
};

// Groups and actions description for rendering
// Inspired by the NetHack keyboard reference PDF for familiarity.
const KEY_GROUPS = [
  // Movement (primary 4-way + diagonals + wait)
  {
    id: 'movement',
    title: 'Movement',
    quip: 'HJKL, WASD, arrows… pick your poison.',
    actions: [
      { id: 'moveUp', label: 'Move Up' },
      { id: 'moveDown', label: 'Move Down' },
      { id: 'moveLeft', label: 'Move Left' },
      { id: 'moveRight', label: 'Move Right' },
      { id: 'moveUpLeft', label: 'Move Up-Left' },
      { id: 'moveUpRight', label: 'Move Up-Right' },
      { id: 'moveDownLeft', label: 'Move Down-Left' },
      { id: 'moveDownRight', label: 'Move Down-Right' },
      { id: 'waitTurn', label: 'Wait/Rest' },
    ],
  },
  // Travel / stairs
  {
    id: 'travel',
    title: 'Travel & Stairs',
    quip: 'Sometimes the fastest route is down.',
    actions: [
      { id: 'ascendStairs', label: 'Ascend Stairs' },
      { id: 'descendStairs', label: 'Descend Stairs' },
      { id: 'autoTravel', label: 'Auto-Travel/Run' },
    ],
  },
  // Interaction / environment
  {
    id: 'interaction',
    title: 'Interaction',
    quip: 'Open. Close. Search. Kick. Look. Repeat.',
    actions: [
      { id: 'search', label: 'Search' },
      { id: 'look', label: 'Look/Examine' },
      { id: 'open', label: 'Open' },
      { id: 'close', label: 'Close' },
      { id: 'kick', label: 'Kick' },
      { id: 'talk', label: 'Talk/Chat' },
    ],
  },
  // Combat
  {
    id: 'combat',
    title: 'Combat',
    quip: 'If it bleeds, it can be bound to a key.',
    actions: [
      { id: 'wield', label: 'Wield Weapon' },
      { id: 'swapWeapon', label: 'Swap Weapon' },
      { id: 'throw', label: 'Throw' },
      { id: 'fire', label: 'Fire (Quiver)' },
      { id: 'targetNext', label: 'Next Target' },
    ],
  },
  // Inventory & items
  {
    id: 'inventory',
    title: 'Inventory & Items',
    quip: 'Pack light. Bind smarter.',
    actions: [
      { id: 'inventory', label: 'Open Inventory' },
      { id: 'pickup', label: 'Pick Up' },
      { id: 'drop', label: 'Drop' },
      { id: 'dropMany', label: 'Drop Many' },
      { id: 'apply', label: 'Apply/Use' },
      { id: 'eat', label: 'Eat' },
      { id: 'read', label: 'Read' },
      { id: 'zap', label: 'Zap' },
      { id: 'quaff', label: 'Quaff' },
      { id: 'wear', label: 'Wear/Put On' },
      { id: 'remove', label: 'Remove/Take Off' },
      { id: 'quiverSelect', label: 'Select Quiver' },
    ],
  },
  // System & UI
  {
    id: 'system',
    title: 'System & UI',
    quip: 'When in doubt, press Help. When doomed, press Save.',
    actions: [
      { id: 'help', label: 'Help' },
      { id: 'messageHistory', label: 'Message History' },
      { id: 'options', label: 'Options/Settings' },
      { id: 'saveQuit', label: 'Save & Quit' },
      { id: 'fullscreenToggle', label: 'Toggle Fullscreen' },
    ],
  },
];

// Inject once: Controls-tab specific layout styles (movement ring, rows, buttons)
function ensureControlsKbStyle() {
  let st = document.getElementById('sf-controls-style');
  if (!st) { st = document.createElement('style'); st.id = 'sf-controls-style'; }
  st.textContent = `
  .sf-kb-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; margin: 6px 0; }
  .sf-kb-label { color: var(--ui-fg, #eee); font-size: 13px; opacity: 0.95; }
  .sf-kb-toolbar { display: flex; gap: 8px; align-items: center; }
  .sf-btn {
    display: inline-flex; align-items: center; justify-content: center;
    height: 30px; padding: 0 12px; border-radius: 8px; cursor: pointer;
    background: linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)));
    color: var(--ui-fg, #eee); border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    box-shadow: none;
  }
  .sf-btn:hover, .sf-btn:focus-visible { border-color: var(--ui-bright, rgba(190,230,255,0.95)); box-shadow: var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.25)); }
  /* Circular movement layout */
  .sf-kb-move-circle { position: relative; width: 220px; height: 220px; margin: 10px auto; }
  .sf-kb-move-circle .arrow { position: absolute; transform: translate(-50%, -50%); color: var(--ui-fg, #eee); opacity: 0.9; font-size: 22px; line-height: 1; user-select: none; pointer-events: none; text-shadow: var(--ui-text-glow, 0 0 6px rgba(140,190,255,0.35)); font-family: "Segoe UI Symbol","Noto Sans Symbols 2","Apple Symbols",sans-serif; }
  .sf-kb-move-circle .sf-keycap { position: absolute; transform: translate(-50%, -50%); }
  .sf-keycap.conflict { animation: sf-kb-pulse 0.2s ease-in-out 0s 3 alternate; }
  @keyframes sf-kb-pulse { from { filter: brightness(1); } to { filter: brightness(1.35); } }
  `;
  try { if (!st.parentNode) document.head.appendChild(st); } catch (_) {}
}

// Helpers to normalize/label keys
function normalizeKey(k) {
  if (!k) return '';
  if (k === ' ' || k === 'Spacebar') return 'Space';
  // Preserve case for shifted bindings (e.g., 'a' vs 'A', '<', '>')
  if (k.length === 1) return k;
  return k;
}
function prettyKey(k) {
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ' ': 'Space' };
  if (!k) return 'Unbound';
  return map[k] || k;
}

// (buildKeycap is imported from core/ui/keycap.js)

// Load/save bindings
function loadBindings() {
  const preset = LS.getItem(PRESET_KEY, 'arrows');
  const saved = LS.getJSON(STORAGE_KEY, null);
  const base = PRESETS[preset] || PRESETS.arrows;
  return { preset, map: { ...base, ...(saved || {}) } };
}
function saveBindings(preset, map) {
  try { LS.setItem(PRESET_KEY, preset); } catch (_) {}
  try { LS.setJSON(STORAGE_KEY, map); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('ui:keybinds:changed', { detail: { preset, map } })); } catch (_) {}
}

export function renderControlTab(opts) {
  const {
    container,
    makeSection,
    makeNote,
    headerTitle = 'Controls',
    headerDesc = 'Bind your keys. Conflicts auto-resolve like civilized barbarians.',
    variant = 'panel', // currently unused but reserved for future differences
  } = opts || {};

  ensureKeycapStyle();
  ensureControlsKbStyle();

  // Section header
  const sec = makeSection(headerTitle, headerDesc);
  container.appendChild(sec);

  // Toolbar: Preset dropdown + Reset button
  const toolbar = document.createElement('div');
  toolbar.className = 'sf-kb-toolbar';
  toolbar.style.margin = '6px 0 12px 0';

  const presetDD = createDropdown({
    items: PRESET_ITEMS,
    value: null,
    onChange: (val) => {
      state.preset = val;
      state.map = { ...PRESETS[val] };
      saveBindings(state.preset, state.map);
      renderAll();
    },
    width: '220px',
    placeholder: 'Layout Preset'
  });
  toolbar.appendChild(presetDD.el);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'sf-btn';
  resetBtn.textContent = 'Reset All';
  resetBtn.onclick = () => {
    state.map = { ...(PRESETS[state.preset] || PRESETS.arrows) };
    saveBindings(state.preset, state.map);
    renderAll();
  };
  toolbar.appendChild(resetBtn);
  container.appendChild(toolbar);

  // Body note
  container.appendChild(makeNote('Tip: Click a keycap, then press any key. Esc cancels. Backspace/Delete unbind.')); 

  // State and UI refs
  const state = loadBindings();
  const keyEls = new Map(); // actionId -> { btn, label }

  // Initialize preset dropdown label
  try { presetDD.setValue(state.preset, false); } catch (_) {}

  // Render key groups
  KEY_GROUPS.forEach((g) => {
    const gSec = makeSection(g.title, g.quip);
    container.appendChild(gSec);

    // Special layout for Movement: circular arrows with themed keycaps
    if (g.id === 'movement') {
      const circle = document.createElement('div');
      circle.className = 'sf-kb-move-circle';

      const center = 110; // half of 220px box
      const rArrow = 87;  // outer radius for arrow glyphs (moved inward by 8px for closer spacing)
      const rKey = 55;    // inner radius for keycaps (moved inward for more gap)

      const placeMap = {
        moveUpLeft: 'tl', moveUp: 't', moveUpRight: 'tr',
        moveLeft: 'l', waitTurn: 'bc', moveRight: 'r',
        moveDownLeft: 'bl', moveDown: 'b', moveDownRight: 'br',
      };

      function place(el, angleDeg, radius) {
        const rad = (angleDeg * Math.PI) / 180;
        const x = center + Math.cos(rad) * radius;
        const y = center + Math.sin(rad) * radius;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      }

      function addArrow(angleDeg, glyph) {
        const s = document.createElement('span');
        s.className = 'arrow';
        s.textContent = glyph;
        place(s, angleDeg, rArrow);
        circle.appendChild(s);
      }

      function addKey(actId, angleDeg, radius) {
        const act = g.actions.find(a => a.id === actId);
        if (!act) return;
        const cur = state.map[act.id] || '';
        const cap = buildKeycap(act, cur ? prettyKey(cur) : '', 'themed', { mode: 'far', placement: placeMap[act.id] || 't' });
        place(cap.btn, angleDeg, radius);
        updateTooltip(cap.btn, `${act.label} — ${cur ? 'bound to: ' + prettyKey(cur) : 'UNBOUND'}. Click to rebind`);
        cap.btn.onclick = () => startListening(cap.btn, act);
        keyEls.set(act.id, { btn: cap.btn, lab: cap.lab, label: act.label, mglyph: false });
        circle.appendChild(cap.btn);
      }

      // Arrows around the ring
      addArrow(-135, MOVE_GLYPHS.moveUpLeft);
      addArrow(-90,  MOVE_GLYPHS.moveUp);
      addArrow(-45,  MOVE_GLYPHS.moveUpRight);
      addArrow(180,  MOVE_GLYPHS.moveLeft);
      addArrow(0,    MOVE_GLYPHS.moveRight);
      addArrow(135,  MOVE_GLYPHS.moveDownLeft);
      addArrow(90,   MOVE_GLYPHS.moveDown);
      addArrow(45,   MOVE_GLYPHS.moveDownRight);
      // center occupied by the waitTurn keycap

      // Keycaps slightly inside the arrows
      addKey('moveUpLeft', -135, rKey);
      addKey('moveUp', -90, rKey);
      addKey('moveUpRight', -45, rKey);
      addKey('moveLeft', 180, rKey);
      addKey('waitTurn', 0, 0); // center
      addKey('moveRight', 0, rKey);
      addKey('moveDownLeft', 135, rKey);
      addKey('moveDown', 90, rKey);
      addKey('moveDownRight', 45, rKey);

      gSec.appendChild(circle);
      return; // done with movement group
    }

    // Default layout: labeled rows with key on the right
    const wrap = document.createElement('div');
    gSec.appendChild(wrap);
    g.actions.forEach((act) => {
      const row = document.createElement('div');
      row.className = 'sf-kb-row';
      const lab = document.createElement('div');
      lab.className = 'sf-kb-label';
      lab.textContent = act.label;
      row.appendChild(lab);
      const k0 = state.map[act.id] || '';
      const cap = buildKeycap(act, k0 ? prettyKey(k0) : '', '', { mode: 'far', placement: 'r' });
      updateTooltip(cap.btn, `${act.label} — bound to: ${k0 ? prettyKey(k0) : 'Unbound'}. Click to rebind`);
      cap.btn.onclick = () => startListening(cap.btn, act);
      row.appendChild(cap.btn);
      keyEls.set(act.id, { btn: cap.btn, lab: cap.lab, label: act.label, mglyph: false });
      wrap.appendChild(row);
    });
  });

  // Apply initial binding visuals after creating all buttons
  renderAll();

  function renderAll() {
    // Update preset label
    try { presetDD.setValue(state.preset, false); } catch (_) {}
    // Update keycaps
    for (const [actId, refs] of keyEls.entries()) {
      const k = state.map[actId] || '';
      const txt = k ? prettyKey(k) : '';
      if (refs.lab) refs.lab.textContent = txt; else refs.btn.textContent = txt; // safety fallback
      // Variable width for special keys
      const isWide = (txt === 'Enter' || txt === 'Space');
      if (refs.btn) refs.btn.classList.toggle('wide', isWide);
      // Dim unassigned
      if (!k) refs.btn.classList.add('unbound'); else refs.btn.classList.remove('unbound');
      // Tooltip reflects binding
      const label = refs.label || actId;
      updateTooltip(refs.btn, `${label} — ${k ? 'bound to: ' + prettyKey(k) : 'UNBOUND'}. Click to rebind`);
    }
  }

  function startListening(btn, act) {
    if (!btn || !act) return;
    btn.classList.add('listening');
    updateTooltip(btn, `Press a key for ${act.label} (Esc cancel, Backspace/Delete unbind)`);

    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const k = e.key;
      if (k === 'Escape') { cleanup(); return; }
      if (k === 'Backspace' || k === 'Delete') {
        state.map[act.id] = '';
        saveBindings(state.preset, state.map);
        renderAll();
        cleanup();
        return;
      }
      // Ignore pure modifier presses so Shift+Key (for capitals and symbols like < >) works
      if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta' || k === 'OS' || k === 'CapsLock') {
        return; // keep listening for the actual printable key
      }
      const keyNorm = normalizeKey(k);
      if (!keyNorm) { cleanup(); return; }
      // Conflict handling: unassign any other action using this key
      let conflicted = null;
      for (const [aid, val] of Object.entries(state.map)) {
        if (aid !== act.id && val === keyNorm) { conflicted = aid; break; }
      }
      if (conflicted) {
        // transiently highlight the conflicted keycap and show tooltip note
        const refs = keyEls.get(conflicted);
        if (refs && refs.btn) {
          refs.btn.classList.add('conflict');
          updateTooltip(refs.btn, `${refs.label || conflicted} — CONFLICT: unbinding due to reassignment`);
          setTimeout(() => {
            refs.btn.classList.remove('conflict');
            const cur = state.map[conflicted] || '';
            updateTooltip(refs.btn, `${refs.label || conflicted} — ${cur ? 'bound to: ' + prettyKey(cur) : 'UNBOUND'}. Click to rebind`);
          }, 1200);
        }
        state.map[conflicted] = '';
      }
      state.map[act.id] = keyNorm;
      saveBindings(state.preset, state.map);
      renderAll();
      cleanup();
    };

    const onBlur = () => { cleanup(); };

    function cleanup() {
      try { window.removeEventListener('keydown', onKey, true); } catch (_) {}
      try { window.removeEventListener('blur', onBlur, true); } catch (_) {}
      btn.classList.remove('listening');
      // Ensure UI reflects current state
      renderAll();
    }

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur, true);
    try { btn.focus(); } catch (_) {}
  }
}
