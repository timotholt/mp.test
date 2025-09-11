// Authoritative Colyseus Room for a simple Nethack-style multiplayer
// Plain JavaScript (CommonJS). Password-protected room with basic input queue.

const { Room } = require('colyseus');
const bcrypt = require('bcryptjs');
const { Schema, type, MapSchema, ArraySchema, defineTypes } = require('@colyseus/schema');
const { generateDungeon } = require('./engine/gameMaster/levels');
const { getDefaultCharacterColorMap } = require('./engine/colors');
const { placeMonsters } = require('./engine/monsterPlacement');
const { placeTreasures } = require('./engine/treasurePlacement');
const { calculateFOV } = require('./engine/fov');
const { applyCommand: applyGameCommand } = require('./engine/commands');
const { placePlayer } = require('./engine/playerPlacement');
const { initPlayer } = require('./engine/initPlayer');
const { buildPositionColorMap } = require('./engine/render');
const { Entity, Location } = require('./engine/entity');
const { addEntity, removeEntity } = require('./engine/occupancy');

const { snapshotWorld, restoreWorld } = require('./engine/serialization');
const { saveSnapshot, loadLatestSnapshot } = require('../persistence/supabase');
const { verifySupabaseAccessToken, fetchSupabaseUser } = require('../auth/verify');
const { upsertRoom, removeRoom } = require('./RoomsHub');
const Presence = require('../presence/PresenceHub');

// --- Session policy (env-configurable) ---
// Disconnect clients with no heartbeat for this long (ms). Default: 60s.
const SESSION_EXPIRE_MS = parseInt(process.env.SESSION_EXPIRE_MS || '60000', 10);
// Enforce a single active Game session per userId (kick older when duplicate joins)
const ENFORCE_SINGLE_SESSION = (process.env.ENFORCE_SINGLE_SESSION ?? 'true') !== 'false';

// Autosave configuration (env with defaults)
const AUTOSAVE_ENABLED = (process.env.AUTOSAVE_ENABLED ?? 'true') !== 'false';
const AUTOSAVE_INTERVAL_MS = parseInt(process.env.AUTOSAVE_INTERVAL_MS || '10000', 10);
const AUTOSAVE_RETENTION = parseInt(process.env.AUTOSAVE_RETENTION || '3', 10);
const ALLOW_MANUAL_RESTORE = (process.env.ALLOW_MANUAL_RESTORE ?? 'false') === 'true';
const REQUIRE_VERIFIED_EMAIL = (process.env.REQUIRE_VERIFIED_EMAIL === 'true');
const AUTH_REQUIRE_LOGIN = (process.env.AUTH_REQUIRE_LOGIN === 'true');

// --- Selection constants (easily changeable) ---
// Factions: top row in the modal
const FACTIONS = [
  { key: 'crimson', name: 'Crimson Legion', icon: '🟥' },
  { key: 'azure', name: 'Azure Covenant', icon: '🟦' },
  { key: 'iron', name: 'Iron Collective', icon: '⬛' },
  { key: 'radiant', name: 'Radiant Order', icon: '🟨' },
];

// Classes (Roles): bottom row in the modal
const CLASSES = [
  { key: 'gene', name: 'Gene Warden', icon: '⚔️', desc: 'Commands lots of soldiers' },
  { key: 'soul', name: 'Soul Warden', icon: '✨', desc: 'Commands dimensional powers' },
  { key: 'machine', name: 'Machine Warden', icon: '🤖', desc: 'Machines & engineering' },
  { key: 'faith', name: 'Faith Warden', icon: '✝️', desc: 'Godlike powers' },
];

// Loadouts per faction (keys mirror FACTIONS keys)
const LOADOUTS_BY_FACTION = {
  crimson: [
    { key: 'close', name: 'Close Combat' },
    { key: 'mid', name: 'Medium Range' },
    { key: 'long', name: 'Long Range' },
  ],
  azure: [
    { key: 'area', name: 'Area Effect' },
    { key: 'dps', name: 'DPS' },
  ],
  iron: [
    { key: 'robots', name: 'Robots' },
    { key: 'vehicles', name: 'Vehicles' },
  ],
  radiant: [
    { key: 'zealot', name: 'Zealot (Close Combat)' },
    { key: 'summoning', name: 'Summoning (Angels)' },
  ],
};

