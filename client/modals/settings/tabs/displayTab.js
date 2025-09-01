// Display Tab: renders the Display settings for panel and overlay
// Variant 'panel' and 'overlay' differ only by input IDs and container naming.
// Minimal, commented, and human-readable per project conventions.

import { makeSection, attachWheel } from '../uiHelpers.js';

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

  // Section header: random quip aligned upper-right
  const quip = DISPLAY_QUIPS[Math.floor(Math.random() * DISPLAY_QUIPS.length)];
  const sec = makeSection('Display', quip, 'afterTitle', true);
  container.appendChild(sec);

  // IDs differ per variant so inputs are unique between contexts
  const idSuffix = '-ovl';
  // Refs for Reset handler
  let fsRngRef = null;
  let fsValRef = null;

  // Font Size slider (root rem scale) shown in pixels
  const fsRow = document.createElement('div');
  fsRow.style.display = 'flex'; fsRow.style.alignItems = 'center'; fsRow.style.gap = '8px'; fsRow.style.marginBottom = '8px';
  const fsLbl = document.createElement('label'); fsLbl.textContent = 'Font Size:'; fsLbl.style.minWidth = '140px';
  const fsRng = document.createElement('input'); fsRng.type = 'range'; fsRng.min = '80'; fsRng.max = '120'; fsRng.step = '1'; fsRng.style.flex = '1'; fsRng.id = `settings-ui-fontscale${idSuffix}`;
  const fsVal = document.createElement('span'); fsVal.style.width = '52px'; fsVal.style.textAlign = 'right'; fsVal.style.color = 'var(--ui-fg-muted, #ccc)'; fsVal.id = `settings-ui-fontscale${idSuffix}-val`;

  // Bind refs for Reset handler
  fsRngRef = fsRng; fsValRef = fsVal;

  try {
    let scale = parseFloat(localStorage.getItem('ui_font_scale'));
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    const p = Math.max(80, Math.min(120, Math.round(scale * 100)));
    fsRng.value = String(p);
    const px = Math.round(16 * (p / 100));
    fsVal.textContent = `${px}px`; fsRng.title = `${px}px`;
  } catch (_) {}

  // Add mouse wheel support to the range input
  attachWheel(fsRng);

  fsRng.oninput = () => {
    const p = Math.max(80, Math.min(120, Math.round(parseFloat(fsRng.value) || 100)));
    if (String(p) !== fsRng.value) fsRng.value = String(p);
    const scale = p / 100;
    const px = Math.round(16 * scale);
    fsVal.textContent = `${px}px`; fsRng.title = `${px}px`;
    try { console.debug(`[display] fontScale(overlay/display) p=${p} scale=${scale} px=${px}`); } catch (_) {}
    try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: scale }); } catch (_) {}
    try { localStorage.setItem('ui_font_scale', String(scale)); } catch (_) {}
  };

  fsRow.appendChild(fsLbl); fsRow.appendChild(fsRng); fsRow.appendChild(fsVal);
  container.appendChild(fsRow);

  // Footer row with Reset button aligned bottom-right
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.marginTop = '8px';

  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset';
  resetBtn.style.background = 'transparent';
  resetBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  resetBtn.style.borderRadius = '10px';
  resetBtn.style.color = 'var(--ui-fg, #eee)';
  resetBtn.style.padding = '4px 10px';
  resetBtn.style.cursor = 'pointer';
  const onHover = () => { try { resetBtn.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))'; resetBtn.style.outline = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))'; } catch (_) {} };
  const onLeave = () => { try { resetBtn.style.boxShadow = 'none'; resetBtn.style.outline = 'none'; } catch (_) {} };
  try {
    resetBtn.addEventListener('mouseenter', onHover);
    resetBtn.addEventListener('mouseleave', onLeave);
    resetBtn.addEventListener('focus', onHover);
    resetBtn.addEventListener('blur', onLeave);
  } catch (_) {}

  resetBtn.onclick = () => {
    // Reset: font scale back to 1 (16px)
    try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: 1 }); } catch (_) {}
    try { localStorage.setItem('ui_font_scale', '1'); } catch (_) {}
    try { if (fsRngRef) fsRngRef.value = '100'; if (fsValRef) { fsValRef.textContent = '16px'; fsRngRef && (fsRngRef.title = '16px'); } } catch (_) {}
  };

  footer.appendChild(resetBtn);
  container.appendChild(footer);
}
