// Minimal Colyseus client (Vite) - plain JS
// Connects, prompts for gameId and room password, and sends arrow-key movement inputs.

import * as Colyseus from 'colyseus.js';
import OverlayManager, { PRIORITY } from './core/overlayManager.js';
import { presentRoomCreateModal } from './modals/roomCreate.js';
import { presentLoginModal, showLoginBackdrop } from './modals/login.js';
import { presentRoomPromptPassword } from './modals/roomPromptPassword.js';
import { presentStartGameConfirm } from './modals/startGameConfirm.js';
import { presentFCLSelectModal } from './modals/factionClassLoadout.js';
import { presentSettingsPanel } from './modals/settings.js';
import { APP_STATES, makeScreen, setRoute, toggleRenderer } from './core/router.js';
import { createChatTabs } from './core/chatTabs.js';
import { getVolume, setVolume, bindRangeToVolume, DEFAULT_WHEEL_STEP } from './core/volume.js';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const log = (line) => { logEl.textContent += line + '\n'; };

// -------------------- Micro Router (plain DOM) --------------------
// Router extracted to './core/router.js'. See imports above.

// Derive a stable gameId from room name and host (URL override supported via ?gameId= or #gameId=)
function deriveGameId(name, hostName) {
  try {
    const params = new URLSearchParams(location.search || '');
    const hashMatch = (location.hash || '').match(/gameId=([A-Za-z0-9_-]+)/);
    const forced = params.get('gameId') || (hashMatch ? hashMatch[1] : '');
    if (forced) return String(forced).slice(0, 48);
  } catch (_) {}
  const base = String(name || 'game')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'game';
  const host = String(hostName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 8);
  return [base, host].filter(Boolean).join('-');
}

// -------------------- Room UI Helpers --------------------
function setReadyButtonUI(isReady) {
  if (!roomReadyBtn) return;
  roomReadyBtn.dataset.ready = isReady ? 'true' : 'false';
  // Checkbox-style labels: empty = not ready, filled = ready
  roomReadyBtn.textContent = isReady ? '☑ Ready' : '☐ Ready';
}
// Expose for modal modules to sync button state on cancel/unready
window.setReadyButtonUI = setReadyButtonUI;
function bindRoomUIEventsOnce() {
  if (!room || roomUIBound) return;
  roomUIBound = true;
  try {
    room.state.players.onAdd((player) => {
      // Re-render players list and refresh start confirm (if shown)
      renderRoomPlayers();
      // Server will push 'showGameConfirm' with fresh snapshot; no local modal refresh needed
    });
    room.state.players.onRemove(() => {
      renderRoomPlayers();
      // Server will push 'showGameConfirm' updates if needed
    });
  } catch (_) {}
  try {
    room.state.log.onAdd((value) => {
      appendChatLine(String(value));
    });
  } catch (_) {}
}

function renderRoomPlayers() {
  if (!roomPlayersEl || !room) return;
  try {
    roomPlayersEl.innerHTML = '';
    // MapSchema supports forEach
    room.state.players.forEach((p, id) => {
      const line = document.createElement('div');
      const nm = p.name || 'Hero';
      const off = p.online === false ? ' (offline)' : '';
      line.textContent = `${nm}${off}`;
      roomPlayersEl.appendChild(line);
    });
  } catch (_) {}
}

// Snapshot current players for modals/UI that need a serializable view
function getPlayersSnapshot() {
  const arr = [];
  try {
    if (!room || !room.state || !room.state.players) return arr;
    room.state.players.forEach((p, id) => {
      arr.push({ id, name: p?.name || 'Hero', ready: !!p?.ready, online: p?.online !== false });
    });
  } catch (_) {}
  return arr;
}

function refreshRoomChat() {
  if (!room) return;
  try {
    const arr = room.state.log || [];
    const start = Math.max(0, arr.length - 100);
    // Clear current Game tab in tabbed UI if present; else clear legacy list
    if (roomChat && typeof roomChat.clear === 'function') {
      roomChat.clear('Game');
    } else if (roomChatListEl) {
      roomChatListEl.innerHTML = '';
    }
    for (let i = start; i < arr.length; i++) {
      appendChatLine(String(arr[i]));
    }
  } catch (_) {}
}

function appendChatLine(line) {
  try {
    if (roomChat && typeof roomChat.appendMessage === 'function') {
      roomChat.appendMessage('Game', String(line));
      return;
    }
  } catch (_) {}
  // Fallback to legacy DOM list if present
  if (!roomChatListEl) return;
  const div = document.createElement('div');
  div.textContent = String(line);
  roomChatListEl.appendChild(div);
  roomChatListEl.scrollTop = roomChatListEl.scrollHeight;
}
// Routing handled by imported setRoute/toggleRenderer in './core/router.js'

// Register screens
let lobbyPollId = null;
let roomsListEl = null;
let createRoomBtn = null;
// ROOM UI refs
let roomPlayersEl = null;
let roomChatListEl = null;
let roomChatInputEl = null;
let roomReadyBtn = null;
let roomUIBound = false;
// Chat components
let lobbyChat = null;
let roomChat = null;

makeScreen(APP_STATES.LOGIN, (el) => {
  // Clear screen content; we use a modal over the full-screen renderer backdrop
  el.innerHTML = '';
  // Ensure any lingering lobby modal is dismissed when returning to login
  try { OverlayManager.dismiss('LOBBY_MODAL'); } catch (_) {}
  try { OverlayManager.dismiss('ROOM_MODAL'); } catch (_) {}
  showLoginBackdrop();
  presentLoginModal();
});

makeScreen(APP_STATES.LOBBY, (el) => {
  // Only present Lobby overlay when this route becomes active
  el.innerHTML = '';
  el.update = () => {
    try { OverlayManager.present({ id: 'LOBBY_MODAL', priority: PRIORITY.MEDIUM, text: 'Lobby', actions: [], blockInput: true, external: true }); } catch (_) {}
    const overlay = document.getElementById('overlay');
    const content = overlay ? overlay.querySelector('#overlay-content') : null;
    if (content) {
      content.innerHTML = '';
      const header = document.createElement('div');
      header.textContent = 'Lobby';
      const actions = document.createElement('div');
      createRoomBtn = document.createElement('button');
      createRoomBtn.textContent = 'Create Private Room';
      actions.appendChild(createRoomBtn);
      roomsListEl = document.createElement('div');
      roomsListEl.id = 'lobby-rooms';
      roomsListEl.style.marginTop = '8px';
      // Tabbed chat UI (Lobby)
      lobbyChat = createChatTabs({
        mode: 'lobby',
        onJoinGame: async (roomId) => {
          try {
            const playerName = localStorage.getItem('name') || 'Hero';
            const rj = await client.joinById(String(roomId), { name: playerName });
            await afterJoin(rj);
          } catch (e) {
            const msg = (e && (e.message || e)) + '';
            if (msg.includes('password')) {
              presentRoomPromptPassword({
                roomName: String(roomId),
                onSubmit: async (pwd) => {
                  try {
                    const rj = await client.joinById(String(roomId), { name: localStorage.getItem('name') || 'Hero', roomPass: pwd || '' });
                    await afterJoin(rj);
                    return true;
                  } catch (err) {
                    const em = (err && (err.message || err)) + '';
                    if (em.includes('Invalid password')) return false;
                    throw new Error(typeof em === 'string' ? em : 'Join failed');
                  }
                },
                onCancel: () => {}
              });
            }
          }
        },
        onOpenLink: (href) => { try { window.open(href, '_blank'); } catch (_) {} }
      });
      content.appendChild(header);
      content.appendChild(actions);
      content.appendChild(roomsListEl);
      content.appendChild(lobbyChat.el);
      createRoomBtn.onclick = () => {
        presentRoomCreateModal({
          onSubmit: async ({ name, turnLength, roomPass, maxPlayers }) => {
            const cname = localStorage.getItem('name') || 'Hero';
            try {
              const newRoom = await client.create('nethack', {
                name,
                turnLength,
                roomPass,
                maxPlayers,
                private: !!roomPass,
                hostName: cname,
                gameId: deriveGameId(name, cname),
              });
              await afterJoin(newRoom);
            } catch (e) {
              console.warn('create failed', e);
            }
          }
        });
      };
    }
    startLobbyPolling();
  };
});

