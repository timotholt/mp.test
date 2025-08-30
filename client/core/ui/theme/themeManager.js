// Theme Manager
// Provides the UITheme runtime (auto-applied default theme) and an ensureThemeSupport()
// utility that injects base CSS variables and a simple window.setTheme().

// --- UITheme (moved from core/ui/theme.js) ---
(function initUITheme() {
  const root = document.documentElement;

  const themes = {
    glassBlue: {
      // Global opacity multiplier (single source of truth for transparency strength)
      // Default to 85% of the current ceiling (2.5) => 2.125 on first run
      '--ui-opacity-mult': '2.125',
      // Tooltip bubble (10% more transparent)
      '--sf-tip-bg-top': 'rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1)))',
      '--sf-tip-bg-bottom': 'rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1)))',
      '--sf-tip-border': 'rgba(120,170,255,0.70)',
      '--sf-tip-glow-outer': '0 0 18px rgba(120,170,255,0.33)',
      '--sf-tip-glow-inset': 'inset 0 0 18px rgba(40,100,200,0.18)',
      '--sf-tip-text-glow': '0 0 9px rgba(120,170,255,0.70)',
      '--sf-tip-backdrop': 'blur(3px) saturate(1.2)',
      '--sf-tip-arrow-glow': 'drop-shadow(0 0 9px rgba(120,170,255,0.35))',

      // Connector line
      '--sf-tip-line-color': 'rgba(120,170,255,0.70)',
      '--sf-tip-line-glow-outer': '0 0 18px rgba(120,170,255,0.33)',
      '--sf-tip-line-glow-core': '0 0 3px rgba(120,170,255,0.70)',

      // Global bright + strong glow for high-visibility focus/hover
      '--ui-bright': 'rgba(190,230,255,0.98)',
      '--ui-glow-strong': '0 0 36px rgba(120,170,255,0.60), 0 0 10px rgba(120,170,255,0.85)',
      // Foreground and link color
      '--ui-fg': 'rgba(220,235,255,0.96)',
      '--ui-link': '#6cf',

      // Shared surface tokens (for modals/menus/panels to adopt)
      '--ui-surface-bg-top': 'rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1)))',
      '--ui-surface-bg-bottom': 'rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1)))',
      '--ui-surface-border': 'rgba(120,170,255,0.70)',
      '--ui-surface-glow-outer': '0 0 18px rgba(120,170,255,0.33)',
      '--ui-surface-glow-inset': 'inset 0 0 18px rgba(40,100,200,0.18)',
      // Defaults for new dynamic controls
      '--ui-gradient': '60',
      '--ui-backdrop-blur': '3px',
      '--ui-overlay-darkness': '0.5',
      // Scrollbar tokens (glass)
      '--ui-scrollbar-width': '10px',
      '--ui-scrollbar-radius': '8px',
      '--ui-scrollbar-thumb': 'rgba(120,170,255,0.45)',
      '--ui-scrollbar-thumb-hover': 'rgba(120,170,255,0.65)',
      // Alternating list row backgrounds (subtle by default)
      '--ui-list-row-odd': 'rgba(255,255,255,0.04)',
      '--ui-list-row-even': 'rgba(255,255,255,0.02)'
    }
  };

  function applyThemeVars(vars) {
    if (!vars) return;
    for (const [k, v] of Object.entries(vars)) {
      try { root.style.setProperty(k, v); } catch (_) {}
    }
  }

  function applyTheme(nameOrVars) {
    if (!nameOrVars) return;
    if (typeof nameOrVars === 'string') {
      applyThemeVars(themes[nameOrVars]);
      state.active = nameOrVars;
      return;
    }
    applyThemeVars(nameOrVars);
    state.active = '(custom)';
  }

  function registerTheme(name, vars) {
    if (!name || typeof vars !== 'object') return;
    themes[name] = { ...vars };
  }

  const state = { active: 'glassBlue' };

  // Apply default theme immediately
  applyTheme('glassBlue');

  // Apply persisted UI opacity multiplier early, if present (clamped to current ceiling)
  try {
    const MMAX = 2.5;
    const v = parseFloat(localStorage.getItem('ui_opacity_mult'));
    if (Number.isFinite(v) && v > 0) {
      const clamped = Math.min(MMAX, Math.max(0, v));
      root.style.setProperty('--ui-opacity-mult', String(clamped));
      if (clamped !== v) {
        try { localStorage.setItem('ui_opacity_mult', String(clamped)); } catch (_) {}
      }
      // TEMP DEBUG: toggle to false to disable
      const OPDBG = true;
      if (OPDBG) {
        try {
          const css = getComputedStyle(root).getPropertyValue('--ui-opacity-mult').trim();
          const raw = localStorage.getItem('ui_opacity_mult');
          console.debug(`[opacity] app-load css=${css} rawLS=${raw} clamped=${clamped}`);
        } catch (_) {}

  // Inject alternating row styles for list containers used by lobby panels
  try {
    const STYLE_ID3 = 'ui-list-style';
    if (!document.getElementById(STYLE_ID3)) {
      const css3 = `
        /* Alternating rows for list containers (Games/Players panels) */
        .ui-list > div { transition: background-color 0.12s ease; }
        .ui-list > div:nth-child(odd) { background-color: var(--ui-list-row-odd, rgba(255,255,255,0.04)); }
        .ui-list > div:nth-child(even) { background-color: var(--ui-list-row-even, rgba(255,255,255,0.02)); }
      `;
      const style3 = document.createElement('style');
      style3.id = STYLE_ID3;
      style3.type = 'text/css';
      style3.textContent = css3;
      document.head.appendChild(style3);
    }
  } catch (_) {}
      }
    } else {
      // No stored value: set and persist default (85% of 2.5 => 2.125) to avoid later jumps
      const def = 2.125;
      try { root.style.setProperty('--ui-opacity-mult', String(def)); } catch (_) {}
      try { localStorage.setItem('ui_opacity_mult', String(def)); } catch (_) {}
      try { console.debug(`[opacity] app-load default applied def=${def}`); } catch (_) {}
    }
  } catch (_) {}

  // Inject glassmorphism scrollbar styles (scoped to .ui-glass-scrollbar)
  try {
    const STYLE_ID = 'ui-glass-scrollbar-style';
    if (!document.getElementById(STYLE_ID)) {
      const css = `
        .ui-glass-scrollbar { scrollbar-width: thin; scrollbar-color: var(--ui-scrollbar-thumb, rgba(120,170,255,0.45)) transparent; box-shadow: var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33)); }
        .ui-glass-scrollbar::-webkit-scrollbar { width: var(--ui-scrollbar-width, 10px); height: var(--ui-scrollbar-width, 10px); }
        .ui-glass-scrollbar::-webkit-scrollbar-track {
          background: linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40))) !important;
          border-radius: var(--ui-scrollbar-radius, 8px);
          box-shadow: var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18));
        }
        .ui-glass-scrollbar::-webkit-scrollbar-thumb {
          background-color: var(--ui-scrollbar-thumb, rgba(120,170,255,0.45)) !important;
          border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
          border-radius: var(--ui-scrollbar-radius, 8px);
          box-shadow: var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33));
        }
        .ui-glass-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: var(--ui-scrollbar-thumb-hover, rgba(120,170,255,0.65)) !important;
        }
        .ui-glass-scrollbar::-webkit-scrollbar-corner { background: transparent !important; }
      `;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.type = 'text/css';
      style.textContent = css;
      document.head.appendChild(style);
    }
  } catch (_) {}

  // Inject minimal select/option theming so dropdowns aren't white-on-blue
  try {
    const STYLE_ID2 = 'ui-controls-style';
    if (!document.getElementById(STYLE_ID2)) {
      const css2 = `
        select, .ui-select {
          background: linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)));
          color: var(--ui-fg, #eee);
          border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
          border-radius: 8px;
        }
        select:focus { outline: none; box-shadow: var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33)); }
        select option { background: linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40))); color: var(--ui-fg, #eee); }
        select option:checked, select option:hover { background-color: rgba(120,170,255,0.20); color: var(--ui-fg, #eee); }
        /* Make form sliders reflect the current theme hue */
        input[type="range"] { accent-color: var(--ui-accent, #6cf); }
        /* Accent-colored track for range controls (thumb/progress matches theme) */
        input[type="range"]::-webkit-slider-runnable-track {
          height: 6px;
          background: var(--ui-accent, #6cf) !important;
          border-radius: 999px;
        }
        input[type="range"]::-moz-range-track {
          height: 6px;
          background: var(--ui-accent, #6cf) !important;
          border-radius: 999px;
        }
        input[type="range"]:disabled::-webkit-slider-runnable-track { background: var(--ui-accent, #6cf) !important; opacity: 0.6; }
        input[type="range"]:disabled::-moz-range-track { background: var(--ui-accent, #6cf) !important; opacity: 0.6; }
        /* Firefox: color the filled progress portion with the accent */
        input[type="range"]::-moz-range-progress {
          height: 6px;
          background: var(--ui-accent, #6cf);
          border-radius: 999px;
        }
        /* Center the thumb across browsers */
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px; height: 14px;
          margin-top: -4px; /* (thumbHeight - trackHeight) / 2 */
          background: var(--ui-accent, #6cf);
          border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
          border-radius: 50%;
          box-shadow: none; /* no glow on the thumb */
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px; height: 14px;
          background: var(--ui-accent, #6cf);
          border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
          border-radius: 50%;
          box-shadow: none; /* no glow on the thumb */
        }
      `;
      const style2 = document.createElement('style');
      style2.id = STYLE_ID2;
      style2.type = 'text/css';
      style2.textContent = css2;
      document.head.appendChild(style2);
    }
  } catch (_) {}

  // --- Dynamic Theme: font scale, hue, intensity ---
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function toFixed(n, d = 3) { try { return String(Number(n).toFixed(d)); } catch (_) { return String(n); } }

  // Prefer OKLCH for perceptual uniformity when supported; fall back to HSL.
  function supportsOKLCH() {
    try { return CSS && CSS.supports && CSS.supports('color', 'oklch(62.8% 0.26 264)'); } catch (_) { return false; }
  }
  const HAS_OKLCH = supportsOKLCH();

  // Map (h, s, l, alpha) to a CSS color string. For OKLCH we use l as L% and map s(0..100) to a conservative
  // chroma range (0..0.33) to avoid out-of-gamut spikes. Alpha is numeric (0..1).
  function colorFromHSLC({ h, s, l, alpha = 1 }) {
    try {
      const H = Number(h || 0);
      const S = Math.max(0, Math.min(100, Number(s)));
      const L = Math.max(0, Math.min(100, Number(l)));
      const A = Math.max(0, Math.min(1, Number(alpha)));
      if (HAS_OKLCH) {
        const C = (S / 100) * 0.33; // safe chroma mapping
        return `oklch(${L}% ${C.toFixed(4)} ${H.toFixed(2)} / ${A})`;
      }
      const hslBase = `hsl(${Math.round(H)} ${Math.round(S)}% ${Math.round(L)}%)`;
      if (A >= 1) return hslBase;
      return `hsl(${Math.round(H)} ${Math.round(S)}% ${Math.round(L)}% / ${A})`;
    } catch (_) {
      return `hsl(${Math.round(h || 0)} ${Math.round(s || 0)}% ${Math.round(l || 0)}%)`;
    }
  }

  // Variant that allows a CSS alpha expression (e.g., calc(...) or var(...)).
  function colorFromHSLCAlphaCss({ h, s, l, alphaCss }) {
    try {
      const H = Number(h || 0);
      const S = Math.max(0, Math.min(100, Number(s)));
      const L = Math.max(0, Math.min(100, Number(l)));
      if (HAS_OKLCH) {
        const C = (S / 100) * 0.33;
        return `oklch(${L}% ${C.toFixed(4)} ${H.toFixed(2)} / ${alphaCss})`;
      }
      return `hsl(${Math.round(H)} ${Math.round(S)}% ${Math.round(L)}% / ${alphaCss})`;
    } catch (_) {
      return `hsl(${Math.round(h || 0)} ${Math.round(s || 0)}% ${Math.round(l || 0)}% / ${alphaCss || 1})`;
    }
  }

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
      // Scale outer/inset glow radius with strength for more dramatic effect at 100%
      const glowR = Math.round(18 * (0.8 + glowStrength / 60));
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

  // Apply persisted dynamic theme knobs at boot
  try {
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
    applyDynamicTheme(params);
  } catch (_) {}

  // Expose lightweight API for future theme switching
  try {
    window.UITheme = {
      applyTheme,
      registerTheme,
      applyDynamicTheme,
      themes,
      get active() { return state.active; }
    };
  } catch (_) {}
})();

