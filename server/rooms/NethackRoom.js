// Authoritative Colyseus Room for a simple Nethack-style multiplayer
// Plain JavaScript (CommonJS). Password-protected room with basic input queue.

const { Room } = require('colyseus');
const bcrypt = require('bcryptjs');
const { Schema, type, MapSchema, ArraySchema, defineTypes } = require('@colyseus/schema');
const { generateDungeon } = require('./gamecode/dungeonGenerator');
const { getDefaultCharacterColorMap } = require('./gamecode/colors');
const { placeMonsters } = require('./gamecode/monsterPlacement');
const { placeTreasures } = require('./gamecode/treasurePlacement');
const { calculateFOV } = require('./gamecode/fov');
const { applyCommand: applyGameCommand } = require('./gamecode/commands');
const { placePlayer } = require('./gamecode/playerPlacement');
const { initPlayer } = require('./gamecode/initPlayer');
const { buildPositionColorMap } = require('./gamecode/render');
const { Entity, Location } = require('./gamecode/entity');
const { addEntity, removeEntity } = require('./gamecode/occupancy');

class Player extends Entity {
  constructor() {
    super();
    this.kind = 'player';
    this.online = true;
  }
}

defineTypes(Player, {
  online: 'boolean',
});

class GameState extends Schema {
  constructor() {
    super();
    this.gameId = '';
    this.players = new MapSchema();
    this.log = new ArraySchema();
  }
}

defineTypes(GameState, {
  gameId: 'string',
  players: { map: Player },
  log: ['string'],
});

class NethackRoom extends Room {
  onCreate(options) {
    // Initialize state and metadata
    this.setState(new GameState());
    this.state.gameId = options.gameId || `game-${Math.random().toString(36).slice(2, 8)}`;
    this.isPrivate = !!options.private;
    this.setMetadata({ gameId: this.state.gameId, private: this.isPrivate });
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

    // Input handler (clients send small intents only; server is authoritative)
    this.onMessage('input', (client, payload) => {
      if (!payload || typeof payload !== 'object') return;
      const { type, ...rest } = payload;
      if (typeof type !== 'string') return;
      // DEBUG: temporary instrumentation - server received input (remove after verifying flow)
      console.log('[DEBUG server] onMessage input', { sessionId: client.sessionId, type, rest });
      this.commandQueue.push({ userId: client.auth?.userId || client.sessionId, type, data: rest });
    });

    // Process queued inputs at a steady cadence
    this.clock.setInterval(() => this.processCommands(), 100);

    // Periodic autosave hook (placeholder for DB persistence)
    this.clock.setInterval(() => {
      // TODO: save snapshot to DB
      // console.debug('[autosave]', this.state.gameId, new Date().toISOString());
    }, 15_000);

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
  }

  async onAuth(client, options) {
    const { roomPass } = options || {};

    // If no password is set yet (brand new room), handle based on privacy
    if (!this.roomPassHash) {
      if (this.isPrivate) {
        if (!roomPass) throw new Error('Room requires password');
        this.roomPassHash = bcrypt.hashSync(roomPass, 8);
      } else {
        // Public room: no password required
        return {
          userId: options.userId || client.sessionId,
          name: options.name || 'Hero',
        };
      }
    }

    const ok = await bcrypt.compare(roomPass || '', this.roomPassHash);
    if (!ok) throw new Error('Invalid password');

    // Minimal identity (no JWT yet). You can integrate JWT later.
    return {
      userId: options.userId || client.sessionId,
      name: options.name || 'Hero',
    };
  }

  onJoin(client, options) {
    const id = client.auth.userId;
    let p = this.state.players.get(id);
    if (!p) {
      p = new Player();
      p.id = id;
      p.name = options?.name || 'Hero';
      p.online = true;
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
    } else {
      p.online = true;
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
      this.state.log.push(`${p.name}#${p.id.slice(0,6)} left`);
      removeEntity(this, p);
    }
    // Drop mapping for targeted messages
    this.userClients.delete(id);
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

  // Backwards-compatible wrapper (use calculateFOV instead)
  getFOVFor(player) {
    return calculateFOV(player, this.dungeonMap, { players: this.state.players });
  }
}

module.exports = { NethackRoom, GameState, Player };
