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

  // Master knob (slightly larger)
  const master = createVolumeKnob({
    groupId: 'MASTER',
    segments: opts.masterSegments ?? 24,
    size: opts.masterSize ?? 44,
    ringOffset: opts.masterRingOffset,
    segThickness: opts.masterSegThickness,
    segLength: opts.masterSegLength,
    dotSize: opts.masterDotSize,
  });
  master.el.classList.add('vk-master');
  master.el.title = 'Master Volume';
  cluster.appendChild(master.el);

  // Toggle button to pin/unpin the panel
  const toggle = document.createElement('button');
  toggle.className = 'vk-toggle';
  toggle.textContent = '▾';
  toggle.title = 'Show more volumes';
  toggle.onclick = () => { cluster.classList.toggle('pinned'); };
  cluster.appendChild(toggle);

  // Hidden panel with other knobs
  const panel = document.createElement('div');
  panel.className = 'vk-panel';

  const groups = opts.groups || [
    { id: 'GAME', label: 'Game', segments: 22, size: 38 },
    { id: 'MUSIC', label: 'Music', segments: 22, size: 38 },
    { id: 'VOICE', label: 'Voice', segments: 22, size: 38 },
  ];

  const unbinders = [];
  for (const g of groups) {
    const k = createVolumeKnob({
      groupId: g.id,
      segments: g.segments,
      size: g.size,
      ringOffset: (g.ringOffset != null ? g.ringOffset : opts.groupRingOffset),
      segThickness: (g.segThickness != null ? g.segThickness : opts.groupSegThickness),
      segLength: (g.segLength != null ? g.segLength : opts.groupSegLength),
      dotSize: (g.dotSize != null ? g.dotSize : opts.groupDotSize),
    });
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
  #topbar-volume-knobs:hover .vk-panel, #topbar-volume-knobs.pinned .vk-panel { display: inline-flex; }
  #topbar-volume-knobs .vk-toggle { background: transparent; color: var(--ui-fg,#fff); border: 1px solid var(--control-border,#444);
    border-radius: 4px; cursor: pointer; padding: 0 6px; height: 24px; }
  `;
  document.head.appendChild(st);
}
