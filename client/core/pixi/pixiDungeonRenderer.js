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

  // Small helper: clamp
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
      textures: { base: null, byCode: new Map() },
      map: { rows: [], width: 0, height: 0 },
      entityById: new Map(), // id -> { sprite, emission }
      raf: 0,
      startTs: performance.now(),
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
      // Derive atlas layout from base texture size to avoid OOB frames
      const cols = Math.max(1, Math.floor(base.width / state.tile.w));
      const rows = Math.max(1, Math.floor(base.height / state.tile.h));
      const maxIndex = (cols * rows) - 1;
      if (idx > maxIndex) idx = idx % (maxIndex + 1);
      const sx = (idx % cols) * state.tile.w;
      let rowIdx = Math.floor(idx / cols);
      // If the atlas is stored upside-down, invert the row index using derived rows
      if (state.flip.tileY && Number.isFinite(rows) && rows > 0) {
        rowIdx = (rows - 1) - rowIdx;
      }
      const sy = rowIdx * state.tile.h;
      const frame = new PIXI.Rectangle(sx, sy, state.tile.w, state.tile.h);
      const tex = new PIXI.Texture(base, frame);
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      state.textures.byCode.set(key, tex);
      return tex;
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
      if (!Array.isArray(list)) return;
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

      // Render-to-texture sprite for post-fx
      state.rt.scene = await PIXI.RenderTexture.create({ width, height, resolution: app.renderer.resolution });
      try { state.rt.scene.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; } catch (_) {}
      state.rt.sprite = new PIXI.Sprite(state.rt.scene);
      state.rt.sprite.roundPixels = true;
      app.stage.addChild(state.rt.sprite);
      // Ensure stage only contains postfx RT sprite (and UI); root remains offstage
      try { app.stage.removeChild(root); } catch (_) {}

      // GI-like filter
      state.giFilter = createGiFilter(PIXI);
      state.filterChain = [state.giFilter];
      state.rt.sprite.filters = state.filterChain;

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
      // Rebuild map sprites to adopt new glyph textures/size
      if (base.valid) {
        rebuildMap();
      } else {
        try {
          const onLoaded = () => { try { rebuildMap(); } catch (_) {} };
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
      setFilterChain,
      addFilter,
      clearFilters,
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
    return api;
  }

  // Expose boot function
  window.bootPixiRenderer = bootPixiRenderer;
})();
