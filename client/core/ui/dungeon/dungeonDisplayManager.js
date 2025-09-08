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

  // Track last route sprites so we can re-apply on Pixi readiness
  let __lastSprites = [];

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

  // Build a single sprite list from an ASCII map + optional extras (already sprite-shaped)
  // Each sprite: { id?, charCode, x, y, color(0xRRGGBB|[r,g,b]), alpha?, occludes? }
  function buildSpritesFromMap(mapString, extras = []) {
    const floors = [];
    const overlays = [];
    const rows = String(mapString || '').split('\n');
    const isWall = (x, y) => {
      if (y < 0 || y >= rows.length) return false;
      const row = rows[y] || '';
      if (x < 0 || x >= row.length) return false;
      return row[x] === '#';
    };
    const wallGlyph = (n, s, w, e) => {
      const mask = (n?1:0) | (s?2:0) | (w?4:0) | (e?8:0);
      switch (mask) {
        case 0:
        case 8:
        case 4:
        case 12: return { ch: '─', code: 196 };
        case 1:
        case 2:
        case 3:  return { ch: '│', code: 179 };
        case 9:  return { ch: '└', code: 192 };
        case 5:  return { ch: '┘', code: 217 };
        case 10: return { ch: '┌', code: 218 };
        case 6:  return { ch: '┐', code: 191 };
        case 7:  return { ch: '┤', code: 180 };
        case 11: return { ch: '├', code: 195 };
        case 14: return { ch: '┬', code: 194 };
        case 13: return { ch: '┴', code: 193 };
        case 15: return { ch: '┼', code: 197 };
        default: return { ch: '█', code: 219 };
      }
    };
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y] || '';
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]; if (ch == null) continue;
        // True floor pass: lay a floor on every cell so ambient-lit background is uniform
        floors.push({ x, y, charCode: 219, color: 0x303030, alpha: 1, occludes: false });
        // Overlays per content
        if (ch === '#') {
          const n = isWall(x, y - 1), s = isWall(x, y + 1), w = isWall(x - 1, y), e = isWall(x + 1, y);
          const g = wallGlyph(n, s, w, e);
          overlays.push({ x, y, charCode: g.code, color: 0xf0f0f0, alpha: 1, occludes: true  });
        } else if (ch === '@') {
          overlays.push({ x, y, charCode: 64, color: 0xFFFFFF, alpha: 1, occludes: false });
        } else if (ch !== ' ' && ch !== '.') {
          overlays.push({ x, y, charCode: String(ch).codePointAt(0), color: 0xFFFFFF, alpha: 1, occludes: false });
        }
      }
    }
    // Append extras (already in sprite spec shape)
    try {
      if (Array.isArray(extras) && extras.length) {
        for (const e of extras) {
          overlays.push({
            id: e.id,
            x: e.x|0, y: e.y|0,
            charCode: e.charCode,
            color: Array.isArray(e.color) ? e.color : (Number.isFinite(e.color) ? e.color : 0xFFFFFF),
            alpha: (e.alpha != null) ? e.alpha : 1,
            occludes: !!(e.occludes || e.blocking),
          });
        }
      }
    } catch (_) {}
    // Floors first, overlays after to guarantee proper layering
    return floors.concat(overlays);
  }

  function applySprites(sprites) {
    try {
      __lastSprites = sprites.slice();
    } catch (_) { __lastSprites = sprites; }
    try { if (window.pxr && typeof window.pxr.setSprites === 'function') window.pxr.setSprites(sprites); } catch (_) {}
    window.__pendingSprites = sprites;
  }

  // Resolve and apply sprites for a given route
  function applyForRoute(route) {
    try {
      const STATES = window.APP_STATES || {};
      const extras = route === STATES.LOGIN ? [
        // Three demo '@' sprites
        { id: 'demo-1', x: 2, y: 4, charCode: 64, color: [0.60, 0.60, 0.62], blocking: false },
        { id: 'demo-2', x: 30, y: 7, charCode: 64, color: [0.25, 0.45, 1.00], blocking: false },
        { id: 'demo-3', x: 48, y: 6, charCode: 64, color: [1.00, 0.28, 0.28], blocking: false },
        // Test: line-drawing characters as EXTRAS to compare transparency with map-origin walls
        // Small rectangle near top-left of corridor
        { id: 'lx', x: 6,  y: 2, color: [1.0, 0.28, 0.28], charCode: 196, blocking: false }, // H
        { id: 'lx2',x: 7,  y: 2, color: [1.0, 0.28, 0.28], charCode: 196, blocking: false },
        { id: 'lx3',x: 8,  y: 2, color: [1.0, 0.28, 0.28], charCode: 196, blocking: false },
        { id: 'ly1',x: 6,  y: 3, color: [1.0, 0.28, 0.28], charCode: 179, blocking: false }, // V
        { id: 'ly2',x: 8,  y: 3, color: [1.0, 0.28, 0.28], charCode: 179, blocking: false },
        { id: 'ltl',x: 6,  y: 2, color: [1.0, 0.28, 0.28], charCode: 218, blocking: false }, // TL
        { id: 'tr', x: 8,  y: 2, color: [1.0, 0.28, 0.28], charCode: 191, blocking: false }, // TR
        { id: 'bl', x: 6,  y: 4, color: [1.0, 0.28, 0.28], charCode: 192, blocking: false }, // BL
        { id: 'br', x: 8,  y: 4, color: [1.0, 0.28, 0.28], charCode: 217, blocking: false }, // BR
        // Caret as EXTRA to compare with map-origin '^'
        { id: 'caret-extra', x: 10, y: 2, color: [1.0, 0.28, 0.28], charCode: 94, blocking: false },
      ] : [];
      const map = route === STATES.LOGIN ? LOGIN_MAP : route === STATES.LOBBY ? LOBBY_MAP : null;
      if (map) applySprites(buildSpritesFromMap(map, extras));
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

  // When Pixi renderer signals readiness, re-apply the current route (or last map)
  window.addEventListener('pxr:ready', () => {
    try {
      const current = (typeof window.__getCurrentRoute === 'function') ? window.__getCurrentRoute() : null;
      if (current) {
        applyForRoute(current);
      } else if (__lastSprites && __lastSprites.length) {
        applySprites(__lastSprites);
      }
    } catch (_) {}
  });

  // Apply immediately for current route on first load
  try {
    const current = (typeof window.__getCurrentRoute === 'function') ? window.__getCurrentRoute() : null;
    if (current) applyForRoute(current);
  } catch (_) {}
})();

