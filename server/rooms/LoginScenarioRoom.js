// LoginScenarioRoom: shared login room with movement-only and full-visibility stub.
// Plain JS (CommonJS). No persistence. Accepts unauthenticated clients.

const { Room } = require('colyseus');
const { generateDungeon } = require('./gamecode/dungeonGenerator');
const { calculateFOV } = require('./gamecode/fov');
const { buildPositionColorMap } = require('./gamecode/render');
const { isWalkable } = require('./gamecode/collision');
const { verifySupabaseAccessToken } = require('../auth/verify');

// --- Config (ENV with sane defaults) ---
const LOGIN_SCENARIO_ENABLED = (process.env.LOGIN_SCENARIO_ENABLED ?? 'true') !== 'false';
const LOGIN_TICK_MS = parseInt(process.env.LOGIN_TICK_MS || '100', 10); // 100–200 typical
const LOGIN_MAX_CLIENTS = parseInt(process.env.LOGIN_MAX_CLIENTS || '32', 10);

class LoginScenarioRoom extends Room {
  onCreate(options) {
    if (!LOGIN_SCENARIO_ENABLED) {
      // If somehow created while disabled, dispose immediately
      try { this.disconnect(); } catch (_) {}
      return;
    }

    // Room identity & capacity
    this.maxClients = LOGIN_MAX_CLIENTS;
    this.setMetadata({
      gameId: 'login',
      name: 'Login Scenario',
      private: false,
      maxPlayers: LOGIN_MAX_CLIENTS,
    });

    // State for login room (keep it minimal; no Schema required)
    this.players = new Map(); // id -> { currentLocation: { x,y,level } }
    this.playerColors = new Map(); // id -> [r,g,b]

    // Deterministic 60x40 level (spaceport_login)
    this.dungeonMap = generateDungeon({ variant: 'login', width: 60, height: 40 });

    // Simple movement input (accepts either 'move' with dx/dy or legacy 'input' { type:'move', dir })
    this.onMessage('move', (client, payload) => {
      const id = client?.auth?.userId || client?.sessionId;
      if (!id) return;
      const p = this.players.get(id);
      if (!p) return;
      const dx = (payload && (payload.dx | 0)) || 0;
      const dy = (payload && (payload.dy | 0)) || 0;
      if (!dx && !dy) return;
      const nx = (p.currentLocation.x | 0) + dx;
      const ny = (p.currentLocation.y | 0) + dy;
      if (isWalkable(this.dungeonMap, nx, ny)) {
        p.currentLocation.x = nx;
        p.currentLocation.y = ny;
      }
    });
    this.onMessage('input', (client, payload) => {
      try {
        if (!payload || payload.type !== 'move') return;
        const dir = String(payload.dir || '').toUpperCase();
        const map = { N: [0,-1], S: [0,1], W: [-1,0], E: [1,0], NE:[1,-1], NW:[-1,-1], SE:[1,1], SW:[-1,1] };
        const v = map[dir];
        if (!v) return;
        this.onMessageHandlersMoveCompat(client, v[0], v[1]);
      } catch (_) {}
    });
    // Internal helper to reuse movement logic for legacy input
    this.onMessageHandlersMoveCompat = (client, dx, dy) => {
      const id = client?.auth?.userId || client?.sessionId;
      if (!id) return;
      const p = this.players.get(id);
      if (!p) return;
      const nx = (p.currentLocation.x | 0) + (dx | 0);
      const ny = (p.currentLocation.y | 0) + (dy | 0);
      if (isWalkable(this.dungeonMap, nx, ny)) {
        p.currentLocation.x = nx;
        p.currentLocation.y = ny;
      }
    };

    // Heartbeat (optional, shared with other rooms)
    try {
      this.onMessage('hb', () => {
        // no-op; could integrate Presence here if desired
      });
    } catch (_) {}

    // Periodic broadcast (throttled)
    this._tickTimer = this.clock.setInterval(() => this.broadcastSnapshot(), Math.max(50, LOGIN_TICK_MS));

    // Periodic JWT re-verify (if token was presented); kick on expiry
    this._jwtTimer = this.clock.setInterval(async () => {
      for (const c of this.clients) {
        try {
          const token = c?._options?.access_token || c?._authOptions?.access_token || c?.auth?.access_token;
          if (!token) continue;
          await verifySupabaseAccessToken(token); // throws if invalid/expired
        } catch (e) {
          try { c.send('modal', { command: 'present', id: 'JWT_EXPIRED', text: 'Session token expired. Please log in again.', blockInput: true }); } catch (_) {}
          try { c.leave(4403); } catch (_) {}
        }
      }
    }, 30000);
  }

  async onAuth(client, options) {
    // Allow guests. If a token is presented, verify it now and attach identity; kick later on expiry.
    const { access_token, userId: optUserId, name: optName } = options || {};
    let userId = optUserId || client.sessionId;
    let name = optName || 'Guest';
    if (access_token && typeof access_token === 'string') {
      try {
        const v = await verifySupabaseAccessToken(access_token);
        userId = v?.userId || userId;
        if (v?.email) name = String(v.email).split('@')[0];
        // Attach for possible re-verify timer usage
        client.auth = { ...(client.auth || {}), userId, name, access_token };
      } catch (e) {
        // Treat failures as guest for login room
      }
    }
    return { userId, name };
  }

  onJoin(client) {
    const id = client?.auth?.userId || client?.sessionId;
    if (!id) return;

    // Spawn at center
    const rows = this.dungeonMap.split('\n');
    const H = rows.length | 0;
    const W = (rows[0] && rows[0].length) | 0;
    const cx = Math.max(1, Math.min(W - 2, Math.floor(W / 2)));
    const cy = Math.max(1, Math.min(H - 2, Math.floor(H / 2)));

    const player = {
      id,
      currentLocation: { x: cx, y: cy, level: 0 },
      lastLocation: { x: cx, y: cy, level: 0 },
    };
    this.players.set(id, player);
    // Fixed blue-ish color for all players in login room
    if (!this.playerColors.has(id)) this.playerColors.set(id, [0.2, 0.6, 1.0]);

    // Send initial snapshot immediately
    this.sendSnapshotTo(client);
  }

  onLeave(client) {
    const id = client?.auth?.userId || client?.sessionId;
    if (id) {
      try { this.players.delete(id); } catch (_) {}
      try { this.playerColors.delete(id); } catch (_) {}
    }
  }

  broadcastSnapshot() {
    // Build overlay dungeon and color map once, broadcast to all
    const overlay = calculateFOV({ currentLocation: { level: 0 } }, this.dungeonMap, { players: this.players, level: 0 });
    const pcm = buildPositionColorMap(this.players, this.playerColors, 0);
    this.clients.forEach((c) => {
      try { c.send('dungeonMap', overlay); } catch (_) {}
      try { c.send('positionColorMap', JSON.stringify(pcm)); } catch (_) {}
    });
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
    if (this._tickTimer) {
      try { this.clock.clearInterval(this._tickTimer); } catch (_) {}
      this._tickTimer = null;
    }
    if (this._jwtTimer) {
      try { this.clock.clearInterval(this._jwtTimer); } catch (_) {}
      this._jwtTimer = null;
    }
    this.players.clear();
    this.playerColors.clear();
  }
}

module.exports = { LoginScenarioRoom, LOGIN_SCENARIO_ENABLED, LOGIN_TICK_MS, LOGIN_MAX_CLIENTS };
