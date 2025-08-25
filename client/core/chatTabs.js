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

  // Root container (glassmorphism via theme variables with fallbacks)
  const el = document.createElement('div');
  el.style.marginTop = '12px';
  el.style.background = 'linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
  el.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  el.style.borderRadius = '6px';
  el.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33)), var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18))';
  el.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
  el.style.color = 'var(--ui-bright, rgba(190,230,255,0.98))';
  // Let the chat fill its container's fixed height (e.g., lobby grid's chat row)
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.height = '100%';
  el.style.maxHeight = '100%';

  // Tabs row
  const tabsRow = document.createElement('div');
  tabsRow.style.display = 'flex';
  tabsRow.style.gap = '6px';
  tabsRow.style.marginBottom = '6px';
  el.appendChild(tabsRow);

  // Messages area (glass surface; flexible to fill remaining height)
  const list = document.createElement('div');
  list.style.flex = '1 1 auto';
  list.style.minHeight = '0';
  list.style.maxHeight = '100%';
  list.style.overflowY = 'auto';
  list.style.background = 'linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
  list.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  list.style.borderRadius = '4px';
  list.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18))';
  list.style.padding = '6px';
  try { list.classList.add('ui-glass-scrollbar'); } catch (_) {}
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
  input.style.background = 'rgba(255,255,255,0.06)';
  input.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  input.style.color = 'var(--ui-bright, rgba(190,230,255,0.98))';
  input.style.borderRadius = '4px';

  const searchBtn = document.createElement('button');
  searchBtn.textContent = '🔎';
  searchBtn.title = 'Filter current tab by text';
  searchBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  searchBtn.style.background = 'rgba(255,255,255,0.06)';
  searchBtn.style.color = 'var(--ui-bright, rgba(190,230,255,0.98))';
  searchBtn.style.borderRadius = '4px';

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  sendBtn.style.background = 'rgba(255,255,255,0.06)';
  sendBtn.style.color = 'var(--ui-bright, rgba(190,230,255,0.98))';
  sendBtn.style.borderRadius = '4px';

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
      b.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
      b.style.background = (t === currentTab) ? 'rgba(120,170,255,0.18)' : 'rgba(255,255,255,0.06)';
      b.style.color = 'var(--ui-bright, rgba(190,230,255,0.98))';
      b.style.borderRadius = '4px';
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
          span.style.color = 'var(--ui-link, #6cf)';
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
    searchBtn.style.background = 'rgba(120,170,255,0.18)';
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
