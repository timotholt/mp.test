// Theme Tab: renders the Theme settings for panel and overlay
// Keeps logic identical to the previous inline implementation in settings.js,
// but removes cross-tab DOM references (fsRng/fsVal) to avoid coupling.
// Minimal, human-readable, and commented per project conventions.

import * as LS from '../../../core/localStorage.js';
import { getQuip } from '../../../core/ui/quip.js';
import { createDropdown } from '../../../core/ui/controls.js';

export function renderThemeTab(opts) {
  const {
    container,
    makeSection,
    attachWheel, // provided by settings.js
    attachHover, // provided by settings.js
    headerTitle = 'Overall Color',
    headerDesc = getQuip('settings.panel.themeTag', [
      "They say color defines your personality. What's yours?",
      'Death knows no color, but we do.',
      'Paint the town red. Or any other color you want.',
      'Hue today, gone tomorrow.',
      'Saturate your soul.',
      'Pick a vibe, survive the dungeon.',
      'Red increases your damage rolls. Source? Trust me bro.',
      'Those color knobs took forever to code. Use them wisely.',
      'If your colors suck, I might change them back.',
      "Reminder: colors can’t fix your lack of skill.",
      'Pick a color. Regret is free.',
    ]),
    variant = 'panel',
  } = opts || {};

  // Section header with quip subtitle and a Reset button on the right.
  const sec = makeSection(headerTitle, headerDesc);

  // Ensure subtitle quip class exists (JS-only style injection)
  try {
    let st = document.getElementById('settings-panel-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'settings-panel-style';
      st.textContent = '.settings-subtitle-quip{ padding-left:6px; --settings-sec-subtitle-color: var(--ui-fg, #eee); }';
      document.head.appendChild(st);
    }
  } catch (_) {}

  // Apply padding class and enforce subdued color via CSS var inline
  try {
    const sub = sec.children[1];
    if (sub) {
      sub.classList.add('settings-subtitle-quip');
      sub.style.setProperty('--settings-sec-subtitle-color', 'var(--ui-fg, #eee)');
    }
  } catch (_) {}

  // Insert Reset button and a left header box for the Theme label
  let resetBtn = null; // hoisted so we can wire onclick after sliders are created
  try {
    const hdr = sec.firstChild; // title div
    if (hdr) {
      hdr.style.display = 'flex';
      hdr.style.alignItems = 'center';
      hdr.style.justifyContent = 'space-between';

      // Left box attaches the static theme display row (to the left of Reset)
      const leftBox = document.createElement('div');
      leftBox.id = 'theme-hdr-left-panel';
      leftBox.style.display = 'flex';
      leftBox.style.alignItems = 'center';
      leftBox.style.gap = '8px';
      hdr.appendChild(leftBox);

      resetBtn = document.createElement('button');
      resetBtn.textContent = 'Reset';
      resetBtn.style.background = 'transparent';
      resetBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
      resetBtn.style.borderRadius = '10px';
      resetBtn.style.color = 'var(--ui-fg, #eee)';
      resetBtn.style.padding = '4px 10px';
      resetBtn.style.cursor = 'pointer';
      // Hover/focus glow
      const onHover = () => { try { resetBtn.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))'; resetBtn.style.outline = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))'; } catch (_) {} };
      const onLeave = () => { try { resetBtn.style.boxShadow = 'none'; resetBtn.style.outline = 'none'; } catch (_) {} };
      resetBtn.addEventListener('mouseenter', onHover);
      resetBtn.addEventListener('mouseleave', onLeave);
      resetBtn.addEventListener('focus', onHover);
      resetBtn.addEventListener('blur', onLeave);

      // onclick wired after slider elements are created
      hdr.appendChild(resetBtn);
    }
  } catch (_) {}

  container.appendChild(sec);

  // Optional Theme preset dropdown for overlay; simple label for panel
  let dd = null; // preset dropdown (overlay only)
  (function buildThemeHeader() {
    try {
      const left = sec.querySelector('#theme-hdr-left-panel');
      if (variant === 'overlay') {
        // Theme presets are centralized in UITheme
        const themePresets = (() => {
          try {
            const tm = (window && window.UITheme) ? window.UITheme : null;
            if (tm) {
              if (typeof tm.getPresets === 'function') return tm.getPresets();
              if (tm.presets) return tm.presets;
            }
          } catch (_) {}
          // Minimal fallback if UITheme isn't ready
          return { 'Steel Blue': { hue: 207, intensity: 60, border: 80, glow: 18, transparency: 85, gradient: 20, overlayDarkness: 60, blur: 3 } };
        })();

        const themeTopRow = document.createElement('div');
        themeTopRow.style.display = 'flex';
        themeTopRow.style.alignItems = 'center';
        themeTopRow.style.gap = '8px';
        themeTopRow.style.marginBottom = '8px';

        const lbl = document.createElement('label');
        lbl.textContent = 'Theme Preset:';
        lbl.style.fontSize = 'calc(16px * var(--ui-font-scale, 1))';
        lbl.style.fontWeight = '600';

        try {
          let savedPreset = LS.getItem('ui_preset', null);
          if (savedPreset === 'Emerald') { savedPreset = 'Verdant Veil'; try { LS.setItem('ui_preset', savedPreset); } catch (_) {} }
          const names = Object.keys(themePresets);
          const items = [{ label: 'Custom', value: 'Custom' }].concat(names.map(n => ({ label: n, value: n })));
          if (!savedPreset || (!themePresets[savedPreset] && savedPreset !== 'Custom')) savedPreset = 'Steel Blue';
          dd = createDropdown({ items, value: savedPreset, width: '240px', onChange: (val) => {
            try { LS.setItem('ui_preset', val); } catch (_) {}
            if (val !== 'Custom') { try { if (typeof applyPreset === 'function') applyPreset(val); } catch (_) {} }
          }});
        } catch (_) {
          dd = createDropdown({ items: [{ label: 'Custom', value: 'Custom' }], value: 'Custom', width: '240px' });
        }
        themeTopRow.appendChild(lbl);
        if (dd) themeTopRow.appendChild(dd.el);
        if (left) left.appendChild(themeTopRow); else container.appendChild(themeTopRow);
      } else {
        const themeRow = document.createElement('div');
        themeRow.style.display = 'flex'; themeRow.style.alignItems = 'center'; themeRow.style.gap = '8px'; themeRow.style.marginBottom = '8px';
        const lbl = document.createElement('label'); lbl.textContent = 'Theme:';
        const currentTheme = document.createElement('span');
        currentTheme.textContent = 'Steel Blue';
        currentTheme.style.opacity = '0.85';
        currentTheme.style.fontSize = '12px';
        try { const saved = LS.getItem('theme', null); if (!saved) LS.setItem('theme', 'steelBlue'); } catch (_) {}
        themeRow.appendChild(lbl); themeRow.appendChild(currentTheme);
        if (left) left.appendChild(themeRow); else container.appendChild(themeRow);
      }
    } catch (_) {
      // Fallback: no-op if header cannot be built
    }
  })();

  // Helper: when any slider/knob changes, mark preset as Custom (do not re-apply values)
  function selectCustomPreset() {
    try { LS.setItem('ui_preset', 'Custom'); } catch (_) {}
    try { dd && dd.setValue && dd.setValue('Custom', false); } catch (_) {}
  }

  // Optional color knobs (Hue / Saturation / Intensity) for overlay if available
  // Mirrors previous inline overlay implementation and initializes from storage
  let hueKn = null, satKn = null, briKn = null;
  try {
    if (variant === 'overlay') {
      const CK = (window && window.ColorKnobs) ? window.ColorKnobs : null;
      if (CK && CK.createHueKnob && CK.createSaturationKnob && CK.createIntensityKnob) {
        const knobRow = document.createElement('div');
        knobRow.style.display = 'flex';
        knobRow.style.gap = 'var(--ui-gap, 1rem)';
        knobRow.style.alignItems = 'center';
        knobRow.style.justifyContent = 'space-between';
        knobRow.style.margin = 'calc(var(--ui-gap, 1rem) * 2) var(--ui-gap, 1rem) 0 var(--ui-gap, 1rem)';
        knobRow.style.padding = '0';
        knobRow.style.overflow = 'visible';
        knobRow.style.marginTop = 'calc(var(--ui-gap, 1rem) * 2)';

        const makeCol = (el, caption) => {
          const wrap = document.createElement('div');
          wrap.style.display = 'flex';
          wrap.style.flexDirection = 'column';
          wrap.style.alignItems = 'center';
          wrap.style.minWidth = '80px';
          wrap.style.padding = '4px 2px';
          wrap.style.overflow = 'visible';
          wrap.appendChild(el);
          const cap = document.createElement('div');
          cap.textContent = caption;
          cap.style.fontSize = '12px';
          cap.style.opacity = '0.8';
          cap.style.marginTop = 'calc(14px + 0.5rem)';
          wrap.appendChild(cap);
          return wrap;
        };

        hueKn = CK.createHueKnob({
          size: 56,
          label: 'Hue',
          ringOffset: 18,
          onInput: () => { try { selectCustomPreset(); } catch (_) {} }
        });
        satKn = CK.createSaturationKnob({
          size: 56,
          label: 'Saturation',
          ringOffset: 18,
          onInput: () => { try { selectCustomPreset(); } catch (_) {} }
        });
        briKn = CK.createIntensityKnob({
          size: 56,
          label: 'Intensity',
          ringOffset: 18,
          onInput: () => { try { selectCustomPreset(); } catch (_) {} }
        });

        try { hueKn.el.style.setProperty('--kn-ring-global-y', '4px'); } catch (_) {}
        try { satKn.el.style.setProperty('--kn-ring-global-y', '4px'); } catch (_) {}
        try { briKn.el.style.setProperty('--kn-ring-global-y', '4px'); } catch (_) {}

        knobRow.appendChild(makeCol(hueKn.el, 'Hue'));
        knobRow.appendChild(makeCol(briKn.el, 'Intensity'));
        knobRow.appendChild(makeCol(satKn.el, 'Saturation'));

        container.appendChild(knobRow);

        // Initialize knob values from persisted state (silent)
        try {
          let hueInit = parseFloat(localStorage.getItem('ui_hue'));
          if (!Number.isFinite(hueInit)) hueInit = 210;
          hueInit = Math.max(0, Math.min(360, Math.round(hueInit)));
          try { if (hueKn && hueKn.setValue) hueKn.setValue(hueInit, { silent: true }); } catch (_) {}

          let intensityInit = parseFloat(localStorage.getItem('ui_intensity'));
          if (!Number.isFinite(intensityInit)) intensityInit = 60;
          const satEffInit = Math.max(0, Math.min(85, Math.round(intensityInit * 0.8)));
          try { if (satKn && satKn.setValue) satKn.setValue(satEffInit, { silent: true }); } catch (_) {}

          let briInit = parseFloat(localStorage.getItem('ui_intensity'));
          if (!Number.isFinite(briInit)) briInit = 60;
          briInit = Math.max(0, Math.min(100, Math.round(briInit)));
          try { if (briKn && briKn.setValue) briKn.setValue(briInit, { silent: true }); } catch (_) {}
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Gradient strength slider (0-100)
  const grRow = document.createElement('div');
  grRow.style.display = 'flex'; grRow.style.alignItems = 'center'; grRow.style.gap = '8px'; grRow.style.marginBottom = '8px';
  const grLbl = document.createElement('label'); grLbl.textContent = 'Gradient:'; grLbl.style.minWidth = '140px'; grLbl.style.textAlign = 'left';
  const grRng = document.createElement('input'); grRng.type = 'range'; grRng.min = '0'; grRng.max = '100'; grRng.step = '1'; grRng.style.flex = '1'; grRng.id = 'settings-ui-gradient';
  const grVal = document.createElement('span'); grVal.style.width = '46px'; grVal.style.textAlign = 'right'; grVal.style.color = '#ccc'; grVal.style.paddingRight = '6px'; grVal.id = 'settings-ui-gradient-val';
  try {
    let g = parseFloat(localStorage.getItem('ui_gradient'));
    if (!Number.isFinite(g)) g = 60;
    const p = Math.max(0, Math.min(100, Math.round(g)));
    grRng.value = String(p);
    grVal.textContent = `${p}%`; grRng.title = `${p}%`;
  } catch (_) {}
  grRng.oninput = () => {
    const p = Math.max(0, Math.min(100, Math.round(parseFloat(grRng.value) || 0)));
    if (String(p) !== grRng.value) grRng.value = String(p);
    grVal.textContent = `${p}%`; grRng.title = `${p}%`;
    try { console.debug(`[display] gradient(${variant}) p=${p}`); } catch (_) {}
    try { window.UITheme && window.UITheme.applyDynamicTheme({ gradient: p }); } catch (_) {}
    try { localStorage.setItem('ui_gradient', String(p)); } catch (_) {}
    try { selectCustomPreset(); } catch (_) {}
  };
  attachWheel && attachWheel(grRng); attachHover && attachHover(grRng, grLbl);
  grRow.appendChild(grLbl); grRow.appendChild(grRng); grRow.appendChild(grVal);

  // Blur slider (backdrop blur 0-10px)
  const mkRow = document.createElement('div');
  mkRow.style.display = 'flex'; mkRow.style.alignItems = 'center'; mkRow.style.gap = '8px'; mkRow.style.marginBottom = '8px';
  const mkLbl = document.createElement('label'); mkLbl.textContent = 'Overlay Blur:'; mkLbl.style.minWidth = '140px'; mkLbl.title = 'Background blur behind panels/overlays'; mkLbl.style.textAlign = 'left';
  const mkRng = document.createElement('input'); mkRng.type = 'range'; mkRng.min = '0'; mkRng.max = '10'; mkRng.step = '0.1'; mkRng.style.flex = '1'; mkRng.id = 'settings-ui-milkiness';
  const mkVal = document.createElement('span'); mkVal.style.width = '46px'; mkVal.style.textAlign = 'right'; mkVal.style.color = '#ccc'; mkVal.style.paddingRight = '6px'; mkVal.id = 'settings-ui-milkiness-val';
  try {
    let m = parseFloat(localStorage.getItem('ui_milkiness'));
    if (!Number.isFinite(m)) m = 3;
    let v = Math.max(0, Math.min(10, m));
    mkRng.value = String(v);
    mkVal.textContent = `${v.toFixed(1)}px`; mkRng.title = `${v.toFixed(1)}px`;
  } catch (_) {}
  mkRng.oninput = () => {
    let v = parseFloat(mkRng.value);
    if (!Number.isFinite(v)) v = 3;
    v = Math.max(0, Math.min(10, v));
    mkRng.value = String(v);
    mkVal.textContent = `${v.toFixed(1)}px`; mkRng.title = `${v.toFixed(1)}px`;
    try { console.debug(`[display] milkiness(${variant}) v=${v}`); } catch (_) {}
    try { window.UITheme && window.UITheme.applyDynamicTheme({ milkiness: v }); } catch (_) {}
    try { localStorage.setItem('ui_milkiness', String(v)); } catch (_) {}
    try { selectCustomPreset(); } catch (_) {}
  };
  attachWheel && attachWheel(mkRng); attachHover && attachHover(mkRng, mkLbl);
  mkRow.appendChild(mkLbl); mkRow.appendChild(mkRng); mkRow.appendChild(mkVal);

  // Insert Transparency section header (overlay only)
  if (variant === 'overlay') {
    try {
      const subtleQuips = [
        'Big movements, subtle changes.',
        'If you do not look closely, you may miss it.',
        'Subtle shifts shape the mood.',
        "It's the little things that matter",
        'It whispers, not shouts.'
      ];
      container.appendChild(makeSection('Transparency', getQuip('settings.overlay.transparencyTag', subtleQuips)));
    } catch (_) {}
  }

  // Transparency slider (reversed: 100% = clear, 0% = opaque)
  const opRow = document.createElement('div');
  opRow.style.display = 'flex'; opRow.style.alignItems = 'center'; opRow.style.gap = '8px'; opRow.style.marginBottom = '8px';
  const opLbl = document.createElement('label'); opLbl.textContent = 'Transparency:'; opLbl.style.minWidth = '140px'; opLbl.title = 'Higher = clearer panels; lower = more solid'; opLbl.style.textAlign = 'left';
  const opRng = document.createElement('input'); opRng.type = 'range'; opRng.min = '0'; opRng.max = '100'; opRng.step = '1'; opRng.style.flex = '1'; opRng.id = 'settings-ui-opacity';
  const opVal = document.createElement('span'); opVal.style.width = '46px'; opVal.style.textAlign = 'right'; opVal.style.color = '#ccc'; opVal.style.paddingRight = '6px'; opVal.id = 'settings-ui-opacity-val';
  // Initialize from storage, default 85% transparency. Read both namespaced and raw keys for compatibility
  try {
    const OPDBG = true; const MMAX = 2.5; // ceiling for opacity multiplier
    let raw = null; try { raw = localStorage.getItem('ui_opacity_mult'); } catch (_) {}
    let ns = null; try { ns = LS.getItem('ui_opacity_mult', null); } catch (_) {}
    let mult = null; let p = 85; // default transparency percent
    if (raw != null || ns != null) {
      mult = parseFloat(ns != null ? ns : raw);
      if (!Number.isFinite(mult) || mult < 0) mult = 0.375; // fallback to previous default if corrupted
      // Detect legacy semantics (old stored mult was proportional to opacity, not transparency)
      if (mult > 1.25) {
        const pOld = Math.max(0, Math.min(100, Math.round((mult / MMAX) * 100)));
        p = Math.max(0, Math.min(100, 100 - pOld));
      } else {
        // New semantics: mult = (100 - p)/100 * MMAX
        p = Math.max(0, Math.min(100, Math.round(100 - (mult / MMAX) * 100)));
      }
    }
    // Apply and persist remapped multiplier
    const multClamped = ((100 - p) / 100) * MMAX;
    opRng.value = String(p);
    const pct = String(p) + '%'; opVal.textContent = pct; opRng.title = pct;
    document.documentElement.style.setProperty('--ui-opacity-mult', String(multClamped));
    try { LS.setItem('ui_opacity_mult', String(multClamped)); } catch (_) {}
    try { localStorage.setItem('ui_opacity_mult', String(multClamped)); } catch (_) {}
    if (OPDBG) { try {
      const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
      console.debug(`[opacity] display-tab-init(${variant},rev) css=${css} p=${p} multClamped=${multClamped} rawLS=${raw}`);
    } catch (_) {} }
  } catch (_) {}
  opRng.oninput = () => {
    const OPDBG = true; const MMAX = 2.5;
    const p = Math.max(0, Math.min(100, Math.round(parseFloat(opRng.value) || 0)));
    if (String(p) !== opRng.value) opRng.value = String(p);
    const mult = ((100 - p) / 100) * MMAX;
    const pct = String(p) + '%';
    opVal.textContent = pct; opRng.title = pct;
    try { window.UITheme && window.UITheme.applyDynamicTheme({ opacityMult: mult }); } catch (_) {}
    // Persist to namespaced LS as well, since init prefers LS over raw localStorage for this key
    try { LS.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
    // Gradient tooltip visible only when panels aren’t fully clear
    try { if (p < 100) { grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; } else { grLbl.title = ''; grLbl.style.opacity = '0.8'; } } catch (_) {}
    if (OPDBG) {
      try {
        const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
        console.debug(`[opacity] slider(${variant},rev) css=${css} p=${p} mult=${mult}`);
      } catch (_) {}
    }
    try { selectCustomPreset(); } catch (_) {}
  };
  attachWheel && attachWheel(opRng); attachHover && attachHover(opRng, opLbl);
  opRow.appendChild(opLbl); opRow.appendChild(opRng); opRow.appendChild(opVal);
  container.appendChild(opRow);

  // Place Gradient and Blur after Transparency now
  try {
    const pInit = Math.max(0, Math.min(100, Math.round(parseFloat(opRng.value) || 0)));
    if (pInit < 100) { grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; } else { grLbl.title = ''; grLbl.style.opacity = '0.8'; }
  } catch (_) {}
  container.appendChild(grRow);

  // New: Overlay Darkness (0-100)
  const odRow = document.createElement('div'); odRow.style.display = 'flex'; odRow.style.alignItems = 'center'; odRow.style.gap = '8px'; odRow.style.marginBottom = '8px';
  const odLbl = document.createElement('label'); odLbl.textContent = 'Overlay Darkness:'; odLbl.style.minWidth = '140px'; odLbl.title = 'Dimming behind dialogs/menus';
  const odRng = document.createElement('input'); odRng.type = 'range'; odRng.min = '0'; odRng.max = '100'; odRng.step = '1'; odRng.style.flex = '1'; odRng.id = 'settings-ui-overlay-darkness';
  const odVal = document.createElement('span'); odVal.style.width = '46px'; odVal.style.textAlign = 'right'; odVal.style.color = '#ccc'; odVal.style.paddingRight = '6px'; odVal.id = 'settings-ui-overlay-darkness-val';
  try { let v = parseFloat(localStorage.getItem('ui_overlay_darkness')); if (!Number.isFinite(v)) v = 50; const p = Math.max(0, Math.min(100, Math.round(v))); odRng.value = String(p); odVal.textContent = `${p}%`; odRng.title = `${p}%`; } catch (_) {}
  odRng.oninput = () => { const p = Math.max(0, Math.min(100, Math.round(parseFloat(odRng.value) || 0))); if (String(p) !== odRng.value) odRng.value = String(p); odVal.textContent = `${p}%`; odRng.title = `${p}%`; try { window.UITheme && window.UITheme.applyDynamicTheme({ overlayDarkness: p }); } catch (_) {} try { localStorage.setItem('ui_overlay_darkness', String(p)); } catch (_) {} try { selectCustomPreset(); } catch (_) {} };
  odRow.appendChild(odLbl); odRow.appendChild(odRng); odRow.appendChild(odVal); container.appendChild(odRow);
  // Place Overlay Blur after Overlay Darkness
  container.appendChild(mkRow);

  // Insert Border section header (overlay only)
  if (variant === 'overlay') {
    try {
      const borderQuips = [
        'Life is brighter living on the edge',
        'The sharper the edge, the sharper your blade.',
        'Outline the chaos',
        'Borders define the void',
        'Edge control, edge comfort',
        "Edges don’t protect. They just decorate.",
        "If you're edgy, move a knob to prove it.",
        "Move the glow knob. It's your last chance in life to glow.",
        'A small glow alters the whole room.',
        'The faintest line divides worlds.',
        "You'll never glow up, but the glow knob will.",
        'Glow up? No. Glow knob? Absolutely.'
      ];
      container.appendChild(makeSection('Border', getQuip('settings.overlay.borderTag', borderQuips)));
    } catch (_) {}
  }

  // New: Border Intensity (0-100)
  const biRow = document.createElement('div'); biRow.style.display = 'flex'; biRow.style.alignItems = 'center'; biRow.style.gap = '8px'; biRow.style.marginBottom = '8px';
  const biLbl = document.createElement('label'); biLbl.textContent = 'Border Intensity:'; biLbl.style.minWidth = '140px'; biLbl.title = 'Strength of panel borders';
  const biRng = document.createElement('input'); biRng.type = 'range'; biRng.min = '0'; biRng.max = '100'; biRng.step = '1'; biRng.style.flex = '1'; biRng.id = 'settings-ui-border-intensity';
  const biVal = document.createElement('span'); biVal.style.width = '46px'; biVal.style.textAlign = 'right'; biVal.style.color = '#ccc'; biVal.style.paddingRight = '6px'; biVal.id = 'settings-ui-border-intensity-val';
  try { let v = parseFloat(localStorage.getItem('ui_border_intensity')); if (!Number.isFinite(v)) v = 70; const p = Math.max(0, Math.min(100, Math.round(v))); biRng.value = String(p); biVal.textContent = `${p}%`; biRng.title = `${p}%`; } catch (_) {}
  biRng.oninput = () => { const p = Math.max(0, Math.min(100, Math.round(parseFloat(biRng.value) || 0))); if (String(p) !== biRng.value) biRng.value = String(p); biVal.textContent = `${p}%`; biRng.title = `${p}%`; try { window.UITheme && window.UITheme.applyDynamicTheme({ borderStrength: p }); } catch (_) {} try { localStorage.setItem('ui_border_intensity', String(p)); } catch (_) {} try { selectCustomPreset(); } catch (_) {} };
  biRow.appendChild(biLbl); biRow.appendChild(biRng); biRow.appendChild(biVal); container.appendChild(biRow);

  // New: Glow Strength (0-100)
  const gsRow = document.createElement('div'); gsRow.style.display = 'flex'; gsRow.style.alignItems = 'center'; gsRow.style.gap = '8px'; gsRow.style.marginBottom = '8px';
  const gsLbl = document.createElement('label'); gsLbl.textContent = 'Glow Strength:'; gsLbl.style.minWidth = '140px'; gsLbl.title = 'Strength of panel glow and highlights';
  const gsRng = document.createElement('input'); gsRng.type = 'range'; gsRng.min = '0'; gsRng.max = '100'; gsRng.step = '1'; gsRng.style.flex = '1'; gsRng.id = 'settings-ui-glow-strength';
  const gsVal = document.createElement('span'); gsVal.style.width = '46px'; gsVal.style.textAlign = 'right'; gsVal.style.color = '#ccc'; gsVal.style.paddingRight = '6px'; gsVal.id = 'settings-ui-glow-strength-val';
  try { let v = parseFloat(localStorage.getItem('ui_glow_strength')); if (!Number.isFinite(v)) v = 60; const p = Math.max(0, Math.min(100, Math.round(v))); gsRng.value = String(p); try { const px = Math.round((p / 100) * 44); gsVal.textContent = `${px}px`; } catch (_) { gsVal.textContent = `${p}%`; } gsRng.title = `${p}%`; } catch (_) {}
  gsRng.oninput = () => { const p = Math.max(0, Math.min(100, Math.round(parseFloat(gsRng.value) || 0))); if (String(p) !== gsRng.value) gsRng.value = String(p); try { const px = Math.round((p / 100) * 44); gsVal.textContent = `${px}px`; } catch (_) { gsVal.textContent = `${p}%`; } gsRng.title = `${p}%`; try { window.UITheme && window.UITheme.applyDynamicTheme({ glowStrength: p }); } catch (_) {} try { localStorage.setItem('ui_glow_strength', String(p)); } catch (_) {} try { selectCustomPreset(); } catch (_) {} };
  gsRow.appendChild(gsLbl); gsRow.appendChild(gsRng); gsRow.appendChild(gsVal); container.appendChild(gsRow);

  // Now that all controls exist, wire the Reset to also update their UI values instantly
  try {
    if (resetBtn) {
      resetBtn.onclick = () => {
        const OPDBG = true; const MMAX = 2.5; const p = 85; // default transparency percent
        const mult = ((100 - p) / 100) * MMAX; // reversed semantics mapping
        // Reset theme selection to preset
        try { LS.setItem('theme', 'steelBlue'); } catch (_) {}
        try { dd && dd.setValue('Steel Blue', true); } catch (_) {}
        // Ensure any explicit saturation override is cleared so preset-derived saturation applies immediately
        try { localStorage.removeItem('ui_saturation'); } catch (_) {}
        // Apply preset directly (ignores LS overrides for H/S/B and related knobs)
        try { window.UITheme && window.UITheme.applyTheme('Steel Blue'); } catch (_) {}
        // Reset opacity via dynamic param and font scale to 1
        try { window.UITheme && window.UITheme.applyDynamicTheme({ opacityMult: mult, fontScale: 1 }); } catch (_) {}
        try { localStorage.setItem('ui_font_scale', '1'); } catch (_) {}
        try { LS.setItem('ui_opacity_mult', String(mult)); localStorage.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
        try { window.dispatchEvent(new CustomEvent('ui:hue-changed')); } catch (_) {}

        // Reset sliders to preset defaults and persist
        try { grRng.value = '20'; grVal.textContent = '20%'; grRng.title = '20%'; localStorage.setItem('ui_gradient', '20'); window.UITheme && window.UITheme.applyDynamicTheme({ gradient: 20 }); } catch (_) {}
        try { mkRng.value = '3'; mkVal.textContent = '3.0px'; mkRng.title = '3.0px'; localStorage.setItem('ui_milkiness', '3'); window.UITheme && window.UITheme.applyDynamicTheme({ milkiness: 3 }); } catch (_) {}
        try { odRng.value = '60'; odVal.textContent = '60%'; odRng.title = '60%'; localStorage.setItem('ui_overlay_darkness', '60'); window.UITheme && window.UITheme.applyDynamicTheme({ overlayDarkness: 60 }); } catch (_) {}
        try { biRng.value = '80'; biVal.textContent = '80%'; biRng.title = '80%'; localStorage.setItem('ui_border_intensity', '80'); window.UITheme && window.UITheme.applyDynamicTheme({ borderStrength: 80 }); } catch (_) {}
        try { gsRng.value = '18'; const px = Math.round((18 / 100) * 44); gsVal.textContent = `${px}px`; gsRng.title = '18%'; localStorage.setItem('ui_glow_strength', '18'); window.UITheme && window.UITheme.applyDynamicTheme({ glowStrength: 18 }); } catch (_) {}
        try { opRng.value = String(p); const pct = `${p}%`; opVal.textContent = pct; opRng.title = pct; } catch (_) {}
        // Gradient label helper visibility
        try { if (p < 100) { grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; } else { grLbl.title = ''; grLbl.style.opacity = '0.8'; } } catch (_) {}

        // Silently sync knobs to the preset values
        try { if (hueKn && hueKn.setValue) hueKn.setValue(207, { silent: true }); } catch (_) {}
        try { if (satKn && satKn.setValue) satKn.setValue(Math.max(0, Math.min(85, Math.round(60 * 0.8))), { silent: true }); } catch (_) {}
        try { if (briKn && briKn.setValue) briKn.setValue(60, { silent: true }); } catch (_) {}

        if (OPDBG) { try {
          const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
          console.debug(`[opacity] theme-reset(${variant},rev) css=${css} p=${p} mult=${mult}`);
        } catch (_) {} }
      };
    }
  } catch (_) {}

  // Apply a named preset to all sliders and persist values (overlay usage)
  function applyPreset(name) {
    try {
      const themePresets = (() => {
        try {
          const tm = (window && window.UITheme) ? window.UITheme : null;
          if (tm) {
            if (typeof tm.getPresets === 'function') return tm.getPresets();
            if (tm.presets) return tm.presets;
          }
        } catch (_) {}
        return { 'Steel Blue': { hue: 207, intensity: 60, border: 80, glow: 18, transparency: 85, gradient: 20, overlayDarkness: 60, blur: 3 } };
      })();
      const defName = 'Steel Blue';
      const p = themePresets[name] || themePresets[defName];
      if (!p) return;
      const MMAX = 2.5;
      const t = Math.max(0, Math.min(100, Math.round(p.transparency)));
      const mult = ((100 - t) / 100) * MMAX;

      // Apply and persist via UITheme
      try {
        try { localStorage.removeItem('ui_saturation'); } catch (_) {}
        window.UITheme && window.UITheme.applyDynamicTheme({
          hue: p.hue,
          intensity: p.intensity,
          borderStrength: p.border,
          glowStrength: p.glow,
          opacityMult: mult,
          gradient: p.gradient,
          milkiness: p.blur,
          overlayDarkness: p.overlayDarkness
        });
      } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('ui:hue-changed')); } catch (_) {}

      // Update UI controls to reflect preset values
      try { const b = Math.max(0, Math.min(100, Math.round(p.border))); biRng.value = String(b); biVal.textContent = `${b}%`; biRng.title = `${b}%`; } catch (_) {}
      try { const g = Math.max(0, Math.min(100, Math.round(p.glow))); gsRng.value = String(g); gsRng.title = `${g}%`; const px = Math.round((g / 100) * 44); gsVal.textContent = `${px}px`; } catch (_) {}
      try { const gr = Math.max(0, Math.min(100, Math.round(p.gradient))); grRng.value = String(gr); grVal.textContent = `${gr}%`; grRng.title = `${gr}%`; } catch (_) {}
      try { let m = Number(p.blur); if (!Number.isFinite(m)) m = 3; m = Math.max(0, Math.min(10, m)); mkRng.value = String(m); mkVal.textContent = `${m.toFixed(1)}px`; mkRng.title = `${m.toFixed(1)}px`; } catch (_) {}
      try { const od = Math.max(0, Math.min(100, Math.round(p.overlayDarkness))); odRng.value = String(od); odVal.textContent = `${od}%`; odRng.title = `${od}%`; } catch (_) {}
      try { opRng.value = String(t); opVal.textContent = `${t}%`; opRng.title = `${t}%`; } catch (_) {}

      // Silently sync knobs to the preset without re-applying handlers
      try { if (hueKn && hueKn.setValue) hueKn.setValue(p.hue, { silent: true }); } catch (_) {}
      try {
        const satEff = Math.max(0, Math.min(85, Math.round((Number(p.intensity) || 60) * 0.8)));
        if (satKn && satKn.setValue) satKn.setValue(satEff, { silent: true });
      } catch (_) {}
      try {
        const br = Math.max(0, Math.min(100, Math.round(Number(p.intensity) || 60)));
        if (briKn && briKn.setValue) briKn.setValue(br, { silent: true });
      } catch (_) {}

      // Persist values so preset selection survives reloads and Reset applies correctly
      try {
        localStorage.setItem('ui_hue', String(p.hue));
        localStorage.setItem('ui_intensity', String(Math.max(0, Math.min(100, Math.round(Number(p.intensity) || 60)))));
        localStorage.setItem('ui_border_intensity', String(Math.max(0, Math.min(100, Math.round(p.border)))));
        localStorage.setItem('ui_glow_strength', String(Math.max(0, Math.min(100, Math.round(p.glow)))));
        localStorage.setItem('ui_gradient', String(Math.max(0, Math.min(100, Math.round(p.gradient)))));
        const mLS = Math.max(0, Math.min(10, Number(p.blur)));
        localStorage.setItem('ui_milkiness', String(mLS));
        localStorage.setItem('ui_overlay_darkness', String(Math.max(0, Math.min(100, Math.round(p.overlayDarkness)))));
        try { LS.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
        localStorage.setItem('ui_opacity_mult', String(mult));
      } catch (_) {}

      try { LS.setItem('ui_preset', name); } catch (_) {}
    } catch (_) {}
  }
}
