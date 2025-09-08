// Minimal Colyseus client (Vite) - plain JS
// Connects, prompts for gameId and room password, and sends arrow-key movement inputs.

import * as Colyseus from 'colyseus.js';
import OverlayManager, { PRIORITY } from './core/overlayManager.js';
import { presentStartGameConfirm } from './modals/startGameConfirm.js';
import { presentFCLSelectModal } from './modals/factionClassLoadout.js';
import { APP_STATES, makeScreen, setRoute, toggleRenderer } from './core/router.js';
import { SUBSTATES, presentSubstate } from './core/substates.js';
// Initialize UI theme system (IIFE side-effect import)
import './core/ui/theme/themeManager.js';
import { ensureStatusBar } from './core/ui/statusBar.js';
import { registerRoomRoute } from './routes/room.js';
import { ensureZoomControls } from './core/zoom/zoomManager.js';
import { ensureBanner } from './core/ui/banner.js';
import { registerGameplayMovement } from './core/input/gameplayInput.js';
import { registerLoginRoute } from './routes/login.js';
import { registerLobbyRoute, stopLobbyPolling as stopLobbyPollingExport } from './routes/lobby.js';
import { getFont, resolveImageSrc } from './core/ui/dungeon/fontCatalog.js';
import { ensureDungeonScrim } from './core/ui/dungeon/dungeonScrim.js';
import { attemptReconnect as attemptReconnectNet } from './core/net/reconnect.js';
import * as LS from './core/localStorage.js';
import { configureRoomUi, resetRoomUiBinding, setReadyButtonUI, bindRoomUIEventsOnce, renderRoomPlayers, getPlayersSnapshot, refreshRoomChat, appendChatLine, setRoomReadyBtn, setRoomPlayersEl, setRoomChat } from './core/ui/roomUi.js';
import { createSessionHandlers } from './core/net/session.js';
import { startHeartbeat } from './core/net/heartbeat.js';
import { initSupabase } from './core/auth/supabaseAuth.js';

import './core/ui/colorKnobs.js';
import './core/ui/dungeon/dungeonDisplayManager.js';
// Load Pixi renderer module (IIFE attaches window.bootPixiRenderer for dev use)
import './core/pixi/pixiDungeonRenderer.js';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const log = (line) => { logEl.textContent += line + '\n'; };

// (Knob utilities are exposed from audioManager.initAudio())

// -------------------- Micro Router (plain DOM) --------------------
// Router extracted to './core/router.js'. See imports above.

// deriveGameId moved to './core/util/deriveGameId.js' and used by Lobby route module

// -------------------- Room UI (extracted to './core/ui/roomUi.js') --------------------
// Expose for modal modules to sync button state on cancel/unready
window.setReadyButtonUI = setReadyButtonUI;
// Routing handled by imported setRoute/toggleRenderer in './core/router.js'

// Provide room reference and session handlers (used by routes)
let room;
const { startLobby, leaveRoomToLobby, afterJoin } = createSessionHandlers({
  setRoute,
  APP_STATES,
  OverlayManager,
  PRIORITY,
  LS,
  resetRoomUiBinding,
  getPlayersSnapshot,
  appendChatLine,
  setReadyButtonUI,
  presentSubstate,
  presentStartGameConfirm,
  presentFCLSelectModal,
  statusEl,
  getRoom: () => room,
  setRoom: (r) => { room = r; try { window.room = r; } catch (_) {} },
  log,
});

// Register screens

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
    setRoomReadyBtn,
    setRoomPlayersEl,
    setRoomChat,
  },
});

makeScreen(APP_STATES.GAMEPLAY_ACTIVE, (el) => { el.textContent = 'Gameplay Active'; });
makeScreen(APP_STATES.GAMEPLAY_PAUSED, (el) => { el.textContent = 'Gameplay Paused'; });


// -------------------- Always-on Canvas Dimming Shade & UI Chrome --------------------
// moved to './core/ui/dungeon/dungeonScrim.js'

// Expose for router to use on initial navigation
window.ensureDungeonScrim = ensureDungeonScrim;

// Default route until server tells us otherwise (after shade is attached)
setRoute(APP_STATES.LOGIN);
// Theme system initializes on import in './core/ui/theme/themeManager.js'
// Initialize Supabase auth once at app startup (singleton)
initSupabase();

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

// Register gameplay input handler (guarded)
try { registerGameplayMovement(() => room); } catch (_) {}

// Configure Room UI module with a getter for current room
try { configureRoomUi({ getRoom: () => room }); } catch (_) {}

// Lightweight heartbeat for presence: send 'hb' to current room and lobby (guarded)
try { startHeartbeat({ getRoom: () => room, getLobbyRoom: () => (window.lobbyRoom || null), intervalMs: 5000 }); } catch (_) {}

