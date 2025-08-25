// LOBBY route module — extracted from main.js without behavior changes
// Registers the LOBBY screen UI in an overlay, list of rooms, create room flow, and chat tabs.

import OverlayManager, { PRIORITY } from '../core/overlayManager.js';
import { createChatTabs } from '../core/chatTabs.js';
import { presentRoomCreateModal } from '../modals/roomCreate.js';
import { presentRoomPromptPassword } from '../modals/roomPromptPassword.js';
import * as LS from '../core/localStorage.js';
import { deriveGameId } from '../core/util/deriveGameId.js';

let lobbyPollId = null;
let roomsListEl = null;
let createRoomBtn = null;
let lobbyChat = null;

export function stopLobbyPolling() { if (lobbyPollId) { clearInterval(lobbyPollId); lobbyPollId = null; } }

export function registerLobbyRoute({ makeScreen, APP_STATES, client, afterJoin }) {
  function renderRooms(rooms) {
    if (!roomsListEl) return;
    roomsListEl.innerHTML = '';
    rooms.forEach((r) => {
      const row = document.createElement('div');
      const meta = r.metadata || {};
      row.textContent = `${meta.name || r.roomId} | ${r.clients}/${meta.maxPlayers || r.maxClients || '?' }${meta.private ? ' (private)' : ''}`;
      const btn = document.createElement('button');
      btn.textContent = 'Join';
      btn.style.marginLeft = '8px';
      btn.onclick = async () => {
        const playerName = LS.getItem('name', '') || prompt('Name?') || 'Hero';
        if (meta.private) {
          presentRoomPromptPassword({
            roomName: meta.name || r.roomId,
            onSubmit: async (pwd) => {
              try {
                const rj = await client.joinById(r.roomId, { name: playerName, roomPass: pwd || '' });
                await afterJoin(rj);
                return true; // close modal
              } catch (e) {
                const msg = (e && (e.message || e)) + '';
                if (msg.includes('Invalid password') || msg.includes('Room requires password')) {
                  return false; // wrong password, keep modal open
                }
                throw new Error(typeof msg === 'string' ? msg : 'Join failed');
              }
            },
            onCancel: () => {}
          });
        } else {
          try {
            const rj = await client.joinById(r.roomId, { name: playerName });
            await afterJoin(rj);
          } catch (e) { console.warn('join failed', e); }
        }
      };
      row.appendChild(btn);
      roomsListEl.appendChild(row);
    });
  }

  function startLobbyPolling() {
    if (lobbyPollId) return;
    const fetchRooms = async () => {
      try {
        const list = await client.getAvailableRooms('nethack');
        renderRooms(list || []);
      } catch (e) {
        console.warn('getAvailableRooms failed', e);
      }
    };
    fetchRooms();
    lobbyPollId = setInterval(fetchRooms, 4000);
  }

  makeScreen(APP_STATES.LOBBY, (el) => {
    // Only present Lobby overlay when this route becomes active
    el.innerHTML = '';
    el.update = () => {
      try { OverlayManager.present({ id: 'LOBBY_MODAL', priority: PRIORITY.MEDIUM, text: 'Lobby', actions: [], blockInput: true, external: true }); } catch (_) {}
      const overlay = document.getElementById('overlay');
      const content = overlay ? overlay.querySelector('#overlay-content') : null;
      if (content) {
        content.innerHTML = '';
        const header = document.createElement('div');
        header.textContent = 'Lobby';
        const actions = document.createElement('div');
        createRoomBtn = document.createElement('button');
        createRoomBtn.textContent = 'Create Private Room';
        actions.appendChild(createRoomBtn);
        roomsListEl = document.createElement('div');
        roomsListEl.id = 'lobby-rooms';
        roomsListEl.style.marginTop = '8px';
        // Tabbed chat UI (Lobby)
        lobbyChat = createChatTabs({
          mode: 'lobby',
          onJoinGame: async (roomId) => {
            try {
              const playerName = LS.getItem('name', 'Hero');
              const rj = await client.joinById(String(roomId), { name: playerName });
              await afterJoin(rj);
            } catch (e) {
              const msg = (e && (e.message || e)) + '';
              if (msg.includes('password')) {
                presentRoomPromptPassword({
                  roomName: String(roomId),
                  onSubmit: async (pwd) => {
                    try {
                      const rj = await client.joinById(String(roomId), { name: LS.getItem('name', 'Hero'), roomPass: pwd || '' });
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
        content.appendChild(header);
        content.appendChild(actions);
        content.appendChild(roomsListEl);
        content.appendChild(lobbyChat.el);
        createRoomBtn.onclick = () => {
          presentRoomCreateModal({
            onSubmit: async ({ name, turnLength, roomPass, maxPlayers }) => {
              const cname = LS.getItem('name', 'Hero');
              try {
                const newRoom = await client.create('nethack', {
                  name,
                  turnLength,
                  roomPass,
                  maxPlayers,
                  private: !!roomPass,
                  hostName: cname,
                  gameId: deriveGameId(name, cname),
                });
                await afterJoin(newRoom);
              } catch (e) {
                console.warn('create failed', e);
              }
            }
          });
        };
      }
      startLobbyPolling();
    };
  });
}