class Player extends Entity {
  constructor() {
    super();
    this.kind = 'player';
    this.online = true;
    this.ready = false;
    this.status = 'red';
    this.pingMs = 0;
    this.net = 'red';
    // Selection fields
    this.faction = '';
    this.classKey = '';
    this.loadout = '';
  }
}

defineTypes(Player, {
  online: 'boolean',
  ready: 'boolean',
  status: 'string',
  pingMs: 'number',
  net: 'string',
  faction: 'string',
  classKey: 'string',
  loadout: 'string',
});

class GameState extends Schema {
  constructor() {
    super();
    this.gameId = '';
    this.players = new MapSchema();
    this.log = new ArraySchema();
    this.starting = false;      // server-driven start countdown active
    this.countdown = 0;         // seconds remaining
  }
}

defineTypes(GameState, {
  gameId: 'string',
  players: { map: Player },
  log: ['string'],
  starting: 'boolean',
  countdown: 'number',
});

class NethackRoom extends Room {
  onCreate(options) {
    // Initialize state and metadata
    this.setState(new GameState());
    this.state.gameId = options.gameId || `game-${Math.random().toString(36).slice(2, 8)}`;
    this.isPrivate = !!options.private;
    // include additional metadata for lobby display
    this.setMetadata({
      gameId: this.state.gameId,
      private: this.isPrivate,
      name: options.name || '',
      hostName: options.hostName || '',
      maxPlayers: options.maxPlayers || options.maxClients || 0,
    });
    // INFO: room identity (easy to remove later)
    console.log('[info] room created', { roomId: this.roomId, gameId: this.state.gameId });

    // Password policy: require a password. First creator can set it.
    const initialPass = options.roomPass;
    if (initialPass && initialPass.length >= 4) {
      this.roomPassHash = bcrypt.hashSync(initialPass, 8);
    } else {
      this.roomPassHash = undefined; // Will enforce onAuth
    }

    // Simple input queue for multiple players
    this.commandQueue = [];
    this.processing = false;

    // Host/user management
    this.hostId = null; // first player to join becomes host
    this.confirmOpenForHost = false; // track if host confirm is currently open on client
    this._startTimer = null; // countdown interval handle

    // --- Helpers for selection flow ---
    const selectionComplete = (pl) => !!(pl && pl.faction && pl.classKey && pl.loadout);
    const buildFCLPayload = (uid) => {
      const p = this.state.players.get(uid);
      const selectedFaction = (p && p.faction) || '';
      const loadouts = LOADOUTS_BY_FACTION[selectedFaction] || [];
      return {
        factions: FACTIONS,
        classes: CLASSES,
        loadouts,
        selection: { faction: p?.faction || '', classKey: p?.classKey || '', loadout: p?.loadout || '' },
        complete: selectionComplete(p),
      };
    };
    const sendFCLTo = (uid) => {
      const c = this.userClients?.get(uid);
      if (!c) return;
      try { c.send('showFCLSelect', buildFCLPayload(uid)); } catch (e) { console.warn('showFCLSelect send failed', e); }
    };

    // Input handler (clients send small intents only; server is authoritative)
    this.onMessage('input', (client, payload) => {
      if (!payload || typeof payload !== 'object') return;
      const { type, ...rest } = payload;
      if (typeof type !== 'string') return;
      // DEBUG: temporary instrumentation - server received input (remove after verifying flow)
      console.log('[DEBUG server] onMessage input', { sessionId: client.sessionId, type, rest });
      const uid = client.auth?.userId || client.sessionId;
      Presence.beat(uid); // gameplay input counts as heartbeat
      this.commandQueue.push({ userId: uid, type, data: rest });
    });

    // Heartbeat message from client (every ~5s)
    try {
      this.onMessage('hb', (client) => {
        const uid = client?.auth?.userId || client?.sessionId;
        if (!uid) return;
        Presence.beat(uid);
        const p = this.state.players.get(String(uid));
        if (p) p.status = Presence.getStatus(uid);
      });
    } catch (_) {}

    // --- Ping/Pong RTT measurement (server-initiated) ---
    try {
      this.onMessage('pong', (c, msg) => {
        try {
          const t = msg && msg.t;
          if (!t) return;
          const rtt = Date.now() - t;
          const id = c?.auth?.userId || c?.sessionId;
          if (!id) return;
          if (typeof rtt === 'number' && isFinite(rtt) && rtt >= 0) {
            Presence.setPing(id, rtt);
          }
          // Treat pong as heartbeat
          Presence.beat(id);
        } catch (_) {}
      });
    } catch (_) {}
    this._pingTimer = this.clock.setInterval(() => {
      try {
        const t = Date.now();
        this.clients.forEach((c) => { try { c.send('ping', { t }); } catch (_) {} });
      } catch (_) {}
    }, 5000);

    // --- Session expiry sweep: force-disconnect idle clients (uses Presence heartbeats) ---
    this._sessionTimer = this.clock.setInterval(() => {
      if (!(SESSION_EXPIRE_MS > 0)) return;
      try {
        const now = Date.now();
        this.clients.forEach((c) => {
          try {
            const uid = c?.auth?.userId || c?.sessionId;
            if (!uid) return;
            const last = Presence.get(uid)?.lastSeen || 0;
            if (now - last > SESSION_EXPIRE_MS) {
              // Notify client before closing the socket (small delay so message can flush)
              try { c.send('modal', { command: 'present', id: 'SESSION_EXPIRE', text: 'Session expired due to inactivity.', blockInput: true }); } catch (_) {}
              this.clock.setTimeout(() => { try { c.leave(4402); } catch (_) {} }, 120);
            }
          } catch (_) {}
        });
      } catch (_) {}
    }, 5000);

    // Host can start at any time: triggers a 5s server-driven countdown
    this.onMessage('startGame', (client) => {
      const uid = client.auth?.userId || client.sessionId;
      if (!this.hostId || uid !== this.hostId) {
        console.log('[server] startGame rejected: not host', { uid, hostId: this.hostId });
        return;
      }
      if (this.state.starting) return; // already counting down
      this.beginCountdown();
    });

    // Selection messages (per-player)
    this.onMessage('chooseFaction', (client, payload) => {
      const uid = client.auth?.userId || client.sessionId;
      const p = this.state.players.get(uid);
      if (!p) return;
      const key = String(payload?.key || '').trim();
      if (!FACTIONS.some(f => f.key === key)) return;
      const changed = p.faction !== key;
      p.faction = key;
      if (changed) p.loadout = '';
      // No dependency resets from faction currently
      try { this.state.log.push(`${p.name} chose faction ${key}`); } catch (_) {}
      sendFCLTo(uid);
    });

    this.onMessage('chooseClass', (client, payload) => {
      const uid = client.auth?.userId || client.sessionId;
      const p = this.state.players.get(uid);
      if (!p) return;
      const key = String(payload?.key || '').trim();
      if (!CLASSES.some(c => c.key === key)) return;
      p.classKey = key;
      try { this.state.log.push(`${p.name} chose class ${key}`); } catch (_) {}
      // Always refresh FCL without auto-dismissing; READY will advance flow
      sendFCLTo(uid);
    });

    this.onMessage('chooseLoadout', (client, payload) => {
      const uid = client.auth?.userId || client.sessionId;
      const p = this.state.players.get(uid);
      if (!p) return;
      const key = String(payload?.key || '').trim();
      const allowed = LOADOUTS_BY_FACTION[p.faction] || [];
      if (!allowed.some(l => l.key === key)) return;
      p.loadout = key;
      try { this.state.log.push(`${p.name} chose loadout ${key}`); } catch (_) {}
      // Always refresh FCL without auto-dismissing; READY will advance flow
      sendFCLTo(uid);
    });

    // Players toggle ready; host ready triggers confirmation modal
    this.onMessage('setReady', (client, payload) => {
      const uid = client.auth?.userId || client.sessionId;
      const p = this.state.players.get(uid);
      if (!p) return;
      const next = !!(payload && payload.ready);
      // Gate readiness on selection completion
      if (next) {
        const complete = !!(p.faction && p.classKey && p.loadout);
        if (!complete) {
          try { this.state.log.push(`${p.name} must choose faction, class, and loadout first`); } catch (_) {}
          // Prompt the player with selection modal
          sendFCLTo(uid);
          return; // do not set ready
        }
      }
      if (p.ready === next) {
        // no-op, but refresh confirm views to keep everyone in sync
        this.broadcastStartConfirmToReady();
        return;
      }
      p.ready = next;
      // Log for debugging
      try { this.state.log.push(`${p.name} is ${p.ready ? 'ready' : 'not ready'}`); } catch (_) {}
      // Update confirm displays for all ready players
      this.broadcastStartConfirmToReady();
      // If someone un-readies during countdown, stop it
      if (this.state.starting && !p.ready) {
        this.stopCountdown('player_unready');
        this.broadcastStartConfirmToReady();
      }
    });

    // Host or any READY player can cancel starting. If starting=false and host calls cancel twice,
    // second cancel will set host to unready (client invokes twice per spec).
    this.onMessage('cancelStart', (client) => {
      const uid = client.auth?.userId || client.sessionId;
      const p = this.state.players.get(uid);
      if (!p) return;
      const isHost = uid === this.hostId;
      // If countdown active, any READY player or host can stop it
      if (this.state.starting) {
        if (isHost || p.ready) {
          this.stopCountdown('cancel');
          // Keep host ready and modal open; others remain ready
          this.broadcastStartConfirmToReady();
        }
        return;
      }
      // Not starting: only host's second cancel should unready himself and close modal client-side
      if (isHost) {
        const wasReady = !!p.ready;
        p.ready = false;
        // Log transition to not ready for chat visibility
        try { if (wasReady) this.state.log.push(`${p.name} is not ready`); } catch (_) {}
        this.broadcastStartConfirmToReady();
      }
    });

    // Process queued inputs at a steady cadence
    this.clock.setInterval(() => this.processCommands(), 100);

    // Periodic autosave (configurable)
    if (AUTOSAVE_ENABLED && AUTOSAVE_INTERVAL_MS > 0) {
      this.clock.setInterval(() => {
        try {
          const snap = snapshotWorld(this);
          if (snap) {
            Promise.resolve(saveSnapshot(this.state.gameId, snap, AUTOSAVE_RETENTION)).catch(() => {});
          }
        } catch (_) {}
      }, AUTOSAVE_INTERVAL_MS);
    }

    // Presence mirror: periodically reflect PresenceHub status into state.players
    this._presenceTimer = this.clock.setInterval(() => {
      try {
        this.state.players.forEach((p, id) => {
          const s = Presence.getStatus(id);
          if (p && typeof p.status === 'string' && p.status !== s) p.status = s;
          const pm = (Presence.getPing(id) | 0) || 0;
          if (p && typeof p.pingMs === 'number' && p.pingMs !== pm) p.pingMs = pm;
          const net = Presence.getNet(id);
          if (p && typeof p.net === 'string' && p.net !== net) p.net = net;
        });
      } catch (_) {}
    }, 2000);

    // --- Dungeon setup (modularized) ---
    // Generate dungeon (currently returns default map)
    this.dungeonMap = generateDungeon(options?.dungeon || {});
    // Default colors for characters/tiles
    this.characterColorMap = getDefaultCharacterColorMap();
    // Future: place monsters/treasures (stubs return empty arrays)
    this.monsters = placeMonsters(this.dungeonMap, options?.monsters || {});
    this.treasures = placeTreasures(this.dungeonMap, options?.treasures || {});

    // Track connected clients by userId so we can send per-player FOV updates
    this.userClients = new Map();

    // Per-player colors for '@' overlays
    this.playerColors = new Map();
    this.colorPalette = [
      [1.0, 0.2, 0.2], // red
      [0.2, 1.0, 0.2], // green
      [0.2, 0.6, 1.0], // blue-ish
      [1.0, 1.0, 0.2], // yellow
      [1.0, 0.4, 1.0], // magenta
      [0.2, 1.0, 1.0], // cyan
      [1.0, 0.6, 0.2], // orange
      [0.8, 0.4, 1.0], // purple
    ];
    this.nextColorIdx = 0;
    
    // --- RoomsHub integration: keep lobby in sync ---
    const updateHub = () => {
      try {
        const clientsCount = Array.isArray(this.clients) ? this.clients.length : (this.state.players?.size || 0);
        const md = this.metadata || {};
        upsertRoom({
          roomId: this.roomId,
          clients: clientsCount | 0,
          maxClients: this.maxClients | 0,
          metadata: md,
        });
      } catch (_) {}
    };
    // initial publish
    updateHub();
    
    // Attempt to restore latest snapshot (world primitives + offline players)
    (async () => {
      try {
        const latest = await loadLatestSnapshot(this.state.gameId);
        if (latest && latest.data) {
          const { players } = restoreWorld(this, latest.data);
          if (Array.isArray(players)) {
            players.forEach((pl) => {
              try {
                if (!pl || !pl.id) return;
                // If already present (shouldn't be on fresh room), skip
                if (this.state.players.has(pl.id)) return;
                const p = new Player();
                p.id = pl.id;
                p.name = pl.name || 'Hero';
                p.ready = !!pl.ready;
                p.online = false; // offline until they rejoin
                p.faction = pl.faction || '';
                p.classKey = pl.classKey || '';
                p.loadout = pl.loadout || '';
                p.glyph = pl.glyph || '@';
                p.blocksMovement = pl.blocksMovement !== false;
                if (pl.currentLocation) {
                  p.currentLocation.x = pl.currentLocation.x | 0;
                  p.currentLocation.y = pl.currentLocation.y | 0;
                  p.currentLocation.level = pl.currentLocation.level | 0;
                }
                if (pl.lastLocation) {
                  p.lastLocation.x = pl.lastLocation.x | 0;
                  p.lastLocation.y = pl.lastLocation.y | 0;
                  p.lastLocation.level = pl.lastLocation.level | 0;
                }
                this.state.players.set(p.id, p);
                // Re-index occupancy
                addEntity(this, p);
              } catch (_) {}
            });
            try { this.state.log.push('[autosave] world restored'); } catch (_) {}
          }
        }
      } catch (e) {
        // fail-quietly, world stays fresh
      }
    })();
  }

