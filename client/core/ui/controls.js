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
      rowEl.style.boxShadow = [prev, 'inset 0 0 0 1px var(--ui-bright, #fff)'].filter(Boolean).join(', ');
      rowEl.style.borderColor = 'var(--ui-bright, #fff)';
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
  try { el.setAttribute('role', 'tablist'); } catch (_) {}

  function render({ tabs = [], activeKey } = {}) {
    el.innerHTML = '';
    tabs.forEach((t) => {
      const key = getKey ? getKey(t) : t;
      const label = getLabel ? getLabel(t) : String(t);
      const b = document.createElement('button');
      b.textContent = label;
      // Expose the tab key for callers that want to update labels (e.g., counts)
      try { b.setAttribute('data-tab-key', String(key)); } catch (_) {}
      try { b.setAttribute('role', 'tab'); } catch (_) {}
      b.style.padding = '4px 8px';
      b.style.border = UI.border;
      b.style.borderBottom = '0';
      b.style.borderRadius = '0';
      b.style.borderTopLeftRadius = '6px';
      b.style.borderTopRightRadius = '6px';
      const isActive = (key === activeKey);
      b.style.background = isActive
        ? 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.35)) 0%, var(--ui-surface-bg-bottom, rgba(10,16,22,0.28)) 100%)'
        : 'rgba(255,255,255,0.06)';
      b.style.color = isActive ? 'var(--sf-tip-fg, #fff)' : 'var(--ui-bright, rgba(190,230,255,0.98))';
      b.style.textShadow = isActive ? 'var(--sf-tip-text-glow, 0 0 6px rgba(140,190,255,0.75))' : '';
      try { b.setAttribute('aria-selected', isActive ? 'true' : 'false'); } catch (_) {}
      try { b.tabIndex = isActive ? 0 : -1; } catch (_) {}
      b.onclick = () => { if (typeof onSelect === 'function') onSelect(key); };
      el.appendChild(b);
    });

    // Keyboard navigation (Left/Right/Home/End) with roving tabindex
    el.onkeydown = (ev) => {
      const code = ev.key;
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(code)) return;
      const btns = Array.from(el.querySelectorAll('button[data-tab-key]'));
      if (!btns.length) return;
      const active = document.activeElement;
      let idx = btns.indexOf(active);
      if (idx < 0) idx = btns.findIndex(b => b.getAttribute('aria-selected') === 'true');
      if (idx < 0) idx = 0;
      if (code === 'ArrowLeft') idx = (idx - 1 + btns.length) % btns.length;
      else if (code === 'ArrowRight') idx = (idx + 1) % btns.length;
      else if (code === 'Home') idx = 0;
      else if (code === 'End') idx = btns.length - 1;
      const nextBtn = btns[idx];
      const nextKey = nextBtn ? nextBtn.getAttribute('data-tab-key') : null;
      if (!nextKey) return;
      ev.preventDefault();
      if (typeof onSelect === 'function') onSelect(nextKey);
      // Focus the newly active tab after parent re-renders
      setTimeout(() => {
        try {
          const q = el.querySelector(`button[data-tab-key="${CSS.escape(String(nextKey))}"]`);
          if (q) q.focus();
        } catch (_) {}
      }, 0);
    };
  }

  return { el, render };
}

