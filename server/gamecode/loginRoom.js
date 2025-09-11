// LoginScenarioRoom: shared login room with movement-only and full-visibility stub.
// Plain JS (CommonJS). No persistence. Accepts unauthenticated clients.

const { Room } = require('colyseus');
// Procedural levels API (kept for future variants)
const { generateDungeon } = require('./engine/gameMaster/levels');
// Hand-authored spec compiler + login spec
const { compileRoomSpec } = require('./engine/compiler/compileRoomSpec');
const { roomSpec: loginRoomSpec } = require('./engine/gameMaster/scenarios/login/roomSpec');
const { calculateFOV } = require('./engine/fov');
const { buildPositionColorMap } = require('./engine/render');
const { isWalkable } = require('./engine/collision');
const { verifySupabaseAccessToken } = require('../auth/verify');

// --- Config (ENV with sane defaults) ---
const LOGIN_SCENARIO_ENABLED = (process.env.LOGIN_SCENARIO_ENABLED ?? 'true') !== 'false';
const LOGIN_TICK_MS = parseInt(process.env.LOGIN_TICK_MS || '100', 10); // 100–200 typical
const LOGIN_MAX_CLIENTS = parseInt(process.env.LOGIN_MAX_CLIENTS || '32', 10);

class LoginScenarioRoom extends Room {
  onCreate(options) {
    if (!LOGIN_SCENARIO_ENABLED) {
      try { this.disconnect(); } catch (_) {}
      return;
    }

    this.maxClients = LOGIN_MAX_CLIENTS;
    this.setMetadata({ gameId: 'login', name: 'Login Scenario', private: false, maxPlayers: LOGIN_MAX_CLIENTS });

    // State (minimal; non-Schema)
    this.players = new Map(); // id -> { currentLocation: { x,y,level } }
    this.playerColors = new Map(); // id -> [r,g,b]

    // Deterministic 60x40 level (spaceport_login) compiled from RoomSpec
    // Supports single '#' and double walls '|' (vertical) and '=' (horizontal)
    // Note: you can swap back to generateDungeon({ variant:'login' }) anytime.
    try {
      const compiled = compileRoomSpec(loginRoomSpec);
      this.dungeonMap = compiled.map;
      // Optionally keep metadata for future (colors/lights/entities)
      this._roomCompiled = compiled;
    } catch (e) {
      // Fallback to generator if spec fails
      this.dungeonMap = generateDungeon({ variant: 'login', width: 60, height: 40 });
    }

    // Simple movement input (dx,dy)
    this.onMessage('move', (client, payload) => {
      const id = client?.auth?.userId || client?.sessionId; if (!id) return;
      const p = this.players.get(id); if (!p) return;
      const dx = (payload && (payload.dx | 0)) || 0; const dy = (payload && (payload.dy | 0)) || 0; if (!dx && !dy) return;
      const nx = (p.currentLocation.x | 0) + dx; const ny = (p.currentLocation.y | 0) + dy;
      if (isWalkable(this.dungeonMap, nx, ny)) { p.currentLocation.x = nx; p.currentLocation.y = ny; }
    });
    // Legacy input path: { type:'move', dir }
    this.onMessage('input', (client, payload) => {
      try {
        if (!payload || payload.type !== 'move') return;
        const dir = String(payload.dir || '').toUpperCase();
        const map = { N:[0,-1], S:[0,1], W:[-1,0], E:[1,0], NE:[1,-1], NW:[-1,-1], SE:[1,1], SW:[-1,1] };
        const v = map[dir]; if (!v) return;
        this._moveCompat(client, v[0], v[1]);
      } catch (_) {}
    });
    this._moveCompat = (client, dx, dy) => {
      const id = client?.auth?.userId || client?.sessionId; if (!id) return;
      const p = this.players.get(id); if (!p) return;
      const nx = (p.currentLocation.x | 0) + (dx | 0);
      const ny = (p.currentLocation.y | 0) + (dy | 0);
      if (isWalkable(this.dungeonMap, nx, ny)) { p.currentLocation.x = nx; p.currentLocation.y = ny; }
    };

    // Lightweight heartbeat
    try { this.onMessage('hb', () => {}); } catch (_) {}

    // Periodic broadcast
    this._tickTimer = this.clock.setInterval(() => this.broadcastSnapshot(), Math.max(50, LOGIN_TICK_MS));

    // Periodic JWT re-verify (if token was presented); kick on expiry
    this._jwtTimer = this.clock.setInterval(async () => {
      for (const c of this.clients) {
        try {
          const token = c?._options?.access_token || c?._authOptions?.access_token || c?.auth?.access_token;
          if (!token) continue;
          await verifySupabaseAccessToken(token);
        } catch (e) {
          try { c.send('modal', { command: 'present', id: 'JWT_EXPIRED', text: 'Session token expired. Please log in again.', blockInput: true }); } catch (_) {}
          try { c.leave(4403); } catch (_) {}
        }
      }
    }, 30000);
  }

