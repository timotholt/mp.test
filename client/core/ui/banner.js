// Banner UI
// Creates a centered transient banner and exposes window.showBanner(msg, ms).
// Behavior identical to the previous inline implementation in main.js.

export function ensureBanner() {
  let banner = document.getElementById('mini-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'mini-banner';
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '50%';
    banner.style.transform = 'translate(-50%, -120%)';
    banner.style.transition = 'transform 0.4s ease';
    banner.style.width = '20%';
    banner.style.minWidth = '240px';
    banner.style.maxWidth = '480px';
    banner.style.height = '2em';
    banner.style.display = 'none';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'center';
    banner.style.background = 'var(--banner-bg, linear-gradient(180deg, rgba(10,18,26,0.35) 0%, rgba(10,16,22,0.28) 100%))';
    banner.style.color = 'var(--ui-fg)';
    banner.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    banner.style.borderTop = 'none';
    banner.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
    banner.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
    banner.style.borderRadius = '6px';
    banner.style.padding = '0 12px';
    // Keep banner above overlay (zIndex 20000) and status bar (30000)
    banner.style.zIndex = '30100';
    document.body.appendChild(banner);

    // Priority queue state (persisted on window to survive re-ensures)
    const state = (window.__bannerState = window.__bannerState || {
      q: [], // items: { msg, pri, ms, id, t }
      nextId: 1,
      showing: false,
      timer: null,
      hideVisTimer: null,
    });

    function animateShow() {
      banner.style.display = 'flex';
      requestAnimationFrame(() => { try { banner.style.transform = 'translate(-50%, 0)'; } catch (_) {} });
    }
    function animateHide(cb) {
      try { banner.style.transform = 'translate(-50%, -120%)'; } catch (_) {}
      state.hideVisTimer && clearTimeout(state.hideVisTimer);
      state.hideVisTimer = setTimeout(() => { try { banner.style.display = 'none'; } catch (_) {} cb && cb(); }, 450);
    }

    function pickNext() {
      if (!state.q.length) return null;
      // Find smallest priority group present
      let minPri = Infinity;
      for (const it of state.q) if (it && it.pri < minPri) minPri = it.pri;
      const idx = state.q.findIndex(it => it.pri === minPri);
      if (idx === -1) return state.q.shift();
      return state.q.splice(idx, 1)[0];
    }

    function runLoop() {
      if (state.showing) return; // already showing; wait for completion
      const item = pickNext();
      if (!item) return; // nothing to show
      state.showing = true;
      try { banner.textContent = item.msg; } catch (_) {}
      animateShow();
      const isLastAfterThis = state.q.length === 0;
      const dur = typeof item.ms === 'number' ? item.ms : (isLastAfterThis ? 3000 : 1500);
      state.timer && clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        animateHide(() => {
          state.showing = false;
          // Immediately proceed to next item if any
          // We intentionally do not collapse priorities mid-flight; new high-pri will be picked next
          runLoop();
        });
      }, Math.max(300, dur));
    }

    // Public APIs
    window.queueBanner = function(msg = '', pri = 4, ms) {
      try {
        state.q.push({ msg: String(msg || ''), pri: Math.max(1, Math.min(9, parseInt(pri, 10) || 4)), ms, id: state.nextId++, t: Date.now() });
        // Start loop if idle
        runLoop();
      } catch (_) {}
    };
    // Back-compat: showBanner enqueues with given duration as override and default priority 4
    window.showBanner = function(msg = '', ms) { window.queueBanner(msg, 4, ms); };
  }
  return banner;
}