// Developer helpers
try { window.DDM = Object.freeze({ buildSpritesFromMap, debugAsciiGrid }); } catch (_) {}

// Build a debug map that shows ASCII/CP437 codes (default 32..256) twice:
// - Left group as MAP TILES (actual tile glyphs)
// - Right group as ENTITIES drawn over a dim background
// You can override range/shape via opts: { start, end, cols, blackKey, threshold }
function debugAsciiGrid(opts = {}) {
  const start = Number.isFinite(opts.start) ? (opts.start|0) : 32;
  const end = Number.isFinite(opts.end) ? (opts.end|0) : 256; // inclusive
  const count = Math.max(0, (end - start + 1));
  const groupCols = Math.max(1, Math.min(64, Number.isFinite(opts.cols) ? (opts.cols|0) : 16));
  const groupRows = Math.max(1, Math.ceil(count / groupCols));
  const gap = 2; // columns between groups
  const pad = 1; // border padding
  const leftX = pad;
  const topY = pad;
  const groupX0 = leftX;                     // ASCII group A
  const groupX1 = leftX + groupCols + gap;   // ASCII group B (mirrored as separate region)
  const groupX2 = groupX1 + groupCols + gap; // Alternating floors A
  const groupX3 = groupX2 + groupCols + gap; // Alternating floors B
  const groupX4 = groupX3 + groupCols + gap; // Rooms A
  const groupX5 = groupX4 + groupCols + gap; // Rooms B
  const width = groupX5 + groupCols + pad;
  const height = topY + groupRows + pad;

  const sprites = [];

  const occlAscii = !!opts.occludesAscii;
  const occlRooms = !!opts.occludesRooms;

  // Group 0: ASCII tiles as-is
  let code = start;
  for (let gy = 0; gy < groupRows; gy++) {
    for (let gx = 0; gx < groupCols; gx++) {
      if (code > end) break;
      sprites.push({ id: `dbg-a-${code}`, charCode: code, x: groupX0 + gx, y: topY + gy, color: 0xFFFFFF, alpha: 1, occludes: occlAscii });
      code++;
    }
  }

  // Group 1: ASCII tiles mirrored to a second region
  code = start;
  for (let gy = 0; gy < groupRows; gy++) {
    for (let gx = 0; gx < groupCols; gx++) {
      if (code > end) break;
      sprites.push({ id: `dbg-b-${code}`, charCode: code, x: groupX1 + gx, y: topY + gy, color: 0xFFFFFF, alpha: 1, occludes: occlAscii });
      code++;
    }
  }

  // Group 2: alternating floor rows (█)
  const floorCh = '█';
  for (let gy = 0; gy < groupRows; gy++) {
    const useFloorRow = (gy % 2) === 0;
    if (!useFloorRow) continue;
    for (let gx = 0; gx < groupCols; gx++) {
      sprites.push({ id: `dbg-f-a-${gy}-${gx}`, charCode: 219, x: groupX2 + gx, y: topY + gy, color: 0xFFFFFF, alpha: 1, occludes: false });
    }
  }

  // Group 3: alternating floor rows again in a second region
  for (let gy = 0; gy < groupRows; gy++) {
    const useFloorRow = (gy % 2) === 0;
    if (!useFloorRow) continue;
    for (let gx = 0; gx < groupCols; gx++) {
      sprites.push({ id: `dbg-f-b-${gy}-${gx}`, charCode: 219, x: groupX3 + gx, y: topY + gy, color: 0xFFFFFF, alpha: 1, occludes: false });
    }
  }

  // Helpers to push CP437 box glyphs into sprites for rooms
  const H = 196, V = 179, TL = 218, TR = 191, BL = 192, BR = 217;
  function drawBoxToSprites(gxBase, ox, oy, w, h) {
    if (w < 2 || h < 2) return;
    const y0 = topY + oy, y1 = topY + oy + h - 1;
    const x0 = gxBase + ox, x1 = gxBase + ox + w - 1;
    for (let x = x0 + 1; x <= x1 - 1; x++) {
      sprites.push({ id: `dbg-r-top-${x}-${y0}` , charCode: H, x, y: y0, color: 0xFFFFFF, alpha: 1, occludes: occlRooms });
      sprites.push({ id: `dbg-r-bot-${x}-${y1}` , charCode: H, x, y: y1, color: 0xFFFFFF, alpha: 1, occludes: occlRooms });
    }
    for (let y = y0 + 1; y <= y1 - 1; y++) {
      sprites.push({ id: `dbg-r-left-${x0}-${y}` , charCode: V, x: x0, y, color: 0xFFFFFF, alpha: 1, occludes: occlRooms });
      sprites.push({ id: `dbg-r-right-${x1}-${y}` , charCode: V, x: x1, y, color: 0xFFFFFF, alpha: 1, occludes: occlRooms });
    }
    sprites.push({ id: `dbg-r-tl-${x0}-${y0}`, charCode: TL, x: x0, y: y0, color: 0xFFFFFF, alpha: 1, occludes: occlRooms });
    sprites.push({ id: `dbg-r-tr-${x1}-${y0}`, charCode: TR, x: x1, y: y0, color: 0xFFFFFF, alpha: 1, occludes: occlRooms });
    sprites.push({ id: `dbg-r-bl-${x0}-${y1}`, charCode: BL, x: x0, y: y1, color: 0xFFFFFF, alpha: 1, occludes: occlRooms });
    sprites.push({ id: `dbg-r-br-${x1}-${y1}`, charCode: BR, x: x1, y: y1, color: 0xFFFFFF, alpha: 1, occludes: occlRooms });
  }

  // Group 4/5: rooms in two regions
  const roomPad = 1;
  const rW = groupCols - roomPad * 2;
  const rH = Math.max(4, Math.min(groupRows - roomPad * 2, Math.floor(groupRows * 0.6)));
  drawBoxToSprites(groupX4, roomPad, roomPad, Math.max(6, rW), rH);
  drawBoxToSprites(groupX4, roomPad + 1, roomPad + 1, Math.max(4, Math.floor(rW * 0.5)), Math.max(4, Math.floor(rH * 0.5)));
  drawBoxToSprites(groupX4, roomPad + Math.max(2, Math.floor(rW * 0.35)), roomPad + Math.max(2, Math.floor(rH * 0.45)), Math.max(5, Math.floor(rW * 0.6)), Math.max(4, Math.floor(rH * 0.5)));
  drawBoxToSprites(groupX5, roomPad, roomPad, Math.max(6, rW), rH);
  drawBoxToSprites(groupX5, roomPad + 1, roomPad + 1, Math.max(4, Math.floor(rW * 0.5)), Math.max(4, Math.floor(rH * 0.5)));
  drawBoxToSprites(groupX5, roomPad + Math.max(2, Math.floor(rW * 0.35)), roomPad + Math.max(2, Math.floor(rH * 0.45)), Math.max(5, Math.floor(rW * 0.6)), Math.max(4, Math.floor(rH * 0.5)));

  // Apply to renderer (unified sprite pipeline)
  try { if (window.pxr && typeof window.pxr.setSprites === 'function') window.pxr.setSprites(sprites); } catch (_) {}
  try { window.__pendingSprites = sprites; } catch (_) {}

  // Optional: black-key for quick inspection
  if (opts.blackKey) {
    try { window.pxr && window.pxr.enableBlackKeyFilters(Number.isFinite(opts.threshold) ? opts.threshold : undefined); } catch (_) {}
  }
}
