import { makeCard, makeTitleBlock, makeTabs, makeContentPane, makeCenterLayer } from '../core/ui/blocks.js';
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

// No closeSettingsPanel: overlay handles dismissal via OverlayManager
// Helpers for sections/rows/inputs/notes now live in 'client/modals/settings/uiHelpers.js'.

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
    // Create centered overlay mount + scrim using blocks
    const layer = makeCenterLayer({ rootId: 'settings-overlay-root' });
    try { content.appendChild(layer.mount); } catch (_) {}

    // Keep settings isolated: do NOT mutate the shared #overlay styles here.
    // OverlayManager already manages its own backdrop/shade using theme vars.
    // Our mount captures input via pointer-events: auto; no global overrides.
    const prevFocus = document.activeElement;

    // Centered container
    const center = layer.center;

    // Centered container, no need for padding or transforms anymore
    // center.style.padding = '24px';
    // center.style.transform = 'translateY(-2vh)';

    // Card
    const card = makeCard();
    try { card.setAttribute('aria-modal', 'true'); } catch (_) {}

    // Title block with quip + close
    const handleClose = () => {
      try {
        if (volAdjustHandler) {
          if (typeof volAdjustHandler === 'function') volAdjustHandler();
          else window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
        }
      } catch (_) {}
      try { const m = document.getElementById('settings-overlay-root'); if (m && m.parentNode) m.parentNode.removeChild(m); } catch (_) {}
      try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
    };
    const titleBlock = makeTitleBlock({ title: 'Settings', quips: SETTINGS_TAGLINES, onClose: handleClose });
    try {
      // ARIA association
      if (titleBlock.titleEl && titleBlock.titleEl.id) card.setAttribute('aria-labelledby', titleBlock.titleEl.id);
      if (titleBlock.quipEl) {
        if (!titleBlock.quipEl.id) titleBlock.quipEl.id = 'settings-modal-desc';
        card.setAttribute('aria-describedby', titleBlock.quipEl.id);
      }
    } catch (_) {}

    // Tabs bar (wrapped)
    const tabsBar = makeTabs({ onSelect: onSelectTab });
    // Tab order per spec: Account, Profile, Display, Theme, Controls, Sound
    const allTabs = ['Account', 'Profile', 'Display', 'Theme', 'Controls', 'Sound'];

    // Bordered content area with scroll
    const contentWrap = makeContentPane();

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
      switch (activeTab) {
        case 'Account': renderAccountTab(contentWrap); break;
        case 'Profile': renderProfileTab(contentWrap); break;
        case 'Theme':   renderThemeTab(contentWrap); break;
        case 'Display': renderDisplayTab(contentWrap); break;
        case 'Sound': {
          try {
            if (volAdjustHandler) {
              if (typeof volAdjustHandler === 'function') volAdjustHandler();
              else window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
            }
          } catch (_) {}
          // Render Sound tab via module; capture cleanup function
          volAdjustHandler = renderSoundTab(contentWrap);
          break;
        }
        case 'Controls': renderControlTab(contentWrap); break;

        // This should eventually go away
        default:
          console.log('ERROR: Unknown tab: ' + activeTab);
          break;
      }
    }

    // Assemble
    card.appendChild(titleBlock.el);
    card.appendChild(tabsBar.el);
    card.appendChild(contentWrap);
    center.appendChild(card);
    // Mount settings centered UI into our dedicated layer
    layer.mount.appendChild(center);

    // Focus trap within the card
    try {
      const trap = (ev) => {
        if (ev.key === 'Escape') {
          ev.preventDefault(); ev.stopPropagation();
          try { (titleBlock && titleBlock.closeBtn) ? titleBlock.closeBtn.click() : handleClose(); } catch (_) {}
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
    // close handled via titleBlock's close button

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
