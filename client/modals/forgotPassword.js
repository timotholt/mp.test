// Forgot Password Modal — email input + submit, glassmorphism style
// Lives under client/modals/. Minimal inline styles; consistent with login/create account.

import { initSupabase, sendPasswordReset } from '../core/auth/supabaseAuth.js';
import { attachTooltip, updateTooltip } from '../core/ui/tooltip.js';
import { presentLoginModal } from './login.js';

export function presentForgotPasswordModal() {
  initSupabase();
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

  // Deep blue translucent backdrop; transparent content
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
  center.style.minHeight = '100%';
  center.style.display = 'flex';
  center.style.alignItems = 'center';
  center.style.justifyContent = 'center';
  center.style.padding = '24px';

  const card = document.createElement('div');
  card.style.width = 'min(520px, calc(100vw - 32px))';
  card.style.color = '#dff1ff';
  card.style.borderRadius = '14px';
  card.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,36,0.48)) 0%, var(--ui-surface-bg-bottom, rgba(8,14,28,0.44)) 100%)';
  card.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  card.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
  card.style.backdropFilter = 'var(--sf-tip-backdrop, blur(8px) saturate(1.25))';
  card.style.padding = '16px';

  const title = document.createElement('div');
  title.textContent = 'Reset Password';
  title.style.fontSize = '22px';
  title.style.fontWeight = '700';
  title.style.marginBottom = '8px';

  const form = document.createElement('div');
  form.style.display = 'grid';
  form.style.gridTemplateColumns = 'max-content 1fr';
  form.style.gap = '10px';
  form.style.alignItems = 'center';

  const emailLabel = document.createElement('label'); emailLabel.textContent = 'Email:';
  const email = document.createElement('input'); email.type = 'email'; email.placeholder = 'Enter email address';
  try { email.className = 'input-glass'; } catch (_) {}
  styleInput(email);

  form.appendChild(emailLabel); form.appendChild(email);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.justifyContent = 'flex-end';
  actions.style.marginTop = '12px';

  const sendBtn = makeBtn('Send Reset Link');
  const cancelBtn = makeBtn('Cancel');
  // Bottom action row tooltips should prefer bottom placement
  try { attachTooltip(sendBtn, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(sendBtn, 'Send reset link'); } catch (_) {}
  try { attachTooltip(cancelBtn, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(cancelBtn, 'Return to the login page'); } catch (_) {}

  const status = document.createElement('div');
  status.style.marginTop = '8px';
  status.style.minHeight = '1.2em';

  // Hover/focus behavior to match Login/Create
  function wireBtnHover(b) {
    try {
      const baseBorder = '1px solid rgba(120,170,255,0.60)';
      const baseShadow = 'inset 0 0 14px rgba(40,100,200,0.12), 0 0 16px rgba(120,170,255,0.22)';
      const hoverShadow = 'inset 0 0 18px rgba(60,140,240,0.18), 0 0 20px rgba(140,190,255,0.30)';
      const applyBase = () => {
        if (b.disabled) {
          b.style.opacity = '0.6'; b.style.cursor = 'default';
          b.style.border = baseBorder; b.style.boxShadow = baseShadow;
        } else {
          b.style.opacity = '1'; b.style.cursor = 'pointer';
          b.style.border = baseBorder; b.style.boxShadow = baseShadow;
        }
      };
      b.addEventListener('mouseenter', () => { if (b.disabled) return; b.style.border = '#dff1ff 1px solid'; b.style.boxShadow = hoverShadow; });
      b.addEventListener('mouseleave', applyBase);
      b.addEventListener('focus', () => { if (b.disabled) return; b.style.border = '#dff1ff 1px solid'; b.style.boxShadow = hoverShadow; });
      b.addEventListener('blur', applyBase);
      applyBase();
    } catch (_) {}
  }
  function wireInputHoverFocus(input) {
    try {
      const baseBorder = '1px solid rgba(120,170,255,0.60)';
      const baseShadow = 'inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18)';
      const focusShadow = 'inset 0 0 16px rgba(60,140,240,0.18), 0 0 18px rgba(140,190,255,0.30)';
      input.addEventListener('mouseenter', () => { if (document.activeElement !== input) input.style.border = '#dff1ff 1px solid'; });
      input.addEventListener('mouseleave', () => { if (document.activeElement !== input) input.style.border = baseBorder; });
      input.addEventListener('focus', () => { input.style.border = '#dff1ff 1px solid'; input.style.boxShadow = focusShadow; });
      input.addEventListener('blur', () => { input.style.border = baseBorder; input.style.boxShadow = baseShadow; });
    } catch (_) {}
  }
  wireBtnHover(sendBtn); wireBtnHover(cancelBtn);
  wireInputHoverFocus(email);

  sendBtn.onclick = async () => {
    setStatus('');
    const e = String(email.value || '').trim();
    if (!e) { setStatus('Please enter your email.'); return; }
    try {
      disable(true);
      await sendPasswordReset(e);
      setStatus('If an account exists, a reset email has been sent.');
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
  card.appendChild(form);
  card.appendChild(actions);
  card.appendChild(status);
  center.appendChild(card);
  content.appendChild(center);

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
  b.style.color = '#dff1ff';
  b.style.border = '1px solid rgba(120,170,255,0.60)';
  b.style.boxShadow = 'inset 0 0 14px rgba(40,100,200,0.12), 0 0 16px rgba(120,170,255,0.22)';
  return b;
}

function styleInput(input) {
  input.style.width = '100%';
  input.style.color = '#eaf6ff';
  input.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.20) 0%, rgba(10,16,22,0.16) 100%)';
  input.style.border = '1px solid rgba(120,170,255,0.60)';
  input.style.borderRadius = '10px';
  input.style.padding = '0 10px';
  input.style.height = '46px';
  input.style.outline = 'none';
  input.style.boxShadow = 'inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18)';
  input.style.backdropFilter = 'blur(6px) saturate(1.2)';
  input.style.boxSizing = 'border-box';
}
