import * as LS from '../core/localStorage.js';
import { createTabsBar, createLeftIconInput, wireFocusHighlight, UI, createInputRow, createDropdown } from '../core/ui/controls.js';
import { getUser, ensureProfileForCurrentUser } from '../core/auth/supabaseAuth.js';
import { getQuip } from '../core/ui/quip.js';
import { renderAccountTab, computeAccountEnabled, setSettingsAuth } from './settings/tabs/accountTab.js';
import { renderProfileTab } from './settings/tabs/profileTab.js';
import { renderDisplayTab } from './settings/tabs/displayTab.js';
import { renderSoundTab } from './settings/tabs/soundTab.js';
import { renderControlTab } from './settings/tabs/controlTab.js';

// Self-contained Settings Panel (always-available)
// Lives outside OverlayManager and routes. JS-only, no external CSS.
// Tabs: Account, Profile, Display, Sound, Controls.
// Account tab is disabled until authenticated.

let __settingsState = {
  activeTab: 'Profile',
  accountEnabled: false,
};

// Shared helpers across panel and overlay
function attachHover(rng, labelEl) {
  const on = () => {
    try { labelEl.style.color = 'var(--ui-bright, #dff1ff)'; } catch (_) {}
    try { rng.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))'; } catch (_) {}
    try { rng.style.outline = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))'; } catch (_) {}
  };
  const off = () => {
    try { labelEl.style.color = ''; } catch (_) {}
    try { rng.style.boxShadow = 'none'; } catch (_) {}
    try { rng.style.outline = 'none'; } catch (_) {}
  };
  try {
    rng.addEventListener('mouseenter', on);
    rng.addEventListener('mouseleave', off);
    rng.addEventListener('focus', on);
    rng.addEventListener('blur', off);
  } catch (_) {}
}

function attachWheel(rng) {
  try {
    rng.addEventListener('wheel', (e) => {
      // Ignore if user holds modifier keys (allow browser gestures)
      if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
      if (e && e.cancelable !== false) e.preventDefault();
      let step = parseFloat(rng.step);
      if (!Number.isFinite(step)) step = 1;
      let min = parseFloat(rng.min); if (!Number.isFinite(min)) min = 0;
      let max = parseFloat(rng.max); if (!Number.isFinite(max)) max = 100;
      let val = parseFloat(rng.value); if (!Number.isFinite(val)) val = min;
      // Wheel up -> increase, wheel down -> decrease
      val += (e.deltaY < 0 ? step : -step);
      // Clamp and snap to step precision
      val = Math.min(max, Math.max(min, val));
      const decs = (String(step).split('.')[1] || '').length;
      if (decs) val = parseFloat(val.toFixed(decs));
      rng.value = String(val);
      try { rng.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) { try { rng.oninput && rng.oninput(); } catch (_) {} }
    }, { passive: false });
  } catch (_) {}
}

export function presentSettingsPanel() {
  // Prefer overlay modal when available for dark backdrop + centering
  try { if (presentSettingsOverlay && presentSettingsOverlay()) return; } catch (_) {}
  let panel = document.getElementById('settings-panel');
  if (!panel) panel = createSettingsPanel();
  // Ensure tagline exists even for panels created before tagline feature
  try {
    if (!panel.querySelector('#settings-panel-tagline')) {
      const settingsTaglines = [
        'Tune the dials. Tame the darkness.',
        'Make the abyss more habitable.',
        'Adjust reality to your liking.',
        'Personalization: because every doom is unique.',
        'Polish your experience. Leave the grime.',
        'Twist the knobs; not your fate.',
        'Balance chaos with preferences.',
        'Sharper fangs, softer UI.',
        'Your look, your feel, your death',
        'Dye your death, attenuate your scream.',
        "You just have to touch everything don't you.",
        'Set the stage for heroics.',
        "Change your settings all you want. It won't help.",
        'Paint your pixels, we paint your doom',
        'Buttons for the brave.',
        'Your dungeon, your rules.',
        'Fine‑tune the fear factor.',
        'Dial-in the doom.',
        'Refine the ritual.',
        'Customize the chaos.'
      ];
      const t = document.createElement('div');
      t.id = 'settings-panel-tagline';
      t.textContent = getQuip('settings.panel.header', settingsTaglines);
      t.style.fontSize = '13px';
      t.style.opacity = '0.9';
      t.style.margin = '0 0 1rem 0';
      t.style.color = 'var(--ui-fg, #eee)';
      t.style.userSelect = 'none';
      const tabsEl = panel.querySelector('#settings-tabs');
      if (tabsEl) panel.insertBefore(t, tabsEl); else panel.appendChild(t);
    }
  } catch (_) {}
  // Update auth-gated state each open
  __settingsState.accountEnabled = computeAccountEnabled();
  renderSettingsContent(panel);
  panel.style.display = '';
  try { panel.focus(); } catch (_) {}
}

export function closeSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  if (panel) panel.style.display = 'none';
}

function createSettingsPanel() {
  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.tabIndex = -1;
  panel.style.position = 'fixed';
  panel.style.top = '60px'; // below hover status bar
  panel.style.right = '12px';
  panel.style.zIndex = '40000'; // above overlays and controls
  // Blue glassmorphism surface
  panel.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
  panel.style.color = 'var(--ui-fg, #eee)';
  panel.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  panel.style.borderRadius = '8px';
  panel.style.padding = '10px';
  panel.style.width = '420px';
  panel.style.maxHeight = '72vh';
  panel.style.overflow = 'hidden';
  panel.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18)), var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33))';
  panel.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
  panel.style.pointerEvents = 'auto';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '8px';

  const title = document.createElement('div');
  title.textContent = 'Settings';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '18px';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  closeBtn.style.borderRadius = '4px';
  closeBtn.style.color = 'var(--ui-fg, #eee)';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => closeSettingsPanel();

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Settings-specific tagline under header (stable per panel instance)
  try {
    const settingsTaglines = [
      'Tune the dials. Tame the darkness.',
      'Make the abyss more habitable.',
      'Adjust reality to your liking.',
      'Personalization: because every doom is unique.',
      'Polish your experience. Leave the grime.',
      'Twist the knobs; not your fate.',
      'Balance chaos with preferences.',
      'Sharper fangs, softer UI.',
      'Your look, your feel, your death',
      'Dye your death, attenuate your scream.',
      "You just have to touch everything don't you.",
      'Set the stage for heroics.',
      "Change your settings all you want. It won't help.",
      'Paint your pixels, we paint your doom',
      'Buttons for the brave.',
      'Your dungeon, your rules.',
      'Fine‑tune the fear factor.',
      'Dial-in the doom.',
      'Refine the ritual.',
      'Customize the chaos.'
    ];
    const tagline = document.createElement('div');
    tagline.textContent = getQuip('settings.panel.header', settingsTaglines);
    tagline.style.fontSize = '13px';
    tagline.style.opacity = '0.9';
    tagline.style.margin = '0 0 1rem 0';
    tagline.style.color = 'var(--ui-fg, #eee)';
    tagline.style.userSelect = 'none';
    panel.appendChild(tagline);
  } catch (_) {}

  // Tabs header
  const tabs = document.createElement('div');
  tabs.id = 'settings-tabs';
  tabs.style.display = 'flex';
  tabs.style.gap = '6px';
  tabs.style.borderBottom = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  tabs.style.paddingBottom = '6px';
  panel.appendChild(tabs);

  // Content container (scrollable)
  const content = document.createElement('div');
  content.id = 'settings-content';
  content.style.marginTop = '8px';
  content.style.overflow = 'auto';
  content.style.maxHeight = '58vh';
  content.style.paddingRight = '6px';
  try { content.classList.add('ui-glass-scrollbar'); } catch (_) {}
  // Visible border around tab content in fallback panel
  try {
    content.style.border = UI.border;
    // Sharp top-left corner only
    content.style.borderRadius = '0 6px 6px 6px';
    content.style.padding = '10px';
    content.style.background = 'linear-gradient(180deg, rgba(10,18,26, calc(0.20 * var(--ui-opacity-mult, 1))) 0%, rgba(10,16,22, calc(0.16 * var(--ui-opacity-mult, 1))) 100%)';
  } catch (_) {}
  panel.appendChild(content);

  document.body.appendChild(panel);

  // Escape key to close
  window.addEventListener('keydown', onKeyDown, { capture: true });

  // Listen for auth updates (optional external trigger)
  window.addEventListener('ui:auth', (e) => {
    try {
      const v = !!(e && e.detail && e.detail.accountEnabled);
      setSettingsAuth({ accountEnabled: v }); // updates global hint
      __settingsState.accountEnabled = computeAccountEnabled();
      const panel = document.getElementById('settings-panel');
      if (panel && panel.style.display !== 'none') renderSettingsContent(panel);
    } catch (_) {}
  });

  // External sync now handled by bindRange from '../core/volumes.js'

  return panel;
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    const panel = document.getElementById('settings-panel');
    if (panel && panel.style.display !== 'none') closeSettingsPanel();
  }
}

