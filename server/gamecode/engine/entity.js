// Base Entity schema shared by players, monsters, etc.
// Keep minimal and human-readable. Extend later with HP, AI, etc.

const { Schema, defineTypes } = require('@colyseus/schema');

class Location extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.level = 0;
  }
}

class Entity extends Schema {
  constructor() {
    super();
    this.id = '';
    this.name = '';
    this.kind = 'entity'; // 'player' | 'monster' | ...
    this.glyph = '?';
    this.blocksMovement = true; // entities block by default
    this.currentLocation = new Location();
    this.lastLocation = new Location();
  }
}

defineTypes(Location, {
  x: 'number',
  y: 'number',
  level: 'number',
});

defineTypes(Entity, {
  id: 'string',
  name: 'string',
  kind: 'string',
  glyph: 'string',
  blocksMovement: 'boolean',
  currentLocation: Location,
  lastLocation: Location,
});

module.exports = { Location, Entity };
