// Rendering helpers to overlay players on the dungeon and build per-position colors.

function mapToRows(dungeonMap) {
  return typeof dungeonMap === 'string' ? dungeonMap.split('\n') : [];
}

function rowsToMap(rows) {
  return rows.join('\n');
}

function overlayPlayersOnMap(dungeonMap, playersMap, targetLevel = 0) {
  const rows = mapToRows(dungeonMap).map((r) => r.split(''));
  const height = rows.length;
  const width = height > 0 ? (rows[0]?.length || 0) : 0;
  const visit = (p) => {
    const loc = p?.currentLocation;
    if (!loc) return;
    if (typeof loc.level !== 'number') return;
    if (loc.level !== targetLevel) return;
    const x = loc.x | 0;
    const y = loc.y | 0;
    if (y >= 0 && y < height && x >= 0 && x < width) {
      rows[y][x] = '@';
    }
  };
  if (playersMap && typeof playersMap.forEach === 'function') {
    playersMap.forEach(visit);
  } else if (playersMap && typeof playersMap[Symbol.iterator] === 'function') {
    for (const [, p] of playersMap) visit(p);
  }
  return rowsToMap(rows.map((r) => r.join('')));
}

function buildPositionColorMap(playersMap, playerColors, targetLevel = 0) {
  const out = {};
  const visit = (p, id) => {
    const loc = p?.currentLocation;
    if (!loc) return;
    if (typeof loc.level !== 'number') return;
    if (loc.level !== targetLevel) return;
    const key = `${loc.x},${loc.y}`;
    const color = playerColors?.get ? playerColors.get(id) : undefined;
    if (Array.isArray(color)) out[key] = color;
  };
  if (playersMap && typeof playersMap.forEach === 'function') {
    playersMap.forEach((p, id) => visit(p, id));
  } else if (playersMap && typeof playersMap[Symbol.iterator] === 'function') {
    for (const [id, p] of playersMap) visit(p, id);
  }
  return out;
}

module.exports = { overlayPlayersOnMap, buildPositionColorMap };
