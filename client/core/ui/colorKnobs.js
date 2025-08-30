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
export const HUE_EVENT_MIN_INTERVAL_MS = 200;
// Throttle: minimum time between spectrum recolors for Sat/Bri when hue changes
export const RING_RECOLOR_MIN_INTERVAL_MS = 200;

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
    size: opts.size || 64,
    label: opts.label || 'Hue',
    segments: -1, // continuous spectrum ring
    // Full 360° sweep for Hue
    angleMin: -180,
    angleMax: 180,
    ringColorForAngle: (_angDeg, t) => {
      const h = t * 360; // full wheel along the 270° arc
      // Keep constant lightness and moderate chroma for pleasing preview
      return colorFromHSLC({ h, s: 85, l: 65, alpha: 1 });
    },
    titleFormatter: tfHue,
    onInput: (v) => {
      try { window.UITheme?.applyDynamicTheme?.({ hue: v }); } catch (_) {}
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
      try { window.UITheme?.applyDynamicTheme?.({ hue: v }); } catch (_) {}
      // Always emit a final event on change (pointer up), regardless of throttle
      try {
        window.dispatchEvent(new CustomEvent('ui:hue-changed', { detail: { hue: v } }));
        _lastHueEventAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      } catch (_) {}
      if (typeof opts.onChange === 'function') { try { opts.onChange(v); } catch (_) {} }
    },
    theme: opts.theme,
    className: opts.className,
    // Default ring offset creates a small gap between knob face and color ring
    ringOffset: (opts.ringOffset ?? 18),
    segThickness: 2,
    segLength: 10,
    dotSize: 6,
  });

  // Recolor the spectrum ring when Hue changes elsewhere
  try { window.addEventListener('ui:hue-changed', () => { try { kn.refreshRingColors?.(); } catch (_) {} }); } catch (_) {}
  

  return kn;
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
    step: (opts.step != null ? opts.step : 5),
    // Fine wheel increment: 1% for subtle wheel moves
    wheelFineStep: (opts.wheelFineStep != null ? opts.wheelFineStep : 1),
    size: opts.size || 64,
    label: opts.label || 'Saturation',
    segments: -1,
    angleMin: -135,
    angleMax: 135,
    ringColorForAngle: (_angDeg, t) => {
      const h = currentHue();
      const s = Math.round(t * 100);
      // Make ring respond to current intensity by matching theme lightness mapping (widened)
      const I = currentIntensity();
      const l = Math.max(25, Math.min(80, Math.round(45 + (I - 60) * 0.38)));
      return colorFromHSLC({ h, s, l, alpha: 1 });
    },
    titleFormatter: tfPct('Saturation'),
    onInput: (v) => {
      // Reflect on CSS var and apply to theme as explicit saturation override (0..100)
      const vv = Math.round(v);
      try { getRoot().style.setProperty('--ui-saturation', String(vv)); } catch (_) {}
      // Guard to avoid reacting to our own broadcast below
      kn.__userAdjusting = true;
      try { window.UITheme?.applyDynamicTheme?.({ saturation: vv }); } catch (_) {}
      kn.__userAdjusting = false;
      if (typeof opts.onInput === 'function') { try { opts.onInput(v); } catch (_) {} }
    },
    onChange: (v) => {
      const vv = Math.round(v);
      try { getRoot().style.setProperty('--ui-saturation', String(vv)); } catch (_) {}
      kn.__userAdjusting = true;
      try { window.UITheme?.applyDynamicTheme?.({ saturation: vv }); } catch (_) {}
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

  // Recolor the spectrum ring when Hue changes elsewhere (throttled)
  try {
    let _last = 0, _timer = null;
    const onHue = () => {
      try {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dueIn = RING_RECOLOR_MIN_INTERVAL_MS - (now - _last);
        if (dueIn <= 0) {
          _last = now; kn.refreshRingColors?.();
        } else if (!_timer) {
          _timer = setTimeout(() => { _timer = null; _last = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); kn.refreshRingColors?.(); }, Math.max(0, dueIn));
        }
      } catch (_) {}
    };
    window.addEventListener('ui:hue-changed', onHue);
  } catch (_) {}

  // Respond to intensity/theme changes by refreshing the outer ring only (value remains user-controlled)
  try {
    window.addEventListener('ui:intensity-changed', () => { try { kn.refreshRingColors?.(); } catch (_) {} });
    window.addEventListener('ui:saturation-changed', () => { try { kn.refreshRingColors?.(); } catch (_) {} });
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
    step: (opts.step != null ? opts.step : 5),
    // Fine wheel increment: 1% for subtle wheel moves
    wheelFineStep: (opts.wheelFineStep != null ? opts.wheelFineStep : 1),
    size: opts.size || 64,
    label: opts.label || 'Intensity',
    segments: -1,
    angleMin: -135,
    angleMax: 135,
    ringColorForAngle: (_angDeg, t) => {
      const h = currentHue();
      const I = Math.round(t * 100);
      const s = satFromIntensity(I);
      // Lightness mapping mirrors themeManager (widened): l = clamp(45 + (I - 60) * 0.38, 25, 80)
      const l = Math.max(25, Math.min(80, Math.round(45 + (I - 60) * 0.38)));
      return colorFromHSLC({ h, s, l, alpha: 1 });
    },
    titleFormatter: tfPct('Intensity'),
    onInput: (v) => {
      const vv = Math.round(v);
      try { getRoot().style.setProperty('--ui-intensity', String(vv)); } catch (_) {}
      try { window.UITheme?.applyDynamicTheme?.({ intensity: vv }); } catch (_) {}
      if (typeof opts.onInput === 'function') { try { opts.onInput(v); } catch (_) {} }
    },
    onChange: (v) => {
      const vv = Math.round(v);
      try { getRoot().style.setProperty('--ui-intensity', String(vv)); } catch (_) {}
      try { window.UITheme?.applyDynamicTheme?.({ intensity: vv }); } catch (_) {}
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

  // Recolor the spectrum ring when Hue changes elsewhere
  try { window.addEventListener('ui:hue-changed', () => { try { kn.refreshRingColors?.(); } catch (_) {} }); } catch (_) {}

  return kn;
}

try { window.ColorKnobs = { createHueKnob, createSaturationKnob, createIntensityKnob }; } catch (_) {}
