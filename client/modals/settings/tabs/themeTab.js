// Theme Tab: renders the Theme settings for panel and overlay
// Keeps logic identical to the previous inline implementation in settings.js,
// but removes cross-tab DOM references (fsRng/fsVal) to avoid coupling.
// Minimal, human-readable, and commented per project conventions.

import { getQuip } from '../../../core/ui/quip.js';
import { createDropdown } from '../../../core/ui/controls.js';
import { makeSection, attachWheel, attachHover } from '../uiHelpers.js';
import { themePresets } from '../../../core/ui/theme/presets.js';
import { createUiElement, basicButton, createRangeElement, basicFormRow, basicFormLabel, basicQuarterGap, basicGapBetweenSections, basicToolbarRow } from '../../../core/ui/theme/elements.js';

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
              try { localStorage.setItem('grimDark.theme', 'custom'); } catch (_) {}
              // No immediate apply; user will tweak controls.
              try { dd && dd.setValue('Custom', false); } catch (_) {}
            } else {
              try { localStorage.setItem('grimDark.theme', val); } catch (_) {}
              // Apply the preset while suppressing 'Custom' flips from onChange handlers
              isApplyingPreset = true;
              try { if (typeof applyPreset === 'function') applyPreset(val); } catch (_) {}
              isApplyingPreset = false;
              try { dd && dd.setValue(val, false); } catch (_) {}
            }
          }});
          // Keep dropdown flush for vertical centering in grid
          try { if (dd && dd.el) dd.el.style.marginTop = '0'; } catch (_) {}
        } catch (_) {
          dd = createDropdown({ items: [{ label: 'Custom', value: 'Custom' }], value: 'Custom', width: '15rem' });
          // Keep dropdown flush even on fallback
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
    try { localStorage.setItem('grimDark.theme', 'custom'); } catch (_) {}
    try { dd && dd.setValue && dd.setValue('Custom', false); } catch (_) {}
  }

  // Style helper: make right-side slider value look like a label (unified template)
  function styleAsLabel(el) {
    try {
      el.style.color = 'var(--ui-fg)';
      el.style.fontSize = 'var(--ui-fontsize-small)';
      el.style.userSelect = 'none';
    } catch (_) {}
  }

  // Optional color knobs (Hue / Saturation / Intensity) for overlay if available
  // Mirrors previous inline overlay implementation and initializes from storage
  let hueKn = null, satKn = null, briKn = null;
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
          onInput: () => { try { selectCustomPreset(); } catch (_) {} }
        });
        satKn = CK.createSaturationKnob({
          size: knobSizePx,
          label: 'Saturation',
          ringOffset: ringOffsetPx,
          onInput: () => { try { selectCustomPreset(); } catch (_) {} }
        });
        briKn = CK.createIntensityKnob({
          size: knobSizePx,
          label: 'Intensity',
          ringOffset: ringOffsetPx,
          onInput: () => { try { selectCustomPreset(); } catch (_) {} }
        });

        // Use rem for global ring Y offset
        try { hueKn.el.style.setProperty('--kn-ring-global-y', '0.25rem'); } catch (_) {}
        try { satKn.el.style.setProperty('--kn-ring-global-y', '0.25rem'); } catch (_) {}
        try { briKn.el.style.setProperty('--kn-ring-global-y', '0.25rem'); } catch (_) {}

        // Match Sound tab knobs: strong, scalable hover/focus glow tied to UI glow tokens
        // These scale with the Glow Strength slider via --ui-glow-strong / --ui-surface-glow-outer
        try {
          hueKn.el.style.setProperty('--kn-hover-glow', 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))');
          hueKn.el.style.setProperty('--kn-focus-glow', 'var(--ui-glow-strong), var(--ui-surface-glow-outer)');
        } catch (_) {}
        try {
          satKn.el.style.setProperty('--kn-hover-glow', 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))');
          satKn.el.style.setProperty('--kn-focus-glow', 'var(--ui-glow-strong), var(--ui-surface-glow-outer)');
        } catch (_) {}
        try {
          briKn.el.style.setProperty('--kn-hover-glow', 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))');
          briKn.el.style.setProperty('--kn-focus-glow', 'var(--ui-glow-strong), var(--ui-surface-glow-outer)');
        } catch (_) {}

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
  } catch (_) {}

  // Gradient strength slider (0-100)
  const { row: grRow, label: grLbl, input: grRng, value: grVal, set: grSet } = createRangeElement(
    0, 100, 1, 60, 'Gradient:', {
      storageKey: 'ui_gradient',
      attachWheel,
      debugLabel: 'display',
      toDisplay: (p) => ({ text: `${p}%`, title: `${p}%` }),
      onChange: (p) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ gradient: p }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  attachHover && attachHover(grRng, grLbl);
  // Unify value styling with label template
  try { styleAsLabel(grVal); } catch (_) {}

  // Blur slider (backdrop blur 0-10px)
  const { row: mkRow, label: mkLbl, input: mkRng, value: mkVal, set: mkSet } = createRangeElement(
    0, 10, 0.1, 3, 'Overlay Blur:', {
      storageKey: 'ui_milkiness',
      attachWheel,
      debugLabel: 'display',
      toDisplay: (v) => ({ text: `${Number(v).toFixed(1)}px`, title: `${Number(v).toFixed(1)}px` }),
      onChange: (v) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ milkiness: v }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  try { mkLbl.title = 'Background blur behind panels/overlays'; } catch (_) {}
  attachHover && attachHover(mkRng, mkLbl);
  // Unify value styling with label template
  try { styleAsLabel(mkVal); } catch (_) {}

  // Insert Transparency section header
  try {
      const subtleQuips = [
        'Big movements, subtle changes.',
        'If you do not look closely, you may miss it.',
        'Subtle shifts shape the mood.',
        "It's the little things that matter",
        'It whispers, not shouts.'
      ];
      // Gap before the new section
      container.appendChild(createUiElement(basicGapBetweenSections, 'div'));
      container.appendChild(makeSection('Transparency', getQuip('settings.overlay.transparencyTag', subtleQuips), 'afterTitle', true));
  } catch (_) {}

  // Transparency slider (reversed: 100% = clear, 0% = opaque)
  const MMAX = 2.5;
  const { row: opRow, label: opLbl, input: opRng, value: opVal, set: opSet } = createRangeElement(
    0, 100, 1, 100, 'Transparency:', {
      storageKey: 'ui_opacity_mult',
      attachWheel,
      debugLabel: 'opacity',
      toDisplay: (p) => ({ text: `${p}%`, title: `${p}%` }),
      toStorage: (p) => String(((100 - p) / 100) * MMAX),
      fromStorage: (s) => {
        const mult = parseFloat(s);
        const p = Number.isFinite(mult) ? Math.max(0, Math.min(100, Math.round(100 - (mult / MMAX) * 100))) : 100;
        return p;
      },
      onChange: (p) => {
        const mult = ((100 - p) / 100) * MMAX;
        try { window.UITheme && window.UITheme.applyDynamicTheme({ opacityMult: mult }); } catch (_) {}
        // Gradient tooltip visible only when panels aren’t fully clear
        try { if (p < 100) { opLbl.title = 'Higher = clearer panels; lower = more solid'; grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; } else { grLbl.title = ''; grLbl.style.opacity = '0.8'; } } catch (_) {}
        try { selectCustomPreset(); } catch (_) {}
      }
    }
  );
  try { opLbl.title = 'Higher = clearer panels; lower = more solid'; } catch (_) {}
  // Initialize from CSS var if available (preferred over LS default)
  try {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
    const mult = parseFloat(css);
    const p = Number.isFinite(mult) ? Math.max(0, Math.min(100, Math.round(100 - (mult / MMAX) * 100))) : 100;
    // Suppress marking preset as Custom during this initial programmatic sync
    isApplyingPreset = true;
    try { opSet && opSet(p); } catch (_) {}
    isApplyingPreset = false;
  } catch (_) {}
  attachHover && attachHover(opRng, opLbl);
  // Unify value styling with label template
  try { styleAsLabel(opVal); } catch (_) {}
  container.appendChild(opRow);

  // Place Gradient and Blur after Transparency now
  try {
    const pInit = Math.max(0, Math.min(100, Math.round(parseFloat(opRng.value) || 0)));
    if (pInit < 100) { grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; } else { grLbl.title = ''; grLbl.style.opacity = '0.8'; }
  } catch (_) {}
  container.appendChild(grRow);

  // New: Overlay Darkness (0-100)
  const { row: odRow, label: odLbl, input: odRng, value: odVal, set: odSet } = createRangeElement(
    0, 100, 1, 50, 'Overlay Darkness:', {
      storageKey: 'ui_overlay_darkness',
      attachWheel,
      debugLabel: 'display',
      toDisplay: (p) => ({ text: `${p}%`, title: `${p}%` }),
      onChange: (p) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ overlayDarkness: p }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  try { odLbl.title = 'Dimming behind dialogs/menus'; } catch (_) {}
  attachHover && attachHover(odRng, odLbl);
  container.appendChild(odRow);
  // Unify value styling with label template
  try { styleAsLabel(odVal); } catch (_) {}
  // Place Overlay Blur after Overlay Darkness
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
      toDisplay: (p) => ({ text: `${p}%`, title: `${p}%` }),
      onChange: (p) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ borderStrength: p }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  try { biLbl.title = 'Strength of panel borders'; } catch (_) {}
  attachHover && attachHover(biRng, biLbl);
  biRow && container.appendChild(biRow);
  // Unify value styling with label template
  try { styleAsLabel(biVal); } catch (_) {}

  // New: Glow Strength (0-100)
  const { row: gsRow, label: gsLbl, input: gsRng, value: gsVal, set: gsSet } = createRangeElement(
    0, 100, 1, 60, 'Glow Strength:', {
      storageKey: 'ui_glow_strength',
      attachWheel,
      debugLabel: 'display',
      toDisplay: (p) => {
        try { const px = Math.round((p / 100) * 44); return { text: `${px}px`, title: `${p}%` }; } catch (_) { return { text: `${p}%`, title: `${p}%` }; }
      },
      onChange: (p) => { try { window.UITheme && window.UITheme.applyDynamicTheme({ glowStrength: p }); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }
    }
  );
  try { gsLbl.title = 'Strength of panel glow and highlights'; } catch (_) {}
  attachHover && attachHover(gsRng, gsLbl);
  container.appendChild(gsRow);
  // Unify value styling with label template
  try { styleAsLabel(gsVal); } catch (_) {}

  // Now that all controls exist, wire the Reset to also update their UI values instantly
  try {
    if (resetBtn) {
      resetBtn.onclick = () => {
        isApplyingPreset = true;
        try {
          // Reset theme selection to default preset
          try { localStorage.setItem('grimDark.theme', 'Steel Blue'); } catch (_) {}
          try { dd && dd.setValue('Steel Blue', false); } catch (_) {}
          // Apply preset fully (includes transparency via themeManager)
          try { window.UITheme && window.UITheme.applyTheme('Steel Blue'); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('ui:hue-changed')); } catch (_) {}

          // Sync sliders from current state (passive display)
          try {
            let gr = parseFloat(localStorage.getItem('ui_gradient')); if (!Number.isFinite(gr)) gr = 60;
            gr = Math.max(0, Math.min(100, Math.round(gr)));
            grSet && grSet(gr);
          } catch (_) {}
          try {
            let m = parseFloat(localStorage.getItem('ui_milkiness')); if (!Number.isFinite(m)) m = 3;
            m = Math.max(0, Math.min(10, m));
            mkSet && mkSet(m);
          } catch (_) {}
          try {
            let od = parseFloat(localStorage.getItem('ui_overlay_darkness')); if (!Number.isFinite(od)) od = 60;
            od = Math.max(0, Math.min(100, Math.round(od)));
            odSet && odSet(od);
          } catch (_) {}
          try {
            let b = parseFloat(localStorage.getItem('ui_border_intensity')); if (!Number.isFinite(b)) b = 80;
            b = Math.max(0, Math.min(100, Math.round(b)));
            biSet && biSet(b);
          } catch (_) {}
          try {
            let g = parseFloat(localStorage.getItem('ui_glow_strength')); if (!Number.isFinite(g)) g = 18;
            g = Math.max(0, Math.min(100, Math.round(g)));
            gsSet && gsSet(g);
          } catch (_) {}
          try {
            const MMAX = 2.5;
            const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
            const mult = parseFloat(css);
            const pNow = Number.isFinite(mult) ? Math.max(0, Math.min(100, Math.round(100 - (mult / MMAX) * 100))) : 100;
            opSet && opSet(pNow);
            // Gradient label helper visibility
            if (pNow < 100) { grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; }
            else { grLbl.title = ''; grLbl.style.opacity = '0.8'; }
          } catch (_) {}

          // Sync knobs silently to preset hue/intensity
          try { if (hueKn && hueKn.setValue) { const p = (window.UITheme && window.UITheme.presets && window.UITheme.presets['Steel Blue']) || { hue: 207, intensity: 60 }; hueKn.setValue(p.hue, { silent: true }); } } catch (_) {}
          try { if (satKn && satKn.setValue) { const p = (window.UITheme && window.UITheme.presets && window.UITheme.presets['Steel Blue']) || { intensity: 60 }; const satEff = Math.max(0, Math.min(85, Math.round((Number(p.intensity) || 60) * 0.8))); satKn.setValue(satEff, { silent: true }); } } catch (_) {}
          try { if (briKn && briKn.setValue) { const p = (window.UITheme && window.UITheme.presets && window.UITheme.presets['Steel Blue']) || { intensity: 60 }; briKn.setValue(Math.max(0, Math.min(100, Math.round(Number(p.intensity) || 60))), { silent: true }); } } catch (_) {}
        } catch (_) {}
        isApplyingPreset = false;
      };
    }
  } catch (_) {}

  // Apply a named preset to all sliders and persist values (overlay usage)
  function applyPreset(name) {
    try {
      // Delegate theme application to UITheme (includes transparency)
      try { window.UITheme && window.UITheme.applyTheme(name); } catch (_) {}
      try { localStorage.setItem('grimDark.theme', name); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('ui:hue-changed')); } catch (_) {}

      // Update UI controls from current persisted state/CSS
      try { const b = Math.max(0, Math.min(100, Math.round(parseFloat(localStorage.getItem('ui_border_intensity')) || 80))); biSet && biSet(b); } catch (_) {}
      try { const g = Math.max(0, Math.min(100, Math.round(parseFloat(localStorage.getItem('ui_glow_strength')) || 18))); gsSet && gsSet(g); } catch (_) {}
      try { const gr = Math.max(0, Math.min(100, Math.round(parseFloat(localStorage.getItem('ui_gradient')) || 60))); grSet && grSet(gr); } catch (_) {}
      try { let m = parseFloat(localStorage.getItem('ui_milkiness')); if (!Number.isFinite(m)) m = 3; m = Math.max(0, Math.min(10, m)); mkSet && mkSet(m); } catch (_) {}
      try { const od = Math.max(0, Math.min(100, Math.round(parseFloat(localStorage.getItem('ui_overlay_darkness')) || 60))); odSet && odSet(od); } catch (_) {}
      try { const MMAX = 2.5; const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim(); const mult = parseFloat(css); const t = Number.isFinite(mult) ? Math.max(0, Math.min(100, Math.round(100 - (mult / MMAX) * 100))) : 100; opSet && opSet(t); } catch (_) {}

      // Silently sync knobs to the preset hue/intensity if available
      try {
        const tm = (window && window.UITheme) ? window.UITheme : null;
        const p = (tm && tm.presets && tm.presets[name]) ? tm.presets[name] : null;
        if (p) {
          if (hueKn && hueKn.setValue) hueKn.setValue(p.hue, { silent: true });
          const satEff = Math.max(0, Math.min(85, Math.round((Number(p.intensity) || 60) * 0.8)));
          if (satKn && satKn.setValue) satKn.setValue(satEff, { silent: true });
          const br = Math.max(0, Math.min(100, Math.round(Number(p.intensity) || 60)));
          if (briKn && briKn.setValue) briKn.setValue(br, { silent: true });
        }
      } catch (_) {}
    } catch (_) {}
  }
}
