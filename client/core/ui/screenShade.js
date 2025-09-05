// Always-on Dungeon Scrim (canvas dimming layer)
export function ensureScreenShade() {
  // Prefer the new id; migrate from old id if present
  let shade = document.getElementById('dungeon-scrim');
  if (!shade) {
    shade = document.createElement('div');
    shade.id = 'dungeon-scrim';
    shade.style.position = 'fixed';
    shade.style.inset = '0';
    // Use themed overlay tint if available; fallback to black with darkness alpha.
    // Alpha controlled by CSS var --ui-overlay-darkness (0..1). Default 0.5
    shade.style.background = 'var(--ui-overlay-bg, rgba(0,0,0, var(--ui-overlay-darkness, 0.5)))';
    shade.style.zIndex = '2000'; // below overlay (20000), above canvas (1)
    shade.style.display = 'none';
    shade.style.pointerEvents = 'none';
    document.body.appendChild(shade);
  }
  return shade;
}

// Expose globally so other modules (e.g., overlayManager) reuse this single creator.
try {
  if (typeof window !== 'undefined') {
    window.ensureScreenShade = window.ensureScreenShade || ensureScreenShade;
    // Provide an alias matching the new name for readability
    window.ensureDungeonScrim = window.ensureDungeonScrim || ensureScreenShade;
  }
} catch (_) {}

// Lightweight event-driven controller: adjusts shade darkness based on UI mode and blocking status
// without owning display/show logic (OverlayManager toggles visibility). This keeps responsibilities
// separate and avoids DOM churn.
;(function(){
  if (typeof window === 'undefined') return;
  let currentMode = 'game';
  const darknessByMode = { login: 0.6, settings: 0.35, game: 0.0, menu: 0.2 };
  const setDark = (v) => {
    const clamped = Math.max(0, Math.min(1, Number(v) || 0));
    try { document.documentElement.style.setProperty('--ui-overlay-darkness', String(clamped)); } catch (_) {}
  };
  // Track current mode for better visual tuning while a modal is blocking
  window.addEventListener('ui:mode-changed', (e) => {
    try { currentMode = String(e?.detail?.mode || 'game'); } catch (_) { currentMode = 'game'; }
    // Apply darkness immediately based on current blocking state to avoid stale visuals
    try { ensureScreenShade(); } catch (_) {}
    let blocking = false;
    try {
      blocking = !!(window.OverlayManager && typeof window.OverlayManager.isBlockingInput === 'function' && window.OverlayManager.isBlockingInput());
    } catch (_) { blocking = false; }
    const v = blocking ? (darknessByMode[currentMode] ?? 0.5) : 0.0;
    setDark(v);
  });
  // On blocking change, ensure shade exists and set appropriate darkness for the active mode
  window.addEventListener('ui:blocking-changed', (e) => {
    try { ensureScreenShade(); } catch (_) {}
    const blocking = !!(e && e.detail && e.detail.blocking);
    const v = blocking ? (darknessByMode[currentMode] ?? 0.5) : 0.0;
    setDark(v);
  });
})();
