# Level Editor Spec (RoomSpec v1)

Author levels as a plain JavaScript module that exports a `roomSpec` object (CommonJS). The server/editor can import, validate, and compile it using `compileRoomSpec()`.

- Authoritative format: .js (CommonJS): `module.exports = { roomSpec }`
- Optional interchange: .json (the editor can import/export JSON for copy/paste or backups)
- Zero functions in the spec (pure data). Human-editable, diff-friendly.

## Goals

- Three non-occluding floor layers (0, 1, 2). Space is transparent; floors never occlude.
- One statics (occluder) layer for walls/solid props (e.g., `#`, `|`, `=`).
- Optional colors, lights, entities, and spawn policy.
- Server compiles into ASCII map + floor layers; client renders with existing renderer (no HTML/CSS changes).

## File Locations

- Per-scenario spec (recommended):
  - `server/gamecode/engine/gameMaster/scenarios/<name>/roomSpec.js`
- Documentation:
  - `docs/levelEditorSpec.md` (this file, or keep as `room specs.md` for now)

## RoomSpec Format

RoomSpec is a plain object, exported as `module.exports = { roomSpec }`.

Required fields:
- `id: string` unique id (e.g., `login_spaceport_v1`)
- `name: string` friendly name
- `size: { width: number, height: number }` grid dimensions
- `layers: Array<Layer>` three floors + statics, described below

Optional fields:
- `palette: { ... }` canonical glyphs for convenience
- `colors: { tiles: { [glyph]: [r,g,b] }, ambient?: [r,g,b] }` RGB in 0..1
- `lights: Array<Light>` future lighting
- `entities: { static: Array<Entity>, spawners: Array<Spawner> }`
- `spawn: { mode?: 'center'|'fixed'|'area', x?: number, y?: number, clamp?: boolean }`
- `occluders?: string[]` override occluder glyph set (defaults: `['#','|','=']`)

### Layers

There are exactly three floor layers and at least one statics layer. Floor layers do not occlude and are composited bottom→top. Statics are used for collision and FOV.

- Floor layer
  - `kind: 'floor'`
  - `z: 0 | 1 | 2` (0 = base, 1 = mid, 2 = top)
  - `data: string[]` exactly `size.height` rows of `size.width` characters
  - Space `' '` is transparent

- Statics layer (occluders)
  - Omit `kind` (or use `type: 'tiles'`)
  - `data: string[]` exactly `size.height` rows; non-space chars are baked as occluders
  - By default, glyphs `#`, `|`, `=` are treated as walls (blocked). You can extend via `occluders` in the root.

### Lights (optional)

- `{ x: number, y: number, intensity: number, color?: [r,g,b], falloff?: 'linear'|'quadratic' }`

### Entities (optional)

- `static: Array<{ kind: string, glyph?: string, x: number, y: number, color?: [r,g,b], props?: object }>`
- `spawners: Array<{ kind: string, count: number, area: { x1:number,y1:number,x2:number,y2:number }, props?: object }>`
- These are for dynamic rendering/logic; they don’t block unless your game rules decide so.

### Spawn (optional)

- `mode: 'center' | 'fixed' | 'area'`
- If `fixed`, provide `x`, `y`.
- `clamp: boolean` to clamp into interior tiles.

### Validation Rules

- `layers[*].data.length === size.height`
- Every row string is exactly `size.width` chars.
- Floor layer requires `kind: 'floor'` and `z` in [0,1,2].
- Non-floor layers are treated as statics by default.
- Colors are `[r,g,b]` floats in [0..1].
- Unknown glyphs are allowed; they’ll render with default color unless present in `colors.tiles`.

## Rendering Semantics

- Floors: composite floor0 → floor1 → floor2 with transparency on space `' '`. Floors never impact collision or FOV.
- Statics: provide the occluder map for collision and FOV.
- Entities: drawn above floors; may or may not occlude depending on future logic (not required now).

## Compilation (Server)

Use `compileRoomSpec(roomSpec)` from `server/gamecode/engine/compiler/compileRoomSpec.js`.

Output object:
- `map: string` legacy ASCII of occluders (used today by collision/FOV)
- `floorLayers: [string, string, string]` floors 0..2 as strings (H lines each)
- `colors, lights, entities, spawn, size, id, name`: passed through for future use

