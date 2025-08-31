// Default two-column renderer
// Renders labeled rows with the key on the right. Applies a two-column grid
// when there are many actions, or for specific groups, mirroring controlTab.js logic.

export function renderDefaultTwoColGroup({ g, gSec, attachKeyForAction }) {
  if (!g || !gSec) return;
  const wrap = document.createElement('div');
  const useTwoCol = (
    g.id === 'magic' || g.id === 'spiritual' || g.id === 'lists' || g.id === 'movementAdvanced'
  ) || (g.actions && g.actions.length >= 12);
  if (useTwoCol) wrap.className = 'sf-kb-two-col';
  gSec.appendChild(wrap);

  (g.actions || []).forEach((act) => {
    const row = document.createElement('div');
    row.className = 'sf-kb-row';
    const lab = document.createElement('div');
    lab.className = 'sf-kb-label';
    lab.textContent = act.label;
    row.appendChild(lab);
    const cell = document.createElement('div');
    cell.className = 'sf-kb-cell';
    row.appendChild(cell);
    attachKeyForAction(cell, act);
    wrap.appendChild(row);
  });
}
