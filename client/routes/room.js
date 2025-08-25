// ROOM route module — extracted from main.js without behavior changes
// Registers the ROOM screen with the micro router and wires room UI.

import OverlayManager, { PRIORITY } from '../core/overlayManager.js';
import { getAccessToken } from '../core/auth/supabaseAuth.js';
import { createChatTabs } from '../core/chatTabs.js';
import { presentRoomPromptPassword } from '../modals/roomPromptPassword.js';
import * as LS from '../core/localStorage.js';
import { ensureBanner } from '../core/ui/banner.js';

export function registerRoomRoute({ makeScreen, APP_STATES, joinById, afterJoin, sendRoomMessage, leaveRoomToLobby, setReadyButtonUI, appendChatLine, bindRoomUIEventsOnce, renderRoomPlayers, refreshRoomChat, setRefs }) {
  makeScreen(APP_STATES.ROOM, (el) => {
    // Render Room UI inside an overlay so it appears above the shade/canvas
    el.innerHTML = '';
    el.update = () => {
      try { OverlayManager.present({ id: 'ROOM_MODAL', priority: PRIORITY.MEDIUM, text: 'Room', actions: [], blockInput: true, external: true }); } catch (_) {}
      try { ensureBanner(); window.queueBanner('Room', 1); } catch (_) {}
      const overlay = document.getElementById('overlay');
      const content = overlay ? overlay.querySelector('#overlay-content') : null;
      if (!content) return;
      content.innerHTML = '';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      const backBtn = document.createElement('button');
      backBtn.textContent = '← Lobby';
      backBtn.style.marginRight = '8px';
      backBtn.onclick = () => { try { leaveRoomToLobby(); } catch (_) {} };
      header.appendChild(backBtn);
      const title = document.createElement('div');
      title.textContent = 'Room';
      header.appendChild(title);
      const roomReadyBtn = document.createElement('button');
      setRefs.setRoomReadyBtn(roomReadyBtn);
      setReadyButtonUI(false); // default to not ready on room entry
      roomReadyBtn.onclick = () => {
        const now = roomReadyBtn.dataset.ready !== 'true';
        setReadyButtonUI(now);
        try { sendRoomMessage('setReady', { ready: now }); } catch (_) {}
        if (now) { try { appendChatLine('You are ready'); } catch (_) {} }
        if (!now) { try { appendChatLine('You are not ready'); } catch (_) {} }
      };
      header.appendChild(roomReadyBtn);

      const players = document.createElement('div');
      players.id = 'room-players';
      const playersTitle = document.createElement('div');
      playersTitle.textContent = 'Players';
      playersTitle.style.marginTop = '8px';
      const roomPlayersEl = document.createElement('div');
      roomPlayersEl.id = 'room-players-list';
      setRefs.setRoomPlayersEl(roomPlayersEl);
      // Tabbed chat UI (Room/Game)
      const roomChat = createChatTabs({
        mode: 'game',
        onJoinGame: async (roomId) => {
          try {
            const playerName = LS.getItem('name', 'Hero');
            const rj = await joinById(String(roomId), { name: playerName, access_token: await getAccessToken() });
            await afterJoin(rj);
          } catch (e) {
            const msg = (e && (e.message || e)) + '';
            if (msg.includes('password')) {
              presentRoomPromptPassword({
                roomName: String(roomId),
                onSubmit: async (pwd) => {
                  try {
                    const rj = await joinById(String(roomId), { name: LS.getItem('name', 'Hero'), roomPass: pwd || '', access_token: await getAccessToken() });
                    await afterJoin(rj);
                    return true;
                  } catch (err) {
                    const em = (err && (err.message || err)) + '';
                    if (em.includes('Invalid password')) return false;
                    throw new Error(typeof em === 'string' ? em : 'Join failed');
                  }
                },
                onCancel: () => {}
              });
            }
          }
        },
        onOpenLink: (href) => { try { window.open(href, '_blank'); } catch (_) {} }
      });
      setRefs.setRoomChat(roomChat);

      content.appendChild(header);
      content.appendChild(players);
      players.appendChild(playersTitle);
      players.appendChild(roomPlayersEl);
      content.appendChild(roomChat.el);

      try { bindRoomUIEventsOnce(); } catch (_) {}
      try { renderRoomPlayers(); } catch (_) {}
      try { refreshRoomChat(); } catch (_) {}
    };
  });
}
