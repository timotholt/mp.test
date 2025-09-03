// Display Tab: renders the Display settings for panel and overlay
// Variant 'panel' and 'overlay' differ only by input IDs and container naming.
// Minimal, commented, and human-readable per project conventions.

import { makeSection, attachWheel } from '../uiHelpers.js';
import { createUiElement, basicButton, createRangeElement, basicFormRow, basicFormLabel, basicGapBetweenSections } from '../../../core/ui/theme/elements.js';
import { createDropdown } from '../../../core/ui/controls.js';
import { getQuip } from '../../../core/ui/quip.js';

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

// Quips for Dungeon Settings section (fonts, tiles, terminal vibes)
const DUNGEON_QUIPS = [
  'Pick a font. Slay a goblin. In that order.',
  'ASCII today, victory tomorrow.',
  'The dungeon prefers monospaced manners.',
  'Fonts so sharp, they crit on read.',
  'Serifs in the dungeon? Bold move.',
];

export function renderDisplayTab(container) {

  // Section header: rotating quip aligned upper-right (via quip library)
  const quip = getQuip('settings.display.header', DISPLAY_QUIPS);
  const sec = makeSection('Display', quip, 'afterTitle', true);
  container.appendChild(sec);

  // Font Size slider (root rem scale) shown in pixels
  const { row: fsRow, input: fsRng, value: fsVal, reset: fsReset } = createRangeElement(
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

  // Spacer between sections (1rem)
  container.appendChild(createUiElement(basicGapBetweenSections, 'div'));

  // Dungeon Settings section
  const dquip = getQuip('settings.dungeon.header', DUNGEON_QUIPS);
  const dsec = makeSection('Dungeon Settings', dquip, 'afterTitle', true);
  container.appendChild(dsec);

  // Keep a reference to the Dungeon Font dropdown for Reset wiring
  let dfDdRef = null;

  // Dungeon Font dropdown (placeholder for ASCII font control)
  // Uses shared dropdown factory for consistent visuals; persists selection.
  try {
    const dfRow = createUiElement(basicFormRow, 'div');
    const dfLbl = createUiElement(basicFormLabel, 'Dungeon Font:');

    let savedFont = 'A';
    try { const s = localStorage.getItem('ui_dungeon_font'); if (s) savedFont = s; } catch (_) {}
    const items = [
      { label: 'Font A', value: 'A' },
      { label: 'Font B', value: 'B' },
    ];
    // Use rem width so the control scales with UI font size
    const dfDd = createDropdown({ items, value: savedFont, width: '14rem', onChange: (val) => {
      try { localStorage.setItem('ui_dungeon_font', String(val)); } catch (_) {}
      // Placeholder: future hook to update dungeon canvas font
    }});
    dfDdRef = dfDd;
    // Top margin belongs to the dropdown element (not the row)
    try { dfDd.el.style.marginTop = '0.5rem'; } catch (_) {}

    dfRow.appendChild(dfLbl);
    dfRow.appendChild(dfDd.el);
    dsec.appendChild(dfRow);
  } catch (_) {}

  // Create footer row with Reset button aligned bottom-right
  const footer = createUiElement({ display: 'flex', justifyContent: 'flex-end', mt: '0.5rem' }, 'div');
  const resetBtn = createUiElement(basicButton, 'Reset');
  resetBtn.onclick = () => {
    try { fsReset && fsReset(); } catch (_) {}
    try {
      localStorage.setItem('ui_dungeon_font', 'A');
      dfDdRef && dfDdRef.setValue && dfDdRef.setValue('A', true);
    } catch (_) {}
  };
  footer.appendChild(resetBtn);
  container.appendChild(footer);
}
