// Always-on Canvas Dimming Shade
export function ensureScreenShade() {
  let shade = document.getElementById('screen-shade');
  if (!shade) {
    shade = document.createElement('div');
    shade.id = 'screen-shade';
    shade.style.position = 'fixed';
    shade.style.inset = '0';
    shade.style.background = 'rgba(0,0,0,0.5)';
    shade.style.zIndex = '2000'; // below overlay (9999), above canvas (1)
    shade.style.display = 'none';
    shade.style.pointerEvents = 'none';
    document.body.appendChild(shade);
  }
  return shade;
}
