// Keybinding presets for Controls tab
// Exported as a named constant for reuse by the Controls tab and related UIs.

export const PRESETS = {
  // Arrow keys baseline (minimal)
  arrows: {
    // Movement (primary)
    moveUp: 'ArrowUp',
    moveDown: 'ArrowDown',
    moveLeft: 'ArrowLeft',
    moveRight: 'ArrowRight',
    moveUpLeft: '',
    moveUpRight: '',
    moveDownLeft: '',
    moveDownRight: '',
    waitTurn: '',
    // Movement (secondary)
    moveUp2: '', moveDown2: '', moveLeft2: '', moveRight2: '',
    moveUpLeft2: '', moveUpRight2: '', moveDownLeft2: '', moveDownRight2: '', waitTurn2: '',
    // Movement (additional)
    quickMove: '', moveFar: '', jump: '', teleport: '',
    // Travel & Stairs
    ascendStairs: '', descendStairs: '', autoTravel: '', rideMonster: '', sitDown: '',
    // Interaction
    search: '', look: '', open: '', close: '', kick: '', lootContainer: '', untrap: '', forceLock: '', identifySymbol: '', identifyTrap: '', nameMonster: '', wipeFace: '', engrave: '', writeInscription: '', pay: '',
    // Magic & Spiritual
    castSpell: '', drink: '', zapWand: '', pray: '', dip: '', rub: '', offer: '', invoke: '', turnUndead: '', specialAbility: '', breakWand: '',
    // Combat
    wield: '', swapWeapon: '', throw: '', fire: '', targetNext: '', twoWeapon: '', viewSkills: '', raiseSkills: '',
    // Inventory & Items
    inventory: '', pickup: '', drop: '', dropMany: '', apply: '', eat: '', read: '', zap: '', quaff: '', wear: '', remove: '', quiverSelect: '', adjustInventory: '', nameObject: '', listWeapons: '', listArmor: '', listRings: '', listAmulets: '', listTools: '', listEquipment: '', listGold: '', listSpells: '', wearArmor: '', takeoffArmor: '', removeMulti: '', putOnRingAmulet: '', removeRingAmulet: '', listDiscoveries: '', listChallenges: '',
    // Extended (independent letter assignments)
    extendedPrefix: '#',
    extHelp: '?',
    extJump: 'j',
    extRide: 'r',
    extLoot: 'l',
    extUntrap: 'u',
    extTwoWeapon: 't',
    extNameObject: 'n',
    extListChallenges: 'c',
    // System & UI
    help: '', messageHistory: '', options: '', saveQuit: '', fullscreenToggle: '', playerInfo: '', save: '', quit: '', redo: '', talk: '', repeatMessage: '', toggleAutopickup: '', displayVersion: '', displayHistory: '', exploreMode: '', explainCommand: '', redrawScreen: '', suspend: '', bossKey: '',
  },

  // Vim/HJKL with diagonals and common NetHack commands
  vim: {
    // Movement (primary)
    moveUp: 'k',
    moveDown: 'j',
    moveLeft: 'h',
    moveRight: 'l',
    moveUpLeft: 'y',
    moveUpRight: 'u',
    moveDownLeft: 'b',
    moveDownRight: 'n',
    waitTurn: '.', // rest one turn
    // Movement (secondary)
    moveUp2: '',
    moveDown2: '',
    moveLeft2: '',
    moveRight2: '',
    moveUpLeft2: '',
    moveUpRight2: '',
    moveDownLeft2: '',
    moveDownRight2: '',
    waitTurn2: '',

    // Movement (additional)
    quickMove: 'g',   // go until something interesting
    moveFar: 'G',     // travel far
    jump: '',         // extended in NetHack; leave blank
    teleport: '',     // extended; leave blank

    // Travel & Stairs
    ascendStairs: '<',
    descendStairs: '>',
    autoTravel: 'g',  // alias of quick go; can be overridden
    rideMonster: '',  // extended: #ride
    sitDown: '',      // extended: #sit

    // Interaction
    search: 's',
    look: ':',
    open: 'o',
    close: 'c',
    kick: 'Ctrl+d',   // classic NetHack chord
    lootContainer: '',
    untrap: '',
    forceLock: '',
    identifySymbol: '/',
    identifyTrap: '^',
    nameMonster: 'C', // call monster/object class
    wipeFace: 'Ctrl+f', // approximate; often extended
    engrave: 'E',
    writeInscription: '',
    pay: 'p',
    // Magic & Spiritual
    castSpell: 'Z',
    drink: 'q',
    zapWand: 'z',
    pray: 'Ctrl+p',   // prayer via menu in some ports; placeholder chord
    dip: 'd',         // dip object
    rub: 'r',         // rub lamp
    offer: 'O',       // offer/sacrifice
    invoke: 'V',
    turnUndead: '',
    specialAbility: 'a', // apply as generic ability
    breakWand: '',

    // Combat
    wield: 'w',
    swapWeapon: 'x',
    throw: 't',
    fire: 'f',
    targetNext: ';',
    twoWeapon: 'X',
    viewSkills: 'S',
    raiseSkills: '',

    // Inventory & Items
    inventory: 'i',
    pickup: ',',
    drop: 'd',
    dropMany: 'D',
    apply: 'a',
    eat: 'e',
    read: 'r',
    quaff: 'q',
    wear: 'P',              // put on ring/amulet (classic P)
    remove: 'R',            // remove ring/amulet
    quiverSelect: 'Q',      // set quiver (ports vary)
    adjustInventory: 'A',   // adjust inventory letters
    nameObject: 'C',        // call
    listWeapons: ')',
    listArmor: ']',
    listRings: '=',
    listAmulets: '"',
    listTools: '(',
    listEquipment: '',
    listGold: '$',
    listSpells: '+',
    wearArmor: 'W',
    takeoffArmor: 'T',
    removeMulti: 'A',
    putOnRingAmulet: 'P',
    removeRingAmulet: 'R',
    listDiscoveries: '\\',
    listChallenges: '',
    // Extended (independent letter assignments)
    extendedPrefix: '#',
    extHelp: '?',           // # + ? = Help
    extJump: 'j',           // # + j = Jump
    extRide: 'r',           // # + r = Ride
    extLoot: 'l',           // # + l = Loot
    extUntrap: 'u',         // # + u = Untrap
    extTwoWeapon: 't',      // # + t = Two-Weapon
    extNameObject: 'n',     // # + n = Name Object
    extListChallenges: 'c', // # + c = List Challenges
    // System & UI
    help: '?',
    messageHistory: 'Ctrl+p',
    options: 'O',
    saveQuit: 'S',
    fullscreenToggle: '',
    playerInfo: '@',
    save: 'S',
    quit: 'Q',
    redo: '',
    talk: 'C',
    repeatMessage: 'Ctrl+p',
    toggleAutopickup: 'Ctrl+a',
    displayVersion: 'v',
    displayHistory: 'H',
    exploreMode: 'X',
    explainCommand: '/',
    redrawScreen: 'Ctrl+r',
    suspend: 'Ctrl+z',
    bossKey: '',
  },

  // WASD built from vim: QWE / ASD / ZXC for movement; digits for secondary.
  wasd: {
    // Movement (primary, 3x3 grid)
    moveUpLeft: 'q',
    moveUp: 'w',
    moveUpRight: 'e',
    moveLeft: 'a',
    waitTurn: 's',
    moveRight: 'd',
    moveDownLeft: 'z',
    moveDown: 'x',
    moveDownRight: 'c',
    // Movement (secondary via numpad digits)
    moveUpLeft2: '7', moveUp2: '8', moveUpRight2: '9',
    moveLeft2: '4',  waitTurn2: '5', moveRight2: '6',
    moveDownLeft2: '1', moveDown2: '2', moveDownRight2: '3',
    // Movement (additional)
    quickMove: 'g', moveFar: 'G', jump: '', teleport: '',
    // Travel & Stairs
    ascendStairs: '<', descendStairs: '>', autoTravel: 'g', rideMonster: '', sitDown: '',
    // Interaction (inherit vim where sensible)
    search: 's', look: ':', open: 'o', close: 'c', kick: 'Ctrl+d', lootContainer: '', untrap: '', forceLock: '', identifySymbol: '/', identifyTrap: '^', nameMonster: 'C', wipeFace: 'Ctrl+f', engrave: 'E', writeInscription: '', pay: 'p',
    // Magic & Spiritual
    castSpell: 'Z', drink: 'q', zapWand: 'z', pray: 'Ctrl+p', dip: 'd', rub: 'r', offer: 'O', invoke: 'V', turnUndead: '', specialAbility: 'a', breakWand: '',
    // Combat
    wield: 'w', swapWeapon: 'x', throw: 't', fire: 'f', targetNext: ';', twoWeapon: 'X', viewSkills: 'S', raiseSkills: '',
    // Inventory & Items
    inventory: 'i', pickup: ',', drop: 'd', dropMany: 'D', apply: 'a', eat: 'e', read: 'r', zap: 'z', quaff: 'q', wear: 'P', remove: 'R', quiverSelect: 'Q', adjustInventory: 'A', nameObject: 'C', listWeapons: ')', listArmor: ']', listRings: '=', listAmulets: '"', listTools: '(', listEquipment: '', listGold: '$', listSpells: '+', wearArmor: 'W', takeoffArmor: 'T', removeMulti: 'A', putOnRingAmulet: 'P', removeRingAmulet: 'R', listDiscoveries: '\\', listChallenges: '',
    // Extended (independent letter assignments)
    extendedPrefix: '#',
    extHelp: '?', extJump: 'j', extRide: 'r', extLoot: 'l', extUntrap: 'u', extTwoWeapon: 't', extNameObject: 'n', extListChallenges: 'c',
    // System & UI
    help: '?', messageHistory: 'Ctrl+p', options: 'O', saveQuit: 'S', fullscreenToggle: '', playerInfo: '@', save: 'S', quit: 'Q', redo: '', talk: 'C', repeatMessage: 'Ctrl+p', toggleAutopickup: 'Ctrl+a', displayVersion: 'v', displayHistory: 'H', exploreMode: 'X', explainCommand: '/', redrawScreen: 'Ctrl+r', suspend: 'Ctrl+z', bossKey: '',
  },
};
