// Reset Password Request Confirmation Modal — small confirmation per UI guidelines
// Lives under client/modals/. Minimal inline styles; matches Login/Create aesthetics.

import { presentLoginModal } from './login.js';
import { getQuip } from '../core/ui/quip.js';
import { ensureGlassFormStyles } from '../core/ui/formBase.js';

export function presentResetPasswordRequestModal(emailValue) {
  // Ensure shared glass form styles (buttons/inputs/icons) are injected once
  try { ensureGlassFormStyles(); } catch (_) {}
  const id = 'RESET_PASSWORD_REQUEST_MODAL';
  const PRIORITY = (window.PRIORITY || { MEDIUM: 50 });
  try {
    if (window.OverlayManager) {
      window.OverlayManager.present({ id, text: '', actions: [], blockInput: true, priority: PRIORITY.MEDIUM });
    }
  } catch (_) {}

  const overlay = document.getElementById('overlay');
  const content = overlay ? overlay.querySelector('#overlay-content') : null;
  if (!content) return;
  content.innerHTML = '';

  // Backdrop + content container styles consistent with other modals
  try { overlay.style.background = 'radial-gradient(1200px 600px at 50% 10%, rgba(12,24,48,0.65) 0%, rgba(4,8,18,0.75) 60%, rgba(2,4,10,0.85) 100%)'; } catch (_) {}
  try {
    content.style.background = 'transparent';
    content.style.border = 'none';
    content.style.boxShadow = 'none';
    content.style.padding = '0';
    content.style.maxWidth = 'unset';
    content.style.margin = '0';
  } catch (_) {}

  const center = document.createElement('div');
  center.style.minHeight = '100vh';
  center.style.display = 'flex';
  center.style.alignItems = 'center';
  center.style.justifyContent = 'center';
  center.style.padding = '24px';
  // Slight upward nudge for visual parity
  center.style.transform = 'translateY(-2vh)';

  const card = document.createElement('div');
  card.style.width = 'min(420px, calc(100vw - 32px))';
  card.style.color = 'var(--ui-fg, #eee)';
  card.style.borderRadius = '14px';
  card.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,36,0.48)) 0%, var(--ui-surface-bg-bottom, rgba(8,14,28,0.44)) 100%)';
  card.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  card.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
  card.style.backdropFilter = 'var(--sf-tip-backdrop, blur(3px) saturate(1.2))';
  card.style.padding = '16px';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';

  const title = document.createElement('div');
  title.textContent = 'Reset Password Request Received';
  title.style.fontSize = '22px';
  title.style.fontWeight = '700';
  title.style.marginBottom = '2px';
  title.style.userSelect = 'none';

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
  try { subtitle.style.fontSize = '13px'; subtitle.style.opacity = '0.9'; subtitle.style.margin = '0 0 20px 0'; subtitle.style.color = 'var(--ui-fg, #eee)'; subtitle.style.userSelect = 'none'; } catch (_) {}

  const message = document.createElement('div');
  message.style.userSelect = 'none';
  message.style.minHeight = '1.2em';
  message.style.marginTop = '4px';
  // UX: do not confirm existence; phrase conditionally
  const shown = String(emailValue || '').trim();
  message.textContent = `If an account exists for email address ${shown}, a reset email has been sent.`;

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.justifyContent = 'flex-end';
  // Ensure readable whitespace between message and the button
  actions.style.marginTop = '16px';

  const goLogin = makeBtn('Go To Login');
  // Simple hover states to match other modals
  wireBtnHover(goLogin);
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
  content.appendChild(center);

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

function makeBtn(label) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cursor = 'pointer';
  b.style.userSelect = 'none';
  b.style.borderRadius = '10px';
  b.style.padding = '10px 12px';
  b.style.fontWeight = '600';
  b.style.fontSize = '14px';
  b.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.12) 0%, rgba(10,16,22,0.08) 100%)';
  b.style.color = '#dff1ff';
  b.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  b.style.boxShadow = 'inset 0 0 14px rgba(40,100,200,0.12), 0 0 16px rgba(120,170,255,0.22)';
  return b;
}

function wireBtnHover(b) {
  try {
    const baseBorder = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
    const baseShadow = 'inset 0 0 14px rgba(40,100,200,0.12), 0 0 16px rgba(120,170,255,0.22)';
    const hoverShadow = 'inset 0 0 18px rgba(60,140,240,0.18), 0 0 20px rgba(140,190,255,0.30)';
    const applyBase = () => {
      b.style.opacity = '1'; b.style.cursor = 'pointer'; b.style.color = '#dff1ff';
      b.style.border = baseBorder; b.style.boxShadow = baseShadow;
    };
    b.addEventListener('mouseenter', () => { b.style.borderColor = '#dff1ff'; b.style.boxShadow = hoverShadow; });
    b.addEventListener('mouseleave', applyBase);
    b.addEventListener('focus', () => { b.style.borderColor = '#dff1ff'; b.style.boxShadow = hoverShadow; });
    b.addEventListener('blur', applyBase);
    applyBase();
  } catch (_) {}
}
