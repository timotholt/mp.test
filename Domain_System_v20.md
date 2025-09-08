# Domain System Framework (v20) — Part A

> **Single-source, comprehensive spec.** Builds on v19 and adds a **Combat System** with combat domains, tier scaling, crit categories, block/dodge rules, and pacing examples.

---

## 0) Key Tenets
- **Humans/flesh races** have **T0 Body(Material)** and **T0 Coverage**. Their defense comes from **equipment**.
- **Salvage is material-locked** (item/corpse material determines outputs) and **size-locked** (corpses scale by size).
- Salvage yields **RAW** (flavorful parts), never ingots directly. **RAW must be refined** before crafting.
- **Spirits are singleton** (max 1 per creature) and require a **Vessel** to capture.
- **Flavor inheritance** applies to **FOOD only** (meals reflect meat species). Gear names are material-only.

---

## 1) Domains (Tier 0–6)

| Domain | T0 | T1 | T2 | **T3 (Baseline)** | T4 | T5 | T6 |
|---|---|---|---|---|---|---|---|
| **Body (Material)** | None (flesh) | Wood | Iron | **Steel** | Titanium | Adamantium | Exotic (Voidmetal/Neutronium) |
| **Spirit (Brain)** | None | Wisp | Lesser | **Normal** | Greater | Ancient | Eternal |
| **Skill (Soldier)** | None | Trainee | Adept | **Veteran (Skilled)** | Elite | Chapter Master | Godlike |
| **Size** | None | Tiny | Small | **Medium** | Large | Huge | Colossal |
| **Coverage (Armor)** | None | Hide/Leather | Ring | **Chain** | Scale | Plate | Full Plate |
| **Movement** (Land/Air/Water/Earth) | — | Crawl/Glide/Paddle/Scratch | Limp/Flutter/Dog-paddle/Burrow | **Walk/Flight/Swim/Tunnel** | Sprint/Swift/Streamlined/Bore | Charge/Soaring/Aquatic Mastery/Drill | Stampede/Supersonic/Abyssal/Subterranean |
| **Senses** (Sight/Hearing/Smell/Taste) | Blind/Deaf/NoSmell/NoTaste | Dim/Dull/Dull/Dull | Basic/Basic/Basic/Basic | **Normal/Sharp/Sharp/Sharp** | Keen/Keen/Keen/Keen | Superior/Superior/Superior/Superior | Transcendent/Transcendent/Transcendent/Transcendent |
| **Elemental** (Ice/Electric/Earth/Poison/Acid/Fire) | None | Minor | Moderate | **Strong** | Severe | Extreme | Cosmic |
| **Loot** | None | Scavenger ×1.1 | Greedy ×1.25 | **Raider ×1.5** | Collector ×2.0 | Hoarder ×3.0 | Vault-Keeper ×5.0 |
| **Combat (see §13)** | Unskilled | Trainee | Adept | **Veteran (Skilled)** | Elite | Chapter Master | Godlike |

---

## 2) Kill Outcome (Spec)
On valid kill (not obliterated by disintegration/incineration flags):
1. **Corpse** drops (see §3).  
2. **Equipped Items** drop intact.  
3. **Spirit Essence** generates (requires **Vessel**; max 1).  
4. **Encounter modifiers** (Elite/Boss) affect **quality/purity**, not corpse component counts.  
5. Roll **Wildcard loot** (off-domain fun):  
   `P_wild = 0.02 × LootMult(creature) × DifficultyMult × PlayerLuckMult` (tuneable).

---

## 3) Corpses & Decay

### 3.1 Components
- **Perishable**: meat, organs, skin.  
- **Durable**: bones/teeth, scales/plates (metal/chitin/stone).

### 3.2 Decay Phases (by *turns × env*)
- **Fresh (0–40t)**: perishable 100%, durable 100%  
- **Stale (41–120t)**: perishable 50%, durable 100%  
- **Rotten (121–200t)**: perishable 0%, durable 100%  
- **Skeletal (200t+)**: perishable 0%, durable 100% → may compress to “Remains”

