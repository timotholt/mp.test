# Map + Entities Architecture (KISS, fast, JS-only)

Author: Cascade
Status: Proposal
Scope: Server-first (authoritative), client ancillary

---

## 1) Goals & Non-Goals

- Goals
  - Elegance: a small set of simple, composable data structures.
  - Simplicity: explainable to a 10-year-old; readable JS; minimal moving parts.
  - Speed: O(1) membership; cache-friendly arrays; avoid GC churn.
  - Server-first: server computes vision/pathing; client consumes pruned deltas (Colyseus).
  - Clear API: init, add/move/remove entities, FOV/adjacent queries, visible slice extraction.

- Non-Goals (for v1)
  - Arbitrary polygon footprints (we’ll use axis-aligned rectangles for big entities).
  - Infinite worlds (we target up to 256×256 per dungeon level; multi-level supported by separate maps).
  - Photorealistic lighting (we do grid FOV; optional “light sources” are additive and simple).

---

## 2) World Model Overview

- Grid-based world with integer coordinates `(x, y)`.
- Movement is 8-way (N, NE, E, SE, S, SW, W, NW).
- Corner cutting is allowed for size-1 (human-sized) movers; large entities cannot corner-cut.
- Map has independent terrain (always present) and visually-rich overlays that don’t block.
- Structures (e.g., walls, doors) exist “over” the terrain and may block movement and/or sight.
- Entities occupy squares; most are 1×1. Large entities are rectangles (e.g., 2×2, 2×3, 3×3).
- FOV uses rot.js (PreciseShadowcasting). Big entities and “smoke” tiles can block sight.
- Pathfinding avoids solid tiles and dynamic solids (other entities). Large entities use their full footprint.

---

## 3) Coordinates & Indexing (cache-friendly)

- Use a single integer index for each cell: `i = y * W + x`.
- Inverse: `x = i % W`, `y = (i / W) | 0`.
- Reasons: O(1) lookups in flat typed arrays; great cache locality.

---

## 4) Map Layers (Kid-Simple, Three visual floors + Structures)

We keep visual *floors* separate from *structures*. Floors never block; structures might.

- Terrain layer (L0): `Uint8Array` of size `W*H`. Each cell is a small enum (0–255, typically 0–32).
  - Examples: 0=Stone, 1=Grass, 2=Dirt, 3=Street, 4=Urban, 5=Water, ...
  - Colors/textures come from a lookup table.

- Decor layer (L1): `Uint8Array` of size `W*H`.
  - Small details: floor lights, paint, clutter. Never blocks movement or sight.

- Effects layer (L2): `Uint8Array` of size `W*H`.
  - Temporary visuals: blood, debris, puddles. Never blocks movement or sight.

- Structures layer (separate): simple id + bit flags per cell.
  - Option A (compact id + flag bitsets):
    - `structId: Uint8Array` (0 = none; nonzero = structure type).
    - `blocksMoveBits: Uint8Array` bitset.
    - `blocksSightBits: Uint8Array` bitset.
    - `doorBits: Uint8Array` bitset (cell has a door).
    - `doorOpenBits: Uint8Array` bitset (door state; open = passable & transparent).
    - Optional: `smokeBits: Uint8Array` bitset (transient fog/smoke that blocks sight only).
  - Option B (wider struct id with flags encoded): `Uint16Array` with bitfields.
  - We recommend Option A for clarity and easy toggling of doors/smoke.

- Derived movement cost layer (optional): `Float32Array` of per-cell movement speed multiplier (default 1.0).
  - Example values: stone=1.0; mud=0.5; shallow water=0.5; ocean=0.3.
  - Note: For A* with weighted costs, see §10; JPS assumes uniform cost, so we switch finders accordingly.

---

## 5) Entity Store (Small, fast, friendly)

