// Profile tab renderer: shared between panel and overlay
// JS-only, no external CSS. Mirrors the inline implementations that existed in settings.js.
// Usage examples:
//   renderProfileTab({
//     container,
//     makeSection,
//     makeNote,
//     // panel-only helpers
//     makeRow,
//     makeInput,
//     // overlay-only helpers
//     createInputRow,
//     wireFocusHighlight,
//     UI,
//     LS,
//     // common
//     headerTitle: 'Profile',
//     headerDesc: '',
//     loggedIn: false,
//     variant: 'overlay' | 'panel',
//
//     // Overlay state hooks (optional; required for overlay variant)
//     getNickname: () => nicknameVal,
//     setNickname: (v) => { nicknameVal = v },
//     getBio: () => bioVal,
//     setBio: (v) => { bioVal = v },
//     setDirty: (flag) => {},
//     reRender: () => {},
//
//     // Panel copy texts (optional)
//     panelLoginMsg: 'Please login to a game server first to change your profile settings.'
//   });

export function renderProfileTab(opts = {}) {
  const {
    container,
    makeSection,
    makeNote,
    // panel helpers
    makeRow,
    makeInput,
    // overlay helpers
    createInputRow,
    wireFocusHighlight,
    UI,
    LS,
    // common
    headerTitle = 'Profile',
    headerDesc = '',
    loggedIn = false,
    variant = 'overlay',
    // overlay state hooks
    getNickname,
    setNickname,
    getBio,
    setBio,
    setDirty = () => {},
    reRender = () => {},
    // messages
    panelLoginMsg = 'Please login to a game server first to change your profile settings.',
    overlayLoginMsg = 'Login required. Sign in to edit your profile.'
  } = opts || {};

  if (!container || typeof makeSection !== 'function' || typeof makeNote !== 'function') {
    return; // fail safe
  }

  try { container.appendChild(makeSection(headerTitle, headerDesc, 'afterTitle')); } catch (_) {}

  // Logged-out states show a note only (consistent with existing behavior)
  if (!loggedIn) {
    const msg = (variant === 'panel') ? panelLoginMsg : overlayLoginMsg;
    try { container.appendChild(makeNote(msg)); } catch (_) {}
    return;
  }

  if (variant === 'panel') {
    // Preserve existing panel UI: a single Display Name row bound to LS name
    if (typeof makeRow === 'function' && typeof makeInput === 'function') {
      let nameVal = '';
      try { nameVal = (LS && LS.getItem) ? (LS.getItem('name', '') || '') : ''; } catch (_) {}
      try { container.appendChild(makeRow('Display Name', makeInput('text', nameVal))); } catch (_) {}
    }
    return;
  }

  // Overlay variant: full nickname + dice, bio, Save/Cancel, and dirty tracking
  // Guards for helpers
  const _createInputRow = typeof createInputRow === 'function'
    ? createInputRow
    : () => { const d = document.createElement('div'); d.style.marginBottom = '8px'; return d; };

  const _wireFocusHighlight = typeof wireFocusHighlight === 'function'
    ? wireFocusHighlight
    : () => {};

  // Pull current state from hooks (falls back to drafts if hooks missing)
  let nicknameVal = (typeof getNickname === 'function') ? String(getNickname() || '') : '';
  let bioVal = (typeof getBio === 'function') ? String(getBio() || '') : '';
  if (!nicknameVal || !bioVal) {
    try {
      if (!nicknameVal && LS && LS.getItem) nicknameVal = LS.getItem('draft:nickname', '') || '';
      if (!bioVal && LS && LS.getItem) bioVal = LS.getItem('draft:bio', '') || '';
    } catch (_) {}
  }

  // Nickname row with right-side dice button inside the input
  const nickRow = _createInputRow({ dataName: 'nickname' });
  const nickLabel = document.createElement('label'); nickLabel.textContent = 'Nickname:'; nickLabel.style.minWidth = '100px';
  const diceSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/></svg>';

  const nickWrap = document.createElement('div');
  nickWrap.style.position = 'relative';
  nickWrap.style.display = 'flex';
  nickWrap.style.alignItems = 'center';
  nickWrap.style.flex = '1';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Pick a unique nickname';
  nameInput.value = nicknameVal || '';
  nameInput.style.display = 'inline-block';
  nameInput.style.height = '40px';
  nameInput.style.lineHeight = '40px';
  nameInput.style.background = 'transparent';
  nameInput.style.outline = 'none';
  nameInput.style.color = 'var(--sf-tip-fg, #fff)';
  nameInput.style.border = '0';
  nameInput.style.borderRadius = '8px';
  try { const sz = UI && UI.iconSize ? UI.iconSize : 18; const lg = UI && UI.leftGap ? UI.leftGap : '10px'; nameInput.style.padding = `0 calc(${sz}px + ${lg}) 0 10px`; } catch (_) { nameInput.style.padding = '0 28px 0 10px'; }
  try { if (UI && UI.insetShadow) nameInput.style.boxShadow = UI.insetShadow; } catch (_) {}
  nameInput.style.flex = '1';
  nameInput.style.width = '100%';
  nameInput.oninput = () => {
    const v = String(nameInput.value || '');
    try { setNickname && setNickname(v); } catch (_) {}
    try { setDirty && setDirty(true); } catch (_) {}
  };
  try { nameInput.id = 'settings-nickname'; nickLabel.htmlFor = 'settings-nickname'; } catch (_) {}

  const diceBtn = document.createElement('button');
  diceBtn.type = 'button';
  diceBtn.title = 'Roll a random nickname';
  diceBtn.style.position = 'absolute';
  diceBtn.style.right = '0';
  diceBtn.style.top = '50%';
  diceBtn.style.transform = 'translateY(-50%)';
  try { diceBtn.style.width = `${UI && UI.iconSize ? UI.iconSize : 18}px`; diceBtn.style.height = `${UI && UI.iconSize ? UI.iconSize : 18}px`; } catch (_) {}
  diceBtn.style.display = 'inline-flex';
  diceBtn.style.alignItems = 'center';
  diceBtn.style.justifyContent = 'center';
  diceBtn.style.background = 'transparent';
  try { if (UI && UI.border) diceBtn.style.border = UI.border; } catch (_) {}
  diceBtn.style.borderRadius = '8px';
  diceBtn.style.boxSizing = 'border-box';
  diceBtn.style.color = 'var(--ui-bright, rgba(190,230,255,0.90))';
  diceBtn.style.cursor = 'pointer';
  diceBtn.innerHTML = diceSvg;
  diceBtn.onclick = () => {
    try {
      const base = ['Vox', 'Hex', 'Gloom', 'Iron', 'Vermilion', 'Ash', 'Rune', 'Blight', 'Grim', 'Cipher'];
      const suf = ['fang', 'shade', 'mark', 'wrath', 'spire', 'veil', 'shard', 'brand', 'wraith', 'mourn'];
      const nick = base[Math.floor(Math.random()*base.length)] + suf[Math.floor(Math.random()*suf.length)] + Math.floor(Math.random()*90+10);
      nameInput.value = nick;
      try { setNickname && setNickname(nick); } catch (_) {}
      try { setDirty && setDirty(true); } catch (_) {}
    } catch (_) {}
  };

  nickWrap.appendChild(nameInput);
  nickWrap.appendChild(diceBtn);
  try { nickRow.appendChild(nickLabel); } catch (_) {}
  try { nickRow.appendChild(nickWrap); } catch (_) {}
  try { container.appendChild(nickRow); } catch (_) {}
  try { _wireFocusHighlight(nameInput, nickRow); } catch (_) {}

  // Bio (multiline)
  const bioRow = document.createElement('div');
  bioRow.style.display = 'flex'; bioRow.style.flexDirection = 'column'; bioRow.style.gap = '6px'; bioRow.style.marginBottom = '8px';
  const bioLbl = document.createElement('label'); bioLbl.textContent = 'Bio:';
  const bioWrap = document.createElement('div');
  bioWrap.style.position = 'relative';
  bioWrap.style.display = 'flex';
  bioWrap.style.flex = '1';
  try { if (UI && UI.border) bioWrap.style.border = UI.border; bioWrap.style.borderRadius = '8px'; if (UI && UI.insetShadow) bioWrap.style.boxShadow = UI.insetShadow; } catch (_) {}
  const bio = document.createElement('textarea');
  bio.placeholder = 'Whisper your legend into the static...';
  bio.value = bioVal || '';
  bio.rows = 5; // fixed visual height
  bio.style.resize = 'vertical';
  bio.style.minHeight = '120px'; bio.style.maxHeight = '200px';
  bio.style.border = '0'; bio.style.outline = 'none';
  bio.style.padding = '8px 10px'; bio.style.color = 'var(--ui-fg, #eee)';
  bio.style.background = 'transparent'; bio.style.width = '100%';
  bio.oninput = () => {
    const v = String(bio.value || '');
    try { setBio && setBio(v); } catch (_) {}
    try { setDirty && setDirty(true); } catch (_) {}
  };
  try { bio.id = 'settings-bio'; bioLbl.htmlFor = 'settings-bio'; } catch (_) {}
  bioWrap.appendChild(bio);
  bioRow.appendChild(bioLbl); bioRow.appendChild(bioWrap);
  try { container.appendChild(bioRow); } catch (_) {}
  try { _wireFocusHighlight(bio, bioWrap); } catch (_) {}

  // Save/Cancel actions
  const actions = document.createElement('div');
  actions.style.display = 'flex'; actions.style.gap = '10px'; actions.style.justifyContent = 'flex-end';
  const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel';
  [saveBtn, cancelBtn].forEach(b => {
    b.style.cursor = 'pointer'; b.style.userSelect = 'none'; b.style.borderRadius = '10px'; b.style.padding = '8px 12px'; b.style.fontWeight = '600'; b.style.fontSize = '14px'; b.style.background = 'linear-gradient(180deg, rgba(10,18,26,0.12) 0%, rgba(10,16,22,0.08) 100%)'; b.style.color = 'var(--ui-fg, #eee)'; b.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.60))'; b.style.boxShadow = 'inset 0 0 14px rgba(40,100,200,0.12), 0 0 16px rgba(120,170,255,0.22)';
  });

  saveBtn.onclick = () => {
    // For now, store locally to avoid data loss between tab switches
    try {
      const n = typeof getNickname === 'function' ? String(getNickname() || '') : nameInput.value || '';
      const b = typeof getBio === 'function' ? String(getBio() || '') : bio.value || '';
      if (LS && LS.setItem) {
        LS.setItem('draft:nickname', n);
        LS.setItem('draft:bio', b);
      }
    } catch (_) {}
    try { setDirty && setDirty(false); } catch (_) {}
  };

  cancelBtn.onclick = () => {
    // Revert fields from last saved draft
    try {
      const n = (LS && LS.getItem) ? (LS.getItem('draft:nickname', '') || '') : '';
      const b = (LS && LS.getItem) ? (LS.getItem('draft:bio', '') || '') : '';
      try { setNickname && setNickname(n); } catch (_) {}
      try { setBio && setBio(b); } catch (_) {}
    } catch (_) {}
    try { reRender && reRender(); } catch (_) {}
    try { setDirty && setDirty(false); } catch (_) {}
  };

  try { actions.appendChild(cancelBtn); actions.appendChild(saveBtn); } catch (_) {}
  try { container.appendChild(actions); } catch (_) {}
}
