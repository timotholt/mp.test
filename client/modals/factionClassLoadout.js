// Faction / Class / Loadout selection modal (server-driven)
// Exports: presentFCLSelectModal({ factions, classes, loadouts, selection, complete, onSelectFaction, onSelectClass, onSelectLoadout, priority })
// Relies on global OverlayManager and window.PRIORITY set by client/main.js

export function presentFCLSelectModal({ factions = [], classes = [], loadouts = [], selection = {}, complete = false, onSelectFaction, onSelectClass, onSelectLoadout, onReady, priority } = {}) {
  try {
    // If complete, dismiss if open
    if (complete) {
      try { window.OverlayManager.dismiss('FCL_SELECT'); } catch (_) {}
      return;
    }

    const prio = (typeof priority === 'number') ? priority : ((window.PRIORITY && window.PRIORITY.MEDIUM) || 50);
    window.OverlayManager.present({ id: 'FCL_SELECT', text: '', actions: [], blockInput: false, priority: prio, external: true });
    const content = document.getElementById('overlay-content');
    if (!content) return;
    content.innerHTML = '';

    // Title
    const title = document.createElement('div');
    title.textContent = 'Choose Faction, Class, and Loadout';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.style.color = '#fff';
    content.appendChild(title);

    // Helper to make a grid of buttons with icons
    function addButtonGrid(label, items, selectedKey, onClick, kind) {
      const section = document.createElement('div');
      const lbl = document.createElement('div');
      lbl.textContent = label;
      lbl.style.margin = '6px 0 4px';
      lbl.style.opacity = '0.9';
      lbl.style.color = '#fff';
      section.appendChild(lbl);

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.flexWrap = 'wrap';

      items.forEach(it => {
        const btn = document.createElement('button');
        btn.style.display = 'flex';
        btn.style.flexDirection = 'column';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.padding = '6px 8px';
        btn.style.minWidth = '90px';
        btn.style.border = (it.key === selectedKey) ? '2px solid #6cf' : '1px solid #444';
        btn.style.background = (it.key === selectedKey) ? 'rgba(80,120,200,0.2)' : 'rgba(0,0,0,0.2)';
        btn.style.color = '#fff';
        const icon = document.createElement('div');
        icon.textContent = it.icon || '◻';
        icon.style.fontSize = '22px';
        const name = document.createElement('div');
        name.textContent = it.name || it.key;
        name.style.marginTop = '4px';
        btn.appendChild(icon);
        btn.appendChild(name);
        btn.onclick = () => {
          // Optimistic visual selection
          try {
            Array.from(row.children).forEach((child) => {
              const k = child && child.textContent ? (child.querySelector('div:nth-child(2)')?.textContent ? it.key /* placeholder */ : null) : null;
            });
          } catch (_) {}
          // Update local selection state
          try {
            if (kind === 'faction') { localSel.faction = it.key; }
            else if (kind === 'class') { localSel.classKey = it.key; }
          } catch (_) {}
          // Enable Ready if now complete
          try { if (readyBtn) readyBtn.disabled = !(localSel.faction && localSel.classKey && localSel.loadout); } catch (_) {}
          // Notify server
          try { onClick && onClick(it.key); } catch (_) {}
        };
        row.appendChild(btn);
      });

      section.appendChild(row);
      content.appendChild(section);
    }

    const selFaction = selection.faction || '';
    const selClass = selection.classKey || '';
    const selLoadout = selection.loadout || '';
    // Track current local selection so we can enable the Ready button optimistically
    const localSel = { faction: selFaction, classKey: selClass, loadout: selLoadout };

    // Top row: Factions
    addButtonGrid('Faction', factions, selFaction, (key) => {
      try { if (typeof onSelectFaction === 'function') onSelectFaction(key); } catch (_) {}
    }, 'faction');

    // Bottom row: Classes
    addButtonGrid('Class', classes, selClass, (key) => {
      try { if (typeof onSelectClass === 'function') onSelectClass(key); } catch (_) {}
    }, 'class');

    // Loadouts area
    const loLabel = document.createElement('div');
    loLabel.textContent = 'Loadout';
    loLabel.style.margin = '10px 0 4px';
    loLabel.style.color = '#fff';
    content.appendChild(loLabel);

    // Hoist ready button reference so we can enable it optimistically on loadout click
    let readyBtn;

    const loRow = document.createElement('div');
    loRow.style.display = 'flex';
    loRow.style.gap = '8px';
    loRow.style.flexWrap = 'wrap';
    (loadouts || []).forEach(it => {
      const btn = document.createElement('button');
      btn.style.display = 'flex';
      btn.style.flexDirection = 'column';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.padding = '6px 8px';
      btn.style.minWidth = '90px';
      btn.style.border = (it.key === selLoadout) ? '2px solid #6cf' : '1px solid #444';
      btn.style.background = (it.key === selLoadout) ? 'rgba(80,120,200,0.2)' : 'rgba(0,0,0,0.2)';
      btn.style.color = '#fff';
      btn.dataset.key = it.key;
      const icon = document.createElement('div');
      icon.textContent = it.icon || '🎒';
      icon.style.fontSize = '22px';
      const name = document.createElement('div');
      name.textContent = it.name || it.key;
      name.style.marginTop = '4px';
      btn.appendChild(icon);
      btn.appendChild(name);
      btn.onclick = () => {
        try { console.log('[FCL] loadout click', it.key); } catch (_) {}
        // Optimistic visual selection
        try {
          Array.from(loRow.children).forEach((child) => {
            const k = child && child.dataset ? child.dataset.key : null;
            if (!k) return;
            child.style.border = (k === it.key) ? '2px solid #6cf' : '1px solid #444';
            child.style.background = (k === it.key) ? 'rgba(80,120,200,0.2)' : 'rgba(0,0,0,0.2)';
          });
        } catch (_) {}
        try { if (typeof onSelectLoadout === 'function') onSelectLoadout(it.key); } catch (_) {}
        // Update local selection and enable Ready if complete
        try { localSel.loadout = it.key; } catch (_) {}
        try { if (readyBtn) readyBtn.disabled = !(localSel.faction && localSel.classKey && localSel.loadout); } catch (_) {}
      };
      loRow.appendChild(btn);
    });
    content.appendChild(loRow);

    // Action row: Ready button (enabled when all three are selected)
    const actionRow = document.createElement('div');
    actionRow.style.marginTop = '12px';
    actionRow.style.display = 'flex';
    actionRow.style.justifyContent = 'flex-end';
    readyBtn = document.createElement('button');
    readyBtn.textContent = 'Ready';
    readyBtn.style.padding = '6px 12px';
    readyBtn.style.background = 'rgba(0,0,0,0.2)';
    readyBtn.style.border = '1px solid #444';
    readyBtn.style.color = '#fff';
    readyBtn.disabled = !(selFaction && selClass && selLoadout);
    readyBtn.onclick = () => {
      try { if (typeof onReady === 'function') onReady(); } catch (_) {}
    };
    actionRow.appendChild(readyBtn);
    content.appendChild(actionRow);

  } catch (e) {
    console.warn('presentFCLSelectModal failed', e);
  }
}
