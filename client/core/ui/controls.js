// Shared UI helpers for input rows and left-icon inputs
// Keep styles in one place so Games/Players panels and Chat stay consistent.

export const UI = {
  border: '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))',
  rowMinHeight: '46px',
  iconSize: 32,
  leftGap: '0.5rem',
  insetShadow: 'inset 0 0 12px rgba(40,100,200,0.10)',
};

// Create a bottom input row with consistent glass/border look
export function createInputRow({ dataName } = {}) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  row.style.minHeight = UI.rowMinHeight;
  row.style.borderBottom = UI.border;
  row.style.borderLeft = UI.border;
  row.style.borderRight = UI.border;
  row.style.borderRadius = '0px 0px 6px 6px';
  if (dataName) { try { row.setAttribute('data-name', dataName); } catch (_) {} }
  return row;
}

// Create an input with a left icon button placed inside the wrapper
export function createLeftIconInput({ placeholder = '', iconSvg, marginLeft = '0' } = {}) {
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.flex = '1';
  if (marginLeft) wrap.style.marginLeft = marginLeft;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.style.display = 'inline-block';
  input.style.height = '40px';
  input.style.lineHeight = '40px';
  input.style.background = 'transparent';
  input.style.outline = 'none';
  input.style.color = 'var(--sf-tip-fg, #fff)';
  input.style.border = '0';
  input.style.borderRadius = '8px';
  input.style.padding = `0 10px 0 calc(${UI.iconSize}px + ${UI.leftGap})`;
  input.style.boxShadow = UI.insetShadow;
  input.style.flex = '1';
  input.style.width = '100%';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.position = 'absolute';
  btn.style.left = '0';
  btn.style.top = '50%';
  btn.style.transform = 'translateY(-50%)';
  btn.style.width = `${UI.iconSize}px`;
  btn.style.height = `${UI.iconSize}px`;
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.background = 'transparent';
  btn.style.border = UI.border;
  btn.style.borderRadius = '8px';
  btn.style.boxSizing = 'border-box';
  btn.style.color = 'var(--ui-bright, rgba(190,230,255,0.90))';
  btn.style.cursor = 'pointer';
  if (iconSvg) btn.innerHTML = iconSvg;

  wrap.appendChild(input);
  wrap.appendChild(btn);
  return { wrap, input, btn };
}

// On input focus, highlight the parent row border; on blur, restore
export function wireFocusHighlight(inputEl, rowEl) {
  // Track whether the user has interacted (mouse/touch/keyboard)
  let userInteracted = false;
  const markUser = () => { userInteracted = true; };
  window.addEventListener('pointerdown', markUser, { once: true, passive: true });
  window.addEventListener('keydown', markUser, { once: true });

  inputEl.addEventListener('focus', (ev) => {
    // Avoid highlight on programmatic focus during mount
    if (ev && ev.isTrusted === false) return;
    // Only show when it's a visible/user-driven focus
    const looksUserDriven = userInteracted || (typeof inputEl.matches === 'function' && inputEl.matches(':focus-visible'));
    if (!looksUserDriven) return;
    try {
      // Save existing shadow so we can restore it on blur (e.g., custom glow)
      if (!rowEl.hasAttribute('data-saved-boxshadow')) {
        rowEl.setAttribute('data-saved-boxshadow', rowEl.style.boxShadow || '');
      }
      const prev = rowEl.getAttribute('data-saved-boxshadow') || '';
      rowEl.style.boxShadow = [prev, 'inset 0 0 0 1px #fff'].filter(Boolean).join(', ');
      rowEl.style.borderColor = '#fff';
    } catch (_) {}
  });
  inputEl.addEventListener('blur', () => {
    try {
      // Restore any saved shadow from before focus
      const prev = rowEl.getAttribute('data-saved-boxshadow');
      rowEl.style.boxShadow = prev || '';
      try { rowEl.removeAttribute('data-saved-boxshadow'); } catch (_) {}
      rowEl.style.borderColor = 'var(--ui-surface-border, rgba(120,170,255,0.70))';
    } catch (_) {}
  });
}

// Create a tabs bar with consistent button styling.
// tabs: array of any. getKey(tab) -> unique key. getLabel(tab) -> display text.
// onSelect(key): called when a tab is clicked.
export function createTabsBar({ getKey, getLabel, onSelect } = {}) {
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.gap = '6px';
  el.style.flex = '0 0 auto';
  el.style.marginBottom = '0';
  el.style.borderTop = '0';

  function render({ tabs = [], activeKey } = {}) {
    el.innerHTML = '';
    tabs.forEach((t) => {
      const key = getKey ? getKey(t) : t;
      const label = getLabel ? getLabel(t) : String(t);
      const b = document.createElement('button');
      b.textContent = label;
      b.style.padding = '4px 8px';
      b.style.border = UI.border;
      b.style.borderBottom = '0';
      b.style.borderRadius = '0';
      b.style.borderTopLeftRadius = '6px';
      b.style.borderTopRightRadius = '6px';
      const isActive = (key === activeKey);
      b.style.background = isActive ? 'rgba(120,170,255,0.32)' : 'rgba(255,255,255,0.06)';
      b.style.color = isActive ? 'var(--sf-tip-fg, #fff)' : 'var(--ui-bright, rgba(190,230,255,0.98))';
      b.style.textShadow = isActive ? '0 0 6px rgba(140,190,255,0.75)' : '';
      b.onclick = () => { if (typeof onSelect === 'function') onSelect(key); };
      el.appendChild(b);
    });
  }

  return { el, render };
}