  async onAuth(client, options) {
    const { roomPass, access_token } = options || {};

    // Try to verify Supabase access token if provided (non-fatal on failure)
    let authUserId = null;
    let authEmail = null;
    let emailVerified = false;
    if (access_token && typeof access_token === 'string') {
      try {
        const v = await verifySupabaseAccessToken(access_token);
        authUserId = v?.userId || null;
        authEmail = v?.email || null;
        // optional: fetch user to inspect verification status
        try {
          const user = await fetchSupabaseUser(access_token);
          emailVerified = !!(user && (user.email_confirmed_at || user.confirmed_at));
        } catch (_) {}
      } catch (e) {
        console.warn('[auth] token verification failed; continuing as guest', e?.message || e);
      }
    }

    // If the server requires login, enforce presence of a valid Supabase user id
    if (AUTH_REQUIRE_LOGIN && !authUserId) {
      throw new Error('Login required');
    }

    // If verified email is required, ensure the user is verified (only applies when logged in)
    if (REQUIRE_VERIFIED_EMAIL && AUTH_REQUIRE_LOGIN) {
      if (!emailVerified) {
        throw new Error('Email not verified');
      }
    }

    // If no password is set yet (brand new room), handle based on privacy
    if (!this.roomPassHash) {
      if (this.isPrivate) {
        if (!roomPass) throw new Error('Room requires password');
        this.roomPassHash = bcrypt.hashSync(roomPass, 8);
      } else {
        // Public room: no password required. Attach auth if available.
        return {
          userId: authUserId || options.userId || client.sessionId,
          name: options.hostName || options.name || (authEmail ? String(authEmail).split('@')[0] : 'Hero'),
        };
      }
    }

    const ok = await bcrypt.compare(roomPass || '', this.roomPassHash);
    if (!ok) throw new Error('Invalid password');

    // Attach identity (prefer Supabase user when available)
    return {
      userId: authUserId || options.userId || client.sessionId,
      name: options.hostName || options.name || (authEmail ? String(authEmail).split('@')[0] : 'Hero'),
    };
  }

