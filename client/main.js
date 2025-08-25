// Minimal Colyseus client (Vite) - plain JS
// Connects, prompts for gameId and room password, and sends arrow-key movement inputs.

import * as Colyseus from 'colyseus.js';
import OverlayManager, { PRIORITY } from './core/overlayManager.js';
import { presentStartGameConfirm } from './modals/startGameConfirm.js';
import { presentFCLSelectModal } from './modals/factionClassLoadout.js';
import { APP_STATES, makeScreen, setRoute, toggleRenderer } from './core/router.js';
import { setupAsciiRenderer } from './core/renderer.js';
import { SUBSTATES, presentSubstate } from './core/substates.js';
import { ensureThemeSupport } from './core/ui/theme/themeManager.js';
import { ensureStatusBar } from './core/ui/statusBar.js';
import { registerRoomRoute } from './routes/room.js';
import { ensureZoomControls } from './core/zoom/zoomManager.js';
import { ensureBanner } from './core/ui/banner.js';
import { registerGameplayMovement } from './core/input/gameplayInput.js';
import { registerLoginRoute } from './routes/login.js';
import { registerLobbyRoute, stopLobbyPolling as stopLobbyPollingExport } from './routes/lobby.js';
import { ensureScreenShade } from './core/ui/screenShade.js';
import { attemptReconnect as attemptReconnectNet } from './core/net/reconnect.js';
import * as LS from './core/localStorage.js';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const log = (line) => { logEl.textContent += line + '\n'; };

// (Knob utilities are exposed from audioManager.initAudio())

// -------------------- Micro Router (plain DOM) --------------------
// Router extracted to './core/router.js'. See imports above.

// deriveGameId moved to './core/util/deriveGameId.js' and used by Lobby route module

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
// ROOM UI refs
let roomPlayersEl = null;
let roomChatListEl = null;
let roomChatInputEl = null;
let roomReadyBtn = null;
let roomUIBound = false;
// Chat components
let roomChat = null;

// Register LOGIN route via extracted module
registerLoginRoute({ makeScreen, APP_STATES });

// LOBBY route moved to './routes/lobby.js' and registered after client is created

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
// moved to './core/ui/screenShade.js'

// Expose for router to use on initial navigation
window.ensureScreenShade = ensureScreenShade;

// Default route until server tells us otherwise (after shade is attached)
setRoute(APP_STATES.LOGIN);
// Theme support moved to './core/ui/theme/themeManager.js'
// Expose for other modules
window.ensureThemeSupport = ensureThemeSupport;

// ensureStatusBar moved to './core/ui/statusBar.js'
// Expose for other modules
window.ensureStatusBar = ensureStatusBar;

// Legacy floating volume controls removed in favor of './core/audio/floatingVolume.js'.

// Provide minimal zoom controls (+/-) moved to './core/zoom/zoomManager.js'
// Expose for other modules
window.ensureZoomControls = ensureZoomControls;

// Banner moved to './core/ui/banner.js' (ensureBanner is imported)
// Expose for other modules
window.ensureBanner = ensureBanner;

// Legacy DOM hider moved to './core/renderer.js'

// OverlayManager now lives in ./core/overlayManager.js and exposes window.OverlayManager and window.PRIORITY

// Substate logic moved to './core/substates.js'

const endpoint = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname || 'localhost'}:2567`;
const client = new Colyseus.Client(endpoint);
// Register LOBBY route via extracted module (needs client)
registerLobbyRoute({ makeScreen, APP_STATES, client, afterJoin });
// Back-compat global
try { window.stopLobbyPolling = stopLobbyPollingExport; } catch (_) {}

let room;
let lastStateVersion = 0;
// Register gameplay input handler (guarded)
try { registerGameplayMovement(() => room); } catch (_) {}

// Reconnect helpers moved to './core/net/reconnect.js'

function startLobby() {
  statusEl.textContent = 'In Lobby';
  setRoute(APP_STATES.LOBBY);
}
// Expose for login modal to call directly
window.startLobby = startLobby;

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
 
// Gameplay movement input moved to './core/input/gameplayInput.js'

// ASCII renderer moved to './core/renderer.js'

// Defer until DOM is ready so we can attach under #app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAsciiRenderer);
} else {
  setupAsciiRenderer();
}

// Initial entry: try reconnect; if none, go to login
attemptReconnectNet({ client, afterJoin, statusEl, log }).catch(() => {}).finally(() => {
  if (!room) setRoute(APP_STATES.LOGIN);
});
