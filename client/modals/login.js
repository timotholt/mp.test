// Login Modal & Backdrop (plain JS)
// Real Supabase auth (OAuth + email/password). Modal lives under client/modals/ per project rule.
// Depends on global OverlayManager and PRIORITY. Keeps exported names the same.
import * as LS from '../core/localStorage.js';
import {
  initSupabase,
  signInWithProvider,
  signInWithPassword,
  getAccessToken,
  ensureProfileForCurrentUser,
  getUser,
} from '../core/auth/supabaseAuth.js';
import { attachTooltip, updateTooltip } from '../core/ui/tooltip.js';
import { LOGIN_PHRASES } from '../core/util/loginPhrases.js';
import { getQuip } from '../core/ui/quip.js';
import { presentCreateAccountModal } from './createAccount.js';
import { presentForgotPasswordModal } from './forgotPassword.js';
import { shouldAutoReconnect } from '../core/net/reconnect.js';
import { ensureGlassFormStyles } from '../core/ui/formBase.js';
import { createUiElement } from '../core/ui/theme/elements.js';
import { makeCard, makeTitleBlock } from '../core/ui/blocks.js';
import { makeSection, makeRow } from './settings/uiHelpers.js';

// Nuclear-green fallback for any missing CSS variable in this file.
// If you see this color, a theme token is missing or failed to apply.
const FALLBACK_FG_COLOR = '#39ff14';

