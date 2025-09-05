// Always-on Dungeon Scrim (canvas dimming layer)
export function ensureDungeonScrim() {
  // Prefer the new id; migrate from old id if present
  let dungeonScrim = document.getElementById('dungeon-scrim');
  if (!dungeonScrim) {
    dungeonScrim = document.createElement('div');
    dungeonScrim.id = 'dungeon-scrim';
    dungeonScrim.style.position = 'fixed';
    dungeonScrim.style.inset = '0';
    // Use themed overlay tint if available; fallback to black with darkness alpha.
    // Alpha controlled by CSS var --ui-overlay-darkness (0..1). Default 0.5
    dungeonScrim.style.background = 'var(--ui-overlay-bg, rgba(0,0,0, var(--ui-overlay-darkness, 0.5)))';
    dungeonScrim.style.zIndex = '2000'; // below overlay (20000), above canvas (1)
    dungeonScrim.style.display = 'none';
    dungeonScrim.style.pointerEvents = 'none';
    document.body.appendChild(dungeonScrim);
  }
  return dungeonScrim;
}

// Expose globally so other modules (e.g., overlayManager) reuse this single creator.
try {
  if (typeof window !== 'undefined') {
    window.ensureDungeonScrim = window.ensureDungeonScrim || ensureDungeonScrim;
  }
} catch (_) {}

// Lightweight event-driven controller: adjusts dungeonScrim darkness based on UI mode and blocking status
// without owning display/show logic (OverlayManager toggles visibility). This keeps responsibilities
// separate and avoids DOM churn.
;(function(){
  if (typeof window === 'undefined') return;
  // Two states only:
  // - Gameplay with no blocking modal -> force 0 darkness
  // - Otherwise -> remove inline override so theme controls darkness
  const applyDarkness = () => {
    const blocking = !!window.OverlayManager?.isBlockingInput?.();
    const inGameplay = (window.__getCurrentRoute?.() === window.APP_STATES?.GAMEPLAY_ACTIVE);
    const rootStyle = document.documentElement.style;
    if (!blocking && inGameplay) {
      rootStyle.setProperty('--ui-overlay-darkness', '0');
      console.log('Dungeon scrim turned off');
    }
    else
    {
      rootStyle.removeProperty('--ui-overlay-darkness');
      console.log('Dungeon scrim turned on');
    }
  };
  window.addEventListener('ui:mode-changed', applyDarkness);
  window.addEventListener('ui:blocking-changed', applyDarkness);
})();
