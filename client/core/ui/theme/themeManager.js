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

      // Shared surface tokens (for modals/menus/panels to adopt)
      '--ui-surface-bg-top': 'rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1)))',
      '--ui-surface-bg-bottom': 'rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1)))',
      '--ui-surface-border': 'rgba(120,170,255,0.70)',
      '--ui-surface-glow-outer': '0 0 18px rgba(120,170,255,0.33)',
      '--ui-surface-glow-inset': 'inset 0 0 18px rgba(40,100,200,0.18)'
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
    }
  } catch (_) {}

  // Expose lightweight API for future theme switching
  try {
    window.UITheme = {
      applyTheme,
      registerTheme,
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
    --ui-bg: rgba(0,0,0, calc(0.8 * var(--ui-opacity-mult, 1)));
    --ui-fg: #fff;
    --ui-muted: #ccc;
    --ui-accent: #4caf50;
    --bar-bg: rgba(20,20,20, calc(0.9 * var(--ui-opacity-mult, 1)));
    --banner-bg: rgba(32,32,32, calc(0.95 * var(--ui-opacity-mult, 1)));
    --control-bg: rgba(0,0,0, calc(0.6 * var(--ui-opacity-mult, 1)));
    --control-border: #444;
  }
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
