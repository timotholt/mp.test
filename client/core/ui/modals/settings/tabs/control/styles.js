// Styles injector for the Controls tab
// Injects the CSS used by the Controls keyboard UI (rows, two-column, movement ring)

export function ensureControlsKbStyle() {
  let st = document.getElementById('sf-controls-style');
  if (!st) { st = document.createElement('style'); st.id = 'sf-controls-style'; }
  st.textContent = `
  .sf-kb-row { display: grid; grid-template-columns: 1fr var(--kb-keycol, 104px); align-items: center; gap: 6px; margin: 6px 0; }
  .sf-kb-label { color: var(--ui-fg, #eee); font-size: 13px; opacity: 0.95; }
  .sf-kb-toolbar { display: flex; gap: 8px; align-items: center; }
  .sf-btn {
    display: inline-flex; align-items: center; justify-content: center;
    height: 30px; padding: 0 12px; border-radius: 8px; cursor: pointer;
    background: linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)));
    color: var(--ui-fg, #eee); border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    box-shadow: none;
  }
  .sf-btn:hover, .sf-btn:focus-visible { border-color: var(--ui-bright, rgba(190,230,255,0.95)); box-shadow: var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.25)); }
  /* Circular movement layout */
  .sf-kb-move-circle { position: relative; width: 220px; height: 220px; margin: 0 0 8px 0; }
  .sf-kb-move-circle .arrow { position: absolute; transform: translate(-50%, -50%); color: var(--ui-fg, #eee); opacity: 0.9; font-size: 22px; line-height: 1; user-select: none; pointer-events: none; text-shadow: var(--ui-text-glow, 0 0 6px rgba(140,190,255,0.35)); font-family: "Segoe UI Symbol","Noto Sans Symbols 2","Apple Symbols",sans-serif; }
  .sf-kb-move-circle .sf-keycap { position: absolute; transform: translate(-50%, -50%); }
  .sf-keycap.conflict { animation: sf-kb-pulse 0.2s ease-in-out 0s 3 alternate; }
  .sf-keycap.unbound { opacity: var(--ui-unbound-opacity, 0.4); }
  @keyframes sf-kb-pulse { from { filter: brightness(1); } to { filter: brightness(1.35); } }
  /* Two-column grid for large groups */
  .sf-kb-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; grid-auto-flow: row dense; }
  .sf-kb-two-col .sf-kb-row { width: 100%; }
  .sf-kb-row .sf-keycap { justify-self: end; }
  .sf-kb-two-col .sf-kb-row { margin: 2px 0; }
  /* Four-cell grid (label,key | label,key) used by Movement (additional) */
  .sf-kb-two-col-keys { display: grid; grid-template-columns: 1fr var(--kb-keycol, 104px) 1fr var(--kb-keycol, 104px); gap: 8px 18px; align-items: center; }
  .sf-kb-two-col-keys .sf-keycap { justify-self: end; }
  /* Smaller, tighter keycaps within controls page */
  .sf-kb-row .sf-keycap, .sf-kb-two-col-keys .sf-keycap { height: 1.5rem; min-width: 1.5rem; padding: 0 0.25rem; }
  /* Preserve wider padding for .wide so Ctrl/Alt look correct */
  .sf-kb-row .sf-keycap.wide, .sf-kb-two-col-keys .sf-keycap.wide { padding: 0 0.4rem; min-width: 2.4rem; }
  /* Fix single-char cap width so unassigned = assigned size */
  .sf-kb-row .sf-keycap:not(.wide), .sf-kb-two-col-keys .sf-keycap:not(.wide) { width: 1.5rem; }
  .sf-kb-row .sf-keycap::before, .sf-kb-two-col-keys .sf-keycap::before { width: 1.1rem; height: 1.1rem; left: calc(50% - 0.55rem); top: 2px; }
  /* Override for wide caps: make inner overlay span the cap width (Ctrl/Alt/Enter/Space) */
  .sf-kb-row .sf-keycap.wide::before, .sf-kb-two-col-keys .sf-keycap.wide::before {
    left: 0.18rem; right: 0.18rem; width: auto; transform: none;
    border-radius: 6px;
  }
  /* Use sans font only for wide caps; single-char caps keep monospace for consistent width */
  .sf-kb-row .sf-keycap.wide .cap-label, .sf-kb-two-col-keys .sf-keycap.wide .cap-label { font-size: 0.9rem; font-weight: 600; font-family: var(--ui-font-sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif); }
  .sf-kb-chord { display: inline-flex; align-items: center; gap: 4px; }
  .sf-kb-chord .plus { margin: 0 4px; color: var(--ui-fg, #eee); opacity: 0.85; }
  /* Ensure the right column is fixed-width and content doesn’t push layout */
  .sf-kb-row > .sf-kb-cell, .sf-kb-two-col-keys > .sf-kb-cell { justify-self: end; width: var(--kb-keycol, 104px); display: flex; justify-content: flex-end; align-items: center; overflow: hidden; }
  .sf-kb-cell .sf-kb-chord, .sf-kb-cell .sf-keycap { flex: 0 0 auto; }
  /* Blink while listening */
  @keyframes sf-kb-blink { 0%,100% { filter: brightness(1.0); } 50% { filter: brightness(1.35); } }
  .sf-keycap.listening { animation: sf-kb-blink 0.8s ease-in-out infinite; }
  /* Dual movement rings container */
  .sf-kb-move-duo { display: flex; gap: 16px; justify-content: center; align-items: flex-start; flex-wrap: nowrap; margin-top: 4px; }
  .sf-kb-move-col { width: 220px; }
  .sf-kb-move-title { text-align: center; color: var(--ui-fg, #eee); font-size: 14px; opacity: 0.85; margin-bottom: 0; }
  `;
  try { if (!st.parentNode) document.head.appendChild(st); } catch (_) {}
}
