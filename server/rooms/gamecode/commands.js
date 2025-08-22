// Game command application.
// Mutates room state appropriately and triggers any necessary side effects.

const { calculateFOV } = require('./fov');

function applyCommand(room, cmd) {
  const p = room.state.players.get(cmd.userId);
  if (!p) return;

  switch (cmd.type) {
    case 'move': {
      const dir = cmd.data?.dir; // 'N' | 'S' | 'E' | 'W'
      const delta = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[dir];
      if (!delta) return;
      p.x += delta[0];
      p.y += delta[1];
      try { console.log('[DEBUG server] applied', { userId: cmd.userId, dir, pos: [p.x, p.y] }); } catch (_) {}
      room.state.log.push(`${p.name}#${p.id.slice(0,6)} moved ${dir} -> (${p.x},${p.y})`);
      // Send updated FOV for this player (currently whole map)
      const c = room.userClients.get(cmd.userId);
      if (c) {
        try {
          c.send('dungeonMap', calculateFOV(p, room.dungeonMap));
        } catch (e) {
          console.warn('[DEBUG server] failed to send updated FOV', { userId: cmd.userId }, e);
        }
      }
      break;
    }
    default:
      break; // ignore unknown
  }
}

module.exports = { applyCommand };
