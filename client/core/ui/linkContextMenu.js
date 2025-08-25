// Link-specific context menu built on top of the generic showContextMenu
// Usage: showLinkContextMenu({ x, y, href, joinRoomId, onOpenLink, onJoinGame, blockGameplayInput })

import { showContextMenu } from './contextMenu.js';
import { ensureBanner } from './banner.js';

export function showLinkContextMenu({ x = 0, y = 0, href = '', joinRoomId = null, onOpenLink, onJoinGame, blockGameplayInput = true } = {}) {
  const url = String(href || '').trim();
  const items = [];

  if (joinRoomId) {
    items.push({ label: 'Join Game', onClick: () => { try { if (typeof onJoinGame === 'function') onJoinGame(String(joinRoomId)); } catch (_) {} } });
  }
  if (url) {
    items.push({ label: 'Open Link', onClick: () => { try { if (typeof onOpenLink === 'function') onOpenLink(url); else window.open(url, '_blank'); } catch (_) {} } });
    items.push({ label: 'Copy Link', onClick: async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const ta = document.createElement('textarea');
          ta.value = url; ta.style.position = 'fixed'; ta.style.left = '-5000px';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        }
        try { ensureBanner(); window.queueBanner('Link copied to clipboard', 1); } catch (_) {}
      } catch (_) {}
    } });
  }
  if (!items.length) {
    try { ensureBanner(); window.queueBanner('No link detected', 2); } catch (_) {}
    return;
  }
  return showContextMenu({ x, y, items, blockGameplayInput });
}

export default showLinkContextMenu;
