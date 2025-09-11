// Player placement utilities.
// Chooses a walkable spawn location that doesn't overlap other players.

const { isWalkable, mapToRows } = require('./collision');

function isOccupied(playersMap, x, y) {
  for (const [, pl] of playersMap) {
    const lx = pl.currentLocation?.x;
    const ly = pl.currentLocation?.y;
    if (lx === x && ly === y) return true;
  }
  return false;
}

function findSpawn(dungeonMap, playersMap) {
  const rows = mapToRows(dungeonMap);
  const height = rows.length;
  const width = rows[0]?.length || 0;
  // Simple scan: top-left to bottom-right for first walkable, unoccupied tile
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isWalkable(dungeonMap, x, y) && !isOccupied(playersMap, x, y)) {
        return { x, y };
      }
    }
  }
  // Fallback: (0,0)
  return { x: 0, y: 0 };
}

function placePlayer(room, player, options = {}) {
  const { x, y } = findSpawn(room.dungeonMap, room.state.players);
  if (!player.currentLocation) player.currentLocation = { x: 0, y: 0, level: 0 };
  if (!player.lastLocation) player.lastLocation = { x: 0, y: 0, level: 0 };
  player.currentLocation.x = x;
  player.currentLocation.y = y;
  // Leveling: default to level 0 for single-level maps for now
  if (typeof player.currentLocation.level !== 'number') player.currentLocation.level = 0;
  // Initialize lastLocation to current on spawn
  player.lastLocation.x = player.currentLocation.x;
  player.lastLocation.y = player.currentLocation.y;
  player.lastLocation.level = player.currentLocation.level;
  return player;
}

module.exports = { placePlayer, findSpawn };
