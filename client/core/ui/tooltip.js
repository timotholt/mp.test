// Sci-Fi Tooltip Utility (plain JS)
// Provides a single floating tooltip element with neon sci-fi styling.
// API:
//   attachTooltip(el)
//   updateTooltip(el, text)
//   detachTooltip(el)
// Tooltip shows on mouseenter/focus and hides on mouseleave/blur.

let TIP = null; // { el, text, visible, target, mx, my }

export function attachTooltip(targetEl) {
  if (!targetEl) return;
  ensureTip();
  // Idempotent: skip re-binding
  if (targetEl.__sfTipBound) return;
  targetEl.__sfTipBound = true;

  const onEnter = () => {
    try {
      TIP.target = targetEl;
      TIP.visible = true;
      render();
    } catch (_) {}
  };
  const onMove = (e) => {
    try {
      if (!TIP.visible || TIP.target !== targetEl) return;
      TIP.mx = e.clientX;
      TIP.my = e.clientY;
      position();
    } catch (_) {}
  };
  const onLeave = () => {
    try {
      if (TIP.target === targetEl) {
        TIP.visible = false;
        TIP.target = null;
        render();
      }
    } catch (_) {}
  };
  const onFocus = () => {
    try {
      TIP.target = targetEl;
      TIP.visible = true;
      // Center above the element if keyboard focus
      const r = targetEl.getBoundingClientRect();
      TIP.mx = Math.round(r.left + r.width / 2);
      TIP.my = Math.round(r.top - 8);
      render();
    } catch (_) {}
  };
  const onBlur = onLeave;

  // Store refs for cleanup
  targetEl.__sfTipHandlers = { onEnter, onMove, onLeave, onFocus, onBlur };

  try { targetEl.addEventListener('mouseenter', onEnter); } catch (_) {}
  try { targetEl.addEventListener('mousemove', onMove); } catch (_) {}
  try { targetEl.addEventListener('mouseleave', onLeave); } catch (_) {}
  try { targetEl.addEventListener('focus', onFocus); } catch (_) {}
  try { targetEl.addEventListener('blur', onBlur); } catch (_) {}
}

export function updateTooltip(targetEl, text) {
  ensureTip();
  try { targetEl.__sfTipText = String(text ?? ''); } catch (_) {}
  if (TIP.target === targetEl) {
    TIP.text = targetEl.__sfTipText || '';
    render();
  }
}

export function detachTooltip(targetEl) {
  if (!targetEl || !targetEl.__sfTipBound) return;
  targetEl.__sfTipBound = false;
  const h = targetEl.__sfTipHandlers || {};
  try { targetEl.removeEventListener('mouseenter', h.onEnter); } catch (_) {}
  try { targetEl.removeEventListener('mousemove', h.onMove); } catch (_) {}
  try { targetEl.removeEventListener('mouseleave', h.onLeave); } catch (_) {}
  try { targetEl.removeEventListener('focus', h.onFocus); } catch (_) {}
  try { targetEl.removeEventListener('blur', h.onBlur); } catch (_) {}
  delete targetEl.__sfTipHandlers;
  delete targetEl.__sfTipText;
  if (TIP && TIP.target === targetEl) { TIP.visible = false; TIP.target = null; render(); }
}

function ensureTip() {
  if (TIP && TIP.el && document.body.contains(TIP.el)) return;
  ensureStyle();
  const el = document.createElement('div');
  el.id = 'sf-tooltip';
  el.className = 'sf-tooltip';
  el.style.display = 'none';
  document.body.appendChild(el);
  TIP = { el, text: '', visible: false, target: null, mx: 0, my: 0 };
}

function render() {
  if (!TIP || !TIP.el) return;
  const t = TIP.target;
  const text = (t && t.__sfTipText) ? t.__sfTipText : '';
  TIP.text = text;
  TIP.el.textContent = text;
  TIP.el.style.display = TIP.visible && text ? 'block' : 'none';
  if (TIP.el.style.display === 'block') position();
}

function position() {
  if (!TIP || !TIP.el) return;
  const pad = 10;
  const preferY = -16; // above cursor
  let x = TIP.mx + 14;
  let y = TIP.my + preferY;
  const r = TIP.el.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth || 800;
  const vh = window.innerHeight || document.documentElement.clientHeight || 600;
  if (x + r.width + pad > vw) x = vw - r.width - pad;
  if (x < pad) x = pad;
  if (y + r.height + pad > vh) y = vh - r.height - pad;
  if (y < pad) y = pad;
  TIP.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function ensureStyle() {
  if (document.getElementById('sf-tooltip-style')) return;
  const st = document.createElement('style');
  st.id = 'sf-tooltip-style';
  st.textContent = `
  .sf-tooltip {
    position: fixed; left: 0; top: 0; z-index: 2147483600; pointer-events: none;
    color: #dff1ff; font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial;
    padding: 6px 8px; border-radius: 6px;
    background: linear-gradient(180deg, rgba(10,18,26,0.92) 0%, rgba(10,16,22,0.88) 100%);
    border: 1px solid rgba(120,170,255,0.45);
    box-shadow: 0 0 12px rgba(120,170,255,0.22), inset 0 0 12px rgba(40,100,200,0.12);
    text-shadow: 0 0 6px rgba(120,170,255,0.7);
    backdrop-filter: blur(4px) saturate(1.2);
    transform: translate(-9999px, -9999px);
  }
  .sf-tooltip::after {
    content: '';
    position: absolute; width: 8px; height: 8px; left: 10px; top: 100%;
    background: linear-gradient(180deg, rgba(10,18,26,0.92) 0%, rgba(10,16,22,0.88) 100%);
    border-right: 1px solid rgba(120,170,255,0.45);
    border-bottom: 1px solid rgba(120,170,255,0.45);
    transform: translateY(-4px) rotate(45deg);
    filter: drop-shadow(0 0 6px rgba(120,170,255,0.25));
  }
  `;
  document.head.appendChild(st);
}
