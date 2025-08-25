// Status Bar UI chrome (persistent, non-modal)
// Extracted from main.js without behavior changes

import { presentSettingsPanel } from '../../modals/settings.js';

export function ensureStatusBar() {
  let bar = document.getElementById('hover-status-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'hover-status-bar';
    bar.style.position = 'fixed';
    bar.style.left = '0';
    bar.style.right = '0';
    bar.style.top = '0';
    bar.style.height = '3em';
    // Always render; visibility controlled via transform for smooth animation
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.justifyContent = 'space-between';
    bar.style.padding = '0 12px';
    // Blue glassmorphism look
    bar.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.12) 0%, rgba(10,16,22,0.08) 100%)';
    bar.style.borderLeft = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    bar.style.borderRight = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    bar.style.borderBottom = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    bar.style.borderTop = 'none';
    bar.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
    bar.style.backdropFilter = 'var(--sf-tip-backdrop, blur(8px) saturate(1.25))';
    bar.style.color = 'var(--ui-fg)';
    // Keep status bar above overlays
    bar.style.zIndex = '30000';
    // Slide animation (window shade): 1s down/up using transform
    bar.style.transform = 'translateY(-100%)';
    bar.style.transition = 'transform 1s ease';
    bar.style.willChange = 'transform';
    bar.style.pointerEvents = 'none';
    const left = document.createElement('div');
    left.id = 'status-left';
    // Keep metrics in a nested span so other UI (like volume knobs) can live inside left without
    // being clobbered by textContent updates elsewhere.
    const metrics = document.createElement('span');
    metrics.id = 'status-metrics';
    metrics.textContent = 'FPS: -- | PING: --';
    left.appendChild(metrics);
    const right = document.createElement('div');
    right.id = 'status-right';
    const gear = document.createElement('button');
    gear.textContent = '⚙️';
    gear.style.background = 'transparent';
    gear.style.border = 'none';
    gear.style.color = 'var(--ui-fg)';
    gear.style.fontSize = '1.2em';
    gear.style.cursor = 'pointer';
    gear.onclick = () => { try { presentSettingsPanel(); } catch (_) {} };
    right.appendChild(gear);
    bar.appendChild(left); bar.appendChild(right);
    document.body.appendChild(bar);

    let hideTimer = null;
    let hoveringBar = false;
    const clearHide = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
    const requestHide = () => {
      clearHide();
      hideTimer = setTimeout(() => {
        if (!hoveringBar) {
          bar.style.transform = 'translateY(-100%)';
          bar.style.pointerEvents = 'none';
        }
      }, 3000);
    };
    bar.addEventListener('mouseenter', () => { hoveringBar = true; clearHide(); });
    bar.addEventListener('mouseleave', () => { hoveringBar = false; requestHide(); });
    window.addEventListener('mousemove', (e) => {
      if (e.clientY <= 8) {
        bar.style.transform = 'translateY(0)';
        bar.style.pointerEvents = 'auto';
        requestHide();
      }
    });
  }
  return bar;
}