function renderSettingsContent(panel) {
  const tabs = panel.querySelector('#settings-tabs');
  const content = panel.querySelector('#settings-content');
  if (!tabs || !content) return;
  __settingsState.accountEnabled = computeAccountEnabled();
  // Tabs remain selectable even when not authenticated; body will show a login-required message.

  // Build tabs
  tabs.innerHTML = '';
  const tabNames = ['Account', 'Profile', 'Display', 'Sound', 'Controls'];
  tabNames.forEach((name) => {
    const btn = document.createElement('button');
    btn.textContent = name;
    // Glass tabs
    btn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    btn.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
    btn.style.boxShadow = (__settingsState.activeTab === name)
      ? 'var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18)), var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33))'
      : 'var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33))';
    btn.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
    btn.style.color = 'var(--ui-fg, #eee)';
    btn.style.padding = '4px 8px';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.onclick = () => { if (!btn.disabled) { __settingsState.activeTab = name; renderSettingsContent(panel); } };
    tabs.appendChild(btn);
  });

  // Build content for active tab
  content.innerHTML = '';
  const tab = __settingsState.activeTab;
  if (tab === 'Account') {
    renderAccountTab({
      container: content,
      makeSection,
      makeNote,
      headerTitle: 'Account',
      headerDesc: 'Manage your account, authentication and linked providers.',
      loggedIn: !!__settingsState.accountEnabled,
      loginMsg: 'Please login to a game server first to change your account settings.',
      loggedInMsg: 'You are logged in.'
    });
  } else if (tab === 'Profile') {
    renderProfileTab({
      container: content,
      makeSection,
      makeNote,
      makeRow,
      makeInput,
      LS,
      headerTitle: 'Profile',
      headerDesc: '',
      loggedIn: !!__settingsState.accountEnabled,
      variant: 'panel',
      panelLoginMsg: 'Please login to a game server first to change your profile settings.'
    });
  } else if (tab === 'Theme') {
    // Theme tab (Panel): rename header to "Overall Color" with a fun random tagline
    const colorQuipsPanel = [
      "They say color defines your personality. What's yours?",
      'Death knows no color, but we do.',
      'Paint the town red. Or any other color you want.',
      'Hue today, gone tomorrow.',
      'Saturate your soul.',
      'Pick a vibe, survive the dungeon.',
      'Red increases your damage rolls. Source? Trust me bro.',
      'Those color knobs took forever to code. Use them wisely.',
      'If your colors suck, I might change them back.',
      "Reminder: colors can’t fix a lack of skill.",
      "Pick a color. Regret is free.",
    ];
    const sec = makeSection(getQuip('settings.panel.themeTag', colorQuipsPanel), '');
    // Insert Reset button into the Theme section header (right side)
    try {
      const hdr = sec.firstChild; // title div
      if (hdr) {
        hdr.style.display = 'flex';
        hdr.style.alignItems = 'center';
        hdr.style.justifyContent = 'space-between';
        // Create a left container in the header to hold the Theme dropdown (to the left of Reset)
        const leftBox = document.createElement('div');
        leftBox.id = 'theme-hdr-left-panel';
        leftBox.style.display = 'flex';
        leftBox.style.alignItems = 'center';
        leftBox.style.gap = '8px';
        hdr.appendChild(leftBox);
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset';
        resetBtn.style.background = 'transparent';
        resetBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
        resetBtn.style.borderRadius = '10px';
        resetBtn.style.color = 'var(--ui-fg, #eee)';
        resetBtn.style.padding = '4px 10px';
        resetBtn.style.cursor = 'pointer';
        // Hover/focus glow
        const onHover = () => { try { resetBtn.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))'; resetBtn.style.outline = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))'; } catch (_) {} };
        const onLeave = () => { try { resetBtn.style.boxShadow = 'none'; resetBtn.style.outline = 'none'; } catch (_) {} };
        resetBtn.addEventListener('mouseenter', onHover);
        resetBtn.addEventListener('mouseleave', onLeave);
        resetBtn.addEventListener('focus', onHover);
        resetBtn.addEventListener('blur', onLeave);
        resetBtn.onclick = () => {
          const OPDBG = true; const MMAX = 2.5; const defMult = ((100 - 15) / 100) * MMAX; // reversed semantics: 15% clear
          // Reset theme selection to preset
          try { LS.setItem('theme', 'steelBlue'); } catch (_) {}
          // Apply preset directly (ignores LS overrides for H/S/B and related knobs)
          try { window.UITheme && window.UITheme.applyTheme('Steel Blue'); } catch (_) {}
          // Reset opacity via dynamic param (presets don't carry opacity multiplier)
          try { window.UITheme && window.UITheme.applyDynamicTheme({ opacityMult: defMult, fontScale: 1 }); } catch (_) {}
          try { fsRng.value = '100'; fsVal.textContent = '100%'; fsRng.title = '100%'; } catch (_) {}
          try { localStorage.setItem('ui_font_scale', '1'); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('ui:hue-changed')); } catch (_) {}
          // Reset gradient and milkiness (Steel Blue preset: gradient=20, blur=3)
          try { grRng.value = '20'; grVal.textContent = '20%'; grRng.title = '20%'; } catch (_) {}
          try { mkRng.value = '3'; mkVal.textContent = '3.0px'; mkRng.title = '3.0px'; } catch (_) {}
          // Reset new sliders
          // Steel Blue preset: overlayDarkness=60, border=80, glow=18
          try { odRng.value = '60'; odVal.textContent = '60%'; odRng.title = '60%'; } catch (_) {}
          try { biRng.value = '80'; biVal.textContent = '80%'; biRng.title = '80%'; } catch (_) {}
          try { gsRng.value = '18'; /* value display updated below */ gsRng.title = '18%'; try { const px = Math.round((18 / 100) * 44); gsVal.textContent = `${px}px`; } catch (_) {} } catch (_) {}
          // Reset opacity
          const p = 15; // transparency percent
          try { opRng.value = String(p); opVal.textContent = `${p}%`; opRng.title = `${p}%`; } catch (_) {}
          if (OPDBG) {
            try {
              const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
              console.debug(`[opacity] display-tab-reset(panel,rev) css=${css}`);
            } catch (_) {}
          }
        };
        hdr.appendChild(resetBtn);
      }
    } catch (_) {}
    content.appendChild(sec);
    // Theme selector moved into header leftBox (left of Reset)
    const themeRow = document.createElement('div');
    themeRow.style.display = 'flex'; themeRow.style.alignItems = 'center'; themeRow.style.gap = '8px'; themeRow.style.marginBottom = '8px';
    const lbl = document.createElement('label'); lbl.textContent = 'Theme:';
    const currentTheme = document.createElement('span');
    currentTheme.textContent = 'Steel Blue';
    currentTheme.style.opacity = '0.85';
    currentTheme.style.fontSize = '12px';
    // Persist a friendly name for reference (no switching)
    try { const saved = LS.getItem('theme', null); if (!saved) LS.setItem('theme', 'steelBlue'); } catch (_) {}
    themeRow.appendChild(lbl); themeRow.appendChild(currentTheme);
    try { const left = sec.querySelector('#theme-hdr-left-panel'); if (left) left.appendChild(themeRow); else content.appendChild(themeRow); } catch (_) { try { content.appendChild(themeRow); } catch (_) {} }

    // Font Size moved to Display tab
    // Hue/Saturation sliders removed; replaced by knobs in Theme tab.

    // Gradient strength slider (0-100)
    const grRow = document.createElement('div');
    grRow.style.display = 'flex'; grRow.style.alignItems = 'center'; grRow.style.gap = '8px'; grRow.style.marginBottom = '8px';
    const grLbl = document.createElement('label'); grLbl.textContent = 'Gradient:'; grLbl.style.minWidth = '140px'; grLbl.style.textAlign = 'left'; // Added text-align: left
    const grRng = document.createElement('input'); grRng.type = 'range'; grRng.min = '0'; grRng.max = '100'; grRng.step = '1'; grRng.style.flex = '1'; grRng.id = 'settings-ui-gradient';
    const grVal = document.createElement('span'); grVal.style.width = '46px'; grVal.style.textAlign = 'right'; grVal.style.color = '#ccc'; grVal.style.paddingRight = '6px'; grVal.id = 'settings-ui-gradient-val';
    try {
      let g = parseFloat(localStorage.getItem('ui_gradient'));
      if (!Number.isFinite(g)) g = 60;
      const p = Math.max(0, Math.min(100, Math.round(g)));
      grRng.value = String(p);
      grVal.textContent = `${p}%`; grRng.title = `${p}%`;
    } catch (_) {}
    grRng.oninput = () => {
      const p = Math.max(0, Math.min(100, Math.round(parseFloat(grRng.value) || 0)));
      if (String(p) !== grRng.value) grRng.value = String(p);
      grVal.textContent = `${p}%`; grRng.title = `${p}%`;
      try { console.debug(`[display] gradient(panel) p=${p}`); } catch (_) {}
      try { window.UITheme && window.UITheme.applyDynamicTheme({ gradient: p }); } catch (_) {}
      try { localStorage.setItem('ui_gradient', String(p)); } catch (_) {}
    };
    attachWheel(grRng); attachHover(grRng, grLbl);
    grRow.appendChild(grLbl); grRow.appendChild(grRng); grRow.appendChild(grVal);
    // Note: appended after Transparency for new ordering

    // Blur slider (backdrop blur 0-10px)
    const mkRow = document.createElement('div');
    mkRow.style.display = 'flex'; mkRow.style.alignItems = 'center'; mkRow.style.gap = '8px'; mkRow.style.marginBottom = '8px';
    const mkLbl = document.createElement('label'); mkLbl.textContent = 'Overlay Blur:'; mkLbl.style.minWidth = '140px'; mkLbl.title = 'Background blur behind panels/overlays'; mkLbl.style.textAlign = 'left'; // Added text-align: left
    const mkRng = document.createElement('input'); mkRng.type = 'range'; mkRng.min = '0'; mkRng.max = '10'; mkRng.step = '0.1'; mkRng.style.flex = '1'; mkRng.id = 'settings-ui-milkiness';
    const mkVal = document.createElement('span'); mkVal.style.width = '46px'; mkVal.style.textAlign = 'right'; mkVal.style.color = '#ccc'; mkVal.style.paddingRight = '6px'; mkVal.id = 'settings-ui-milkiness-val';
    try {
      let m = parseFloat(localStorage.getItem('ui_milkiness'));
      if (!Number.isFinite(m)) m = 3;
      let v = Math.max(0, Math.min(10, m));
      mkRng.value = String(v);
      mkVal.textContent = `${v.toFixed(1)}px`; mkRng.title = `${v.toFixed(1)}px`;
    } catch (_) {}
    mkRng.oninput = () => {
      let v = parseFloat(mkRng.value);
      if (!Number.isFinite(v)) v = 3;
      v = Math.max(0, Math.min(10, v));
      mkRng.value = String(v);
      mkVal.textContent = `${v.toFixed(1)}px`; mkRng.title = `${v.toFixed(1)}px`;
      try { console.debug(`[display] milkiness(panel) v=${v}`); } catch (_) {}
      try { window.UITheme && window.UITheme.applyDynamicTheme({ milkiness: v }); } catch (_) {}
      try { localStorage.setItem('ui_milkiness', String(v)); } catch (_) {}
    };
    attachWheel(mkRng); attachHover(mkRng, mkLbl);
    mkRow.appendChild(mkLbl); mkRow.appendChild(mkRng); mkRow.appendChild(mkVal);
    // Note: appended after Transparency for new ordering

    // Transparency slider (reversed: 100% = clear, 0% = opaque)
    const opRow = document.createElement('div');
    opRow.style.display = 'flex'; opRow.style.alignItems = 'center'; opRow.style.gap = '8px'; opRow.style.marginBottom = '8px';
    const opLbl = document.createElement('label'); opLbl.textContent = 'Transparency:'; opLbl.style.minWidth = '140px'; opLbl.title = 'Higher = clearer panels; lower = more solid'; opLbl.style.textAlign = 'left'; // Added text-align: left
    const opRng = document.createElement('input'); opRng.type = 'range'; opRng.min = '0'; opRng.max = '100'; opRng.step = '1'; opRng.style.flex = '1'; opRng.id = 'settings-ui-opacity';
    const opVal = document.createElement('span'); opVal.style.width = '46px'; opVal.style.textAlign = 'right'; opVal.style.color = '#ccc'; opVal.style.paddingRight = '6px'; opVal.id = 'settings-ui-opacity-val';
    // Initialize from storage, default 85% transparency. Read both namespaced and raw keys for compatibility
    try {
      const OPDBG = true; const MMAX = 2.5; // ceiling for opacity multiplier
      let raw = null; try { raw = localStorage.getItem('ui_opacity_mult'); } catch (_) {}
      let ns = null; try { ns = LS.getItem('ui_opacity_mult', null); } catch (_) {}
      let mult = null; let p = 85; // default transparency percent
      if (raw != null || ns != null) {
        mult = parseFloat(ns != null ? ns : raw);
        if (!Number.isFinite(mult) || mult < 0) mult = 0.375; // fallback to previous default if corrupted
        // Detect legacy semantics (old stored mult was proportional to opacity, not transparency)
        if (mult > 1.25) {
          const pOld = Math.max(0, Math.min(100, Math.round((mult / MMAX) * 100)));
          p = Math.max(0, Math.min(100, 100 - pOld));
        } else {
          // New semantics: mult = (100 - p)/100 * MMAX
          p = Math.max(0, Math.min(100, Math.round(100 - (mult / MMAX) * 100)));
        }
      }
      // Apply and persist remapped multiplier
      const multClamped = ((100 - p) / 100) * MMAX;
      opRng.value = String(p);
      const pct = String(p) + '%'; opVal.textContent = pct; opRng.title = pct;
      document.documentElement.style.setProperty('--ui-opacity-mult', String(multClamped));
      try { LS.setItem('ui_opacity_mult', String(multClamped)); } catch (_) {}
      try { localStorage.setItem('ui_opacity_mult', String(multClamped)); } catch (_) {}
      if (OPDBG) { try {
        const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
        console.debug(`[opacity] display-tab-init(panel,rev) css=${css} p=${p} multClamped=${multClamped} rawLS=${raw}`);
      } catch (_) {} }
    } catch (_) {}
    opRng.oninput = () => {
      const OPDBG = true; const MMAX = 2.5;
      const p = Math.max(0, Math.min(100, Math.round(parseFloat(opRng.value) || 0)));
      if (String(p) !== opRng.value) opRng.value = String(p);
      const mult = ((100 - p) / 100) * MMAX;
      const pct = String(p) + '%';
      opVal.textContent = pct; opRng.title = pct;
      try { window.UITheme && window.UITheme.applyDynamicTheme({ opacityMult: mult }); } catch (_) {}
      // Persist to namespaced LS as well, since init prefers LS over raw localStorage for this key
      try { LS.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
      // Gradient tooltip visible only when panels aren’t fully clear
      try { if (p < 100) { grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; } else { grLbl.title = ''; grLbl.style.opacity = '0.8'; } } catch (_) {}
      if (OPDBG) {
        try {
          const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
          console.debug(`[opacity] slider(panel,rev) css=${css} p=${p} mult=${mult}`);
        } catch (_) {}
      }
    };
    attachWheel(opRng); attachHover(opRng, opLbl);
    opRow.appendChild(opLbl); opRow.appendChild(opRng); opRow.appendChild(opVal);
    content.appendChild(opRow);

    // Place Gradient and Blur after Transparency now
    try { const pInit = Math.max(0, Math.min(100, Math.round(parseFloat(opRng.value) || 0))); if (pInit < 100) { grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; } else { grLbl.title = ''; grLbl.style.opacity = '0.8'; } } catch (_) {}
    content.appendChild(grRow);

    // New: Overlay Darkness (0-100)
    const odRow = document.createElement('div'); odRow.style.display = 'flex'; odRow.style.alignItems = 'center'; odRow.style.gap = '8px'; odRow.style.marginBottom = '8px';
    const odLbl = document.createElement('label'); odLbl.textContent = 'Overlay Darkness:'; odLbl.style.minWidth = '140px'; odLbl.title = 'Dimming behind dialogs/menus';
    const odRng = document.createElement('input'); odRng.type = 'range'; odRng.min = '0'; odRng.max = '100'; odRng.step = '1'; odRng.style.flex = '1'; odRng.id = 'settings-ui-overlay-darkness';
    const odVal = document.createElement('span'); odVal.style.width = '46px'; odVal.style.textAlign = 'right'; odVal.style.color = '#ccc'; odVal.style.paddingRight = '6px'; odVal.id = 'settings-ui-overlay-darkness-val';
    try { let v = parseFloat(localStorage.getItem('ui_overlay_darkness')); if (!Number.isFinite(v)) v = 50; const p = Math.max(0, Math.min(100, Math.round(v))); odRng.value = String(p); odVal.textContent = `${p}%`; odRng.title = `${p}%`; } catch (_) {}
    odRng.oninput = () => { const p = Math.max(0, Math.min(100, Math.round(parseFloat(odRng.value) || 0))); if (String(p) !== odRng.value) odRng.value = String(p); odVal.textContent = `${p}%`; odRng.title = `${p}%`; try { window.UITheme && window.UITheme.applyDynamicTheme({ overlayDarkness: p }); } catch (_) {} try { localStorage.setItem('ui_overlay_darkness', String(p)); } catch (_) {} };
    odRow.appendChild(odLbl); odRow.appendChild(odRng); odRow.appendChild(odVal); content.appendChild(odRow);
    // Place Overlay Blur after Overlay Darkness
    content.appendChild(mkRow);

    // New: Border Intensity (0-100)
    const biRow = document.createElement('div'); biRow.style.display = 'flex'; biRow.style.alignItems = 'center'; biRow.style.gap = '8px'; biRow.style.marginBottom = '8px';
    const biLbl = document.createElement('label'); biLbl.textContent = 'Border Intensity:'; biLbl.style.minWidth = '140px'; biLbl.title = 'Strength of panel borders';
    const biRng = document.createElement('input'); biRng.type = 'range'; biRng.min = '0'; biRng.max = '100'; biRng.step = '1'; biRng.style.flex = '1'; biRng.id = 'settings-ui-border-intensity';
    const biVal = document.createElement('span'); biVal.style.width = '46px'; biVal.style.textAlign = 'right'; biVal.style.color = '#ccc'; biVal.style.paddingRight = '6px'; biVal.id = 'settings-ui-border-intensity-val';
    try { let v = parseFloat(localStorage.getItem('ui_border_intensity')); if (!Number.isFinite(v)) v = 70; const p = Math.max(0, Math.min(100, Math.round(v))); biRng.value = String(p); biVal.textContent = `${p}%`; biRng.title = `${p}%`; } catch (_) {}
    biRng.oninput = () => { const p = Math.max(0, Math.min(100, Math.round(parseFloat(biRng.value) || 0))); if (String(p) !== biRng.value) biRng.value = String(p); biVal.textContent = `${p}%`; biRng.title = `${p}%`; try { window.UITheme && window.UITheme.applyDynamicTheme({ borderStrength: p }); } catch (_) {} try { localStorage.setItem('ui_border_intensity', String(p)); } catch (_) {} };
    biRow.appendChild(biLbl); biRow.appendChild(biRng); biRow.appendChild(biVal); content.appendChild(biRow);

    // New: Glow Strength (0-100)
    const gsRow = document.createElement('div'); gsRow.style.display = 'flex'; gsRow.style.alignItems = 'center'; gsRow.style.gap = '8px'; gsRow.style.marginBottom = '8px';
    const gsLbl = document.createElement('label'); gsLbl.textContent = 'Glow Strength:'; gsLbl.style.minWidth = '140px'; gsLbl.title = 'Strength of panel glow and highlights';
    const gsRng = document.createElement('input'); gsRng.type = 'range'; gsRng.min = '0'; gsRng.max = '100'; gsRng.step = '1'; gsRng.style.flex = '1'; gsRng.id = 'settings-ui-glow-strength';
    const gsVal = document.createElement('span'); gsVal.style.width = '46px'; gsVal.style.textAlign = 'right'; gsVal.style.color = '#ccc'; gsVal.style.paddingRight = '6px'; gsVal.id = 'settings-ui-glow-strength-val';
    try { let v = parseFloat(localStorage.getItem('ui_glow_strength')); if (!Number.isFinite(v)) v = 60; const p = Math.max(0, Math.min(100, Math.round(v))); gsRng.value = String(p); try { const px = Math.round((p / 100) * 44); gsVal.textContent = `${px}px`; } catch (_) { gsVal.textContent = `${p}%`; } gsRng.title = `${p}%`; } catch (_) {}
    gsRng.oninput = () => { const p = Math.max(0, Math.min(100, Math.round(parseFloat(gsRng.value) || 0))); if (String(p) !== gsRng.value) gsRng.value = String(p); try { const px = Math.round((p / 100) * 44); gsVal.textContent = `${px}px`; } catch (_) { gsVal.textContent = `${p}%`; } gsRng.title = `${p}%`; try { window.UITheme && window.UITheme.applyDynamicTheme({ glowStrength: p }); } catch (_) {} try { localStorage.setItem('ui_glow_strength', String(p)); } catch (_) {} };
    gsRow.appendChild(gsLbl); gsRow.appendChild(gsRng); gsRow.appendChild(gsVal); content.appendChild(gsRow);

  } else if (tab === 'Display') {
    renderDisplayTab({
      container: content,
      makeSection,
      headerTitle: 'Display',
      headerDesc: 'Legibility and scale.',
      variant: 'panel'
    });
  } else if (tab === 'Sound') {
    renderSoundTab({
      container: content,
      makeSection,
      makeNote,
      variant: 'panel'
    });
  } else if (tab === 'Controls') {
    renderControlTab({
      container: content,
      makeSection,
      makeNote,
      variant: 'panel'
    });
  }
}

