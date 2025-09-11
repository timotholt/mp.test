// Centralized event-driven dungeon map switching (plain JS)
// Listens for route changes and sets the background dungeon accordingly.
// - LOGIN: dungeon #1
// - LOBBY: dungeon #2
// - GAMEPLAY_ACTIVE: do nothing (gameplay owns dungeon via server events)

(function initDungeonDisplayManager(){
  if (typeof window === 'undefined') return;

  // Simple, readable ASCII maps (fallbacks). Shared generator will override when available.
  // Login: very horizontal corridor across the middle
  let LOGIN_MAP = [
    '############################################################',
    '############################################################',
    '##############################+#############################',
    '##############################.#############################',
    '##############################.#############################',
    '########@=====================.====================^########',
    '##############################.#############################',
    '##############################.#############################',
    '##############################.#############################',
    '############################################################',
    '############################################################',
    '############################################################',
  ].join('\n');

  // Lobby: tall vertical shaft down the center
  let LOBBY_MAP = [
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################@#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################^#############################',
    '##############################|#############################',
  ].join('\n');

  function setMapString(mapString) {
    try {
      const rc = window.radianceCascades;
      if (rc && typeof rc.setDungeonMap === 'function') {
        rc.setDungeonMap(mapString);
      } else {
        window.__pendingDungeonMap = mapString;
      }
    } catch (_) {}
  }

  function applyForRoute(route) {
    try {
      const STATES = window.APP_STATES || {};
      if (route === STATES.LOGIN) {
        setMapString(LOGIN_MAP);
      } else if (route === STATES.LOBBY) {
        setMapString(LOBBY_MAP);
      } else if (route === STATES.GAMEPLAY_ACTIVE) {
        // Gameplay dungeon is controlled by gameplay events (wireRoomEvents.js)
        // Do not override here.
      }
    } catch (_) {}
  }

  // Attempt to load shared generator (CommonJS) and override fallbacks

  // Respond to future route changes
  window.addEventListener('route:changed', (e) => {
    const r = (e && e.detail && e.detail.route) || null;
    if (!r) return;
    applyForRoute(r);
  });

  // Apply immediately for current route on first load
  try {
    const current = (typeof window.__getCurrentRoute === 'function') ? window.__getCurrentRoute() : null;
    if (current) applyForRoute(current);
  } catch (_) {}
})();
