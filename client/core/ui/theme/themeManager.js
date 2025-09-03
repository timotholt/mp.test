// Theme Manager
// Provides the UITheme runtime. initUITheme() is an IIFE that initializes all CSS variables
// at import time and exposes a lightweight window.UITheme API. '--ui-fg' is fixed globally
// and not theme-overridable to ensure consistent UI foreground color.

import { applyListRowStyle, applyScrollbarStyle, applyControlsStyle, applyGlobalTextStyle, colorFromHSLC, colorFromHSLCAlphaCss } from './themeHelpers.js';
import { LockedThemeDefaults, LockedThemeVars, LockedThemeVarsSet } from './tokens.js';
import { themePresets } from './presets.js';
import { basicStyles } from './templates.js';
export { basicStyles, basicTitle, basicSubtitle, basicQuipTitle, basicQuipSubtitle, basicBody, basicQuip, basicCard, basicDisabled, basicButton, basicFormRow, basicFormLabel, basicFormValue, basicInputRange, basicGap } from './templates.js';

export function createUiElement(style = {}, a = 'div', b = '', c) {
  // Resolve parameters with backward compatibility and a new optional id
  const isTag = (s) => typeof s === 'string' && /^[a-z][a-z0-9-]*$/.test(s); // lowercase tags only
  let tag = 'div', content = '', id = undefined;
  let tagExplicit = false;
  const argc = arguments.length;
  if (argc === 1) {
    // only style
  } else if (argc === 2) {
    // (style, tag) or (style, content)
    if (isTag(a)) { tag = a; tagExplicit = true; } else { content = a; }
  } else if (argc === 3) {
    // (style, tag, content) or (style, content, id)
    if (isTag(a)) { tag = a; tagExplicit = true; content = b ?? ''; }
    else { content = a; id = b; }
  } else {
    // argc >= 4: (style, tag, content, id) or (style, id, tag, content)
    if (!isTag(a) && isTag(b)) { id = a; tag = b; tagExplicit = true; content = c ?? ''; }
    else { tag = a; tagExplicit = true; content = b ?? ''; id = c; }
  }

  // Start from caller-provided style template(s).
  // Accept either a single object or an array of objects to merge (left→right)
  let out = {};
  if (Array.isArray(style)) {
    for (const s of style) { if (s && typeof s === 'object') Object.assign(out, s); }
  } else {
    out = { ...(style || {}) };
  }

  // Meta: default tag from template if not explicitly provided
  const tmplTag = out.__tag || out.tag;
  if (!tagExplicit && isTag(tmplTag)) tag = tmplTag;
  delete out.__tag; delete out.tag;

  // Meta: hover style (apply on listeners; restore on leave)
  const hover = (out && typeof out.hover === 'object') ? { ...out.hover } : null;
  if (hover) delete out.hover;

  const el = document.createElement(tag);
  if (id) try { el.id = id; } catch (_) {}
  // Meta: input type
  if (tag === 'input') {
    const t = out.__type || out.inputType;
    if (t) { try { el.type = String(t); } catch (_) {} }
    delete out.__type; delete out.inputType;
  }
  if (content != null) {
    if (tag === 'input') { try { el.value = content; } catch (_) {} }
    else { el.textContent = content; }
  }

  // Shorthands: color
  if (out.fg != null) { out.color = out.fg; delete out.fg; }
  if (out.textColor != null) { out.color = out.textColor; delete out.textColor; }

  // Shorthands: opacity
  if (out.op != null && out.opacity == null) { out.opacity = String(out.op); delete out.op; }

  // Shorthands: pointer/cursor
  if (Object.prototype.hasOwnProperty.call(out, 'pointer')) {
    const v = out.pointer;
    if (v === true) out.cursor = 'pointer';
    else if (typeof v === 'string') out.cursor = v;
    delete out.pointer;
  }

  // Shorthands: background
  if (out.bg != null) { out.background = out.bg; delete out.bg; }
  if (out.bgColor != null) { out.background = out.bgColor; delete out.bgColor; }
  if (out.backgroundColor != null && out.background == null) {
    out.background = out.backgroundColor; delete out.backgroundColor;
  }

  // Shorthand: font (string or object)
  if (out.font && typeof out.font === 'object') {
    const f = out.font;
    if (f.size) out.fontSize = f.size;
    if (f.weight) out.fontWeight = f.weight;
    if (f.family) out.fontFamily = f.family;
    if (f.lineHeight) out.lineHeight = f.lineHeight;
    if (f.letterSpacing) out.letterSpacing = f.letterSpacing;
    delete out.font;
  }
  // If font is a string, leave it as-is (CSS font shorthand)

  // Shorthands: margin/padding (m, mt, mr, mb, ml, mx, my, p, pt, pr, pb, pl, px, py)
  // Minimal and non-intrusive: expand only when target longhand is not already provided
  (function applyBoxShorthands() {
    const asCss = (v) => (typeof v === 'number' ? `${v}px` : String(v));
    const expandParts = (val) => {
      // Accept CSS-like shorthand: 1, 2, 3, or 4 values -> [t, r, b, l]
      const s = String(val).trim().split(/\s+/).map(asCss);
      if (s.length === 1) return [s[0], s[0], s[0], s[0]];
      if (s.length === 2) return [s[0], s[1], s[0], s[1]];
      if (s.length === 3) return [s[0], s[1], s[2], s[1]];
      return [s[0], s[1], s[2], s[3]]; // 4+
    };
    const applySet = (kind, key, val) => {
      const K = kind === 'm' ? 'margin' : 'padding';
      const [t, r, b, l] = Array.isArray(val) ? val : expandParts(val);
      const setIfMissing = (prop, value) => { if (out[prop] == null) out[prop] = value; };
      if (key === '') {
        // m / p
        setIfMissing(`${K}Top`, t);
        setIfMissing(`${K}Right`, r);
        setIfMissing(`${K}Bottom`, b);
        setIfMissing(`${K}Left`, l);
        return;
      }
      if (key === 'x') { setIfMissing(`${K}Left`, asCss(val)); setIfMissing(`${K}Right`, asCss(val)); return; }
      if (key === 'y') { setIfMissing(`${K}Top`, asCss(val)); setIfMissing(`${K}Bottom`, asCss(val)); return; }
      if (key === 't') { setIfMissing(`${K}Top`, asCss(val)); return; }
      if (key === 'r') { setIfMissing(`${K}Right`, asCss(val)); return; }
      if (key === 'b') { setIfMissing(`${K}Bottom`, asCss(val)); return; }
      if (key === 'l') { setIfMissing(`${K}Left`, asCss(val)); return; }
    };
    const keys = [
      ['m', ''], ['mt', 't'], ['mr', 'r'], ['mb', 'b'], ['ml', 'l'], ['mx', 'x'], ['my', 'y'],
      ['p', ''], ['pt', 't'], ['pr', 'r'], ['pb', 'b'], ['pl', 'l'], ['px', 'x'], ['py', 'y']
    ];
    for (const [k, sub] of keys) {
      if (Object.prototype.hasOwnProperty.call(out, k) && out[k] != null) {
        applySet(k[0], sub, out[k]);
        delete out[k];
      }
    }
  })();

  // Convenience: apply themed surface styling in one flag
  if (out.surface === true) {
    out.background = 'linear-gradient(var(--ui-surface-bg-top), var(--ui-surface-bg-bottom))';
    out.border = 'var(--ui-surface-border-css)';
    out.boxShadow = 'var(--ui-surface-glow-outer)';
    out.borderRadius = 'var(--ui-card-radius)';
    delete out.surface;
  }

  // Apply to element
  Object.assign(el.style, out);

  // Attach hover listeners if provided by template
  if (hover) {
    const keys = Object.keys(hover);
    const base = {};
    for (const k of keys) base[k] = el.style[k];
    try {
      const apply = () => { for (const k of keys) el.style[k] = hover[k]; };
      const clear = () => { for (const k of keys) el.style[k] = base[k] || ''; };
      el.addEventListener('mouseenter', apply);
      el.addEventListener('mouseleave', clear);
      el.addEventListener('focus', apply);
      el.addEventListener('blur', clear);
    } catch (_) {}
  }
  return el;
}

