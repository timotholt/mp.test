// Display Tab: renders the Display settings for panel and overlay
// Variant 'panel' and 'overlay' differ only by input IDs and container naming.
// Minimal, commented, and human-readable per project conventions.

import { makeSection, attachWheel } from '../uiHelpers.js';
import { createUiElement, basicSubtitle, basicGap, basicButton, createRangeElement } from '../../../core/ui/theme/elements.js';

// Quips for Display tab (eyesight, scaling, glasses, etc.)
const DISPLAY_QUIPS = [
  'Font size is not a substitute for glasses.',
  'Sit closer. Or slide right.',
  "Font sliders: Cause squinting isn't a good look.",
  'Bigger fonts: the oldest monitor overclock.',
  'Pixels too small? Summon larger ones.',
  'Get better glasses or better excuses.',
  'Scaling: because monitors lie about inches.',
  'Lean in like you mean it.',
  'Font size: a bandaid for tiny screens.',
  'Gargoyles read at 8px. Mortals need 16+.',
  'Move the slider, save your eyesight.',
  'Monitor small? Ego big? Compensate here.',
  'Reading glasses: analog upscaling.',
  'Squinting is not accessibility.',
  "Make text huge. Pretend it’s for testing.",
  'Your eyes called. They want 18px.',
  'UI scale: the poor man’s 4K.',
  'The screen is far; the slider is near.',
  'More pixels per letter, fewer tears per quest.',
  'Pro tip: 16px is the new 12px.',
  'Less eyestrain, more brainstrain.',
  'Real men move the slider all the way left.'
];

export function renderDisplayTab(container) {

  // // This is how I expect these things to be used (template, text, id)
  // container.appendChild(createUiElement(basicSubtitle, 'Display', 'display-tab-subtitle'));
  // container.appendChild(createUiElement(basicGap));

  // Section header: random quip aligned upper-right
  const quip = DISPLAY_QUIPS[Math.floor(Math.random() * DISPLAY_QUIPS.length)];
  const sec = makeSection('Display', quip, 'afterTitle', true);
  container.appendChild(sec);

  // Font Size slider (root rem scale) shown in pixels
  const { row: fsRow, label: fsLbl, input: fsRng, value: fsVal, reset: fsReset } = createRangeElement(
    80, 120, 1, 100, 'Font Size:', {
      storageKey: 'ui_font_scale',
      attachWheel,
      debugLabel: 'display',
      toDisplay: (p) => { const scale = p / 100; const px = Math.round(16 * scale); return { text: `${px}px`, title: `${px}px`, derived: { p, scale, px } }; },
      toStorage: (p) => String(p / 100),
      fromStorage: (s) => { const scale = parseFloat(s); const p = Math.round((Number.isFinite(scale) ? scale : 1) * 100); return Math.max(80, Math.min(120, p)); },
      onChange: (p) => { const scale = p / 100; try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: scale }); } catch (_) {} }
    }
  );
  fsRng.id = `settings-ui-fontscale-ovl`;
  fsVal.id = `settings-ui-fontscale-ovl-val`;
  container.appendChild(fsRow);

  // Create footer row with Reset button aligned bottom-right
  const footer = createUiElement({ display: 'flex', justifyContent: 'flex-end', mt: 8 }, 'div');
  const resetBtn = createUiElement(basicButton, 'Reset');
  resetBtn.onclick = () => { try { fsReset && fsReset(); } catch (_) {} };
  footer.appendChild(resetBtn);
  container.appendChild(footer);
}
