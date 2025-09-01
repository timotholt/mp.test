// Extended Commands renderer
// Renders the special layout for the "Extended" group as [prefix] + [interactive letter]
// Dependencies are passed in to avoid cross-module coupling.

export function renderExtendedGroup({
  g,
  gSec,
  state,
  registerKeyEl,
  prettyKey,
  buildKeycap,
  updateTooltip,
  startListening,
  extMirrorEls,
}) {
  if (!g || !gSec) return;

  const wrap = document.createElement('div');
  gSec.appendChild(wrap);
  // Widen key column for two-key chord (prefix + letter)
  try { gSec.style.setProperty('--kb-keycol', '10.5rem'); } catch (_) {}

  g.actions.forEach((act) => {
    const row = document.createElement('div');
    row.className = 'sf-kb-row';
    const lab = document.createElement('div');
    lab.className = 'sf-kb-label';
    lab.textContent = act.label;
    row.appendChild(lab);
    const cell = document.createElement('div');
    cell.className = 'sf-kb-cell';
    row.appendChild(cell);

    if (act.id === 'extendedPrefix') {
      const k0 = state.map[act.id] || '';
      const cap = buildKeycap(act, k0 ? prettyKey(k0) : '', 'themed', { mode: 'far', placement: 'r' });
      updateTooltip(cap.btn, `${act.label} — ${k0 ? 'bound to: ' + prettyKey(k0) : 'UNBOUND'}. Click to rebind`);
      cap.btn.onclick = () => startListening(cap.btn, act);
      // Place the prefix cap in the RIGHT key column and align it exactly
      // like other rows by appending hidden "+" and letter ghosts to the right.
      try {
        lab.textContent = act.label;
        // Match layout used by other extended rows
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        // Visible prefix
        cell.appendChild(cap.btn);
        // Hidden plus preserves spacing
        const plusGhost = document.createElement('span');
        plusGhost.textContent = ' + ';
        plusGhost.style.margin = '0 0.375rem';
        plusGhost.style.color = 'var(--ui-fg, #eee)';
        plusGhost.style.visibility = 'hidden';
        cell.appendChild(plusGhost);
        // Hidden letter cap preserves spacing
        const dummyAct = { id: '__dummy_ext_letter', label: '' };
        const ghost = buildKeycap(dummyAct, 'x', '', null);
        ghost.btn.style.visibility = 'hidden';
        ghost.btn.style.pointerEvents = 'none';
        ghost.btn.tabIndex = -1;
        cell.appendChild(ghost.btn);
      } catch (_) {
        cell.appendChild(cap.btn);
      }
      // Track updates without giving renderAll a cell to rebuild
      registerKeyEl(act.id, { btn: cap.btn, lab: cap.lab, label: act.label, mglyph: false, act });
      // also track for mirror updates
      if (extMirrorEls) extMirrorEls.push({ lab: cap.lab, btn: cap.btn });
      wrap.appendChild(row);
      return;
    }

    // Build prefix mirror + interactive letter (independent from base commands)
    const prefixAct = { id: 'extendedPrefix', label: 'Extended Prefix' };
    const pk = state.map['extendedPrefix'] || '';
    const pcap = buildKeycap(prefixAct, pk ? prettyKey(pk) : '', 'themed', { mode: 'far', placement: 'l' });
    updateTooltip(pcap.btn, `Prefix — ${pk ? 'bound to: ' + prettyKey(pk) : 'UNBOUND'} (click to rebind)`);
    pcap.btn.onclick = () => startListening(pcap.btn, prefixAct);

    const plus = document.createElement('span');
    plus.textContent = ' + ';
    plus.style.margin = '0 0.375rem';
    plus.style.color = 'var(--ui-fg, #eee)';
    // Interactive letter cap uses this action's own independent binding
    const lk = state.map[act.id] || '';
    const lcap = buildKeycap(act, lk ? prettyKey(lk) : '', '', { mode: 'far', placement: 'r' });
    updateTooltip(lcap.btn, `${act.label} — ${lk ? 'bound to: ' + prettyKey(lk) : 'UNBOUND'} (click to rebind)`);
    lcap.btn.onclick = () => startListening(lcap.btn, act);

    cell.style.display = 'flex';
    cell.style.alignItems = 'center';
    cell.appendChild(pcap.btn);
    cell.appendChild(plus);
    cell.appendChild(lcap.btn);
    if (extMirrorEls) extMirrorEls.push({ lab: pcap.lab, btn: pcap.btn });
    // Track the interactive letter for updates without giving renderAll a 'cell'
    // so it doesn't rebuild this row and wipe the prefix+letter layout.
    registerKeyEl(act.id, { btn: lcap.btn, lab: lcap.lab, label: act.label, mglyph: false, act });
    wrap.appendChild(row);
  });
}