makeScreen(APP_STATES.ROOM, (el) => {
  // Render Room UI inside an overlay so it appears above the shade/canvas
  el.innerHTML = '';
  el.update = () => {
    try { OverlayManager.present({ id: 'ROOM_MODAL', priority: PRIORITY.MEDIUM, text: 'Room', actions: [], blockInput: true, external: true }); } catch (_) {}
    const overlay = document.getElementById('overlay');
    const content = overlay ? overlay.querySelector('#overlay-content') : null;
    if (!content) return;
    content.innerHTML = '';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Lobby';
    backBtn.style.marginRight = '8px';
    backBtn.onclick = () => { try { leaveRoomToLobby(); } catch (_) {} };
    header.appendChild(backBtn);
    const title = document.createElement('div');
    title.textContent = 'Room';
    header.appendChild(title);
    roomReadyBtn = document.createElement('button');
    setReadyButtonUI(false); // default to not ready on room entry
    roomReadyBtn.onclick = () => {
      const now = roomReadyBtn.dataset.ready !== 'true';
      setReadyButtonUI(now);
      try { if (room) room.send('setReady', { ready: now }); } catch (_) {}
      if (now) { try { appendChatLine('You are ready'); } catch (_) {} }
      if (!now) { try { appendChatLine('You are not ready'); } catch (_) {} }
    };
    header.appendChild(roomReadyBtn);

    const players = document.createElement('div');
    players.id = 'room-players';
    const playersTitle = document.createElement('div');
    playersTitle.textContent = 'Players';
    playersTitle.style.marginTop = '8px';
    roomPlayersEl = document.createElement('div');
    roomPlayersEl.id = 'room-players-list';
    // Tabbed chat UI (Room/Game)
    roomChat = createChatTabs({
      mode: 'game',
      onJoinGame: async (roomId) => {
        try {
          const playerName = localStorage.getItem('name') || 'Hero';
          const rj = await client.joinById(String(roomId), { name: playerName });
          await afterJoin(rj);
        } catch (e) {
          const msg = (e && (e.message || e)) + '';
          if (msg.includes('password')) {
            presentRoomPromptPassword({
              roomName: String(roomId),
              onSubmit: async (pwd) => {
                try {
                  const rj = await client.joinById(String(roomId), { name: localStorage.getItem('name') || 'Hero', roomPass: pwd || '' });
                  await afterJoin(rj);
                  return true;
                } catch (err) {
                  const em = (err && (err.message || err)) + '';
                  if (em.includes('Invalid password')) return false;
                  throw new Error(typeof em === 'string' ? em : 'Join failed');
                }
              },
              onCancel: () => {}
            });
          }
        }
      },
      onOpenLink: (href) => { try { window.open(href, '_blank'); } catch (_) {} }
    });

    content.appendChild(header);
    content.appendChild(players);
    players.appendChild(playersTitle);
    players.appendChild(roomPlayersEl);
    content.appendChild(roomChat.el);

    try { bindRoomUIEventsOnce(); } catch (_) {}
    try { renderRoomPlayers(); } catch (_) {}
    try { refreshRoomChat(); } catch (_) {}
  };
});

makeScreen(APP_STATES.GAMEPLAY_ACTIVE, (el) => { el.textContent = 'Gameplay Active'; });
makeScreen(APP_STATES.GAMEPLAY_PAUSED, (el) => { el.textContent = 'Gameplay Paused'; });


// -------------------- Always-on Canvas Dimming Shade & UI Chrome --------------------
function ensureScreenShade() {
  let shade = document.getElementById('screen-shade');
  if (!shade) {
    shade = document.createElement('div');
    shade.id = 'screen-shade';
    shade.style.position = 'fixed';
    shade.style.inset = '0';
    shade.style.background = 'rgba(0,0,0,0.5)';
    shade.style.zIndex = '2000'; // below overlay (9999), above canvas (1)
    shade.style.display = 'none';
    shade.style.pointerEvents = 'none';
    document.body.appendChild(shade);
  }
  return shade;
}

// Expose for router to use on initial navigation
window.ensureScreenShade = ensureScreenShade;

// Default route until server tells us otherwise (after shade is attached)
setRoute(APP_STATES.LOGIN);

// Lightweight theme support using CSS variables
function ensureThemeSupport() {
  if (document.getElementById('theme-style')) return;
  const st = document.createElement('style');
  st.id = 'theme-style';
  st.textContent = `:root{
    --ui-bg: rgba(0,0,0,0.8);
    --ui-fg: #fff;
    --ui-muted: #ccc;
    --ui-accent: #4caf50;
    --bar-bg: rgba(20,20,20,0.9);
    --banner-bg: rgba(32,32,32,0.95);
    --control-bg: rgba(0,0,0,0.6);
    --control-border: #444;
  }
  body, button, input, select, textarea {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }`;
  document.head.appendChild(st);
  window.setTheme = function(theme) {
    // Simple placeholder for future themes
    const dark = theme !== 'light';
    document.documentElement.style.setProperty('--ui-bg', dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)');
    document.documentElement.style.setProperty('--ui-fg', dark ? '#fff' : '#111');
    document.documentElement.style.setProperty('--ui-muted', dark ? '#ccc' : '#333');
    document.documentElement.style.setProperty('--bar-bg', dark ? 'rgba(20,20,20,0.9)' : 'rgba(240,240,240,0.9)');
    document.documentElement.style.setProperty('--banner-bg', dark ? 'rgba(32,32,32,0.95)' : 'rgba(250,250,250,0.95)');
    document.documentElement.style.setProperty('--control-bg', dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)');
    document.documentElement.style.setProperty('--control-border', dark ? '#444' : '#bbb');
  };
}

