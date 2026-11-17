// ─── Moves (stage 9) ─────────────────────────────────────────────────────────
// Designed species by species. Each move: type (one of the 13), kind (physical uses
// Attack vs Defense, elemental uses Elemental vs Resistance, support doesn't hit),
// power, accuracy, stamina cost, and effects:
//   status: [{ id, chance, turns, self? }]   a status on the foe (or on itself)
//   stat:   [{ stat, stages, chance?, self? }] stat stages for the battle
//   special: a one-off rule handled by the engine
//   crit:   critical-hit chance if it isn't the usual 5%
// "Light" moves cost 5 stamina or less and are the only ones a Fatigued creature can use.
export const MOVES = {
  // Ramtarug
  bump:          { name: "Bump",            type: "Normal", kind: "physical", power: 35,  acc: 1.0,  stamina: 3 },
  sourspit:      { name: "Sour Spit",       type: "Poison", kind: "elemental", power: 30, acc: 1.0,  stamina: 4,  status: [{ id: "poison", chance: 0.3, turns: 4 }] },
  warningspots:  { name: "Warning Spots",   type: "Poison", kind: "support",  power: 0,   acc: 0.9,  stamina: 6,  stat: [{ stat: "atk", stages: -1 }], status: [{ id: "fear", chance: 0.1, turns: 3 }] },
  mudkick:       { name: "Mud Kick",        type: "Earth",  kind: "physical", power: 50,  acc: 0.95, stamina: 8,  status: [{ id: "blind", chance: 0.1, turns: 3 }] },
  ram:           { name: "Ram",             type: "Normal", kind: "physical", power: 65,  acc: 0.95, stamina: 10, status: [{ id: "knocked", chance: 0.05, turns: 1 }] },
  foulbite:      { name: "Foul Bite",       type: "Poison", kind: "physical", power: 60,  acc: 1.0,  stamina: 10, status: [{ id: "festering", chance: 0.3, turns: 8 }] },
  swampgas:      { name: "Swamp Gas",       type: "Poison", kind: "elemental", power: 60, acc: 0.9,  stamina: 12, status: [{ id: "poison", chance: 0.4, turns: 16 }] },
  toxichide:     { name: "Toxic Hide",      type: "Poison", kind: "support",  power: 0,   acc: 1.0,  stamina: 12, stat: [{ stat: "def", stages: 1, self: true }], status: [{ id: "toxichide", chance: 1, turns: 10, self: true }] },
  skullcrack:    { name: "Skullcrack",      type: "Normal", kind: "physical", power: 100, acc: 0.85, stamina: 25, status: [{ id: "knocked", chance: 0.3, turns: 1 }] },
  oldramsstand:  { name: "Old Ram's Stand", type: "Normal", kind: "support",  power: 0,   acc: 1.0,  stamina: 15, stat: [{ stat: "def", stages: 1, self: true }, { stat: "res", stages: 1, self: true }], special: "clearOne" },
};
for (const [id, m] of Object.entries(MOVES)) m.id = id;

// What each move does, in a line (for the card and the move buttons)
const STAT_NAME = { atk: "Attack", def: "Defense", ele: "Elemental", res: "Resistance", spd: "Speed" };
const SNAME = { poison: "Poison", fear: "Fear", blind: "Blind", knocked: "Knocked down", festering: "Festering" };
export function moveEffectText(m) {
  const parts = [];
  for (const s of m.stat || []) parts.push(`${s.self ? "" : "foe's "}${STAT_NAME[s.stat]} ${s.stages > 0 ? "up" : "down"}`);
  for (const s of m.status || []) {
    if (s.id === "toxichide") parts.push("poisons attackers 30% (10 turns)");
    else parts.push(`${Math.round(s.chance * 100)}% ${SNAME[s.id] || s.id}${s.id === "knocked" ? "" : ` (${s.turns} turns)`}`);
  }
  if (m.special === "clearOne") parts.push("clears one of its statuses");
  if (!parts.length) return "";
  const t = parts.join(", ");
  return t[0].toUpperCase() + t.slice(1);
}
