// UI Theme System (plain JS)
// Defines CSS variables on :root to control UI look & feel.
// Starts with a "Glass Blue" preset matching the tooltip glassmorphism vibe.
// You can extend this for broader UI elements later.

(function initUITheme() {
  const root = document.documentElement;

  // Minimal theming engine
  const themes = {
    glassBlue: {
      // Tooltip bubble (10% more transparent)
      '--sf-tip-bg-top': 'rgba(10,18,26,0.41)',
      '--sf-tip-bg-bottom': 'rgba(10,16,22,0.40)',
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
      '--ui-glow-strong': '0 0 36px rgba(120,170,255,0.60), 0 0 10px rgba(120,170,255,0.85)'
      ,
      // Shared surface tokens (for modals/menus/panels to adopt)
      '--ui-surface-bg-top': 'rgba(10,18,26,0.41)',
      '--ui-surface-bg-bottom': 'rgba(10,16,22,0.40)',
      '--ui-surface-border': 'rgba(120,170,255,0.70)',
      '--ui-surface-glow-outer': '0 0 18px rgba(120,170,255,0.33)',
      '--ui-surface-glow-inset': 'inset 0 0 18px rgba(40,100,200,0.18)'
      ,
      // Link color used by chat and other interactive text
      '--ui-link': '#6cf',
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

  // Inject glassmorphism scrollbar styles (scoped to .ui-glass-scrollbar)
  try {
    const STYLE_ID = 'ui-glass-scrollbar-style';
    if (!document.getElementById(STYLE_ID)) {
      const css = `
        .ui-glass-scrollbar { scrollbar-width: thin; scrollbar-color: var(--ui-scrollbar-thumb, rgba(120,170,255,0.45)) transparent; box-shadow: 0 -4px 16px -6px var(--ui-surface-glow-color, rgba(120,170,255,0.33)), -4px 0 16px -8px var(--ui-surface-glow-color, rgba(120,170,255,0.33)), 4px 0 16px -8px var(--ui-surface-glow-color, rgba(120,170,255,0.33)); }
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