function ensureStatusBar() {
  let bar = document.getElementById('hover-status-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'hover-status-bar';
    bar.style.position = 'fixed';
    bar.style.left = '0';
    bar.style.right = '0';
    bar.style.top = '0';
    bar.style.height = '3em';
    bar.style.display = 'none';
    bar.style.alignItems = 'center';
    bar.style.justifyContent = 'space-between';
    bar.style.padding = '0 12px';
    bar.style.background = 'var(--bar-bg)';
    bar.style.color = 'var(--ui-fg)';
    // Keep status bar above overlays
    bar.style.zIndex = '30000';
    const left = document.createElement('div');
    left.id = 'status-left';
    left.textContent = 'FPS: -- | PING: --';
    const right = document.createElement('div');
    right.id = 'status-right';
    const gear = document.createElement('button');
    gear.textContent = '⚙️';
    gear.style.background = 'transparent';
    gear.style.border = 'none';
    gear.style.color = 'var(--ui-fg)';
    gear.style.fontSize = '1.2em';
    gear.style.cursor = 'pointer';
    gear.onclick = () => { try { presentSettingsPanel(); } catch (_) {} };
    right.appendChild(gear);
    bar.appendChild(left); bar.appendChild(right);
    document.body.appendChild(bar);

    let hideTimer = null;
    const requestHide = () => { if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { bar.style.display = 'none'; }, 3000); };
    window.addEventListener('mousemove', (e) => {
      if (e.clientY <= 8) { bar.style.display = 'flex'; requestHide(); }
    });
  }
  return bar;
}

