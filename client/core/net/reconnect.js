// Reconnect helpers extracted from main.js
// Usage: attemptReconnect({ client, afterJoin, statusEl, log })

export function shouldAutoReconnect() {
  try {
    const navs = (typeof performance.getEntriesByType === 'function') ? performance.getEntriesByType('navigation') : null;
    if (navs && navs[0] && typeof navs[0].type === 'string') {
      return navs[0].type === 'reload' || navs[0].type === 'back_forward';
    }
  } catch (_) {}
  try {
    const PN = performance.navigation;
    if (PN && typeof PN.type === 'number') {
      return PN.type === PN.TYPE_RELOAD || PN.type === PN.TYPE_BACK_FORWARD;
    }
  } catch (_) {}
  return false;
}

export async function attemptReconnect({ client, afterJoin, statusEl, log }) {
  try {
    const savedRoomId = sessionStorage.getItem('roomId');
    const savedSessionId = sessionStorage.getItem('sessionId');

    if (savedRoomId && savedSessionId && shouldAutoReconnect()) {
      statusEl.textContent = 'Reconnecting...';
      try {
        // Avoid getting stuck if reconnect hangs (e.g., server restarted)
        const timeoutMs = 3000;
        const r = await Promise.race([
          client.reconnect(savedRoomId, savedSessionId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('reconnect timeout')), timeoutMs))
        ]);
        await afterJoin(r);
        return; // done
      } catch (_) {
        // fallthrough to join
      }
    }
  } catch (err) {
    statusEl.textContent = 'Failed to connect';
    try { console.error(err); } catch (_) {}
    try { if (typeof log === 'function') log(String(err?.message || err)); } catch (_) {}
  }
}
