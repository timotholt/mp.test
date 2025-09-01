// Controls Tab: renders Controls settings for panel and overlay
// Human-readable, commented, and variant-aware per project conventions.
// Adds a themed, minimal keybinding editor with presets, conflict handling,
// and reset. JS-only changes; no external CSS/HTML files touched.

import { createDropdown } from '../../../core/ui/controls.js';
import { updateTooltip } from '../../../core/ui/tooltip.js';
import { ensureKeycapStyle, buildKeycap } from '../../../core/ui/keycap.js';
import * as LS from '../../../core/localStorage.js';
import { PRESETS } from '../../../core/ui/modals/settings/tabs/control/presets.js';
import { KEY_GROUPS } from '../../../core/ui/modals/settings/tabs/control/keyGroups.js';
import { MOVE_GLYPHS, WIDE_KEY_NAMES } from '../../../core/ui/modals/settings/tabs/control/constants.js';
import { renderExtendedGroup } from '../../../core/ui/modals/settings/tabs/control/renderers/extended.js';
import { renderMovementGroup } from '../../../core/ui/modals/settings/tabs/control/renderers/movement.js';
import { renderDefaultTwoColGroup } from '../../../core/ui/modals/settings/tabs/control/renderers/defaultTwoCol.js';
import { ensureControlsKbStyle } from '../../../core/ui/modals/settings/tabs/control/styles.js';
import { normalizeKey, prettyKey, isMovementActionId, keyFromEvent, splitChord } from '../../../core/ui/modals/settings/tabs/control/ui.js';

// Storage keys (namespaced via LS helper)
const STORAGE_KEY = 'keybinds.map';
const PRESET_KEY = 'keybinds.preset';

