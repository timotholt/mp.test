// Account tab renderer: shared between panel and overlay
// JS-only, no external CSS. After this refactor, we only accept a container.
// We resolve helpers and auth state internally to keep callers simple.
import { makeSection, makeNote } from '../uiHelpers.js';
import { getUser } from '../../../core/auth/supabaseAuth.js';
import { getQuip } from '../../../core/ui/quip.js';

// How frequently to re-check auth while the Account tab is open (ms)
// Can be overridden at runtime via window.__settingsAccountPollMs
const ACCOUNT_AUTH_POLL_MS = (() => {
  try { const v = Number(window.__settingsAccountPollMs); if (Number.isFinite(v) && v > 250) return v; } catch (_) {}
  return 4000; // default: every few seconds
})();

export function renderAccountTab(container) {
  // Fail safe: no work if container missing
  if (!container) return;

  // Fixed copy kept local for consistency across callers
  const headerTitle = 'Account';
  // Use a right-aligned quip like other tabs
  const headerDesc = getQuip('settings.overlay.accountTag', [
'Passwords expire. Embarrassment does not.',
  'Your login is the only loot you keep forever.',
  'Forgot your password? So did the last hero.',
  'One click from “account secured” to “account screwed.”',
  'Eternal glory requires a stable email.',
  'Bind your fate to digits and symbols.',
  'Change your password. Impress absolutely nobody.',
  'Security questions: riddles, but less fun.',
  'Your credentials are worth more than your gear.',
  'Lose your account, lose your legacy.',
  'Accounts are fragile. Dungeons are not.',
  'Email, password, dignity — update at will.',
  'Your bones file is useless without a login.',
  'Lock it down before goblins guess it.',
  "Even the dragon can’t reset your password.",
  "Your email address isn’t as cool as you think.",
  "Protect your password. Or don’t. Free country.",
  'Security review: it’s not cheating, it’s surviving.',
  'Authentication: because trust issues are healthy.',
  'The dungeon doesn’t forgive weak passwords.'
  ]);
  const loginMsg = 'Login required. Sign in to manage your account.';
  const loggedInMsg = 'You are logged in.';

  // Section header
  try { container.appendChild(makeSection(headerTitle, headerDesc, 'afterTitle', true)); } catch (_) {}

  // Create a placeholder note; start blank until we confirm auth state
  let noteEl = null;
  try { noteEl = makeNote(''); } catch (_) { noteEl = null; }
  if (noteEl) { try { container.appendChild(noteEl); } catch (_) {} }

  // Track last known state so we only update when it changes
  const state = { known: false, loggedIn: false };

  // Ensure only one polling loop per container; cancel any previous one
  try { if (container.__accountAuthTimer) { clearTimeout(container.__accountAuthTimer); container.__accountAuthTimer = null; } } catch (_) {}
  container.__accountAuthGen = (container.__accountAuthGen || 0) + 1;
  const gen = container.__accountAuthGen;

  const isAlive = () => {
    try { if (!document || !document.body) return false; } catch (_) { return false; }
    // Stop when this tab content is no longer current (noteEl removed when switching tabs)
    return container.__accountAuthGen === gen && noteEl && document.body.contains(noteEl);
  };

  async function refreshAuth() {
    try {
      const user = await getUser();
      const isIn = !!user;
      if (!state.known || isIn !== state.loggedIn) {
        state.known = true; state.loggedIn = isIn;
        if (noteEl) {
          try { noteEl.textContent = isIn ? loggedInMsg : loginMsg; } catch (_) {}
        }
      }
    } catch (_) { /* keep blank on errors until next poll */ }
  }

  // Kick off: do an immediate check (keeps UI blank until resolved), then poll
  (async () => {
    await refreshAuth();
    const tick = async () => {
      if (!isAlive()) return;
      await refreshAuth();
      if (!isAlive()) return;
      try { container.__accountAuthTimer = setTimeout(tick, ACCOUNT_AUTH_POLL_MS); } catch (_) {}
    };
    try { container.__accountAuthTimer = setTimeout(tick, ACCOUNT_AUTH_POLL_MS); } catch (_) {}
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
