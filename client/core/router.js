// Micro Router (plain DOM) — extracted from client/main.js
// Exports: APP_STATES, makeScreen, setRoute, toggleRenderer

export const APP_STATES = {
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

// Expose for other modules expecting globals
window.APP_STATES = APP_STATES;
window.__getCurrentRoute = () => currentRoute;

export function makeScreen(id, initFn) {
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

// Always-on canvas per UI architecture rule: the renderer is always visible.
// We use a separate screen shade layer to dim the scene behind screens/modals.
export function toggleRenderer(/* visible */) {
  const rc = document.getElementById('rc-canvas');
  if (!rc) return;
  rc.style.display = '';
}

export function setRoute(route, payload = {}) {
  currentRoute = route;
  hideAllScreens();
  const el = screens.get(route);
  if (el) {
    el.style.display = '';
    if (typeof el.update === 'function') el.update(payload);
  } else {
    try { console.warn('[router] no screen for', route); } catch (_) {}
  }

  // Renderer is always visible; instead, toggle a dimming shade when a screen is active.
  toggleRenderer(true);

  try {
    const shade = (window.ensureScreenShade && window.ensureScreenShade()) || null;
    if (shade) {
      const needsShade = route !== APP_STATES.GAMEPLAY_ACTIVE;
      shade.style.display = needsShade ? '' : 'none';
    }
  } catch (_) {}

  // Enable pointer interaction with renderer except on LOGIN backdrop
  try {
    const rc = document.getElementById('rc-canvas');
    if (rc) rc.style.pointerEvents = (route === APP_STATES.LOGIN) ? 'none' : 'auto';
  } catch (_) {}

  // Allow movement input only during active gameplay and without blocking modals
  try { window.__canSendGameplayInput = (route === APP_STATES.GAMEPLAY_ACTIVE); } catch (_) {}

  // Stop lobby polling if we left the lobby
  if (route !== APP_STATES.LOBBY) {
    try { if (typeof window.stopLobbyPolling === 'function') window.stopLobbyPolling(); } catch (_) {}
  }
}
