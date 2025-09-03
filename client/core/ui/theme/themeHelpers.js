// Theme helper utilities extracted from themeManager.js
// These helpers are pure DOM/CSS utilities and do not depend on the UITheme closure.
// Prefer OKLCH for perceptual uniformity when supported; fall back to HSL.
function supportsOKLCH() {
  try { return CSS && CSS.supports && CSS.supports('color', 'oklch(62.8% 0.26 264)'); } catch (_) { return false; }
}
const HAS_OKLCH = supportsOKLCH();

// Map (h, s, l, alpha) to a CSS color string. For OKLCH we use l as L% and map s(0..100) to a conservative
// chroma range (0..0.33) to avoid out-of-gamut spikes. Alpha is numeric (0..1).
export function colorFromHSLC({ h, s, l, alpha = 1 }) {
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
export function colorFromHSLCAlphaCss({ h, s, l, alphaCss }) {
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

// Apply alternating row styles for list containers (Games/Players panels)
export function applyListRowStyle(options = {}) {
  const { styleId = 'ui-list-style', containerSelector = '.ui-list' } = options || {};
  try {
    const existing = document.getElementById(styleId);
    const css = `
      /* Alternating rows for list containers (Games/Players panels) */
      ${containerSelector} > div { transition: background-color 0.12s ease; }
      ${containerSelector} > div:nth-child(odd) { background-color: var(--ui-list-row-odd); }
      ${containerSelector} > div:nth-child(even) { background-color: var(--ui-list-row-even); }
    `;
    if (existing) {
      existing.textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = styleId;
      style.type = 'text/css';
      style.textContent = css;
      document.head.appendChild(style);
    }
  } catch (_) {}
}

// Global text defaults + utilities
// Applies base foreground color and optional glow widely, and exposes helper classes
export function applyGlobalTextStyle(options = {}) {
  const { styleId = 'ui-global-text-style' } = options || {};
  try {
    const existing = document.getElementById(styleId);
    const css = `
      /* Global base text color + glow */
      html, body, #app, #root, #overlay {
        color: var(--ui-fg);
        text-shadow: var(--ui-text-glow, var(--sf-tip-text-glow, none));
      }
      /* Ensure common text elements inherit the base color */
      body, p, span, div, li, dt, dd, th, td, input, button, label {
        color: inherit;
      }
      /* Utility classes for tone */
      .text-quip, .text-muted { color: var(--ui-fg-quip); }
      .text-weak { color: var(--ui-fg-weak, var(--ui-fg-quip)); }
    `;
    if (existing) {
      existing.textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = styleId;
      style.type = 'text/css';
      style.textContent = css;
      document.head.appendChild(style);
    }
  } catch (_) {}
}

// Cross-browser, theme-driven scrollbar styling helper
// Uses CSS variables populated by applyDynamicTheme(). No hardcoded color fallbacks.
export function applyScrollbarStyle(options = {}) {
  const {
    className = 'ui-glass-scrollbar',
    styleId = 'ui-glass-scrollbar-style',
    width,
    radius
  } = options || {};

  const root = document.documentElement;
  try {
    if (width) root.style.setProperty('--ui-scrollbar-width', String(width));
    if (radius) root.style.setProperty('--ui-scrollbar-radius', String(radius));
  } catch (_) {}

  try {
    const existing = document.getElementById(styleId);
    const css = `
      .${className} { scrollbar-width: thin; scrollbar-color: var(--ui-scrollbar-thumb) transparent; box-shadow: var(--ui-surface-glow-outer); }
      .${className}::-webkit-scrollbar { width: var(--ui-scrollbar-width); height: var(--ui-scrollbar-width); }
      .${className}::-webkit-scrollbar-track {
        background: linear-gradient(var(--ui-surface-bg-top), var(--ui-surface-bg-bottom)) !important;
        border-radius: var(--ui-scrollbar-radius);
        box-shadow: var(--ui-surface-glow-inset);
      }
      .${className}::-webkit-scrollbar-thumb {
        background-color: var(--ui-scrollbar-thumb) !important;
        border: var(--ui-surface-border-css);
        border-radius: var(--ui-scrollbar-radius);
        box-shadow: var(--ui-surface-glow-outer);
      }
      .${className}:hover::-webkit-scrollbar-thumb {
        background-color: var(--ui-scrollbar-thumb-hover) !important;
        border-color: var(--ui-surface-border);
      }
      .${className}::-webkit-scrollbar-corner { background: transparent !important; }
    `;
    if (existing) {
      existing.textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = styleId;
      style.type = 'text/css';
      style.textContent = css;
      document.head.appendChild(style);
    }
  } catch (_) {}
}

// Generic controls theming (dropdowns/selects, range inputs, labels)
export function applyControlsStyle(options = {}) {
  const { styleId = 'ui-controls-style' } = options || {};
  try {
    const existing = document.getElementById(styleId);
    const css = `
      select, .ui-select {
        background: linear-gradient(var(--ui-surface-bg-top), var(--ui-surface-bg-bottom));
        color: var(--ui-fg);
        border: var(--ui-surface-border-css);
        border-radius: var(--ui-card-radius);
        /* Match button/dropdown height via padding and text scale */
        padding: 0.375rem 0.625rem;
        font-size: var(--ui-fontsize-small);
      }
      select:focus, select:focus-visible, .ui-select:focus, .ui-select:focus-visible { outline: none; box-shadow: var(--ui-surface-glow-outer); border-color: var(--ui-surface-border); }
      select:hover, .ui-select:hover { box-shadow: var(--ui-surface-glow-outer); border-color: var(--ui-surface-border); }
      /* Bright border on hover/focus for common buttons and text inputs */
      button:hover, button:focus-visible,
      .sf-btn:hover, .sf-btn:focus-visible {
        border-color: var(--ui-surface-border);
        box-shadow: var(--ui-surface-glow-outer);
        outline: none;
      }
      input[type="text"]:hover, input[type="text"]:focus,
      input[type="number"]:hover, input[type="number"]:focus,
      textarea:hover, textarea:focus {
        border-color: var(--ui-surface-border);
        box-shadow: var(--ui-surface-glow-outer);
        outline: none;
      }
      select option { background: linear-gradient(var(--ui-surface-bg-top), var(--ui-surface-bg-bottom)); color: var(--ui-fg); }
      select option:checked, select option:hover { background: var(--ui-accent); color: var(--ui-fg); }
      /* Make form sliders reflect the current theme hue */
      input[type="range"] { accent-color: var(--ui-accent); }
      /* Accent-colored track for range controls (thumb/progress matches theme) */
      input[type="range"]::-webkit-slider-runnable-track { height: 0.375rem; background: var(--ui-accent) !important; border-radius: 999px; }
      input[type="range"]::-moz-range-track { height: 0.375rem; background: var(--ui-accent) !important; border-radius: 999px; }
      input[type="range"]:disabled::-webkit-slider-runnable-track { background: var(--ui-accent) !important; opacity: 0.6; }
      input[type="range"]:disabled::-moz-range-track { background: var(--ui-accent) !important; opacity: 0.6; }
      /* Firefox: color the filled progress portion with the accent */
      input[type="range"]::-moz-range-progress { height: 0.375rem; background: var(--ui-accent); border-radius: 999px; }
      /* Center the thumb across browsers */
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none; width: 0.875rem; height: 0.875rem; margin-top: -0.25rem;
        background: var(--ui-accent);
        border: 1px solid var(--ui-surface-border);
        border-radius: 50%; box-shadow: none;
      }
      input[type="range"]::-moz-range-thumb {
        width: 0.875rem; height: 0.875rem; background: var(--ui-accent);
        border: 1px solid var(--ui-surface-border);
        border-radius: 50%; box-shadow: none;
      }
      /* Bright white + glow on label hover across app */
      label { transition: color 0.12s ease, text-shadow 0.12s ease; }
      label:hover { color: var(--ui-bright); text-shadow: 0 0 0.5625rem var(--ui-bright), 0 0 1.125rem var(--ui-accent); }
    `;
    if (existing) {
      existing.textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = styleId;
      style.type = 'text/css';
      style.textContent = css;
      document.head.appendChild(style);
    }
  } catch (_) {}
}
