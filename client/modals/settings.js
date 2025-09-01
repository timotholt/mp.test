import { createTabsBar, UI } from '../core/ui/controls.js';
import { getQuip } from '../core/ui/quip.js';
import { renderAccountTab } from './settings/tabs/accountTab.js';
import { renderProfileTab } from './settings/tabs/profileTab.js';
import { renderDisplayTab } from './settings/tabs/displayTab.js';
import { renderSoundTab } from './settings/tabs/soundTab.js';
import { renderControlTab } from './settings/tabs/controlTab.js';
import { renderThemeTab } from './settings/tabs/themeTab.js';

// Shared taglines used by both the fallback panel and the overlay modal
const SETTINGS_TAGLINES = [
  'Tune the dials. Tame the darkness.',
  'Make the abyss more habitable.',
  'Adjust reality to your liking.',
  'Personalization: because every doom is unique.',
  'Polish your experience. Leave the grime.',
  'Twist the knobs; not your fate.',
  'Balance chaos with preferences.',
  'Sharper fangs, softer UI.',
  'Your look, your feel, your death',
  'Dye your death, attenuate your scream.',
  "You just have to touch everything don't you.",
  'Set the stage for heroics.',
  "Change your settings all you want. It won't help.",
  'Paint your pixels, we paint your doom',
  'Buttons for the brave.',
  'Your dungeon, your rules.',
  'Fine‑tune the fear factor.',
  'Dial-in the doom.',
  'Refine the ritual.',
  'Customize the chaos.',
  "Even the programmer who made this doesn't know what half these things do.",
  "You can change your settings … but should you?",
  "Change your settings, cause you can't change your life."
];

// Self-contained Settings Panel (always-available)
// Lives outside OverlayManager and routes. JS-only, no external CSS.
// Tabs: Account, Profile, Display, Sound, Controls.
// Account tab is disabled until authenticated.

let __settingsState = {
  activeTab: 'Profile',
};
export function presentSettingsPanel() {
  // Always use overlay modal. No fallback panel.
  try { presentSettingsOverlay(); } catch (_) {}
}

// No closeSettingsPanel: overlay handles dismissal via OverlayManager
// Helpers for sections/rows/inputs/notes now live in 'client/modals/settings/uiHelpers.js'.

