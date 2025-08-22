// Minimal Colyseus client (Vite) - plain JS
// Connects, prompts for gameId and room password, and sends arrow-key movement inputs.

import * as Colyseus from 'colyseus.js';
import { presentRoomCreateModal } from './modals/roomCreate.js';
import { presentLoginModal, showLoginBackdrop } from './modals/login.js';
import { presentRoomPromptPassword } from './modals/roomPromptPassword.js';
import { presentStartGameConfirm } from './modals/startGameConfirm.js';
import { presentFCLSelectModal } from './modals/factionClassLoadout.js';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const log = (line) => { logEl.textContent += line + '\n'; };

// -------------------- Micro Router (plain DOM) --------------------
// Screens are simple divs under #app, shown/hidden by route.
const APP_STATES = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOBBY: 'LOBBY',
  ROOM: 'ROOM',
  GAMEPLAY_ACTIVE: 'GAMEPLAY_ACTIVE',
  GAMEPLAY_PAUSED: 'GAMEPLAY_PAUSED',
};

const appRoot = document.getElementById('app');
const screens = new Map();
let currentRoute = null;

function makeScreen(id, initFn) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.display = 'none';
    appRoot.appendChild(el);
  }
  if (typeof initFn === 'function') initFn(el);
  screens.set(id, el);
  return el;
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
  if (!roomChatListEl || !room) return;
  try {
    roomChatListEl.innerHTML = '';
    const arr = room.state.log || [];
    const start = Math.max(0, arr.length - 100);
    for (let i = start; i < arr.length; i++) {
      appendChatLine(String(arr[i]));
    }
  } catch (_) {}
}

function appendChatLine(line) {
  if (!roomChatListEl) return;
  const div = document.createElement('div');
  div.textContent = line;
  roomChatListEl.appendChild(div);
  roomChatListEl.scrollTop = roomChatListEl.scrollHeight;
}
function hideAllScreens() {
  for (const el of screens.values()) el.style.display = 'none';
}

function toggleRenderer(visible) {
  const rc = document.getElementById('rc-canvas');
  if (!rc) return;
  rc.style.display = visible ? '' : 'none';
}

function setRoute(route, payload = {}) {
  currentRoute = route;
  hideAllScreens();
  const el = screens.get(route);
  if (el) {
    el.style.display = '';
    if (typeof el.update === 'function') el.update(payload);
  } else {
    console.warn('[router] no screen for', route);
  }
  const showRC = route === APP_STATES.GAMEPLAY_ACTIVE || route === APP_STATES.GAMEPLAY_PAUSED;
  toggleRenderer(showRC);
  // Allow movement input only during active gameplay and without blocking modals
  window.__canSendGameplayInput = (route === APP_STATES.GAMEPLAY_ACTIVE);
  // Stop lobby polling if we left the lobby
  if (route !== APP_STATES.LOBBY) {
    try { stopLobbyPolling(); } catch (_) {}
  }
  // Ensure login modal/backdrop when entering LOGIN
  if (route === APP_STATES.LOGIN) {
    try { showLoginBackdrop(); } catch (_) {}
    try { presentLoginModal(); } catch (_) {}
  }
}

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

makeScreen(APP_STATES.LOGIN, (el) => {
  // Clear screen content; we use a modal over the full-screen renderer backdrop
  el.innerHTML = '';
  showLoginBackdrop();
  presentLoginModal();
});

makeScreen(APP_STATES.LOBBY, (el) => {
  el.innerHTML = '';
  const header = document.createElement('div');
  header.textContent = 'Lobby';
  const actions = document.createElement('div');
  createRoomBtn = document.createElement('button');
  createRoomBtn.textContent = 'Create Private Room';
  actions.appendChild(createRoomBtn);
  roomsListEl = document.createElement('div');
  roomsListEl.id = 'lobby-rooms';
  roomsListEl.style.marginTop = '8px';
  const stubs = document.createElement('div');
  stubs.style.marginTop = '12px';
  stubs.innerHTML = '<div>[chat stub]</div><div>[player list stub]</div>';
  el.appendChild(header);
  el.appendChild(actions);
  el.appendChild(roomsListEl);
  el.appendChild(stubs);
  el.update = () => { startLobbyPolling(); };
  createRoomBtn.onclick = () => {
    presentRoomCreateModal({
      onSubmit: async ({ name, turnLength, roomPass, maxPlayers }) => {
        const cname = localStorage.getItem('name') || 'Hero';
        try {
          const newRoom = await client.create('nethack', {
            name, turnLength, roomPass, maxPlayers, private: !!roomPass, hostName: cname,
          });
          await afterJoin(newRoom);
        } catch (e) {
          console.warn('create failed', e);
        }
      }
    });
  };
});

