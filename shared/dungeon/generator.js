// Shared dungeon generator (CommonJS) usable by both server (require) and client (Vite can import CJS)
// TODO: Replace with real procedural generation using options (seed, size, theme, etc.)

// Default gameplay map (matches original server default)
function getDefaultMap() {
  return [
    '####################',
    '#.............~~~~~#',
    '#..####..####..~~~~#',
    '#..#  #..#  #..,.,.#',
    '#..#  +==+  #......#',
    '#..####..####......#',
    '#..................#',
    '####################',
  ].join('\n');
}

// Variant maps for non-gameplay backgrounds (login/lobby). Keeping here ensures single source of truth.
function getLoginBackgroundMap() {
  // Legacy 60x12 banner (kept for reference)
  return [
    '############################################################',
    '#..........######.................######.............^.....#',
    '#..........#....#.................#....#...................#',
    '#..........#....#.....@@@@@.......#....#...................#',
    '#..........######.................######...................#',
    '#..........................................................#',
    '#.............######....................######.............#',
    '#.............#....#....................#....#.............#',
    '#.....@.......#....#....................#....#.......@.....#',
    '#.............######....................######.............#',
    '#..........................................................#',
    '############################################################',
  ].join('\n');
}

// Programmatic 60x40 (default) static "spaceport_login" rectangle with smooth walls and marble floor.
function makeSpaceportLoginLevel(width = 60, height = 40) {
  const W = Math.max(20, width | 0);
  const H = Math.max(12, height | 0);
  const rows = new Array(H);
  const border = '#'.repeat(W);
  rows[0] = border;
  rows[H - 1] = border;
  for (let y = 1; y < H - 1; y++) {
    const inner = '.'.repeat(W - 2); // '.' = black marble floor (client chooses material)
    rows[y] = '#' + inner + '#';     // '#' = smooth sci-fi wall
  }
  // Add a few horizontal wall bands with door gaps to avoid monotony
  const bands = [Math.floor(H * 0.25), Math.floor(H * 0.5), Math.floor(H * 0.75)];
  bands.forEach((y, i) => {
    if (y <= 0 || y >= H - 1) return;
    const gapStart = 4 + (i * 7) % Math.max(5, W - 10);
    const gapLen = 6;
    const arr = rows[y].split('');
    for (let x = 1; x < W - 1; x++) {
      arr[x] = '#';
    }
    for (let x = gapStart; x < Math.min(W - 1, gapStart + gapLen); x++) arr[x] = '.';
    rows[y] = arr.join('');
  });
  return rows.join('\n');
}

function getLobbyBackgroundMap() {
  return [
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################@#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################|#############################',
    '##############################^#############################',
    '##############################|#############################',
  ].join('\n');
}

function generateDungeon(options = {}) {
  const variant = (options && options.variant) || '';
  if (variant === 'login') {
    const w = (options && options.width) || 60;
    const h = (options && options.height) || 40;
    return makeSpaceportLoginLevel(w, h);
  }
  if (variant === 'lobby') return getLobbyBackgroundMap();
  // Default gameplay map
  return getDefaultMap();
}

module.exports = { generateDungeon, getDefaultMap, getLoginBackgroundMap, getLobbyBackgroundMap, makeSpaceportLoginLevel };
