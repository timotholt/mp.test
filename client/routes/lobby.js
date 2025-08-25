// LOBBY route module — extracted from main.js without behavior changes
// Registers the LOBBY screen UI in an overlay, list of rooms, create room flow, and chat tabs.

import OverlayManager, { PRIORITY } from '../core/overlayManager.js';
import { getAccessToken } from '../core/auth/supabaseAuth.js';
import { createChatTabs } from '../core/chatTabs.js';
import { presentRoomCreateModal } from '../modals/roomCreate.js';
import { presentRoomPromptPassword } from '../modals/roomPromptPassword.js';
import * as LS from '../core/localStorage.js';
import { deriveGameId } from '../core/util/deriveGameId.js';
import { ensureBanner } from '../core/ui/banner.js';

let lobbyPollId = null;
let lobbyChat = null;
let lobbyRoom = null;

// Panels state
let gamesPanel = null;   // { el, setData, setFilter, selectTab }
let playersPanel = null; // { el, setData, setFilter, selectTab }

// In-memory caches
let roomsCache = [];
let playersCache = [];

// Local storage helpers for friends/blocked/recent
function readJSON(key, fallback) {
  try { const v = LS.getItem(key, null); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
}
function writeJSON(key, val) { try { LS.setItem(key, JSON.stringify(val)); } catch (_) {} }
function getFriendsSet() { return new Set(readJSON('friends:set', [])); }
function getBlockedSet() { return new Set(readJSON('blocked:set', [])); }
function getRecentMap() { return new Map(Object.entries(readJSON('recent:players', {}))); }
function markRecent(userId) {
  const m = getRecentMap();
  m.set(String(userId), Date.now());
  writeJSON('recent:players', Object.fromEntries(m));
}
function toggleSet(storageKey, userId, on) {
  const arr = readJSON(storageKey, []);
  const s = new Set(arr);
  const id = String(userId);
  if (on) s.add(id); else s.delete(id);
  writeJSON(storageKey, Array.from(s));
}

export function stopLobbyPolling() { if (lobbyPollId) { clearInterval(lobbyPollId); lobbyPollId = null; } }

export function registerLobbyRoute({ makeScreen, APP_STATES, client, afterJoin }) {
  // Join room helper (used by Games panel)
  async function joinRoomById(r) {
    const meta = r.metadata || {};
    const playerName = LS.getItem('name', '') || prompt('Name?') || 'Hero';
    if (meta.private) {
      presentRoomPromptPassword({
        roomName: meta.name || r.roomId,
        onSubmit: async (pwd) => {
          try {
            const rj = await client.joinById(r.roomId, { name: playerName, roomPass: pwd || '', access_token: await getAccessToken() });
            await afterJoin(rj);
            return true; // close modal
          } catch (e) {
            const msg = (e && (e.message || e)) + '';
            if (msg.includes('Invalid password') || msg.includes('Room requires password')) return false;
            throw new Error(typeof msg === 'string' ? msg : 'Join failed');
          }
        },
        onCancel: () => {}
      });
    } else {
      try {
        const rj = await client.joinById(r.roomId, { name: playerName, access_token: await getAccessToken() });
        await afterJoin(rj);
      } catch (e) { console.warn('join failed', e); }
    }
  }

  // Basic tabbed panel factory (minimal styling, glass-compatible)
  function createTabbedPanel({ title, tabs, onRender }) {
    const root = document.createElement('div');
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    // Match chat: tabs should touch the list (no outer gap/padding/border)
    root.style.gap = '0';
    root.style.background = 'transparent';
    root.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
    root.style.border = '0';
    root.style.borderRadius = '0';
    root.style.padding = '0';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';
    header.style.marginBottom = '0';
    const htitle = document.createElement('div');
    htitle.textContent = title;
    htitle.style.fontWeight = '600';
    htitle.style.flex = '0 0 auto';
    const tabsBar = document.createElement('div');
    tabsBar.style.display = 'flex';
    tabsBar.style.gap = '6px';
    tabsBar.style.flex = '0 0 auto';
    // No top border and no bottom spacing, so tabs sit directly on the list
    tabsBar.style.marginBottom = '0';
    tabsBar.style.borderTop = '0';
    const searchWrap = document.createElement('div');
    // Chat-like input with left icon inside the control
    searchWrap.style.marginLeft = '0';
    searchWrap.style.position = 'relative';
    searchWrap.style.display = 'flex';
    searchWrap.style.alignItems = 'center';
    searchWrap.style.flex = '1';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search…';
    // Permanently visible search input
    searchInput.style.display = 'inline-block';
    searchInput.style.height = '40px';
    searchInput.style.lineHeight = '40px';
    searchInput.style.background = 'transparent';
    searchInput.style.color = 'var(--sf-tip-fg, #fff)';
    searchInput.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    searchInput.style.borderRadius = '8px';
    // padding-left: icon-left (0) + icon-width (32px) + desired gap (0.5rem)
    searchInput.style.padding = '0 10px 0 calc(32px + 0.5rem)';
    searchInput.style.boxShadow = 'inset 0 0 12px rgba(40,100,200,0.10)';
    searchInput.style.flex = '1';
    searchInput.style.width = '100%';
    const searchBtn = document.createElement('button');
    searchBtn.title = 'Search';
    // Left icon positioned inside the input
    searchBtn.style.position = 'absolute';
    searchBtn.style.left = '0';
    searchBtn.style.top = '50%';
    searchBtn.style.transform = 'translateY(-50%)';
    searchBtn.style.width = '32px';
    searchBtn.style.height = '32px';
    searchBtn.style.display = 'inline-flex';
    searchBtn.style.alignItems = 'center';
    searchBtn.style.justifyContent = 'center';
    searchBtn.style.background = 'transparent';
    searchBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    searchBtn.style.borderRadius = '8px';
    searchBtn.style.boxSizing = 'border-box';
    searchBtn.style.color = 'var(--ui-bright, rgba(190,230,255,0.90))';
    searchBtn.style.cursor = 'pointer';
    searchBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(searchBtn);
    header.appendChild(htitle);
    header.appendChild(tabsBar);
    // Search box belongs at the bottom; do not place in header

    const list = document.createElement('div');
    list.style.flex = '1 1 auto';
    list.style.minHeight = '0';
    list.style.maxHeight = '100%';
    list.style.overflowY = 'auto';
    // Chat-like surface
    list.style.background = 'linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
    list.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    list.style.borderRadius = '4px 4px 0px 0px';
    list.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18))';
    list.style.padding = '6px';
    try { list.classList.add('ui-glass-scrollbar'); } catch (_) {}

    root.appendChild(header);
    root.appendChild(list);
    // Bottom input row (chat-like), hosting the search control
    const inputRow = document.createElement('div');
    inputRow.style.display = 'flex';
    inputRow.style.alignItems = 'center';
    inputRow.style.gap = '8px';
    inputRow.style.minHeight = '46px';
    inputRow.style.borderBottom = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    inputRow.style.borderLeft = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    inputRow.style.borderRight = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    inputRow.style.borderRadius = '0px 0px 6px 6px';
    inputRow.appendChild(searchWrap);
    root.appendChild(inputRow);

    let activeTab = tabs[0]?.key;
    let filterText = '';
    let data = [];

    function renderTabs() {
      tabsBar.innerHTML = '';
      tabs.forEach(t => {
        const b = document.createElement('button');
        b.textContent = t.label;
        b.style.padding = '4px 8px';
        // Chat tabs style: no bottom border, only top corners rounded
        b.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
        b.style.borderBottom = '0';
        b.style.borderRadius = '0';
        b.style.borderTopLeftRadius = '6px';
        b.style.borderTopRightRadius = '6px';
        const isActive = (t.key === activeTab);
        b.style.background = isActive ? 'rgba(120,170,255,0.32)' : 'rgba(255,255,255,0.06)';
        b.style.color = isActive ? 'var(--sf-tip-fg, #fff)' : 'var(--ui-bright, rgba(190,230,255,0.98))';
        b.style.textShadow = isActive ? '0 0 6px rgba(140,190,255,0.75)' : '';
        b.onclick = () => { activeTab = t.key; onRender({ listEl: list, tab: activeTab, data, filterText }); renderTabs(); };
        tabsBar.appendChild(b);
      });
    }

    function setData(next) { data = Array.isArray(next) ? next : []; onRender({ listEl: list, tab: activeTab, data, filterText }); }
    function setFilter(f) { filterText = (f || '').toLowerCase(); onRender({ listEl: list, tab: activeTab, data, filterText }); }
    function selectTab(k) { if (tabs.some(t => t.key === k)) { activeTab = k; onRender({ listEl: list, tab: activeTab, data, filterText }); renderTabs(); } }

    // Search behavior: always-on live filter; Esc clears
    searchBtn.onclick = () => { try { searchInput.focus(); } catch (_) {} };
    searchInput.addEventListener('input', () => setFilter(searchInput.value || ''));
    searchInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        searchInput.value = '';
        setFilter('');
      }
    });

    renderTabs();
    return { el: root, setData, setFilter, selectTab };
  }

  function startLobbyPolling() {
    if (lobbyPollId) return;
    const fetchRooms = async () => {
      try {
        const list = await client.getAvailableRooms('nethack');
        roomsCache = list || [];
        if (gamesPanel) gamesPanel.setData(roomsCache);
      } catch (e) {
        console.warn('getAvailableRooms failed', e);
      }
    };
    fetchRooms();
    lobbyPollId = setInterval(fetchRooms, 4000);
  }

  async function startLobbyRealtime() {
    if (lobbyRoom) return true;
    try {
      const access_token = await getAccessToken();
      // Join or create a singleton lobby room; allow guests too
      lobbyRoom = await client.joinOrCreate('lobby', { access_token });
      // Stop polling once realtime feed is active
      stopLobbyPolling();
      try {
        lobbyRoom.onMessage('roomsList', (rooms) => {
          roomsCache = Array.isArray(rooms) ? rooms : [];
          if (gamesPanel) gamesPanel.setData(roomsCache);
        });
      } catch (_) {}
      // Realtime players feed -> update cache, mark recent, render panel
      try {
        lobbyRoom.onMessage('playersList', (players) => {
          playersCache = Array.isArray(players) ? players : [];
          playersCache.forEach(p => { if (p && p.id) markRecent(p.id); });
          if (playersPanel) playersPanel.setData(playersCache);
        });
      } catch (_) {}
      lobbyRoom.onLeave(() => { lobbyRoom = null; /* resume polling if needed */ startLobbyPolling(); });
      return true;
    } catch (e) {
      // Fallback: keep polling
      console.warn('lobby realtime unavailable, using polling', e);
      return false;
    }
  }

  makeScreen(APP_STATES.LOBBY, (el) => {
    // Only present Lobby overlay when this route becomes active
    el.innerHTML = '';
    el.update = () => {
      try { OverlayManager.present({ id: 'LOBBY_MODAL', priority: PRIORITY.MEDIUM, text: 'Lobby', actions: [], blockInput: true, external: true }); } catch (_) {}
      try { ensureBanner(); window.queueBanner('Lobby', 1); } catch (_) {}
      const overlay = document.getElementById('overlay');
      const content = overlay ? overlay.querySelector('#overlay-content') : null;
      if (content) {
        content.innerHTML = '';
        // Add spacing around the lobby content; switch to '0 4rem' for left/right-only
        try {
          content.style.padding = '2rem 4rem 4rem 4rem';
          // Include padding within layout height to prevent bottom clipping of chat
          content.style.boxSizing = 'border-box';
        } catch (_) {}
        // Layout container: grid with 2 rows (top panels fixed to 40vh, bottom chat fills remainder) and 2 columns
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        // Top fixed height reduced by 2rem; bottom grows to fill remainder
        grid.style.gridTemplateRows = 'calc(40vh - 2rem) 1fr';
        // Horizontal gap 10px, vertical gap 1rem between panels and chat
        grid.style.columnGap = '10px';
        grid.style.rowGap = '1rem';
        grid.style.marginTop = '8px';
        // Fill viewport height minus content padding (2rem top + 4rem bottom = 6rem)
        grid.style.height = 'calc(100vh - 6rem)';

        // --- Games Panel ---
        gamesPanel = createTabbedPanel({
          title: '',
          tabs: [
            { key: 'all', label: 'All' },
            { key: 'yours', label: "Your Games" },
            { key: 'friends', label: "Friends' Games" },
            { key: 'create', label: 'Create Game' },
          ],
          onRender: ({ listEl, tab, data, filterText }) => {
            listEl.innerHTML = '';
            if (tab === 'create') {
              const info = document.createElement('div');
              info.textContent = 'Create a new room and invite friends';
              const btn = document.createElement('button');
              btn.textContent = 'Create Game';
              btn.style.marginTop = '8px';
              btn.onclick = () => {
                presentRoomCreateModal({
                  onSubmit: async ({ name, turnLength, roomPass, maxPlayers }) => {
                    const cname = LS.getItem('name', 'Hero');
                    try {
                      const newRoom = await client.create('nethack', {
                        name, turnLength, roomPass, maxPlayers,
                        private: !!roomPass,
                        hostName: cname,
                        gameId: deriveGameId(name, cname),
                        access_token: await getAccessToken(),
                      });
                      await afterJoin(newRoom);
                    } catch (e) {
                      console.warn('create failed', e);
                    }
                  }
                });
              };
              listEl.appendChild(info);
              listEl.appendChild(btn);
              return;
            }

            const friends = getFriendsSet();
            const you = (LS.getItem('name', '') || '').toLowerCase();
            const filtered = (data || []).filter(r => {
              const meta = r.metadata || {};
              const hay = [
                r.roomId,
                String(meta.name || ''),
                String(meta.hostName || ''),
                String(meta.gameId || ''),
              ].join(' ').toLowerCase();
              if (filterText && !hay.includes(filterText)) return false;
              if (tab === 'yours') {
                return String(meta.hostName || '').toLowerCase() === you;
              }
              if (tab === 'friends') {
                // Stub: friend of host
                const hostId = String(meta.hostId || meta.hostName || '').trim();
                // We don't have hostId yet; fall back to hostName match
                return friends.has(String(meta.hostName || '').trim());
              }
              return true;
            });
            if (!filtered.length) {
              const empty = document.createElement('div');
              empty.style.opacity = '0.7';
              empty.textContent = tab === 'yours' ? 'No games you host yet.' : (tab === 'friends' ? 'No friends hosting games.' : 'No games found.');
              listEl.appendChild(empty);
            }
            filtered.forEach((r) => {
              const meta = r.metadata || {};
              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.alignItems = 'center';
              row.style.justifyContent = 'space-between';
              row.style.padding = '6px 8px';
              row.style.border = '1px solid rgba(255,255,255,0.12)';
              row.style.borderRadius = '6px';
              row.style.margin = '4px 0';
              const label = document.createElement('div');
              label.textContent = `${meta.name || r.roomId}  |  ${r.clients}/${meta.maxPlayers || r.maxClients || '?' }${meta.private ? ' (private)' : ''}`;
              const btn = document.createElement('button');
              btn.textContent = 'Join';
              btn.onclick = () => joinRoomById(r);
              row.appendChild(label);
              row.appendChild(btn);
              listEl.appendChild(row);
            });
          }
        });

        // --- Players Panel ---
        playersPanel = createTabbedPanel({
          title: '',
          tabs: [
            { key: 'all', label: 'All' },
            { key: 'friends', label: 'Friends' },
            { key: 'recent', label: 'Recent' },
            { key: 'blocked', label: 'Blocked' },
          ],
          onRender: ({ listEl, tab, data, filterText }) => {
            listEl.innerHTML = '';
            const friends = getFriendsSet();
            const blocked = getBlockedSet();
            const recent = getRecentMap();
            let filtered = (data || []).filter(p => p && p.id);
            filtered = filtered.filter(p => {
              const hay = `${p.id} ${p.name || ''}`.toLowerCase();
              if (filterText && !hay.includes(filterText)) return false;
              if (tab === 'friends') return friends.has(String(p.id)) || friends.has(String(p.name || ''));
              if (tab === 'blocked') return blocked.has(String(p.id)) || blocked.has(String(p.name || ''));
              if (tab === 'recent') return recent.has(String(p.id));
              return true;
            });
            if (!filtered.length) {
              const empty = document.createElement('div');
              empty.style.opacity = '0.7';
              const msg = { all: 'No players online.', friends: 'No friends online yet.', recent: 'No recent players yet.', blocked: 'No blocked players.' }[tab] || 'Nothing here.';
              empty.textContent = msg;
              listEl.appendChild(empty);
              return;
            }
            filtered.forEach(p => {
              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.alignItems = 'center';
              row.style.justifyContent = 'space-between';
              row.style.padding = '6px 8px';
              row.style.border = '1px solid rgba(255,255,255,0.12)';
              row.style.borderRadius = '6px';
              row.style.margin = '4px 0';
              const label = document.createElement('div');
              const when = recent.get(String(p.id)) || 0;
              const ago = when ? `${Math.max(1, Math.round((Date.now() - when)/1000))}s ago` : '';
              label.textContent = `${p.name || 'Guest'}  ${ago ? '· ' + ago : ''}`;
              const actions = document.createElement('div');
              actions.style.display = 'flex';
              actions.style.gap = '6px';
              const friendBtn = document.createElement('button');
              const isF = friends.has(String(p.id)) || friends.has(String(p.name || ''));
              friendBtn.textContent = isF ? 'Unfriend' : 'Add Friend';
              friendBtn.onclick = () => {
                toggleSet('friends:set', p.id, !isF);
                if (p.name) toggleSet('friends:set', p.name, !isF);
                playersPanel.setData(playersCache);
              };
              const blockBtn = document.createElement('button');
              const isB = blocked.has(String(p.id)) || blocked.has(String(p.name || ''));
              blockBtn.textContent = isB ? 'Unblock' : 'Block';
              blockBtn.onclick = () => {
                toggleSet('blocked:set', p.id, !isB);
                if (p.name) toggleSet('blocked:set', p.name, !isB);
                playersPanel.setData(playersCache);
              };
              actions.appendChild(friendBtn);
              actions.appendChild(blockBtn);
              row.appendChild(label);
              row.appendChild(actions);
              listEl.appendChild(row);
            });
          }
        });

        // Place panels in grid
        gamesPanel.el.style.gridColumn = '1 / 2';
        gamesPanel.el.style.gridRow = '1 / 2';
        // Ensure the panel fills its grid track so its internal list can flex
        gamesPanel.el.style.height = '100%';
        playersPanel.el.style.gridColumn = '2 / 3';
        playersPanel.el.style.gridRow = '1 / 2';
        playersPanel.el.style.height = '100%';

        // --- Chat bottom ---
        lobbyChat = createChatTabs({
          mode: 'lobby',
          onJoinGame: async (roomId) => {
            try {
              const playerName = LS.getItem('name', 'Hero');
              const rj = await client.joinById(String(roomId), { name: playerName, access_token: await getAccessToken() });
              await afterJoin(rj);
            } catch (e) {
              const msg = (e && (e.message || e)) + '';
              if (msg.includes('password')) {
                presentRoomPromptPassword({
                  roomName: String(roomId),
                  onSubmit: async (pwd) => {
                    try {
                      const rj = await client.joinById(String(roomId), { name: LS.getItem('name', 'Hero'), roomPass: pwd || '', access_token: await getAccessToken() });
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
        const chatWrap = document.createElement('div');
        chatWrap.style.gridColumn = '1 / 3';
        chatWrap.style.gridRow = '2 / 3';
        // Chat fills the remaining space of the grid
        chatWrap.style.height = '100%';
        chatWrap.style.maxHeight = '100%';
        chatWrap.style.minHeight = '0';
        // We allow the bottom of the chat to be seen
        // chatWrap.style.overflow = 'hidden';
        // Let the chat component fill the fixed area without growing layout
        try {
          lobbyChat.el.style.height = '100%';
          lobbyChat.el.style.maxHeight = '100%';
          // Include padding/border within fixed height so the input row isn't clipped
          lobbyChat.el.style.boxSizing = 'border-box';
        } catch (_) {}
        chatWrap.appendChild(lobbyChat.el);

        grid.appendChild(gamesPanel.el);
        grid.appendChild(playersPanel.el);
        grid.appendChild(chatWrap);

        content.appendChild(grid);
      }
      // Prefer realtime; keep polling as a fallback
      startLobbyRealtime();
      startLobbyPolling();
      // Render initial cached data if any
      if (gamesPanel && roomsCache) gamesPanel.setData(roomsCache);
      if (playersPanel && playersCache) playersPanel.setData(playersCache);
    };
  });
}
