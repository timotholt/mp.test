// Dungeon generator entry point.
// Delegate to shared generator to keep client and server identical.
const { generateDungeon: sharedGenerateDungeon } = require('../../../shared/dungeon/generator');

function generateDungeon(options = {}) {
  // Forward to shared generator (supports options like seed, size, theme in the future)
  return sharedGenerateDungeon(options || {});
}

module.exports = { generateDungeon };
