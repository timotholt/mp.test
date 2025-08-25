// Zoom Manager
// Provides minimal on-screen +/- controls and dispatches a zoom event or calls a renderer hook.
// Behavior is identical to the prior inline implementation in main.js.

export function ensureZoomControls() {
  let zoom = document.getElementById('zoom-controls');
  if (!zoom) {
    zoom = document.createElement('div');
    zoom.id = 'zoom-controls';
    zoom.style.position = 'fixed';
    zoom.style.left = '12px';
    zoom.style.bottom = '12px';
    zoom.style.zIndex = '30001';
    // Blue glassmorphism surface with safe fallbacks
    zoom.style.background = 'var(--control-bg, linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40))))';
    zoom.style.border = '1px solid var(--control-border, var(--ui-surface-border, rgba(120,170,255,0.70)))';
    zoom.style.borderRadius = '6px';
    zoom.style.padding = '6px';
    zoom.style.display = 'flex';
    zoom.style.flexDirection = 'column';
    zoom.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33))';
    zoom.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';

    const zin = document.createElement('button');
    zin.textContent = '+';
    zin.style.marginBottom = '6px';
    // Glass button style (minimally invasive)
    zin.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    zin.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
    zin.style.color = 'var(--ui-fg, #eee)';
    zin.style.minWidth = '32px';
    zin.style.height = '32px';
    zin.style.borderRadius = '4px';
    zin.style.cursor = 'pointer';
    zin.style.display = 'inline-flex';
    zin.style.alignItems = 'center';
    zin.style.justifyContent = 'center';

    const zout = document.createElement('button');
    zout.textContent = '-';
    // Mirror style for consistency
    zout.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    zout.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
    zout.style.color = 'var(--ui-fg, #eee)';
    zout.style.minWidth = '32px';
    zout.style.height = '32px';
    zout.style.borderRadius = '4px';
    zout.style.cursor = 'pointer';
    zout.style.display = 'inline-flex';
    zout.style.alignItems = 'center';
    zout.style.justifyContent = 'center';

    const applyZoom = (factor) => {
      try {
        if (window.radianceCascades && typeof window.radianceCascades.zoom === 'function') {
          window.radianceCascades.zoom(factor);
        } else {
          window.dispatchEvent(new CustomEvent('ui:zoom', { detail: { factor } }));
        }
      } catch (_) {}
    };

    zin.onclick = () => applyZoom(1.1);
    zout.onclick = () => applyZoom(0.9);
    zoom.appendChild(zin);
    zoom.appendChild(zout);
    document.body.appendChild(zoom);
  }
}