function ensureFloatingControls() {
  let zoom = document.getElementById('zoom-controls');
  if (!zoom) {
    zoom = document.createElement('div');
    zoom.id = 'zoom-controls';
    zoom.style.position = 'fixed';
    zoom.style.left = '12px';
    zoom.style.bottom = '12px';
    // Keep zoom controls above overlays
    zoom.style.zIndex = '30001';
    zoom.style.background = 'var(--control-bg)';
    zoom.style.border = '1px solid var(--control-border)';
    zoom.style.borderRadius = '6px';
    zoom.style.padding = '6px';
    // Vertical layout: + on top, - on bottom
    zoom.style.display = 'flex';
    zoom.style.flexDirection = 'column';
    const zin = document.createElement('button'); zin.textContent = '+'; zin.style.marginBottom = '6px';
    const zout = document.createElement('button'); zout.textContent = '-';
    const applyZoom = (factor) => {
      try {
        if (window.radianceCascades && typeof window.radianceCascades.zoom === 'function') {
          window.radianceCascades.zoom(factor);
        } else {
          window.dispatchEvent(new CustomEvent('ui:zoom', { detail: { factor } }));
        }
      } catch (_) {}
    };
    zin.onclick = () => applyZoom(1.1);
    zout.onclick = () => applyZoom(0.9);
    zoom.appendChild(zin); zoom.appendChild(zout);
    document.body.appendChild(zoom);
  }

  let vol = document.getElementById('volume-control');
  if (!vol) {
    vol = document.createElement('div');
    vol.id = 'volume-control';
    vol.style.position = 'fixed';
    vol.style.right = '12px';
    vol.style.bottom = '12px';
    // Keep volume control above overlays
    vol.style.zIndex = '30001';
    // Minimal, unobtrusive by default; emphasize on hover
    vol.style.background = 'transparent';
    vol.style.border = '1px solid transparent';
    vol.style.borderRadius = '6px';
    vol.style.padding = '2px';
    vol.style.transition = 'height 120ms ease, width 120ms ease, background 120ms ease, border-color 120ms ease, padding 120ms ease';
    // Vertical slider container
    vol.style.display = 'flex';
    vol.style.flexDirection = 'column';
    vol.style.alignItems = 'flex-end';
    vol.style.justifyContent = 'center';
    // Size is controlled dynamically on hover
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '1';
    range.step = String(DEFAULT_WHEEL_STEP);
    // Make slider vertical (up = louder)
    range.style.position = 'absolute';
    range.style.left = 'calc(50% + 1px)';
    range.style.top = '50%';
    range.style.zIndex = '1';
    range.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
    range.style.transformOrigin = '50% 50%';
    range.style.height = '24px';
    range.style.margin = '0';
    range.style.transition = 'width 120ms ease';

    // Hover-driven collapse/expand
    const COLLAPSED_LEN = 36;   // short control when idle
    const EXPANDED_LEN = 165;   // tall control on hover
    function applyCollapsed() {
      try {
        vol.style.height = COLLAPSED_LEN + 'px';
        vol.style.width = 'auto';
        range.style.width = COLLAPSED_LEN + 'px';
        vol.style.background = 'transparent';
        vol.style.border = '1px solid var(--control-border)';
        vol.style.padding = '10px 4px';
        // Stack vertically when not extended
        vol.style.flexDirection = 'column';
        // Center contents in collapsed mode (expanded uses flex-end)
        vol.style.alignItems = 'center';
        // True center in collapsed column
        range.style.left = '50%';
        range.style.marginRight = '0';
        // Keep master column the same width as its holder so the track stays centered
        if (typeof masterCol !== 'undefined' && masterCol) masterCol.style.width = '24px';
        // Master adornments hidden when not extended
        if (masterLabel) masterLabel.style.display = 'none';
        if (masterVal) masterVal.style.display = 'none';
        if (masterHolder) masterHolder.style.height = COLLAPSED_LEN + 'px';
        // Hide toggle in collapsed state
        if (toggle) toggle.style.display = 'none';
      } catch (_) {}
    }
    function applyExpanded() {
      try {
        const extended = !!window.__volumeExtended;
        // Give extra height when extended to fit rows
        vol.style.height = (extended ? '200px' : (EXPANDED_LEN + 'px'));
        // Let content define width in both modes to share the same layout math
        vol.style.width = extended ? 'auto' : '24px';
        range.style.width = EXPANDED_LEN + 'px';
        vol.style.background = 'var(--control-bg)';
        vol.style.border = '1px solid var(--control-border)';
        // Narrow left/right padding (4px), with extra top/bottom
        vol.style.padding = '10px 4px';
        // Always use the 4-column layout rules; in single-hover, panel is hidden but layout matches
        vol.style.flexDirection = 'row';
        vol.style.alignItems = 'flex-end';
        // Avoid asymmetric margins so the slider stays visually centered
        // Restore the tiny subpixel nudge used by the 4-slider layout
        range.style.left = 'calc(50% + 1px)';
        range.style.marginRight = '0';
        if (masterHolder) masterHolder.style.height = EXPANDED_LEN + 'px';
        // Restore wider column in expanded view to match other sliders
        if (typeof masterCol !== 'undefined' && masterCol) masterCol.style.width = '40px';
        // Show Master adornments only in full extended mode
        if (masterLabel) masterLabel.style.display = extended ? '' : 'none';
        if (masterVal) masterVal.style.display = extended ? '' : 'none';
        // Show toggle when expanded
        if (toggle) { toggle.style.display = ''; try { positionToggle(); } catch (_) {} }
      } catch (_) {}
    }
    try { vol.addEventListener('mouseenter', applyExpanded); } catch (_) {}
    try { vol.addEventListener('mouseleave', () => { if (!window.__volumeAdjusting && !window.__volumeExtended) applyCollapsed(); }); } catch (_) {}
    // Ensure runtime state matches persisted value without emitting
    try { setVolume(getVolume(), { silent: true }); } catch (_) {}
    // Bind to shared volume utility
    bindRangeToVolume(range, {
      withWheel: true,
      emitOnInit: false,
      onRender: (v) => {
        try {
          const pct = String(Math.round(v * 100)) + '%';
          range.title = pct;
          // Update Master % readout when available
          if (typeof masterVal !== 'undefined' && masterVal) masterVal.textContent = pct;
        } catch (_) {}
      }
    });
    // We'll append the master range inside masterHolder after it's created to keep
    // all slider columns structurally identical (holder contains the input range).

    // Small toggle to expand into full set of sliders
    const toggle = document.createElement('button');
    toggle.textContent = '>';
    toggle.title = 'Show more volume controls';
    toggle.style.background = 'transparent';
    toggle.style.border = '1px solid var(--control-border)';
    toggle.style.borderRadius = '3px';
    toggle.style.color = 'var(--ui-fg)';
    toggle.style.cursor = 'pointer';
    toggle.style.fontSize = '10px';
    toggle.style.lineHeight = '10px';
    toggle.style.width = '16px';
    toggle.style.height = '16px';
    toggle.style.padding = '0';
    // Overlay the toggle on top of the track, only visible when expanded
    toggle.style.position = 'absolute';
    toggle.style.top = '14px'; // a couple extra pixels of space from top of slider
    toggle.style.right = 'auto'; // we'll position via left for centering
    toggle.style.zIndex = '5';
    toggle.style.display = 'none';
    // Insert so it is a child; absolute position will place it over the range
    vol.appendChild(toggle);

    // Shared helper: apply consistent styles to any volume column (Master/Game/Music/Voice)
    // This keeps layout and typography uniform without duplicating style code.
    function applyVolumeColStyles(col, holder, labelEl, valEl) {
      try {
        // Column container
        col.style.display = 'flex';
        col.style.flexDirection = 'column';
        col.style.alignItems = 'center';
        col.style.gap = '2px';
        col.style.width = '40px';
        // Label
        if (labelEl) {
          labelEl.style.fontSize = '11px';
          labelEl.style.color = 'var(--ui-fg)';
          labelEl.style.textAlign = 'center';
        }
        // Holder for rotated range
        if (holder) {
          holder.style.width = '24px';
          holder.style.height = EXPANDED_LEN + 'px';
          holder.style.display = 'flex';
          holder.style.alignItems = 'center';
          holder.style.justifyContent = 'center';
          holder.style.position = 'relative';
        }
        // Value text
        if (valEl) {
          valEl.style.fontSize = '11px';
          valEl.style.color = 'var(--ui-fg)';
          valEl.style.textAlign = 'center';
        }
      } catch (_) {}
    }

    // Master column: label, main vertical slider, % readout (shown only when extended)
    const masterCol = document.createElement('div');
    const masterLabel = document.createElement('div');
    masterLabel.textContent = 'Master';
    masterLabel.style.display = 'none';
    const masterHolder = document.createElement('div');
    applyVolumeColStyles(masterCol, masterHolder, masterLabel, null);
    // Place the primary range inside the master holder so Master column structure
    // matches Game/Music/Voice columns.
    masterHolder.appendChild(range);
    const masterVal = document.createElement('div');
    applyVolumeColStyles(masterCol, null, null, masterVal);
    masterVal.style.display = 'none';
    masterCol.appendChild(masterHolder);
    masterCol.appendChild(masterLabel);
    masterCol.appendChild(masterVal);
    vol.appendChild(masterCol);
    // Initialize Master % readout
    try { const v0 = getVolume(); masterVal.textContent = String(Math.round(v0 * 100)) + '%'; } catch (_) {}

    // Compact panel containing the rest of the volume sliders
    const panel = document.createElement('div');
    panel.id = 'volume-panel';
    panel.style.display = 'none';
    // Lay out sliders side-by-side
    panel.style.flexDirection = 'row';
    panel.style.alignItems = 'center';
    panel.style.gap = '2px';
    panel.style.padding = '0';
    panel.style.width = 'auto';
    panel.style.maxWidth = 'none';
    panel.style.flexWrap = 'nowrap';
    panel.style.marginLeft = '0';
    panel.style.boxSizing = 'border-box';

    const makeSmallRow = (labelText, storageKey, windowVarName, eventName, useMasterBinding) => {
      const row = document.createElement('div');
      const lbl = document.createElement('label'); lbl.textContent = labelText;
      // Fixed-size holder to constrain rotated range footprint
      const holder = document.createElement('div');
      // Apply shared column/label/holder styles for consistency
      applyVolumeColStyles(row, holder, lbl, null);
      const rng = document.createElement('input'); rng.type = 'range'; rng.min = '0'; rng.max = '1'; rng.step = String(DEFAULT_WHEEL_STEP);
      // Make these sliders vertical like the main one and absolutely center them
      rng.style.position = 'absolute';
      rng.style.left = 'calc(50% + 1px)';
      rng.style.top = '50%';
      rng.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
      rng.style.transformOrigin = '50% 50%';
      rng.style.height = '24px';
      rng.style.margin = '0';
      rng.style.transition = 'width 120ms ease';
      rng.style.width = EXPANDED_LEN + 'px';
      holder.appendChild(rng);
      const val = document.createElement('span');
      applyVolumeColStyles(row, null, null, val);

      if (useMasterBinding) {
        try {
          const init = getVolume();
          rng.value = String(init);
          const pct = String(Math.round(init * 100)) + '%';
          val.textContent = pct; rng.title = pct;
        } catch (_) {}
        bindRangeToVolume(rng, {
          withWheel: true,
          emitOnInit: false,
          onRender: (v) => {
            try { const pct = String(Math.round(v * 100)) + '%'; val.textContent = pct; rng.title = pct; } catch (_) {}
          }
        });
      } else {
        // Mirror settings.js behavior for non-master sliders
        try {
          const saved = parseFloat(localStorage.getItem(storageKey));
          const live = (typeof window[windowVarName] === 'number') ? window[windowVarName] : NaN;
          const fallback = 1;
          const v = Number.isFinite(live) ? live : (Number.isFinite(saved) ? saved : fallback);
          const clamped = Math.max(0, Math.min(1, v));
          rng.value = String(clamped);
          window[windowVarName] = clamped;
          const pct = String(Math.round(clamped * 100)) + '%'; val.textContent = pct; rng.title = pct;
        } catch (_) {}
        rng.oninput = () => {
          try { localStorage.setItem(storageKey, rng.value); } catch (_) {}
          try {
            window[windowVarName] = parseFloat(rng.value);
            const vv = window[windowVarName];
            window.dispatchEvent(new CustomEvent(eventName, { detail: { volume: vv } }));
            const pct = String(Math.round(vv * 100)) + '%'; val.textContent = pct; rng.title = pct;
          } catch (_) {}
        };
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
        // Listen for external changes (from Settings panel or other sources)
        try {
          const onExternal = (e) => {
            try {
              const v = (e && e.detail && typeof e.detail.volume === 'number') ? e.detail.volume : window[windowVarName];
              const clamped = Math.max(0, Math.min(1, v));
              rng.value = String(clamped);
              const pct = String(Math.round(clamped * 100)) + '%';
              val.textContent = pct; rng.title = pct;
            } catch (_) {}
          };
          window.addEventListener(eventName, onExternal);
        } catch (_) {}
      }

      row.appendChild(holder); row.appendChild(lbl); row.appendChild(val);
      return row;
    };

    // Build rows (Master is already present as the main vertical slider; avoid duplicating it here)
    panel.appendChild(makeSmallRow('Game', 'volume_game', '__volumeGame', 'ui:volume:game', false));
    panel.appendChild(makeSmallRow('Music', 'volume_music', '__volumeMusic', 'ui:volume:music', false));
    panel.appendChild(makeSmallRow('Voice', 'volume_voice', '__volumeVoice', 'ui:volume:voice', false));
    vol.appendChild(panel);

    function setExtended(on) {
      try {
        window.__volumeExtended = !!on;
        panel.style.display = on ? 'flex' : 'none';
        toggle.textContent = on ? '<' : '>';
        if (on) {
          applyExpanded(); try { positionToggle(); } catch (_) {}
        } else {
          if (!window.__volumeAdjusting) applyCollapsed();
        }
      } catch (_) {}
    }
    toggle.addEventListener('click', () => setExtended(!window.__volumeExtended));
    // Start collapsed; expand on hover only (until extended via >)
    applyCollapsed();
    document.body.appendChild(vol);

    // React to Settings slider adjustments by forcing expansion during drag
    try {
      const onAdjust = (e) => {
        try {
          const adj = !!(e && e.detail && e.detail.adjusting);
          window.__volumeAdjusting = adj;
          const extended = !!window.__volumeExtended;
          if (adj || extended) applyExpanded(); else applyCollapsed();
          try { positionToggle(); } catch (_) {}
        } catch (_) {}
      };
      window.addEventListener('ui:volume:adjusting', onAdjust);
    } catch (_) {}

    // Position the toggle centered over the Master slider
    function positionToggle() {
      try {
        if (!toggle || !masterHolder) return;
        const volRect = vol.getBoundingClientRect();
        const holderRect = masterHolder.getBoundingClientRect();
        const left = Math.round((holderRect.left - volRect.left) + (holderRect.width / 2) - (toggle.offsetWidth / 2));
        const gutter = 4; // small spacing from the holder's top edge
        const top = Math.round((holderRect.top - volRect.top) + gutter);
        // Clamp inside container so moving cursor to the button doesn't exit hover area
        const maxLeft = Math.max(0, (vol.clientWidth - toggle.offsetWidth - 2));
        const maxTop = Math.max(0, (vol.clientHeight - toggle.offsetHeight - 2));
        const clampedLeft = Math.max(2, Math.min(maxLeft, left));
        const clampedTop = Math.max(2, Math.min(maxTop, top));
        toggle.style.left = clampedLeft + 'px';
        toggle.style.top = clampedTop + 'px';
      } catch (_) {}
    }
    try { window.addEventListener('resize', positionToggle); } catch (_) {}
  }
}

