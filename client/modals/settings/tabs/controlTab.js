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
    extendedPrefix: '#',
  },
  wasd: {
    moveUp: 'w',
    moveDown: 's',
    moveLeft: 'a',
    moveRight: 'd',
    extendedPrefix: '#',
  },
  vim: {
    moveUp: 'k',
    moveDown: 'j',
    moveLeft: 'h',
    moveRight: 'l',
    moveUpLeft: 'y',
    moveUpRight: 'u',
    moveDownLeft: 'b',
    moveDownRight: 'n',
    waitTurn: 'i',
    extendedPrefix: '#',
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
  // Movement (secondary bindings, used by the second ring; not rendered directly)
  {
    id: 'movementSecondary',
    title: 'Movement (Secondary)',
    quip: 'Secondary bindings used by the right-hand movement ring.',
    actions: [
      { id: 'moveUp2', label: 'Move Up (Secondary)' },
      { id: 'moveDown2', label: 'Move Down (Secondary)' },
      { id: 'moveLeft2', label: 'Move Left (Secondary)' },
      { id: 'moveRight2', label: 'Move Right (Secondary)' },
      { id: 'moveUpLeft2', label: 'Move Up-Left (Secondary)' },
      { id: 'moveUpRight2', label: 'Move Up-Right (Secondary)' },
      { id: 'moveDownLeft2', label: 'Move Down-Left (Secondary)' },
      { id: 'moveDownRight2', label: 'Move Down-Right (Secondary)' },
      { id: 'waitTurn2', label: 'Wait/Rest (Secondary)' },
    ],
  },
  // Movement (advanced)
  {
    id: 'movementAdvanced',
    title: 'Movement (additional)',
    quip: 'Quick-move, far-move, acrobatics & wizardry.',
    actions: [
      { id: 'quickMove', label: 'Quick Move' },
      { id: 'moveFar', label: 'Move Far' },
      { id: 'jump', label: 'Jump' },
      { id: 'teleport', label: 'Teleport' },
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
      { id: 'rideMonster', label: 'Ride Monster' },
      { id: 'sitDown', label: 'Sit Down' },
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
      { id: 'lootContainer', label: 'Loot Box/Bag' },
      { id: 'untrap', label: 'Untrap' },
      { id: 'forceLock', label: 'Force Lock' },
      { id: 'identifySymbol', label: 'Identify Symbol' },
      { id: 'identifyTrap', label: 'Identify Trap' },
      { id: 'nameMonster', label: 'Name Monster' },
      { id: 'wipeFace', label: 'Wipe Face' },
      { id: 'engrave', label: 'Engrave' },
      { id: 'writeInscription', label: 'Write Inscription' },
      { id: 'pay', label: 'Pay' },
    ],
  },
  // Magic & Spiritual
  {
    id: 'magic',
    title: 'Magic & Spiritual',
    quip: 'Pray you bound these right.',
    actions: [
      { id: 'castSpell', label: 'Cast Spell' },
      { id: 'drink', label: 'Drink' },
      { id: 'zapWand', label: 'Zap Wand' },
      { id: 'pray', label: 'Pray' },
      { id: 'dip', label: 'Dip' },
      { id: 'rub', label: 'Rub' },
      { id: 'offer', label: 'Offer/Sacrifice' },
      { id: 'invoke', label: 'Invoke' },
      { id: 'turnUndead', label: 'Turn Undead' },
      { id: 'specialAbility', label: 'Special Ability' },
      { id: 'breakWand', label: 'Break Wand' },
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
      { id: 'twoWeapon', label: 'Use Two Weapons' },
      { id: 'viewSkills', label: 'View Skills' },
      { id: 'raiseSkills', label: 'Raise Skills' },
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
      { id: 'adjustInventory', label: 'Adjust Inventory' },
      { id: 'nameObject', label: 'Name Object' },
      { id: 'listWeapons', label: 'List Weapons' },
      { id: 'listArmor', label: 'List Armor' },
      { id: 'listRings', label: 'List Rings' },
      { id: 'listAmulets', label: 'List Amulets' },
      { id: 'listTools', label: 'List Tools' },
      { id: 'listEquipment', label: 'List Equipment' },
      { id: 'listGold', label: 'List Gold' },
      { id: 'listSpells', label: 'List Spells' },
      { id: 'wearArmor', label: 'Wear Armor' },
      { id: 'takeoffArmor', label: 'Take Off Armor' },
      { id: 'removeMulti', label: 'Remove Multiple Items' },
      { id: 'putOnRingAmulet', label: 'Put On Ring/Amulet' },
      { id: 'removeRingAmulet', label: 'Remove Ring/Amulet' },
      { id: 'listDiscoveries', label: 'List Discovered Objects' },
      { id: 'listChallenges', label: 'List Challenges' },
    ],
  },
  // Extended Commands (two-keystroke): prefix + letter
  {
    id: 'extended',
    title: 'Extended Commands',
    quip: 'Two-keystroke commands: [prefix] + [key] (e.g., # + r = Ride).',
    actions: [
      { id: 'extendedPrefix', label: 'Extended Prefix' },
      { id: 'rideMonster', label: 'Ride' },
      { id: 'twoWeapon', label: 'Two-Weapon' },
      { id: 'listChallenges', label: 'Conduct' },
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
      { id: 'playerInfo', label: 'Player Info' },
      { id: 'save', label: 'Save' },
      { id: 'quit', label: 'Quit' },
      { id: 'redo', label: 'Redo' },
      { id: 'talk', label: 'Talk/Chat' },
      { id: 'repeatMessage', label: 'Repeat Message' },
      { id: 'toggleAutopickup', label: 'Toggle Auto-pickup' },
      { id: 'displayVersion', label: 'Display Version' },
      { id: 'displayHistory', label: 'Display History' },
      { id: 'exploreMode', label: 'Explore Mode' },
      { id: 'explainCommand', label: 'Explain Command' },
      { id: 'redrawScreen', label: 'Redraw the Screen' },
      { id: 'suspend', label: 'Suspend' },
      { id: 'bossKey', label: 'Boss Key' },
    ],
  },
];

