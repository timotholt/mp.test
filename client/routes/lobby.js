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
import { UI, createInputRow, createLeftIconInput, wireFocusHighlight, createTabsBar } from '../core/ui/controls.js';
import { showPlayerContextMenu } from '../core/ui/playerContextMenu.js';

let lobbyPollId = null;
let lobbyChat = null;
let lobbyRoom = null;

// Panels state
let gamesPanel = null;   // { el, setData, setFilter, selectTab }
let playersPanel = null; // { el, setData, setFilter, selectTab }
let playersUiTimer = null; // updates 'ago' text & dot tooltip without re-rendering

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
    const hasRoom = !!r.roomId;
    const gameId = r.gameId || meta.gameId || '';
    if (!hasRoom && gameId) {
      // Not currently loaded: load-on-demand by joining/creating the game room
      try {
        const rj = await client.joinOrCreate('nethack', { gameId, name: playerName, access_token: await getAccessToken() });
        await afterJoin(rj);
      } catch (e) { console.warn('joinOrCreate failed', e); }
      return;
    }
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
    const tabsCtl = createTabsBar({
      getKey: (t) => t.key,
      getLabel: (t) => t.label,
      onSelect: (key) => {
        activeTab = key;
        onRender({ listEl: list, tab: activeTab, data, filterText });
        tabsCtl.render({ tabs, activeKey: activeTab });
      },
    });
    // Create shared left-icon input for search (bottom row will host it)
    const { wrap: searchWrap, input: searchInput, btn: searchBtn } = createLeftIconInput({
      placeholder: 'Search…',
      marginLeft: '0',
      iconSvg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
    });
    try { searchWrap.setAttribute('data-name', 'panel-search-wrap'); } catch (_) {}
    // Make the search icon decorative only (no border, not focusable/clickable)
    try {
      searchBtn.title = '';
      searchBtn.style.border = '0';
      searchBtn.style.background = 'transparent';
      searchBtn.style.outline = 'none';
      searchBtn.style.boxShadow = 'none';
      searchBtn.style.cursor = 'default';
      searchBtn.style.pointerEvents = 'none';
      searchBtn.tabIndex = -1;
      searchBtn.setAttribute('aria-hidden', 'true');
    } catch (_) {}
    const hasTitle = !!String(title || '').trim();
    if (hasTitle) {
      header.appendChild(htitle);
    } else {
      // If no title, remove spacing so tabs start flush left (to match chat)
      header.style.gap = '0';
    }
    header.appendChild(tabsCtl.el);
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
    // Match chat: subtle outer glow on top/left/right; omit bottom to avoid glow overlap with input row
    const glowColor = 'var(--ui-surface-glow-color, rgba(120,170,255,0.33))';
    list.style.borderBottom = '0';
    list.style.boxShadow = `0 -2px 16px -6px ${glowColor}, -2px 0 16px -6px ${glowColor}, 2px 0 16px -6px ${glowColor}`;
    list.style.padding = '6px';
    try { list.classList.add('ui-glass-scrollbar'); } catch (_) {}

    root.appendChild(header);
    root.appendChild(list);
    // Bottom input row (chat-like), hosting the search control
    const inputRow = createInputRow({ dataName: 'panel-input-row' });
    inputRow.style.paddingLeft = '0.5rem';
    inputRow.appendChild(searchWrap);
    root.appendChild(inputRow);
    // Match chat input row: left/right/bottom glow only; crisp top border as separator
    try {
      inputRow.style.background = 'linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
      inputRow.style.boxShadow = `-2px 0 16px -6px ${glowColor}, 2px 0 16px -6px ${glowColor}, 0 2px 16px -6px ${glowColor}`;
      inputRow.style.borderTop = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    } catch (_) {}

    let activeTab = tabs[0]?.key;
    let filterText = '';
    let data = [];

    function renderTabs() {
      tabsCtl.render({ tabs, activeKey: activeTab });
    }

    function setData(next) { data = Array.isArray(next) ? next : []; onRender({ listEl: list, tab: activeTab, data, filterText }); }
    function setFilter(f) { filterText = (f || '').toLowerCase(); onRender({ listEl: list, tab: activeTab, data, filterText }); }
    function selectTab(k) { if (tabs.some(t => t.key === k)) { activeTab = k; onRender({ listEl: list, tab: activeTab, data, filterText }); renderTabs(); } }

    // Search behavior: always-on live filter; Esc clears (icon is decorative)
    searchBtn.onclick = null;
    searchInput.addEventListener('input', () => setFilter(searchInput.value || ''));
    searchInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        searchInput.value = '';
        setFilter('');
      }
    });
    // Focus styling: keep input borderless; highlight parent row instead
    wireFocusHighlight(searchInput, inputRow);

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
      try { window.lobbyRoom = lobbyRoom; } catch (_) {}
      // Stop polling once realtime feed is active
      stopLobbyPolling();
      // New: consume LobbyRoom Schema state
      try {
        lobbyRoom.onStateChange((state) => {
          // Map games state to existing UI shape
          try {
            const games = Array.from(state?.games || []);
            const mapped = games.map((g) => ({
              roomId: g?.roomId || '',
              clients: g?.clients | 0,
              maxClients: g?.maxPlayers | 0,
              isGameEntry: true,
              gameId: g?.gameId || '',
              metadata: {
                gameId: g?.gameId || '',
                name: g?.name || '',
                hostName: g?.hostName || '',
                private: !!g?.private,
                maxPlayers: g?.maxPlayers | 0,
              },
            }));
            roomsCache = mapped;
            if (gamesPanel) gamesPanel.setData(roomsCache);
          } catch (_) {}
          // Map players state to UI list
          try {
            const pl = [];
            const m = state?.players;
            if (m && typeof m.forEach === 'function') {
              m.forEach((p, id) => {
                const status = (p && typeof p.status === 'string') ? p.status : '';
                // Include pingMs for UI (Presence mirror updates this)
                const pingMs = (p && typeof p.pingMs === 'number') ? p.pingMs : 0;
                pl.push({ id, name: p?.name || 'Guest', status, pingMs });
              });
            }
            playersCache = pl;
            playersCache.forEach(p => { if (p && p.id) markRecent(p.id); });
            if (playersPanel) playersPanel.setData(playersCache);
          } catch (_) {}
        });
      } catch (_) {}
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
      // Reply to server-initiated ping for RTT measurement (lobby)
      try {
        lobbyRoom.onMessage('ping', (msg) => {
          try { lobbyRoom.send('pong', { t: (msg && msg.t) }); } catch (_) {}
        });
      } catch (_) {}
      lobbyRoom.onLeave(() => { lobbyRoom = null; try { window.lobbyRoom = null; } catch (_) {} /* resume polling if needed */ startLobbyPolling(); try { if (playersUiTimer) { clearInterval(playersUiTimer); playersUiTimer = null; } } catch (_) {} });
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
          // Let pointer events pass through empty gaps to the canvas; child panels remain interactive
          content.style.pointerEvents = 'none';
        } catch (_) {}
        // Layout container: grid with 2 rows (top panels fixed to 40vh, bottom chat fills remainder) and 2 columns
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        // Let gaps between items pass through to the canvas; panels will re-enable interaction
        grid.style.pointerEvents = 'none';
        grid.style.gridTemplateColumns = '2fr 1fr';
        // Top fixed height reduced by 2rem; bottom grows to fill remainder
        grid.style.gridTemplateRows = 'calc(40vh - 2rem) 1fr';
        // Horizontal gap 2.5rem, vertical gap 1rem between panels and chat
        grid.style.columnGap = '2.5rem';
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
        // Add IDs to Games panel search containers
        try {
          const gWrap = gamesPanel?.el?.querySelector('[data-name="panel-search-wrap"]');
          if (gWrap) gWrap.id = 'games-search-wrap';
          const gRow = gamesPanel?.el?.querySelector('[data-name="panel-input-row"]');
          if (gRow) gRow.id = 'games-search-row';
        } catch (_) {}

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
            const selfName = String(LS.getItem('name', '') || '').trim();
            let filtered = (data || []).filter(p => p && p.id);
            filtered = filtered.filter(p => {
              const hay = `${p.id} ${p.name || ''}`.toLowerCase();
              if (filterText && !hay.includes(filterText)) return false;
              if (tab === 'friends') return friends.has(String(p.id)) || friends.has(String(p.name || ''));
              if (tab === 'blocked') return blocked.has(String(p.id)) || blocked.has(String(p.name || ''));
              if (tab === 'recent') return recent.has(String(p.id));
              return true;
            });
            // Sort by presence (green -> yellow -> red -> unknown) then by name
            const statusOrder = (raw) => raw === 'green' ? 0 : (raw === 'yellow' ? 1 : (raw === 'red' ? 2 : 3));
            filtered.sort((a, b) => {
              const sa = statusOrder(String(a.status || '').toLowerCase());
              const sb = statusOrder(String(b.status || '').toLowerCase());
              if (sa !== sb) return sa - sb;
              const an = String(a.name || '').toLowerCase();
              const bn = String(b.name || '').toLowerCase();
              return an.localeCompare(bn);
            });
            if (!filtered.length) {
              const empty = document.createElement('div');
              empty.style.opacity = '0.7';
              const msg = { all: 'No players online.', friends: 'No friends online yet.', recent: 'No recent players yet.', blocked: 'No blocked players.' }[tab] || 'Nothing here.';
              empty.textContent = msg;
              listEl.appendChild(empty);
              return;
            }
            // Render each row as a 4-column grid: [dot | name | location | ping]
            filtered.forEach(p => {
              const row = document.createElement('div');
              // Grid layout to meet the 4-column spec
              row.style.display = 'grid';
              row.style.gridTemplateColumns = '24px 1fr auto auto';
              row.style.alignItems = 'center';
              row.style.columnGap = '8px';
              row.style.padding = '6px 8px';
              row.style.border = '1px solid rgba(255,255,255,0.12)';
              row.style.borderRadius = '6px';
              row.style.margin = '4px 0';

              // 1) Status dot (centered)
              const statusRaw = String(p.status || '').toLowerCase();
              const dot = document.createElement('span');
              dot.textContent = '●';
              const dotColor = statusRaw === 'green' ? '#4ade80' : (statusRaw === 'yellow' ? '#facc15' : (statusRaw === 'red' ? '#f87171' : 'rgba(255,255,255,0.5)'));
              dot.style.color = dotColor;
              dot.style.textAlign = 'center';
              dot.style.display = 'inline-block';
              dot.style.width = '100%';
              dot.setAttribute('data-dot-id', String(p.id));

              // 2) Player name (left)
              const nameSpan = document.createElement('span');
              nameSpan.textContent = p.name || 'Guest';
              nameSpan.style.textAlign = 'left';

              // 3) Location (right) — placeholder until real location is wired
              const loc = 'Lobby';
              const locSpan = document.createElement('span');
              locSpan.textContent = loc;
              locSpan.style.opacity = '0.8';
              locSpan.style.textAlign = 'right';

              // 4) Ping (right) — format per spec
              const pingSpan = document.createElement('span');
              const ms = Number(p.pingMs || 0);
              const isValid = Number.isFinite(ms) && ms >= 0;
              let pingText = '—';
              if (isValid) {
                if (ms <= 1000) {
                  pingText = `${Math.round(ms)} ms`;
                } else {
                  const secs = ms / 1000;
                  const prec = secs >= 10 ? 1 : 2; // keep at most 2 decimals
                  pingText = `${secs.toFixed(prec)} s`;
                }
              }
              pingSpan.textContent = pingText;
              pingSpan.style.textAlign = 'right';
              pingSpan.style.opacity = isValid ? '1' : '0.7';

              // Right-click context menu on player name (skip self)
              try {
                nameSpan.style.cursor = 'context-menu';
                nameSpan.addEventListener('contextmenu', (ev) => {
                  ev.preventDefault(); ev.stopPropagation();
                  const targetName = String(p.name || '').trim();
                  if (targetName && targetName === selfName) return; // don't show for yourself
                  showPlayerContextMenu({
                    x: ev.clientX,
                    y: ev.clientY,
                    name: targetName || p.id,
                    id: p.id,
                    selfName,
                    onWhisper: (display) => { try { if (lobbyChat && typeof lobbyChat.whisperTo === 'function') lobbyChat.whisperTo(display); } catch (_) {} },
                    onViewProfile: () => { try { ensureBanner(); window.queueBanner('Profile coming soon', 2); } catch (_) {} },
                    onFriendsChanged: () => { try { playersPanel.setData(playersCache); } catch (_) {} },
                    onBlockedChanged: () => { try { playersPanel.setData(playersCache); } catch (_) {} }
                  });
                });
              } catch (_) {}

              row.appendChild(dot);
              row.appendChild(nameSpan);
              row.appendChild(locSpan);
              row.appendChild(pingSpan);
              listEl.appendChild(row);
            });
          }
        });

        // Add IDs to Players panel search containers
        try {
          const pWrap = playersPanel?.el?.querySelector('[data-name="panel-search-wrap"]');
          if (pWrap) pWrap.id = 'players-search-wrap';
          const pRow = playersPanel?.el?.querySelector('[data-name="panel-input-row"]');
          if (pRow) pRow.id = 'players-search-row';
        } catch (_) {}

        // Place panels in grid
        gamesPanel.el.style.gridColumn = '1 / 2';
        gamesPanel.el.style.gridRow = '1 / 2';
        // Ensure the panel fills its grid track so its internal list can flex
        gamesPanel.el.style.height = '100%';
        // Re-enable interaction within the panel while parent container passes through
        gamesPanel.el.style.pointerEvents = 'auto';
        playersPanel.el.style.gridColumn = '2 / 3';
        playersPanel.el.style.gridRow = '1 / 2';
        playersPanel.el.style.height = '100%';
        playersPanel.el.style.pointerEvents = 'auto';

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
        chatWrap.style.pointerEvents = 'auto';
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

        grid.appendChild(chatWrap);

        grid.appendChild(gamesPanel.el);
        grid.appendChild(playersPanel.el);
        // chatWrap already appended above; avoid duplicate append

        content.appendChild(grid);
      }
      // Prefer realtime; keep polling as a fallback
      startLobbyRealtime();
      startLobbyPolling();
      // Render initial cached data if any
      if (gamesPanel && roomsCache) gamesPanel.setData(roomsCache);
      if (playersPanel && playersCache) playersPanel.setData(playersCache);
      // Removed 'ago' updater: players list now only shows dot, name, and location.
    };
  });
}
