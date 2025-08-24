// Audio Manager - single entry point for client audio setup
// Keeps main.js decoupled from audio implementation details.

import { installFloatingVolumeUI } from './floatingVolume.js';

// Initialize all client-side audio UI and wiring.
// options:
// - floatingVolume: boolean (default true) to enable/disable floating volume UI
export function initAudio(options = {}) {
  const { floatingVolume = true } = options || {};

  if (floatingVolume) {
    try {
      // Idempotent: the installer returns early if already present
      installFloatingVolumeUI();
    } catch (err) {
      try { console.warn('[audioManager] failed to install floating volume UI:', err); } catch (_) {}
    }
  }
}
