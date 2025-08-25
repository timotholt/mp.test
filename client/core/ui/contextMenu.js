// Lightweight glass-styled context menu (JS-only)
// Usage: import { showContextMenu } from './contextMenu.js';
// showContextMenu({ x, y, items: [ { label, onClick }, { separator: true }, ... ] })

export function showContextMenu({ x = 0, y = 0, items = [], blockGameplayInput = true } = {}) {
  // Close any existing menu first
  try { hideContextMenu(); } catch (_) {}

  const backdrop = document.createElement('div');
  backdrop.id = 'ui-context-menu-backdrop';
  backdrop.style.position = 'fixed';
  backdrop.style.inset = '0';
  backdrop.style.zIndex = '30000';
  backdrop.style.background = 'transparent';
  backdrop.style.pointerEvents = 'auto';

  const menu = document.createElement('div');
  menu.id = 'ui-context-menu';
  menu.style.position = 'fixed';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.minWidth = '180px';
  menu.style.maxWidth = '320px';
  menu.style.padding = '6px';
  menu.style.display = 'flex';
  menu.style.flexDirection = 'column';
  menu.style.gap = '4px';
  // Glass surface
  menu.style.background = 'linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
  menu.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  menu.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33))';
  menu.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
  menu.style.borderRadius = '8px';
  menu.style.color = 'var(--ui-bright, rgba(190,230,255,0.98))';
  menu.style.pointerEvents = 'auto';

  // Build items
  (items || []).forEach((it) => {
    if (!it) return;
    if (it.separator) {
      const hr = document.createElement('div');
      hr.style.margin = '4px 0';
      hr.style.height = '1px';
      hr.style.background = 'var(--ui-surface-border, rgba(120,170,255,0.70))';
      hr.style.opacity = '0.7';
      menu.appendChild(hr);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = it.label || '';
    btn.disabled = !!it.disabled;
    btn.style.display = 'block';
    btn.style.textAlign = 'left';
    btn.style.padding = '8px 10px';
    btn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    btn.style.background = 'transparent';
    btn.style.color = 'inherit';
    btn.style.borderRadius = '6px';
    btn.style.cursor = it.disabled ? 'not-allowed' : 'pointer';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      try { if (typeof it.onClick === 'function') it.onClick(); } catch (_) {}
      hideContextMenu();
    });
    menu.appendChild(btn);
  });

  // Ensure on-screen positioning
  document.body.appendChild(backdrop);
  document.body.appendChild(menu);
  // Optionally gate gameplay input while menu is open
  let restoreGameplayInput;
  try {
    if (blockGameplayInput) {
      const prev = window.__canSendGameplayInput;
      restoreGameplayInput = () => { try { window.__canSendGameplayInput = prev; } catch (_) {} };
      window.__canSendGameplayInput = false;
    }
  } catch (_) {}
  try {
    const rect = menu.getBoundingClientRect();
    let nx = x, ny = y;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (rect.right > vw) nx = Math.max(0, vw - rect.width - 8);
    if (rect.bottom > vh) ny = Math.max(0, vh - rect.height - 8);
    menu.style.left = nx + 'px';
    menu.style.top = ny + 'px';
  } catch (_) {}

  // Close behaviors
  function handleClose() { try { if (restoreGameplayInput) restoreGameplayInput(); } catch (_) {} hideContextMenu(); }
  backdrop.addEventListener('click', handleClose, { once: true });
  backdrop.addEventListener('contextmenu', (e) => { e.preventDefault(); handleClose(); });
  window.addEventListener('blur', handleClose, { once: true });
  window.addEventListener('resize', handleClose, { once: true });
  window.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { window.removeEventListener('keydown', esc); handleClose(); } });

  return { hide: hideContextMenu };
}

export function hideContextMenu() {
  try { const m = document.getElementById('ui-context-menu'); if (m) m.remove(); } catch (_) {}
  try { const b = document.getElementById('ui-context-menu-backdrop'); if (b) b.remove(); } catch (_) {}
}
