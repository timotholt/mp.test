// Overlay Manager (extracted)
// Exposes window.PRIORITY and window.OverlayManager. No HTML/CSS edits required.
// Depends on the presence of a root element with id="app".

export const PRIORITY = {
  LOW: 10,
  MEDIUM: 50,
  HIGH: 90,
  CRITICAL: 100,
};

function ensureOverlay() {
  let overlayEl = document.getElementById('overlay');
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'overlay';
    overlayEl.style.position = 'fixed';
    overlayEl.style.left = '0';
    overlayEl.style.top = '0';
    overlayEl.style.right = '0';
    overlayEl.style.bottom = '0';
    overlayEl.style.display = 'none';
    // Allow dragging/clicks to pass through dim background
    overlayEl.style.pointerEvents = 'none';
    // Single source of truth: do NOT dim at the overlay layer.
    // Fullscreen dimming is handled by dungeon scrim and settings scrim only.
    overlayEl.style.background = 'transparent';
    overlayEl.style.color = 'var(--ui-fg, #eee)';
    overlayEl.style.padding = '0px';
    overlayEl.style.zIndex = '20000';
    const inner = document.createElement('div');
    inner.id = 'overlay-content';
    // Keep modal content interactive; make this a neutral, full-size container
    inner.style.pointerEvents = 'auto';
    inner.style.width = '100%';
    inner.style.height = '100%';
    inner.style.margin = '0';
    inner.style.padding = '0';
    inner.style.background = 'transparent';
    inner.style.border = 'none';
    inner.style.boxShadow = 'none';
    inner.style.backdropFilter = 'none';
    // Provide a stable, clearly-named child root for external modals to target
    // without breaking existing '#overlay-content' behavior.
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    // Keep neutral styling; layout is controlled by the modal itself.
    modalRoot.style.display = 'block';
    modalRoot.style.width = '100%';
    modalRoot.style.height = '100%';
    inner.appendChild(modalRoot);
    overlayEl.appendChild(inner);
    const appRoot = document.getElementById('app');
    if (appRoot) {
      appRoot.style.position = appRoot.style.position || 'relative';
      appRoot.appendChild(overlayEl);
    } else {
      document.body.appendChild(overlayEl);
    }
  }
  return overlayEl;
}

function ensureDungeonScrim() {
  try {
    // Prefer shared implementation if available to avoid duplicate creators
    if (typeof window.ensureDungeonScrim === 'function') return window.ensureDungeonScrim();
  } catch (_) {}
  let shade = document.getElementById('dungeon-scrim');
  if (!shade) {
    shade = document.createElement('div');
    shade.id = 'dungeon-scrim';
    shade.style.position = 'fixed';
    shade.style.inset = '0';
    // Background: use themed overlay tint if available, else fallback to black with darkness alpha.
    // Alpha controlled by CSS var --ui-overlay-darkness (0..1). Default 0.5
    shade.style.background = 'var(--ui-overlay-bg, rgba(0,0,0, var(--ui-overlay-darkness, 0.5)))';
    shade.style.zIndex = '2000';
    shade.style.display = 'none';
    shade.style.pointerEvents = 'none';
    document.body.appendChild(shade);
  }
  return shade;
}

