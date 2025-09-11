// Default gameplay map (ASCII). Server-side only.

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
