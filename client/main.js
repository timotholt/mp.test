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
import { configureRoomUi, resetRoomUiBinding, setReadyButtonUI, bindRoomUIEventsOnce, renderRoomPlayers, getPlayersSnapshot, refreshRoomChat, appendChatLine, setRoomReadyBtn, setRoomPlayersEl, setRoomChat } from './core/ui/roomUi.js';
import { createSessionHandlers } from './core/net/session.js';

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

// Register gameplay input handler (guarded)
try { registerGameplayMovement(() => room); } catch (_) {}

// Configure Room UI module with a getter for current room
try { configureRoomUi({ getRoom: () => room }); } catch (_) {}

// Reconnect helpers moved to './core/net/reconnect.js'

// Expose for login modal to call directly
window.startLobby = startLobby;
 
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
