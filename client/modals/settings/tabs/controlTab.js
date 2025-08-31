// Controls Tab: renders Controls settings for panel and overlay
// Human-readable, commented, and variant-aware per project conventions.
// Adds a themed, minimal keybinding editor with presets, conflict handling,
// and reset. JS-only changes; no external CSS/HTML files touched.

import { createDropdown } from '../../../core/ui/controls.js';
import { attachTooltip, updateTooltip } from '../../../core/ui/tooltip.js';
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
    moveUp: 'W',
    moveDown: 'S',
    moveLeft: 'A',
    moveRight: 'D',
  },
  vim: {
    moveUp: 'K',
    moveDown: 'J',
    moveLeft: 'H',
    moveRight: 'L',
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

// Inject once: simple themed keycap style
function ensureKeycapStyle() {
  let st = document.getElementById('sf-keycap-style');
  if (!st) { st = document.createElement('style'); st.id = 'sf-keycap-style'; }
  st.textContent = `
  .sf-keycap {
    display: inline-flex; align-items: center; justify-content: center;
    height: 2rem; width: 2rem; padding: 0; overflow: hidden; text-overflow: ellipsis;
    border-radius: 8px; cursor: pointer; user-select: none;
    color: var(--sf-tip-fg, #fff);
    background: linear-gradient(180deg,
      var(--ui-surface-bg-top, rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1)))) 0%,
      var(--ui-surface-bg-bottom, rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1)))) 100%
    );
    border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    box-shadow: var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.28));
    text-shadow: var(--sf-tip-text-glow, 0 0 6px rgba(140,190,255,0.65));
    white-space: nowrap;
  }
  .sf-keycap:hover, .sf-keycap:focus-visible, .sf-keycap.listening {
    outline: none;
    box-shadow: var(--ui-surface-glow-outer, 0 0 14px rgba(120,170,255,0.38)), var(--ui-surface-glow-inset, inset 0 0 10px rgba(40,100,200,0.20));
    border-color: var(--ui-bright, rgba(190,230,255,0.95));
  }
  /* Unassigned keycaps are dim with no glow */
  .sf-keycap.unbound { opacity: 0.75; box-shadow: none; text-shadow: none; }
  .sf-keycap.unbound:hover, .sf-keycap.unbound:focus-visible { box-shadow: none; border-color: var(--ui-surface-border, rgba(120,170,255,0.70)); }
  /* Slightly larger glyphs for movement arrows */
  .sf-keycap.mglyph { font-size: 1.1rem; line-height: 1; }
  /* Make movement glyph caps pop a bit more */
  .sf-keycap.mglyph { border-color: var(--ui-bright, rgba(190,230,255,0.95)); }
  .sf-kb-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; margin: 6px 0; }
  .sf-kb-label { color: var(--ui-fg, #eee); font-size: 13px; opacity: 0.95; }
  .sf-kb-toolbar { display: flex; gap: 8px; align-items: center; }
  .sf-btn {
    display: inline-flex; align-items: center; justify-content: center;
    height: 30px; padding: 0 12px; border-radius: 8px; cursor: pointer;
    background: linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)));
    color: var(--ui-fg, #eee); border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    box-shadow: var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.25));
  }
  .sf-btn:hover, .sf-btn:focus-visible { border-color: var(--ui-bright, rgba(190,230,255,0.95)); }
  /* 8-way movement ring grid */
  .sf-kb-ring { display: grid; grid-template-columns: repeat(3, auto); grid-auto-rows: auto; gap: 12px; justify-content: center; align-items: center; margin: 8px 0; }
  .sf-kb-ring .slot { display: flex; justify-content: center; align-items: center; min-width: 2rem; min-height: 2rem; }
  `;
  try { if (!st.parentNode) document.head.appendChild(st); } catch (_) {}
}

// Helpers to normalize/label keys
function normalizeKey(k) {
  if (!k) return '';
  if (k === ' ' || k === 'Spacebar') return 'Space';
  // Use upper-case letters for readability; keep names like ArrowUp as-is
  if (k.length === 1) return k.toUpperCase();
  return k;
}
function prettyKey(k) {
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ' ': 'Space' };
  if (!k) return 'Unbound';
  return map[k] || k;
}

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

    // Special layout for Movement: 8-way circle (3x3 grid with center wait)
    if (g.id === 'movement') {
      const ring = document.createElement('div');
      ring.className = 'sf-kb-ring';
      const slots = [
        ['moveUpLeft', 'moveUp', 'moveUpRight'],
        ['moveLeft', 'waitTurn', 'moveRight'],
        ['moveDownLeft', 'moveDown', 'moveDownRight'],
      ];
      for (const rowIds of slots) {
        for (const actId of rowIds) {
          const slot = document.createElement('div');
          slot.className = 'slot';
          const act = g.actions.find(a => a.id === actId);
          if (act) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sf-keycap mglyph';
            btn.setAttribute('data-action', act.id);
            btn.textContent = MOVE_GLYPHS[act.id] || '·';
            attachTooltip(btn, { mode: 'near', placement: 't' });
            const cur = state.map[act.id] || '';
            updateTooltip(btn, `${act.label} — bound to: ${cur ? prettyKey(cur) : 'Unbound'}. Click to rebind`);
            btn.onclick = () => startListening(btn, act);
            // Track label and mglyph so renderAll can format properly
            keyEls.set(act.id, { btn, lab: null, label: act.label, mglyph: true });
            slot.appendChild(btn);
          }
          ring.appendChild(slot);
        }
      }
      gSec.appendChild(ring);
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
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sf-keycap';
      btn.setAttribute('data-action', act.id);
      btn.textContent = prettyKey(state.map[act.id]);
      attachTooltip(btn, { mode: 'near', placement: 't' });
      updateTooltip(btn, `${act.label} — bound to: ${state.map[act.id] ? prettyKey(state.map[act.id]) : 'Unbound'}. Click to rebind`);
      btn.onclick = () => startListening(btn, act);
      row.appendChild(btn);
      keyEls.set(act.id, { btn, lab, label: act.label, mglyph: false });
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
      // Show movement glyphs; other keys show bound key label
      if (refs.mglyph) {
        refs.btn.textContent = MOVE_GLYPHS[actId] || refs.btn.textContent;
      } else {
        refs.btn.textContent = prettyKey(k);
      }
      // Dim unassigned
      if (!k) refs.btn.classList.add('unbound'); else refs.btn.classList.remove('unbound');
      // Tooltip reflects binding
      const label = refs.label || actId;
      updateTooltip(refs.btn, `${label} — bound to: ${k ? prettyKey(k) : 'Unbound'}. Click to rebind`);
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
      const keyNorm = normalizeKey(k);
      if (!keyNorm) { cleanup(); return; }
      // Conflict handling: unassign any other action using this key
      let conflicted = null;
      for (const [aid, val] of Object.entries(state.map)) {
        if (aid !== act.id && val === keyNorm) { conflicted = aid; break; }
      }
      if (conflicted) {
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
