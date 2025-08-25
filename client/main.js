// Minimal Colyseus client (Vite) - plain JS
// Connects, prompts for gameId and room password, and sends arrow-key movement inputs.

import * as Colyseus from 'colyseus.js';
import OverlayManager, { PRIORITY } from './core/overlayManager.js';
import { presentRoomCreateModal } from './modals/roomCreate.js';
import { presentLoginModal, showLoginBackdrop } from './modals/login.js';
import { presentRoomPromptPassword } from './modals/roomPromptPassword.js';
import { presentStartGameConfirm } from './modals/startGameConfirm.js';
import { presentFCLSelectModal } from './modals/factionClassLoadout.js';
import { APP_STATES, makeScreen, setRoute, toggleRenderer } from './core/router.js';
import { createChatTabs } from './core/chatTabs.js';
import { setupAsciiRenderer } from './core/renderer.js';
import { SUBSTATES, presentSubstate } from './core/substates.js';
import './core/ui/theme.js';
import { ensureStatusBar } from './core/ui/statusBar.js';
import { registerRoomRoute } from './routes/room.js';
import * as LS from './core/localStorage.js';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const log = (line) => { logEl.textContent += line + '\n'; };

// (Knob utilities are exposed from audioManager.initAudio())

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
            const playerName = LS.getItem('name', 'Hero');
            const rj = await client.joinById(String(roomId), { name: playerName });
            await afterJoin(rj);
          } catch (e) {
            const msg = (e && (e.message || e)) + '';
            if (msg.includes('password')) {
              presentRoomPromptPassword({
                roomName: String(roomId),
                onSubmit: async (pwd) => {
                  try {
                    const rj = await client.joinById(String(roomId), { name: LS.getItem('name', 'Hero'), roomPass: pwd || '' });
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
            const cname = LS.getItem('name', 'Hero');
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

// Register ROOM route via extracted module
registerRoomRoute({
  makeScreen,
  APP_STATES,
  joinById: (roomId, opts) => client.joinById(roomId, opts),
  afterJoin,
  sendRoomMessage: (type, data) => { try { if (room) room.send(type, data); } catch (_) {} },
  leaveRoomToLobby,
  setReadyButtonUI,
  appendChatLine,
  bindRoomUIEventsOnce,
  renderRoomPlayers,
  refreshRoomChat,
  setRefs: {
    setRoomReadyBtn: (btn) => { roomReadyBtn = btn; },
    setRoomPlayersEl: (el) => { roomPlayersEl = el; },
    setRoomChat: (chat) => { roomChat = chat; },
  },
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
// Expose for other modules
window.ensureThemeSupport = ensureThemeSupport;

// ensureStatusBar moved to './core/ui/statusBar.js'
// Expose for other modules
window.ensureStatusBar = ensureStatusBar;

// Legacy floating volume controls removed in favor of './core/audio/floatingVolume.js'.

// Provide minimal zoom controls (+/-) to replace the part that lived in the legacy block
function ensureZoomControls() {
  let zoom = document.getElementById('zoom-controls');
  if (!zoom) {
    zoom = document.createElement('div');
    zoom.id = 'zoom-controls';
    zoom.style.position = 'fixed';
    zoom.style.left = '12px';
    zoom.style.bottom = '12px';
    zoom.style.zIndex = '30001';
    zoom.style.background = 'var(--control-bg)';
    zoom.style.border = '1px solid var(--control-border)';
    zoom.style.borderRadius = '6px';
    zoom.style.padding = '6px';
    zoom.style.display = 'flex';
    zoom.style.flexDirection = 'column';
    const zin = document.createElement('button');
    zin.textContent = '+'; zin.style.marginBottom = '6px';
    const zout = document.createElement('button');
    zout.textContent = '-';
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
}
// Expose for other modules
window.ensureZoomControls = ensureZoomControls;

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
// Expose for other modules
window.ensureBanner = ensureBanner;

// Legacy DOM hider moved to './core/renderer.js'

// OverlayManager now lives in ./core/overlayManager.js and exposes window.OverlayManager and window.PRIORITY

// Substate logic moved to './core/substates.js'

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
      const playerName = LS.getItem('name', '') || prompt('Name?') || 'Hero';
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
  const pname = LS.getItem('name', 'Hero');
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

// ASCII renderer moved to './core/renderer.js'

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
