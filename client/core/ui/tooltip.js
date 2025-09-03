// Sci-Fi Tooltip Utility (plain JS)
// Provides a single floating tooltip element with neon sci-fi styling.
// API:
//   attachTooltip(el)
//   updateTooltip(el, text)
//   detachTooltip(el)
// Tooltip shows on mouseenter/focus and hides on mouseleave/blur.

let TIP = null; // { el, line, text, visible, target, mx, my }

export function attachTooltip(targetEl, opts = {}) {
  if (!targetEl) return;
  ensureTip();
  // Idempotent: skip re-binding
  if (targetEl.__sfTipBound) return;
  targetEl.__sfTipBound = true;
  // Mode: 'near' (arrow, close) or 'far' (line, distant). Defaults to 'near'.
  try {
    if (opts && typeof opts === 'object') {
      if (opts.mode === 'far' || opts.mode === 'near') targetEl.__sfTipMode = opts.mode;
      if (Number.isFinite(opts.gapRem)) targetEl.__sfTipGapRem = Number(opts.gapRem);
      if (opts.start === 'edge' || opts.start === 'center') targetEl.__sfTipStart = opts.start;
      if (Number.isFinite(opts.startOffset)) targetEl.__sfTipStartOffsetPx = Number(opts.startOffset);
      // Optional placement hint/priority. Accepts string like "t/b/l/r/tl/tr/bl/br/tc/bc/lc/rc" or array of tokens.
      if (typeof opts.placement === 'string') targetEl.__sfTipPlacementPriority = opts.placement;
      else if (Array.isArray(opts.placement)) targetEl.__sfTipPlacementPriority = opts.placement.join(',');
      else if (typeof opts.placementPriority === 'string') targetEl.__sfTipPlacementPriority = opts.placementPriority;
    }
  } catch (_) {}

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
  delete targetEl.__sfTipMode;
  delete targetEl.__sfTipGapRem;
  if (TIP && TIP.target === targetEl) { TIP.visible = false; TIP.target = null; render(); }
}

// Immediately hide any visible tooltip and clear target.
export function hideTooltipNow() {
  try {
    ensureTip();
    if (!TIP) return;
    TIP.visible = false;
    TIP.target = null;
    if (TIP.el) TIP.el.style.display = 'none';
    if (TIP.line) TIP.line.style.display = 'none';
  } catch (_) {}
}

function ensureTip() {
  if (TIP && TIP.el && document.body.contains(TIP.el)) return;
  ensureStyle();
  const el = document.createElement('div');
  el.id = 'sf-tooltip';
  el.className = 'sf-tooltip';
  el.style.display = 'none';
  document.body.appendChild(el);

  const line = document.createElement('div');
  line.id = 'sf-tooltip-line';
  line.className = 'sf-tooltip-line';
  line.style.display = 'none';
  document.body.appendChild(line);

  TIP = { el, line, text: '', visible: false, target: null, mx: 0, my: 0 };
}

function render() {
  if (!TIP || !TIP.el) return;
  const t = TIP.target;
  const text = (t && t.__sfTipText) ? t.__sfTipText : '';
  const mode = (t && t.__sfTipMode) || 'near';
  TIP.text = text;
  TIP.el.textContent = text;
  TIP.el.style.display = TIP.visible && text ? 'block' : 'none';
  // Toggle mode class (controls arrow visibility via CSS)
  try { TIP.el.classList.toggle('far', mode === 'far'); } catch (_) {}
  if (TIP.line) TIP.line.style.display = (TIP.el.style.display === 'block' && mode === 'far') ? 'block' : 'none';
  if (TIP.el.style.display === 'block') position();
}

