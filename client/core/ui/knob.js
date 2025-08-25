// Generic Knob UI (plain JS)
// Reusable control for any purpose (puzzles, mixers, etc.)
// - Wheel, drag, and keyboard input
// - Segmented outer ring with configurable count and geometry
// - Indicator dot rotates across an angle sweep
// - A11y slider semantics
// - Theming via CSS variables per-element (no global CSS edits)
//
// Usage:
//   import { createKnob, applyKnobTheme, themes } from './knob.js';
//   const { el, getValue, setValue } = createKnob({
//     min: 0, max: 1, value: 0.25, step: 0.05,
//     size: 64, segments: 24, label: 'Power',
//   });
//   document.body.appendChild(el);
//   applyKnobTheme(el, themes.neonCyan);
//
// Returns: { el, getValue, setValue, unbind }

// ---- public API ----
export function createKnob(opts = {}) {
  ensureStyle();

  const min = toNum(opts.min, 0);
  const max = toNum(opts.max, 1);
  const range = Math.max(0.000001, max - min);
  const step = toNum(opts.step, range / 20);
  const readOnly = !!opts.readOnly;
  const allowSmall = !!opts.allowSmall;

  const rawSize = opts.size;
  const sizeNum = (typeof rawSize === 'number' && Number.isFinite(rawSize)) ? Math.floor(rawSize) : null;
  const minSize = allowSmall ? 8 : 40;
  const size = (sizeNum != null) ? Math.max(minSize, sizeNum) : 64;

  const segments = Math.max(6, Math.floor(toNum(opts.segments, 24)));
  const angleMin = toNum(opts.angleMin, -135);
  const angleMax = toNum(opts.angleMax, 135);

  const ringOffset = (opts.ringOffset != null)
    ? Math.max(0, Math.round(Number(opts.ringOffset)))
    : (sizeNum != null ? Math.max(8, Math.round(size * 0.18)) : 6);

  const segThickness = opts.segThickness != null ? Math.max(1, Math.round(Number(opts.segThickness))) : null;
  const segLength = opts.segLength != null ? Math.max(1, Math.round(Number(opts.segLength))) : null;
  const dotSize = opts.dotSize != null ? Math.max(2, Math.round(Number(opts.dotSize))) : null;

  const label = String(opts.label || 'Knob');
  const className = String(opts.className || '');
  const titleFormatter = typeof opts.titleFormatter === 'function' ? opts.titleFormatter : defaultTitle;
  const onInput = typeof opts.onInput === 'function' ? opts.onInput : null;
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;

  const el = document.createElement('div');
  el.className = 'knob' + (className ? (' ' + className) : '');
  // Support numeric pixel sizes and string CSS sizes (e.g., '1rem')
  if (typeof rawSize === 'string') el.style.setProperty('--kn-size', String(rawSize));
  else el.style.setProperty('--kn-size', size + 'px');
  el.style.setProperty('--kn-segments', segments);
  el.style.setProperty('--kn-ring-offset', ringOffset + 'px');
  if (segThickness != null) el.style.setProperty('--kn-seg-w', segThickness + 'px');
  if (segLength != null) el.style.setProperty('--kn-seg-h', segLength + 'px');
  if (dotSize != null) el.style.setProperty('--kn-dot-size', dotSize + 'px');

  el.setAttribute('role', 'slider');
  el.setAttribute('aria-label', label);
  el.setAttribute('aria-valuemin', String(min));
  el.setAttribute('aria-valuemax', String(max));
  el.tabIndex = 0;

  // Indicator dot
  const dot = document.createElement('div');
  dot.className = 'k-dot';
  el.appendChild(dot);

  // Segmented ring
  const ring = document.createElement('div');
  ring.className = 'k-ring';
  el.appendChild(ring);

  const segEls = [];
  for (let i = 0; i < segments; i++) {
    const seg = document.createElement('div');
    seg.className = 'k-seg';
    const t = segments === 1 ? 0 : i / (segments - 1);
    const ang = lerp(angleMin, angleMax, t);
    seg.style.setProperty('--ang', ang + 'deg');
    ring.appendChild(seg);
    segEls.push(seg);
  }

  // internal state
  let value = clamp(min, max, (opts.value != null) ? Number(opts.value) : min);
  let adjusting = false;

  const updateUI = (v) => {
    const n = clamp01((v - min) / range);
    const ang = lerp(angleMin, angleMax, n);
    dot.style.transform = `rotate(${ang}deg)`;

    // Light segments
    const lit = Math.round(n * segments);
    for (let i = 0; i < segments; i++) segEls[i].classList.toggle('on', i < lit);

    // Tooltip + ARIA
    const title = titleFormatter(v, { min, max });
    el.title = title;
    el.setAttribute('aria-valuenow', String(v));
    el.setAttribute('aria-valuetext', title);
  };

  const setValue = (v, opts2 = {}) => {
    const next = clamp(min, max, Number(v));
    if (next === value) return;
    value = next;
    updateUI(value);
    if (!opts2.silent && onInput) try { onInput(value); } catch (_) {}
  };
  const getValue = () => value;

  // Initialize
  updateUI(value);

  // Interaction helpers
  const DRAG_PIXELS_FOR_FULL = Math.max(80, Math.min(260, size * 2));
  let drag = null; // { startY, startVal }

  const beginAdjust = () => { adjusting = true; };
  const endAdjust = () => {
    if (!adjusting) return;
    adjusting = false;
    if (onChange) try { onChange(value); } catch (_) {}
  };

  const increment = (dir) => { // dir: +1 or -1
    if (readOnly) return;
    const delta = dir * step;
    const next = clamp(min, max, value + delta);
    if (next !== value) {
      value = next;
      updateUI(value);
      if (onInput) try { onInput(value); } catch (_) {}
    }
  };

  const onWheel = (e) => {
    try {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1; // up = louder/higher
      beginAdjust();
      increment(dir);
      // endAdjust is not immediate; give tiny grace period for spins
      clearTimeout(onWheel._t);
      onWheel._t = setTimeout(endAdjust, 160);
    } catch (_) {}
  };

  const onPointerDown = (e) => {
    try {
      if (readOnly) return;
      e.preventDefault();
      const y = getPointerY(e);
      drag = { startY: y, startVal: value };
      el.setPointerCapture?.(e.pointerId ?? 1);
      beginAdjust();
    } catch (_) {}
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    try {
      const y = getPointerY(e);
      const dy = drag.startY - y; // up = positive = clockwise
      const frac = dy / DRAG_PIXELS_FOR_FULL; // fraction of full range
      const next = clamp(min, max, drag.startVal + frac * range);
      if (next !== value) {
        value = next;
        updateUI(value);
        if (onInput) try { onInput(value); } catch (_) {}
      }
    } catch (_) {}
  };

  const onPointerUp = (e) => {
    if (!drag) return;
    try {
      drag = null;
      el.releasePointerCapture?.(e.pointerId ?? 1);
    } catch (_) {}
    endAdjust();
  };

  const onKeyDown = (e) => {
    try {
      let dir = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') dir = 1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') dir = -1;
      if (!dir) return;
      e.preventDefault();
      beginAdjust();
      increment(dir);
      clearTimeout(onKeyDown._t);
      onKeyDown._t = setTimeout(endAdjust, 60);
    } catch (_) {}
  };

  const onMouseEnter = () => updateUI(value); // keep title fresh

  // Wire
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  el.addEventListener('keydown', onKeyDown);
  el.addEventListener('mouseenter', onMouseEnter);

  const unbind = () => {
    try { el.removeEventListener('wheel', onWheel, { passive: false }); } catch (_) {}
    try { el.removeEventListener('pointerdown', onPointerDown); } catch (_) {}
    try { window.removeEventListener('pointermove', onPointerMove); } catch (_) {}
    try { window.removeEventListener('pointerup', onPointerUp); } catch (_) {}
    try { el.removeEventListener('keydown', onKeyDown); } catch (_) {}
    try { el.removeEventListener('mouseenter', onMouseEnter); } catch (_) {}
  };

  // Apply theme if provided
  if (opts.theme && typeof opts.theme === 'object') applyKnobTheme(el, opts.theme);

  return { el, getValue, setValue, unbind };
}

