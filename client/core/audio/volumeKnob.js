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
import { createKnob } from '../ui/knob.js';

// Angle sweep stays the same as before via createKnob({ angleMin, angleMax })

export function createVolumeKnob(opts = {}) {
  const groupId = String(opts.groupId || 'MASTER');
  const sourceId = makeSourceId(groupId);

  const initialValue = clamp01(getValue(groupId));
  const step = typeof opts.step === 'number' ? Math.abs(opts.step) : DEFAULT_WHEEL_STEP;

  const { el, setValue: setKnobValue, unbind: knUnbind } = createKnob({
    min: 0,
    max: 1,
    value: initialValue,
    step,
    size: opts.size,
    segments: Math.max(6, Math.floor(opts.segments || 24)),
    angleMin: -135,
    angleMax: 135,
    ringOffset: opts.ringOffset,
    segThickness: opts.segThickness,
    segLength: opts.segLength,
    dotSize: opts.dotSize,
    allowSmall: true, // keep compact knobs working
    label: opts.label || `${groupId} Volume`,
    className: 'vol-knob',
    onInput: (v) => {
      try { setValue(groupId, v, { sourceId }); } catch (_) {}
      signalAdjusting(true);
    },
    onChange: (v) => {
      try { setValue(groupId, v, { sourceId }); } catch (_) {}
      signalAdjusting(false);
    },
  });

  // Ensure LED segment hover color matches the center dot hover (white)
  try { el.style.setProperty('--kn-seg-on-bright', '#fff'); } catch (_) {}

  // Prefer tooltip to appear below the knob ("far" mode is set in createKnob)
  // Set placement priority and a slightly larger gap so it renders clearly under the control.
  try {
    el.__sfTipPlacementPriority = 'b,bc,bl,br';
    el.__sfTipGapRem = 3.2;
    el.__sfTipStart = 'edge';
  } catch (_) {}

  // External sync -> update UI silently (ignore own echoes)
  const onExternal = (e) => {
    try {
      const d = e && e.detail ? e.detail : {};
      if (d && d.sourceId && d.sourceId === sourceId) return;
      const v = typeof d.value === 'number' ? d.value : clamp01(getValue(groupId));
      setKnobValue(v, { silent: true });
    } catch (_) {}
  };
  window.addEventListener('ui:volume:' + groupId, onExternal);

  // Optional: emit current value on init (for consumers needing initial broadcast)
  if (opts.emitOnInit) {
    try { setValue(groupId, initialValue, { sourceId }); } catch (_) {}
  }

  const unbind = () => {
    try { window.removeEventListener('ui:volume:' + groupId, onExternal); } catch (_) {}
    try { knUnbind?.(); } catch (_) {}
  };

  return { el, unbind };
}

// ---- helpers ----
function clamp01(x) { x = Number(x); if (!Number.isFinite(x)) return 0; if (x < 0) return 0; if (x > 1) return 1; return x; }

function makeSourceId(groupId) {
  try {
    if (!window.__vkSeq) window.__vkSeq = 0;
    return `vk-${groupId}-${++window.__vkSeq}`;
  } catch (_) {
    return `vk-${groupId}-x`;
  }
}

function signalAdjusting(on) {
  try { window.dispatchEvent(new CustomEvent('ui:volume:adjusting', { detail: { adjusting: !!on } })); } catch (_) {}
}

// (No local CSS; UI provided by client/core/ui/knob.js)