// Overlay-based Settings Modal (preferred). Returns true if shown, false to fall back.
function presentSettingsOverlay() {
  try {
    if (!window.OverlayManager) return false;
    const id = 'SETTINGS_MODAL';
    const PRIORITY = (window.PRIORITY || { MEDIUM: 50 });
    try {
      window.OverlayManager.present({ id, text: '', actions: [], blockInput: true, priority: PRIORITY.MEDIUM, external: true });
    } catch (_) {}

    const overlay = document.getElementById('overlay');
    const content = overlay ? overlay.querySelector('#overlay-content') : null;
    if (!content) return false;
    // Do NOT clear shared overlay content; create our own mount layer instead
    // Remove any stale instance from a previous open
    try {
      const prev = content.querySelector('#settings-overlay-root');
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    } catch (_) {}
    const mount = document.createElement('div');
    mount.id = 'settings-overlay-root';
    // Fixed full-viewport layer so it overlays existing lobby/login siblings
    mount.style.position = 'fixed';
    mount.style.inset = '0';
    mount.style.zIndex = '20001';
    // Allow this layer to capture pointer events (modal blocks background)
    mount.style.pointerEvents = 'auto';
    try { content.appendChild(mount); } catch (_) {}
    // Local scrim to subtly dim background behind the settings card
    try {
      const scrim = document.createElement('div');
      scrim.style.position = 'absolute';
      scrim.style.inset = '0';
      // Use theme-driven overlay tint and blur so sliders affect this scrim
      // Darkness comes from --ui-overlay-darkness via --ui-overlay-bg (set in UITheme)
      scrim.style.background = 'var(--ui-overlay-bg, rgba(0,0,0,0.50))';
      // Blur comes from --ui-backdrop-blur (e.g., 3px), updated by applyDynamicTheme({ milkiness })
      scrim.style.backdropFilter = 'blur(var(--ui-backdrop-blur, 3px))';
      scrim.style.webkitBackdropFilter = 'blur(var(--ui-backdrop-blur, 3px))';
      scrim.style.zIndex = '0';
      scrim.style.pointerEvents = 'auto';
      mount.appendChild(scrim);
    } catch (_) {}

    // Keep settings isolated: do NOT mutate the shared #overlay styles here.
    // OverlayManager already manages its own backdrop/shade using theme vars.
    // Our mount captures input via pointer-events: auto; no global overrides.
    const prevFocus = document.activeElement;

    // Centered container
    const center = document.createElement('div');
    center.style.position = 'relative';
    center.style.zIndex = '1';
    center.style.minHeight = '100vh';
    center.style.display = 'flex';
    center.style.alignItems = 'center';
    center.style.justifyContent = 'center';

    // Centered container, no need for padding or transforms anymore
    // center.style.padding = '24px';
    // center.style.transform = 'translateY(-2vh)';

    // Card
    const card = document.createElement('div');
    card.style.width = 'auto';
    card.style.maxWidth = 'calc(100vw - 32px)';
    card.style.color = 'var(--ui-fg, #eee)';
    card.style.borderRadius = '14px';
    card.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,36,0.48)) 0%, var(--ui-surface-bg-bottom, rgba(8,14,28,0.44)) 100%)';
    card.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    card.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
    card.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
    card.style.padding = '16px';
    card.style.maxHeight = 'min(80vh, 820px)';
    card.style.height = 'min(80vh, 820px)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.minWidth = '0';
    try { card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); } catch (_) {}

    // Header row (title left, close right)
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '2px';
    const title = document.createElement('div');
    title.textContent = 'Settings';
    title.style.fontSize = 'var(--ui-title-size, 1.5rem)';
    title.style.fontWeight = 'var(--ui-title-weight, 700)';
    title.style.userSelect = 'none';
    try { title.id = 'settings-modal-title'; card.setAttribute('aria-labelledby', 'settings-modal-title'); } catch (_) {}
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = '1px solid var(--ui-surface-border)';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.color = 'var(--ui-fg, #eee)';
    closeBtn.style.cursor = 'pointer';
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Cache random quip for overlay header (hoisted before use)
    let _quipSettings = null;

    const tagline = document.createElement('div');
    try {
      _quipSettings = getQuip('settings.overlay.header', SETTINGS_TAGLINES);
      tagline.textContent = _quipSettings;
      tagline.style.fontSize = 'var(--ui-title-quip-size, 0.9rem)';
      tagline.style.opacity = '0.9';
      tagline.style.margin = '0 0 1rem 0';
      tagline.style.color = 'var(--ui-fg-quip, #bbb)';
      tagline.style.userSelect = 'none';
    } catch (_) {}
    try { tagline.id = 'settings-modal-desc'; card.setAttribute('aria-describedby', 'settings-modal-desc'); } catch (_) {}

    // Tabs bar
    const tabsBar = createTabsBar({ onSelect: onSelectTab });
    // Tab order per spec: Account, Profile, Display, Theme, Controls, Sound
    const allTabs = ['Account', 'Profile', 'Display', 'Theme', 'Controls', 'Sound'];

    // Bordered content area with scroll
    const contentWrap = document.createElement('div');
    try { contentWrap.classList.add('ui-glass-scrollbar'); } catch (_) {}
    contentWrap.style.overflow = 'auto';
    contentWrap.style.padding = '1.0rem';
    contentWrap.style.marginTop = '0px';
    contentWrap.style.minHeight = '240px';
    contentWrap.style.maxHeight = 'calc(min(80vh, 820px) - 120px)';

    // Tim - contentWrap minWidth and maxWidth intentionally set to the same size
    contentWrap.style.maxWidth = 'var(--ui-glass-scrollbar-max-width)';
    contentWrap.style.minWidth = 'var(--ui-glass-scrollbar-min-width)';

    try {
      contentWrap.style.border = UI.border;
      // Sharp top-left corner only
      contentWrap.style.borderRadius = '0 8px 8px 8px';
      contentWrap.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.20) 0%, rgba(10,16,22,0.16) 100%)';
    } catch (_) {}

    // Local UI state for this overlay instance
    let activeTab = __settingsState.activeTab || 'Profile';
    let volAdjustHandler = null;

    // (Inline confirm removed; settings auto-save and no discard flow is used.)

    function onSelectTab(name) {
      // Tabs switch immediately; settings auto-save, no discard prompts
      // If we are leaving the Sound tab, run its cleanup (remove listeners)
      try {
        if (activeTab === 'Sound' && name !== 'Sound' && volAdjustHandler) {
          if (typeof volAdjustHandler === 'function') volAdjustHandler();
          else window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
          volAdjustHandler = null;
        }
      } catch (_) {}
      activeTab = String(name || 'Profile');
      __settingsState.activeTab = activeTab;
      render();
    }

    // No dirty tracking: tabs auto-save or manage their own state.

    function render() {
      // Tabs UI
      try { tabsBar.render({ tabs: allTabs, activeKey: activeTab }); } catch (_) {}
      // After rendering tabs, set up ARIA linkage and ids
      try {
        const btns = tabsBar.el.querySelectorAll('button[data-tab-key]');
        btns.forEach((b) => {
          const key = b.getAttribute('data-tab-key') || '';
          const safe = String(key).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
          if (!b.id) b.id = `settings-tab-${safe}`;
        });
        contentWrap.setAttribute('role', 'tabpanel');
        const activeBtn = tabsBar.el.querySelector(`button[data-tab-key="${activeTab}"]`);
        if (activeBtn && activeBtn.id) contentWrap.setAttribute('aria-labelledby', activeBtn.id);
      } catch (_) {}

      // Body
      contentWrap.innerHTML = '';
      const tab = activeTab;
      if (tab === 'Account') {
        // New simplified API: only pass the container; the tab resolves its own helpers/state
        renderAccountTab(contentWrap);
      } else if (tab === 'Profile') {
        renderProfileTab(contentWrap);
      } else if (tab === 'Theme') {
        renderThemeTab(contentWrap);
      } else if (tab === 'Display') {
        renderDisplayTab(contentWrap);
      } else if (tab === 'Sound')  {
        // Clean up any previous overlay listener before re-attaching via tab module
        try {
          if (volAdjustHandler) {
            if (typeof volAdjustHandler === 'function') volAdjustHandler();
            else window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
          }
        } catch (_) {}
        // Render Sound tab via module; capture cleanup function
        volAdjustHandler = renderSoundTab(contentWrap);
      } else if (tab === 'Controls') {
        // New simplified API: only pass the container; the tab resolves its own helpers/state
        renderControlTab(contentWrap);
      }
    }

    // Assemble
    card.appendChild(header);
    card.appendChild(tagline);
    card.appendChild(tabsBar.el);
    card.appendChild(contentWrap);
    center.appendChild(card);
    // Mount settings centered UI into our dedicated layer
    mount.appendChild(center);

    // Focus trap within the card
    try {
      const trap = (ev) => {
        if (ev.key === 'Escape') {
          ev.preventDefault(); ev.stopPropagation();
          try { closeBtn.click(); } catch (_) {}
          return;
        }
        if (ev.key !== 'Tab') return;
        const nodes = card.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const focusables = Array.from(nodes).filter(el => !el.disabled && el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); try { last.focus(); } catch (_) {} }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); try { first.focus(); } catch (_) {} }
      };
      card.addEventListener('keydown', trap);
      // Initial focus to first button/input
      setTimeout(() => {
        try {
          const nodes = card.querySelectorAll('input, button, select, textarea');
          for (const n of nodes) { if (!n.disabled) { n.focus(); break; } }
        } catch (_) {}
      }, 0);
    } catch (_) {}

    // Close without unsaved-change prompts (auto-save behavior)
    closeBtn.onclick = () => {
      try {
        if (volAdjustHandler) {
          if (typeof volAdjustHandler === 'function') volAdjustHandler();
          else window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
        }
      } catch (_) {}
      // Clean up our mount layer
      try { const m = document.getElementById('settings-overlay-root'); if (m && m.parentNode) m.parentNode.removeChild(m); } catch (_) {}
      try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
    };

    // Tabs manage their own auth/profile state and re-rendering as needed.

    // Initial render (before async auth completes)
    render();

    return true;
  } catch (_) {
    return false;
  }
}

// Optional global exposure for quick access/debug
window.presentSettingsPanel = presentSettingsPanel;
