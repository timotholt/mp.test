// Status Bar UI chrome (persistent, non-modal)
// Extracted from main.js without behavior changes

import { presentSettingsPanel } from '../../modals/settings.js';

// Hover timings
// Start: slide animation duration when bar enters/leaves on hover
// Exit: delay before auto-hiding after the pointer leaves
const STATUSBAR_SLIDE_DURATION_MS = 1000;
const STATUSBAR_HIDE_DELAY_MS = 1000;

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
    // Themed glassmorphism look. Theme override via --statusbar-bg; fallback ties to surface tokens
    bar.style.background = 'var(--statusbar-bg, linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.35)) 0%, var(--ui-surface-bg-bottom, rgba(10,16,22,0.28)) 100%))';
    // bar.style.borderLeft = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    // bar.style.borderRight = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    bar.style.borderLeft = '0';
    bar.style.borderRight = '0';
    bar.style.borderBottom = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    bar.style.borderTop = 'none';
    bar.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
    bar.style.backdropFilter = 'var(--sf-tip-backdrop, blur(8px) saturate(1.25))';
    bar.style.color = 'var(--ui-fg)';
    // Keep status bar above overlays
    bar.style.zIndex = '30000';
    // Slide animation (window shade): 1s down/up using transform
    bar.style.transform = 'translateY(-100%)';
    bar.style.transition = `transform ${STATUSBAR_SLIDE_DURATION_MS}ms ease`;
    bar.style.willChange = 'transform';
    bar.style.pointerEvents = 'none';
    const left = document.createElement('div');
    left.id = 'status-left';
    // Metrics span (ID preserved for external updaters). Now lives in right side next to the gear.
    const metrics = document.createElement('span');
    metrics.id = 'status-metrics';
    metrics.textContent = 'FPS: -- | PING: --';
    const right = document.createElement('div');
    right.id = 'status-right';
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '10px';
    const gear = document.createElement('button');
    // Outline gear SVG (accessible)
    gear.setAttribute('aria-label', 'Settings');
    gear.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.3l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51.16.07.33.1.51.1H21a2 2 0 1 1 0 4h-.09c-.18 0-.35.03-.51.1-.61.25-1 .85-1 1.51Z"/></svg>';
    gear.style.background = 'transparent';
    gear.style.border = 'none';
    gear.style.color = 'var(--ui-fg)';
    gear.style.width = '28px';
    gear.style.height = '28px';
    gear.style.display = 'inline-flex';
    gear.style.alignItems = 'center';
    gear.style.justifyContent = 'center';
    gear.style.cursor = 'pointer';
    gear.onclick = () => { try { presentSettingsPanel(); } catch (_) {} };
    right.appendChild(gear);
    right.appendChild(metrics);
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
      }, STATUSBAR_HIDE_DELAY_MS);
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
