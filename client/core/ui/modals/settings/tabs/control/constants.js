// Shared constants for the Controls tab UI

// Arrow glyphs for movement ring and wait
export const MOVE_GLYPHS = {
  moveUpLeft: '↖',
  moveUp: '↑',
  moveUpRight: '↗',
  moveLeft: '←',
  waitTurn: '•',
  moveRight: '→',
  moveDownLeft: '↙',
  moveDown: '↓',
  moveDownRight: '↘',
};

// Centralized list of key names that should render as wide keycaps.
// Includes both 'Delete' and shorthand 'Del' and common nav keys.
export const WIDE_KEY_NAMES = new Set([
  'Enter','Space','Tab','CapsLock','Insert','Delete','Del',
  'PageUp','PageDown','Home','End','PrintScreen'
]);
