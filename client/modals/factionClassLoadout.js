// Faction / Class / Loadout selection modal (server-driven)
// Exports: presentFCLSelectModal({ factions, classes, loadouts, selection, complete, onSelectFaction, onSelectClass, onSelectLoadout, priority })
// Relies on global OverlayManager and window.PRIORITY set by client/main.js

export function presentFCLSelectModal({ factions = [], classes = [], loadouts = [], selection = {}, complete = false, onSelectFaction, onSelectClass, onSelectLoadout, priority } = {}) {
  try {
    // If complete, dismiss if open
    if (complete) {
      try { window.OverlayManager.dismiss('FCL_SELECT'); } catch (_) {}
      return;
    }

    const prio = (typeof priority === 'number') ? priority : ((window.PRIORITY && window.PRIORITY.MEDIUM) || 50);
    window.OverlayManager.present({ id: 'FCL_SELECT', text: '', actions: [], blockInput: false, priority: prio });
    const content = document.getElementById('overlay-content');
    if (!content) return;
    content.innerHTML = '';

    // Title
    const title = document.createElement('div');
    title.textContent = 'Choose Faction, Class, and Loadout';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    content.appendChild(title);

    // Helper to make a grid of buttons with icons
    function addButtonGrid(label, items, selectedKey, onClick) {
      const section = document.createElement('div');
      const lbl = document.createElement('div');
      lbl.textContent = label;
      lbl.style.margin = '6px 0 4px';
      lbl.style.opacity = '0.9';
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
        const icon = document.createElement('div');
        icon.textContent = it.icon || '◻';
        icon.style.fontSize = '22px';
        const name = document.createElement('div');
        name.textContent = it.name || it.key;
        name.style.marginTop = '4px';
        btn.appendChild(icon);
        btn.appendChild(name);
        btn.onclick = () => { try { onClick && onClick(it.key); } catch (_) {} };
        row.appendChild(btn);
      });

      section.appendChild(row);
      content.appendChild(section);
    }

    const selFaction = selection.faction || '';
    const selClass = selection.classKey || '';
    const selLoadout = selection.loadout || '';

    // Top row: Factions
    addButtonGrid('Faction', factions, selFaction, (key) => {
      try { if (typeof onSelectFaction === 'function') onSelectFaction(key); } catch (_) {}
    });

    // Bottom row: Classes
    addButtonGrid('Class', classes, selClass, (key) => {
      try { if (typeof onSelectClass === 'function') onSelectClass(key); } catch (_) {}
    });

    // Loadouts area
    const loLabel = document.createElement('div');
    loLabel.textContent = 'Loadout';
    loLabel.style.margin = '10px 0 4px';
    content.appendChild(loLabel);

    const loRow = document.createElement('div');
    loRow.style.display = 'flex';
    loRow.style.gap = '8px';
    loRow.style.flexWrap = 'wrap';
    (loadouts || []).forEach(it => {
      const btn = document.createElement('button');
      btn.textContent = it.name || it.key;
      btn.style.border = (it.key === selLoadout) ? '2px solid #6cf' : '1px solid #444';
      btn.style.background = (it.key === selLoadout) ? 'rgba(80,120,200,0.2)' : 'rgba(0,0,0,0.2)';
      btn.onclick = () => { try { if (typeof onSelectLoadout === 'function') onSelectLoadout(it.key); } catch (_) {} };
      loRow.appendChild(btn);
    });
    content.appendChild(loRow);

  } catch (e) {
    console.warn('presentFCLSelectModal failed', e);
  }
}
