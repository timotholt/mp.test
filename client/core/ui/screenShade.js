// Always-on Canvas Dimming Shade
export function ensureScreenShade() {
  let shade = document.getElementById('screen-shade');
  if (!shade) {
    shade = document.createElement('div');
    shade.id = 'screen-shade';
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
try { if (typeof window !== 'undefined') { window.ensureScreenShade = window.ensureScreenShade || ensureScreenShade; } } catch (_) {}
