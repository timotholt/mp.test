// Reusable UI blocks for top-level windows (Settings, Login, etc.)
// Encapsulate inline styling so callers remain CSS-agnostic

import { createTabsBar, UI } from './controls.js';
import { getQuip } from './quip.js';

// Modal card container
export function makeCard() {
  const card = document.createElement('div');
  card.style.width = 'auto';
  card.style.maxWidth = 'calc(100vw - 32px)';
  card.style.color = 'var(--ui-fg, #eee)';
  card.style.borderRadius = '14px';
  card.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,36,0.48)) 0%, var(--ui-surface-bg-bottom, rgba(8,14,28,0.44)) 100%)';
  card.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  card.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
  card.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
  card.style.padding = '16px';
  card.style.maxHeight = 'min(80vh, 820px)';
  card.style.height = 'min(80vh, 820px)';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.minWidth = '0';
  try { card.setAttribute('role', 'dialog'); } catch (_) {}
  return card;
}

// Title block with close button and optional quip line
export function makeTitleBlock({ title = '', quips = null, desc = '', onClose = null } = {}) {
  const root = document.createElement('div');

  // Header row
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '2px';

  const titleEl = document.createElement('div');
  titleEl.textContent = String(title || '');
  titleEl.style.fontSize = 'var(--ui-title-size, 1.5rem)';
  titleEl.style.fontWeight = 'var(--ui-title-weight, 700)';
  titleEl.style.userSelect = 'none';
  try { titleEl.id = 'modal-title'; } catch (_) {}

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = '1px solid var(--ui-surface-border)';
  closeBtn.style.borderRadius = '8px';
  closeBtn.style.color = 'var(--ui-fg, #eee)';
  closeBtn.style.cursor = 'pointer';
  if (typeof onClose === 'function') {
    try { closeBtn.onclick = onClose; } catch (_) {}
  }

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  // Quip/tagline below header
  const quipEl = document.createElement('div');
  try {
    const text = quips ? getQuip('blocks.title.quip', Array.isArray(quips) ? quips : []) : (desc || '');
    quipEl.textContent = text || '';
  } catch (_) { quipEl.textContent = String(desc || ''); }
  quipEl.style.fontSize = 'var(--ui-title-quip-size, 0.9rem)';
  quipEl.style.opacity = '0.9';
  quipEl.style.margin = '0 0 1rem 0';
  quipEl.style.color = 'var(--ui-fg-quip, #bbb)';
  quipEl.style.userSelect = 'none';

  root.appendChild(header);
  root.appendChild(quipEl);

  return { el: root, titleEl, quipEl, closeBtn };
}

// Tabs wrapper around createTabsBar; preserves { el, render }
export function makeTabs({ onSelect = () => {} } = {}) {
  const bar = createTabsBar({ onSelect });
  return {
    el: bar.el,
    render: (...args) => bar.render && bar.render(...args),
  };
}

// Bordered, scrollable content pane (glass look)
export function makeContentPane() {
  const pane = document.createElement('div');
  try { pane.classList.add('ui-glass-scrollbar'); } catch (_) {}
  pane.style.overflow = 'auto';
  pane.style.padding = '1.0rem';
  pane.style.marginTop = '0px';
  pane.style.minHeight = '240px';
  pane.style.maxHeight = 'calc(min(80vh, 820px) - 120px)';
  // Width constraints are managed by CSS vars used elsewhere
  pane.style.maxWidth = 'var(--ui-glass-scrollbar-max-width)';
  pane.style.minWidth = 'var(--ui-glass-scrollbar-min-width)';
  try {
    pane.style.border = UI.border;
    pane.style.borderRadius = '0 8px 8px 8px'; // sharp top-left
    pane.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.20) 0%, rgba(10,16,22,0.16) 100%)';
  } catch (_) {}
  return pane;
}

// Centered overlay mount with scrim; caller appends mount to overlay content
export function makeCenterLayer({ rootId = 'settings-overlay-root' } = {}) {
  const mount = document.createElement('div');
  mount.id = rootId;
  mount.style.position = 'fixed';
  mount.style.inset = '0';
  mount.style.zIndex = '20001';
  mount.style.pointerEvents = 'auto';

  const scrim = document.createElement('div');
  scrim.style.position = 'absolute';
  scrim.style.inset = '0';
  scrim.style.background = 'var(--ui-overlay-bg, rgba(0,0,0,0.50))';
  scrim.style.backdropFilter = 'blur(var(--ui-backdrop-blur, 3px))';
  scrim.style.webkitBackdropFilter = 'blur(var(--ui-backdrop-blur, 3px))';
  scrim.style.zIndex = '0';
  scrim.style.pointerEvents = 'auto';
  try { mount.appendChild(scrim); } catch (_) {}

  const center = document.createElement('div');
  center.style.position = 'relative';
  center.style.zIndex = '1';
  center.style.minHeight = '100vh';
  center.style.display = 'flex';
  center.style.alignItems = 'center';
  center.style.justifyContent = 'center';

  return { mount, scrim, center };
}

// Thin divider, useful outside of makeSection
export function makeSectionSeparator() {
  const hr = document.createElement('div');
  hr.style.borderTop = '1px solid var(--ui-surface-border, rgba(120,170,255,0.30))';
  hr.style.margin = '0.25rem 0 0.5rem 0';
  return hr;
}
