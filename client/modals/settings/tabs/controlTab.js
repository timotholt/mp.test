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
import { makeSection } from '../uiHelpers.js';
import { getQuip } from '../../../core/ui/quip.js';
import { createUiElement, basicButton, basicFormLabel } from '../../../core/ui/theme/themeManager.js';
import { basicSection, basicGapBetweenSections } from '../../../core/ui/theme/templates.js';

// Storage keys (namespaced via LS helper)
const STORAGE_KEY = 'keybinds.map';
const PRESET_KEY = 'keybinds.preset';


const PRESET_ITEMS = [
  { label: 'Custom', value: 'custom' },
  { label: 'Arrow Keys', value: 'arrows' },
  { label: 'WASD', value: 'wasd' },
  { label: 'Vim (HJKL)', value: 'vim' },
];


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

export function renderControlTab(container) {
  const headerTitle = 'Control Presets';
  const headerDesc = getQuip('settings.overlay.controlsTag', [
    'No one ever said roguelikes were easy to learn.',
    'You just wait. The next version will add 20 more commands.',
    'Your brain is way too small to remember all this.',
    'Hate VIM? Yea, me too.',
    'Hate WASD? Yea, me too.',
    "HJKL isn’t a phase, it’s a lifestyle.",
    'Arrow keys: the training wheels of greatness.',
    'WASD is for walking. Dying is on you.',
    'Remap boldly. Forget instantly.',
    'Press any key to panic.',
    'Presets are for cowards. Rebinding is for legends.',
    'Your pinky finger is the real tank.',
    'Pro tip: the spacebar does not pause life.',
    'Emacs users, we believe in you. Barely.',
    'Vim users already know where this is going.',
    'The best key is the one you meant to press.',
    'Pro-tip: Try binding Alt+F4 to move up.',
    'Numpad mains, your secret is safe with us.',
    'Every bind is a life choice. Most are bad.',
    'Set it, forget it, regret it.',
    'If you die, blame the keybinds. We always do.',
    'Muscle memory installed separately.',
    'Rebinding keys counts as cardio.',
    'One does not simply "learn all the commands".',
    "You will press the wrong key and die. It’s tradition.",
    'HJKL: One bind to rule them all',
    'No one ever said this was going to be easy. Or fun.',
    'Blank bind, blank mind.',
    "Those blank buttons aren't going to bind themselves.",
    "You can win even with blank binds. Source? Trust me bro.",
    "You want Brief or Pedit layouts? Sorry but NO.",
    "Every keystroke forges your destiny.",
    "Every keystroke changes your reality."
  ]);

  ensureKeycapStyle();
  ensureControlsKbStyle();

  // Section header
  const sec = makeSection(headerTitle, headerDesc, 'afterTitle', true);
  container.appendChild(sec);

  // Toolbar: Preset dropdown + Reset button (templated)
  const toolbar = createUiElement(basicSection);
  toolbar.className = 'sf-kb-toolbar';
  // Layout: left group (label+dropdown), right-aligned Reset
  try {
    toolbar.style.display = 'flex';
    toolbar.style.alignItems = 'center';
    toolbar.style.gap = '0.5rem';
  } catch (_) {}

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
    width: '13.75rem',
    placeholder: 'Layout Preset'
  });
  const presetLabel = createUiElement(basicFormLabel, 'Layout Style:');
  try { presetLabel.classList.add('sf-kb-label'); } catch (_) {}
  // Left group wrapper for spacing between label and dropdown
  const leftGroup = document.createElement('div');
  try {
    leftGroup.style.display = 'flex';
    leftGroup.style.alignItems = 'center';
    leftGroup.style.gap = '0.5rem';
  } catch (_) {}
  leftGroup.appendChild(presetLabel);
  leftGroup.appendChild(presetDD.el);
  toolbar.appendChild(leftGroup);

  const resetBtn = createUiElement(basicButton, 'button', 'Reset All');
  try { resetBtn.setAttribute('aria-label', 'Reset all keybindings'); } catch (_) {}
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
  // Right-justify Reset All
  try { resetBtn.style.marginLeft = 'auto'; } catch (_) {}
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
  let listeningCleanup = null; // function to immediately cancel active listening

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
    // try { gSec.style.margin = '1rem 0'; } catch (_) {}
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

    // Combat now uses the default two-column renderer like other groups

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
      // Gap after Extended section
      try { container.appendChild(createUiElement(basicGapBetweenSections)); } catch (_) {}
      return; // done with extended group
    }

    // Default layout: labeled rows with key on the right (two-column when applicable)
    renderDefaultTwoColGroup({ g, gSec, attachKeyForAction });
    
    // Gap between sections
    try { container.appendChild(createUiElement(basicGapBetweenSections)); } catch (_) {}
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

    // expose this specific cleanup to the tab-level return value
    listeningCleanup = cleanup;

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur, true);
    listening = { btn, act, onKey, onBlur, blinkBtns: initialBlink, timer: setTimeout(() => cleanup(), 12000) };
    try { btn.focus(); } catch (_) {}
  }

  // Return a cleanup function so the settings container can cancel any active listeners immediately
  return () => {
    try { if (typeof listeningCleanup === 'function') listeningCleanup(); } catch (_) {}
    listeningCleanup = null;
  };
}
