// ASCII Renderer integration extracted from main.js
// Keeps behavior the same, but modular. Uses global UI helpers if present.

import { initAudio } from './audio/audioManager.js';
import { getFont, resolveImageSrc } from './ui/dungeon/fontCatalog.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${src}?v=${Date.now()}`; // cache-bust
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

// Hide legacy demo DOM and vendor demo controls when our canvas is active
function hideLegacyDom() {
  try { document.body.style.background = '#000'; } catch (_) {}
  try {
    const app = document.getElementById('app');
    if (app) {
      app.querySelectorAll('h1, p, pre').forEach((el) => { el.style.display = 'none'; });
    }

    // After RC is ready, apply saved dungeon font from localStorage if any
    try {
      const savedIdRaw = localStorage.getItem('ui_dungeon_font_id');
      if (savedIdRaw) {
        // Migrate legacy ids like Display tab does
        const alias = {
          'vendor-16x16': 'Bisasam_16x16',
          'Bisasam 16x16': 'Bisasam_16x16',
        };
        const savedId = alias[savedIdRaw] || savedIdRaw;
        const f = getFont(savedId);
        if (f) {
          const src = resolveImageSrc(f);
          if (src) {
            const detail = {
              id: f.id,
              name: f.name,
              tile: f.tile,
              atlas: f.atlas,
              startCode: Number.isFinite(f.startCode) ? f.startCode : 32,
            };
            // Include flip hints only if defined on the font entry
            if (Object.prototype.hasOwnProperty.call(f, 'flipTextureY')) detail.flipTextureY = !!f.flipTextureY;
            if (Object.prototype.hasOwnProperty.call(f, 'flipTextureX')) detail.flipTextureX = !!f.flipTextureX;
            if (Object.prototype.hasOwnProperty.call(f, 'flipRow')) detail.flipRow = !!f.flipRow;
            if (Object.prototype.hasOwnProperty.call(f, 'flipTileY')) detail.flipTileY = !!f.flipTileY;
            if (f.dataUrl) detail.dataUrl = f.dataUrl; else detail.url = src;
            window.dispatchEvent(new CustomEvent('ui:dungeon-font-changed', { detail }));
          }
        }
      } else {
        // No saved font yet: proactively dispatch default 'vendor-8x8' like the Display tab does
        const f = getFont('vendor-8x8');
        if (f) {
          const src = resolveImageSrc(f);
          if (src) {
            const detail = {
              id: f.id,
              name: f.name,
              tile: f.tile,
              atlas: f.atlas,
              startCode: Number.isFinite(f.startCode) ? f.startCode : 32,
            };
            // Include flip hints only if defined on the font entry
            if (Object.prototype.hasOwnProperty.call(f, 'flipTextureY')) detail.flipTextureY = !!f.flipTextureY;
            if (Object.prototype.hasOwnProperty.call(f, 'flipTextureX')) detail.flipTextureX = !!f.flipTextureX;
            if (Object.prototype.hasOwnProperty.call(f, 'flipRow')) detail.flipRow = !!f.flipRow;
            if (Object.prototype.hasOwnProperty.call(f, 'flipTileY')) detail.flipTileY = !!f.flipTileY;
            if (f.dataUrl) detail.dataUrl = f.dataUrl; else detail.url = src;
            window.dispatchEvent(new CustomEvent('ui:dungeon-font-changed', { detail }));
          }
        }
      }
    } catch (_) {}
  } catch (_) {}
  // If vendor demo controls ever sneak in, hide them defensively
  try {
    ['enable-nearest','bilinear-fix','rc-sun-angle-slider','falloff-slider-container','radius-slider-container']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    document.querySelectorAll('.iconButton').forEach((el) => { el.style.display = 'none'; });
  } catch (_) {}
}