const OverlayManager = (() => {
  const stack = []; // { id, priority, text, actions, blockInput, hotkeys }

  function getRoute() {
    try { return (typeof window.__getCurrentRoute === 'function') ? window.__getCurrentRoute() : null; } catch (_) { return null; }
  }
  function getStates() { return window.APP_STATES || {}; }

  function renderTop() {
    const el = ensureOverlay();
    if (stack.length === 0) {
      el.style.display = 'none';
      const content = el.querySelector('#overlay-content');
      if (content) {
        content.innerHTML = '';
        // Reset to default interactive behavior when no modals are shown
        try { content.style.pointerEvents = 'auto'; } catch (_) {}
        // Recreate modal-root to keep external modals targeting consistent
        try {
          const root = document.createElement('div');
          root.id = 'modal-root';
          root.style.display = 'block';
          root.style.width = '100%';
          root.style.height = '100%';
          content.appendChild(root);
        } catch (_) {}
      }
      const route = getRoute();
      // Recompute input gate when overlays change
      window.__canSendGameplayInput = (route === getStates().GAMEPLAY_ACTIVE);
      // Hide dungeon scrim only if current route does not require it (keep separation with router)
      try {
        const shade = document.getElementById('dungeon-scrim');
        const route = getRoute();
        const needsShade = route !== getStates().GAMEPLAY_ACTIVE;
        if (shade && !needsShade) shade.style.display = 'none';
      } catch (_) {}
      // Broadcast changes: no top modal
      try {
        const detail = { blocking: false, topId: null, external: false, stackDepth: 0 };
        window.dispatchEvent(new CustomEvent('ui:blocking-changed', { detail }));
        window.dispatchEvent(new CustomEvent('ui:modal-top-changed', { detail }));
      } catch (_) {}
      return;
    }
    const top = stack[stack.length - 1];
    el.style.display = '';
    // Ensure dimming shade is visible while any modal is shown (dungeon scrim ON during modals)
    try { const shade = ensureDungeonScrim(); shade.style.display = ''; } catch (_) {}
    const content = el.querySelector('#overlay-content');
    // If this modal uses external content management (e.g., Login), clear any
    // leftover content from prior non-external modals and recreate a clean
    // '#modal-root' container for external modals to target.
    if (top && top.external) {
      try {
        if (content) {
          // Minimal fix: do NOT clear overlay-content when an external modal is on top.
          // Doing so would destroy underlying external modals (e.g., Login) when
          // opening another external layer (e.g., Settings). Instead, ensure a
          // stable '#modal-root' exists for external modals that target it.
          // Also: Allow pointer events to pass through empty overlay areas so canvas remains interactive
          try { content.style.pointerEvents = 'none'; } catch (_) {}
          let root = content.querySelector('#modal-root');
          if (!root) {
            root = document.createElement('div');
            root.id = 'modal-root';
            root.style.display = 'block';
            root.style.width = '100%';
            root.style.height = '100%';
            content.appendChild(root);
          }
        }
      } catch (_) {}
      const route = getRoute();
      window.__canSendGameplayInput = (route === getStates().GAMEPLAY_ACTIVE) && !top.blockInput;
      // Broadcast changes for external modal path
      try {
        const detail = { blocking: !!top.blockInput, topId: top.id || null, external: true, stackDepth: stack.length };
        window.dispatchEvent(new CustomEvent('ui:blocking-changed', { detail }));
        window.dispatchEvent(new CustomEvent('ui:modal-top-changed', { detail }));
      } catch (_) {}
      return;
    }
    if (content) content.innerHTML = '';
    // Normal (non-external) modals should be interactive over the overlay
    try { if (content) content.style.pointerEvents = 'auto'; } catch (_) {}
    const p = document.createElement('div');
    p.textContent = top.text || '[modal]';
    content.appendChild(p);
    const btnRow = document.createElement('div');
    btnRow.style.marginTop = '12px';
    content.appendChild(btnRow);
    (top.actions || []).forEach((a, idx) => {
      const b = document.createElement('button');
      b.textContent = a.label || a.id || ('Option ' + (idx + 1));
      b.style.marginRight = '8px';
      b.addEventListener('click', () => selectAction(top, a));
      btnRow.appendChild(b);
    });
    // Disable gameplay input if blocking
    const route = getRoute();
    window.__canSendGameplayInput = (route === getStates().GAMEPLAY_ACTIVE) && !top.blockInput;
    // Broadcast changes for normal (non-external) modal path
    try {
      const detail = { blocking: !!top.blockInput, topId: top.id || null, external: false, stackDepth: stack.length };
      window.dispatchEvent(new CustomEvent('ui:blocking-changed', { detail }));
      window.dispatchEvent(new CustomEvent('ui:modal-top-changed', { detail }));
    } catch (_) {}
  }

  function selectAction(modal, action) {
    try { if (window.room) window.room.send('modalAction', { modalId: modal.id, actionId: action.id }); } catch (_) {}
    dismiss(modal.id);
  }

  function present({ id, priority = PRIORITY.LOW, text = '', actions = [], blockInput = true, hotkeys = {}, external = false }) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].id === id) stack.splice(i, 1);
    }
    const modal = { id, priority, text, actions, blockInput, hotkeys, external };
    const idx = stack.findIndex(m => m.priority > priority);
    if (idx === -1) stack.push(modal); else stack.splice(idx, 0, modal);
    renderTop();
  }

  function dismiss(id) {
    const i = stack.findIndex(m => m.id === id);
    if (i !== -1) stack.splice(i, 1);
    renderTop();
  }

  function clearBelow(priority) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].priority < priority) stack.splice(i, 1);
    }
    renderTop();
  }

  function top() { return stack[stack.length - 1] || null; }
  function isBlockingInput() { const t = top(); return !!(t && t.blockInput); }

  // Keyboard hotkeys for the top modal
  window.addEventListener('keydown', (e) => {
    const t = top();
    if (!t) return;
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= (t.actions || []).length) {
      e.preventDefault();
      selectAction(t, t.actions[num - 1]);
      return;
    }
    if ((e.key === 'y' || e.key === 'Y') && (t.actions || [])[0]) { e.preventDefault(); selectAction(t, t.actions[0]); return; }
    if ((e.key === 'n' || e.key === 'N') && (t.actions || [])[1]) { e.preventDefault(); selectAction(t, t.actions[1]); return; }
  });

  return { present, dismiss, clearBelow, top, isBlockingInput };
})();

// Expose globally to keep API identical
window.PRIORITY = PRIORITY;
window.OverlayManager = OverlayManager;

export default OverlayManager;
