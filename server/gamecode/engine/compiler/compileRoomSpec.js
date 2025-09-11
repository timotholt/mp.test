// Merge layered tiles into a final ASCII map string (server-side)
// Space character = transparent in layers

function compileRoomSpec(spec) {
  const W = (spec?.size?.width | 0) || 60;
  const H = (spec?.size?.height | 0) || 12;
  const layers = Array.isArray(spec?.layers) ? spec.layers : [];

  // Start with spaces (transparent)
  const grid = Array.from({ length: H }, () => Array(W).fill(' '));

  // Paint layers in order; non-space char overwrites
  for (const layer of layers) {
    if (!layer || layer.type !== 'tiles' || !Array.isArray(layer.data)) continue;
    for (let y = 0; y < Math.min(H, layer.data.length); y++) {
      const row = String(layer.data[y] || '');
      for (let x = 0; x < Math.min(W, row.length); x++) {
        const ch = row[x];
        if (ch !== ' ') grid[y][x] = ch;
      }
    }
  }

  // Replace any remaining spaces with floor (if provided), otherwise '.'
  const floorChar = (spec?.palette?.floor) || '.';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] === ' ') grid[y][x] = floorChar;
    }
  }

  // Convert to string lines
  const map = grid.map(row => row.join('')).join('\n');

  // Return optional metadata you might use later
  return {
    map,
    colors: spec?.colors || null,
    lights: spec?.lights || [],
    entities: spec?.entities || { static: [], spawners: [] },
    spawn: spec?.spawn || null,
    size: { width: W, height: H },
    id: spec?.id || null,
    name: spec?.name || null,
  };
}

module.exports = { compileRoomSpec };
