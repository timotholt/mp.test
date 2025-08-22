// Start Game confirmation modal (host-only presentation, server-driven)
// Exports: presentStartGameConfirm({ players, canStart, onStart, onCancel, priority })
// Relies on global OverlayManager and window.PRIORITY set by client/main.js

export function presentStartGameConfirm({ players = [], canStart = false, onStart, onCancel, priority } = {}) {
  try {
    const prio = (typeof priority === 'number') ? priority : ((window.PRIORITY && window.PRIORITY.MEDIUM) || 50);
    // Non-blocking so lobby/room UI remains interactive while we wait
    window.OverlayManager.present({ id: 'CONFIRM_START', text: '', actions: [], blockInput: false, priority: prio });
    const content = document.getElementById('overlay-content');
    if (!content) return;
    content.innerHTML = '';

    // Title
    const title = document.createElement('div');
    title.textContent = 'Start game?';
    title.style.fontWeight = 'bold';
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

    // Summary
    const summary = document.createElement('div');
    summary.style.marginTop = '8px';
    const allReady = (total > 0) && (readyCount === total) && (players.every(p => p && p.online !== false));
    const allow = (typeof canStart === 'boolean') ? canStart : allReady;
    summary.textContent = `${readyCount}/${total} ready` + (allow ? '' : ' — waiting for players...');
    content.appendChild(summary);

    // Buttons
    const row = document.createElement('div');
    row.style.marginTop = '10px';

    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start';
    startBtn.disabled = !allow;
    startBtn.onclick = () => {
      try { if (typeof onStart === 'function') onStart(); } catch (_) {}
      try { window.__confirmStartOpen = false; } catch (_) {}
      try { window.OverlayManager.dismiss('CONFIRM_START'); } catch (_) {}
    };

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.marginLeft = '8px';
    cancel.onclick = () => {
      try { if (typeof onCancel === 'function') onCancel(); } catch (_) {}
      try { window.__confirmStartOpen = false; } catch (_) {}
      try { window.OverlayManager.dismiss('CONFIRM_START'); } catch (_) {}
    };

    row.appendChild(startBtn);
    row.appendChild(cancel);
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
