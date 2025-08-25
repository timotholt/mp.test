// Player-specific context menu built on top of the generic showContextMenu
// Usage: showPlayerContextMenu({ x, y, name, id, selfName, onWhisper, onViewProfile, onFriendsChanged, onBlockedChanged, blockGameplayInput })

import { showContextMenu } from './contextMenu.js';
import * as LS from '../localStorage.js';
import { ensureBanner } from './banner.js';

function readJSON(key, fallback) {
  try { const v = LS.getItem(key, null); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
}
function writeJSON(key, val) { try { LS.setItem(key, JSON.stringify(val)); } catch (_) {} }

function hasInSet(setKey, key) {
  const s = new Set(readJSON(setKey, []));
  return s.has(String(key));
}
function toggleInSet(setKey, key, on) {
  const arr = readJSON(setKey, []);
  const s = new Set(arr);
  const id = String(key);
  if (on) s.add(id); else s.delete(id);
  writeJSON(setKey, Array.from(s));
}

export function showPlayerContextMenu({ x = 0, y = 0, name = '', id = '', selfName = '', onWhisper, onViewProfile, onFriendsChanged, onBlockedChanged, blockGameplayInput = true } = {}) {
  const targetName = String(name || '').trim();
  const targetId = String(id || '').trim();
  if ((selfName && targetName && targetName === String(selfName)) || (!targetName && !targetId)) return;

  // Determine current state
  const isFriend = hasInSet('friends:set', targetId) || (targetName && hasInSet('friends:set', targetName));
  const isBlocked = hasInSet('blocked:set', targetId) || (targetName && hasInSet('blocked:set', targetName));

  const display = targetName || targetId;

  const items = [
    { label: `Whisper ${display}`, onClick: () => { try { if (typeof onWhisper === 'function') onWhisper(display); } catch (_) {} } },
    { label: 'View Profile', onClick: () => {
      if (typeof onViewProfile === 'function') { try { onViewProfile({ name: targetName, id: targetId }); } catch (_) {} }
      else { try { ensureBanner(); window.queueBanner('Profile coming soon', 2); } catch (_) {} }
    }},
    { label: isFriend ? 'Unfriend' : 'Add Friend', onClick: () => {
      try {
        toggleInSet('friends:set', targetId, !isFriend);
        if (targetName) toggleInSet('friends:set', targetName, !isFriend);
        if (typeof onFriendsChanged === 'function') onFriendsChanged({ name: targetName, id: targetId, isFriend: !isFriend });
      } catch (_) {}
    }},
    { separator: true },
    { label: isBlocked ? 'Unblock' : 'Block', onClick: () => {
      try {
        toggleInSet('blocked:set', targetId, !isBlocked);
        if (targetName) toggleInSet('blocked:set', targetName, !isBlocked);
        if (typeof onBlockedChanged === 'function') onBlockedChanged({ name: targetName, id: targetId, isBlocked: !isBlocked });
      } catch (_) {}
    }},
  ];

  return showContextMenu({ x, y, items, blockGameplayInput });
}

export default showPlayerContextMenu;
