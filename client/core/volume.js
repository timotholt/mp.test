// Shared Volume Utility (plain JS)
// Centralizes master volume state, persistence, events, and slider binding.
// - Source of truth: window.__volume (0..1)
// - Persistence: localStorage['volume']
// - Event: 'ui:volume' with { detail: { volume } }

// export const DEFAULT_WHEEL_STEP = 0.02;
export const DEFAULT_WHEEL_STEP = 0.05;


function clamp01(x) {
  x = Number(x);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function getVolume() {
  try {
    const live = typeof window.__volume === 'number' ? window.__volume : NaN;
    if (Number.isFinite(live)) return clamp01(live);
  } catch (_) {}
  try {
    const saved = parseFloat(localStorage.getItem('volume'));
    if (Number.isFinite(saved)) return clamp01(saved);
  } catch (_) {}
  return 1;
}

export function setVolume(v, opts = {}) {
  const { silent = false } = opts || {};
  const val = clamp01(v);
  try { window.__volume = val; } catch (_) {}
  try { localStorage.setItem('volume', String(val)); } catch (_) {}
  if (!silent) {
    try { window.dispatchEvent(new CustomEvent('ui:volume', { detail: { volume: val } })); } catch (_) {}
  }
  return val;
}

// Binds a range <input type="range" min=0 max=1 step=...> to the master volume.
// Options:
// - withWheel: enable mouse wheel to adjust (default true)
// - emitOnInit: dispatch ui:volume with current value on init (default false)
// - onRender: function(v) -> called whenever the UI should reflect 'v' (e.g., update labels/tooltips)
export function bindRangeToVolume(rangeEl, opts = {}) {
  if (!rangeEl) return () => {};
  const { withWheel = true, emitOnInit = false, onRender } = opts;

  // Initialize UI from current volume
  const initVal = getVolume();
  try { rangeEl.min = '0'; rangeEl.max = '1'; rangeEl.step = rangeEl.step || String(DEFAULT_WHEEL_STEP); } catch (_) {}
  try { rangeEl.value = String(initVal); } catch (_) {}
  try { if (onRender) onRender(initVal); } catch (_) {}
  if (emitOnInit) setVolume(initVal, { silent: false });

  const onInput = () => {
    try {
      const v = parseFloat(rangeEl.value);
      const nv = setVolume(v, { silent: false });
      if (onRender) onRender(nv);
    } catch (_) {}
  };

  const onWheel = (e) => {
    try {
      e.preventDefault();
      const step = parseFloat(rangeEl.step) || DEFAULT_WHEEL_STEP;
      const dir = e.deltaY < 0 ? 1 : -1; // up = louder
      const cur = parseFloat(rangeEl.value);
      const next = clamp01(cur + dir * step);
      if (next !== cur) { rangeEl.value = String(next); onInput(); }
    } catch (_) {}
  };

  const onExternalVolume = (e) => {
    try {
      const v = (e && e.detail && typeof e.detail.volume === 'number') ? e.detail.volume : getVolume();
      const clamped = clamp01(v);
      rangeEl.value = String(clamped);
      if (onRender) onRender(clamped);
    } catch (_) {}
  };

  // Wire events
  try { rangeEl.addEventListener('input', onInput); } catch (_) {}
  if (withWheel) try { rangeEl.addEventListener('wheel', onWheel, { passive: false }); } catch (_) {}
  try { window.addEventListener('ui:volume', onExternalVolume); } catch (_) {}

  // Return unbind function
  return () => {
    try { rangeEl.removeEventListener('input', onInput); } catch (_) {}
    if (withWheel) try { rangeEl.removeEventListener('wheel', onWheel, { passive: false }); } catch (_) {}
    try { window.removeEventListener('ui:volume', onExternalVolume); } catch (_) {}
  };
}
