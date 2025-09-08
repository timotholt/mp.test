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
    '#..........######.................######.............^.....#',
    '#..........#....#.................#....#...................#',
    '#..........#....#.....@@@@@.......#....#...................#',
    '#..........######.................######...................#',
    '#..........................................................#',
    '#.............######....................######.............#',
    '#.............#....#....................#....#.............#',
    '#.....@.......#....#....................#....#.......@.....#',
    '#.............######....................######.............#',
    '#..........................................................#',
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

  // Build entity list from a floor map. Floors remain in mapString visually.
  // We add entities on top only for walls ('#') and the player '@'.
  function computeEntitiesFromMap(mapString) {
    const entities = [];
    const rows = String(mapString || '').split('\n');
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '#') {
          // Dark, near-neutral wall color in the entities layer to avoid emission.
          // Visual wall appearance comes primarily from the FLOOR layer color map below.
          entities.push({ x, y, char: '#', color: [0.06, 0.07, 0.08], blocking: true });
        } else if (ch === '@') {
          // Player '@' should be white in the entities layer
          entities.push({ x, y, char: '@', color: [1.0, 1.0, 1.0], blocking: false });
        }
      }
    }
    return entities;
  }

  // Apply floors as non-blocking and walls/entities as blocking layer over the floor.
  function applyFloorAndEntities(mapString) {
    try {
      const rc = window.radianceCascades;
      const entities = computeEntitiesFromMap(mapString);
      if (rc && typeof rc.setPositionBlockMapFill === 'function' && typeof rc.setEntities === 'function') {
        rc.setPositionBlockMapFill(false); // floors never block
        rc.setEntities(entities);
        // Apply a non-blinding character color map for the FLOOR layer
        if (rc.surface && typeof rc.surface.setCharacterColorMap === 'function') {
          const charMap = JSON.stringify({
            '#': [0.36, 0.38, 0.42],  // walls (visual albedo on FLOOR layer)
            '.': [0.14, 0.14, 0.16],  // floor dots slightly darker for contrast
            '~': [0.20, 0.40, 0.80],  // water (optional)
            '+': [0.85, 0.65, 0.20],  // doors (optional)
            '|': [0.50, 0.52, 0.56],  // divider (optional)
          });
          rc.surface.setCharacterColorMap(charMap);
        }
      } else {
        window.__pendingBlockFill = false;
        window.__pendingEntities = entities;
        // Stash the color map until RC is ready
        window.__pendingCharacterColorMap = JSON.stringify({
          '#': [0.36, 0.38, 0.42],
          '.': [0.14, 0.14, 0.16],
          '~': [0.20, 0.40, 0.80],
          '+': [0.85, 0.65, 0.20],
          '|': [0.50, 0.52, 0.56],
        });
      }
    } catch (_) {}
  }

  function applyForRoute(route) {
    try {
      const STATES = window.APP_STATES || {};
      if (route === STATES.LOGIN) {
        setMapString(LOGIN_MAP);
        applyFloorAndEntities(LOGIN_MAP);
      } else if (route === STATES.LOBBY) {
        setMapString(LOBBY_MAP);
        applyFloorAndEntities(LOBBY_MAP);
      } else if (route === STATES.GAMEPLAY_ACTIVE) {
        // Gameplay dungeon is controlled by gameplay events (wireRoomEvents.js)
        // Do not override here.
      }
    } catch (_) {}
  }

  // Attempt to load shared generator (CommonJS) and override fallbacks
  try {
    import('@shared/dungeon/generator.js')
      .then((mod) => {
        try {
          const g = (mod && (mod.default || mod)) || null;
          let nextLogin = null;
          let nextLobby = null;
          if (g && typeof g.generateDungeon === 'function') {
            nextLogin = g.generateDungeon({ variant: 'login' });
            nextLobby = g.generateDungeon({ variant: 'lobby' });
          } else if (g && typeof g.getLoginBackgroundMap === 'function') {
            nextLogin = g.getLoginBackgroundMap();
            nextLobby = g.getLobbyBackgroundMap();
          }
          if (typeof nextLogin === 'string' && nextLogin) LOGIN_MAP = nextLogin;
          if (typeof nextLobby === 'string' && nextLobby) LOBBY_MAP = nextLobby;
          // Re-apply for current route to reflect updates
          try {
            const current = (typeof window.__getCurrentRoute === 'function') ? window.__getCurrentRoute() : null;
            if (current) applyForRoute(current);
          } catch (_) {}
        } catch (_) {}
      })
      .catch(() => {});
  } catch (_) {}

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
