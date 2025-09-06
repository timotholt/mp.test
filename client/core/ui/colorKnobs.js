// Color Knobs (Hue / Saturation / Intensity)
// Plain JS helpers built on top of the generic knob in './knob.js'
// - Hue knob: continuous spectrum ring (segments=-1)
// - Saturation knob: spectrum ring from monochrome -> fully saturated (at constant lightness)
// - Intensity knob: maps 0..100 intensity into saturation/lightness using the same logic as themeManager
//
// Uses OKLCH when supported to better preserve perceived lightness; falls back to HSL.
// Minimal, human-readable code with comments per user guidelines.

import { createKnob } from './knob.js';

// Throttle: minimum time between hue change broadcasts while dragging (ms)
export const HUE_EVENT_MIN_INTERVAL_MS = 0;
// Throttle: minimum time between spectrum recolors for Sat/Bri when hue changes
export const RING_RECOLOR_MIN_INTERVAL_MS = 200;

// ---------------------------------------------------------------
// Shared knob defaults (arc-style knobs): size, steps, angles, arc sweep
// ---------------------------------------------------------------
export const KNOB_SIZE_PX_DEFAULT = 64;
export const KNOB_STEP_DEFAULT = 5;                 // coarse drag step (percent)
export const KNOB_WHEEL_FINE_STEP_DEFAULT = 1;      // fine wheel step (percent)
export const ARC_ANGLE_MIN_DEG = -135;
export const ARC_ANGLE_MAX_DEG = 135;
// Arc orientation and sampling (bottom-centered cutout)
export const RING_ARC_LEN_DEG = 270;                // -135..+135 sweep
export const RING_ARC_FROM_DEG = 225;               // start angle -> cutout at 6 o'clock
export const RING_SAMPLE_STEP_DEG = 10;             // sampling for gradient stops

// ---------------------------------------------------------------
// Hue Knob Visual Tuning (single source of truth; easy to tweak)
// All distances are in rem unless otherwise noted; 1rem is relative to root font-size
// ---------------------------------------------------------------
export const HUE_RING_THICKNESS_REM = 0.30;  // ring thickness in rem (0.625rem ≈ 10px @16px)
export const HUE_RING_EDGE_INSET_REM = 0.0;   // inset from knob edge in rem (0 = flush)
export const HUE_RING_SCALE = 1.50;           // overall ring scale (unitless)
export const HUE_RING_OFFSET_Y_REM = 0;    // vertical offset in rem (negative = up)
export const HUE_DOT_DIAM_REM = 0.3;         // dot diameter in rem (0.5rem ≈ 8px @16px)
export const HUE_RING_FEATHER_REM = 0.01;    // soft edge width for AA (rem). ~1.28px @16px
export const HUE_RING_ROTATE_DEG = 215;      // conic-gradient start angle in degrees (rotates the wheel)

function remBasePx() {
  try { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; } catch (_) { return 16; }
}

// Keep vertical offset reactive without recreating the knob: use a root CSS var.
function applyHueRootVars() {
  try { document.documentElement.style.setProperty('--hue-ring-offset', `${HUE_RING_OFFSET_Y_REM}rem`); } catch (_) {}
}
applyHueRootVars();

// ---- Color utilities (OKLCH with HSL fallback) ----
function supportsOKLCH() {
  try {
    // Spec requires percent on L; C is unitless; hue is degrees
    return CSS && CSS.supports && CSS.supports('color', 'oklch(62.8% 0.26 264)');
  } catch (_) { return false; }
}

const HAS_OKLCH = supportsOKLCH();

