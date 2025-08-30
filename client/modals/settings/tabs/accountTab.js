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

  try { container.appendChild(makeSection(headerTitle, headerDesc)); } catch (_) {}
  if (!loggedIn) {
    try { container.appendChild(makeNote(loginMsg)); } catch (_) {}
  } else {
    try { container.appendChild(makeNote(loggedInMsg)); } catch (_) {}
  }
}
