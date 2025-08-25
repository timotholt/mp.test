// Banner UI
// Creates a centered transient banner and exposes window.showBanner(msg, ms).
// Behavior identical to the previous inline implementation in main.js.

export function ensureBanner() {
  let banner = document.getElementById('mini-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'mini-banner';
    banner.style.position = 'fixed';
    banner.style.top = '8px';
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
    banner.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
    banner.style.backdropFilter = 'var(--sf-tip-backdrop, blur(8px) saturate(1.25))';
    banner.style.borderRadius = '6px';
    banner.style.padding = '0 12px';
    // Keep banner above overlay (zIndex 20000) and status bar (30000)
    banner.style.zIndex = '30100';
    document.body.appendChild(banner);

    window.showBanner = function(msg = '', ms = 4000) {
      try {
        banner.textContent = msg;
        banner.style.display = 'flex';
        // allow layout to apply before animating
        requestAnimationFrame(() => { try { banner.style.transform = 'translate(-50%, 0)'; } catch (_) {} });
      } catch (_) {}
      if (window.__bannerTimer) clearTimeout(window.__bannerTimer);
      if (window.__bannerHideVisTimer) clearTimeout(window.__bannerHideVisTimer);
      window.__bannerTimer = setTimeout(() => {
        try { banner.style.transform = 'translate(-50%, -120%)'; } catch (_) {}
        window.__bannerHideVisTimer = setTimeout(() => { try { banner.style.display = 'none'; } catch (_) {} }, 450);
      }, ms);
    };
  }
  return banner;
}