// Presets organized to mirror KEY_GROUPS order. Unknowns intentionally left blank ('').
/* const PRESETS = {
  // Arrow keys baseline (minimal)
  arrows: {
    // Movement (primary)
    moveUp: 'ArrowUp',
    moveDown: 'ArrowDown',
    moveLeft: 'ArrowLeft',
    moveRight: 'ArrowRight',
    moveUpLeft: '',
    moveUpRight: '',
    moveDownLeft: '',
    moveDownRight: '',
    waitTurn: '',
    // Movement (secondary)
    moveUp2: '', moveDown2: '', moveLeft2: '', moveRight2: '',
    moveUpLeft2: '', moveUpRight2: '', moveDownLeft2: '', moveDownRight2: '', waitTurn2: '',
    // Movement (additional)
    quickMove: '', moveFar: '', jump: '', teleport: '',
    // Travel & Stairs
    ascendStairs: '', descendStairs: '', autoTravel: '', rideMonster: '', sitDown: '',
    // Interaction
    search: '', look: '', open: '', close: '', kick: '', lootContainer: '', untrap: '', forceLock: '', identifySymbol: '', identifyTrap: '', nameMonster: '', wipeFace: '', engrave: '', writeInscription: '', pay: '',
    // Magic & Spiritual
    castSpell: '', drink: '', zapWand: '', pray: '', dip: '', rub: '', offer: '', invoke: '', turnUndead: '', specialAbility: '', breakWand: '',
    // Combat
    wield: '', swapWeapon: '', throw: '', fire: '', targetNext: '', twoWeapon: '', viewSkills: '', raiseSkills: '',
    // Inventory & Items
    inventory: '', pickup: '', drop: '', dropMany: '', apply: '', eat: '', read: '', zap: '', quaff: '', wear: '', remove: '', quiverSelect: '', adjustInventory: '', nameObject: '', listWeapons: '', listArmor: '', listRings: '', listAmulets: '', listTools: '', listEquipment: '', listGold: '', listSpells: '', wearArmor: '', takeoffArmor: '', removeMulti: '', putOnRingAmulet: '', removeRingAmulet: '', listDiscoveries: '', listChallenges: '',
    // Extended (independent letter assignments)
    extendedPrefix: '#',
    extHelp: '?',
    extJump: 'j',
    extRide: 'r',
    extLoot: 'l',
    extUntrap: 'u',
    extTwoWeapon: 't',
    extNameObject: 'n',
    extListChallenges: 'c',
    // System & UI
    help: '', messageHistory: '', options: '', saveQuit: '', fullscreenToggle: '', playerInfo: '', save: '', quit: '', redo: '', talk: '', repeatMessage: '', toggleAutopickup: '', displayVersion: '', displayHistory: '', exploreMode: '', explainCommand: '', redrawScreen: '', suspend: '', bossKey: '',
  },

  // Vim/HJKL with diagonals and common NetHack commands
  vim: {
    // Movement (primary)
    moveUp: 'k',
    moveDown: 'j',
    moveLeft: 'h',
    moveRight: 'l',
    moveUpLeft: 'y',
    moveUpRight: 'u',
    moveDownLeft: 'b',
    moveDownRight: 'n',
    waitTurn: '.', // rest one turn
    // Movement (secondary)
    moveUp2: '',
    moveDown2: '',
    moveLeft2: '',
    moveRight2: '',
    moveUpLeft2: '',
    moveUpRight2: '',
    moveDownLeft2: '',
    moveDownRight2: '',
    waitTurn2: '',

    // Movement (additional)
    quickMove: 'g',   // go until something interesting
    moveFar: 'G',     // travel far
    jump: '',         // extended in NetHack; leave blank
    teleport: '',     // extended; leave blank

    // Travel & Stairs
    ascendStairs: '<',
    descendStairs: '>',
    autoTravel: 'g',  // alias of quick go; can be overridden
    rideMonster: '',  // extended: #ride
    sitDown: '',      // extended: #sit

    // Interaction
    search: 's',
    look: ':',
    open: 'o',
    close: 'c',
    kick: 'Ctrl+d',   // classic NetHack chord
    lootContainer: '',
    untrap: '',
    forceLock: '',
    identifySymbol: '/',
    identifyTrap: '^',
    nameMonster: 'C', // call monster/object class
    wipeFace: 'Ctrl+f', // approximate; often extended
    engrave: 'E',
    writeInscription: '',
    pay: 'p',
    // Magic & Spiritual
    castSpell: 'Z',
    drink: 'q',
    zapWand: 'z',
    pray: 'Ctrl+p',   // prayer via menu in some ports; placeholder chord
    dip: 'd',         // dip object
    rub: 'r',         // rub lamp
    offer: 'O',       // offer/sacrifice
    invoke: 'V',
    turnUndead: '',
    specialAbility: 'a', // apply as generic ability
    breakWand: '',

    // Combat
    wield: 'w',
    swapWeapon: 'x',
    throw: 't',
    fire: 'f',
    targetNext: ';',
    twoWeapon: 'X',
    viewSkills: 'S',
    raiseSkills: '',

    // Inventory & Items
    inventory: 'i',
    pickup: ',',
    drop: 'd',
    dropMany: 'D',
    apply: 'a',
    eat: 'e',
    read: 'r',
    quaff: 'q',
    wear: 'P',              // put on ring/amulet (classic P)
    remove: 'R',            // remove ring/amulet
    quiverSelect: 'Q',      // set quiver (ports vary)
    adjustInventory: 'A',   // adjust inventory letters
    nameObject: 'C',        // call
    listWeapons: ')',
    listArmor: ']',
    listRings: '=',
    listAmulets: '"',
    listTools: '(',
    listEquipment: '',
    listGold: '$',
    listSpells: '+',
    wearArmor: 'W',
    takeoffArmor: 'T',
    removeMulti: 'A',
    putOnRingAmulet: 'P',
    removeRingAmulet: 'R',
    listDiscoveries: '\\',
    listChallenges: '',
    // Extended (independent letter assignments)
    extendedPrefix: '#',
    extHelp: '?',           // # + ? = Help
    extJump: 'j',           // # + j = Jump
    extRide: 'r',           // # + r = Ride
    extLoot: 'l',           // # + l = Loot
    extUntrap: 'u',         // # + u = Untrap
    extTwoWeapon: 't',      // # + t = Two-Weapon
    extNameObject: 'n',     // # + n = Name Object
    extListChallenges: 'c', // # + c = List Challenges
    // System & UI
    help: '?',
    messageHistory: 'Ctrl+p',
    options: 'O',
    saveQuit: 'S',
    fullscreenToggle: '',
    playerInfo: '@',
    save: 'S',
    quit: 'Q',
    redo: '',
    talk: 'C',
    repeatMessage: 'Ctrl+p',
    toggleAutopickup: 'Ctrl+a',
    displayVersion: 'v',
    displayHistory: 'H',
    exploreMode: 'X',
    explainCommand: '/',
    redrawScreen: 'Ctrl+r',
    suspend: 'Ctrl+z',
    bossKey: '',
  },

  // WASD built from vim: QWE / ASD / ZXC for movement; digits for secondary.
  wasd: {
    // Movement (primary, 3x3 grid)
    moveUpLeft: 'q',
    moveUp: 'w',
    moveUpRight: 'e',
    moveLeft: 'a',
    waitTurn: 's',
    moveRight: 'd',
    moveDownLeft: 'z',
    moveDown: 'x',
    moveDownRight: 'c',
    // Movement (secondary via numpad digits)
    moveUpLeft2: '7', moveUp2: '8', moveUpRight2: '9',
    moveLeft2: '4',  waitTurn2: '5', moveRight2: '6',
    moveDownLeft2: '1', moveDown2: '2', moveDownRight2: '3',
    // Movement (additional)
    quickMove: 'g', moveFar: 'G', jump: '', teleport: '',
    // Travel & Stairs
    ascendStairs: '<', descendStairs: '>', autoTravel: 'g', rideMonster: '', sitDown: '',
    // Interaction (inherit vim where sensible)
    search: 's', look: ':', open: 'o', close: 'c', kick: 'Ctrl+d', lootContainer: '', untrap: '', forceLock: '', identifySymbol: '/', identifyTrap: '^', nameMonster: 'C', wipeFace: 'Ctrl+f', engrave: 'E', writeInscription: '', pay: 'p',
    // Magic & Spiritual
    castSpell: 'Z', drink: 'q', zapWand: 'z', pray: 'Ctrl+p', dip: 'd', rub: 'r', offer: 'O', invoke: 'V', turnUndead: '', specialAbility: 'a', breakWand: '',
    // Combat
    wield: 'w', swapWeapon: 'x', throw: 't', fire: 'f', targetNext: ';', twoWeapon: 'X', viewSkills: 'S', raiseSkills: '',
    // Inventory & Items
    inventory: 'i', pickup: ',', drop: 'd', dropMany: 'D', apply: 'a', eat: 'e', read: 'r', zap: 'z', quaff: 'q', wear: 'P', remove: 'R', quiverSelect: 'Q', adjustInventory: 'A', nameObject: 'C', listWeapons: ')', listArmor: ']', listRings: '=', listAmulets: '"', listTools: '(', listEquipment: '', listGold: '$', listSpells: '+', wearArmor: 'W', takeoffArmor: 'T', removeMulti: 'A', putOnRingAmulet: 'P', removeRingAmulet: 'R', listDiscoveries: '\\', listChallenges: '',
    // Extended (independent letter assignments)
    extendedPrefix: '#',
    extHelp: '?', extJump: 'j', extRide: 'r', extLoot: 'l', extUntrap: 'u', extTwoWeapon: 't', extNameObject: 'n', extListChallenges: 'c',
    // System & UI
    help: '?', messageHistory: 'Ctrl+p', options: 'O', saveQuit: 'S', fullscreenToggle: '', playerInfo: '@', save: 'S', quit: 'Q', redo: '', talk: 'C', repeatMessage: 'Ctrl+p', toggleAutopickup: 'Ctrl+a', displayVersion: 'v', displayHistory: 'H', exploreMode: 'X', explainCommand: '/', redrawScreen: 'Ctrl+r', suspend: 'Ctrl+z', bossKey: '',
  },
}; */

