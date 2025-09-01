// Profile tab (rebuilt): consistent with other tabs, login-aware, saves locally (and to server if available)

import * as LS from '../../../core/localStorage.js';
import { makeSection, makeNote, createInputRow, wireFocusHighlight } from '../uiHelpers.js';
import { UI } from '../../../core/ui/controls.js';
import { getUser, ensureProfileForCurrentUser, getClient } from '../../../core/auth/supabaseAuth.js';

export function renderProfileTab(container) {
  if (!container) return;

  // Quips about identity and the hero's journey
  const QUIPS = [
    'A legend starts with a name.',
    "Be the hero. Or at least spell it right.",
    'Become someone… or become everyone.',
    'Who are you when no one’s spectating?',
    'Masks are optional; myths are not.',
    'Rename yourself, rewrite your fate.',
    'Every odyssey begins with an alias.',
    'Fake it till the dragon buys it.',
    'Identity is the sharpest weapon.',
    'Today: player. Tomorrow: protagonist.',
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

    // Nickname row with embedded dice button
    const nickRow = createInputRow({ dataName: 'nickname' });
    const nickLabel = document.createElement('label'); nickLabel.textContent = 'Nickname:'; nickLabel.style.minWidth = '100px';
    const nickWrap = document.createElement('div'); nickWrap.style.position = 'relative'; nickWrap.style.display = 'flex'; nickWrap.style.alignItems = 'center'; nickWrap.style.flex = '1';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Pick a unique nickname';
    nameInput.value = nicknameVal || '';
    nameInput.style.display = 'inline-block'; nameInput.style.height = '40px'; nameInput.style.lineHeight = '40px';
    nameInput.style.background = 'transparent'; nameInput.style.outline = 'none'; nameInput.style.color = 'var(--sf-tip-fg, #fff)';
    nameInput.style.border = '0'; nameInput.style.borderRadius = '8px';
    try { const sz = UI?.iconSize ?? 18; const lg = UI?.leftGap ?? '10px'; nameInput.style.padding = `0 calc(${sz}px + ${lg}) 0 10px`; } catch (_) { nameInput.style.padding = '0 28px 0 10px'; }
    try { if (UI?.insetShadow) nameInput.style.boxShadow = UI.insetShadow; } catch (_) {}
    nameInput.style.flex = '1'; nameInput.style.width = '100%';
    try { nameInput.id = 'settings-nickname'; nickLabel.htmlFor = 'settings-nickname'; } catch (_) {}

    const diceBtn = document.createElement('button');
    diceBtn.type = 'button'; diceBtn.title = 'Roll a random nickname';
    diceBtn.style.position = 'absolute'; diceBtn.style.right = '0'; diceBtn.style.top = '50%'; diceBtn.style.transform = 'translateY(-50%)';
    try { const s = UI?.iconSize ?? 18; diceBtn.style.width = `${s}px`; diceBtn.style.height = `${s}px`; } catch (_) {}
    diceBtn.style.display = 'inline-flex'; diceBtn.style.alignItems = 'center'; diceBtn.style.justifyContent = 'center';
    diceBtn.style.background = 'transparent'; try { if (UI?.border) diceBtn.style.border = UI.border; } catch (_) {}
    diceBtn.style.borderRadius = '8px'; diceBtn.style.boxSizing = 'border-box'; diceBtn.style.color = 'var(--ui-bright, rgba(190,230,255,0.90))'; diceBtn.style.cursor = 'pointer';
    diceBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/></svg>';
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

    // Bio (multiline)
    const bioRow = document.createElement('div'); bioRow.style.display = 'flex'; bioRow.style.flexDirection = 'column'; bioRow.style.gap = '6px'; bioRow.style.marginBottom = '8px';
    const bioLbl = document.createElement('label'); bioLbl.textContent = 'Bio:';
    const bioWrap = document.createElement('div'); bioWrap.style.position = 'relative'; bioWrap.style.display = 'flex'; bioWrap.style.flex = '1';
    try { if (UI?.border) bioWrap.style.border = UI.border; bioWrap.style.borderRadius = '8px'; if (UI?.insetShadow) bioWrap.style.boxShadow = UI.insetShadow; } catch (_) {}
    const bio = document.createElement('textarea');
    bio.placeholder = 'Whisper your legend into the static...';
    bio.value = bioVal || ''; bio.rows = 5; bio.style.resize = 'vertical'; bio.style.minHeight = '120px'; bio.style.maxHeight = '200px';
    bio.style.border = '0'; bio.style.outline = 'none'; bio.style.padding = '8px 10px'; bio.style.color = 'var(--ui-fg, #eee)'; bio.style.background = 'transparent'; bio.style.width = '100%';
    try { bio.id = 'settings-bio'; bioLbl.htmlFor = 'settings-bio'; } catch (_) {}
    bioWrap.appendChild(bio); bioRow.appendChild(bioLbl); bioRow.appendChild(bioWrap); container.appendChild(bioRow);
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