makeScreen(APP_STATES.ROOM, (el) => {
  el.innerHTML = '';
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  const title = document.createElement('div');
  title.textContent = 'Room';
  header.appendChild(title);
  roomReadyBtn = document.createElement('button');
  setReadyButtonUI(false); // default to not ready on room entry
  roomReadyBtn.onclick = () => {
    // Toggle local ready flag and notify server; server decides whether to show modal
    const now = roomReadyBtn.dataset.ready !== 'true';
    setReadyButtonUI(now);
    try { if (room) room.send('setReady', { ready: now }); } catch (_) {}
    // Ensure visible feedback when unreadying locally
    if (!now) {
      try { appendChatLine('You are not ready'); } catch (_) {}
    }
  };
  header.appendChild(roomReadyBtn);
  const players = document.createElement('div');
  players.id = 'room-players';
  const playersTitle = document.createElement('div');
  playersTitle.textContent = 'Players';
  playersTitle.style.marginTop = '8px';
  roomPlayersEl = document.createElement('div');
  roomPlayersEl.id = 'room-players-list';
  const chat = document.createElement('div');
  chat.id = 'room-chat';
  const chatTitle = document.createElement('div');
  chatTitle.textContent = 'Chat / Log';
  chatTitle.style.marginTop = '12px';
  roomChatListEl = document.createElement('div');
  roomChatListEl.id = 'room-chat-list';
  roomChatListEl.style.maxHeight = '200px';
  roomChatListEl.style.overflowY = 'auto';
  const chatInputRow = document.createElement('div');
  chatInputRow.style.marginTop = '6px';
  roomChatInputEl = document.createElement('input');
  roomChatInputEl.type = 'text';
  roomChatInputEl.placeholder = 'Chat coming soon…';
  roomChatInputEl.disabled = true; // server chat not implemented yet
  const chatSend = document.createElement('button');
  chatSend.textContent = 'Send';
  chatSend.disabled = true;
  chatInputRow.appendChild(roomChatInputEl);
  chatInputRow.appendChild(chatSend);
  el.appendChild(header);
  el.appendChild(players);
  players.appendChild(playersTitle);
  players.appendChild(roomPlayersEl);
  el.appendChild(chat);
  chat.appendChild(chatTitle);
  chat.appendChild(roomChatListEl);
  chat.appendChild(chatInputRow);

  el.update = () => {
    try { bindRoomUIEventsOnce(); } catch (_) {}
    try { renderRoomPlayers(); } catch (_) {}
    try { refreshRoomChat(); } catch (_) {}
  };
});
makeScreen(APP_STATES.GAMEPLAY_ACTIVE, (el) => { el.textContent = 'Gameplay Active'; });
makeScreen(APP_STATES.GAMEPLAY_PAUSED, (el) => { el.textContent = 'Gameplay Paused'; });

// Default route until server tells us otherwise
setRoute(APP_STATES.LOGIN);

// -------------------- Overlay Manager (priority modals) --------------------
// Supports dynamic server-driven modals with priority and actions (yes/no/1..9)
const PRIORITY = {
  LOW: 10,              // character creation steps, quest window
  MEDIUM: 50,           // game paused, waiting states
  HIGH: 90,             // player dead, kicked
  CRITICAL: 100,        // server shutdown/reboot
};
// Expose for modal modules
window.PRIORITY = PRIORITY;

let overlayEl = null;
function ensureOverlay() {
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'overlay';
    overlayEl.style.position = 'absolute';
    overlayEl.style.left = '0';
    overlayEl.style.top = '0';
    overlayEl.style.right = '0';
    overlayEl.style.bottom = '0';
    overlayEl.style.display = 'none';
    overlayEl.style.pointerEvents = 'auto';
    overlayEl.style.background = 'rgba(0,0,0,0.5)';
    overlayEl.style.color = '#fff';
    overlayEl.style.padding = '16px';
    overlayEl.style.zIndex = '9999';
    // Create inner content box for basic layout
    const inner = document.createElement('div');
    inner.id = 'overlay-content';
    inner.style.maxWidth = '640px';
    inner.style.margin = '40px auto';
    inner.style.background = 'rgba(0,0,0,0.8)';
    inner.style.border = '1px solid #444';
    inner.style.padding = '16px';
    inner.style.boxShadow = '0 0 12px rgba(0,0,0,0.6)';
    overlayEl.appendChild(inner);
    // Ensure appRoot is positioned for overlay stacking
    appRoot.style.position = appRoot.style.position || 'relative';
    appRoot.appendChild(overlayEl);
  }
  return overlayEl;
}

