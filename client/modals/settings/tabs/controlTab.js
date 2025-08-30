// Controls Tab: renders Controls settings for panel and overlay
// Minimal placeholder extracted from settings.js to keep structure consistent with other tabs.
// Human-readable, commented, and variant-aware per project conventions.

export function renderControlTab(opts) {
  const {
    container,
    makeSection,
    makeNote,
    headerTitle = 'Controls',
    headerDesc = 'Keybinds (coming soon).',
    variant = 'panel', // currently unused but reserved for future differences
  } = opts || {};

  // Section header
  const sec = makeSection(headerTitle, headerDesc);
  container.appendChild(sec);

  // Body note
  container.appendChild(makeNote('Keybinding editor will appear here.'));
}
