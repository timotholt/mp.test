import { bindRange, getValue, setValue, DEFAULT_WHEEL_STEP } from '../core/audio/volumeGroupManager.js';
import { createVolumeKnob } from '../core/audio/volumeKnob.js';
import * as LS from '../core/localStorage.js';
import { createTabsBar, createLeftIconInput, wireFocusHighlight, UI, createInputRow } from '../core/ui/controls.js';
import { getUser, ensureProfileForCurrentUser } from '../core/auth/supabaseAuth.js';

// Self-contained Settings Panel (always-available)
// Lives outside OverlayManager and routes. JS-only, no external CSS.
// Tabs: Account, Profile, Display, Sound, Controls.
// Account tab is disabled until authenticated.

let __settingsState = {
  activeTab: 'Profile',
  accountEnabled: false,
};

function computeAccountEnabled() {
  try {
    if (typeof window.__settingsAccountEnabled === 'boolean') return !!window.__settingsAccountEnabled;
  } catch (_) {}
  // Heuristic: enabled when joined to a room (until proper auth is wired)
  try { if (window.room) return true; } catch (_) {}
  return false;
}

export function presentSettingsPanel() {
  // Prefer overlay modal when available for dark backdrop + centering
  try { if (presentSettingsOverlay && presentSettingsOverlay()) return; } catch (_) {}
  let panel = document.getElementById('settings-panel');
  if (!panel) panel = createSettingsPanel();
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

export function setSettingsAuth({ accountEnabled }) {
  __settingsState.accountEnabled = !!accountEnabled;
  try { window.__settingsAccountEnabled = !!accountEnabled; } catch (_) {}
  const panel = document.getElementById('settings-panel');
  if (panel && panel.style.display !== 'none') renderSettingsContent(panel);
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
      setSettingsAuth({ accountEnabled: v });
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
    content.appendChild(makeSection('Account', 'Manage your account, authentication and linked providers.'));
    if (!__settingsState.accountEnabled) {
      content.appendChild(makeNote('Please login to a game server first to change your account settings.'));
    } else {
      content.appendChild(makeNote('You are logged in.'));
    }
  } else if (tab === 'Profile') {
    content.appendChild(makeSection('Profile'));
    if (!__settingsState.accountEnabled) {
      content.appendChild(makeNote('Please login to a game server first to change your profile settings.'));
    } else {
      content.appendChild(makeRow('Display Name', makeInput('text', LS.getItem('name', '') || '')));
    }
  } else if (tab === 'Display') {
    const sec = makeSection('Display', 'Theme and rendering.');
    // Insert Reset button into the Display section header (right side)
    try {
      const hdr = sec.firstChild; // title div
      if (hdr) {
        hdr.style.display = 'flex';
        hdr.style.alignItems = 'center';
        hdr.style.justifyContent = 'space-between';
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
          const OPDBG = true; const MMAX = 2.5; const defMult = 2.125; // 85% of MMAX
          // Reset theme
          try { sel.value = 'dark'; LS.setItem('theme', 'dark'); window.setTheme && window.setTheme('dark'); } catch (_) {}
          // Reset dynamic theme knobs
          try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: 1, hue: 210, intensity: 60, opacityMult: defMult }); } catch (_) {}
          try { fsRng.value = '100'; fsVal.textContent = '100%'; fsRng.title = '100%'; } catch (_) {}
          try { hueRng.value = '210'; hueVal.textContent = '210'; hueRng.title = '210'; } catch (_) {}
          try { inRng.value = '60'; inVal.textContent = '60'; inRng.title = '60'; } catch (_) {}
          try { localStorage.setItem('ui_font_scale', '1'); } catch (_) {}
          try { localStorage.setItem('ui_hue', '210'); } catch (_) {}
          try { localStorage.setItem('ui_intensity', '60'); } catch (_) {}
          // Reset opacity
          const p = Math.round((defMult / MMAX) * 100);
          try { opRng.value = String(p); opVal.textContent = `${p}%`; opRng.title = `${p}%`; } catch (_) {}
          if (OPDBG) {
            try {
              const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
              console.debug(`[opacity] reset(panel) css=${css} p=${p} mult=${defMult}`);
            } catch (_) {}
          }
        };
        hdr.appendChild(resetBtn);
      }
    } catch (_) {}
    content.appendChild(sec);
    const themeRow = document.createElement('div');
    themeRow.style.display = 'flex'; themeRow.style.alignItems = 'center'; themeRow.style.gap = '8px'; themeRow.style.marginBottom = '8px';
    const lbl = document.createElement('label'); lbl.textContent = 'Theme:';
    const sel = document.createElement('select');
    ['dark','light'].forEach((opt) => { const o = document.createElement('option'); o.value = opt; o.textContent = opt; sel.appendChild(o); });
    // Load and apply persisted theme
    try {
      const saved = LS.getItem('theme', null);
      if (saved) sel.value = saved;
      if (window.setTheme) window.setTheme(sel.value || saved || 'dark');
    } catch (_) {}
    sel.onchange = () => {
      try { LS.setItem('theme', sel.value); } catch (_) {}
      try { window.setTheme && window.setTheme(sel.value); } catch (_) {}
    };
    themeRow.appendChild(lbl); themeRow.appendChild(sel); content.appendChild(themeRow);

    // Font Size slider (root rem scale)
    const fsRow = document.createElement('div');
    fsRow.style.display = 'flex'; fsRow.style.alignItems = 'center'; fsRow.style.gap = '8px'; fsRow.style.marginBottom = '8px';
    const fsLbl = document.createElement('label'); fsLbl.textContent = 'Font Size:'; fsLbl.style.minWidth = '140px';
    const fsRng = document.createElement('input'); fsRng.type = 'range'; fsRng.min = '80'; fsRng.max = '120'; fsRng.step = '1'; fsRng.style.flex = '1'; fsRng.id = 'settings-ui-fontscale';
    const fsVal = document.createElement('span'); fsVal.style.width = '46px'; fsVal.style.textAlign = 'right'; fsVal.style.color = '#ccc'; fsVal.id = 'settings-ui-fontscale-val';
    try {
      let scale = parseFloat(localStorage.getItem('ui_font_scale'));
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;
      const p = Math.max(80, Math.min(120, Math.round(scale * 100)));
      fsRng.value = String(p);
      fsVal.textContent = `${p}%`; fsRng.title = `${p}%`;
    } catch (_) {}
    fsRng.oninput = () => {
      const p = Math.max(80, Math.min(120, Math.round(parseFloat(fsRng.value) || 100)));
      if (String(p) !== fsRng.value) fsRng.value = String(p);
      const scale = p / 100;
      fsVal.textContent = `${p}%`; fsRng.title = `${p}%`;
      try { console.debug(`[display] fontScale(panel) p=${p} scale=${scale}`); } catch (_) {}
      try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: scale }); } catch (_) {}
      try { localStorage.setItem('ui_font_scale', String(scale)); } catch (_) {}
    };
    fsRow.appendChild(fsLbl); fsRow.appendChild(fsRng); fsRow.appendChild(fsVal);
    content.appendChild(fsRow);

    // Hue slider
    const hueRow = document.createElement('div');
    hueRow.style.display = 'flex'; hueRow.style.alignItems = 'center'; hueRow.style.gap = '8px'; hueRow.style.marginBottom = '8px';
    const hueLbl = document.createElement('label'); hueLbl.textContent = 'Hue:'; hueLbl.style.minWidth = '140px';
    const hueRng = document.createElement('input'); hueRng.type = 'range'; hueRng.min = '0'; hueRng.max = '360'; hueRng.step = '1'; hueRng.style.flex = '1'; hueRng.id = 'settings-ui-hue';
    const hueVal = document.createElement('span'); hueVal.style.width = '46px'; hueVal.style.textAlign = 'right'; hueVal.style.color = '#ccc'; hueVal.id = 'settings-ui-hue-val';
    try {
      let hue = parseFloat(localStorage.getItem('ui_hue'));
      if (!Number.isFinite(hue)) hue = 210;
      const p = Math.max(0, Math.min(360, Math.round(hue)));
      hueRng.value = String(p);
      hueVal.textContent = `${p}`; hueRng.title = `${p}`;
    } catch (_) {}
    hueRng.oninput = () => {
      const p = Math.max(0, Math.min(360, Math.round(parseFloat(hueRng.value) || 0)));
      if (String(p) !== hueRng.value) hueRng.value = String(p);
      hueVal.textContent = `${p}`; hueRng.title = `${p}`;
      try { console.debug(`[display] hue(panel) p=${p}`); } catch (_) {}
      try { window.UITheme && window.UITheme.applyDynamicTheme({ hue: p }); } catch (_) {}
      try { localStorage.setItem('ui_hue', String(p)); } catch (_) {}
    };
    hueRow.appendChild(hueLbl); hueRow.appendChild(hueRng); hueRow.appendChild(hueVal);
    content.appendChild(hueRow);

    // Intensity slider
    const inRow = document.createElement('div');
    inRow.style.display = 'flex'; inRow.style.alignItems = 'center'; inRow.style.gap = '8px'; inRow.style.marginBottom = '8px';
    const inLbl = document.createElement('label'); inLbl.textContent = 'Intensity:'; inLbl.style.minWidth = '140px';
    const inRng = document.createElement('input'); inRng.type = 'range'; inRng.min = '0'; inRng.max = '100'; inRng.step = '1'; inRng.style.flex = '1'; inRng.id = 'settings-ui-intensity';
    const inVal = document.createElement('span'); inVal.style.width = '46px'; inVal.style.textAlign = 'right'; inVal.style.color = '#ccc'; inVal.id = 'settings-ui-intensity-val';
    try {
      let intensity = parseFloat(localStorage.getItem('ui_intensity'));
      if (!Number.isFinite(intensity)) intensity = 60;
      const p = Math.max(0, Math.min(100, Math.round(intensity)));
      inRng.value = String(p);
      inVal.textContent = `${p}`; inRng.title = `${p}`;
    } catch (_) {}
    inRng.oninput = () => {
      const p = Math.max(0, Math.min(100, Math.round(parseFloat(inRng.value) || 0)));
      if (String(p) !== inRng.value) inRng.value = String(p);
      inVal.textContent = `${p}`; inRng.title = `${p}`;
      try { console.debug(`[display] intensity(panel) p=${p}`); } catch (_) {}
      try { window.UITheme && window.UITheme.applyDynamicTheme({ intensity: p }); } catch (_) {}
      try { localStorage.setItem('ui_intensity', String(p)); } catch (_) {}
    };
    inRow.appendChild(inLbl); inRow.appendChild(inRng); inRow.appendChild(inVal);
    content.appendChild(inRow);

    // Transparency slider
    const opRow = document.createElement('div');
    opRow.style.display = 'flex'; opRow.style.alignItems = 'center'; opRow.style.gap = '8px'; opRow.style.marginBottom = '8px';
    const opLbl = document.createElement('label'); opLbl.textContent = 'Transparency:'; opLbl.style.minWidth = '140px';
    const opRng = document.createElement('input'); opRng.type = 'range'; opRng.min = '0'; opRng.max = '100'; opRng.step = '1'; opRng.style.flex = '1'; opRng.id = 'settings-ui-opacity';
    const opVal = document.createElement('span'); opVal.style.width = '46px'; opVal.style.textAlign = 'right'; opVal.style.color = '#ccc'; opVal.id = 'settings-ui-opacity-val';
    // Initialize from storage, default 1. Read both namespaced and raw keys for compatibility
    try {
      const OPDBG = true; // TEMP debug logging toggle
      const MMAX = 2.5; // 100% -> full opacity
      let raw = null; try { raw = localStorage.getItem('ui_opacity_mult'); } catch (_) {}
      let ns = null; try { ns = LS.getItem('ui_opacity_mult', null); } catch (_) {}
      let mult;
      let p;
      if (raw != null || ns != null) {
        mult = parseFloat(ns != null ? ns : raw);
        if (!Number.isFinite(mult) || mult < 0) mult = 1;
        p = Math.max(0, Math.min(100, Math.round((mult / MMAX) * 100)));
      } else {
        // Default to 85% transparency when no prior value exists
        p = 85;
        mult = (p / 100) * MMAX;
        try { LS.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
        try { localStorage.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
      }
      opRng.value = String(p);
      const pct = String(p) + '%';
      opVal.textContent = pct; opRng.title = pct;
      // Clamp CSS var to the new scale so old values (e.g., 12.5) don't overdrive
      const multClamped = (p / 100) * MMAX;
      document.documentElement.style.setProperty('--ui-opacity-mult', String(multClamped));
      if (OPDBG) {
        try {
          const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
          console.debug(`[opacity] display-tab-init(panel) css=${css} p=${p} multClamped=${multClamped} rawLS=${raw}`);
        } catch (_) {}
      }
    } catch (_) {}
    opRng.oninput = () => {
      const OPDBG = true; const MMAX = 2.5;
      const p = Math.max(0, Math.min(100, Math.round(parseFloat(opRng.value) || 0)));
      if (String(p) !== opRng.value) opRng.value = String(p);
      const mult = (p / 100) * MMAX;
      const pct = String(p) + '%';
      opVal.textContent = pct; opRng.title = pct;
      try { window.UITheme && window.UITheme.applyDynamicTheme({ opacityMult: mult }); } catch (_) {}
      if (OPDBG) {
        try {
          const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
          console.debug(`[opacity] slider(panel) css=${css} p=${p} mult=${mult}`);
        } catch (_) {}
      }
    };
    opRow.appendChild(opLbl); opRow.appendChild(opRng); opRow.appendChild(opVal);
    content.appendChild(opRow);

    // Reset button moved to section header (see above)
  } else if (tab === 'Sound') {
    content.appendChild(makeSection('Sound'));
    // Space between section title and knobs (increase spacing to 1rem)
    { const spacer = document.createElement('div'); spacer.style.height = '1rem'; content.appendChild(spacer); }
    // Volume knobs (smaller)
    content.appendChild(makeVolumeKnobsGrid());

    // Spacer above Notifications
    { const spacer = document.createElement('div'); spacer.style.height = '12px'; content.appendChild(spacer); }
    // Notifications (style description to match top modal tagline)
    {
      const sec = makeSection('Notifications', 'Choose which alerts to receive.');
      try {
        const desc = sec.children && sec.children[1];
        if (desc) {
          desc.style.fontSize = '13px';
          desc.style.opacity = '0.9';
          desc.style.margin = '0 0 10px 0';
          desc.style.color = 'var(--ui-fg, #eee)';
          desc.style.userSelect = 'none';
        }
      } catch (_) {}
      content.appendChild(sec);
    }
    content.appendChild(makeCheckboxRow('Player joins/leaves lobby/room', 'notif_playerJoinLeave', 'ui:notif:playerJoinLeave'));
    content.appendChild(makeCheckboxRow('Friend joins/leaves server/lobby/room', 'notif_friendJoinLeave', 'ui:notif:friendJoinLeave'));
    content.appendChild(makeCheckboxRow('Public game created', 'notif_publicGameCreated', 'ui:notif:publicGameCreated'));
    content.appendChild(makeCheckboxRow('Friend game created', 'notif_friendGameCreated', 'ui:notif:friendGameCreated'));
    content.appendChild(makeCheckboxRow('New lobby chat message', 'notif_lobbyChat', 'ui:notif:lobbyChat'));
    content.appendChild(makeCheckboxRow('New game chat message', 'notif_gameChat', 'ui:notif:gameChat'));
    content.appendChild(makeCheckboxRow('@Mention', 'notif_mention', 'ui:notif:mention'));
  } else if (tab === 'Controls') {
    content.appendChild(makeSection('Controls', 'Keybinds (coming soon).'));
    content.appendChild(makeNote('Keybinding editor will appear here.'));
  }
}