  onJoin(client, options) {
    const id = client.auth.userId;
    // Enforce single active session per userId: kick previous client if connected
    if (ENFORCE_SINGLE_SESSION && id) {
      try {
        const prev = this.userClients && this.userClients.get(id);
        if (prev && prev !== client) {
          try { prev.send('modal', { command: 'present', id: 'SESSION_KICK', text: 'You signed in from another tab/device. This game session was disconnected.', blockInput: true }); } catch (_) {}
          this.clock.setTimeout(() => { try { prev.leave(4401); } catch (_) {} }, 120);
        }
      } catch (_) {}
    }
    let p = this.state.players.get(id);
    if (!p) {
      // First arrival becomes host
      if (!this.hostId) this.hostId = id;
      p = new Player();
      p.id = id;
      // Prefer authenticated name (from onAuth), fall back to join options
      p.name = (client.auth && client.auth.name) || options?.name || 'Hero';
      p.online = true;
      Presence.setOnline(id);
      p.status = Presence.getStatus(id);
      // Initialize player glyphs/metadata
      initPlayer(p);
      // Place the player at a walkable spawn
      placePlayer(this, p);
      // Assign a unique-ish color for this player
      if (!this.playerColors.has(id)) {
        const col = this.colorPalette[this.nextColorIdx++ % this.colorPalette.length];
        this.playerColors.set(id, col);
      }
      this.state.players.set(id, p);
      this.state.log.push(`${p.name}#${p.id.slice(0,6)} joined`);
      // Track client for targeted messages
      this.userClients.set(id, client);
      // Index occupancy
      addEntity(this, p);
      // Send initial render assets: color map then dungeon FOV (stubbed to full map)
      try {
        client.send('characterColorMap', JSON.stringify(this.characterColorMap));
        client.send('dungeonMap', calculateFOV(p, this.dungeonMap, { players: this.state.players }));
        const pcm = buildPositionColorMap(this.state.players, this.playerColors, p.currentLocation?.level ?? 0);
        client.send('positionColorMap', JSON.stringify(pcm));
        console.log('[DEBUG server] onJoin: sent characterColorMap and dungeonMap to client', { id });
      } catch (e) {
        console.warn('[DEBUG server] onJoin: failed to send initial maps', e);
      }
      // Refresh confirm views for ready players (host + others)
      this.broadcastStartConfirmToReady();
      // Update lobby rooms list
      try { updateHub(); } catch (_) {}
      // If player has not completed selection, prompt them
      if (!(p.faction && p.classKey && p.loadout)) {
        try { client.send('showFCLSelect', { ...buildFCLPayload(id), complete: false }); } catch (_) {}
      }
    } else {
      p.online = true;
      Presence.setOnline(id);
      p.status = Presence.getStatus(id);
      this.state.log.push(`${p.name}#${p.id.slice(0,6)} rejoined`);
      // Update mapping in case of reconnection
      this.userClients.set(id, client);
      // Ensure occupancy is indexed (idempotent)
      addEntity(this, p);
      try {
        client.send('characterColorMap', JSON.stringify(this.characterColorMap));
        client.send('dungeonMap', calculateFOV(p, this.dungeonMap, { players: this.state.players }));
        const pcm = buildPositionColorMap(this.state.players, this.playerColors, p.currentLocation?.level ?? 0);
        client.send('positionColorMap', JSON.stringify(pcm));
        console.log('[DEBUG server] onJoin(rejoin): resent characterColorMap and dungeonMap', { id });
      } catch (e) {
        console.warn('[DEBUG server] onJoin(rejoin): failed to send maps', e);
      }
      // Refresh confirm views for ready players (host + others)
      this.broadcastStartConfirmToReady();
      // If player is incomplete, prompt selection again (e.g., fresh browser)
      if (!(p.faction && p.classKey && p.loadout)) {
        try { client.send('showFCLSelect', { ...buildFCLPayload(id), complete: false }); } catch (_) {}
      }
    }
  }

