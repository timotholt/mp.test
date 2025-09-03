// Reusable Keycap UI Component
// Exports ensureKeycapStyle() to inject styles once and buildKeycap() to create a keycap button

import { attachTooltip } from './tooltip.js';

export function ensureKeycapStyle() {
  let st = document.getElementById('sf-keycap-style');
  if (!st) { st = document.createElement('style'); st.id = 'sf-keycap-style'; }
  st.textContent = `
  .sf-keycap {
    position: relative;
    display: inline-flex; align-items: center; justify-content: center;
    height: 1.8rem; min-width: 1.8rem; width: auto; padding: 0 0.3rem;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    border-radius: 6px; cursor: pointer; user-select: none;
    font-family: var(--ui-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace);
    /* Slight lighten overlay to avoid overly dark base */
    background:
      linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.06)),
      linear-gradient(180deg,
        var(--ui-surface-bg-top, rgba(10,18,26, calc(0.52 * var(--ui-opacity-mult, 1)))) 0%,
        var(--ui-surface-bg-bottom, rgba(10,16,22, calc(0.50 * var(--ui-opacity-mult, 1)))) 100%
      );
    border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    box-shadow: none;
  }
  /* Inner 1.3rem square with a fixed 2px top gap from the base, dim theme fill */
  .sf-keycap::before {
    content: ""; position: absolute; width: 1.3rem; height: 1.3rem;
    left: calc(50% - 0.65rem); top: 2px;
    border-radius: 5px;
    background: var(--ui-keycap-inner, var(--ui-scrollbar-thumb, rgba(120,170,255,0.35)));
    border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
  }
  /* Variable width helpers for long labels like Enter/Space */
  .sf-keycap.wide { padding: 0 0.4rem; }
  .sf-keycap.wide::before { width: calc(100% - 0.3rem); left: 50%; transform: translateX(-50%); }

  .sf-keycap:hover, .sf-keycap:focus-visible, .sf-keycap:active, .sf-keycap.listening {
    outline: none;
    box-shadow: var(--ui-surface-glow-outer, 0 0 14px rgba(120,170,255,0.38)), var(--ui-surface-glow-inset, inset 0 0 10px rgba(40,100,200,0.20));
    border-color: var(--ui-surface-border, rgba(190,230,255,0.95));
  }
  /* Unassigned keycaps are dim with no glow */
  .sf-keycap.unbound { opacity: 0.85; box-shadow: none; border-style: dashed; border-color: rgba(255,255,255,0.5); }
  .sf-keycap.unbound::before { opacity: 0.95; }
  /* But on hover/focus/active, unassigned caps should glow like assigned */
  .sf-keycap.unbound:hover, .sf-keycap.unbound:focus-visible, .sf-keycap.unbound:active {
    /* Match assigned hover exactly */
    box-shadow: var(--ui-surface-glow-outer, 0 0 14px rgba(120,170,255,0.38)), var(--ui-surface-glow-inset, inset 0 0 10px rgba(40,100,200,0.20));
    border-color: var(--ui-surface-border, rgba(190,230,255,0.95));
    border-style: solid;
    opacity: 1;
  }

  .sf-keycap .cap-label {
    position: relative; z-index: 1; top: 0;
    display: inline-block; padding: 0 4px; font-size: 1rem; font-weight: 700;
    color: #fff; letter-spacing: 0.02em; line-height: 1;
  }
  .sf-keycap:active { box-shadow: inset 0 2px 8px rgba(0,0,0,0.4); filter: brightness(0.97); }
  .sf-keycap:hover::before, .sf-keycap:focus-visible::before { filter: brightness(1.04); }
  `;
  try { if (!st.parentNode) document.head.appendChild(st); } catch (_) {}
}

export function buildKeycap(act, initialText, extraClass, tooltipOpts) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sf-keycap' + (extraClass ? ' ' + extraClass : '');
  btn.setAttribute('data-action', act.id);
  const lab = document.createElement('span');
  lab.className = 'cap-label';
  lab.textContent = initialText || '';
  btn.appendChild(lab);
  if (tooltipOpts) attachTooltip(btn, tooltipOpts);
  return { btn, lab };
}
