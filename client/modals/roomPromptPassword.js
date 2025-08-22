// Room Password Prompt Modal
// Shows a password input with OK/Cancel, and supports wrong-password retry.
// Usage:
//   presentRoomPromptPassword({ roomName, onSubmit, onCancel })
// - onSubmit: async (password) => boolean
//     return true to close the modal,
//     return false to show 'Wrong password' and keep it open,
//     throw Error to show error message and keep it open.

export function presentRoomPromptPassword({ roomName = 'Private Room', onSubmit, onCancel } = {}) {
  const id = 'ROOM_PASSWORD_PROMPT';
  try {
    const prio = (window.PRIORITY && window.PRIORITY.MEDIUM) || 50;
    window.OverlayManager.present({ id, text: '', actions: [], blockInput: true, priority: prio });
  } catch (_) {}

  const content = document.getElementById('overlay-content');
  if (!content) return;
  content.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = `Enter password for: ${roomName}`;
  title.style.fontWeight = 'bold';
  title.style.fontSize = '18px';
  title.style.marginBottom = '8px';
  content.appendChild(title);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  row.style.marginTop = '6px';

  const label = document.createElement('label');
  label.textContent = 'Password:';
  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = '••••';

  row.appendChild(label);
  row.appendChild(input);
  content.appendChild(row);

  const error = document.createElement('div');
  error.style.color = '#ff8080';
  error.style.marginTop = '8px';
  error.style.minHeight = '1.2em';
  content.appendChild(error);

  const actions = document.createElement('div');
  actions.style.marginTop = '10px';

  const ok = document.createElement('button');
  ok.textContent = 'OK';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.style.marginLeft = '8px';

  function setBusy(b) {
    ok.disabled = b; cancel.disabled = b; input.disabled = b;
  }

  ok.onclick = async () => {
    const pwd = input.value || '';
    error.textContent = '';
    setBusy(true);
    try {
      const res = (typeof onSubmit === 'function') ? await onSubmit(pwd) : true;
      if (res === true) {
        try { window.OverlayManager.dismiss(id); } catch (_) {}
      } else {
        error.textContent = 'Wrong password';
      }
    } catch (e) {
      error.textContent = (e && e.message) ? e.message : 'Join failed';
    } finally {
      setBusy(false);
      input.focus();
      input.select();
    }
  };

  cancel.onclick = () => {
    try { window.OverlayManager.dismiss(id); } catch (_) {}
    try { if (typeof onCancel === 'function') onCancel(); } catch (_) {}
  };

  actions.appendChild(ok);
  actions.appendChild(cancel);
  content.appendChild(actions);

  // Autofocus
  try { input.focus(); } catch (_) {}
}
