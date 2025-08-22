// Authoritative Colyseus Room for a simple Nethack-style multiplayer
// Plain JavaScript (CommonJS). Password-protected room with basic input queue.

const { Room } = require('colyseus');
const bcrypt = require('bcryptjs');
const { Schema, type, MapSchema, ArraySchema, defineTypes } = require('@colyseus/schema');

class Player extends Schema {
  constructor() {
    super();
    this.id = '';
    this.name = '';
    this.x = 0;
    this.y = 0;
    this.online = true;
  }
}

defineTypes(Player, {
  id: 'string',
  name: 'string',
  x: 'number',
  y: 'number',
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
    this.setMetadata({ gameId: this.state.gameId });
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

    // --- Dungeon + FOV stubs ---
    // Minimal hard-coded dungeon and a basic character color map.
    // FOV is currently the entire dungeon (stub), but the delivery pipeline works per-player.
    this.dungeonMap = [
      '####################',
      '#.............~~~~~#',
      '#..####..####..~~~~#',
      '#..#  #..#  #..,.,.#',
      '#..#  +==+  #......#',
      '#..####..####......#',
      '#..................#',
      '####################',
    ].join('\n');

    this.characterColorMap = {
      '#': [0.75, 0.75, 0.75],
      '.': [0.35, 0.35, 0.35],
      ',': [0.10, 0.70, 0.10],
      '~': [0.20, 0.40, 1.00],
      '+': [0.90, 0.75, 0.20],
      '=': [0.85, 0.55, 0.15],
    };

    // Track connected clients by userId so we can send per-player FOV updates
    this.userClients = new Map();
  }

  async onAuth(client, options) {
    const { roomPass } = options || {};

    // If no password is set yet (brand new room), set it now
    if (!this.roomPassHash) {
      if (!roomPass) throw new Error('Room requires password');
      this.roomPassHash = bcrypt.hashSync(roomPass, 8);
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
      p.x = 0; p.y = 0; p.online = true;
      this.state.players.set(id, p);
      this.state.log.push(`${p.name}#${p.id.slice(0,6)} joined`);
      // Track client for targeted messages
      this.userClients.set(id, client);
      // Send initial render assets: color map then dungeon FOV (stubbed to full map)
      try {
        client.send('characterColorMap', JSON.stringify(this.characterColorMap));
        client.send('dungeonMap', this.getFOVFor(p));
        console.log('[DEBUG server] onJoin: sent characterColorMap and dungeonMap to client', { id });
      } catch (e) {
        console.warn('[DEBUG server] onJoin: failed to send initial maps', e);
      }
    } else {
      p.online = true;
      this.state.log.push(`${p.name}#${p.id.slice(0,6)} rejoined`);
      // Update mapping in case of reconnection
      this.userClients.set(id, client);
      try {
        client.send('characterColorMap', JSON.stringify(this.characterColorMap));
        client.send('dungeonMap', this.getFOVFor(p));
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
    const p = this.state.players.get(cmd.userId);
    if (!p) return;

    switch (cmd.type) {
      case 'move': {
        const dir = cmd.data?.dir; // 'N' | 'S' | 'E' | 'W'
        const delta = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[dir];
        if (!delta) return;
        p.x += delta[0];
        p.y += delta[1];
        // DEBUG: temporary instrumentation - server applied command (remove after verifying flow)
        console.log('[DEBUG server] applied', { userId: cmd.userId, dir, pos: [p.x, p.y] });
        this.state.log.push(`${p.name}#${p.id.slice(0,6)} moved ${dir} -> (${p.x},${p.y})`);
        // Send updated FOV for this player (currently whole map)
        const c = this.userClients.get(cmd.userId);
        if (c) {
          try {
            c.send('dungeonMap', this.getFOVFor(p));
          } catch (e) {
            console.warn('[DEBUG server] failed to send updated FOV', { userId: cmd.userId }, e);
          }
        }
        break;
      }
      // TODO: combat, inventory, actions, etc.
      default:
        break; // ignore unknown
    }
  }

  // Stub FOV: return the entire dungeon for now. Later, compute visibility based on player pos.
  getFOVFor(player) {
    return this.dungeonMap;
  }
}

module.exports = { NethackRoom, GameState, Player };
