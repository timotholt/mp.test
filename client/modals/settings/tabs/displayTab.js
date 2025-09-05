// Display Tab: renders the Display settings for panel and overlay
// Variant 'panel' and 'overlay' differ only by input IDs and container naming.
// Minimal, commented, and human-readable per project conventions.

import { makeSection, attachWheel } from '../uiHelpers.js';
import { createUiElement, basicButton, createRangeElement, basicFormRow, basicFormLabel, basicQuarterGap, basicGapBetweenSections, basicToolbarRow } from '../../../core/ui/theme/elements.js';
import { createDropdown } from '../../../core/ui/controls.js';
import { LockedThemeDefaults } from '../../../core/ui/theme/tokens.js';
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

  // UI Font dropdown (applies global UI font-family via CSS var) — placed at top of section
  // Options: System Default + registered fonts from /styles/fonts.css
  // Persist selection and apply immediately by updating --ui-font-family.
  let uiFontDdRef = null;
  try {
    // Add a quarter-gap after the section header to mirror Theme tab spacing
    try { sec.appendChild(createUiElement(basicQuarterGap)); } catch (_) {}
    const defStack = LockedThemeDefaults['--ui-font-family'];
    const mkFamily = (key) => (key === 'system' ? defStack : `'${key}', ${defStack}`);

    // Fonts registered in fonts.css (font-family names)
    const fontNames = [
      'Hyperjump',
      'Ultramarines',
      'A Space Heavy',
      'Boltruin',
      'Gardion',
      'Nebula',
      'Netron',
      'Rikos',
      'Spotnik',
      'TechnoCharm',
      'Warpen',
      'Moonhouse',
      'Neo Latina',
      'Orbitron',
    ];

    // Determine initial selection from localStorage (extract first quoted family)
    let initKey = 'system';
    try {
      const saved = localStorage.getItem('ui_font_family');
      if (saved && typeof saved === 'string') {
        // Parse leading quoted family name: 'Name', then fallback to system
        let lead = null;
        const t = saved.trim();
        if (t.startsWith("'")) {
          const idx = t.indexOf("'", 1);
          if (idx > 1) lead = t.slice(1, idx);
        }
        if (lead && fontNames.includes(lead)) initKey = lead; else initKey = 'system';
      }
    } catch (_) {}

    const items = [
      { label: 'System Default', value: 'system' },
      ...fontNames.map(name => ({ label: name, value: name }))
    ];
    // Use a toolbar row, matching Theme tab structure exactly
    const uiFontRow = createUiElement(basicToolbarRow);
    const uiFontLbl = createUiElement(basicFormLabel, 'UI Font:');
    const uiFontDd = createDropdown({ items, value: initKey, width: '16rem', onChange: (val) => {
      try {
        const fam = mkFamily(val);
        document.documentElement && document.documentElement.style.setProperty('--ui-font-family', fam);
        localStorage.setItem('ui_font_family', fam);
      } catch (_) {}
    }});
    uiFontDdRef = uiFontDd;
    // Align dropdown vertically with label like Theme tab toolbar rows
    try { uiFontDd.el.style.marginTop = '0'; } catch (_) {}
    // Section-local Reset for Display settings
    const uiResetBtn = createUiElement(basicButton, 'Reset');
    uiResetBtn.onclick = () => {
      // Reset font size and letter spacing sliders
      try { fsReset && fsReset(); } catch (_) {}
      try { lsReset && lsReset(); } catch (_) {}
      // Reset UI font to system default and sync dropdown
      try {
        const defStack = LockedThemeDefaults['--ui-font-family'];
        document.documentElement && document.documentElement.style.setProperty('--ui-font-family', defStack);
        localStorage.setItem('ui_font_family', defStack);
        uiFontDdRef && uiFontDdRef.setValue && uiFontDdRef.setValue('system', true);
      } catch (_) {}
    };
    uiFontRow.appendChild(uiFontLbl);
    uiFontRow.appendChild(uiFontDd.el);
    uiFontRow.appendChild(uiResetBtn);
    // Append inside the section to keep spacing consistent with header
    sec.appendChild(uiFontRow);
  } catch (_) {}

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

  // Font Spacing slider (UI-only letter-spacing in rem; 0.00 .. 0.30)
  const { row: lsRow, input: lsRng, value: lsVal, reset: lsReset } = createRangeElement(
    0, 0.3, 0.01, 0, 'Font Spacing:', {
      storageKey: 'ui_letter_spacing',
      attachWheel,
      debugLabel: 'display',
      toDisplay: (v) => { const vv = Number(v); const txt = `${vv.toFixed(2)}rem`; return { text: txt, title: txt, derived: { v: vv } }; },
      fromStorage: (s) => { let v = parseFloat(s); if (!Number.isFinite(v)) v = 0; if (v < 0) v = 0; if (v > 0.3) v = 0.3; return v; },
      onChange: (v) => {
        try {
          const root = document.documentElement;
          if (root) {
            root.style.setProperty('--ui-letter-spacing', `${v}rem`);
            // Ensure inheritance across the app; components can override if needed
            root.style.letterSpacing = 'var(--ui-letter-spacing, 0rem)';
          }
        } catch (_) {}
      }
    }
  );
  lsRng.id = 'settings-ui-letterspacing-ovl';
  lsVal.id = 'settings-ui-letterspacing-ovl-val';
  container.appendChild(lsRow);

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
    // Section-local Reset for Dungeon Settings
    const dfResetBtn = createUiElement(basicButton, 'Reset');
    dfResetBtn.onclick = () => {
      try { localStorage.setItem('ui_dungeon_font', 'A'); } catch (_) {}
      try { dfDdRef && dfDdRef.setValue && dfDdRef.setValue('A', true); } catch (_) {}
    };
    try { dfResetBtn.style.marginLeft = '0.5rem'; } catch (_) {}
    dfRow.appendChild(dfLbl);
    dfRow.appendChild(dfDd.el);
    dfRow.appendChild(dfResetBtn);
    dsec.appendChild(dfRow);
  } catch (_) {}

}
