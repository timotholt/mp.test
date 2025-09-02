// Profile tab (rebuilt): consistent with other tabs, login-aware, saves locally (and to server if available)

import * as LS from '../../../core/localStorage.js';
import { makeSection, makeNote, createInputRow, wireFocusHighlight } from '../uiHelpers.js';
import { UI } from '../../../core/ui/controls.js';
import { getUser, ensureProfileForCurrentUser, getClient } from '../../../core/auth/supabaseAuth.js';
import { createUiElement, basicButton, basicPanelLabel, basicTextInput } from '../../../core/ui/theme/elements.js';

export function renderProfileTab(container) {
  if (!container) return;

  // Quips about identity and the hero's journey
  const QUIPS = [
    'A legend starts with a name. A good one.',
    "Be the hero. Or at least spell it right.",
    'Are you a hero or a harlot? Choose wisely.',
    'Rename yourself, rewrite your fate.',
    'Every odyssey begins with an alias.',
    'Player today. Famous martyr tomorrow.',
    'The saga waits for your signature.',
    'Change your name, change the prophecy.',
    'Legends are born from bad spelling.',
    'What name shall we put on your tombstone?',
    'Choose a name that echoes in eternity.',
    "Heroes don’t answer to 'Guest123.'",
    'What’s in a name? Everything, actually.',
    'The first quest in Grimdark: a cool name.',
    'Alias now, immortality later.',
    'Be someone worth remembering.',
    'Even villains brand themselves.',
    'A famous hero is just marketing done well.',
    'Masks fade; names endure.',
    'Rename yourself, reforge your soul.',
    "A dragon fears what it can’t pronounce.",
    "Legends don’t start with placeholders.",
    'Every keystroke is a destiny.',
    'Your ID is your incantation.',
    'Choose a name that casts a shadow.',
    'Victory tastes better with a good alias.',
    'Heroes never hide behind default tags.',
    "A name is like a wife: don't get stuck with a bad one forever.",
    'Even gods rebrand sometimes.',
    'Heroes are forged, not autofilled.',
    'Become the myth you mistyped.',
    'Pick bold, pick strange, pick legend.',
  ];

  const quip = QUIPS[Math.floor(Math.random() * QUIPS.length)];
  try { container.appendChild(makeSection('Profile', quip, 'afterTitle', true, true)); } catch (_) {}

  // Render body depending on auth
  (async () => {
    const user = await safeGetUser();
    if (!user) {
      try { container.appendChild(makeNote('Login required. Sign in to edit your profile.')); } catch (_) {}
      return;
    }

    // Initial values: drafts first, then server profile, then fallback
    let nicknameVal = safeGetLS('draft:nickname', '');
    let bioVal = safeGetLS('draft:bio', '');
    if (!nicknameVal) {
      try {
        const prof = await ensureProfileForCurrentUser();
        if (prof && prof.display_name) nicknameVal = String(prof.display_name);
        if (prof && prof.bio && !bioVal) bioVal = String(prof.bio);
      } catch (_) {}
    }

    // Nickname row with embedded dice button (templated)
    const nickRow = createInputRow({ dataName: 'nickname' });
    const nickLabel = createUiElement(basicPanelLabel, 'Nickname:');
    const nickWrap = createUiElement([{ __tag: 'div' }, { position: 'relative', display: 'flex', alignItems: 'center', flex: '1' }]);

    const nameInput = createUiElement([basicTextInput, { fontSize: 'var(--ui-fontsize-medium)', pr: '2rem' }]);
    try {
      nameInput.type = 'text';
      nameInput.placeholder = 'Pick a unique nickname';
      nameInput.value = nicknameVal || '';
      nameInput.id = 'settings-nickname';
      nickLabel.htmlFor = 'settings-nickname';
    } catch (_) {}

    const diceBtn = createUiElement([
      basicButton,
      {
        __tag: 'button', // need real button to host SVG content
        position: 'absolute',
        right: '0',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ui-bright, var(--ui-highlight))',
        padding: '0',
        width: '1.125rem',
        height: '1.125rem',
        fontSize: '1.125rem',
        boxSizing: 'border-box',
      }
    ]);
    try { diceBtn.type = 'button'; } catch (_) {}
    try { diceBtn.title = 'Roll a random nickname'; diceBtn.setAttribute('aria-label', 'Roll a random nickname'); } catch (_) {}
    // Preserve theme-driven border if provided via UI helpers
    try { if (UI?.border) diceBtn.style.border = UI.border; } catch (_) {}
    diceBtn.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/></svg>';
    diceBtn.onclick = () => {
      try {
        const base = ['Vox', 'Hex', 'Gloom', 'Iron', 'Vermilion', 'Ash', 'Rune', 'Blight', 'Grim', 'Cipher'];
        const suf = ['fang', 'shade', 'mark', 'wrath', 'spire', 'veil', 'shard', 'brand', 'wraith', 'mourn'];
        const nick = base[Math.floor(Math.random()*base.length)] + suf[Math.floor(Math.random()*suf.length)] + Math.floor(Math.random()*90+10);
        nameInput.value = nick; persistDraft(); queueSave();
      } catch (_) {}
    };

    nickWrap.appendChild(nameInput); nickWrap.appendChild(diceBtn);
    nickRow.appendChild(nickLabel); nickRow.appendChild(nickWrap);
    container.appendChild(nickRow);
    try { wireFocusHighlight(nameInput, nickRow); } catch (_) {}

    // Bio (multiline, templated)
    const bioRow = createUiElement([{ __tag: 'div' }, { display: 'flex', flexDirection: 'column', gap: '0.375rem', mb: '0.5rem' }]);
    const bioLbl = createUiElement(basicPanelLabel, 'Bio:');
    const bioWrap = createUiElement([{ __tag: 'div' }, { position: 'relative', display: 'flex', flex: '1', borderRadius: 'var(--ui-card-radius, 0.5rem)' }]);
    try { bioWrap.classList && bioWrap.classList.add('ui-focus-reset'); } catch (_) {}
    const bio = createUiElement([basicTextInput, { __tag: 'textarea', rows: 5, resize: 'vertical', minHeight: '7.5rem', maxHeight: '12.5rem', fontSize: 'var(--ui-fontsize-medium)', px: '0.625rem', py: '0.5rem' }]);
    try {
      bio.placeholder = 'Whisper your legend into the static...';
      bio.value = bioVal || '';
      bio.id = 'settings-bio'; bioLbl.htmlFor = 'settings-bio';
    } catch (_) {}
    bioWrap.appendChild(bio);
    bioRow.appendChild(bioLbl);
    bioRow.appendChild(bioWrap);
    container.appendChild(bioRow);
    try { wireFocusHighlight(bio, bioWrap); } catch (_) {}

    // Persist: save draft immediately; try server when possible (debounced)
    const persistDraft = () => {
      try { LS.setItem('draft:nickname', String(nameInput.value || '')); } catch (_) {}
      try { LS.setItem('draft:bio', String(bio.value || '')); } catch (_) {}
    };

    let saveTimer = null;
    const queueSave = () => {
      try { if (saveTimer) clearTimeout(saveTimer); } catch (_) {}
      saveTimer = setTimeout(async () => {
        persistDraft();
        // Try server upsert; fallback is localStorage (HACK until endpoint/policies are solid)
        try {
          const client = getClient && getClient();
          if (client && user?.id) {
            await client.from('profiles').upsert({ id: user.id, display_name: String(nameInput.value || ''), bio: String(bio.value || '') }).select().single();
          }
        } catch (e) {
          // HACK: local-only persistence until server endpoint/policies exist
          // console.warn('[profile] server save failed; using local storage', e);
        }
      }, 400);
    };

    // Wire events
    nameInput.oninput = () => { persistDraft(); queueSave(); };
    bio.oninput = () => { persistDraft(); queueSave(); };
  })();
}

async function safeGetUser() {
  try { return await getUser(); } catch (_) { return null; }
}

function safeGetLS(key, def) {
  try { return (LS.getItem(key, def) || def); } catch (_) { return def; }
}
