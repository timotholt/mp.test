// Game command application.
// Mutates room state appropriately and triggers any necessary side effects.

const { calculateFOV } = require('./fov');
const { isWalkable } = require('./collision');
const { buildPositionColorMap } = require('./render');

function applyCommand(room, cmd) {
  const p = room.state.players.get(cmd.userId);
  if (!p) return;

  switch (cmd.type) {
    case 'move': {
      const dir = cmd.data?.dir; // 'N' | 'S' | 'E' | 'W'
      const delta = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[dir];
      if (!delta) return;
      const cx = p.currentLocation?.x ?? 0;
      const cy = p.currentLocation?.y ?? 0;
      const nx = cx + delta[0];
      const ny = cy + delta[1];
      if (isWalkable(room.dungeonMap, nx, ny)) {
        if (p.currentLocation && p.lastLocation) {
          // store previous into lastLocation
          p.lastLocation.x = p.currentLocation.x;
          p.lastLocation.y = p.currentLocation.y;
          p.lastLocation.level = p.currentLocation.level;
          // apply new
          p.currentLocation.x = nx;
          p.currentLocation.y = ny;
        }
        const lvl = p.currentLocation?.level ?? 0;
        try { console.log('[DEBUG server] applied', { userId: cmd.userId, dir, pos: [p.currentLocation.x, p.currentLocation.y, lvl] }); } catch (_) {}
        room.state.log.push(`${p.name}#${p.id.slice(0,6)} moved ${dir} -> (${p.currentLocation.x}/${p.currentLocation.y}/${lvl})`);
      } else {
        try { console.log('[DEBUG server] blocked', { userId: cmd.userId, dir, at: [nx, ny] }); } catch (_) {}
        room.state.log.push(`${p.name}#${p.id.slice(0,6)} bumped into a wall`);
      }
      // Send updated dungeon and position colors to all clients, tailored to each client's level
      for (const [otherId, c] of room.userClients) {
        const viewer = room.state.players.get(otherId);
        if (!viewer) continue;
        try {
          const mapStr = calculateFOV(viewer, room.dungeonMap, { players: room.state.players });
          c.send('dungeonMap', mapStr);
          const lvl2 = viewer.currentLocation?.level ?? 0;
          const pcm = buildPositionColorMap(room.state.players, room.playerColors, lvl2);
          c.send('positionColorMap', JSON.stringify(pcm));
        } catch (e) {
          console.warn('[DEBUG server] failed to send updated maps', { userId: otherId }, e);
        }
      }
      break;
    }
    default:
      break; // ignore unknown
  }
}

module.exports = { applyCommand };