const OverlayManager = (() => {
  const stack = []; // { id, priority, text, actions, blockInput, hotkeyMap }

  function renderTop() {
    const el = ensureOverlay();
    if (stack.length === 0) {
      el.style.display = 'none';
      el.querySelector('#overlay-content').innerHTML = '';
      // Recompute input gate when overlays change
      window.__canSendGameplayInput = (currentRoute === APP_STATES.GAMEPLAY_ACTIVE);
      return;
    }
    const top = stack[stack.length - 1];
    el.style.display = '';
    const content = el.querySelector('#overlay-content');
    content.innerHTML = '';
    const p = document.createElement('div');
    p.textContent = top.text || '[modal]';
    content.appendChild(p);
    const btnRow = document.createElement('div');
    btnRow.style.marginTop = '12px';
    content.appendChild(btnRow);
    (top.actions || []).forEach((a, idx) => {
      const b = document.createElement('button');
      b.textContent = a.label || a.id || ('Option ' + (idx + 1));
      b.style.marginRight = '8px';
      b.addEventListener('click', () => selectAction(top, a));
      btnRow.appendChild(b);
    });
    // If modal blocks input, disable gameplay input
    window.__canSendGameplayInput = (currentRoute === APP_STATES.GAMEPLAY_ACTIVE) && !top.blockInput;
  }

  function selectAction(modal, action) {
    // Inform server about the chosen action
    try {
      if (window.room) {
        window.room.send('modalAction', { modalId: modal.id, actionId: action.id });
      }
    } catch (e) { console.warn('modalAction send failed', e); }
    // Dismiss the current modal
    dismiss(modal.id);
  }

  function present({ id, priority = PRIORITY.LOW, text = '', actions = [], blockInput = true, hotkeys = {} }) {
    // Remove any existing modal with same id
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].id === id) stack.splice(i, 1);
    }
    // Insert keeping stack sorted by priority (ascending), but top is last
    const modal = { id, priority, text, actions, blockInput, hotkeys };
    const idx = stack.findIndex(m => m.priority > priority);
    if (idx === -1) stack.push(modal); else stack.splice(idx, 0, modal);
    renderTop();
  }

  function dismiss(id) {
    const i = stack.findIndex(m => m.id === id);
    if (i !== -1) stack.splice(i, 1);
    renderTop();
  }

  function clearBelow(priority) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].priority < priority) stack.splice(i, 1);
    }
    renderTop();
  }

  function top() { return stack[stack.length - 1] || null; }

  function isBlockingInput() {
    const t = top();
    return !!(t && t.blockInput);
  }

  // Keyboard hotkeys for the top modal
  window.addEventListener('keydown', (e) => {
    const t = top();
    if (!t) return;
    // map numeric keys 1..9 to actions by index
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= (t.actions || []).length) {
      e.preventDefault();
      selectAction(t, t.actions[num - 1]);
      return;
    }
    // y/n convenience
    if ((e.key === 'y' || e.key === 'Y') && (t.actions || [])[0]) {
      e.preventDefault();
      selectAction(t, t.actions[0]);
      return;
    }
    if ((e.key === 'n' || e.key === 'N') && (t.actions || [])[1]) {
      e.preventDefault();
      selectAction(t, t.actions[1]);
      return;
    }
  });

  return { present, dismiss, clearBelow, top, isBlockingInput };
})();

// Expose OverlayManager for external modules (room create modal)
window.OverlayManager = OverlayManager;
// If we are currently on the LOGIN route and the initial attempt to present the
// login modal happened before OverlayManager existed, present it now.
if (currentRoute === APP_STATES.LOGIN) {
  try { presentLoginModal(); } catch (_) {}
}

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
      container.style.display = 'none'; // hidden by default; router toggles when needed
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.zIndex = '1';
      app.appendChild(container);
    }

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