export async function setupAsciiRenderer() {
  try {
    const base = '/vendor/ascii-dungeon/ascii-dungeon';
    // Load in the same order as vendor example
    await loadScript(`${base}/interactivity-setup.js`);
    await loadScript(`${base}/ascii-texture.js`);
    await loadScript(`${base}/ascii-gi-helpers.js`);
    await loadScript(`${base}/ascii-gi.js`);

    // Create container if not present (no HTML edits)
    const app = document.getElementById('app');
    let container = document.getElementById('rc-canvas');
    if (!container) {
      container = document.createElement('div');
      container.id = 'rc-canvas';
      container.style.display = '';
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.zIndex = '1';
      app.appendChild(container);
    }

    // Proactively hide legacy DOM under our fullscreen canvas
    hideLegacyDom();

    // Fullscreen size; DPR handled by RC props
    const width = Math.max(320, window.innerWidth || 1024);
    const height = Math.max(240, window.innerHeight || 768);

    // RC is declared by vendor scripts as a global. It may not be on window,
    // so use a safe lookup that works with declarative globals.
    const RCClass = (typeof RC !== 'undefined') ? RC : window.RC;
    const rc = new RCClass({ id: 'rc-canvas', width, height, dpr: 1.0 });
    window.radianceCascades = rc; // expose for debugging/devtools
    if (typeof rc.load === 'function') {
      try { console.log('[DEBUG client] calling rc.load()'); } catch (_) {}
      rc.load();
    }

    // Robust resize handler: updates canvas/container, renderer internals, uniforms, and render targets
    const handleResize = () => {
      try {
        const w = Math.max(320, window.innerWidth || 1024);
        const h = Math.max(240, window.innerHeight || 768);
        const dpr = window.devicePixelRatio || 1;

        // Ensure container fills viewport
        try {
          container.style.width = '100vw';
          container.style.height = '100vh';
        } catch (_) {}

        // Also update canvas CSS size and backing store to match DPR
        try {
          const canvas = rc.canvas;
          if (canvas) {
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
          }
        } catch (_) {}

        // Update renderer dimensions and DPR
        rc.width = w;
        rc.height = h;
        rc.dpr = dpr;

        // Rebuild base dungeon render targets for the new size (preserves camera)
        if (typeof rc.resize === 'function') rc.resize(w, h, dpr);

        // Update viewport-dependent uniforms
        if (rc.dungeonUniforms) rc.dungeonUniforms.viewportSize = [w, h];

        // Recalculate cascade parameters and dependent uniforms
        if (typeof rc.initializeParameters === 'function') rc.initializeParameters(true);

        // Recreate shader pipelines and render targets using new size/DPR
        if (typeof rc.innerInitialize === 'function') rc.innerInitialize();

        // Refresh ASCII view texture after resize if a dungeon map exists
        try {
          if (rc.surface && typeof rc.updateAsciiViewTexture === 'function' && typeof rc.surface.dungeonMap === 'string') {
            rc.updateAsciiViewTexture(rc.surface.dungeonMap);
          }
        } catch (_) {}

        // Update camera/grid uniforms and trigger a redraw
        try { if (typeof rc.updateCameraUniforms === 'function') rc.updateCameraUniforms(); } catch (_) {}
        try { if (typeof rc.renderPass === 'function') rc.renderPass(); } catch (_) {}

        // Keep legacy demo DOM hidden after resize/fullscreen
        try { hideLegacyDom(); } catch (_) {}
      } catch (e) {
        console.warn('[resize] handler failed', e);
      }
    };

    // Handle window resizing dynamically
    window.addEventListener('resize', handleResize);

    // Mirror resize on fullscreen changes and re-hide legacy DOM
    ;['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach((evt) => {
      document.addEventListener(evt, () => { handleResize(); try { hideLegacyDom(); } catch (_) {} });
    });

    // Programmatic fullscreen toggle and keybinding ('f')
    const isFullscreen = () => (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    window.toggleFullscreen = async () => {
      try {
        if (isFullscreen()) {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
          else if (document.msExitFullscreen) await document.msExitFullscreen();
        } else {
          if (container.requestFullscreen) await container.requestFullscreen();
          else if (container.webkitRequestFullscreen) await container.webkitRequestFullscreen();
          else if (container.msRequestFullscreen) await container.msRequestFullscreen();
        }
      } catch (_) {}
    };

    // Integrate floating zoom buttons with renderer
    window.addEventListener('ui:zoom', (e) => {
      try { const f = Number(e?.detail?.factor) || 1.0; rc.zoomCamera(f, 0.5, 0.5); } catch (_) {}
    });

    // FPS estimator for status bar (simple rAF-based)
    (function fpsLoop(){
      let last = performance.now(), frames = 0, acc = 0;
      function tick(now){
        const dt = now - last; last = now; frames++; acc += dt;
        if (acc >= 1000) {
          const fps = Math.round(frames * 1000 / acc);
          frames = 0; acc = 0;
          try {
            const metricsEl = document.getElementById('status-metrics');
            if (metricsEl) {
              const txt = metricsEl.textContent || '';
              const parts = txt.split('|');
              metricsEl.textContent = `FPS: ${fps} | ${parts[1] ? parts[1].trim() : 'PING: --'}`;
            }
          } catch (_) {}
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })();

    // Ensure UI chrome exists (use globals if available)
    try { if (window.ensureStatusBar) window.ensureStatusBar(); } catch (_) {}
    try { if (window.ensureZoomControls) window.ensureZoomControls(); } catch (_) {}
    // Disable center debug knob while keeping audio wiring; floating panel also off for now
    try { initAudio({ floatingVolume: false, centerDebugKnob: false }); } catch (_) {}
    try { if (window.ensureBanner) window.ensureBanner(); } catch (_) {}
    try { if (window.ensureDungeonScrim) window.ensureDungeonScrim(); } catch (_) {}

    // Apply any pending assets received before renderer was ready
    if (window.__pendingDungeonMap && typeof rc.setDungeonMap === 'function') {
      try {
        console.log('[DEBUG client] applying pending dungeonMap');
        rc.setDungeonMap(window.__pendingDungeonMap);
      } catch (_) {}
      window.__pendingDungeonMap = undefined;
    }
    if (window.__pendingDungeonFont && rc && rc.renderer) {
      try {
        const meta = window.__pendingDungeonFont;
        console.log('[DEBUG client] applying pending dungeon font', meta);
        const src = meta && (meta.dataUrl || meta.url);
        if (src) {
          // Respect optional flip hints; default to flipY=true to match vendor behavior
          const options = {
            flipY: (meta && meta.flipTextureY === undefined) ? true : !!meta.flipTextureY,
            flipX: !!(meta && meta.flipTextureX),
          };
          const tex = rc.renderer.createTextureFromImage(src, options, () => {
            try {
              rc.renderer.font = tex;
              if (rc.dungeonUniforms) {
                rc.dungeonUniforms.asciiTexture = tex;
                if (meta.tile && Number.isFinite(meta.tile.w) && Number.isFinite(meta.tile.h)) {
                  rc.dungeonUniforms.tileSize = [meta.tile.w, meta.tile.h];
                }
                if (meta.atlas && Number.isFinite(meta.atlas.cols) && Number.isFinite(meta.atlas.rows)) {
                  rc.dungeonUniforms.atlasSize = [meta.atlas.cols, meta.atlas.rows];
                }
                if (Number.isFinite(meta.startCode)) {
                  rc.dungeonUniforms.startCode = meta.startCode * 1.0;
                }
                // Apply optional shader flip controls if provided
                if (Object.prototype.hasOwnProperty.call(meta, 'flipRow')) {
                  rc.dungeonUniforms.flipRow = meta.flipRow ? 1.0 : 0.0;
                }
                if (Object.prototype.hasOwnProperty.call(meta, 'flipTileY')) {
                  rc.dungeonUniforms.flipTileY = meta.flipTileY ? 1.0 : 0.0;
                }
                // Cache applied meta to prevent redundant re-applies
                try {
                  rc.__appliedFontMeta = {
                    id: meta.id,
                    src: (meta.dataUrl || meta.url) || null,
                    tileW: meta.tile && meta.tile.w,
                    tileH: meta.tile && meta.tile.h,
                    atlasCols: meta.atlas && meta.atlas.cols,
                    atlasRows: meta.atlas && meta.atlas.rows,
                    startCode: Number.isFinite(meta.startCode) ? meta.startCode : undefined,
                    flipRow: !!meta.flipRow,
                    flipTileY: !!meta.flipTileY,
                  };
                } catch (_) {}
                // Force-refresh view texture and pipelines to match steady-state
                try {
                  if (rc.surface && typeof rc.surface.dungeonMap === 'string' && typeof rc.updateAsciiViewTexture === 'function') {
                    rc.updateAsciiViewTexture(rc.surface.dungeonMap);
                  }
                } catch (_) {}
                try { if (typeof rc.innerInitialize === 'function') rc.innerInitialize(); } catch (_) {}
                try { if (typeof rc.updateCameraUniforms === 'function') rc.updateCameraUniforms(); } catch (_) {}
                rc.renderPass && rc.renderPass();
                // One extra frame next tick to ensure everything is latched post-init
                try { setTimeout(() => { try { rc.renderPass && rc.renderPass(); } catch (_) {} }, 0); } catch (_) {}
              }
            } catch (e) { console.warn('[font update] pending apply failed', e); }
          });
        }
      } catch (_) {}
      window.__pendingDungeonFont = undefined;
    }
    if (window.__pendingCharacterColorMap && rc.surface && typeof rc.surface.setCharacterColorMap === 'function') {
      try {
        console.log('[DEBUG client] applying pending characterColorMap');
        rc.surface.setCharacterColorMap(window.__pendingCharacterColorMap);
      } catch (_) {}
      window.__pendingCharacterColorMap = undefined;
    }
    if (window.__pendingPositionColorMap && rc.surface && typeof rc.surface.setPositionColorMap === 'function') {
      try {
        console.log('[DEBUG client] applying pending positionColorMap');
        rc.surface.setPositionColorMap(window.__pendingPositionColorMap);
      } catch (_) {}
      window.__pendingPositionColorMap = undefined;
    }

    // New: apply pending PositionBlockMap fill and Entities (layered rendering)
    if (typeof window.__pendingBlockFill !== 'undefined' && typeof rc.setPositionBlockMapFill === 'function') {
      try {
        console.log('[DEBUG client] applying pending block-fill', window.__pendingBlockFill);
        rc.setPositionBlockMapFill(window.__pendingBlockFill);
      } catch (_) {}
      window.__pendingBlockFill = undefined;
    }
    if (window.__pendingEntities && typeof rc.setEntities === 'function') {
      try {
        console.log('[DEBUG client] applying pending entities', window.__pendingEntities?.length || 0);
        rc.setEntities(window.__pendingEntities);
      } catch (_) {}
      window.__pendingEntities = undefined;
    }

    // Minimal camera controls (mouse): pan + wheel zoom
    const canvas = rc.canvas;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const zoomFactor = 1.0 / Math.sqrt(rc.camera.zoomLevel || 1.0);
      rc.panCamera(-dx * zoomFactor, -dy * zoomFactor);
      lastX = e.clientX;
      lastY = e.clientY;
    });

    // Defensive: if the pointer leaves the canvas mid-drag, reset state/cursor
    canvas.addEventListener('mouseleave', () => {
      if (!dragging) return;
      dragging = false;
      try { canvas.style.cursor = 'default'; } catch (_) {}
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = 'default';
    });

    // Defensive: if the window loses focus while dragging, ensure we reset state/cursor
    window.addEventListener('blur', () => {
      if (!dragging) return;
      dragging = false;
      try { canvas.style.cursor = 'default'; } catch (_) {}
    });

    // Wheel zoom: zoom at pointer position
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      rc.zoomCamera(factor, x, y);
    }, { passive: false });

    // Keyboard helpers: +/- zoom and F8 UI toggle
    window.addEventListener('keydown', (e) => {
      try {
        if (e.key === '+' || e.key === '=') {
          rc.zoomCamera(1.1, 0.5, 0.5);
        } else if (e.key === '-') {
          rc.zoomCamera(0.9, 0.5, 0.5);
        } else if (e.key === 'F8') {
          const hidden = document.body.getAttribute('data-ui-hidden') === 'true' ? false : true;
          document.body.setAttribute('data-ui-hidden', hidden ? 'true' : 'false');

          const toggleEl = (el) => {
            if (!el) return;
            if (hidden) {
              if (!el.getAttribute('data-prev-display')) el.setAttribute('data-prev-display', el.style.display || '');
              el.style.display = 'none';
            } else {
              const prev = el.getAttribute('data-prev-display');
              el.style.display = (prev != null) ? prev : '';
              el.removeAttribute('data-prev-display');
            }
          };

          // Known chrome and overlay containers
          const ids = [
            'hover-status-bar', 'zoom-controls', 'settings-overlay-root', 'settings-scrim',
            'overlay', 'overlay-content', 'modal-root', 'dungeon-scrim'
          ];
          ids.forEach((id) => toggleEl(document.getElementById(id)));

          // Route screens (LOGIN, LOBBY, ROOM, GAMEPLAY_*), created via makeScreen(id)
          try {
            const states = (window.APP_STATES || {});
            Object.values(states).forEach((sid) => {
              toggleEl(document.getElementById(String(sid)));
            });
          } catch (_) {}

          // Login modal cards (class)
          try {
            document.querySelectorAll('.login-card').forEach((el) => toggleEl(el));
          } catch (_) {}
        }
      } catch (_) {}
    });

    // Initial adjustment
    handleResize();

    // Ensure the current dungeon font is applied after vendor load completes (avoid race)
    try {
      const applySelectedFont = () => {
        const rc = window.radianceCascades;
        if (!rc || !rc.renderer || !rc.dungeonUniforms) return false;
        // Defer until the view texture exists to match steady-state rendering conditions
        if (!rc.asciiViewTexture) return false;
        let fontId = null;
        try { fontId = localStorage.getItem('ui_dungeon_font_id'); } catch (_) { fontId = null; }
        const alias = { 'vendor-16x16': 'Bisasam_16x16', 'Bisasam 16x16': 'Bisasam_16x16' };
        const resolvedId = alias[fontId] || fontId || 'vendor-8x8';
        const f = getFont(resolvedId);
        if (!f) return true; // nothing to apply
        const src = resolveImageSrc(f);
        if (!src) return true;
        const meta = {
          id: resolvedId,
          dataUrl: src,
          tile: f.tile,
          atlas: f.atlas,
        };
        // Only attach flip flags if explicitly defined on the font entry
        if (Object.prototype.hasOwnProperty.call(f, 'flipRow')) meta.flipRow = !!f.flipRow;
        if (Object.prototype.hasOwnProperty.call(f, 'flipTileY')) meta.flipTileY = !!f.flipTileY;
        // Respect optional flip hints; default to flipY=true to match vendor behavior
        const options = {
          flipY: (f && f.flipTextureY === undefined) ? true : !!f.flipTextureY,
          flipX: !!(f && f.flipTextureX),
        };
        // Skip if identical to last applied font
        try {
          const last = rc.__appliedFontMeta || null;
          const sameId = !!(last && last.id === meta.id);
          const sameSrc = !!(last && last.src === (meta.dataUrl || meta.url));
          const sameTile = !!(last && last.tileW === (meta.tile && meta.tile.w) && last.tileH === (meta.tile && meta.tile.h));
          const sameAtlas = !!(last && last.atlasCols === (meta.atlas && meta.atlas.cols) && last.atlasRows === (meta.atlas && meta.atlas.rows));
          const sameFlipRow = !!(last && last.flipRow === (!!meta.flipRow));
          const sameFlipTileY = !!(last && last.flipTileY === (!!meta.flipTileY));
          if (sameId && sameSrc && sameTile && sameAtlas && sameFlipRow && sameFlipTileY) {
            return false; // no-op; visuals already consistent
          }
        } catch (_) {}

        const tex = rc.renderer.createTextureFromImage(src, options, () => {
          try {
            rc.renderer.font = tex;
            if (rc.dungeonUniforms) {
              rc.dungeonUniforms.asciiTexture = tex;
              if (meta.tile && Number.isFinite(meta.tile.w) && Number.isFinite(meta.tile.h)) {
                rc.dungeonUniforms.tileSize = [meta.tile.w, meta.tile.h];
              }
              if (meta.atlas && Number.isFinite(meta.atlas.cols) && Number.isFinite(meta.atlas.rows)) {
                rc.dungeonUniforms.atlasSize = [meta.atlas.cols, meta.atlas.rows];
              }
              if (Number.isFinite(meta.startCode)) {
                rc.dungeonUniforms.startCode = meta.startCode * 1.0;
              }
              // Apply optional shader flip controls if provided
              if (Object.prototype.hasOwnProperty.call(meta, 'flipRow')) {
                rc.dungeonUniforms.flipRow = meta.flipRow ? 1.0 : 0.0;
              }
              if (Object.prototype.hasOwnProperty.call(meta, 'flipTileY')) {
                rc.dungeonUniforms.flipTileY = meta.flipTileY ? 1.0 : 0.0;
              }
              // Cache applied meta to prevent redundant re-applies
              try {
                rc.__appliedFontMeta = {
                  id: meta.id,
                  src: (meta.dataUrl || meta.url) || null,
                  tileW: meta.tile && meta.tile.w,
                  tileH: meta.tile && meta.tile.h,
                  atlasCols: meta.atlas && meta.atlas.cols,
                  atlasRows: meta.atlas && meta.atlas.rows,
                  startCode: Number.isFinite(meta.startCode) ? meta.startCode : undefined,
                  flipRow: !!meta.flipRow,
                  flipTileY: !!meta.flipTileY,
                };
              } catch (_) {}
              // Force-refresh view texture and pipelines to match steady-state
              try {
                if (rc.surface && typeof rc.surface.dungeonMap === 'string' && typeof rc.updateAsciiViewTexture === 'function') {
                  rc.updateAsciiViewTexture(rc.surface.dungeonMap);
                }
              } catch (_) {}
              try { if (typeof rc.innerInitialize === 'function') rc.innerInitialize(); } catch (_) {}
              try { if (typeof rc.updateCameraUniforms === 'function') rc.updateCameraUniforms(); } catch (_) {}
              rc.renderPass && rc.renderPass();
              // One extra frame next tick to ensure everything is latched post-init
              try { setTimeout(() => { try { rc.renderPass && rc.renderPass(); } catch (_) {} }, 0); } catch (_) {}
            }
          } catch (_) {}
        });
        return true;
      };
      let tries = 0;
      const maxTries = 60; // ~1s at ~16ms
      (function waitForVendor(){
        const rc = window.radianceCascades;
        if (rc && rc.initialized && rc.asciiViewTexture) {
          if (!applySelectedFont()) {
            // If apply returned false due to a late check, try again next tick
            setTimeout(waitForVendor, 16);
          }
        } else if (tries++ < maxTries) {
          setTimeout(waitForVendor, 16);
        } else {
          // Give it one best-effort apply even if not flagged initialized
          applySelectedFont();
        }
      })();
    } catch (_) {}
  } catch (e) {
    console.error('[ASCII renderer] setup failed:', e);
  }
}

