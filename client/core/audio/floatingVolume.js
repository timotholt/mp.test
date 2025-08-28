// Floating Volume UI (V2) - clean, CSS-first, using volumeGroupManager.js groups
// Exports a single installer function. Keeps all state in DOM + window flags.

import { bindRange, getValue, setValue, DEFAULT_WHEEL_STEP } from './volumeGroupManager.js';

export function installFloatingVolumeUI() {
  // Feature-guarded creation
  let root = document.getElementById('floating-volume-v2');
  if (root) return root;

  // Inject minimal CSS (scoped by #floating-volume-v2)
  injectStyleOnce();

  root = document.createElement('div');
  root.id = 'floating-volume-v2';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Volume Controls');

  // Master always visible
  const master = makeSliderColumn('Master', 'MASTER');
  master.col.className = 'vol-col master';
  root.appendChild(master.col);

  // Panel of small sliders (shown on :hover or when extended/pinned)
  const panel = document.createElement('div');
  panel.className = 'panel';

  const game = makeSliderColumn('Game', 'GAME');
  const music = makeSliderColumn('Music', 'MUSIC');
  const voice = makeSliderColumn('Voice', 'VOICE');
  panel.appendChild(game.col);
  panel.appendChild(music.col);
  panel.appendChild(voice.col);

  root.appendChild(panel);

  // Pin toggle: pins the panel open by toggling .extended
  const pin = document.createElement('button');
  pin.className = 'pin';
  pin.textContent = '⟪';
  pin.title = 'Pin volume panel';
  pin.onclick = () => {
    const on = !root.classList.contains('extended');
    root.classList.toggle('extended', on);
    try { window.__volumeExtended = on; } catch (_) {}
  };
  root.appendChild(pin);

  // React to Settings interactions to temporarily expand/collapse
  window.addEventListener('ui:volume:adjusting', (e) => {
    try {
      const adj = !!(e && e.detail && e.detail.adjusting);
      // Only auto-expand if not pinned extended
      if (!root.classList.contains('extended')) root.classList.toggle('hovered', adj);
    } catch (_) {}
  });

  document.body.appendChild(root);
  return root;
}

function injectStyleOnce() {
  if (document.getElementById('floating-volume-v2-style')) return;
  const st = document.createElement('style');
  st.id = 'floating-volume-v2-style';
  st.textContent = `
  #floating-volume-v2 { position: fixed; bottom: 8px; right: 8px; z-index: 12000; 
    background: rgba(0,0,0,0.7); border: 1px solid var(--control-border, #444); border-radius: 8px; 
    padding: 6px; display: flex; align-items: center; gap: 6px; color: var(--ui-fg, #eee); }
  #floating-volume-v2 .panel { display: none; align-items: center; gap: 6px; }
  #floating-volume-v2:hover .panel, #floating-volume-v2.extended .panel, #floating-volume-v2.hovered .panel { display: flex; }
  #floating-volume-v2 .pin { background: transparent; color: var(--ui-fg, #eee); border: 1px solid var(--control-border, #555); border-radius: 4px; cursor: pointer; }
  #floating-volume-v2 .vol-col { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  #floating-volume-v2 .vol-col label { font-size: 10px; opacity: 0.9; }
  #floating-volume-v2 .vol-col .val { font-size: 10px; color: #ccc; min-width: 28px; text-align: center; }
  #floating-volume-v2 input[type="range"] { width: 120px; }
  `;
  document.head.appendChild(st);
}

function makeSliderColumn(labelText, groupId) {
  const col = document.createElement('div');
  const lbl = document.createElement('label');
  lbl.textContent = labelText;
  const valEl = document.createElement('div');
  valEl.className = 'val';
  const rng = document.createElement('input');
  rng.type = 'range';
  rng.min = '0'; rng.max = '1'; rng.step = String(DEFAULT_WHEEL_STEP);

  // Initialize label/value
  try {
    const init = getValue(groupId);
    rng.value = String(init);
    setValue(groupId, init, { silent: true });
    valEl.textContent = `${Math.round(init * 100)}%`;
    rng.title = valEl.textContent;
  } catch (_) {}

  bindRange(rng, groupId, {
    withWheel: true,
    emitOnInit: false,
    onRender: (v) => {
      try { const pct = `${Math.round(v * 100)}%`; valEl.textContent = pct; rng.title = pct; } catch (_) {}
    }
  });

  col.className = 'vol-col';
  col.appendChild(lbl);
  col.appendChild(valEl);
  col.appendChild(rng);
  return { col, rng, valEl };
}