The login room already compiles a spec and sends:
- `dungeonMap` (legacy map for current renderer path)
- `positionColorMap` (unchanged)
- `floorLayers` (new; the client can ignore until the renderer path is added)

## Editor Behavior

- The editor opens/creates a `roomSpec.js` under `server/gamecode/engine/gameMaster/scenarios/<name>/`.
- Palette modes:
  - Floor 0 (base): paints into `z:0`
  - Floor 1 (mid): paints into `z:1`
  - Floor 2 (top): paints into `z:2`
  - Statics: paints into the statics layer
- The editor UI implicitly selects the correct target layer based on the palette mode; the user doesn’t need to choose layers manually.
- Tools:
  - Paint (single tile)
  - Line (click-drag)
  - Rectangle (outline or fill)
  - Eraser (paints `' '`, i.e., transparent)
  - Eyedropper (pick glyph + color)
- Colors:
  - Optional color swatch applied to glyph class or direct-tile override (editor keeps it as glyph color in `colors.tiles`; per-tile color can be a future extension).
- Preview:
  - Uses the existing client renderer to display composite floors and statics.
  - The editor can switch between “author preview” (floors composited) and “legacy view” (occluder map only).

## Saving/Loading

Authoritative format: `.js` CommonJS module.

Example file:

```js
// roomSpec.js — DO NOT wrap in functions
const roomSpec = {
  id: 'example_level_v1',
  name: 'Example Level',
  size: { width: 60, height: 20 },
  palette: { floor: '.', wallSingle: '#', wallDoubleV: '|', wallDoubleH: '=', door: '+', spawnUp: '^', spawnDown: '@', water: '~', grass: ',' },
  colors: {
    tiles: {
      '.': [0.14, 0.14, 0.16],
      '#': [0.45, 0.45, 0.50],
      '|': [0.40, 0.40, 0.46],
      '=': [0.40, 0.40, 0.46],
      '+': [0.85, 0.75, 0.40],
      '~': [0.12, 0.22, 0.40],
      ',': [0.18, 0.22, 0.16],
      '^': [0.90, 0.90, 0.95],
      '@': [0.90, 0.90, 0.95],
    },
    ambient: [0.06, 0.06, 0.07],
  },
  layers: [
    { kind: 'floor', z: 0, data: [ /* H rows of W chars */ ] },
    { kind: 'floor', z: 1, data: [ /* … */ ] },
    { kind: 'floor', z: 2, data: [ /* … */ ] },
    { name: 'statics', type: 'tiles', data: [ /* occluders */ ] },
  ],
  lights: [],
  entities: { static: [], spawners: [] },
  spawn: { mode: 'center', clamp: true },
  occluders: ['#','|','='], // optional override
};
module.exports = { roomSpec };
```

JSON Interchange (optional):
- Editor can import/export JSON with the same shape as `roomSpec`.
- When saving to `.js`, the editor writes a stable, readable file:
  - 2-space indentation
  - keys in consistent order (size, palette, colors, layers, lights, entities, spawn, occluders)
  - trailing newline

## Server Integration (Editor I/O)

When implemented:
- GET `/api/roomspec/load?path=<scenario>/roomSpec.js` → returns `{ roomSpec }`
- POST `/api/roomspec/save` with `{ path, roomSpec }` → writes `.js` module
  - Server validates (size, rows, z indices) and compiles with `compileRoomSpec` to check integrity before writing.

Auth:
- Include `access_token` if available (Supabase), otherwise allow local dev.

## Renderer Integration (Preview)

- Floors: composite floor0→floor1→floor2 (space = transparent). No occlusion logic tied to floors.
- Statics: provide occluder map passed through as `dungeonMap` (unchanged path).
- Editor preview can rely on the same handler used in `client/core/net/loginScenario.js` plus one new message to set floor layers when we wire it.

## Conventions

- Row strings are exactly `size.width` characters; list length is exactly `size.height`.
- Use `palette` glyphs consistently where possible.
- Single walls: `#`
- Double walls:
  - Vertical: `|`
  - Horizontal: `=`
- Doors (non-blocking for now): `+`

## Future Extensions

- Per-tile color and material properties
- Doors with open/closed state that toggle occlusion
- Zone metadata (e.g., music, biome)
- Multiple statics layers (z-index for props)
- On-the-fly occluder glyph set based on `occluders` field