- Entities are records in a packed store with stable integer IDs.
- Suggested fields (minimal):
  - `id: number` (index in packed arrays or in a map)
  - `kind: number` (small enum for rendering/AI; e.g., Human, Orc, Tank, DoorControl, Item, Corpse)
  - `x, y: number` (top-left tile of its footprint)
  - `w, h: number` (footprint width and height in tiles; default 1×1)
  - `size: number` (0 = sub-tile item/particle; ≥1 = tile-occupying actor)
  - `opaque: boolean` (blocks sight; e.g., a 2×2 tank blocks sight)
  - `stateFlags: number` (bitfield for states/effects; e.g., SLEEPING, DEAD, PETRIFIED)
  - `faction: number` (optional, AI logic)
  - `meta: object` (optional bag for game-specific data)

- Footprint: Rectangle `[x..x+w-1, y..y+h-1]`.
  - An entity is “adjacent” or “visible” if any tile in its footprint qualifies.
  - Pass-over policy (who can be stepped through) is derived from `size` and `stateFlags`:
    - May pass over if: `size === 0`, or (`size <= 1` AND `stateFlags` contains SLEEPING).
    - May NOT pass over if: footprint is multi-tile (`w>1 || h>1`) or state is disallowed (e.g., PETRIFIED/FROZEN/STONE).

- Occupancy grid: `Array<W*H>` of `Set<entityId>`.
  - For each cell `i`, store a small `Set` of entity IDs currently occupying it.
  - On move: remove ID from old cells, add to new cells (iterate footprint).
  - Any number of size-0 entities can share a cell. Tile-occupying entities (`size ≥ 1`) are limited by gameplay rules.
  - This makes adjacency checks and per-cell queries trivial.

- ID allocation: simple free-list or `nextId++`. Keep it kid-simple.

---

## 6) Per-Map Metadata

- `W, H`: dimensions (≤ 256 × 256 in our target).
- `mapRevision: number`: increment when structures affecting sight/movement change (doors toggle, walls placed).
- `terrainLUT: Array<{ name, color, cost }>`: optional lookup; cost is a movement multiplier.

---

## 6.5) Game Settings & Constants

Define these as explicit settings/consts (no hard-coded magic numbers):

- Game setting: `SERVER_ACTION_TICK_MS` (typical 100; can be 250 or 500 depending on game)
- Constant: `SERVER_ACTION_STEP_SIZE_PER_TICK` (default 1 tile per tick)
- Game setting: `CHASE_MEMORY_TURNS` (default 300 turns; i.e., 30s at 100 ms, but scales with your tick)
- Pass-over policy constants:
  - `PASS_OVER_ALLOWED_STATES = { SLEEPING }`
  - `PASS_OVER_DISALLOWED_STATES = { PETRIFIED, FROZEN, STONE }`

Notes:
- Chase memory is turn-based (`CHASE_MEMORY_TURNS`), not time-based. Slower games naturally have longer wall-clock chase windows.
- Only entities with `size === 0` are always passable. Tile-occupiers (`size ≥ 1`) are passable ONLY if `size <= 1` AND state includes `SLEEPING`. Multi-tile (`w>1 || h>1`) are never passable.

---

## 7) Visibility (FOV) & LOS

- Library: rot.js `FOV.PreciseShadowcasting`.
- Transparency callback uses `blocksSightBits`/`doorOpenBits`/`smokeBits` and bounds check:
  - A cell is transparent iff inside bounds and NOT `blocksSight` (unless door is open; smoke can force opaque).

- Caching rule (per entity):
  - Cache `{ x, y, radius, rev, bits }` for each entity that needs FOV.
  - Recompute only when the entity moves at least one tile or `mapRevision` changes.
  - For large entities, use a chosen anchor (e.g., center or top-left) for FOV origin; typically center.

- Radius metric & defaults:
  - Default FOV radius per actor is stored on the character sheet (recommended default 20).
  - Use Euclidean radius for a circular feel (NetHack-like), while movement remains 8-way.
  - LOS rays still use Bresenham-style stepping against the same transparency rules.

