// Debug Center Volume Knob
// Installs a single volume knob at the center of the screen for testing.
// No expansion, minimal chrome. Safe to keep around; idempotent.

import { createVolumeKnob } from './volumeKnob.js';

export function installCenterVolumeKnob(opts = {}) {
  let root = document.getElementById('center-volume-knob');
  if (root) return root;

  const groupId = String(opts.groupId || 'MASTER');
  const size = Math.max(72, Math.floor(opts.size || 120));
  const segments = Math.max(12, Math.floor(opts.segments || 36));

  root = document.createElement('div');
  root.id = 'center-volume-knob';
  root.style.position = 'fixed';
  root.style.left = '50%';
  root.style.top = '50%';
  root.style.transform = 'translate(-50%, -50%)';
  root.style.zIndex = '35000'; // above status bar (30000), below overlay (9999) is actually higher; we want above, so 35000
  root.style.pointerEvents = 'auto';

  const knob = createVolumeKnob({ groupId, size, segments });
  root.appendChild(knob.el);

  document.body.appendChild(root);

  root.uninstall = () => {
    try { knob.unbind?.(); } catch (_) {}
    try { root.remove(); } catch (_) {}
  };
  return root;
}