// Global listener: update dungeon font dynamically from Display tab
try {
  window.addEventListener('ui:dungeon-font-changed', (e) => {
    try {
      const meta = (e && e.detail) || null;
      if (!meta) return;
      const src = meta.dataUrl || meta.url;
      if (!src) return;
      const rc = window.radianceCascades;
      if (!rc || !rc.renderer) {
        // Renderer not ready yet; stash for setupAsciiRenderer to consume
        window.__pendingDungeonFont = meta;
        return;
      }
      // Create texture and swap into uniforms on load
      // Respect optional flip hints; default to flipY=true to match vendor behavior
      const options = {
        flipY: (meta && meta.flipTextureY === undefined) ? true : !!meta.flipTextureY,
        flipX: !!(meta && meta.flipTextureX),
      };
      // Skip if identical to last applied font
      try {
        const last = rc.__appliedFontMeta || null;
        const sameId = !!(last && last.id === meta.id);
        const sameSrc = !!(last && last.src === (meta.dataUrl || meta.url));
        const sameTile = !!(last && last.tileW === (meta.tile && meta.tile.w) && last.tileH === (meta.tile && meta.tile.h));
        const sameAtlas = !!(last && last.atlasCols === (meta.atlas && meta.atlas.cols) && last.atlasRows === (meta.atlas && meta.atlas.rows));
        const sameFlipRow = !!(last && last.flipRow === (!!meta.flipRow));
        const sameFlipTileY = !!(last && last.flipTileY === (!!meta.flipTileY));
        if (sameId && sameSrc && sameTile && sameAtlas && sameFlipRow && sameFlipTileY) {
          return; // no-op; visuals already consistent
        }
      } catch (_) {}

      const tex = rc.renderer.createTextureFromImage(src, options, () => {
        try {
          rc.renderer.font = tex;
          if (rc.dungeonUniforms) {
            rc.dungeonUniforms.asciiTexture = tex;
            if (meta.tile && Number.isFinite(meta.tile.w) && Number.isFinite(meta.tile.h)) {
              rc.dungeonUniforms.tileSize = [meta.tile.w, meta.tile.h];
            }
            if (meta.atlas && Number.isFinite(meta.atlas.cols) && Number.isFinite(meta.atlas.rows)) {
              rc.dungeonUniforms.atlasSize = [meta.atlas.cols, meta.atlas.rows];
            }
            if (Number.isFinite(meta.startCode)) {
              rc.dungeonUniforms.startCode = meta.startCode * 1.0;
            }
            // Apply optional shader flip controls if provided
            if (Object.prototype.hasOwnProperty.call(meta, 'flipRow')) {
              rc.dungeonUniforms.flipRow = meta.flipRow ? 1.0 : 0.0;
            }
            if (Object.prototype.hasOwnProperty.call(meta, 'flipTileY')) {
              rc.dungeonUniforms.flipTileY = meta.flipTileY ? 1.0 : 0.0;
            }
            // Cache applied meta to prevent redundant re-applies
            try {
              rc.__appliedFontMeta = {
                id: meta.id,
                src: (meta.dataUrl || meta.url) || null,
                tileW: meta.tile && meta.tile.w,
                tileH: meta.tile && meta.tile.h,
                atlasCols: meta.atlas && meta.atlas.cols,
                atlasRows: meta.atlas && meta.atlas.rows,
                startCode: Number.isFinite(meta.startCode) ? meta.startCode : undefined,
                flipRow: !!meta.flipRow,
                flipTileY: !!meta.flipTileY,
              };
            } catch (_) {}
            // Force-refresh view texture and pipelines to match steady-state
            try {
              if (rc.surface && typeof rc.surface.dungeonMap === 'string' && typeof rc.updateAsciiViewTexture === 'function') {
                rc.updateAsciiViewTexture(rc.surface.dungeonMap);
              }
            } catch (_) {}
            try { if (typeof rc.innerInitialize === 'function') rc.innerInitialize(); } catch (_) {}
            // Re-apply uniforms after pipeline rebuild to avoid losing state
            try {
              if (rc.dungeonUniforms) {
                rc.dungeonUniforms.asciiTexture = tex;
                if (meta.tile && Number.isFinite(meta.tile.w) && Number.isFinite(meta.tile.h)) {
                  rc.dungeonUniforms.tileSize = [meta.tile.w, meta.tile.h];
                }
                if (meta.atlas && Number.isFinite(meta.atlas.cols) && Number.isFinite(meta.atlas.rows)) {
                  rc.dungeonUniforms.atlasSize = [meta.atlas.cols, meta.atlas.rows];
                }
                if (Number.isFinite(meta.startCode)) {
                  rc.dungeonUniforms.startCode = meta.startCode * 1.0;
                }
                if (Object.prototype.hasOwnProperty.call(meta, 'flipRow')) {
                  rc.dungeonUniforms.flipRow = meta.flipRow ? 1.0 : 0.0;
                }
                if (Object.prototype.hasOwnProperty.call(meta, 'flipTileY')) {
                  rc.dungeonUniforms.flipTileY = meta.flipTileY ? 1.0 : 0.0;
                }
              }
            } catch (_) {}
            // Recompute grid/camera with the new tile size so the first drag doesn't "snap"
            try { if (typeof rc.updateCameraUniforms === 'function') rc.updateCameraUniforms(); } catch (_) {}
            rc.renderPass && rc.renderPass();
            try { setTimeout(() => { try { rc.renderPass && rc.renderPass(); } catch (_) {} }, 0); } catch (_) {}
          }
        } catch (e) { console.warn('[font update] pending apply failed', e); }
      });
    } catch (err) {
      console.warn('[font update] listener error', err);
    }
  });
} catch (_) {}

