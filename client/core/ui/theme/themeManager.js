// Theme Manager
// Provides the UITheme runtime. initUITheme() is an IIFE that initializes all CSS variables
// at import time and exposes a lightweight window.UITheme API. '--ui-fg' is fixed globally
// and not theme-overridable to ensure consistent UI foreground color.

import { applyListRowStyle, applyScrollbarStyle, applyControlsStyle, colorFromHSLC, colorFromHSLCAlphaCss } from './themeHelpers.js';

// --- UITheme (moved from core/ui/theme.js) ---
(function initUITheme() {
  const root = document.documentElement;
  
  // Fixed, theme-agnostic foreground color for consistent UI text
  try { root.style.setProperty('--ui-fg', 'rgba(220,220,220,1)'); } catch (_) {}
  // Default sans-serif font for the whole app, applied at :root
  try { root.style.setProperty('--ui-font-family', 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Liberation Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif'); } catch (_) {}
  try { root.style.fontFamily = 'var(--ui-font-family, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Liberation Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif)'; } catch (_) {}

  // Preset definitions (hue, saturation, brightness, border intensity, glow strength, transparency %, gradient, overlay darkness %, blur px)
  // Centralized here so Settings UI can consume via UITheme API
  const themePresets = Object.freeze({
    // Ordered by Hue around the color wheel
    'Blood Red':      { hue: 0,   saturation: 50, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Ember Glow':     { hue: 20,  saturation: 70, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Old Photos':     { hue: 40,  saturation: 30, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Amber Forge':    { hue: 50,  saturation: 60, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Golden Dusk':    { hue: 60,  saturation: 60, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Desert Mirage':  { hue: 75,  saturation: 55, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Lime Spark':     { hue: 90,  saturation: 70, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Moss Crown':     { hue: 110, saturation: 50, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Verdant Veil':   { hue: 140, saturation: 50, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Teal Tide':      { hue: 160, saturation: 60, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Sea Glass':      { hue: 175, saturation: 50, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Cyan Frost':     { hue: 180, saturation: 50, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Steel Blue':     { hue: 207, saturation: 35, brightness: 49, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Azure Storm':    { hue: 210, saturation: 60, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Cobalt Drift':   { hue: 225, saturation: 55, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Cerulean Surge': { hue: 240, saturation: 60, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Indigo Night':   { hue: 260, saturation: 60, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Midnight Iris':  { hue: 270, saturation: 55, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Royal Violet':   { hue: 280, saturation: 60, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Neon Magenta':   { hue: 300, saturation: 90, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Hot Pink':       { hue: 320, saturation: 80, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Fuchsia Bloom':  { hue: 330, saturation: 85, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Rose Storm':     { hue: 340, saturation: 75, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Coral Blade':    { hue: 350, saturation: 70, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Crimson Dawn':   { hue: 355, saturation: 60, brightness: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 }
  });

  // Locked theme defaults (single source of truth) and derived keys
  const LockedThemeDefaults = Object.freeze({
    '--ui-fg': 'rgba(220,220,220,1)',
    '--ui-opacity-mult': '2.125',
    '--ui-font-family': 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Liberation Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif',
    
    // Locked scrollbar geometry (themes cannot change; a notheme path may override via allowLocked)
    '--ui-scrollbar-width': '10px',
    '--ui-scrollbar-radius': '8px',

    // Locked list row backgrounds (themes cannot change; a notheme path may override via allowLocked)
    '--ui-list-row-odd': 'rgba(255,255,255,0.04)',
    '--ui-list-row-even': 'rgba(255,255,255,0.02)'
  });

  const LockedThemeVars = Object.freeze(Object.keys(LockedThemeDefaults));
  const LockedThemeVarsSet = new Set(LockedThemeVars);

  function applyThemeVars(vars, allowLocked = false) {
    if (!vars) return;
    for (const [k, v] of Object.entries(vars)) {
      // Do not allow themes to override locked variables unless explicitly allowed
      if (!allowLocked && LockedThemeVarsSet.has(k)) continue;
      try { root.style.setProperty(k, v); } catch (_) {}
    }
  }

  function applyTheme(nameOrParams) {
    if (!nameOrParams) return;
    if (typeof nameOrParams === 'string') {
      const preset = themePresets[nameOrParams];
      if (preset) {
        applyDynamicTheme({
          hue: preset.hue,
          saturation: preset.saturation,
          brightness: preset.brightness,
          borderStrength: preset.border,
          glowStrength: preset.glow,
          gradient: preset.gradient,
          milkiness: preset.blur,
          overlayDarkness: preset.overlayDarkness
        });
        state.active = nameOrParams;
      }
      return;
    }
    // Treat object input as dynamic theme params
    applyDynamicTheme(nameOrParams);
    state.active = '(custom)';
  }

  const state = { active: 'dynamic' };

  // Apply default theme immediately
  // First ensure locked variable defaults are applied
  applyThemeVars(LockedThemeDefaults, true);
  // Initialize dynamic theme tokens right away (will be refined by boot-time persisted pass below)
  // Do NOT pre-seed dynamic theme values here; it would persist fallback 210/48/49
  // and prevent the boot block from applying the intended preset on true first-run.
  // The boot-time persisted block below will now handle initial application.

  // --- Dynamic Theme: font scale, hue, intensity ---
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function toFixed(n, d = 3) { try { return String(Number(n).toFixed(d)); } catch (_) { return String(n); } }

  // color helpers are imported from themeHelpers.js

  function applyDynamicTheme(params = {}) {
    try {
      // Read existing or provided values
      const cs = getComputedStyle(root);
      // Respect 0 values (avoid "|| fallback" after parseFloat which treats 0 as falsy)
      const readCssNum = (name, fallback) => {
        const v = parseFloat(cs.getPropertyValue(name));
        return Number.isFinite(v) ? v : fallback;
      };
      const currentHue = readCssNum('--ui-hue', 210);
      const currentIntensity = readCssNum('--ui-intensity', 60);
      const currentScale = readCssNum('--ui-font-scale', 1);
      // New controls: gradient strength (0..100), milkiness/backdrop blur (0..8 px)
      // Fallbacks when CSS vars are not yet set.
      const currentGradient = readCssNum('--ui-gradient', 60);
      const currentMilkiness = readCssNum('--ui-backdrop-blur', 3);
      // Additional new controls (persisted in LS):
      let currentBorderStrength = parseFloat(localStorage.getItem('ui_border_intensity'));
      if (!Number.isFinite(currentBorderStrength)) currentBorderStrength = 70; // default ~0.70 border alpha baseline
      let currentGlowStrength = parseFloat(localStorage.getItem('ui_glow_strength'));
      if (!Number.isFinite(currentGlowStrength)) currentGlowStrength = 60; // default matches prior glow look
      let currentOverlayDarkness = parseFloat(localStorage.getItem('ui_overlay_darkness'));
      if (!Number.isFinite(currentOverlayDarkness)) currentOverlayDarkness = 50; // 50% darkness baseline

      const hue = clamp(params.hue != null ? params.hue : currentHue, 0, 360);
      const intensity = clamp(params.intensity != null ? params.intensity : currentIntensity, 0, 100);
      const fontScale = clamp(params.fontScale != null ? params.fontScale : currentScale, 0.8, 1.2);
      const gradient = clamp(params.gradient != null ? params.gradient : currentGradient, 0, 100);
      // Allow heavier blur (will be exposed by the slider up to 10px)
      const milkiness = clamp(params.milkiness != null ? params.milkiness : currentMilkiness, 0, 10);
      const borderStrength = clamp(params.borderStrength != null ? params.borderStrength : currentBorderStrength, 0, 100);
      const glowStrength = clamp(params.glowStrength != null ? params.glowStrength : currentGlowStrength, 0, 100);
      const overlayDarkness = clamp(params.overlayDarkness != null ? params.overlayDarkness : currentOverlayDarkness, 0, 100);
      // Debug: entry point (verify sliders call into here)
      try { console.debug('[theme] applyDynamicTheme(start)', { params, hue, intensity, fontScale, gradient, milkiness, borderStrength, glowStrength, overlayDarkness }); } catch (_) {}

      // Optional: accept transparency multiplier from callers (e.g., Settings slider)
      if (params.opacityMult != null) {
        const MMAX = 2.5; // ceiling used by Settings panel
        const m = clamp(Number(params.opacityMult), 0, MMAX);
        try { root.style.setProperty('--ui-opacity-mult', String(m)); } catch (_) {}
        try { localStorage.setItem('ui_opacity_mult', String(m)); } catch (_) {}
        // Debug: reflect opacity change
        try {
          const cssOp = getComputedStyle(root).getPropertyValue('--ui-opacity-mult').trim();
          console.debug(`[theme] opacityMult set -> m=${m} css=${cssOp}`);
        } catch (_) {}
      }

      // Apply overlay darkness (0..100 -> 0..1 alpha) and persist
      try { root.style.setProperty('--ui-overlay-darkness', String(overlayDarkness / 100)); } catch (_) {}
      try { localStorage.setItem('ui_overlay_darkness', String(overlayDarkness)); } catch (_) {}

      // Persist user prefs
      try { localStorage.setItem('ui_hue', String(hue)); } catch (_) {}
      try { localStorage.setItem('ui_intensity', String(intensity)); } catch (_) {}
      try { localStorage.setItem('ui_font_scale', toFixed(fontScale, 3)); } catch (_) {}
      try { localStorage.setItem('ui_gradient', String(gradient)); } catch (_) {}
      try { localStorage.setItem('ui_milkiness', String(milkiness)); } catch (_) {}
      try { localStorage.setItem('ui_border_intensity', String(borderStrength)); } catch (_) {}
      try { localStorage.setItem('ui_glow_strength', String(glowStrength)); } catch (_) {}
      // Reflect new controls as CSS variables for other components to read if needed
      try { root.style.setProperty('--ui-gradient', String(gradient)); } catch (_) {}
      try { root.style.setProperty('--ui-backdrop-blur', `${toFixed(milkiness, 2)}px`); } catch (_) {}

      // Determine saturation/brightness with sticky overrides
      // Prefer explicit params; otherwise, use persisted overrides; otherwise, fall back to intensity mapping.
      let satLS = NaN, briLS = NaN;
      try { satLS = parseFloat(localStorage.getItem('ui_saturation')); } catch (_) {}
      try { briLS = parseFloat(localStorage.getItem('ui_brightness')); } catch (_) {}

      // Base mappings (human-readable, conservative)
      // Saturation rises slightly with intensity; lightness adjusts inversely to keep readable contrast.
      // Allow grayscale at the far-left (intensity = 0)
      let sat;
      let light;
      if (params.saturation != null) {
        sat = clamp(Number(params.saturation), 0, 100);
      } else if (Number.isFinite(satLS)) {
        sat = clamp(satLS, 0, 100);
      } else {
        sat = clamp(intensity * 0.8, 0, 85);     // 0%..80%
      }

      if (params.brightness != null) {
        light = clamp(Number(params.brightness), 0, 100);
      } else if (Number.isFinite(briLS)) {
        light = clamp(briLS, 0, 100);
      } else {
        light = clamp(45 + (60 - intensity) * 0.15, 30, 70); // ~35%..65%
      }

      // Persist explicit overrides when provided (after values are computed)
      if (params.saturation != null) { try { localStorage.setItem('ui_saturation', String(sat)); } catch (_) {} }
      if (params.brightness != null) { try { localStorage.setItem('ui_brightness', String(light)); } catch (_) {} }
      const borderAlpha = clamp(0.45 + intensity * 0.004, 0.45, 0.85); // 0.45..0.85
      const glowAlpha = clamp(0.18 + intensity * 0.0015, 0.12, 0.40); // 0.18..0.40
      // Scale border/glow by user strengths (normalize to keep prior defaults unchanged)
      const borderAlphaEff = clamp(borderAlpha * (borderStrength / 70), 0, 1);
      // Much stronger glow: scale towards 1.0 quickly as glowStrength increases
      // 0% -> ~0.6x base, 100% -> ~3.0x (clamped to 1)
      const glowAlphaEff = clamp(glowAlpha * (0.6 + (glowStrength / 100) * 2.4), 0, 1);

      // Tooltip surface uses slightly different (more transparent) mapping
      const tipTopA0 = clamp(0.32 + intensity * 0.001, 0.30, 0.45);
      const tipBotA0 = clamp(0.30 + intensity * 0.001, 0.28, 0.43);

      // Apply core knobs first
      root.style.setProperty('--ui-hue', String(hue));
      root.style.setProperty('--ui-intensity', String(intensity));
      root.style.setProperty('--ui-font-scale', toFixed(fontScale, 3));

      // Drive root font-size from fontScale (rem-based typography enabler)
      try { root.style.fontSize = `calc(16px * var(--ui-font-scale, 1))`; } catch (_) {}

      // Derive common tokens from hue/intensity (OKLCH when available, else HSL)
      const accent = colorFromHSLC({ h: hue, s: sat, l: light, alpha: 1 });
      // Boost border contrast at high strength by nudging lightness a bit
      const borderLightBase = Math.max(30, light - 5);
      const borderLight = clamp(borderLightBase + (borderStrength - 70) * 0.30, 20, 90);
      const border = colorFromHSLC({ h: hue, s: sat, l: borderLight, alpha: borderAlphaEff });
      // Scale outer/inset glow radius strictly 0..44px from 0..100% strength
      const glowR = Math.round((glowStrength / 100) * 44);
      const cGlow1 = colorFromHSLC({ h: hue, s: sat, l: Math.max(35, light), alpha: glowAlphaEff });
      const cGlow2 = colorFromHSLC({ h: hue, s: sat, l: Math.min(95, light + 30), alpha: Math.min(1, glowAlphaEff + 0.25) });
      const glowOuter = `0 0 ${glowR}px ${cGlow1}, 0 0 ${Math.round(glowR / 2)}px ${cGlow2}`;
      const glowInset = `inset 0 0 ${glowR}px ${colorFromHSLC({ h: hue, s: Math.min(90, sat + 20), l: Math.max(25, light - 10), alpha: Math.min(0.30, glowAlphaEff + 0.06) })}`;
      const bright = colorFromHSLC({ h: hue, s: Math.min(90, sat + 30), l: Math.min(95, light + 35), alpha: 0.98 });

      // Surfaces (alpha scaled by --ui-opacity-mult; gradient strength mixes top/bottom toward flat at 0, dramatic at 100)
      const lt0 = Math.max(18, light - 30);
      const lb0 = Math.max(14, light - 34);
      const lmid = (lt0 + lb0) / 2;
      const f = gradient / 100; // 0..1
      const lt = (1 - f) * lmid + f * lt0;
      const lb = (1 - f) * lmid + f * lb0;
      const sAvgA = (0.41 + 0.40) / 2; // ~0.405
      const sTopA = clamp((1 - f) * sAvgA + f * 0.60, 0, 1);
      const sBotA = clamp((1 - f) * sAvgA + f * 0.00, 0, 1);
      const surfTop = colorFromHSLCAlphaCss({ h: hue, s: Math.min(90, sat + 5), l: lt, alphaCss: `calc(${toFixed(sTopA, 3)} * var(--ui-opacity-mult, 1))` });
      const surfBot = colorFromHSLCAlphaCss({ h: hue, s: Math.min(90, sat + 0), l: lb, alphaCss: `calc(${toFixed(sBotA, 3)} * var(--ui-opacity-mult, 1))` });

      // Tooltips (alpha also scaled by --ui-opacity-mult); tie gradient strength to tooltip as well
      const tMidA = (tipTopA0 + tipBotA0) / 2;
      const tTopA = clamp((1 - f) * tMidA + f * 0.50, 0, 1);
      const tBotA = clamp((1 - f) * tMidA + f * 0.00, 0, 1);
      const tipTop = colorFromHSLCAlphaCss({ h: hue, s: Math.min(90, sat + 5), l: Math.max(18, light - 30), alphaCss: `calc(${toFixed(tTopA, 3)} * var(--ui-opacity-mult, 1))` });
      const tipBot = colorFromHSLCAlphaCss({ h: hue, s: Math.min(90, sat + 0), l: Math.max(14, light - 34), alphaCss: `calc(${toFixed(tBotA, 3)} * var(--ui-opacity-mult, 1))` });

      // Apply tokens referenced across UI
      root.style.setProperty('--ui-accent', accent);
      root.style.setProperty('--ui-surface-border', border);
      root.style.setProperty('--ui-surface-glow-outer', glowOuter);
      root.style.setProperty('--ui-surface-glow-inset', glowInset);
      root.style.setProperty('--ui-bright', bright);
      // Flat themed overlay tint (no gradient): keeps color while preserving contrast.
      // Uses the current hue with a dark lightness so content still pops. Alpha comes from --ui-overlay-darkness.
      try {
        const ovlSat = clamp(Math.min(90, sat + 10), 0, 100);
        const ovlLight = clamp(Math.max(6, light - 40), 0, 100);
        const ovl = colorFromHSLCAlphaCss({ h: hue, s: ovlSat, l: ovlLight, alphaCss: 'var(--ui-overlay-darkness, 0.5)' });
        root.style.setProperty('--ui-overlay-bg', ovl);
      } catch (_) {}
      // Scrollbar colors follow current hue
      try {
        root.style.setProperty('--ui-scrollbar-thumb', colorFromHSLC({ h: hue, s: sat, l: light, alpha: 0.45 }));
        root.style.setProperty('--ui-scrollbar-thumb-hover', colorFromHSLC({ h: hue, s: Math.min(90, sat + 10), l: Math.min(95, light + 12), alpha: 0.65 }));
      } catch (_) {}
      // Strong glow used by interactive hover/focus (two-layer glow for pop)
      // Strong glow: larger and brighter at high strength (still clamped visually)
      const glowSizeFactor = clamp(0.8 + glowStrength / 40, 0.8, 3.0);
      const strongGlowColor1 = colorFromHSLC({ h: hue, s: sat, l: light, alpha: Math.min(0.72, glowAlphaEff + 0.35) });
      const strongGlowColor2 = colorFromHSLC({ h: hue, s: sat, l: light, alpha: Math.min(0.98, glowAlphaEff + 0.55) });
      const strongGlow = `0 0 ${Math.round(36 * glowSizeFactor)}px ${strongGlowColor1}, 0 0 ${Math.round(10 * glowSizeFactor)}px ${strongGlowColor2}`;
      root.style.setProperty('--ui-glow-strong', strongGlow);
      root.style.setProperty('--ui-surface-bg-top', surfTop);
      root.style.setProperty('--ui-surface-bg-bottom', surfBot);

      // Tooltip related
      root.style.setProperty('--sf-tip-bg-top', tipTop);
      root.style.setProperty('--sf-tip-bg-bottom', tipBot);
      root.style.setProperty('--sf-tip-border', border);
      root.style.setProperty('--sf-tip-glow-outer', `0 0 18px ${colorFromHSLC({ h: hue, s: sat, l: light, alpha: glowAlphaEff })}`);
      root.style.setProperty('--sf-tip-glow-inset', glowInset);
      root.style.setProperty('--sf-tip-text-glow', `0 0 9px ${colorFromHSLC({ h: hue, s: Math.min(90, sat + 30), l: Math.min(95, light + 35), alpha: 0.70 })}`);
      // Backdrop blur derives from milkiness
      root.style.setProperty('--sf-tip-backdrop', `blur(${toFixed(milkiness, 2)}px) saturate(1.2)`);
      root.style.setProperty('--sf-tip-arrow-glow', `drop-shadow(0 0 9px ${colorFromHSLC({ h: hue, s: sat, l: light, alpha: 0.35 })})`);
      root.style.setProperty('--sf-tip-line-color', border);
      root.style.setProperty('--sf-tip-line-glow-outer', `0 0 18px ${colorFromHSLC({ h: hue, s: sat, l: light, alpha: glowAlphaEff })}`);
      root.style.setProperty('--sf-tip-line-glow-core', `0 0 3px ${colorFromHSLC({ h: hue, s: sat, l: light, alpha: Math.min(0.85, borderAlphaEff + 0.15) })}`);
      // Debug: exit point (verify full execution)
      try {
        const cssHue = getComputedStyle(root).getPropertyValue('--ui-hue').trim();
        const cssInt = getComputedStyle(root).getPropertyValue('--ui-intensity').trim();
        const cssScale = getComputedStyle(root).getPropertyValue('--ui-font-scale').trim();
        const cssOp = getComputedStyle(root).getPropertyValue('--ui-opacity-mult').trim();
        console.debug('[theme] applyDynamicTheme(done)', { hue: cssHue, intensity: cssInt, fontScale: cssScale, opacityMult: cssOp });
      } catch (_) {}
    } catch (_) {}
  }

  // UI helper appliers are provided by themeHelpers.js and imported at top.

  // Apply default UI helpers on boot
  try { applyListRowStyle(); } catch (_) {}
  try { applyScrollbarStyle(); } catch (_) {}
  try { applyControlsStyle(); } catch (_) {}

  // Apply persisted dynamic theme knobs at boot
  try {
    // Read selected theme (namespaced). Values like 'steelBlue', 'custom', etc.
    let themeName = null;
    try { themeName = (localStorage.getItem('grimDark.theme') || '').trim(); } catch (_) {}
    const themeNameLc = (themeName || '').toLowerCase();

    // Gather any persisted params (used only for 'custom' or legacy fallback)
    const hue = parseFloat(localStorage.getItem('ui_hue'));   // 0..360
    const intensity = parseFloat(localStorage.getItem('ui_intensity')); // 0..100
    const fontScale = parseFloat(localStorage.getItem('ui_font_scale')); // 0.8..1.2
    const gradient = parseFloat(localStorage.getItem('ui_gradient')); // 0..100
    const satOverride = parseFloat(localStorage.getItem('ui_saturation')); // optional 0..100
    const briOverride = parseFloat(localStorage.getItem('ui_brightness')); // optional 0..100
    const params = {};
    if (Number.isFinite(hue)) params.hue = hue;
    if (Number.isFinite(intensity)) params.intensity = intensity;
    if (Number.isFinite(fontScale)) params.fontScale = fontScale;
    if (Number.isFinite(gradient)) params.gradient = gradient;
    if (Number.isFinite(satOverride)) params.saturation = satOverride;
    if (Number.isFinite(briOverride)) params.brightness = briOverride;

    // First-run detection
    const hasPersisted =
      Number.isFinite(hue) || Number.isFinite(intensity) || Number.isFinite(fontScale) ||
      Number.isFinite(gradient) || Number.isFinite(satOverride) || Number.isFinite(briOverride);

    // Helper: resolve preset name from stored slug (case/space-insensitive)
    const presetNames = Object.keys(themePresets);
    const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
    let resolvedPreset = null;
    if (themeName) {
      const target = norm(themeName);
      for (const p of presetNames) {
        if (norm(p) === target) { resolvedPreset = p; break; }
      }
    }

    if (themeNameLc === 'custom') {
      // Custom theme: honor persisted user parameters
      applyDynamicTheme(params);
    } else if (resolvedPreset) {
      // Named preset: apply exactly from the table (ignore LS overrides for H/S/B)
      applyTheme(resolvedPreset);
    } else if (!hasPersisted) {
      // No theme selected and nothing persisted: default to Steel Blue preset
      applyTheme('Steel Blue');
    } else {
      // Legacy/unspecified theme with persisted values: treat as custom
      applyDynamicTheme(params);
    }
  } catch (_) {}

  // Expose lightweight API for future theme switching
  try {
    window.UITheme = {
      applyTheme,
      applyDynamicTheme,
      // Expose theme presets for Settings UI consumption
      getPresets: () => themePresets,
      getPresetNames: () => Object.keys(themePresets),
      presets: themePresets,
      get active() { return state.active; }
    };
  } catch (_) {}
})();

// --- Theme bootstrap notes ---
// All required CSS variables are initialized by initUITheme() on module import.
// No fallback function is used; '--ui-fg' is centralized and immutable across themes.