const PRESET_ITEMS = [
  { label: 'Custom', value: 'custom' },
  { label: 'Arrow Keys', value: 'arrows' },
  { label: 'WASD', value: 'wasd' },
  { label: 'Vim (HJKL)', value: 'vim' },
];

// Arrow glyphs for movement ring and wait
/* const MOVE_GLYPHS = {
  moveUpLeft: '↖',
  moveUp: '↑',
  moveUpRight: '↗',
  moveLeft: '←',
  waitTurn: '•',
  moveRight: '→',
  moveDownLeft: '↙',
  moveDown: '↓',
  moveDownRight: '↘',
}; */

// Centralized list of key names that should render as wide keycaps.
// Includes both 'Delete' and shorthand 'Del' and common nav keys.
/* const WIDE_KEY_NAMES = new Set([
  'Enter','Space','Tab','CapsLock','Insert','Delete','Del',
  'PageUp','PageDown','Home','End','PrintScreen'
]); */

// Groups and actions description for rendering
// Inspired by the NetHack keyboard reference PDF for familiarity.
/* const KEY_GROUPS = [
  // Movement (primary 4-way + diagonals + wait)
  {
    id: 'movement',
    title: 'Movement',
    quip: '',
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
    title: 'Movement (Additional)',
    quip: '',
    actions: [
      { id: 'ascendStairs', label: 'Ascend Stairs' },
      { id: 'descendStairs', label: 'Descend Stairs' },
      { id: 'quickMove', label: 'Quick Move' },
      { id: 'moveFar', label: 'Move Far' },
      { id: 'jump', label: 'Jump' },
      { id: 'teleport', label: 'Teleport' },
      { id: 'autoTravel', label: 'Auto-Travel/Run' },
      { id: 'rideMonster', label: 'Ride Monster' },
      { id: 'sitDown', label: 'Sit Down' },
    ],
  },
  // Interaction / environment
  {
    id: 'interaction',
    title: 'Interaction',
    quip: '',
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
    quip: '',
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
    quip: '',
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
    quip: '',
    actions: [
      { id: 'inventory', label: 'Open Inventory' },
      { id: 'pickup', label: 'Pick Up' },
      { id: 'drop', label: 'Drop' },
      { id: 'dropMany', label: 'Drop Many' },
      { id: 'apply', label: 'Apply/Use' },
      { id: 'eat', label: 'Eat' },
      { id: 'read', label: 'Read' },
      { id: 'quaff', label: 'Quaff' },
      { id: 'wear', label: 'Wear/Put On' },
      { id: 'remove', label: 'Remove/Take Off' },
      { id: 'quiverSelect', label: 'Select Quiver' },
      { id: 'adjustInventory', label: 'Adjust Inventory' },
      { id: 'nameObject', label: 'Name Object' },
      { id: 'wearArmor', label: 'Wear Armor' },
      { id: 'takeoffArmor', label: 'Take Off Armor' },
      { id: 'removeMulti', label: 'Remove Multiple Items' },
      { id: 'putOnRingAmulet', label: 'Put On Ring/Amulet' },
      { id: 'removeRingAmulet', label: 'Remove Ring/Amulet' },
    ],
  },
  // Lists (moved out of Inventory & Items)
  {
    id: 'lists',
    title: 'Lists',
    quip: '',
    actions: [
      { id: 'listWeapons', label: 'List Weapons' },
      { id: 'listArmor', label: 'List Armor' },
      { id: 'listRings', label: 'List Rings' },
      { id: 'listAmulets', label: 'List Amulets' },
      { id: 'listTools', label: 'List Tools' },
      { id: 'listEquipment', label: 'List Equipment' },
      { id: 'listGold', label: 'List Gold' },
      { id: 'listSpells', label: 'List Spells' },
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
      { id: 'extHelp', label: 'Help' },
      { id: 'extJump', label: 'Jump' },
      { id: 'extRide', label: 'Ride' },
      { id: 'extLoot', label: 'Loot Box / Bag' },
      { id: 'extUntrap', label: 'Untrap' },
      { id: 'extTwoWeapon', label: 'Two Weapons' },
      { id: 'extNameObject', label: 'Name Object' },
      { id: 'extListChallenges', label: 'List Challenges' },
    ],
  },
  // System & UI
  {
    id: 'system',
    title: 'System & UI',
    quip: '',
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
]; */

