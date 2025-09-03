// Movement Rings renderer
// Renders the dual circular movement layout (Primary/Secondary rings)
// Dependencies are passed in to avoid cross-module coupling.
import { createUiElement, basicFormLabel } from '../../../../../theme/themeManager.js';

export function renderMovementGroup({
  g,
  gSec,
  state,
  registerKeyEl,
  prettyKey,
  buildKeycap,
  updateTooltip,
  startListening,
  arrowByAction,
  KEY_GROUPS,
  MOVE_GLYPHS,
}) {
  if (!g || !gSec) return;

  // Dual movement rings: left Primary uses 'movement' actions, right Secondary uses 'movementSecondary'
  const duo = document.createElement('div');
  duo.className = 'sf-kb-move-duo';

  function ringFor(groupId, title, ids) {
    const col = document.createElement('div');
    col.className = 'sf-kb-move-col';
    const titleEl = createUiElement(basicFormLabel, title);
    try { titleEl.classList.add('sf-kb-move-title'); } catch (_) {}
    try { titleEl.style.display = 'block'; } catch (_) {}
    col.appendChild(titleEl);
    const circle = document.createElement('div');
    circle.className = 'sf-kb-move-circle';
    col.appendChild(circle);

    // REM-based geometry to match CSS: .sf-kb-move-circle { width/height: 13rem }
    const centerRem = 6.5; // half of 13rem circle
    const rArrowRem = centerRem * (87 / 110); // preserve original proportions
    const rKeyRem = centerRem * (55 / 110);   // preserve original proportions

    function place(el, angleDeg, radiusRem) {
      const rad = (angleDeg * Math.PI) / 180;
      const xRem = centerRem + Math.cos(rad) * radiusRem;
      const yRem = centerRem + Math.sin(rad) * radiusRem;
      el.style.left = xRem + 'rem';
      el.style.top = yRem + 'rem';
    }

    function addArrow(angleDeg, glyph) {
      const s = document.createElement('span');
      s.className = 'arrow';
      s.textContent = glyph;
      place(s, angleDeg, rArrowRem);
      circle.appendChild(s);
      return s;
    }

    function addKey(actId, angleDeg, radiusRem) {
      // Find action definition across KEY_GROUPS by id
      let act = null;
      for (const gg of KEY_GROUPS) { const f = (gg.actions || []).find(a => a.id === actId); if (f) { act = f; break; } }
      if (!act) return;
      const cur = state.map[act.id] || '';
      const cap = buildKeycap(act, cur ? prettyKey(cur) : '', 'themed', { mode: 'far', placement: 't' });
      place(cap.btn, angleDeg, radiusRem);
      updateTooltip(cap.btn, `${act.label} — ${cur ? 'bound to: ' + prettyKey(cur) : 'UNBOUND'}. Click to rebind`);
      cap.btn.onclick = () => startListening(cap.btn, act);
      registerKeyEl(act.id, { btn: cap.btn, lab: cap.lab, label: act.label, mglyph: false });
      circle.appendChild(cap.btn);
    }

    // Arrows (track by action id for dimming when unbound)
    arrowByAction.set(ids.ul, addArrow(-135, MOVE_GLYPHS.moveUpLeft));
    arrowByAction.set(ids.u,  addArrow(-90,  MOVE_GLYPHS.moveUp));
    arrowByAction.set(ids.ur, addArrow(-45,  MOVE_GLYPHS.moveUpRight));
    arrowByAction.set(ids.l,  addArrow(180,  MOVE_GLYPHS.moveLeft));
    arrowByAction.set(ids.r,  addArrow(0,    MOVE_GLYPHS.moveRight));
    arrowByAction.set(ids.dl, addArrow(135,  MOVE_GLYPHS.moveDownLeft));
    arrowByAction.set(ids.d,  addArrow(90,   MOVE_GLYPHS.moveDown));
    arrowByAction.set(ids.dr, addArrow(45,   MOVE_GLYPHS.moveDownRight));

    // Keycaps slightly inside the arrows
    addKey(ids.ul, -135, rKeyRem);
    addKey(ids.u,  -90,  rKeyRem);
    addKey(ids.ur, -45,  rKeyRem);
    addKey(ids.l,  180,  rKeyRem);
    addKey(ids.c,  0,    0);   // center wait
    addKey(ids.r,  0,    rKeyRem);
    addKey(ids.dl, 135,  rKeyRem);
    addKey(ids.d,  90,   rKeyRem);
    addKey(ids.dr, 45,   rKeyRem);

    return col;
  }

  const primary = ringFor('movement', 'Primary', {
    ul: 'moveUpLeft', u: 'moveUp', ur: 'moveUpRight', l: 'moveLeft', c: 'waitTurn', r: 'moveRight', dl: 'moveDownLeft', d: 'moveDown', dr: 'moveDownRight'
  });
  const secondary = ringFor('movementSecondary', 'Secondary', {
    ul: 'moveUpLeft2', u: 'moveUp2', ur: 'moveUpRight2', l: 'moveLeft2', c: 'waitTurn2', r: 'moveRight2', dl: 'moveDownLeft2', d: 'moveDown2', dr: 'moveDownRight2'
  });

  duo.appendChild(primary);
  duo.appendChild(secondary);
  gSec.appendChild(duo);
}
