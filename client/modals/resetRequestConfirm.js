// Reset Password Request Confirmation Modal — small confirmation per UI guidelines
// Lives under client/modals/. Minimal inline styles; matches Login/Create aesthetics.

import { presentLoginModal } from './login.js';
import { getQuip } from '../core/ui/quip.js';
import { ensureGlassFormStyles } from '../core/ui/formBase.js';
import { createUiElement, centerViewport, basicCard, basicButton } from '../core/ui/theme/elements.js';

export function presentResetPasswordRequestModal(emailValue) {
  // Ensure shared glass form styles (buttons/inputs/icons) are injected once
  try { ensureGlassFormStyles(); } catch (_) {}
  const id = 'RESET_PASSWORD_REQUEST_MODAL';
  const PRIORITY = (window.PRIORITY || { MEDIUM: 50 });
  try {
    if (window.OverlayManager) {
      // Treat as external so OverlayManager won't wipe #overlay-content; we manage #modal-root
      window.OverlayManager.present({ id, text: '', actions: [], blockInput: true, priority: PRIORITY.MEDIUM, external: true });
    }
  } catch (_) {}

  const overlay = document.getElementById('overlay');
  const content = overlay ? overlay.querySelector('#overlay-content') : null;
  // Render into the stable external modal root
  const contentRoot = document.querySelector('#modal-root');
  if (!contentRoot) return;
  contentRoot.innerHTML = '';

  // Backdrop + content container styles consistent with other modals
  try {
    overlay.style.setProperty('--ui-overlay-bg', 'radial-gradient(75rem 37.5rem at 50% 10%, var(--ui-surface-bg-top, rgba(12,24,48,0.65)) 0%, var(--ui-surface-bg-bottom, rgba(4,8,18,0.75)) 60%, var(--ui-surface-bg-bottom, rgba(2,4,10,0.85)) 100%)');
  } catch (_) {}
  try {
    content.style.background = 'transparent';
    content.style.border = 'none';
    content.style.boxShadow = 'none';
    content.style.padding = '0';
    content.style.maxWidth = 'unset';
    content.style.margin = '0';
  } catch (_) {}

  // Build centered card using standardized theme templates (same as Login)
  const center = createUiElement(centerViewport);
  // Slight upward nudge for visual parity
  center.style.transform = 'translateY(-2vh)';

  const card = createUiElement(basicCard);
  // Narrow width variant for Reset Request Confirm
  card.style.width = 'min(26.25rem, calc(100vw - 2rem))';
  // Match Login hover behavior (no glow by default; glow on hover/focus-within)
  try { card.classList.add('login-card'); } catch (_) {}
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  // Allow internal scroll if content exceeds viewport
  try { card.style.maxHeight = 'calc(100vh - (var(--ui-page-padding, 1.5rem) * 2))'; card.style.overflowY = 'auto'; } catch (_) {}

  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = 'Reset Password Request Received';
  try { title.style.marginBottom = '0.125rem'; } catch (_) {}

  // Subtitle with a short grimdark quips
  const quips = [
    'Keys rust; resolve doesn\'t.',
    'The lock listens for new words.',
    'A candle relit in the dark.',
    'Reset, return, resume the delve.'
  ];
  const subtitle = document.createElement('div');
  // Centralized rotating quip for consistency
  subtitle.textContent = getQuip('auth.resetConfirm.tagline', quips);
  subtitle.className = 'modal-title-quip';
  try { subtitle.style.margin = '0 0 1.25rem 0'; } catch (_) {}

  const message = document.createElement('div');
  message.style.userSelect = 'none';
  message.style.minHeight = '1.2em';
  message.style.marginTop = '0.25rem';
  // UX: do not confirm existence; phrase conditionally
  const shown = String(emailValue || '').trim();
  message.textContent = `If an account exists for email address ${shown}, a reset email has been sent.`;

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '0.625rem';
  actions.style.justifyContent = 'flex-end';
  // Ensure readable whitespace between message and the button
  actions.style.marginTop = '1rem';

  const goLogin = createUiElement(basicButton, 'button', 'Go To Login');
  goLogin.onclick = () => {
    try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
    try { presentLoginModal(); } catch (_) {}
  };

  actions.appendChild(goLogin);

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(message);
  card.appendChild(actions);
  center.appendChild(card);
  contentRoot.appendChild(center);

  // Focus trap: only the Go To Login button is focusable
  try {
    const trap = (ev) => {
      if (ev.key !== 'Tab') return;
      ev.preventDefault();
      try { goLogin.focus(); } catch (_) {}
    };
    card.addEventListener('keydown', trap);
    try { goLogin.focus(); } catch (_) {}
  } catch (_) {}
}