function makeSection(title, desc) {
  const wrap = document.createElement('div');
  const t = document.createElement('div'); t.textContent = title; t.style.fontWeight = 'bold'; t.style.margin = '6px 0';
  wrap.appendChild(t);
  if (desc) {
    const d = document.createElement('div'); d.textContent = desc; d.style.color = 'var(--ui-fg, #eee)'; d.style.marginBottom = '8px';
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

// Knobs grid for Sound tab (MASTER, GAME, MUSIC, VOICE)
function makeVolumeKnobsGrid() {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.gap = '14px';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'flex-start';

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
    cell.style.width = '110px';

    const { el } = createVolumeKnob({ groupId: g.id, label: g.label + ' Volume', size: 64, segments: 20 });
    const cap = document.createElement('div');
    cap.textContent = g.label;
    cap.style.marginTop = '6px';
    cap.style.color = 'var(--ui-fg, #eee)';
    cap.style.opacity = '0.9';
    cap.style.fontSize = '12px';

    cell.appendChild(el);
    cell.appendChild(cap);
    wrap.appendChild(cell);
  });

  return wrap;
}

// Helpers for Sound tab
function makeVolumeRow(labelText, storageKey, windowVarName, eventName) {
  const row = document.createElement('div');
  row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px'; row.style.marginBottom = '8px';
  const lbl = document.createElement('label'); lbl.textContent = labelText + ':'; lbl.style.minWidth = '140px';
  const rng = document.createElement('input'); rng.type = 'range'; rng.min = '0'; rng.max = '1'; rng.step = String(DEFAULT_WHEEL_STEP); rng.style.flex = '1';
  const val = document.createElement('span'); val.style.width = '46px'; val.style.textAlign = 'right'; val.style.color = '#ccc';
  // Give IDs to master volume row for external syncing
  if (storageKey === 'volume') { rng.id = 'settings-master-volume'; val.id = 'settings-master-volume-val'; }
  // Assign IDs for other volume rows to enable external syncing
  if (storageKey === 'volume_game') { rng.id = 'settings-game-volume'; val.id = 'settings-game-volume-val'; }
  if (storageKey === 'volume_music') { rng.id = 'settings-music-volume'; val.id = 'settings-music-volume-val'; }
  if (storageKey === 'volume_voice') { rng.id = 'settings-voice-volume'; val.id = 'settings-voice-volume-val'; }
  // Group mapping for new volumes API
  const groupId = (storageKey === 'volume') ? 'MASTER'
    : (storageKey === 'volume_game') ? 'GAME'
    : (storageKey === 'volume_music') ? 'MUSIC'
    : (storageKey === 'volume_voice') ? 'VOICE'
    : 'MASTER';

  // Initialize UI from group value
  try {
    const init = getValue(groupId);
    rng.value = String(init);
    setValue(groupId, init, { silent: true });
    const pct = String(Math.round(init * 100)) + '%';
    val.textContent = pct; rng.title = pct;
  } catch (_) {}

  // Bind via unified group-based utility (handles input, wheel, external sync)
  bindRange(rng, groupId, {
    withWheel: true,
    emitOnInit: false,
    onRender: (v) => {
      try {
        const pct = String(Math.round(v * 100)) + '%';
        val.textContent = pct; rng.title = pct;
      } catch (_) {}
    }
  });

  // While adjusting from the Settings panel, broadcast an adjusting flag for MASTER only
  if (groupId === 'MASTER') {
    try {
      const sendAdjusting = (adjusting) => {
        try { window.dispatchEvent(new CustomEvent('ui:volume:adjusting', { detail: { adjusting: !!adjusting, source: 'settings' } })); } catch (_) {}
      };
      const end = () => sendAdjusting(false);
      rng.addEventListener('mousedown', () => sendAdjusting(true));
      rng.addEventListener('touchstart', () => sendAdjusting(true));
      rng.addEventListener('mouseenter', () => sendAdjusting(true));
      rng.addEventListener('mouseup', end);
      rng.addEventListener('touchend', end);
      rng.addEventListener('mouseleave', end);
      rng.addEventListener('blur', end);
      let __wheelAdjustTimer;
      rng.addEventListener('wheel', () => {
        sendAdjusting(true);
        try { if (__wheelAdjustTimer) clearTimeout(__wheelAdjustTimer); } catch (_) {}
        __wheelAdjustTimer = setTimeout(() => { try { sendAdjusting(false); } catch (_) {} }, 600);
      }, { passive: true });
    } catch (_) {}
  }
  row.appendChild(lbl); row.appendChild(rng); row.appendChild(val);
  return row;
}