// Global listener: debug threshold/curve from Display tab
try {
  window.addEventListener('ui:rc-debug-changed', (e) => {
    try {
      const rc = window.radianceCascades;
      if (!rc || !rc.rcUniforms) return;
      const d = (e && e.detail) || {};
      const threshold = Number(d.threshold) || 0;
      const curve = Number(d.curve) || 1;
      const fogAmount = (d.fogAmount != null) ? Math.max(0, Math.min(1, Number(d.fogAmount))) : null;
      const srgbFalloff = (d.srgbFalloff != null) ? Math.max(0, Math.min(3, Number(d.srgbFalloff))) : null;
      const overlayGain = (d.overlayGain != null) ? Math.max(0, Math.min(3, Number(d.overlayGain))) : null;
      const bilinearFixEnabled = (d.bilinearFixEnabled != null) ? !!d.bilinearFixEnabled : null;
      rc.rcUniforms.threshold = threshold;
      rc.rcUniforms.curve = curve;
      // Map Falloff slider to distance attenuation (lightDecay) to control shadow range
      if (srgbFalloff != null) rc.rcUniforms.lightDecay = srgbFalloff;
      if (rc.overlayUniforms && fogAmount != null) rc.overlayUniforms.fogAmount = fogAmount;
      if (rc.overlayUniforms && overlayGain != null) rc.overlayUniforms.overlayGain = overlayGain;
      if (bilinearFixEnabled != null) rc.rcUniforms.bilinearFixEnabled = bilinearFixEnabled;
      rc.renderPass && rc.renderPass();
    } catch (_) {}
  });
} catch (_) {}

