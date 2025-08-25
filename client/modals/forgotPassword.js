// Forgot Password Modal — email input + submit, glassmorphism style
// Lives under client/modals/. Minimal inline styles; consistent with login/create account.

import { initSupabase, sendPasswordReset } from '../core/auth/supabaseAuth.js';

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
  title.style.fontSize = '20px';
  title.style.fontWeight = '700';
  title.style.marginBottom = '8px';

  const form = document.createElement('div');
  form.style.display = 'grid';
  form.style.gridTemplateColumns = 'max-content 1fr';
  form.style.gap = '10px';
  form.style.alignItems = 'center';

  const emailLabel = document.createElement('label'); emailLabel.textContent = 'Email:';
  const email = document.createElement('input'); email.type = 'email'; email.placeholder = 'you@grim.dark';
  styleInput(email);

  form.appendChild(emailLabel); form.appendChild(email);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.justifyContent = 'flex-end';
  actions.style.marginTop = '12px';

  const sendBtn = makeBtn('Send Reset Link');
  const cancelBtn = makeBtn('Cancel');

  const status = document.createElement('div');
  status.style.marginTop = '8px';
  status.style.minHeight = '1.2em';

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
    }
  };
  cancelBtn.onclick = () => { try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {} };

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
