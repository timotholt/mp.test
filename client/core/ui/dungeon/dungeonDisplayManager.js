// Centralized event-driven dungeon map switching (plain JS)
// Listens for route changes and sets the background dungeon accordingly.
// - LOGIN: dungeon #1
// - LOBBY: dungeon #2
// - GAMEPLAY_ACTIVE: do nothing (gameplay owns dungeon via server events)

(function initDungeonDisplayManager(){
  if (typeof window === 'undefined') return;

  // TEST MAP: 0-based glyph indices as raw codes. The renderer splits rows on '\n' (code 10),
  // so we cannot embed code 10 inside a row. We substitute that single cell with code 0 and
  // log a warning. All other codes 0..55 are emitted as-is so you can verify atlas indexing.
  function makeSequentialGlyphTest(rows, cols, startCode) {
    const r = Math.max(1, rows|0), c = Math.max(1, cols|0);
    const start = Number.isFinite(startCode) ? startCode : 32;
    const lines = [];
    for (let y = 0; y < r; y++) {
      let row = '';
      for (let x = 0; x < c; x++) {
        const code = start + y * c + x;
        if (code === 10) {
          // Avoid newline breaking row; use glyph 0 for this single cell
          try { console.warn('[TEST] substituted glyph 10 (newline) with 0 at', { y, x }); } catch (_) {}
          row += String.fromCharCode(0);
        } else {
          row += String.fromCharCode(code);
        }
      }
      lines.push(row);
    }
    try {
      console.log('[TEST] glyph index grid', { rows: r, cols: c, start });
    } catch (_) {}
    return lines.join('\n');
  }

  // Use a consistent test dimension for both map and color overlay
  // Expand to 8x16 so row 0 displays glyphs 0..15 as requested
  const TEST_ROWS = 8;
  const TEST_COLS = 16;

  // 8 rows x 16 cols = 128 glyphs starting at 0 (0..127). Note glyph 10 is substituted to 0.
  let LOGIN_MAP = makeSequentialGlyphTest(TEST_ROWS, TEST_COLS, 0);
  // Mirror the same test in the lobby for convenience
  let LOBBY_MAP = makeSequentialGlyphTest(TEST_ROWS, TEST_COLS, 0);

  // Apply a position color map over an axis-aligned block (inclusive ranges)
  function applyBlockColor(x0, y0, x1, y1, rgb) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v|0));
    const nx = (rgb[0] / 255), ny = (rgb[1] / 255), nz = (rgb[2] / 255);
    const map = {};
    const xs = clamp(x0, 0, TEST_COLS - 1), xe = clamp(x1, 0, TEST_COLS - 1);
    const ys = clamp(y0, 0, TEST_ROWS - 1), ye = clamp(y1, 0, TEST_ROWS - 1);
    for (let y = ys; y <= ye; y++) {
      for (let x = xs; x <= xe; x++) {
        map[`${x},${y}`] = [nx, ny, nz];
      }
    }
    const payload = JSON.stringify(map);
    try {
      const rc = window.radianceCascades;
      if (rc && rc.surface && typeof rc.surface.setPositionColorMap === 'function') {
        rc.surface.setPositionColorMap(payload);
      } else {
        window.__pendingPositionColorMap = payload;
      }
    } catch (_) {}
  }

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
        // Color the entire 8x8 test area dark gray (10,10,10)
        applyBlockColor(0, 0, TEST_COLS - 1, TEST_ROWS - 1, [90, 90, 90]);
      } else if (route === STATES.LOBBY) {
        setMapString(LOBBY_MAP);
        // Color the entire 8x8 test area dark gray (10,10,10)
        applyBlockColor(0, 0, TEST_COLS - 1, TEST_ROWS - 1, [40, 40, 40]);
      } else if (route === STATES.GAMEPLAY_ACTIVE) {
        // Gameplay dungeon is controlled by gameplay events (wireRoomEvents.js)
        // Do not override here.
      }
    } catch (_) {}
  }

  // Commented out: dynamic shared generator override. Keep our test map visible.
  // try {
  //   import('@shared/dungeon/generator.js')
  //     .then((mod) => {
  //       // disabled during test
  //     })
  //     .catch(() => {});
  // } catch (_) {}

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
