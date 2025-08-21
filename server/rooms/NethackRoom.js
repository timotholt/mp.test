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
    this.runId = '';
    this.players = new MapSchema();
    this.log = new ArraySchema();
  }
}

defineTypes(GameState, {
  runId: 'string',
  players: { map: Player },
  log: ['string'],
});

class NethackRoom extends Room {
  onCreate(options) {
    // Initialize state and metadata
    this.setState(new GameState());
    this.state.runId = options.runId || `run-${Math.random().toString(36).slice(2, 8)}`;
    this.setMetadata({ runId: this.state.runId });
    // INFO: room identity (easy to remove later)
    console.log('[info] room created', { roomId: this.roomId, runId: this.state.runId });

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
      // console.debug('[autosave]', this.state.runId, new Date().toISOString());
    }, 15_000);
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
    } else {
      p.online = true;
      this.state.log.push(`${p.name}#${p.id.slice(0,6)} rejoined`);
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
        break;
      }
      // TODO: combat, inventory, actions, etc.
      default:
        break; // ignore unknown
    }
  }
}

module.exports = { NethackRoom, GameState, Player };