// Find an action definition by id (shared)
function findActById(id) {
  for (const gg of KEY_GROUPS) {
    const f = (gg.actions || []).find(a => a.id === id);
    if (f) return f;
  }
  return null;
}




// (buildKeycap is imported from core/ui/keycap.js)


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
    headerDesc = 'Pick your poison. HJKL, WASD, or roll your own.',
    variant = 'panel', // currently unused but reserved for future differences
  } = opts || {};

  ensureKeycapStyle();
  ensureControlsKbStyle();

  // Section header
  const sec = makeSection(headerTitle, headerDesc, 'afterTitle', true);
  container.appendChild(sec);

  // Toolbar: Preset dropdown + Reset button
  const toolbar = document.createElement('div');
  toolbar.className = 'sf-kb-toolbar';
  toolbar.style.margin = '6px 0 12px 0';

  const presetDD = createDropdown({
    items: PRESET_ITEMS,
    value: null,
    onChange: (val) => {
      if (val === 'custom') {
        // Preserve current bindings; just mark preset as custom and remember last real preset
        if (state.preset !== 'custom') {
          state.lastPreset = state.preset;
          try { LS.setItem('keybinds.lastPreset', state.lastPreset); } catch (_) {}
        }
        state.preset = 'custom';
        saveBindings(state.preset, state.map);
        renderAll();
        return;
      }
      state.preset = val;
      state.map = fillAllActions({ ...(PRESETS[val] || {}) });
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
    let targetPreset = state.preset;
    if (state.preset === 'custom') {
      // restore to lastPreset if available, else arrows
      const last = state.lastPreset || LS.getItem('keybinds.lastPreset', 'arrows');
      targetPreset = last || 'arrows';
      state.preset = targetPreset;
    }
    state.map = fillAllActions({ ...(PRESETS[targetPreset] || PRESETS.arrows) });
    saveBindings(state.preset, state.map);
    renderAll();
  };
  toolbar.appendChild(resetBtn);
  container.appendChild(toolbar);

  // Body note
  // container.appendChild(makeNote('Tip: Click a keycap, then press any key. Esc cancels. Backspace/Delete unbind.')); 

  // State and UI refs
  const state = loadBindings();
  const keyEls = new Map(); // actionId -> [ { cell?, btn, btns?, lab, labs?, label, isChord?, mglyph? } ]
  const arrowByAction = new Map(); // actionId -> arrow span element
  let extMirrorEls = []; // mirrors of extended prefix within extended rows
  let listening = null; // { btn, act, timer }

  function registerKeyEl(id, refs) {
    const arr = keyEls.get(id) || [];
    // Replace existing entry for same cell to avoid duplicate refs on rebuilds
    if (refs.cell) {
      const idx = arr.findIndex(r => r && r.cell === refs.cell);
      if (idx !== -1) {
        arr[idx] = refs;
        keyEls.set(id, arr);
        return;
      }
    }
    // Also guard against duplicate registration of the same button(s)
    if (refs.btn && arr.some(r => r && r.btn === refs.btn)) {
      keyEls.set(id, arr);
      return;
    }
    if (refs.btns && arr.some(r => r && r.btns && r.btns[0] === refs.btns[0])) {
      keyEls.set(id, arr);
      return;
    }
    arr.push(refs);
    keyEls.set(id, arr);
  }

  // splitChord, keyFromEvent, prettyKey, etc. are imported from ui.js

  function attachKeyForAction(cell, act) {
    while (cell.firstChild) cell.removeChild(cell.firstChild);
    const k0 = state.map[act.id] || '';
    const chord = splitChord(k0);
    if (!k0) {
      const cap = buildKeycap(act, '', '', { mode: 'far', placement: 'r' });
      updateTooltip(cap.btn, `${act.label} — UNBOUND. Click to rebind`);
      cap.btn.onclick = () => startListening(cap.btn, act);
      cap.btn.classList.add('unbound');
      cell.appendChild(cap.btn);
      registerKeyEl(act.id, { cell, btn: cap.btn, lab: cap.lab, label: act.label, isChord: false, mglyph: false, act });
      return;
    }
    if (chord) {
      const wrap = document.createElement('div');
      wrap.className = 'sf-kb-chord';
      const pcap = buildKeycap(act, chord.prefix, 'themed', { mode: 'far', placement: 'l' });
      const plus = document.createElement('span'); plus.textContent = '+'; plus.className = 'plus';
      const basePretty = prettyKey(chord.base);
      const bcap = buildKeycap(act, basePretty, '', { mode: 'far', placement: 'r' });
      [pcap.btn, bcap.btn].forEach(b => { b.onclick = () => startListening(b, act); });
      updateTooltip(pcap.btn, `${act.label} — bound to: ${k0}. Click to rebind`);
      updateTooltip(bcap.btn, `${act.label} — bound to: ${k0}. Click to rebind`);
      // Force modifier wide, base non-wide per spec (e.g., Ctrl + x)
      try { pcap.btn.classList.add('wide'); } catch (_) {}
      // Special-case: wide base for long-labeled keys like Enter/Insert/etc.
      try {
        const isNum = !!basePretty && basePretty.startsWith('Num');
        bcap.btn.classList.toggle('wide', isNum || WIDE_KEY_NAMES.has(basePretty));
      } catch (_) {}
      wrap.appendChild(pcap.btn); wrap.appendChild(plus); wrap.appendChild(bcap.btn);
      cell.appendChild(wrap);
      registerKeyEl(act.id, { cell, btns: [pcap.btn, bcap.btn], labs: [pcap.lab, bcap.lab], label: act.label, isChord: true, mglyph: false, act });
      return;
    }
    const _txt = prettyKey(k0);
    const cap = buildKeycap(act, _txt, '', { mode: 'far', placement: 'r' });
    updateTooltip(cap.btn, `${act.label} — bound to: ${_txt}. Click to rebind`);
    cap.btn.onclick = () => startListening(cap.btn, act);
    // Ensure special single keys render as wide immediately
    try {
      const isWideSingle = !!_txt && (WIDE_KEY_NAMES.has(_txt) || _txt.length > 1);
      cap.btn.classList.toggle('wide', isWideSingle);
    } catch (_) {}
    cell.appendChild(cap.btn);
    registerKeyEl(act.id, { cell, btn: cap.btn, lab: cap.lab, label: act.label, isChord: false, mglyph: false, act });
  }

  // Initialize preset dropdown label
  try { presetDD.setValue(state.preset, false); } catch (_) {}

  // Render key groups
  KEY_GROUPS.forEach((g) => {
    // Skip groups that are integrated elsewhere
    if (g.id === 'movementSecondary') {
      return;
    }

    // Match previous look: rule directly after the title (before any quip)
    const gSec = makeSection(g.title, g.quip, 'afterTitle');
    try { gSec.style.margin = '1rem 0'; } catch (_) {}
    container.appendChild(gSec);

    // Special layout for Movement: circular arrows with themed keycaps
    if (g.id === 'movement') {
      renderMovementGroup({
        g,
        gSec,
        state,
        registerKeyEl,
        prettyKey,
        buildKeycap,
        updateTooltip,
        startListening,
        arrowByAction,
        KEY_GROUPS,
        MOVE_GLYPHS,
      });
      return; // done with movement group
    }

    // (Movement Additional) now uses default two-column layout; no special-casing

    // Combat: render as four-column grid like movement additional
    if (g.id === 'combat') {
      const wrap = document.createElement('div');
      wrap.className = 'sf-kb-two-col-keys';
      gSec.appendChild(wrap);

      function appendPair(act) {
        if (!act) {
          const emptyLab = document.createElement('div'); emptyLab.className = 'sf-kb-label'; emptyLab.textContent = '';
          const emptyCell = document.createElement('div'); emptyCell.className = 'sf-kb-cell'; emptyCell.style.minHeight = '30px';
          wrap.appendChild(emptyLab); wrap.appendChild(emptyCell);
          return;
        }
        const lab = document.createElement('div');
        lab.className = 'sf-kb-label';
        lab.textContent = act.label;
        wrap.appendChild(lab);
        const cell = document.createElement('div');
        cell.className = 'sf-kb-cell';
        wrap.appendChild(cell);
        attachKeyForAction(cell, act);
      }

      const acts = (g.actions || []).slice();
      for (let i = 0; i < acts.length; i += 2) {
        appendPair(acts[i]);
        appendPair(acts[i + 1]);
      }
      return; // done with combat
    }

    // Special layout for Extended Commands: show [prefix] + [interactive letter]
    if (g.id === 'extended') {
      renderExtendedGroup({
        g,
        gSec,
        state,
        registerKeyEl,
        prettyKey,
        buildKeycap,
        updateTooltip,
        startListening,
        extMirrorEls,
      });
      return; // done with extended group
    }

    // movementSecondary is already skipped above; no need to guard again

    // Default layout: labeled rows with key on the right (two-column when applicable)
    renderDefaultTwoColGroup({ g, gSec, attachKeyForAction });
  });

  // Apply initial binding visuals after creating all buttons
  renderAll();

  function renderAll() {
    // Update preset label
    try { presetDD.setValue(state.preset, false); } catch (_) {}
    // Update keycaps
    for (const [actId, list] of keyEls.entries()) {
      const k = state.map[actId] || '';
      // Refresh arrows opacity regardless of UI mirrors
      if (isMovementActionId(actId)) {
        const arrowEl = arrowByAction.get(actId);
        if (arrowEl) arrowEl.style.opacity = k ? '0.9' : '0.28';
      }
      for (const refs of list) {
        // Cell-based entries rebuild to handle chord/non-chord transitions cleanly
        if (refs.cell && refs.act) {
          attachKeyForAction(refs.cell, refs.act);
          continue;
        }
        const txt = k ? prettyKey(k) : '';
        if (refs.lab) refs.lab.textContent = txt; else if (refs.btn) refs.btn.textContent = txt;
        // Wide if special single key, chord, or multi-char label
        const isWide = !!txt && (WIDE_KEY_NAMES.has(txt) || txt.includes('+') || txt.length > 1);
        if (refs.btn) refs.btn.classList.toggle('wide', isWide);
        if (refs.btn) refs.btn.classList.toggle('unbound', !k);
        const label = refs.label || actId;
        if (refs.btn) updateTooltip(refs.btn, `${label} — ${k ? 'bound to: ' + prettyKey(k) : 'UNBOUND'}. Click to rebind`);
        // extended prefix mirrors
        if (refs.prefixLab) {
          const pk = state.map['extendedPrefix'] || '';
          const ptxt = pk ? prettyKey(pk) : '';
          refs.prefixLab.textContent = ptxt;
          if (refs.prefixBtn) {
            const isWideP = !!ptxt && (WIDE_KEY_NAMES.has(ptxt) || ptxt.length > 1);
            refs.prefixBtn.classList.toggle('wide', isWideP);
            refs.prefixBtn.classList.toggle('unbound', !pk);
            updateTooltip(refs.prefixBtn, `Prefix — ${pk ? 'bound to: ' + prettyKey(pk) : 'UNBOUND'} (mirrored)`);
          }
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
          const isWideP = !!ptxt && (WIDE_KEY_NAMES.has(ptxt) || ptxt.length > 1);
          m.btn.classList.toggle('wide', isWideP);
          if (!pk) m.btn.classList.add('unbound'); else m.btn.classList.remove('unbound');
          updateTooltip(m.btn, `Prefix — ${pk ? 'bound to: ' + prettyKey(pk) : 'UNBOUND'} (mirrored)`);
        }
      });
    }
  }

  // Helper: compare current map to a preset's base
  function isEqualToPreset(name) {
    const base = PRESETS[name] || {};
    // only compare keys present in base; if any differ, it's not equal
    for (const [k, v] of Object.entries(base)) {
      if ((state.map[k] || '') !== (v || '')) return false;
    }
    // also ensure no extra overrides beyond base for known actions
    for (const g of KEY_GROUPS) {
      for (const a of (g.actions || [])) {
        if (a.id in base) continue;
        // allow extra bindings outside the preset definition without affecting equality
      }
    }
    return true;
  }

  function bumpToCustom() {
    if (state.preset !== 'custom') {
      state.lastPreset = state.preset;
      try { LS.setItem('keybinds.lastPreset', state.lastPreset); } catch (_) {}
      state.preset = 'custom';
    }
    try { presetDD.setValue(state.preset, false); } catch (_) {}
  }

  function startListening(btn, act) {
    if (!btn || !act) return;
    // Cancel any previous listener
    if (listening) {
      try { listening.btn.classList.remove('listening'); } catch (_) {}
      try {
        if (listening.blinkBtns && listening.blinkBtns.length) {
          listening.blinkBtns.forEach(b => { try { b.classList.remove('listening'); } catch (_) {} });
        }
      } catch (_) {}
      try { window.removeEventListener('keydown', listening.onKey, true); } catch (_) {}
      try { window.removeEventListener('blur', listening.onBlur, true); } catch (_) {}
      if (listening.timer) clearTimeout(listening.timer);
      listening = null;
    }
    // Helper: gather all buttons that mirror this action id (and extended prefix mirrors)
    const collectBlinkBtns = (aid) => {
      const set = new Set();
      const pushBtn = (b) => { if (b) set.add(b); };
      const list = keyEls.get(aid) || [];
      list.forEach(r => {
        if (r.btn) pushBtn(r.btn);
        if (r.btns && r.btns.length) r.btns.forEach(pushBtn);
      });
      // If assigning the extended prefix, include all its mirrored prefix caps
      if (aid === 'extendedPrefix' && extMirrorEls && extMirrorEls.length) {
        extMirrorEls.forEach(m => pushBtn(m.btn));
      }
      return Array.from(set);
    };

    // Initial blink: apply to clicked btn and all mirrors
    const initialBlink = collectBlinkBtns(act.id);
    if (!initialBlink.includes(btn)) initialBlink.push(btn);
    initialBlink.forEach(b => { try { b.classList.add('listening'); b.classList.remove('unbound'); } catch (_) {} });
    btn.classList.add('listening');
    updateTooltip(btn, `Press a key for ${act.label} (Esc cancel, Backspace unbind)`);

    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const k = e.key;
      if (k === 'Escape') { cleanup(); return; }
      if (k === 'Backspace') {
        state.map[act.id] = '';
        bumpToCustom();
        saveBindings(state.preset, state.map);
        renderAll();
        // After updating UI, briefly blink the updated keycaps, then cleanup
        const postBlink = collectBlinkBtns(act.id);
        postBlink.forEach(b => { try { b.classList.add('listening'); b.classList.remove('unbound'); } catch (_) {} });
        if (listening) listening.blinkBtns = postBlink;
        if (listening && listening.timer) clearTimeout(listening.timer);
        listening.timer = setTimeout(() => cleanup(), 550);
        return;
      }
      // Build chord-aware binding (Ctrl/Alt), ignoring invalid combos and pure modifiers
      const keyNorm = keyFromEvent(e, act.id);
      if (!keyNorm) { return; }
      // Conflict handling: scope by domain (ext vs non-ext). Extended letters (ext*)
      // only conflict with other ext* actions. Base actions ignore ext* and extendedPrefix.
      // extendedPrefix remains globally conflicted for safety.
      let conflicted = null;
      const isExtAct = /^ext/.test(act.id);
      for (const [aid, val] of Object.entries(state.map)) {
        if (aid === act.id) continue;
        // Filter by domain
        if (act.id === 'extendedPrefix') {
          // No filter; prefix should remain unique overall
        } else if (isExtAct) {
          if (!/^ext/.test(aid)) continue; // ext letters ignore base/prefix conflicts
        } else {
          if (/^ext/.test(aid) || aid === 'extendedPrefix') continue; // base ignores ext letters and prefix
        }
        if (val === keyNorm) { conflicted = aid; break; }
      }
      if (conflicted) {
        // transiently highlight the conflicted keycap and show tooltip note
        const list = keyEls.get(conflicted) || [];
        list.forEach(r => {
          const b = r.btn || (r.btns && r.btns[0]);
          if (b) {
            b.classList.add('conflict');
            updateTooltip(b, `${r.label || conflicted} — CONFLICT: unbinding due to reassignment`);
            setTimeout(() => {
              b.classList.remove('conflict');
              const cur = state.map[conflicted] || '';
              updateTooltip(b, `${r.label || conflicted} — ${cur ? 'bound to: ' + prettyKey(cur) : 'UNBOUND'}. Click to rebind`);
            }, 1200);
          }
        });
        state.map[conflicted] = '';
      }
      state.map[act.id] = keyNorm;
      bumpToCustom();
      saveBindings(state.preset, state.map);
      renderAll();
      // After updating UI, briefly blink the updated keycaps, then cleanup
      const postBlink = collectBlinkBtns(act.id);
      postBlink.forEach(b => { try { b.classList.add('listening'); b.classList.remove('unbound'); } catch (_) {} });
      if (listening) listening.blinkBtns = postBlink;
      if (listening && listening.timer) clearTimeout(listening.timer);
      listening.timer = setTimeout(() => cleanup(), 550);
      return;
    };

    const onBlur = () => { cleanup(); };

    function cleanup() {
      try { window.removeEventListener('keydown', onKey, true); } catch (_) {}
      try { window.removeEventListener('blur', onBlur, true); } catch (_) {}
      btn.classList.remove('listening');
      try {
        if (listening && listening.blinkBtns && listening.blinkBtns.length) {
          listening.blinkBtns.forEach(b => { try { b.classList.remove('listening'); } catch (_) {} });
        }
      } catch (_) {}
      // Ensure UI reflects current state
      renderAll();
      if (listening && listening.timer) { clearTimeout(listening.timer); }
      listening = null;
    }

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur, true);
    listening = { btn, act, onKey, onBlur, blinkBtns: initialBlink, timer: setTimeout(() => cleanup(), 12000) };
    try { btn.focus(); } catch (_) {}
  }
}