// Convert (h, s, l) to CSS color string. If HAS_OKLCH, we prefer OKLCH for better perceptual uniformity.
// For OKLCH mapping we treat s (0..100) as chroma scaled into a conservative [0..0.33] range to avoid out-of-gamut.
// For hue knob and saturation knob we keep L constant (default 65%) to preserve perceived intensity.
function colorFromHSLC({ h, s = 70, l = 65, alpha = 1, fixedChroma = null, fixedLight = null }) {
  h = Number(h || 0);
  s = Math.max(0, Math.min(100, Number(s)));
  l = Math.max(0, Math.min(100, Number(l)));
  alpha = Math.max(0, Math.min(1, Number(alpha)));

  if (HAS_OKLCH) {
    // Use constant-lightness OKLCH when possible
    const L = (fixedLight != null) ? Number(fixedLight) : l; // percent
    // C maps from HSL saturation approximately into 0..0.33 range; optionally override with fixed chroma
    const C = fixedChroma != null ? Math.max(0, Number(fixedChroma)) : (s / 100) * 0.33;
    const A = alpha;
    // Alpha must be inside the oklch(...) function
    return `oklch(${L}% ${C.toFixed(4)} ${h.toFixed(2)} / ${A})`;
  }

  // Fallback: HSL
  const base = `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
  if (alpha >= 1) return base;
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}% / ${alpha})`;
}

