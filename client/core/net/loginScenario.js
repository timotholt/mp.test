// Login Scenario client helper: join shared 'login' room, render full-FOV snapshots,
// and send movement-only intents while on the LOGIN route.
// JS-only, minimal, no UI changes.

import { getAccessToken } from '../auth/supabaseAuth.js';

let loginRoom = null;
let keyHandler = null;

export async function startLoginScenario({ client } = {}) {
  try {
    if (!client) return;
    if (loginRoom) return; // already joined
    const opts = {};
    try { const t = await getAccessToken(); if (t) opts.access_token = t; } catch (_) {}
    // Join or create shared singleton
    loginRoom = await client.joinOrCreate('login', opts).catch(() => null);
    if (!loginRoom) return;

    // Wire map messages directly (identical to wireRoomEvents map handlers)
    try {
      loginRoom.onMessage('dungeonMap', (mapString) => {
        if (window.radianceCascades && typeof window.radianceCascades.setDungeonMap === 'function') {
          window.radianceCascades.setDungeonMap(mapString);
        } else { window.__pendingDungeonMap = mapString; }
      });
    } catch (_) {}
    try {
      loginRoom.onMessage('positionColorMap', (mapString) => {
        if (window.radianceCascades?.surface?.setPositionColorMap) {
          window.radianceCascades.surface.setPositionColorMap(mapString);
        } else { window.__pendingPositionColorMap = mapString; }
      });
    } catch (_) {}

    // Movement-only: send simple intents on arrow keys; ignore repeats to avoid flooding
    keyHandler = (e) => {
      const map = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' };
      const dir = map[e.key];
      if (!dir) return;
      if (e.repeat) return;
      if (!loginRoom) return;
      e.preventDefault();
      try { loginRoom.send('input', { type: 'move', dir }); } catch (_) {}
    };
    window.addEventListener('keydown', keyHandler);

    // Reply to server ping for RTT if sent
    try { loginRoom.onMessage('ping', (msg) => { try { loginRoom.send('pong', { t: (msg && msg.t) }); } catch (_) {} }); } catch (_) {}

    // Clean up on close
    loginRoom.onLeave(() => {
      try { window.removeEventListener('keydown', keyHandler); } catch (_) {}
      keyHandler = null;
      loginRoom = null;
    });
  } catch (e) {
    // Ignore; login scenario is optional
  }
}

export async function stopLoginScenario() {
  try { if (keyHandler) window.removeEventListener('keydown', keyHandler); } catch (_) {}
  keyHandler = null;
  try {
    if (loginRoom && typeof loginRoom.leave === 'function') {
      await loginRoom.leave(true);
    }
  } catch (_) {}
  loginRoom = null;
}
