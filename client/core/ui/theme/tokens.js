// Theme tokens extracted from themeManager.js
// Exports locked CSS variable defaults and derived name sets.

export const LockedThemeDefaults = Object.freeze({
  // Foreground text colors
  '--ui-fg': 'rgba(220,220,220,1.0)',
  '--ui-fg-muted': 'rgba(200,200,200,1.0)',
  '--ui-fg-quip': 'rgba(176,176,176,1.0)',
  '--ui-fg-weak': 'rgba(144,144,144,1.0)',

  '--ui-fontsize-xlarge': '1.5rem',
  '--ui-fontsize-large': '1.25rem',
  '--ui-fontsize-medium': '1rem',
  '--ui-fontsize-small': '0.8rem',
  '--ui-fontsize-xsmall': '0.7rem',

  '--ui-fontweight-bold': '700',
  '--ui-fontweight-normal': '400',

  // App-level tokens used by basicStyles presets
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

  '--ui-opacity-mult': '2.125',
  '--ui-font-family': 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Liberation Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif',
  '--ui-font-mono': 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',

  '--ui-section-padding-after': '1rem',

  // Locked layout tokens
  '--ui-card-radius': '0.6rem',
  '--ui-page-padding': '24px',
  '--ui-modal-padding': '1rem',
  // Locked border system
  '--ui-border-size': '0.0625rem',
  '--ui-surface-border-css': 'var(--ui-border-size) solid var(--ui-surface-border)',

  // Locked scrollbar geometry
  '--ui-scrollbar-width': '0.625rem',
  '--ui-scrollbar-radius': '0.5rem',

  // ui-glass-scrollbar width clamps
  '--ui-glass-scrollbar-min-width': '32rem',
  '--ui-glass-scrollbar-max-width': '32rem',

  // Locked list row backgrounds
  '--ui-list-row-odd': 'rgba(255,255,255,0.04)',
  '--ui-list-row-even': 'rgba(255,255,255,0.02)',

  // Button colors
  '--ui-button-fg': 'var(--ui-fg)',
  '--ui-button-hover-fg': 'var(--ui-fg)',
  '--ui-button-active-fg': 'var(--ui-fg)',
  '--ui-button-disabled-fg': 'var(--ui-fg)',
  '--ui-opacity-enabled-button': '1.0',
  '--ui-opacity-disabled-button': '0.6',

  // Locked knob face colors (used by core knob UI)
  '--ui-knob-bg-top': '#1a1a1a',
  '--ui-knob-bg-bottom': '#101010',
  '--ui-knob-darken': '0.06',
});

export const LockedThemeVars = Object.freeze(Object.keys(LockedThemeDefaults));
export const LockedThemeVarsSet = new Set(LockedThemeVars);