- Big entities and smoke:
  - Big entities with `opaque=true` contribute to sight blocking (we OR their footprint into a transient opacity bitset per FOV compute).
  - Smoke tiles are transient opacity; they block sight but not movement.

- LOS (pairwise):
  - Use a small Bresenham ray against the same transparency function for “can X see Y?” checks.

---

## 8) Movement & Adjacency Rules

- 8-way movement with corner-cutting allowed for size-1 movers.
- Large movers (w>1 or h>1) cannot corner-cut; each step must have enough clearance for the whole footprint.
- A move is valid iff all cells in the destination footprint are inside bounds and non-solid.
- Adjacency for queries uses 8-neighbors by default.

---

## 9) Pathfinding (A*/JPS) with Large Entity Support

- Library: `pathfinding.js`.
- Two modes:
  1) Uniform-cost mode (fast, uses Jump Point Search):
     - Use `PF.JumpPointFinder` with `PF.DiagonalMovement.Always` (corner cutting allowed).
     - For size-1 agents only.
  2) Weighted-cost mode (terrain multipliers):
     - Switch to `PF.AStarFinder` (JPS assumes uniform cost).
     - We provide a wrapper that computes neighbor costs using our terrain multipliers.
     - If the stock library lacks per-node weights in your version, we can fall back to a tiny built-in A* (≤ 120 LOC), still KISS.

- Large entities:
  - Use a “clearance check” when expanding neighbors: the `w×h` footprint of the agent must be non-solid for the destination.
  - If using library finders that cannot customize clearance, plan with our wrapper A*/Dijkstra.

- Dynamic obstacles:
  - Other blocking entities (per size/state policy) are treated as non-walkable during search (project their footprints onto a transient blocking mask).

---

## 10) Terrain Costs (multipliers → weights)

- Game design uses multipliers (speed): stone=1.0, mud=0.5, river=0.5, ocean=0.3.
- Pathfinding uses additive weights (cost): we convert `cost = 1 / multiplier`.
  - Examples: 1.0 → 1.0, 0.5 → 2.0, 0.3 → ~3.33.
- Diagonal steps scale by `√2` multiplied by terrain cost at the destination tile (simple, consistent rule).
- For multi-tile agents, use the max cost among the destination footprint (conservative) or average (smoother); we default to max.

---

## 11) Fog of War (per player)

- Each player has a `memoryBits: Uint8Array` bitset of size `W*H`.
- On each FOV compute, set bits for visible cells to 1 (OR). These persist for the lifetime of a player and level.
- When extracting a visible slice for a player, include both:
  - `visibleBits` (current FOV mask)
  - `memoryBits` (ever seen). Clients can render unseen as dark, memory as dim, visible as bright.
- Entities are only included if currently visible (server authority), unless you want “remembered corpses/doors” (configurable).

---

## 12) Light Sources (optional additive visibility)

- Server engine does NOT compute lighting. Lighting/brightness is handled entirely by the client renderer for visuals.
- Server visibility is purely FOV/LOS-based over opaque/transparent cells (and big opaque entities/smoke), independent of lights.
- Benefit: saves server CPU; renderer can glow/brighten without affecting authoritative visibility.

---

## 13) Core API (KISS)

All functions are plain JS. The library hides algorithmic details.

