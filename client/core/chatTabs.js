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
  // el.style.background = 'linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
  el.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  el.style.borderRadius = '6px';
  // el.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 18px rgba(120,170,255,0.33)), var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18))';
  el.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
  el.style.color = 'var(--ui-bright, rgba(190,230,255,0.98))';
  // Let the chat fill its container's fixed height (e.g., lobby grid's chat row)
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.height = '100%';
  el.style.maxHeight = '100%';
  // No top border on chat root
  // el.style.borderTop = '0';
  // el.style.borderLeft = '0';
  // el.style.borderRight = '0';
  el.style.border = '0px';
  // Debug labels for DOM inspection
  try { el.setAttribute('data-name', 'chat-root'); el.setAttribute('data-mode', String(mode)); } catch (_) {}

  // Tabs row
  const tabsRow = document.createElement('div');
  tabsRow.style.display = 'flex';
  tabsRow.style.gap = '6px';
  // Tabs should touch the div below (no gap)
  tabsRow.style.marginBottom = '0';
  // No top border on the chat tabs row
  tabsRow.style.borderTop = '0';
  tabsRow.style.borderLeft = '0';
  tabsRow.style.borderRight = '0';
  try { tabsRow.setAttribute('data-name', 'chat-tabs-row'); } catch (_) {}
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
  try { list.setAttribute('data-name', 'chat-messages-list'); } catch (_) {}
  el.appendChild(list);

  // Input row
  const inputRow = document.createElement('div');
  inputRow.style.display = 'flex';
  inputRow.style.alignItems = 'center';
  inputRow.style.gap = '8px';
  // inputRow.style.marginTop = '6px';
  inputRow.style.minHeight = '46px';
  inputRow.style.borderBottom = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  inputRow.style.borderLeft = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  inputRow.style.borderRight = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  inputRow.style.borderRadius = '0px 0px 6px 6px';
  try { inputRow.setAttribute('data-name', 'chat-input-row'); } catch (_) {}
  el.appendChild(inputRow);

  // Input with left icon (login-style control, JS-styled to avoid CSS edits)
  const inputWrap = document.createElement('div');
  inputWrap.style.position = 'relative';
  inputWrap.style.display = 'flex';
  inputWrap.style.alignItems = 'center';
  inputWrap.style.flex = '1';
  inputWrap.style.marginLeft = '0.3rem';
  try { inputWrap.setAttribute('data-name', 'chat-input-wrap'); } catch (_) {}

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type message…';
  input.style.flex = '1';
  input.style.height = '46px';
  input.style.lineHeight = '46px';
  // Fully transparent to use parent background
  input.style.background = 'transparent';
  input.style.border = '0'; // reduce borders around the input control
  input.style.outline = 'none';
  input.style.color = 'var(--sf-tip-fg, #fff)';
  input.style.borderRadius = '10px';
  input.style.fontSize = '16px'; // larger input text
  // padding-left: icon-left (0) + icon-width (32px) + desired gap (0.5rem)
  input.style.padding = '0 10px 0 calc(32px + 0.5rem)';
  input.style.boxShadow = 'inset 0 0 12px rgba(40,100,200,0.10)';

  // Left search icon button inside input (acts as search toggle)
  const searchBtn = document.createElement('button');
  searchBtn.type = 'button';
  searchBtn.title = 'Filter current tab by text';
  searchBtn.style.position = 'absolute';
  searchBtn.style.left = '0';
  searchBtn.style.top = '50%';
  searchBtn.style.transform = 'translateY(-50%)';
  searchBtn.style.width = '32px';
  searchBtn.style.height = '32px';
  searchBtn.style.display = 'inline-flex';
  searchBtn.style.alignItems = 'center';
  searchBtn.style.justifyContent = 'center';
  searchBtn.style.background = 'transparent'; // transparent like send button
  searchBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  searchBtn.style.borderRadius = '8px';
  searchBtn.style.boxSizing = 'border-box';
  searchBtn.style.color = 'var(--ui-bright, rgba(190,230,255,0.90))';
  searchBtn.style.cursor = 'pointer';
  // Inline SVG magnifier (line-art to match login eye icon style)
  searchBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  // Softer look: fewer borders; keep subtle glass background
  // Add a clear border per request
  sendBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  sendBtn.style.background = 'transparent';
  sendBtn.style.color = 'var(--sf-tip-fg, #fff)';
  sendBtn.style.borderRadius = '8px';
  sendBtn.style.height = '40px';
  sendBtn.style.padding = '0 14px';
  // Even margin on all sides
  sendBtn.style.margin = '0.3rem';

  inputWrap.appendChild(input);
  inputWrap.appendChild(searchBtn);
  inputRow.appendChild(inputWrap);
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
      // Remove bottom border so tabs visually touch content below
      b.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
      b.style.borderBottom = '0';
      // Only round top corners
      b.style.borderRadius = '0';
      b.style.borderTopLeftRadius = '6px';
      b.style.borderTopRightRadius = '6px';
      // Active vs inactive styling
      const isActive = (t === currentTab);
      b.style.background = isActive ? 'rgba(120,170,255,0.32)' : 'rgba(255,255,255,0.06)';
      b.style.color = isActive ? 'var(--sf-tip-fg, #fff)' : 'var(--ui-bright, rgba(190,230,255,0.98))';
      b.style.textShadow = isActive ? '0 0 6px rgba(140,190,255,0.75)' : '';
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
    // Track current tab on the list itself for easier debugging
    try { list.setAttribute('data-current-tab', String(currentTab)); } catch (_) {}
    list.innerHTML = '';
    const arr = messages.get(currentTab) || [];
    arr.forEach((msg, idx) => {
      if (!lineIncludes(msg, filterTerm)) return;
      const div = document.createElement('div');
      try {
        div.setAttribute('data-name', 'chat-message');
        div.setAttribute('data-index', String(idx));
        div.setAttribute('data-tab', String(currentTab));
      } catch (_) {}
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
