// Tabbed chat UI (JS-only, reusable)
// Exports: createChatTabs({ mode: 'lobby' | 'game', onJoinGame(roomId), onOpenLink(href) })
import { UI, createInputRow, createLeftIconInput, wireFocusHighlight, createTabsBar } from './ui/controls.js';
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

  // Tabs row (shared)
  const tabsCtl = createTabsBar({
    getKey: (t) => t,
    getLabel: (t) => t,
    onSelect: (key) => switchTo(key),
  });
  try { tabsCtl.el.setAttribute('data-name', 'chat-tabs-row'); } catch (_) {}
  el.appendChild(tabsCtl.el);

  // Messages area (glass surface; flexible to fill remaining height)
  const list = document.createElement('div');
  list.style.flex = '1 1 auto';
  list.style.minHeight = '0';
  list.style.maxHeight = '100%';
  list.style.overflowY = 'auto';
  list.style.background = 'linear-gradient(var(--ui-surface-bg-top, rgba(10,18,26,0.41)), var(--ui-surface-bg-bottom, rgba(10,16,22,0.40)))';
  list.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  list.style.borderRadius = '0px 4px 0px 0px';
  list.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 18px rgba(40,100,200,0.18))';
  list.style.padding = '6px';
  try { list.classList.add('ui-glass-scrollbar'); } catch (_) {}
  try { list.setAttribute('data-name', 'chat-messages-list'); } catch (_) {}
  el.appendChild(list);

  // Input row (shared control)
  const inputRow = createInputRow({ dataName: 'chat-input-row' });
  el.appendChild(inputRow);

  // Message input: use shared left-icon input but hide the icon to reuse styles
  const { wrap: inputWrap, input, btn: hiddenIconBtn } = createLeftIconInput({
    placeholder: 'Type message…',
    marginLeft: '0.3rem',
    iconSvg: null,
  });
  try { inputWrap.setAttribute('data-name', 'chat-input-wrap'); } catch (_) {}
  // Hide the built-in icon button and reset padding to plain input
  hiddenIconBtn.style.display = 'none';
  input.style.padding = '0 10px';
  // Preserve chat sizing and font
  // Fill the full row height so the left border (divider) touches top/bottom
  input.style.height = '100%';
  input.style.lineHeight = '46px';
  input.style.borderRadius = '0px 10px 0px 0px';
  input.style.borderLeft = '1px solid var(--ui-surface-border)';
  input.style.boxSizing = 'border-box';
  input.style.fontSize = '16px';

  // Stretch the input row's children to eliminate tiny vertical gaps
  try { inputRow.style.alignItems = 'stretch'; } catch (_) {}
  try { inputWrap.style.alignSelf = 'stretch'; } catch (_) {}

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
  // Horizontal margin only (no vertical) to keep row height tight
  sendBtn.style.margin = '0.3rem';

  // CSS-driven expanding search field (separate from message input)
  const { wrap: searchWrap, input: searchInput, btn: searchBtn } = createLeftIconInput({
    placeholder: 'Search',
    marginLeft: '0',
    iconSvg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
  });
  try { searchWrap.setAttribute('data-name', 'chat-search-wrap'); } catch (_) {}
  // Start collapsed; expand on hover/focus via injected CSS
  searchWrap.classList.add('chat-search-collapsible');
  // Prevent it from stretching; only take space equal to icon until expanded
  searchWrap.style.flex = '0 0 auto';
  // Add small padding before the search icon per request
  // searchWrap.style.paddingLeft = '6px';
  // Make the search icon a plain, non-interactive icon
  try {
    searchBtn.style.border = '0';
    searchBtn.style.outline = 'none';
    searchBtn.style.background = 'transparent';
    searchBtn.style.cursor = 'default';
    searchBtn.style.pointerEvents = 'none';
    searchBtn.style.left = '6px';
    searchBtn.tabIndex = -1;
    searchBtn.setAttribute('aria-hidden', 'true');
    // Remove any box shadow/border artifacts
    searchBtn.style.boxShadow = 'none';
  } catch (_) {}
  // Tiny clear button on right side of the search input
  const clearBtn = document.createElement('button');
  clearBtn.className = 'chat-search-clear';
  clearBtn.type = 'button';
  clearBtn.title = 'Clear';
  clearBtn.textContent = 'clear';
  // Interactive; sizing/border handled via CSS class
  try {
    clearBtn.style.boxShadow = 'none';
    clearBtn.tabIndex = 0;
  } catch (_) {}
  searchWrap.appendChild(clearBtn);
  // Slightly smaller search input
  searchInput.style.height = '40px';
  searchInput.style.lineHeight = '40px';
  searchInput.style.borderRadius = '8px';
  // Ensure width transitions apply; do not let flex sizing override
  searchInput.style.flex = '0 0 auto';
  // Let CSS drive width/padding transitions: clear inline values set by shared helper
  try { searchInput.style.removeProperty('width'); } catch (_) {}
  try { searchInput.style.removeProperty('padding'); } catch (_) {}
  // Accessibility titles
  searchBtn.title = 'Search messages';
  // Order: search (left), message input (center), send (right)
  inputRow.appendChild(searchWrap);
  inputRow.appendChild(inputWrap);
  inputRow.appendChild(sendBtn);

  // Inject minimal CSS for the collapsible search behavior (no JS toggling)
  try {
    const STYLE_ID = 'chat-search-collapsible-css';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .chat-search-collapsible{ position:relative; display:flex; align-items:center; width:32px; overflow:hidden; transition: width 160ms ease; }
        .chat-search-collapsible input{ width:0; opacity:0; padding:0; pointer-events:none; transition: width 160ms ease, opacity 140ms ease, padding 160ms ease; }
        .chat-search-collapsible:hover, .chat-search-collapsible:focus-within, .chat-search-collapsible.has-text{ width:240px; }
        .chat-search-collapsible:hover input, .chat-search-collapsible:focus-within input, .chat-search-collapsible.has-text input{ width:200px; opacity:1; padding: 0 64px 0 calc(32px + 0.5rem); pointer-events:auto; }
        .chat-search-collapsible > button:not(.chat-search-clear){ left:0; }
        .chat-search-collapsible .chat-search-clear{ position:absolute; right:6px; top:50%; transform:translateY(-50%); background:transparent; color: var(--ui-bright, rgba(190,230,255,0.90)); font-size:12px; line-height:18px; padding:0 6px; border-radius:6px; border:1px solid var(--ui-surface-border, rgba(120,170,255,0.70)); cursor:pointer; opacity:0; pointer-events:none; transition: opacity 120ms ease, background 120ms ease, border-color 120ms ease, color 120ms ease; }
        .chat-search-collapsible:hover .chat-search-clear, .chat-search-collapsible:focus-within .chat-search-clear, .chat-search-collapsible.has-text .chat-search-clear{ opacity:1; pointer-events:auto; }
        .chat-search-collapsible .chat-search-clear:hover{ background: rgba(120,170,255,0.10); border-color: var(--ui-surface-border-strong, rgba(120,170,255,0.95)); }
      `;
      document.head.appendChild(style);
    }
  } catch (_) {}

  // State
  const messages = new Map();
  tabs.forEach(t => messages.set(t, []));
  let currentTab = tabs[0];
  let filterTerm = '';
  let unsentDraft = '';

  // Helpers
  function isReadOnly(tab) { return readOnlyTabs.has(tab); }

  function renderTabs() {
    tabsCtl.render({ tabs, activeKey: currentTab });
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
    // Message input disabled on read-only; search stays enabled
    input.disabled = ro;
    sendBtn.disabled = ro;
    input.placeholder = ro ? 'Read-only' : 'Type message…';
  }

  function switchTo(tab) {
    if (!tabs.includes(tab)) return;
    currentTab = tab;
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

  // No toggle: live-filter via dedicated search input

  // Wire inputs (no JS focus for search icon to keep behavior CSS-only)
  sendBtn.onclick = () => {
    if (isReadOnly(currentTab)) return;
    const msg = (input.value || '').trim();
    if (!msg) return;
    // Stub: echo locally. Integration will hook network later.
    appendMessage(currentTab, `You: ${msg}`);
    input.value = '';
    unsentDraft = '';
  };
  input.addEventListener('keydown', (e) => {
    // Tab from typing area -> go to search input (skip buttons)
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      try { searchInput.focus(); } catch (_) {}
      return;
    }
    if (e.key === 'Escape') {
      // Allow Esc to clear message draft focus behavior only
      return;
    }
    if (e.key === 'Enter') sendBtn.click();
  });
  // Focus styling: keep inputs borderless; highlight parent row instead
  wireFocusHighlight(input, inputRow);
  wireFocusHighlight(searchInput, inputRow);
  // Track unsent draft on message input
  input.addEventListener('input', () => { unsentDraft = String(input.value || ''); });

  // Wire search input live filtering and Esc behavior
  searchInput.addEventListener('input', () => {
    const v = String(searchInput.value || '').trim();
    if (v) searchWrap.classList.add('has-text'); else searchWrap.classList.remove('has-text');
    filter(v);
  });
  searchInput.addEventListener('keydown', (e) => {
    // Tab from search -> go to typing area (skip buttons)
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      try { if (!input.disabled) input.focus(); } catch (_) {}
      return;
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      searchInput.value = '';
      filter('');
      searchWrap.classList.remove('has-text');
      try { searchInput.blur(); } catch (_) {}
    }
  });
  // Clear button: clear search input and keep focus
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    filter('');
    searchWrap.classList.remove('has-text');
    try { searchInput.focus(); } catch (_) {}
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
