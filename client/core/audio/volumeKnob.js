// Volume Knob UI (plain JS)
// Reusable knob control bound to volumeGroupManager.js groups.
// Features:
// - Mouse wheel: up = louder, down = softer (preventDefault)
// - Vertical drag: drag up = louder, down = softer
// - Segmented ring lights with configurable segment count
// - Rotating indicator dot
// - Tooltip shows exact numeric volume (0..1) and percent
// - ARIA slider semantics
//
// Usage:
//   import { createVolumeKnob } from './volumeKnob.js';
//   const knob = createVolumeKnob({ groupId: 'MASTER', segments: 28, size: 72 });
//   container.appendChild(knob.el);
//
// Returns: { el, unbind }
//
// Notes:
// - Integrates with events from volumeGroupManager: 'ui:volume:<GROUP>'
// - Uses getValue()/setValue() as the source of truth; echoes suppressed via sourceId

import { getValue, setValue, DEFAULT_WHEEL_STEP } from './volumeGroupManager.js';

const MIN_ANGLE = -135; // degrees
const MAX_ANGLE = 135;  // degrees (sweep of 270deg)

export function createVolumeKnob(opts = {}) {
  ensureStyle();

  const groupId = String(opts.groupId || 'MASTER');
  const size = Math.max(40, Math.floor(opts.size || 64));
  const segments = Math.max(6, Math.floor(opts.segments || 24));
  const step = typeof opts.step === 'number' ? Math.abs(opts.step) : DEFAULT_WHEEL_STEP;
  const emitOnInit = !!opts.emitOnInit;

  const el = document.createElement('div');
  el.className = 'vol-knob';
  el.style.setProperty('--vk-size', size + 'px');
  el.style.setProperty('--vk-segments', segments);
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-label', (opts.label || (groupId + ' Volume')));
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '1');
  el.tabIndex = 0; // focusable for a11y

  // Indicator dot
  const dot = document.createElement('div');
  dot.className = 'vk-dot';
  el.appendChild(dot);

  // Segmented ring
  const ring = document.createElement('div');
  ring.className = 'vk-ring';
  el.appendChild(ring);

  const segEls = [];
  for (let i = 0; i < segments; i++) {
    const seg = document.createElement('div');
    seg.className = 'vk-seg';
    // Angle spacing across [MIN_ANGLE, MAX_ANGLE]
    const t = segments === 1 ? 0 : i / (segments - 1);
    const ang = lerp(MIN_ANGLE, MAX_ANGLE, t);
    seg.style.setProperty('--ang', ang + 'deg');
    ring.appendChild(seg);
    segEls.push(seg);
  }

  // Generate a stable source id for echo-suppression
  const sourceId = makeSourceId(groupId);

  // State helpers
  const get = () => clamp01(getValue(groupId));
  const set = (v, opts2 = {}) => setValue(groupId, v, { ...opts2, sourceId });

  const updateUI = (v) => {
    const val = clamp01(v);
    const ang = lerp(MIN_ANGLE, MAX_ANGLE, val);
    dot.style.transform = `rotate(${ang}deg)`;

    // Light up appropriate number of segments
    const lit = Math.round(val * segments);
    for (let i = 0; i < segments; i++) segEls[i].classList.toggle('on', i < lit);

    // Tooltip + ARIA
    const pct = Math.round(val * 100);
    const num = Math.round(val * 100) / 100; // 2 decimals
    const tip = `${pct}% (${num})`;
    el.title = tip;
    el.setAttribute('aria-valuenow', String(val));
    el.setAttribute('aria-valuetext', tip);
  };

  // Initialize
  let value = get();
  updateUI(value);
  if (emitOnInit) set(value, { silent: false });

  // Wheel behavior (clockwise on wheel-up = louder)
  const onWheel = (e) => {
    try {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1; // up = louder
      const next = clamp01(value + dir * step);
      if (next !== value) {
        value = next;
        updateUI(value);
        set(value, { silent: false });
        signalAdjusting(true);
        debounceAdjustingDone();
      }
    } catch (_) {}
  };

  // Drag behavior (vertical)
  let drag = null; // { startY, startVal }
  const DRAG_PIXELS_FOR_FULL = Math.max(80, Math.min(260, size * 2));

  const onPointerDown = (e) => {
    try {
      e.preventDefault();
      const y = getPointerY(e);
      drag = { startY: y, startVal: value };
      el.setPointerCapture?.(e.pointerId ?? 1);
      signalAdjusting(true);
    } catch (_) {}
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    try {
      const y = getPointerY(e);
      const dy = drag.startY - y; // up = positive = louder
      const delta = dy / DRAG_PIXELS_FOR_FULL; // fraction of full range
      const next = clamp01(drag.startVal + delta);
      if (next !== value) {
        value = next;
        updateUI(value);
        set(value, { silent: false });
      }
    } catch (_) {}
  };

  const onPointerUp = (e) => {
    if (!drag) return;
    try {
      drag = null;
      el.releasePointerCapture?.(e.pointerId ?? 1);
    } catch (_) {}
    signalAdjusting(false);
  };

  // Keyboard support (left/right/down/up)
  const onKeyDown = (e) => {
    let dir = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') dir = 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') dir = -1;
    if (!dir) return;
    e.preventDefault();
    const next = clamp01(value + dir * step);
    if (next !== value) {
      value = next;
      updateUI(value);
      set(value, { silent: false });
      signalAdjusting(true);
      debounceAdjustingDone();
    }
  };

  // External sync listener
  const onExternal = (e) => {
    try {
      const d = e && e.detail ? e.detail : {};
      if (d && d.sourceId && d.sourceId === sourceId) return; // ignore self
      const v = typeof d.value === 'number' ? d.value : get();
      if (v !== value) { value = clamp01(v); updateUI(value); }
    } catch (_) {}
  };

  // Tooltip update when mouse moves (to ensure OS shows new title)
  const onMouseEnter = () => updateUI(value);

  // Wire listeners
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  el.addEventListener('keydown', onKeyDown);
  el.addEventListener('mouseenter', onMouseEnter);
  window.addEventListener('ui:volume:' + groupId, onExternal);

  const unbind = () => {
    try { el.removeEventListener('wheel', onWheel, { passive: false }); } catch (_) {}
    try { el.removeEventListener('pointerdown', onPointerDown); } catch (_) {}
    try { window.removeEventListener('pointermove', onPointerMove); } catch (_) {}
    try { window.removeEventListener('pointerup', onPointerUp); } catch (_) {}
    try { el.removeEventListener('keydown', onKeyDown); } catch (_) {}
    try { el.removeEventListener('mouseenter', onMouseEnter); } catch (_) {}
    try { window.removeEventListener('ui:volume:' + groupId, onExternal); } catch (_) {}
  };

  return { el, unbind };
}

