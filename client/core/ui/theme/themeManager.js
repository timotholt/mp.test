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
      '--ui-scrollbar-thumb-hover': 'rgba(120,170,255,0.65)'
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
          background: linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)));
          border-radius: var(--ui-scrollbar-radius, 8px);
          box-shadow: var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18));
        }
        .ui-glass-scrollbar::-webkit-scrollbar-thumb {
          background-color: var(--ui-scrollbar-thumb, rgba(120,170,255,0.45));
          border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
          border-radius: var(--ui-scrollbar-radius, 8px);
          box-shadow: var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33));
        }
        .ui-glass-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: var(--ui-scrollbar-thumb-hover, rgba(120,170,255,0.65));
        }
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

  function applyDynamicTheme(params = {}) {
    try {
      // Read existing or provided values
      const cs = getComputedStyle(root);
      const currentHue = parseFloat(cs.getPropertyValue('--ui-hue') || '210') || 210;
      const currentIntensity = parseFloat(cs.getPropertyValue('--ui-intensity') || '60') || 60;
      const currentScale = parseFloat(cs.getPropertyValue('--ui-font-scale') || '1') || 1;
      // New controls: gradient strength (0..100), milkiness/backdrop blur (0..8 px)
      // Fallbacks when CSS vars are not yet set.
      const currentGradient = parseFloat(cs.getPropertyValue('--ui-gradient') || '60') || 60;
      const currentMilkiness = parseFloat(cs.getPropertyValue('--ui-backdrop-blur') || '3') || 3;
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
      const milkiness = clamp(params.milkiness != null ? params.milkiness : currentMilkiness, 0, 8);
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

      // Base mappings (human-readable, conservative)
      // Saturation rises slightly with intensity; lightness adjusts inversely to keep readable contrast.
      // Experiment: allow grayscale at the far-left (intensity = 0)
      // Previous mapping had a 35% baseline and a 20% lower clamp, preventing grayscale.
      // New mapping is linear with no baseline so intensity=0 -> sat=0.
      const sat = clamp(intensity * 0.8, 0, 85);     // 0%..80%
      const light = clamp(45 + (60 - intensity) * 0.15, 30, 70); // ~35%..65%
      const borderAlpha = clamp(0.45 + intensity * 0.004, 0.45, 0.85); // 0.45..0.85
      const glowAlpha = clamp(0.18 + intensity * 0.0015, 0.12, 0.40); // 0.18..0.40
      // Scale border/glow by user strengths (normalize to keep prior defaults unchanged)
      const borderAlphaEff = clamp(borderAlpha * (borderStrength / 70), 0, 1);
      const glowAlphaEff = clamp(glowAlpha * (glowStrength / 60), 0, 1);

      // Tooltip surface uses slightly different (more transparent) mapping
      const tipTopA0 = clamp(0.32 + intensity * 0.001, 0.30, 0.45);
      const tipBotA0 = clamp(0.30 + intensity * 0.001, 0.28, 0.43);

      // Apply core knobs first
      root.style.setProperty('--ui-hue', String(hue));
      root.style.setProperty('--ui-intensity', String(intensity));
      root.style.setProperty('--ui-font-scale', toFixed(fontScale, 3));

      // Drive root font-size from fontScale (rem-based typography enabler)
      try { root.style.fontSize = `calc(16px * var(--ui-font-scale, 1))`; } catch (_) {}

      // Derive common tokens from hue/intensity (HSL)
      const accent = `hsl(${hue} ${sat}% ${light}%)`;
      const border = `hsl(${hue} ${sat}% ${Math.max(30, light - 5)}% / ${borderAlphaEff})`;
      const glowOuter = `0 0 18px hsl(${hue} ${sat}% ${Math.max(35, light)}% / ${glowAlphaEff})`;
      const glowInset = `inset 0 0 18px hsl(${hue} ${Math.min(90, sat + 20)}% ${Math.max(25, light - 10)}% / ${Math.min(0.24, glowAlphaEff + 0.02)})`;
      const bright = `hsl(${hue} ${Math.min(90, sat + 30)}% ${Math.min(95, light + 35)}% / 0.98)`;

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
      const surfTop = `hsl(${hue} ${Math.min(90, sat + 5)}% ${lt}% / calc(${toFixed(sTopA, 3)} * var(--ui-opacity-mult, 1)))`;
      const surfBot = `hsl(${hue} ${Math.min(90, sat + 0)}% ${lb}% / calc(${toFixed(sBotA, 3)} * var(--ui-opacity-mult, 1)))`;

      // Tooltips (alpha also scaled by --ui-opacity-mult); tie gradient strength to tooltip as well
      const tMidA = (tipTopA0 + tipBotA0) / 2;
      const tTopA = clamp((1 - f) * tMidA + f * 0.50, 0, 1);
      const tBotA = clamp((1 - f) * tMidA + f * 0.00, 0, 1);
      const tipTop = `hsl(${hue} ${Math.min(90, sat + 5)}% ${Math.max(18, light - 30)}% / calc(${toFixed(tTopA, 3)} * var(--ui-opacity-mult, 1)))`;
      const tipBot = `hsl(${hue} ${Math.min(90, sat + 0)}% ${Math.max(14, light - 34)}% / calc(${toFixed(tBotA, 3)} * var(--ui-opacity-mult, 1)))`;

      // Apply tokens referenced across UI
      root.style.setProperty('--ui-accent', accent);
      root.style.setProperty('--ui-surface-border', border);
      root.style.setProperty('--ui-surface-glow-outer', glowOuter);
      root.style.setProperty('--ui-surface-glow-inset', glowInset);
      root.style.setProperty('--ui-bright', bright);
      // Strong glow used by interactive hover/focus (two-layer glow for pop)
      const strongGlow = `0 0 36px hsl(${hue} ${sat}% ${light}% / ${Math.min(0.60, glowAlphaEff + 0.20)}), 0 0 10px hsl(${hue} ${sat}% ${light}% / ${Math.min(0.88, glowAlphaEff + 0.40)})`;
      root.style.setProperty('--ui-glow-strong', strongGlow);
      root.style.setProperty('--ui-surface-bg-top', surfTop);
      root.style.setProperty('--ui-surface-bg-bottom', surfBot);

      // Tooltip related
      root.style.setProperty('--sf-tip-bg-top', tipTop);
      root.style.setProperty('--sf-tip-bg-bottom', tipBot);
      root.style.setProperty('--sf-tip-border', border);
      root.style.setProperty('--sf-tip-glow-outer', `0 0 18px hsl(${hue} ${sat}% ${light}% / ${glowAlphaEff})`);
      root.style.setProperty('--sf-tip-glow-inset', glowInset);
      root.style.setProperty('--sf-tip-text-glow', `0 0 9px hsl(${hue} ${Math.min(90, sat + 30)}% ${Math.min(95, light + 35)}% / 0.70)`);
      // Backdrop blur derives from milkiness
      root.style.setProperty('--sf-tip-backdrop', `blur(${toFixed(milkiness, 2)}px) saturate(1.2)`);
      root.style.setProperty('--sf-tip-arrow-glow', `drop-shadow(0 0 9px hsl(${hue} ${sat}% ${light}% / 0.35))`);
      root.style.setProperty('--sf-tip-line-color', border);
      root.style.setProperty('--sf-tip-line-glow-outer', `0 0 18px hsl(${hue} ${sat}% ${light}% / ${glowAlphaEff})`);
      root.style.setProperty('--sf-tip-line-glow-core', `0 0 3px hsl(${hue} ${sat}% ${light}% / ${Math.min(0.85, borderAlphaEff + 0.15)})`);
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
    const params = {};
    if (Number.isFinite(hue)) params.hue = hue;
    if (Number.isFinite(intensity)) params.intensity = intensity;
    if (Number.isFinite(fontScale)) params.fontScale = fontScale;
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
