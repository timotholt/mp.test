// Sound Tab: renders Sound settings for panel and overlay
// Variant 'panel' and 'overlay' differ by taglines, layout, and event wiring.
// Keep behavior identical to previous inline implementation.

import { bindRange, getValue, setValue, DEFAULT_WHEEL_STEP } from '../../../core/audio/volumeGroupManager.js';
import { createVolumeKnob } from '../../../core/audio/volumeKnob.js';
import * as LS from '../../../core/localStorage.js';
import { getQuip } from '../../../core/ui/quip.js';
import { createCheckbox } from '../../../core/ui/controls.js';

export function renderSoundTab(opts) {
  const {
    container,
    makeSection,
    makeNote, // not used now but left for parity with other tabs
    variant = 'panel',
    setDirty, // overlay uses this to mark dirty while adjusting master volume
  } = opts || {};

  // 1) Sound mixer header + Knobs grid
  if (variant === 'overlay') {
    try {
      const mixerQuips = [
        "Softness is weakness. Turn it up.",
        'Turn it up until your neighbors complain, then turn it up more.',
        'Silence is deadly. Volume is deadlier.',
        "Those pretty knobs are just begging to be touched.",
        "Hurry up. Those pretty knobs aren't going to touch themselves.",
        'Temper the noise, amplify the legend.',
        'Turn it up. Your speakers will thank you.'
      ];
      container.appendChild(makeSection('Sound Mixer', getQuip('settings.overlay.soundMixerTag', mixerQuips)));
    } catch (_) {
      container.appendChild(makeSection('Sound Mixer', ''));
    }
  } else {
    container.appendChild(makeSection('Sound'));
  }

  { const spacer = document.createElement('div'); spacer.style.height = '1rem'; container.appendChild(spacer); }
  container.appendChild(makeVolumeKnobsGrid());

  // While adjusting from the overlay, broadcast/track adjusting flag via window event and setDirty(true)
  let cleanup = null;
  if (variant === 'overlay' && typeof setDirty === 'function') {
    try {
      const handler = (e) => { if (e && e.detail && e.detail.adjusting) setDirty(true); };
      window.addEventListener('ui:volume:adjusting', handler);
      cleanup = () => { try { window.removeEventListener('ui:volume:adjusting', handler); } catch(_) {} };
    } catch (_) {}
  }

  // 2) Notifications section
  if (variant === 'overlay') {
    const spacer = document.createElement('div'); spacer.style.height = '12px'; container.appendChild(spacer);
    try {
      const notifQuips = [
        'Only the alerts that matter.',
        'Hear what hurts. Ignore the rest.',
        'Signals in the noise.',
        'Ping when the plot thickens.',
        'Stay alert, stay alive.',
        'Not every ping is friendly.',
        'The loudest warnings come too late.',
        'Disable at your own peril.',
        'Notifications ignored = fate accepted.',
        'If you mute these, don’t cry later.'
      ];
      const sec = makeSection('Notifications', getQuip('settings.overlay.notificationsTag', notifQuips));
      try {
        const desc = sec.children && sec.children[1];
        if (desc) {
          desc.style.fontSize = '13px';
          desc.style.opacity = '0.9';
          desc.style.margin = '0 0 10px 0';
          desc.style.color = 'var(--ui-bright, #dff1ff)';
          desc.style.userSelect = 'none';
        }
      } catch (_) {}
      container.appendChild(sec);
    } catch (_) {
      container.appendChild(makeSection('Notifications', ''));
    }

    const notifGrid = document.createElement('div');
    notifGrid.style.display = 'grid';
    notifGrid.style.gridTemplateColumns = '1fr 1fr';
    notifGrid.style.columnGap = '12px';
    notifGrid.style.rowGap = '6px';
    container.appendChild(notifGrid);

    notifGrid.appendChild(makeCheckboxRow('Player joins/leaves lobby/room', 'notif_playerJoinLeave', 'ui:notif:playerJoinLeave'));
    notifGrid.appendChild(makeCheckboxRow('Friend joins/leaves server/lobby/room', 'notif_friendJoinLeave', 'ui:notif:friendJoinLeave'));
    notifGrid.appendChild(makeCheckboxRow('Public game created', 'notif_publicGameCreated', 'ui:notif:publicGameCreated'));
    notifGrid.appendChild(makeCheckboxRow('Friend game created', 'notif_friendGameCreated', 'ui:notif:friendGameCreated'));
    notifGrid.appendChild(makeCheckboxRow('New lobby chat message', 'notif_lobbyChat', 'ui:notif:lobbyChat'));
    notifGrid.appendChild(makeCheckboxRow('New game chat message', 'notif_gameChat', 'ui:notif:gameChat'));
    notifGrid.appendChild(makeCheckboxRow('@Mention', 'notif_mention', 'ui:notif:mention'));
  } else {
    const spacer = document.createElement('div'); spacer.style.height = '12px'; container.appendChild(spacer);
    const sec = makeSection('Notifications', 'Choose which alerts to receive.');
    try {
      const desc = sec.children && sec.children[1];
      if (desc) {
        desc.style.fontSize = '13px';
        desc.style.opacity = '0.9';
        desc.style.margin = '0 0 10px 0';
        desc.style.color = 'var(--ui-fg, #eee)';
        desc.style.userSelect = 'none';
      }
    } catch (_) {}
    container.appendChild(sec);

    container.appendChild(makeCheckboxRow('Player joins/leaves lobby/room', 'notif_playerJoinLeave', 'ui:notif:playerJoinLeave'));
    container.appendChild(makeCheckboxRow('Friend joins/leaves server/lobby/room', 'notif_friendJoinLeave', 'ui:notif:friendJoinLeave'));
    container.appendChild(makeCheckboxRow('Public game created', 'notif_publicGameCreated', 'ui:notif:publicGameCreated'));
    container.appendChild(makeCheckboxRow('Friend game created', 'notif_friendGameCreated', 'ui:notif:friendGameCreated'));
    container.appendChild(makeCheckboxRow('New lobby chat message', 'notif_lobbyChat', 'ui:notif:lobbyChat'));
    container.appendChild(makeCheckboxRow('New game chat message', 'notif_gameChat', 'ui:notif:gameChat'));
    container.appendChild(makeCheckboxRow('@Mention', 'notif_mention', 'ui:notif:mention'));
  }

  // Return cleanup for overlay listener so caller can dispose on tab switch/close
  return cleanup;
}

