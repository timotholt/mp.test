// Theme Manager
// Provides the UITheme runtime. initUITheme() is an IIFE that initializes all CSS variables
// at import time and exposes a lightweight window.UITheme API. '--ui-fg' is fixed globally
// and not theme-overridable to ensure consistent UI foreground color.

import { applyListRowStyle, applyScrollbarStyle, applyControlsStyle, applyGlobalTextStyle, colorFromHSLC, colorFromHSLCAlphaCss } from './themeHelpers.js';

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
  // Default sans-serif font for the whole app, applied at :root
  // Moved var definition to LockedThemeDefaults; keep root font binding here
  try { root.style.fontFamily = 'var(--ui-font-family, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Liberation Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif)'; } catch (_) {}
 
  // Preset definitions (hue, saturation, intensity, border intensity, glow strength, transparency %, gradient, overlay darkness %, blur px)
  // Centralized here so Settings UI can consume via UITheme API
  const themePresets = Object.freeze({
    // Ordered by Hue around the color wheel
    'Blood Red':      { hue: 0,   saturation: 50, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Ember Glow':     { hue: 20,  saturation: 70, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Old Photos':     { hue: 40,  saturation: 30, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Amber Forge':    { hue: 50,  saturation: 60, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Golden Dusk':    { hue: 60,  saturation: 60, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Desert Mirage':  { hue: 75,  saturation: 55, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Lime Spark':     { hue: 90,  saturation: 70, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Moss Crown':     { hue: 110, saturation: 50, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Verdant Veil':   { hue: 140, saturation: 50, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Teal Tide':      { hue: 160, saturation: 60, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Sea Glass':      { hue: 175, saturation: 50, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Cyan Frost':     { hue: 180, saturation: 50, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Steel Blue':     { hue: 207, saturation: 35, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Azure Storm':    { hue: 210, saturation: 60, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Cobalt Drift':   { hue: 225, saturation: 55, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Cerulean Surge': { hue: 240, saturation: 60, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Indigo Night':   { hue: 260, saturation: 60, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Midnight Iris':  { hue: 270, saturation: 55, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Royal Violet':   { hue: 280, saturation: 60, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Neon Magenta':   { hue: 300, saturation: 90, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Hot Pink':       { hue: 320, saturation: 80, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Fuchsia Bloom':  { hue: 330, saturation: 85, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Rose Storm':     { hue: 340, saturation: 75, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Coral Blade':    { hue: 350, saturation: 70, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 },
    'Crimson Dawn':   { hue: 355, saturation: 60, intensity: 60, border: 80, glow: 18, transparency: 0, gradient: 20, overlayDarkness: 60, blur: 3 }
  });

  // Locked theme defaults (single source of truth) and derived keys
  const LockedThemeDefaults = Object.freeze({

    // These define the foreground colors of text in the app. App should never reference these.
    '--ui-fg': 'rgba(220,220,220,1.0)',                     // Brightest text
    '--ui-fg-muted': 'rgba(200,200,200,1.0)',               // Second brightest text
    '--ui-fg-quip': 'rgba(176,176,176,1.0)',                // Third brighest text
    '--ui-fg-weak': 'rgba(144,144,144,1.0)',                // Fourth brightest text

    '--ui-fontsize-xlarge': '1.5rem',                       // Titles of screens & modals
    '--ui-fontsize-large': '1.25rem',                       // Section headers
    '--ui-fontsize-medium': '1rem',                         // Body text
    '--ui-fontsize-small': '0.8rem',                        // Quips
    '--ui-fontsize-xsmall': '0.7rem',                      // Subtitles

    '--ui-fontweight-bold': '700',
    '--ui-fontweight-normal': '400',

    // App-level tokens used by basicStyles presets (map to locked base tokens)
    '--ui-modal-title-fg': 'var(--ui-fg)',
    '--ui-modal-title-size': 'var(--ui-fontsize-large)',
    '--ui-modal-title-weight': 'var(--ui-fontweight-bold)',

    '--ui-modal-title-quip-fg': 'var(--ui-fg-quip)',
    '--ui-modal-title-quip-size': 'var(--ui-fontsize-small)',
    '--ui-modal-title-quip-weight': 'var(--ui-fontweight-bold)',

    '--ui-modal-subtitle-fg': 'var(--ui-fg)',
    '--ui-modal-subtitle-size': 'var(--ui-fontsize-medium)',
    '--ui-modal-subtitle-weight': 'var(--ui-fontweight-bold)',

    '--ui-modal-subtitle-quip-fg': 'var(--ui-fg-quip)',
    '--ui-modal-subtitle-quip-size': 'var(--ui-fontsize-small)',
    '--ui-modal-subtitle-quip-weight': 'var(--ui-fontweight-normal)',

    // '--ui-root-fg': 'var(--ui-fg)',

    '--ui-opacity-mult': '2.125',
    '--ui-font-family': 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Liberation Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif',
    '--ui-font-mono': 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',

    '--ui-section-padding-after': '1rem',

    // Locked layout tokens
    '--ui-card-radius': '0.875rem',
    '--ui-page-padding': '24px',
    '--ui-modal-padding': '1rem',
    // Locked border system
    '--ui-border-size': '0.0625rem',
    '--ui-surface-border-css': 'var(--ui-border-size) solid var(--ui-surface-border)',

    // Locked scrollbar geometry (themes cannot change; a notheme path may override via allowLocked)
    '--ui-scrollbar-width': '0.625rem',
    '--ui-scrollbar-radius': '0.5rem',

    /*
     * IMPORTANT: ui-glass-scrollbar width clamps (LOCKED)
     * ---------------------------------------------------
     * These variables define the absolute minimum and maximum width constraints
     * intended for containers that OPT-IN to the 'ui-glass-scrollbar' styling.
     * They DO NOT auto-apply any width constraints by themselves; components can
     * reference these to clamp their layout when needed.
     *
     * Rationale: Some narrow tab groups need a strict 500px width to prevent
     * scrollbar/overflow layout jitter. Making this a locked variable ensures
     * theme packs cannot accidentally alter core geometry.
     *
     * Usage example (in a component that wants the clamp):
     *   el.style.minWidth = 'var(--ui-glass-scrollbar-min-width)';
     *   el.style.maxWidth = 'var(--ui-glass-scrollbar-max-width)';
     */
    // '--ui-glass-scrollbar-min-width': '500px',
    // '--ui-glass-scrollbar-max-width': '500px',

    '--ui-glass-scrollbar-min-width': '32rem',
    '--ui-glass-scrollbar-max-width': '32rem',


    // Locked list row backgrounds (themes cannot change; a notheme path may override via allowLocked)
    '--ui-list-row-odd': 'rgba(255,255,255,0.04)',
    '--ui-list-row-even': 'rgba(255,255,255,0.02)',

    // Button colors
    '--ui-button-fg': 'var(--ui-fg)',
    '--ui-button-hover-fg': 'var(--ui-fg)',
    '--ui-button-active-fg': 'var(--ui-fg)',
    '--ui-button-disabled-fg': 'var(--ui-fg)', // how do i add 0.6 opacity?
    '--ui-opacity-enabled-button': '1.0',
    '--ui-opacity-disabled-button': '0.6',        
    
    // Locked knob face colors (used by core knob UI). Themes cannot override directly.
    // Dynamic theme will set these at runtime; these are safe fallbacks.
    '--ui-knob-bg-top': '#1a1a1a',
    '--ui-knob-bg-bottom': '#101010',
    // Locked control for additional knob darkness (0..0.5 recommended). Higher -> darker.
    '--ui-knob-darken': '0.06',
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
          // Use preset-provided intensity when available; fall back to a sane default
          intensity: (preset.intensity != null ? preset.intensity : 60),
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
      // 0% -> ~0.6x base, 100% -> ~3.0x (clamped to 1)
      let glowAlphaEff = clamp(glowAlpha * (0.6 + (glowStrength / 100) * 2.4), 0, 1);
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
      const bright = colorFromHSLC({ h: hue, s: Math.min(90, sat + 30), l: Math.min(95, light + 35), alpha: 0.98 });
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

      // Tooltip related
      root.style.setProperty('--sf-tip-bg-top', tipTop);
      root.style.setProperty('--sf-tip-bg-bottom', tipBot);
      root.style.setProperty('--sf-tip-border', border);
      root.style.setProperty('--sf-tip-glow-outer', `0 0 18px ${colorFromHSLC({ h: hue, s: sat, l: light, alpha: glowAlphaEff })}`);
      root.style.setProperty('--sf-tip-glow-inset', glowInset);
      // Global text glow reduced by ~50% (blur radius and alpha)
      const tipTextGlow = `0 0 6px ${colorFromHSLC({ h: hue, s: Math.min(90, sat + 30), l: Math.min(95, light + 35), alpha: 0.5 * Math.min(1, intensity / 20) })}`;
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

  // Apply default UI helpers on boot
  try { applyListRowStyle(); } catch (_) {}
  try { applyScrollbarStyle(); } catch (_) {}
  try { applyControlsStyle(); } catch (_) {}
  try { applyGlobalTextStyle(); } catch (_) {}

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
    const params = {};
    if (Number.isFinite(hue)) params.hue = hue;
    if (Number.isFinite(intensity)) params.intensity = intensity;
    if (Number.isFinite(fontScale)) params.fontScale = fontScale;
    if (Number.isFinite(gradient)) params.gradient = gradient;
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

  // Expose lightweight API for future theme switching
  try {
    window.UITheme = {
      applyTheme,
      applyDynamicTheme,
      get active() { return state.active; }
    };
  } catch (_) {}

})();

// Style presets using existing tokens (text, surfaces, states)
export const basicStyles = Object.freeze({
  // Text
  title: {
    __tag: 'div',
    color: 'var(--ui-modal-title-fg)',
    fontSize: 'var(--ui-modal-title-size)',
    fontWeight: 'var(--ui-modal-title-weight)',
    userSelect: 'none'
  },
  subtitle: {
    __tag: 'div',
    color: 'var(--ui-modal-subtitle-fg)',
    fontSize: 'var(--ui-modal-subtitle-size)',
    fontWeight: 'var(--ui-modal-subtitle-weight)'
  },
  quipTitle: {
    __tag: 'div',
    color: 'var(--ui-modal-title-quip-fg)',
    fontSize: 'var(--ui-modal-title-quip-size)',
    fontWeight: 'var(--ui-modal-title-quip-weight)'
  },
  quipSubtitle: {
    __tag: 'div',
    color: 'var(--ui-modal-subtitle-quip-fg)',
    fontSize: 'var(--ui-modal-subtitle-quip-size)',
    fontWeight: 'var(--ui-modal-subtitle-quip-weight)'
  },
  body: {
    __tag: 'div',
    color: 'var(--ui-fg)',
    fontSize: 'var(--ui-fontsize-medium)',
    fontWeight: 'var(--ui-fontweight-normal)'
  },
  quip: {
    __tag: 'div',
    color: 'var(--ui-fg-quip)',
    fontSize: 'var(--ui-fontsize-small)',
    fontWeight: 'var(--ui-fontweight-normal)'
  },

  // Surfaces
  card: {
    __tag: 'div',
    background: 'linear-gradient(var(--ui-surface-bg-top), var(--ui-surface-bg-bottom))',
    border: 'var(--ui-surface-border-css)',
    boxShadow: 'var(--ui-surface-glow-outer)',
    borderRadius: 'var(--ui-card-radius)',
    padding: 'var(--ui-modal-padding)'
  },

  // States
  disabled: {
    color: 'var(--ui-button-disabled-fg)',
    opacity: 'var(--ui-opacity-disabled-button)',
    pointerEvents: 'none',
    cursor: 'not-allowed'
  },

  // Controls
  button: {
    __tag: 'input',
    __type: 'button',
    background: 'transparent',
    border: 'var(--ui-surface-border-css)',
    color: 'var(--ui-fg)',
    borderRadius: 'var(--ui-card-radius)',
    py: '0.25rem',
    px: '0.625rem',
    fontSize: 'var(--ui-fontsize-small)',
    fontWeight: 'var(--ui-fontweight-normal)',
    pointer: true,
    hover: {
      boxShadow: 'var(--ui-surface-glow-outer)',
      outline: 'var(--ui-surface-border-css)'
    }
  },

  // Form helpers
  formRow: {
    __tag: 'div',
    display: 'flex',
    alignItems: 'center',
    gap: '1.0rem',
    mb: 8
  },
  formLabel: {
    __tag: 'label',
    color: 'var(--ui-fg)',
    fontSize: 'var(--ui-fontsize-small)',
    minWidth: '8.75rem',
    userSelect: 'none'
  },
  formValue: {
    __tag: 'span',
    color: 'var(--ui-fg-muted, #ccc)',
    width: '3.25rem',
    textAlign: 'right'
  },
  inputRange: {
    __tag: 'input',
    __type: 'range',
    flex: '1'
  }
});

// Convenience aliases (template-first usage)
export const basicTitle = basicStyles.title;
export const basicSubtitle = basicStyles.subtitle;
export const basicQuipTitle = basicStyles.quipTitle;
export const basicQuipSubtitle = basicStyles.quipSubtitle;
export const basicBody = basicStyles.body;
export const basicQuip = basicStyles.quip;
export const basicCard = basicStyles.card;
export const basicDisabled = basicStyles.disabled;
export const basicButton = basicStyles.button;
export const basicFormRow = basicStyles.formRow;
export const basicFormLabel = basicStyles.formLabel;
export const basicFormValue = basicStyles.formValue;
export const basicInputRange = basicStyles.inputRange;

// Simple gap/spacer element template (used between headers and sections)
export const basicGap = Object.freeze({ height: '0.5rem' });

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
