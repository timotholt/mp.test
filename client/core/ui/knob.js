import { attachTooltip, updateTooltip as updateSciTip, detachTooltip } from './tooltip.js';
// Spectrum ring density controls (for segments = -1). Adjust to tune performance/quality.
// Default halves prior density: 1 segment per degree -> ~270 micro-segments for a 270° sweep.
const SPECTRUM_SEGMENTS_PER_DEG = 1;     // was 2
const SPECTRUM_MIN_SEGMENTS = 72;        // lower bound for small sweeps
const SPECTRUM_MAX_SEGMENTS = 360;       // upper bound (was 720)
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
  // Optional: allow finer wheel increments than the base step for subtle wheel motions
  const wheelFineStep = (opts.wheelFineStep != null && Number.isFinite(Number(opts.wheelFineStep)))
    ? Number(opts.wheelFineStep)
    : null;
  // Optional: middle tier for small multi-notch spins (e.g., 2–3 notches)
  // Defaults to 3 units if not provided, matching the requested "3 degrees / 3%" middle speed
  const wheelMediumStep = (opts.wheelMediumStep != null && Number.isFinite(Number(opts.wheelMediumStep)))
    ? Number(opts.wheelMediumStep)
    : 3;
  // Optional: turbo tier for very large multi-notch spins; defaults to 2× base step
  const wheelTurboStep = (opts.wheelTurboStep != null && Number.isFinite(Number(opts.wheelTurboStep)))
    ? Number(opts.wheelTurboStep)
    : (step * 2);
  const readOnly = !!opts.readOnly;
  const allowSmall = !!opts.allowSmall;

  const rawSize = opts.size;
  const sizeNum = (typeof rawSize === 'number' && Number.isFinite(rawSize)) ? Math.floor(rawSize) : null;
  const minSize = allowSmall ? 8 : 40;
  const size = (sizeNum != null) ? Math.max(minSize, sizeNum) : 64;

  // segments semantics:
  //  >0  = classic LED segments (existing behavior)
  //   0  = draw no outer ring
  //  -1  = draw a "continuous" spectrum ring (internally many thin segments)
  const segRaw = Math.floor(toNum(opts.segments, 24));
  const segMode = (segRaw === -1) ? 'spectrum' : (segRaw === 0 ? 'none' : 'classic');
  const segments = segMode === 'classic' ? Math.max(6, segRaw) : 0;
  let angleMin = toNum(opts.angleMin, -135);
  let angleMax = toNum(opts.angleMax, 135);
  // If using spectrum ring and caller didn't set explicit angle bounds, default to full 360°
  if (segMode === 'spectrum' && opts.angleMin == null && opts.angleMax == null) {
    angleMin = -180;
    angleMax = 180;
  }
  // Allow wrap-around for any control spanning ~360° (not only spectrum mode)
  const fullSweep = (Math.abs(angleMax - angleMin) >= 359.5);

  const ringOffset = (opts.ringOffset != null)
    ? Math.max(0, Math.round(Number(opts.ringOffset)))
    : (sizeNum != null ? Math.max(8, Math.round(size * 0.18)) : 6);

  const segThickness = opts.segThickness != null ? Math.max(1, Math.round(Number(opts.segThickness))) : null;
  const segLength = opts.segLength != null ? Math.max(1, Math.round(Number(opts.segLength))) : null;
  const dotSize = opts.dotSize != null ? Math.max(2, Math.round(Number(opts.dotSize))) : null;

  const label = String(opts.label || 'Knob');
  const className = String(opts.className || '');
  // Title/tooltip formatter receives (value, { min, max, label })
  const titleFormatter = typeof opts.titleFormatter === 'function' ? opts.titleFormatter : defaultTitle;
  const onInput = typeof opts.onInput === 'function' ? opts.onInput : null;
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
  // Optional: make the tip (last lit) segment white while other lit segments use theme highlight
  const tipWhite = !!opts.tipWhite;

  const el = document.createElement('div');
  el.className = 'knob' + (className ? (' ' + className) : '');
  // Support numeric pixel sizes and string CSS sizes (e.g., '1rem')
  if (typeof rawSize === 'string') el.style.setProperty('--kn-size', String(rawSize));
  else el.style.setProperty('--kn-size', size + 'px');
  el.style.setProperty('--kn-segments', segments);
  el.style.setProperty('--kn-ring-offset', pxToMinRem(ringOffset));
  if (segThickness != null) el.style.setProperty('--kn-seg-w', pxToMinRem(segThickness));
  if (segLength != null) el.style.setProperty('--kn-seg-h', pxToMinRem(segLength));
  if (dotSize != null) el.style.setProperty('--kn-dot-size', pxToMinRem(dotSize));
  // Size-aware vertical micro-adjust for the outer ring: combats subpixel rounding from segment geometry.
  // Small knobs look best at 0px; medium benefit from ~1px; large regain the prior ~2px compensation.
  try {
    let ringAutoY = 0;
    if (size >= 64) ringAutoY = 2;
    else if (size >= 52) ringAutoY = 1;
    el.style.setProperty('--kn-ring-global-y', pxToMinRem(ringAutoY));
  } catch (_) {}

  el.setAttribute('role', 'slider');
  el.setAttribute('aria-label', label);
  el.setAttribute('aria-valuemin', String(min));
  el.setAttribute('aria-valuemax', String(max));
  el.tabIndex = 0;

  // Indicator dot
  const dot = document.createElement('div');
  dot.className = 'k-dot';
  el.appendChild(dot);

  // Segmented ring (classic) or spectrum ring (micro-segments)
  const ring = document.createElement('div');
  ring.className = 'k-ring';
  el.appendChild(ring);

  const segEls = [];
  const ringColorForAngle = (typeof opts.ringColorForAngle === 'function') ? opts.ringColorForAngle : null;
  if (segMode === 'classic') {
    for (let i = 0; i < segments; i++) {
      const seg = document.createElement('div');
      seg.className = 'k-seg';
      const t = segments === 1 ? 0 : i / (segments - 1);
      const ang = lerp(angleMin, angleMax, t);
      seg.style.setProperty('--ang', ang + 'deg');
      ring.appendChild(seg);
      segEls.push(seg);
    }
  } else if (segMode === 'spectrum') {
    // Internally approximate continuous by many thin segments (size-aware, clamped)
    const sweep = Math.abs(angleMax - angleMin);
    const microCount = Math.max(SPECTRUM_MIN_SEGMENTS, Math.min(SPECTRUM_MAX_SEGMENTS, Math.round(sweep * SPECTRUM_SEGMENTS_PER_DEG))); // ~270 for 270° sweep
    for (let i = 0; i < microCount; i++) {
      const seg = document.createElement('div');
      seg.className = 'k-seg';
      const t = microCount === 1 ? 0 : i / (microCount - 1);
      const ang = lerp(angleMin, angleMax, t);
      seg.style.setProperty('--ang', ang + 'deg');
      // In spectrum mode, each micro-segment is fully opaque and colored by a callback (if provided)
      try { seg.style.opacity = '1'; } catch (_) {}
      if (ringColorForAngle) {
        try { seg.style.background = String(ringColorForAngle(ang, t)); } catch (_) {}
      }
      ring.appendChild(seg);
      segEls.push(seg);
    }
  } // segMode 'none' draws no outer ring

  // internal state
  let value = clamp(min, max, (opts.value != null) ? Number(opts.value) : min);
  let adjusting = false;

  // Allow callers to refresh spectrum ring colors (e.g., when theme hue changes)
  const refreshRingColors = () => {
    if (segMode !== 'spectrum' || !ringColorForAngle) return;
    try {
      const count = segEls.length;
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        const ang = lerp(angleMin, angleMax, t);
        try { segEls[i].style.background = String(ringColorForAngle(ang, t)); segEls[i].style.opacity = '1'; } catch (_) {}
      }
    } catch (_) {}
  };

  const updateUI = (v) => {
    const n = clamp01((v - min) / range);
    const ang = lerp(angleMin, angleMax, n);
    dot.style.transform = `rotate(${ang}deg)`;

    // Light segments only in classic mode; spectrum/none don't use on/off
    if (segMode === 'classic') {
      const lit = Math.round(n * segments);
      for (let i = 0; i < segments; i++) {
        const on = i < lit;
        const seg = segEls[i];
        seg.classList.toggle('on', on);
        if (tipWhite) {
          // Inline style wins over CSS hover/focus rules; apply only to the last lit segment
          if (on && i === lit - 1) {
            try { seg.style.background = '#fff'; } catch (_) {}
          } else {
            try { seg.style.background = ''; } catch (_) {}
          }
        }
      }
    }

    // Tooltip (Sci-Fi) + ARIA
    const title = titleFormatter(v, { min, max, label });
    try { updateSciTip(el, title); } catch (_) {}
    el.setAttribute('aria-valuenow', String(v));
    el.setAttribute('aria-valuetext', title);
  };

  const setValue = (v, opts2 = {}) => {
    let next = Number(v);
    if (fullSweep) {
      const width = range;
      const base = min;
      let rel = (next - base) % width;
      if (rel < 0) rel += width;
      next = base + rel;
    } else {
      next = clamp(min, max, next);
    }
    if (next === value) return;
    value = next;
    updateUI(value);
    if (!opts2.silent && onInput) try { onInput(value); } catch (_) {}
  };
  const getValue = () => value;

  // Initialize (far mode = distant tooltip with connector line, no arrow)
  try { attachTooltip(el, { mode: 'far' }); } catch (_) {}
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

  const increment = (dir, stepOverride) => { // dir: +1 or -1
    if (readOnly) return;
    const s = (stepOverride != null && Number.isFinite(stepOverride)) ? stepOverride : step;
    const delta = dir * s;
    let next = value + delta;
    if (fullSweep) {
      const width = range;
      const base = min;
      let rel = (next - base) % width;
      if (rel < 0) rel += width;
      next = base + rel;
    } else {
      next = clamp(min, max, next);
    }
    if (next !== value) {
      value = next;
      updateUI(value);
      if (onInput) try { onInput(value); } catch (_) {}
    }
  };

  // Normalize wheel delta across browsers/devices into rough "line units"
  const normalizeWheelDelta = (e) => {
    try {
      const mode = e.deltaMode; // 0=pixel, 1=line, 2=page
      const dy = Number(e.deltaY) || 0;
      if (mode === 1) return dy / 3;       // lines -> assume ~3 lines per notch
      if (mode === 2) return dy * 8;       // pages -> treat as many lines
      return dy / 100;                      // pixels -> approx lines (100px per notch common)
    } catch (_) { return (e && e.deltaY) ? (e.deltaY / 100) : 0; }
  };

  const onWheel = (e) => {
    try {
      e.preventDefault();
      const norm = normalizeWheelDelta(e);
      const dir = norm < 0 ? 1 : -1; // up = higher
      const mag = Math.abs(norm);
      // Compute rounded notch count so Windows' common 120px (-> 1.2) still counts as a single notch
      const notches = Math.max(1, Math.min(50, Math.round(mag)));
      // Tiered steps: 1-notch -> fine; 2–3 -> medium; 4–6 -> base; 7+ -> turbo
      let unitStep;
      if (notches === 1 && wheelFineStep != null) unitStep = wheelFineStep;
      else if (notches <= 3 && wheelMediumStep != null) unitStep = wheelMediumStep;
      else if (notches >= 7 && wheelTurboStep != null) unitStep = wheelTurboStep;
      else unitStep = step;

      beginAdjust();
      // Apply in one update to avoid spamming onInput listeners
      const totalDelta = dir * unitStep * notches;
      let next = value + totalDelta;
      if (fullSweep) {
        const width = range;
        const base = min;
        let rel = (next - base) % width;
        if (rel < 0) rel += width;
        next = base + rel;
      } else {
        next = clamp(min, max, next);
      }
      if (next !== value) {
        value = next;
        updateUI(value);
        if (onInput) try { onInput(value); } catch (_) {}
      }
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
      let next = drag.startVal + frac * range;
      if (fullSweep) {
        const width = range;
        const base = min;
        let rel = (next - base) % width;
        if (rel < 0) rel += width;
        next = base + rel;
      } else {
        next = clamp(min, max, next);
      }
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
    try { detachTooltip(el); } catch (_) {}
  };

  // Apply theme if provided
  if (opts.theme && typeof opts.theme === 'object') applyKnobTheme(el, opts.theme);

  return { el, getValue, setValue, unbind, refreshRingColors };
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
// Convert a pixel length to a CSS length that scales with root font-size below a 19px baseline
// while clamping to the original pixel size at >=19px. Example: 18 -> 'min(18px, 0.947rem)'
// Keeps the "perfect at 19px" look and preserves proportions as font-size shrinks.
function pxToMinRem(px) {
  try {
    const n = Math.max(0, Math.round(Number(px)));
    if (n === 0) return '0px';
    const rem = (n / 19);
    // Limit decimals for readability; CSS will parse fine
    const remStr = rem.toFixed(5).replace(/0+$/,'').replace(/\.$/, '');
    return `min(${n}px, ${remStr}rem)`;
  } catch (_) {
    // Fallback to px if anything goes wrong
    const nn = Math.round(Number(px)) || 0;
    return nn + 'px';
  }
}

function toNum(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function clamp(min, max, v) { if (!Number.isFinite(v)) return min; if (v < min) return min; if (v > max) return max; return v; }
function clamp01(x) { x = Number(x); if (!Number.isFinite(x)) return 0; if (x < 0) return 0; if (x > 1) return 1; return x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function getPointerY(e) { return (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY); }

function defaultTitle(v, { min, max, label }) {
  const range = Math.max(0.000001, max - min);
  const pct = Math.round(((v - min) / range) * 100);
  // Include label (knob name) so tooltip shows e.g., "Master: 75%"
  const prefix = label ? String(label) + ': ' : '';
  return `${prefix}${pct}%`;
}

function ensureStyle() {
  let st = document.getElementById('generic-knob-style');
  if (!st) { st = document.createElement('style'); st.id = 'generic-knob-style'; document.head.appendChild(st); }
  st.textContent = `
  .knob { position: relative; width: var(--kn-size, 64px); height: var(--kn-size, 64px);
    border-radius: 50%; outline: none; cursor: ns-resize; user-select: none; touch-action: none; overflow: visible;
    /* Lighting: brighter on the RIGHT, darker on the LEFT */
    background: linear-gradient(90deg,
      var(--ui-knob-bg-left, var(--ui-knob-bg-bottom, var(--kn-bg-bottom, #1a1a1a))) 0%,
      var(--ui-knob-bg-right, var(--ui-knob-bg-top, var(--kn-bg-top, #202020))) 100%);
    box-shadow:
       2px -2px 3px rgba(255,255,255,0.32),
      -2px  2px  7px rgba(0,0,0,1.0),
      inset  2px -2px 2px rgba(255,255,255,0.18),
      inset -2px  2px 3px rgba(0,0,0,0.46);
  }
  .knob:focus { box-shadow: var(--kn-focus-glow, var(--ui-glow-strong, var(--sf-tip-glow-outer, 0 0 18px rgba(120,170,255,0.33)))), var(--kn-focus-ring, 0 0 0 2px rgba(100,160,255,0.5)), 2px -2px 3px rgba(255,255,255,0.32), -2px 2px 7px rgba(0,0,0,1.0), inset 2px -2px 2px rgba(255,255,255,0.18), inset -2px 2px 3px rgba(0,0,0,0.46); }
  .knob:hover { box-shadow: var(--kn-hover-glow, var(--ui-glow-strong, var(--sf-tip-glow-outer, 0 0 18px rgba(120,170,255,0.33)))), 2px -2px 3px rgba(255,255,255, calc(0.32 + 0.06 * var(--kn-hover-strength, 1))), -2px 2px 8px rgba(0,0,0,1.0), inset 2px -2px 2px rgba(255,255,255, calc(0.18 + 0.04 * var(--kn-hover-strength, 1))), inset -2px 2px 3px rgba(0,0,0, calc(0.46 + 0.06 * var(--kn-hover-strength, 1))); }

  /* Centered theme ring painted on the knob surface (hidden by default) */
  .knob::before { content: '';
    position: absolute; left: 50%; top: 50%;
    width: var(--kn-center-ring-d, 70%);
    height: var(--kn-center-ring-d, 70%);
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: var(--kn-center-ring-w, 2px) solid var(--kn-center-ring-color, var(--kn-seg-on, var(--ui-surface-border)));
    box-shadow: var(--kn-center-ring-glow, var(--kn-seg-glow, none));
    opacity: var(--kn-center-ring-opacity, 0);
    pointer-events: none;
  }
  .knob:hover::before, .knob:focus::before {
    border-color: var(--kn-center-ring-color-hover, var(--kn-seg-on-bright, var(--ui-bright)));
    box-shadow: var(--kn-center-ring-glow-strong, var(--kn-seg-glow-strong, var(--kn-center-ring-glow, var(--kn-seg-glow, none))));
  }

  .knob .k-dot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; transform-origin: 50% 50%; }
  .knob .k-dot::after { content: ''; position: absolute; left: 50%; top: calc(6% + 5px);
    width: var(--kn-dot-size, 6px); height: var(--kn-dot-size, 6px); margin-left: calc(-0.5 * var(--kn-dot-size, 6px));
    border-radius: 50%;
    /* Default: dim gray independent of theme; allow override via --kn-dot-color or --kn-dot-color-idle */
    background: var(--kn-dot-color, var(--kn-dot-color-idle, #a0a0a0));
    /* Idle glow off by default; can be overridden */
    box-shadow: var(--kn-dot-glow, none); }

  .knob .k-ring { position: absolute; inset: 0; pointer-events: none; transform: translateY(var(--kn-ring-global-y, 0px)); }
  .knob .k-seg { position: absolute; left: 50%; top: 50%; width: var(--kn-seg-w, 2px); height: var(--kn-seg-h, 10px);
    background: var(--kn-seg-off, #2a2f36); border-radius: 1px; opacity: 0.45;
    transform-origin: 0 0;
    transform: translate(calc(-0.5 * var(--kn-seg-w, 2px)), calc(-0.5 * var(--kn-seg-h, 10px))) rotate(var(--ang)) translateY(calc(-0.5 * var(--kn-size) - var(--kn-ring-offset, 12px)));
  }
  .knob .k-seg.on { background: var(--kn-seg-on, var(--ui-accent, #9fd0ff)); opacity: 1; box-shadow: var(--kn-seg-glow, var(--ui-surface-glow-outer, 0 0 6px rgba(120,170,255,0.9))); }
  .knob:hover .k-seg.on, .knob:focus .k-seg.on { background: var(--kn-seg-on-bright, var(--ui-bright, #dff1ff)); box-shadow: var(--kn-seg-glow-strong, var(--ui-glow-strong, 0 0 14px rgba(120,170,255,0.95))); }
  /* Dot hover/focus: brighten to white with a subtle glow, overridable via vars */
  .knob:hover .k-dot::after, .knob:focus .k-dot::after {
    background: var(--kn-dot-color-hover, var(--kn-dot-color-bright, #ffffff));
    box-shadow: var(--kn-dot-glow-hover, 0 0 10px rgba(255,255,255,0.85));
  }
  `;
}