function ensureBanner() {
  let banner = document.getElementById('mini-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'mini-banner';
    banner.style.position = 'fixed';
    banner.style.top = '8px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.width = '20%';
    banner.style.minWidth = '240px';
    banner.style.maxWidth = '480px';
    banner.style.height = '2em';
    banner.style.display = 'none';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'center';
    banner.style.background = 'var(--banner-bg)';
    banner.style.color = 'var(--ui-fg)';
    banner.style.border = '1px solid var(--control-border)';
    banner.style.borderRadius = '6px';
    banner.style.padding = '0 12px';
    banner.style.zIndex = '9500'; // above hover status bar (9000), below overlay (9999)
    document.body.appendChild(banner);

    window.showBanner = function(msg = '', ms = 4000) {
      try { banner.textContent = msg; banner.style.display = 'flex'; } catch (_) {}
      if (window.__bannerTimer) clearTimeout(window.__bannerTimer);
      window.__bannerTimer = setTimeout(() => { try { banner.style.display = 'none'; } catch (_) {} }, ms);
    };
  }
  return banner;
}

// Hide legacy demo DOM and vendor demo controls when our canvas is active
function hideLegacyDom() {
  try { document.body.style.background = '#000'; } catch (_) {}
  try {
    const app = document.getElementById('app');
    if (app) {
      app.querySelectorAll('h1, p, pre').forEach((el) => { el.style.display = 'none'; });
    }
  } catch (_) {}
  // If vendor demo controls ever sneak in, hide them defensively
  try {
    ['enable-nearest','bilinear-fix','rc-sun-angle-slider','falloff-slider-container','radius-slider-container']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    document.querySelectorAll('.iconButton').forEach((el) => { el.style.display = 'none'; });
  } catch (_) {}
}

// OverlayManager now lives in ./core/overlayManager.js and exposes window.OverlayManager and window.PRIORITY

// Known substates and their priority for preemption
const SUBSTATES = {
  CURRENT_PLAYER_CHOOSING_CHARACTER_CLASS: 'CURRENT_PLAYER_CHOOSING_CHARACTER_CLASS',
  CURRENT_PLAYER_CHOOSING_CHARACTER_FACTION: 'CURRENT_PLAYER_CHOOSING_CHARACTER_FACTION',
  CURRENT_PLAYER_CHOOSING_CHARACTER_STATS: 'CURRENT_PLAYER_CHOOSING_CHARACTER_STATS',
  CURRENT_PLAYER_CHOOSING_CHARACTER_EQUIPMENT: 'CURRENT_PLAYER_CHOOSING_CHARACTER_EQUIPMENT',
  WAITING_ON_GAME_START: 'WAITING_ON_GAME_START',
  GAME_PAUSED_OTHER_PLAYER_IN_MENU: 'GAME_PAUSED_OTHER_PLAYER_IN_MENU',
  CURRENT_PLAYER_DEAD: 'CURRENT_PLAYER_DEAD',
  OTHER_PLAYER_DEAD: 'OTHER_PLAYER_DEAD',
  CURRENT_PLAYER_DISCONNECTED: 'CURRENT_PLAYER_DISCONNECTED',
  OTHER_PLAYER_DISCONNECTED: 'OTHER_PLAYER_DISCONNECTED',
  CURRENT_PLAYER_REJOINING: 'CURRENT_PLAYER_REJOINING',
  OTHER_PLAYER_REJOINING: 'OTHER_PLAYER_REJOINING',
  CURRENT_PLAYER_KICKED: 'CURRENT_PLAYER_KICKED',
  OTHER_PLAYER_KICKED: 'OTHER_PLAYER_KICKED',
  SERVER_SHUTDOWN: 'SERVER_SHUTDOWN',
  SERVER_REBOOT: 'SERVER_REBOOT',
  CURRENT_PLAYER_QUEST_WINDOW: 'CURRENT_PLAYER_QUEST_WINDOW',
};

