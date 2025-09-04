// Theme Tab: renders the Theme settings for panel and overlay
// Keeps logic identical to the previous inline implementation in settings.js,
// but removes cross-tab DOM references (fsRng/fsVal) to avoid coupling.
// Minimal, human-readable, and commented per project conventions.

import { getQuip } from '../../../core/ui/quip.js';
import { createDropdown } from '../../../core/ui/controls.js';
import { makeSection, attachWheel, attachHover } from '../uiHelpers.js';
import { themePresets } from '../../../core/ui/theme/presets.js';
import { createUiElement, basicButton, createRangeElement, basicFormRow, basicFormLabel, basicQuarterGap, basicGapBetweenSections, basicToolbarRow } from '../../../core/ui/theme/elements.js';
import { createKnob } from '../../../core/ui/knob.js';
import { attachTooltip, updateTooltip } from '../../../core/ui/tooltip.js';

export function renderThemeTab(container) {
  // Theme tab is overlay-only; remove variant checks
  // const variant = 'overlay';
  const headerTitle = 'UI Presets';
  const headerDesc = getQuip('settings.overlay.themeTag', [
    'If in doubt, Steel Blue never loses.',
    'Select a preset. Roll with it.',
    'Pick a vibe, survive the dungeon.',
    'Colorblind? We got presets for that vibe too.',
    'This preset was made by Van Gough.',
    'This preset was made by Michael Angelo.',
    'This preset was made by Leonardo da Vinci.',
    'This preset was made by Claude Monet.',
    'Pick a preset. Pretend it was intentional.',
    'Mood ring broke? Try these instead.',
    'Colors chosen by wizards with crayons.',
    'One click = instant personality.',
    'RGB is just astrology with numbers.',
    'These palettes survived the Dark Ages.',
    'Preset: because chaos needs boundaries.',
    'Somewhere, a designer is crying.',
    'Your eyes will thank you (eventually).',
    'Match the theme, dodge the memes.',
    'Presets: the training wheels of taste.',
    'No color theory degree required.',
    'Even dragons respect a good gradient.',
    'These presets passed the vibe check.',
    'Palette curated by eldritch interns.',
    'Click until destiny feels right.',
    'Neon Pink is always a power move.',
    'Sometimes "old photos" is the bold choice.',
    "Heroes don’t pick Pink.",
    'Presets: art, but without the suffering.',
    'Warning: some themes unlock trauma.',
    'Every theme tells a story.',
  ]);

  // Section header with quip right-aligned
  const sec = makeSection(headerTitle, headerDesc, 'afterTitle', true);
  container.appendChild(sec);

  // Reset button hoisted reference (wired after controls are created)
  // Guard to avoid marking preset as Custom during programmatic updates
  let resetBtn = null;
  let isApplyingPreset = false;
  
  // --- Small helpers to keep things readable and DRY (no behavior changes) ---
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return (v === null || v === undefined) ? d : v; } catch (_) { return d; } };
  const lsGetNum = (k, d) => { const n = parseFloat(lsGet(k, '')); return Number.isFinite(n) ? n : d; };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const silently = (fn) => { const prev = isApplyingPreset; isApplyingPreset = true; try { fn && fn(); } finally { isApplyingPreset = prev; } };
  const setKnob = (kn, v) => { try { kn && kn.setValue && kn.setValue(v, { silent: true }); } catch (_) {} };
  const setRange = (setter, v) => { try { setter && setter(v); } catch (_) {} };
  const getTheme = () => (lsGet('grimDark.theme', '').trim());
  const setTheme = (name) => lsSet('grimDark.theme', name);
  const saveLastPresetIfReal = () => { const cur = getTheme(); if (cur && cur.toLowerCase() !== 'custom') lsSet('grimDark.theme.lastPreset', cur); };
  const lastPresetOrDefault = (d = 'Steel Blue') => { const last = (lsGet('grimDark.theme.lastPreset', '').trim()); return last || d; };
  
  // Defaults: prefer CSS variables as the single source of truth.
  // Fall back to stable numbers only if CSS is unavailable.
  const DEFAULTS = (() => {
    const parseCssNum = (name, fb) => {
      try {
        const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
        return Number.isFinite(v) ? v : fb;
      } catch (_) { return fb; }
    };
    return {
      get hue() { return Math.round(parseCssNum('--ui-hue', 210)); },
      get intensity() { return Math.round(parseCssNum('--ui-intensity', 60)); },
      satFromIntensity: (i) => Math.round(i * 0.8),
      get fgBrightness() { return 50; },
      // Backdrop blur in px; UI default is 3 if CSS not present
      get milkiness() { return parseCssNum('--ui-backdrop-blur', 3); },
      // System constant used across UI for opacity multiplier range
      opacityMMAX: 2.5,
    };
  })();
  const applyKnobChrome = (kn) => {
    if (!kn || !kn.el) return;
    try { kn.el.style.setProperty('--kn-ring-global-y', '0.25rem'); } catch (_) {}
    try { kn.el.style.setProperty('--kn-hover-glow', '0 0 0 1px var(--ui-bright-border), var(--ui-glow-strong), var(--ui-surface-glow-outer, 0 0 8px rgba(120,170,255,0.25))'); } catch (_) {}
    try { kn.el.style.setProperty('--kn-focus-glow', 'var(--ui-glow-strong), var(--ui-surface-glow-outer)'); } catch (_) {}
    try { kn.el.style.setProperty('--kn-focus-ring', '0 0 0 1px var(--ui-bright-border)'); } catch (_) {}
    try { kn.el.style.setProperty('--kn-center-ring-color-hover', 'var(--ui-bright-border)'); } catch (_) {}
  };
  // Apply a subtle halo that sits under/around the outer ring using drop-shadow on the ring element.
  // JS-only, reversible; tuned down for subtlety. Baseline (stronger) values kept commented for quick comparison.
  const applyRingHalo = (kn) => {
    if (!kn || !kn.el) return;
    try {
      const ring = kn.el.querySelector('.k-ring');
      if (!ring) return;
      // Baseline (stronger) for quick rollback:
      // 'drop-shadow(0 0 0.375rem var(--ui-bright-border)) drop-shadow(0 0 0.875rem var(--ui-bright-border))'
      // Subtle default previously used at ~60% glow strength: 0.20rem / 0.50rem
      // Now scale radii with Glow Strength (0..100) for consistency with global glow.
      const readGlowStrength = () => {
        try {
          const n = parseFloat(localStorage.getItem('ui_glow_strength'));
          if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
        } catch (_) {}
        return 60; // sane default matches prior visual tuning
      };
      const computeHalo = () => {
        // Smoothly scale from 0 glow at 0% to subtle glow at 100%.
        // Use smoothstep easing to make the low-end ramp gentle.
        const s = Math.max(0, Math.min(1, readGlowStrength() / 100));
        if (s <= 0) return '';
        const t = s * s * (3 - 2 * s); // smoothstep(0..1)
        // Radii chosen to remain subtle at max while matching prior ~0.20/0.50 around 60%.
        const rSmall = (0.27 * t).toFixed(3);
        const rLarge = (0.67 * t).toFixed(3);
        return `drop-shadow(0 0 ${rSmall}rem var(--ui-bright-border)) drop-shadow(0 0 ${rLarge}rem var(--ui-bright-border))`;
      };
      const on = () => { try { ring.style.filter = computeHalo(); } catch (_) {} };
      const off = () => { try { ring.style.filter = ''; } catch (_) {} };
      kn.el.addEventListener('mouseenter', on);
      kn.el.addEventListener('mouseleave', off);
      kn.el.addEventListener('focus', on);
      kn.el.addEventListener('blur', off);
    } catch (_) {}
  };
  const syncGradientHelper = (percent) => {
    try {
      if (percent < 100) {
        // RNG quips for gradient
        const quips = [
          'Gradients: because flat is yesterday\'s apocalypse.',
          'Add gradient. Pretend it\'s depth. Profit.',
          'Surface gradient: subtle flex, big vibes.',
          'Turn the gradient up and whisper "graphics".',
          'Make it shiny. Make it dangerous.',
          'A tasteful gradient never killed anyone. Probably.',
          'Flat UI is for cowards. Embrace the slope.'
        ];
        try { grLbl.removeAttribute('title'); } catch (_) {}
        updateTooltip(grLbl, getQuip('settings.overlay.gradient', quips));
        grLbl.style.opacity = '1';
      } else {
        // At 100% transparency the gradient hides behind glass — keep it chill
        try { grLbl.removeAttribute('title'); } catch (_) {}
        updateTooltip(grLbl, getQuip('settings.overlay.gradientMaxed', [
          'Panels fully clear: gradient on stealth mode.',
          'Nothing to gradient here, move along.',
          'Transparency 100%: gradient took a lunch break.'
        ]));
        grLbl.style.opacity = '0.8';
      }
      // Keep Sci-Fi tooltip text in sync with label
      // Tooltip text already updated above
    } catch (_) {}
  };
  
  // Single header row: 3 columns (label | dropdown | reset), vertically centered
  const hdrRow = createUiElement(basicToolbarRow);
  const lbl = createUiElement(basicFormLabel, 'Theme Preset:');
  hdrRow.appendChild(lbl);

  // Create Reset button now; append after dropdown is created
  resetBtn = createUiElement(basicButton, 'button', 'Reset');
  // Small gap between section header and toolbar row
  try { sec.appendChild(createUiElement(basicQuarterGap)); } catch (_) {}
  sec.appendChild(hdrRow);

  // Optional Theme preset dropdown for overlay
  let dd = null; // preset dropdown (overlay only)
  (function buildThemeHeader() {
    try {
      // Theme presets: import centralized presets directly (single source of truth)
      const presets = themePresets;

        try {
          // Use unified key 'grimDark.theme' only (no compatibility fallback)
          let savedPreset = null;
          try { savedPreset = (localStorage.getItem('grimDark.theme') || '').trim(); } catch (_) {}
          const names = Object.keys(presets);
          const items = [{ label: 'Custom', value: 'Custom' }].concat(names.map(n => ({ label: n, value: n })));
          let ddValue = 'Steel Blue';
          if (savedPreset && savedPreset.toLowerCase() === 'custom') ddValue = 'Custom';
          else if (savedPreset && names.includes(savedPreset)) ddValue = savedPreset;
          dd = createDropdown({ items, value: ddValue, width: '15rem', onChange: (val) => {
            if (val === 'Custom') {
              // Persist the last non-Custom preset so Reset can restore it (like Controls tab)
              saveLastPresetIfReal();
              setTheme('custom');
              // No immediate apply; user will tweak controls.
              dd.setValue('Custom', false);
            } else {
              setTheme(val);
              // Apply the preset while suppressing 'Custom' flips from onChange handlers
              silently(() => applyPreset(val));
              dd.setValue(val, false);
            }
          }});
          // Keep dropdown flush for vertical centering in grid
          if (dd && dd.el) dd.el.style.marginTop = '0';
        } catch (_) {
          dd = createDropdown({ items: [{ label: 'Custom', value: 'Custom' }], value: 'Custom', width: '15rem' });
          // Keep dropdown flush even on fallback
          if (dd && dd.el) dd.el.style.marginTop = '0';
          try { if (dd && dd.el) dd.el.style.marginTop = '0'; } catch (_) {}
        }
        if (dd) hdrRow.appendChild(dd.el);
        if (resetBtn) hdrRow.appendChild(resetBtn);
    } catch (_) {
      // Fallback: no-op if header cannot be built
    }
  })();

  // Helper: when any slider/knob changes, mark preset as Custom (do not re-apply values)
  function selectCustomPreset() {
    if (isApplyingPreset) return;
    // Record last real preset the first time we flip to Custom
    try { saveLastPresetIfReal(); } catch (_) {}
    try { setTheme('custom'); } catch (_) {}
    try { dd && dd.setValue && dd.setValue('Custom', false); } catch (_) {}
  }

  // Unified percentage formatter for right-side value labels
  function fmtPct(p) {
    try { const v = Math.round(Number(p)); return { text: `${v}%`, title: `${v}%` }; } catch (_) { return { text: `${p}%`, title: `${p}%` }; }
  }

  // Optional color knobs (Hue / Saturation / Intensity) + Text Brightness for overlay if available
  // Mirrors previous inline overlay implementation and initializes from storage
  let hueKn = null, satKn = null, briKn = null, txtKn = null;
  try {
    // Insert "Overall UI" section header before the color knobs
    try {
        // Generate a separate quip for this section; avoid repeating header quip
        const fallbackQuips = [
          'Small tweaks, big vibes.',
          "Sorry we didn't have a mood dial.",
          'Paint your pixels, paint your doom.',
          'Saturate your soul.',
          'Crank saturation. Enter gamer mode.',
          'What? Our presets not good enough?',
          'Paint the town red. Or any other color you want.',
          'You know, those color knobs took forever to code.',
          'Too bright? Too dark? Too opinionated? Good.',
          'Hue today, gone tomorrow.',          
          "They say color defines your personality. What's yours?",
          'Death knows no color, but we do.',
          'Choosing red does more damage. Source? Trust me bro.',
          'If your colors suck, I might change them back.',
          "Reminder: colors can’t fix your lack of skill.",
          'Pick a color. Regret is free.',
          'If your UI hurts, move a knob until it apologizes.',
          'Colors are temporary. Regret is forever.',
          "Just because you can, doesn't mean you should.",
          "It’s not you, it’s saturation.",
          "So you think you know more about color than we do?"
        ];
        const overallQuip = getQuip('settings.overlay.overallUI', fallbackQuips);
        // Gap before the new section for consistent spacing
        container.appendChild(createUiElement(basicGapBetweenSections, 'div'));
        container.appendChild(makeSection('Base UI Color', overallQuip, 'afterTitle', true));
      } catch (_) {}
      const CK = (window && window.ColorKnobs) ? window.ColorKnobs : null;
      if (CK && CK.createHueKnob && CK.createSaturationKnob && CK.createIntensityKnob) {
        const knobRow = document.createElement('div');
        knobRow.style.display = 'flex';
        knobRow.style.gap = 'var(--ui-gap, 1rem)';
        knobRow.style.alignItems = 'center';
        // Evenly distribute knobs across the row for better spacing
        knobRow.style.justifyContent = 'space-evenly';
        knobRow.style.margin = 'calc(var(--ui-gap, 1rem) * 2) var(--ui-gap, 1rem) 0 var(--ui-gap, 1rem)';
        knobRow.style.padding = '0';
        knobRow.style.overflow = 'visible';
        knobRow.style.marginTop = 'calc(var(--ui-gap, 1rem) * 2)';

        const makeCol = (el, caption) => {
          const wrap = document.createElement('div');
          wrap.style.display = 'flex';
          wrap.style.flexDirection = 'column';
          wrap.style.alignItems = 'center';
          // Columns in rem, not px
          wrap.style.minWidth = '5rem';
          wrap.style.padding = '0.25rem 0.125rem';
          wrap.style.overflow = 'visible';
          wrap.appendChild(el);
          // Use the standard label template for captions (unified styling)
          const cap = createUiElement(basicFormLabel, caption);
          // Center and constrain without the wide minWidth the label template has
          cap.style.textAlign = 'center';
          cap.style.minWidth = 'auto';
          // Slightly subdued, like before
          cap.style.opacity = '0.8';
          // 14px ≈ 0.875rem
          cap.style.marginTop = '1.375rem';
          wrap.appendChild(cap);
          return wrap;
        };

        // Compute knob sizes in rem -> px at runtime (ColorKnobs expects numeric px)
        let remPx = 16;
        try { remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; } catch (_) {}
        const knobSizePx = 3.5 * remPx;      // 56px -> 3.5rem
        const ringOffsetPx = 1.125 * remPx;  // 18px -> 1.125rem

        hueKn = CK.createHueKnob({
          size: knobSizePx,
          label: 'Hue',
          ringOffset: ringOffsetPx,
          // ColorKnobs already applies hue on input; only mark Custom here
          onInput: () => { try { selectCustomPreset(); } catch (_) {} }
        });
        // Place Hue tooltip to the left of the knob
        try { if (hueKn && hueKn.el) hueKn.el.__sfTipPlacementPriority = 'lc,l'; } catch (_) {}
        satKn = CK.createSaturationKnob({
          size: knobSizePx,
          label: 'Saturation',
          ringOffset: ringOffsetPx,
          // ColorKnobs already applies saturation on input; only mark Custom here
          onInput: () => { try { selectCustomPreset(); } catch (_) {} }
        });
        briKn = CK.createIntensityKnob({
          size: knobSizePx,
          label: 'Intensity',
          ringOffset: ringOffsetPx,
          // ColorKnobs already applies intensity on input; only mark Custom here
          onInput: () => { try { selectCustomPreset(); } catch (_) {} }
        });

        // Apply shared knob chrome (ring offset + hover/focus glow)
        applyKnobChrome(hueKn);
        applyKnobChrome(satKn);
        applyKnobChrome(briKn);
        // Apply ring halo on hover/focus for all three color knobs
        applyRingHalo(hueKn);
        applyRingHalo(satKn);
        applyRingHalo(briKn);

        knobRow.appendChild(makeCol(hueKn.el, 'Hue'));
        knobRow.appendChild(makeCol(briKn.el, 'Intensity'));
        knobRow.appendChild(makeCol(satKn.el, 'Saturation'));

        // New foreground Text Brightness knob (0..100, default 50)
        // Uses the generic knob with a grayscale spectrum ring for consistency
        txtKn = createKnob({
          min: 0,
          max: 100,
          value: 50,
          step: 5,
          wheelFineStep: 1,
          size: knobSizePx,
          label: 'Text Brightness',
          segments: -1,
          angleMin: -135,
          angleMax: 135,
          ringOffset: ringOffsetPx,
          // Grayscale ring: dark -> light across the sweep
          ringColorForAngle: (_angDeg, t) => {
            const c = Math.round(96 + t * (255 - 96));
            return `rgb(${c}, ${c}, ${c})`;
          },
          onInput: (v) => {
            try { window.UITheme && window.UITheme.applyDynamicTheme({ fgBrightness: Math.round(v) }); } catch (_) {}
            try { selectCustomPreset(); } catch (_) {}
          },
          onChange: (v) => {
            try { window.UITheme && window.UITheme.applyDynamicTheme({ fgBrightness: Math.round(v) }); } catch (_) {}
          }
        });

        // Place Text Brightness tooltip to the right of the knob
        try { if (txtKn && txtKn.el) { txtKn.el.__sfTipMode = 'far'; txtKn.el.__sfTipPlacementPriority = 'rc,r'; } } catch (_) {}

        // Match other knobs' hover/focus glow and apply bright border
        try { txtKn.el.style.setProperty('--kn-hover-glow', '0 0 0 1px var(--ui-bright-border), var(--ui-glow-strong), var(--ui-surface-glow-outer, 0 0 8px rgba(120,170,255,0.25))'); } catch (_) {}
        try { txtKn.el.style.setProperty('--kn-focus-glow', 'var(--ui-glow-strong), var(--ui-surface-glow-outer)'); } catch (_) {}
        try { txtKn.el.style.setProperty('--kn-focus-ring', '0 0 0 1px var(--ui-bright-border)'); } catch (_) {}
        try { txtKn.el.style.setProperty('--kn-center-ring-color-hover', 'var(--ui-bright-border)'); } catch (_) {}
        // Centering fudge: align spectrum ring vertically like other knobs
        try { txtKn.el.style.setProperty('--kn-ring-global-y', '0.25rem'); } catch (_) {}
        // Apply ring halo for Text Brightness knob as well
        try { applyRingHalo(txtKn); } catch (_) {}

        knobRow.appendChild(makeCol(txtKn.el, 'Text Brightness'));

        container.appendChild(knobRow);

        // Spacer between knob row and Transparency slider (exactly 1rem)
        try { const spacer = document.createElement('div'); spacer.style.height = '1rem'; spacer.style.width = '100%'; spacer.style.pointerEvents = 'none'; container.appendChild(spacer); } catch (_) {}

        // Initialize knob values from current CSS (single source of truth),
        // falling back to storage and then hard defaults (silent)
        try {
          const root = document.documentElement;
          const cs = getComputedStyle(root);

          const cssHue = parseFloat(cs.getPropertyValue('--ui-hue'));
          const hueInit = clamp(Math.round(Number.isFinite(cssHue) ? cssHue : lsGetNum('ui_hue', DEFAULTS.hue)), 0, 360);
          setKnob(hueKn, hueInit);

          const cssInt = parseFloat(cs.getPropertyValue('--ui-intensity'));
          const intensityInit = clamp(Math.round(Number.isFinite(cssInt) ? cssInt : lsGetNum('ui_intensity', DEFAULTS.intensity)), 0, 100);
          const satStored = lsGetNum('ui_saturation', NaN);
          const satInit = clamp(Number.isFinite(satStored) ? Math.round(satStored) : DEFAULTS.satFromIntensity(intensityInit), 0, 100);
          setKnob(satKn, satInit);

          const briInit = intensityInit; // intensity knob mirrors ui_intensity
          setKnob(briKn, briInit);

          // Foreground brightness init (default 50)
          const fgInit = clamp(Math.round(lsGetNum('ui_fg_brightness', DEFAULTS.fgBrightness)), 0, 100);
          setKnob(txtKn, fgInit);
        } catch (_) {}
      }
  } catch (_) {}

  // Gradient strength slider (0-100)
  const { row: grRow, label: grLbl, input: grRng, value: grVal, set: grSet } = createRangeElement(
    0, 100, 1, 60, 'Gradient:', {
      storageKey: 'ui_gradient',
      attachWheel,
      debugLabel: 'display',
      toDisplay: fmtPct,
      onChange: (p) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ gradient: p }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  // Attach Sci-Fi tooltip to Gradient label and initialize text
  try {
    try { grLbl.removeAttribute('title'); } catch (_) {}
    attachTooltip(grLbl, { mode: 'far', placement: 'lc' });
    updateTooltip(grLbl, 'Surface gradient intensity');
  } catch (_) {}
  attachHover && attachHover(grRng, grLbl);
  attachHover && attachHover(grRng, grVal);

  // Blur slider (backdrop blur 0-10px)
  const { row: mkRow, label: mkLbl, input: mkRng, value: mkVal, set: mkSet } = createRangeElement(
    0, 10, 0.1, 3, 'Overlay Blur:', {
      storageKey: 'ui_milkiness',
      attachWheel,
      debugLabel: 'display',
      // Display as percentage (0..10px -> 0..100%)
      toDisplay: (v) => fmtPct(Number(v) * 10),
      onChange: (v) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ milkiness: v }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  try {
    try { mkLbl.removeAttribute('title'); } catch (_) {}
    updateTooltip(mkLbl, getQuip('settings.overlay.blur', [
      'Blur the world. Focus on victory.',
      'A little blur hides a lot of sins.',
      'Smudge reality for better UI.',
      'Blur it like you meant to click that.',
      "If it's ugly, blur harder.",
      'Gaussian vibes, battlefield focus.'
    ]));
  } catch (_) {}
  // Attach Sci-Fi tooltip to Blur label and initialize text
  try { attachTooltip(mkLbl, { mode: 'far', placement: 'lc' }); } catch (_) {}
  attachHover && attachHover(mkRng, mkLbl);
  attachHover && attachHover(mkRng, mkVal);

  // Transparency slider now grouped under the "Base UI Color" section (no extra header)

  // Transparency slider (reversed: 100% = clear, 0% = opaque)
  const { row: opRow, label: opLbl, input: opRng, value: opVal, set: opSet } = createRangeElement(
    0, 100, 1, 100, 'Transparency:', {
      storageKey: 'ui_opacity_mult',
      attachWheel,
      debugLabel: 'opacity',
      toDisplay: fmtPct,
      toStorage: (p) => String(((100 - p) / 100) * DEFAULTS.opacityMMAX),
      fromStorage: (s) => {
        const mult = parseFloat(s);
        const p = Number.isFinite(mult) ? clamp(Math.round(100 - (mult / DEFAULTS.opacityMMAX) * 100), 0, 100) : 100;
        return p;
      },
      onChange: (p) => {
        const mult = ((100 - p) / 100) * DEFAULTS.opacityMMAX;
        try { window.UITheme && window.UITheme.applyDynamicTheme({ opacityMult: mult }); } catch (_) {}
        // Gradient tooltip visible only when panels aren’t fully clear
        try { opLbl.removeAttribute('title'); } catch (_) {}
        try { updateTooltip(opLbl, 'Higher = clearer panels; lower = more solid'); } catch (_) {}
        syncGradientHelper(p);
        try { selectCustomPreset(); } catch (_) {}
      }
    }
  );
  // Attach Sci-Fi tooltip to Transparency label and initialize text
  try { opLbl && opLbl.removeAttribute && opLbl.removeAttribute('title'); } catch (_) {}
  try { attachTooltip(opLbl, { mode: 'far', placement: 'lc' }); updateTooltip(opLbl, 'Higher = clearer panels; lower = more solid'); } catch (_) {}
  // Initialize from CSS var if available (preferred over LS default)
  try {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
    const mult = parseFloat(css);
    const p = Number.isFinite(mult) ? clamp(Math.round(100 - (mult / DEFAULTS.opacityMMAX) * 100), 0, 100) : 100;
    silently(() => { setRange(opSet, p); });
    syncGradientHelper(p);
  } catch (_) {}
  attachHover && attachHover(opRng, opLbl);
  attachHover && attachHover(opRng, opVal);
  // Unify value styling with label template
  container.appendChild(opRow);

  // Place Gradient and Blur after Transparency now
  try {
    const pInit = clamp(Math.round(parseFloat(opRng.value) || 0), 0, 100);
    syncGradientHelper(pInit);
  } catch (_) {}
  // New section header to group Gradient / Overlay Darkness / Overlay Blur
  try {
    container.appendChild(createUiElement(basicGapBetweenSections, 'div'));
    const bdQuip = getQuip('settings.overlay.backdropDepth', [
      'Gradient, dimming, and blur — the holy trinity.',
      'A little depth keeps the UI from looking like a PDF.',
      'Depth effects: tasteful seasoning for your interface stew.',
      'Turn knobs here until reality looks expensive.',
      'Layered vibes for layered problems.'
    ]);
    container.appendChild(makeSection('Backdrop & Depth', bdQuip, 'afterTitle', true));
  } catch (_) {}
  container.appendChild(grRow);

  // New: Overlay Darkness (0-100)
  const { row: odRow, label: odLbl, input: odRng, value: odVal, set: odSet } = createRangeElement(
    0, 100, 1, 50, 'Overlay Darkness:', {
      storageKey: 'ui_overlay_darkness',
      attachWheel,
      debugLabel: 'display',
      toDisplay: fmtPct,
      onChange: (p) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ overlayDarkness: p }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  try {
    try { odLbl.removeAttribute('title'); } catch (_) {}
    updateTooltip(odLbl, getQuip('settings.overlay.darkness', [
      'Darken the world. Or your mood. Both work.',
      'Dim the background so your choices look brighter.',
      'More darkness, fewer distractions. Very brooding.',
      'If in doubt: more dramatic lighting.',
      'Overlay darkness: because gritty is in.'
    ]));
  } catch (_) {}
  // Attach Sci-Fi tooltip to Overlay Darkness label and initialize text
  try { attachTooltip(odLbl, { mode: 'far', placement: 'lc' }); } catch (_) {}
  attachHover && attachHover(odRng, odLbl);
  attachHover && attachHover(odRng, odVal);
  container.appendChild(odRow);
  container.appendChild(mkRow);

  // Insert Border section header
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
        'Glow up? No. Glow knob? Absolutely.',
        'A touch here, a glow there.'
      ];
      container.appendChild(createUiElement(basicGapBetweenSections, 'div'));
      container.appendChild(makeSection('Border', getQuip('settings.overlay.borderTag', borderQuips), 'afterTitle', true));
    } catch (_) {}
  

  // New: Border Intensity (0-100)
  const { row: biRow, label: biLbl, input: biRng, value: biVal, set: biSet } = createRangeElement(
    0, 100, 1, 70, 'Border Intensity:', {
      storageKey: 'ui_border_intensity',
      attachWheel,
      debugLabel: 'display',
      toDisplay: fmtPct,
      onChange: (p) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ borderStrength: p }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  try { biLbl && biLbl.removeAttribute && biLbl.removeAttribute('title'); } catch (_) {}
  // Attach Sci-Fi tooltip to Border Intensity label and initialize text
  try { attachTooltip(biLbl, { mode: 'far', placement: 'lc' }); updateTooltip(biLbl, 'Strength of panel borders'); } catch (_) {}
  attachHover && attachHover(biRng, biLbl);
  attachHover && attachHover(biRng, biVal);
  biRow && container.appendChild(biRow);

  // New: Glow Strength (0-100)
  const { row: gsRow, label: gsLbl, input: gsRng, value: gsVal, set: gsSet } = createRangeElement(
    0, 100, 1, 60, 'Glow Strength:', {
      storageKey: 'ui_glow_strength',
      attachWheel,
      debugLabel: 'display',
      // Show as simple percentage to unify all displays
      toDisplay: fmtPct,
      onChange: (p) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ glowStrength: p }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  try { gsLbl && gsLbl.removeAttribute && gsLbl.removeAttribute('title'); } catch (_) {}
  // Attach Sci-Fi tooltip to Glow Strength label and initialize text
  try { attachTooltip(gsLbl, { mode: 'far', placement: 'lc' }); updateTooltip(gsLbl, 'Strength of panel glow and highlights'); } catch (_) {}
  attachHover && attachHover(gsRng, gsLbl);
  attachHover && attachHover(gsRng, gsVal);
  container.appendChild(gsRow);

  // Now that all controls exist, wire the Reset to also update their UI values instantly
  try {
    if (resetBtn) {
      resetBtn.onclick = () => {
        // Reset to the last real preset if currently Custom; else reset to the current preset
        let target = 'Steel Blue';
        try {
          const cur = getTheme();
          target = (!cur || cur.toLowerCase() === 'custom') ? lastPresetOrDefault('Steel Blue') : cur;
        } catch (_) {}
        // Use the same code path as choosing a preset from the dropdown to avoid mismatches
        silently(() => {
          try { if (typeof applyPreset === 'function') applyPreset(target); } catch (_) {}
          try { dd && dd.setValue && dd.setValue(target, false); } catch (_) {}
        });
      };
    }
  } catch (_) {}

  // Hidden dev hotkey: Ctrl+E to export current settings to console while this tab is active
  try {
    const onKey = (ev) => {
      try {
        // Auto-cleanup when container is gone
        if (!document.body.contains(container)) { window.removeEventListener('keydown', onKey); return; }
        if (ev.ctrlKey && !ev.altKey && !ev.shiftKey && String(ev.key).toLowerCase() === 'e') {
          const tm = (window && window.UITheme) ? window.UITheme : null;
          const preset = tm && typeof tm.exportCurrentPreset === 'function' ? tm.exportCurrentPreset() : null;
          if (preset) {
            console.log('[ThemeTab] Export (Ctrl+E):', preset);
            try { console.log(JSON.stringify({ 'My Preset': preset }, null, 2)); } catch (_) {}
          } else {
            console.warn('[ThemeTab] UITheme.exportCurrentPreset() unavailable');
          }
        }
      } catch (_) {}
    };
    window.addEventListener('keydown', onKey);
  } catch (_) {}

  // Apply a named preset to all sliders and persist values (overlay usage)
  function applyPreset(name) {
    try {
      // Delegate theme application to UITheme (includes transparency)
      try { window.UITheme && window.UITheme.applyTheme(name); } catch (_) {}
      try { localStorage.setItem('grimDark.theme', name); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('ui:hue-changed')); } catch (_) {}

      // Update UI controls from current persisted state/CSS
      try { const b = clamp(Math.round(lsGetNum('ui_border_intensity', 80)), 0, 100); biSet && biSet(b); } catch (_) {}
      try { const g = clamp(Math.round(lsGetNum('ui_glow_strength', 18)), 0, 100); gsSet && gsSet(g); } catch (_) {}
      try { const gr = clamp(Math.round(lsGetNum('ui_gradient', 60)), 0, 100); grSet && grSet(gr); } catch (_) {}
      try { let m = lsGetNum('ui_milkiness', 3); m = clamp(m, 0, 10); mkSet && mkSet(m); } catch (_) {}
      try { const od = clamp(Math.round(lsGetNum('ui_overlay_darkness', 60)), 0, 100); odSet && odSet(od); } catch (_) {}
      try {
        const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
        const mult = parseFloat(css);
        const t = Number.isFinite(mult) ? clamp(Math.round(100 - (mult / DEFAULTS.opacityMMAX) * 100), 0, 100) : 100;
        opSet && opSet(t);
        // Keep Gradient helper visibility consistent with current transparency
        syncGradientHelper(t);
      } catch (_) {}

      // Silently sync knobs to the preset values if available
      try {
        const tm = (window && window.UITheme) ? window.UITheme : null;
        const p = (tm && tm.presets && tm.presets[name]) ? tm.presets[name] : null;
        if (p) {
          if (hueKn && hueKn.setValue) hueKn.setValue(p.hue, { silent: true });
          const satVal = Math.max(0, Math.min(100, Math.round(Number(p.saturation))));
          if (satKn && satKn.setValue) satKn.setValue(satVal, { silent: true });
          const br = Math.max(0, Math.min(100, Math.round(Number(p.intensity) || 60)));
          if (briKn && briKn.setValue) briKn.setValue(br, { silent: true });
          // Sync Text Brightness knob to preset value
          try {
            const fgb = Math.max(0, Math.min(100, Math.round(Number(p.fgBrightness) || 50)));
            if (txtKn && txtKn.setValue) txtKn.setValue(fgb, { silent: true });
          } catch (_) {}
        }
      } catch (_) {}
    } catch (_) {}
  }
}
