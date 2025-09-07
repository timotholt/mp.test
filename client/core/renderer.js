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
            // Optional per-font orientation overrides
            if (Number.isFinite(f.flipRow)) detail.flipRow = Number(f.flipRow);
            if (Number.isFinite(f.flipTileY)) detail.flipTileY = Number(f.flipTileY);
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
          const tex = rc.renderer.createTextureFromImage(src, (dims) => {
            try {
              rc.renderer.font = tex;
              if (rc.dungeonUniforms) {
                rc.dungeonUniforms.asciiTexture = tex;
                let cols = meta?.atlas?.cols, rows = meta?.atlas?.rows;
                if (Number.isFinite(cols) && Number.isFinite(rows) && dims && dims.width && dims.height) {
                  const dw = Math.round(dims.width / cols);
                  const dh = Math.round(dims.height / rows);
                  if (!meta.tile || meta.tile.w !== dw || meta.tile.h !== dh) {
                    try { console.warn('[font] derived tileSize differs from metadata', { metaTile: meta.tile, derived: { w: dw, h: dh } }); } catch (_) {}
                    rc.dungeonUniforms.tileSize = [dw, dh];
                  } else {
                    rc.dungeonUniforms.tileSize = [meta.tile.w, meta.tile.h];
                  }
                  rc.dungeonUniforms.atlasSize = [cols, rows];
                } else {
                  if (meta.tile && Number.isFinite(meta.tile.w) && Number.isFinite(meta.tile.h)) {
                    rc.dungeonUniforms.tileSize = [meta.tile.w, meta.tile.h];
                  }
                  if (meta.atlas && Number.isFinite(meta.atlas.cols) && Number.isFinite(meta.atlas.rows)) {
                    rc.dungeonUniforms.atlasSize = [meta.atlas.cols, meta.atlas.rows];
                  }
                }
                if (Number.isFinite(meta.startCode)) {
                  rc.dungeonUniforms.asciiStartCode = Number(meta.startCode);
                }
                // Apply optional per-font flip overrides when provided
                if (Number.isFinite(meta.flipRow)) rc.dungeonUniforms.flipRow = Number(meta.flipRow);
                if (Number.isFinite(meta.flipTileY)) rc.dungeonUniforms.flipTileY = Number(meta.flipTileY);
                // Recompute grid/camera with the new tile size so the first drag doesn't "snap"
                try { if (typeof rc.updateCameraUniforms === 'function') rc.updateCameraUniforms(); } catch (_) {}
                rc.renderPass && rc.renderPass();
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

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      rc.zoomCamera(factor, x, y);
    }, { passive: false });

    // Optional: keyboard zoom
    window.addEventListener('keydown', (e) => {
      if (e.key === '+') rc.zoomCamera(1.1, 0.5, 0.5);
      if (e.key === '-') rc.zoomCamera(0.9, 0.5, 0.5);
    });

    // Toggle UI visibility for dungeon testing: F8 (safe default; avoids F12/DevTools)
    // Hides all siblings in #app except rc-canvas and dungeon-scrim. Restores exact previous display.
    (function setupDungeonUiToggle(){
      function setUiHidden(hidden) {
        try {
          const app = document.getElementById('app');
          if (!app) return;
          const kids = Array.from(app.children || []);
          kids.forEach((el) => {
            const id = (el && el.id) || '';
            if (id === 'rc-canvas' || id === 'dungeon-scrim') return; // keep renderer and scrim visible
            if (hidden) {
              if (el.dataset.prevDisplay === undefined) {
                // Preserve exact inline style so we can restore later
                el.dataset.prevDisplay = el.style.display || '';
              }
              el.style.display = 'none';
            } else {
              if (el.dataset.prevDisplay !== undefined) {
                el.style.display = el.dataset.prevDisplay;
                delete el.dataset.prevDisplay;
              } else {
                el.style.display = '';
              }
            }
          });
          // Ensure canvas remains interactive while testing
          try { container.style.pointerEvents = 'auto'; } catch (_) {}
          window.__uiHiddenForDungeonTest = !!hidden;
        } catch (_) {}
      }
      // Expose a console helper for quick toggling
      try { window.toggleDungeonUi = () => setUiHidden(!window.__uiHiddenForDungeonTest); } catch (_) {}
      // Ignore when typing in form elements to avoid surprises
      window.addEventListener('keydown', (e) => {
        try {
          const t = e.target;
          const tag = (t && t.tagName) || '';
          const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);
          if (typing) return;
          if (e.key === 'F8') {
            e.preventDefault();
            setUiHidden(!window.__uiHiddenForDungeonTest);
          }
        } catch (_) {}
      });
    })();

    // UI overlay integration: keep canvas interactive on Login/Lobby; disable only during gameplay
    window.addEventListener('ui:blocking-changed', (e) => {
      const blocking = !!(e && e.detail && e.detail.blocking);
      let route = null;
      try { route = (typeof window.__getCurrentRoute === 'function') ? window.__getCurrentRoute() : null; } catch (_) {}
      const STATES = window.APP_STATES || {};
      const shouldDisable = !!(blocking && route === STATES.GAMEPLAY_ACTIVE);
      try { container.style.pointerEvents = shouldDisable ? 'none' : 'auto'; } catch (_) {}
      if (shouldDisable && dragging) {
        // Cancel any in-flight drag so we don't keep panning under a blocking gameplay modal
        dragging = false;
        try { canvas.style.cursor = 'default'; } catch (_) {}
      }
    });

    // Initial adjustment
    handleResize();
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
      const tex = rc.renderer.createTextureFromImage(src, (dims) => {
        try {
          rc.renderer.font = tex;
          if (rc.dungeonUniforms) {
            rc.dungeonUniforms.asciiTexture = tex;
            let cols = meta?.atlas?.cols, rows = meta?.atlas?.rows;
            if (Number.isFinite(cols) && Number.isFinite(rows) && dims && dims.width && dims.height) {
              const dw = Math.round(dims.width / cols);
              const dh = Math.round(dims.height / rows);
              if (!meta.tile || meta.tile.w !== dw || meta.tile.h !== dh) {
                try { console.warn('[font] derived tileSize differs from metadata', { metaTile: meta.tile, derived: { w: dw, h: dh } }); } catch (_) {}
                rc.dungeonUniforms.tileSize = [dw, dh];
              } else {
                rc.dungeonUniforms.tileSize = [meta.tile.w, meta.tile.h];
              }
              rc.dungeonUniforms.atlasSize = [cols, rows];
            } else {
              if (meta.tile && Number.isFinite(meta.tile.w) && Number.isFinite(meta.tile.h)) {
                rc.dungeonUniforms.tileSize = [meta.tile.w, meta.tile.h];
              }
              if (meta.atlas && Number.isFinite(meta.atlas.cols) && Number.isFinite(meta.atlas.rows)) {
                rc.dungeonUniforms.atlasSize = [meta.atlas.cols, meta.atlas.rows];
              }
            }
            if (Number.isFinite(meta.startCode)) {
              rc.dungeonUniforms.asciiStartCode = Number(meta.startCode);
            }
            // Apply optional per-font flip overrides when provided
            if (Number.isFinite(meta.flipRow)) rc.dungeonUniforms.flipRow = Number(meta.flipRow);
            if (Number.isFinite(meta.flipTileY)) rc.dungeonUniforms.flipTileY = Number(meta.flipTileY);
            // Recompute grid/camera with the new tile size so the first drag doesn't "snap"
            try { if (typeof rc.updateCameraUniforms === 'function') rc.updateCameraUniforms(); } catch (_) {}
            rc.renderPass && rc.renderPass();
          }
        } catch (err) {
          console.warn('[font update] apply failed', err);
        }
      });
    } catch (err) {
      console.warn('[font update] listener error', err);
    }
  });
} catch (_) {}
