// Audio Manager - single entry point for client audio setup
// Keeps main.js decoupled from audio implementation details.

import { installFloatingVolumeUI } from './floatingVolume.js';
import { installTopBarVolumeKnobs } from './topBarVolumeKnobs.js';
import { installCenterVolumeKnob } from './debugCenterKnob.js';
import { createKnob as createGenericKnob, applyKnobTheme as applyKnobThemeGeneric, themes as knobThemes } from '../ui/knob.js';

// Initialize all client-side audio UI and wiring.
// options:
// - floatingVolume: boolean (default true) to enable/disable floating volume UI
export function initAudio(options = {}) {
  const {
    floatingVolume = true,
    topBarKnobs = true,
    centerDebugKnob = true,
    topBarOptions = null,
  } = options || {};

  // Expose generic knob utilities for quick experiments
  try { window.Knob = { createKnob: createGenericKnob, applyKnobTheme: applyKnobThemeGeneric, themes: knobThemes }; } catch (_) {}

  if (floatingVolume) {
    try {
      // Idempotent: the installer returns early if already present
      installFloatingVolumeUI();
    } catch (err) {
      try { console.warn('[audioManager] failed to install floating volume UI:', err); } catch (_) {}
    }
  }

  // Install compact knobs on the hover status bar's left side.
  // Note: Caller should ensure the status bar exists before calling initAudio().
  if (topBarKnobs) {
    try {
      installTopBarVolumeKnobs(topBarOptions || {
        masterSegments: 20,
        masterSize: 25,
        masterRingOffset: 9,
        masterOffsetY: 10,
        spacing: 24,
        masterSegThickness: 0.5,
        masterSegLength: 2.5,
        masterDotSize: 2,
        groupRingOffset: 9,
        groupSegThickness: 0.5,
        groupSegLength: 2.5,
        groupDotSize: 2,
        groups: [
          { id: 'GAME',  label: 'Game',  segments: 20, size: 25 },
          { id: 'MUSIC', label: 'Music', segments: 20, size: 25 },
          { id: 'VOICE', label: 'Voice', segments: 20, size: 25 },
        ],
      });
    } catch (err) {
      try { console.warn('[audioManager] failed to install top bar knobs:', err); } catch (_) {}
    }
  }

  if (centerDebugKnob) {
    try {
      installCenterVolumeKnob({ groupId: 'MASTER', size: 120, segments: 36 });
    } catch (err) {
      try { console.warn('[audioManager] failed to install center debug knob:', err); } catch (_) {}
    }
  }
}
