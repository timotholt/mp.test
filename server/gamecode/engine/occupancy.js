// Occupancy index + entity-aware blocking.
// Stores which entity occupies each (level,x,y) and provides helpers to maintain it.

const { tileAt, isWalkableTile } = require('./collision');

function posKey(x, y) { return `${x},${y}`; }

function ensureLevel(room, level) {
  if (!room.occupancy) room.occupancy = new Map();
  if (!room.occupancy.has(level)) room.occupancy.set(level, new Map());
  return room.occupancy.get(level);
}

function addEntity(room, entity) {
  const lvl = entity.currentLocation?.level ?? 0;
  const x = entity.currentLocation?.x | 0;
  const y = entity.currentLocation?.y | 0;
  const layer = ensureLevel(room, lvl);
  layer.set(posKey(x, y), entity.id);
}

function removeEntity(room, entity) {
  const lvl = entity.currentLocation?.level ?? entity.lastLocation?.level ?? 0;
  const x = entity.currentLocation?.x ?? entity.lastLocation?.x;
  const y = entity.currentLocation?.y ?? entity.lastLocation?.y;
  const layer = ensureLevel(room, lvl);
  layer.delete(posKey(x | 0, y | 0));
}

function moveEntity(room, entity, from, to) {
  const fromLvl = from?.level ?? entity.lastLocation?.level ?? 0;
  const toLvl = to?.level ?? entity.currentLocation?.level ?? 0;
  const fromLayer = ensureLevel(room, fromLvl);
  const toLayer = ensureLevel(room, toLvl);
  if (typeof from?.x === 'number' && typeof from?.y === 'number') {
    fromLayer.delete(posKey(from.x | 0, from.y | 0));
  }
  if (typeof to?.x === 'number' && typeof to?.y === 'number') {
    toLayer.set(posKey(to.x | 0, to.y | 0), entity.id);
  }
}

function isOccupied(room, level, x, y) {
  const layer = ensureLevel(room, level ?? 0);
  return layer.get(posKey(x | 0, y | 0)) || null;
}

function isBlocked(room, level, x, y) {
  const ch = tileAt(room.dungeonMap, x, y);
  if (!isWalkableTile(ch)) return true; // terrain blocks
  return !!isOccupied(room, level ?? 0, x, y); // entity blocks
}

module.exports = { addEntity, removeEntity, moveEntity, isOccupied, isBlocked };
