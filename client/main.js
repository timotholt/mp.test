// Minimal Colyseus client (Vite) - plain JS
// Connects, prompts for runId and room password, and sends arrow-key movement inputs.

import * as Colyseus from 'colyseus.js';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const log = (line) => { logEl.textContent += line + '\n'; };

const endpoint = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname || 'localhost'}:2567`;
const client = new Colyseus.Client(endpoint);

const storedRunId = localStorage.getItem('runId') || '';
const storedName = localStorage.getItem('name') || '';

const runId = storedRunId || (prompt('Run ID (new or existing):') || 'run-1');
const roomPass = prompt('Room password:') || '';
const name = storedName || (prompt('Name:') || 'Hero');

localStorage.setItem('runId', runId);
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
      room = await client.joinOrCreate('nethack', { runId, roomPass, name });
      localStorage.setItem('roomId', room.id);
      localStorage.setItem('sessionId', room.sessionId);
    }

    statusEl.textContent = 'Connected';
    // DEBUG: temporary instrumentation - connected (remove after verifying flow)
    console.log('[DEBUG client] connected', { roomId: room.id, sessionId: room.sessionId });

    // Observe players (Schema v2 signal-style)
    room.state.players.onAdd((player, key) => { log(`+ ${player.name} (${key}) @ ${player.x},${player.y}`); });
    room.state.players.onRemove((_, key) => { log(`- player ${key}`); });

    // Observe server log (Schema v2 signal-style)
    // DEBUG: temporary instrumentation - log stream (remove after verifying flow)
    room.state.log.onAdd((value) => { console.log('[DEBUG client] log.onAdd', value); log(value); });

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
