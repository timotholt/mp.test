// Centralized UI helpers for Settings tabs
// Minimal, human-readable implementations with no external CSS.
// Each function mirrors usage patterns in tabs and keeps styling inline.

// Create a section wrapper with a title and optional quip/description.
// makeSection(title, desc = '', position = 'afterTitle', rightAlign = false, underline = true)
// Returns a container element callers can append content to.
export function makeSection(title, desc = '', position = 'afterTitle', rightAlign = false, underline = true) {
  const sec = document.createElement('div');
  sec.className = 'sf-sec';
  sec.style.display = 'block';
  sec.style.margin = '0.5rem 0 0.75rem 0';

  const header = document.createElement('div');
  header.className = 'sf-sec-hdr';
  header.style.display = 'flex';
  header.style.alignItems = 'baseline';
  header.style.justifyContent = rightAlign ? 'space-between' : 'flex-start';
  header.style.gap = '0.75rem';

  const h = document.createElement('div');
  h.className = 'sf-sec-title';
  h.textContent = String(title || '');
  h.style.fontWeight = '700';
  h.style.fontSize = 'calc(16px * var(--ui-font-scale, 1))';
  h.style.color = 'var(--ui-fg, #eee)';

  header.appendChild(h);

  if (desc) {
    const q = document.createElement('div');
    q.className = 'sf-sec-quip';
    q.textContent = String(desc);
    q.style.opacity = '0.8';
    q.style.fontSize = '12px';
    q.style.color = 'var(--ui-fg-muted, #ccd)';
    q.style.marginLeft = rightAlign ? 'auto' : '0';
    header.appendChild(q);
  }

  // Title/quip goes first; optional underline below; rows/control content follow by callers
  sec.appendChild(header);
  if (underline) {
    const hr = document.createElement('div');
    hr.className = 'sf-sec-hr';
    hr.style.borderTop = '1px solid var(--ui-surface-border, rgba(120,170,255,0.30))';
    hr.style.margin = '0.25rem 0 0.5rem 0';
    sec.appendChild(hr);
  }
  return sec;
}

// Create a subtle note block used by tabs for logged-out or tips
export function makeNote(text) {
  const n = document.createElement('div');
  n.className = 'sf-note';
  n.textContent = String(text || '');
  n.style.margin = '0.25rem 0 0.5rem 0';
  n.style.fontSize = '12px';
  n.style.opacity = '0.9';
  n.style.color = 'var(--ui-fg-muted, #ccd)';
  return n;
}

// Panel-style row: label on the left, input on the right
export function makeRow(labelText, inputEl) {
  const row = document.createElement('div');
  row.className = 'sf-row';
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  row.style.margin = '6px 0';

  const lab = document.createElement('label');
  lab.textContent = String(labelText || '');
  lab.style.minWidth = '100px';
  lab.style.color = 'var(--ui-fg, #eee)';
  row.appendChild(lab);

  const cell = document.createElement('div');
  cell.style.flex = '1';
  if (inputEl) cell.appendChild(inputEl);
  row.appendChild(cell);
  return row;
}

// Simple styled input used by panel rows
export function makeInput(type = 'text', value = '') {
  const el = document.createElement('input');
  el.type = type;
  el.value = value != null ? String(value) : '';
  el.style.display = 'inline-block';
  el.style.height = '32px';
  el.style.lineHeight = '32px';
  el.style.background = 'transparent';
  el.style.outline = 'none';
  el.style.color = 'var(--ui-fg, #eee)';
  el.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.60))';
  el.style.borderRadius = '8px';
  el.style.padding = '0 8px';
  el.style.flex = '1';
  el.style.width = '100%';
  return el;
}

// Overlay input row scaffold used by Profile tab
export function createInputRow({ dataName } = {}) {
  const row = document.createElement('div');
  row.className = 'sf-input-row';
  if (dataName) try { row.dataset.name = String(dataName); } catch (_) {}
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  row.style.marginBottom = '8px';
  return row;
}

// Focus highlight behavior used by overlay inputs
export function wireFocusHighlight(inputEl, wrapEl) {
  if (!inputEl) return;
  const target = wrapEl || inputEl;
  const on = () => {
    try {
      target.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.30))';
      if (target !== inputEl) target.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    } catch (_) {}
  };
  const off = () => {
    try {
      target.style.boxShadow = 'none';
      if (target !== inputEl) target.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.30))';
    } catch (_) {}
  };
  try { inputEl.addEventListener('focus', on); inputEl.addEventListener('blur', off); } catch (_) {}
}

// Mouse wheel adjust for range inputs; respects step/min/max
export function attachWheel(rangeEl) {
  if (!rangeEl) return;
  const onWheel = (e) => {
    try {
      e.preventDefault();
      const stepAttr = parseFloat(rangeEl.step);
      const step = Number.isFinite(stepAttr) && stepAttr > 0 ? stepAttr : 1;
      const min = Number.isFinite(parseFloat(rangeEl.min)) ? parseFloat(rangeEl.min) : -Infinity;
      const max = Number.isFinite(parseFloat(rangeEl.max)) ? parseFloat(rangeEl.max) : Infinity;
      const cur = Number.isFinite(parseFloat(rangeEl.value)) ? parseFloat(rangeEl.value) : 0;
      const dir = (e.deltaY || 0) > 0 ? -1 : 1;
      let nxt = cur + dir * step;
      if (nxt < min) nxt = min;
      if (nxt > max) nxt = max;
      if (nxt !== cur) {
        rangeEl.value = String(nxt);
        // Emit input event to trigger listeners
        rangeEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (_) {}
  };
  try { rangeEl.addEventListener('wheel', onWheel, { passive: false }); } catch (_) {}
}

// Hover/focus feedback for paired slider + label
export function attachHover(rangeEl, labelEl) {
  const target = labelEl || rangeEl;
  if (!target) return;
  const on = () => { try { target.style.filter = 'drop-shadow(0 0 6px rgba(120,170,255,0.25))'; } catch (_) {} };
  const off = () => { try { target.style.filter = 'none'; } catch (_) {} };
  try {
    rangeEl && rangeEl.addEventListener('mouseenter', on);
    rangeEl && rangeEl.addEventListener('mouseleave', off);
    rangeEl && rangeEl.addEventListener('focus', on);
    rangeEl && rangeEl.addEventListener('blur', off);
    if (labelEl && labelEl !== rangeEl) {
      labelEl.addEventListener('mouseenter', on);
      labelEl.addEventListener('mouseleave', off);
      labelEl.addEventListener('focus', on);
      labelEl.addEventListener('blur', off);
    }
  } catch (_) {}
}
