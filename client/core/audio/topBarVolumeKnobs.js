// Top Bar Volume Knobs (plain JS)
// Installs a compact master knob in the hover status bar with an expandable row
// of per-group knobs (GAME, MUSIC, VOICE). Uses createVolumeKnob() and
// volumeGroupManager.js under the hood. No HTML/CSS edits outside this file.
//
// Usage: call installTopBarVolumeKnobs() after the status bar exists.
// This module injects its own minimal CSS once.

import { createVolumeKnob } from './volumeKnob.js';

export function installTopBarVolumeKnobs(opts = {}) {
  ensureStyle();
  const bar = document.getElementById('hover-status-bar');
  const left = document.getElementById('status-left');
  if (!bar || !left) return null;

  let cluster = document.getElementById('topbar-volume-knobs');
  if (cluster) return cluster;

  cluster = document.createElement('div');
  cluster.id = 'topbar-volume-knobs';
  cluster.className = 'vk-cluster';
  cluster.setAttribute('role', 'group');
  cluster.setAttribute('aria-label', 'Volume');
  // Optional configurable spacing between knobs (overrides CSS gap)
  const spacing = (opts.spacing != null)
    ? (typeof opts.spacing === 'string' ? String(opts.spacing) : (Math.round(Number(opts.spacing)) + 'px'))
    : null;
  if (spacing) {
    try { cluster.style.gap = spacing; } catch (_) {}
  }

  // Master knob (slightly larger)
  const masterOpts = { groupId: 'MASTER', ...opts };
  // Only set explicit master-specific keys if provided, otherwise keep pass-through
  if (opts.masterSegments != null) masterOpts.segments = opts.masterSegments; else if (masterOpts.segments == null) masterOpts.segments = 24;
  if (opts.masterSize != null) masterOpts.size = opts.masterSize; else if (masterOpts.size == null) masterOpts.size = 44;
  if (opts.masterRingOffset != null) masterOpts.ringOffset = opts.masterRingOffset;
  if (opts.masterSegThickness != null) masterOpts.segThickness = opts.masterSegThickness;
  if (opts.masterSegLength != null) masterOpts.segLength = opts.masterSegLength;
  if (opts.masterDotSize != null) masterOpts.dotSize = opts.masterDotSize;
  const master = createVolumeKnob(masterOpts);
  if (opts.masterOffsetY != null) {
    try { master.el.style.marginTop = Math.round(Number(opts.masterOffsetY)) + 'px'; } catch (_) {}
  }
  master.el.classList.add('vk-master');
  master.el.title = 'Master Volume';
  cluster.appendChild(master.el);

  // Hidden panel with other knobs
  const panel = document.createElement('div');
  panel.className = 'vk-panel';
  if (spacing) {
    try { panel.style.gap = spacing; } catch (_) {}
  }

  const groups = opts.groups || [
    { id: 'GAME', label: 'Game', segments: 22, size: 38 },
    { id: 'MUSIC', label: 'Music', segments: 22, size: 38 },
    { id: 'VOICE', label: 'Voice', segments: 22, size: 38 },
  ];

  const unbinders = [];
  for (const g of groups) {
    const kOpts = { groupId: g.id, ...opts, ...g };
    // Only set group geometry if provided at either per-group or group-level
    if (g.segments != null) kOpts.segments = g.segments;
    if (g.size != null) kOpts.size = g.size;
    if (g.ringOffset != null || opts.groupRingOffset != null) kOpts.ringOffset = (g.ringOffset != null ? g.ringOffset : opts.groupRingOffset);
    if (g.segThickness != null || opts.groupSegThickness != null) kOpts.segThickness = (g.segThickness != null ? g.segThickness : opts.groupSegThickness);
    if (g.segLength != null || opts.groupSegLength != null) kOpts.segLength = (g.segLength != null ? g.segLength : opts.groupSegLength);
    if (g.dotSize != null || opts.groupDotSize != null) kOpts.dotSize = (g.dotSize != null ? g.dotSize : opts.groupDotSize);
    const k = createVolumeKnob(kOpts);
    // Inherit vertical nudge from master if no explicit group or per-item offset is provided
    const offY = (g.offsetY != null ? g.offsetY : (opts.groupOffsetY != null ? opts.groupOffsetY : opts.masterOffsetY));
    if (offY != null) {
      try { k.el.style.marginTop = Math.round(Number(offY)) + 'px'; } catch (_) {}
    }
    k.el.title = `${g.label} Volume`;
    panel.appendChild(k.el);
    unbinders.push(k.unbind);
  }

  cluster.appendChild(panel);

  // Insert cluster to the left side, before existing text
  left.prepend(cluster);

  // Cleanup helper if needed by callers
  cluster.uninstall = () => {
    try { for (const u of unbinders) u(); } catch (_) {}
    try { cluster.remove(); } catch (_) {}
  };

  return cluster;
}

function ensureStyle() {
  if (document.getElementById('topbar-volume-knobs-style')) return;
  const st = document.createElement('style');
  st.id = 'topbar-volume-knobs-style';
  st.textContent = `
  #topbar-volume-knobs.vk-cluster { display: inline-flex; align-items: center; gap: 6px; margin-right: 10px; }
  #topbar-volume-knobs .vk-master { --vk-size: 44px; }
  #topbar-volume-knobs .vk-panel { display: none; align-items: center; gap: 6px; }
  #topbar-volume-knobs:hover .vk-panel { display: inline-flex; }
  `;
  document.head.appendChild(st);
}