// --- ensureThemeSupport (moved from main.js) ---
export function ensureThemeSupport() {
  if (document.getElementById('theme-style')) return;
  const st = document.createElement('style');
  st.id = 'theme-style';
  st.textContent = `:root{
    --ui-opacity-mult: 2.125;
    --ui-font-scale: 1;
    --ui-hue: 210;
    --ui-intensity: 60;
    --ui-bg: rgba(0,0,0, calc(0.8 * var(--ui-opacity-mult, 1)));
    --ui-fg: #fff;
    --ui-muted: #ccc;
    --ui-accent: #4caf50;
    --bar-bg: rgba(20,20,20, calc(0.9 * var(--ui-opacity-mult, 1)));
    --banner-bg: rgba(32,32,32, calc(0.95 * var(--ui-opacity-mult, 1)));
    --control-bg: rgba(0,0,0, calc(0.6 * var(--ui-opacity-mult, 1)));
    --control-border: #444;
  }
  html { font-size: calc(16px * var(--ui-font-scale, 1)); }
  body, button, input, select, textarea {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }`;
  document.head.appendChild(st);
  window.setTheme = function(theme) {
    // Simple placeholder for future themes
    const dark = theme !== 'light';
    document.documentElement.style.setProperty('--ui-bg', dark ? 'rgba(0,0,0, calc(0.8 * var(--ui-opacity-mult, 1)))' : 'rgba(255,255,255, calc(0.9 * var(--ui-opacity-mult, 1)))');
    document.documentElement.style.setProperty('--ui-fg', dark ? '#fff' : '#111');
    document.documentElement.style.setProperty('--ui-muted', dark ? '#ccc' : '#333');
    document.documentElement.style.setProperty('--bar-bg', dark ? 'rgba(20,20,20, calc(0.9 * var(--ui-opacity-mult, 1)))' : 'rgba(240,240,240, calc(0.9 * var(--ui-opacity-mult, 1)))');
    document.documentElement.style.setProperty('--banner-bg', dark ? 'rgba(32,32,32, calc(0.95 * var(--ui-opacity-mult, 1)))' : 'rgba(250,250,250, calc(0.95 * var(--ui-opacity-mult, 1)))');
    document.documentElement.style.setProperty('--control-bg', dark ? 'rgba(0,0,0, calc(0.6 * var(--ui-opacity-mult, 1)))' : 'rgba(255,255,255, calc(0.7 * var(--ui-opacity-mult, 1)))');
    document.documentElement.style.setProperty('--control-border', dark ? '#444' : '#bbb');
  };
}
