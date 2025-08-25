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
    banner.style.transform = 'translateX(-50%)';
    banner.style.width = '20%';
    banner.style.minWidth = '240px';
    banner.style.maxWidth = '480px';
    banner.style.height = '2em';
    banner.style.display = 'none';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'center';
    banner.style.background = 'var(--banner-bg)';
    banner.style.color = 'var(--ui-fg)';
    banner.style.border = '1px solid var(--control-border)';
    banner.style.borderRadius = '6px';
    banner.style.padding = '0 12px';
    banner.style.zIndex = '9500'; // above hover status bar (9000), below overlay (9999)
    document.body.appendChild(banner);

    window.showBanner = function(msg = '', ms = 4000) {
      try { banner.textContent = msg; banner.style.display = 'flex'; } catch (_) {}
      if (window.__bannerTimer) clearTimeout(window.__bannerTimer);
      window.__bannerTimer = setTimeout(() => { try { banner.style.display = 'none'; } catch (_) {} }, ms);
    };
  }
  return banner;
}