// Helpers to read current theme hue/intensity for ring previews
function getRoot() { return document.documentElement; }
function readCssNumber(name, fallback) {
  try {
    const v = parseFloat(getComputedStyle(getRoot()).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  } catch (_) { return fallback; }
}

function currentHue() { return readCssNumber('--ui-hue', 210); }
function currentIntensity() { return readCssNumber('--ui-intensity', 60); }

// Mirror themeManager.js mapping so saturation previews align with current intensity
function satFromIntensity(intensity) { return Math.max(0, Math.min(85, intensity * 0.8)); }

// Lightness mapping mirrors themeManager with low-end compression (smoothstep over 0..10)
function lightnessFromIntensity(I) {
  I = Math.max(0, Math.min(100, Number(I)));
  if (I <= 0) return 0;
  const baseLight = Math.max(0, Math.min(80, 45 + (I - 60) * 0.38));
  const tEase = Math.min(1, I / 10);
  const smooth = tEase * tEase * (3 - 2 * tEase);
  return Math.max(0, Math.min(80, Math.round(baseLight * smooth)));
}

export const TEXT_BRI_MIN_L = 38;

// ---- Title formatters ----
const tfHue = (v) => `Hue: ${Math.round(v)}°`;
const tfPct = (label) => (v, { min, max }) => {
  const range = Math.max(0.000001, max - min);
  const pct = Math.round(((v - min) / range) * 100);
  return `${label}: ${pct}%`;
};

// ---- Knobs ----
export function createHueKnob(opts = {}) {
  const initial = Number.isFinite(opts.value) ? opts.value : currentHue();
  // Track last time we broadcasted a hue change to coalesce redraws in listeners
  let _lastHueEventAt = 0;

  const kn = createKnob({
    min: 0,
    max: 360,
    value: initial,
    // Wheel/key increment: match ~5% of range like volume knobs (0..360 -> 18)
    step: (opts.step != null ? opts.step : 18),
    // Fine wheel increment: 1 degree for subtle wheel moves
    wheelFineStep: (opts.wheelFineStep != null ? opts.wheelFineStep : 1),
    size: opts.size || KNOB_SIZE_PX_DEFAULT,
    label: opts.label || 'Hue',
    // Use CSS conic-gradient for the hue ring (no micro-segments)
    segments: 0,
    // Full 360° sweep for Hue
    angleMin: -180,
    angleMax: 180,
    titleFormatter: tfHue,
    onInput: (v) => {
      try {
        const TS = (typeof window !== 'undefined') ? window.ThemeScheduler : null;
        if (TS && TS.schedule) { try { TS.beginDrag(); } catch (_) {} try { TS.schedule({ hue: v, transient: true }); } catch (_) {} }
        else { try { window.UITheme?.applyDynamicTheme?.({ hue: v, transient: true }); } catch (_) {} }
      } catch (_) {}
      // Notify other knobs so they can recolor their spectrum rings (throttled)
      try {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (now - _lastHueEventAt >= HUE_EVENT_MIN_INTERVAL_MS) {
          window.dispatchEvent(new CustomEvent('ui:hue-changed', { detail: { hue: v } }));
          _lastHueEventAt = now;
        }
      } catch (_) {}
      if (typeof opts.onInput === 'function') { try { opts.onInput(v); } catch (_) {} }
    },
    onChange: (v) => {
      try {
        const TS = (typeof window !== 'undefined') ? window.ThemeScheduler : null;
        if (TS && TS.endDrag) { try { TS.endDrag({ hue: v }); } catch (_) {} }
        else { try { window.UITheme?.applyDynamicTheme?.({ hue: v }); } catch (_) {} }
      } catch (_) {}
      // Always emit a final event on change (pointer up), regardless of throttle
      try {
        window.dispatchEvent(new CustomEvent('ui:hue-changed', { detail: { hue: v } }));
        _lastHueEventAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      } catch (_) {}
      if (typeof opts.onChange === 'function') { try { opts.onChange(v); } catch (_) {} }
    },
    theme: opts.theme,
    // Tag for live updates (used by applyHueConstantsToAll)
    className: (opts.className ? 'hue-knob ' + opts.className : 'hue-knob'),
    // Default ring offset creates a small gap between knob face and color ring
    ringOffset: (opts.ringOffset ?? 18),
    segThickness: 16,
    // Use tuning constants for band and dot (convert rem -> px here for the generic knob API)
    segLength: Math.round(HUE_RING_THICKNESS_REM * remBasePx()),
    dotSize: Math.round(HUE_DOT_DIAM_REM * remBasePx()),
  });

  // Tooltips: show below knob with connector line (far mode, bottom-center placement)
  try {
    if (kn && kn.el) {
      kn.el.__sfTipMode = 'far';
      kn.el.__sfTipPlacementPriority = 'bc,b';
    }
  } catch (_) {}

  // Paint the hue ring using a CSS conic-gradient + radial mask (donut)
  try {
    // Find the ring element created by the generic knob
    const ring = kn && kn.el ? kn.el.querySelector('.k-ring') : null;
    if (ring) {
      // Build a full-spectrum conic gradient
      // Align gradient with knob value/angle mapping:
      // - hue 0/360 -> ang -180/180 -> dot at 6 o'clock -> red at bottom
      // - hue 180    -> ang 0       -> dot at 12 o'clock -> cyan at top
      // Use pinned stops every 45° for 8 equal slices; rotation via constant
      ring.style.background = `conic-gradient(from ${HUE_RING_ROTATE_DEG}deg,
        hsl(0 100% 50%) 0deg,
        hsl(45 100% 50%) 45deg,
        hsl(90 100% 50%) 90deg,
        hsl(135 100% 50%) 135deg,
        hsl(180 100% 50%) 180deg,
        hsl(225 100% 50%) 225deg,
        hsl(270 100% 50%) 270deg,
        hsl(315 100% 50%) 315deg,
        hsl(360 100% 50%) 360deg)`;
      // Compute ring geometry based on provided options or sensible defaults
      const size = Number.isFinite(Number(opts.size)) ? Number(opts.size) : KNOB_SIZE_PX_DEFAULT;
      // Band thickness and edge inset from tuning constants (convert rem -> px)
      const thicknessOpt = (opts.segLength != null) ? Number(opts.segLength) : (HUE_RING_THICKNESS_REM * remBasePx());
      const edgeInset = (HUE_RING_EDGE_INSET_REM * remBasePx()); // px
      const outerR = Math.max(10, Math.floor(size / 2) - edgeInset);
      const innerBase = Math.max(1, outerR - thicknessOpt);
      // Simple, predictable donut: no dynamic rem math; inner radius = outer - thickness
      const innerR = innerBase;
      // Feather edges to improve anti-aliasing on both inner and outer rims
      const feather = Math.max(0.5, HUE_RING_FEATHER_REM * remBasePx());
      const i0 = Math.max(0, innerR - feather);
      const i1 = innerR;
      const o0 = outerR;
      const o1 = outerR + feather;
      const mask = `radial-gradient(circle at 50% 50%, transparent ${i0}px, white ${i1}px, white ${o0}px, transparent ${o1}px)`;
    // Align gradient with knob angle mapping and pin 45° stops (live); rotation via constant
    try {
      ring.style.background = `conic-gradient(from ${HUE_RING_ROTATE_DEG}deg,
        hsl(0 100% 50%) 0deg,
        hsl(45 100% 50%) 45deg,
        hsl(90 100% 50%) 90deg,
        hsl(135 100% 50%) 135deg,
        hsl(180 100% 50%) 180deg,
        hsl(225 100% 50%) 225deg,
        hsl(270 100% 50%) 270deg,
        hsl(315 100% 50%) 315deg,
        hsl(360 100% 50%) 360deg)`;
    } catch (_) {}
      try { ring.style.webkitMaskImage = mask; } catch (_) {}
      try { ring.style.maskImage = mask; } catch (_) {}
      try { ring.style.maskMode = 'alpha'; ring.style.webkitMaskComposite = 'source-over'; } catch (_) {}
      // Hint the browser for smoother animation/rendering
      try { ring.style.willChange = 'transform, -webkit-mask-image, mask-image'; } catch (_) {}
      try { ring.style.opacity = '1'; } catch (_) {}
      // Apply tuning constants for scale and vertical offset (offset via root CSS var for live updates)
      try { ring.style.transformOrigin = '50% 50%'; ring.style.transform = `translateY(var(--hue-ring-offset, var(--kn-ring-global-y, 0px))) scale(${Number(HUE_RING_SCALE).toFixed(3)})`; } catch (_) {}
    }
  } catch (_) {}

  // Hue ring colors are static (full spectrum); no need to recolor on hue changes
  

  return kn;
}

export function createTextBrightnessKnob(opts = {}) {
  // 0..100 foreground text brightness; preview ring is grayscale dark -> light
  const min = 0, max = 100;
  const initial = Number.isFinite(opts.value) ? opts.value : 50;

  const kn = createKnob({
    min,
    max,
    value: initial,
    step: (opts.step != null ? opts.step : KNOB_STEP_DEFAULT),
    wheelFineStep: (opts.wheelFineStep != null ? opts.wheelFineStep : KNOB_WHEEL_FINE_STEP_DEFAULT),
    size: opts.size || KNOB_SIZE_PX_DEFAULT,
    label: opts.label || 'Text Brightness',
    // CSS conic-gradient (no segments)
    segments: 0,
    angleMin: ARC_ANGLE_MIN_DEG,
    angleMax: ARC_ANGLE_MAX_DEG,
    titleFormatter: tfPct('Text Brightness'),
    onInput: (v) => {
      try {
        const vv = Math.round(v);
        const TS = (typeof window !== 'undefined') ? window.ThemeScheduler : null;
        if (TS && TS.schedule) { try { TS.beginDrag(); } catch (_) {} try { TS.schedule({ fgBrightness: vv, transient: true }); } catch (_) {} }
        else { try { window.UITheme?.applyDynamicTheme?.({ fgBrightness: vv, transient: true }); } catch (_) {} }
      } catch (_) {}
      if (typeof opts.onInput === 'function') { try { opts.onInput(v); } catch (_) {} }
    },
    onChange: (v) => {
      try {
        const vv = Math.round(v);
        const TS = (typeof window !== 'undefined') ? window.ThemeScheduler : null;
        if (TS && TS.endDrag) { try { TS.endDrag({ fgBrightness: vv }); } catch (_) {} }
        else { try { window.UITheme?.applyDynamicTheme?.({ fgBrightness: vv }); } catch (_) {} }
      } catch (_) {}
      if (typeof opts.onChange === 'function') { try { opts.onChange(v); } catch (_) {} }
    },
    theme: opts.theme,
    className: opts.className,
    ringOffset: (opts.ringOffset ?? 22),
    segThickness: 2,
    segLength: 10,
    dotSize: 6,
  });

  // Tooltips: show below knob with connector line (far mode, bottom-center placement)
  try {
    if (kn && kn.el) {
      kn.el.__sfTipMode = 'far';
      kn.el.__sfTipPlacementPriority = 'bc,b';
    }
  } catch (_) {}

  // Paint the grayscale ring as an arc-only conic-gradient + donut mask
  try {
    const ring = kn && kn.el ? kn.el.querySelector('.k-ring') : null;
    if (ring) {
      const size = Number.isFinite(Number(opts.size)) ? Number(opts.size) : KNOB_SIZE_PX_DEFAULT;
      const mask = buildStandardRingMask(size);

      const buildGradient = () => buildArcGradient(
        RING_ARC_FROM_DEG,
        RING_ARC_LEN_DEG,
        RING_SAMPLE_STEP_DEG,
        (t) => {
          const l = Math.max(0, Math.min(100, Math.round(38 + t * (100 - 38))));
          return colorFromHSLC({ h: 0, s: 0, l, alpha: 1, fixedChroma: 0 });
        }
      );

      try { ring.style.background = buildGradient(); } catch (_) {}
      applyStandardRingSkin(ring, mask);
    }
  } catch (_) {}

  return kn;
}

// --- Live reapply utilities (so constant tweaks take effect without recreating the modal) ---
export function applyHueConstantsTo(el) {
  try {
    if (!el || !el.classList || !el.classList.contains('hue-knob')) return;
    const ring = el.querySelector('.k-ring');
    if (!ring) return;
    const csEl = getComputedStyle(el);
    const sizePx = parseFloat(csEl.width) || 64;
    const rem = remBasePx();
    const thickness = Math.max(1, HUE_RING_THICKNESS_REM * rem);
    const edgeInsetPx = Math.max(0, HUE_RING_EDGE_INSET_REM * rem);
    const outerR = Math.max(10, Math.floor(sizePx / 2) - edgeInsetPx);
    const innerR = Math.max(1, outerR - thickness);
    const feather = Math.max(0.5, HUE_RING_FEATHER_REM * rem);
    const i0 = Math.max(0, innerR - feather);
    const i1 = innerR;
    const o0 = outerR;
    const o1 = outerR + feather;
    const mask = `radial-gradient(circle at 50% 50%, transparent ${i0}px, white ${i1}px, white ${o0}px, transparent ${o1}px)`;
    try { ring.style.webkitMaskImage = mask; } catch (_) {}
    try { ring.style.maskImage = mask; } catch (_) {}
    try { ring.style.maskMode = 'alpha'; ring.style.webkitMaskComposite = 'source-over'; } catch (_) {}
    try { ring.style.willChange = 'transform, -webkit-mask-image, mask-image'; } catch (_) {}
    try { ring.style.transformOrigin = '50% 50%'; ring.style.transform = `translateY(var(--hue-ring-offset, var(--kn-ring-global-y, 0px))) scale(${Number(HUE_RING_SCALE).toFixed(3)})`; } catch (_) {}
    // Update the root var so offset takes effect on all rings without recreation
    applyHueRootVars();
    // Override dot size via CSS var so we don't need to recreate the knob
    try { el.style.setProperty('--kn-dot-size', `${HUE_DOT_DIAM_REM}rem`); } catch (_) {}
  } catch (_) {}
}

export function applyHueConstantsToAll() {
  try { document.querySelectorAll('.hue-knob').forEach((el) => applyHueConstantsTo(el)); } catch (_) {}
}

// --- Shared utility: build a feathered donut mask (thickness/edge/feather in px) ---
// This matches the Hue knob geometry and keeps thickness/AA consistent across knobs.
function buildDonutMask(sizePx, thicknessPx, edgeInsetPx, featherPx) {
  const outerR = Math.max(10, Math.floor(sizePx / 2) - Math.max(0, edgeInsetPx || 0));
  const innerR = Math.max(1, outerR - Math.max(1, thicknessPx || 1));
  const feather = Math.max(0.5, featherPx || 0.5);
  const i0 = Math.max(0, innerR - feather);
  const i1 = innerR;
  const o0 = outerR;
  const o1 = outerR + feather;
  return `radial-gradient(circle at 50% 50%, transparent ${i0}px, white ${i1}px, white ${o0}px, transparent ${o1}px)`;
}

// Build a standard feathered donut mask using Hue geometry constants
function buildStandardRingMask(sizePx) {
  const rem = remBasePx();
  const thicknessPx = Math.max(1, HUE_RING_THICKNESS_REM * rem);
  const edgeInsetPx = Math.max(0, HUE_RING_EDGE_INSET_REM * rem);
  const featherPx = Math.max(0.5, HUE_RING_FEATHER_REM * rem);
  return buildDonutMask(sizePx, thicknessPx, edgeInsetPx, featherPx);
}

// Apply common ring chrome (mask, hints, transform/scale)
function applyStandardRingSkin(ring, mask) {
  try { ring.style.webkitMaskImage = mask; } catch (_) {}
  try { ring.style.maskImage = mask; } catch (_) {}
  try { ring.style.maskMode = 'alpha'; ring.style.webkitMaskComposite = 'source-over'; } catch (_) {}
  try { ring.style.willChange = 'transform, -webkit-mask-image, mask-image, background'; } catch (_) {}
  try { ring.style.opacity = '1'; } catch (_) {}
  try { ring.style.transformOrigin = '50% 50%'; ring.style.transform = `translateY(var(--hue-ring-offset, var(--kn-ring-global-y, 0px))) scale(${Number(HUE_RING_SCALE).toFixed(3)})`; } catch (_) {}
}

// Generic arc gradient builder; colorAtT receives t in [0,1] over the arc
function buildArcGradient(fromDeg, arcLenDeg, stepDeg, colorAtT) {
  const stops = [];
  for (let ang = 0; ang <= arcLenDeg; ang += stepDeg) {
    const t = Math.min(1, Math.max(0, ang / arcLenDeg));
    let col = '#000';
    try { col = colorAtT(t) || '#000'; } catch (_) {}
    stops.push(`${col} ${ang}deg`);
  }
  stops.push(`transparent ${arcLenDeg}deg`, 'transparent 360deg');
  return `conic-gradient(from ${fromDeg}deg, ${stops.join(', ')})`;
}

export function createSaturationKnob(opts = {}) {
  // 0..100 logical saturation; preview uses constant lightness with increasing chroma
  const min = 0, max = 100;
  const initial = Number.isFinite(opts.value) ? opts.value : satFromIntensity(currentIntensity());

  const kn = createKnob({
    min,
    max,
    value: initial,
    // Wheel/key increment: ~5% of range for easier wheel control
    step: (opts.step != null ? opts.step : KNOB_STEP_DEFAULT),
    // Fine wheel increment: 1% for subtle wheel moves
    wheelFineStep: (opts.wheelFineStep != null ? opts.wheelFineStep : KNOB_WHEEL_FINE_STEP_DEFAULT),
    size: opts.size || KNOB_SIZE_PX_DEFAULT,
    label: opts.label || 'Saturation',
    // Use CSS conic-gradient for the saturation ring (no micro-segments)
    segments: 0,
    angleMin: ARC_ANGLE_MIN_DEG,
    angleMax: ARC_ANGLE_MAX_DEG,
    titleFormatter: tfPct('Saturation'),
    onInput: (v) => {
      // Reflect on CSS var and apply to theme as explicit saturation override (0..100)
      const vv = Math.round(v);
      // Guard to avoid reacting to our own broadcast below
      kn.__userAdjusting = true;
      try {
        const TS = (typeof window !== 'undefined') ? window.ThemeScheduler : null;
        if (TS && TS.schedule) { try { TS.beginDrag(); } catch (_) {} try { TS.schedule({ saturation: vv, transient: true }); } catch (_) {} }
        else { try { window.UITheme?.applyDynamicTheme?.({ saturation: vv, transient: true }); } catch (_) {} }
      } catch (_) {}
      kn.__userAdjusting = false;
      if (typeof opts.onInput === 'function') { try { opts.onInput(v); } catch (_) {} }
    },
    onChange: (v) => {
      const vv = Math.round(v);
      try { getRoot().style.setProperty('--ui-saturation', String(vv)); } catch (_) {}
      kn.__userAdjusting = true;
      try {
        const TS = (typeof window !== 'undefined') ? window.ThemeScheduler : null;
        if (TS && TS.endDrag) { try { TS.endDrag({ saturation: vv }); } catch (_) {} }
        else { try { window.UITheme?.applyDynamicTheme?.({ saturation: vv }); } catch (_) {} }
      } catch (_) {}
      kn.__userAdjusting = false;
      if (typeof opts.onChange === 'function') { try { opts.onChange(v); } catch (_) {} }
    },
    theme: opts.theme,
    className: opts.className,
    // Default ring offset creates a small gap between knob face and color ring
    ringOffset: (opts.ringOffset ?? 22),
    segThickness: 2,
    segLength: 10,
    dotSize: 6,
  });

  // Tooltips: show below knob with connector line (far mode, bottom-center placement)
  try {
    if (kn && kn.el) {
      kn.el.__sfTipMode = 'far';
      kn.el.__sfTipPlacementPriority = 'bc,b';
    }
  } catch (_) {}

  // Paint the saturation ring using a CSS conic-gradient + radial mask (donut), arc-only
  try {
    const ring = kn && kn.el ? kn.el.querySelector('.k-ring') : null;
    if (ring) {
      const size = Number.isFinite(Number(opts.size)) ? Number(opts.size) : KNOB_SIZE_PX_DEFAULT;
      const mask = buildStandardRingMask(size);

      let _hueForPreview = currentHue();
      let _intensityForPreview = currentIntensity();

      const buildGradient = () => buildArcGradient(
        RING_ARC_FROM_DEG,
        RING_ARC_LEN_DEG,
        RING_SAMPLE_STEP_DEG,
        (t) => {
          const h = _hueForPreview;
          const I = Math.round(_intensityForPreview);
          const s = Math.round(t * 100);
          const l = lightnessFromIntensity(I);
          return colorFromHSLC({ h, s, l, alpha: 1 });
        }
      );

      try { ring.style.background = buildGradient(); } catch (_) {}
      applyStandardRingSkin(ring, mask);

      // Live recolor listeners
      try {
        const onHue = (ev) => {
          try { if (ev && ev.detail && Number.isFinite(ev.detail.hue)) { _hueForPreview = Number(ev.detail.hue); } else { _hueForPreview = currentHue(); } } catch (_) {}
          try { ring.style.background = buildGradient(); } catch (_) {}
        };
        const onIntensity = (ev) => {
          try { if (ev && ev.detail && Number.isFinite(ev.detail.intensity)) { _intensityForPreview = Number(ev.detail.intensity); } else { _intensityForPreview = currentIntensity(); } } catch (_) {}
          try { ring.style.background = buildGradient(); } catch (_) {}
        };
        window.addEventListener('ui:hue-changed', onHue);
        window.addEventListener('ui:intensity-changed', onIntensity);
      } catch (_) {}
    }
  } catch (_) {}

  return kn;
}

export function createIntensityKnob(opts = {}) {
  // 0..100 intensity; preview ring uses theme mapping to show resulting sat/light
  const min = 0, max = 100;
  const initial = Number.isFinite(opts.value) ? opts.value : currentIntensity();

  const kn = createKnob({
    min,
    max,
    value: initial,
    // Wheel/key increment: ~5% of range for easier wheel control
    step: (opts.step != null ? opts.step : KNOB_STEP_DEFAULT),
    // Fine wheel increment: 1% for subtle wheel moves
    wheelFineStep: (opts.wheelFineStep != null ? opts.wheelFineStep : KNOB_WHEEL_FINE_STEP_DEFAULT),
    size: opts.size || KNOB_SIZE_PX_DEFAULT,
    label: opts.label || 'Intensity',
    // Use CSS conic-gradient for the intensity ring (no micro-segments)
    segments: 0,
    angleMin: ARC_ANGLE_MIN_DEG,
    angleMax: ARC_ANGLE_MAX_DEG,
    titleFormatter: tfPct('Intensity'),
    onInput: (v) => {
      const vv = Math.round(v);
      try {
        const TS = (typeof window !== 'undefined') ? window.ThemeScheduler : null;
        if (TS && TS.schedule) { try { TS.beginDrag(); } catch (_) {} try { TS.schedule({ intensity: vv, transient: true }); } catch (_) {} }
        else { try { window.UITheme?.applyDynamicTheme?.({ intensity: vv, transient: true }); } catch (_) {} }
      } catch (_) {}
      if (typeof opts.onInput === 'function') { try { opts.onInput(v); } catch (_) {} }
    },
    onChange: (v) => {
      const vv = Math.round(v);
      try { getRoot().style.setProperty('--ui-intensity', String(vv)); } catch (_) {}
      try {
        const TS = (typeof window !== 'undefined') ? window.ThemeScheduler : null;
        if (TS && TS.endDrag) { try { TS.endDrag({ intensity: vv }); } catch (_) {} }
        else { try { window.UITheme?.applyDynamicTheme?.({ intensity: vv }); } catch (_) {} }
      } catch (_) {}
      if (typeof opts.onChange === 'function') { try { opts.onChange(v); } catch (_) {} }
    },
    theme: opts.theme,
    className: opts.className,
    // Default ring offset creates a small gap between knob face and color ring
    ringOffset: (opts.ringOffset ?? 12),
    segThickness: 2,
    segLength: 10,
    dotSize: 6,
  });

  // Tooltips: show below knob with connector line (far mode, bottom-center placement)
  try {
    if (kn && kn.el) {
      kn.el.__sfTipMode = 'far';
      kn.el.__sfTipPlacementPriority = 'bc,b';
    }
  } catch (_) {}

  // Paint the intensity ring using a CSS conic-gradient + radial mask (donut)
  try {
    const ring = kn && kn.el ? kn.el.querySelector('.k-ring') : null;
    if (ring) {
      const size = Number.isFinite(Number(opts.size)) ? Number(opts.size) : 64;
      const mask = buildStandardRingMask(size);

      // Build a perceptual intensity gradient for an arc-only sweep
      let _hueForPreview = currentHue();
      const buildGradient = () => buildArcGradient(
        RING_ARC_FROM_DEG,
        RING_ARC_LEN_DEG,
        RING_SAMPLE_STEP_DEG,
        (t) => {
          const h = _hueForPreview;
          const I = Math.round(t * 100);
          const s = satFromIntensity(I);
          const l = lightnessFromIntensity(I);
          return colorFromHSLC({ h, s, l, alpha: 1 });
        }
      );

      try { ring.style.background = buildGradient(); } catch (_) {}
      applyStandardRingSkin(ring, mask);

      // Rebuild the gradient immediately when Hue changes elsewhere
      try {
        const onHue = (ev) => {
          try { if (ev && ev.detail && Number.isFinite(ev.detail.hue)) { _hueForPreview = Number(ev.detail.hue); } else { _hueForPreview = currentHue(); } } catch (_) {}
          try { ring.style.background = buildGradient(); } catch (_) {}
        };
        window.addEventListener('ui:hue-changed', onHue);
      } catch (_) {}
    }
  } catch (_) {}

  return kn;
}

try {
  window.ColorKnobs = Object.assign(window.ColorKnobs || {}, {
    createHueKnob,
    createSaturationKnob,
    createIntensityKnob,
    createTextBrightnessKnob,
    applyHueConstantsTo,
    applyHueConstantsToAll,
  });
} catch (_) {}
