// Gameplay Movement Input (Guarded)
// Attaches a keydown listener that sends movement inputs when allowed.
// Guard respects window.__canSendGameplayInput and the provided getRoom callback.

export function registerGameplayMovement(getRoom) {
  window.addEventListener('keydown', (e) => {
    const map = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' };
    const dir = map[e.key];
    if (!dir) return;
    const room = (typeof getRoom === 'function') ? getRoom() : null;
    if (!room || !window.__canSendGameplayInput) return;
    e.preventDefault();
    try { room.send('input', { type: 'move', dir }); } catch (_) {}
  });
}
