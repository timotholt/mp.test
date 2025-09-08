// PixiJS-based dungeon renderer (JS-only, no HTML/CSS changes)
// Goals:
// - Use WebGL via PixiJS for tile/atlas rendering
// - Reuse fonts from Display tab (listens to 'ui:dungeon-font-changed')
// - Provide a dungeon->screen translation layer (camera)
// - Support multi-pass pipeline with a placeholder GI/ray-march-like filter
// - Separate visual tint (albedo) from emission; keep emission decoupled
// - Support simple tweened animation between snapped dungeon addresses
//
// This module does not replace the existing ASCII renderer; it's additive.
// You can boot it from DevTools:
//   window.bootPixiRenderer && window.bootPixiRenderer();
//
// Public API (exposed on window.pxr):
// - init(opts)
// - setFont(meta)
// - setDungeonMap(mapString)
// - setEntities(list)
// - panCamera(dx, dy)
// - zoomCamera(factor, ax, ay)
// - toScreen({ x, y }) -> { x, y }
// - animateEntity(id, toX, toY, opts)
// - destroy()

(function () {
  if (typeof window === 'undefined') return;

  // Lazy PIXI loader to avoid touching package.json.
  async function loadPixi() {
    if (window.PIXI) return window.PIXI;
    // Try ESM CDN first, fall back to UMD + global if needed.
    try {
      const m = await import('https://cdn.skypack.dev/pixi.js@7');
      if (m && (m.Application || m.default)) {
        const PIXI = m;
        window.PIXI = PIXI;
        return PIXI;
      }

    // Debug helper: set UV inset in pixels (applies to future texture frame builds)
    function setUvInsetPx(px) {
      try { state.debug.uvInsetPx = Number(px) || 0; state.textures.byCode.clear(); rebuildMap(); setEntities(state.lastEntities||[]); } catch (_) {}
    }

      // (helpers moved into createRendererAPI)

  // Placeholder GI-like filter (single-pass). Tunable and replaceable.
  function createGiFilter(PIXI) {
    const frag = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uFogAmount;
uniform float uFalloff;

// Very lightweight halo/falloff effect + subtle filmic curve.
void main() {
  vec2 uv = vTextureCoord;
  vec4 base = texture2D(uSampler, uv);

  // Fake bounce light by sampling a small neighborhood
  vec3 accum = base.rgb;
  float k = 0.08; // small kernel weight
  accum += texture2D(uSampler, uv + vec2( 1.0/1024.0,  0.0)).rgb * k;
  accum += texture2D(uSampler, uv + vec2(-1.0/1024.0,  0.0)).rgb * k;
  accum += texture2D(uSampler, uv + vec2( 0.0,  1.0/1024.0)).rgb * k;
  accum += texture2D(uSampler, uv + vec2( 0.0, -1.0/1024.0)).rgb * k;

  // Distance-based falloff from center (placeholder for ray-march distance)
  vec2 dc = uv - 0.5;
  float d = length(dc);
  float fog = clamp(uFogAmount * smoothstep(0.3, 0.8, d), 0.0, 1.0);

  // Fake sRGB-ish falloff shaping
  float decay = 1.0 / (1.0 + uFalloff * d * 3.0);
  vec3 lit = mix(accum, accum * decay, 0.85);

  // Filmic-like tone map (very mild)
  vec3 x = max(vec3(0.0), lit - 0.004);
  vec3 mapped = (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);

  // Apply fog
  vec3 color = mix(mapped, vec3(0.0), fog);
  gl_FragColor = vec4(color, base.a);
}
`;
    const uniforms = { uTime: 0, uFogAmount: 0.2, uFalloff: 1.8 };
    return new PIXI.Filter(undefined, frag, uniforms);
  }

  // Chroma-key style transparency: discard near-black pixels for atlases without alpha
  function createBlackKeyFilter(PIXI) {
    const frag = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uThreshold; // 0..1
void main() {
  vec4 c = texture2D(uSampler, vTextureCoord);
  float mx = max(c.r, max(c.g, c.b));
  // Keep only pixels brighter than threshold; multiply by original alpha
  float a = c.a * step(uThreshold, mx);
  gl_FragColor = vec4(c.rgb, a);
}`;
    const uniforms = { uThreshold: 0.025 };
    return new PIXI.Filter(undefined, frag, uniforms);
  }

    } catch (_) {}
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/pixi.js@7/dist/pixi.min.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load PIXI UMD'));
        document.head.appendChild(s);
      });
      if (window.PIXI) return window.PIXI;
    } catch (e) {
      console.error('[pixiDungeonRenderer] Unable to load PixiJS', e);
      throw e;
    }
  }

  // Top-level filters (available to the renderer API)
  function createGiFilter(PIXI) {
    const frag = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uFogAmount;
uniform float uFalloff;

void main() {
  vec2 uv = vTextureCoord;
  vec4 base = texture2D(uSampler, uv);
  vec3 accum = base.rgb;
  float k = 0.08;
  accum += texture2D(uSampler, uv + vec2( 1.0/1024.0,  0.0)).rgb * k;
  accum += texture2D(uSampler, uv + vec2(-1.0/1024.0,  0.0)).rgb * k;
  accum += texture2D(uSampler, uv + vec2( 0.0,  1.0/1024.0)).rgb * k;
  accum += texture2D(uSampler, uv + vec2( 0.0, -1.0/1024.0)).rgb * k;
  vec2 dc = uv - 0.5;
  float d = length(dc);
  float fog = clamp(uFogAmount * smoothstep(0.3, 0.8, d), 0.0, 1.0);
  float decay = 1.0 / (1.0 + uFalloff * d * 3.0);
  vec3 lit = mix(accum, accum * decay, 0.85);
  vec3 x = max(vec3(0.0), lit - 0.004);
  vec3 mapped = (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
  vec3 color = mix(mapped, vec3(0.0), fog);
  gl_FragColor = vec4(color, base.a);
}`;
    const uniforms = { uTime: 0, uFogAmount: 0.2, uFalloff: 1.8 };
    return new PIXI.Filter(undefined, frag, uniforms);
  }

  function createBlackKeyFilter(PIXI) {
    const frag = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uThreshold; // 0..1
void main() {
  vec4 c = texture2D(uSampler, vTextureCoord);
  float mx = max(c.r, max(c.g, c.b));
  float a = c.a * step(uThreshold, mx);
  gl_FragColor = vec4(c.rgb, a);
}`;
    const uniforms = { uThreshold: 0.025 };
    return new PIXI.Filter(undefined, frag, uniforms);
  }

  // Small helper: clamp
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function createRendererAPI(PIXI) {
    // Internal state
    const state = {
      app: null,
      root: null,
      layers: {
        tiles: null,
        entities: null,
        ui: null,
      },
      rt: { scene: null, sprite: null },
      giFilter: null,
      filterChain: [],
      camera: { x: 0, y: 0, scale: 1 },
      pixelPerfect: true,
      tile: { w: 8, h: 8 },
      atlas: { cols: 16, rows: 16, startCode: 32 },
      flip: { tileY: false, row: false },
      textures: { base: null, byCode: new Map(), originalBase: null },
      map: { rows: [], width: 0, height: 0 },
      entityById: new Map(), // id -> { sprite, emission }
      lastEntities: [], // remember latest desired entities to reapply post-font-load
      raf: 0,
      startTs: performance.now(),
      debug: { floorBgTint: null, uvInsetPx: 0 },
      flags: { useRT: true },
    };

    // Helpers: coordinate transforms
    function dungeonToWorld(x, y) {
      // Map integer dungeon coords to world-space pixel coords (top-left of tile)
      return { x: x * state.tile.w, y: y * state.tile.h };
    }
    function worldToScreen(x, y) {
      const s = state.camera.scale;
      return { x: (x - state.camera.x) * s, y: (y - state.camera.y) * s };
    }
    function dungeonToScreen(dx, dy) {
      const p = dungeonToWorld(dx, dy);
      return worldToScreen(p.x, p.y);
    }

    // Build/cached glyph texture for a char code
    function textureForCode(code) {
      const key = code | 0;
      const cached = state.textures.byCode.get(key);
      if (cached) return cached;
      const base = state.textures.base;
      if (!base || !base.valid) return null;
      const start = state.atlas.startCode | 0;
      let idx = Math.max(0, key - start);
      // Derive atlas layout from base texture size (respecting optional extrusion padding)
      const pad = Number(state.atlas.pad || 0);
      const cellW = state.tile.w + pad * 2;
      const cellH = state.tile.h + pad * 2;
      const cols = Math.max(1, Math.floor(base.width / (cellW || state.tile.w)));
      const rows = Math.max(1, Math.floor(base.height / (cellH || state.tile.h)));
      const maxIndex = (cols * rows) - 1;
      if (idx > maxIndex) idx = idx % (maxIndex + 1);
      const sx = (idx % cols) * (cellW || state.tile.w) + pad;
      let rowIdx = Math.floor(idx / cols);
      // If the atlas is stored upside-down, invert the row index using derived rows
      if (state.flip.tileY && Number.isFinite(rows) && rows > 0) {
        rowIdx = (rows - 1) - rowIdx;
      }
      const sy = rowIdx * (cellH || state.tile.h) + pad;
      // Optional UV inset to avoid sampling atlas gutters
      let inset = (state.debug && Number.isFinite(state.debug.uvInsetPx)) ? Number(state.debug.uvInsetPx) : 0;
      // Apply a small permanent inset for thin CP437 line glyphs to reduce sporadic edge artifacts
      try {
        const LINE_CODES = [179,196,218,191,192,217,180,195,194,193,197];
        if (LINE_CODES.indexOf(key) !== -1) {
          inset = Math.max(inset, 0.25);
        }
      } catch (_) {}
      inset = Math.max(0, Math.min(inset, Math.min(state.tile.w, state.tile.h) * 0.49));
      const frame = (inset > 0)
        ? new PIXI.Rectangle(sx + inset, sy + inset, state.tile.w - inset * 2, state.tile.h - inset * 2)
        : new PIXI.Rectangle(sx, sy, state.tile.w, state.tile.h);
      const tex = new PIXI.Texture(base, frame);
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      state.textures.byCode.set(key, tex);
      return tex;
    }

    // Build an extruded atlas on a canvas by duplicating edge pixels to create gutters.
    function buildExtrudedAtlas(base, padPx) {
      try {
        const pad = Math.max(0, Math.floor(Number(padPx) || 0));
        if (!pad) return null;
        const src = base && base.resource && base.resource.source; // HTMLImageElement/Canvas
        if (!src || !base.valid) return null;
        const tW = state.tile.w, tH = state.tile.h;
        const cols = Math.max(1, Math.floor(base.width / tW));
        const rows = Math.max(1, Math.floor(base.height / tH));
        const cellW = tW + pad*2;
        const cellH = tH + pad*2;
        const outW = cols * cellW;
        const outH = rows * cellH;
        const canvas = document.createElement('canvas');
        canvas.width = outW; canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.imageSmoothingEnabled = false;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const sx0 = c * tW;
            const sy0 = r * tH;
            const dx0 = c * cellW + pad;
            const dy0 = r * cellH + pad;
            // center
            ctx.drawImage(src, sx0, sy0, tW, tH, dx0, dy0, tW, tH);
            // edges
            // left/right strips
            ctx.drawImage(src, sx0, sy0, 1, tH, dx0 - pad, dy0, pad, tH);
            ctx.drawImage(src, sx0 + tW - 1, sy0, 1, tH, dx0 + tW, dy0, pad, tH);
            // top/bottom strips
            ctx.drawImage(src, sx0, sy0, tW, 1, dx0, dy0 - pad, tW, pad);
            ctx.drawImage(src, sx0, sy0 + tH - 1, tW, 1, dx0, dy0 + tH, tW, pad);
            // corners
            ctx.drawImage(src, sx0, sy0, 1, 1, dx0 - pad, dy0 - pad, pad, pad);
            ctx.drawImage(src, sx0 + tW - 1, sy0, 1, 1, dx0 + tW, dy0 - pad, pad, pad);
            ctx.drawImage(src, sx0, sy0 + tH - 1, 1, 1, dx0 - pad, dy0 + tH, pad, pad);
            ctx.drawImage(src, sx0 + tW - 1, sy0 + tH - 1, 1, 1, dx0 + tW, dy0 + tH, pad, pad);
          }
        }
        const newBase = PIXI.BaseTexture.from(canvas);
        try { newBase.scaleMode = PIXI.SCALE_MODES.NEAREST; } catch (_) {}
        return { base: newBase, pad };
      } catch (_) { return null; }
    }

    function enableAtlasExtrude(padPx = 1) {
      try {
        const base = state.textures.originalBase || state.textures.base;
        if (!base || !base.valid) return false;
        const out = buildExtrudedAtlas(base, padPx);
        if (!out) return false;
        state.textures.byCode.clear();
        state.textures.base = out.base;
        state.atlas.pad = out.pad;
        rebuildMap();
        try { if (state.lastEntities && state.lastEntities.length) setEntities(state.lastEntities); } catch (_) {}
        return true;
      } catch (_) { return false; }
    }

    function disableAtlasExtrude() {
      try {
        if (!state.textures.originalBase) return false;
        state.textures.byCode.clear();
        state.textures.base = state.textures.originalBase;
        state.atlas.pad = 0;
        rebuildMap();
        try { if (state.lastEntities && state.lastEntities.length) setEntities(state.lastEntities); } catch (_) {}
        return true;
      } catch (_) { return false; }
    }

    function rebuildMap() {
      if (!state.layers.tiles) return;
      const layer = state.layers.tiles;
      layer.removeChildren();
      const rows = state.map.rows;
      for (let y = 0; y < rows.length; y++) {
        const row = rows[y];
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          // Floors are rendered as Unicode '█' (U+2588) by dungeonDisplayManager,
          // but our atlases are laid out in CP437 order where full block is code 219.
          // Remap that single glyph so it selects the correct atlas cell.
          const cp = (ch && ch.codePointAt) ? (ch.codePointAt(0) || 32) : 32;
          const code = (cp === 0x2588 /* Unicode full block */) ? 219 : cp;
          const tex = textureForCode(code);
          if (!tex) continue;
          const spr = new PIXI.Sprite(tex);
          try { spr.roundPixels = true; } catch (_) {}
          spr.anchor.set(0, 0); // top-left of tile
          const wp = dungeonToWorld(x, y);
          spr.x = wp.x; spr.y = wp.y;
          // Apply per-glyph tint on the floor map to avoid blinding white floors.
          try {
            if (ch === '█') {
              // Dark plate floor (approx RGB ~0.03)
              spr.tint = 0x080808;
            } else if (ch === '░' || ch === '.') {
              // Allow debug override for background floor tint
              const t = (state.debug && state.debug.floorBgTint != null) ? state.debug.floorBgTint : 0x242424;
              spr.tint = t;
            }
          } catch (_) {}
          // If rows are vertically flipped inside tiles, flip the sprite.
          if (state.flip.row) { spr.scale.y = -1; spr.y += state.tile.h; }
          layer.addChild(spr);
        }
      }
    }

    function setEntities(list) {
      const layer = state.layers.entities;
      if (!layer) return;
      // Reuse existing sprites if ids match; otherwise rebuild simply.
      layer.removeChildren();
      state.entityById.clear();
      if (!Array.isArray(list)) { state.lastEntities = []; return; }
      // Remember latest desired entities in case font loads after this call
      try { state.lastEntities = list.slice(); } catch (_) { state.lastEntities = list; }
      list.forEach((e, idx) => {
        const code = (Number.isFinite(e.charCode) ? e.charCode : (String(e.char||' ').codePointAt(0) || 32));
        const tex = textureForCode(code);
        if (!tex) return;
        const spr = new PIXI.Sprite(tex);
        try { spr.roundPixels = true; } catch (_) {}
        spr.anchor.set(0, 0);
        const wp = dungeonToWorld(e.x|0, e.y|0);
        spr.x = wp.x; spr.y = wp.y;
        if (state.flip.row) { spr.scale.y = -1; spr.y += state.tile.h; }
        // Albedo tint from entity color property (array [r,g,b] 0..1)
        try {
          if (Array.isArray(e.color) && e.color.length >= 3) {
            const r = clamp(Math.round((e.color[0]||0) * 255), 0, 255);
            const g = clamp(Math.round((e.color[1]||0) * 255), 0, 255);
            const b = clamp(Math.round((e.color[2]||0) * 255), 0, 255);
            spr.tint = (r<<16) | (g<<8) | b;
          } else {
            spr.tint = 0xFFFFFF;
          }
        } catch (_) { spr.tint = 0xFFFFFF; }
        layer.addChild(spr);
        const id = e.id != null ? e.id : idx;
        state.entityById.set(id, { sprite: spr, emission: (e.emission != null ? e.emission : 0) });
      });
    }

    // Enable chroma-key style transparency on both tile and entity layers
    function enableBlackKeyFilters(threshold) {
      try {
        const fkTiles = createBlackKeyFilter(PIXI);
        const fkEnt = createBlackKeyFilter(PIXI);
        if (threshold != null && Number.isFinite(threshold)) {
          fkTiles.uniforms.uThreshold = Number(threshold);
          fkEnt.uniforms.uThreshold = Number(threshold);
        }
        if (state.layers.tiles) state.layers.tiles.filters = [fkTiles];
        if (state.layers.entities) state.layers.entities.filters = [fkEnt];
        state.blackKeyFilters = { tiles: fkTiles, entities: fkEnt };
      } catch (_) {}
    }

    // Disable black-key filters on both layers
    function disableBlackKeyFilters() {
      try { if (state.layers.tiles) state.layers.tiles.filters = null; } catch (_) {}
      try { if (state.layers.entities) state.layers.entities.filters = null; } catch (_) {}
      state.blackKeyFilters = null;
    }

    // Apply black-key only to ENTITIES layer (useful when floors are atlas tiles)
    function enableBlackKeyOnEntities(threshold) {
      try {
        const fk = createBlackKeyFilter(PIXI);
        if (threshold != null && Number.isFinite(threshold)) fk.uniforms.uThreshold = Number(threshold);
        if (state.layers.entities) state.layers.entities.filters = [fk];
        // Do not touch tiles layer
        state.blackKeyFilters = Object.assign({}, state.blackKeyFilters, { entities: fk });
      } catch (_) {}
    }

    // Build a debug map that shows ASCII/CP437 codes (default 32..256) twice:
    // - Left group as MAP TILES (actual tile glyphs)
    // - Right group as ENTITIES drawn over a dim background
    // You can override range/shape via opts: { start, end, cols, blackKey, threshold }
    function debugAsciiGrid(opts = {}) {
      // Allow overriding the dim floor tint to make background more visible during tests
      try {
        const def = 0x0b3a7a; // dark blue
        let tint = def;
        if (opts && opts.bgTint != null) {
          if (typeof opts.bgTint === 'number') {
            tint = opts.bgTint | 0;
          } else if (typeof opts.bgTint === 'string') {
            const s = String(opts.bgTint).trim();
            const hex = s.startsWith('#') ? s.slice(1) : s;
            const n = parseInt(hex, 16);
            if (Number.isFinite(n)) tint = n >>> 0;
          }
        }
        state.debug.floorBgTint = tint;
      } catch (_) {}
      try { if (opts && opts.uvInsetPx != null) state.debug.uvInsetPx = Number(opts.uvInsetPx) || 0; } catch (_) {}
      const start = Number.isFinite(opts.start) ? (opts.start|0) : 32;
      const end = Number.isFinite(opts.end) ? (opts.end|0) : 256; // inclusive
      const count = Math.max(0, (end - start + 1));
      const groupCols = Math.max(1, Math.min(64, Number.isFinite(opts.cols) ? (opts.cols|0) : 16));
      const groupRows = Math.max(1, Math.ceil(count / groupCols));
      const gap = 2; // columns between groups
      const pad = 1; // border padding
      const leftX = pad;
      const topY = pad;
      const groupX0 = leftX;                     // ASCII as map tiles
      const groupX1 = leftX + groupCols + gap;   // ASCII as entities
      const groupX2 = groupX1 + groupCols + gap; // Alternating floor rows as map
      const groupX3 = groupX2 + groupCols + gap; // Alternating floor rows as entities
      const groupX4 = groupX3 + groupCols + gap; // Rooms as map tiles
      const groupX5 = groupX4 + groupCols + gap; // Rooms as entities
      const width = groupX5 + groupCols + pad;
      const height = topY + groupRows + pad;

      // Background tile to make black-key artifacts visible: use '.' which we tint to 0x242424 in rebuildMap().
      const bg = '.';
      const grid = [];
      for (let y = 0; y < height; y++) {
        const row = new Array(width).fill(bg);
        grid.push(row);
      }

      // Group 0 (left): map tiles using the glyphs themselves
      let code = start;
      for (let gy = 0; gy < groupRows; gy++) {
        for (let gx = 0; gx < groupCols; gx++) {
          if (code > end) break;
          const ch = String.fromCharCode(code);
          grid[topY + gy][groupX0 + gx] = ch;
          code++;
        }
      }

      // Group 1 (second): keep background as '.' in the map; overlay entities with the same glyphs
      const entities = [];
      code = start;
      for (let gy = 0; gy < groupRows; gy++) {
        for (let gx = 0; gx < groupCols; gx++) {
          if (code > end) break;
          entities.push({
            id: `dbg-ascii-${code}`,
            charCode: code,
            x: groupX1 + gx,
            y: topY + gy,
            color: [1, 1, 1], // white tint for clarity
            emission: 0,
          });
          code++;
        }
      }

      // Group 2 (third): alternating rows of floor tiles as MAP tiles
      // Use full block '█' (CP437 219) as our floor glyph to mirror real dungeon floors
      const floorCh = '█';
      for (let gy = 0; gy < groupRows; gy++) {
        const useFloorRow = (gy % 2) === 0;
        for (let gx = 0; gx < groupCols; gx++) {
          grid[topY + gy][groupX2 + gx] = useFloorRow ? floorCh : bg;
        }
      }

      // Group 3 (fourth): alternating rows of floor tiles as ENTITIES
      for (let gy = 0; gy < groupRows; gy++) {
        const useFloorRow = (gy % 2) === 0;
        if (!useFloorRow) continue; // only place on the rows that would be floors
        for (let gx = 0; gx < groupCols; gx++) {
          entities.push({
            id: `dbg-floor-${gy}-${gx}`,
            charCode: 219, // CP437 full block
            x: groupX3 + gx,
            y: topY + gy,
            color: [1, 1, 1],
            emission: 0,
          });
        }
      }

      // Helper to draw a CP437 box into a grid region as MAP tiles
      function drawBoxToMap(ox, oy, w, h) {
        const H = 196; // '─'
        const V = 179; // '│'
        const TL = 218; // '┌'
        const TR = 191; // '┐'
        const BL = 192; // '└'
        const BR = 217; // '┘'
        if (w < 2 || h < 2) return;
        const y0 = topY + oy, y1 = topY + oy + h - 1;
        const x0 = ox, x1 = ox + w - 1;
        if (y0 < topY || y1 >= topY + groupRows) return;
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || x >= grid[0].length) continue;
          grid[y0][x] = String.fromCharCode(H);
          grid[y1][x] = String.fromCharCode(H);
        }
        for (let y = y0; y <= y1; y++) {
          if (y < 0 || y >= grid.length) continue;
          if (x0 >= 0 && x0 < grid[0].length) grid[y][x0] = String.fromCharCode(V);
          if (x1 >= 0 && x1 < grid[0].length) grid[y][x1] = String.fromCharCode(V);
        }
        if (x0 >= 0 && x0 < grid[0].length) {
          if (y0 >= 0 && y0 < grid.length) grid[y0][x0] = String.fromCharCode(TL);
          if (y1 >= 0 && y1 < grid.length) grid[y1][x0] = String.fromCharCode(BL);
        }
        if (x1 >= 0 && x1 < grid[0].length) {
          if (y0 >= 0 && y0 < grid.length) grid[y0][x1] = String.fromCharCode(TR);
          if (y1 >= 0 && y1 < grid.length) grid[y1][x1] = String.fromCharCode(BR);
        }
      }

      // Helper to draw a CP437 box as ENTITIES
      function drawBoxToEntities(ox, oy, w, h, gxBase) {
        const H = 196, V = 179, TL = 218, TR = 191, BL = 192, BR = 217;
        if (w < 2 || h < 2) return;
        const y0 = topY + oy, y1 = topY + oy + h - 1;
        const x0 = gxBase + ox, x1 = gxBase + ox + w - 1;
        // top/bottom
        for (let x = x0 + 1; x <= x1 - 1; x++) {
          entities.push({ id: `dbg-r-top-${x}-${y0}` , charCode: H, x, y: y0, color: [1,1,1], emission: 0 });
          entities.push({ id: `dbg-r-bot-${x}-${y1}` , charCode: H, x, y: y1, color: [1,1,1], emission: 0 });
        }
        // left/right
        for (let y = y0 + 1; y <= y1 - 1; y++) {
          entities.push({ id: `dbg-r-left-${x0}-${y}` , charCode: V, x: x0, y, color: [1,1,1], emission: 0 });
          entities.push({ id: `dbg-r-right-${x1}-${y}` , charCode: V, x: x1, y, color: [1,1,1], emission: 0 });
        }
        // corners
        entities.push({ id: `dbg-r-tl-${x0}-${y0}`, charCode: TL, x: x0, y: y0, color: [1,1,1], emission: 0 });
        entities.push({ id: `dbg-r-tr-${x1}-${y0}`, charCode: TR, x: x1, y: y0, color: [1,1,1], emission: 0 });
        entities.push({ id: `dbg-r-bl-${x0}-${y1}`, charCode: BL, x: x0, y: y1, color: [1,1,1], emission: 0 });
        entities.push({ id: `dbg-r-br-${x1}-${y1}`, charCode: BR, x: x1, y: y1, color: [1,1,1], emission: 0 });
      }

      // Group 4 (fifth): rooms as MAP tiles
      // Draw 3 rooms of different sizes inside the region
      const roomPad = 1;
      const rW = groupCols - roomPad * 2;
      const rH = Math.max(4, Math.min(groupRows - roomPad * 2, Math.floor(groupRows * 0.6)));
      // Big centered
      drawBoxToMap(groupX4 + roomPad, roomPad, Math.max(6, rW), rH);
      // Small top-left
      drawBoxToMap(groupX4 + roomPad + 1, roomPad + 1, Math.max(4, Math.floor(rW * 0.5)), Math.max(4, Math.floor(rH * 0.5)));
      // Medium bottom-right
      drawBoxToMap(groupX4 + roomPad + Math.max(2, Math.floor(rW * 0.35)), roomPad + Math.max(2, Math.floor(rH * 0.45)), Math.max(5, Math.floor(rW * 0.6)), Math.max(4, Math.floor(rH * 0.5)));

      // Group 5 (sixth): rooms as ENTITIES
      drawBoxToEntities(roomPad, roomPad, Math.max(6, rW), rH, groupX5);
      drawBoxToEntities(roomPad + 1, roomPad + 1, Math.max(4, Math.floor(rW * 0.5)), Math.max(4, Math.floor(rH * 0.5)), groupX5);
      drawBoxToEntities(roomPad + Math.max(2, Math.floor(rW * 0.35)), roomPad + Math.max(2, Math.floor(rH * 0.45)), Math.max(5, Math.floor(rW * 0.6)), Math.max(4, Math.floor(rH * 0.5)), groupX5);

      // Apply to renderer
      const mapString = grid.map(r => r.join('')).join('\n');
      setDungeonMap(mapString);
      setEntities(entities);

      // Optional: reset camera to 1x at origin so user can pan/zoom as needed
      try {
        state.camera.x = 0;
        state.camera.y = 0;
        state.camera.scale = 1;
        updateCamera();
      } catch (_) {}

      // If requested, flip black-key filters on for quick inspection
      if (opts.blackKey) {
        enableBlackKeyFilters(Number.isFinite(opts.threshold) ? opts.threshold : undefined);
      }
    }

    // Simple tween manager for entity motion
    const tweens = new Set();
    function animateEntity(id, toX, toY, opts = {}) {
      const rec = state.entityById.get(id);
      if (!rec) return false;
      const spr = rec.sprite;
      const from = { x: spr.x, y: spr.y };
      const dest = dungeonToWorld(toX|0, toY|0);
      const duration = Math.max(1, Number(opts.duration || 250)); // ms
      const ease = (t) => t * t * (3 - 2 * t); // smoothstep
      const start = performance.now();
      const tw = { id, spr, from, dest, start, duration, ease };
      tweens.add(tw);
      return true;
    }

    // Camera controls
    function panCamera(dx, dy) {
      state.camera.x += dx;
      state.camera.y += dy;
      updateCamera();
    }
    function zoomCamera(factor, ax = 0.5, ay = 0.5) {
      const app = state.app; if (!app) return;
      const viewW = app.renderer.width; const viewH = app.renderer.height;
      // Anchor in screen space -> world space point we want to keep stable
      const worldBefore = {
        x: state.camera.x + (ax * viewW) / state.camera.scale,
        y: state.camera.y + (ay * viewH) / state.camera.scale,
      };
      let newScale;
      if (state.pixelPerfect) {
        const f = Number(factor) || 1;
        if (f > 1) {
          newScale = Math.min(8, Math.floor(state.camera.scale) + 1);
        } else if (f < 1) {
          newScale = Math.max(1, Math.ceil(state.camera.scale) - 1);
        } else {
          newScale = Math.max(1, Math.round(state.camera.scale));
        }
      } else {
        newScale = clamp(state.camera.scale * (Number(factor)||1), 0.25, 8.0);
      }
      state.camera.scale = newScale;
      const worldAfter = {
        x: state.camera.x + (ax * viewW) / state.camera.scale,
        y: state.camera.y + (ay * viewH) / state.camera.scale,
      };
      // Adjust camera so the world point under (ax,ay) stays under the cursor
      state.camera.x += (worldBefore.x - worldAfter.x);
      state.camera.y += (worldBefore.y - worldAfter.y);
      updateCamera();
    }
    function updateCamera() {
      const root = state.root; if (!root) return;
      const s = state.pixelPerfect ? Math.max(1, Math.round(state.camera.scale)) : state.camera.scale;
      // Snap camera to whole pixels at pixel-perfect scales to avoid 1px seams/dots at 1x
      if (state.pixelPerfect) {
        state.camera.x = Math.round(state.camera.x);
        state.camera.y = Math.round(state.camera.y);
      }
      root.scale.set(s);
      const px = -state.camera.x * s;
      const py = -state.camera.y * s;
      root.position.set(state.pixelPerfect ? Math.round(px) : px, state.pixelPerfect ? Math.round(py) : py);
    }

    // Init and pipeline
    async function init(opts = {}) {
      const containerId = opts.containerId || 'pixi-canvas';
      // Ensure container
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.position = 'fixed';
        container.style.inset = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.zIndex = '1';
        (document.getElementById('app') || document.body).appendChild(container);
      }

      const width = Math.max(320, window.innerWidth || 1024);
      const height = Math.max(240, window.innerHeight || 768);

      let app;
      const commonOpts = {
        width,
        height,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0x000000,
        hello: false,
      };
      // Pixi v7+: Application.init exists
      if (PIXI.Application && PIXI.Application.prototype && typeof PIXI.Application.prototype.init === 'function') {
        app = new PIXI.Application();
        await app.init(commonOpts);
        container.appendChild(app.canvas);
      } else {
        // Pixi v5/v6 style
        app = new PIXI.Application(commonOpts);
        container.appendChild(app.view);
      }
      state.app = app;
      const viewEl = app.canvas || app.view;
      try { viewEl.style.imageRendering = 'pixelated'; } catch (_) {}
      
      // Prefer integer pixel snapping at the renderer level if supported
      try { if (app.renderer && 'roundPixels' in app.renderer) app.renderer.roundPixels = true; } catch (_) {}
      try { if (PIXI.settings && 'ROUND_PIXELS' in PIXI.settings) PIXI.settings.ROUND_PIXELS = true; } catch (_) {}

      // Root world container (offscreen: rendered into RT only, not directly to stage)
      const root = new PIXI.Container();
      state.root = root;
      try { root.roundPixels = true; } catch (_) {}

      // Layers: tiles below, entities above
      state.layers.tiles = new PIXI.Container();
      state.layers.entities = new PIXI.Container();
      state.layers.ui = new PIXI.Container();
      root.addChild(state.layers.tiles);
      root.addChild(state.layers.entities);
      app.stage.addChild(state.layers.ui);
      try { state.layers.tiles.roundPixels = true; } catch (_) {}
      try { state.layers.entities.roundPixels = true; } catch (_) {}

      // Black-key transparency (disabled by default to avoid potential 1px artifacts at 1x)
      // To enable later for atlases without alpha, set these filters at runtime.
      // try {
      //   const fkTiles = createBlackKeyFilter(PIXI);
      //   const fkEnt = createBlackKeyFilter(PIXI);
      //   state.layers.tiles.filters = [fkTiles];
      //   state.layers.entities.filters = [fkEnt];
      // } catch (_) {}

      // Render-to-texture sprite for post-fx
      state.rt.scene = await PIXI.RenderTexture.create({ width, height, resolution: app.renderer.resolution });
      try { state.rt.scene.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; } catch (_) {}
      state.rt.sprite = new PIXI.Sprite(state.rt.scene);
      state.rt.sprite.roundPixels = true;
      app.stage.addChild(state.rt.sprite);
      // Ensure stage only contains postfx RT sprite (and UI); root remains offstage when using RT
      try { app.stage.removeChild(root); } catch (_) {}

      function applyRTMode() {
        const useRT = !!state.flags.useRT;
        try {
          if (useRT) {
            // Stage should have RT sprite and not the root container
            if (!app.stage.children.includes(state.rt.sprite)) app.stage.addChild(state.rt.sprite);
            try { app.stage.removeChild(root); } catch (_) {}
          } else {
            // Stage should have root directly and no RT sprite
            try { app.stage.removeChild(state.rt.sprite); } catch (_) {}
            if (!app.stage.children.includes(root)) app.stage.addChild(root);
          }
        } catch (_) {}
      }
      applyRTMode();

      // GI-like filter (available but disabled by default to keep base colors faithful)
      state.giFilter = createGiFilter(PIXI);
      state.filterChain = [];
      state.rt.sprite.filters = state.filterChain;

      // Default: enable black-key on ENTITIES only (helps atlases without alpha)
      try {
        let th = 0.025; // safe conservative default
        try {
          const s = localStorage.getItem('ui_blackkey_entities_threshold');
          if (s != null && s !== '') {
            if (s.trim().endsWith('%')) {
              const p = parseFloat(s);
              if (Number.isFinite(p)) th = Math.max(0, Math.min(1, p / 100));
            } else {
              const v = Number(s);
              if (Number.isFinite(v)) th = Math.max(0, Math.min(1, v));
            }
          }
        } catch (_) {}
        enableBlackKeyOnEntities(th);
      } catch (_) {}

      // Pointer wheel zoom (anchor under cursor) and drag pan
      try {
        function onWheel(ev) {
          try {
            ev.preventDefault();
            const factor = (ev.deltaY < 0) ? 1.2 : (1/1.2);
            const rect = viewEl.getBoundingClientRect();
            const ax = (ev.clientX - rect.left) / rect.width;
            const ay = (ev.clientY - rect.top) / rect.height;
            zoomCamera(factor, ax, ay);
          } catch (_) {}
        }
        let dragging = false; let lastX = 0; let lastY = 0; let pid = null;
        function onDown(ev) { try { dragging = true; lastX = ev.clientX; lastY = ev.clientY; pid = ev.pointerId; viewEl.setPointerCapture && viewEl.setPointerCapture(pid); } catch (_) {} }
        function onMove(ev) {
          if (!dragging) return;
          try {
            const dx = ev.clientX - lastX; const dy = ev.clientY - lastY; lastX = ev.clientX; lastY = ev.clientY;
            const s = state.pixelPerfect ? Math.max(1, Math.round(state.camera.scale)) : state.camera.scale;
            panCamera(-dx / s, -dy / s);
          } catch (_) {}
        }
        function onUp(ev) { try { dragging = false; if (pid != null) { viewEl.releasePointerCapture && viewEl.releasePointerCapture(pid); } pid = null; } catch (_) {} }
        viewEl.addEventListener('wheel', onWheel, { passive: false });
        viewEl.addEventListener('pointerdown', onDown);
        viewEl.addEventListener('pointermove', onMove);
        viewEl.addEventListener('pointerup', onUp);
        viewEl.addEventListener('pointercancel', onUp);
        viewEl.addEventListener('mouseleave', onUp);
      } catch (_) {}

      // Resize handling
      function handleResize() {
        try {
          const w = Math.max(320, window.innerWidth || 1024);
          const h = Math.max(240, window.innerHeight || 768);
          app.renderer.resize(w, h);
          // Recreate RT when size changes
          state.rt.scene.destroy(true);
          state.rt.scene = PIXI.RenderTexture.create({ width: w, height: h, resolution: app.renderer.resolution });
          try { state.rt.scene.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; } catch (_) {}
          state.rt.sprite.texture = state.rt.scene;
          updateCamera();
        } catch (e) { console.warn('[pixi] resize failed', e); }
      }
      window.addEventListener('resize', handleResize);
      ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange']
        .forEach((evt) => document.addEventListener(evt, handleResize));

      // Integrate global zoom events like ASCII renderer
      window.addEventListener('ui:zoom', (e) => {
        try { const f = Number(e?.detail?.factor) || 1.0; zoomCamera(f, 0.5, 0.5); } catch (_) {}
      });

      // React to Display Debug updates for fog/falloff
      try {
        window.addEventListener('ui:rc-debug-changed', (e) => {
          const d = (e && e.detail) || {};
          const fog = (d.fogAmount != null) ? Math.max(0, Math.min(1, Number(d.fogAmount))) : null;
          const falloff = (d.srgbFalloff != null) ? Math.max(0, Math.min(3, Number(d.srgbFalloff))) : null;
          if (state.giFilter) {
            if (fog != null) state.giFilter.uniforms.uFogAmount = fog;
            if (falloff != null) state.giFilter.uniforms.uFalloff = falloff;
          }
        });
      } catch (_) {}

      // Animation loop: render world to RT, then stage
      function tick(now) {
        // Update tweens
        if (tweens.size) {
          const remove = [];
          tweens.forEach((tw) => {
            const t = clamp((now - tw.start) / tw.duration, 0, 1);
            const k = tw.ease(t);
            const x = tw.from.x + (tw.dest.x - tw.from.x) * k;
            const y = tw.from.y + (tw.dest.y - tw.from.y) * k;
            tw.spr.position.set(x, y);
            if (t >= 1) remove.push(tw);
          });
          remove.forEach((tw) => tweens.delete(tw));
        }

        // Update GI uniforms
        if (state.giFilter) {
          state.giFilter.uniforms.uTime = (now - state.startTs) * 0.001;
        }

        if (state.flags.useRT) {
          // First render world into RT (try Pixi v7 signature, fallback to v6)
          try {
            app.renderer.render({ container: root, target: state.rt.scene, clear: true });
          } catch (_) {
            try { app.renderer.render(root, { renderTexture: state.rt.scene, clear: true }); } catch (_) {}
          }
          // Then render stage, which has the RT sprite with filters
          try {
            app.renderer.render({ container: app.stage, clear: true });
          } catch (_) {
            try { app.renderer.render(app.stage); } catch (_) {}
          }
        } else {
          // Direct render: stage contains root + UI, no RT indirection
          try {
            app.renderer.render({ container: app.stage, clear: true });
          } catch (_) {
            try { app.renderer.render(app.stage); } catch (_) {}
          }
        }
        state.raf = requestAnimationFrame(tick);
      }
      state.raf = requestAnimationFrame(tick);

      // Return minimal API
      return api;
    }

    function setFont(meta) {
      if (!meta) return;
      const src = meta.dataUrl || meta.url; if (!src) return;
      state.tile.w = (meta.tile && meta.tile.w) || state.tile.w;
      state.tile.h = (meta.tile && meta.tile.h) || state.tile.h;
      state.atlas.cols = (meta.atlas && meta.atlas.cols) || state.atlas.cols;
      state.atlas.rows = (meta.atlas && meta.atlas.rows) || state.atlas.rows;
      state.atlas.startCode = Number.isFinite(meta.startCode) ? meta.startCode : state.atlas.startCode;
      // Optional flip hints from fontCatalog entry
      state.flip.tileY = !!meta.flipTileY;
      state.flip.row = !!meta.flipRow;

      // Load base texture
      const base = PIXI.Texture.from(src).baseTexture;
      base.scaleMode = PIXI.SCALE_MODES.NEAREST;
      try { if (PIXI.MIPMAP_MODES) base.mipmap = PIXI.MIPMAP_MODES.OFF; else base.mipmap = false; } catch (_) {}
      try { base.anisotropicLevel = 0; } catch (_) {}
      // Reset per-code cache
      state.textures.byCode.clear();
      state.textures.base = base;
      state.textures.originalBase = base;
      // Rebuild map sprites to adopt new glyph textures/size
      if (base.valid) {
        // Optionally auto-extrude if configured via localStorage
        try {
          const s = localStorage.getItem('ui_atlas_extrude_pad');
          const pad = (s != null && s !== '') ? Math.max(0, Math.floor(Number(s))) : 1; // default 1
          if (pad > 0) enableAtlasExtrude(pad);
        } catch (_) {}
        rebuildMap();
        try { if (state.lastEntities && state.lastEntities.length) setEntities(state.lastEntities); } catch (_) {}
      } else {
        try {
          const onLoaded = () => { try { rebuildMap(); if (state.lastEntities && state.lastEntities.length) setEntities(state.lastEntities); } catch (_) {} };
          if (typeof base.once === 'function') {
            base.once('loaded', onLoaded);
          } else if (typeof base.on === 'function') {
            const handler = () => { try { base.off && base.off('loaded', handler); } catch (_) {} onLoaded(); };
            base.on('loaded', handler);
          } else {
            // Fallback: poll until valid
            const it = setInterval(() => {
              if (base.valid) { clearInterval(it); try { rebuildMap(); } catch (_) {} }
            }, 16);
          }
        } catch (_) { /* no-op */ }
      }
    }

    // Multi-pass helpers
    function setFilterChain(filtersArray) {
      try {
        state.filterChain = Array.isArray(filtersArray) ? filtersArray.slice() : [];
        state.rt.sprite.filters = state.filterChain;
      } catch (_) {}
    }
    function addFilter(filter) {
      try {
        state.filterChain.push(filter);
        state.rt.sprite.filters = state.filterChain;
      } catch (_) {}
    }
    function clearFilters() { setFilterChain([]); }

    function setDungeonMap(mapString) {
      const rows = String(mapString || '').split('\n');
      state.map.rows = rows;
      state.map.height = rows.length;
      state.map.width = rows.reduce((m, r) => Math.max(m, r.length), 0);
      rebuildMap();
    }

    function destroy() {
      try { cancelAnimationFrame(state.raf); } catch (_) {}
      try { state.app && state.app.destroy(true, { children: true }); } catch (_) {}
      state.app = null;
      state.root = null;
    }

    const api = {
      init,
      setFont,
      setDungeonMap,
      setEntities,
      panCamera,
      zoomCamera,
      toScreen: ({ x, y }) => dungeonToScreen(x, y),
      animateEntity,
      enableBlackKeyFilters,
      disableBlackKeyFilters,
      enableBlackKeyOnEntities,
      debugAsciiGrid,
      setFilterChain,
      addFilter,
      clearFilters,
      setBypassRT: (flag) => { try { state.flags.useRT = !flag; applyRTMode(); } catch (_) {} },
      enableAtlasExtrude,
      disableAtlasExtrude,
      destroy,
    };
    return api;
  }

  // Boot helper for quick manual testing from DevTools
  async function bootPixiRenderer() {
    const PIXI = await loadPixi();
    const api = createRendererAPI(PIXI);
    window.pxr = api;
    await api.init({ containerId: 'pixi-canvas' });

    // Wire Display tab font events
    window.addEventListener('ui:dungeon-font-changed', (e) => {
      try { const meta = e && e.detail; if (meta) api.setFont(meta); } catch (_) {}
    });

    // If a pending font was staged before this booted, apply it
    try { if (window.__pendingDungeonFont) api.setFont(window.__pendingDungeonFont); } catch (_) {}
    // Otherwise proactively apply current selection from localStorage using fontCatalog
    try {
      if (!window.__pendingDungeonFont) {
        const mod = await import('../ui/dungeon/fontCatalog.js');
        const getFont = mod.getFont || (mod.default && mod.default.getFont);
        const resolveImageSrc = mod.resolveImageSrc || (mod.default && mod.default.resolveImageSrc);
        if (getFont && resolveImageSrc) {
          let fontId = null;
          try { fontId = localStorage.getItem('ui_dungeon_font_id'); } catch (_) { fontId = null; }
          const alias = { 'vendor-16x16': 'Bisasam_16x16', 'Bisasam 16x16': 'Bisasam_16x16' };
          const resolvedId = alias[fontId] || fontId || 'vendor-8x8';
          const f = getFont(resolvedId) || getFont('vendor-8x8');
          if (f) {
            const src = resolveImageSrc(f);
            if (src) {
              const meta = {
                id: f.id,
                name: f.name,
                tile: f.tile,
                atlas: f.atlas,
                startCode: Number.isFinite(f.startCode) ? f.startCode : 32,
                dataUrl: src,
              };
              if (Object.prototype.hasOwnProperty.call(f, 'flipTextureY')) meta.flipTextureY = !!f.flipTextureY;
              if (Object.prototype.hasOwnProperty.call(f, 'flipTextureX')) meta.flipTextureX = !!f.flipTextureX;
              if (Object.prototype.hasOwnProperty.call(f, 'flipRow')) meta.flipRow = !!f.flipRow;
              if (Object.prototype.hasOwnProperty.call(f, 'flipTileY')) meta.flipTileY = !!f.flipTileY;
              api.setFont(meta);
            }
          }
        }
      }
    } catch (_) {}

    // Apply any pending assets (map and entities) like ASCII renderer does
    try { if (window.__pendingDungeonMap) api.setDungeonMap(window.__pendingDungeonMap); } catch (_) {}
    try { if (window.__pendingEntities) api.setEntities(window.__pendingEntities); } catch (_) {}

    console.log('[pixiDungeonRenderer] ready. Exposed as window.pxr');
    // Signal readiness so producers (e.g., dungeonDisplayManager) can push content deterministically
    try { window.dispatchEvent(new CustomEvent('pxr:ready')); } catch (_) {}
    // Convenience: allow quickly invoking the ASCII debug grid from console
    try {
      window.showAsciiBlackKeyDebug = async (opts) => {
        // If the renderer hasn't been booted yet, boot first
        try {
          if (!window.pxr) {
            const PIXI2 = await loadPixi();
            const api2 = createRendererAPI(PIXI2);
            window.pxr = api2;
            await api2.init({ containerId: 'pixi-canvas' });
          }
        } catch (_) {}
        try { window.pxr.debugAsciiGrid(opts || {}); } catch (_) {}
      };
    } catch (_) {}
    return api;
  }

  // Expose boot function
  window.bootPixiRenderer = bootPixiRenderer;
})();
