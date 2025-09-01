// Account tab renderer: shared between panel and overlay
// JS-only, no external CSS. After this refactor, we only accept a container.
// We resolve helpers and auth state internally to keep callers simple.
import { makeSection, makeNote } from '../uiHelpers.js';
import { getUser } from '../../../core/auth/supabaseAuth.js';

export function renderAccountTab(container) {
  // Fail safe: no work if container missing
  if (!container) return;

  // Fixed copy kept local for consistency across callers
  const headerTitle = 'Account';
  const headerDesc = 'Manage your account, authentication and linked providers.';
  const loginMsg = 'Login required. Sign in to manage your account.';
  const loggedInMsg = 'You are logged in.';

  // Section header
  try { container.appendChild(makeSection(headerTitle, headerDesc, 'afterTitle')); } catch (_) {}

  // Initial heuristic: enable note based on computeAccountEnabled(); refine via getUser()
  let loggedIn = false;
  try { loggedIn = !!computeAccountEnabled(); } catch (_) { loggedIn = false; }

  // Render a note and keep a handle so we can update text after async auth resolves
  let noteEl = null;
  try { noteEl = makeNote(loggedIn ? loggedInMsg : loginMsg); } catch (_) { noteEl = null; }
  if (noteEl) { try { container.appendChild(noteEl); } catch (_) {} }

  // Asynchronously check real auth state; update text if it changes
  (async () => {
    try {
      const user = await getUser();
      const isIn = !!user;
      if (noteEl && isIn !== loggedIn) {
        try { noteEl.textContent = isIn ? loggedInMsg : loginMsg; } catch (_) {}
      }
    } catch (_) {}
  })();
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
