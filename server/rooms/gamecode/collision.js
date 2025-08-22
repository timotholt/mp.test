// Collision detection helpers.
// Map is a string with `\n`-separated rows.

function mapToRows(dungeonMap) {
  return typeof dungeonMap === 'string' ? dungeonMap.split('\n') : [];
}

function tileAt(dungeonMap, x, y) {
  const rows = mapToRows(dungeonMap);
  if (y < 0 || y >= rows.length) return null;
  const row = rows[y] || '';
  if (x < 0 || x >= row.length) return null;
  return row[x] || null;
}

function isWalkableTile(ch) {
  if (!ch) return false;
  // Simple rule: walls '#' are blocked. Everything else walkable for now.
  return ch !== '#';
}

function isWalkable(dungeonMap, x, y) {
  return isWalkableTile(tileAt(dungeonMap, x, y));
}

module.exports = { mapToRows, tileAt, isWalkable, isWalkableTile };
