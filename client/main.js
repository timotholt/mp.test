// Minimal Colyseus client (Vite) - plain JS
// Connects, prompts for gameId and room password, and sends arrow-key movement inputs.

import * as Colyseus from 'colyseus.js';

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
}

// Register minimal placeholder screens (improve later)
makeScreen(APP_STATES.LOGIN, (el) => { el.textContent = 'Login Screen'; });
makeScreen(APP_STATES.LOBBY, (el) => { el.textContent = 'Lobby Screen'; });
makeScreen(APP_STATES.ROOM, (el) => { el.textContent = 'Room Screen'; });
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

    // --- Server-driven app state & modal handling ---
    let lastStateVersion = 0;
    room.onMessage('appState', (msg) => {
      try { console.log('[DEBUG client] appState', msg); } catch (_) {}
      if (typeof msg?.version === 'number' && msg.version < lastStateVersion) return;
      if (typeof msg?.version === 'number') lastStateVersion = msg.version;
      const { state, substate, payload } = msg || {};
      if (state) setRoute(state, payload || {});
      if (substate) presentSubstate(substate, payload || {}); else OverlayManager.clearBelow(PRIORITY.CRITICAL + 1);
    });

    // Generic modal channel (server can present/dismiss arbitrary modal)
    room.onMessage('modal', (msg) => {
      const { command, id, text, actions, priority, blockInput } = msg || {};
      if (command === 'present') {
        OverlayManager.present({ id, text, actions, priority: priority ?? PRIORITY.MEDIUM, blockInput: blockInput !== false });
      } else if (command === 'dismiss' && id) {
        OverlayManager.dismiss(id);
      } else if (command === 'clearBelow') {
        OverlayManager.clearBelow(priority ?? PRIORITY.MEDIUM);
      }
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

// Known substates and their priority for preemption
const SUBSTATES = {
  CURRENT_PLAYER_CHOOSING_CHARACTER_CLASS: 'CURRENT_PLAYER_CHOOSING_CHARACTER_CLASS',
  CURRENT_PLAYER_CHOOSING_CHARACTER_CHAPTER: 'CURRENT_PLAYER_CHOOSING_CHARACTER_CHAPTER',
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
    case SUBSTATES.CURRENT_PLAYER_CHOOSING_CHARACTER_CHAPTER:
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

const storedGameId = localStorage.getItem('gameId') || '';
const storedName = localStorage.getItem('name') || '';

const gameId = storedGameId || (prompt('Game ID (new or existing):') || 'game-1');
const roomPass = prompt('Room password:') || '';
const name = storedName || (prompt('Name:') || 'Hero');

localStorage.setItem('gameId', gameId);
localStorage.setItem('name', name);

let room;

async function connect() {
  try {
    const savedRoomId = localStorage.getItem('roomId');
    const savedSessionId = localStorage.getItem('sessionId');

    if (savedRoomId && savedSessionId) {
      statusEl.textContent = 'Reconnecting...';
      try {
        room = await client.reconnect(savedRoomId, savedSessionId);
      } catch (_) {
        // fallthrough to join
      }
    }

    if (!room) {
      statusEl.textContent = 'Joining...';
      room = await client.joinOrCreate('nethack', { gameId, roomPass, name });
      localStorage.setItem('roomId', room.id);
      localStorage.setItem('sessionId', room.sessionId);
    }

    // IDENTITY INFO: show gameId, roomId and our session/user id (easy to remove later)
    const selfId = room.sessionId;
    statusEl.textContent = `Connected | gameId=${gameId} | roomId=${room.id} | you=${name} (${selfId.slice(0,6)})`;
    log(`[info] connected room=${room.id} game=${gameId} you=${name} (${selfId})`);
    // DEBUG: temporary instrumentation - connected (remove after verifying flow)
    console.log('[DEBUG client] connected', { roomId: room.id, sessionId: room.sessionId });
    // Expose room for modalAction messages
    window.room = room;

    // Observe players (Schema v2 signal-style)
    room.state.players.onAdd((player, key) => {
      const lx = player.currentLocation?.x;
      const ly = player.currentLocation?.y;
      const ll = player.currentLocation?.level ?? 0;
      log(`+ ${player.name} (${key}) @ ${lx}/${ly}/${ll}`);
    });
    room.state.players.onRemove((_, key) => { log(`- player ${key}`); });

    // Observe server log (Schema v2 signal-style)
    // DEBUG: temporary instrumentation - log stream (remove after verifying flow)
    room.state.log.onAdd((value) => { console.log('[DEBUG client] log.onAdd', value); log(value); });

    // Wire dungeon map updates from server (placeholder message type)
    room.onMessage('dungeonMap', (mapString) => {
      try {
        const lines = typeof mapString === 'string' ? mapString.split('\n').length : 0;
        console.log('[DEBUG client] received dungeonMap', { chars: mapString?.length, lines, preview: (typeof mapString === 'string' ? mapString.slice(0, 80) : '') });
      } catch (_) {}
      if (window.radianceCascades && typeof window.radianceCascades.setDungeonMap === 'function') {
        console.log('[DEBUG client] applying dungeonMap to renderer');
        window.radianceCascades.setDungeonMap(mapString);
      } else {
        console.warn('[ASCII renderer] Received dungeonMap before renderer ready. Caching.');
        window.__pendingDungeonMap = mapString;
      }
    });

    // Wire per-position color map from server (JSON string)
    room.onMessage('positionColorMap', (mapString) => {
      try {
        const parsed = JSON.parse(mapString);
        console.log('[DEBUG client] received positionColorMap', { entries: Object.keys(parsed).length });
      } catch (e) {
        console.warn('[DEBUG client] invalid positionColorMap JSON', e);
      }
      if (window.radianceCascades && window.radianceCascades.surface && typeof window.radianceCascades.surface.setPositionColorMap === 'function') {
        console.log('[DEBUG client] applying positionColorMap to renderer');
        window.radianceCascades.surface.setPositionColorMap(mapString);
      } else {
        console.warn('[ASCII renderer] Received positionColorMap before renderer ready. Caching.');
        window.__pendingPositionColorMap = mapString;
      }
    });

    // Wire character color map from server (JSON string)
    room.onMessage('characterColorMap', (mapString) => {
      try {
        // Validate JSON early for logging
        const parsed = JSON.parse(mapString);
        console.log('[DEBUG client] received characterColorMap', { keys: Object.keys(parsed).length });
      } catch (e) {
        console.warn('[DEBUG client] invalid characterColorMap JSON', e);
      }
      if (window.radianceCascades && window.radianceCascades.surface && typeof window.radianceCascades.surface.setCharacterColorMap === 'function') {
        console.log('[DEBUG client] applying characterColorMap to renderer');
        window.radianceCascades.surface.setCharacterColorMap(mapString);
      } else {
        console.warn('[ASCII renderer] Received characterColorMap before renderer ready. Caching.');
        window.__pendingCharacterColorMap = mapString;
      }
    });

    // Handle disconnect
    room.onLeave((code) => { statusEl.textContent = 'Disconnected (' + code + ')'; });

    // Send arrow-key movement
    window.addEventListener('keydown', (e) => {
      // DEBUG: temporary instrumentation - keydown (remove after verifying flow)
      console.log('[DEBUG client] keydown', e.key);
      const map = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' };
      const dir = map[e.key];
      if (dir) {
        // DEBUG: temporary instrumentation - send move (remove after verifying flow)
        console.log('[DEBUG client] send move', dir);
        room.send('input', { type: 'move', dir });
        e.preventDefault();
      }
    });
  } catch (err) {
    statusEl.textContent = 'Failed to connect';
    console.error(err);
    log(String(err?.message || err));
  }
}

connect();

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
      app.appendChild(container);
    }

    // Pick a sensible default size; DPR handled by RC props
    const width = 512;
    const height = 512;

    // RC is declared by vendor scripts as a global. It may not be on window,
    // so use a safe lookup that works with declarative globals.
    const RCClass = (typeof RC !== 'undefined') ? RC : window.RC;
    const rc = new RCClass({
      id: 'rc-canvas',
      width: width,
      height: height,
      dpr: 1.0,
      canvasScale: 1.0,
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
