// Account tab renderer: shared between panel and overlay
// JS-only, no external CSS. We accept helpers and append into the given container.
// Usage:
//   renderAccountTab({
//     container,
//     makeSection,
//     makeNote,
//     headerTitle: 'Account',
//     headerDesc: 'Manage your account, authentication and linked providers.',
//     loggedIn: false,
//     loginMsg: 'Login required. Sign in to manage your account.',
//     loggedInMsg: 'You are logged in.'
//   });

export function renderAccountTab(opts = {}) {
  const {
    container,
    makeSection,
    makeNote,
    headerTitle = 'Account',
    headerDesc = 'Manage your account, authentication and linked providers.',
    loggedIn = false,
    loginMsg = 'Login required. Sign in to manage your account.',
    loggedInMsg = 'You are logged in.',
  } = opts || {};

  if (!container || typeof makeSection !== 'function' || typeof makeNote !== 'function') {
    // Fail safe: do nothing if required hooks are missing
    return;
  }

  try { container.appendChild(makeSection(headerTitle, headerDesc, 'afterTitle')); } catch (_) {}
  if (!loggedIn) {
    try { container.appendChild(makeNote(loginMsg)); } catch (_) {}
  } else {
    try { container.appendChild(makeNote(loggedInMsg)); } catch (_) {}
  }
}

// Determine if account-related UI should be enabled.
// Reads a global hint window.__settingsAccountEnabled when present,
// otherwise falls back to a heuristic (joined to a room).
export function computeAccountEnabled() {
  try {
    if (typeof window.__settingsAccountEnabled === 'boolean') return !!window.__settingsAccountEnabled;
  } catch (_) {}
  try { if (window.room) return true; } catch (_) {}
  return false;
}

// Update the global hint used by computeAccountEnabled().
// Keep this function UI-agnostic to avoid circular dependencies.
// Callers should re-render their UI after invoking this.
export function setSettingsAuth({ accountEnabled }) {
  try { window.__settingsAccountEnabled = !!accountEnabled; } catch (_) {}
}
