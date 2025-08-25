// Session handlers extracted from main.js
// Provides startLobby, leaveRoomToLobby, and afterJoin using provided deps and room accessors.

import { wireRoomEvents } from './wireRoomEvents.js';

export function createSessionHandlers(deps) {
  const {
    // routing/UI
    setRoute, APP_STATES, OverlayManager, PRIORITY,
    // storage/utils
    LS,
    // room UI helpers
    resetRoomUiBinding, getPlayersSnapshot, appendChatLine, setReadyButtonUI,
    // modal pipeline
    presentSubstate, presentStartGameConfirm, presentFCLSelectModal,
    // status/logging
    statusEl,
    // room accessors
    getRoom, setRoom,
  } = deps || {};

  // Track last forced modal so we don't duplicate onLeave fallback
  let _lastForcedModalId = null; // 'SESSION_KICK' | 'SESSION_EXPIRE' | null
  let _lastForcedAt = 0;

  function startLobby() {
    try { statusEl && (statusEl.textContent = 'In Lobby'); } catch (_) {}
    setRoute && setRoute(APP_STATES && APP_STATES.LOBBY);
  }

  async function leaveRoomToLobby() {
    try {
      const room = getRoom && getRoom();
      if (room && typeof room.leave === 'function') {
        await room.leave(true);
      }
    } catch (e) { try { console.warn('leave failed', e); } catch (_) {} }
    try { sessionStorage.removeItem('roomId'); } catch (_) {}
    try { sessionStorage.removeItem('sessionId'); } catch (_) {}
    try { OverlayManager && OverlayManager.dismiss && OverlayManager.dismiss('ROOM_MODAL'); } catch (_) {}
    try { statusEl && (statusEl.textContent = 'In Lobby'); } catch (_) {}
    try { setRoom && setRoom(null); } catch (_) {}
    try { resetRoomUiBinding && resetRoomUiBinding(); } catch (_) {}
    setRoute && setRoute(APP_STATES && APP_STATES.LOBBY);
  }

  async function afterJoin(r) {
    setRoom && setRoom(r);
    try { sessionStorage.setItem('roomId', r.id); } catch (_) {}
    try { sessionStorage.setItem('sessionId', r.sessionId); } catch (_) {}
    try { window.room = r; } catch (_) {}
    try { resetRoomUiBinding && resetRoomUiBinding(); } catch (_) {}
    wireRoomEvents(r, {
      log: (line) => { try { console?.log?.(line); } catch (_) {} },
      setRoute, APP_STATES, presentSubstate, OverlayManager, PRIORITY,
      presentStartGameConfirm, getPlayersSnapshot, appendChatLine, setReadyButtonUI, presentFCLSelectModal,
      onLeave: (code) => {
        try { statusEl && (statusEl.textContent = 'Disconnected (' + code + ')'); } catch (_) {}
        try { setRoom && setRoom(null); } catch (_) {}
        // Fallback modal if server closed before modal delivered
        try {
          const now = Date.now();
          const seenRecently = _lastForcedModalId && (now - _lastForcedAt < 3000);
          if (!seenRecently && (code === 4401 || code === 4402)) {
            const id = code === 4401 ? 'SESSION_KICK' : 'SESSION_EXPIRE';
            const text = code === 4401
              ? 'You signed in from another tab/device. This session was disconnected.'
              : 'Session expired due to inactivity.';
            try { OverlayManager && OverlayManager.present && OverlayManager.present({ id, text, priority: PRIORITY && PRIORITY.CRITICAL, blockInput: true }); } catch (_) {}
          }
        } catch (_) {}
        startLobby();
      },
      onForcedModal: (id) => { try { if (id === 'SESSION_KICK' || id === 'SESSION_EXPIRE') { _lastForcedModalId = id; _lastForcedAt = Date.now(); } } catch (_) {} },
    });
    const selfId = r.sessionId;
    const pname = (LS && LS.getItem) ? LS.getItem('name', 'Hero') : 'Hero';
    try { statusEl && (statusEl.textContent = `Connected | roomId=${r.id} | you=${pname} (${String(selfId).slice(0,6)})`); } catch (_) {}
    try { OverlayManager && OverlayManager.dismiss && OverlayManager.dismiss('LOBBY_MODAL'); } catch (_) {}
    setRoute && setRoute(APP_STATES && APP_STATES.ROOM);
  }

  return { startLobby, leaveRoomToLobby, afterJoin };
}
