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
    zoom.style.background = 'var(--control-bg)';
    zoom.style.border = '1px solid var(--control-border)';
    zoom.style.borderRadius = '6px';
    zoom.style.padding = '6px';
    zoom.style.display = 'flex';
    zoom.style.flexDirection = 'column';

    const zin = document.createElement('button');
    zin.textContent = '+';
    zin.style.marginBottom = '6px';

    const zout = document.createElement('button');
    zout.textContent = '-';

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
