// UI Theme System (plain JS)
// Defines CSS variables on :root to control UI look & feel.
// Starts with a "Glass Blue" preset matching the tooltip glassmorphism vibe.
// You can extend this for broader UI elements later.

(function initUITheme() {
  const root = document.documentElement;

  // Minimal theming engine
  const themes = {
    glassBlue: {
      // Tooltip bubble
      '--sf-tip-bg-top': 'rgba(10,18,26,0.46)',
      '--sf-tip-bg-bottom': 'rgba(10,16,22,0.44)',
      '--sf-tip-border': 'rgba(120,170,255,0.70)',
      '--sf-tip-glow-outer': '0 0 18px rgba(120,170,255,0.33)',
      '--sf-tip-glow-inset': 'inset 0 0 18px rgba(40,100,200,0.18)',
      '--sf-tip-text-glow': '0 0 9px rgba(120,170,255,0.70)',
      '--sf-tip-backdrop': 'blur(4px) saturate(1.2)',
      '--sf-tip-arrow-glow': 'drop-shadow(0 0 9px rgba(120,170,255,0.35))',

      // Connector line
      '--sf-tip-line-color': 'rgba(120,170,255,0.70)',
      '--sf-tip-line-glow-outer': '0 0 18px rgba(120,170,255,0.33)',
      '--sf-tip-line-glow-core': '0 0 3px rgba(120,170,255,0.70)'
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
