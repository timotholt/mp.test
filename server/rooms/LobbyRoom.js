// Colyseus Lobby room with Schema state (games + players), plus legacy broadcasts for compatibility
// Plain JS (CommonJS)
const { Room } = require('colyseus');
const { Schema, type, ArraySchema, MapSchema, defineTypes } = require('@colyseus/schema');
const { onRoomsChanged, getRooms } = require('./RoomsHub');
const { verifySupabaseAccessToken, fetchSupabaseUser } = require('../auth/verify');
const { listRecentGames } = require('../persistence/supabase');

class LobbyGame extends Schema {
  constructor() {
    super();
    this.gameId = '';
    this.name = '';
    this.hostName = '';
    this.private = false;
    this.maxPlayers = 0;
    this.clients = 0;
    this.roomId = '';
    this.lastSavedAt = '';
  }
}

defineTypes(LobbyGame, {
  gameId: 'string',
  name: 'string',
  hostName: 'string',
  private: 'boolean',
  maxPlayers: 'number',
  clients: 'number',
  roomId: 'string',
  lastSavedAt: 'string',
});

class LobbyPlayer extends Schema {
  constructor() {
    super();
    this.id = '';
    this.name = '';
  }
}

defineTypes(LobbyPlayer, {
  id: 'string',
  name: 'string',
});

class LobbyState extends Schema {
  constructor() {
    super();
    this.games = new ArraySchema();
    this.players = new MapSchema();
  }
}

defineTypes(LobbyState, {
  games: [LobbyGame],
  players: { map: LobbyPlayer },
});

class LobbyRoom extends Room {
  onCreate() {
    // Initialize state
    this.setState(new LobbyState());

    // Seed from Supabase asynchronously
    (async () => {
      try {
        const list = await listRecentGames(200);
        this.mergeSupabaseGames(list);
      } catch (_) {}
    })();

    // Subscribe to RoomsHub and update state; keep legacy broadcast for older clients
    this._unsub = onRoomsChanged((rooms) => {
      try {
        this.applyRoomsHub(rooms || []);
        this.broadcast('roomsList', rooms || []); // legacy payload
      } catch (_) {}
    });
    // Initial legacy snapshot and state sync
    this.clock.setTimeout(() => {
      try {
        const current = getRooms();
        this.applyRoomsHub(current);
        this.broadcast('roomsList', current);
      } catch (_) {}
    }, 50);

    // Periodic Supabase refresh (lightweight)
    this._supabaseTimer = this.clock.setInterval(async () => {
      try {
        const list = await listRecentGames(200);
        this.mergeSupabaseGames(list);
      } catch (_) {}
    }, 30000);
  }

  async onAuth(client, options) {
    // Optional auth via Supabase access token; allow guests
    const { access_token } = options || {};
    let userId = options?.userId || client.sessionId;
    let name = options?.name || 'Guest';
    if (access_token && typeof access_token === 'string') {
      try {
        const v = await verifySupabaseAccessToken(access_token);
        userId = v?.userId || userId;
        const user = await fetchSupabaseUser(access_token).catch(() => null);
        const email = user?.email || v?.email;
        if (email) name = String(email).split('@')[0];
      } catch (_) {}
    }
    return { userId, name };
  }

  onJoin(client) {
    // Legacy: send current rooms list on join
    try { client.send('roomsList', getRooms()); } catch (_) {}
    // Track lobby players in state
    try {
      const id = client?.auth?.userId || client?.sessionId;
      const name = client?.auth?.name || 'Guest';
      const lp = new LobbyPlayer();
      lp.id = String(id);
      lp.name = String(name);
      this.state.players.set(lp.id, lp);
    } catch (_) {}
    // Legacy playersList broadcast for older clients
    this.broadcastLobbyPlayers();
  }

  onLeave(client) {
    // Remove from state.players
    try {
      const id = client?.auth?.userId || client?.sessionId;
      if (id && this.state?.players?.has?.(id)) this.state.players.delete(id);
    } catch (_) {}
    // Rebuild legacy players list snapshot
    this.broadcastLobbyPlayers();
  }

  onDispose() {
    if (typeof this._unsub === 'function') {
      try { this._unsub(); } catch (_) {}
    }
    if (this._supabaseTimer) {
      try { this.clock.clearInterval(this._supabaseTimer); } catch (_) {}
      this._supabaseTimer = null;
    }
  }

  broadcastLobbyPlayers() {
    const players = this.clients.map((c) => ({ id: c?.auth?.userId || c?.sessionId, name: c?.auth?.name || 'Guest' }));
    try { this.broadcast('playersList', players); } catch (_) {}
  }

  // --- Helpers to manage state.games ---
  mergeSupabaseGames(list) {
    if (!Array.isArray(list)) return;
    list.forEach((g) => {
      const gid = String(g?.gameId || '').trim();
      if (!gid) return;
      const idx = this.findGameIndex(gid);
      if (idx === -1) {
        const lg = new LobbyGame();
        lg.gameId = gid;
        lg.name = '';
        lg.hostName = '';
        lg.private = false;
        lg.maxPlayers = 0;
        lg.clients = 0;
        lg.roomId = '';
        lg.lastSavedAt = String(g?.lastSavedAt || '');
        this.state.games.push(lg);
      } else {
        try { this.state.games[idx].lastSavedAt = String(g?.lastSavedAt || ''); } catch (_) {}
      }
    });
  }

  applyRoomsHub(rooms) {
    if (!Array.isArray(rooms)) return;
    const seenGameIds = new Set();
    rooms.forEach((r) => {
      const meta = r?.metadata || {};
      const gid = String(meta.gameId || '').trim();
      if (!gid) return;
      seenGameIds.add(gid);
      const idx = this.findGameIndex(gid);
      if (idx === -1) {
        const lg = new LobbyGame();
        lg.gameId = gid;
        lg.name = String(meta.name || '');
        lg.hostName = String(meta.hostName || '');
        lg.private = !!meta.private;
        lg.maxPlayers = (meta.maxPlayers | 0) || (r.maxClients | 0) || 0;
        lg.clients = r.clients | 0;
        lg.roomId = String(r.roomId || '');
        this.state.games.push(lg);
      } else {
        const g = this.state.games[idx];
        try {
          g.name = String(meta.name || g.name || '');
          g.hostName = String(meta.hostName || g.hostName || '');
          g.private = !!meta.private;
          g.maxPlayers = (meta.maxPlayers | 0) || (r.maxClients | 0) || g.maxPlayers;
          g.clients = r.clients | 0;
          g.roomId = String(r.roomId || '');
        } catch (_) {}
      }
    });
    // Optionally, clear roomId/clients for games that are not currently active
    for (let i = 0; i < this.state.games.length; i++) {
      const g = this.state.games[i];
      if (!g || !g.gameId) continue;
      if (!seenGameIds.has(g.gameId)) {
        try { g.roomId = ''; g.clients = 0; } catch (_) {}
      }
    }
  }

  findGameIndex(gameId) {
    for (let i = 0; i < this.state.games.length; i++) {
      if (this.state.games[i]?.gameId === gameId) return i;
    }
    return -1;
  }
}

module.exports = { LobbyRoom };
