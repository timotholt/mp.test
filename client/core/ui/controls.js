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
      // Stable label/count spans allow flicker-free count updates by callers
      const lab = document.createElement('span');
      lab.textContent = label;
      try { lab.setAttribute('data-tab-label', '1'); } catch (_) {}
      const cnt = document.createElement('span');
      try { cnt.setAttribute('data-tab-count', '1'); } catch (_) {}
      cnt.style.marginLeft = '6px';
      b.appendChild(lab);
      b.appendChild(cnt);
      // Expose the tab key for callers that want to update labels (e.g., counts)
      try { b.setAttribute('data-tab-key', String(key)); } catch (_) {}
      try { b.setAttribute('role', 'tab'); } catch (_) {}
      b.style.padding = '6px 10px';
      b.style.border = UI.border;
      b.style.borderBottom = '0';
      b.style.borderRadius = '0';
      b.style.borderTopLeftRadius = '6px';
      b.style.borderTopRightRadius = '6px';
      // Center the tab label content
      b.style.display = 'inline-flex';
      b.style.alignItems = 'center';
      b.style.justifyContent = 'center';
      b.style.textAlign = 'center';
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
  try { btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false'); } catch (_) {}

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
  try { menu.setAttribute('role', 'listbox'); menu.tabIndex = -1; } catch (_) {}

  const list = document.createElement('div');
  list.style.padding = '4px 0';
  menu.appendChild(list);

  let _items = Array.isArray(items) ? items.slice() : [];
  let _value = value;
  let _typeBuffer = '';
  let _typeTimer = 0;

  function renderMenu() {
    list.innerHTML = '';
    _items.forEach((it, idx) => {
      const row = document.createElement('div');
      row.textContent = it.label != null ? String(it.label) : String(it.value);
      row.setAttribute('data-value', String(it.value));
      row.style.padding = '8px 10px';
      row.style.cursor = 'pointer';
      row.style.userSelect = 'none';
      const isSel = (it.value === _value);
      row.style.color = isSel ? 'var(--sf-tip-fg, #fff)' : 'var(--ui-bright, rgba(190,230,255,0.95))';
      row.style.background = isSel ? 'rgba(255,255,255,0.08)' : 'transparent';
      try { row.setAttribute('role', 'option'); row.setAttribute('aria-selected', isSel ? 'true' : 'false'); row.id = `dd-opt-${idx}`; } catch (_) {}
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
    try { btn.setAttribute('aria-expanded', 'true'); } catch (_) {}
  }

  function close() {
    menu.style.display = 'none';
    if (menu._onDoc) {
      window.removeEventListener('mousedown', menu._onDoc, { capture: true });
      window.removeEventListener('wheel', menu._onDoc, { capture: true });
      menu._onDoc = null;
    }
    try { btn.setAttribute('aria-expanded', 'false'); btn.focus(); } catch (_) {}
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

  function findIndexByValue(v) {
    return _items.findIndex(it => it.value === v);
  }

  function clampIndex(i) {
    const n = _items.length;
    if (n <= 0) return -1;
    return (i + n) % n;
  }

  function selectByOffset(delta, fire = true) {
    if (!_items.length) return;
    const cur = findIndexByValue(_value);
    const next = clampIndex((cur < 0 ? 0 : cur) + delta);
    const it = _items[next];
    if (it) setValue(it.value, fire);
  }

  function selectFirstLast(which = 'first', fire = true) {
    if (!_items.length) return;
    const idx = which === 'last' ? _items.length - 1 : 0;
    const it = _items[idx];
    if (it) setValue(it.value, fire);
  }

  function typeAhead(ch) {
    try { ch = String(ch || '').toLowerCase(); } catch (_) { return; }
    if (!/^[\w\-\s]$/.test(ch)) return;
    clearTimeout(_typeTimer);
    _typeBuffer += ch;
    _typeTimer = setTimeout(() => { _typeBuffer = ''; }, 750);
    const start = Math.max(0, findIndexByValue(_value));
    const n = _items.length;
    for (let off = 1; off <= n; off++) {
      const it = _items[(start + off) % n];
      if (!it) continue;
      const label = (it.label != null ? String(it.label) : String(it.value)).toLowerCase();
      if (label.startsWith(_typeBuffer)) { setValue(it.value, true); break; }
    }
  }

  function onKeyDown(ev) {
    const k = ev.key;
    if (k === 'ArrowDown') { ev.preventDefault(); selectByOffset(1, true); return; }
    if (k === 'ArrowUp') { ev.preventDefault(); selectByOffset(-1, true); return; }
    if (k === 'Home') { ev.preventDefault(); selectFirstLast('first', true); return; }
    if (k === 'End') { ev.preventDefault(); selectFirstLast('last', true); return; }
    if (k === 'Enter' || k === ' ') {
      ev.preventDefault();
      if (menu.style.display === 'none') open(); else close();
      return;
    }
    if (k === 'Escape') { if (menu.style.display !== 'none') { ev.preventDefault(); close(); } return; }
    // Type-ahead for letters/numbers and space
    if (k && k.length === 1) { typeAhead(k); }
  }

  btn.addEventListener('keydown', onKeyDown);
  // When menu is open, allow same navigation keys
  menu.addEventListener('keydown', (ev) => {
    const k = ev.key;
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End') { onKeyDown(ev); return; }
    if (k === 'Enter' || k === ' ') { ev.preventDefault(); close(); return; }
    if (k === 'Escape') { ev.preventDefault(); close(); return; }
    if (k && k.length === 1) { typeAhead(k); }
  });

  wrap.appendChild(btn);
  wrap.appendChild(menu);

  // Initialize
  setItems(_items);
  setValue(_value, false);

  return { el: wrap, button: btn, menu, setItems, setValue, getValue, open, close };
}

// Create a tooltip-styled checkbox (reusable across the app)
// Usage:
//   const cb = createCheckbox({ label: 'Enable thing', checked: true, onChange: (val) => {} });
//   parent.appendChild(cb.el);
export function createCheckbox({ label = '', checked = false, onChange } = {}) {
  ensureCheckboxStyle();
  const lab = document.createElement('label');
  lab.className = 'sf-check';
  lab.style.cursor = 'pointer';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'sf-check-input';
  input.checked = !!checked;

  const box = document.createElement('span');
  box.className = 'sf-check-box';

  const text = document.createElement('span');
  text.className = 'sf-check-text';
  text.textContent = label;

  input.onchange = () => {
    if (typeof onChange === 'function') onChange(!!input.checked);
  };

  lab.appendChild(input);
  lab.appendChild(box);
  lab.appendChild(text);

  function setChecked(v) { input.checked = !!v; if (typeof onChange === 'function') onChange(!!input.checked); }
  function getChecked() { return !!input.checked; }

  return { el: lab, input, setChecked, getChecked };
}

// Inject minimal CSS for the tooltip-like checkbox once
function ensureCheckboxStyle() {
  let st = document.getElementById('sf-checkbox-style');
  if (!st) { st = document.createElement('style'); st.id = 'sf-checkbox-style'; }
  st.textContent = `
  /* Minimal tooltip-like checkbox visuals; only the box uses glass/glow */
  .sf-check { display: inline-flex; align-items: center; gap: 8px; color: var(--ui-fg, #eee); }
  .sf-check-input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .sf-check-box {
    position: relative; width: 14px; height: 14px; flex: 0 0 14px; display: inline-block;
    border-radius: 3px;
    border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    background: linear-gradient(180deg,
      var(--ui-surface-bg-top, rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1)))) 0%,
      var(--ui-surface-bg-bottom, rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1)))) 100%
    );
    box-shadow: var(--ui-surface-glow-inset, inset 0 0 9px rgba(40,100,200,0.18));
  }
  .sf-check:hover .sf-check-box,
  .sf-check-input:focus-visible + .sf-check-box {
    box-shadow: var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35)), var(--ui-surface-glow-inset, inset 0 0 9px rgba(40,100,200,0.22));
    outline: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    outline-offset: 1px;
  }
  .sf-check-input:checked + .sf-check-box {
    /* Keep the same look as unchecked (no theme fill), only add a white checkmark */
    background: linear-gradient(180deg,
      var(--ui-surface-bg-top, rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1)))) 0%,
      var(--ui-surface-bg-bottom, rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1)))) 100%
    );
    border-color: var(--ui-surface-border, rgba(120,170,255,0.70));
    box-shadow: var(--ui-surface-glow-inset, inset 0 0 9px rgba(40,100,200,0.18));
  }
  .sf-check-input:checked + .sf-check-box::after {
    content: '✓';
    position: absolute; left: 0; top: 0; width: 100%; height: 100%;
    font-weight: 900; font-size: 12px; line-height: 14px; text-align: center;
    color: #fff;
  }
  .sf-check-text { font-size: 12px; line-height: 1.2; }
  `;
  try { if (!st.parentNode) document.head.appendChild(st); } catch (_) {}
}
