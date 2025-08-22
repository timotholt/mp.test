// Simple confirm modal for starting the game (host-only action)
// Exports: presentStartGameConfirm(onOk, onCancel)
// Relies on global OverlayManager and window.PRIORITY set by client/main.js

export function presentStartGameConfirm(onOk, onCancel) {
  try {
    const prio = (window.PRIORITY && window.PRIORITY.MEDIUM) || 5;
    window.OverlayManager.present({ id: 'CONFIRM_START', text: '', actions: [], blockInput: true, priority: prio });
    const content = document.getElementById('overlay-content');
    if (!content) return;
    content.innerHTML = '';

    const p = document.createElement('div');
    p.textContent = 'Start game now?';
    content.appendChild(p);

    const row = document.createElement('div');
    row.style.marginTop = '10px';

    const ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.onclick = () => {
      try { window.OverlayManager.dismiss('CONFIRM_START'); } catch (_) {}
      try { if (typeof onOk === 'function') onOk(); } catch (_) {}
    };

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.marginLeft = '8px';
    cancel.onclick = () => {
      try { window.OverlayManager.dismiss('CONFIRM_START'); } catch (_) {}
      try { if (typeof onCancel === 'function') onCancel(); } catch (_) {}
    };

    row.appendChild(ok);
    row.appendChild(cancel);
    content.appendChild(row);
  } catch (e) {
    console.warn('presentStartGameConfirm failed', e);
  }
}
