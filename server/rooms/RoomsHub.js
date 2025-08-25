// Simple in-memory hub for broadcasting room list updates to LobbyRoom
// Plain JS (CommonJS). Not persisted.
const { EventEmitter } = require('events');

class RoomsHub extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map(); // roomId -> { roomId, clients, maxClients, metadata }
  }

  upsert(roomInfo) {
    if (!roomInfo || !roomInfo.roomId) return;
    const prev = this.rooms.get(roomInfo.roomId) || {};
    const next = {
      roomId: roomInfo.roomId,
      clients: roomInfo.clients | 0,
      maxClients: roomInfo.maxClients | 0,
      metadata: roomInfo.metadata || {},
    };
    const changed = JSON.stringify(prev) !== JSON.stringify(next);
    this.rooms.set(next.roomId, next);
    if (changed) this.emit('roomsChanged', this.list());
  }

  remove(roomId) {
    if (!this.rooms.has(roomId)) return;
    this.rooms.delete(roomId);
    this.emit('roomsChanged', this.list());
  }

  list() {
    return Array.from(this.rooms.values());
  }
}

// Singleton
const hub = new RoomsHub();

module.exports = {
  hub,
  upsertRoom: (info) => hub.upsert(info),
  removeRoom: (roomId) => hub.remove(roomId),
  getRooms: () => hub.list(),
  onRoomsChanged: (fn) => { hub.on('roomsChanged', fn); return () => hub.off('roomsChanged', fn); },
};
