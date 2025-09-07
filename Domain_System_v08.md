# Domain System Framework (v08)

This version introduces **Elemental Stones** as the medium for channeling elemental domains into equipment. 
Stones provide a unified system for socketing fire, ice, electricity, earth, poison, and acid into gear. 
The effect depends on the **equipment slot**.

---

## 🔥 Elemental Stones

**Types:**
- Firestone (Fire Domain)
- Icestone (Ice Domain)
- Stormstone (Electric Domain)
- Earthstone (Earth Domain)
- Venomstone (Poison Domain)
- Acidstone (Acid Domain)

**Tier (1–6):**
- Stone tier = elemental strength (+1 to +6).
- Example: Firestone T5 → +5 fire effect.

**Source:**
- Dropped from Elemental Cores or crafted from them.

---

## ⚔️ Slot Expressions

### Weapons
- Expression: **Offense**
- Effect: Adds elemental damage equal to stone tier.
- Example: Firestone T5 + Sword = +5 Fire Damage per hit.

### Armor – Chest
- Expression: **Resistance**
- Effect: Adds elemental resistance equal to stone tier.
- Example: Icestone T4 + Chest = +4 Ice Resistance.

### Shields
- Expression: **Block Absorption**
- Effect: Reduces damage of that element when blocking, equal to stone tier.

### Accessories – Rings
- Expression: **Minor Utility**
- Effect: Small resistance + minor thematic buff.
- Example: Firestone T3 + Ring = +1 Fire Resist, +1 Fire Aura.

### Accessories – Amulets
- Expression: **Affinity**
- Effect: Split between resist and damage boost.
- Example: Firestone T5 + Amulet = +2 Fire Damage, +2 Fire Resistance.

### Other Armor Slots
- Helmet: **Awareness** (vision, detection, perception)
- Gloves: **Handling** (apply debuffs, enhance crafting, elemental manipulation)
- Boots: **Mobility** (lava-walking, ice-walking, shockstep)
- Pants: **Stamina** (regen, fatigue reduction, durability vs that element)

---

## 🧩 Examples

- Firestone + Sword (T5): +5 Fire Damage
- Firestone + Shield (T5): +5 Fire Resistance when blocking
- Firestone + Amulet (T5): +2 Fire Damage, +2 Fire Resistance
- Firestone + Boots (T5): Lava-walk ability, duration scales with tier
- Stormstone + Helmet (T4): Lightning-vision, detect enemies as arcs
- Icestone + Gloves (T3): Strikes apply +3 Freeze chance

---

## ⚖️ General Rule

- Stones **must match their domain**; you cannot slot raw fire directly. 
- Fire → Firestone → valid equipment slot.
- Invalid combinations are rejected.
- Amulets and rings provide hybrid effects, while chest armor provides core resistances, and weapons always convert the element to damage.