  async onLeave(client, consented) {
    const id = client.auth?.userId || client.sessionId;
    const p = this.state.players.get(id);

    if (!consented) {
      try {
        await this.allowReconnection(client, 180); // 3 minutes grace
        return; // reconnection allowed, keep as-is
      } catch (err) {
        // timed out
      }
    }

    if (p) {
      p.online = false;
      Presence.setOffline(id);
      this.state.log.push(`${p.name}#${p.id.slice(0,6)} left`);
      removeEntity(this, p);
      // Refresh confirm views for ready players (host + others)
      this.broadcastStartConfirmToReady();
    }
    // Drop mapping for targeted messages
    this.userClients.delete(id);
    // Update lobby rooms list
    try {
      const clientsCount = Array.isArray(this.clients) ? this.clients.length : (this.state.players?.size || 0);
      if (clientsCount <= 0) {
        // when room empties, keep it listed until disposed; update count anyway
      }
      const md = this.metadata || {};
      upsertRoom({ roomId: this.roomId, clients: clientsCount | 0, maxClients: this.maxClients | 0, metadata: md });
    } catch (_) {}
  }

  processCommands() {
    if (this.processing) return;
    this.processing = true;

    let steps = 0;
    while (this.commandQueue.length && steps++ < 32) {
      const cmd = this.commandQueue.shift();
      this.applyCommand(cmd);
    }

    this.processing = false;
  }