// Inject once: Controls-tab specific layout styles (movement ring, rows, buttons)
function ensureControlsKbStyle() {
  let st = document.getElementById('sf-controls-style');
  if (!st) { st = document.createElement('style'); st.id = 'sf-controls-style'; }
  st.textContent = `
  .sf-kb-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; margin: 6px 0; }
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
  .sf-kb-move-circle { position: relative; width: 220px; height: 220px; margin: 10px 0; }
  .sf-kb-move-circle .arrow { position: absolute; transform: translate(-50%, -50%); color: var(--ui-fg, #eee); opacity: 0.9; font-size: 22px; line-height: 1; user-select: none; pointer-events: none; text-shadow: var(--ui-text-glow, 0 0 6px rgba(140,190,255,0.35)); font-family: "Segoe UI Symbol","Noto Sans Symbols 2","Apple Symbols",sans-serif; }
  .sf-kb-move-circle .sf-keycap { position: absolute; transform: translate(-50%, -50%); }
  .sf-keycap.conflict { animation: sf-kb-pulse 0.2s ease-in-out 0s 3 alternate; }
  .sf-keycap.unbound { opacity: var(--ui-unbound-opacity, 0.4); }
  @keyframes sf-kb-pulse { from { filter: brightness(1); } to { filter: brightness(1.35); } }
  /* Two-column grid for large groups */
  .sf-kb-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; grid-auto-flow: row dense; }
  .sf-kb-two-col .sf-kb-row { width: 100%; }
  .sf-kb-row .sf-keycap { justify-self: end; }
  .sf-kb-two-col .sf-kb-row { margin: 2px 0; }
  /* Four-cell grid (label,key | label,key) used by Movement (additional) */
  .sf-kb-two-col-keys { display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 8px 18px; align-items: center; }
  .sf-kb-two-col-keys .sf-keycap { justify-self: end; }
  /* Dual movement rings container */
  .sf-kb-move-duo { display: flex; gap: 16px; justify-content: center; align-items: flex-start; flex-wrap: nowrap; }
  .sf-kb-move-col { width: 220px; }
  .sf-kb-move-title { text-align: center; color: var(--ui-fg, #eee); font-size: 12px; opacity: 0.75; margin-bottom: 4px; }
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

// Helpers for movement/chord recognition
function isMovementActionId(id) {
  return id === 'waitTurn' || id === 'waitTurn2' || /^move(Up|Down|Left|Right)/.test(id);
}

// Build a normalized label from a KeyboardEvent, including Ctrl/Alt chords.
// Returns '' to indicate "ignore and keep listening" (e.g., invalid chord for movement).
function keyFromEvent(e, actId) {
  const base = normalizeKey(e.key);
  const ctrl = !!e.ctrlKey; // treat Meta as unsupported for now
  const alt = !!e.altKey;

  // Disallow multiple cording (Ctrl+Alt)
  if (ctrl && alt) return '';

  // Ignore pure modifier presses so Shift+Key works via case/symbols
  if (base === 'Shift' || base === 'Control' || base === 'Alt' || base === 'Meta' || base === 'OS' || base === 'CapsLock') return '';

  // Movement actions do not accept chords (Ctrl/Alt)
  if (isMovementActionId(actId) && (ctrl || alt)) return '';

  if (ctrl) return `Ctrl+${base}`;
  if (alt) return `Alt+${base}`;
  return base;
}

// Ensure any preset map contains an entry for every declared action id; default to unbound
function fillAllActions(map) {
  const out = { ...(map || {}) };
  KEY_GROUPS.forEach(g => {
    (g.actions || []).forEach(a => {
      if (!(a.id in out)) out[a.id] = '';
    });
  });
  return out;
}

// Load/save bindings
function loadBindings() {
  const preset = LS.getItem(PRESET_KEY, 'arrows');
  const saved = LS.getJSON(STORAGE_KEY, null);
  const base = PRESETS[preset] || PRESETS.arrows;
  return { preset, map: fillAllActions({ ...base, ...(saved || {}) }) };
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
    headerDesc = 'HJKL, WASD, arrows, or roll your own... pick your poison.',
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
      state.map = fillAllActions({ ...PRESETS[val] });
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
    state.map = fillAllActions({ ...(PRESETS[state.preset] || PRESETS.arrows) });
    saveBindings(state.preset, state.map);
    renderAll();
  };
  toolbar.appendChild(resetBtn);
  container.appendChild(toolbar);

  // Body note
  // container.appendChild(makeNote('Tip: Click a keycap, then press any key. Esc cancels. Backspace/Delete unbind.')); 

  // State and UI refs
  const state = loadBindings();
  const keyEls = new Map(); // actionId -> { btn, label }
  let extMirrorEls = []; // mirrors of extended prefix within extended rows

  // Initialize preset dropdown label
  try { presetDD.setValue(state.preset, false); } catch (_) {}

  // Render key groups
  KEY_GROUPS.forEach((g) => {
    // Skip groups that are integrated elsewhere
    if (g.id === 'movementSecondary' || g.id === 'travel') {
      return;
    }

    const gSec = makeSection(g.title, g.quip);
    try { gSec.style.margin = '1rem 0'; } catch (_) {}
    container.appendChild(gSec);

    // Special layout for Movement: circular arrows with themed keycaps
    if (g.id === 'movement') {
      // Dual movement rings: left Primary uses 'movement' actions, right Secondary uses 'movementSecondary'
      const duo = document.createElement('div');
      duo.className = 'sf-kb-move-duo';

      function ringFor(groupId, title, ids) {
        const col = document.createElement('div');
        col.className = 'sf-kb-move-col';
        const titleEl = document.createElement('div');
        titleEl.className = 'sf-kb-move-title';
        titleEl.textContent = title;
        col.appendChild(titleEl);
        const circle = document.createElement('div');
        circle.className = 'sf-kb-move-circle';
        col.appendChild(circle);

        const center = 110; // half of 220px box
        const rArrow = 87;  // outer radius for arrow glyphs
        const rKey = 55;    // inner radius for keycaps

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
          // Find action definition across KEY_GROUPS by id
          let act = null;
          for (const gg of KEY_GROUPS) { const f = (gg.actions || []).find(a => a.id === actId); if (f) { act = f; break; } }
          if (!act) return;
          const cur = state.map[act.id] || '';
          const cap = buildKeycap(act, cur ? prettyKey(cur) : '', 'themed', { mode: 'far', placement: 't' });
          place(cap.btn, angleDeg, radius);
          updateTooltip(cap.btn, `${act.label} — ${cur ? 'bound to: ' + prettyKey(cur) : 'UNBOUND'}. Click to rebind`);
          cap.btn.onclick = () => startListening(cap.btn, act);
          keyEls.set(act.id, { btn: cap.btn, lab: cap.lab, label: act.label, mglyph: false });
          circle.appendChild(cap.btn);
        }

        // Arrows
        addArrow(-135, MOVE_GLYPHS.moveUpLeft);
        addArrow(-90,  MOVE_GLYPHS.moveUp);
        addArrow(-45,  MOVE_GLYPHS.moveUpRight);
        addArrow(180,  MOVE_GLYPHS.moveLeft);
        addArrow(0,    MOVE_GLYPHS.moveRight);
        addArrow(135,  MOVE_GLYPHS.moveDownLeft);
        addArrow(90,   MOVE_GLYPHS.moveDown);
        addArrow(45,   MOVE_GLYPHS.moveDownRight);

        // Keycaps slightly inside the arrows
        addKey(ids.ul, -135, rKey);
        addKey(ids.u,  -90,  rKey);
        addKey(ids.ur, -45,  rKey);
        addKey(ids.l,  180,  rKey);
        addKey(ids.c,  0,    0);   // center wait
        addKey(ids.r,  0,    rKey);
        addKey(ids.dl, 135,  rKey);
        addKey(ids.d,  90,   rKey);
        addKey(ids.dr, 45,   rKey);

        return col;
      }

      const primary = ringFor('movement', 'Primary', {
        ul: 'moveUpLeft', u: 'moveUp', ur: 'moveUpRight', l: 'moveLeft', c: 'waitTurn', r: 'moveRight', dl: 'moveDownLeft', d: 'moveDown', dr: 'moveDownRight'
      });
      const secondary = ringFor('movementSecondary', 'Secondary', {
        ul: 'moveUpLeft2', u: 'moveUp2', ur: 'moveUpRight2', l: 'moveLeft2', c: 'waitTurn2', r: 'moveRight2', dl: 'moveDownLeft2', d: 'moveDown2', dr: 'moveDownRight2'
      });

      duo.appendChild(primary);
      duo.appendChild(secondary);
      gSec.appendChild(duo);
      return; // done with movement group
    }

    // Special layout for Movement (additional): four-column grid (label,key | label,key)
    if (g.id === 'movementAdvanced') {
      const wrap = document.createElement('div');
      wrap.className = 'sf-kb-two-col-keys';
      gSec.appendChild(wrap);

      const rightIds = ['ascendStairs', 'autoTravel', 'rideMonster', 'sitDown'];

      function findActById(id) {
        for (const gg of KEY_GROUPS) { const f = (gg.actions || []).find(a => a.id === id); if (f) return f; }
        return null;
      }

      const leftActs = (g.actions || []).filter(a => !rightIds.includes(a.id));
      const rightActs = rightIds.map(id => findActById(id)).filter(Boolean);
      const rows = Math.max(leftActs.length, rightActs.length);

      function appendPair(act) {
        if (!act) {
          const emptyLab = document.createElement('div'); emptyLab.className = 'sf-kb-label'; emptyLab.textContent = '';
          const emptyCap = document.createElement('div'); emptyCap.style.minHeight = '30px';
          wrap.appendChild(emptyLab); wrap.appendChild(emptyCap);
          return;
        }
        const lab = document.createElement('div');
        lab.className = 'sf-kb-label';
        lab.textContent = act.label;
        wrap.appendChild(lab);
        const k0 = state.map[act.id] || '';
        const cap = buildKeycap(act, k0 ? prettyKey(k0) : '', '', { mode: 'far', placement: 'r' });
        updateTooltip(cap.btn, `${act.label} — bound to: ${k0 ? prettyKey(k0) : 'Unbound'}. Click to rebind`);
        cap.btn.onclick = () => startListening(cap.btn, act);
        wrap.appendChild(cap.btn);
        keyEls.set(act.id, { btn: cap.btn, lab: cap.lab, label: act.label, mglyph: false });
      }

      for (let i = 0; i < rows; i++) {
        appendPair(leftActs[i]);
        appendPair(rightActs[i]);
      }

      return; // done with movement additional
    }

    // Special layout for Extended Commands: show [prefix] + [key]
    if (g.id === 'extended') {
      const wrap = document.createElement('div');
      gSec.appendChild(wrap);

      // Static letters for common extended commands (display only)
      const EXTENDED_ROWS = [
        { id: 'rideMonster', label: 'Ride', letter: 'r' },
        { id: 'twoWeapon', label: 'Two-Weapon', letter: 't' },
        { id: 'listChallenges', label: 'Conduct', letter: 'c' },
      ];

      g.actions.forEach((act) => {
        const row = document.createElement('div');
        row.className = 'sf-kb-row';

        const lab = document.createElement('div');
        lab.className = 'sf-kb-label';
        lab.textContent = act.label;
        row.appendChild(lab);

        if (act.id === 'extendedPrefix') {
          const k0 = state.map[act.id] || '';
          const cap = buildKeycap(act, k0 ? prettyKey(k0) : '', '', { mode: 'far', placement: 'r' });
          updateTooltip(cap.btn, `${act.label} — ${k0 ? 'bound to: ' + prettyKey(k0) : 'UNBOUND'}. Click to rebind`);
          cap.btn.onclick = () => startListening(cap.btn, act);
          row.appendChild(cap.btn);
          keyEls.set(act.id, { btn: cap.btn, lab: cap.lab, label: act.label, mglyph: false });
          wrap.appendChild(row);
        } else {
          // Mirror of prefix (non-interactive) + static command letter
          const rowDef = EXTENDED_ROWS.find(r => r.id === act.id);
          const prefixAct = { id: 'extendedPrefix', label: 'Extended Prefix' };
          const pk = state.map['extendedPrefix'] || '';
          const pcap = buildKeycap(prefixAct, pk ? prettyKey(pk) : '', '', { mode: 'far', placement: 'l' });
          pcap.btn.style.pointerEvents = 'none';
          updateTooltip(pcap.btn, `Prefix — ${pk ? 'bound to: ' + prettyKey(pk) : 'UNBOUND'} (mirrored)`);

          const plus = document.createElement('span');
          plus.textContent = ' + ';
          plus.style.margin = '0 6px';
          plus.style.color = 'var(--ui-fg, #eee)';

          const letter = rowDef && rowDef.letter ? rowDef.letter : '';
          const dummyAct = { id: `extendedLetter_${act.id}`, label: act.label };
          const lcap = buildKeycap(dummyAct, letter ? prettyKey(letter) : '', '', { mode: 'far', placement: 'r' });
          lcap.btn.style.pointerEvents = 'none';
          updateTooltip(lcap.btn, `${act.label} key — ${letter ? prettyKey(letter) : 'n/a'} (fixed)`);

          const right = document.createElement('div');
          right.style.display = 'flex';
          right.style.alignItems = 'center';
          right.appendChild(pcap.btn);
          right.appendChild(plus);
          right.appendChild(lcap.btn);
          row.appendChild(right);

          // Track mirror elements so we can refresh them when prefix changes
          if (!extMirrorEls) extMirrorEls = [];
          extMirrorEls.push({ lab: pcap.lab, btn: pcap.btn });
          // Do NOT register this display-only row in keyEls, to avoid overriding actual action buttons elsewhere
          wrap.appendChild(row);
        }
      });
      return; // done with extended group
    }

    // Skip rendering movementSecondary as a plain list; it's displayed via the second movement ring
    if (g.id === 'movementSecondary') {
      return;
    }

    // Default layout: labeled rows with key on the right
    const wrap = document.createElement('div');
    // Use two columns when there are many actions, or for specific groups (magic, spiritual)
    const useTwoCol = (g.id === 'magic' || g.id === 'spiritual') || (g.actions && g.actions.length >= 12);
    if (useTwoCol) wrap.className = 'sf-kb-two-col';
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
      const isWide = (txt === 'Enter' || txt === 'Space' || (txt && (txt.includes('+') || txt.length > 1)));
      if (refs.btn) refs.btn.classList.toggle('wide', isWide);
      // Dim unassigned
      if (!k) refs.btn.classList.add('unbound'); else refs.btn.classList.remove('unbound');
      // Tooltip reflects binding
      const label = refs.label || actId;
      updateTooltip(refs.btn, `${label} — ${k ? 'bound to: ' + prettyKey(k) : 'UNBOUND'}. Click to rebind`);

      // If this is an extended row, mirror the prefix keycap too
      if (refs.prefixLab) {
        const pk = state.map['extendedPrefix'] || '';
        const ptxt = pk ? prettyKey(pk) : '';
        refs.prefixLab.textContent = ptxt;
        if (refs.prefixBtn) {
          const isWideP = (ptxt === 'Enter' || ptxt === 'Space');
          refs.prefixBtn.classList.toggle('wide', isWideP);
          if (!pk) refs.prefixBtn.classList.add('unbound'); else refs.prefixBtn.classList.remove('unbound');
          updateTooltip(refs.prefixBtn, `Prefix — ${pk ? 'bound to: ' + prettyKey(pk) : 'UNBOUND'} (mirrored)`);
        }
      }
    }

    // Also refresh any tracked extended prefix mirror keycaps
    if (extMirrorEls && extMirrorEls.length) {
      const pk = state.map['extendedPrefix'] || '';
      const ptxt = pk ? prettyKey(pk) : '';
      extMirrorEls.forEach(m => {
        if (m.lab) m.lab.textContent = ptxt;
        if (m.btn) {
          const isWideP = (ptxt === 'Enter' || ptxt === 'Space');
          m.btn.classList.toggle('wide', isWideP);
          if (!pk) m.btn.classList.add('unbound'); else m.btn.classList.remove('unbound');
          updateTooltip(m.btn, `Prefix — ${pk ? 'bound to: ' + prettyKey(pk) : 'UNBOUND'} (mirrored)`);
        }
      });
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
      // Build chord-aware binding (Ctrl/Alt), ignoring invalid combos and pure modifiers
      const keyNorm = keyFromEvent(e, act.id);
      if (!keyNorm) { return; }
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
