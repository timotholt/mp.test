// Start Game confirmation modal (server-driven)
// Exports: presentStartGameConfirm({ players, canStart, isHost, starting, countdown, youAreReady, onStart, onCancel, onUnready, priority })
// Relies on global OverlayManager and window.PRIORITY set by client/main.js
import ensureGlassFormStyles from '../core/ui/formBase.js';

export function presentStartGameConfirm({ players = [], canStart = false, isHost = false, starting = false, countdown = 0, youAreReady = false, onStart, onCancel, onUnready, priority } = {}) {
  try {
    // Ensure shared modal typography/button/input classes are available
    try { ensureGlassFormStyles(); } catch (_) {}
    const prio = (typeof priority === 'number') ? priority : ((window.PRIORITY && window.PRIORITY.MEDIUM) || 50);
    // Non-blocking so lobby/room UI remains interactive while we wait
    window.OverlayManager.present({ id: 'CONFIRM_START', text: '', actions: [], blockInput: false, priority: prio });
    const content = document.getElementById('overlay-content');
    if (!content) return;
    content.innerHTML = '';

    // Title
    const title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = starting ? `Starting in ${Math.max(0, countdown|0)}…` : 'Start game?';
    content.appendChild(title);

    // Player table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.marginTop = '8px';
    table.style.borderCollapse = 'collapse';
    const header = document.createElement('tr');
    addCell(header, 'Name', true);
    addCell(header, 'Ready', true);
    addCell(header, 'Online', true);
    table.appendChild(header);

    let readyCount = 0;
    let total = 0;
    (players || []).forEach((p) => {
      total++;
      const tr = document.createElement('tr');
      const nm = p && p.name ? String(p.name) : 'Hero';
      const rdy = !!(p && p.ready);
      const onl = (p && p.online !== false);
      if (rdy) readyCount++;
      addCell(tr, nm);
      addCell(tr, rdy ? 'Yes' : 'No');
      addCell(tr, onl ? 'Online' : 'Offline');
      table.appendChild(tr);
    });

    content.appendChild(table);

    // Summary (ready/total)
    const summary = document.createElement('div');
    summary.style.marginTop = '8px';
    const allReady = (total > 0) && (readyCount === total) && (players.every(p => p && p.online !== false));
    const allow = (typeof canStart === 'boolean') ? canStart : allReady;
    summary.textContent = `${readyCount}/${total} ready` + (starting ? ` — starting in ${Math.max(0, countdown|0)}…` : (allow ? '' : ' — waiting for players...'));
    content.appendChild(summary);

    // Buttons (role-based)
    const row = document.createElement('div');
    row.style.marginTop = '10px';

    if (isHost) {
      // Host controls: Start (always allowed; disabled during countdown) and Cancel
      const startBtn = document.createElement('button');
      startBtn.textContent = 'Start';
      startBtn.disabled = !!starting; // host can always start when not counting down
      startBtn.onclick = () => {
        try { if (typeof onStart === 'function') onStart(); } catch (_) {}
      };
      row.appendChild(startBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = starting ? 'Cancel countdown' : 'Cancel';
      cancelBtn.style.marginLeft = '8px';
      cancelBtn.onclick = () => {
        try { if (typeof onCancel === 'function') onCancel(); } catch (_) {}
        // If not actively counting down, close the modal locally
        if (!starting) {
          try { window.__confirmStartOpen = false; } catch (_) {}
          try { window.OverlayManager.dismiss('CONFIRM_START'); } catch (_) {}
        }
      };
      row.appendChild(cancelBtn);
    } else if (youAreReady) {
      // Ready players can unready (this cancels countdown if active)
      const unreadyBtn = document.createElement('button');
      unreadyBtn.textContent = starting ? 'Unready (cancel)' : 'Unready';
      unreadyBtn.onclick = () => {
        try { if (typeof onUnready === 'function') onUnready(); } catch (_) {}
        // Unready means we won't receive further confirm updates; close locally
        try { window.__confirmStartOpen = false; } catch (_) {}
        try { window.OverlayManager.dismiss('CONFIRM_START'); } catch (_) {}
      };
      row.appendChild(unreadyBtn);
    }

    content.appendChild(row);

    // Mark open for dynamic refresh hooks
    try { window.__confirmStartOpen = true; } catch (_) {}
  } catch (e) {
    console.warn('presentStartGameConfirm failed', e);
  }
}

function addCell(tr, text, isHeader = false) {
  const td = document.createElement(isHeader ? 'th' : 'td');
  td.textContent = text;
  td.style.borderBottom = '1px solid #333';
  td.style.padding = '4px 6px';
  tr.appendChild(td);
}