export function applyKnobTheme(el, vars = {}) {
  if (!el || !vars) return;
  for (const [k, v] of Object.entries(vars)) {
    try { el.style.setProperty(k, String(v)); } catch (_) {}
  }
}

export const themes = {
  neonCyan: {
    '--kn-bg-top': '#202020',
    '--kn-bg-bottom': '#1a1a1a',
    '--kn-seg-off': '#2a2f36',
    '--kn-seg-on': '#9fd0ff',
    '--kn-seg-glow': '0 0 6px rgba(120,170,255,0.9)',
    '--kn-dot-color': '#cfe8ff',
    '--kn-dot-glow': '0 0 8px rgba(130,180,255,0.8)',
    '--kn-focus-ring': '0 0 0 2px rgba(100,160,255,0.5)',
    '--kn-hover-strength': '1.0',
  },
  muted: {
    '--kn-bg-top': '#1e1e1e',
    '--kn-bg-bottom': '#171717',
    '--kn-seg-off': '#2a2a2a',
    '--kn-seg-on': '#8aa0b2',
    '--kn-seg-glow': '0 0 4px rgba(120,150,180,0.5)',
    '--kn-dot-color': '#b7c4d0',
    '--kn-dot-glow': '0 0 5px rgba(120,150,180,0.5)',
    '--kn-focus-ring': '0 0 0 2px rgba(140,140,140,0.5)',
    '--kn-hover-strength': '0.7',
  },
};

