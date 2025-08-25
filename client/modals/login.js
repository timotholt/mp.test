// Login Modal & Backdrop (plain JS)
// Real Supabase auth (OAuth + email/password). Modal lives under client/modals/ per project rule.
// Depends on global OverlayManager and PRIORITY. Keeps exported names the same.
import * as LS from '../core/localStorage.js';
import {
  initSupabase,
  signInWithProvider,
  signInWithPassword,
  signUpWithPassword,
  sendPasswordReset,
  ensureProfileForCurrentUser,
  getUser,
} from '../core/auth/supabaseAuth.js';
import { attachTooltip, updateTooltip } from '../core/ui/tooltip.js';
import { getRandomLoginPhrase } from '../core/util/loginPhrases.js';

function ensureLoginStyles() {
  if (document.getElementById('login-modal-style')) return;
  const st = document.createElement('style');
  st.id = 'login-modal-style';
  st.textContent = `
  /* Page backdrop tint (deep blue) applied to #overlay by presentLoginModal */
  .login-center { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .login-card {
    width: min(720px, calc(100vw - 32px));
    color: #dff1ff;
    border-radius: 14px;
    background: linear-gradient(180deg,
      var(--ui-surface-bg-top, rgba(10,18,36,0.48)) 0%,
      var(--ui-surface-bg-bottom, rgba(8,14,28,0.44)) 100%
    );
    border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    box-shadow: var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33));
    backdrop-filter: var(--sf-tip-backdrop, blur(8px) saturate(1.25));
    padding: 1rem; /* Ensure inner padding so nothing touches edges */
  }
  .login-title { font-size: 22px; font-weight: 700; margin: 0 0 6px 0; }
  .login-sub { opacity: 0.9; margin: 0 0 14px 0; }
  .login-providers { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin: 12px 0 10px 0; }
  .btn { cursor: pointer; user-select: none; border-radius: 10px; padding: 10px 12px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 10px; justify-content: center; }
  .btn:disabled { opacity: 0.6; cursor: default; }
  .btn-outline-glass {
    background: linear-gradient(180deg, rgba(10,18,26,0.12) 0%, rgba(10,16,22,0.08) 100%);
    color: #dff1ff;
    border: 1px solid rgba(120,170,255,0.60);
    box-shadow: inset 0 0 14px rgba(40,100,200,0.12), 0 0 16px rgba(120,170,255,0.22);
  }
  .btn-outline-glass:hover { border-color: #dff1ff; box-shadow: inset 0 0 18px rgba(60,140,240,0.18), 0 0 20px rgba(140,190,255,0.30); }
  .btn svg { width: 18px; height: 18px; }
  .login-sep { text-align: center; opacity: 0.9; margin: 10px 0; }
  .login-form { display: grid; grid-template-columns: max-content 1fr; align-items: center; gap: 6px 10px; margin-top: 8px; }
  .login-form label { opacity: 0.95; text-align: right; }
  .input-glass { 
    width: 100%; color: #eaf6ff; background: linear-gradient(180deg, rgba(10,18,26,0.20) 0%, rgba(10,16,22,0.16) 100%);
    border: 1px solid rgba(120,170,255,0.60); border-radius: 10px; padding: 9px 10px;
    outline: none; box-shadow: inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18);
    backdrop-filter: blur(6px) saturate(1.2);
    box-sizing: border-box; max-width: 100%; /* Prevent overflow so it never touches card edge */
  }
  .input-glass::placeholder { color: rgba(220,235,255,0.65); }
  .input-glass:hover { border-color: #dff1ff; }
  .input-glass:focus { border-color: #dff1ff; box-shadow: inset 0 0 16px rgba(60,140,240,0.18), 0 0 18px rgba(140,190,255,0.30); }
  .login-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .login-status { margin-top: 10px; min-height: 1.2em; color: var(--sf-tip-fg, #eee); }
  /* Two-column layout inside the modal */
  .login-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 1rem; align-items: stretch; }
  .login-art { border-radius: 10px; border: 1px dashed rgba(120,170,255,0.45); min-height: 220px; background: linear-gradient(180deg, rgba(10,18,36,0.20), rgba(8,14,28,0.16)); }
  .login-main { display: flex; flex-direction: column; min-width: 0; }
  @media (max-width: 700px) { .login-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(st);
}

function icon(name) {
  const wrap = document.createElement('span');
  wrap.setAttribute('aria-hidden', 'true');
  // Simple inline SVGs (from Simple Icons), sized via CSS
  if (name === 'google') {
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 12v3.6h5.1c-.22 1.34-1.54 3.93-5.1 3.93-3.07 0-5.58-2.54-5.58-5.67S8.93 8.19 12 8.19c1.75 0 2.92.74 3.59 1.38l2.45-2.36C16.73 5.83 14.6 5 12 5 6.98 5 2.9 9.03 2.9 14.06 2.9 19.09 6.98 23.12 12 23.12c6.93 0 9.55-4.85 9.55-8.01 0-.54-.06-.95-.13-1.36H12z"/></svg>';
  } else if (name === 'discord') {
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.369A19.791 19.791 0 0 0 16.558 3c-.2.36-.438.848-.6 1.232a18.27 18.27 0 0 0-3.917 0A12.36 12.36 0 0 0 11.44 3c-1.436.26-2.796.7-4.117 1.369C4.1 7.753 3.38 11.042 3.64 14.29c1.7 1.265 3.34 2.033 4.94 2.537.4-.553.76-1.137 1.07-1.75-.59-.22-1.15-.5-1.69-.82.14-.1.27-.2.4-.3 3.26 1.53 6.79 1.53 10.01 0 .14.1.27.2.4.3-.53.32-1.09.6-1.68.82.31.613.67 1.197 1.07 1.75 1.6-.504 3.24-1.272 4.94-2.537.4-4.76-.83-8.01-3.79-9.921ZM8.68 13.337c-.98 0-1.78-.9-1.78-2.005 0-1.106.79-2.005 1.78-2.005.98 0 1.79.9 1.78 2.005 0 1.106-.79 2.005-1.78 2.005Zm6.64 0c-.98 0-1.78-.9-1.78-2.005 0-1.106.79-2.005 1.78-2.005.99 0 1.79.9 1.78 2.005 0 1.106-.79 2.005-1.78 2.005Z"/></svg>';
  } else if (name === 'facebook') {
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24h11.495v-9.294H9.691V11.01h3.129V8.414c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.794.143v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.763v2.315h3.587l-.467 3.696h-3.12V24h6.116C23.407 24 24 23.407 24 22.676V1.325C24 .593 23.407 0 22.675 0Z"/></svg>';
  }
  return wrap;
}

export function presentLoginModal() {
  initSupabase();
  const id = 'LOGIN_MODAL';
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
  // Apply deep blue translucent backdrop to overlay and make content transparent; center our card
  try { overlay.style.background = 'radial-gradient(1200px 600px at 50% 10%, rgba(12,24,48,0.65) 0%, rgba(4,8,18,0.75) 60%, rgba(2,4,10,0.85) 100%)'; } catch (_) {}
  try {
    content.style.background = 'transparent';
    content.style.border = 'none';
    content.style.boxShadow = 'none';
    content.style.padding = '0';
    content.style.maxWidth = 'unset';
    content.style.margin = '0';
  } catch (_) {}
  ensureLoginStyles();

  // If already authenticated (e.g., after OAuth redirect), skip UI and proceed
  try { getUser().then(u => { if (u && u.id) afterAuthSuccess(id); }); } catch (_) {}

  // Build centered card
  const center = document.createElement('div');
  center.className = 'login-center';
  const card = document.createElement('div');
  card.className = 'login-card';

  const title = document.createElement('div');
  title.className = 'login-title';
  title.textContent = 'Welcome to Grimdark';

  const sub = document.createElement('div');
  sub.className = 'login-sub';
  sub.textContent = 'Sign in with a provider or email. ' + getRandomLoginPhrase();

  const buttons = document.createElement('div');
  buttons.className = 'login-providers';

  const mkBtn = (label, onClick) => {
    const b = document.createElement('button');
    b.className = 'btn btn-outline-glass';
    const txt = document.createElement('span');
    txt.textContent = label;
    b.appendChild(txt);
    b.onclick = async () => {
      setStatus('');
      try {
        disableAll(true);
        await onClick();
      } catch (e) {
        setStatus((e && (e.message || e)) || 'Auth failed');
      } finally {
        disableAll(false);
      }
    };
    return b;
  };

  const googleBtn = mkBtn('Google', () => signInWithProvider('google'));
  try { googleBtn.insertBefore(icon('google'), googleBtn.firstChild); } catch (_) {}
  const discordBtn = mkBtn('Discord', () => signInWithProvider('discord'));
  try { discordBtn.insertBefore(icon('discord'), discordBtn.firstChild); } catch (_) {}
  const facebookBtn = mkBtn('Facebook', () => signInWithProvider('facebook'));
  try { facebookBtn.insertBefore(icon('facebook'), facebookBtn.firstChild); } catch (_) {}
  // Far-mode tooltips for providers
  try { attachTooltip(googleBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(googleBtn, 'Continue with Google'); } catch (_) {}
  try { attachTooltip(discordBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(discordBtn, 'Continue with Discord'); } catch (_) {}
  try { attachTooltip(facebookBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(facebookBtn, 'Continue with Facebook'); } catch (_) {}

  buttons.appendChild(googleBtn);
  buttons.appendChild(discordBtn);
  buttons.appendChild(facebookBtn);

  const sep = document.createElement('div');
  sep.className = 'login-sep';
  sep.textContent = '— or —';

  const form = document.createElement('div');
  form.className = 'login-form';

  const emailLabel = document.createElement('label'); emailLabel.textContent = 'Email:';
  const emailInput = document.createElement('input'); emailInput.type = 'email'; emailInput.placeholder = 'you@grim.dark'; emailInput.className = 'input-glass';
  const passLabel = document.createElement('label'); passLabel.textContent = 'Password:';
  const passInput = document.createElement('input'); passInput.type = 'password'; passInput.placeholder = '••••••••'; passInput.className = 'input-glass';
  try { attachTooltip(emailInput, { mode: 'far' }); updateTooltip(emailInput, 'Enter your email address'); } catch (_) {}
  try { attachTooltip(passInput, { mode: 'far' }); updateTooltip(passInput, 'Enter your password'); } catch (_) {}

  form.appendChild(emailLabel); form.appendChild(emailInput);
  form.appendChild(passLabel); form.appendChild(passInput);

  const actions = document.createElement('div');
  actions.className = 'login-actions';

  const signInBtn = mkBtn('Sign In', async () => {
    await signInWithPassword(String(emailInput.value || '').trim(), String(passInput.value || ''));
    await afterAuthSuccess(id);
  });
  const signUpBtn = mkBtn('Create Account', async () => {
    await signUpWithPassword(String(emailInput.value || '').trim(), String(passInput.value || ''));
    setStatus('Check your email for a verification link. Then sign in.');
  });
  const resetBtn = mkBtn('Reset Password', async () => {
    await sendPasswordReset(String(emailInput.value || '').trim());
    setStatus('Password reset sent (if the email exists).');
  });
  // Tooltips on action buttons
  try { attachTooltip(signInBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(signInBtn, 'Sign In'); } catch (_) {}
  try { attachTooltip(signUpBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(signUpBtn, 'Create Account'); } catch (_) {}
  try { attachTooltip(resetBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(resetBtn, 'Reset Password'); } catch (_) {}
  actions.appendChild(signInBtn);
  actions.appendChild(signUpBtn);
  actions.appendChild(resetBtn);

  const status = document.createElement('div');
  status.id = 'login-status';
  status.className = 'login-status';

  function setStatus(msg) { status.textContent = msg || ''; }
  function disableAll(disabled) {
    [googleBtn, discordBtn, facebookBtn, signInBtn, signUpBtn, resetBtn, emailInput, passInput].forEach(el => { try { el.disabled = !!disabled; } catch (_) {} });
  }

  const grid = document.createElement('div'); grid.className = 'login-grid';
  const art = document.createElement('div'); art.className = 'login-art';
  const main = document.createElement('div'); main.className = 'login-main';

  main.appendChild(title);
  main.appendChild(sub);
  main.appendChild(buttons);
  main.appendChild(sep);
  main.appendChild(form);
  main.appendChild(actions);
  main.appendChild(status);

  grid.appendChild(art);
  grid.appendChild(main);
  card.appendChild(grid);
  center.appendChild(card);
  content.appendChild(center);
}

async function afterAuthSuccess(modalId) {
  try {
    const profile = await ensureProfileForCurrentUser();
    let display = null;
    if (profile && profile.display_name) display = String(profile.display_name);
    if (!display) {
      const u = await getUser();
      const base = (u?.email || '').split('@')[0] || 'Hero';
      display = base.replace(/[^a-zA-Z0-9_\-]/g, '') || 'Hero';
    }
    LS.setItem('name', display);
  } catch (_) {}

  try { if (window.OverlayManager) window.OverlayManager.dismiss(modalId); } catch (_) {}
  if (typeof window.startLobby === 'function') {
    window.startLobby();
  } else {
    window.dispatchEvent(new CustomEvent('hack40k:startLobby'));
  }
}

export function showLoginBackdrop() {
  // Ensure renderer container exists and is full-screen and visible.
  const container = document.getElementById('rc-canvas');
  if (container) {
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.display = '';
    container.style.zIndex = '1';
    container.style.pointerEvents = 'none'; // modal handles input
  }
  // Paint a small demo dungeon if nothing has arrived yet
  const demo = buildDemoDungeon();
  if (window.radianceCascades && typeof window.radianceCascades.setDungeonMap === 'function') {
    window.radianceCascades.setDungeonMap(demo);
  } else {
    window.__pendingDungeonMap = demo;
  }
}

function buildDemoDungeon() {
  // Tiny ASCII room with a door; readable even if color maps missing
  const w = 60, h = 24;
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => '#'));
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) grid[y][x] = '.';
  }
  grid[Math.floor(h/2)][0] = '+'; // a door on left
  return grid.map(r => r.join('')).join('\n');
}