  async onAuth(client, options) {
    const { access_token, userId: optUserId, name: optName } = options || {};
    let userId = optUserId || client.sessionId; let name = optName || 'Guest';
    if (access_token && typeof access_token === 'string') {
      try {
        const v = await verifySupabaseAccessToken(access_token);
        userId = v?.userId || userId; if (v?.email) name = String(v.email).split('@')[0];
        client.auth = { ...(client.auth || {}), userId, name, access_token };
      } catch (_) { /* guest fallback */ }
    }
    return { userId, name };
  }

  onJoin(client) {
    const id = client?.auth?.userId || client?.sessionId; if (!id) return;
    const rows = this.dungeonMap.split('\n'); const H = rows.length | 0; const W = (rows[0] && rows[0].length) | 0;
    const cx = Math.max(1, Math.min(W - 2, Math.floor(W / 2)));
    const cy = Math.max(1, Math.min(H - 2, Math.floor(H / 2)));
    const player = { id, currentLocation: { x: cx, y: cy, level: 0 }, lastLocation: { x: cx, y: cy, level: 0 } };
    this.players.set(id, player);
    if (!this.playerColors.has(id)) this.playerColors.set(id, [0.2, 0.6, 1.0]);
    this.sendSnapshotTo(client);
  }

  onLeave(client) {
    const id = client?.auth?.userId || client?.sessionId;
    if (id) { try { this.players.delete(id); } catch (_) {} try { this.playerColors.delete(id); } catch (_) {} }
  }

  broadcastSnapshot() {
    const overlay = calculateFOV({ currentLocation: { level: 0 } }, this.dungeonMap, { players: this.players, level: 0 });
    const pcm = buildPositionColorMap(this.players, this.playerColors, 0);
    this.clients.forEach((c) => { try { c.send('dungeonMap', overlay); } catch (_) {} try { c.send('positionColorMap', JSON.stringify(pcm)); } catch (_) {} });
  }

  sendSnapshotTo(client) {
    try {
      const overlay = calculateFOV({ currentLocation: { level: 0 } }, this.dungeonMap, { players: this.players, level: 0 });
      client.send('dungeonMap', overlay);
      const pcm = buildPositionColorMap(this.players, this.playerColors, 0);
      client.send('positionColorMap', JSON.stringify(pcm));
    } catch (_) {}
  }

  onDispose() {
    if (this._tickTimer) { try { this.clock.clearInterval(this._tickTimer); } catch (_) {} this._tickTimer = null; }
    if (this._jwtTimer) { try { this.clock.clearInterval(this._jwtTimer); } catch (_) {} this._jwtTimer = null; }
    try { this.players.clear(); this.playerColors.clear(); } catch (_) {}
  }
}

module.exports = { LoginScenarioRoom, LOGIN_SCENARIO_ENABLED, LOGIN_TICK_MS, LOGIN_MAX_CLIENTS };