function priorityForSubstate(s) {
  switch (s) {
    case SUBSTATES.SERVER_SHUTDOWN:
    case SUBSTATES.SERVER_REBOOT:
      return PRIORITY.CRITICAL;
    case SUBSTATES.CURRENT_PLAYER_KICKED:
    case SUBSTATES.OTHER_PLAYER_KICKED:
    case SUBSTATES.CURRENT_PLAYER_DEAD:
    case SUBSTATES.OTHER_PLAYER_DEAD:
      return PRIORITY.HIGH;
    case SUBSTATES.GAME_PAUSED_OTHER_PLAYER_IN_MENU:
    case SUBSTATES.CURRENT_PLAYER_DISCONNECTED:
    case SUBSTATES.OTHER_PLAYER_DISCONNECTED:
    case SUBSTATES.CURRENT_PLAYER_REJOINING:
    case SUBSTATES.OTHER_PLAYER_REJOINING:
    case SUBSTATES.WAITING_ON_GAME_START:
      return PRIORITY.MEDIUM;
    case SUBSTATES.CURRENT_PLAYER_CHOOSING_CHARACTER_CLASS:
    case SUBSTATES.CURRENT_PLAYER_CHOOSING_CHARACTER_FACTION:
    case SUBSTATES.CURRENT_PLAYER_CHOOSING_CHARACTER_STATS:
    case SUBSTATES.CURRENT_PLAYER_CHOOSING_CHARACTER_EQUIPMENT:
    case SUBSTATES.CURRENT_PLAYER_QUEST_WINDOW:
    default:
      return PRIORITY.LOW;
  }
}

function presentSubstate(substate, payload = {}) {
  const prio = priorityForSubstate(substate);
  // Clear any lower-priority modals so higher priority takes precedence
  OverlayManager.clearBelow(prio);
  const text = payload.text || `[${substate}]`;
  const actions = Array.isArray(payload.actions) ? payload.actions : defaultActionsFor(substate);
  const blockInput = payload.blockInput !== false; // block by default
  OverlayManager.present({ id: substate, priority: prio, text, actions, blockInput });
}

function defaultActionsFor(substate) {
  switch (substate) {
    case SUBSTATES.SERVER_SHUTDOWN:
    case SUBSTATES.SERVER_REBOOT:
      return [{ id: 'ok', label: 'OK' }];
    case SUBSTATES.CURRENT_PLAYER_KICKED:
      return [{ id: 'dismiss', label: 'OK' }];
    case SUBSTATES.CURRENT_PLAYER_DEAD:
      return [
        { id: 'respawn', label: 'Respawn' },
        { id: 'spectate', label: 'Spectate' },
      ];
    case SUBSTATES.WAITING_ON_GAME_START:
      return [{ id: 'ready', label: 'Ready' }];
    default:
      return [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' },
      ];
  }
}