// ---- helpers ----
function toNum(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function clamp(min, max, v) { if (!Number.isFinite(v)) return min; if (v < min) return min; if (v > max) return max; return v; }
function clamp01(x) { x = Number(x); if (!Number.isFinite(x)) return 0; if (x < 0) return 0; if (x > 1) return 1; return x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function getPointerY(e) { return (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY); }

function defaultTitle(v, { min, max }) {
  const range = Math.max(0.000001, max - min);
  const pct = Math.round(((v - min) / range) * 100);
  const num = Math.round(v * 100) / 100; // 2 decimals
  return `${pct}% (${num})`;
}

function ensureStyle() {
  let st = document.getElementById('generic-knob-style');
  if (!st) { st = document.createElement('style'); st.id = 'generic-knob-style'; document.head.appendChild(st); }
  st.textContent = `
  .knob { position: relative; width: var(--kn-size, 64px); height: var(--kn-size, 64px);
    border-radius: 50%; outline: none; cursor: ns-resize; user-select: none; touch-action: none; overflow: visible;
    background: linear-gradient(to bottom, var(--kn-bg-top, #202020) 0%, var(--kn-bg-bottom, #1a1a1a) 100%);
    box-shadow:
      -2px -2px 3px rgba(255,255,255,0.28),
       2px  2px 7px rgba(0,0,0,1.0),
      inset -2px -2px 3px rgba(0,0,0,0.40),
      inset  2px  2px 2px rgba(255,255,255,0.14);
  }
  .knob:focus { box-shadow: var(--kn-focus-ring, 0 0 0 2px rgba(100,160,255,0.5)), -2px -2px 3px rgba(255,255,255,0.28), 2px 2px 7px rgba(0,0,0,1.0), inset -2px -2px 3px rgba(0,0,0,0.40), inset 2px 2px 2px rgba(255,255,255,0.14); }
  .knob:hover { box-shadow: -2px -2px 3px rgba(255,255,255, calc(0.28 + 0.06 * var(--kn-hover-strength, 1))), 2px 2px 8px rgba(0,0,0,1.0), inset -2px -2px 3px rgba(0,0,0, calc(0.40 + 0.06 * var(--kn-hover-strength, 1))), inset 2px 2px 2px rgba(255,255,255, calc(0.14 + 0.04 * var(--kn-hover-strength, 1))); }

  .knob .k-dot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; transform-origin: 50% 50%; }
  .knob .k-dot::after { content: ''; position: absolute; left: 50%; top: calc(6% + 5px);
    width: var(--kn-dot-size, 6px); height: var(--kn-dot-size, 6px); margin-left: calc(-0.5 * var(--kn-dot-size, 6px));
    border-radius: 50%; background: var(--kn-dot-color, #cfe8ff); box-shadow: var(--kn-dot-glow, 0 0 8px rgba(130,180,255,0.8)); }

  .knob .k-ring { position: absolute; inset: 0; pointer-events: none; transform: translateY(var(--kn-ring-global-y, 2px)); }
  .knob .k-seg { position: absolute; left: 50%; top: 50%; width: var(--kn-seg-w, 2px); height: var(--kn-seg-h, 10px);
    background: var(--kn-seg-off, #2a2f36); border-radius: 1px; opacity: 0.45;
    transform-origin: 0 0;
    transform: translate(calc(-0.5 * var(--kn-seg-w, 2px)), calc(-0.5 * var(--kn-seg-h, 10px))) rotate(var(--ang)) translateY(calc(-0.5 * var(--kn-size) - var(--kn-ring-offset, 12px)));
  }
  .knob .k-seg.on { background: var(--kn-seg-on, #9fd0ff); opacity: 1; box-shadow: var(--kn-seg-glow, 0 0 6px rgba(120,170,255,0.9)); }
  `;
}
