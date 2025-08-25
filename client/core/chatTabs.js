// Tabbed chat UI (JS-only, reusable)
// Exports: createChatTabs({ mode: 'lobby' | 'game', onJoinGame(roomId), onOpenLink(href) })
// - Lobby tabs: Lobby / Whisper / News / Games / Server (read-only: News, Games, Server)
// - Game tabs: Game / Whisper / Server (read-only: Server)
// - Search: clicking the magnifier filters current tab to lines containing the input text; click with empty text clears filter

export function createChatTabs({ mode = 'lobby', onJoinGame, onOpenLink } = {}) {
  const tabs = (mode === 'lobby')
    ? ['Lobby', 'Whisper', 'News', 'Games', 'Server']
    : ['Game', 'Whisper', 'Server'];
  const readOnlyTabs = new Set((mode === 'lobby') ? ['News', 'Games', 'Server'] : ['Server']);

  // Root container
  const el = document.createElement('div');
  el.style.marginTop = '12px';
  el.style.background = 'var(--ui-bg)';
  el.style.border = '1px solid var(--control-border)';
  el.style.borderRadius = '6px';
  el.style.padding = '8px';

  // Tabs row
  const tabsRow = document.createElement('div');
  tabsRow.style.display = 'flex';
  tabsRow.style.gap = '6px';
  tabsRow.style.marginBottom = '6px';
  el.appendChild(tabsRow);

  // Messages area
  const list = document.createElement('div');
  list.style.maxHeight = '220px';
  list.style.overflowY = 'auto';
  list.style.background = 'rgba(0,0,0,0.2)';
  list.style.border = '1px solid var(--control-border)';
  list.style.borderRadius = '4px';
  list.style.padding = '6px';
  el.appendChild(list);

  // Input row
  const inputRow = document.createElement('div');
  inputRow.style.display = 'flex';
  inputRow.style.alignItems = 'center';
  inputRow.style.gap = '6px';
  inputRow.style.marginTop = '6px';
  el.appendChild(inputRow);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type message…';
  input.style.flex = '1';

  const searchBtn = document.createElement('button');
  searchBtn.textContent = '🔎';
  searchBtn.title = 'Filter current tab by text';

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';

  inputRow.appendChild(input);
  inputRow.appendChild(searchBtn);
  inputRow.appendChild(sendBtn);

  // State
  const messages = new Map();
  tabs.forEach(t => messages.set(t, []));
  let currentTab = tabs[0];
  let filterTerm = '';
  let searchMode = false;

  // Helpers
  function isReadOnly(tab) { return readOnlyTabs.has(tab); }

  function renderTabs() {
    tabsRow.innerHTML = '';
    tabs.forEach(t => {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.padding = '4px 8px';
      b.style.border = '1px solid var(--control-border)';
      b.style.background = (t === currentTab) ? 'rgba(100,150,220,0.25)' : 'rgba(0,0,0,0.2)';
      b.style.color = 'var(--ui-fg)';
      b.onclick = () => switchTo(t);
      tabsRow.appendChild(b);
    });
  }

  function renderMessage(container, msg) {
    if (typeof msg === 'string') { container.textContent = msg; return; }
    if (Array.isArray(msg)) {
      msg.forEach(seg => {
        const span = document.createElement('span');
        span.textContent = String(seg?.text || '');
        const href = seg?.href; const joinRoomId = seg?.joinRoomId;
        if (href || joinRoomId) {
          span.style.textDecoration = 'underline';
          span.style.cursor = 'pointer';
          span.style.color = '#6cf';
          span.addEventListener('click', () => {
            try {
              if (href) {
                if (typeof onOpenLink === 'function') onOpenLink(href); else window.open(href, '_blank');
              } else if (joinRoomId && typeof onJoinGame === 'function') {
                onJoinGame(joinRoomId);
              }
            } catch (_) {}
          });
        }
        container.appendChild(span);
      });
      return;
    }
    // Fallback
    container.textContent = String(msg);
  }

  function lineIncludes(msg, term) {
    if (!term) return true;
    const t = term.toLowerCase();
    if (typeof msg === 'string') return msg.toLowerCase().includes(t);
    if (Array.isArray(msg)) return msg.some(seg => String(seg?.text || '').toLowerCase().includes(t));
    return false;
  }

  function renderList() {
    list.innerHTML = '';
    const arr = messages.get(currentTab) || [];
    arr.forEach(msg => {
      if (!lineIncludes(msg, filterTerm)) return;
      const div = document.createElement('div');
      renderMessage(div, msg);
      list.appendChild(div);
    });
    list.scrollTop = list.scrollHeight;
  }

  function updateReadOnlyUI() {
    const ro = isReadOnly(currentTab);
    input.disabled = ro;
    sendBtn.disabled = ro;
    input.placeholder = ro ? 'Read-only' : 'Type message…';
  }

  function switchTo(tab) {
    if (!tabs.includes(tab)) return;
    currentTab = tab;
    // Exiting search mode when switching tabs makes filtering less confusing
    if (searchMode) disableSearchMode();
    updateReadOnlyUI();
    renderTabs();
    renderList();
  }

  function appendMessage(tab, msg) {
    const t = tabs.includes(tab) ? tab : currentTab;
    messages.get(t).push(msg);
    if (t === currentTab) renderList();
  }

  function clear(tab) {
    if (!tabs.includes(tab)) return;
    messages.set(tab, []);
    if (tab === currentTab) renderList();
  }

  function filter(text) {
    filterTerm = String(text || '').trim();
    renderList();
  }

  // Search mode helpers (live-as-you-type while active)
  let __onLiveInput;
  function enableSearchMode() {
    if (searchMode) return;
    searchMode = true;
    searchBtn.style.background = 'rgba(100,150,220,0.25)';
    searchBtn.title = 'Exit search (Esc)';
    __onLiveInput = () => filter(input.value || '');
    input.addEventListener('input', __onLiveInput);
    // Start filtering immediately with current text
    filter(input.value || '');
  }
  function disableSearchMode() {
    if (!searchMode) return;
    searchMode = false;
    searchBtn.style.background = '';
    searchBtn.title = 'Filter current tab by text';
    try { if (__onLiveInput) input.removeEventListener('input', __onLiveInput); } catch (_) {}
    __onLiveInput = null;
    filter('');
  }

  // Wire inputs
  searchBtn.onclick = () => {
    if (!searchMode) enableSearchMode(); else disableSearchMode();
  };
  sendBtn.onclick = () => {
    if (isReadOnly(currentTab)) return;
    const msg = (input.value || '').trim();
    if (!msg) return;
    // Stub: echo locally. Integration will hook network later.
    appendMessage(currentTab, `You: ${msg}`);
    input.value = '';
    if (searchMode) disableSearchMode();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchMode) { e.stopPropagation(); disableSearchMode(); }
      return;
    }
    if (e.key === 'Enter') sendBtn.click();
  });

  // Initial render
  renderTabs();
  updateReadOnlyUI();
  renderList();

  // Public API
  return {
    el,
    switchTo,
    appendMessage,
    clear,
    filter,
    get currentTab() { return currentTab; },
    get tabs() { return [...tabs]; },
  };
}
