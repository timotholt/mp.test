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
    '#..........#....#.................#....#...................#',
    '#..........######.................######...................#',
    '#..........................................................#',
    '#.............######....................######.............#',
    '#.............#....#....................#....#.............#',
    '#.............#....#....................#....#.............#',
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
      // Change FLOOR glyphs for display only:
      // - '.' -> '█' (solid floor plate)
      // - '#' -> ' ' (space) so walls are not drawn on FLOOR; walls render via ENTITIES only
      const src = String(mapString || '');
      const floorMapped = src.replace(/\./g, '█').replace(/#/g, ' ');
      // Prefer Pixi: apply immediately if available, otherwise stash for Pixi boot
      if (window.pxr && typeof window.pxr.setDungeonMap === 'function') {
        window.pxr.setDungeonMap(floorMapped);
      }
      window.__pendingDungeonMap = floorMapped;
    } catch (_) {}
  }

  // Build entity list from a floor map. Floors remain in mapString visually.
  // We add entities on top only for walls ('#') and the player '@'.
  function computeEntitiesFromMap(mapString) {
    const entities = [];
    const rows = String(mapString || '').split('\n');
    // Helper: check if a position is a wall ('#') within bounds
    const isWall = (x, y) => {
      if (y < 0 || y >= rows.length) return false;
      const row = rows[y] || '';
      if (x < 0 || x >= row.length) return false;
      return row[x] === '#';
    };
    // Map a bitmask of neighbors (N=1,S=2,W=4,E=8) to CP437 box-drawing glyphs
    const wallGlyph = (n, s, w, e) => {
      const mask = (n?1:0) | (s?2:0) | (w?4:0) | (e?8:0);
      switch (mask) {
        case 0: // isolated; default to horizontal
        case 8: // E only
        case 4: // W only
        case 12: // W+E
          return { ch: '─', code: 196 };
        case 1: // N only
        case 2: // S only
        case 3: // N+S
          return { ch: '│', code: 179 };
        case 9: // N+E -> bottom-left corner
          return { ch: '└', code: 192 };
        case 5: // N+W -> bottom-right corner
          return { ch: '┘', code: 217 };
        case 10: // S+E -> top-left corner
          return { ch: '┌', code: 218 };
        case 6: // S+W -> top-right corner
          return { ch: '┐', code: 191 };
        case 7: // N+S+W -> tee right
          return { ch: '┤', code: 180 };
        case 11: // N+S+E -> tee left
          return { ch: '├', code: 195 };
        case 14: // S+W+E -> tee up
          return { ch: '┬', code: 194 };
        case 13: // N+W+E -> tee down
          return { ch: '┴', code: 193 };
        case 15: // all
          return { ch: '┼', code: 197 };
        default:
          return { ch: '█', code: 219 }; // fallback to solid
      }
    };
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '#') {
          // Use ANSI/CP437 box-drawing based on 4-neighbor connectivity
          const n = isWall(x, y - 1);
          const s = isWall(x, y + 1);
          const w = isWall(x - 1, y);
          const e = isWall(x + 1, y);
          const g = wallGlyph(n, s, w, e);
          entities.push({ x, y, char: g.ch, charCode: g.code, color: [0.30, 0.30, 0.30], blocking: true });
        } else if (ch === '@') {
          // Player '@' should be white in the entities layer
          // entities.push({ x, y, char: '@', color: [0.5, 0.5, 0.5], blocking: false });
          //entities.push({ x, y, char: '@', color: [0.5, 0.5, 0.5], blocking: false });
        }
      }
    }
    return entities;
  }

  // Apply floors as non-blocking and walls/entities as blocking layer over the floor.
  function applyFloorAndEntities(mapString) {
    try {
      const entities = computeEntitiesFromMap(mapString);
      // Merge any additional, route-specific entities (e.g., demo humans)
      try {
        if (Array.isArray(window.__extraDemoEntities) && window.__extraDemoEntities.length) {
          entities.push.apply(entities, window.__extraDemoEntities);
        }
      } catch (_) {}
      // Push to Pixi immediately if active; also stash for boot-time consumption.
      try { if (window.pxr && typeof window.pxr.setEntities === 'function') { window.pxr.setEntities(entities); } } catch (_) {}
      window.__pendingEntities = entities;
    } catch (_) {}
  }

  function applyForRoute(route) {
    try {
      const STATES = window.APP_STATES || {};
      if (route === STATES.LOGIN) {
        setMapString(LOGIN_MAP);
        // Place three colored humans via entity list (white, blue, red). Non-blocking, moderate tint.
        // Coordinates chosen to sit on the open floor row near the bottom (y=10) inside the corridor.
        window.__extraDemoEntities = [
          { x: 2, y: 4, char: '@', charCode: 64, color: [0.60, 0.60, 0.62], blocking: false }, // white
          { x: 30, y: 7, char: '@', charCode: 64, color: [0.25, 0.45, 1.00], blocking: false }, // blue (Ultramarines-like)
          { x: 48, y: 6, char: '@', charCode: 64, color: [1.00, 0.28, 0.28], blocking: false }, // red (Blood Angels-like)
        ];
        applyFloorAndEntities(LOGIN_MAP);
      } else if (route === STATES.LOBBY) {
        setMapString(LOBBY_MAP);
        // No extra demo entities on Lobby by default
        window.__extraDemoEntities = [];
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