```js
// Types used in signatures (informal):
// MapHandle: an object bundling arrays, bitsets, dims, and indices.
// EntityId: number
// Rect: { x, y, w, h }
// VisibleSlice: {
//   box: { x, y, w, h },             // bounding box of visible cells
//   maskBits: Uint8Array,             // bitset for box (w*h bits) marking which cells inside box are actually visible
//   floors3D: Array3D,                // [layer][row][col] clipped to box; non-visible entries may be -1
//   entities2D: Array2D<entityId|0>,  // 0 for none; clipped to box (first solid or top entity per cell, policy-defined)
//   touching: EntityId[],             // entities adjacent (8-way) to the player
//   visible: EntityId[]               // entities with any tile in FOV
// }

// 13.1 Initialization
function createMap(W, H, opts): MapHandle
function setTerrain(map, x, y, terrainId): void
function setDecor(map, x, y, decorId): void
function setEffect(map, x, y, effectId): void
function setStructure(map, x, y, structId, { blocksMove, blocksSight, isDoor, isOpen }): void
function toggleDoor(map, x, y, isOpen): void // bumps mapRevision
function setSmoke(map, x, y, on): void       // only affects sight

// 13.2 Entities
function addEntity(map, { kind, x, y, w=1, h=1, solid=false, opaque=false, faction=0, meta={} }): EntityId
function moveEntity(map, id, nx, ny): boolean // respects footprint, corner rules, solids
function removeEntity(map, id): void

// 13.3 Queries
function getAdjacentEntities(map, id): EntityId[]
function getVisibleEntities(map, id, radius): EntityId[]
function hasLineOfSight(map, fromId, toId): boolean // Bresenham over transparency

// 13.4 Visibility products
function computeFov(map, id, radius): Uint8Array // bitset W*H, cached internally
function extractVisibleSlice(map, id, radius): VisibleSlice

// 13.5 Pathfinding
function findPath(map, id, tx, ty, opts={ weighted:true }): Array<[x,y]>
// Uses large-entity clearance, avoids dynamic solids. Weighted uses A*/wrapper; unweighted may use JPS.

// 13.6 Tick / maintenance
function onEntityMoved(map, id): void          // invalidates cached FOV for id
function onMapStructuresChanged(map): void     // bump mapRevision, invalidates cached FOV for all
```

Notes:
- The library tracks cached FOV per entity (`{x, y, radius, rev, bits}`), so `computeFov`/`getVisibleEntities` are cheap when nothing changed.
- `extractVisibleSlice` returns the smallest bounding box containing all visible cells. The `maskBits` encodes holes (exact shape) inside the box.
- For clients that prefer a fixed square window (e.g., 25×25), we can add `extractVisibleWindow(map, id, radius, size)`.

---

## 14) Internal Data Structures (Server)

```js
// Dimensions
W: number; H: number; N = W * H;

// Floors (visual)
terrain: Uint8Array(N); // L0
decor:   Uint8Array(N); // L1
effects: Uint8Array(N); // L2

// Structures
structId:       Uint8Array(N); // 0 = none
blocksMoveBits: Uint8Array((N+7)>>3); // bitset
blocksSightBits:Uint8Array((N+7)>>3); // bitset
doorBits:       Uint8Array((N+7)>>3); // bitset
doorOpenBits:   Uint8Array((N+7)>>3); // bitset
smokeBits:      Uint8Array((N+7)>>3); // bitset (optional)

// Derived movement costs (per tile multiplier; default 1.0)
costMul: Float32Array(N);

// Entities
entities: Map<EntityId, EntityRecord>
nextId: number; freeIds: number[];

// Occupancy: per-cell set of entity IDs
cellEntities: (Set<number>|null)[] // length N

// Per-entity cached FOV
fovCache: Map<EntityId, { x, y, radius, rev, bits: Uint8Array }>

// Map revision
mapRevision: number;
```

Utility helpers: `idx(x,y)`, `getBit(bits,i)`, `setBit(bits,i,v)`.

---

## 15) Algorithms & Libraries

- FOV: rot.js `FOV.PreciseShadowcasting` bound to `isTransparent(x,y)`.
- LOS: Bresenham integer ray, early-out on opaque cells.
- Pathfinding:
  - Unweighted, size-1: `PF.JumpPointFinder` with diagonal movement allowed.
  - Weighted or large entities: `PF.AStarFinder` if weights supported (version-dependent), else a tiny built-in A* (≤ 120 LOC). The API doesn’t change.

