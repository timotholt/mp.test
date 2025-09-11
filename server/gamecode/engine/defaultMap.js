// Default map stub used by the dungeon generator until it's fully implemented.
// Keep this in sync with the previous hard-coded map in `NethackRoom.js`.

function getDefaultMap() {
  return [
    '####################',
    '#.............~~~~~#',
    '#..####..####..~~~~#',
    '#..#  #..#  #..,.,.#',
    '#..#  +==+  #......#',
    '#..####..####......#',
    '#..................#',
    '####################',
  ].join('\n');
}

module.exports = { getDefaultMap };
