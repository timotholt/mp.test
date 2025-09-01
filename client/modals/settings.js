import * as LS from '../core/localStorage.js';
import { createTabsBar, createLeftIconInput, wireFocusHighlight, UI, createInputRow, createDropdown } from '../core/ui/controls.js';
import { getUser, ensureProfileForCurrentUser } from '../core/auth/supabaseAuth.js';
import { getQuip } from '../core/ui/quip.js';
import { renderAccountTab, computeAccountEnabled, setSettingsAuth } from './settings/tabs/accountTab.js';
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
  accountEnabled: false,
};

// Shared helpers across panel and overlay
function attachHover(rng, labelEl) {
  const on = () => {
    try { labelEl.style.color = 'var(--ui-bright, #dff1ff)'; } catch (_) {}
    try { rng.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))'; } catch (_) {}
    try { rng.style.outline = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))'; } catch (_) {}
  };
  const off = () => {
    try { labelEl.style.color = ''; } catch (_) {}
    try { rng.style.boxShadow = 'none'; } catch (_) {}
    try { rng.style.outline = 'none'; } catch (_) {}
  };
  try {
    rng.addEventListener('mouseenter', on);
    rng.addEventListener('mouseleave', off);
    rng.addEventListener('focus', on);
    rng.addEventListener('blur', off);
  } catch (_) {}
}

function attachWheel(rng) {
  try {
    rng.addEventListener('wheel', (e) => {
      // Ignore if user holds modifier keys (allow browser gestures)
      if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
      if (e && e.cancelable !== false) e.preventDefault();
      let step = parseFloat(rng.step);
      if (!Number.isFinite(step)) step = 1;
      let min = parseFloat(rng.min); if (!Number.isFinite(min)) min = 0;
      let max = parseFloat(rng.max); if (!Number.isFinite(max)) max = 100;
      let val = parseFloat(rng.value); if (!Number.isFinite(val)) val = min;
      // Wheel up -> increase, wheel down -> decrease
      val += (e.deltaY < 0 ? step : -step);
      // Clamp and snap to step precision
      val = Math.min(max, Math.max(min, val));
      const decs = (String(step).split('.')[1] || '').length;
      if (decs) val = parseFloat(val.toFixed(decs));
      rng.value = String(val);
      try { rng.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) { try { rng.oninput && rng.oninput(); } catch (_) {} }
    }, { passive: false });
  } catch (_) {}
}

export function presentSettingsPanel() {
  // Always use overlay modal. No fallback panel.
  try { presentSettingsOverlay(); } catch (_) {}
}

// No closeSettingsPanel: overlay handles dismissal via OverlayManager


function makeSection(title, desc, hrPosition, inlineQuip = false) {
  // hrPosition: undefined | 'afterTitle' | 'afterQuip'
  const wrap = document.createElement('div');

  // Title element (shared styles)
  const t = document.createElement('div');
  t.textContent = title;
  // Standardize via CSS variables with sensible fallbacks
  t.style.fontSize = 'var(--ui-section-title-size, var(--ui-title-size, 1.5rem))';
  t.style.fontWeight = 'var(--ui-section-title-weight, var(--ui-title-weight, 700))';
  t.style.lineHeight = 'var(--settings-sec-subtitle-line, 1.25)';
  // Ensure consistent foreground color (locked token)
  t.style.color = 'var(--ui-fg, #eee)';

  // Helper to create a themed horizontal rule
  function makeHr() {
    const hr = document.createElement('div');
    hr.style.height = '1px';
    hr.style.width = '100%';
    hr.style.background = 'var(--ui-surface-border, rgba(120,170,255,0.32))';
    hr.style.margin = '0.35rem 0 var(--ui-section-padding-after)';
    return hr;
  }

  if (inlineQuip) {
    // Render title and quip on the same line
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'baseline';
    row.style.flexWrap = 'wrap';
    row.style.width = '100%';
    row.style.gap = '0.5rem';
    row.appendChild(t);

    if (desc) {
      const d = document.createElement('div');
      d.textContent = desc;
      try { d.classList.add('text-quip'); } catch (_) {}
      d.style.fontSize = 'var(--ui-section-quip-size, var(--ui-title-quip-size, 0.9rem))';
      d.style.lineHeight = 'var(--settings-sec-subtitle-line, 1.25)';
      d.style.opacity = 'var(--settings-sec-subtitle-opacity, 0.9)';
      d.style.color = 'var(--ui-fg-quip, #bbb)';
      // Inline quip: no bottom margin; add a small left gap via row.gap
      d.style.margin = '0';
      // Push quip to the far right when on the same line
      d.style.marginLeft = 'auto';
      d.style.textAlign = 'right';
      d.style.minWidth = '0';
      row.appendChild(d);
    }

    wrap.appendChild(row);

    // For inline layout, place rule after the combined row if requested
    if (hrPosition === true || hrPosition === 'afterTitle' || hrPosition === 'afterQuip') {
      wrap.appendChild(makeHr());
    }
  } else {
    // Default stacked layout
    wrap.appendChild(t);

    // If caller asked for a rule immediately after the title
    if (hrPosition === true || hrPosition === 'afterTitle') {
      wrap.appendChild(makeHr());
    }

    if (desc) {
      const d = document.createElement('div');
      d.textContent = desc;
      // Use quip tone + locked quip size
      try { d.classList.add('text-quip'); } catch (_) {}
      d.style.fontSize = 'var(--ui-section-quip-size, var(--ui-title-quip-size, 0.9rem))';
      d.style.lineHeight = 'var(--settings-sec-subtitle-line, 1.25)';
      d.style.opacity = 'var(--settings-sec-subtitle-opacity, 0.9)';
      d.style.color = 'var(--ui-fg-quip, #bbb)';
      d.style.margin = 'var(--settings-sec-subtitle-margin, 0 0 10px 0)';
      wrap.appendChild(d);
      // Optionally place the rule after the quip instead
      if (hrPosition === 'afterQuip') {
        wrap.appendChild(makeHr());
      }
    } else if (hrPosition === 'afterQuip') {
      // No quip provided; fall back to placing after title
      wrap.appendChild(makeHr());
    }
  }

  return wrap;
}