Performance guidance:
- 256×256 → N = 65,536 cells; one bitset is ~8 KB. Plenty small for a few masks.
- FOV radius 12 → ~450 cells considered; 40 entities staggered at 10–20 Hz is trivial.
- Maintain a transient “dynamic opacity” bitset when big opaque entities or smoke are present; OR it with structural opacity during FOV.

---

## 16) Visible Slice (Exact Shape)

- We return a tight bounding `box = { x, y, w, h }` around visible cells.
- `maskBits` is a bitset of size `w*h` marking which cells inside the box are visible (1) vs. not (0).
- `floors3D` is `[layer][row][col]` clipped to the box:
  - For cells where `maskBits` is 0, set entries to `-1` to mark “not visible right now.”
- `entities2D` represents the top entity per cell (policy can be: first solid, else last non-solid).
- This gives exact shape while staying array-friendly.
 - `entities2D` selection policy (for rendering priority):
   - If any size-1 (tile-occupying) entity is present in the cell, choose one of them (e.g., the latest/active by ID or draw-order).
   - Otherwise, pick among size-0 stack the highest-quality item using rarity ordering: `GRAY < WHITE < BLUE < GREEN < PURPLE < GOLD`.
   - Full stack details are still available via the separate visible entity list; `entities2D` is just the drawn representative.

---

## 17) Corner-Cutting Rules (Details)

- For size-1 movers: if moving diagonally (dx≠0 and dy≠0), allow step even if both orthogonal neighbors are solid (NetHack-style corner cutting).
- For large movers (w>1 or h>1): disallow corner cutting. A diagonal step requires that all cells in the destination footprint are free (and optionally the swept edge cells too, when you want conservative clearance).

---

## 18) Example: Server Usage (Pseudo-JS)

```js
const map = createMap(256, 256);

// Build terrain
for (let y = 0; y < 256; y++) {
  for (let x = 0; x < 256; x++) {
    setTerrain(map, x, y, 0); // stone
  }
}

// Place a wall line and a door
for (let x = 10; x <= 30; x++) {
  setStructure(map, x, 20, 1, { blocksMove: true, blocksSight: true, isDoor: false, isOpen: false });
}
setStructure(map, 20, 20, 2, { blocksMove: true, blocksSight: true, isDoor: true, isOpen: false });

// Add a player and a monster
const player = addEntity(map, { kind: 1, x: 12, y: 12, solid: true, opaque: false, w:1, h:1 });
const ogre   = addEntity(map, { kind: 2, x: 24, y: 22, solid: true, opaque: true,  w:2, h:2 });

// Visibility
const radius = 12;
const vis = computeFov(map, player, radius); // bitset W*H
const slice = extractVisibleSlice(map, player, radius);

// Adjacency
const adj = getAdjacentEntities(map, player);

// LOS
const canSee = hasLineOfSight(map, player, ogre);

// Pathfinding (player to target)
const path = findPath(map, player, 40, 40, { weighted: true });

// Open the door and update FOV
toggleDoor(map, 20, 20, true); // mapRevision++
const vis2 = computeFov(map, player, radius); // cache invalidated, recomputed
```

---

## 19) Networking (Colyseus) Payload Shape

Server → Client per player (delta-friendly):

```js
{
  levelId: string,
  rev: number,             // map revision for client-side cache invalidation
  box: { x, y, w, h },
  maskBits: <binary>,      // w*h bits; RLE/deflate as needed
  floors3D: [              // [layer][row][col], clipped to box; -1 for non-visible
    number[w][h],          // terrain ids
    number[w][h],          // decor ids
    number[w][h]           // effects ids
  ],
  entities2D: number[w][h],// entity id at cell or 0
  touching: number[],
  visible: number[],
  memoryPatch?: <binary>   // optional diff to player’s fog-of-war memory
}
```

Notes:
- Use deltas keyed by `rev` and player position changes.
- Bit-level payloads compress extremely well.

