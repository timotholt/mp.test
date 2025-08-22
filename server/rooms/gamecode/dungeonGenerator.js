// Dungeon generator entry point.
// For now, return the default static map while the generator is being built out.
const { getDefaultMap } = require('./defaultMap');

function generateDungeon(options = {}) {
  // TODO: replace with real procedural generation using options (seed, size, theme, etc.)
  return getDefaultMap();
}

module.exports = { generateDungeon };
