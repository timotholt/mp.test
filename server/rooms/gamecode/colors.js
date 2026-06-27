// Default character color map used by the client renderer.
// Keep values in [0,1] range for each RGB channel.

function getDefaultCharacterColorMap() {
  return {
    '#': [0.75, 0.75, 0.75],
    '.': [0.35, 0.35, 0.35],
    ',': [0.10, 0.70, 0.10],
    '~': [0.20, 0.40, 1.00],
    '+': [0.90, 0.75, 0.20],
    '=': [0.85, 0.55, 0.15],
    '@': [1.00, 0.80, 0.40],  // player — warm bright glow, acts as a light source
  };
}

module.exports = { getDefaultCharacterColorMap };
