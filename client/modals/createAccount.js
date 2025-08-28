// Create Account Modal (email + password + confirm) — glassmorphism style
// Lives under client/modals/ per project convention. Minimal inline styles.

import { initSupabase, signUpWithPassword } from '../core/auth/supabaseAuth.js';
import { attachTooltip, updateTooltip } from '../core/ui/tooltip.js';
import { presentLoginModal } from './login.js';
import { presentForgotPasswordModal } from './forgotPassword.js';

function ensureCreateAccountStyles() {
  if (document.getElementById('create-account-autofill-style')) return;
  const st = document.createElement('style');
  st.id = 'create-account-autofill-style';
  st.textContent = `
  /* Make browser autofill match our glass style inside overlay */
  #overlay input:-webkit-autofill,
  #overlay input:-webkit-autofill:hover,
  #overlay input:-webkit-autofill:focus {
    -webkit-text-fill-color: #eaf6ff !important;
    caret-color: #eaf6ff;
    transition: background-color 9999s ease-in-out 0s;
    box-shadow: inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18), 0 0 0px 1000px rgba(10,16,22,0.16) inset;
    border: 1px solid var(--ui-surface-border, rgba(120,170,255,0.70));
    background-clip: content-box;
  }
  #overlay input:-moz-autofill {
    box-shadow: inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18), 0 0 0px 1000px rgba(10,16,22,0.16) inset;
    -moz-text-fill-color: #eaf6ff;
    caret-color: #eaf6ff;
  }
  `;
  document.head.appendChild(st);
}