function makeRow(labelText, controlEl) {
  const row = document.createElement('div');
  row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px'; row.style.marginBottom = '8px';
  const lbl = document.createElement('label'); lbl.textContent = labelText;
  row.appendChild(lbl); row.appendChild(controlEl);
  return row;
}

function makeInput(type, value) {
  const i = document.createElement('input'); i.type = type; if (value != null) i.value = value;
  i.style.flex = '1';
  i.onchange = () => { if (type === 'text') try { LS.setItem('name', i.value || ''); } catch (_) {} };
  return i;
}

function makeNote(text) {
  const d = document.createElement('div'); d.textContent = text; d.style.color = 'var(--ui-fg-quip, #bbb)'; d.style.fontSize = '12px'; d.style.marginBottom = '8px';
  return d;
}

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
    // Rename Display -> Theme, and introduce a separate Display tab
    const allTabs = ['Account', 'Profile', 'Theme', 'Display', 'Sound', 'Controls'];

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
    let dirty = false;
    let loggedIn = false;
    let nicknameVal = '';
    let bioVal = '';
    let volAdjustHandler = null;
    // Cache random quips so they don't change on re-render
    let _quipThemeColor = null;
    let _quipSoundMixer = null;
    let _quipNotif = null;

    // Add mouse wheel support for range sliders in overlay
    function attachWheel(rng) {
      try {
        rng.addEventListener('wheel', (e) => {
          // Ignore if user holds modifier keys (allow browser gestures)
          if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
          if (e && e.cancelable !== false) e.preventDefault();
          let step = parseFloat(rng.step);
          if (!Number.isFinite(step)) step = 1;
          let min = parseFloat(rng.min); if (!Number.isFinite(min)) min = 0;
          let max = parseFloat(rng.max); if (!Number.isFinite(max)) max = 100;
          let val = parseFloat(rng.value); if (!Number.isFinite(val)) val = min;
          // Wheel up -> increase, wheel down -> decrease
          val += (e.deltaY < 0 ? step : -step);
          // Clamp and snap to step precision
          val = Math.min(max, Math.max(min, val));
          const decs = (String(step).split('.')[1] || '').length;
          if (decs) val = parseFloat(val.toFixed(decs));
          rng.value = String(val);
          try { rng.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) { try { rng.oninput && rng.oninput(); } catch (_) {} }
        }, { passive: false });
      } catch (_) {}
    }

    // Simple inline-styled confirm overlay within this card
    function presentInlineConfirm(message = 'Discard changes?') {
      return new Promise((resolve) => {
        try {
          const scrim = document.createElement('div');
          scrim.style.position = 'absolute';
          scrim.style.inset = '0';
          scrim.style.background = 'rgba(0,0,0,0.45)';
          scrim.style.backdropFilter = 'blur(1px)';
          scrim.style.display = 'flex';
          scrim.style.alignItems = 'center';
          scrim.style.justifyContent = 'center';
          scrim.style.zIndex = '10';

          const box = document.createElement('div');
          box.style.minWidth = '280px';
          box.style.maxWidth = '90%';
          box.style.background = 'linear-gradient(180deg, rgba(10,18,36,0.52) 0%, rgba(8,14,28,0.48) 100%)';
          box.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
          box.style.borderRadius = '10px';
          box.style.boxShadow = '0 0 20px rgba(120,170,255,0.33)';
          box.style.padding = '12px';
          box.style.color = 'var(--ui-fg, #eee)';

          const msg = document.createElement('div');
          msg.textContent = String(message || 'Are you sure?');
          msg.style.marginBottom = '10px';
          msg.style.fontWeight = '600';
          box.appendChild(msg);

          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'flex-end';
          row.style.gap = '8px';

          const noBtn = document.createElement('button');
          noBtn.textContent = 'Cancel';
          const yesBtn = document.createElement('button');
          yesBtn.textContent = 'Discard';
          [noBtn, yesBtn].forEach(b => { b.style.cursor = 'pointer'; b.style.userSelect = 'none'; b.style.borderRadius = '10px'; b.style.padding = '6px 10px'; b.style.fontWeight = '600'; b.style.fontSize = '14px'; b.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.12) 0%, rgba(10,16,22,0.08) 100%)'; b.style.color = '#dff1ff'; b.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.60))'; b.style.boxShadow = 'inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18)'; });

          noBtn.onclick = () => { try { card.removeChild(scrim); } catch (_) {} resolve(false); };
          yesBtn.onclick = () => { try { card.removeChild(scrim); } catch (_) {} resolve(true); };

          row.appendChild(noBtn); row.appendChild(yesBtn);
          box.appendChild(row);
          scrim.appendChild(box);
          card.appendChild(scrim);
          try { yesBtn.focus(); } catch (_) {}
        } catch (_) { resolve(false); }
      });
    }

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

    function setDirty(v) { dirty = !!v; }

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
        renderProfileTab({
          container: contentWrap,
          makeSection,
          makeNote,
          createInputRow,
          wireFocusHighlight,
          UI,
          LS,
          headerTitle: 'Profile',
          headerDesc: '',
          loggedIn: !!loggedIn,
          variant: 'overlay',
          getNickname: () => nicknameVal,
          setNickname: (v) => { nicknameVal = String(v || ''); },
          getBio: () => bioVal,
          setBio: (v) => { bioVal = String(v || ''); },
          setDirty: (v) => setDirty(!!v),
          reRender: () => render()
        });
      } else if (tab === 'Theme') {
        // Overlay Theme tab: delegate to modular renderer with cached quip subtitle
        if (_quipThemeColor == null) {
          const colorQuips = [
            "They say color defines your personality. What's yours?",
            'Death knows no color, but we do.',
            'Paint the town red. Or any other color you want.',
            'Hue today, gone tomorrow.',
            'Saturate your soul.',
            'Pick a vibe, survive the dungeon.',
            'Red increases your damage rolls. Source? Trust me bro.',
            'Those color knobs took forever to code. Use them wisely.',
            'If your colors suck, I might change them back.',
            "Reminder: colors can’t fix a lack of skill.",
            "Pick a color. Regret is free.",
          ];
          _quipThemeColor = getQuip('settings.overlay.themeTag', colorQuips);
        }
        renderThemeTab({
          variant: 'overlay',
          container: contentWrap,
          makeSection,
          attachWheel,
          attachHover,
          headerTitle: 'Overall Color',
          headerDesc: _quipThemeColor
        });
      } else if (tab === 'Display') {
        renderDisplayTab({
          container: contentWrap,
          makeSection,
          headerTitle: 'Display',
          headerDesc: 'Legibility and scale.',
          variant: 'overlay'
        });
      } else if (tab === 'Sound')  {
        // Clean up any previous overlay listener before re-attaching via tab module
        try {
          if (volAdjustHandler) {
            if (typeof volAdjustHandler === 'function') volAdjustHandler();
            else window.removeEventListener('ui:volume:adjusting', volAdjustHandler);
          }
        } catch (_) {}
        // Render Sound tab via module; capture cleanup function
        volAdjustHandler = renderSoundTab({
          container: contentWrap,
          makeSection,
          makeNote,
          variant: 'overlay',
          setDirty
        });
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

    // Resolve auth, drafts, and server profile, then conditionally render
    (async () => {
      const prevLoggedIn = loggedIn;
      const prevNick = nicknameVal;
      try { loggedIn = !!(await getUser()); } catch (_) { loggedIn = false; }
      // Load local drafts first
      try { nicknameVal = LS.getItem('draft:nickname', '') || ''; } catch (_) {}
      try { bioVal = LS.getItem('draft:bio', '') || ''; } catch (_) {}
      // If logged in and no local nickname draft, prefill from server profile (creates one if missing)
      if (loggedIn && !nicknameVal) {
        try {
          const prof = await ensureProfileForCurrentUser();
          if (prof && prof.display_name && !nicknameVal) nicknameVal = String(prof.display_name);
        } catch (_) {}
      }
      // Only re-render if we're on Account/Profile and auth or nickname changed
      const tabNeedsAuth = (activeTab === 'Account' || activeTab === 'Profile');
      if (tabNeedsAuth && (loggedIn !== prevLoggedIn || nicknameVal !== prevNick)) {
        render();
      }
    })();

    // Initial render (before async auth completes)
    render();

    return true;
  } catch (_) {
    return false;
  }
}

// Optional global exposure for quick access/debug
window.presentSettingsPanel = presentSettingsPanel;
window.setSettingsAuth = setSettingsAuth;
