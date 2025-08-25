// Colyseus room that broadcasts real-time rooms list and connected lobby players
// Plain JS (CommonJS)
const { Room } = require('colyseus');
const { onRoomsChanged, getRooms } = require('./RoomsHub');
const { verifySupabaseAccessToken, fetchSupabaseUser } = require('../auth/verify');

class LobbyRoom extends Room {
  onCreate() {
    // Keep a simple subscription to the hub and rebroadcast to clients
    this._unsub = onRoomsChanged((rooms) => {
      try { this.broadcast('roomsList', rooms || []); } catch (_) {}
    });
    // Send initial snapshot periodically as a safeguard
    this.clock.setTimeout(() => {
      try { this.broadcast('roomsList', getRooms()); } catch (_) {}
    }, 50);
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
    // Send current rooms list on join
    try { client.send('roomsList', getRooms()); } catch (_) {}
    // Update players list for lobby
    this.broadcastLobbyPlayers();
  }

  onLeave() {
    // Update players list for lobby when someone leaves
    this.broadcastLobbyPlayers();
  }

  onDispose() {
    if (typeof this._unsub === 'function') {
      try { this._unsub(); } catch (_) {}
    }
  }

  broadcastLobbyPlayers() {
    const players = this.clients.map((c) => ({
      id: c?.auth?.userId || c?.sessionId,
      name: c?.auth?.name || 'Guest',
    }));
    try { this.broadcast('playersList', players); } catch (_) {}
  }
}

module.exports = { LobbyRoom };
