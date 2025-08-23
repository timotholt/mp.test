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
    overlayEl.style.pointerEvents = 'auto';
    overlayEl.style.background = 'rgba(0,0,0,0.5)';
    overlayEl.style.color = '#fff';
    overlayEl.style.padding = '16px';
    overlayEl.style.zIndex = '20000';
    const inner = document.createElement('div');
    inner.id = 'overlay-content';
    inner.style.maxWidth = '640px';
    inner.style.margin = '40px auto';
    inner.style.background = 'rgba(0,0,0,0.8)';
    inner.style.border = '1px solid #444';
    inner.style.padding = '16px';
    inner.style.boxShadow = '0 0 12px rgba(0,0,0,0.6)';
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

function ensureScreenShade() {
  let shade = document.getElementById('screen-shade');
  if (!shade) {
    shade = document.createElement('div');
    shade.id = 'screen-shade';
    shade.style.position = 'fixed';
    shade.style.inset = '0';
    shade.style.background = 'rgba(0,0,0,0.5)';
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
      if (content) content.innerHTML = '';
      const route = getRoute();
      // Recompute input gate when overlays change
      window.__canSendGameplayInput = (route === getStates().GAMEPLAY_ACTIVE);
      // Shade follows route when no modal
      try {
        const shade = document.getElementById('screen-shade');
        if (shade) shade.style.display = (route !== getStates().GAMEPLAY_ACTIVE) ? '' : 'none';
      } catch (_) {}
      return;
    }
    const top = stack[stack.length - 1];
    el.style.display = '';
    // Ensure dimming shade is visible while any modal is shown
    try { const shade = ensureScreenShade(); shade.style.display = ''; } catch (_) {}
    const content = el.querySelector('#overlay-content');
    // If this modal uses external content management, do not touch the content area
    if (top && top.external) {
      const route = getRoute();
      window.__canSendGameplayInput = (route === getStates().GAMEPLAY_ACTIVE) && !top.blockInput;
      return;
    }
    if (content) content.innerHTML = '';
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