// ... (rest of the code remains the same)

// Ensure the current dungeon font is applied after vendor load completes (avoid race)
try {
  const applySelectedFont = () => {
    const rc = window.radianceCascades;
    if (!rc || !rc.renderer || !rc.dungeonUniforms) return false;
    // Defer until the view texture exists to match steady-state rendering conditions
    if (!rc.asciiViewTexture) return false;
    let fontId = null;
    try { fontId = localStorage.getItem('ui_dungeon_font_id'); } catch (_) { fontId = null; }
    const alias = { 'vendor-16x16': 'Bisasam_16x16', 'Bisasam 16x16': 'Bisasam_16x16' };
    const resolvedId = alias[fontId] || fontId || 'vendor-8x8';
    const f = getFont(resolvedId);
    if (!f) return true; // nothing to apply
    const src = resolveImageSrc(f);
    if (!src) return true;
    const meta = {
      id: resolvedId,
      dataUrl: src,
      tile: f.tile,
      atlas: f.atlas,
    };
    // Only attach flip flags if explicitly defined on the font entry
    if (Object.prototype.hasOwnProperty.call(f, 'flipRow')) meta.flipRow = !!f.flipRow;
    if (Object.prototype.hasOwnProperty.call(f, 'flipTileY')) meta.flipTileY = !!f.flipTileY;
    // Respect optional flip hints; default to flipY=true to match vendor behavior
    const options = {
      flipY: (f && f.flipTextureY === undefined) ? true : !!f.flipTextureY,
      flipX: !!(f && f.flipTextureX),
    };
    // Skip if identical to last applied font
    try {
      const last = rc.__appliedFontMeta || null;
      const sameId = !!(last && last.id === meta.id);
      const sameSrc = !!(last && last.src === (meta.dataUrl || meta.url));
      const sameTile = !!(last && last.tileW === (meta.tile && meta.tile.w) && last.tileH === (meta.tile && meta.tile.h));
      const sameAtlas = !!(last && last.atlasCols === (meta.atlas && meta.atlas.cols) && last.atlasRows === (meta.atlas && meta.atlas.rows));
      const sameFlipRow = !!(last && last.flipRow === (!!meta.flipRow));
      const sameFlipTileY = !!(last && last.flipTileY === (!!meta.flipTileY));
      if (sameId && sameSrc && sameTile && sameAtlas && sameFlipRow && sameFlipTileY) {
        return false; // no-op; visuals already consistent
      }
    } catch (_) {}

    const tex = rc.renderer.createTextureFromImage(src, options, () => {
      try {
        rc.renderer.font = tex;
        if (rc.dungeonUniforms) {
          rc.dungeonUniforms.asciiTexture = tex;
          if (meta.tile && Number.isFinite(meta.tile.w) && Number.isFinite(meta.tile.h)) {
            rc.dungeonUniforms.tileSize = [meta.tile.w, meta.tile.h];
          }
          if (meta.atlas && Number.isFinite(meta.atlas.cols) && Number.isFinite(meta.atlas.rows)) {
            rc.dungeonUniforms.atlasSize = [meta.atlas.cols, meta.atlas.rows];
          }
          // Apply optional shader flip controls if provided
          if (Object.prototype.hasOwnProperty.call(meta, 'flipRow')) {
            rc.dungeonUniforms.flipRow = meta.flipRow ? 1.0 : 0.0;
          }
          if (Object.prototype.hasOwnProperty.call(meta, 'flipTileY')) {
            rc.dungeonUniforms.flipTileY = meta.flipTileY ? 1.0 : 0.0;
          }
          // Cache applied meta to prevent redundant re-applies
          try {
            rc.__appliedFontMeta = {
              id: meta.id,
              src: (meta.dataUrl || meta.url) || null,
              tileW: meta.tile && meta.tile.w,
              tileH: meta.tile && meta.tile.h,
              atlasCols: meta.atlas && meta.atlas.cols,
              atlasRows: meta.atlas && meta.atlas.rows,
              flipRow: !!meta.flipRow,
              flipTileY: !!meta.flipTileY,
            };
          } catch (_) {}
          // Force-refresh view texture and pipelines to match steady-state
          try {
            if (rc.surface && typeof rc.surface.dungeonMap === 'string' && typeof rc.updateAsciiViewTexture === 'function') {
              rc.updateAsciiViewTexture(rc.surface.dungeonMap);
            }
          } catch (_) {}
          try { if (typeof rc.innerInitialize === 'function') rc.innerInitialize(); } catch (_) {}
          try { if (typeof rc.updateCameraUniforms === 'function') rc.updateCameraUniforms(); } catch (_) {}
          rc.renderPass && rc.renderPass();
          // One extra frame next tick to ensure everything is latched post-init
          try { setTimeout(() => { try { rc.renderPass && rc.renderPass(); } catch (_) {} }, 0); } catch (_) {}
        }
      } catch (_) {}
    });
    return true;
  };
  let tries = 0;
  const maxTries = 60; // ~1s at ~16ms
  (function waitForVendor(){
    const rc = window.radianceCascades;
    if (rc && rc.initialized && rc.asciiViewTexture) {
      if (!applySelectedFont()) {
        // If apply returned false due to a late check, try again next tick
        setTimeout(waitForVendor, 16);
      }
    } else if (tries++ < maxTries) {
      setTimeout(waitForVendor, 16);
    } else {
      // Give it one best-effort apply even if not flagged initialized
      applySelectedFont();
    }
  })();
} catch (_) {}
