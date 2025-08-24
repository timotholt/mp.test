import { bindRange, getValue, setValue, DEFAULT_WHEEL_STEP } from '../core/audio/volumeGroupManager.js';
import * as LS from '../core/localStorage.js';

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
  panel.style.background = 'rgba(0,0,0,0.9)';
  panel.style.color = 'var(--ui-fg, #eee)';
  panel.style.border = '1px solid #444';
  panel.style.borderRadius = '8px';
  panel.style.padding = '10px';
  panel.style.width = '420px';
  panel.style.maxHeight = '72vh';
  panel.style.overflow = 'hidden';
  panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
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
  closeBtn.style.border = '1px solid #555';
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
  tabs.style.borderBottom = '1px solid #333';
  tabs.style.paddingBottom = '6px';
  panel.appendChild(tabs);

  // Content container (scrollable)
  const content = document.createElement('div');
  content.id = 'settings-content';
  content.style.marginTop = '8px';
  content.style.overflow = 'auto';
  content.style.maxHeight = '58vh';
  content.style.paddingRight = '6px';
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
    btn.style.border = '1px solid #444';
    btn.style.background = (__settingsState.activeTab === name) ? '#2a2a2a' : 'transparent';
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
    content.appendChild(makeSection('Profile', 'Name, avatar, and bio.'));
    if (!__settingsState.accountEnabled) {
      content.appendChild(makeNote('Please login to a game server first to change your profile settings.'));
    } else {
      content.appendChild(makeRow('Display Name', makeInput('text', LS.getItem('name', '') || '')));
    }
  } else if (tab === 'Display') {
    content.appendChild(makeSection('Display', 'Theme and rendering.'));
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
  } else if (tab === 'Sound') {
    content.appendChild(makeSection('Sound', 'Configure audio volumes and notifications.'));

    // Volumes
    content.appendChild(makeVolumeRow('Master volume', 'volume', '__volume', 'ui:volume'));
    content.appendChild(makeVolumeRow('Game volume', 'volume_game', '__volumeGame', 'ui:volume:game'));
    content.appendChild(makeVolumeRow('Music volume', 'volume_music', '__volumeMusic', 'ui:volume:music'));
    content.appendChild(makeVolumeRow('Voice volume', 'volume_voice', '__volumeVoice', 'ui:volume:voice'));

    // Spacer above Notifications
    { const spacer = document.createElement('div'); spacer.style.height = '12px'; content.appendChild(spacer); }
    // Notifications
    content.appendChild(makeSection('Notifications', 'Choose which alerts to receive.'));
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
  const d = document.createElement('div'); d.textContent = desc; d.style.color = '#bbb'; d.style.marginBottom = '8px';
  wrap.appendChild(t); wrap.appendChild(d);
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
  const lbl = document.createElement('label'); lbl.textContent = labelText;
  cb.onchange = () => {
    try { LS.setItem(storageKey, cb.checked ? '1' : '0'); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent(eventName, { detail: { enabled: cb.checked } })); } catch (_) {}
  };
  row.appendChild(cb); row.appendChild(lbl);
  return row;
}

// Optional global exposure for quick access/debug
window.presentSettingsPanel = presentSettingsPanel;
window.closeSettingsPanel = closeSettingsPanel;
window.setSettingsAuth = setSettingsAuth;
