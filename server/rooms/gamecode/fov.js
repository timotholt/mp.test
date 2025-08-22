// Field-of-view calculation.
// Currently returns the entire dungeon as a stub, but overlays players so '@' moves are visible.

const { overlayPlayersOnMap } = require('./render');

function calculateFOV(player, dungeonMap, options = {}) {
  // options: { players: MapSchema, level: number }
  const level = (typeof options.level === 'number')
    ? options.level
    : (player?.currentLocation?.level ?? 0);
  const players = options.players;
  let base = dungeonMap;
  if (players) {
    base = overlayPlayersOnMap(dungeonMap, players, level);
  }
  // TODO: implement real FOV/visibility based on player position and light
  return base;
}

module.exports = { calculateFOV };
