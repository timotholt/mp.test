# Scenario → Quest → Dungeon → Level Generation (KISS, JS-only)

Author: Cascade
Status: Proposal
Scope: Server-first generation, client renders. Deterministic via seeds.

---

## 1) Goals & Non-Goals

- Goals
  - Keep it simple and composable: 4 small generators chained together.
  - Deterministic results from a single seed; sub-seeds per stage for stability.
  - Clean, kid-readable data contracts between stages.
  - Output maps/entities matching our Map + Entities Architecture.
  - Fast enough for 256×256; suitable for multiple levels per run.

- Non-Goals (for v1)
  - Over-engineered content graphs or behavior trees in the generator.
  - Heavy-weight constraint solvers; we prefer greedy + validate + repair.
  - Infinite worlds; we target discrete levels up to 256×256.

---

## 2) Pipeline Overview

Stages (left → right), each consumes structured input and produces structured output:

- ScenarioGenerator
  - Input: seed, game settings (party level, length, biome, difficulty).
  - Output: Scenario (theme/biome, difficulty profile, rules, tags).

- QuestGenerator
  - Input: Scenario
  - Output: Quest (objectives, key-item mapping, locks/doors, pacing beats).

- DungeonPlanner
  - Input: Quest
  - Output: DungeonPlan (topology graph of rooms/corridors, zones, key/lock placements, hazards).

- LevelBuilder
  - Input: DungeonPlan
  - Output: Level (concrete 2D grid layers, structures, door states, costs, initial entities).

Validation at each step; if it fails, repair or re-roll sub-seed and retry.

---

## 3) RNG & Seeding Strategy

- Use one master seed (string or number) per level.
- Derive sub-seeds deterministically for each stage using a simple hash (e.g., `xxhash32(master + ":scenario")`, etc.).
  - `seedScenario = H(master, "scenario")`
  - `seedQuest    = H(master, "quest")`
  - `seedDungeon  = H(master, "dungeon")`
  - `seedLevel    = H(master, "level")`
- Within a stage, further derive for subroutines (e.g., room count, branching) for stability.
- RNG API: tiny inline LCG or `seedrandom` (if allowed). Keep JS-only and deterministic.

---

## 4) Data Contracts (Types)

We use plain JS objects. All IDs are strings unless small-enum noted. Coordinates are integers.

- Scenario
```js
{
  id: string,                // scenario id (derived from seed)
  seed: string|number,
  biome: 'dungeon'|'cave'|'urban'|'sewer'|'lab',
  theme: 'undead'|'bandit'|'cult'|'demonic'|'military'|'mixed',
  difficulty: { tier: 1|2|3|4|5, curve: 'flat'|'rising'|'spike' },
  length: 'short'|'medium'|'long',
  partyLevel: number,        // avg player level
  tags: string[],            // optional flags (e.g., 'low-light', 'toxic-gas', 'no-magic')
}
```

- Quest
```js
{
  id: string,
  scenarioId: string,
  objectives: [
    // minimal v1 set
    { type: 'reach', target: 'exit' },
    { type: 'collect', itemId: 'keyA', count: 1 },
    { type: 'defeat', bossId: 'boss1' }
  ],
  locks: [ { doorId: 'doorA', key: 'keyA' } ], // key-door pairs
  items:  [ { id: 'keyA', rarity: 'BLUE'} ],   // keys/artifacts guaranteed somewhere
  pacing: { beats: ['intro','mid','boss'], loopChance: 0.25 },
  constraints: { timeLimitTurns: null, optionalRooms: 0.15 }
}
```

- DungeonPlan
```js
{
  id: string,
  rooms: [
    { id: 'R1', zone: 0, kind: 'start', size: [8,8] },
    { id: 'R2', zone: 1, kind: 'treasure', size: [10,8] },
    { id: 'R3', zone: 2, kind: 'boss', size: [12,10] },
  ],
  corridors: [ { from: 'R1', to: 'R2', kind: 'hall' } ],
  doors: [ { id:'D1', between:['R2','R3'], lock: 'keyA', initiallyOpen:false } ],
  keys: [ { id:'keyA', room: 'R2' } ],
  hazards: [ { kind:'pit', room:'R2', density:0.1 } ],
  startRoom: 'R1', exitRoom: 'R3'
}
```