// Create a custom dropdown with themed styling (button + overlay menu)
// Usage:
//   const dd = createDropdown({
//     items: [{ label: 'Item A', value: 'a' }, ...],
//     value: 'a',
//     onChange: (val) => {},
//     width: '240px'
//   });
//   parent.appendChild(dd.el);
export function createDropdown({ items = [], value = null, onChange, width = '220px', placeholder = 'Select' } = {}) {
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  wrap.style.display = 'inline-block';
  wrap.style.flex = '0 0 auto';
  wrap.style.minWidth = width;
  wrap.style.maxWidth = width;
  wrap.style.width = width;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'space-between';
  btn.style.gap = '8px';
  btn.style.padding = '6px 10px';
  btn.style.width = '100%';
  btn.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
  btn.style.color = 'var(--ui-fg, #eee)';
  btn.style.border = UI.border;
  btn.style.borderRadius = '10px';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 12px rgba(120,170,255,0.25))';

  const btnLabel = document.createElement('span');
  btnLabel.textContent = placeholder;
  btnLabel.style.flex = '1';
  btnLabel.style.textAlign = 'left';
  btn.appendChild(btnLabel);

  const caret = document.createElement('span');
  caret.textContent = '▾';
  caret.style.opacity = '0.9';
  btn.appendChild(caret);

  const menu = document.createElement('div');
  menu.style.position = 'absolute';
  menu.style.left = '0';
  menu.style.top = 'calc(100% + 4px)';
  menu.style.zIndex = '100000';
  menu.style.minWidth = '100%';
  menu.style.maxHeight = '240px';
  menu.style.overflowY = 'auto';
  menu.style.display = 'none';
  menu.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.95) 0%, rgba(10,16,22,0.92) 100%)';
  menu.style.color = 'var(--ui-fg, #eee)';
  menu.style.border = UI.border;
  menu.style.borderRadius = '10px';
  menu.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 16px rgba(120,170,255,0.35))';
  try { menu.classList.add('ui-glass-scrollbar'); } catch (_) {}

  const list = document.createElement('div');
  list.style.padding = '4px 0';
  menu.appendChild(list);

  let _items = Array.isArray(items) ? items.slice() : [];
  let _value = value;

  function renderMenu() {
    list.innerHTML = '';
    _items.forEach((it) => {
      const row = document.createElement('div');
      row.textContent = it.label != null ? String(it.label) : String(it.value);
      row.setAttribute('data-value', String(it.value));
      row.style.padding = '8px 10px';
      row.style.cursor = 'pointer';
      row.style.userSelect = 'none';
      row.style.color = (it.value === _value) ? 'var(--sf-tip-fg, #fff)' : 'var(--ui-bright, rgba(190,230,255,0.95))';
      row.style.background = (it.value === _value) ? 'rgba(255,255,255,0.08)' : 'transparent';
      row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.10)'; };
      row.onmouseleave = () => { row.style.background = (it.value === _value) ? 'rgba(255,255,255,0.08)' : 'transparent'; };
      row.onclick = () => {
        setValue(it.value, true);
        close();
      };
      list.appendChild(row);
    });
  }

  function open() {
    menu.style.display = 'block';
    // Focus trapping lightweight
    setTimeout(() => { try { menu.focus(); } catch (_) {} }, 0);
    const onDoc = (ev) => {
      if (!wrap.contains(ev.target)) { close(); }
    };
    window.addEventListener('mousedown', onDoc, { capture: true });
    window.addEventListener('wheel', onDoc, { passive: true, capture: true });
    menu.setAttribute('data-onDoc', '1');
    menu._onDoc = onDoc;
  }

  function close() {
    menu.style.display = 'none';
    if (menu._onDoc) {
      window.removeEventListener('mousedown', menu._onDoc, { capture: true });
      window.removeEventListener('wheel', menu._onDoc, { capture: true });
      menu._onDoc = null;
    }
  }

  function setItems(items) {
    _items = Array.isArray(items) ? items.slice() : [];
    renderMenu();
  }

  function setValue(v, fire) {
    _value = v;
    const found = _items.find(it => it.value === v);
    btnLabel.textContent = found ? (found.label != null ? String(found.label) : String(found.value)) : placeholder;
    renderMenu();
    if (fire && typeof onChange === 'function') onChange(v);
  }

  function getValue() { return _value; }

  btn.onclick = () => {
    if (menu.style.display === 'none') open(); else close();
  };

  wrap.appendChild(btn);
  wrap.appendChild(menu);

  // Initialize
  setItems(_items);
  setValue(_value, false);

  return { el: wrap, button: btn, menu, setItems, setValue, getValue, open, close };
}
