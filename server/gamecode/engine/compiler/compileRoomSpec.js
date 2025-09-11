// Merge layered tiles into a final ASCII map string (server-side)
// Space character = transparent in layers

function compileRoomSpec(spec) {
  const W = (spec?.size?.width | 0) || 60;
  const H = (spec?.size?.height | 0) || 12;
  const layers = Array.isArray(spec?.layers) ? spec.layers : [];

  // Prepare separate buffers
  const occluderGrid = Array.from({ length: H }, () => Array(W).fill(' '));
  const floorGrids = [0, 1, 2].map(() => Array.from({ length: H }, () => Array(W).fill(' ')));

  // Helper to detect occluders (walls)
  const isOccluderChar = (ch) => (ch === '#') || (ch === '|') || (ch === '=');

  for (const layer of layers) {
    if (!layer || !Array.isArray(layer.data)) continue;
    // Layer routing: floor vs occluder
    let floorIndex = -1;
    let isFloor = false;
    // Accept either explicit kind/z or the older 'type' convention like 'floor0'
    if (layer.kind === 'floor') {
      isFloor = true;
      const z = (layer.z | 0);
      if (z >= 0 && z <= 2) floorIndex = z; else floorIndex = 0;
    } else if (typeof layer.type === 'string') {
      const t = layer.type.toLowerCase();
      if (t === 'floor') { isFloor = true; floorIndex = 0; }
      else if (t === 'floor0') { isFloor = true; floorIndex = 0; }
      else if (t === 'floor1') { isFloor = true; floorIndex = 1; }
      else if (t === 'floor2') { isFloor = true; floorIndex = 2; }
      else if (t === 'tiles') { /* treat as occluder/decor by content */ }
    }

    for (let y = 0; y < Math.min(H, layer.data.length); y++) {
      const row = String(layer.data[y] || '');
      for (let x = 0; x < Math.min(W, row.length); x++) {
        const ch = row[x];
        if (ch === ' ') continue;
        if (isFloor) {
          // Paint into specified floor layer only
          floorGrids[floorIndex][y][x] = ch;
        } else {
          // Paint non-space into occluder buffer
          occluderGrid[y][x] = ch;
        }
      }
    }
  }

  // Build final occluder+floor map for legacy consumers (collision/FOV)
  const floorChar = (spec?.palette?.floor) || '.';
  const finalGrid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    const occ = occluderGrid[y][x];
    return (occ !== ' ') ? occ : floorChar;
  }));

  const map = finalGrid.map(row => row.join('')).join('\n');
  const floorLayers = floorGrids.map(g => g.map(row => row.join('')).join('\n'));

  return {
    map,
    floorLayers, // 3 strings, each H lines by W chars, spaces = transparent
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
