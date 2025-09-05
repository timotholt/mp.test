// Forgot Password Modal — email input + submit, glassmorphism style
// Lives under client/modals/. Minimal inline styles; consistent with login/create account.

import { sendPasswordReset } from '../core/auth/supabaseAuth.js';
import { attachTooltip, updateTooltip } from '../core/ui/tooltip.js';
import { presentLoginModal } from './login.js';
import { presentResetPasswordRequestModal } from './resetRequestConfirm.js';
import { getQuip } from '../core/ui/quip.js';
import { ensureGlassFormStyles } from '../core/ui/formBase.js';

export function presentForgotPasswordModal() {
  // Ensure shared glass form styles (buttons/inputs/icons) are injected once
  try { ensureGlassFormStyles(); } catch (_) {}
  const id = 'FORGOT_PASSWORD_MODAL';
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

  // Deep blue translucent backdrop using theme variables; transparent content
  try {
    overlay.style.background = 'radial-gradient(1200px 600px at 50% 10%, '
      + 'var(--ui-surface-bg-top, rgba(12,24,48,0.65)) 0%, '
      + 'var(--ui-surface-bg-bottom, rgba(4,8,18,0.75)) 60%, '
      + 'var(--ui-surface-bg-bottom, rgba(2,4,10,0.85)) 100%)';
  } catch (_) {}
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
  // Slight upward nudge to match Login/Create
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
  // Make the card a column so actions can pin to the bottom
  card.style.display = 'flex';
  card.style.flexDirection = 'column';

  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = 'Reset Password';
  try { title.style.marginBottom = '2px'; } catch (_) {}

  // Subtitle with random grimdark quips (20), styled per uiStandards
  const quips = [
    'A whisper in the dark says: change your key.',
    'Even shadows forget. We won’t — verify anew.',
    'The dungeon keeps secrets. Rotate yours.',
    'Keys rust in the abyss. Forge another.',
    'Mistakes drift like echoes. Reset and return.',
    'A lost password isn’t the end—only a turning.',
    'The gate creaks. Offer it a new sigil.',
    'Trust is a candle; relight it.',
    'Courage, then cadence. Reset, then stride.',
    'The lock smiles. Show it a fresh grin.',
    'When memory falters, resolve sharpens.',
    'New key, same legend. Continue.',
    'The dark tests; you adapt.',
    'Let the old password rest. Raise the new.',
    'All doors can open — bring the right word.',
    'From error, a path. From path, return.',
    'Your tale pauses, not ends. Reset onward.',
    'A seal breaks; another is set.',
    'Ink fades; intention doesn’t. Reset.',
    'The vault is patient. So are you.'
  ];
  const subtitle = document.createElement('div');
  // Centralized rotating quip for consistency
  subtitle.textContent = getQuip('auth.forgot.tagline', quips);
  subtitle.className = 'modal-title-quip';
  try { subtitle.style.margin = '0 0 20px 0'; } catch (_) {}

  const form = document.createElement('div');
  form.style.display = 'grid';
  form.style.gridTemplateColumns = 'max-content 1fr';
  form.style.gap = '10px';
  form.style.alignItems = 'center';

  const emailLabel = document.createElement('label'); emailLabel.textContent = 'Email:'; try { emailLabel.style.userSelect = 'none'; } catch (_) {}
  const email = document.createElement('input'); email.type = 'email'; email.placeholder = 'Enter email address';
  try { email.className = 'input-glass'; } catch (_) {}
  styleInput(email);

  form.appendChild(emailLabel); form.appendChild(email);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.justifyContent = 'flex-end';
  // Pin actions to modal bottom
  actions.style.marginTop = 'auto';

  const sendBtn = makeBtn('Send Reset Link');
  const cancelBtn = makeBtn('Cancel');
  // Bottom action row tooltips should prefer bottom placement
  try { attachTooltip(sendBtn, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(sendBtn, 'Enter a valid email to send reset link'); } catch (_) {}
  try { attachTooltip(cancelBtn, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(cancelBtn, 'Return to the login page'); } catch (_) {}

  const status = document.createElement('div');
  status.style.marginTop = '8px';
  status.style.minHeight = '1.2em';
  status.style.userSelect = 'none';

  // Hover/focus behavior to match Login/Create
  function wireBtnHover(b) {
    try {
      const baseBorder = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
      const baseShadow = 'var(--ui-surface-glow-inset, inset 0 0 14px rgba(40,100,200,0.12)), var(--ui-surface-glow-outer, 0 0 16px rgba(120,170,255,0.22))';
      const hoverShadow = 'var(--ui-surface-glow-inset, inset 0 0 18px rgba(60,140,240,0.18)), var(--ui-surface-glow-outer, 0 0 20px rgba(140,190,255,0.30))';
      const applyBase = () => {
        if (b.disabled) {
          b.style.opacity = '0.5'; b.style.cursor = 'default'; b.style.color = 'var(--ui-fg-weak, #aaa)';
          b.style.border = baseBorder; b.style.boxShadow = baseShadow;
        } else {
          b.style.opacity = '1'; b.style.cursor = 'pointer'; b.style.color = 'var(--ui-fg, #eee)';
          b.style.border = baseBorder; b.style.boxShadow = baseShadow;
        }
      };
      b.addEventListener('mouseenter', () => { if (b.disabled) return; b.style.borderColor = 'var(--ui-bright, #dff1ff)'; b.style.boxShadow = hoverShadow; });
      b.addEventListener('mouseleave', applyBase);
      b.addEventListener('focus', () => { if (b.disabled) return; b.style.borderColor = 'var(--ui-bright, #dff1ff)'; b.style.boxShadow = hoverShadow; });
      b.addEventListener('blur', applyBase);
      applyBase();
    } catch (_) {}
  }
  function wireInputHoverFocus(input) {
    try {
      const baseBorder = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
      const baseShadow = 'var(--ui-surface-glow-inset, inset 0 0 12px rgba(40,100,200,0.10)), var(--ui-surface-glow-outer, 0 0 12px rgba(120,170,255,0.18))';
      const focusShadow = 'var(--ui-surface-glow-inset, inset 0 0 16px rgba(60,140,240,0.18)), var(--ui-surface-glow-outer, 0 0 18px rgba(140,190,255,0.30))';
      input.addEventListener('mouseenter', () => { if (document.activeElement !== input) input.style.borderColor = 'var(--ui-bright, #dff1ff)'; });
      input.addEventListener('mouseleave', () => { if (document.activeElement !== input) input.style.border = baseBorder; });
      input.addEventListener('focus', () => { input.style.borderColor = 'var(--ui-bright, #dff1ff)'; input.style.boxShadow = focusShadow; });
      input.addEventListener('blur', () => { input.style.border = baseBorder; input.style.boxShadow = baseShadow; });
    } catch (_) {}
  }
  // Start with Send disabled until valid email
  try { sendBtn.disabled = true; } catch (_) {}
  wireBtnHover(sendBtn); wireBtnHover(cancelBtn);
  wireInputHoverFocus(email);

  // Email validation + dynamic Send button state/tooltip
  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val || '').trim());
  function updateSendState() {
    const e = String(email.value || '').trim();
    const ok = isValidEmail(e);
    try { sendBtn.disabled = !ok; } catch (_) {}
    try { updateTooltip(sendBtn, ok ? 'Send reset link' : 'Enter a valid email to send reset link'); } catch (_) {}
    // Refresh visuals to reflect disabled/enabled
    try { sendBtn.dispatchEvent(new Event('mouseleave')); } catch (_) {}
  }
  email.addEventListener('input', updateSendState);
  updateSendState();

  sendBtn.onclick = async () => {
    setStatus('');
    const e = String(email.value || '').trim();
    if (!isValidEmail(e)) { setStatus('Please enter a valid email.'); return; }
    try {
      disable(true);
      await sendPasswordReset(e);
      // After a successful request, show confirmation modal and close this one
      try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
      try { presentResetPasswordRequestModal(e); } catch (_) {}
    } catch (err) {
      setStatus(err && (err.message || String(err)) || 'Unable to send reset email');
    } finally {
      disable(false);
      // Refresh button visuals after disabled state changes
      try { sendBtn.dispatchEvent(new Event('mouseleave')); cancelBtn.dispatchEvent(new Event('mouseleave')); } catch (_) {}
    }
  };
  cancelBtn.onclick = () => {
    try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
    try { presentLoginModal(); } catch (_) {}
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(sendBtn);

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(form);
  card.appendChild(status);
  card.appendChild(actions);
  center.appendChild(card);
  content.appendChild(center);

  // Focus trap: Email → Cancel → Send (if enabled) → back to Email
  try {
    const getFocusables = () => {
      const arr = [email, cancelBtn];
      if (!sendBtn.disabled) arr.push(sendBtn);
      return arr;
    };
    const trap = (ev) => {
      if (ev.key !== 'Tab') return;
      const f = getFocusables();
      if (!f.length) return;
      const idx = f.indexOf(document.activeElement);
      ev.preventDefault();
      if (ev.shiftKey) {
        const prev = idx <= 0 ? f[f.length - 1] : f[idx - 1];
        try { prev.focus(); } catch (_) {}
      } else {
        const next = idx < 0 || idx >= f.length - 1 ? f[0] : f[idx + 1];
        try { next.focus(); } catch (_) {}
      }
    };
    card.addEventListener('keydown', trap);
    // Initial focus
    try { email.focus(); } catch (_) {}
  } catch (_) {}

  function setStatus(msg) { status.textContent = msg || ''; }
  function disable(d) { [email, sendBtn, cancelBtn].forEach(el => { try { el.disabled = !!d; } catch (_) {} }); }
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
  b.style.color = 'var(--ui-fg, #eee)';
  b.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  b.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 14px rgba(40,100,200,0.12)), var(--ui-surface-glow-outer, 0 0 16px rgba(120,170,255,0.22))';
  return b;
}

function styleInput(input) {
  input.style.width = '100%';
  input.style.color = 'var(--ui-fg, #eee)';
  input.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.20) 0%, rgba(10,16,22,0.16) 100%)';
  input.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  input.style.borderRadius = '10px';
  input.style.padding = '0 10px';
  input.style.height = '46px';
  input.style.outline = 'none';
  input.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 12px rgba(40,100,200,0.10)), var(--ui-surface-glow-outer, 0 0 12px rgba(120,170,255,0.18))';
  input.style.backdropFilter = 'blur(6px) saturate(1.2)';
  input.style.boxSizing = 'border-box';
}
