// Sound Tab: renders Sound settings for panel and overlay
// Variant 'panel' and 'overlay' differ by taglines, layout, and event wiring.
// Keep behavior identical to previous inline implementation.

import { bindRange, getValue, setValue, DEFAULT_WHEEL_STEP } from '../../../core/audio/volumeGroupManager.js';
import { createVolumeKnob } from '../../../core/audio/volumeKnob.js';
import * as LS from '../../../core/localStorage.js';
import { getQuip } from '../../../core/ui/quip.js';
import { createCheckbox } from '../../../core/ui/controls.js';
import { makeSection } from '../uiHelpers.js';
import { createUiElement, basicGapBetweenSections } from '../../../core/ui/theme/elements.js';

export function renderSoundTab(container) {
  const variant = 'overlay';

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
      container.appendChild(makeSection('Sound Mixer', getQuip('settings.overlay.soundMixerTag', mixerQuips), 'afterTitle', true));
    } catch (_) {
      container.appendChild(makeSection('Sound Mixer', '', 'afterTitle', true));
    }
  } else {
    container.appendChild(makeSection('Sound', '', 'afterTitle'));
  }

  { const spacer = document.createElement('div'); spacer.style.height = '1rem'; container.appendChild(spacer); }
  container.appendChild(makeVolumeKnobsGrid());

  // While adjusting from the overlay, broadcast/track adjusting flag via window event and setDirty(true)
  let cleanup = null;
  if (variant === 'overlay') {
    try {
      const handler = (e) => { /* marker hook removed; settings overlay tracks auto-save */ };
      window.addEventListener('ui:volume:adjusting', handler);
      cleanup = () => { try { window.removeEventListener('ui:volume:adjusting', handler); } catch(_) {} };
    } catch (_) {}
  }

  // 2) Notifications section
  if (variant === 'overlay') {
    // Standardized gap between Sound Mixer and Notifications
    try { container.appendChild(createUiElement(basicGapBetweenSections)); } catch (_) {}
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
      const sec = makeSection('Notifications', getQuip('settings.overlay.notificationsTag', notifQuips), 'afterTitle', true);
      container.appendChild(sec);
    } catch (_) {
      container.appendChild(makeSection('Notifications', '', 'afterTitle', true));
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
    // Standardized gap between Sound Mixer and Notifications
    try { container.appendChild(createUiElement(basicGapBetweenSections)); } catch (_) {}
    const sec = makeSection('Notifications', 'Choose which alerts to receive.', 'afterTitle', true);
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
  // Use UI gap variable at half-scale (defaults to 0.5rem if --ui-gap is 1rem)
  wrap.style.gap = 'calc(var(--ui-gap, 1rem) * 0.5)';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'space-between';

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
    // Scale cell width with UI font scale via rem (110px ≈ 6.875rem; round to 7rem)
    cell.style.width = '7rem';

    // Use rem so knob size respects --ui-font-scale via root rem
    const { el } = createVolumeKnob({ groupId: g.id, label: g.label + ' Volume', size: '4rem', segments: 20 });
    // Micro-adjusts for audio knobs:
    // - Push the outer ring down by +2px (to ~4px total) for visual centering
    // - Increase radial gap between knob and LED ring via --kn-ring-offset
    // - Brighten the dark gray off segments for contrast
    // - Add a subtle glow to lit segments (stronger on hover/focus)
    try {
      // Convert micro-adjusts to rem to scale with UI font size
      el.style.setProperty('--kn-ring-global-y', '0.25rem');
      el.style.setProperty('--kn-ring-offset', '0.875rem');
      el.style.setProperty('--kn-seg-off', '#3b4350');
      // Match LED segment colors to themed border/highlight
      el.style.setProperty('--kn-seg-on', 'var(--ui-surface-border)');
      // Brighten non-tip segments on hover/focus using theme bright;
      // the tip segment is forced white inline by knob.js
      el.style.setProperty('--kn-seg-on-bright', 'var(--ui-bright)');
      // Disable idle glow; keep strong glow only on hover/focus
      // Re-enable idle LED glow and tie it to theme's surface glow (driven by glow slider)
      el.style.setProperty('--kn-seg-glow', 'var(--ui-surface-glow-outer)');
      // Make hover/focus LED glow more pronounced; still driven by glow slider
      el.style.setProperty('--kn-seg-glow-strong', 'var(--ui-glow-strong), var(--ui-surface-glow-outer)');
      // Match overall knob hover glow to border slider hover glow
      el.style.setProperty('--kn-hover-glow', 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))');

      // Centered theme circle on the knob face; matches LED segment color
      // Hidden by default in knob.css; enable here for Sound tab knobs only
      // Softer opacity to reduce perceived brightness
      el.style.setProperty('--kn-center-ring-opacity', '1.0');
      // Subtle but visible line weight
      el.style.setProperty('--kn-center-ring-w', '2px');
      // Keep a clear gap so the ring never touches the white dot
      el.style.setProperty('--kn-center-ring-gap', '0.25rem');
      // Precise diameter so the ring stroke centerline matches the dot center radius minus gap:
      // Rdot_center = 0.5*size - (0.06*size + 5px + 0.5*dot) = 0.44*size - 5px - 0.5*dot
      // We want: Rring_centerline = Rdot_center - gap
      // In CSS border terms, Rring_centerline = contentRadius + 0.5*borderWidth
      // => contentRadius = Rdot_center - gap - 0.5*borderWidth
      // => contentDiameter = 2 * (0.44*size - 5px - 0.5*dot - gap - 0.5*borderWidth)
      el.style.setProperty('--kn-center-ring-d', 'calc(2 * (0.44 * var(--kn-size) - 5px - 0.5 * var(--kn-dot-size) - var(--kn-center-ring-gap) - 0.5 * var(--kn-center-ring-w)))');
      // Match LED colors (and brighten on hover via CSS in knob.js)
      el.style.setProperty('--kn-center-ring-color', 'var(--kn-seg-on, var(--ui-surface-border))');
      el.style.setProperty('--kn-center-ring-color-hover', 'var(--kn-seg-on-bright, var(--ui-bright))');
      // Softer ring glow to avoid bleed, but glow both inward and outward
      // Idle: tiny inner+outer; Hover: small inner+outer
      el.style.setProperty('--kn-center-ring-glow', 'inset 0 0 2px var(--kn-seg-on), 0 0 2px var(--kn-seg-on)');
      el.style.setProperty('--kn-center-ring-glow-strong', 'inset 0 0 4px var(--kn-seg-on-bright), 0 0 4px var(--kn-seg-on-bright)');

      // When the center ring is present, hide the white dot for a cleaner look
      try { const d = el.querySelector('.k-dot'); if (d) d.style.display = 'none'; } catch (_) {}
    } catch (_) {}
    const cap = document.createElement('div');
    cap.textContent = g.label;
    cap.style.marginTop = '6px';
    cap.style.color = 'var(--ui-fg, #eee)';
    cap.style.opacity = '0.9';
    // Caption scales with UI font size
    cap.style.fontSize = '0.75rem';

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