- Level (matches Map+Entities architecture)
```js
{
  seed: string|number,
  W: number, H: number,                   // ≤ 256
  // floor layers (Uint8Array) and structures/flags bitsets per architecture doc
  terrain: Uint8Array, decor: Uint8Array, effects: Uint8Array,
  structId: Uint8Array,
  blocksMoveBits: Uint8Array, blocksSightBits: Uint8Array,
  doorBits: Uint8Array, doorOpenBits: Uint8Array,
  smokeBits?: Uint8Array,
  costMul: Float32Array,
  // entities
  entities: Array<Entity>,                // see architecture (size, stateFlags, etc.)
  spawn: { player: {x,y}, allies: Array<{x,y}>, enemies: Array<{x,y,kind}> },
  // mappings for runtime
  roomByCell: Uint16Array,                // room index per cell for debug/AI
  doorCells: Array<{id, x, y}>,           // placed door positions
}
```

---

## 5) Scenario Generator (S → Scenario)

Simple sampling by seed.

- Choose biome/theme based on partyLevel and seed.
- Choose difficulty tier and curve.
- Choose length (short/medium/long) → implies target room count budget and branching factor.
- Produce tags (e.g., low-light) that later influence structures (more doors, torches as decor only).

API
```js
function generateScenario(seed, opts={}): Scenario
```

---

## 6) Quest Generator (Scenario → Quest)

- Pick objective template set per theme: reach exit; collect key; defeat boss; rescue hostage.
- Decide lock/key pairs from item pool (e.g., keyA opens doorA).
- Decide optional rooms ratio; decide pacing beats.

Constraints
- Ensure at least one key before its door in traversal order (key-before-lock invariant).
- Ensure boss/exit is reachable after satisfying objectives.

API
```js
function generateQuest(scenario, rng): Quest
```

---

## 7) Dungeon Planner (Quest → DungeonPlan)

Graph builder that outputs rooms/corridors/doors with keys placed upstream of locks.

Steps
- Decide room count by length and difficulty.
- Build a spanning backbone (start → mid → boss/exit).
- Add branches and optional loops controlled by `loopChance`.
- Assign room kinds (start, combat, treasure, puzzle, boss).
- Place keys in pre-lock rooms; attach doors on edges beyond their locks.

Validation
- Graph reachability: every required objective room reachable from start.
- Key-before-lock: path to a door includes its key location first.
- Budget limits: max degree, max corridor length.

API
```js
function planDungeon(quest, rng): DungeonPlan
```

---

## 8) Level Builder (DungeonPlan → Level)

Concrete 2D map assembly using tiles and structures.

Steps
- Layout rooms on the grid (e.g., BSP packing or orbit placement) with separation.
- Carve room interiors (rects for v1; cave noise optional later).
- Connect rooms with corridors matching the plan.
- Place doors at corridor endpoints as per `doors[]` from plan.
- Paint terrain per biome (stone/urban/street/water) into Terrain L0; add decor/effects for flavor.
- Set `blocksMoveBits/blocksSightBits/doorBits/doorOpenBits` according to doors/walls.
- Derive `costMul` by terrain (1.0 stone, 0.5 mud/river, 0.3 ocean).
- Spawn entities per spawn budget (from quest/scenario): player start in startRoom; boss in boss room; loot and keys placed accordingly.

Validation
- Flood-fill walkable from start to exit: must be reachable obeying doors & locks (initial door states assumed).
- Minimum spawn spacing around player.
- No entity spawned inside wall.

API
```js
function buildLevel(plan, rng): Level
```

---

## 9) Validation & Repair

- Connectivity check (walkable cells) using 8-way step rules (size-1 corner cutting allowed).
- Key-door invariants: simulate a pickup order; ensure locks are not blocking required progress pre-key.
- Door states: verify closed doors that require keys are placed only beyond their key path.
- Repair strategies:
  - Move door back one edge; relocate key upstream; add alternate corridor; widen room; re-roll a branch.

API
```js
function validateLevel(level): { ok: boolean, issues: string[], fixes?: number }
```

---

## 10) Difficulty & Pacing

- Difficulty drives enemy counts and hazard densities per zone.
- Pacing beats: intro (lighter), mid (spike), boss (high). Adjust spawn budgets per beat.
- Optional rooms: % of total; populate with side loot, lore, risk/reward.

---

## 11) Decorations & Biomes

- Terrain L0 from biome palette (stone, dirt, street, grass, water).
- Decor L1: decals like floor lights, paint, tiles; do not block.
- Effects L2: blood, debris, puddles; transient.
- Biome influences corridor width, room aspect ratio, and door frequency.

---

## 12) Entities & Loot Placement

- Use the architecture entity model (size, stateFlags). Keys as size 0 items with quality `BLUE` or `GREEN`.
- Rarity curve for loot selection: GRAY < WHITE < BLUE < GREEN < PURPLE < GOLD.
- Ensure `entities2D` selection policy yields expected draw order (size-1 first, else best rarity among size-0 stack).

---