**Environment multipliers**: cold 0.25×; hot 2×; lava 8×; refrigeration 0.1×; salted/smoked 0.2×; swamp 1.5×; arid 0.75×.  
**Death flags** may delete perishables and reduce durables by 25–50%.

### 3.3 Salvaging Corpses
- **Durables**: available at all phases unless destroyed.  
- **Perishables**: yield scales by phase (100/50/0/0).  
- **Humans/flesh (T0/T0)**: no metal/scales; organic RAW only.

**Size scaling** (for corpse durables):  
`units = CoverageBase × SizeMult` where:

- `CoverageBase`: None 0, Hide 1, Ring 2, Chain 3, Scale 4, Plate 5, Full 6  
- `SizeMult`: T0 0.0, T1 0.25, T2 0.5, T3 1.0, T4 2.0, T5 4.0, T6 8.0  
- Optional clamp: `units ≤ BodyTier × 24`
---

## 4) Items & Equipment
- Items drop intact.  
- Salvaging an **item** yields **RAW** by its **Coverage** and **Material**:  
  - `Ring/Chain → LINKS`, `Scale → SCALES`, `Plate/Full → PLATES`, `Hide → HIDE`.  
  - `units = CoverageBase` (items do **not** scale by size).  
- **Quality/rarity does not change** salvage type/quantity (can add bonus dust separately).

---

## 5) RAW (Unified Model) & FOOD
- RAW = material-locked salvage (LINKS, PLATES, SCALES, HIDE, SHARDS, BONES, WOOD).  
- FOOD = species-locked meat; never refined.  
- See v19 for full schemas; rules unchanged.

---

## 6) Refining RAW → Ingots/Units
- RAW → Ingots/Units (1:1 defaults).  
- Auto-refine allowed.  
- See v19 pseudocode.

---

## 7) Crafting
- Armor/weapon costs same as v19.  
- Sockets allow elemental stones.  
- FOOD ignored by crafting.

---

## 8) Spirits & Elemental Stones
- Spirits: singleton; purity tiers.  
- Stones: elemental augments for weapons, armor, amulets, etc.

---

## 9) Flavor (FOOD-only)
- Flavor inheritance restricted to FOOD.  
- Dominant vs Blend modes for naming dishes.  
- Gear never inherits flavor.

---

## 10) Skills & XP
- T0 Unskilled (0) → T6 Godlike (160+).  
- XP curve and checks same as v19.

---

## 11) Credits Economy & Tuning
- Credits + quality multipliers.  
- Material base costs by tier.  
- ECON_K applies globally.  
- See v19 for formulas.

---

## 12) Loot Tables — Parametric Design
- Blueprints + resolvers for modular loot.  
- Wildcard drop chance formula included.

---

## 13) Combat System
- Domains: HP, AC, To-Hit, Damage, Crit, Dodge, Block.  
- Scaling: HP ×1.6/tier, Damage ×1.35/tier, AC +10–15%/tier.  
- Crit tiers: Glancing → Godslayer.  
- Pacing: T3 vs T3 ~4–7 rounds; Elites 6–12; Bosses 10–20.  
- Block resolves after Dodge.  
- Legendary fights shouldn’t collapse to ≤4 hits.

---

## 14) Examples
- Human Soldier T3 (corpse, chainmail, sword, spirit).  
- Dragon Huge T5 (scales, bones, spirit).  
- Combat samples (HP/damage scaling).

---

## 15) Data Schemas (concise)
- RAW and FOOD JSON models.  
- Stack keys defined.

---

## 16) Pseudocode Index
- corpse_phase, salvage, refine_raw, craft, spirit_drop, name_dish, resolve_drops.

---

## 17) Changelog
- **v20**: Added Combat System domains, scaling, crits, pacing.  
- v19: Consolidated all prior subsystems.  
- v18: FOOD-only flavor inheritance.  
- v17–v11: see prior logs.
