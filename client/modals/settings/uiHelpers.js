// Centralized UI helpers for Settings tabs
// Minimal, human-readable implementations with no external CSS.
// Each function mirrors usage patterns in tabs and keeps styling inline.
import { createUiElement, basicSection, basicSectionHeader, basicSectionRule, basicSubtitle, basicQuipSubtitle, basicNote, basicPanelRow, basicPanelLabel, basicPanelCell, basicTextInput, basicInputRow } from '../../core/ui/theme/elements.js';

// Create a section wrapper with a title and optional quip/description.
// makeSection(title, desc = '', position = 'afterTitle', rightAlign = false, underline = true)
// Returns a container element callers can append content to.
export function makeSection(title, desc = '', position = 'afterTitle', rightAlign = false, underline = true) {
  // 1) Create all elements first
  const sec = createUiElement(basicSection);
  const header = createUiElement([
    basicSectionHeader,
    { justifyContent: rightAlign ? 'space-between' : 'flex-start' }
  ]);
  const h = createUiElement(basicSubtitle, String(title || ''));
  const q = desc ? createUiElement(basicQuipSubtitle, String(desc)) : null;
  const hr = underline ? createUiElement(basicSectionRule) : null;

  // 2) Apply classes/styles (in one place for easy removal/commenting)
  try {
    sec.className = 'sf-sec';
    header.className = 'sf-sec-hdr';
    h.className = 'sf-sec-subtitle';
    if (q) {
      q.className = 'sf-sec-quip';
      q.style.marginLeft = rightAlign ? 'auto' : '0';
    }
    if (hr) {
      hr.className = 'sf-sec-hr';
    }
  } catch (_) {}

  // 3) Assemble DOM
  header.appendChild(h);
  if (q) header.appendChild(q);
  sec.appendChild(header);
  if (hr) sec.appendChild(hr);
  return sec;
}

// Create a subtle note block used by tabs for logged-out or tips
export function makeNote(text) {
  const n = createUiElement(basicNote, String(text || ''));
  try { n.className = 'sf-note'; } catch (_) {}
  return n;
}

// Panel-style row: label on the left, input on the right
export function makeRow(labelText, inputEl) {
  // 1) Create elements
  const row = createUiElement(basicPanelRow);
  const lab = createUiElement(basicPanelLabel, String(labelText || ''));
  const cell = createUiElement(basicPanelCell);

  // 2) Apply classes/styles
  try {
    row.className = 'sf-row';
  } catch (_) {}

  // 3) Assemble DOM
  if (inputEl) cell.appendChild(inputEl);
  row.appendChild(lab);
  row.appendChild(cell);
  return row;
}

// Simple styled input used by panel rows
export function makeInput(type = 'text', value = '') {
  const el = createUiElement([basicTextInput, { __type: type }]);
  try { el.value = (value != null ? String(value) : ''); } catch (_) {}
  return el;
}

// Overlay input row scaffold used by Profile tab
export function createInputRow({ dataName } = {}) {
  // 1) Create element
  const row = createUiElement(basicInputRow);

  // 2) Apply classes/datasets
  try {
    row.className = 'sf-input-row';
    if (dataName) row.dataset.name = String(dataName);
  } catch (_) {}

  // 3) Return
  return row;
}

// Focus highlight behavior used by overlay inputs
export function wireFocusHighlight(inputEl, wrapEl) {
  if (!inputEl) return;
  const target = wrapEl || inputEl;
  const on = () => {
    try {
      if (target === inputEl) {
        target.classList && target.classList.add('ui-focus-ring');
      } else {
        target.classList && target.classList.remove('ui-focus-reset');
        target.classList && target.classList.add('ui-focus-glow');
      }
    } catch (_) {}
  };
  const off = () => {
    try {
      if (target === inputEl) {
        target.classList && target.classList.remove('ui-focus-ring');
      } else {
        target.classList && target.classList.remove('ui-focus-glow');
        target.classList && target.classList.add('ui-focus-reset');
      }
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
  const on = () => { try { target.classList && target.classList.add('ui-hover-glow'); } catch (_) {} };
  const off = () => { try { target.classList && target.classList.remove('ui-hover-glow'); } catch (_) {} };
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