## 13) Interface & Module Layout (Server)

Keep modules ≤ 500 LOC each; split further if needed.

- `server/rooms/gamecode/generation/scenario/scenarioGenerator.js`
  - `generateScenario(seed, opts)`
- `server/rooms/gamecode/generation/quest/questGenerator.js`
  - `generateQuest(scenario, rng)`
- `server/rooms/gamecode/generation/dungeon/dungeonPlanner.js`
  - `planDungeon(quest, rng)`
- `server/rooms/gamecode/generation/level/levelBuilder.js`
  - `buildLevel(plan, rng)`
- `server/rooms/gamecode/generation/validate/validator.js`
  - `validateLevel(level)`
- `server/rooms/gamecode/generation/util/rng.js`
  - `makeRng(seed)`, `derive(seed, label)`
- `server/rooms/gamecode/generation/util/types.js`
  - Small factories and validators for data contracts above

Note: We already have `shared/dungeon/generator.js` with some variants. We’ll keep that for client-side decorative maps (login/lobby) and move authoritative gameplay generation into the server modules above. Shared code (e.g., tile palettes) can live under `shared/` and be imported server-side.

---

## 14) KISS APIs (Unified)

```js
// Entrypoint used by rooms
function generateLevelFromSeed(masterSeed, opts) {
  const s0 = derive(masterSeed, 'scenario');
  const s1 = derive(masterSeed, 'quest');
  const s2 = derive(masterSeed, 'dungeon');
  const s3 = derive(masterSeed, 'level');

  const scenario = generateScenario(s0, opts);
  const quest    = generateQuest(scenario, makeRng(s1));
  const plan     = planDungeon(quest, makeRng(s2));
  const level    = buildLevel(plan, makeRng(s3));

  const v = validateLevel(level);
  if (!v.ok) { /* repair/retry a bounded number of times */ }

  return { scenario, quest, plan, level };
}
```

---

## 15) Networking & Persistence

- Server owns seeds and emits only the finalized `Level` (pruned later by FOV for each client).
- Persist level seeds in DB (Supabase) per game instance; regenerate deterministically as needed.
- Avoid shipping full RNG state; seeds are enough.

---

## 16) Performance Notes

- Planning is graph-scale (rooms, not cells) → very fast.
- Level build is cell-scale but linear in carved cells; 256×256 is trivial in JS.
- Validation flood-fills should be O(cells); small per level.
- Retry budget: keep ≤ 3 retries; repair before re-rolling entire plan where possible.

---

## 17) Validation Invariants (Checklist)

- __Connectivity__: start → exit reachable respecting closed doors & keys.
- __Key-before-lock__: every lock has a path to its key before encountering the lock.
- __Spawn safety__: player start has 8 neighbors not immediately lethal.
- __Door uniqueness__: each door id unique; each lock references a defined key.
- __Budget bounds__: room count within [min,max]; corridor length caps respected.
- __No overlaps__: rooms do not overlap; corridors carved only in void; doors in walls only.

---

## 18) Open Questions (for tuning)

- __Quest types__: list you want v1 to support besides reach/collect/defeat/rescue.
- __Biomes__: final set for v1 (dungeon, cave, sewer, urban, lab?).
- __Loops__: desired typical loop count or percentage.
- __Hazards__: which first (pit, acid, lava) and how they affect movement costs?
- __Room shapes__: keep rectangles v1? Add simple circular or caverns later?
- __Boss rules__: minimum room size, door count?

---

## 19) Roadmap

- Phase 1: Implement `rng.js`, `scenarioGenerator.js`, `questGenerator.js` (unit-ish tests for key-door pairs).
- Phase 2: Implement `dungeonPlanner.js` (graph + invariants), with visualize-ascii debug output.
- Phase 3: Implement `levelBuilder.js` (layers + structures + doors) using our architecture, and `validator.js` flood-fill.
- Phase 4: Wire into room bootstrap to create levels from seeds; persist seeds in Supabase.
- Phase 5: Optional: add cave variant + decor themes, more quest templates.

---

## 20) Example Flow (Pseudo)

```js
const { scenario, quest, plan, level } = generateLevelFromSeed('game-123-level-001', {
  partyLevel: 5,
  biome: 'dungeon',
  difficulty: { tier: 2, curve: 'rising' },
  length: 'medium',
});

// Use `level` to initialize MapHandle arrays and entities; then start the room.
```

---

## 21) Why This Will Work

- Each stage is tiny and testable; failures are easy to diagnose.
- Contracts are small JSON-like objects; no black boxes.
- Deterministic seeds make bugs reproducible.
- Output aligns 1:1 with our Map + Entities Architecture for seamless integration.
