// Dungeon generator entry point (server-only).
// All generation logic now lives under server/rooms/gamecode/levels/.
const { generateDungeon: serverGenerateDungeon } = require('./gameMaster/levels');

function generateDungeon(options = {}) {
  // Supports options like seed, size, theme (future)
  return serverGenerateDungeon(options || {});
}

module.exports = { generateDungeon };