function makeSection(title, desc) {
  const wrap = document.createElement('div');
  const t = document.createElement('div');
  t.textContent = title;
  // Standardize via CSS variables with sensible fallbacks
  t.style.fontSize = 'var(--settings-sec-title-size, calc(14px * var(--ui-font-scale, 1)))';
  t.style.fontWeight = 'var(--settings-sec-title-weight, 700)';
  t.style.lineHeight = 'var(--settings-sec-title-line, 1.25)';
  t.style.margin = 'var(--settings-sec-title-margin, 8px 0 4px 0)';
  wrap.appendChild(t);
  if (desc) {
    const d = document.createElement('div');
    d.textContent = desc;
    d.style.fontSize = 'var(--settings-sec-subtitle-size, calc(13px * var(--ui-font-scale, 1)))';
    d.style.lineHeight = 'var(--settings-sec-subtitle-line, 1.25)';
    d.style.color = 'var(--settings-sec-subtitle-color, var(--ui-bright, #dff1ff))';
    d.style.opacity = 'var(--settings-sec-subtitle-opacity, 0.9)';
    d.style.margin = 'var(--settings-sec-subtitle-margin, 0 0 10px 0)';
    wrap.appendChild(d);
  }
  return wrap;
}

function makeRow(labelText, controlEl) {
  const row = document.createElement('div');
  row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px'; row.style.marginBottom = '8px';
  const lbl = document.createElement('label'); lbl.textContent = labelText;
  row.appendChild(lbl); row.appendChild(controlEl);
  return row;
}

