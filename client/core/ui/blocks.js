// Reusable UI blocks for top-level windows (Settings, Login, etc.)
// Encapsulate inline styling so callers remain CSS-agnostic

import { createTabsBar, UI } from './controls.js';
import { getQuip } from './quip.js';
import { createUiElement, basicButton } from './theme/elements.js';

// Modal card container
export function makeCard() {
  const card = document.createElement('div');
  card.style.width = 'auto';
  card.style.maxWidth = 'calc(100vw - 2rem)';
  card.style.color = 'var(--ui-fg)';
  card.style.borderRadius = '0.875rem';
  card.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,36,0.48)) 0%, var(--ui-surface-bg-bottom, rgba(8,14,28,0.44)) 100%)';
  card.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  card.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 1.375rem rgba(80,140,255,0.33))';
  card.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
  card.style.padding = '1rem';
  card.style.maxHeight = 'min(80vh, 50rem)';
  card.style.height = 'min(80vh, 50rem)';
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
  header.style.marginBottom = '0.125rem';

  const titleEl = document.createElement('div');
  titleEl.textContent = String(title || '');
  titleEl.style.fontSize = 'var(--ui-modal-title-size)';
  titleEl.style.fontWeight = 'var(--ui-modal-title-weight)';
  titleEl.style.userSelect = 'none';
  try { titleEl.id = 'modal-title'; } catch (_) {}

  // Close button: use standard UI button template with minimal overrides
  // Use 'button' tag explicitly to keep textContent and semantics; template defaults to input[type=button].
  const closeBtn = createUiElement([
    basicButton,
    { fontSize: 'var(--ui-fontsize-medium)', borderRadius: '0.5rem', px: '0.5rem', py: '0.25rem' }
  ], 'button', '✕');
  try { closeBtn.setAttribute('aria-label', 'Close'); } catch (_) {}
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
  quipEl.style.fontSize = 'var(--ui-modal-title-quip-size)';
  quipEl.style.opacity = '0.9';
  quipEl.style.margin = '0 0 1rem 0';
  quipEl.style.color = 'var(--ui-fg-quip)';
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
  pane.style.minHeight = '15rem';
  pane.style.maxHeight = 'calc(min(80vh, 50rem) - 7.5rem)';
  // Width constraints are managed by CSS vars used elsewhere
  pane.style.maxWidth = 'var(--ui-glass-scrollbar-max-width)';
  pane.style.minWidth = 'var(--ui-glass-scrollbar-min-width)';
  try {
    pane.style.border = UI.border;
    pane.style.borderRadius = '0 0.5rem 0.5rem 0.5rem'; // sharp top-left
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

// Present an external OverlayManager layer and mount a center container
// Returns { mount, scrim, center, dismiss } or null on failure
export function presentExternalOverlayLayer({ id = 'GENERIC_MODAL', priority = (window.PRIORITY || { MEDIUM: 50 }).MEDIUM, rootId = 'modal-overlay-root' } = {}) {
  try { if (!window || !window.OverlayManager) return null; } catch (_) { return null; }
  try {
    window.OverlayManager.present({ id, text: '', actions: [], blockInput: true, priority, external: true });
  } catch (_) {}

  let content = null;
  try {
    const overlay = document.getElementById('overlay');
    content = overlay ? overlay.querySelector('#overlay-content') : null;
  } catch (_) { content = null; }
  if (!content) return null;

  try {
    const prev = content.querySelector(`#${rootId}`);
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
  } catch (_) {}

  const layer = makeCenterLayer({ rootId });
  try { content.appendChild(layer.mount); } catch (_) {}

  const dismiss = () => {
    try { const m = document.getElementById(rootId); if (m && m.parentNode) m.parentNode.removeChild(m); } catch (_) {}
    try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
  };

  return { ...layer, dismiss };
}

// Focus trap utility for modal dialogs
// Usage: const remove = attachFocusTrap(cardEl, { onEscape, autoFocus: true, focusSelector: 'input,button' });
export function attachFocusTrap(rootEl, { onEscape = null, autoFocus = true, focusSelector = null } = {}) {
  if (!rootEl || typeof rootEl.addEventListener !== 'function') return () => {};

  const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function getFocusable() {
    try {
      const nodes = rootEl.querySelectorAll(selector);
      return Array.from(nodes).filter(el => !el.disabled && el.offsetParent !== null);
    } catch (_) { return []; }
  }

  const keyHandler = (ev) => {
    try {
      if (ev.key === 'Escape') {
        ev.preventDefault(); ev.stopPropagation();
        if (typeof onEscape === 'function') onEscape();
        return;
      }
      if (ev.key !== 'Tab') return;
      const focusables = getFocusable();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); try { last.focus(); } catch (_) {} }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); try { first.focus(); } catch (_) {} }
    } catch (_) {}
  };

  try { rootEl.addEventListener('keydown', keyHandler); } catch (_) {}

  if (autoFocus) {
    setTimeout(() => {
      try {
        let node = null;
        if (focusSelector) {
          const custom = rootEl.querySelectorAll(focusSelector);
          node = Array.from(custom).find(el => !el.disabled && el.offsetParent !== null) || null;
        }
        if (!node) {
          const focusables = getFocusable();
          node = focusables[0] || null;
        }
        if (node) node.focus();
      } catch (_) {}
    }, 0);
  }

  return () => {
    try { rootEl.removeEventListener('keydown', keyHandler); } catch (_) {}
  };
}

// Thin divider, useful outside of makeSection
export function makeSectionSeparator() {
  const hr = document.createElement('div');
  hr.style.borderTop = '1px solid var(--ui-surface-border, rgba(120,170,255,0.30))';
  hr.style.margin = '0.25rem 0 0.5rem 0';
  return hr;
}
