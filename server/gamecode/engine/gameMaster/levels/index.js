// Server-side Levels Aggregator (CommonJS)
// All dungeon generation lives server-side. Clients only render maps.

const { getDefaultMap } = require('../dungeons/default');
const { getLobbyBackgroundMap } = require('../scenarios/lobby/');
const { getLoginBackgroundMap, makeSpaceportLoginLevel } = require('../scenarios/login');

function generateDungeon(options = {}) {
  const variant = (options && options.variant) || '';
  if (variant === 'login') {
    const w = (options && options.width) || 60;
    const h = (options && options.height) || 40;
    return makeSpaceportLoginLevel(w, h);
  }
  if (variant === 'lobby') return getLobbyBackgroundMap();
  return getDefaultMap();
}

module.exports = {
  generateDungeon,
  getDefaultMap,
  getLobbyBackgroundMap,
  getLoginBackgroundMap,
  makeSpaceportLoginLevel,
};