function position() {
  if (!TIP || !TIP.el) return;
  const pad = 10;
  const t = TIP.target;
  const mode = (t && t.__sfTipMode) || 'near';
  const gap = remToPx(Number.isFinite(t?.__sfTipGapRem) ? t.__sfTipGapRem : (mode === 'far' ? 2.5 : 0.5));
  // If we have a target, anchor to it; otherwise fall back to mouse
  const rt = TIP.target ? TIP.target.getBoundingClientRect() : null;
  const centerX = rt ? (rt.left + rt.width / 2) : TIP.mx;
  const centerY = rt ? (rt.top + rt.height / 2) : TIP.my;

  const r = TIP.el.getBoundingClientRect();
  let x = Math.round(centerX - r.width / 2);
  let y = Math.round(centerY - gap - r.height); // try above by default
  const vw = window.innerWidth || document.documentElement.clientWidth || 800;
  const vh = window.innerHeight || document.documentElement.clientHeight || 600;
  // Try custom placement priority first (e.g., prefer right). If not specified or no fit, fall back to default.
  const priorityRaw = (t && t.__sfTipPlacementPriority) ? String(t.__sfTipPlacementPriority) : '';
  const placements = priorityRaw
    ? priorityRaw.split(/[\s,\/|]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    : null;
  let placedFlag = false;

  if (rt && placements && placements.length) {
    for (const place of placements) {
      const cand = computePlacementFor(place, rt, r, gap);
      if (!cand) continue;
      let cx = cand.x, cy = cand.y;
      // Keep within viewport with padding
      if (cx + r.width + pad > vw) cx = vw - r.width - pad;
      if (cx < pad) cx = pad;
      if (cy + r.height + pad > vh) cy = vh - r.height - pad;
      if (cy < pad) cy = pad;
      // If the candidate still roughly lies on the intended side, accept. Otherwise keep trying.
      if (isPlacementRoughlyOnSide(place, rt, { x: cx, y: cy, w: r.width, h: r.height })) {
        x = Math.round(cx); y = Math.round(cy);
        placedFlag = true;
        break;
      }
    }
    // If none placed, we'll fall back below
  }

  // If not enough space above, place below (default behavior)
  if (!placedFlag) {
    if (y < pad) y = Math.round(centerY + gap);
  }

  if (x + r.width + pad > vw) x = vw - r.width - pad;
  if (x < pad) x = pad;
  if (y + r.height + pad > vh) y = vh - r.height - pad;
  if (y < pad) y = pad;
  TIP.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;

  // Position connector line from target anchor to tooltip edge (far mode only)
  if (TIP.line && mode === 'far') {
    const trW = r.width; const trH = r.height;
    // Endpoint at the nearest edge center of the tooltip box towards the anchor
    const above = (y + trH) <= centerY;
    const endX = x + trW / 2;
    const endY = above ? (y + trH) : y;

    // Determine start point: from target center or edge toward tooltip
    let startX = centerX;
    let startY = centerY;
    const startMode = t && t.__sfTipStart ? t.__sfTipStart : 'edge';
    const startOff = Number.isFinite(t?.__sfTipStartOffsetPx) ? t.__sfTipStartOffsetPx : 6;
    if (rt && startMode === 'edge') {
      const hit = intersectRectTowardsPoint(rt, endX, endY);
      if (hit) { startX = hit.x; startY = hit.y; }
    }
    // Nudge start a little outward toward the tooltip so we don't overlap the target
    {
      const vx = endX - startX; const vy = endY - startY; const vlen = Math.hypot(vx, vy) || 1;
      startX += (vx / vlen) * startOff;
      startY += (vy / vlen) * startOff;
    }

    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.max(0, Math.hypot(dx, dy)); // line touches tooltip
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    TIP.line.style.width = `${Math.round(len)}px`;
    TIP.line.style.transform = `translate(${Math.round(startX)}px, ${Math.round(startY)}px) rotate(${ang}deg)`;
  }
}

function ensureStyle() {
  if (document.getElementById('sf-tooltip-style')) return;
  const st = document.createElement('style');
  st.id = 'sf-tooltip-style';
  st.textContent = `
  .sf-tooltip {
    position: fixed; left: 0; top: 0; z-index: 2147483600; pointer-events: none;
    color: var(--ui-fg, #eee); font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial;
    padding: 6px 8px; border-radius: var(--ui-card-radius, 6px);
    /* Theme variables with fallbacks */
    background: linear-gradient(180deg,
      var(--sf-tip-bg-top, var(--ui-surface-bg-top, rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1))))) 0%,
      var(--sf-tip-bg-bottom, var(--ui-surface-bg-bottom, rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1))))) 100%
    );
    border: 1px solid var(--sf-tip-border, var(--ui-surface-border));
    box-shadow: var(--sf-tip-glow-outer, var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33))),
                var(--sf-tip-glow-inset, var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18)));
    text-shadow: var(--sf-tip-text-glow, 0 0 9px rgba(120,170,255,0.70));
    backdrop-filter: var(--sf-tip-backdrop, blur(4px) saturate(1.2));
    transform: translate(-9999px, -9999px);
  }
  .sf-tooltip::after {
    content: '';
    position: absolute; width: 8px; height: 8px; left: 10px; top: 100%;
    background: linear-gradient(180deg,
      var(--sf-tip-bg-top, var(--ui-surface-bg-top, rgba(10,18,26, calc(0.41 * var(--ui-opacity-mult, 1))))) 0%,
      var(--sf-tip-bg-bottom, var(--ui-surface-bg-bottom, rgba(10,16,22, calc(0.40 * var(--ui-opacity-mult, 1))))) 100%
    );
    border-right: 1px solid var(--sf-tip-border, var(--ui-surface-border));
    border-bottom: 1px solid var(--sf-tip-border, var(--ui-surface-border));
    transform: translateY(-4px) rotate(45deg);
    filter: var(--sf-tip-arrow-glow, drop-shadow(0 0 9px rgba(120,170,255,0.35)));
  }
  .sf-tooltip.far::after { content: none; }
  .sf-tooltip-line {
    position: fixed; left: 0; top: 0; height: 1px; width: 0; z-index: 2147483599;
    pointer-events: none;
    /* Match tooltip outline hue/glow via theme variables */
    background: var(--sf-tip-line-color, var(--ui-surface-border));
    box-shadow: var(--sf-tip-line-glow-outer, 0 0 18px rgba(120,170,255,0.33)),
               var(--sf-tip-line-glow-core, 0 0 3px rgba(120,170,255,0.70));
    transform-origin: 0 50%;
  }
  `;
  document.head.appendChild(st);
}

// Compute intersection point between the center of rect and a target point (tx, ty)
// returning the point where the ray exits the rectangle boundary.
function intersectRectTowardsPoint(rect, tx, ty) {
  // Ray origin: rectangle center
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = tx - cx; const dy = ty - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return { x: cx, y: cy };
  // Compute t at which the ray hits each side; pick the smallest positive
  const tVals = [];
  if (Math.abs(dx) > 1e-6) {
    const t1 = (rect.left - cx) / dx; // left side
    const y1 = cy + t1 * dy; if (t1 >= 0 && y1 >= rect.top && y1 <= rect.bottom) tVals.push({ t: t1, x: rect.left, y: y1 });
    const t2 = (rect.right - cx) / dx; // right side
    const y2 = cy + t2 * dy; if (t2 >= 0 && y2 >= rect.top && y2 <= rect.bottom) tVals.push({ t: t2, x: rect.right, y: y2 });
  }
  if (Math.abs(dy) > 1e-6) {
    const t3 = (rect.top - cy) / dy; // top side
    const x3 = cx + t3 * dx; if (t3 >= 0 && x3 >= rect.left && x3 <= rect.right) tVals.push({ t: t3, x: x3, y: rect.top });
    const t4 = (rect.bottom - cy) / dy; // bottom side
    const x4 = cx + t4 * dx; if (t4 >= 0 && x4 >= rect.left && x4 <= rect.right) tVals.push({ t: t4, x: x4, y: rect.bottom });
  }
  if (!tVals.length) return { x: cx, y: cy };
  tVals.sort((a,b) => a.t - b.t);
  return { x: tVals[0].x, y: tVals[0].y };
}

function remToPx(rem) {
  try {
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return Math.round(rem * fs);
  } catch (_) { return Math.round(rem * 16); }
}

// Compute top-left (x,y) for a given placement token relative to target rect (rt)
// Supported tokens: t, b, l, r, tl, tr, bl, br, tc, bc, lc, rc
function computePlacementFor(token, rt, tipRect, gapPx) {
  try {
    const t = String(token || '').toLowerCase();
    const w = tipRect.width, h = tipRect.height;
    const cx = rt.left + rt.width / 2;
    const cy = rt.top + rt.height / 2;
    const top = rt.top - gapPx - h;
    const bottom = rt.bottom + gapPx;
    const left = rt.left - gapPx - w;
    const right = rt.right + gapPx;
    switch (t) {
      case 't':
      case 'tc': return { x: Math.round(cx - w / 2), y: Math.round(top) };
      case 'b':
      case 'bc': return { x: Math.round(cx - w / 2), y: Math.round(bottom) };
      case 'l':
      case 'lc': return { x: Math.round(left), y: Math.round(cy - h / 2) };
      case 'r':
      case 'rc': return { x: Math.round(right), y: Math.round(cy - h / 2) };
      case 'tl': return { x: Math.round(left), y: Math.round(rt.top) };
      case 'tr': return { x: Math.round(right), y: Math.round(rt.top) };
      case 'bl': return { x: Math.round(left), y: Math.round(rt.bottom - h) };
      case 'br': return { x: Math.round(right), y: Math.round(rt.bottom - h) };
      default: return null;
    }
  } catch (_) { return null; }
}

// Heuristic check: does the tooltip rect lie roughly on the intended side of the target?
function isPlacementRoughlyOnSide(token, rt, tipBox) {
  try {
    const t = String(token || '').toLowerCase();
    const cx = rt.left + rt.width / 2;
    const cy = rt.top + rt.height / 2;
    const leftSide = tipBox.x + tipBox.w <= cx;
    const rightSide = tipBox.x >= cx;
    const topSide = tipBox.y + tipBox.h <= cy;
    const bottomSide = tipBox.y >= cy;
    if (t === 'l' || t === 'lc' || t === 'tl' || t === 'bl') return leftSide;
    if (t === 'r' || t === 'rc' || t === 'tr' || t === 'br') return rightSide;
    if (t === 't' || t === 'tc' || t === 'tl' || t === 'tr') return topSide;
    if (t === 'b' || t === 'bc' || t === 'bl' || t === 'br') return bottomSide;
    return true;
  } catch (_) { return true; }
}