function ensureLoginStyles() {
  if (document.getElementById('login-modal-style')) return;
  const st = document.createElement('style');
  st.id = 'login-modal-style';
  st.textContent = `
  /* Login-specific layout rules only. Shared styles come from ensureGlassFormStyles(). */
  .login-providers { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin: 12px 0 10px 0; }
  /* Provider buttons fixed height */
  .login-providers .btn { height: 46px; padding-top: 0; padding-bottom: 0; }

  .login-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 16px; }
  .login-links { display: flex; gap: 12px; font-size: 12.5px; align-items: center; justify-content: center; }
  .login-link { color: var(--ui-fg, ${FALLBACK_FG_COLOR}); text-decoration: underline; background: none; border: 0; padding: 0; font: inherit; cursor: pointer; opacity: 0.9; }
  .login-link:hover { color: var(--ui-bright, ${FALLBACK_FG_COLOR}); opacity: 1; }
  .login-status { margin-top: 10px; min-height: 1.2em; color: var(--sf-tip-fg, ${FALLBACK_FG_COLOR}); user-select: none; }

  /* Two-column layout inside the modal */
  .login-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 1rem; align-items: stretch; }
  .login-art { border-radius: 10px; border: var(--ui-surface-border-css, 0.0625rem solid ${FALLBACK_FG_COLOR}); border-style: dashed; min-height: 240px; background: linear-gradient(180deg, rgba(10,18,36,0.20), rgba(8,14,28,0.16)); }
  .login-main { display: flex; flex-direction: column; min-width: 0; }
  @media (max-width: 700px) { .login-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(st);
}

function icon(name) {
  const wrap = document.createElement('div');
  wrap.className = 'icon-wrap icon-' + name;
  wrap.setAttribute('aria-hidden', 'true');
  // Simple inline SVGs (from Simple Icons), sized via CSS via .icon-wrap
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
      // Mark as external so OverlayManager.renderTop() will not clear/replace our DOM
      window.OverlayManager.present({ id, text: '', actions: [], blockInput: true, priority: PRIORITY.MEDIUM, external: true });
    }
  } catch (_) {}

  const overlay = document.getElementById('overlay');
  const content = overlay ? overlay.querySelector('#overlay-content') : null;
  if (!content) return;
  content.innerHTML = '';
  // Apply deep blue translucent backdrop to overlay and make content transparent; center our card
  // Use theme-driven surface variables so hue/intensity affect the backdrop
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
  // Ensure shared glass form styles are present (buttons/inputs/icons)
  try { ensureGlassFormStyles(); } catch (_) {}
  ensureLoginStyles();

  // Only auto-continue when the page load was a reload/back-forward to avoid
  // surprising fresh tabs instantly skipping the login UI.
  try {
    if (shouldAutoReconnect()) {
      getUser().then(u => { if (u && u.id) afterAuthSuccess(id); });
    }
  } catch (_) {}

  // Build centered card using standard UI blocks
  const center = createUiElement({
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--ui-page-padding, 24px)',
    transform: 'translateY(-2vh)'
  });
  const card = makeCard();
  // Constrain width similarly to the legacy style for consistency
  try { card.style.width = 'min(720px, calc(100vw - 32px))'; } catch (_) {}

  // Title and quip via reusable block
  const titleBlock = makeTitleBlock({
    title: 'Welcome to Grimdark',
    desc: getQuip('auth.login.tagline', LOGIN_PHRASES)
  });
  // Preserve previous behavior: do not show a close button in the Login modal
  try {
    if (titleBlock && titleBlock.closeBtn && titleBlock.closeBtn.style) {
      titleBlock.closeBtn.style.display = 'none';
      titleBlock.closeBtn.setAttribute('aria-hidden', 'true');
      titleBlock.closeBtn.tabIndex = -1;
    }
  } catch (_) {}

  // Section header above provider buttons
  const providersHeader = makeSection('Sign in with a provider', '', 'afterTitle', false, false);

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
  // Provider label size bump
  try { const gTxt = googleBtn.lastElementChild; if (gTxt && gTxt.style) gTxt.style.fontSize = '16px'; } catch (_) {}
  const discordBtn = mkBtn('Discord', () => signInWithProvider('discord'));
  try { discordBtn.insertBefore(icon('discord'), discordBtn.firstChild); } catch (_) {}
  // Provider label size bump
  try { const dTxt = discordBtn.lastElementChild; if (dTxt && dTxt.style) dTxt.style.fontSize = '16px'; } catch (_) {}
  const facebookBtn = mkBtn('Facebook', () => signInWithProvider('facebook'));
  try { facebookBtn.insertBefore(icon('facebook'), facebookBtn.firstChild); } catch (_) {}
  // Facebook size is good; just bump provider label size slightly for consistency
  try { const fTxt = facebookBtn.lastElementChild; if (fTxt && fTxt.style) fTxt.style.fontSize = '16px'; } catch (_) {}
  // Far-mode tooltips for providers
  try { attachTooltip(googleBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(googleBtn, 'Continue with Google'); } catch (_) {}
  try { attachTooltip(discordBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(discordBtn, 'Continue with Discord'); } catch (_) {}
  try { attachTooltip(facebookBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(facebookBtn, 'Continue with Facebook'); } catch (_) {}

  buttons.appendChild(googleBtn);
  buttons.appendChild(discordBtn);
  buttons.appendChild(facebookBtn);

  // Email/password section header
  const emailHeader = makeSection('Or email and password', '', 'afterTitle', false, false);

  // Form rows using settings helpers + shared glass inputs
  const form = document.createElement('div');
  form.className = 'login-form';
  const emailLabel = document.createElement('label'); emailLabel.textContent = 'Email';
  const emailInput = document.createElement('input'); emailInput.type = 'email'; emailInput.placeholder = 'Enter email address'; emailInput.className = 'input-glass';
  try { emailInput.id = 'login-email'; } catch (_) {}
  const passLabel = document.createElement('label'); passLabel.textContent = 'Password';
  const passInput = document.createElement('input'); passInput.type = 'password'; passInput.placeholder = 'Enter password'; passInput.className = 'input-glass';
  try { passInput.id = 'login-password'; } catch (_) {}

  // Wrap inputs with optional icons
  const emailWrap = document.createElement('div'); emailWrap.className = 'input-wrap';
  const passWrap = document.createElement('div'); passWrap.className = 'input-wrap';

  // No left icon for email (per request)

  // Right eye icon for password (toggle visibility)
  const eyeBtn = document.createElement('button'); eyeBtn.type = 'button'; eyeBtn.className = 'input-icon-btn right';
  // Not a tab stop per UX
  try { eyeBtn.tabIndex = -1; } catch (_) {}
  // Line-art eye icons (stroke) for better readability
  const eyeOpen = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M3 3l18 18"/><path d="M9.9 5.2A11 11 0 0 1 12 5c6 0 10 7 10 7a17.7 17.7 0 0 1-3.2 3.8"/><path d="M6.1 6.1A17.7 17.7 0 0 0 2 12s4 7 10 7c1.1 0 2.1-.2 3.1-.5"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';
  let pwVisible = false; eyeBtn.innerHTML = '<div class="icon-wrap icon-eye">' + eyeOpen + '</div>';
  eyeBtn.onclick = () => {
    try {
      pwVisible = !pwVisible;
      passInput.type = pwVisible ? 'text' : 'password';
      eyeBtn.innerHTML = '<div class="icon-wrap icon-eye">' + (pwVisible ? eyeOff : eyeOpen) + '</div>';
      try { updateTooltip(eyeBtn, pwVisible ? 'Hide password' : 'Show password'); } catch (_) {}
    } catch (_) {}
  };
  try { attachTooltip(eyeBtn, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(eyeBtn, 'Show password'); } catch (_) {}

  // Assemble wraps
  emailWrap.appendChild(emailInput);
  try { passWrap.classList.add('has-right'); } catch (_) {}
  passWrap.appendChild(passInput);
  passWrap.appendChild(eyeBtn);

  // Tooltips for inputs
  try { attachTooltip(emailInput, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(emailInput, 'Enter your email address'); } catch (_) {}
  try { attachTooltip(passInput, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(passInput, 'Enter your password'); } catch (_) {}

  // Prefill from temporary global if returning from Create Account cancel
  try {
    if (window.__loginPrefill) {
      const e = String(window.__loginPrefill.email || '');
      const p = String(window.__loginPrefill.password || '');
      if (e) emailInput.value = e;
      if (p) passInput.value = p;
      try { delete window.__loginPrefill; } catch (_) {}
    }
  } catch (_) {}

  // Add rows to form using standardized row builder
  const emailRow = makeRow('Email', emailWrap);
  const passRow = makeRow('Password', passWrap);
  form.appendChild(emailRow);
  form.appendChild(passRow);

  const actions = document.createElement('div');
  actions.className = 'login-actions';

  const signInBtn = mkBtn('Sign In', async () => {
    await signInWithPassword(String(emailInput.value || '').trim(), String(passInput.value || ''));
    await afterAuthSuccess(id);
  });
  // Disable Sign In until both fields are filled; keep tooltip in sync
  function updateSignInState() {
    const e = String(emailInput.value || '').trim();
    const p = String(passInput.value || '');
    const ok = !!(e && p);
    try { signInBtn.disabled = !ok; } catch (_) {}
    try { updateTooltip(signInBtn, ok ? 'Sign In' : 'Enter email and password'); } catch (_) {}
  }
  try { emailInput.addEventListener('input', updateSignInState); passInput.addEventListener('input', updateSignInState); } catch (_) {}
  updateSignInState();
  // Inline link-style actions
  const signUpLink = document.createElement('button');
  signUpLink.type = 'button';
  signUpLink.className = 'login-link';
  signUpLink.textContent = 'Create Account';
  signUpLink.onclick = () => {
    try {
      window.__loginPrefill = {
        email: String(emailInput.value || ''),
        password: String(passInput.value || ''),
      };
    } catch (_) {}
    try { presentCreateAccountModal(); } catch (_) {}
  };
  const resetLink = document.createElement('button');
  resetLink.type = 'button';
  resetLink.className = 'login-link';
  resetLink.textContent = 'Forgot password?';
  resetLink.onclick = () => { try { presentForgotPasswordModal(); } catch (_) {} };
  // Tooltips on actions (favor bottom-right)
  try { attachTooltip(signInBtn, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(signInBtn, 'Sign In'); } catch (_) {}
  // Place these as bottom hints so they come off the bottom edge of the link
  try { attachTooltip(signUpLink, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(signUpLink, 'Create Account'); } catch (_) {}
  try { attachTooltip(resetLink, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(resetLink, 'Reset Password'); } catch (_) {}
  // Centered primary button
  const linksWrap = document.createElement('div');
  linksWrap.className = 'login-links';
  // Keep links in the right column, pinned to the bottom of that column
  try { linksWrap.style.marginTop = 'auto'; linksWrap.style.alignSelf = 'center'; } catch (_) {}
  linksWrap.appendChild(signUpLink);
  linksWrap.appendChild(resetLink);
  actions.appendChild(signInBtn);

  const status = document.createElement('div');
  status.id = 'login-status';
  status.className = 'login-status';

  function setStatus(msg) { status.textContent = msg || ''; }
  function disableAll(disabled) {
    [googleBtn, discordBtn, facebookBtn, signInBtn, signUpLink, resetLink, emailInput, passInput].forEach(el => { try { el.disabled = !!disabled; } catch (_) {} });
  }

  const grid = document.createElement('div'); grid.className = 'login-grid';
  const art = document.createElement('div'); art.className = 'login-art';
  const main = document.createElement('div'); main.className = 'login-main';

  // Assemble with standardized blocks/sections
  main.appendChild(titleBlock.el);
  main.appendChild(providersHeader);
  main.appendChild(buttons);
  main.appendChild(emailHeader);
  main.appendChild(form);
  main.appendChild(actions);
  main.appendChild(status);
  // Place links at the bottom of the right column
  main.appendChild(linksWrap);

  grid.appendChild(art);
  grid.appendChild(main);
  card.appendChild(grid);
  center.appendChild(card);
  content.appendChild(center);

  // Focus trap & tab order: Google → Discord → Facebook → Email → Password → Sign In → Create Account → Forgot password → Google
  try {
    const getFocusables = () => [googleBtn, discordBtn, facebookBtn, emailInput, passInput, signInBtn, signUpLink, resetLink].filter(el => el && !el.disabled);
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
    // Do not force initial focus on any button
  } catch (_) {}
}

async function afterAuthSuccess(modalId) {
  // DEBUG: Log auth token and whether server verifies it
  try {
    const token = await getAccessToken();
    const proto = (location && location.protocol === 'https:') ? 'https' : 'http';
    const host = (location && location.hostname) ? location.hostname : 'localhost';
    const verifyUrl = `${proto}://${host}:2567/auth/verify`;
    let valid = false;
    let resp = null;
    if (token) {
      try {
        const r = await fetch(verifyUrl, { headers: { Authorization: `Bearer ${token}` } });
        valid = r.ok;
        try { resp = await r.json(); } catch (_) {}
      } catch (_) {}
    }
    // Print truncated token for safety; includes 'DEBUG' keyword for easy removal
    const showTok = token ? (String(token).slice(0, 24) + '…') : null;
    console.debug('[DEBUG][auth] token', showTok, 'valid', !!valid, resp || null);
  } catch (e) {
    try { console.debug('[DEBUG][auth] token check failed', e?.message || e); } catch (_) {}
  }

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
