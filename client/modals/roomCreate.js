// Room Create Modal (plain JS) - uses global OverlayManager from client/main.js
// Exports a function to present a modal for creating a private room.
// Fields: name, turnLength (s), password, maxPlayers.

export function presentRoomCreateModal({ onSubmit } = {}) {
  const id = 'CREATE_ROOM';
  try {
    // Open a blocking modal; we'll fully control the content area
    if (window.OverlayManager) {
      window.OverlayManager.present({ id, text: '', actions: [], blockInput: true });
    }

    const container = document.getElementById('overlay-content');
    if (!container) return;
    container.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = 'Create Private Room';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';

    const form = document.createElement('div');

    const row = (labelText, input) => {
      const r = document.createElement('div');
      r.style.display = 'flex';
      r.style.alignItems = 'center';
      r.style.marginBottom = '8px';
      const label = document.createElement('label');
      label.textContent = labelText;
      label.style.width = '160px';
      r.appendChild(label);
      r.appendChild(input);
      return r;
    };

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Hack40k Room';
    nameInput.value = 'Hack40k Room';

    const turnInput = document.createElement('input');
    turnInput.type = 'number';
    turnInput.min = '5';
    turnInput.max = '600';
    turnInput.step = '5';
    turnInput.value = '30';

    const passInput = document.createElement('input');
    passInput.type = 'text';
    passInput.placeholder = '(optional password)';

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.max = '16';
    maxInput.step = '1';
    maxInput.value = '4';

    form.appendChild(row('Game Name', nameInput));
    form.appendChild(row('Turn Length (sec)', turnInput));
    form.appendChild(row('Password', passInput));
    form.appendChild(row('Max Players', maxInput));

    const btnRow = document.createElement('div');
    btnRow.style.marginTop = '12px';

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.onclick = () => window.OverlayManager && window.OverlayManager.dismiss(id);

    const create = document.createElement('button');
    create.textContent = 'Create';
    create.style.marginLeft = '8px';
    create.onclick = async () => {
      const payload = {
        name: nameInput.value.trim() || 'Hack40k Room',
        turnLength: clampInt(parseInt(turnInput.value, 10), 5, 600) || 30,
        roomPass: passInput.value || '',
        maxPlayers: clampInt(parseInt(maxInput.value, 10), 1, 16) || 4,
      };
      try {
        if (typeof onSubmit === 'function') await onSubmit(payload);
        window.OverlayManager && window.OverlayManager.dismiss(id);
      } catch (e) {
        console.warn('room create submit failed', e);
      }
    };

    btnRow.appendChild(cancel);
    btnRow.appendChild(create);

    container.appendChild(title);
    container.appendChild(form);
    container.appendChild(btnRow);
  } catch (e) {
    console.warn('presentRoomCreateModal failed', e);
  }
}

function clampInt(v, min, max) {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}