// ---- helpers ----
function clamp01(x) { x = Number(x); if (!Number.isFinite(x)) return 0; if (x < 0) return 0; if (x > 1) return 1; return x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function getPointerY(e) { return (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY); }

function makeSourceId(groupId) {
  try {
    if (!window.__vkSeq) window.__vkSeq = 0;
    return `vk-${groupId}-${++window.__vkSeq}`;
  } catch (_) {
    return `vk-${groupId}-x`;
  }
}

let adjustingTimer = null;
function signalAdjusting(on) {
  try { window.dispatchEvent(new CustomEvent('ui:volume:adjusting', { detail: { adjusting: !!on } })); } catch (_) {}
}
function debounceAdjustingDone() {
  clearTimeout(adjustingTimer);
  adjustingTimer = setTimeout(() => signalAdjusting(false), 180);
}

function ensureStyle() {
  if (document.getElementById('volume-knob-style')) return;
  const st = document.createElement('style');
  st.id = 'volume-knob-style';
  st.textContent = `
  .vol-knob { position: relative; width: var(--vk-size, 64px); height: var(--vk-size, 64px);
    border-radius: 50%; background: radial-gradient(ellipse at center, #222 0%, #151515 60%, #0d0d0d 100%);
    box-shadow: inset 0 1px 2px rgba(255,255,255,0.06), inset 0 -2px 6px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.5);
    outline: none; cursor: ns-resize; user-select: none; touch-action: none; overflow: visible; }
  .vol-knob:focus { box-shadow: 0 0 0 2px rgba(100,160,255,0.5), inset 0 1px 2px rgba(255,255,255,0.06), inset 0 -2px 6px rgba(0,0,0,0.8); }

  .vol-knob .vk-dot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none;
    transform-origin: 50% 50%; }
  .vol-knob .vk-dot::after { content: ''; position: absolute; left: 50%; top: 6%; width: 6px; height: 6px; margin-left: -3px;
    border-radius: 50%; background: #cfe8ff; box-shadow: 0 0 8px rgba(130,180,255,0.8); }

  .vol-knob .vk-ring { position: absolute; inset: 0; pointer-events: none; }
  .vol-knob .vk-seg { position: absolute; left: 50%; top: 50%; width: 2px; height: 10px; margin-left: -1px; margin-top: -5px;
    background: #2a2f36; border-radius: 1px; opacity: 0.45;
    transform-origin: 0 0; transform: rotate(var(--ang)) translateY(calc(-1 * var(--vk-size) / 2 - 6px)); }
  .vol-knob .vk-seg.on { background: #9fd0ff; opacity: 1; box-shadow: 0 0 6px rgba(120,170,255,0.9); }
  `;
  document.head.appendChild(st);
}
