// Client heartbeat helper
// Sends a lightweight 'hb' message every interval to any joined rooms
// Minimal, resilient, and guarded to avoid duplicate timers.

export function startHeartbeat({ getRoom, getLobbyRoom, intervalMs = 5000 } = {}) {
  try {
    // Global guard so multiple calls are harmless
    if (window.__hbTimer) return;
    window.__hbTimer = setInterval(() => {
      // Current game room
      try {
        const r = typeof getRoom === 'function' ? getRoom() : null;
        if (r && typeof r.send === 'function') r.send('hb');
      } catch (_) {}
      // Lobby room (if joined)
      try {
        const lr = typeof getLobbyRoom === 'function' ? getLobbyRoom() : (window.lobbyRoom || null);
        if (lr && typeof lr.send === 'function') lr.send('hb');
      } catch (_) {}
    }, intervalMs);
  } catch (_) {}
}
