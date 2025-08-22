// Whole-world serialization helpers for snapshot/restore
// Keep plain JS objects; avoid circular refs. Rebuild occupancy on restore.

function deepClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); } catch (_) { return obj; }
}

function snapshotWorld(room) {
  if (!room || !room.state) return null;
  const players = [];
  try {
    room.state.players.forEach((p, id) => {
      players.push({
        id,
        name: p?.name || 'Hero',
        ready: !!p?.ready,
        online: p?.online !== false,
        faction: p?.faction || '',
        classKey: p?.classKey || '',
        loadout: p?.loadout || '',
        glyph: p?.glyph || '@',
        blocksMovement: p?.blocksMovement !== false,
        currentLocation: {
          x: (p?.currentLocation?.x | 0),
          y: (p?.currentLocation?.y | 0),
          level: (p?.currentLocation?.level | 0),
        },
        lastLocation: {
          x: (p?.lastLocation?.x | 0),
          y: (p?.lastLocation?.y | 0),
          level: (p?.lastLocation?.level | 0),
        },
      });
    });
  } catch (_) {}

  const playerColors = {};
  try {
    if (room.playerColors && typeof room.playerColors.forEach === 'function') {
      room.playerColors.forEach((col, id) => { if (Array.isArray(col)) playerColors[id] = col; });
    }
  } catch (_) {}

  const snap = {
    version: 1,
    dungeonMap: String(room.dungeonMap || ''),
    characterColorMap: deepClone(room.characterColorMap || {}),
    monsters: deepClone(room.monsters || []),
    treasures: deepClone(room.treasures || []),
    players,
    playerColors,
    log: Array.isArray(room.state?.log) ? room.state.log.slice(-200) : [],
  };
  return snap;
}

function restoreWorld(room, snap) {
  if (!room || !snap || typeof snap !== 'object') return { players: [] };
  // Basic world primitives
  room.dungeonMap = typeof snap.dungeonMap === 'string' ? snap.dungeonMap : (room.dungeonMap || '');
  room.characterColorMap = snap.characterColorMap || room.characterColorMap || {};
  room.monsters = Array.isArray(snap.monsters) ? snap.monsters : (room.monsters || []);
  room.treasures = Array.isArray(snap.treasures) ? snap.treasures : (room.treasures || []);

  // Rehydrate player color map
  try {
    room.playerColors = new Map();
    const pc = snap.playerColors || {};
    Object.keys(pc).forEach((id) => { if (Array.isArray(pc[id])) room.playerColors.set(id, pc[id]); });
  } catch (_) {}

  // Clear occupancy; caller will re-index via addEntity for each player
  try { room.occupancy = new Map(); } catch (_) {}

  const players = Array.isArray(snap.players) ? snap.players : [];
  return { players };
}

module.exports = { snapshotWorld, restoreWorld };
