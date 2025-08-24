// Group-based Volume Utility (plain JS)
// Manages multiple logical volume groups (e.g., MASTER, GAME, MUSIC, VOICE).
// - Source of truth per group: window.__volGroups[groupId] (0..1)
// - Persistence: localStorage['vol:' + groupId]
// - Events per group: 'ui:volume:<groupId>' with { detail: { groupId, value, sourceId } }
// - Binding helper: bindRange(rangeEl, groupId, opts)

export const DEFAULT_WHEEL_STEP = 0.05;

function clamp01(x) {
  x = Number(x);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function ensureGlobals() {
  try { if (!window.__volGroups) window.__volGroups = Object.create(null); } catch (_) {}
  try { if (!window.__volBindSeq) window.__volBindSeq = Object.create(null); } catch (_) {}
}

export function getValue(groupId = 'MASTER', defaultValue = 1) {
  ensureGlobals();
  const gid = String(groupId || 'MASTER');
  try {
    const live = window.__volGroups && typeof window.__volGroups[gid] === 'number' ? window.__volGroups[gid] : NaN;
    if (Number.isFinite(live)) return clamp01(live);
  } catch (_) {}
  try {
    const saved = parseFloat(localStorage.getItem('vol:' + gid));
    if (Number.isFinite(saved)) return clamp01(saved);
  } catch (_) {}
  return clamp01(defaultValue);
}

export function setValue(groupId = 'MASTER', v, opts = {}) {
  ensureGlobals();
  const gid = String(groupId || 'MASTER');
  const { silent = false, sourceId } = opts || {};
  const val = clamp01(v);
  try { window.__volGroups[gid] = val; } catch (_) {}
  try { localStorage.setItem('vol:' + gid, String(val)); } catch (_) {}
  if (!silent) {
    try { window.dispatchEvent(new CustomEvent('ui:volume:' + gid, { detail: { groupId: gid, value: val, sourceId } })); } catch (_) {}
  }
  return val;
}

// Binds a range <input type="range" min=0 max=1 step=...> to a volume group.
// Options:
// - withWheel: enable mouse wheel to adjust (default true)
// - emitOnInit: dispatch ui:volume:<groupId> with current value on init (default false)
// - onRender: function(v) -> called whenever the UI should reflect 'v' (update labels/tooltips)
// Returns: { unbind, sliderId, groupId }
export function bindRange(rangeEl, groupId = 'MASTER', opts = {}) {
  if (!rangeEl) return { unbind: () => {}, sliderId: '', groupId: String(groupId || 'MASTER') };
  ensureGlobals();
  const gid = String(groupId || 'MASTER');
  const { withWheel = true, emitOnInit = false, onRender } = opts || {};

  // Assign a stable slider id for deduping echo
  let sliderId = '';
  try {
    const seq = (window.__volBindSeq[gid] = (window.__volBindSeq[gid] || 0) + 1);
    sliderId = `vol-${gid}-${seq}`;
  } catch (_) { sliderId = `vol-${gid}-x`; }

  // Initialize UI from group value
  const initVal = getValue(gid);
  try { rangeEl.min = '0'; rangeEl.max = '1'; rangeEl.step = rangeEl.step || String(DEFAULT_WHEEL_STEP); } catch (_) {}
  try { rangeEl.value = String(initVal); } catch (_) {}
  try { if (onRender) onRender(initVal); } catch (_) {}
  if (emitOnInit) setValue(gid, initVal, { silent: false, sourceId: sliderId });

  const onInput = () => {
    try {
      const v = parseFloat(rangeEl.value);
      const nv = setValue(gid, v, { silent: false, sourceId: sliderId });
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

  const onExternal = (e) => {
    try {
      const d = e && e.detail ? e.detail : {};
      if (d.sourceId && d.sourceId === sliderId) return; // ignore self
      const v = typeof d.value === 'number' ? d.value : getValue(gid);
      const clamped = clamp01(v);
      rangeEl.value = String(clamped);
      if (onRender) onRender(clamped);
    } catch (_) {}
  };

  try { rangeEl.addEventListener('input', onInput); } catch (_) {}
  if (withWheel) try { rangeEl.addEventListener('wheel', onWheel, { passive: false }); } catch (_) {}
  try { window.addEventListener('ui:volume:' + gid, onExternal); } catch (_) {}

  const unbind = () => {
    try { rangeEl.removeEventListener('input', onInput); } catch (_) {}
    if (withWheel) try { rangeEl.removeEventListener('wheel', onWheel, { passive: false }); } catch (_) {}
    try { window.removeEventListener('ui:volume:' + gid, onExternal); } catch (_) {}
  };

  return { unbind, sliderId, groupId: gid };
}