  applyCommand(cmd) {
    // Delegate to modular command handler
    return applyGameCommand(this, cmd);
  }

  // Helper: build a snapshot payload for confirm modal
  buildConfirmPayload(forUserId) {
    const players = [];
    try {
      this.state.players.forEach((p, id) => {
        players.push({ id, name: p?.name || 'Hero', ready: !!p?.ready, online: p?.online !== false });
      });
    } catch (_) {}
    return {
      players,
      hostId: this.hostId,
      isHost: forUserId === this.hostId,
      starting: !!this.state.starting,
      countdown: this.state.countdown | 0,
      canStart: true, // host can always start; client will disable for non-hosts
      youAreReady: !!this.state.players.get(forUserId)?.ready,
    };
  }

  // Send/refresh confirm to all ready players and the host (if ready)
  broadcastStartConfirmToReady() {
    const ids = [];
    this.state.players.forEach((p, id) => { if (p.ready) ids.push(id); });
    ids.forEach((id) => {
      const c = this.userClients.get(id);
      if (!c) return;
      const payload = this.buildConfirmPayload(id);
      try { c.send('showGameConfirm', payload); } catch (e) { console.warn('showGameConfirm send failed', e); }
    });
  }

  // Begin a 5-second countdown; server-driven tick and broadcasts
  beginCountdown() {
    if (this._startTimer) return;
    this.state.starting = true;
    this.state.countdown = 5;
    try { this.state.log.push('Starting in 5…'); } catch (_) {}
    this.broadcastStartConfirmToReady();
    this._startTimer = this.clock.setInterval(() => {
      if (!this.state.starting) { this.clearCountdownTimer(); return; }
      this.state.countdown = Math.max(0, (this.state.countdown | 0) - 1);
      this.broadcastStartConfirmToReady();
      if (this.state.countdown <= 0) {
        this.stopCountdown('done');
        // Enter gameplay
        this.broadcast('appState', { state: 'GAMEPLAY_ACTIVE' });
      }
    }, 1000);
  }