// Local helpers (moved from settings.js)
function makeVolumeKnobsGrid() {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.gap = '14px';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'flex-start';

  const groups = [
    { id: 'MASTER', label: 'Master' },
    { id: 'GAME', label: 'Game' },
    { id: 'MUSIC', label: 'Music' },
    { id: 'VOICE', label: 'Voice' },
  ];

  groups.forEach(g => {
    const cell = document.createElement('div');
    cell.style.display = 'flex';
    cell.style.flexDirection = 'column';
    cell.style.alignItems = 'center';
    cell.style.width = '110px';

    const { el } = createVolumeKnob({ groupId: g.id, label: g.label + ' Volume', size: 64, segments: 20 });
    // Micro-adjusts for audio knobs:
    // - Push the outer ring down by +2px (to ~4px total) for visual centering
    // - Increase radial gap between knob and LED ring via --kn-ring-offset
    // - Brighten the dark gray off segments for contrast
    // - Add a subtle glow to lit segments (stronger on hover/focus)
    try {
      el.style.setProperty('--kn-ring-global-y', '4px');
      el.style.setProperty('--kn-ring-offset', '14px');
      el.style.setProperty('--kn-seg-off', '#3b4350');
      // Match LED segment colors to themed border/highlight
      el.style.setProperty('--kn-seg-on', 'var(--ui-surface-border)');
      // Hover/focus LED segment color should match center dot hover (pure white)
      el.style.setProperty('--kn-seg-on-bright', '#fff');
      // Disable idle glow; keep strong glow only on hover/focus
      // Re-enable idle LED glow and tie it to theme's surface glow (driven by glow slider)
      el.style.setProperty('--kn-seg-glow', 'var(--ui-surface-glow-outer)');
      // Make hover/focus LED glow more pronounced; still driven by glow slider
      el.style.setProperty('--kn-seg-glow-strong', 'var(--ui-glow-strong), var(--ui-surface-glow-outer)');
      // Match overall knob hover glow to border slider hover glow
      el.style.setProperty('--kn-hover-glow', 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))');
    } catch (_) {}
    const cap = document.createElement('div');
    cap.textContent = g.label;
    cap.style.marginTop = '6px';
    cap.style.color = 'var(--ui-fg, #eee)';
    cap.style.opacity = '0.9';
    cap.style.fontSize = '12px';

    cell.appendChild(el);
    cell.appendChild(cap);
    wrap.appendChild(cell);
  });

  return wrap;
}

function makeCheckboxRow(labelText, storageKey, eventName) {
  let checked = false;
  try { checked = (LS.getItem(storageKey, '0') === '1'); } catch (_) { checked = false; }
  const cb = createCheckbox({
    label: labelText,
    checked,
    onChange: (val) => {
      try { LS.setItem(storageKey, val ? '1' : '0'); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent(eventName, { detail: { enabled: !!val } })); } catch (_) {}
    }
  });
  try { cb.el.style.marginBottom = '6px'; } catch (_) {}
  return cb.el;
}

// (Checkbox styles provided by shared controls via createCheckbox())