// Reconnect helpers moved to './core/net/reconnect.js'

// Client replies to server 'ping' with 'pong' and also sends a lightweight 'hb' every ~5s for presence

// Expose for login modal to call directly
window.startLobby = startLobby;
 
// Gameplay movement input moved to './core/input/gameplayInput.js'

// ASCII renderer moved to './core/renderer.js'

// Defer until DOM is ready so we can attach under #app
async function bootPixi() {
  try { if (window.bootPixiRenderer) { await window.bootPixiRenderer(); } } catch (e) { try { console.error('[main] Pixi boot failed', e); } catch (_) {} }
  // Ensure core UI overlays are present (previously created by ASCII renderer)
  try { ensureStatusBar(); } catch (_) {}
  try { ensureBanner(); } catch (_) {}
  try { ensureZoomControls(); } catch (_) {}

  // Proactively dispatch the current dungeon font so Pixi shows without opening Settings
  try {
    let fontId = null;
    try { fontId = localStorage.getItem('ui_dungeon_font_id'); } catch (_) { fontId = null; }
    const alias = { 'vendor-16x16': 'Bisasam_16x16', 'Bisasam 16x16': 'Bisasam_16x16' };
    const resolvedId = alias[fontId] || fontId || 'vendor-8x8';
    const f = getFont(resolvedId);
    if (f) {
      const src = resolveImageSrc(f);
      if (src) {
        const detail = {
          id: f.id,
          name: f.name,
          tile: f.tile,
          atlas: f.atlas,
          startCode: Number.isFinite(f.startCode) ? f.startCode : 32,
        };
        if (Object.prototype.hasOwnProperty.call(f, 'flipTextureY')) detail.flipTextureY = !!f.flipTextureY;
        if (Object.prototype.hasOwnProperty.call(f, 'flipTextureX')) detail.flipTextureX = !!f.flipTextureX;
        if (Object.prototype.hasOwnProperty.call(f, 'flipRow')) detail.flipRow = !!f.flipRow;
        if (Object.prototype.hasOwnProperty.call(f, 'flipTileY')) detail.flipTileY = !!f.flipTileY;
        if (f.dataUrl) detail.dataUrl = f.dataUrl; else detail.url = src;
        window.dispatchEvent(new CustomEvent('ui:dungeon-font-changed', { detail }));
      }
    }
  } catch (_) {}

  // Re-emit current route so dungeonDisplayManager reapplies map (ensures Pixi picks it up)
  try {
    const current = (typeof window.__getCurrentRoute === 'function') ? window.__getCurrentRoute() : null;
    if (current) window.dispatchEvent(new CustomEvent('route:changed', { detail: { route: current } }));
  } catch (_) {}

  // Global keydown: +/- zoom and F8 UI toggle (mirrors ASCII behavior)
  try {
    window.addEventListener('keydown', (e) => {
      try {
        if (e.key === '+' || e.key === '=') {
          window.dispatchEvent(new CustomEvent('ui:zoom', { detail: { factor: 1.1 } }));
        } else if (e.key === '-') {
          window.dispatchEvent(new CustomEvent('ui:zoom', { detail: { factor: 0.9 } }));
        } else if (e.key === 'F8') {
          const hidden = document.body.getAttribute('data-ui-hidden') === 'true' ? false : true;
          document.body.setAttribute('data-ui-hidden', hidden ? 'true' : 'false');
          const toggleEl = (el) => {
            if (!el) return;
            if (hidden) {
              if (!el.getAttribute('data-prev-display')) el.setAttribute('data-prev-display', el.style.display || '');
              el.style.display = 'none';
            } else {
              const prev = el.getAttribute('data-prev-display');
              el.style.display = (prev != null) ? prev : '';
              el.removeAttribute('data-prev-display');
            }
          };
          const ids = [
            'hover-status-bar', 'zoom-controls', 'settings-overlay-root', 'settings-scrim',
            'overlay', 'overlay-content', 'modal-root', 'dungeon-scrim'
          ];
          ids.forEach((id) => toggleEl(document.getElementById(id)));
          try {
            const states = (window.APP_STATES || {});
            Object.values(states).forEach((sid) => toggleEl(document.getElementById(String(sid))));
          } catch (_) {}
          try { document.querySelectorAll('.login-card').forEach((el) => toggleEl(el)); } catch (_) {}
        }
      } catch (_) {}
    });
  } catch (_) {}
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { bootPixi(); });
} else {
  bootPixi();
}

// Initial entry: try reconnect; if none, go to login
attemptReconnectNet({ client, afterJoin, statusEl, log }).catch(() => {}).finally(() => {
  if (!room) setRoute(APP_STATES.LOGIN);
});
