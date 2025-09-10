// Display Tab: renders the Display settings for panel and overlay
// Variant 'panel' and 'overlay' differ only by input IDs and container naming.
// Minimal, commented, and human-readable per project conventions.

import { makeSection, attachWheel } from '../uiHelpers.js';
import { createUiElement, basicButton, createRangeElement, basicFormRow, basicFormLabel, basicQuarterGap, basicGapBetweenSections, basicToolbarRow } from '../../../core/ui/theme/elements.js';
import { createDropdown } from '../../../core/ui/controls.js';
import { listFonts, getFont, resolveImageSrc, computeGlyphCount } from '../../../core/ui/dungeon/fontCatalog.js';
import { LockedThemeDefaults } from '../../../core/ui/theme/tokens.js';
import { getQuip } from '../../../core/ui/quip.js';
import { defineNamespace as definePrefsNs, loadAll as prefsLoadAll, get as prefsGet, set as prefsSet, resetAll as prefsResetAll } from '../../../core/prefs/prefs.js';

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

  // Ensure Display RC namespace is defined (vendor defaults)
  try {
    definePrefsNs('display.rc', {
      version: 1,
      defaults: {
        // Vendor-aligned defaults
        basePPExp: 0,              // 2^0 => 1 pixel between base probes
        baseRayCount: 4,           // 4 rays base
        rayInterval: 1.0,          // interval length
        intervalOverlap: 0.1,      // 10%
        distanceAttenuation: 0.0,  // vendor UI had no attenuation; keep 0
        emissionThreshold: 0.35,   // GI seeding threshold (project extension)
        bilinearFix: true,         // vendor default: YES
        nearestFiltering: false,   // vendor default: Nearest OFF
        addNoise: false,
        enableSun: false,
        sunAngle: 0.0,
        forceFullPass: true,
      }
    });
  } catch (_) {}

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

  // Keep references for updates triggered by dropdown/zoom
  let dfDdRef = null;
  let updatePreview = () => {};
  let updateInfo = () => {};

  // Dungeon Font dropdown driven by fontCatalog. Persists by id.
  try {
    // Use toolbarRow (CSS grid: label | control | action) for clean alignment
    const dfRow = createUiElement(basicToolbarRow, 'div');
    const dfLbl = createUiElement(basicFormLabel, 'Dungeon Font:');

    const fonts = listFonts();
    let initialId = (fonts[0] && fonts[0].id) || 'vendor-8x8';
    try {
      const s = localStorage.getItem('ui_dungeon_font_id');
      if (s) {
        // Migrate older ids to the new stable catalog ids
        const alias = {
          'vendor-16x16': 'Bisasam_16x16',
          'Bisasam 16x16': 'Bisasam_16x16',
        };
        const mapped = alias[s] || s;
        initialId = mapped;
        if (mapped !== s) {
          try { localStorage.setItem('ui_dungeon_font_id', mapped); } catch (_) {}
        }
      }
    } catch (_) {}

    const items = fonts.map(f => ({ label: f.name, value: f.id }));
    function dispatchDungeonFont(fontId) {
      try {
        const f = getFont(fontId);
        if (!f) return;
        const src = resolveImageSrc(f);
        if (!src) return;
        const detail = {
          id: f.id,
          name: f.name,
          tile: f.tile,
          atlas: f.atlas,
          startCode: Number.isFinite(f.startCode) ? f.startCode : 32,
        };
        // Include optional flip hints ONLY if present on the font
        if (Object.prototype.hasOwnProperty.call(f, 'flipTextureY')) detail.flipTextureY = !!f.flipTextureY;
        if (Object.prototype.hasOwnProperty.call(f, 'flipTextureX')) detail.flipTextureX = !!f.flipTextureX;
        if (Object.prototype.hasOwnProperty.call(f, 'flipRow')) detail.flipRow = !!f.flipRow;
        if (Object.prototype.hasOwnProperty.call(f, 'flipTileY')) detail.flipTileY = !!f.flipTileY;
        if (f.dataUrl) detail.dataUrl = f.dataUrl; else detail.url = src;
        window.dispatchEvent(new CustomEvent('ui:dungeon-font-changed', { detail }));
      } catch (_) {}
    }

    const dfDd = createDropdown({ items, value: initialId, width: '16rem', onChange: (id) => {
      try { localStorage.setItem('ui_dungeon_font_id', String(id)); } catch (_) {}
      updatePreview();
      updateInfo();
      dispatchDungeonFont(id);
    }});
    dfDdRef = dfDd;
    // Section-local Reset for Dungeon Settings (reset to first catalog font)
    const dfResetBtn = createUiElement(basicButton, 'Reset');
    dfResetBtn.onclick = () => {
      const first = (listFonts()[0] && listFonts()[0].id) || 'vendor-8x8';
      try { localStorage.setItem('ui_dungeon_font_id', first); } catch (_) {}
      try { dfDdRef && dfDdRef.setValue && dfDdRef.setValue(first, true); } catch (_) {}
      updatePreview();
      updateInfo();
      dispatchDungeonFont(first);
    };
    // Rely on grid gap for spacing; no manual margins needed
    dfRow.appendChild(dfLbl);
    dfRow.appendChild(dfDd.el);
    dfRow.appendChild(dfResetBtn);
    // Add a quarter-space before the Dungeon Font row per request
    try { dsec.appendChild(createUiElement(basicQuarterGap)); } catch (_) {}
    dsec.appendChild(dfRow);
    // Sync current selection to the dungeon renderer on first render
    try { dispatchDungeonFont(initialId); } catch (_) {}
  } catch (_) {}

  // Bitmap Glyph Preview (no vendor runtime). Uses fontCatalog metadata.
  try {
    // Preview row
    const prevRow = createUiElement(basicFormRow, 'div');
    // Align the multi-line label/controls with the top of the preview box
    try { prevRow.style.alignItems = 'flex-start'; prevRow.style.width = '100%'; } catch (_) {}
    const prevLbl = createUiElement(basicFormLabel, 'Glyph Preview:');
    // Create a label column to place zoom controls UNDER the label
    const labelCol = document.createElement('div');
    labelCol.style.display = 'flex';
    labelCol.style.flexDirection = 'column';
    labelCol.style.gap = '0.25rem';
    const labelTop = document.createElement('div');
    labelTop.appendChild(prevLbl);
    const controlsRow = document.createElement('div');
    controlsRow.style.display = 'flex';
    controlsRow.style.gap = '0.375rem';
    controlsRow.style.alignItems = 'center';
    try { controlsRow.style.marginTop = '0.25rem'; } catch (_) {}
    const zoomOutBtn = createUiElement(basicButton, '-');
    const zoomInBtn = createUiElement(basicButton, '+');
    try { zoomOutBtn.type = 'button'; zoomInBtn.type = 'button'; } catch (_) {}
    // Fixed size buttons as requested
    [zoomOutBtn, zoomInBtn].forEach((b) => {
      try {
        b.style.width = '1.5rem';
        b.style.height = '1.5rem';
        b.style.padding = '0';
        b.style.lineHeight = '1.5rem';
        b.style.textAlign = 'center';
      } catch (_) {}
    });
    controlsRow.appendChild(zoomOutBtn);
    controlsRow.appendChild(zoomInBtn);
    // Zoom label (xN) lives next to the +/- buttons; small text
    const zoomLbl = document.createElement('div');
    try {
      zoomLbl.style.fontSize = 'var(--ui-fontsize-xsmall, 0.75rem)';
      zoomLbl.style.opacity = '0.9';
      zoomLbl.style.minWidth = '2.5rem';
    } catch (_) {}
    zoomLbl.textContent = 'x1';
    controlsRow.appendChild(zoomLbl);
    labelCol.appendChild(labelTop);
    labelCol.appendChild(controlsRow);
    // Fix label column width to align with other form rows
    try { labelCol.style.minWidth = '8.75rem'; labelCol.style.maxWidth = '8.75rem'; labelCol.style.flex = '0 0 8.75rem'; } catch (_) {}
    const prevBox = document.createElement('div');
    prevBox.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.45))';
    prevBox.style.borderRadius = '0.5rem';
    prevBox.style.padding = '0.5rem';
    prevBox.style.background = 'linear-gradient(180deg, rgba(10,18,36,0.08), rgba(8,14,28,0.06))';
    prevBox.style.display = 'flex';
    prevBox.style.flexDirection = 'column';
    prevBox.style.gap = '0.5rem';
    // Make the parent the scroller so padding is inside the scrollbars (theme standard)
    try { prevBox.style.overflow = 'auto'; prevBox.style.position = 'relative'; prevBox.style.height = '10rem'; } catch (_) {}
    // Remember base styles so we can toggle hover glow cleanly
    const prevBoxBase = { border: prevBox.style.border, boxShadow: prevBox.style.boxShadow || '' };
    function setGlyphContainerHover(on) {
      try {
        if (on) {
          prevBox.style.border = '1px solid var(--ui-bright-border, rgba(120,170,255,0.85))';
          prevBox.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.30))';
        } else {
          prevBox.style.border = prevBoxBase.border;
          prevBox.style.boxShadow = prevBoxBase.boxShadow;
        }
      } catch (_) {}
    }
    // Critical for flex children to allow shrinking instead of forcing the row wider
    try {
      prevBox.style.flex = '1 1 auto';
      prevBox.style.minWidth = '0';
      prevBox.style.maxWidth = '100%';
    } catch (_) {}

    const scrollWrap = document.createElement('div');
    scrollWrap.style.width = '100%';
    scrollWrap.style.maxWidth = '100%';
    scrollWrap.style.minWidth = '0';
    // Inner wrapper is not the scroller; keep visible so parent (prevBox) scrollbars include padding
    scrollWrap.style.height = 'auto';
    scrollWrap.style.overflow = 'visible';
    scrollWrap.style.borderRadius = '0.375rem';
    scrollWrap.style.background = 'transparent';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.style.imageRendering = 'pixelated';
    canvas.style.display = 'block';
    // Do not allow canvas to impose its own max-width on parents
    canvas.style.maxWidth = 'none';
    scrollWrap.appendChild(canvas);

    // Keep previously configured flex settings; do not override here.
    prevRow.appendChild(labelCol);
    prevRow.appendChild(prevBox);
    dsec.appendChild(prevRow);

    prevBox.appendChild(scrollWrap);
    // Glow and borderBright when mouse is over the glyph container area
    try {
      prevBox.addEventListener('mouseenter', () => setGlyphContainerHover(true));
      prevBox.addEventListener('mouseleave', () => setGlyphContainerHover(false));
    } catch (_) {}

    // Info block under preview (two lines)
    const infoRow = createUiElement(basicFormRow, 'div');
    const infoLbl = createUiElement(basicFormLabel, 'Info:');
    const infoCol = document.createElement('div');
    infoCol.style.display = 'flex';
    infoCol.style.flexDirection = 'column';
    infoCol.style.gap = '0.125rem';
    const infoTextTop = document.createElement('div');
    const infoTextBottom = document.createElement('div');
    infoTextTop.style.opacity = '0.9';
    infoTextBottom.style.opacity = '0.9';
    // Top line shows hovered glyph info (normal). Bottom shows font info (small).
    infoTextTop.style.fontSize = 'var(--ui-fontsize-normal, 1rem)';
    infoTextBottom.style.fontSize = 'var(--ui-fontsize-small, 0.875rem)';
    try { infoTextTop.style.paddingTop = '0.25rem'; } catch (_) {}
    infoCol.appendChild(infoTextTop);
    infoCol.appendChild(infoTextBottom);
    infoRow.appendChild(infoLbl);
    infoRow.appendChild(infoCol);
    dsec.appendChild(infoRow);

    let zoomLevel = 1;          // integer zoom multiplier (>=1)
    let currentImg = null;      // loaded Image for current font
    let derived = { cols: null, rows: null, count: null }; // computed from image when available
    let lastHover = { col: -1, row: -1 }; // hovered cell for preview highlight

    function currentFont() {
      try {
        let id = null;
        try { id = (dfDdRef && dfDdRef.getValue && dfDdRef.getValue()) || null; } catch (_) {}
        if (!id) { try { id = localStorage.getItem('ui_dungeon_font_id'); } catch (_) { id = null; } }
        return getFont(id) || getFont('vendor-8x8');
      } catch (_) {
        return getFont('vendor-8x8');
      }
    }

    function fitToBox(font, img) {
      if (!font || !img) return;
      const start = Number.isFinite(font.startCode) ? font.startCode : 32;
      let glyphCount = (derived.count && Number.isFinite(derived.count)) ? derived.count : computeGlyphCount(font);
      glyphCount = Math.max(1, Number.isFinite(glyphCount) ? glyphCount : 1);
      let atlasCols = (derived.cols && Number.isFinite(derived.cols)) ? derived.cols : (font.atlas?.cols || 16);
      atlasCols = Math.max(1, Number.isFinite(atlasCols) ? atlasCols : 16);
      const cols = Math.max(1, Math.min(atlasCols, 16)); // cap preview grid cols at 16 for readability
      const rows = Math.max(1, Math.ceil(glyphCount / cols));
      const cellW = font.tile.w;
      const cellH = font.tile.h;
      // Prefer the parent box size for better initial fit
      const availW = prevBox.clientWidth || scrollWrap.clientWidth || (cols * cellW);
      const availH = (prevBox.clientHeight || scrollWrap.clientHeight || 160); // ~10rem default
      const scaleW = availW / (cols * cellW);
      // Width-first integer fit. Use actual integer without forcing 2x minimum.
      zoomLevel = Math.max(1, Math.floor(scaleW));
      try { updateZoomLabel(); } catch (_) {}
    }

    let lastGrid = { cols: 0, rows: 0, start: 32, glyphCount: 0, cellW: 0, cellH: 0, tileW: 0, tileH: 0 };
    function drawPreview(font, img) {
      if (!font) return;
      const start = Number.isFinite(font.startCode) ? font.startCode : 32;
      let glyphCount = (derived.count && Number.isFinite(derived.count)) ? derived.count : computeGlyphCount(font);
      glyphCount = Math.max(1, Number.isFinite(glyphCount) ? glyphCount : 1);
      let atlasCols = (derived.cols && Number.isFinite(derived.cols)) ? derived.cols : (font.atlas?.cols || 16);
      atlasCols = Math.max(1, Number.isFinite(atlasCols) ? atlasCols : 16);
      const cols = Math.max(1, Math.min(atlasCols, 16));
      const rows = Math.max(1, Math.ceil(glyphCount / cols));
      const TILE_W = font.tile.w;
      const TILE_H = font.tile.h;
      const cellW = Math.max(1, TILE_W * zoomLevel);
      const cellH = Math.max(1, TILE_H * zoomLevel);
      canvas.width = cols * cellW;
      canvas.height = rows * cellH;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw glyphs sequentially starting at startCode
      for (let i = 0; i < glyphCount; i++) {
        const code = start + i;
        // Map to atlas index starting at 0 for startCode-based atlases
        const atlasIndex = code - start;
        const sx = (atlasIndex % atlasCols) * TILE_W;
        const sy = Math.floor(atlasIndex / atlasCols) * TILE_H; // top-to-bottom rows
        const dx = (i % cols) * cellW;
        const dy = Math.floor(i / cols) * cellH;
        try { ctx.drawImage(img, sx, sy, TILE_W, TILE_H, dx, dy, cellW, cellH); } catch (_) {}
      }
      // Save grid info for hover hit-testing
      lastGrid = { cols, rows, start, glyphCount, cellW, cellH, tileW: TILE_W, tileH: TILE_H };
      // Draw hover highlight if applicable (theme-compliant)
      try { drawHoverHighlight(); } catch (_) {}
    }

    function drawHoverHighlight() {
      try {
        if (!lastGrid || lastHover.col < 0 || lastHover.row < 0) return;
        const cs = getComputedStyle(document.documentElement);
        const color = (cs.getPropertyValue('--ui-bright-border') || cs.getPropertyValue('--ui-surface-border') || 'rgba(120,170,255,0.85)').trim();
        const dx = lastHover.col * lastGrid.cellW;
        const dy = lastHover.row * lastGrid.cellH;
        const w = lastGrid.cellW;
        const h = lastGrid.cellH;
        ctx.save();
        // Soft fill using theme hue (slightly stronger for visibility)
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = color;
        ctx.fillRect(dx, dy, w, h);
        // Outline with glow
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, Math.floor(zoomLevel / 2));
        ctx.shadowColor = (cs.getPropertyValue('--ui-bright') || color || 'rgba(120,170,255,1)').trim();
        ctx.shadowBlur = 10;
        ctx.strokeRect(dx + 0.5, dy + 0.5, w - 1, h - 1);
        ctx.restore();
      } catch (_) {}
    }

    function renderFallbackText(font) {
      const start = Number.isFinite(font?.startCode) ? font.startCode : 32;
      const glyphCount = computeGlyphCount(font);
      const cols = 16;
      const rows = Math.ceil(glyphCount / cols);
      const pre = document.createElement('pre');
      pre.style.margin = '0';
      pre.style.fontFamily = 'monospace, ui-monospace, SFMono-Regular, Menlo, Consolas';
      pre.style.lineHeight = '1.2';
      pre.style.userSelect = 'text';
      pre.style.whiteSpace = 'pre';
      let grid = '';
      let row = '';
      for (let i = 0; i < glyphCount; i++) {
        row += String.fromCharCode(start + i) + ' ';
        if (((i + 1) % cols) === 0) { grid += row + '\n'; row = ''; }
      }
      if (row) grid += row + '\n';
      // Swap in fallback
      try { scrollWrap.innerHTML = ''; } catch (_) {}
      scrollWrap.appendChild(pre);
      pre.textContent = grid;
    }

    function loadAndRender(font) {
      if (!font) return;
      // Ensure scrollWrap contains the canvas for drawing mode
      try { scrollWrap.innerHTML = ''; } catch (_) {}
      scrollWrap.appendChild(canvas);
      const src = resolveImageSrc(font);
      if (!src) { renderFallbackText(font); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous'; // allow remote previews without tainting concerns for draw only
      img.onload = () => {
        currentImg = img;
        // Derive atlas layout and glyph count from image dimensions if possible
        try {
          const TILE_W = font.tile.w; const TILE_H = font.tile.h;
          const colsEff = Math.max(1, Math.floor(img.width / TILE_W));
          const rowsEff = Math.max(1, Math.floor(img.height / TILE_H));
          derived.cols = colsEff; derived.rows = rowsEff; derived.count = colsEff * rowsEff;
        } catch (_) { derived = { cols: null, rows: null, count: null }; }
        fitToBox(font, img);
        drawPreview(font, img);
        try { updateInfo(); } catch (_) {}
      };
      img.onerror = (err) => {
        try { console.warn('[GlyphPreview] Image failed to load:', { src, err, font }); } catch (_) {}
        renderFallbackText(font);
      };
      img.src = src;
    }

    updatePreview = () => { const f = currentFont(); loadAndRender(f); };
    function updateZoomLabel() { try { zoomLbl.textContent = `x${zoomLevel}`; } catch (_) {} }
    updateInfo = () => {
      const f = currentFont();
      if (!f) { infoTextTop.textContent = 'No font selected'; infoTextBottom.textContent = ''; return; }
      const count = (derived.count && Number.isFinite(derived.count)) ? derived.count : computeGlyphCount(f);
      // Bottom line: base font/atlas info (no zoom indicator here)
      infoTextBottom.textContent = `${f.tile.w}x${f.tile.h} • ${count} glyphs • start ${Number.isFinite(f.startCode)?f.startCode:32}`;
      // Top line: hovered glyph details
      let hoverLine = 'No glyph selected';
      try {
        if (lastGrid && lastHover.col >= 0 && lastHover.row >= 0) {
          const idx = lastHover.row * lastGrid.cols + lastHover.col;
          const code = lastGrid.start + idx;
          const ch = String.fromCharCode(code);
          const hex = '0x' + code.toString(16).toUpperCase().padStart(2, '0');
          hoverLine = `hover ${code} '${ch}' (${hex})`;
        }
      } catch (_) {}
      infoTextTop.textContent = hoverLine;
      // Keep zoom label next to +/-
      updateZoomLabel();
    };

    function handleHover(ev) {
      try {
        if (!lastGrid || !currentImg) { updateInfo(); return; }
        const rect = canvas.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
          if (lastHover.col !== -1 || lastHover.row !== -1) {
            lastHover = { col: -1, row: -1 };
            const f = currentFont();
            try { drawPreview(f, currentImg); } catch (_) {}
          }
          updateInfo();
          return;
        }
        const col = Math.floor(x / lastGrid.cellW);
        const row = Math.floor(y / lastGrid.cellH);
        if (col !== lastHover.col || row !== lastHover.row) {
          lastHover = { col, row };
          const f = currentFont();
          try { drawPreview(f, currentImg); } catch (_) {}
        }
        // Always refresh Info line during hover
        updateInfo();
      } catch (_) { /* no-op */ }
    }

    const handleZoomIn = (ev) => {
      try {
        try { console.debug('[GlyphPreview] + clicked'); } catch (_) {}
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        if (!Number.isFinite(zoomLevel) || zoomLevel < 1) zoomLevel = 1;
        zoomLevel = Math.min(64, zoomLevel + 1);
        const f = currentFont();
        if (currentImg) { try { drawPreview(f, currentImg); } catch (e) { try { console.error('[GlyphPreview] drawPreview (zoom in) failed', e); } catch (_) {} } }
        try { updateInfo(); } catch (_) {}
      } catch (err) {
        try { console.error('[GlyphPreview] zoomIn failed:', err); } catch (_) {}
      }
    };
    const handleZoomOut = (ev) => {
      try {
        try { console.debug('[GlyphPreview] - clicked'); } catch (_) {}
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        if (!Number.isFinite(zoomLevel) || zoomLevel < 1) zoomLevel = 1;
        zoomLevel = Math.max(1, zoomLevel - 1);
        const f = currentFont();
        if (currentImg) { try { drawPreview(f, currentImg); } catch (e) { try { console.error('[GlyphPreview] drawPreview (zoom out) failed', e); } catch (_) {} } }
        try { updateInfo(); } catch (_) {}
      } catch (err) {
        try { console.error('[GlyphPreview] drawPreview (zoom out) failed', err); } catch (_) {}
      }
    };
    // Attach handlers
    try { zoomInBtn.onclick = handleZoomIn; zoomOutBtn.onclick = handleZoomOut; } catch (_) {}
    try { canvas.addEventListener('mousemove', handleHover); canvas.addEventListener('mouseleave', handleHover); } catch (_) {}
    // Initial render
    try { updatePreview(); updateInfo(); } catch (_) {}

  } catch (_) {}

  // Our Enhancements (threshold/curve/fog) — gated by flag
  try {
    const ENABLE_DEBUG = (typeof window !== 'undefined' && window.__enableDisplayDebug != null)
      ? !!window.__enableDisplayDebug
      : true; // enable by default; set window.__enableDisplayDebug=false to hide
    if (ENABLE_DEBUG) {
      const dbg = makeSection('Our Enhancements', 'Non-vendor tweaks (threshold/curve/fog). F8 hides UI.', 'afterTitle', true);
      container.appendChild(dbg);

      const toFixed2 = (v) => Number(v).toFixed(2);

      const { row: thrRow, input: thrRng, value: thrVal, reset: thrReset } = createRangeElement(
        0, 1, 0.01, 0, 'Threshold:', {
          storageKey: 'rc_debug_threshold',
          attachWheel,
          debugLabel: 'display',
          toDisplay: (v) => ({ text: toFixed2(v), title: toFixed2(v), derived: { v } }),
          fromStorage: (s) => { const v = parseFloat(s); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; },
          onChange: (v) => {
            try {
              const curve = parseFloat(localStorage.getItem('rc_debug_curve') || '1') || 1;
              const fogAmount = parseFloat(localStorage.getItem('rc_debug_fog') || '0.8');
              const srgbFalloff = parseFloat(localStorage.getItem('rc_debug_srgb') || '2.0');
              const detail = { threshold: Number(v) || 0, curve, fogAmount, srgbFalloff };
              window.dispatchEvent(new CustomEvent('ui:rc-debug-changed', { detail }));
            } catch (_) {}
          }
        }
      );
      thrRng.id = 'settings-rc-threshold';
      thrVal.id = 'settings-rc-threshold-val';
      dbg.appendChild(thrRow);

      const { row: crvRow, input: crvRng, value: crvVal, reset: crvReset } = createRangeElement(
        0.1, 4, 0.05, 1, 'Curve:', {
          storageKey: 'rc_debug_curve',
          attachWheel,
          debugLabel: 'display',
          toDisplay: (v) => ({ text: toFixed2(v), title: toFixed2(v), derived: { v } }),
          fromStorage: (s) => { const v = parseFloat(s); return Number.isFinite(v) ? Math.max(0.1, Math.min(4, v)) : 1; },
          onChange: (v) => {
            try {
              const thr = parseFloat(localStorage.getItem('rc_debug_threshold') || '0') || 0;
              const fogAmount = parseFloat(localStorage.getItem('rc_debug_fog') || '0.8');
              const srgbFalloff = parseFloat(localStorage.getItem('rc_debug_srgb') || '2.0');
              const detail = { threshold: thr, curve: Number(v) || 1, fogAmount, srgbFalloff };
              window.dispatchEvent(new CustomEvent('ui:rc-debug-changed', { detail }));
            } catch (_) {}
          }
        }
      );
      crvRng.id = 'settings-rc-curve';
      crvVal.id = 'settings-rc-curve-val';
      dbg.appendChild(crvRow);

      // Fog Amount slider (0..1)
      const { row: fogRow, input: fogRng, value: fogVal, reset: fogReset } = createRangeElement(
        0.0, 1.0, 0.05, 0.8, 'Fog Amount:', {
          storageKey: 'rc_debug_fog',
          attachWheel,
          debugLabel: 'display',
          toDisplay: (v) => ({ text: toFixed2(v), title: toFixed2(v), derived: { v } }),
          fromStorage: (s) => {
            const v = parseFloat(s);
            return Number.isFinite(v) ? Math.max(0.0, Math.min(1.0, v)) : 0.8;
          },
          onChange: (v) => {
            try {
              const thr = parseFloat(localStorage.getItem('rc_debug_threshold') || '0') || 0;
              const curve = parseFloat(localStorage.getItem('rc_debug_curve') || '1') || 1;
              const srgbFalloff = parseFloat(localStorage.getItem('rc_debug_srgb') || '2.0');
              const detail = { threshold: thr, curve, fogAmount: Number(v) || 0.8, srgbFalloff };
              window.dispatchEvent(new CustomEvent('ui:rc-debug-changed', { detail }));
            } catch (_) {}
          }
        }
      );
      fogRng.id = 'settings-rc-fog';
      fogVal.id = 'settings-rc-fog-val';
      dbg.appendChild(fogRow);

      // Move our custom controls here (were previously under Advanced)
      // Distance Attenuation (light decay)
      const { row: ldRow } = createRangeElement(
        0.0, 3.0, 0.05, Math.max(0.0, Math.min(3.0, Number(prefsGet('display.rc', 'distanceAttenuation', 0.0)) || 0.0)), 'Distance Attenuation:', {
          attachWheel,
          debugLabel: 'display',
          toDisplay: (v) => ({ text: toFixed2(v), title: toFixed2(v), derived: { v: Number(v) } }),
          onChange: (v) => {
            try {
              prefsSet('display.rc', 'distanceAttenuation', Number(v) || 0.0);
              const p = prefsLoadAll('display.rc');
              window.dispatchEvent(new CustomEvent('ui:rc-advanced-changed', { detail: p }));
            } catch (_) {}
          }
        }
      );
      dbg.appendChild(ldRow);

      // Emission Threshold (DF seeding)
      const { row: etRow } = createRangeElement(
        0.0, 1.0, 0.01, Math.max(0.0, Math.min(1.0, Number(prefsGet('display.rc', 'emissionThreshold', 0.35)) || 0.35)), 'Emission Threshold:', {
          attachWheel,
          debugLabel: 'display',
          toDisplay: (v) => ({ text: toFixed2(v), title: toFixed2(v), derived: { v: Number(v) } }),
          onChange: (v) => {
            try {
              prefsSet('display.rc', 'emissionThreshold', Number(v) || 0.35);
              const p = prefsLoadAll('display.rc');
              window.dispatchEvent(new CustomEvent('ui:rc-advanced-changed', { detail: p }));
            } catch (_) {}
          }
        }
      );
      dbg.appendChild(etRow);

      // Debug Reset button
      const dbgToolbar = createUiElement(basicToolbarRow, 'div');
      const dbgResetBtn = createUiElement(basicButton, 'Reset');
      dbgResetBtn.onclick = () => {
        try { thrReset && thrReset(); } catch (_) {}
        try { crvReset && crvReset(); } catch (_) {}
        try { fogReset && fogReset(); } catch (_) {}
        try {
          const thr = parseFloat(localStorage.getItem('rc_debug_threshold') || '0') || 0;
          const curve = parseFloat(localStorage.getItem('rc_debug_curve') || '1') || 1;
          const fogAmount = parseFloat(localStorage.getItem('rc_debug_fog') || '0.8');
          const srgbFalloff = parseFloat(localStorage.getItem('rc_debug_srgb') || '2.0');
          window.dispatchEvent(new CustomEvent('ui:rc-debug-changed', { detail: { threshold: thr, curve, fogAmount, srgbFalloff } }));
        } catch (_) {}
      };
      dbgToolbar.appendChild(document.createElement('div'));
      dbgToolbar.appendChild(document.createElement('div'));
      dbgToolbar.appendChild(dbgResetBtn);
      dbg.appendChild(dbgToolbar);

      // Emit current values once so renderer syncs when opening tab
      try {
        const thr = parseFloat(localStorage.getItem('rc_debug_threshold') || '0') || 0;
        const curve = parseFloat(localStorage.getItem('rc_debug_curve') || '1') || 1;
        const fogAmount = parseFloat(localStorage.getItem('rc_debug_fog') || '0.8');
        const srgbFalloff = parseFloat(localStorage.getItem('rc_debug_srgb') || '2.0');
        window.dispatchEvent(new CustomEvent('ui:rc-debug-changed', { detail: { threshold: thr, curve, fogAmount, srgbFalloff } }));
      } catch (_) {}
    }
  } catch (_) {}

  // Advanced GI/Renderer section
  try {
    // Helper to emit entire advanced payload from prefs
    const emitAdvanced = () => {
      try {
        const p = prefsLoadAll('display.rc');
        window.dispatchEvent(new CustomEvent('ui:rc-advanced-changed', { detail: p }));
      } catch (_) {}
    };

    const adv = makeSection('Advanced GI/Renderer', 'Expose vendor GI parameters', 'afterTitle', true);
    container.appendChild(adv);

    const toFixed2 = (v) => Number(v).toFixed(2);
    // Vendor-style numeric formatter: integers shown without decimal; otherwise trim trailing zeros up to 3dp
    const fmtVendor = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return String(v);
      const r = Math.round(n * 1000) / 1000;
      if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
      let s = r.toFixed(3);
      s = s.replace(/\.0+$/, '').replace(/(\.[0-9]*[1-9])0+$/, '$1');
      return s;
    };

    // Vendor Parity Mode toggle (button). Persists and reloads to apply.
    try {
      const vpRow = createUiElement(basicToolbarRow, 'div');
      const vpLbl = createUiElement(basicFormLabel, 'Vendor Parity Mode:');
      let on = true;
      try { on = ((localStorage.getItem('__vendor_parity_mode') || 'on') === 'on'); } catch (_) {}
      try { window.__rcVendorParity = on; } catch (_) {}
      const btn = createUiElement(basicButton, on ? 'On' : 'Off');
      btn.onclick = () => {
        try {
          on = !on;
          btn.textContent = on ? 'On' : 'Off';
          localStorage.setItem('__vendor_parity_mode', on ? 'on' : 'off');
          try { window.__rcVendorParity = on; } catch (_) {}
          // Reload to fully reinitialize the pipeline under the selected mode
          try { location.reload(); } catch (_) {}
        } catch (_) {}
      };
      vpRow.appendChild(vpLbl);
      vpRow.appendChild(btn);
      adv.appendChild(vpRow);
    } catch (_) {}

    // Falloff (srgb exponent) — vendor control; wire into rc-debug change bus
    try {
      const initFall = (() => { const s = localStorage.getItem('rc_debug_srgb'); const v = parseFloat(s); return Number.isFinite(v) ? Math.max(0.1, Math.min(4.0, v)) : 2.0; })();
      const { row: fallRow, input: fallRng } = createRangeElement(
        0.1, 4.0, 0.1, initFall, 'Falloff:', {
          attachWheel,
          debugLabel: 'display',
          toDisplay: (v) => ({ text: fmtVendor(v), title: fmtVendor(v), derived: { v: Number(v) } }),
          onChange: (v) => {
            try {
              const srgbFalloff = Number(v) || 2.0;
              localStorage.setItem('rc_debug_srgb', String(srgbFalloff));
              const thr = parseFloat(localStorage.getItem('rc_debug_threshold') || '0') || 0;
              const curve = parseFloat(localStorage.getItem('rc_debug_curve') || '1') || 1;
              const fogAmount = parseFloat(localStorage.getItem('rc_debug_fog') || '0.8');
              const detail = { threshold: thr, curve, fogAmount, srgbFalloff };
              window.dispatchEvent(new CustomEvent('ui:rc-debug-changed', { detail }));
            } catch (_) {}
          }
        }
      );
      adv.appendChild(fallRow);
    } catch (_) {}

    // Base Pixels Between Probes (exponent)
    const { row: pppRow, input: pppRng } = createRangeElement(
      0, 4, 1, Math.max(0, Math.min(4, Number(prefsGet('display.rc', 'basePPExp', 0) || 0))), 'Pixels Between Base Probes:', {
        attachWheel,
        debugLabel: 'display',
        toDisplay: (x) => {
          const exp = Math.round(Number(x) || 0);
          const val = Math.pow(2, exp);
          return { text: `${val}`, title: `2^${exp} = ${val}`, derived: { exp, val } };
        },
        onChange: (x) => { try { prefsSet('display.rc', 'basePPExp', Math.round(Number(x) || 0)); emitAdvanced(); } catch (_) {} }
      }
    );
    adv.appendChild(pppRow);

    // Base Ray Count (3-step slider 4/16/64) — show numeric value on right
    const brVals = [4, 16, 64];
    const baseRayInit = Number(prefsGet('display.rc', 'baseRayCount', 4)) || 4;
    const initIdx = Math.max(0, brVals.indexOf(baseRayInit));
    const { row: brRow, input: brRng } = createRangeElement(
      0, 2, 1, initIdx, 'Base Ray Count:', {
        attachWheel,
        debugLabel: 'display',
        toDisplay: (i) => { const idx = Math.round(Number(i) || 0); const val = brVals[idx] ?? 4; return { text: String(val), title: String(val), derived: { idx, val } }; },
        onChange: (i) => { try { const idx = Math.round(Number(i) || 0); const val = brVals[idx] ?? 4; prefsSet('display.rc', 'baseRayCount', val); emitAdvanced(); } catch (_) {} }
      }
    );
    adv.appendChild(brRow);

    // Ray Interval
    const { row: riRow, input: riRng } = createRangeElement(
      1.0, 512.0, 0.1, Math.max(1.0, Math.min(512.0, Number(prefsGet('display.rc', 'rayInterval', 1.0)) || 1.0)), 'Interval Length:', {
        attachWheel,
        debugLabel: 'display',
        toDisplay: (v) => ({ text: fmtVendor(v), title: fmtVendor(v), derived: { v: Number(v) } }),
        onChange: (v) => { try { prefsSet('display.rc', 'rayInterval', Number(v) || 1.0); emitAdvanced(); } catch (_) {} }
      }
    );
    adv.appendChild(riRow);

    // Interval Overlap
    const { row: ioRow, input: ioRng } = createRangeElement(
      -1.0, 2.0, 0.01, Math.max(-1.0, Math.min(2.0, Number(prefsGet('display.rc', 'intervalOverlap', 0.1)) || 0.1)), 'Interval Overlap %:', {
        attachWheel,
        debugLabel: 'display',
        toDisplay: (v) => ({ text: fmtVendor(v), title: fmtVendor(v), derived: { v: Number(v) } }),
        onChange: (v) => { try { prefsSet('display.rc', 'intervalOverlap', Number(v) || 0.1); emitAdvanced(); } catch (_) {} }
      }
    );
    adv.appendChild(ioRow);

    // Toggles: Bilinear Fix, Nearest Filtering, Add Noise, Force Full Pass
    const tgRow1 = createUiElement(basicToolbarRow, 'div');
    const toggleRefs = {};
    const mkToggle = (label, key) => {
      const row = document.createElement('div');
      row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '0.5rem';
      const lbl = createUiElement(basicFormLabel, label);
      const initVal = !!prefsGet('display.rc', key, false);
      const dd = createDropdown({ items: [
        { label: 'On', value: 'on' },
        { label: 'Off', value: 'off' },
      ], value: initVal ? 'on' : 'off', width: '6.5rem', onChange: (v) => {
        try { prefsSet('display.rc', key, v === 'on'); emitAdvanced(); } catch (_) {}
      } });
      // Keep a handle so Reset can update UI as well as prefs
      toggleRefs[key] = dd;
      row.appendChild(lbl);
      row.appendChild(dd.el);
      return row;
    };
    tgRow1.appendChild(mkToggle('Bilinear Fix:', 'bilinearFix'));
    tgRow1.appendChild(mkToggle('Nearest Filtering:', 'nearestFiltering'));
    adv.appendChild(tgRow1);

    const tgRow2 = createUiElement(basicToolbarRow, 'div');
    tgRow2.appendChild(mkToggle('Add Noise:', 'addNoise'));
    // Vendor naming: Reduce Demand (Calculate over 2 frames) => inverse of forceFullPass
    let reduceDemandDd = null;
    try {
      const row = document.createElement('div');
      row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '0.5rem';
      const lbl = createUiElement(basicFormLabel, 'Reduce Demand (Calculate over 2 frames):');
      const forceFull = !!prefsGet('display.rc', 'forceFullPass', true);
      const init = forceFull ? 'off' : 'on';
      const dd = createDropdown({ items: [
        { label: 'On', value: 'on' },
        { label: 'Off', value: 'off' },
      ], value: init, width: '6.5rem', onChange: (v) => {
        try { const reduce = (v === 'on'); prefsSet('display.rc', 'forceFullPass', !reduce); emitAdvanced(); } catch (_) {}
      }});
      row.appendChild(lbl);
      row.appendChild(dd.el);
      reduceDemandDd = dd;
      tgRow2.appendChild(row);
    } catch (_) {}
    adv.appendChild(tgRow2);

    // Sun controls
    const sunRow = createUiElement(basicToolbarRow, 'div');
    const sunToggle = mkToggle('Sun:', 'enableSun');
    sunRow.appendChild(sunToggle);
    const { row: saRow, input: saRng } = createRangeElement(
      0.0, 6.283, 0.01, Math.max(0.0, Math.min(6.283, Number(prefsGet('display.rc', 'sunAngle', 0.0)) || 0.0)), 'Sun Angle:', {
        attachWheel,
        debugLabel: 'display',
        toDisplay: (v) => ({ text: fmtVendor(v), title: fmtVendor(v), derived: { v: Number(v) } }),
        onChange: (v) => { try { prefsSet('display.rc', 'sunAngle', Number(v) || 0.0); emitAdvanced(); } catch (_) {} }
      }
    );
    sunRow.appendChild(saRow);
    adv.appendChild(sunRow);

    // Advanced Reset
    const advToolbar = createUiElement(basicToolbarRow, 'div');
    const advResetBtn = createUiElement(basicButton, 'Reset');
    advResetBtn.onclick = () => {
      try {
        // Reset prefs to vendor-aligned defaults
        prefsResetAll('display.rc');
        // Update UI controls to match defaults so users see immediate reset
        const fire = (el, v) => { try { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {} };
        if (pppRng) fire(pppRng, 0);    // 2^0 => 1
        if (brRng)  fire(brRng, 0);     // index for 4
        if (riRng)  fire(riRng, 1.0);
        if (ioRng)  fire(ioRng, 0.1);
        if (saRng)  fire(saRng, 0.0);
        // Falloff reset: UI + storage + debug event so RC uniform updates
        try {
          if (fallRng) fire(fallRng, 2.0);
          localStorage.setItem('rc_debug_srgb', '2.0');
          const thr = parseFloat(localStorage.getItem('rc_debug_threshold') || '0') || 0;
          const curve = parseFloat(localStorage.getItem('rc_debug_curve') || '1') || 1;
          const fogAmount = parseFloat(localStorage.getItem('rc_debug_fog') || '0.8');
          window.dispatchEvent(new CustomEvent('ui:rc-debug-changed', { detail: { threshold: thr, curve, fogAmount, srgbFalloff: 2.0 } }));
        } catch (_) {}
        // Toggles
        if (toggleRefs.bilinearFix && toggleRefs.bilinearFix.setValue) toggleRefs.bilinearFix.setValue('on');
        if (toggleRefs.nearestFiltering && toggleRefs.nearestFiltering.setValue) toggleRefs.nearestFiltering.setValue('off');
        if (toggleRefs.addNoise && toggleRefs.addNoise.setValue) toggleRefs.addNoise.setValue('off');
        if (toggleRefs.enableSun && toggleRefs.enableSun.setValue) toggleRefs.enableSun.setValue('off');
        if (reduceDemandDd && reduceDemandDd.setValue) reduceDemandDd.setValue('off'); // off => forceFullPass true
      } catch (_) {}
      try { emitAdvanced(); } catch (_) {}
    };

    advToolbar.appendChild(document.createElement('div'));
    advToolbar.appendChild(document.createElement('div'));
    advToolbar.appendChild(advResetBtn);
    adv.appendChild(advToolbar);

    // Emit once so renderer aligns on open
    emitAdvanced();
  } catch (_) {}

}