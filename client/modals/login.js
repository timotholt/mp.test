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

  // If already authenticated (e.g., after OAuth redirect), skip UI and proceed
  try { getUser().then(u => { if (u && u.id) afterAuthSuccess(id); }); } catch (_) {}

  const title = document.createElement('div');
  title.textContent = 'Welcome to Hack40k';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '20px';
  title.style.marginBottom = '10px';

  const sub = document.createElement('div');
  sub.textContent = 'Sign in with a provider or email. We only roll critical hits on privacy.';
  sub.style.opacity = '0.8';
  sub.style.marginBottom = '8px';

  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '8px';
  buttons.style.flexWrap = 'wrap';

  const mkBtn = (label, onClick) => {
    const b = document.createElement('button');
    b.textContent = label;
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

  const googleBtn = mkBtn('Continue with Google', () => signInWithProvider('google'));
  const discordBtn = mkBtn('Continue with Discord', () => signInWithProvider('discord'));
  const facebookBtn = mkBtn('Continue with Facebook', () => signInWithProvider('facebook'));

  buttons.appendChild(googleBtn);
  buttons.appendChild(discordBtn);
  buttons.appendChild(facebookBtn);

  const sep = document.createElement('div');
  sep.textContent = '— or —';
  sep.style.margin = '8px 0';
  sep.style.opacity = '0.8';

  const form = document.createElement('div');
  form.style.display = 'grid';
  form.style.gridTemplateColumns = 'auto 1fr';
  form.style.alignItems = 'center';
  form.style.gap = '6px 8px';

  const emailLabel = document.createElement('label'); emailLabel.textContent = 'Email:';
  const emailInput = document.createElement('input'); emailInput.type = 'email'; emailInput.placeholder = 'you@grim.dark';
  const passLabel = document.createElement('label'); passLabel.textContent = 'Password:';
  const passInput = document.createElement('input'); passInput.type = 'password'; passInput.placeholder = '••••••••';

  form.appendChild(emailLabel); form.appendChild(emailInput);
  form.appendChild(passLabel); form.appendChild(passInput);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '8px';

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
  actions.appendChild(signInBtn);
  actions.appendChild(signUpBtn);
  actions.appendChild(resetBtn);

  const status = document.createElement('div');
  status.id = 'login-status';
  status.style.marginTop = '8px';
  status.style.minHeight = '1.2em';
  status.style.color = 'var(--sf-tip-fg, #eee)';

  function setStatus(msg) { status.textContent = msg || ''; }
  function disableAll(disabled) {
    [googleBtn, discordBtn, facebookBtn, signInBtn, signUpBtn, resetBtn, emailInput, passInput].forEach(el => { try { el.disabled = !!disabled; } catch (_) {} });
  }

  content.appendChild(title);
  content.appendChild(sub);
  content.appendChild(buttons);
  content.appendChild(sep);
  content.appendChild(form);
  content.appendChild(actions);
  content.appendChild(status);
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
