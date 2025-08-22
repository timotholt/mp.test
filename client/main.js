// Minimal Colyseus client (Vite) - plain JS
// Connects, prompts for gameId and room password, and sends arrow-key movement inputs.

import * as Colyseus from 'colyseus.js';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const log = (line) => { logEl.textContent += line + '\n'; };

const endpoint = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname || 'localhost'}:2567`;
const client = new Colyseus.Client(endpoint);

const storedGameId = localStorage.getItem('gameId') || '';
const storedName = localStorage.getItem('name') || '';

const gameId = storedGameId || (prompt('Game ID (new or existing):') || 'game-1');
const roomPass = prompt('Room password:') || '';
const name = storedName || (prompt('Name:') || 'Hero');

localStorage.setItem('gameId', gameId);
localStorage.setItem('name', name);

let room;

async function connect() {
  try {
    const savedRoomId = localStorage.getItem('roomId');
    const savedSessionId = localStorage.getItem('sessionId');

    if (savedRoomId && savedSessionId) {
      statusEl.textContent = 'Reconnecting...';
      try {
        room = await client.reconnect(savedRoomId, savedSessionId);
      } catch (_) {
        // fallthrough to join
      }
    }

    if (!room) {
      statusEl.textContent = 'Joining...';
      room = await client.joinOrCreate('nethack', { gameId, roomPass, name });
      localStorage.setItem('roomId', room.id);
      localStorage.setItem('sessionId', room.sessionId);
    }

    // IDENTITY INFO: show gameId, roomId and our session/user id (easy to remove later)
    const selfId = room.sessionId;
    statusEl.textContent = `Connected | gameId=${gameId} | roomId=${room.id} | you=${name} (${selfId.slice(0,6)})`;
    log(`[info] connected room=${room.id} game=${gameId} you=${name} (${selfId})`);
    // DEBUG: temporary instrumentation - connected (remove after verifying flow)
    console.log('[DEBUG client] connected', { roomId: room.id, sessionId: room.sessionId });

    // Observe players (Schema v2 signal-style)
    room.state.players.onAdd((player, key) => { log(`+ ${player.name} (${key}) @ ${player.x},${player.y}`); });
    room.state.players.onRemove((_, key) => { log(`- player ${key}`); });

    // Observe server log (Schema v2 signal-style)
    // DEBUG: temporary instrumentation - log stream (remove after verifying flow)
    room.state.log.onAdd((value) => { console.log('[DEBUG client] log.onAdd', value); log(value); });

    // Wire dungeon map updates from server (placeholder message type)
    room.onMessage('dungeonMap', (mapString) => {
      try {
        const lines = typeof mapString === 'string' ? mapString.split('\n').length : 0;
        console.log('[DEBUG client] received dungeonMap', { chars: mapString?.length, lines, preview: (typeof mapString === 'string' ? mapString.slice(0, 80) : '') });
      } catch (_) {}
      if (window.radianceCascades && typeof window.radianceCascades.setDungeonMap === 'function') {
        console.log('[DEBUG client] applying dungeonMap to renderer');
        window.radianceCascades.setDungeonMap(mapString);
      } else {
        console.warn('[ASCII renderer] Received dungeonMap before renderer ready. Caching.');
        window.__pendingDungeonMap = mapString;
      }
    });

    // Wire character color map from server (JSON string)
    room.onMessage('characterColorMap', (mapString) => {
      try {
        // Validate JSON early for logging
        const parsed = JSON.parse(mapString);
        console.log('[DEBUG client] received characterColorMap', { keys: Object.keys(parsed).length });
      } catch (e) {
        console.warn('[DEBUG client] invalid characterColorMap JSON', e);
      }
      if (window.radianceCascades && window.radianceCascades.surface && typeof window.radianceCascades.surface.setCharacterColorMap === 'function') {
        console.log('[DEBUG client] applying characterColorMap to renderer');
        window.radianceCascades.surface.setCharacterColorMap(mapString);
      } else {
        console.warn('[ASCII renderer] Received characterColorMap before renderer ready. Caching.');
        window.__pendingCharacterColorMap = mapString;
      }
    });

    // Handle disconnect
    room.onLeave((code) => { statusEl.textContent = 'Disconnected (' + code + ')'; });

    // Send arrow-key movement
    window.addEventListener('keydown', (e) => {
      // DEBUG: temporary instrumentation - keydown (remove after verifying flow)
      console.log('[DEBUG client] keydown', e.key);
      const map = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' };
      const dir = map[e.key];
      if (dir) {
        // DEBUG: temporary instrumentation - send move (remove after verifying flow)
        console.log('[DEBUG client] send move', dir);
        room.send('input', { type: 'move', dir });
        e.preventDefault();
      }
    });
  } catch (err) {
    statusEl.textContent = 'Failed to connect';
    console.error(err);
    log(String(err?.message || err));
  }
}

connect();

// --- ASCII Dungeon Renderer integration (dynamic, no HTML changes) ---
// We load vendor scripts in order, then mount the renderer into a
// programmatically-created container under #app, and wire camera input.
// Keeping it minimal and self-contained.

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // Cache-bust to ensure latest vendor scripts are fetched
    s.src = `${src}?v=${Date.now()}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function setupAsciiRenderer() {
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
      app.appendChild(container);
    }

    // Pick a sensible default size; DPR handled by RC props
    const width = 512;
    const height = 512;

    // RC is declared by vendor scripts as a global. It may not be on window,
    // so use a safe lookup that works with declarative globals.
    const RCClass = (typeof RC !== 'undefined') ? RC : window.RC;
    const rc = new RCClass({
      id: 'rc-canvas',
      width: width,
      height: height,
      dpr: 1.0,
      canvasScale: 1.0,
    });
    window.radianceCascades = rc; // expose for debugging/devtools
    // Ensure renderer starts even if IntersectionObserver doesn't fire
    if (typeof rc.load === 'function') {
      console.log('[DEBUG client] calling rc.load()');
      rc.load();
    }

    // Apply any pending assets received before renderer was ready
    // Important: set dungeon map before color maps so render has valid data
    if (window.__pendingDungeonMap && typeof rc.setDungeonMap === 'function') {
      try {
        console.log('[DEBUG client] applying pending dungeonMap');
        rc.setDungeonMap(window.__pendingDungeonMap);
      } catch (_) {}
      window.__pendingDungeonMap = undefined;
    }
    if (window.__pendingCharacterColorMap && rc.surface && typeof rc.surface.setCharacterColorMap === 'function') {
      try {
        console.log('[DEBUG client] applying pending characterColorMap');
        rc.surface.setCharacterColorMap(window.__pendingCharacterColorMap);
      } catch (_) {}
      window.__pendingCharacterColorMap = undefined;
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
      // Adjust sensitivity a bit; use zoom-aware scaling similar to vendor example
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const zoomFactor = 1.0 / Math.sqrt(rc.camera.zoomLevel || 1.0);
      rc.panCamera(-dx * zoomFactor, -dy * zoomFactor);
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = 'grab';
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
  } catch (e) {
    console.error('[ASCII renderer] setup failed:', e);
  }
}

// Defer until DOM is ready so we can attach under #app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAsciiRenderer);
} else {
  setupAsciiRenderer();
}
