// Room UI helper module extracted from main.js
// Holds UI refs and logic related to Room screen rendering and chat.
import { showPlayerContextMenu } from './playerContextMenu.js';
import * as LS from '../localStorage.js';

let _getRoom = null;
let roomPlayersEl = null;
let roomChatListEl = null; // legacy fallback list
let roomChatInputEl = null; // reserved for future
let roomReadyBtn = null;
let roomUIBound = false;
let roomChat = null; // tabbed chat component if present

export function configureRoomUi({ getRoom }) {
  _getRoom = typeof getRoom === 'function' ? getRoom : () => null;
}

export function resetRoomUiBinding() { roomUIBound = false; }

export function setRoomReadyBtn(btn) { roomReadyBtn = btn; }
export function setRoomPlayersEl(el) { roomPlayersEl = el; }
export function setRoomChat(chat) { roomChat = chat; }

export function setReadyButtonUI(isReady) {
  if (!roomReadyBtn) return;
  roomReadyBtn.dataset.ready = isReady ? 'true' : 'false';
  roomReadyBtn.textContent = isReady ? '☑ Ready' : '☐ Ready';
}

export function bindRoomUIEventsOnce() {
  const room = _getRoom ? _getRoom() : null;
  if (!room || roomUIBound) return;
  roomUIBound = true;
  try {
    room.state.players.onAdd(() => {
      renderRoomPlayers();
    });
    room.state.players.onRemove(() => {
      renderRoomPlayers();
    });
  } catch (_) {}
  try {
    room.state.log.onAdd((value) => {
      appendChatLine(String(value));
    });
  } catch (_) {}
}

export function renderRoomPlayers() {
  const room = _getRoom ? _getRoom() : null;
  if (!roomPlayersEl || !room) return;
  try {
    roomPlayersEl.innerHTML = '';
    room.state.players.forEach((p, id) => {
      const line = document.createElement('div');
      const nm = p.name || 'Hero';
      const off = p.online === false ? ' (offline)' : '';
      // Compose name span to support context menu
      const nameSpan = document.createElement('span');
      nameSpan.textContent = nm;
      try { nameSpan.setAttribute('data-player-name', nm); } catch (_) {}
      nameSpan.style.textDecoration = 'underline';
      nameSpan.style.cursor = 'context-menu';
      nameSpan.style.color = 'var(--ui-link, #6cf)';
      // Right-click to open player context menu
      nameSpan.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        const selfName = String(LS.getItem('name', '') || '').trim();
        showPlayerContextMenu({
          x: e.clientX,
          y: e.clientY,
          name: nm,
          id: id,
          selfName,
          onWhisper: (display) => { try { if (roomChat && typeof roomChat.whisperTo === 'function') roomChat.whisperTo(display); } catch (_) {} },
        });
      });

      line.appendChild(nameSpan);
      const suffix = document.createElement('span');
      suffix.textContent = off;
      line.appendChild(suffix);
      roomPlayersEl.appendChild(line);
    });
  } catch (_) {}
}

export function getPlayersSnapshot() {
  const arr = [];
  try {
    const room = _getRoom ? _getRoom() : null;
    if (!room || !room.state || !room.state.players) return arr;
    room.state.players.forEach((p, id) => {
      arr.push({ id, name: p?.name || 'Hero', ready: !!p?.ready, online: p?.online !== false });
    });
  } catch (_) {}
  return arr;
}

export function refreshRoomChat() {
  const room = _getRoom ? _getRoom() : null;
  if (!room) return;
  try {
    const arr = room.state.log || [];
    const start = Math.max(0, arr.length - 100);
    if (roomChat && typeof roomChat.clear === 'function') {
      roomChat.clear('Game');
    } else if (roomChatListEl) {
      roomChatListEl.innerHTML = '';
    }
    for (let i = start; i < arr.length; i++) {
      appendChatLine(String(arr[i]));
    }
  } catch (_) {}
}

export function appendChatLine(line) {
  try {
    if (roomChat && typeof roomChat.appendMessage === 'function') {
      roomChat.appendMessage('Game', String(line));
      return;
    }
  } catch (_) {}
  if (!roomChatListEl) return;
  const div = document.createElement('div');
  div.textContent = String(line);
  roomChatListEl.appendChild(div);
  roomChatListEl.scrollTop = roomChatListEl.scrollHeight;
}