  stopCountdown(reason) {
    if (!this.state.starting && !this._startTimer) return;
    this.state.starting = false;
    this.state.countdown = 0;
    this.clearCountdownTimer();
    try { this.state.log.push(`Start cancelled${reason ? ' (' + reason + ')' : ''}`); } catch (_) {}
  }

  clearCountdownTimer() {
    if (this._startTimer) {
      try { if (typeof this._startTimer.clear === 'function') this._startTimer.clear(); } catch (_) {}
      this._startTimer = null;
    }
  }

  // Backwards-compatible wrapper (use calculateFOV instead)
  getFOVFor(player) {
    return calculateFOV(player, this.dungeonMap, { players: this.state.players });
  }

  async onDispose() {
    try { removeRoom(this.roomId); } catch (_) {}
    if (this._presenceTimer) {
      try { this.clock.clearInterval(this._presenceTimer); } catch (_) {}
      this._presenceTimer = null;
    }
    if (this._pingTimer) {
      try { this.clock.clearInterval(this._pingTimer); } catch (_) {}
      this._pingTimer = null;
    }
    if (this._sessionTimer) {
      try { this.clock.clearInterval(this._sessionTimer); } catch (_) {}
      this._sessionTimer = null;
    }
  }
}

module.exports = { NethackRoom, GameState, Player };
