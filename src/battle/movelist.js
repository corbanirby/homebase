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
  // Scuffinch
  peck:          { name: "Peck",            type: "Normal", kind: "physical", power: 35,  acc: 1.0,  stamina: 3,  crit: 0.12 },
  leafflick:     { name: "Leaf Flick",      type: "Normal", kind: "physical", power: 25,  acc: 1.0,  stamina: 4,  status: [{ id: "blind", chance: 0.2, turns: 2 }] },
  wingattack:    { name: "Wing Attack",     type: "Air",    kind: "physical", power: 45,  acc: 1.0,  stamina: 5 },
  doublephrase:  { name: "Double Phrase",   type: "Air",    kind: "elemental", power: 25, acc: 0.95, stamina: 8,  hits: 2 },
  dirtscuff:     { name: "Dirt Scuff",      type: "Earth",  kind: "physical", power: 55,  acc: 0.95, stamina: 9,  status: [{ id: "blind", chance: 0.1, turns: 3 }] },
  borrowedsong:  { name: "Borrowed Song",   type: "Air",    kind: "support",  power: 0,   acc: 1.0,  stamina: 10, special: "borrow" },
  hedgedive:     { name: "Hedge Dive",      type: "Air",    kind: "physical", power: 80,  acc: 0.9,  stamina: 14, crit: 0.25 },
  dawnchorus:    { name: "Dawn Chorus",     type: "Air",    kind: "support",  power: 0,   acc: 1.0,  stamina: 8,  special: "dawnChorus", status: [{ id: "awake", chance: 1, turns: 5, self: true }] },
  scoldingcall:  { name: "Scolding Call",   type: "Normal", kind: "support",  power: 0,   acc: 0.9,  stamina: 8,  stat: [{ stat: "atk", stages: -1 }], status: [{ id: "mute", chance: 0.2, turns: 3 }] },
  nestfury:      { name: "Nest Fury",       type: "Normal", kind: "physical", power: 90,  acc: 0.9,  stamina: 22, crit: 0.25, stat: [{ stat: "def", stages: -1, self: true }] },
  thousandsongs: { name: "Thousand Songs",  type: "Air",    kind: "elemental", power: 70, acc: 0.95, stamina: 15, status: [{ id: "confusion", chance: 0.3, turns: 3 }] },
  // Kudzoon
  vinewhip:       { name: "Vine Whip",          type: "Plant",  kind: "physical", power: 35, acc: 1.0,  stamina: 3 },
  creepingrunner: { name: "Creeping Runner",    type: "Plant",  kind: "support",  power: 0,  acc: 0.95, stamina: 5,  stat: [{ stat: "spd", stages: -1 }], status: [{ id: "tangle", chance: 0.3, turns: 3 }] },
  taproot:        { name: "Taproot",            type: "Plant",  kind: "elemental", power: 35, acc: 1.0, stamina: 6,  status: [{ id: "leech", chance: 0.5, turns: 8 }] },
  leaffold:       { name: "Leaf Fold",          type: "Plant",  kind: "support",  power: 0,  acc: 1.0,  stamina: 6,  stat: [{ stat: "res", stages: 1, self: true }], heal: 0.1 },
  smother:        { name: "Smother",            type: "Plant",  kind: "elemental", power: 60, acc: 0.95, stamina: 10, status: [{ id: "tangle", chance: 0.3, turns: 4 }] },
  grapebloom:     { name: "Grape Bloom",        type: "Plant",  kind: "support",  power: 0,  acc: 0.9,  stamina: 8,  status: [{ id: "drowsy", chance: 0.4, turns: 4 }] },
  blankethills:   { name: "Blanket the Hills",  type: "Plant",  kind: "support",  power: 0,  acc: 1.0,  stamina: 14, field: { id: "overgrown", turns: 5 } },
  strangle:       { name: "Strangle",           type: "Plant",  kind: "physical", power: 70, acc: 0.95, stamina: 14, bonusVs: "tangle", status: [{ id: "tangle", chance: 0.3, turns: 4 }] },
  topple:         { name: "Topple",             type: "Normal", kind: "physical", power: 85, acc: 0.85, stamina: 20, status: [{ id: "knocked", chance: 0.15, turns: 1 }] },
  deepcrown:      { name: "Deep Crown",         type: "Plant",  kind: "support",  power: 0,  acc: 1.0,  stamina: 15, status: [{ id: "deepcrown", chance: 1, turns: 3, self: true }] },
  woodycrown:     { name: "Woody Crown",        type: "Plant",  kind: "support",  power: 0,  acc: 1.0,  stamina: 15, stat: [{ stat: "def", stages: 2, self: true }, { stat: "res", stages: 2, self: true }], heal: 0.25 },
};
for (const [id, m] of Object.entries(MOVES)) m.id = id;
export const FIELDS = { overgrown: { name: "Overgrown", icon: "🌿", text: "Plant moves +25%, everyone else 20% slower, Tangle lands more often" } };

// What each move does, in a line (for the card and the move buttons)
const STAT_NAME = { atk: "Attack", def: "Defense", ele: "Elemental", res: "Resistance", spd: "Speed" };
const SNAME = { poison: "Poison", fear: "Fear", blind: "Blind", knocked: "Knocked down", festering: "Festering", mute: "Mute", confusion: "Confusion", tangle: "Tangle", leech: "Leech", drowsy: "Drowsy" };
export function moveEffectText(m) {
  const parts = [];
  for (const s of m.stat || []) parts.push(`${s.self ? "" : "foe's "}${STAT_NAME[s.stat]} ${s.stages > 0 ? "up" : "down"}`);
  for (const s of m.status || []) {
    if (s.id === "toxichide") parts.push("poisons attackers 30% (10 turns)");
    else if (s.id === "awake") parts.push("can't get drowsy (5 turns)");
    else if (s.id === "deepcrown") parts.push("for 3 turns survives a knockout with 1 HP and heals 5% a turn");
    else parts.push(`${Math.round(s.chance * 100)}% ${SNAME[s.id] || s.id}${s.id === "knocked" ? "" : ` (${s.turns} turns)`}`);
  }
  if (m.special === "clearOne") parts.push("clears one of its statuses");
  if (m.heal) parts.push(`heals ${Math.round(m.heal * 100)}%`);
  if (m.field) parts.push(`overgrows the field (${m.field.turns} turns)`);
  if (m.bonusVs) parts.unshift(`×1.5 power if the foe has ${SNAME[m.bonusVs] || m.bonusVs}`);
  if (m.special === "borrow") parts.push("uses the last elemental move the foe used");
  if (m.special === "dawnChorus") parts.push("wakes and calms your whole team (clears Drowsy and Fear)");
  if (m.hits > 1) parts.unshift(`hits ${m.hits} times`);
  if (m.crit) parts.push(`${Math.round(m.crit * 100)}% critical`);
  if (!parts.length) return "";
  const t = parts.join(", ");
  return t[0].toUpperCase() + t.slice(1);
}