function makeInput(type, value) {
  const i = document.createElement('input'); i.type = type; if (value != null) i.value = value;
  i.style.flex = '1';
  i.onchange = () => { if (type === 'text') try { LS.setItem('name', i.value || ''); } catch (_) {} };
  return i;
}

function makeNote(text) {
  const d = document.createElement('div'); d.textContent = text; d.style.color = '#bbb'; d.style.fontSize = '12px'; d.style.marginBottom = '8px';
  return d;
}

// Overlay-based Settings Modal (preferred). Returns true if shown, false to fall back.
function presentSettingsOverlay() {
  try {
    if (!window.OverlayManager) return false;
    const id = 'SETTINGS_MODAL';
    const PRIORITY = (window.PRIORITY || { MEDIUM: 50 });
    try {
      window.OverlayManager.present({ id, text: '', actions: [], blockInput: true, priority: PRIORITY.MEDIUM, external: true });
    } catch (_) {}

    const overlay = document.getElementById('overlay');
    const content = overlay ? overlay.querySelector('#overlay-content') : null;
    if (!content) return false;
    // Do NOT clear shared overlay content; create our own mount layer instead
    // Remove any stale instance from a previous open
    try {
      const prev = content.querySelector('#settings-overlay-root');
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    } catch (_) {}
    const mount = document.createElement('div');
    mount.id = 'settings-overlay-root';
    // Fixed full-viewport layer so it overlays existing lobby/login siblings
    mount.style.position = 'fixed';
    mount.style.inset = '0';
    mount.style.zIndex = '20001';
    // Allow this layer to capture pointer events (modal blocks background)
    mount.style.pointerEvents = 'auto';
    try { content.appendChild(mount); } catch (_) {}
    // Local scrim to subtly dim background behind the settings card
    try {
      const scrim = document.createElement('div');
      scrim.style.position = 'absolute';
      scrim.style.inset = '0';
      // Use theme-driven overlay tint and blur so sliders affect this scrim
      // Darkness comes from --ui-overlay-darkness via --ui-overlay-bg (set in UITheme)
      scrim.style.background = 'var(--ui-overlay-bg, rgba(0,0,0,0.50))';
      // Blur comes from --ui-backdrop-blur (e.g., 3px), updated by applyDynamicTheme({ milkiness })
      scrim.style.backdropFilter = 'blur(var(--ui-backdrop-blur, 3px))';
      scrim.style.webkitBackdropFilter = 'blur(var(--ui-backdrop-blur, 3px))';
      scrim.style.zIndex = '0';
      scrim.style.pointerEvents = 'auto';
      mount.appendChild(scrim);
    } catch (_) {}

    // Keep settings isolated: do NOT mutate the shared #overlay styles here.
    // OverlayManager already manages its own backdrop/shade using theme vars.
    // Our mount captures input via pointer-events: auto; no global overrides.
    const prevFocus = document.activeElement;

    // Centered container
    const center = document.createElement('div');
    center.style.position = 'relative';
    center.style.zIndex = '1';
    center.style.minHeight = '100vh';
    center.style.display = 'flex';
    center.style.alignItems = 'center';
    center.style.justifyContent = 'center';
    center.style.padding = '24px';
    center.style.transform = 'translateY(-2vh)';

    // Card
    const card = document.createElement('div');
    card.style.width = 'min(50vw, 820px, calc(100vw - 32px))';
    card.style.maxWidth = 'min(50vw, 820px, calc(100vw - 32px))';
    card.style.color = '#dff1ff';
    card.style.borderRadius = '14px';
    card.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,36,0.48)) 0%, var(--ui-surface-bg-bottom, rgba(8,14,28,0.44)) 100%)';
    card.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    card.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
    card.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
    card.style.padding = '16px';
    card.style.maxHeight = 'min(80vh, 820px)';
    card.style.height = 'min(80vh, 820px)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.minWidth = '0';
    try { card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); } catch (_) {}

    // Header row (title left, close right)
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '2px';
    const title = document.createElement('div');
    title.textContent = 'Settings';
    title.style.fontSize = '22px';
    title.style.fontWeight = '700';
    title.style.userSelect = 'none';
    try { title.id = 'settings-modal-title'; card.setAttribute('aria-labelledby', 'settings-modal-title'); } catch (_) {}
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = '1px solid var(--ui-surface-border)';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.color = '#dff1ff';
    closeBtn.style.cursor = 'pointer';
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Cache random quip for overlay header (hoisted before use)
    let _quipSettings = null;

    // Settings-specific taglines
    const settingsTaglines = [
      'Tune the dials. Tame the darkness.',
      'Make the abyss more habitable.',
      'Adjust reality to your liking.',
      'Personalization: because every doom is unique.',
      'Polish your experience. Leave the grime.',
      'Twist the knobs; not your fate.',
      'Balance chaos with preferences.',
      'Sharper fangs, softer UI.',
      'Your look, your feel, your death.',
      'Silence your screams, dye your death.',
      "You just have to touch everything don't you.",
      'Set the stage for heroics.',
      "Change your settings all you want. It won't help.",
      'Paint your pixels, we paint your doom.',
      'Buttons for the brave.',
      'Your dungeon, your rules.',
      'Fine‑tune the fear factor.',
      'Dial-in the doom.',
      'Refine the ritual.',
      'Customize the chaos.',
      "Even the programmer who made this doesn't know what half these things do.",
      "You can change your settings … but should you?",
      "Change your settings, cause you can't change your life."
    ];
    const tagline = document.createElement('div');
    try {
      _quipSettings = getQuip('settings.overlay.header', settingsTaglines);
      tagline.textContent = _quipSettings;
      tagline.style.fontSize = '13px';
      tagline.style.opacity = '0.9';
      tagline.style.margin = '0 0 1rem 0';
      tagline.style.color = 'var(--ui-fg, #eee)';
      tagline.style.userSelect = 'none';
    } catch (_) {}
    try { tagline.id = 'settings-modal-desc'; card.setAttribute('aria-describedby', 'settings-modal-desc'); } catch (_) {}

    // Tabs bar
    const tabsBar = createTabsBar({ onSelect: onSelectTab });
    // Rename Display -> Theme, and introduce a separate Display tab
    const allTabs = ['Account', 'Profile', 'Theme', 'Display', 'Sound', 'Controls'];

    // Bordered content area with scroll
    const contentWrap = document.createElement('div');
    try { contentWrap.classList.add('ui-glass-scrollbar'); } catch (_) {}
    contentWrap.style.overflow = 'auto';
    contentWrap.style.padding = '1.0rem';
    contentWrap.style.marginTop = '0px';
    contentWrap.style.minHeight = '240px';
    contentWrap.style.maxHeight = 'calc(min(80vh, 820px) - 120px)';
    try {
      contentWrap.style.border = UI.border;
      // Sharp top-left corner only
      contentWrap.style.borderRadius = '0 8px 8px 8px';
      contentWrap.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.20) 0%, rgba(10,16,22,0.16) 100%)';
    } catch (_) {}

    // Local UI state for this overlay instance
    let activeTab = __settingsState.activeTab || 'Profile';
    let dirty = false;
    let loggedIn = false;
    let nicknameVal = '';
    let bioVal = '';
    let volAdjustHandler = null;
    // Cache random quips so they don't change on re-render
    let _quipThemeColor = null;
    let _quipBorder = null;
    let _quipTransparency = null;
    let _quipSoundMixer = null;
    let _quipNotif = null;

    // Add mouse wheel support for range sliders in overlay
    function attachWheel(rng) {
      try {
        rng.addEventListener('wheel', (e) => {
          // Ignore if user holds modifier keys (allow browser gestures)
          if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
          if (e && e.cancelable !== false) e.preventDefault();
          let step = parseFloat(rng.step);
          if (!Number.isFinite(step)) step = 1;
          let min = parseFloat(rng.min); if (!Number.isFinite(min)) min = 0;
          let max = parseFloat(rng.max); if (!Number.isFinite(max)) max = 100;
          let val = parseFloat(rng.value); if (!Number.isFinite(val)) val = min;
          // Wheel up -> increase, wheel down -> decrease
          val += (e.deltaY < 0 ? step : -step);
          // Clamp and snap to step precision
          val = Math.min(max, Math.max(min, val));
          const decs = (String(step).split('.')[1] || '').length;
          if (decs) val = parseFloat(val.toFixed(decs));
          rng.value = String(val);
          try { rng.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) { try { rng.oninput && rng.oninput(); } catch (_) {} }
        }, { passive: false });
      } catch (_) {}
    }

    // Simple inline-styled confirm overlay within this card
    function presentInlineConfirm(message = 'Discard changes?') {
      return new Promise((resolve) => {
        try {
          const scrim = document.createElement('div');
          scrim.style.position = 'absolute';
          scrim.style.inset = '0';
          scrim.style.background = 'rgba(0,0,0,0.45)';
          scrim.style.backdropFilter = 'blur(1px)';
          scrim.style.display = 'flex';
          scrim.style.alignItems = 'center';
          scrim.style.justifyContent = 'center';
          scrim.style.zIndex = '10';

          const box = document.createElement('div');
          box.style.minWidth = '280px';
          box.style.maxWidth = '90%';
          box.style.background = 'linear-gradient(180deg, rgba(10,18,36,0.52) 0%, rgba(8,14,28,0.48) 100%)';
          box.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
          box.style.borderRadius = '10px';
          box.style.boxShadow = '0 0 20px rgba(120,170,255,0.33)';
          box.style.padding = '12px';
          box.style.color = '#eaf6ff';

          const msg = document.createElement('div');
          msg.textContent = String(message || 'Are you sure?');
          msg.style.marginBottom = '10px';
          msg.style.fontWeight = '600';
          box.appendChild(msg);

          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'flex-end';
          row.style.gap = '8px';

          const noBtn = document.createElement('button');
          noBtn.textContent = 'Cancel';
          const yesBtn = document.createElement('button');
          yesBtn.textContent = 'Discard';
          [noBtn, yesBtn].forEach(b => { b.style.cursor = 'pointer'; b.style.userSelect = 'none'; b.style.borderRadius = '10px'; b.style.padding = '6px 10px'; b.style.fontWeight = '600'; b.style.fontSize = '14px'; b.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.12) 0%, rgba(10,16,22,0.08) 100%)'; b.style.color = '#dff1ff'; b.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.60))'; b.style.boxShadow = 'inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18)'; });

          noBtn.onclick = () => { try { card.removeChild(scrim); } catch (_) {} resolve(false); };
          yesBtn.onclick = () => { try { card.removeChild(scrim); } catch (_) {} resolve(true); };

          row.appendChild(noBtn); row.appendChild(yesBtn);
          box.appendChild(row);
          scrim.appendChild(box);
          card.appendChild(scrim);
          try { yesBtn.focus(); } catch (_) {}
        } catch (_) { resolve(false); }
      });
    }

    function onSelectTab(name) {
      // Tabs switch immediately; settings auto-save, no discard prompts
      // If we are leaving the Sound tab, run its cleanup (remove listeners)
      try {
        if (activeTab === 'Sound' && name !== 'Sound' && volAdjustHandler) {
          if (typeof volAdjustHandler === 'function') volAdjustHandler();
          else window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
          volAdjustHandler = null;
        }
      } catch (_) {}
      activeTab = String(name || 'Profile');
      __settingsState.activeTab = activeTab;
      render();
    }

    function setDirty(v) { dirty = !!v; }

    function render() {
      // Tabs UI
      try { tabsBar.render({ tabs: allTabs, activeKey: activeTab }); } catch (_) {}
      // After rendering tabs, set up ARIA linkage and ids
      try {
        const btns = tabsBar.el.querySelectorAll('button[data-tab-key]');
        btns.forEach((b) => {
          const key = b.getAttribute('data-tab-key') || '';
          const safe = String(key).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
          if (!b.id) b.id = `settings-tab-${safe}`;
        });
        contentWrap.setAttribute('role', 'tabpanel');
        const activeBtn = tabsBar.el.querySelector(`button[data-tab-key="${activeTab}"]`);
        if (activeBtn && activeBtn.id) contentWrap.setAttribute('aria-labelledby', activeBtn.id);
      } catch (_) {}

      // Body
      contentWrap.innerHTML = '';
      const tab = activeTab;
      if (tab === 'Account') {
        renderAccountTab({
          container: contentWrap,
          makeSection,
          makeNote,
          headerTitle: 'Account',
          headerDesc: 'Manage your account, authentication and linked providers.',
          loggedIn: !!loggedIn,
          loginMsg: 'Login required. Sign in to manage your account.',
          loggedInMsg: 'You are logged in.'
        });
      } else if (tab === 'Profile') {
        renderProfileTab({
          container: contentWrap,
          makeSection,
          makeNote,
          createInputRow,
          wireFocusHighlight,
          UI,
          LS,
          headerTitle: 'Profile',
          headerDesc: '',
          loggedIn: !!loggedIn,
          variant: 'overlay',
          getNickname: () => nicknameVal,
          setNickname: (v) => { nicknameVal = String(v || ''); },
          getBio: () => bioVal,
          setBio: (v) => { bioVal = String(v || ''); },
          setDirty: (v) => setDirty(!!v),
          reRender: () => render()
        });
      } else if (tab === 'Theme') {
        // Theme tab (Overlay): rename header to "Overall Color" with a fun random tagline
        const colorQuips = [
          "They say color defines your personality. What's yours?",
          'Death knows no color, but we do.',
          'Paint the town red. Or any other color you want.',
          'Hue today, gone tomorrow.',
          'Saturate your soul.',
          'Pick a vibe, survive the dungeon.',
          'Red increases your damage rolls. Source? Trust me bro.',
          'Those color knobs took forever to code. Use them wisely.',
          'If your colors suck, I might change them back.',
          "Reminder: colors can’t fix a lack of skill.",
          "Pick a color. Regret is free.",
        ];
        if (_quipThemeColor == null) { _quipThemeColor = getQuip('settings.overlay.themeTag', colorQuips); }
        const sec = makeSection('UI Color', _quipThemeColor);
        // Insert Reset button into the Theme section header (overlay)
        try {
          const hdr = sec.firstChild; // title div
          if (hdr) {
            hdr.style.display = 'flex';
            hdr.style.alignItems = 'center';
            hdr.style.justifyContent = 'flex-start';
          }
        } catch (_) {}
        // Theme selector row (above the color tagline), with Reset on the same line
        const themeTopRow = document.createElement('div');
        themeTopRow.style.display = 'flex';
        themeTopRow.style.alignItems = 'center';
        themeTopRow.style.justifyContent = 'space-between';
        themeTopRow.style.gap = '8px';
        themeTopRow.style.marginBottom = '8px';

        // Theme presets are now centralized in themeManager.js. Retrieve via UITheme.
        const themePresets = (() => {
          try {
            const tm = (window && window.UITheme) ? window.UITheme : null;
            if (tm) {
              if (typeof tm.getPresets === 'function') return tm.getPresets();
              if (tm.presets) return tm.presets;
            }
          } catch (_) {}
          // Minimal fallback if UITheme isn't ready
          return { 'Steel Blue': { hue: 207, intensity: 60, border: 80, glow: 18, transparency: 15, gradient: 20, overlayDarkness: 60, blur: 3 } };
        })();

        const themeGroup = document.createElement('div');
        themeGroup.style.display = 'flex';
        themeGroup.style.alignItems = 'center';
        themeGroup.style.gap = '8px';
        const lbl = document.createElement('label'); lbl.textContent = 'Theme Preset:'; lbl.style.fontSize = 'calc(16px * var(--ui-font-scale, 1))'; lbl.style.fontWeight = '600';
        let dd = null;
        try {
          let savedPreset = LS.getItem('ui_preset', null);
          if (savedPreset === 'Emerald') { savedPreset = 'Verdant Veil'; try { LS.setItem('ui_preset', savedPreset); } catch (_) {} }
          const names = Object.keys(themePresets);
          const items = [{ label: 'Custom', value: 'Custom' }].concat(names.map(n => ({ label: n, value: n })));
          if (!savedPreset || (!themePresets[savedPreset] && savedPreset !== 'Custom')) savedPreset = 'Steel Blue';
          dd = createDropdown({ items, value: savedPreset, width: '240px', onChange: (val) => {
            try { LS.setItem('ui_preset', val); } catch (_) {}
            if (val !== 'Custom') { try { if (typeof applyPreset === 'function') applyPreset(val); } catch (_) {} }
          }});
        } catch (_) {
          dd = createDropdown({ items: [{ label: 'Custom', value: 'Custom' }], value: 'Custom', width: '240px' });
        }
        themeGroup.appendChild(lbl); if (dd) themeGroup.appendChild(dd.el);

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
        resetBtn.addEventListener('mouseenter', onHover);
        resetBtn.addEventListener('mouseleave', onLeave);
        resetBtn.addEventListener('focus', onHover);
        resetBtn.addEventListener('blur', onLeave);
        resetBtn.onclick = () => {
          // Reset to base Steel Blue preset (85% Transparency)
          try { dd && dd.setValue('Steel Blue', true); } catch (_) {}
        };

        themeTopRow.appendChild(themeGroup);
        themeTopRow.appendChild(resetBtn);
        contentWrap.appendChild(themeTopRow);

        // Spacer before the color tagline
        { const spacer = document.createElement('div'); spacer.style.height = '8px'; contentWrap.appendChild(spacer); }

        contentWrap.appendChild(sec);

        // Helper: when any slider changes, mark preset as Custom (do not re-apply values)
        function selectCustomPreset() {
          try { LS.setItem('ui_preset', 'Custom'); } catch (_) {}
          try { dd && dd.setValue('Custom', false); } catch (_) {}
        }

        // Font Size moved to Display tab (overlay)

        // Hoisted knob references so other handlers (e.g., applyPreset) can access them
        let hueKn = null, satKn = null, briKn = null;

        // Experimental: inline color knobs (Hue / Saturation / Intensity) for testing
        try {
          const CK = (window && window.ColorKnobs) ? window.ColorKnobs : null;
          if (CK && CK.createHueKnob && CK.createSaturationKnob && CK.createIntensityKnob) {
            const knobRow = document.createElement('div');
            knobRow.style.display = 'flex';
            knobRow.style.gap = '18px';
            knobRow.style.alignItems = 'center';
            knobRow.style.justifyContent = 'center';
            knobRow.style.margin = '6px 0 10px';
            // Extra breathing room so full 360° Hue ring isn't clipped
            knobRow.style.padding = '6px 4px';
            knobRow.style.overflow = 'visible';

            const makeCol = (el, caption) => {
              const wrap = document.createElement('div');
              wrap.style.display = 'flex';
              wrap.style.flexDirection = 'column';
              wrap.style.alignItems = 'center';
              wrap.style.minWidth = '80px';
              // Ensure ring segments can render beyond exact bounds without clipping
              wrap.style.padding = '4px 2px';
              wrap.style.overflow = 'visible';
              wrap.appendChild(el);
              const cap = document.createElement('div');
              cap.textContent = caption;
              cap.style.fontSize = '12px';
              cap.style.opacity = '0.8';
              // Extra top margin to prevent label/ring overlap (Hue has a full 360° ring)
              cap.style.marginTop = '14px';
              wrap.appendChild(cap);
              return wrap;
            };

            hueKn = CK.createHueKnob({
              size: 56,
              label: 'Hue',
              ringOffset: 18,
              onInput: (v) => {
                // Any knob change implies a custom theme selection
                try { selectCustomPreset(); } catch (_) {}
              }
            });
            satKn = CK.createSaturationKnob({
              size: 56,
              label: 'Saturation',
              ringOffset: 18,
              onInput: () => { try { selectCustomPreset(); } catch (_) {} }
            });
            briKn =CK.createIntensityKnob({
              size: 56,
              label: 'Intensity',
              ringOffset: 18,
              onInput: () => { try { selectCustomPreset(); } catch (_) {} }
            });

            // For this size, nudge the outer ring down a bit for better visual centering
            try { hueKn.el.style.setProperty('--kn-ring-global-y', '4px'); } catch (_) {}
            try { satKn.el.style.setProperty('--kn-ring-global-y', '4px'); } catch (_) {}
            try { briKn.el.style.setProperty('--kn-ring-global-y', '4px'); } catch (_) {}

            knobRow.appendChild(makeCol(hueKn.el, 'Hue'));
            knobRow.appendChild(makeCol(satKn.el, 'Saturation'));
            knobRow.appendChild(makeCol(briKn.el, 'Intensity'));

            contentWrap.appendChild(knobRow);

            // Initialize knobs to current persisted values/preset so they reflect state on open (silent to avoid loops)
            try {
              // Hue
              let hueInit = parseFloat(localStorage.getItem('ui_hue'));
              if (!Number.isFinite(hueInit)) hueInit = 210;
              hueInit = Math.max(0, Math.min(360, Math.round(hueInit)));
              try { if (hueKn && hueKn.setValue) hueKn.setValue(hueInit, { silent: true }); } catch (_) {}

              // Saturation knob shows effective saturation derived from intensity mapping (scaled by 0.8)
              let intensityInit = parseFloat(localStorage.getItem('ui_intensity'));
              if (!Number.isFinite(intensityInit)) intensityInit = 60;
              const satEffInit = Math.max(0, Math.min(85, Math.round(intensityInit * 0.8)));
              try { if (satKn && satKn.setValue) satKn.setValue(satEffInit, { silent: true }); } catch (_) {}

              // Intensity: prefer explicit override; else fall back to current preset's intensity
              let briInit = parseFloat(localStorage.getItem('ui_intensity'));
              if (!Number.isFinite(briInit)) {
                let presetName = null; try { presetName = LS.getItem('ui_preset', null); } catch (_) {}
                const defName = 'Steel Blue';
                const pp = (presetName && themePresets[presetName]) ? themePresets[presetName] : themePresets[defName];
                briInit = pp && Number.isFinite(pp.intensity) ? pp.intensity : 60;
              }
              briInit = Math.max(0, Math.min(100, Math.round(briInit)));
              try { if (briKn && briKn.setValue) briKn.setValue(briInit, { silent: true }); } catch (_) {}
            } catch (_) {}
          }
        } catch (_) {}

        // Hue range slider removed; controlled via Hue knob above.

        // Saturation range slider removed; controlled via Saturation knob above.

        // Space before Border controls
        { const spacer = document.createElement('div'); spacer.style.height = '8px'; contentWrap.appendChild(spacer); }
        // New header before border-related controls (random tagline)
        try {
          const borderQuips = [
            'Life is brighter living on the edge',
            'The sharper the edge, the sharper your blade.',
            'Outline the chaos',
            'Borders define the void',
            'Edge control, edge comfort',
            "Edges don’t protect. They just decorate.",
            "If you're edgy, move a knob to prove it.",
            "Move the glow knob. It's your last chance in life to glow.",
            'A small glow alters the whole room.',
            "The faintest line divides worlds.",
            "You'll never glow up, but the glow knob will.",
            "Glow up? No. Glow knob? Absolutely."
          ];
          if (_quipBorder == null) { _quipBorder = getQuip('settings.overlay.borderTag', borderQuips); }
          contentWrap.appendChild(makeSection('Border', _quipBorder));
        } catch (_) {}

        // New: Border Intensity (0-100)
        const biRow = document.createElement('div'); biRow.style.display = 'flex'; biRow.style.alignItems = 'center'; biRow.style.gap = '8px'; biRow.style.marginBottom = '8px';
        const biLbl = document.createElement('label'); biLbl.textContent = 'Border Intensity:'; biLbl.style.minWidth = '140px'; biLbl.style.fontSize = '14px'; biLbl.style.textAlign = 'left'; biLbl.title = 'Strength of panel borders';
        const biRng = document.createElement('input'); biRng.type = 'range'; biRng.min = '0'; biRng.max = '100'; biRng.step = '1'; biRng.style.flex = '1'; biRng.id = 'settings-ui-border-intensity-ovl';
        const biVal = document.createElement('span'); biVal.style.width = '46px'; biVal.style.textAlign = 'right'; biVal.style.color = '#ccc'; biVal.id = 'settings-ui-border-intensity-ovl-val';
        try { let v = parseFloat(localStorage.getItem('ui_border_intensity')); if (!Number.isFinite(v)) v = 70; const p = Math.max(0, Math.min(100, Math.round(v))); biRng.value = String(p); biVal.textContent = `${p}%`; biRng.title = `${p}%`; } catch (_) {}
        biRng.oninput = () => { const p = Math.max(0, Math.min(100, Math.round(parseFloat(biRng.value) || 0))); if (String(p) !== biRng.value) biRng.value = String(p); biVal.textContent = `${p}%`; biRng.title = `${p}%`; try { window.UITheme && window.UITheme.applyDynamicTheme({ borderStrength: p }); } catch (_) {} try { localStorage.setItem('ui_border_intensity', String(p)); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }; attachWheel(biRng); attachHover(biRng, biLbl);
        biRow.appendChild(biLbl); biRow.appendChild(biRng); biRow.appendChild(biVal); contentWrap.appendChild(biRow);

        // New: Glow Strength (0-100)
        const gsRow = document.createElement('div'); gsRow.style.display = 'flex'; gsRow.style.alignItems = 'center'; gsRow.style.gap = '8px'; gsRow.style.marginBottom = '8px';
        const gsLbl = document.createElement('label'); gsLbl.textContent = 'Border Glow:'; gsLbl.style.minWidth = '140px'; gsLbl.style.fontSize = '14px'; gsLbl.style.textAlign = 'left'; gsLbl.title = 'Strength of panel glow and highlights';
        const gsRng = document.createElement('input'); gsRng.type = 'range'; gsRng.min = '0'; gsRng.max = '100'; gsRng.step = '1'; gsRng.style.flex = '1'; gsRng.id = 'settings-ui-glow-strength-ovl';
        const gsVal = document.createElement('span'); gsVal.style.width = '46px'; gsVal.style.textAlign = 'right'; gsVal.style.color = '#ccc'; gsVal.id = 'settings-ui-glow-strength-ovl-val';
        try { let v = parseFloat(localStorage.getItem('ui_glow_strength')); if (!Number.isFinite(v)) v = 60; const p = Math.max(0, Math.min(100, Math.round(v))); gsRng.value = String(p); try { const px = Math.round((p / 100) * 44); gsVal.textContent = `${px}px`; } catch (_) { gsVal.textContent = `${p}%`; } gsRng.title = `${p}%`; } catch (_) {}
        gsRng.oninput = () => { const p = Math.max(0, Math.min(100, Math.round(parseFloat(gsRng.value) || 0))); if (String(p) !== gsRng.value) gsRng.value = String(p); try { const px = Math.round((p / 100) * 44); gsVal.textContent = `${px}px`; } catch (_) { gsVal.textContent = `${p}%`; } gsRng.title = `${p}%`; try { window.UITheme && window.UITheme.applyDynamicTheme({ glowStrength: p }); } catch (_) {} try { localStorage.setItem('ui_glow_strength', String(p)); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }; attachWheel(gsRng); attachHover(gsRng, gsLbl);
        gsRow.appendChild(gsLbl); gsRow.appendChild(gsRng); gsRow.appendChild(gsVal); contentWrap.appendChild(gsRow);
        // Space before Transparency tagline
        { const spacer = document.createElement('div'); spacer.style.height = '8px'; contentWrap.appendChild(spacer); }
        // Insert a new section header for Transparency Effects with a subtle/random tagline
        try {
          const subtleQuips = [
            'Big movements, subtle changes.',
            'If you do not look closely, you may miss it.',
            'Subtle shifts shape the mood.',
            "It's the little things that matter",
            'It whispers, not shouts.'
          ];
          if (_quipTransparency == null) { _quipTransparency = getQuip('settings.overlay.transparencyTag', subtleQuips); }
          const trSec = makeSection('Transparency', _quipTransparency);
          contentWrap.appendChild(trSec);
        } catch (_) {}

        // Gradient strength slider (0-100)
        const grRow = document.createElement('div');
        grRow.style.display = 'flex'; grRow.style.alignItems = 'center'; grRow.style.gap = '8px'; grRow.style.marginBottom = '8px';
        const grLbl = document.createElement('label'); grLbl.textContent = 'Gradient:'; grLbl.style.minWidth = '140px'; grLbl.style.fontSize = '14px'; grLbl.style.textAlign = 'left'; grLbl.title = 'Surface gradient amount';
        const grRng = document.createElement('input'); grRng.type = 'range'; grRng.min = '0'; grRng.max = '100'; grRng.step = '1'; grRng.style.flex = '1'; grRng.id = 'settings-ui-gradient-ovl';
        const grVal = document.createElement('span'); grVal.style.width = '46px'; grVal.style.textAlign = 'right'; grVal.style.color = '#ccc'; grVal.id = 'settings-ui-gradient-ovl-val';
        try {
          let g = parseFloat(localStorage.getItem('ui_gradient'));
          if (!Number.isFinite(g)) g = 60;
          const p = Math.max(0, Math.min(100, Math.round(g)));
          grRng.value = String(p);
          grVal.textContent = `${p}%`; grRng.title = `${p}%`;
        } catch (_) {}
        grRng.oninput = () => {
          const p = Math.max(0, Math.min(100, Math.round(parseFloat(grRng.value) || 0)));
          if (String(p) !== grRng.value) grRng.value = String(p);
          grVal.textContent = `${p}%`; grRng.title = `${p}%`;
          try { console.debug(`[display] gradient(overlay) p=${p}`); } catch (_) {}
          try { window.UITheme && window.UITheme.applyDynamicTheme({ gradient: p }); } catch (_) {}
          try { localStorage.setItem('ui_gradient', String(p)); } catch (_) {}
          try { selectCustomPreset(); } catch (_) {}
        }; attachWheel(grRng); attachHover(grRng, grLbl);
        grRow.appendChild(grLbl); grRow.appendChild(grRng); grRow.appendChild(grVal);
        // Note: appended after Transparency for new ordering

        // Blur slider (backdrop blur 0-10px)
        const mkRow = document.createElement('div');
        mkRow.style.display = 'flex'; mkRow.style.alignItems = 'center'; mkRow.style.gap = '8px'; mkRow.style.marginBottom = '8px';
        const mkLbl = document.createElement('label'); mkLbl.textContent = 'Overlay Blur:'; mkLbl.style.minWidth = '140px'; mkLbl.style.fontSize = '14px'; mkLbl.style.textAlign = 'left'; mkLbl.title = 'Background blur behind panels/overlays';
        const mkRng = document.createElement('input'); mkRng.type = 'range'; mkRng.min = '0'; mkRng.max = '10'; mkRng.step = '0.1'; mkRng.style.flex = '1'; mkRng.id = 'settings-ui-milkiness-ovl';
        const mkVal = document.createElement('span'); mkVal.style.width = '46px'; mkVal.style.textAlign = 'right'; mkVal.style.color = '#ccc'; mkVal.id = 'settings-ui-milkiness-ovl-val';
        try {
          let m = parseFloat(localStorage.getItem('ui_milkiness'));
          if (!Number.isFinite(m)) m = 3;
          let v = Math.max(0, Math.min(10, m));
          mkRng.value = String(v);
          mkVal.textContent = `${v.toFixed(1)}px`; mkRng.title = `${v.toFixed(1)}px`;
        } catch (_) {}
        mkRng.oninput = () => {
          let v = parseFloat(mkRng.value);
          if (!Number.isFinite(v)) v = 3;
          v = Math.max(0, Math.min(10, v));
          mkRng.value = String(v);
          mkVal.textContent = `${v.toFixed(1)}px`; mkRng.title = `${v.toFixed(1)}px`;
          try { console.debug(`[display] milkiness(overlay) v=${v}`); } catch (_) {}
          try { window.UITheme && window.UITheme.applyDynamicTheme({ milkiness: v }); } catch (_) {}
          try { localStorage.setItem('ui_milkiness', String(v)); } catch (_) {}
          try { selectCustomPreset(); } catch (_) {}
        }; attachWheel(mkRng); attachHover(mkRng, mkLbl);
        mkRow.appendChild(mkLbl); mkRow.appendChild(mkRng); mkRow.appendChild(mkVal);
        // Note: appended after Transparency for new ordering

        // Transparency slider (reversed: 100% = clear, 0% = opaque)
        const opRow = document.createElement('div');
        opRow.style.display = 'flex'; opRow.style.alignItems = 'center'; opRow.style.gap = '8px'; opRow.style.marginBottom = '8px';
        const opLbl = document.createElement('label'); opLbl.textContent = 'Transparency:'; opLbl.style.minWidth = '140px'; opLbl.style.fontSize = '14px'; opLbl.style.textAlign = 'left'; opLbl.title = 'Higher = clearer panels; lower = more solid';
        const opRng = document.createElement('input'); opRng.type = 'range'; opRng.min = '0'; opRng.max = '100'; opRng.step = '1'; opRng.style.flex = '1'; opRng.id = 'settings-ui-opacity-ovl';
        const opVal = document.createElement('span'); opVal.style.width = '46px'; opVal.style.textAlign = 'right'; opVal.style.color = '#ccc'; opVal.id = 'settings-ui-opacity-ovl-val';
        try {
          const OPDBG = true; const MMAX = 2.5; // ceiling
          let raw = null; try { raw = localStorage.getItem('ui_opacity_mult'); } catch (_) {}
          let ns = null; try { ns = LS.getItem('ui_opacity_mult', null); } catch (_) {}
          let mult = null; let p = 85;
          if (raw != null || ns != null) {
            mult = parseFloat(ns != null ? ns : raw);
            if (!Number.isFinite(mult) || mult < 0) mult = 0.375;
            if (mult > 1.25) {
              const pOld = Math.max(0, Math.min(100, Math.round((mult / MMAX) * 100)));
              p = Math.max(0, Math.min(100, 100 - pOld));
            } else {
              p = Math.max(0, Math.min(100, Math.round(100 - (mult / MMAX) * 100)));
            }
          }
          const multClamped = ((100 - p) / 100) * MMAX;
          opRng.value = String(p);
          const pct = String(p) + '%'; opVal.textContent = pct; opRng.title = pct;
          document.documentElement.style.setProperty('--ui-opacity-mult', String(multClamped));
          try { LS.setItem('ui_opacity_mult', String(multClamped)); } catch (_) {}
          try { localStorage.setItem('ui_opacity_mult', String(multClamped)); } catch (_) {}
          if (OPDBG) {
            try {
              const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
              console.debug(`[opacity] display-tab-init(overlay,rev) css=${css} p=${p} multClamped=${multClamped} rawLS=${raw}`);
            } catch (_) {}
          }
        } catch (_) {}
        opRng.oninput = () => {
          const OPDBG = true; const MMAX = 2.5;
          const p = Math.max(0, Math.min(100, Math.round(parseFloat(opRng.value) || 0)));
          if (String(p) !== opRng.value) opRng.value = String(p);
          const mult = ((100 - p) / 100) * MMAX;
          const pct = String(p) + '%';
          opVal.textContent = pct; opRng.title = pct;
          try { window.UITheme && window.UITheme.applyDynamicTheme({ opacityMult: mult }); } catch (_) {}
          // Persist to namespaced LS as well, since init prefers LS over raw localStorage for this key
          try { LS.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
          // Gradient tooltip visible when not fully clear
          try { if (p < 100) { grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; } else { grLbl.title = ''; grLbl.style.opacity = '0.8'; } } catch (_) {}
          if (OPDBG) {
            try {
              const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
              console.debug(`[opacity] slider(overlay,rev) css=${css} p=${p} mult=${mult}`);
            } catch (_) {}
          }
          try { selectCustomPreset(); } catch (_) {}
        }; attachWheel(opRng); attachHover(opRng, opLbl);
        opRow.appendChild(opLbl); opRow.appendChild(opRng); opRow.appendChild(opVal);
        contentWrap.appendChild(opRow);

        // Place Gradient and Blur after Transparency now
        try { const pInit = Math.max(0, Math.min(100, Math.round(parseFloat(opRng.value) || 0))); if (pInit < 100) { grLbl.title = 'Surface gradient amount (more noticeable when not fully transparent)'; grLbl.style.opacity = '1'; } else { grLbl.title = ''; grLbl.style.opacity = '0.8'; } } catch (_) {}
        contentWrap.appendChild(grRow);

        // New: Overlay Darkness (0-100)
        const odRow = document.createElement('div'); odRow.style.display = 'flex'; odRow.style.alignItems = 'center'; odRow.style.gap = '8px'; odRow.style.marginBottom = '8px';
        const odLbl = document.createElement('label'); odLbl.textContent = 'Overlay Darkness:'; odLbl.style.minWidth = '140px'; odLbl.style.fontSize = '14px'; odLbl.style.textAlign = 'left'; odLbl.title = 'Dimming behind dialogs/menus';
        const odRng = document.createElement('input'); odRng.type = 'range'; odRng.min = '0'; odRng.max = '100'; odRng.step = '1'; odRng.style.flex = '1'; odRng.id = 'settings-ui-overlay-darkness-ovl';
        const odVal = document.createElement('span'); odVal.style.width = '46px'; odVal.style.textAlign = 'right'; odVal.style.color = '#ccc'; odVal.id = 'settings-ui-overlay-darkness-ovl-val';
        try { let v = parseFloat(localStorage.getItem('ui_overlay_darkness')); if (!Number.isFinite(v)) v = 50; const p = Math.max(0, Math.min(100, Math.round(v))); odRng.value = String(p); odVal.textContent = `${p}%`; odRng.title = `${p}%`; } catch (_) {}
        odRng.oninput = () => { const p = Math.max(0, Math.min(100, Math.round(parseFloat(odRng.value) || 0))); if (String(p) !== odRng.value) odRng.value = String(p); odVal.textContent = `${p}%`; odRng.title = `${p}%`; try { window.UITheme && window.UITheme.applyDynamicTheme({ overlayDarkness: p }); } catch (_) {} try { localStorage.setItem('ui_overlay_darkness', String(p)); } catch (_) {} try { selectCustomPreset(); } catch (_) {} }; attachWheel(odRng); attachHover(odRng, odLbl);
        odRow.appendChild(odLbl); odRow.appendChild(odRng); odRow.appendChild(odVal); contentWrap.appendChild(odRow);
        // Place Overlay Blur after Overlay Darkness
        contentWrap.appendChild(mkRow);

        // Apply a named preset to all sliders and persist values
        function applyPreset(name) {
          try {
            const defName = 'Steel Blue';
            const p = themePresets[name] || themePresets[defName];
            if (!p) return;
            const MMAX = 2.5;
            const t = Math.max(0, Math.min(100, Math.round(p.transparency)));
            const mult = ((100 - t) / 100) * MMAX;

            // Apply and persist via UITheme
            try {
              window.UITheme && window.UITheme.applyDynamicTheme({
                hue: p.hue,
                intensity: p.intensity,
                borderStrength: p.border,
                glowStrength: p.glow,
                opacityMult: mult,
                gradient: p.gradient,
                milkiness: p.blur,
                overlayDarkness: p.overlayDarkness
              });
            } catch (_) {}
            try { window.dispatchEvent(new CustomEvent('ui:hue-changed')); } catch (_) {}

            // Update UI controls to reflect preset values
            try { hueRng.value = String(p.hue); hueVal.textContent = String(p.hue); hueRng.title = String(p.hue); } catch (_) {}
            try { const i = Math.max(0, Math.min(100, Math.round(p.intensity))); inRng.value = String(i); inVal.textContent = `${i}%`; inRng.title = `${i}%`; } catch (_) {}
            try { const b = Math.max(0, Math.min(100, Math.round(p.border))); biRng.value = String(b); biVal.textContent = `${b}%`; biRng.title = `${b}%`; } catch (_) {}
            try { const g = Math.max(0, Math.min(100, Math.round(p.glow))); gsRng.value = String(g); gsRng.title = `${g}%`; const px = Math.round((g / 100) * 44); gsVal.textContent = `${px}px`; } catch (_) {}
            try { const gr = Math.max(0, Math.min(100, Math.round(p.gradient))); grRng.value = String(gr); grVal.textContent = `${gr}%`; grRng.title = `${gr}%`; } catch (_) {}
            try { let m = Number(p.blur); if (!Number.isFinite(m)) m = 3; m = Math.max(0, Math.min(10, m)); mkRng.value = String(m); mkVal.textContent = `${m.toFixed(1)}px`; mkRng.title = `${m.toFixed(1)}px`; } catch (_) {}
            try { const od = Math.max(0, Math.min(100, Math.round(p.overlayDarkness))); odRng.value = String(od); odVal.textContent = `${od}%`; odRng.title = `${od}%`; } catch (_) {}
            try { opRng.value = String(t); opVal.textContent = `${t}%`; opRng.title = `${t}%`; } catch (_) {}

            // Silently sync knobs to the preset without re-applying handlers
            try { if (typeof hueKn !== 'undefined' && hueKn && hueKn.setValue) hueKn.setValue(p.hue, { silent: true }); } catch (_) {}
            try {
              // Saturation knob shows effective saturation derived from intensity mapping used by themeManager
              const satEff = Math.max(0, Math.min(85, Math.round((Number(p.intensity) || 60) * 0.8)));
              if (typeof satKn !== 'undefined' && satKn && satKn.setValue) satKn.setValue(satEff, { silent: true });
            } catch (_) {}
            try {
              // Intensity knob: set from preset intensity
              const br = Math.max(0, Math.min(100, Math.round(Number(p.intensity) || 60)));
              if (typeof briKn !== 'undefined' && briKn && briKn.setValue) briKn.setValue(br, { silent: true });
            } catch (_) {}

            // Persist values so preset selection survives reloads and Reset applies correctly
            try {
              localStorage.setItem('ui_hue', String(p.hue));
              localStorage.setItem('ui_intensity', String(Math.max(0, Math.min(100, Math.round(Number(p.intensity) || 60)))));
              localStorage.setItem('ui_border_intensity', String(Math.max(0, Math.min(100, Math.round(p.border)))));
              localStorage.setItem('ui_glow_strength', String(Math.max(0, Math.min(100, Math.round(p.glow)))));
              localStorage.setItem('ui_gradient', String(Math.max(0, Math.min(100, Math.round(p.gradient)))));
              // blur (milkiness) allows decimals, clamp to [0,10]
              const mLS = Math.max(0, Math.min(10, Number(p.blur)));
              localStorage.setItem('ui_milkiness', String(mLS));
              localStorage.setItem('ui_overlay_darkness', String(Math.max(0, Math.min(100, Math.round(p.overlayDarkness)))));
              // store opacity multiplier in both LS wrappers for compatibility
              try { LS.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
              localStorage.setItem('ui_opacity_mult', String(mult));
              // Clear any prior explicit overrides so preset uses intensity-based mapping cleanly
              try { localStorage.removeItem('ui_saturation'); } catch (_) {}
            } catch (_) {}

            try { LS.setItem('ui_preset', name); } catch (_) {}
          } catch (_) {}
        }


      } else if (tab === 'Display') {
        renderDisplayTab({
          container: contentWrap,
          makeSection,
          headerTitle: 'Display',
          headerDesc: 'Legibility and scale.',
          variant: 'overlay'
        });
      } else if (tab === 'Sound')  {
        // Clean up any previous overlay listener before re-attaching via tab module
        try {
          if (volAdjustHandler) {
            if (typeof volAdjustHandler === 'function') volAdjustHandler();
            else window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
          }
        } catch (_) {}
        // Render Sound tab via module; capture cleanup function
        volAdjustHandler = renderSoundTab({
          container: contentWrap,
          makeSection,
          makeNote,
          variant: 'overlay',
          setDirty
        });
      } else if (tab === 'Controls') {
        renderControlTab({
          container: contentWrap,
          makeSection,
          makeNote,
          variant: 'overlay'
        });
      }
    }

    // Assemble
    card.appendChild(header);
    card.appendChild(tagline);
    card.appendChild(tabsBar.el);
    card.appendChild(contentWrap);
    center.appendChild(card);
    // Mount settings centered UI into our dedicated layer
    mount.appendChild(center);

    // Focus trap within the card
    try {
      const trap = (ev) => {
        if (ev.key === 'Escape') {
          ev.preventDefault(); ev.stopPropagation();
          try { closeBtn.click(); } catch (_) {}
          return;
        }
        if (ev.key !== 'Tab') return;
        const nodes = card.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const focusables = Array.from(nodes).filter(el => !el.disabled && el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); try { last.focus(); } catch (_) {} }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); try { first.focus(); } catch (_) {} }
      };
      card.addEventListener('keydown', trap);
      // Initial focus to first button/input
      setTimeout(() => {
        try {
          const nodes = card.querySelectorAll('input, button, select, textarea');
          for (const n of nodes) { if (!n.disabled) { n.focus(); break; } }
        } catch (_) {}
      }, 0);
    } catch (_) {}

    // Close without unsaved-change prompts (auto-save behavior)
    closeBtn.onclick = () => {
      try {
        if (volAdjustHandler) {
          if (typeof volAdjustHandler === 'function') volAdjustHandler();
          else window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
        }
      } catch (_) {}
      // Clean up our mount layer
      try { const m = document.getElementById('settings-overlay-root'); if (m && m.parentNode) m.parentNode.removeChild(m); } catch (_) {}
      try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
    };

    // Resolve auth, drafts, and server profile, then conditionally render
    (async () => {
      const prevLoggedIn = loggedIn;
      const prevNick = nicknameVal;
      try { loggedIn = !!(await getUser()); } catch (_) { loggedIn = false; }
      // Load local drafts first
      try { nicknameVal = LS.getItem('draft:nickname', '') || ''; } catch (_) {}
      try { bioVal = LS.getItem('draft:bio', '') || ''; } catch (_) {}
      // If logged in and no local nickname draft, prefill from server profile (creates one if missing)
      if (loggedIn && !nicknameVal) {
        try {
          const prof = await ensureProfileForCurrentUser();
          if (prof && prof.display_name && !nicknameVal) nicknameVal = String(prof.display_name);
        } catch (_) {}
      }
      // Only re-render if we're on Account/Profile and auth or nickname changed
      const tabNeedsAuth = (activeTab === 'Account' || activeTab === 'Profile');
      if (tabNeedsAuth && (loggedIn !== prevLoggedIn || nicknameVal !== prevNick)) {
        render();
      }
    })();

    // Initial render (before async auth completes)
    render();

    return true;
  } catch (_) {
    return false;
  }
}

// Optional global exposure for quick access/debug
window.presentSettingsPanel = presentSettingsPanel;
window.closeSettingsPanel = closeSettingsPanel;
window.setSettingsAuth = setSettingsAuth;
