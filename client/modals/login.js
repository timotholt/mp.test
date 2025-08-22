// Login Modal & Backdrop (plain JS)
// Depends on global window.OverlayManager and optionally window.PRIORITY.
// Exports functions used by client/main.js to present the login UI.

export function presentLoginModal() {
  const id = 'LOGIN_MODAL';
  const PRIORITY = (window.PRIORITY || { MEDIUM: 50 });
  try {
    if (window.OverlayManager) {
      window.OverlayManager.present({ id, text: '', actions: [], blockInput: true, priority: PRIORITY.MEDIUM });
    }
  } catch (_) {}

  const content = document.getElementById('overlay-content');
  if (!content) return;
  content.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Welcome to Hack40k';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '20px';
  title.style.marginBottom = '10px';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  row.style.marginTop = '6px';

  const label = document.createElement('label');
  label.textContent = 'Name:';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Hero';
  input.value = localStorage.getItem('name') || '';

  const ok = document.createElement('button');
  ok.textContent = 'Enter Lobby';
  ok.onclick = () => {
    const n = (input.value || '').trim() || 'Hero';
    localStorage.setItem('name', n);
    if (window.OverlayManager) window.OverlayManager.dismiss(id);
    // Route into lobby by setting a marker and relying on main.js to start lobby
    if (typeof window.startLobby === 'function') {
      window.startLobby();
    } else {
      // Fallback: dispatch a custom event main.js can listen for
      window.dispatchEvent(new CustomEvent('hack40k:startLobby'));
    }
  };

  row.appendChild(label);
  row.appendChild(input);
  content.appendChild(title);
  content.appendChild(row);
  const actions = document.createElement('div');
  actions.style.marginTop = '10px';
  actions.appendChild(ok);
  content.appendChild(actions);
}

export function showLoginBackdrop() {
  // Ensure renderer container exists and is full-screen and visible.
  const container = document.getElementById('rc-canvas');
  if (container) {
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.display = '';
    container.style.zIndex = '1';
    container.style.pointerEvents = 'none'; // modal handles input
  }
  // Paint a small demo dungeon if nothing has arrived yet
  const demo = buildDemoDungeon();
  if (window.radianceCascades && typeof window.radianceCascades.setDungeonMap === 'function') {
    window.radianceCascades.setDungeonMap(demo);
  } else {
    window.__pendingDungeonMap = demo;
  }
}

function buildDemoDungeon() {
  // Tiny ASCII room with a door; readable even if color maps missing
  const w = 60, h = 24;
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => '#'));
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) grid[y][x] = '.';
  }
  grid[Math.floor(h/2)][0] = '+'; // a door on left
  return grid.map(r => r.join('')).join('\n');
}