function makeCheckboxRow(labelText, storageKey, eventName) {
  const row = document.createElement('div');
  row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px'; row.style.marginBottom = '6px';
  const cb = document.createElement('input'); cb.type = 'checkbox';
  try { cb.checked = LS.getItem(storageKey, '0') === '1'; } catch (_) { cb.checked = false; }
  // Themed checkbox: use accentColor + subtle border/glow on hover/focus
  try {
    // Primary check color follows theme, fallback to blue-ish
    cb.style.accentColor = 'var(--ui-bright, rgba(120,170,255,0.90))';
    // No persistent outline; set during hover/focus only
    cb.style.outline = 'none';
    cb.style.outlineOffset = '2px';
    cb.style.cursor = 'pointer';
    // Hover/Focus glow using theme outer glow. Inline events to avoid CSS pseudo-classes.
    const onHover = () => {
      try {
        cb.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))';
        cb.style.outline = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
      } catch (_) {}
    };
    const onLeave = () => {
      try {
        cb.style.boxShadow = 'none';
        cb.style.outline = 'none';
      } catch (_) {}
    };
    cb.addEventListener('mouseenter', onHover);
    cb.addEventListener('mouseleave', onLeave);
    cb.addEventListener('focus', onHover);
    cb.addEventListener('blur', onLeave);
  } catch (_) {}
  const lbl = document.createElement('label'); lbl.textContent = labelText; lbl.style.fontSize = '12px'; lbl.style.lineHeight = '1.2';
  // Link label to checkbox for accessibility
  try { const id = `settings-${String(storageKey)}`; cb.id = id; lbl.htmlFor = id; } catch (_) {}
  cb.onchange = () => {
    try { LS.setItem(storageKey, cb.checked ? '1' : '0'); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent(eventName, { detail: { enabled: cb.checked } })); } catch (_) {}
  };
  row.appendChild(cb); row.appendChild(lbl);
  return row;
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

    // Darker backdrop to emphasize modal
    try {
      overlay.style.background = 'radial-gradient(1200px 600px at 50% 10%, '
        + 'var(--ui-surface-bg-top, rgba(12,24,48,0.65)) 0%, '
        + 'var(--ui-surface-bg-bottom, rgba(4,8,18,0.78)) 60%, '
        + 'var(--ui-surface-bg-bottom, rgba(2,4,10,0.88)) 100%)';
      // Follow OverlayManager defaults so background passes clicks through
      // and only the modal content captures input. Keep zIndex modest.
      overlay.style.zIndex = '20000';
      overlay.style.pointerEvents = 'none';
      if (content && content.style) {
        content.style.zIndex = '20001';
        content.style.pointerEvents = 'auto';
        content.style.position = 'relative';
      }
    } catch (_) {}
    const prevFocus = document.activeElement;

    // Centered container
    const center = document.createElement('div');
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
    card.style.backdropFilter = 'var(--sf-tip-backdrop, blur(8px) saturate(1.25))';
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

    // Settings-specific taglines
    const settingsTaglines = [
      'Tune the dials. Tame the darkness.',
      'Make the abyss more habitable.',
      'Adjust reality to your liking.',
      'Personalization: because doom is unique.',
      'Polish your experience. Leave the grime.',
      'Twist the knobs; not your fate.',
      'Balance chaos with preferences.',
      'Sharper fangs, softer UI.',
      'Comfort meets calamity.',
      'Where control meets the void.',
      'Temper the noise. Amplify the legend.',
      'Set the stage for heroics.',
      'Make the night yours.',
      'Silence the wraiths, not the music.',
      'Buttons for the brave.',
      'Your dungeon, your rules.',
      'Fine‑tune the fear factor.',
      'Dial back the doom, if you must.',
      'Refine the ritual settings.',
      'Customize the chaos.'
    ];
    const tagline = document.createElement('div');
    try {
      tagline.textContent = settingsTaglines[Math.floor(Math.random() * settingsTaglines.length)];
      tagline.style.fontSize = '13px';
      tagline.style.opacity = '0.9';
      tagline.style.margin = '0 0 10px 0';
      tagline.style.color = 'var(--ui-fg, #eee)';
      tagline.style.userSelect = 'none';
    } catch (_) {}
    try { tagline.id = 'settings-modal-desc'; card.setAttribute('aria-describedby', 'settings-modal-desc'); } catch (_) {}

    // Tabs bar
    const tabsBar = createTabsBar({ onSelect: onSelectTab });
    const allTabs = ['Account', 'Profile', 'Display', 'Sound', 'Controls'];

    // Bordered content area with scroll
    const contentWrap = document.createElement('div');
    try { contentWrap.classList.add('ui-glass-scrollbar'); } catch (_) {}
    contentWrap.style.overflow = 'auto';
    contentWrap.style.padding = '10px';
    contentWrap.style.paddingRight = '6px';
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
        contentWrap.appendChild(makeSection('Account', 'Manage your account, authentication and linked providers.'));
        if (!loggedIn) {
          contentWrap.appendChild(makeNote('Login required. Sign in to manage your account.'));
        } else {
          contentWrap.appendChild(makeNote('You are logged in.')); // Placeholder until account UI is added
        }
      } else if (tab === 'Profile') {
        contentWrap.appendChild(makeSection('Profile'));
        if (!loggedIn) {
          contentWrap.appendChild(makeNote('Login required. Sign in to edit your profile.'));
        } else {
          // Nickname row with right-side dice button inside the input (like login password eye)
          const nickRow = createInputRow({ dataName: 'nickname' });
          const nickLabel = document.createElement('label'); nickLabel.textContent = 'Nickname:'; nickLabel.style.minWidth = '100px';
          const diceSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/></svg>';

          const nickWrap = document.createElement('div');
          nickWrap.style.position = 'relative';
          nickWrap.style.display = 'flex';
          nickWrap.style.alignItems = 'center';
          nickWrap.style.flex = '1';

          const nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.placeholder = 'Pick a unique nickname';
          nameInput.value = nicknameVal || '';
          nameInput.style.display = 'inline-block';
          nameInput.style.height = '40px';
          nameInput.style.lineHeight = '40px';
          nameInput.style.background = 'transparent';
          nameInput.style.outline = 'none';
          nameInput.style.color = 'var(--sf-tip-fg, #fff)';
          nameInput.style.border = '0';
          nameInput.style.borderRadius = '8px';
          nameInput.style.padding = `0 calc(${UI.iconSize}px + ${UI.leftGap}) 0 10px`;
          nameInput.style.boxShadow = UI.insetShadow;
          nameInput.style.flex = '1';
          nameInput.style.width = '100%';
          nameInput.oninput = () => { nicknameVal = String(nameInput.value || ''); setDirty(true); };
          try { nameInput.id = 'settings-nickname'; nickLabel.htmlFor = 'settings-nickname'; } catch (_) {}

          const diceBtn = document.createElement('button');
          diceBtn.type = 'button';
          diceBtn.title = 'Roll a random nickname';
          diceBtn.style.position = 'absolute';
          diceBtn.style.right = '0';
          diceBtn.style.top = '50%';
          diceBtn.style.transform = 'translateY(-50%)';
          diceBtn.style.width = `${UI.iconSize}px`;
          diceBtn.style.height = `${UI.iconSize}px`;
          diceBtn.style.display = 'inline-flex';
          diceBtn.style.alignItems = 'center';
          diceBtn.style.justifyContent = 'center';
          diceBtn.style.background = 'transparent';
          diceBtn.style.border = UI.border;
          diceBtn.style.borderRadius = '8px';
          diceBtn.style.boxSizing = 'border-box';
          diceBtn.style.color = 'var(--ui-bright, rgba(190,230,255,0.90))';
          diceBtn.style.cursor = 'pointer';
          diceBtn.innerHTML = diceSvg;
          diceBtn.onclick = async () => {
            try {
              const base = ['Vox', 'Hex', 'Gloom', 'Iron', 'Vermilion', 'Ash', 'Rune', 'Blight', 'Grim', 'Cipher'];
              const suf = ['fang', 'shade', 'mark', 'wrath', 'spire', 'veil', 'shard', 'brand', 'wraith', 'mourn'];
              const nick = base[Math.floor(Math.random()*base.length)] + suf[Math.floor(Math.random()*suf.length)] + Math.floor(Math.random()*90+10);
              nameInput.value = nick; nicknameVal = nick; setDirty(true);
            } catch (_) {}
          };

          nickWrap.appendChild(nameInput);
          nickWrap.appendChild(diceBtn);
          nickRow.appendChild(nickLabel);
          nickRow.appendChild(nickWrap);
          contentWrap.appendChild(nickRow);
          try { wireFocusHighlight(nameInput, nickRow); } catch (_) {}

          // Bio (multiline, fixed container height so the card size doesn’t jump)
          const bioRow = document.createElement('div');
          bioRow.style.display = 'flex'; bioRow.style.flexDirection = 'column'; bioRow.style.gap = '6px'; bioRow.style.marginBottom = '8px';
          const bioLbl = document.createElement('label'); bioLbl.textContent = 'Bio:';
          const bioWrap = document.createElement('div');
          bioWrap.style.position = 'relative';
          bioWrap.style.display = 'flex';
          bioWrap.style.flex = '1';
          try { bioWrap.style.border = UI.border; bioWrap.style.borderRadius = '8px'; bioWrap.style.boxShadow = UI.insetShadow; } catch (_) {}
          const bio = document.createElement('textarea');
          bio.placeholder = 'Whisper your legend into the static...';
          bio.value = bioVal || '';
          bio.rows = 5; // fixed visual height
          bio.style.resize = 'vertical';
          bio.style.minHeight = '120px'; bio.style.maxHeight = '200px';
          bio.style.border = '0'; bio.style.outline = 'none';
          bio.style.padding = '8px 10px'; bio.style.color = '#eaf6ff';
          bio.style.background = 'transparent'; bio.style.width = '100%';
          bio.oninput = () => { bioVal = String(bio.value || ''); setDirty(true); };
          try { bio.id = 'settings-bio'; bioLbl.htmlFor = 'settings-bio'; } catch (_) {}
          bioWrap.appendChild(bio);
          bioRow.appendChild(bioLbl); bioRow.appendChild(bioWrap);
          contentWrap.appendChild(bioRow);
          try { wireFocusHighlight(bio, bioWrap); } catch (_) {}

          // Save/Cancel actions
          const actions = document.createElement('div');
          actions.style.display = 'flex'; actions.style.gap = '10px'; actions.style.justifyContent = 'flex-end';
          const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save';
          const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel';
          [saveBtn, cancelBtn].forEach(b => { b.style.cursor = 'pointer'; b.style.userSelect = 'none'; b.style.borderRadius = '10px'; b.style.padding = '8px 12px'; b.style.fontWeight = '600'; b.style.fontSize = '14px'; b.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.12) 0%, rgba(10,16,22,0.08) 100%)'; b.style.color = '#dff1ff'; b.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.60))'; b.style.boxShadow = 'inset 0 0 14px rgba(40,100,200,0.12), 0 0 16px rgba(120,170,255,0.22)'; });
          saveBtn.onclick = async () => {
            // TODO: wire to server profile update once nickname APIs exist
            // For now, store locally to avoid data loss between tab switches
            try { LS.setItem('draft:nickname', nicknameVal || ''); LS.setItem('draft:bio', bioVal || ''); } catch (_) {}
            setDirty(false);
          };
          cancelBtn.onclick = () => {
            // Revert fields from last saved draft
            try { nicknameVal = LS.getItem('draft:nickname', '') || ''; bioVal = LS.getItem('draft:bio', '') || ''; } catch (_) {}
            render(); setDirty(false);
          };
          actions.appendChild(cancelBtn); actions.appendChild(saveBtn);
          contentWrap.appendChild(actions);
        }
      } else if (tab === 'Display') {
        const sec = makeSection('Display', 'Theme and rendering.');
        // Insert Reset button into the Display section header (overlay)
        try {
          const hdr = sec.firstChild;
          if (hdr) {
            hdr.style.display = 'flex';
            hdr.style.alignItems = 'center';
            hdr.style.justifyContent = 'space-between';
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
              const OPDBG = true; const MMAX = 2.5; const defMult = 2.125;
              try { sel.value = 'dark'; LS.setItem('theme', 'dark'); window.setTheme && window.setTheme('dark'); } catch (_) {}
              try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: 1, hue: 210, intensity: 60, opacityMult: defMult }); } catch (_) {}
              try { fsRng.value = '100'; fsVal.textContent = '100%'; fsRng.title = '100%'; } catch (_) {}
              try { hueRng.value = '210'; hueVal.textContent = '210'; hueRng.title = '210'; } catch (_) {}
              try { inRng.value = '60'; inVal.textContent = '60'; inRng.title = '60'; } catch (_) {}
              try { localStorage.setItem('ui_font_scale', '1'); } catch (_) {}
              try { localStorage.setItem('ui_hue', '210'); } catch (_) {}
              try { localStorage.setItem('ui_intensity', '60'); } catch (_) {}
              const p = Math.round((defMult / MMAX) * 100);
              try { opRng.value = String(p); opVal.textContent = `${p}%`; opRng.title = `${p}%`; } catch (_) {}
              if (OPDBG) {
                try {
                  const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
                  console.debug(`[opacity] reset(overlay) css=${css} p=${p} mult=${defMult}`);
                } catch (_) {}
              }
            };
            hdr.appendChild(resetBtn);
          }
        } catch (_) {}
        contentWrap.appendChild(sec);
        const themeRow = document.createElement('div');
        themeRow.style.display = 'flex'; themeRow.style.alignItems = 'center'; themeRow.style.gap = '8px'; themeRow.style.marginBottom = '8px';
        const lbl = document.createElement('label'); lbl.textContent = 'Theme:';
        const sel = document.createElement('select');
        // Build theme selector
        ;['dark','light'].forEach((opt) => { const o = document.createElement('option'); o.value = opt; o.textContent = opt; sel.appendChild(o); });
        try {
          const saved = LS.getItem('theme', null);
          if (saved) sel.value = saved;
          if (window.setTheme) window.setTheme(sel.value || saved || 'dark');
        } catch (_) {}
        sel.onchange = () => {
          try { LS.setItem('theme', sel.value); } catch (_) {}
          try { window.setTheme && window.setTheme(sel.value); } catch (_) {}
        };
        themeRow.appendChild(lbl); themeRow.appendChild(sel); contentWrap.appendChild(themeRow);

        // Font Size slider (root rem scale)
        const fsRow = document.createElement('div');
        fsRow.style.display = 'flex'; fsRow.style.alignItems = 'center'; fsRow.style.gap = '8px'; fsRow.style.marginBottom = '8px';
        const fsLbl = document.createElement('label'); fsLbl.textContent = 'Font Size:'; fsLbl.style.minWidth = '140px';
        const fsRng = document.createElement('input'); fsRng.type = 'range'; fsRng.min = '80'; fsRng.max = '120'; fsRng.step = '1'; fsRng.style.flex = '1'; fsRng.id = 'settings-ui-fontscale-ovl';
        const fsVal = document.createElement('span'); fsVal.style.width = '46px'; fsVal.style.textAlign = 'right'; fsVal.style.color = '#ccc'; fsVal.id = 'settings-ui-fontscale-ovl-val';
        try {
          let scale = parseFloat(localStorage.getItem('ui_font_scale'));
          if (!Number.isFinite(scale) || scale <= 0) scale = 1;
          const p = Math.max(80, Math.min(120, Math.round(scale * 100)));
          fsRng.value = String(p);
          fsVal.textContent = `${p}%`; fsRng.title = `${p}%`;
        } catch (_) {}
        fsRng.oninput = () => {
          const p = Math.max(80, Math.min(120, Math.round(parseFloat(fsRng.value) || 100)));
          if (String(p) !== fsRng.value) fsRng.value = String(p);
          const scale = p / 100;
          fsVal.textContent = `${p}%`; fsRng.title = `${p}%`;
          try { console.debug(`[display] fontScale(overlay) p=${p} scale=${scale}`); } catch (_) {}
          try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: scale }); } catch (_) {}
          try { localStorage.setItem('ui_font_scale', String(scale)); } catch (_) {}
        };
        fsRow.appendChild(fsLbl); fsRow.appendChild(fsRng); fsRow.appendChild(fsVal);
        contentWrap.appendChild(fsRow);

        // Hue slider
        const hueRow = document.createElement('div');
        hueRow.style.display = 'flex'; hueRow.style.alignItems = 'center'; hueRow.style.gap = '8px'; hueRow.style.marginBottom = '8px';
        const hueLbl = document.createElement('label'); hueLbl.textContent = 'Hue:'; hueLbl.style.minWidth = '140px';
        const hueRng = document.createElement('input'); hueRng.type = 'range'; hueRng.min = '0'; hueRng.max = '360'; hueRng.step = '1'; hueRng.style.flex = '1'; hueRng.id = 'settings-ui-hue-ovl';
        const hueVal = document.createElement('span'); hueVal.style.width = '46px'; hueVal.style.textAlign = 'right'; hueVal.style.color = '#ccc'; hueVal.id = 'settings-ui-hue-ovl-val';
        try {
          let hue = parseFloat(localStorage.getItem('ui_hue'));
          if (!Number.isFinite(hue)) hue = 210;
          const p = Math.max(0, Math.min(360, Math.round(hue)));
          hueRng.value = String(p);
          hueVal.textContent = `${p}`; hueRng.title = `${p}`;
        } catch (_) {}
        hueRng.oninput = () => {
          const p = Math.max(0, Math.min(360, Math.round(parseFloat(hueRng.value) || 0)));
          if (String(p) !== hueRng.value) hueRng.value = String(p);
          hueVal.textContent = `${p}`; hueRng.title = `${p}`;
          try { console.debug(`[display] hue(overlay) p=${p}`); } catch (_) {}
          try { window.UITheme && window.UITheme.applyDynamicTheme({ hue: p }); } catch (_) {}
          try { localStorage.setItem('ui_hue', String(p)); } catch (_) {}
        };
        hueRow.appendChild(hueLbl); hueRow.appendChild(hueRng); hueRow.appendChild(hueVal);
        contentWrap.appendChild(hueRow);

        // Intensity slider
        const inRow = document.createElement('div');
        inRow.style.display = 'flex'; inRow.style.alignItems = 'center'; inRow.style.gap = '8px'; inRow.style.marginBottom = '8px';
        const inLbl = document.createElement('label'); inLbl.textContent = 'Intensity:'; inLbl.style.minWidth = '140px';
        const inRng = document.createElement('input'); inRng.type = 'range'; inRng.min = '0'; inRng.max = '100'; inRng.step = '1'; inRng.style.flex = '1'; inRng.id = 'settings-ui-intensity-ovl';
        const inVal = document.createElement('span'); inVal.style.width = '46px'; inVal.style.textAlign = 'right'; inVal.style.color = '#ccc'; inVal.id = 'settings-ui-intensity-ovl-val';
        try {
          let intensity = parseFloat(localStorage.getItem('ui_intensity'));
          if (!Number.isFinite(intensity)) intensity = 60;
          const p = Math.max(0, Math.min(100, Math.round(intensity)));
          inRng.value = String(p);
          inVal.textContent = `${p}`; inRng.title = `${p}`;
        } catch (_) {}
        inRng.oninput = () => {
          const p = Math.max(0, Math.min(100, Math.round(parseFloat(inRng.value) || 0)));
          if (String(p) !== inRng.value) inRng.value = String(p);
          inVal.textContent = `${p}`; inRng.title = `${p}`;
          try { console.debug(`[display] intensity(overlay) p=${p}`); } catch (_) {}
          try { window.UITheme && window.UITheme.applyDynamicTheme({ intensity: p }); } catch (_) {}
          try { localStorage.setItem('ui_intensity', String(p)); } catch (_) {}
        };
        inRow.appendChild(inLbl); inRow.appendChild(inRng); inRow.appendChild(inVal);
        contentWrap.appendChild(inRow);

        // Transparency slider
        const opRow = document.createElement('div');
        opRow.style.display = 'flex'; opRow.style.alignItems = 'center'; opRow.style.gap = '8px'; opRow.style.marginBottom = '8px';
        const opLbl = document.createElement('label'); opLbl.textContent = 'Transparency:'; opLbl.style.minWidth = '140px';
        const opRng = document.createElement('input'); opRng.type = 'range'; opRng.min = '0'; opRng.max = '100'; opRng.step = '1'; opRng.style.flex = '1'; opRng.id = 'settings-ui-opacity-ovl';
        const opVal = document.createElement('span'); opVal.style.width = '46px'; opVal.style.textAlign = 'right'; opVal.style.color = '#ccc'; opVal.id = 'settings-ui-opacity-ovl-val';
        try {
          const OPDBG = true; const MMAX = 2.5;
          let raw = null; try { raw = localStorage.getItem('ui_opacity_mult'); } catch (_) {}
          let ns = null; try { ns = LS.getItem('ui_opacity_mult', null); } catch (_) {}
          let mult; let p;
          if (raw != null || ns != null) {
            mult = parseFloat(ns != null ? ns : raw);
            if (!Number.isFinite(mult) || mult < 0) mult = 1;
            p = Math.max(0, Math.min(100, Math.round((mult / MMAX) * 100)));
          } else {
            p = 85; // default 85%
            mult = (p / 100) * MMAX;
            try { LS.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
            try { localStorage.setItem('ui_opacity_mult', String(mult)); } catch (_) {}
          }
          opRng.value = String(p);
          const pct = String(p) + '%';
          opVal.textContent = pct; opRng.title = pct;
          const multClamped = (p / 100) * MMAX;
          document.documentElement.style.setProperty('--ui-opacity-mult', String(multClamped));
          if (OPDBG) {
            try {
              const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
              console.debug(`[opacity] display-tab-init(overlay) css=${css} p=${p} multClamped=${multClamped} rawLS=${raw}`);
            } catch (_) {}
          }
        } catch (_) {}
        opRng.oninput = () => {
          const OPDBG = true; const MMAX = 2.5;
          const p = Math.max(0, Math.min(100, Math.round(parseFloat(opRng.value) || 0)));
          if (String(p) !== opRng.value) opRng.value = String(p);
          const mult = (p / 100) * MMAX;
          const pct = String(p) + '%';
          opVal.textContent = pct; opRng.title = pct;
          try { window.UITheme && window.UITheme.applyDynamicTheme({ opacityMult: mult }); } catch (_) {}
          if (OPDBG) {
            try {
              const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-opacity-mult').trim();
              console.debug(`[opacity] slider(overlay) css=${css} p=${p} mult=${mult}`);
            } catch (_) {}
          }
        };
        opRow.appendChild(opLbl); opRow.appendChild(opRng); opRow.appendChild(opVal);
        contentWrap.appendChild(opRow);

        // Reset button moved to section header (see above)
      } else if (tab === 'Sound')  {
        contentWrap.appendChild(makeSection('Sound Mixer', ''));
        // Space between section title and knobs (increase spacing to 1rem)
        { const spacer = document.createElement('div'); spacer.style.height = '1rem'; contentWrap.appendChild(spacer); }
        // Volume knobs (smaller)
        contentWrap.appendChild(makeVolumeKnobsGrid());
        // Mark dirty when user adjusts any knob
        try {
          if (volAdjustHandler) window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
          volAdjustHandler = (e) => { if (e && e.detail && e.detail.adjusting) setDirty(true); };
          window.addEventListener('ui:volume:adjusting', volAdjustHandler);
        } catch (_) {}
        const spacer = document.createElement('div'); spacer.style.height = '12px'; contentWrap.appendChild(spacer);
        // Notifications (style description to match top modal tagline)
        {
          const sec = makeSection('Notifications', 'Choose which alerts to receive.');
          try {
            const desc = sec.children && sec.children[1];
            if (desc) {
              desc.style.fontSize = '13px';
              desc.style.opacity = '0.9';
              desc.style.margin = '0 0 10px 0';
              desc.style.color = 'var(--ui-bright, #dff1ff)';
              desc.style.userSelect = 'none';
            }
          } catch (_) {}
          contentWrap.appendChild(sec);
        }
        contentWrap.appendChild(makeCheckboxRow('Player joins/leaves lobby/room', 'notif_playerJoinLeave', 'ui:notif:playerJoinLeave'));
        contentWrap.appendChild(makeCheckboxRow('Friend joins/leaves server/lobby/room', 'notif_friendJoinLeave', 'ui:notif:friendJoinLeave'));
        contentWrap.appendChild(makeCheckboxRow('Public game created', 'notif_publicGameCreated', 'ui:notif:publicGameCreated'));
        contentWrap.appendChild(makeCheckboxRow('Friend game created', 'notif_friendGameCreated', 'ui:notif:friendGameCreated'));
        contentWrap.appendChild(makeCheckboxRow('New lobby chat message', 'notif_lobbyChat', 'ui:notif:lobbyChat'));
        contentWrap.appendChild(makeCheckboxRow('New game chat message', 'notif_gameChat', 'ui:notif:gameChat'));
        contentWrap.appendChild(makeCheckboxRow('@Mention', 'notif_mention', 'ui:notif:mention'));
      } else if (tab === 'Controls') {
        contentWrap.appendChild(makeSection('Controls', 'Keybinds (coming soon).'));
        contentWrap.appendChild(makeNote('Keybinding editor will appear here.'));
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
      try { if (volAdjustHandler) window.removeEventListener('ui:volume:adjusting', volAdjustHandler); } catch (_) {}
      // Clean up our mount layer
      try { const m = document.getElementById('settings-overlay-root'); if (m && m.parentNode) m.parentNode.removeChild(m); } catch (_) {}
      try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
    };

    // Resolve auth, drafts, and server profile, then render
    (async () => {
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
      render();
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