const endpoint = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname || 'localhost'}:2567`;
const client = new Colyseus.Client(endpoint);

let room;
let lastStateVersion = 0;

// Only auto-reconnect on reload or back/forward, not on a fresh navigate/duplicated tab.
function shouldAutoReconnect() {
  try {
    const navs = (typeof performance.getEntriesByType === 'function') ? performance.getEntriesByType('navigation') : null;
    if (navs && navs[0] && typeof navs[0].type === 'string') {
      return navs[0].type === 'reload' || navs[0].type === 'back_forward';
    }
  } catch (_) {}
  try {
    const PN = performance.navigation;
    if (PN && typeof PN.type === 'number') {
      return PN.type === PN.TYPE_RELOAD || PN.type === PN.TYPE_BACK_FORWARD;
    }
  } catch (_) {}
  return false;
}

async function attemptReconnect() {
  try {
    const savedRoomId = sessionStorage.getItem('roomId');
    const savedSessionId = sessionStorage.getItem('sessionId');

    if (savedRoomId && savedSessionId && shouldAutoReconnect()) {
      statusEl.textContent = 'Reconnecting...';
      try {
        // Avoid getting stuck if reconnect hangs (e.g., server restarted)
        const timeoutMs = 3000;
        const r = await Promise.race([
          client.reconnect(savedRoomId, savedSessionId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('reconnect timeout')), timeoutMs))
        ]);
        await afterJoin(r);
        return; // done
      } catch (_) {
        // fallthrough to join
      }
    }
  } catch (err) {
    statusEl.textContent = 'Failed to connect';
    console.error(err);
    log(String(err?.message || err));
  }
}

function startLobby() {
  statusEl.textContent = 'In Lobby';
  setRoute(APP_STATES.LOBBY);
}
// Expose for login modal to call directly
window.startLobby = startLobby;

function startLobbyPolling() {
  if (lobbyPollId) return;
  const fetchRooms = async () => {
    try {
      const list = await client.getAvailableRooms('nethack');
      renderRooms(list || []);
    } catch (e) {
      console.warn('getAvailableRooms failed', e);
    }
  };
  fetchRooms();
  lobbyPollId = setInterval(fetchRooms, 4000);
}

function stopLobbyPolling() { if (lobbyPollId) { clearInterval(lobbyPollId); lobbyPollId = null; } }
window.stopLobbyPolling = stopLobbyPolling;

// Leave current room and return to Lobby
async function leaveRoomToLobby() {
  try {
    if (room && typeof room.leave === 'function') {
      await room.leave(true);
    }
  } catch (e) { try { console.warn('leave failed', e); } catch (_) {} }
  try { sessionStorage.removeItem('roomId'); } catch (_) {}
  try { sessionStorage.removeItem('sessionId'); } catch (_) {}
  try { OverlayManager.dismiss('ROOM_MODAL'); } catch (_) {}
  try { statusEl.textContent = 'In Lobby'; } catch (_) {}
  try { window.room = null; } catch (_) {}
  try { room = null; } catch (_) {}
  try { roomUIBound = false; } catch (_) {}
  setRoute(APP_STATES.LOBBY);
}

function renderRooms(rooms) {
  if (!roomsListEl) return;
  roomsListEl.innerHTML = '';
  rooms.forEach((r) => {
    const row = document.createElement('div');
    const meta = r.metadata || {};
    row.textContent = `${meta.name || r.roomId} | ${r.clients}/${meta.maxPlayers || r.maxClients || '?' }${meta.private ? ' (private)' : ''}`;
    const btn = document.createElement('button');
    btn.textContent = 'Join';
    btn.style.marginLeft = '8px';
    btn.onclick = async () => {
      const playerName = localStorage.getItem('name') || prompt('Name?') || 'Hero';
      if (meta.private) {
        presentRoomPromptPassword({
          roomName: meta.name || r.roomId,
          onSubmit: async (pwd) => {
            try {
              const rj = await client.joinById(r.roomId, { name: playerName, roomPass: pwd || '' });
              await afterJoin(rj);
              return true; // close modal
            } catch (e) {
              const msg = (e && (e.message || e)) + '';
              if (msg.includes('Invalid password') || msg.includes('Room requires password')) {
                return false; // wrong password, keep modal open
              }
              throw new Error(typeof msg === 'string' ? msg : 'Join failed');
            }
          },
          onCancel: () => {}
        });
      } else {
        try {
          const rj = await client.joinById(r.roomId, { name: playerName });
          await afterJoin(rj);
        } catch (e) { console.warn('join failed', e); }
      }
    };
    row.appendChild(btn);
    roomsListEl.appendChild(row);
  });
}

async function afterJoin(r) {
  room = r;
  sessionStorage.setItem('roomId', room.id);
  sessionStorage.setItem('sessionId', room.sessionId);
  window.room = room;
  // reset room UI binding for this new room
  try { roomUIBound = false; } catch (_) {}
  wireRoomEvents(room);
  const selfId = room.sessionId;
  const pname = localStorage.getItem('name') || 'Hero';
  statusEl.textContent = `Connected | roomId=${room.id} | you=${pname} (${selfId.slice(0,6)})`;
  // Close lobby modal on successful join
  try { OverlayManager.dismiss('LOBBY_MODAL'); } catch (_) {}
  setRoute(APP_STATES.ROOM);
}

function wireRoomEvents(r) {
  lastStateVersion = 0;
  // Players
  try {
    r.state.players.onAdd((player, key) => {
      const lx = player.currentLocation?.x; const ly = player.currentLocation?.y; const ll = player.currentLocation?.level ?? 0;
      log(`+ ${player.name} (${key}) @ ${lx}/${ly}/${ll}`);
    });
    r.state.players.onRemove((_, key) => { log(`- player ${key}`); });
  } catch (_) {}

  // Server log
  try { r.state.log.onAdd((value) => { log(value); }); } catch (_) {}

  // Maps & colors
  r.onMessage('dungeonMap', (mapString) => {
    if (window.radianceCascades && typeof window.radianceCascades.setDungeonMap === 'function') {
      window.radianceCascades.setDungeonMap(mapString);
    } else { window.__pendingDungeonMap = mapString; }
  });
  r.onMessage('positionColorMap', (mapString) => {
    if (window.radianceCascades?.surface?.setPositionColorMap) {
      window.radianceCascades.surface.setPositionColorMap(mapString);
    } else { window.__pendingPositionColorMap = mapString; }
  });
  r.onMessage('characterColorMap', (mapString) => {
    if (window.radianceCascades?.surface?.setCharacterColorMap) {
      window.radianceCascades.surface.setCharacterColorMap(mapString);
    } else { window.__pendingCharacterColorMap = mapString; }
  });

  // App state and modal pipeline
  r.onMessage('appState', (msg) => {
    try { console.log('[DEBUG client] appState', msg); } catch (_) {}
    if (typeof msg?.version === 'number' && msg.version < lastStateVersion) return;
    if (typeof msg?.version === 'number') lastStateVersion = msg.version;
    const { state, substate, payload } = msg || {};
    if (state) setRoute(state, payload || {});
    // Ensure start-confirm modal is dismissed when gameplay starts
    if (state === APP_STATES.GAMEPLAY_ACTIVE) {
      try { OverlayManager.dismiss('CONFIRM_START'); } catch (_) {}
    }
    if (substate) presentSubstate(substate, payload || {}); else OverlayManager.clearBelow(PRIORITY.CRITICAL + 1);
  });
  r.onMessage('modal', (msg) => {
    const { command, id, text, actions, priority, blockInput } = msg || {};
    if (command === 'present') {
      OverlayManager.present({ id, text, actions, priority: priority ?? PRIORITY.MEDIUM, blockInput: blockInput !== false });
    } else if (command === 'dismiss' && id) {
      OverlayManager.dismiss(id);
    } else if (command === 'clearBelow') {
      OverlayManager.clearBelow(priority ?? PRIORITY.MEDIUM);
    }
  });

  // Server-driven start game confirmation (host and ready players)
  r.onMessage('showGameConfirm', (payload) => {
    try {
      presentStartGameConfirm({
        players: (payload && Array.isArray(payload.players)) ? payload.players : getPlayersSnapshot(),
        canStart: typeof payload?.canStart === 'boolean' ? payload.canStart : undefined,
        isHost: !!(payload && (payload.isHost || (payload.hostId && payload.hostId === r.sessionId))),
        starting: !!payload?.starting,
        countdown: (payload && typeof payload.countdown === 'number') ? payload.countdown : 0,
        youAreReady: !!payload?.youAreReady,
        onStart: () => { try { r.send('startGame'); } catch (e) { console.warn('startGame send failed', e); } },
        onCancel: () => {
          try { r.send('cancelStart'); } catch (_) {}
          // Host cancel should reflect as not ready when countdown isn't active; reset UI proactively
          try { if (typeof window.setReadyButtonUI === 'function') window.setReadyButtonUI(false); } catch (_) {}
        },
        onUnready: () => {
          try { r.send('setReady', { ready: false }); } catch (_) {}
          try { if (typeof window.setReadyButtonUI === 'function') window.setReadyButtonUI(false); } catch (_) {}
          try { appendChatLine('You are not ready'); } catch (_) {}
        },
        priority: PRIORITY.MEDIUM,
      });
    } catch (e) { console.warn('showGameConfirm handling failed', e); }
  });

  // Server-driven Faction/Class/Loadout selection modal (per-player)
  r.onMessage('showFCLSelect', (payload) => {
    try {
      // If selection incomplete, ensure Ready button shows not ready
      if (!payload?.complete) {
        try { if (typeof window.setReadyButtonUI === 'function') window.setReadyButtonUI(false); } catch (_) {}
      }
      presentFCLSelectModal({
        factions: payload?.factions || [],
        classes: payload?.classes || [],
        loadouts: payload?.loadouts || [],
        selection: payload?.selection || {},
        complete: !!payload?.complete,
        priority: PRIORITY.LOW,
        onSelectFaction: (key) => { try { r.send('chooseFaction', { key }); } catch (_) {} },
        onSelectClass: (key) => { try { r.send('chooseClass', { key }); } catch (_) {} },
        onSelectLoadout: (key) => { try { r.send('chooseLoadout', { key }); } catch (_) {} },
        onReady: () => {
          try { r.send('setReady', { ready: true }); } catch (_) {}
          try { setReadyButtonUI(true); } catch (_) {}
          try { appendChatLine('You are ready'); } catch (_) {}
        },
      });
    } catch (e) { console.warn('showFCLSelect handling failed', e); }
  });

  r.onLeave((code) => {
    statusEl.textContent = 'Disconnected (' + code + ')';
    room = null;
    startLobby();
  });
}
 
// Gameplay movement input (guarded)
window.addEventListener('keydown', (e) => {
  const map = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' };
  const dir = map[e.key];
  if (!dir) return;
  if (!room || !window.__canSendGameplayInput) return;
  e.preventDefault();
  room.send('input', { type: 'move', dir });
});

// --- ASCII Dungeon Renderer integration (dynamic, no HTML changes) ---
// We load vendor scripts in order, then mount the renderer into a
// programmatically-created container under #app, and wire camera input.
// Keeping it minimal and self-contained.

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // Cache-bust to ensure latest vendor scripts are fetched
    s.src = `${src}?v=${Date.now()}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function setupAsciiRenderer() {
  try {
    const base = '/vendor/ascii-dungeon/ascii-dungeon';
    // Load in the same order as vendor example
    await loadScript(`${base}/interactivity-setup.js`);
    await loadScript(`${base}/ascii-texture.js`);
    await loadScript(`${base}/ascii-gi-helpers.js`);
    await loadScript(`${base}/ascii-gi.js`);

    // Create container if not present (no HTML edits)
    const app = document.getElementById('app');
    let container = document.getElementById('rc-canvas');
    if (!container) {
      container = document.createElement('div');
      container.id = 'rc-canvas';
      container.style.display = ''; // always visible per UI architecture
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.zIndex = '1';
      app.appendChild(container);
    }

    // Proactively hide legacy DOM under our fullscreen canvas
    hideLegacyDom();

    // Fullscreen size; DPR handled by RC props
    const width = Math.max(320, window.innerWidth || 1024);
    const height = Math.max(240, window.innerHeight || 768);

    // RC is declared by vendor scripts as a global. It may not be on window,
    // so use a safe lookup that works with declarative globals.
    const RCClass = (typeof RC !== 'undefined') ? RC : window.RC;
    const rc = new RCClass({
      id: 'rc-canvas',
      width: width,
      height: height,
      dpr: 1.0,
    });
    window.radianceCascades = rc; // expose for debugging/devtools
    // Ensure renderer starts even if IntersectionObserver doesn't fire
    if (typeof rc.load === 'function') {
      console.log('[DEBUG client] calling rc.load()');
      rc.load();
    }

    // Robust resize handler: updates canvas/container, renderer internals, uniforms, and render targets
    const handleResize = () => {
      try {
        const w = Math.max(320, window.innerWidth || 1024);
        const h = Math.max(240, window.innerHeight || 768);
        const dpr = window.devicePixelRatio || 1;

        // Ensure container fills viewport
        try {
          container.style.width = '100vw';
          container.style.height = '100vh';
        } catch (_) {}

        // Also update canvas CSS size and backing store to match DPR
        try {
          const canvas = rc.canvas;
          if (canvas) {
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
          }
        } catch (_) {}

        // Update renderer dimensions and DPR
        rc.width = w;
        rc.height = h;
        rc.dpr = dpr;

        // Rebuild base dungeon render targets for the new size (preserves camera)
        if (typeof rc.resize === 'function') {
          rc.resize(w, h, dpr);
        }

        // Update viewport-dependent uniforms
        if (rc.dungeonUniforms) {
          rc.dungeonUniforms.viewportSize = [w, h];
        }

        // Recalculate cascade parameters and dependent uniforms
        if (typeof rc.initializeParameters === 'function') {
          rc.initializeParameters(true);
        }

        // Recreate shader pipelines and render targets using new size/DPR
        if (typeof rc.innerInitialize === 'function') {
          rc.innerInitialize();
        }

        // Refresh ASCII view texture after resize if a dungeon map exists
        try {
          if (rc.surface && typeof rc.updateAsciiViewTexture === 'function' && typeof rc.surface.dungeonMap === 'string') {
            rc.updateAsciiViewTexture(rc.surface.dungeonMap);
          }
        } catch (_) {}

        // Update camera/grid uniforms and trigger a redraw
        try { if (typeof rc.updateCameraUniforms === 'function') rc.updateCameraUniforms(); } catch (_) {}
        try { if (typeof rc.renderPass === 'function') rc.renderPass(); } catch (_) {}

        // Keep legacy demo DOM hidden after resize/fullscreen
        try { hideLegacyDom(); } catch (_) {}
      } catch (e) {
        console.warn('[resize] handler failed', e);
      }
    };

    // Handle window resizing dynamically
    window.addEventListener('resize', handleResize);

    // Mirror resize on fullscreen changes and re-hide legacy DOM
    ;['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach((evt) => {
      document.addEventListener(evt, () => {
        handleResize();
        try { hideLegacyDom(); } catch (_) {}
      });
    });

    // Programmatic fullscreen toggle and keybinding ('f')
    const isFullscreen = () => (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    window.toggleFullscreen = async () => {
      try {
        if (isFullscreen()) {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
          else if (document.msExitFullscreen) await document.msExitFullscreen();
        } else {
          if (container.requestFullscreen) await container.requestFullscreen();
          else if (container.webkitRequestFullscreen) await container.webkitRequestFullscreen();
          else if (container.msRequestFullscreen) await container.msRequestFullscreen();
        }
      } catch (_) {}
    };

    // Integrate floating zoom buttons with renderer
    window.addEventListener('ui:zoom', (e) => {
      try { const f = Number(e?.detail?.factor) || 1.0; rc.zoomCamera(f, 0.5, 0.5); } catch (_) {}
    });

    // FPS estimator for status bar (simple rAF-based)
    (function fpsLoop(){
      let last = performance.now(), frames = 0, acc = 0;
      function tick(now){
        const dt = now - last; last = now; frames++; acc += dt;
        if (acc >= 1000) {
          const fps = Math.round(frames * 1000 / acc);
          frames = 0; acc = 0;
          try {
            const left = document.getElementById('status-left');
            if (left) {
              const txt = left.textContent || '';
              const parts = txt.split('|');
              left.textContent = `FPS: ${fps} | ${parts[1] ? parts[1].trim() : 'PING: --'}`;
            }
          } catch (_) {}
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })();

    // Ensure UI chrome exists
    ensureThemeSupport();
    ensureStatusBar();
    ensureFloatingControls();
    ensureBanner();
    ensureScreenShade();

    // Apply any pending assets received before renderer was ready
    // Important: set dungeon map before color maps so render has valid data
    if (window.__pendingDungeonMap && typeof rc.setDungeonMap === 'function') {
      try {
        console.log('[DEBUG client] applying pending dungeonMap');
        rc.setDungeonMap(window.__pendingDungeonMap);
      } catch (_) {}
      window.__pendingDungeonMap = undefined;
    }
    if (window.__pendingCharacterColorMap && rc.surface && typeof rc.surface.setCharacterColorMap === 'function') {
      try {
        console.log('[DEBUG client] applying pending characterColorMap');
        rc.surface.setCharacterColorMap(window.__pendingCharacterColorMap);
      } catch (_) {}
      window.__pendingCharacterColorMap = undefined;
    }
    if (window.__pendingPositionColorMap && rc.surface && typeof rc.surface.setPositionColorMap === 'function') {
      try {
        console.log('[DEBUG client] applying pending positionColorMap');
        rc.surface.setPositionColorMap(window.__pendingPositionColorMap);
      } catch (_) {}
      window.__pendingPositionColorMap = undefined;
    }

    // Minimal camera controls (mouse): pan + wheel zoom
    const canvas = rc.canvas;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      // Adjust sensitivity a bit; use zoom-aware scaling similar to vendor example
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const zoomFactor = 1.0 / Math.sqrt(rc.camera.zoomLevel || 1.0);
      rc.panCamera(-dx * zoomFactor, -dy * zoomFactor);
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      rc.zoomCamera(factor, x, y);
    }, { passive: false });

    // Optional: keyboard zoom
    window.addEventListener('keydown', (e) => {
      if (e.key === '+') rc.zoomCamera(1.1, 0.5, 0.5);
      if (e.key === '-') rc.zoomCamera(0.9, 0.5, 0.5);
    });

    // Initial adjustment
    handleResize();
  } catch (e) {
    console.error('[ASCII renderer] setup failed:', e);
  }
}

// Defer until DOM is ready so we can attach under #app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAsciiRenderer);
} else {
  setupAsciiRenderer();
}

// Initial entry: try reconnect; if none, go to login
attemptReconnect().catch(() => {}).finally(() => {
  if (!room) setRoute(APP_STATES.LOGIN);
});
