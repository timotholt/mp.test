import { bindRangeToVolume, getVolume, setVolume, DEFAULT_WHEEL_STEP } from '../core/volume.js';

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

  // Keep Settings master volume UI in sync with external changes (e.g., canvas slider)
  window.addEventListener('ui:volume', (e) => {
    try {
      const panel = document.getElementById('settings-panel');
      if (!panel || panel.style.display === 'none') return;
      const rng = panel.querySelector('#settings-master-volume');
      const val = panel.querySelector('#settings-master-volume-val');
      if (!rng) return;
      const v = (e && e.detail && typeof e.detail.volume === 'number') ? e.detail.volume : window.__volume;
      const clamped = Math.max(0, Math.min(1, v));
      rng.value = String(clamped);
      const pct = String(Math.round(clamped * 100)) + '%';
      rng.title = pct; if (val) val.textContent = pct;
    } catch (_) {}
  });

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
      content.appendChild(makeRow('Display Name', makeInput('text', localStorage.getItem('name') || '')));
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
      const saved = localStorage.getItem('theme');
      if (saved) sel.value = saved;
      if (window.setTheme) window.setTheme(sel.value || saved || 'dark');
    } catch (_) {}
    sel.onchange = () => {
      try { localStorage.setItem('theme', sel.value); } catch (_) {}
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
  i.onchange = () => { if (type === 'text') try { localStorage.setItem('name', i.value || ''); } catch (_) {} };
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
  // Use shared utility for master volume only
  if (storageKey === 'volume') {
    try {
      const init = getVolume();
      rng.value = String(init);
      // Ensure runtime state is aligned but don't emit yet
      setVolume(init, { silent: true });
      const pct = String(Math.round(init * 100)) + '%';
      val.textContent = pct; rng.title = pct;
    } catch (_) {}
    // Delegate input, wheel, and external sync to utility
    bindRangeToVolume(rng, {
      withWheel: true,
      emitOnInit: false,
      onRender: (v) => {
        try {
          const pct = String(Math.round(v * 100)) + '%';
          val.textContent = pct; rng.title = pct;
        } catch (_) {}
      }
    });
    row.appendChild(lbl); row.appendChild(rng); row.appendChild(val);
    return row;
  }
  try {
    const saved = parseFloat(localStorage.getItem(storageKey));
    const live = (typeof window[windowVarName] === 'number') ? window[windowVarName] : NaN;
    const fallback = (storageKey === 'volume' ? 1 : 1);
    const v = Number.isFinite(live) ? live : (Number.isFinite(saved) ? saved : fallback);
    rng.value = String(Math.max(0, Math.min(1, v)));
    window[windowVarName] = parseFloat(rng.value);
    const pct = String(Math.round(window[windowVarName] * 100)) + '%'; val.textContent = pct; rng.title = pct;
    if (eventName === 'ui:volume') {
      window.dispatchEvent(new CustomEvent(eventName, { detail: { volume: window[windowVarName] } }));
    }
  } catch (_) { rng.value = (window[windowVarName] ?? 1).toString(); const pct = String(Math.round(parseFloat(rng.value) * 100)) + '%'; val.textContent = pct; rng.title = pct; }
  rng.oninput = () => {
    try { localStorage.setItem(storageKey, rng.value); } catch (_) {}
    try {
      window[windowVarName] = parseFloat(rng.value);
      const val2 = window[windowVarName];
      if (eventName === 'ui:volume') {
        window.dispatchEvent(new CustomEvent(eventName, { detail: { volume: val2 } }));
      } else {
        window.dispatchEvent(new CustomEvent(eventName, { detail: { volume: val2 } }));
      }
      const pct = String(Math.round(val2 * 100)) + '%'; val.textContent = pct; rng.title = pct;
    } catch (_) {}
  };
  // Mouse wheel support: scroll up increases, down decreases
  rng.addEventListener('wheel', (e) => {
    try {
      e.preventDefault();
      const step = parseFloat(rng.step) || DEFAULT_WHEEL_STEP;
      const dir = e.deltaY < 0 ? 1 : -1;
      const cur = parseFloat(rng.value);
      const next = Math.max(0, Math.min(1, cur + dir * step));
      if (next !== cur) { rng.value = String(next); rng.oninput(); }
    } catch (_) {}
  }, { passive: false });
  row.appendChild(lbl); row.appendChild(rng); row.appendChild(val);
  return row;
}

function makeCheckboxRow(labelText, storageKey, eventName) {
  const row = document.createElement('div');
  row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px'; row.style.marginBottom = '6px';
  const cb = document.createElement('input'); cb.type = 'checkbox';
  try { cb.checked = localStorage.getItem(storageKey) === '1'; } catch (_) { cb.checked = false; }
  const lbl = document.createElement('label'); lbl.textContent = labelText;
  cb.onchange = () => {
    try { localStorage.setItem(storageKey, cb.checked ? '1' : '0'); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent(eventName, { detail: { enabled: cb.checked } })); } catch (_) {}
  };
  row.appendChild(cb); row.appendChild(lbl);
  return row;
}

// Optional global exposure for quick access/debug
window.presentSettingsPanel = presentSettingsPanel;
window.closeSettingsPanel = closeSettingsPanel;
window.setSettingsAuth = setSettingsAuth;