// --- UITheme (moved from core/ui/theme.js) ---
(function initUITheme() {
  const root = document.documentElement;
  
  /*
   CSS Variable Glossary (partial, key tokens)
   --ui-fg: Base foreground/text color used across UI.
   --ui-font-family: Default app font stack.
   --ui-title-size: Title font-size (rem-based); used in modals/screens.
   --ui-subtitle-size: Subtitle font-size (rem-based); used under titles.
   --ui-card-radius: Default corner radius for cards/modals.
   --ui-page-padding: Outer page padding (e.g., login page centering).
   --ui-modal-padding: Inner padding for modal/card bodies.
   --ui-border-size: Standard border thickness (rem); combine with color.
   --ui-surface-border-css: Full border shorthand built from size + color.
   --ui-bright: Alias to highlight/accent color (maps to --ui-highlight).
   --ui-surface-bg-top/bottom: Glass gradient stops for surfaces.
   --ui-surface-border: Border color for surfaces/inputs/buttons.
   --ui-surface-glow-inset/outer: Glow effects applied to surfaces.
   Notes: Many surface tokens are derived from preset hue/saturation/intensity
   and dynamic params (border, glow, gradient, blur, overlay darkness).
  */
  // Fixed, theme-agnostic foreground color for consistent UI text
  // Moved var definition to LockedThemeDefaults; keep root font binding here
  try { root.style.fontFamily = 'var(--ui-font-family, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Liberation Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif)'; } catch (_) {}
 
  // themePresets now imported from presets.js

  // LockedThemeDefaults and vars now imported from tokens.js

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
          // Use preset-provided intensity when available; fall back to a sane default
          intensity: (preset.intensity != null ? preset.intensity : 60),
          // Apply preset-provided foreground text brightness (0..100; 50 is neutral)
          fgBrightness: preset.fgBrightness,
          borderStrength: preset.border,
          glowStrength: preset.glow,
          // Map preset transparency percent -> opacity multiplier used by CSS
          // Formula: opacityMult = ((100 - transparency)/100) * MMAX
          // Where MMAX is the ceiling used by Settings (2.5)
          opacityMult: (function () {
            const MMAX = 2.5;
            const t = (preset.transparency != null ? Number(preset.transparency) : 0);
            const tp = Math.min(100, Math.max(0, t));
            return ((100 - tp) / 100) * MMAX;
          })(),
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
      // Base preset fallbacks (single source of truth)
      const basePreset = themePresets['Steel Blue'] || {};
      const currentHue = readCssNum('--ui-hue', basePreset.hue);
      const currentIntensity = readCssNum('--ui-intensity', basePreset.intensity);
      const currentScale = readCssNum('--ui-font-scale', 1);
      // New controls: gradient strength (0..100), milkiness/backdrop blur (0..8 px)
      // Fallbacks when CSS vars are not yet set.
      const currentGradient = readCssNum('--ui-gradient', basePreset.gradient);
      const currentMilkiness = readCssNum('--ui-backdrop-blur', basePreset.blur);
      // Additional new controls (persisted in LS):
      let currentBorderStrength = parseFloat(localStorage.getItem('ui_border_intensity'));
      if (!Number.isFinite(currentBorderStrength)) currentBorderStrength = basePreset.border;
      let currentGlowStrength = parseFloat(localStorage.getItem('ui_glow_strength'));
      if (!Number.isFinite(currentGlowStrength)) currentGlowStrength = basePreset.glow;
      let currentOverlayDarkness = parseFloat(localStorage.getItem('ui_overlay_darkness'));
      if (!Number.isFinite(currentOverlayDarkness)) currentOverlayDarkness = basePreset.overlayDarkness;

      const hue = clamp(params.hue != null ? params.hue : currentHue, 0, 360);
      const intensity = clamp(params.intensity != null ? params.intensity : currentIntensity, 0, 100);
      const fontScale = clamp(params.fontScale != null ? params.fontScale : currentScale, 0.8, 1.2);
      const gradient = clamp(params.gradient != null ? params.gradient : currentGradient, 0, 100);
      // Allow heavier blur (will be exposed by the slider up to 10px)
      const milkiness = clamp(params.milkiness != null ? params.milkiness : currentMilkiness, 0, 10);
      const borderStrength = clamp(params.borderStrength != null ? params.borderStrength : currentBorderStrength, 0, 100);
      const glowStrength = clamp(params.glowStrength != null ? params.glowStrength : currentGlowStrength, 0, 100);
      const overlayDarkness = clamp(params.overlayDarkness != null ? params.overlayDarkness : currentOverlayDarkness, 0, 100);
      // New: Foreground brightness (0..100) where 50 = baseline (factor 1.0)
      let currentFgBrightness = NaN;
      try { currentFgBrightness = parseFloat(localStorage.getItem('ui_fg_brightness')); } catch (_) {}
      const fgBrightness = clamp(params.fgBrightness != null ? Number(params.fgBrightness) : (Number.isFinite(currentFgBrightness) ? currentFgBrightness : 50), 0, 100);
      // Derive a reusable brightness scale for tokens (50 -> 1.0, 0 -> 0.4, 100 -> 1.4)
      const fgScale = (function () {
        const b = fgBrightness;
        if (b >= 50) return 1 + ((b - 50) / 50) * 0.4;
        return 0.4 + (b / 50) * 0.6;
      })();
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
      // Persist foreground brightness
      try { localStorage.setItem('ui_fg_brightness', String(fgBrightness)); } catch (_) {}
      // Reflect new controls as CSS variables for other components to read if needed
      try { root.style.setProperty('--ui-gradient', String(gradient)); } catch (_) {}
      try { root.style.setProperty('--ui-backdrop-blur', `${toFixed(milkiness, 2)}px`); } catch (_) {}

      // Determine saturation with sticky override; lightness derives from intensity mapping.
      // Prefer explicit params; otherwise, use persisted saturation override; otherwise, fall back to intensity mapping.
      let satLS = NaN;
      try { satLS = parseFloat(localStorage.getItem('ui_saturation')); } catch (_) {}

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

      // Lightness: derive purely from intensity for consistent theming
      // Widened range and slope; at zero intensity force true black.
      // Additionally, compress the low-end (0..10) so 0→1 doesn't jump visually.
      if (intensity <= 0) {
        light = 0;
      } else {
        // Base mapping as before
        const baseLight = clamp(45 + (intensity - 60) * 0.38, 0, 80);
        // Smoothly ease in over the first ~10 points of intensity
        const tEase = Math.min(1, intensity / 10);
        const smooth = tEase * tEase * (3 - 2 * tEase); // smoothstep(0..1)
        light = clamp(baseLight * smooth, 0, 80);
      }

      // Persist explicit overrides when provided (after values are computed)
      if (params.saturation != null) { try { localStorage.setItem('ui_saturation', String(sat)); } catch (_) {} }
      const borderAlpha = clamp(0.45 + intensity * 0.004, 0.45, 0.85); // 0.45..0.85
      const glowAlpha = clamp(0.18 + intensity * 0.0015, 0.12, 0.40); // 0.18..0.40
      // Low-end saturation easing for accent tokens: fade in over first ~10 intensity points
      const nearZero = Math.min(1, intensity / 10);
      const satAcc = (intensity <= 0) ? 0 : Math.round(sat * nearZero);
      const satAccPlus10 = (intensity <= 0) ? 0 : Math.round(Math.min(90, sat + 10) * nearZero);
      // Scale border/glow by user strengths (normalize to keep prior defaults unchanged)
      let borderAlphaEff = clamp(borderAlpha * (borderStrength / 70), 0, 1);
      // Much stronger glow: scale towards 1.0 quickly as glowStrength increases
      // Soften overall glow by ~20% to make max less overpowering
      // 0% -> ~0.48x base, 100% -> ~2.4x (clamped to 1)
      let glowAlphaEff = clamp(glowAlpha * (0.6 + (glowStrength / 100) * 2.4) * 0.8, 0, 1);
      // Fade in border/glow over first ~20 intensity points to avoid a big 0→1 step
      const nearZeroFade = Math.min(1, intensity / 20);
      borderAlphaEff *= nearZeroFade;
      glowAlphaEff *= nearZeroFade;
      // At zero intensity, suppress border and glow to allow true-black surfaces (explicit)
      if (intensity <= 0) { borderAlphaEff = 0; glowAlphaEff = 0; }

      // Tooltip surface uses slightly different (more transparent) mapping
      const tipTopA0 = clamp(0.32 + intensity * 0.001, 0.30, 0.45);
      const tipBotA0 = clamp(0.30 + intensity * 0.001, 0.28, 0.43);

      // Apply core knobs first
      root.style.setProperty('--ui-hue', String(hue));
      root.style.setProperty('--ui-intensity', String(intensity));
      root.style.setProperty('--ui-font-scale', toFixed(fontScale, 3));

      // Drive root font-size from fontScale (rem-based typography enabler)
      try { root.style.fontSize = `calc(16px * var(--ui-font-scale, 1))`; } catch (_) {}

      // Broadcast changes so UI controls (e.g., knobs) can stay in sync with derived state
      try { window.dispatchEvent(new CustomEvent('ui:intensity-changed', { detail: { intensity } })); } catch (_) {}
      try {
        const source = (params.saturation != null || Number.isFinite(satLS)) ? 'override' : 'derived';
        window.dispatchEvent(new CustomEvent('ui:saturation-changed', { detail: { saturation: sat, source } }));
      } catch (_) {}

      // Derive common tokens from hue/intensity (OKLCH when available, else HSL)
      const accent = colorFromHSLC({ h: hue, s: satAcc, l: light, alpha: 1 });
      // Boost border contrast at high strength by nudging lightness and a touch of saturation
      const borderLightBase = Math.max(30, light - 5);
      // Stronger slope so 100% feels noticeably brighter (was 0.30)
      const borderLight = clamp(borderLightBase + (borderStrength - 70) * 0.60, 20, 90);
      // Small saturation lift at high strength for perceived brightness without neon
      const borderSat = clamp(sat + (borderStrength - 70) * 0.5, 0, 100);
      const border = colorFromHSLC({ h: hue, s: borderSat, l: borderLight, alpha: borderAlphaEff });
      // Scale outer/inset glow radius strictly 0..44px from 0..100% strength
      const glowR = Math.round((glowStrength / 100) * 44);
      const cGlow1 = colorFromHSLC({ h: hue, s: sat, l: Math.max(35, light), alpha: glowAlphaEff });
      const cGlow2 = colorFromHSLC({ h: hue, s: sat, l: Math.min(95, light + 30), alpha: Math.min(1, glowAlphaEff + 0.25) });
      const glowOuter = `0 0 ${glowR}px ${cGlow1}, 0 0 ${Math.round(glowR / 2)}px ${cGlow2}`;
      const glowInset = `inset 0 0 ${glowR}px ${colorFromHSLC({ h: hue, s: Math.min(90, sat + 20), l: Math.max(25, light - 10), alpha: Math.min(0.30, glowAlphaEff + 0.06) })}`;
      // Accent "bright" now respects Text Brightness via fgScale
      const brightLBase = Math.min(95, light + 35);
      const brightL = clamp(Math.round(brightLBase * fgScale), 0, 98);
      const bright = colorFromHSLC({ h: hue, s: Math.min(90, sat + 30), l: brightL, alpha: 0.98 });
      // (reverted) Do not derive a custom inner keycap token; fall back to scrollbar thumb

      // Surfaces (alpha scaled by --ui-opacity-mult; gradient strength mixes top/bottom toward flat at 0, dramatic at 100)
      // Ease in floors near zero intensity to prevent a jump from 0→1
      const lt0 = (intensity <= 0) ? 0 : Math.max(light - 30, intensity * 0.2);
      const lb0 = (intensity <= 0) ? 0 : Math.max(light - 34, intensity * 0.15);
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
      const tipTop = colorFromHSLCAlphaCss({ h: hue, s: Math.min(90, sat + 5), l: (intensity <= 0 ? 0 : Math.max(light - 30, intensity * 0.2)), alphaCss: `calc(${toFixed(tTopA, 3)} * var(--ui-opacity-mult, 1))` });
      const tipBot = colorFromHSLCAlphaCss({ h: hue, s: Math.min(90, sat + 0), l: (intensity <= 0 ? 0 : Math.max(light - 34, intensity * 0.15)), alphaCss: `calc(${toFixed(tBotA, 3)} * var(--ui-opacity-mult, 1))` });

      // Apply tokens referenced across UI
      root.style.setProperty('--ui-accent', accent);
      root.style.setProperty('--ui-surface-border', border);
      root.style.setProperty('--ui-surface-glow-outer', glowOuter);
      root.style.setProperty('--ui-surface-glow-inset', glowInset);
      root.style.setProperty('--ui-highlight', bright);
      // Back-compat alias used in some components
      root.style.setProperty('--ui-bright', bright);

      // Foreground brightness application (override locked defaults at runtime)
      // Map: extend lower dimming. 0→0.4, 50→1.0, 100→1.4 (piecewise-linear)
      try {
        const b = fgBrightness;
        let f;
        if (b >= 50) { f = 1 + ((b - 50) / 50) * 0.4; }
        else { f = 0.4 + (b / 50) * 0.6; }
        const clamp255 = (x) => Math.max(0, Math.min(255, Math.round(x)));
        // Base grayscale anchors from LockedThemeDefaults
        const baseMain = 220, baseMuted = 200, baseQuip = 176, baseWeak = 144;
        const cMain = clamp255(baseMain * f);
        const cMuted = clamp255(baseMuted * f);
        const cQuip = clamp255(baseQuip * f);
        const cWeak = clamp255(baseWeak * f);
        root.style.setProperty('--ui-fg', `rgba(${cMain},${cMain},${cMain},1.0)`);
        root.style.setProperty('--ui-fg-muted', `rgba(${cMuted},${cMuted},${cMuted},1.0)`);
        root.style.setProperty('--ui-fg-quip', `rgba(${cQuip},${cQuip},${cQuip},1.0)`);
        root.style.setProperty('--ui-fg-weak', `rgba(${cWeak},${cWeak},${cWeak},1.0)`);
      } catch (_) {}
      
      // Compute solid (non-alpha) knob face colors: neutral/dark, slightly darker than surfaces.
      // Controlled by locked --ui-knob-darken (0..~0.5). At intensity=0, force true black.
      try {
        const kd = clamp(parseFloat(cs.getPropertyValue('--ui-knob-darken')) || 0, 0, 1);
        // Base lights start well below surface; ease-in near zero intensity to avoid jumps.
        const kLtBase = (intensity <= 0) ? 0 : Math.max(light - 52, intensity * 0.06);
        const kLbBase = (intensity <= 0) ? 0 : Math.max(light - 58, intensity * 0.04);
        const darkenBoost = kd * 20; // up to ~20 lightness points darker at kd=1
        const kLt = clamp(kLtBase - darkenBoost, 0, 22);
        const kLb = clamp(kLbBase - darkenBoost, 0, 20);
        const knobTop = colorFromHSLC({ h: hue, s: 0, l: kLt, alpha: 1 });
        const knobBottom = colorFromHSLC({ h: hue, s: 0, l: kLb, alpha: 1 });
        root.style.setProperty('--ui-knob-bg-top', knobTop);
        root.style.setProperty('--ui-knob-bg-bottom', knobBottom);
      } catch (_) {}

      // Flat themed overlay tint (no gradient): keeps color while preserving contrast.
      // Uses the current hue with a dark lightness so content still pops. Alpha comes from --ui-overlay-darkness.
      try {
        // At zero intensity we want a neutral (non-hued) blackout overlay; avoid tint by forcing sat=0
        // Additionally, fade in overlay hue over the first ~10 intensity points to prevent green-ish cast at low I.
        const nearZero = Math.min(1, intensity / 10);
        const ovlSatBase = clamp(Math.min(90, sat + 10), 0, 100);
        const ovlSat = (intensity <= 0) ? 0 : Math.round(ovlSatBase * nearZero);
        // Ease in overlay floor with intensity to avoid jump at 1
        const ovlLight = (intensity <= 0) ? 0 : clamp(Math.max(light - 40, intensity * 0.1), 0, 100);
        const ovl = colorFromHSLCAlphaCss({ h: hue, s: ovlSat, l: ovlLight, alphaCss: 'var(--ui-overlay-darkness, 0.5)' });
        root.style.setProperty('--ui-overlay-bg', ovl);
      } catch (_) {}
      // Scrollbar colors follow current hue
      try {
        root.style.setProperty('--ui-scrollbar-thumb', colorFromHSLC({ h: hue, s: satAcc, l: light, alpha: 0.45 }));
        root.style.setProperty('--ui-scrollbar-thumb-hover', colorFromHSLC({ h: hue, s: satAccPlus10, l: Math.min(95, light + 12), alpha: 0.65 }));
      } catch (_) {}
      // Strong glow used by interactive hover/focus (two-layer glow for pop)
      // Strong glow: larger and brighter at high strength (still clamped visually)
      const glowSizeFactor = clamp(0.8 + glowStrength / 40, 0.8, 3.0);
      const strongGlowColor1 = colorFromHSLC({ h: hue, s: sat, l: light, alpha: Math.min(0.72, (glowAlphaEff + 0.35) * Math.min(1, intensity / 20)) });
      const strongGlowColor2 = colorFromHSLC({ h: hue, s: sat, l: light, alpha: Math.min(0.98, (glowAlphaEff + 0.55) * Math.min(1, intensity / 20)) });
      const strongGlow = `0 0 ${Math.round(36 * glowSizeFactor)}px ${strongGlowColor1}, 0 0 ${Math.round(10 * glowSizeFactor)}px ${strongGlowColor2}`;
      root.style.setProperty('--ui-glow-strong', strongGlow);
      root.style.setProperty('--ui-surface-bg-top', surfTop);
      root.style.setProperty('--ui-surface-bg-bottom', surfBot);
      //============== WARNING ==================================================
      // We attempted to tie scrollbar thickness to --ui-font-scale using:
      //   calc(10px * var(--ui-font-scale, 1))
      // but Chrome's overlay scrollbars on some systems did not respect live
      // recomputation reliably. Rolling back to a fixed rem value for now.
      // If you re-enable dynamic scaling, TEST across platforms and themes.
      //=======================================================================
      // Scrollbar sizing tokens (consumed by applyScrollbarStyle)
      // Keep width in rem so it scales with the root font size consistently.
      root.style.setProperty('--ui-scrollbar-width', '0.625rem');
      root.style.setProperty('--ui-scrollbar-radius', 'var(--ui-card-radius)');
      // Re-apply scrollbar style to nudge WebKit to recompute pseudo-element metrics
      try { applyScrollbarStyle(); } catch (_) {}

      // Tooltip related
      root.style.setProperty('--sf-tip-bg-top', tipTop);
      root.style.setProperty('--sf-tip-bg-bottom', tipBot);
      // Tooltip border should follow surface border intensity, not text brightness
      root.style.setProperty('--sf-tip-border', border);
      // Match tooltip outer glow to the general surface glow for consistent size/brightness
      root.style.setProperty('--sf-tip-glow-outer', glowOuter);
      root.style.setProperty('--sf-tip-glow-inset', glowInset);
      // Tooltip text glow: scale alpha by glow strength and intensity so tooltips respect glow slider
      const tipTextGlow = `0 0 6px ${colorFromHSLC({ h: hue, s: Math.min(90, sat + 30), l: Math.min(95, light + 35), alpha: Math.min(0.9, glowAlphaEff * Math.min(1, intensity / 20)) })}`;
      root.style.setProperty('--sf-tip-text-glow', tipTextGlow);
      // Expose same glow for general UI text usage
      root.style.setProperty('--ui-text-glow', tipTextGlow);
      // Backdrop blur derives from milkiness
      root.style.setProperty('--sf-tip-backdrop', `blur(${toFixed(milkiness, 2)}px) saturate(1.2)`);
      root.style.setProperty('--sf-tip-arrow-glow', `drop-shadow(0 0 9px ${colorFromHSLC({ h: hue, s: sat, l: light, alpha: 0.35 })})`);
      root.style.setProperty('--sf-tip-line-color', border);
      root.style.setProperty('--sf-tip-line-glow-outer', `0 0 18px ${colorFromHSLC({ h: hue, s: sat, l: light, alpha: glowAlphaEff })}`);
      root.style.setProperty('--sf-tip-line-glow-core', `0 0 3px ${colorFromHSLC({ h: hue, s: sat, l: light, alpha: Math.min(0.85, (borderAlphaEff + 0.15) * Math.min(1, intensity / 20)) })}`);
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

  // Inject minimal utility CSS classes used by JS behaviors (no external CSS files required)
  function injectUtilityStyles() {
    try {
      const id = 'ui-utility-styles';
      if (document.getElementById(id)) return;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = [
        '.ui-focus-ring{',
        '  box-shadow: var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.30));',
        '}',
        '.ui-focus-glow{',
        '  box-shadow: var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.30));',
        '  border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));',
        '}',
        '.ui-focus-reset{',
        '  border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.30));',
        '}',
        '.ui-hover-glow{',
        '  filter: drop-shadow(0 0 6px rgba(120,170,255,0.25));',
        '}',
      ].join('\n');
      document.head && document.head.appendChild(style);
    } catch (_) {}
  }

  // Apply default UI helpers on boot
  try { applyListRowStyle(); } catch (_) {}
  try { applyScrollbarStyle(); } catch (_) {}
  // Opt-in the viewport to themed scrollbars (rem-based, scales with font)
  try {
    document.body && document.body.classList.add('ui-glass-scrollbar');
    document.documentElement && document.documentElement.classList.add('ui-glass-scrollbar');
  } catch (_) {}
  try { applyControlsStyle(); } catch (_) {}
  try { applyGlobalTextStyle(); } catch (_) {}
  // Ensure utility classes are available globally
  try { injectUtilityStyles(); } catch (_) {}

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
    const milkinessLS = parseFloat(localStorage.getItem('ui_milkiness')); // 0..10 (px)
    const satOverride = parseFloat(localStorage.getItem('ui_saturation')); // optional 0..100
    const params = {};
    if (Number.isFinite(hue)) params.hue = hue;
    if (Number.isFinite(intensity)) params.intensity = intensity;
    if (Number.isFinite(fontScale)) params.fontScale = fontScale;
    if (Number.isFinite(gradient)) params.gradient = gradient;
    if (Number.isFinite(milkinessLS)) params.milkiness = milkinessLS;
    if (Number.isFinite(satOverride)) params.saturation = satOverride;

    // First-run detection
    const hasPersisted =
      Number.isFinite(hue) || Number.isFinite(intensity) || Number.isFinite(fontScale) ||
      Number.isFinite(gradient) || Number.isFinite(satOverride);

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

    // Opacity is applied via preset (applyTheme) or via custom persisted value.
    // Do NOT set any default here; allow the selected path below to define it.

    if (themeNameLc === 'custom') {
      // Custom theme: honor persisted user parameters
      try {
        const op = parseFloat(localStorage.getItem('ui_opacity_mult'));
        if (Number.isFinite(op)) params.opacityMult = op;
      } catch (_) {}
      try {
        const fgb = parseFloat(localStorage.getItem('ui_fg_brightness'));
        if (Number.isFinite(fgb)) params.fgBrightness = fgb;
      } catch (_) {}
      applyDynamicTheme(params);
    } else if (resolvedPreset) {
      // Named preset: apply exactly from the table (ignore LS overrides for H/S/B)
      applyTheme(resolvedPreset);
    } else if (!hasPersisted) {
      // No theme selected and nothing persisted: default to Steel Blue preset
      applyTheme('Steel Blue');
    } else {
      // Legacy/unspecified theme with persisted values: treat as custom
      try {
        const op = parseFloat(localStorage.getItem('ui_opacity_mult'));
        if (Number.isFinite(op)) params.opacityMult = op;
      } catch (_) {}
      applyDynamicTheme(params);
    }
  } catch (_) {}

  // Developer utility: export current theme as a presets.js-compatible object.
  // Reads values from CSS variables and localStorage using the same mappings
  // as applyDynamicTheme(). No side effects.
  function exportCurrentPreset() {
    try {
      const cs = getComputedStyle(root);
      const numCss = (name, fb) => {
        const v = parseFloat(cs.getPropertyValue(name));
        return Number.isFinite(v) ? v : fb;
      };
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
      const round = (v) => Math.round(Number(v) || 0);

      // Core knobs
      const hue = round(numCss('--ui-hue', 210));
      const intensity = round(numCss('--ui-intensity', 60));

      // Saturation: prefer LS override; otherwise derive from intensity (0..85)
      let satLS = NaN;
      try { satLS = parseFloat(localStorage.getItem('ui_saturation')); } catch (_) {}
      const saturation = round(Number.isFinite(satLS) ? clamp(satLS, 0, 100) : clamp(intensity * 0.8, 0, 85));

      // Foreground text brightness (0..100; 50 neutral)
      let fgBrightness = parseFloat(localStorage.getItem('ui_fg_brightness'));
      if (!Number.isFinite(fgBrightness)) fgBrightness = 50;
      fgBrightness = round(clamp(fgBrightness, 0, 100));

      // Border / glow strengths (LS-backed, with sensible fallbacks)
      let border = parseFloat(localStorage.getItem('ui_border_intensity'));
      if (!Number.isFinite(border)) border = 80;
      let glow = parseFloat(localStorage.getItem('ui_glow_strength'));
      if (!Number.isFinite(glow)) glow = 18;

      // Transparency: inverse of opacity multiplier (MMAX = 2.5)
      const MMAX = 2.5;
      let m = parseFloat(localStorage.getItem('ui_opacity_mult'));
      if (!Number.isFinite(m)) { m = numCss('--ui-opacity-mult', MMAX); }
      const transparency = round(100 - clamp((m / MMAX) * 100, 0, 100));

      // Gradient (CSS var) and blur (strip px)
      const gradient = round(numCss('--ui-gradient', 20));
      const blur = round(parseFloat(cs.getPropertyValue('--ui-backdrop-blur')) || 0);

      // Overlay darkness: LS (0..100) else CSS var (0..1 -> percent)
      let overlayDarkness = parseFloat(localStorage.getItem('ui_overlay_darkness'));
      if (!Number.isFinite(overlayDarkness)) {
        overlayDarkness = round(clamp((parseFloat(cs.getPropertyValue('--ui-overlay-darkness')) || 0) * 100, 0, 100));
      } else {
        overlayDarkness = round(clamp(overlayDarkness, 0, 100));
      }

      const out = {
        hue,
        intensity,
        saturation,
        fgBrightness,
        border: round(border),
        glow: round(glow),
        transparency,
        gradient,
        overlayDarkness,
        blur,
      };
      
      try { console.log('[UITheme] Export current preset:', out); } catch (_) {}
      return out;
    } catch (_) { return null; }
  }

  // Expose lightweight API for future theme switching
  try {
    window.UITheme = {
      applyTheme,
      applyDynamicTheme,
      // Expose presets so Settings UI can read values when syncing knobs
      presets: themePresets,
      get active() { return state.active; },
      // Dev-only helper to export the current theme in presets.js format
      exportCurrentPreset
    };
  } catch (_) {}

})();