---

## 20) Performance & Complexity Notes

- Bitsets: `W*H/8` bytes per mask. At 256×256, ~8 KB per bitset. Five masks ≈ 40 KB.
- FOV: O(visible tiles) with shadowcasting; radius 12 ~ 450 tiles.
- LOS: O(line length) ~ up to ~360 steps worst-case across the map.
- Pathfinding: A* ~ O(E log V). With 8-neighbors and tight heuristics, searches are fast on 256².
- Caching FOV per-entity and recomputing only on changes keeps CPU smooth at 100 Hz ticks.

---

## 21) Extensibility & Variants

- Levels: multiple 256×256 maps → one `MapHandle` per level.
- Multi-floor: create separate `MapHandle`s per Z; inter-level portals handled by gameplay.
- Damageable walls: flip `blocksMoveBits`/`blocksSightBits` by cell and bump `mapRevision`.
- Stealth: let entities emit `opaque=true` when crouching behind cover (footprint ORed into transient opacity).
- Field effects: add `gasBits`, `webBits`, etc., with tuned movement/sight impacts.

---

## 22) Minimal Helper Snippets (reference)

```js
function idx(x, y, W) { return y * W + x; }
function makeBits(N) { return new Uint8Array((N + 7) >> 3); }
function getBit(bits, i) { return (bits[i >> 3] >> (i & 7)) & 1; }
function setBit(bits, i, v) {
  const b = i >> 3, m = 1 << (i & 7);
  bits[b] = v ? (bits[b] | m) : (bits[b] & ~m);
}
```

---

## 23) Rollout Plan

- Phase 1: Implement core data structures, entities, occupancy, bitsets, LOS, rot.js FOV cache.
- Phase 2: Pathfinding v1
  - Size-1, uniform cost (JPS).
  - Large entity clearance check in wrapper (may switch to A*).
- Phase 3: Weighted terrain
  - Switch to A* (library or tiny in-house) with per-cell cost; keep API identical.
- Phase 4: Fog of War and visible slice extraction (exact shape via maskBits + bounding box).
- Phase 5: Optional lights.

---

## 24) Why This Is “Best” For You

- Floors are kid-simple arrays; structures/doors are explicit flags.
- Entities are rectangles with a tiny occupancy index → instant adjacency.
- FOV uses a proven JS lib; LOS is a 20-line function.
- Pathfinding starts fast (JPS) and grows to weighted costs without API churn.
- Exact-shape visibility payloads remain compact and delta-friendly for Colyseus.

If it fits, we can scaffold the server module with these types and wire rot.js/pathfinding.js behind the KISS API. The result: code a 10-year-old can read, performance that keeps grown-ups happy.

---

## 25) Path/Chase System (Server Tick)

This section describes the authoritative server behavior for “monster chases player,” rebuilt each time something important changes, and otherwise advancing by small steps per tick. It’s designed to be KISS, deterministic, and fast.

- Responsibilities
  - Compute or reuse a path from chaser → target (8-way movement).
  - Advance the chaser along the path up to `maxSteps` per tick (usually 1).
  - Rebuild the path when the world changes (target moved cell, door toggled, waypoint blocked).
  - Respect entity footprints (large actors), door states, and dynamic solids.

- Inputs
  - `map`: provides `W, H, mapRevision`, plus helpers from §26.
  - `chaserId`, `targetId`.
  - Tick options: `{ maxSteps = 1 }` (per action/turn rules).

- Outputs (per tick)
  - `{ moved: boolean, reason: 'ok'|'no-path'|'blocked'|'blocked-dynamic'|'partial'|'at-target', pathRemaining: number }`.
  - The chaser’s new `(x,y)` is reflected via the map adapter’s `moveEntity()`.

- State (per chaser)
  - `target`: last target cell `[tx, ty]` used for the path.
  - `path`: array of waypoints `[ [x,y], ... ]`.
  - `step`: index of the next waypoint to consume.
  - `rev`: `mapRevision` captured when the path was built.