export function presentCreateAccountModal() {
  initSupabase();
  ensureCreateAccountStyles();
  const id = 'CREATE_ACCOUNT_MODAL';
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

  // Keep the login backdrop vibe if present
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
  // Slight upward nudge for visual centering parity with Login/Reset
  center.style.transform = 'translateY(-2vh)';

  const card = document.createElement('div');
  card.style.width = 'min(720px, calc(100vw - 32px))';
  card.style.color = '#dff1ff';
  card.style.borderRadius = '14px';
  card.style.background = 'linear-gradient(180deg, var(--ui-surface-bg-top, rgba(10,18,36,0.48)) 0%, var(--ui-surface-bg-bottom, rgba(8,14,28,0.44)) 100%)';
  card.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
  card.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 22px rgba(80,140,255,0.33))';
  card.style.backdropFilter = 'var(--sf-tip-backdrop, blur(8px) saturate(1.25))';
  card.style.padding = '16px';

  const title = document.createElement('div');
  title.textContent = 'Create Grimdark Account';
  title.style.fontSize = '22px';
  title.style.fontWeight = '700';
  title.style.marginBottom = '2px';
  title.style.userSelect = 'none';

  // Fun taglines shown under the title. Easy to edit.
  const taglines = [
    'One step closer to your doom. Proceed wisely.',
    'Dare to join the abyss? We saved you a seat.',
    'Heroes enter. Few return.',
    'Welcome, brave soul. Your saga begins in the dark.',
    'Steel your nerves. Adventure echoes below.',
    'Sign here to tempt fate.',
    'Darkness calls your name. Will you answer?',
    'Fortune favors the doomed.',
    'The gates creak open. Mind the teeth.',
    'Abandon hope? Optional. Curiosity? Required.',
    'We have cookies. They may be cursed.',
    'Glory or grave. Sometimes both.',
    'Equip courage. Unequip hesitation.',
    'The dungeon growls. It’s hungry.',
    'Step lightly. The floor remembers.',
    'Your legend awaits… with a wicked grin.',
    'Ink your pact. Adventure signs back.',
    'You bring the spark. We bring the gloom.',
    'Tread where the brave whisper.',
    'Roll the dice. The dark rolls back.'
  ];
  const subtitle = document.createElement('div');
  subtitle.textContent = taglines[Math.floor(Math.random() * taglines.length)];
  try { subtitle.style.fontSize = '13px'; subtitle.style.opacity = '0.9'; subtitle.style.margin = '0 0 16px 0'; subtitle.style.color = '#cfe6ff'; subtitle.style.userSelect = 'none'; } catch (_) {}

  // Use same grid layout as login; art on the left, main content on the right
  const grid = document.createElement('div'); grid.className = 'login-grid';
  // Fallback inline styles if login styles are not present
  try { grid.style.display = 'grid'; grid.style.gridTemplateColumns = '1fr 1.4fr'; grid.style.gap = '1rem'; grid.style.alignItems = 'stretch'; } catch (_) {}
  const art = document.createElement('div'); art.className = 'login-art';
  try { art.style.borderRadius = '10px'; art.style.border = '1px dashed var(--ui-surface-border, rgba(120,170,255,0.45))'; art.style.minHeight = '220px'; art.style.background = 'linear-gradient(180deg, rgba(10,18,36,0.20), rgba(8,14,28,0.16))'; } catch (_) {}
  const main = document.createElement('div'); main.className = 'login-main';
  try { main.style.display = 'flex'; main.style.flexDirection = 'column'; main.style.minWidth = '0'; } catch (_) {}

  const form = document.createElement('div');
  form.className = 'login-form';
  // Inline grid style kept as fallback if login styles were not injected yet
  form.style.display = 'grid';
  form.style.gridTemplateColumns = 'max-content 1fr';
  form.style.gap = '10px 10px';
  form.style.alignItems = 'center';

  const emailLabel = document.createElement('label'); emailLabel.textContent = 'Email:'; try { emailLabel.style.textAlign = 'right'; emailLabel.style.opacity = '0.95'; emailLabel.style.userSelect = 'none'; } catch (_) {}
  const email = document.createElement('input'); email.type = 'email'; email.placeholder = 'Enter email address'; try { email.className = 'input-glass'; } catch (_) {}
  styleInput(email);
  const pwLabel = document.createElement('label'); pwLabel.textContent = 'Password:'; try { pwLabel.style.textAlign = 'right'; pwLabel.style.opacity = '0.95'; pwLabel.style.userSelect = 'none'; } catch (_) {}
  const pw = document.createElement('input'); pw.type = 'password'; pw.placeholder = 'Enter password'; try { pw.className = 'input-glass'; } catch (_) {}
  styleInput(pw);
  const pw2Label = document.createElement('label'); pw2Label.textContent = 'Confirm:'; try { pw2Label.style.textAlign = 'right'; pw2Label.style.opacity = '0.95'; pw2Label.style.userSelect = 'none'; } catch (_) {}
  const pw2 = document.createElement('input'); pw2.type = 'password'; pw2.placeholder = 'Repeat password'; try { pw2.className = 'input-glass'; } catch (_) {}
  styleInput(pw2);

  // Wrap inputs to support right-side eye buttons like on login modal
  const emailWrap = document.createElement('div'); emailWrap.className = 'input-wrap';
  const pwWrap = document.createElement('div'); pwWrap.className = 'input-wrap'; try { pwWrap.classList.add('has-right'); } catch (_) {}
  const pw2Wrap = document.createElement('div'); pw2Wrap.className = 'input-wrap'; try { pw2Wrap.classList.add('has-right'); } catch (_) {}

  // Eye icons
  const eyeOpen = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M3 3l18 18"/><path d="M9.9 5.2A11 11 0 0 1 12 5c6 0 10 7 10 7a17.7 17.7 0 0 1-3.2 3.8"/><path d="M6.1 6.1A17.7 17.7 0 0 0 2 12s4 7 10 7c1.1 0 2.1-.2 3.1-.5"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';

  const eyeBtn1 = document.createElement('button'); eyeBtn1.type = 'button'; eyeBtn1.className = 'input-icon-btn right';
  const eyeBtn2 = document.createElement('button'); eyeBtn2.type = 'button'; eyeBtn2.className = 'input-icon-btn right';
  let pw1Visible = false; let pw2Visible = false;
  eyeBtn1.innerHTML = '<div class="icon-wrap icon-eye">' + eyeOpen + '</div>';
  eyeBtn2.innerHTML = '<div class="icon-wrap icon-eye">' + eyeOpen + '</div>';
  // Per UX: icon subcontrols are not tab stops
  try { eyeBtn1.tabIndex = -1; eyeBtn2.tabIndex = -1; } catch (_) {}
  eyeBtn1.onclick = () => { try { pw1Visible = !pw1Visible; pw.type = pw1Visible ? 'text' : 'password'; eyeBtn1.innerHTML = '<div class="icon-wrap icon-eye">' + (pw1Visible ? eyeOff : eyeOpen) + '</div>'; updateTooltip(eyeBtn1, pw1Visible ? 'Hide password' : 'Show password'); } catch (_) {} };
  eyeBtn2.onclick = () => { try { pw2Visible = !pw2Visible; pw2.type = pw2Visible ? 'text' : 'password'; eyeBtn2.innerHTML = '<div class="icon-wrap icon-eye">' + (pw2Visible ? eyeOff : eyeOpen) + '</div>'; updateTooltip(eyeBtn2, pw2Visible ? 'Hide password' : 'Show password'); } catch (_) {} };
  try { attachTooltip(eyeBtn1, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(eyeBtn1, 'Show password'); } catch (_) {}
  try { attachTooltip(eyeBtn2, { mode: 'far', placement: 'r,rc,tr,br,t,b' }); updateTooltip(eyeBtn2, 'Show password'); } catch (_) {}

  // Assemble wraps
  emailWrap.appendChild(email);
  pwWrap.appendChild(pw); pwWrap.appendChild(eyeBtn1);
  pw2Wrap.appendChild(pw2); pw2Wrap.appendChild(eyeBtn2);

  form.appendChild(emailLabel); form.appendChild(emailWrap);
  form.appendChild(pwLabel); form.appendChild(pwWrap);
  form.appendChild(pw2Label); form.appendChild(pw2Wrap);

  // Status row under Confirm (hidden by default)
  const matchStatus = document.createElement('div');
  try {
    // Reserve space so the modal does not jump when text appears
    matchStatus.style.minHeight = '1.2em';
    matchStatus.style.visibility = 'hidden';
    matchStatus.style.gridColumn = '2 / 3';
    matchStatus.style.fontSize = '12.5px';
    matchStatus.style.opacity = '0.95';
    matchStatus.style.marginTop = '-4px';
    matchStatus.style.userSelect = 'none';
  } catch (_) {}
  form.appendChild(matchStatus);

  // Prefill from login modal if present
  try {
    const loginEmail = document.getElementById('login-email');
    const loginPass = document.getElementById('login-password');
    if (loginEmail && loginEmail.value) email.value = String(loginEmail.value || '');
    if (loginPass && loginPass.value) {
      const val = String(loginPass.value || '');
      pw.value = val; pw2.value = val;
    }
    // Fallback to temp prefill object if DOM elements aren't present
    if ((!email.value || !pw.value) && window.__loginPrefill) {
      const e = String(window.__loginPrefill.email || '');
      const p = String(window.__loginPrefill.password || '');
      if (e && !email.value) email.value = e;
      if (p) { if (!pw.value) pw.value = p; if (!pw2.value) pw2.value = p; }
      try { delete window.__loginPrefill; } catch (_) {}
    }
  } catch (_) {}

  const actions = document.createElement('div');
  actions.className = 'login-actions';
  // Side-by-side buttons
  actions.style.display = 'flex';
  actions.style.flexDirection = 'row';
  actions.style.justifyContent = 'flex-end';
  actions.style.alignItems = 'center';
  actions.style.gap = '10px';
  actions.style.marginTop = 'auto';

  const createBtn = makeBtn('Create');
  const cancelBtn = makeBtn('Cancel');
  // Far tooltips for primary actions (bottom-first for bottom action row)
  try { attachTooltip(createBtn, { mode: 'far', placement: 'b,bc,br,bl,t' }); } catch (_) {}
  try { attachTooltip(cancelBtn, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(cancelBtn, 'Return to the login page'); } catch (_) {}

  const status = document.createElement('div');
  status.style.marginTop = '8px';
  status.style.minHeight = '1.2em';
  status.style.userSelect = 'none';

  // Start disabled until valid
  try { createBtn.disabled = true; } catch (_) {}

  createBtn.onclick = async () => {
    setStatus('');
    const e = String(email.value || '').trim();
    const p1 = String(pw.value || '');
    const p2 = String(pw2.value || '');
    if (!e || !p1 || !p2) { setStatus('Please fill out all fields.'); return; }
    if (p1 !== p2) { setStatus('Passwords do not match.'); return; }
    try {
      disable(true);
      const data = await signUpWithPassword(e, p1);
      // Supabase may return success with identities: [] if the user already exists (anti-enumeration)
      if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        renderResult('exists', e);
      } else {
        renderResult('success', e);
      }
    } catch (err) {
      const msg = (err && (err.message || String(err))) || '';
      if ((err && (err.code === 'user_already_exists' || err.status === 400)) || /already\s*(exists|registered)/i.test(msg)) {
        renderResult('exists', e);
      } else {
        setStatus(msg || 'Sign up failed');
      }
    } finally {
      disable(false);
    }
  };
  cancelBtn.onclick = () => {
    // Prefill login with current entries for convenience
    try { window.__loginPrefill = { email: String(email.value || ''), password: String(pw.value || '') }; } catch (_) {}
    try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
    try { presentLoginModal(); } catch (_) {}
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(createBtn);

  // Build layout: art panel on left, main content on right
  main.appendChild(title);
  main.appendChild(subtitle);
  main.appendChild(form);
  // Keep general status above bottom actions so actions can pin to modal bottom
  main.appendChild(status);
  main.appendChild(actions);
  grid.appendChild(art);
  grid.appendChild(main);
  card.appendChild(grid);
  center.appendChild(card);
  content.appendChild(center);

  function setStatus(msg) { status.textContent = msg || ''; }
  function disable(d) { [email, pw, pw2, createBtn, cancelBtn].forEach(el => { try { el.disabled = !!d; } catch (_) {} }); }

  // Button hover highlight to match login
  function wireBtnHover(b) {
    try {
      const baseBorder = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
      const baseShadow = 'var(--ui-surface-glow-inset, inset 0 0 14px rgba(40,100,200,0.12)), var(--ui-surface-glow-outer, 0 0 16px rgba(120,170,255,0.22))';
      const hoverShadow = 'var(--ui-surface-glow-inset, inset 0 0 18px rgba(60,140,240,0.18)), var(--ui-surface-glow-outer, 0 0 20px rgba(140,190,255,0.30))';
      const applyBase = () => {
        if (b.disabled) {
          b.style.opacity = '0.5'; b.style.cursor = 'default';
          // Disabled text: #9fb1c6 (rgb 159,177,198)
          b.style.color = '#9fb1c6';
          b.style.border = baseBorder; b.style.boxShadow = baseShadow;
        } else {
          b.style.opacity = '1'; b.style.cursor = 'pointer';
          // Enabled text: #dff1ff (rgb 223,241,255)
          b.style.color = '#dff1ff';
          b.style.border = baseBorder; b.style.boxShadow = baseShadow;
        }
      };
      b.addEventListener('mouseenter', () => { if (b.disabled) return; b.style.borderColor = 'var(--ui-bright, #dff1ff)'; b.style.boxShadow = hoverShadow; });
      b.addEventListener('mouseleave', applyBase);
      b.addEventListener('focus', () => { if (b.disabled) return; b.style.borderColor = 'var(--ui-bright, #dff1ff)'; b.style.boxShadow = hoverShadow; });
      b.addEventListener('blur', applyBase);
      // Initialize base visuals
      applyBase();
    } catch (_) {}
  }
  wireBtnHover(createBtn); wireBtnHover(cancelBtn);

  // Input hover/focus highlight similar to login
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
  wireInputHoverFocus(email); wireInputHoverFocus(pw); wireInputHoverFocus(pw2);

  // Validation + status row + enable rules
  function updateState() {
    const e = String(email.value || '').trim();
    const p1 = String(pw.value || '');
    const p2 = String(pw2.value || '');
    let ok = false;
    if (p1 && p2) {
      matchStatus.style.visibility = 'visible';
      if (p1 === p2) {
        matchStatus.textContent = 'Passwords match';
        try { matchStatus.style.color = '#9fffb3'; } catch (_) {}
      } else {
        matchStatus.textContent = "Passwords don't match";
        try { matchStatus.style.color = '#ff4d4f'; } catch (_) {}
      }
    } else {
      matchStatus.style.visibility = 'hidden';
      matchStatus.textContent = '';
    }
    if (e && p1 && p2 && p1 === p2) ok = true;
    try { createBtn.disabled = !ok; } catch (_) {}
    // Refresh button visuals to ensure disabled state is dimmed and non-glowy
    try { createBtn.dispatchEvent(new Event('mouseleave')); } catch (_) {}
    // Dynamic tooltip based on validity
    try { updateTooltip(createBtn, ok ? 'Create your account' : 'Fill in all fields properly to create an account'); } catch (_) {}
  }
  [email, pw, pw2].forEach(el => { try { el.addEventListener('input', updateState); } catch (_) {} });
  // Initialize
  updateState();

  // Focus trap: keep Tab within modal (inputs + primary buttons; icon subcontrols excluded)
  try {
    const getFocusables = () => {
      const arr = [email, pw, pw2, cancelBtn];
      if (!createBtn.disabled) arr.push(createBtn);
      return arr;
    };
    const trap = (ev) => {
      if (ev.key !== 'Tab') return;
      const focusables = getFocusables();
      if (!focusables.length) return;
      const active = document.activeElement;
      const idx = focusables.indexOf(active);
      ev.preventDefault();
      if (ev.shiftKey) {
        const prev = idx <= 0 ? focusables[focusables.length - 1] : focusables[idx - 1];
        try { prev.focus(); } catch (_) {}
      } else {
        const next = idx < 0 || idx >= focusables.length - 1 ? focusables[0] : focusables[idx + 1];
        try { next.focus(); } catch (_) {}
      }
    };
    card.addEventListener('keydown', trap);
    // Initial focus
    try { email.focus(); } catch (_) {}
  } catch (_) {}

  function renderResult(kind, emailValue) {
    try {
      // Rebuild the card content to match UI guidelines
      card.innerHTML = '';
      // Compact width for the result (similar to reset confirmation)
      if (kind === 'success' || kind === 'exists') {
        try {
          const narrow = 'min(420px, calc(100vw - 32px))';
          card.style.width = narrow; card.style.maxWidth = narrow;
        } catch (_) {}
      }

      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.minWidth = '0';

      const resTitle = document.createElement('div');
      resTitle.style.fontSize = '22px';
      resTitle.style.fontWeight = '700';
      resTitle.style.marginBottom = '2px';
      resTitle.style.userSelect = 'none';
      resTitle.textContent = kind === 'success' ? 'Grimdark Account Created' : 'Account Already Exists';

      const resSub = document.createElement('div');
      resSub.style.fontSize = '13px';
      resSub.style.opacity = '0.9';
      resSub.style.margin = '0 0 20px 0';
      resSub.style.color = '#cfe6ff';
      resSub.style.userSelect = 'none';
      if (kind === 'success') {
        // Use the same tagline pool as the main modal
        try { resSub.textContent = taglines[Math.floor(Math.random() * taglines.length)]; } catch (_) { resSub.textContent = 'Welcome, brave soul.'; }
      } else {
        // Exists view should also show a tagline under the title
        try { resSub.textContent = taglines[Math.floor(Math.random() * taglines.length)]; } catch (_) { resSub.textContent = 'A familiar echo in the dark.'; }
      }

      const resStatus = document.createElement('div');
      resStatus.style.minHeight = '1.2em';
      resStatus.style.userSelect = 'none';
      // Clearer whitespace between tagline and message
      resStatus.style.marginTop = '8px';
      // Extra whitespace after message for the 'exists' view
      resStatus.style.marginBottom = (kind === 'exists') ? '10px' : '0';
      // Success: explicit verification instruction with email; Exists: show email only
      if (kind === 'success') {
        const shown = String(emailValue || '').trim();
        resStatus.textContent = shown
          ? `Check your email at ${shown} to verify your account, then return to sign in.`
          : 'Check your email to verify your account, then return to sign in.';
      } else {
        // Inline the email into the exists message
        const shown = String(emailValue || '').trim();
        resStatus.textContent = shown
          ? `An account with email ${shown} already exists. You can sign in or reset your password.`
          : 'An account with this email already exists. You can sign in or reset your password.';
      }

      const resActions = document.createElement('div');
      resActions.className = 'login-actions';
      resActions.style.display = 'flex';
      resActions.style.flexDirection = 'row';
      resActions.style.justifyContent = 'flex-end';
      resActions.style.alignItems = 'center';
      resActions.style.gap = '10px';
      // Keep a comfortable gap above the buttons; exists needs a bit more space
      resActions.style.marginTop = (kind === 'exists') ? '28px' : '16px';

      const goLogin = makeBtn('Go To Login');
      const resetBtn = kind === 'exists' ? makeBtn('Forgot Password') : null;
      try { attachTooltip(goLogin, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(goLogin, 'Return to the login page'); } catch (_) {}
      if (resetBtn) { try { attachTooltip(resetBtn, { mode: 'far', placement: 'b,bc,br,bl,t' }); updateTooltip(resetBtn, 'Reset your password'); } catch (_) {} }
      // Match hover/focus visuals used elsewhere
      try { wireBtnHover(goLogin); } catch (_) {}
      if (resetBtn) { try { wireBtnHover(resetBtn); } catch (_) {} }

    goLogin.onclick = () => {
      try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
      try { presentLoginModal(); } catch (_) {}
    };
    if (resetBtn) {
      resetBtn.onclick = () => {
        try { window.OverlayManager && window.OverlayManager.dismiss(id); } catch (_) {}
        try { presentForgotPasswordModal(); } catch (_) {}
      };
    }

    if (resetBtn) resActions.appendChild(resetBtn);
    resActions.appendChild(goLogin);

    wrap.appendChild(resTitle);
    wrap.appendChild(resSub);
    wrap.appendChild(resStatus);
    wrap.appendChild(resActions);
    card.appendChild(wrap);

    // Result-state focus trap: cycle between the action buttons only
    try {
      const getFocusables = () => {
        const arr = [];
        if (resetBtn) arr.push(resetBtn);
        arr.push(goLogin);
        return arr;
      };
      const resultTrap = (ev) => {
        if (ev.key !== 'Tab') return;
        // Prevent the original form trap from running
        try { ev.stopImmediatePropagation(); } catch (_) {}
        ev.preventDefault();
        const focusables = getFocusables();
        if (!focusables.length) return;
        const active = document.activeElement;
        const idx = focusables.indexOf(active);
        if (ev.shiftKey) {
          const prev = idx <= 0 ? focusables[focusables.length - 1] : focusables[idx - 1];
          try { prev.focus(); } catch (_) {}
        } else {
          const next = idx < 0 || idx >= focusables.length - 1 ? focusables[0] : focusables[idx + 1];
          try { next.focus(); } catch (_) {}
        }
      };
      // Capture phase so we pre-empt previously registered listeners
      card.addEventListener('keydown', resultTrap, true);
      // Set initial focus to the left-most action
      try { (resetBtn || goLogin).focus(); } catch (_) {}
    } catch (_) {}
  } catch (e) {
    setStatus(kind === 'success' ? 'Account created. Check your email to verify.' : 'Account already exists.');
  }
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
  b.style.boxShadow = 'var(--ui-surface-glow-inset, inset 0 0 14px rgba(40,100,200,0.12)), var(--ui-surface-glow-outer, 0 0 16px rgba(120,170,255,0.22))';
  return b;
}

function styleInput(input) {
  input.style.width = '100%';
  input.style.color = '#eaf6ff';
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

}
