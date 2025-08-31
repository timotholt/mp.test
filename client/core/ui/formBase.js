// Shared glassmorphism form styles for modals and panels (plain JS)
// Adds theme-driven styles for buttons and inputs used across multiple modals.
// Safe to call multiple times; style is injected once by id.
// Uses UI theme tokens from core/ui/theme/themeManager.js. All styles prefer CSS vars with fallbacks.

const FALLBACK_FG_COLOR = '#39ff14'; // debug-green if theme tokens fail

export function ensureGlassFormStyles(styleId = 'ui-glass-form-style') {
  try {
    if (document.getElementById(styleId)) return;
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `
    /* Buttons */
    .btn { cursor: pointer; user-select: none; border-radius: 10px; padding: 10px 12px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 10px; justify-content: center; }
    .btn:disabled { opacity: var(--ui-opacity-disabled-button, 0.6); cursor: default; }
    .btn-outline-glass {
      background: linear-gradient(180deg, rgba(10,18,26,0.12) 0%, rgba(10,16,22,0.08) 100%);
      color: var(--ui-fg, ${FALLBACK_FG_COLOR});
      border: var(--ui-surface-border-css, 0.0625rem solid ${FALLBACK_FG_COLOR});
      box-shadow: var(--ui-surface-glow-inset, inset 0 0 14px rgba(40,100,200,0.12)), var(--ui-surface-glow-outer, 0 0 16px rgba(120,170,255,0.22));
    }
    .btn-outline-glass:hover {
      border-color: var(--ui-bright, ${FALLBACK_FG_COLOR});
      box-shadow: var(--ui-surface-glow-inset, inset 0 0 18px rgba(60,140,240,0.18)), var(--ui-surface-glow-outer, 0 0 20px rgba(140,190,255,0.30));
    }
    .btn svg { width: 18px; height: 18px; }

    /* Modal typographic utility classes (unified across all modals) */
    .modal-title { font-size: var(--ui-title-size, 1.5rem); font-weight: var(--ui-title-weight, 700); color: var(--ui-fg, ${FALLBACK_FG_COLOR}); user-select: none; text-shadow: var(--ui-text-glow, var(--sf-tip-text-glow, none)); }
    .modal-title-quip { font-size: var(--ui-title-quip-size, 0.9rem); color: var(--ui-fg-quip, ${FALLBACK_FG_COLOR}); user-select: none; margin: 0 0 var(--ui-padding-after-title-block, 1rem) 0 !important; text-shadow: var(--ui-text-glow, var(--sf-tip-text-glow, none)); }
    .modal-subtitle { font-size: var(--ui-subtitle-size, 1rem); font-weight: var(--ui-title-weight, 700); color: var(--ui-fg, ${FALLBACK_FG_COLOR}); user-select: none; text-shadow: var(--ui-text-glow, var(--sf-tip-text-glow, none)); }
    .modal-subtitle-quip { font-size: var(--ui-title-quip-size, 0.9rem); color: var(--ui-fg-quip, ${FALLBACK_FG_COLOR}); user-select: none; margin: 0 0 var(--ui-padding-after-title-block, 1rem) 0 !important; text-shadow: var(--ui-text-glow, var(--sf-tip-text-glow, none)); }

    /* Universal icon wrapper for consistent sizing */
    .icon-wrap { width: 27px; height: 27px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; }
    .icon-wrap svg { width: 100%; height: 100%; display: block; }
    /* Optional icon tweaks used by some modals */
    .icon-wrap.icon-google { transform: translateY(-4px); }
    .icon-wrap.icon-discord svg { transform: scale(1.28); transform-origin: 50% 50%; }
    .icon-wrap.icon-eye svg { transform: scale(1.35); transform-origin: 50% 50%; }

    /* Inputs */
    .input-glass { 
      width: 100%; color: var(--ui-fg, ${FALLBACK_FG_COLOR}); background: linear-gradient(180deg, rgba(10,18,26,0.20) 0%, rgba(10,16,22,0.16) 100%);
      border: var(--ui-surface-border-css, 0.0625rem solid ${FALLBACK_FG_COLOR}); border-radius: 10px; padding: 0 10px; height: 46px;
      outline: none; box-shadow: var(--ui-surface-glow-inset, inset 0 0 12px rgba(40,100,200,0.10)), var(--ui-surface-glow-outer, 0 0 12px rgba(120,170,255,0.18));
      backdrop-filter: blur(6px) saturate(1.2);
      box-sizing: border-box; max-width: 100%;
    }
    .input-glass::placeholder { color: rgba(220,235,255,0.65); }
    .input-glass:hover { border-color: var(--ui-bright, ${FALLBACK_FG_COLOR}); }
    .input-glass:focus {
      border-color: var(--ui-bright, ${FALLBACK_FG_COLOR});
      box-shadow: var(--ui-surface-glow-inset, inset 0 0 16px rgba(60,140,240,0.18)), var(--ui-surface-glow-outer, 0 0 18px rgba(140,190,255,0.30));
    }

    /* Make browser autofill match our glass style */
    .input-glass:-webkit-autofill,
    .input-glass:-webkit-autofill:focus,
    #overlay input:-webkit-autofill,
    #overlay input:-webkit-autofill:focus {
      -webkit-text-fill-color: var(--ui-fg, ${FALLBACK_FG_COLOR}) !important;
      caret-color: var(--ui-fg, ${FALLBACK_FG_COLOR});
      transition: background-color 9999s ease-in-out 0s;
      box-shadow: inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18), 0 0 0px 1000px rgba(10,16,22,0.16) inset;
      border: var(--ui-surface-border-css, 0.0625rem solid ${FALLBACK_FG_COLOR});
      background-clip: content-box;
    }
    .input-glass:-webkit-autofill:hover,
    #overlay input:-webkit-autofill:hover {
      border-color: var(--ui-bright, ${FALLBACK_FG_COLOR});
      box-shadow: var(--ui-surface-glow-inset, inset 0 0 16px rgba(60,140,240,0.18)), var(--ui-surface-glow-outer, 0 0 18px rgba(140,190,255,0.30));
    }
    /* Firefox */
    .input-glass:-moz-autofill,
    #overlay input:-moz-autofill {
      box-shadow: inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18), 0 0 0px 1000px rgba(10,16,22,0.16) inset;
      -moz-text-fill-color: var(--ui-fg, ${FALLBACK_FG_COLOR});
      caret-color: var(--ui-fg, ${FALLBACK_FG_COLOR});
    }

    /* Input wrapper with optional left/right icon buttons */
    .input-wrap { position: relative; width: 100%; display: flex; align-items: center; }
    .input-wrap.has-left .input-glass { padding-left: 34px; }
    .input-wrap.has-right .input-glass { padding-right: 34px; }
    .input-icon-btn { position: absolute; top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; background: none; border: 0; color: var(--ui-fg, ${FALLBACK_FG_COLOR}); opacity: 0.9; cursor: pointer; }
    .input-icon-btn.left { left: 8px; }
    .input-icon-btn.right { right: 8px; }
    .input-icon-btn:hover { color: var(--ui-bright, ${FALLBACK_FG_COLOR}); opacity: 1; }
    `;
    document.head.appendChild(st);
  } catch (_) {}
}

export default ensureGlassFormStyles;
