// Initialize a new player with default NetHack-style glyph and any per-player metadata.
// Keep this minimal; extend later as needed.

function initPlayer(player) {
  // NetHack player glyph
  player.glyph = '@';
  // Additional metadata (non-schema) can be attached as plain JS
  // e.g., player.meta = { /* ... */ };
  return player;
}

module.exports = { initPlayer };
