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
        startLobby();
      },
    });
    const selfId = r.sessionId;
    const pname = (LS && LS.getItem) ? LS.getItem('name', 'Hero') : 'Hero';
    try { statusEl && (statusEl.textContent = `Connected | roomId=${r.id} | you=${pname} (${String(selfId).slice(0,6)})`); } catch (_) {}
    try { OverlayManager && OverlayManager.dismiss && OverlayManager.dismiss('LOBBY_MODAL'); } catch (_) {}
    setRoute && setRoute(APP_STATES && APP_STATES.ROOM);
  }

  return { startLobby, leaveRoomToLobby, afterJoin };
}