- Rebuild triggers
  - Target changed cell (player moved).
  - `mapRevision` changed (e.g., door toggled).
  - Chaser deviated from the cached path (teleport, shove, desync).
  - Next waypoint is no longer clear (dynamic blocker stepped in, or door closed).
  - TTL: continue pursuing the last seen position up to `CHASE_MEMORY_TURNS`; after that, abandon.

- Movement rules (recap)
  - 8-way.
  - Size-1 agents can corner-cut (NetHack). Large agents cannot: a diagonal step requires orthogonal clearance and a clear destination footprint.
  - Destination footprint must be fully inside bounds and non-solid (structures + dynamic solids).
  - Weighted terrain: base step cost is `1` or `√2`, multiplied by `1 / multiplier` at the destination (or max across the destination footprint for large).
  - Pass-over policy (no ghosting):
    - You may step through an occupied cell only if the occupant is `size === 0`, or (`size === 1` AND state ∈ `PASS_OVER_ALLOWED_STATES`).
    - Never step through multi-tile footprints or disallowed states (e.g., PETRIFIED/FROZEN/STONE).

- Scheduling (100 Hz default turn window)
  - Run chase updates once per scheduled AI turn. For a 100 ms “turn,” you can:
    - Process all active monsters sequentially (fine at ~40).
    - Or round-robin in batches if you spike above budget.
  - Movement per tick is controlled by `SERVER_ACTION_STEP_SIZE_PER_TICK` (default 1 tile). Increase only for special abilities.

- Pseudocode (KISS)

```js
function updateChaser(chaserId, targetId, { maxSteps = 1 }) {
  const ch = map.getEntity(chaserId);
  const tg = map.getEntity(targetId);
  if (!ch || !tg) return { moved:false, reason:'missing-entity', pathRemaining:0 };

  // Ensure cache exists and is fresh w.r.t target cell and mapRevision
  const cache = ensurePath(chaserId, tg.x, tg.y); // builds/rebuilds on change
  if (!cache) return { moved:false, reason:'no-path', pathRemaining:0 };

  let moved = false; let steps = 0;
  while (steps < maxSteps && cache.step < cache.path.length) {
    const [nx, ny] = cache.path[cache.step];
    // Validate destination is still clear for chaser footprint
    if (!isFootprintClear(map, nx, ny, ch.w||1, ch.h||1)) {
      // Rebuild once and break
      const rebuilt = rebuild(chaserId, cache.target[0], cache.target[1]);
      if (!rebuilt) return { moved, reason: moved?'partial':'blocked', pathRemaining:0 };
      const next = rebuilt.path[rebuilt.step];
      if (!next || !isFootprintClear(map, next[0], next[1], ch.w||1, ch.h||1)) {
        return { moved, reason: moved?'partial':'blocked', pathRemaining:0 };
      }
    }
    // Apply one tile of movement
    if (!map.moveEntity(chaserId, nx, ny)) return { moved, reason:'blocked-dynamic', pathRemaining:0 };
    moved = true; steps++; cache.step++;
  }
  const remaining = Math.max(0, cache.path.length - cache.step);
  return { moved, reason: moved?'ok':'at-target', pathRemaining: remaining };
}
```

---

## 26) Map Adapter Interface (for Path/Chase)

To keep the path system decoupled from game logic, implement a small adapter on the server map:

- Dimensions & revision
  - `W, H, mapRevision` (numbers)

- Static blockers & dynamic solids
  - `isBlockedMove(x, y): boolean` — true if walls/closed doors block movement.
  - `isBlockingEntityAt(x, y): boolean` — true if a blocking entity occupies the cell (size/state policy).

- Terrain multiplier
  - `getCostMul(x, y): number` — movement speed multiplier (default 1.0).