// basicStyles and convenience aliases are now exported from templates.js

// Small helper to create a labeled range row using basic form templates.
// Returns an object so callers can bind events and customize behavior.
export function createRangeElement(min, max, step, resetValue, labelText = 'Value:', opts = {}) {
  const row = createUiElement(basicStyles.formRow);
  const label = createUiElement(basicStyles.formLabel, labelText);
  const input = createUiElement(basicStyles.inputRange);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const value = createUiElement(basicStyles.formValue);

  const clamp = (x) => {
    let v = parseFloat(x);
    if (!Number.isFinite(v)) v = resetValue;
    // Snap to step
    const inv = 1 / (step || 1);
    v = Math.round(v * inv) / inv;
    // Clamp
    if (v < min) v = min;
    if (v > max) v = max;
    return v;
  };

  const toDisplay = typeof opts.toDisplay === 'function'
    ? opts.toDisplay
    : (v) => ({ text: String(v), title: String(v), derived: {} });
  const toStorage = typeof opts.toStorage === 'function'
    ? opts.toStorage
    : (v) => String(v);
  const fromStorage = typeof opts.fromStorage === 'function'
    ? opts.fromStorage
    : (s) => clamp(parseFloat(s));

  const writeDisplay = (v) => {
    const out = toDisplay(v) || {};
    const txt = out.text != null ? out.text : String(v);
    const tit = out.title != null ? out.title : txt;
    try { value.textContent = txt; } catch (_) {}
    try { input.title = tit; } catch (_) {}
    return out;
  };

  const apply = (v) => {
    const vv = clamp(v);
    if (String(vv) !== input.value) try { input.value = String(vv); } catch (_) {}
    const out = writeDisplay(vv);
    if (opts.debugLabel) {
      try { console.debug(`[${opts.debugLabel}] v=${vv}`, out?.derived || {}); } catch (_) {}
    }
    if (typeof opts.onChange === 'function') {
      try { opts.onChange(vv, { row, label, input, value, derived: out.derived || {} }); } catch (_) {}
    }
    if (opts.storageKey) {
      try { localStorage.setItem(opts.storageKey, toStorage(vv)); } catch (_) {}
    }
  };

  // Initialize value (possibly from storage)
  let initV = resetValue;
  if (opts.storageKey) {
    try {
      const s = localStorage.getItem(opts.storageKey);
      if (s != null) initV = fromStorage(s);
    } catch (_) {}
  }
  try { input.value = String(initV); } catch (_) {}
  writeDisplay(initV);

  // Optional wheel binder from caller to keep deps minimal
  if (typeof opts.attachWheel === 'function') {
    try { opts.attachWheel(input); } catch (_) {}
  }

  // Also support forgiving wheel: scrolling anywhere in the row adjusts the slider
  try {
    const onWheelRow = (e) => {
      try {
        // If the event target is the slider input, let its own handler take it
        if (e && e.target === input) return;
        // If the wheel originated from the input itself, its handler already runs
        // We still preventDefault to keep the page from scrolling while adjusting
        e.preventDefault();
        const stepAttr = parseFloat(input.step);
        const stp = Number.isFinite(stepAttr) && stepAttr > 0 ? stepAttr : 1;
        const mn = Number.isFinite(parseFloat(input.min)) ? parseFloat(input.min) : -Infinity;
        const mx = Number.isFinite(parseFloat(input.max)) ? parseFloat(input.max) : Infinity;
        const cur = Number.isFinite(parseFloat(input.value)) ? parseFloat(input.value) : resetValue;
        const dir = (e.deltaY || 0) > 0 ? -1 : 1;
        let nxt = cur + dir * stp;
        if (nxt < mn) nxt = mn;
        if (nxt > mx) nxt = mx;
        if (nxt !== cur) {
          input.value = String(nxt);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (_) {}
    };
    // Use non-passive to allow preventDefault()
    row.addEventListener('wheel', onWheelRow, { passive: false });
  } catch (_) {}

  input.oninput = () => apply(input.value);

  row.appendChild(label); row.appendChild(input); row.appendChild(value);

  return {
    row, label, input, value,
    reset: () => { try { input.value = String(resetValue); input.dispatchEvent(new Event('input')); } catch (_) {} },
    set: (v) => apply(v)
  };
}

// --- Theme bootstrap notes ---
// All required CSS variables are initialized by initUITheme() on module import.
// No fallback function is used; '--ui-fg' is centralized and immutable across themes.
