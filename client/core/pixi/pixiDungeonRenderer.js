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
// - setSprites(list)          // unified sprite pipeline
// - panCamera(dx, dy)
// - zoomCamera(factor, ax, ay)
// - toScreen({ x, y }) -> { x, y }
// - animateEntity(id, toX, toY, opts)
// - getOcclusionTexture()
// - setFilterChain(filters), addFilter(filter), clearFilters()
// - enableBlackKeyFilters(threshold), disableBlackKeyFilters()
// - destroy()

(function () {
  if (typeof window === 'undefined') return;

  // Tuned to eliminate seam artifacts at pixel-perfect scales without visible shrink
  // const GLYPH_UV_INSET_PX = 0.18;
    const GLYPH_UV_INSET_PX = 0.0;
  // Luminance threshold for black-key transparency. Binary: below -> fully transparent
  // Keep low because sprite tints darken visible glyphs; 0.06–0.10 works well.
  const GLYPH_KEY_THRESHOLD = 0.08;

  // Raymarching emissive lighting (every pixel can emit if bright enough)
  // All parameters are centralized here so UI sliders can bind directly later.
  const RAYMARCH_DEFAULTS = {
    enabled: true,          // turn the effect on by default
    threshold: 0.35,        // emission threshold on scene luminance (0..1)
    curve: 1.6,             // emission curve (gamma-like exponent)
    intensity: 1.2,         // multiplier for emissive contribution
    ambient: 0.35,          // base ambient level added to all pixels
    stepPx: 5.0,            // step size in pixels along each ray
    steps: 28,              // number of steps traced per direction (<= 64)
    dirCount: 12,           // number of directions on the unit circle (<= 32 recommended)
    occlusionBlock: 0.85,   // how strongly the occlusion mask blocks light (0..1)
    distanceFalloff: 1.0,   // linear falloff factor with distance (0..2)
  };

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

  // Screen-space emissive raymarch: every pixel on the scene acts as an emitter
  // based on luminance threshold/curve. Rays accumulate emission while being
  // attenuated by distance and blocked by the occlusion RT (walls).
  function createRaymarchFilter(PIXI) {
    const MAX_STEPS = 64;
    const MAX_DIRS = 32;
    const frag = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;      // scene color (albedo)
uniform sampler2D uOcclusion;    // occlusion mask (white blocks)
uniform vec2 uResolution;        // renderer size in pixels
uniform float uThreshold;        // emission threshold on luminance
uniform float uCurve;            // emission curve exponent
uniform float uIntensity;        // emission intensity multiplier
uniform float uAmbient;          // ambient level
uniform float uStepPx;           // step length in pixels
uniform float uSteps;            // steps per direction (<= ${MAX_STEPS})
uniform float uDirCount;         // number of directions (<= ${MAX_DIRS})
uniform float uOcclusionBlock;   // occlusion block strength (0..1)
uniform float uDistanceFalloff;  // linear falloff

float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float texOcc(vec2 uv){ vec3 o = texture2D(uOcclusion, uv).rgb; return max(max(o.r,o.g),o.b); }

// Uniformly distribute directions on the circle
vec2 dirForIndex(int i, float n){
  float fi = float(i);
  float fn = max(n, 1.0);
  float a = 6.28318530718 * (fi / fn);
  return vec2(cos(a), sin(a));
}

void main(){
  vec2 uv = vTextureCoord;
  vec4 base4 = texture2D(uSampler, uv);
  vec3 base = base4.rgb;
  float stepLen = max(0.5, uStepPx);
  float invW = 1.0 / uResolution.x;
  float invH = 1.0 / uResolution.y;
  float emitAccum = 0.0;
  float normAccum = 0.0;

  float DC = max(1.0, uDirCount);
  float ST = max(1.0, min(uSteps, float(${MAX_STEPS})));
  for (int di = 0; di < ${MAX_DIRS}; di++){
    if (float(di) >= DC) break;
    vec2 d = dirForIndex(di, DC);
    vec2 stepUV = vec2(stepLen*invW, stepLen*invH) * d;
    vec2 p = uv;
    float trans = 1.0;
    for (int si = 0; si < ${MAX_STEPS}; si++){
      if (float(si) >= ST) break;
      p += stepUV;
      float occ = texOcc(p);
      trans *= (1.0 - uOcclusionBlock * occ);
      if (trans < 0.003) break;
      float L = lum(texture2D(uSampler, p).rgb);
      float e = max(0.0, (L - uThreshold) / max(1e-6, 1.0 - uThreshold));
      e = pow(e, max(0.001, uCurve));
      float dist = float(si+1) * stepLen;
      float fall = max(0.0, 1.0 - uDistanceFalloff * (dist / 512.0));
      emitAccum += trans * e * fall;
      normAccum += fall;
    }
  }
  float emissive = (normAccum > 0.0) ? (emitAccum / normAccum) : 0.0;
  float lighting = clamp(uAmbient + uIntensity * emissive, 0.0, 2.0);
  vec3 color = base * lighting;
  gl_FragColor = vec4(color, base4.a);
}`;
    const uniforms = {
      uOcclusion: null,
      uResolution: new Float32Array([1024, 768]),
      uThreshold: RAYMARCH_DEFAULTS.threshold,
      uCurve: RAYMARCH_DEFAULTS.curve,
      uIntensity: RAYMARCH_DEFAULTS.intensity,
      uAmbient: RAYMARCH_DEFAULTS.ambient,
      uStepPx: RAYMARCH_DEFAULTS.stepPx,
      uSteps: RAYMARCH_DEFAULTS.steps,
      uDirCount: RAYMARCH_DEFAULTS.dirCount,
      uOcclusionBlock: RAYMARCH_DEFAULTS.occlusionBlock,
      uDistanceFalloff: RAYMARCH_DEFAULTS.distanceFalloff,
    };
    return new PIXI.Filter(undefined, frag, uniforms);
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
uniform sampler2D uOcclusion; // optional occlusion mask (alpha/white)

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

  // Mild darken from occlusion mask if provided
  vec4 occ = texture2D(uOcclusion, uv);
  float occAmt = clamp(max(max(occ.r, occ.g), occ.b), 0.0, 1.0);
  color = mix(color, color * 0.65, occAmt);
  gl_FragColor = vec4(color, base.a);
}`;
    const uniforms = { uTime: 0, uFogAmount: 0.2, uFalloff: 1.8, uOcclusion: null };
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
  // Luminance-based key (independent of hue); binary alpha
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float a = c.a * step(uThreshold, lum);
  gl_FragColor = vec4(c.rgb, a);
}`;
    const uniforms = { uThreshold: GLYPH_KEY_THRESHOLD };
    return new PIXI.Filter(undefined, frag, uniforms);
  }

  // Small helper: clamp
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /**
   * SpriteSpec
   * @typedef {Object} SpriteSpec
   * @property {string=} id          Optional stable id for animation/lookups
   * @property {string=} char        Single-character glyph
   * @property {number=} charCode    Codepoint for glyph (used if provided)
   * @property {number} x            Dungeon grid X
   * @property {number} y            Dungeon grid Y
   * @property {number|number[]} color  0xRRGGBB or [r,g,b] 0..1
   * @property {number=} alpha       0..1 (default 1)
   * @property {boolean=} occludes   If true, contributes to occlusion mask
   */

  function createRendererAPI(PIXI) {
    // Internal state
    const state = {
      app: null,
      root: null,
      layers: {
        floors: null,     // unfiltered background floor tiles
        world: null,      // visible glyphs that may need black-key
        occlusion: null,  // monochrome mask
        ui: null,
      },
      rt: { scene: null, sprite: null, occlusion: null },
      giFilter: null,
      rayFilter: null,
      filterChain: [],
      camera: { x: 0, y: 0, scale: 1 },
      pixelPerfect: true,
      tile: { w: 8, h: 8 },
      atlas: { cols: 16, rows: 16, startCode: 32 },
      flip: { tileY: false, row: false },
      textures: { base: null, byCode: new Map(), originalBase: null },
      idIndex: new Map(), // id -> { sprite, occlSprite } for animation/tweening
      lastSprites: [],    // last applied sprite list; used to redraw on font change
      raf: 0,
      startTs: performance.now(),
      debugInset: GLYPH_UV_INSET_PX,   // default inset; tune via setGlyphInset(px) if needed
      blackKeyFilterWorld: null,
      blackKeyFilterOcc: null,
      viewingOcclusion: false,
      rayParams: { ...RAYMARCH_DEFAULTS },
      // no debug flags kept in production path
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

    // Debug helper: inspect the computed glyph frame and inferred inset for a codepoint
    function debugGlyphFrame(code) {
      try {
        const tex = textureForCode(code|0);
        if (!tex) return { ok: false, reason: 'no-texture' };
        const f = tex.frame || { x: 0, y: 0, width: state.tile.w, height: state.tile.h };
        const insetX = (state.tile.w - f.width) * 0.5;
        const insetY = (state.tile.h - f.height) * 0.5;
        const info = {
          ok: true,
          code: code|0,
          tile: { w: state.tile.w, h: state.tile.h },
          frame: { x: f.x, y: f.y, w: f.width, h: f.height },
          inferredInset: { x: insetX, y: insetY },
          atlas: { cols: state.atlas.cols, rows: state.atlas.rows, startCode: state.atlas.startCode }
        };
        try { console.log('[debugGlyphFrame]', info); } catch (_) {}
        return info;
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    }

    // Runtime detection of floor seams: render only the floors layer into a temporary RT
    // and scan tile-boundary columns/rows for any pixels with alpha < 255 (indicating gaps)
    function detectFloorSeams(opts = {}) {
      const app = state.app; if (!app || !state.layers.floors) return { ok: false, reason: 'no-app-or-floors' };
      const w = app.renderer.width|0; const h = app.renderer.height|0;
      const s = state.pixelPerfect ? Math.max(1, Math.round(state.camera.scale)) : state.camera.scale;
      const periodX = Math.max(1, Math.round(state.tile.w * s));
      const periodY = Math.max(1, Math.round(state.tile.h * s));
      const x0 = Math.round(state.root ? state.root.position.x : 0);
      const y0 = Math.round(state.root ? state.root.position.y : 0);
      const maxProbeCols = Math.min(Math.ceil(w / periodX), opts.maxCols || 64);
      const maxProbeRows = Math.min(Math.ceil(h / periodY), opts.maxRows || 64);
      const rt = PIXI.RenderTexture.create({ width: w, height: h, resolution: app.renderer.resolution });
      let verticalIssues = 0, horizontalIssues = 0;
      try {
        // Render only floors
        app.renderer.render({ container: state.layers.floors, target: rt, clear: true });
        const extract = app.renderer.extract;
        // Probe vertical boundaries
        for (let i = 0; i < maxProbeCols; i++) {
          const x = x0 + i * periodX;
          if (x < 0 || x >= w) continue;
          const rect = new PIXI.Rectangle(Math.max(0, x), 0, 1, h);
          const px = extract.pixels(rt, rect);
          for (let p = 3; p < px.length; p += 4) { if (px[p] < 250) { verticalIssues++; break; } }
        }
        // Probe horizontal boundaries
        for (let j = 0; j < maxProbeRows; j++) {
          const y = y0 + j * periodY;
          if (y < 0 || y >= h) continue;
          const rect = new PIXI.Rectangle(0, Math.max(0, y), w, 1);
          const px = extract.pixels(rt, rect);
          for (let p = 3; p < px.length; p += 4) { if (px[p] < 250) { horizontalIssues++; break; } }
        }
      } catch (e) {
        console.warn('[detectFloorSeams] failed', e);
      } finally {
        try { rt.destroy(true); } catch (_) {}
      }
      const result = { ok: true, verticalIssues, horizontalIssues };
      try { console.log('[detectFloorSeams]', result); } catch (_) {}
      return result;
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
      // Prefer explicit atlas metadata when available; fall back to deriving from texture size
      const pad = Number(state.atlas.pad || 0);
      const cellW = state.tile.w + pad * 2;
      const cellH = state.tile.h + pad * 2;
      const metaCols = Number.isFinite(state.atlas.cols) ? (state.atlas.cols|0) : 0;
      const metaRows = Number.isFinite(state.atlas.rows) ? (state.atlas.rows|0) : 0;
      const cols = Math.max(1, metaCols || Math.floor(base.width / (cellW || state.tile.w)));
      const rows = Math.max(1, metaRows || Math.floor(base.height / (cellH || state.tile.h)));
      const maxIndex = (cols * rows) - 1;
      if (idx > maxIndex) idx = idx % (maxIndex + 1);
      const sx = (idx % cols) * (cellW || state.tile.w) + pad;
      let rowIdx = Math.floor(idx / cols);
      // If the atlas is stored upside-down, invert the row index using derived rows
      if (state.flip.tileY && Number.isFinite(rows) && rows > 0) {
        rowIdx = (rows - 1) - rowIdx;
      }
      const sy = rowIdx * (cellH || state.tile.h) + pad;

      // UV inset to avoid sampling atlas gutters
      // Default tiny inset helps reduce bleeding at certain scales; use anisotropic inset so
      // line-drawing glyphs still butt perfectly without a 1px gap between tiles.
      let inset = Math.max(0, Number(state.debugInset) || 0);
      let insetX = inset, insetY = inset;
      try {
        // Do NOT inset fully filled block (floor) so tiles butt without visible gaps
        if (key === 219) { insetX = 0; insetY = 0; }
        else {
          const LINE_CODES = [179,196,218,191,192,217,180,195,194,193,197];
          const H_SPAN = [196,218,191,192,217,180,195,194,193,197]; // spans left-right
          const V_SPAN = [179,218,191,192,217,180,195,194,193,197]; // spans top-bottom
          if (LINE_CODES.indexOf(key) !== -1) {
            // Keep a modest inset to reduce atlas bleed, but do not shrink along the axis that must butt
            const strong = Math.max(inset, 0.20);
            insetX = strong; insetY = strong;
            if (H_SPAN.indexOf(key) !== -1) insetX = 0; // full horizontal extent
            if (V_SPAN.indexOf(key) !== -1) insetY = 0; // full vertical extent
          }
        }
      } catch (_) {}
      insetX = Math.max(0, Math.min(insetX, (state.tile.w) * 0.49));
      insetY = Math.max(0, Math.min(insetY, (state.tile.h) * 0.49));
      const frame = (insetX > 0 || insetY > 0)
        ? new PIXI.Rectangle(sx + insetX, sy + insetY, state.tile.w - insetX * 2, state.tile.h - insetY * 2)
        : new PIXI.Rectangle(sx, sy, state.tile.w, state.tile.h);
      const tex = new PIXI.Texture(base, frame);
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      state.textures.byCode.set(key, tex);
      return tex;
    }
    
    // (legacy atlas extrude/rebuild code removed in sprite-only renderer)
    // (legacy setEntities/pending map recombine removed; new setEntities wrapper defined later)

    // Enable chroma-key style transparency on world layer (pre-composite)
    function enableBlackKeyFilters(threshold) {
      try {
        const t = (threshold != null && Number.isFinite(threshold)) ? Number(threshold) : GLYPH_KEY_THRESHOLD;
        const fkW = createBlackKeyFilter(PIXI); fkW.uniforms.uThreshold = t;
        const fkO = createBlackKeyFilter(PIXI); fkO.uniforms.uThreshold = t;
        state.blackKeyFilterWorld = fkW;
        state.blackKeyFilterOcc = fkO;
        if (state.layers.world) state.layers.world.filters = [fkW];
        if (state.layers.occlusion) state.layers.occlusion.filters = [fkO];
      } catch (_) {}
    }

    // Disable black-key filters on both layers
    function disableBlackKeyFilters() {
      state.blackKeyFilterWorld = null;
      state.blackKeyFilterOcc = null;
      try { if (state.layers.world) state.layers.world.filters = null; } catch (_) {}
      try { if (state.layers.occlusion) state.layers.occlusion.filters = null; } catch (_) {}
    }

    // Simple tween manager for entity motion (see final animateEntity using idIndex)
    const tweens = new Set();

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
      // Mirror transform onto occlusion layer so masks align 1:1 with visuals
      try {
        const occ = state.layers.occlusion;
        if (occ) {
          occ.scale.set(s);
          occ.position.set(state.pixelPerfect ? Math.round(px) : px, state.pixelPerfect ? Math.round(py) : py);
        }
      } catch (_) {}
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

      // Layers: world (visible) + occlusion (mask)
      const MaxSprites = 65535;
      // Floors: separate unfiltered container so binary key doesn't cause seams on solid tiles
      state.layers.floors = new PIXI.Container();
      // World must be a Container to support filters (black-key pre-composite)
      state.layers.world = new PIXI.Container();
      // Occlusion uses a Container so we can apply threshold filtering for binary masks
      state.layers.occlusion = new PIXI.Container();
      state.layers.ui = new PIXI.Container();
      root.addChild(state.layers.floors);
      root.addChild(state.layers.world);
      app.stage.addChild(state.layers.ui);
      try { state.layers.floors.roundPixels = true; } catch (_) {}
      try { state.layers.world.roundPixels = true; } catch (_) {}
      try { state.layers.occlusion.roundPixels = true; } catch (_) {}

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
      // Ensure stage only contains postfx RT sprite (and UI); root remains offstage
      try { app.stage.removeChild(root); } catch (_) {}

      // Separate occlusion RT (not shown directly). We render a monochrome mask into this.
      state.rt.occlusion = await PIXI.RenderTexture.create({ width, height, resolution: app.renderer.resolution });
      try { state.rt.occlusion.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; } catch (_) {}

      // GI-like filter (available but disabled by default to keep base colors faithful)
      state.giFilter = createGiFilter(PIXI);
      // Raymarch emissive filter (on by default per RAYMARCH_DEFAULTS)
      state.rayFilter = createRaymarchFilter(PIXI);
      state.filterChain = RAYMARCH_DEFAULTS.enabled ? [state.rayFilter] : [];
      state.rt.sprite.filters = state.filterChain;

      // Default: enable black-key on world (uniform ASCII transparency)
      try { enableBlackKeyFilters(GLYPH_KEY_THRESHOLD); } catch (_) {}

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

      // Function keys: F2 toggles occlusion mask / scene; F3 toggles raymarch on/off
      try {
        function onKey(ev) {
          if (!ev || ev.repeat) return;
          if (ev.code === 'F2') {
            try {
              state.viewingOcclusion = !state.viewingOcclusion;
              if (state.viewingOcclusion) {
                api && api.viewOcclusion && api.viewOcclusion();
              } else {
                api && api.viewScene && api.viewScene();
              }
              ev.preventDefault();
              ev.stopPropagation();
            } catch (_) {}
          } else if (ev.code === 'F3') {
            try {
              // Toggle raymarch filter in the post chain
              const has = state.rayFilter && state.filterChain.includes(state.rayFilter);
              if (has) {
                state.filterChain = state.filterChain.filter(f => f !== state.rayFilter);
              } else if (state.rayFilter) {
                state.filterChain.push(state.rayFilter);
              }
              state.rt.sprite.filters = state.filterChain;
              ev.preventDefault();
              ev.stopPropagation();
            } catch (_) {}
          }
        }
        window.addEventListener('keydown', onKey);
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
          try { if (state.rt.occlusion) state.rt.occlusion.destroy(true); } catch (_) {}
          state.rt.occlusion = PIXI.RenderTexture.create({ width: w, height: h, resolution: app.renderer.resolution });
          try { state.rt.occlusion.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; } catch (_) {}
          try { if (state.rayFilter) { state.rayFilter.uniforms.uResolution[0] = w; state.rayFilter.uniforms.uResolution[1] = h; } } catch (_) {}
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
            try { if (tw.occ) tw.occ.position.set(x, y); } catch (_) {}
            if (t >= 1) remove.push(tw);
          });
          remove.forEach((tw) => tweens.delete(tw));
        }

        // Update GI uniforms
        if (state.giFilter) {
          state.giFilter.uniforms.uTime = (now - state.startTs) * 0.001;
          // If a pipeline consumes occlusion, keep the uniform bound
          try { state.giFilter.uniforms.uOcclusion = state.rt.occlusion; } catch (_) {}
        }
        // Update Raymarch uniforms
        if (state.rayFilter) {
          try {
            const w = state.app.renderer.width|0; const h = state.app.renderer.height|0;
            state.rayFilter.uniforms.uResolution[0] = w;
            state.rayFilter.uniforms.uResolution[1] = h;
            state.rayFilter.uniforms.uOcclusion = state.rt.occlusion;
            const p = state.rayParams;
            state.rayFilter.uniforms.uThreshold = p.threshold;
            state.rayFilter.uniforms.uCurve = p.curve;
            state.rayFilter.uniforms.uIntensity = p.intensity;
            state.rayFilter.uniforms.uAmbient = p.ambient;
            state.rayFilter.uniforms.uStepPx = p.stepPx;
            state.rayFilter.uniforms.uSteps = Math.max(1, Math.min(64, (p.steps|0)));
            state.rayFilter.uniforms.uDirCount = Math.max(1, Math.min(32, (p.dirCount|0)));
            state.rayFilter.uniforms.uOcclusionBlock = Math.max(0, Math.min(1, p.occlusionBlock));
            state.rayFilter.uniforms.uDistanceFalloff = Math.max(0, Math.min(2, p.distanceFalloff));
          } catch (_) {}
        }

        // First render occlusion mask offstage
        try { app.renderer.render({ container: state.layers.occlusion, target: state.rt.occlusion, clear: true }); } catch (_) { try { app.renderer.render(state.layers.occlusion, { renderTexture: state.rt.occlusion, clear: true }); } catch (_) {} }

        // Then render world into color RT (try Pixi v7 signature, fallback to v6)
        try { app.renderer.render({ container: root, target: state.rt.scene, clear: true }); } catch (_) { try { app.renderer.render(root, { renderTexture: state.rt.scene, clear: true }); } catch (_) {} }
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

    // Debug: swap the full-screen RT to show occlusion mask, and restore
    function viewOcclusion() {
      try {
        if (state && state.rt && state.rt.sprite && state.rt.occlusion) {
          state.rt.sprite.texture = state.rt.occlusion;
          // Show raw mask without post-fx filters
          try { state.rt.sprite.filters = []; } catch (_) {}
        }
      } catch (_) {}
    }
    function viewScene() {
      try {
        if (state && state.rt && state.rt.sprite && state.rt.scene) {
          state.rt.sprite.texture = state.rt.scene;
          // Restore user filter chain
          try { state.rt.sprite.filters = state.filterChain; } catch (_) {}
        }
      } catch (_) {}
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
      // Redraw with new font when ready
      const redraw = () => { try { if (state.lastSprites && state.lastSprites.length) setSprites(state.lastSprites); } catch (_) {} };
      if (base.valid) redraw();
      else {
        try {
          if (typeof base.once === 'function') base.once('loaded', redraw);
          else if (typeof base.on === 'function') { const h = () => { try { base.off && base.off('loaded', h); } catch (_) {} redraw(); }; base.on('loaded', h); }
          else { const it = setInterval(() => { if (base.valid) { clearInterval(it); redraw(); } }, 16); }
        } catch (_) {}
      }
    }

    // Multi-pass helpers
    function setFilterChain(filtersArray) {
      try {
        state.filterChain = Array.isArray(filtersArray) ? filtersArray.slice() : [];
        // User chain remains on RT sprite (post-fx); black-key stays on world pre-fx
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

    // Raymarch API
    function enableRaymarch() {
      try {
        if (!state.rayFilter) return;
        if (!state.filterChain.includes(state.rayFilter)) state.filterChain.push(state.rayFilter);
        state.rt.sprite.filters = state.filterChain;
      } catch (_) {}
    }
    function disableRaymarch() {
      try {
        if (!state.rayFilter) return;
        state.filterChain = state.filterChain.filter(f => f !== state.rayFilter);
        state.rt.sprite.filters = state.filterChain;
      } catch (_) {}
    }
    function setRayParams(params) {
      try {
        if (!params) return;
        Object.assign(state.rayParams, params);
      } catch (_) {}
    }


    function setSprites(sprites) {
      const floors = state.layers.floors; const world = state.layers.world; const occ = state.layers.occlusion;
      if (!world) return;
      if (floors) floors.removeChildren();
      world.removeChildren();
      try { if (occ) occ.removeChildren(); } catch (_) {}
      try { state.idIndex.clear(); } catch (_) {}
      const list = Array.isArray(sprites) ? sprites : [];
      try { state.lastSprites = list.slice(); } catch (_) { state.lastSprites = list; }
      // Compute a conservative dungeon-space view window for culling
      let cull = null;
      try {
        const app = state.app;
        if (app && app.renderer) {
          const s = state.pixelPerfect ? Math.max(1, Math.round(state.camera.scale)) : state.camera.scale;
          const viewW = app.renderer.width / s;
          const viewH = app.renderer.height / s;
          const minX = Math.floor(state.camera.x / state.tile.w) - 1;
          const minY = Math.floor(state.camera.y / state.tile.h) - 1;
          const maxX = Math.ceil((state.camera.x + viewW) / state.tile.w) + 1;
          const maxY = Math.ceil((state.camera.y + viewH) / state.tile.h) + 1;
          cull = { minX, minY, maxX, maxY };
        }
      } catch (_) { cull = null; }
      list.forEach((s) => {
        try {
          if (cull) {
            const sx = (s.x|0); const sy = (s.y|0);
            if (sx < cull.minX || sy < cull.minY || sx > cull.maxX || sy > cull.maxY) return; // skip offscreen
          }
          const code = Number.isFinite(s?.charCode) ? (s.charCode|0) : ((s?.char && String(s.char).codePointAt(0)) || 32);
          const tex = textureForCode(code);
          if (!tex) return;
          let spr = new PIXI.Sprite(tex);
          try { spr.roundPixels = true; } catch (_) {}
          spr.anchor.set(0, 0); // top-left of tile
          const wp = dungeonToWorld(s.x|0, s.y|0);
          spr.x = wp.x; spr.y = wp.y;
          // Apply optional tint/alpha from sprite spec (no renderer heuristics)
          try {
            if (Array.isArray(s.color) && s.color.length >= 3) {
              const r = clamp(Math.round((s.color[0]||0) * 255), 0, 255);
              const g = clamp(Math.round((s.color[1]||0) * 255), 0, 255);
              const b = clamp(Math.round((s.color[2]||0) * 255), 0, 255);
              spr.tint = (r<<16) | (g<<8) | b;
            } else if (Number.isFinite(s.color)) {
              spr.tint = s.color >>> 0;
            } else {
              spr.tint = 0xFFFFFF;
            }
            if (s.alpha != null) spr.alpha = Math.max(0, Math.min(1, Number(s.alpha)));
          } catch (_) { spr.tint = 0xFFFFFF; }
          // If rows are vertically flipped inside tiles, flip the sprite.
          if (state.flip.row) { spr.scale.y = -1; spr.y += state.tile.h; }
          // Route solid floor block to the unfiltered floors layer and render as a solid quad
          if (floors && code === 219 && s.occludes === false) {
            // Preserve computed tint/alpha from above before we swap the sprite
            const prevTint = (spr && Number.isFinite(spr.tint)) ? (spr.tint >>> 0) : 0xFFFFFF;
            const prevAlpha = (spr && Number.isFinite(spr.alpha)) ? spr.alpha : 1;
            // Replace glyph with a white quad sized to the tile; tint provides color
            spr = new PIXI.Sprite(PIXI.Texture.WHITE);
            try { spr.roundPixels = true; } catch (_) {}
            spr.anchor.set(0, 0);
            spr.x = wp.x; spr.y = wp.y;
            spr.width = state.tile.w; spr.height = state.tile.h;
            // Reapply tint/alpha so it picks up the requested floor color
            try { spr.tint = prevTint; } catch (_) { spr.tint = prevTint; }
            spr.alpha = prevAlpha;
            floors.addChild(spr);
          } else {
            world.addChild(spr);
          }
          if (s.occludes) {
            // Use the exact glyph texture for occlusion so the mask matches visible pixels
            const o = new PIXI.Sprite(tex);
            try { o.roundPixels = true; } catch (_) {}
            o.anchor.set(0, 0);
            o.x = wp.x; o.y = wp.y;
            // Ensure mask is solid white where glyph exists
            try { o.tint = 0xFFFFFF; } catch (_) {}
            o.alpha = 1;
            if (state.flip.row) { o.scale.y = -1; o.y += state.tile.h; }
            occ.addChild(o);
            try { if (s && Object.prototype.hasOwnProperty.call(s, 'id')) state.idIndex.set(s.id, { sprite: spr, occlSprite: o }); } catch (_) {}
          } else {
            try { if (s && Object.prototype.hasOwnProperty.call(s, 'id')) state.idIndex.set(s.id, { sprite: spr, occlSprite: null }); } catch (_) {}
          }
        } catch (_) {}
      });
    }

    // Cleanup
    function destroy() {
      try { if (state.raf) cancelAnimationFrame(state.raf); } catch (_) {}
      try { if (state.app) state.app.destroy(true, { children: true }); } catch (_) {}
      try { if (state.rt && state.rt.occlusion) state.rt.occlusion.destroy(true); } catch (_) {}
      state.app = null;
      state.root = null;
    }

    function animateEntity(id, toX, toY, opts = {}) {
      const rec = state.idIndex.get(id);
      if (!rec) return false;
      const spr = rec.sprite;
      const occ = rec.occlSprite || null;
      const from = { x: spr.x, y: spr.y };
      const dest = dungeonToWorld(toX|0, toY|0);
      const duration = Math.max(1, Number(opts.duration || 250)); // ms
      const ease = (t) => t * t * (3 - 2 * t); // smoothstep
      const start = performance.now();
      const tw = { id, spr, occ, from, dest, start, duration, ease };
      tweens.add(tw);
      return true;
    }

    const api = {
      init,
      setFont,
      setSprites,
      panCamera,
      zoomCamera,
      toScreen: ({ x, y }) => dungeonToScreen(x, y),
      animateEntity,
      enableBlackKeyFilters,
      disableBlackKeyFilters,
      setFilterChain,
      addFilter,
      clearFilters,
      getOcclusionTexture: () => state.rt && state.rt.occlusion,
      viewOcclusion,
      viewScene,
      detectFloorSeams,
      debugGlyphFrame,
      enableRaymarch,
      disableRaymarch,
      setRayParams,
      setGlyphInset: (px) => { try { state.debugInset = Math.max(0, Number(px)||0); state.textures.byCode.clear(); if (state.lastSprites && state.lastSprites.length) setSprites(state.lastSprites); } catch (_) {} },
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

    // Apply any pending assets staged before boot
    try { if (window.__pendingSprites) api.setSprites(window.__pendingSprites); } catch (_) {}

    console.log('[pixiDungeonRenderer] ready. Exposed as window.pxr');
    // Signal readiness so producers (e.g., dungeonDisplayManager) can push content deterministically
    try { window.dispatchEvent(new CustomEvent('pxr:ready')); } catch (_) {}
    return api;
  }

  // Expose boot function
  window.bootPixiRenderer = bootPixiRenderer;
})();