- Entities
  - `getEntity(id): { x, y, w, h, solid? } | null`
  - `moveEntity(id, nx, ny): boolean` — must also update your occupancy index.

These are sufficient for 8-way A* with large-entity clearance and dynamic avoidance.

---

## 27) Integration With Vision & Doors

- Vision-driven behavior (optional but recommended)
  - Use `computeFov(map, chaserId, radius)` to decide whether the chaser sees the target before pursuing.
  - If not visible, idle or patrol. When visible again (or remembered with sound cues), resume chasing.
  - If the target leaves FOV, pursue last seen position for up to `CHASE_MEMORY_TURNS`; then stop.

- Doors
  - When door state changes, bump `mapRevision`.
  - Path caches check `mapRevision` and rebuild automatically on the next `updateChaser()`.

- Big opaque entities and smoke
  - For LOS checks (if AI needs them), OR big entity footprints and smoke into a transient opacity mask.

---

## 28) Scheduling & Performance Notes

- At 256×256 with ~40 monsters, A* over 8-neighbors is fast. Tips:
  - Rebuild paths only when triggers fire (target moved cell, rev change, block).
  - Limit to one rebuild per chaser per tick.
  - Consider an LRU pool for arrays if you profile GC pressure.

- Turn windows
  - 100 ms default “turn” (LAN) or 200–250 ms (Internet) are fine. Keep per-chaser work bounded and amortized.

---

## 29) Example: Monster Follows Player Into a Room (Timeline)

1. t0: Player at (12,12). Ogre (2×2) at (24,22). Door at (20,20) closed.
   - Path: `no-path` (door blocks). Ogre idles.
2. t1: Door opens (`mapRevision++`).
   - Path rebuild: ogre → player via doorway. Ogre takes 1 step (e.g., to 23,22).
3. t2: Player darts to (15,18) inside room.
   - Target cell changed → path rebuild. Ogre advances 1 step toward door (22,21). If player becomes unseen, ogre continues to last seen cell up to `CHASE_MEMORY_TURNS`.
4. t3: Another monster crowds the doorway.
   - Next waypoint blocked dynamically → rebuild or wait depending on policy; ogre pauses or takes an alternate route.
5. t4: Door closes before ogre enters.
   - `mapRevision++` → path invalid, rebuild returns `no-path`. Ogre idles or bangs on door (game rule).

This illustrates when/why rebuilds happen, with minimal work each tick.

---

## 30) Next Steps (Roadmap)

- Implement the map adapter (small shim over your existing arrays/bitsets).
- Integrate a `PathSystem` module exposing `updateChaser()`.
- Wire AI scheduling at your chosen turn rate (100 ms default) and call into `updateChaser()`.
- Optionally gate chasing by FOV and faction logic.
- Add unit-ish tests: doorway corner cases, large-entity diagonals, dynamic blockers.

---

## 31) Code Organization & Module Size Guidelines

To keep modules readable and AI-friendly:

- Prefer many small modules over a few large ones; aim ≤ 500 LOC per file (hard max ≈ 1000).
- Suggested server layout:
  - `server/rooms/gamecode/map/` — arrays, bitsets, door toggles, occupancy, costs (Map adapter)
  - `server/rooms/gamecode/systems/vision/` — FOV cache, LOS helpers, fog-of-war accumulation
  - `server/rooms/gamecode/systems/path/` — pathfinding wrappers, chase update logic
  - `server/rooms/gamecode/systems/ai/` — target selection, behavior trees/state machines (future)
  - `server/rooms/gamecode/util/` — bitset helpers, index helpers, constants
- Place shared constants in a small `constants.js` and import where needed (`SERVER_ACTION_TICK_MS`, `CHASE_MEMORY_TURNS`, etc.).
- Keep interfaces thin; pass adapters (not raw arrays) into systems so internals can evolve without API churn.

One-liner: The chase system is a polite bouncer—moves one step at a time, checks the door list every turn, and refuses to squeeze a dragon through a doggy door.
