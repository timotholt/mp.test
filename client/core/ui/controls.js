// Shared UI helpers for input rows and left-icon inputs
// Keep styles in one place so Games/Players panels and Chat stay consistent.

export const UI = {
  border: 'var(--ui-surface-border-css)',
  rowMinHeight: '2.875rem',
  iconSize: 32,
  leftGap: '0.5rem',
  insetShadow: 'inset 0 0 0.75rem rgba(40,100,200,0.10)',
};

// Create a bottom input row with consistent glass/border look
export function createInputRow({ dataName } = {}) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '0.5rem';
  row.style.minHeight = UI.rowMinHeight;
  row.style.borderBottom = UI.border;
  row.style.borderLeft = UI.border;
  row.style.borderRight = UI.border;
  row.style.borderRadius = '0 0 0.375rem 0.375rem';
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
  input.style.height = '2.5rem';
  input.style.lineHeight = '2.5rem';
  input.style.background = 'transparent';
  input.style.outline = 'none';
  input.style.color = 'var(--sf-tip-fg, #fff)';
  input.style.border = '0';
  input.style.borderRadius = '0.5rem';
  input.style.padding = `0 0.625rem 0 calc(${(UI.iconSize/16)}rem + ${UI.leftGap})`;
  input.style.boxShadow = UI.insetShadow;
  input.style.flex = '1';
  input.style.width = '100%';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.position = 'absolute';
  btn.style.left = '0';
  btn.style.top = '50%';
  btn.style.transform = 'translateY(-50%)';
  btn.style.width = `${(UI.iconSize/16)}rem`;
  btn.style.height = `${(UI.iconSize/16)}rem`;
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.background = 'transparent';
  btn.style.border = UI.border;
  btn.style.borderRadius = '0.5rem';
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
      rowEl.style.boxShadow = [prev, 'inset 0 0 0 0.0625rem var(--ui-bright-border, var(--ui-bright, #fff))'].filter(Boolean).join(', ');
      rowEl.style.borderColor = 'var(--ui-bright-border, var(--ui-surface-border, rgba(120,170,255,0.70)))';
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
  el.style.gap = '0.375rem';
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
      // Do not add static margin when empty; count text from callers begins with a space
      // (e.g., " (3)") so titles remain visually centered without phantom right padding.
      cnt.style.marginLeft = '0';
      b.appendChild(lab);
      b.appendChild(cnt);
      // Expose the tab key for callers that want to update labels (e.g., counts)
      try { b.setAttribute('data-tab-key', String(key)); } catch (_) {}
      try { b.setAttribute('role', 'tab'); } catch (_) {}
      b.style.padding = '0.375rem 0.625rem';
      b.style.border = UI.border;
      b.style.borderBottom = '0';
      b.style.borderRadius = '0';
      b.style.borderTopLeftRadius = '0.375rem';
      b.style.borderTopRightRadius = '0.375rem';
      // Center the tab label content
      b.style.display = 'inline-flex';
      b.style.alignItems = 'center';
      b.style.justifyContent = 'center';
      b.style.textAlign = 'center';
      const isActive = (key === activeKey);

      // This controls the background color of the active tab
      b.style.background = isActive
        ? 'var(--ui-surface-border, rgba(190,230,255,0.98))'
        : 'rgba(255,255,255,0.06)';
      // Unify text color so inactive tabs match active tab text color
      b.style.color = 'var(--ui-fg-quip)';
      b.style.textShadow = isActive ? 'var(--sf-tip-text-glow, 0 0 0.375rem rgba(140,190,255,0.75))' : '';
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
export function createDropdown({ items = [], value = null, onChange, width = '13.75rem', placeholder = 'Select' } = {}) {
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
  btn.style.gap = '0.5rem';
  btn.style.padding = '0.375rem 0.625rem';
  btn.style.width = '100%';
  btn.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
  btn.style.color = 'var(--ui-fg, #eee)';
  btn.style.border = 'var(--ui-surface-border-css)';
  btn.style.borderRadius = 'var(--ui-card-radius)';
  btn.style.cursor = 'pointer';
  // Scale text with UI font size and show glow only on hover/focus (button parity)
  btn.style.fontSize = 'var(--ui-fontsize-small)';
  // Avoid text selection when dragging over the closed dropdown label/caret
  btn.style.userSelect = 'none';
  btn.style.boxShadow = 'none';
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

  // Apply high-tech button chrome with scaled halo, then re-assert dropdown layout needs
  try {
    wireButtonChrome(btn);
    // Dropdown trigger uses full width and space-between to hold label and caret
    btn.style.width = '100%';
    btn.style.justifyContent = 'space-between';
    btn.style.padding = '0.375rem 0.625rem';
    btn.style.gap = '0.5rem';
  } catch (_) {}

  const menu = document.createElement('div');
  menu.style.position = 'absolute';
  menu.style.left = '0';
  menu.style.top = 'calc(100% + 0.25rem)';
  menu.style.zIndex = '100000';
  menu.style.minWidth = '100%';
  menu.style.maxHeight = '15rem';
  menu.style.overflowY = 'auto';
  menu.style.display = 'none';
  // Darken while keeping theme tint: stack a neutral overlay above the theme-
  // tinted tooltip gradient. Use multiply blending so the tint stays visible.
  // Overlay respects --ui-opacity-mult (Transparency control). Bumped ~15-20% darker.
  menu.style.background = 'linear-gradient(180deg, rgba(12,12,12, calc(0.32 * var(--ui-opacity-mult, 1))) 0%, rgba(10,10,10, calc(0.28 * var(--ui-opacity-mult, 1))) 100%), linear-gradient(180deg, var(--sf-tip-bg-top), var(--sf-tip-bg-bottom))';
  menu.style.backgroundBlendMode = 'multiply, normal';
  menu.style.color = 'var(--ui-fg, #eee)';
  menu.style.fontSize = 'var(--ui-fontsize-small)';
  menu.style.border = 'var(--ui-surface-border-css)';
  menu.style.borderRadius = 'var(--ui-card-radius)';
  menu.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 1rem rgba(120,170,255,0.35))';
  // Apply theme-controlled backdrop blur for readability over busy backgrounds
  try {
    // Match tooltip semantics: prefer --sf-tip-backdrop; fallback to blur(var(--ui-backdrop-blur))
    const bf = 'var(--sf-tip-backdrop, blur(var(--ui-backdrop-blur, 0.25rem)) saturate(1.2))';
    menu.style.backdropFilter = bf;
    // Safari/WebKit prefix
    menu.style.webkitBackdropFilter = bf;
  } catch (_) {}
  try { menu.classList.add('ui-glass-scrollbar'); } catch (_) {}
  try { menu.setAttribute('role', 'listbox'); menu.tabIndex = -1; } catch (_) {}

  const list = document.createElement('div');
  list.style.padding = '0.25rem 0';
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
      row.style.padding = '0.5rem 0.625rem';
      row.style.fontSize = 'var(--ui-fontsize-small)';
      row.style.cursor = 'pointer';
      row.style.userSelect = 'none';
      const isSel = (it.value === _value);
      // Use UI foreground for all rows and the preferred active-tab background for selection
      row.style.color = 'var(--ui-fg)';
      row.style.background = isSel ? 'var(--ui-surface-border, rgba(190,230,255,0.98))' : 'transparent';
      try { row.setAttribute('role', 'option'); row.setAttribute('aria-selected', isSel ? 'true' : 'false'); row.id = `dd-opt-${idx}`; } catch (_) {}
      // Hover highlight matches the active-tab background to keep parity with tab visuals
      row.onmouseenter = () => { row.style.background = 'var(--ui-surface-border, rgba(190,230,255,0.98))'; };
      row.onmouseleave = () => { row.style.background = (it.value === _value) ? 'var(--ui-surface-border, rgba(190,230,255,0.98))' : 'transparent'; };
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

  // Scaled halo on the menu container as well (hover/focus)
  try { applyRectHalo(menu); } catch (_) {}

  // Button chrome/halo handled by wireButtonChrome(); no extra hover handlers needed here.

  // Menu hover/focus: use brightBorder on the menu container while hovered or focused
  try {
    let _menuHover = false;
    let _menuFocus = false;
    const applyMenuBorder = () => {
      if (_menuHover || _menuFocus) {
        menu.style.border = '0.0625rem solid var(--ui-bright-border, var(--ui-surface-border))';
      } else {
        menu.style.border = 'var(--ui-surface-border-css)';
      }
    };
    menu.addEventListener('mouseenter', () => { _menuHover = true; applyMenuBorder(); });
    menu.addEventListener('mouseleave', () => { _menuHover = false; applyMenuBorder(); });
    menu.addEventListener('focus', () => { _menuFocus = true; applyMenuBorder(); });
    menu.addEventListener('blur', () => { _menuFocus = false; applyMenuBorder(); });
  } catch (_) {}

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
  .sf-check { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--ui-fg, #eee); }
  .sf-check-input { position: absolute; opacity: 0; width: 0.0625rem; height: 0.0625rem; }
  .sf-check-box {
    position: relative; width: 0.875rem; height: 0.875rem; flex: 0 0 0.875rem; display: inline-block;
    border-radius: 0.1875rem;
    border: 0.0625rem solid var(--ui-surface-border, rgba(120,170,255,0.70));
    background: linear-gradient(180deg,
      var(--ui-surface-bg-top, rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1)))) 0%,
      var(--ui-surface-bg-bottom, rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1)))) 100%
    );
    box-shadow: var(--ui-surface-glow-inset, inset 0 0 0.5625rem rgba(40,100,200,0.18));
  }
  .sf-check:hover .sf-check-box,
  .sf-check-input:focus-visible + .sf-check-box {
    box-shadow: var(--ui-surface-glow-outer, 0 0 0.625rem rgba(120,170,255,0.35)), var(--ui-surface-glow-inset, inset 0 0 0.5625rem rgba(40,100,200,0.22));
    border-color: var(--ui-bright-border, var(--ui-surface-border, rgba(120,170,255,0.70)));
    outline: none;
  }
  .sf-check-input:checked + .sf-check-box {
    /* Keep the same look as unchecked (no theme fill), only add a white checkmark */
    background: linear-gradient(180deg,
      var(--ui-surface-bg-top, rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1)))) 0%,
      var(--ui-surface-bg-bottom, rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1)))) 100%
    );
    border-color: var(--ui-surface-border, rgba(120,170,255,0.70));
    box-shadow: var(--ui-surface-glow-inset, inset 0 0 0.5625rem rgba(40,100,200,0.18));
  }
  .sf-check-input:checked + .sf-check-box::after {
    content: '✓';
    position: absolute; left: 0; top: 0; width: 100%; height: 100%;
    font-weight: 900; font-size: 0.75rem; line-height: 0.875rem; text-align: center;
    color: #fff;
  }
  /* Scale checkbox label text with UI font size template */
  .sf-check-text { font-size: var(--ui-fontsize-small); line-height: 1.2; }
  `;
  try { if (!st.parentNode) document.head.appendChild(st); } catch (_) {}
}

// ------------------------------
// Basic high-tech button chrome (JS-only, knob parity)
// ------------------------------
// Reuses the same glow scaling approach as knob halos: at Glow=0 -> no halo,
// smooth ramp-in with a subtle maximum. No CSS/HTML changes required.

function readGlowStrength() {
  try {
    const n = parseFloat(localStorage.getItem('ui_glow_strength'));
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  } catch (_) {}
  return 60; // sensible default matching prior visual tuning
}

function computeRectHalo() {
  // Smoothstep easing for gentle low-end ramp; returns CSS filter string.
  const s = Math.max(0, Math.min(1, readGlowStrength() / 100));
  if (s <= 0) return '';
  const t = s * s * (3 - 2 * s);
  const rSmall = (0.27 * t).toFixed(3);
  const rLarge = (0.67 * t).toFixed(3);
  return `drop-shadow(0 0 ${rSmall}rem var(--ui-bright-border)) drop-shadow(0 0 ${rLarge}rem var(--ui-bright-border))`;
}

export function applyRectHalo(el) {
  if (!el) return;
  const on = () => { try { el.style.filter = computeRectHalo(); } catch (_) {} };
  const off = () => { try { el.style.filter = ''; } catch (_) {} };
  try {
    el.addEventListener('mouseenter', on);
    el.addEventListener('mouseleave', off);
    el.addEventListener('focus', on);
    el.addEventListener('blur', off);
  } catch (_) {}
}

export function wireButtonChrome(btn, { minWidth = '', variant = 'default' } = {}) {
  if (!btn) return btn;
  // Base glass surface with gentle vignette and diagonal specular sheen
  // Right-lit: darker on the LEFT, brighter on the RIGHT
  const bgGlass = 'linear-gradient(90deg, var(--ui-surface-bg-left, var(--ui-surface-bg-bottom, rgba(10,16,22,0.40))) 0%, var(--ui-surface-bg-right, var(--ui-surface-bg-top, rgba(10,18,26,0.41))) 100%)';
  // Subtle vignette biased to the right to enhance the light direction
  const bgVignette = 'radial-gradient(140% 120% at 100% 50%, rgba(255,255,255,0.06) 0%, transparent 55%)';
  // Stronger specular sheen along the right edge
  const bgSheen = 'linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.16) 78%, transparent 100%)';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.gap = '0.5rem';
  btn.style.padding = '0.5rem 0.75rem';
  if (minWidth) btn.style.minWidth = minWidth;
  btn.style.background = `${bgSheen}, ${bgVignette}, ${bgGlass}`;
  btn.style.color = 'var(--ui-fg, #eee)';
  // Match app-wide themed text glow
  btn.style.textShadow = 'var(--ui-text-glow, var(--sf-tip-text-glow, none))';
  btn.style.border = 'var(--ui-surface-border-css)';
  btn.style.borderRadius = 'var(--ui-card-radius)';
  btn.style.userSelect = 'none';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = 'var(--ui-fontsize-small)';
  btn.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 0.5625rem rgba(40,100,200,0.18))';
  btn.style.outline = 'none';

  // Hover/focus: bright rim and scaled halo (no double outline)
  const hoverOn = () => {
    try {
      btn.style.border = '0.0625rem solid var(--ui-bright-border, var(--ui-surface-border))';
      btn.style.boxShadow = [
        'var(--ui-surface-glow-inset, inset 0 0 0.5625rem rgba(40,100,200,0.22))'
      ].join(', ');
      btn.style.filter = computeRectHalo();
    } catch (_) {}
  };
  const hoverOff = () => {
    try {
      btn.style.border = 'var(--ui-surface-border-css)';
      btn.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 0.5625rem rgba(40,100,200,0.18))';
      btn.style.filter = '';
    } catch (_) {}
  };
  try {
    btn.addEventListener('mouseenter', hoverOn);
    btn.addEventListener('mouseleave', hoverOff);
    btn.addEventListener('focus', hoverOn);
    btn.addEventListener('blur', hoverOff);
  } catch (_) {}

  // Pressed: slightly deeper inset and tiny depress
  const pressOn = () => {
    try {
      btn.style.transform = 'translateY(0.03125rem)';
      btn.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 0.75rem rgba(40,100,200,0.24))';
    } catch (_) {}
  };
  const pressOff = () => {
    try {
      btn.style.transform = 'none';
      // Keep current hover state if still hovered/focused
      // We won't touch border/filter here to avoid flicker.
    } catch (_) {}
  };
  try {
    btn.addEventListener('mousedown', pressOn);
    window.addEventListener('mouseup', pressOff, { passive: true });
    btn.addEventListener('keydown', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') pressOn(); });
    btn.addEventListener('keyup', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') pressOff(); });
  } catch (_) {}

  // Also expose the halo behavior as a reusable helper when needed
  try { applyRectHalo(btn); } catch (_) {}
  return btn;
}

// Create a ready-to-use button with the chrome applied.
export function createButton({ label = 'Button', onClick, minWidth = '' } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  wireButtonChrome(btn, { minWidth });
  if (typeof onClick === 'function') btn.onclick = onClick;
  return { el: btn, button: btn, setLabel: (t) => { try { btn.textContent = String(t); } catch (_) {} } };
}

// Rectangular button that visually matches the glossy black knob look
export function wireKnobButtonChrome(btn, { minWidth = '' } = {}) {
  if (!btn) return btn;
  // Right-lit glossy black, borrowing the knob lighting model
  const bg = 'linear-gradient(90deg, var(--knbtn-left, var(--ui-knob-bg-bottom, #0f0f0f)) 0%, var(--knbtn-right, var(--ui-knob-bg-top, #1f1f1f)) 100%)';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.gap = '0.5rem';
  btn.style.padding = '0.5rem 0.9rem';
  if (minWidth) btn.style.minWidth = minWidth;
  btn.style.background = bg;
  btn.style.color = 'var(--ui-fg, #eee)';
  // Match app-wide themed text glow
  btn.style.textShadow = 'var(--ui-text-glow, var(--sf-tip-text-glow, none))';
  // Use a themed 1px border matching the brighter overlay to avoid a seam between outer and inset rings
  btn.style.border = '0.0625rem solid color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 85%, white 15%)';
  btn.style.borderRadius = 'var(--ui-card-radius)';
  btn.style.userSelect = 'none';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = 'var(--ui-fontsize-small)';
  btn.style.position = 'relative';
  // Base highlights/shadows emulate `.knob` from knob.js (right side lit)
  btn.style.boxShadow = [
    '0.125rem -0.125rem 0.1875rem rgba(255,255,255,0.28)',
    '-0.125rem 0.125rem 0.4375rem rgba(0,0,0,1.0)',
    'inset 0.125rem -0.125rem 0.125rem rgba(255,255,255,0.16)',
    'inset -0.125rem 0.125rem 0.1875rem rgba(0,0,0,0.44)'
  ].join(', ');
  btn.style.outline = 'none';

  const hoverOn = () => {
    try {
      btn.style.border = '0.0625rem solid var(--ui-bright-border, var(--ui-surface-border))';
      btn.style.boxShadow = [
        '0.125rem -0.125rem 0.1875rem rgba(255,255,255,0.34)',
        '-0.125rem 0.125rem 0.5rem rgba(0,0,0,1.0)',
        'inset 0.125rem -0.125rem 0.125rem rgba(255,255,255,0.20)',
        'inset -0.125rem 0.125rem 0.1875rem rgba(0,0,0,0.52)'
      ].join(', ');
      btn.style.background = bgHover;
      // Brighten any inline knob-LEDs inside the button
      const leds = btn.querySelectorAll('[data-knob-led="1"]');
      leds.forEach((led) => {
        led.style.background = 'var(--kn-seg-on-bright, var(--ui-bright, #dff1ff))';
        const inset = 'inset 0.0625rem -0.0625rem 0.125rem rgba(255,255,255,0.35), inset -0.0625rem 0.0625rem 0.125rem rgba(0,0,0,0.70)';
        led.style.boxShadow = inset + ', var(--kn-seg-glow-strong, var(--ui-glow-strong, 0 0 0.875rem rgba(120,170,255,0.95)))';
      });
    } catch (_) {}
  };
  const hoverOff = () => {
    try {
      btn.style.border = '0.0625rem solid transparent';
      btn.style.boxShadow = [
        '0.125rem -0.125rem 0.1875rem rgba(255,255,255,0.28)',
        '-0.125rem 0.125rem 0.4375rem rgba(0,0,0,1.0)',
        'inset 0.125rem -0.125rem 0.125rem rgba(255,255,255,0.16)',
        'inset -0.125rem 0.125rem 0.1875rem rgba(0,0,0,0.44)'
      ].join(', ');
      btn.style.background = bgNormal;
      // Restore LED normal glow/colors
      const leds = btn.querySelectorAll('[data-knob-led="1"]');
      leds.forEach((led) => {
        led.style.background = 'var(--kn-seg-on, var(--ui-accent, #9fd0ff))';
        const inset = 'inset 0.0625rem -0.0625rem 0.125rem rgba(255,255,255,0.35), inset -0.0625rem 0.0625rem 0.125rem rgba(0,0,0,0.70)';
        led.style.boxShadow = inset + ', var(--kn-seg-glow, var(--ui-surface-glow-outer, 0 0 0.375rem rgba(120,170,255,0.9)))';
      });
    } catch (_) {}
  };
  try {
    btn.addEventListener('mouseenter', hoverOn);
    btn.addEventListener('mouseleave', hoverOff);
  } catch (_) {}

  const pressOn = () => {
    try {
      btn.style.transform = 'translateY(0.03125rem)';
      // sync border color to pressed overlay
      btn.style.borderColor = 'color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 84%, white 16%)';
      btn.style.boxShadow = [
        '0.125rem -0.125rem 0.1875rem rgba(255,255,255,0.30)',
        '-0.125rem 0.125rem 0.5625rem rgba(0,0,0,1.0)',
        'inset 0.125rem -0.125rem 0.1875rem rgba(255,255,255,0.22)',
        'inset -0.125rem 0.125rem 0.25rem rgba(0,0,0,0.56)'
      ].join(', ');
    } catch (_) {}
  };
  const pressOff = () => { try { btn.style.transform = 'none'; btn.style.borderColor = 'color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 85%, white 15%)'; } catch (_) {} };
  try {
    btn.addEventListener('mousedown', pressOn);
    window.addEventListener('mouseup', pressOff, { passive: true });
    btn.addEventListener('keydown', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') pressOn(); });
    btn.addEventListener('keyup', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') pressOff(); });
  } catch (_) {}

  // Also wire halo for consistency
  try { applyRectHalo(btn); } catch (_) {}
  return btn;
}

export function createKnobButton({ label = 'Knob Button', onClick, minWidth = '' } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '';
  wireKnobButtonChrome(btn, { minWidth });
  // Add a subtle white specular dot BEFORE the label to reinforce 3D cue
  let lab = null;
  try {
    const dot = document.createElement('span');
    dot.setAttribute('aria-hidden', 'true');
    dot.style.display = 'inline-block';
    dot.style.width = '6px';
    dot.style.height = '6px';
    dot.style.borderRadius = '50%';
    dot.style.pointerEvents = 'none';
    dot.style.background = 'radial-gradient(circle at 45% 45%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.75) 45%, rgba(255,255,255,0.15) 75%, rgba(255,255,255,0) 100%)';
    dot.style.boxShadow = '0 0 8px rgba(255,255,255,0.25)';
    btn.appendChild(dot);
    lab = document.createElement('span');
    lab.textContent = label;
    btn.appendChild(lab);
    // Add 3 vertical LEDs to the right of the label (match knob LED colors/glow)
    const col = document.createElement('span');
    col.style.display = 'inline-flex';
    col.style.flexDirection = 'column';
    col.style.gap = '6px';
    col.style.marginLeft = '0.5rem';
    col.style.alignSelf = 'center';
    const makeLed = () => {
      const led = document.createElement('span');
      led.setAttribute('aria-hidden', 'true');
      led.setAttribute('data-knob-led', '1');
      led.style.display = 'inline-block';
      led.style.width = '8px';
      led.style.height = '8px';
      led.style.borderRadius = '50%';
      // Inset 3D look + theme glow matching knob segments
      led.style.background = 'var(--kn-seg-on, var(--ui-accent, #9fd0ff))';
      led.style.boxShadow = 'inset 1px -1px 2px rgba(255,255,255,0.35), inset -1px 1px 2px rgba(0,0,0,0.70), var(--kn-seg-glow, var(--ui-surface-glow-outer, 0 0 6px rgba(120,170,255,0.9)))';
      led.style.border = '1px solid rgba(255,255,255,0.10)';
      led.style.opacity = '0.95';
      return led;
    };
    col.appendChild(makeLed());
    col.appendChild(makeLed());
    col.appendChild(makeLed());
    btn.appendChild(col);
  } catch (_) { /* fallback below */ }
  // Fallback if dot/label creation failed
  if (!lab) { try { btn.textContent = label; } catch (_) {} }
  if (typeof onClick === 'function') btn.onclick = onClick;
  return { el: btn, button: btn, setLabel: (t) => { try { if (lab) lab.textContent = String(t); else btn.textContent = String(t); } catch (_) {} } };
}

// -------------------------------------------------
// Neon Outline Button (JS-only; pill outline + glow)
// -------------------------------------------------
export function wireNeonButtonChrome(btn, { minWidth = '', color = 'var(--ui-accent, #9fd0ff)' } = {}) {
  if (!btn) return btn;
  // Theme-driven: use CSS vars for glow strength/size; fall back to reasonable blue hues

  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.padding = '0.95rem 2.75rem';
  btn.style.gap = '0.5rem';
  if (minWidth) btn.style.minWidth = minWidth;
  btn.style.border = '1px solid transparent';
  btn.style.borderRadius = '9999px';
  // Keep a subtle neutral specular highlight; avoid hardcoded hue tints
  // Editable gradient band settings (dark-left -> center glow -> dark-right)
  // Tweak these in-place when you want to change the look
  const bandLeftShade = 'rgba(0,0,0,0.55)';
  const bandRightShade = 'rgba(0,0,0,0.55)';
  const bandGlowHue = `var(--ui-bright-border, ${color || '#9fd0ff'})`;
  const bandGlowMix = 20; // percent of hue in the band glow (0-100)
  const bandStart = 5;   // where the glow ramp-in begins (percent)
  const bandPeak = 50;    // where the glow peaks (percent)
  const bandEnd = 95;     // where the glow ramp-out ends (percent)
  const band = `linear-gradient(90deg,
    ${bandLeftShade} 0%,
    ${bandLeftShade} ${bandStart}%,
    color-mix(in srgb, ${bandGlowHue} ${bandGlowMix}%, transparent) ${bandPeak}%,
    ${bandRightShade} ${bandEnd}%,
    ${bandRightShade} 100%
  )`;
  btn.style.background = [
    band,
    'radial-gradient(120% 200% at 50% -40%, rgba(255,255,255,0.06), rgba(255,255,255,0))'
  ].join(', ');
  // Text at 0.8 opacity while staying theme-aware
  btn.style.color = 'color-mix(in srgb, var(--ui-fg, #eee) 80%, transparent)';
  btn.style.textTransform = 'uppercase';
  btn.style.letterSpacing = 'var(--ui-letter-spacing, 0rem)';
  btn.style.fontWeight = '800';
  btn.style.fontSize = 'var(--ui-fontsize-small)';
  // Match app-wide themed text glow
  btn.style.textShadow = 'var(--ui-text-glow, var(--sf-tip-text-glow, none))';
  btn.style.userSelect = 'none';
  btn.style.cursor = 'pointer';
  btn.style.position = 'relative';
  btn.style.outline = 'none';
  try { btn.style.backdropFilter = 'saturate(120%) blur(0.025rem)'; } catch (_) {}

  const baseRings = [
    // 2px brighter oval overlay exactly matching the outer ring size (fully opaque)
    '0 0 0 0.0625rem color-mix(in srgb, var(--ui-border, var(--ui-accent, #9fd0ff)) 35%, white 15%)',
    // Outer color ring (2px) — match overlay color to avoid any seam
    // '0 0 0 2px color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 85%, white 15%)',
    // Inner 1px highlight
    // 'inset 0 0 0 1px color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 85%, white 15%)',
    // 3px darker inner shade
    // 'inset 0 0 0 3px rgba(0,0,0,0.18)',
    // Theme glows
    'var(--ui-surface-glow-outer, 0 0 1.125rem rgba(120,170,255,0.40), 0 0 0.5625rem rgba(120,170,255,0.55))',
    'var(--ui-surface-glow-inset, inset 0 0 0.625rem rgba(120,170,255,0.25))'
  ].join(', ');
  btn.style.boxShadow = baseRings;

  const hoverOn = () => {
    try {
      // sync border color to hover overlay
      btn.style.borderColor = 'color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 82%, white 18%)';
      btn.style.boxShadow = [
        // 2px brighter oval overlay (hover: stronger; fully opaque)
        '0 0 0 0.125rem color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 82%, white 18%)',
        // Match base ring to overlay color to ensure perfect coverage
        '0 0 0 0.125rem color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 82%, white 18%)',
        // Inner 1px highlight (slightly stronger mix on hover)
        'inset 0 0 0 0.0625rem color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 82%, white 18%)',
        // 3px darker inner shade (a bit lighter on hover)
        'inset 0 0 0 0.1875rem rgba(0,0,0,0.16)',
        'var(--ui-glow-strong, 0 0 2.25rem rgba(120,170,255,0.72), 0 0 0.625rem rgba(120,170,255,0.98))',
        'var(--ui-surface-glow-outer, 0 0 1.125rem rgba(120,170,255,0.40))',
        'var(--ui-surface-glow-inset, inset 0 0 0.75rem rgba(120,170,255,0.30))'
      ].join(', ');
      btn.style.textShadow = 'var(--ui-text-glow, var(--sf-tip-text-glow, none))';
    } catch (_) {}
  };
  const hoverOff = () => {
    try {
      btn.style.boxShadow = baseRings;
      // restore base border color
      btn.style.borderColor = 'color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 85%, white 15%)';
      btn.style.textShadow = 'var(--ui-text-glow, var(--sf-tip-text-glow, none))';
    } catch (_) {}
  };
  try {
    btn.addEventListener('mouseenter', hoverOn);
    btn.addEventListener('mouseleave', hoverOff);
    btn.addEventListener('focus', hoverOn);
    btn.addEventListener('blur', hoverOff);
  } catch (_) {}

  const pressOn = () => {
    try {
      btn.style.transform = 'translateY(0.03125rem)';
      btn.style.boxShadow = [
        // 2px brighter oval overlay (pressed: between base and hover; fully opaque)
        '0 0 0 0.125rem color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 84%, white 16%)',
        // Match base ring to overlay color to ensure perfect coverage
        '0 0 0 0.125rem color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 84%, white 16%)',
        'inset 0 0 0 0.0625rem color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 84%, white 16%)',
        // 3px darker inner shade (slightly stronger on press)
        'inset 0 0 0 0.1875rem rgba(0,0,0,0.20)',
        'var(--ui-surface-glow-inset, inset 0 0 0.875rem rgba(120,170,255,0.32))',
        'var(--ui-surface-glow-outer, 0 0 0.75rem rgba(120,170,255,0.30))'
      ].join(', ');
    } catch (_) {}
  };
  const pressOff = () => { try { btn.style.transform = 'none'; } catch (_) {} };
  try {
    btn.addEventListener('mousedown', pressOn);
    window.addEventListener('mouseup', pressOff, { passive: true });
    btn.addEventListener('keydown', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') pressOn(); });
    btn.addEventListener('keyup',   (ev) => { if (ev.key === ' ' || ev.key === 'Enter') pressOff(); });
  } catch (_) {}

  try { applyRectHalo(btn); } catch (_) {}
  return btn;
}

export function createNeonButton({ label = 'Subscribe', onClick, minWidth = '', color } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  try { btn.textContent = String(label).toUpperCase(); } catch (_) { btn.textContent = 'SUBSCRIBE'; }
  wireNeonButtonChrome(btn, { minWidth, color });
  if (typeof onClick === 'function') btn.onclick = onClick;
  return { el: btn, button: btn, setLabel: (t) => { try { btn.textContent = String(t).toUpperCase(); } catch (_) {} } };
}

// -------------------------------------------------------------
// Neon Outline-Text Button (variation of the blue subscribe)
// Reuses wireNeonButtonChrome, then applies transparent fill + stroke
// -------------------------------------------------------------
export function wireNeonButtonChromeOutlineText(btn, { minWidth = '', color } = {}) {
  if (!btn) return btn;
  // First apply the standard neon chrome so visuals stay in sync
  wireNeonButtonChrome(btn, { minWidth, color });

  // Tweakable outline text variables (kept next to the button for quick edits)
  const outlineWidth = '1px';
  const outlineColor = 'color-mix(in srgb, var(--ui-bright-border, var(--ui-accent, #9fd0ff)) 88%, white 12%)';
  const outlineGlow = 'var(--neon-outline-glow, 0 0 8px rgba(120,170,255,0.65))';

  try {
    // Make the fill transparent, keep strong tracking/weight from neon chrome
    btn.style.color = 'transparent';
    // WebKit stroke (Chromium/Safari)
    btn.style.webkitTextStroke = `${outlineWidth} ${outlineColor}`;
    btn.style.webkitTextFillColor = 'transparent';
    // Keep a subtle glow on the outline; hover handlers will still adjust this
    btn.style.textShadow = outlineGlow;
  } catch (_) {}

  // Fallback for browsers lacking text stroke: multi-direction shadow outline
  try {
    const test = document.createElement('span').style;
    if (!('webkitTextStroke' in test)) {
      const s = 1; // px offset per shadow step
      const oc = outlineColor;
      btn.style.textShadow = [
        `${s}px 0 0 ${oc}`,
        `-${s}px 0 0 ${oc}`,
        `0 ${s}px 0 ${oc}`,
        `0 -${s}px 0 ${oc}`,
        `${s}px ${s}px 0 ${oc}`,
        `-${s}px ${s}px 0 ${oc}`,
        `${s}px -${s}px 0 ${oc}`,
        `-${s}px -${s}px 0 ${oc}`
      ].join(', ');
    }
  } catch (_) {}

  return btn;
}

export function createNeonOutlineTextButton({ label = 'Subscribe', onClick, minWidth = '', color } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  try { btn.textContent = String(label).toUpperCase(); } catch (_) { btn.textContent = 'SUBSCRIBE'; }
  wireNeonButtonChromeOutlineText(btn, { minWidth, color });
  if (typeof onClick === 'function') btn.onclick = onClick;
  return { el: btn, button: btn, setLabel: (t) => { try { btn.textContent = String(t).toUpperCase(); } catch (_) {} } };
}

// ---------------------------------------------
// V2: Identical copy of knob button and chrome
// ---------------------------------------------
export function wireKnobButtonChromeV2(btn, { minWidth = '' } = {}) {
  if (!btn) return btn;
  // Glassy-black look: deep translucent blacks with a right-lit blue tint overlay.
  // Normal state background (layered gradients, topmost first)
  const bgNormal = [
    // Right-edge blue tint (fallback rgba to avoid relying on color-mix)
    'linear-gradient(90deg, rgba(120,170,255,0.14) 0%, rgba(120,170,255,0.18) 18%, rgba(120,170,255,0.08) 46%, rgba(120,170,255,0.00) 100%)',
    // Soft vertical specular sweep
    'linear-gradient(0deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.00) 60%)',
    // Base body (translucent black, roughly matching original left/right ends)
    'linear-gradient(90deg, rgba(15,15,15,0.90) 0%, rgba(31,31,31,0.78) 100%)'
  ].join(', ');
  // Hover/focus background: amplify blue tint and specular slightly
  const bgHover = [
    'linear-gradient(90deg, rgba(120,170,255,0.20) 0%, rgba(120,170,255,0.26) 18%, rgba(120,170,255,0.12) 46%, rgba(120,170,255,0.00) 100%)',
    'linear-gradient(0deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.00) 60%)',
    'linear-gradient(90deg, rgba(15,15,15,0.92) 0%, rgba(31,31,31,0.80) 100%)'
  ].join(', ');
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.gap = '0.5rem';
  btn.style.padding = '0.5rem 0.9rem';
  if (minWidth) btn.style.minWidth = minWidth;
  btn.style.background = bgNormal;
  btn.style.color = 'var(--ui-fg, #eee)';
  // Match app-wide themed text glow
  btn.style.textShadow = 'var(--ui-text-glow, var(--sf-tip-text-glow, none))';
  btn.style.border = '1px solid transparent';
  btn.style.borderRadius = 'var(--ui-card-radius)';
  btn.style.userSelect = 'none';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = 'var(--ui-fontsize-small)';
  btn.style.position = 'relative';
  // Subtle glassiness. If unsupported, harmlessly ignored.
  try { btn.style.backdropFilter = 'saturate(120%) blur(0.6px)'; } catch (_) {}
  // Base highlights/shadows emulate `.knob` from knob.js (right side lit)
  btn.style.boxShadow = [
    '2px -2px 3px rgba(255,255,255,0.28)',
    '-2px 2px 7px rgba(0,0,0,1.0)',
    'inset 2px -2px 2px rgba(255,255,255,0.16)',
    'inset -2px 2px 3px rgba(0,0,0,0.44)'
  ].join(', ');
  btn.style.outline = 'none';

  const hoverOn = () => {
    try {
      btn.style.border = '1px solid var(--ui-bright-border, var(--ui-surface-border))';
      btn.style.boxShadow = [
        '2px -2px 3px rgba(255,255,255,0.34)',
        '-2px 2px 8px rgba(0,0,0,1.0)',
        'inset 2px -2px 2px rgba(255,255,255,0.20)',
        'inset -2px 2px 3px rgba(0,0,0,0.52)'
      ].join(', ');
      // Brighten any inline knob-LEDs inside the button
      const leds = btn.querySelectorAll('[data-knob-led="1"]');
      leds.forEach((led) => {
        led.style.background = 'var(--kn-seg-on-bright, var(--ui-bright, #dff1ff))';
        const inset = 'inset 1px -1px 2px rgba(255,255,255,0.35), inset -1px 1px 2px rgba(0,0,0,0.70)';
        led.style.boxShadow = inset + ', var(--kn-seg-glow-strong, var(--ui-glow-strong, 0 0 14px rgba(120,170,255,0.95)))';
      });
    } catch (_) {}
  };
  const hoverOff = () => {
    try {
      btn.style.border = '1px solid transparent';
      btn.style.boxShadow = [
        '2px -2px 3px rgba(255,255,255,0.28)',
        '-2px 2px 7px rgba(0,0,0,1.0)',
        'inset 2px -2px 2px rgba(255,255,255,0.16)',
        'inset -2px 2px 3px rgba(0,0,0,0.44)'
      ].join(', ');
      // Restore LED normal glow/colors
      const leds = btn.querySelectorAll('[data-knob-led="1"]');
      leds.forEach((led) => {
        led.style.background = 'var(--kn-seg-on, var(--ui-accent, #9fd0ff))';
        const inset = 'inset 1px -1px 2px rgba(255,255,255,0.35), inset -1px 1px 2px rgba(0,0,0,0.70)';
        led.style.boxShadow = inset + ', var(--kn-seg-glow, var(--ui-surface-glow-outer, 0 0 6px rgba(120,170,255,0.9)))';
      });
    } catch (_) {}
  };
  try {
    btn.addEventListener('mouseenter', hoverOn);
    btn.addEventListener('mouseleave', hoverOff);
  } catch (_) {}

  const pressOn = () => {
    try {
      btn.style.transform = 'translateY(0.5px)';
      btn.style.boxShadow = [
        '2px -2px 3px rgba(255,255,255,0.30)',
        '-2px 2px 9px rgba(0,0,0,1.0)',
        'inset 2px -2px 3px rgba(255,255,255,0.22)',
        'inset -2px 2px 4px rgba(0,0,0,0.56)'
      ].join(', ');
    } catch (_) {}
  };
  const pressOff = () => { try { btn.style.transform = 'none'; } catch (_) {} };
  try {
    btn.addEventListener('mousedown', pressOn);
    window.addEventListener('mouseup', pressOff, { passive: true });
    btn.addEventListener('keydown', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') pressOn(); });
    btn.addEventListener('keyup', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') pressOff(); });
  } catch (_) {}

  // Also wire halo for consistency
  try { applyRectHalo(btn); } catch (_) {}
  return btn;
}

export function createKnobButtonV2({ label = 'Knob Button', onClick, minWidth = '' } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '';
  wireKnobButtonChromeV2(btn, { minWidth });
  // Add a subtle white specular dot BEFORE the label to reinforce 3D cue
  let lab = null;
  try {
    const dot = document.createElement('span');
    dot.setAttribute('aria-hidden', 'true');
    dot.style.display = 'inline-block';
    dot.style.width = '6px';
    dot.style.height = '6px';
    dot.style.borderRadius = '50%';
    dot.style.pointerEvents = 'none';
    dot.style.background = 'radial-gradient(circle at 45% 45%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.75) 45%, rgba(255,255,255,0.15) 75%, rgba(255,255,255,0) 100%)';
    dot.style.boxShadow = '0 0 8px rgba(255,255,255,0.25)';
    btn.appendChild(dot);
    lab = document.createElement('span');
    lab.textContent = label;
    btn.appendChild(lab);
    // Add 3 vertical LEDs to the right of the label (match knob LED colors/glow)
    const col = document.createElement('span');
    col.style.display = 'inline-flex';
    col.style.flexDirection = 'column';
    col.style.gap = '6px';
    col.style.marginLeft = '0.5rem';
    col.style.alignSelf = 'center';
    const makeLed = () => {
      const led = document.createElement('span');
      led.setAttribute('aria-hidden', 'true');
      led.setAttribute('data-knob-led', '1');
      led.style.display = 'inline-block';
      led.style.width = '8px';
      led.style.height = '8px';
      led.style.borderRadius = '50%';
      // Inset 3D look + theme glow matching knob segments
      led.style.background = 'var(--kn-seg-on, var(--ui-accent, #9fd0ff))';
      led.style.boxShadow = 'inset 1px -1px 2px rgba(255,255,255,0.35), inset -1px 1px 2px rgba(0,0,0,0.70), var(--kn-seg-glow, var(--ui-surface-glow-outer, 0 0 6px rgba(120,170,255,0.9)))';
      led.style.border = '1px solid rgba(255,255,255,0.10)';
      led.style.opacity = '0.95';
      return led;
    };
    col.appendChild(makeLed());
    col.appendChild(makeLed());
    col.appendChild(makeLed());
    btn.appendChild(col);
  } catch (_) { /* fallback below */ }
  // Fallback if dot/label creation failed
  if (!lab) { try { btn.textContent = label; } catch (_) {} }
  if (typeof onClick === 'function') btn.onclick = onClick;
  return { el: btn, button: btn, setLabel: (t) => { try { if (lab) lab.textContent = String(t); else btn.textContent = String(t); } catch (_) {} } };
}
