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
  sourspit:      { name: "Sour Spit",       type: "Poison", kind: "elemental", power: 30, acc: 1.0,  stamina: 4,  status: [{ id: "poison", chance: 0.5, turns: 5 }] },
  warningspots:  { name: "Warning Spots",   type: "Poison", kind: "support",  power: 0,   acc: 0.9,  stamina: 6,  stat: [{ stat: "atk", stages: -1 }], status: [{ id: "fear", chance: 0.8, turns: 4 }] },
  mudkick:       { name: "Mud Kick",        type: "Earth",  kind: "physical", power: 50,  acc: 0.95, stamina: 8,  status: [{ id: "blind", chance: 0.25, turns: 4 }] },
  ram:           { name: "Ram",             type: "Normal", kind: "physical", power: 65,  acc: 0.95, stamina: 10, status: [{ id: "knocked", chance: 0.05, turns: 1 }] },
  foulbite:      { name: "Foul Bite",       type: "Poison", kind: "physical", power: 60,  acc: 1.0,  stamina: 10, status: [{ id: "festering", chance: 0.5, turns: 8 }] },
  swampgas:      { name: "Swamp Gas",       type: "Poison", kind: "elemental", power: 60, acc: 0.9,  stamina: 12, status: [{ id: "poison", chance: 0.6, turns: 16 }] },
  toxichide:     { name: "Toxic Hide",      type: "Poison", kind: "support",  power: 0,   acc: 1.0,  stamina: 12, stat: [{ stat: "def", stages: 1, self: true }], status: [{ id: "toxichide", chance: 1, turns: 10, self: true }] },
  skullcrack:    { name: "Skullcrack",      type: "Normal", kind: "physical", power: 100, acc: 0.85, stamina: 25, status: [{ id: "knocked", chance: 0.3, turns: 1 }] },
  oldramsstand:  { name: "Old Ram's Stand", type: "Normal", kind: "support",  power: 0,   acc: 1.0,  stamina: 15, stat: [{ stat: "def", stages: 1, self: true }, { stat: "res", stages: 1, self: true }], special: "clearOne" },
  // Scuffinch
  peck:          { name: "Peck",            type: "Air",    kind: "physical", power: 35,  acc: 1.0,  stamina: 3,  crit: 0.12 },
  leafflick:     { name: "Leaf Flick",      type: "Normal", kind: "physical", power: 25,  acc: 1.0,  stamina: 4,  status: [{ id: "blind", chance: 0.4, turns: 5 }] },
  wingattack:    { name: "Wing Attack",     type: "Air",    kind: "physical", power: 45,  acc: 1.0,  stamina: 5 },
  doublephrase:  { name: "Double Phrase",   type: "Air",    kind: "elemental", power: 25, acc: 0.95, stamina: 8,  hits: 2 },
  dirtscuff:     { name: "Dirt Scuff",      type: "Earth",  kind: "physical", power: 55,  acc: 0.95, stamina: 9,  status: [{ id: "blind", chance: 0.25, turns: 4 }] },
  borrowedsong:  { name: "Borrowed Song",   type: "Air",    kind: "support",  power: 0,   acc: 1.0,  stamina: 10, special: "borrow" },
  hedgedive:     { name: "Hedge Dive",      type: "Air",    kind: "physical", power: 80,  acc: 0.9,  stamina: 14, crit: 0.25 },
  dawnchorus:    { name: "Dawn Chorus",     type: "Air",    kind: "support",  power: 0,   acc: 1.0,  stamina: 8,  special: "dawnChorus", status: [{ id: "awake", chance: 1, turns: 5, self: true }] },
  scoldingcall:  { name: "Scolding Call",   type: "Normal", kind: "support",  power: 0,   acc: 0.9,  stamina: 8,  stat: [{ stat: "atk", stages: -1 }], status: [{ id: "mute", chance: 0.8, turns: 4 }] },
  nestfury:      { name: "Nest Fury",       type: "Normal", kind: "physical", power: 90,  acc: 0.9,  stamina: 22, crit: 0.25, stat: [{ stat: "def", stages: -1, self: true }] },
  thousandsongs: { name: "Thousand Songs",  type: "Air",    kind: "elemental", power: 70, acc: 0.95, stamina: 15, status: [{ id: "confusion", chance: 0.4, turns: 5 }] },
  // Kudzoon
  vinewhip:       { name: "Vine Whip",          type: "Plant",  kind: "physical", power: 35, acc: 1.0,  stamina: 3 },
  creepingrunner: { name: "Creeping Runner",    type: "Plant",  kind: "support",  power: 0,  acc: 0.95, stamina: 5,  stat: [{ stat: "spd", stages: -1 }], status: [{ id: "tangle", chance: 0.8, turns: 4 }] },
  taproot:        { name: "Taproot",            type: "Plant",  kind: "elemental", power: 35, acc: 1.0, stamina: 6,  status: [{ id: "leech", chance: 0.6, turns: 8 }] },
  leaffold:       { name: "Leaf Fold",          type: "Plant",  kind: "support",  power: 0,  acc: 1.0,  stamina: 6,  stat: [{ stat: "res", stages: 1, self: true }], heal: 0.1 },
  smother:        { name: "Smother",            type: "Plant",  kind: "elemental", power: 60, acc: 0.95, stamina: 10, status: [{ id: "tangle", chance: 0.5, turns: 5 }] },
  grapebloom:     { name: "Grape Bloom",        type: "Plant",  kind: "support",  power: 0,  acc: 0.9,  stamina: 8,  status: [{ id: "drowsy", chance: 0.8, turns: 5 }] },
  blankethills:   { name: "Blanket the Hills",  type: "Plant",  kind: "support",  power: 0,  acc: 1.0,  stamina: 14, field: { id: "overgrown", turns: 5 } },
  strangle:       { name: "Strangle",           type: "Plant",  kind: "physical", power: 70, acc: 0.95, stamina: 14, bonusVs: "tangle", status: [{ id: "tangle", chance: 0.4, turns: 5 }] },
  topple:         { name: "Topple",             type: "Normal", kind: "physical", power: 85, acc: 0.85, stamina: 20, status: [{ id: "knocked", chance: 0.15, turns: 1 }] },
  deepcrown:      { name: "Deep Crown",         type: "Plant",  kind: "support",  power: 0,  acc: 1.0,  stamina: 15, status: [{ id: "deepcrown", chance: 1, turns: 3, self: true }] },
  woodycrown:     { name: "Woody Crown",        type: "Plant",  kind: "support",  power: 0,  acc: 1.0,  stamina: 15, stat: [{ stat: "def", stages: 2, self: true }, { stat: "res", stages: 2, self: true }], heal: 0.25 },
  // ── Shared moves: plain actions any species can have, each with one small quirk
  bite:          { name: "Bite",            type: "Normal", kind: "physical", power: 40,  acc: 1.0,  stamina: 3,  status: [{ id: "fear", chance: 0.1, turns: 3 }] },
  pinch:         { name: "Pinch",           type: "Normal", kind: "physical", power: 35,  acc: 1.0,  stamina: 3,  status: [{ id: "bleed", chance: 0.15, turns: 3 }] },
  scratch:       { name: "Scratch",         type: "Normal", kind: "physical", power: 35,  acc: 1.0,  stamina: 3,  crit: 0.1, status: [{ id: "bleed", chance: 0.1, turns: 3 }] },
  dig:           { name: "Dig",             type: "Earth",  kind: "physical", power: 80,  acc: 1.0,  stamina: 14, twoTurn: true },
  splash:        { name: "Splash",          type: "Water",  kind: "elemental", power: 45, acc: 1.0,  stamina: 6,  status: [{ id: "wet", chance: 0.6, turns: 6 }] },
  zap:           { name: "Zap",             type: "Electric", kind: "elemental", power: 30, acc: 1.0, stamina: 3, status: [{ id: "paralysis", chance: 0.15, turns: 3 }] },
  shock:         { name: "Shock",           type: "Electric", kind: "elemental", power: 45, acc: 1.0, stamina: 6, status: [{ id: "paralysis", chance: 0.4, turns: 5 }] },
  // Thrummet
  pierce:        { name: "Pierce",          type: "Bug",    kind: "physical", power: 35,  acc: 1.0,  stamina: 3,  crit: 0.12 },
  saptap:        { name: "Sap Tap",         type: "Bug",    kind: "elemental", power: 30, acc: 1.0,  stamina: 5,  drain: 0.5 },
  digin:         { name: "Dig In",          type: "Earth",  kind: "support",  power: 0,   acc: 1.0,  stamina: 5,  stat: [{ stat: "def", stages: 1, self: true }] },
  emergence:     { name: "Emergence",       type: "Earth",  kind: "physical", power: 50,  acc: 0.95, stamina: 8 },
  molt:          { name: "Molt",            type: "Air",    kind: "support",  power: 0,   acc: 1.0,  stamina: 10, special: "molt" },
  drone:         { name: "Drone",           type: "Air",    kind: "elemental", power: 50, acc: 0.95, stamina: 8,  foeStamina: 15, status: [{ id: "confusion", chance: 0.3, turns: 4 }] },
  wingwhir:      { name: "Wing Whir",       type: "Air",    kind: "physical", power: 60,  acc: 1.0,  stamina: 9 },
  chorusswell:   { name: "Chorus Swell",    type: "Bug",    kind: "support",  power: 0,   acc: 1.0,  stamina: 10, foeStamina: 10, stat: [{ stat: "ele", stages: 1, self: true }] },
  seventeenyears:{ name: "Seventeen Years", type: "Bug",    kind: "elemental", power: 95, acc: 0.9,  stamina: 24, status: [{ id: "confusion", chance: 0.35, turns: 5 }] },
  // Flintback
  flintstrike:   { name: "Flint Strike",    type: "Fire",   kind: "physical", power: 35,  acc: 1.0,  stamina: 3,  status: [{ id: "burn", chance: 0.15, turns: 3 }] },
  pushups:       { name: "Push-Ups",        type: "Normal", kind: "support",  power: 0,   acc: 0.95, stamina: 5,  stat: [{ stat: "atk", stages: 1, self: true }, { stat: "atk", stages: -1 }] },
  gritspray:     { name: "Grit Spray",      type: "Earth",  kind: "elemental", power: 40, acc: 0.95, stamina: 6,  status: [{ id: "blind", chance: 0.3, turns: 4 }] },
  bask:          { name: "Bask",            type: "Fire",   kind: "support",  power: 0,   acc: 1.0,  stamina: 6,  stat: [{ stat: "spd", stages: 1, self: true }, { stat: "ele", stages: 1, self: true }] },
  hotstone:      { name: "Hot Stone",       type: "Earth",  kind: "physical", power: 60,  acc: 0.95, stamina: 10, status: [{ id: "burn", chance: 0.4, turns: 5 }] },
  taildrop:      { name: "Tail Drop",       type: "Normal", kind: "support",  power: 0,   acc: 1.0,  stamina: 10, special: "tailDrop" },
  flintflash:    { name: "Flint Flash",     type: "Fire",   kind: "elemental", power: 70, acc: 0.95, stamina: 12, status: [{ id: "burn", chance: 0.5, turns: 6 }] },
  hotrocks:      { name: "Hot Rocks",       type: "Fire",   kind: "support",  power: 0,   acc: 1.0,  stamina: 14, field: { id: "hotrocks", turns: 5 } },
  graniteslam:   { name: "Granite Slam",    type: "Earth",  kind: "physical", power: 90,  acc: 0.9,  stamina: 20 },
  oldcoal:       { name: "Old Coal",        type: "Fire",   kind: "elemental", power: 100, acc: 0.9, stamina: 24, status: [{ id: "burn", chance: 0.6, turns: 8 }] },
  // Shoalclaw
  siltcloud:     { name: "Silt Cloud",      type: "Water",  kind: "elemental", power: 30, acc: 1.0,  stamina: 4,  status: [{ id: "blind", chance: 0.5, turns: 5 }] },
  clawclamp:     { name: "Claw Clamp",      type: "Water",  kind: "physical", power: 55,  acc: 0.95, stamina: 9,  status: [{ id: "bleed", chance: 0.5, turns: 5 }] },
  mudfort:       { name: "Mud Fort",        type: "Earth",  kind: "support",  power: 0,   acc: 1.0,  stamina: 8,  stat: [{ stat: "def", stages: 2, self: true }] },
  tailflip:      { name: "Tail Flip",       type: "Water",  kind: "support",  power: 0,   acc: 1.0,  stamina: 8,  special: "tailFlip" },
  riverbedrake:  { name: "Riverbed Rake",   type: "Earth",  kind: "physical", power: 70,  acc: 0.95, stamina: 12, status: [{ id: "knocked", chance: 0.1, turns: 1 }] },
  crushingclaw:  { name: "Crushing Claw",   type: "Water",  kind: "physical", power: 85,  acc: 0.9,  stamina: 18, crit: 0.25, status: [{ id: "bleed", chance: 0.3, turns: 5 }] },
  oldpincer:     { name: "Old Pincer",      type: "Normal", kind: "physical", power: 100, acc: 0.85, stamina: 22, status: [{ id: "bleed", chance: 0.4, turns: 6 }] },
  // Glimmerwick
  flashpattern:  { name: "Flash Pattern",   type: "Electric", kind: "support", power: 0,  acc: 0.85, stamina: 4,  status: [{ id: "blind", chance: 1, turns: 4 }] },
  nightswarm:    { name: "Night Swarm",     type: "Bug",    kind: "elemental", power: 20, acc: 0.9,  stamina: 8,  hits: 3 },
  falsesignal:   { name: "False Signal",    type: "Electric", kind: "support", power: 0,  acc: 0.9,  stamina: 8,  stat: [{ stat: "def", stages: -1 }, { stat: "res", stages: -1 }] },
  glowwormdrift: { name: "Glowworm Drift",  type: "Bug",    kind: "support",  power: 0,   acc: 1.0,  stamina: 6,  stat: [{ stat: "spd", stages: 1, self: true }], status: [{ id: "drift", chance: 1, turns: 4, self: true }] },
  heatlightning: { name: "Heat Lightning",  type: "Electric", kind: "elemental", power: 80, acc: 0.9, stamina: 14, status: [{ id: "paralysis", chance: 0.4, turns: 5 }] },
  lastlight:     { name: "Last Light",      type: "Electric", kind: "elemental", power: 110, acc: 0.95, stamina: 25, selfCost: 0.5 },
  // Possumbra
  fiftytoothhiss:{ name: "Fifty-Tooth Hiss",type: "Normal", kind: "support",  power: 0,   acc: 0.9,  stamina: 5,  stat: [{ stat: "atk", stages: -1 }], status: [{ id: "fear", chance: 0.8, turns: 4 }] },
  moonlessstare: { name: "Moonless Stare",  type: "Spirit", kind: "elemental", power: 45, acc: 1.0,  stamina: 6,  status: [{ id: "fear", chance: 0.4, turns: 5 }] },
  tailgrip:      { name: "Tail Grip",       type: "Normal", kind: "physical", power: 45,  acc: 0.95, stamina: 7,  status: [{ id: "tangle", chance: 0.4, turns: 5 }] },
  playdead:      { name: "Play Dead",       type: "Spirit", kind: "support",  power: 0,   acc: 1.0,  stamina: 0,  special: "playDead" },
  tickgroom:     { name: "Tick Groom",      type: "Normal", kind: "support",  power: 0,   acc: 1.0,  stamina: 8,  heal: 0.15, special: "groom" },
  scavenge:      { name: "Scavenge",        type: "Normal", kind: "support",  power: 0,   acc: 1.0,  stamina: 10, heal: 0.3 },
  graveyardshift:{ name: "Graveyard Shift", type: "Spirit", kind: "elemental", power: 75, acc: 0.95, stamina: 14, status: [{ id: "fear", chance: 0.4, turns: 5 }] },
  deathscent:    { name: "Death Scent",     type: "Spirit", kind: "elemental", power: 90, acc: 0.95, stamina: 20, status: [{ id: "fear", chance: 0.4, turns: 5 }, { id: "festering", chance: 0.4, turns: 6 }] },
  // Clattershell
  brace:         { name: "Brace",           type: "Metal",  kind: "support",  power: 0,   acc: 1.0,  stamina: 5,  stat: [{ stat: "def", stages: 2, self: true }] },
  pounce:        { name: "Pounce",          type: "Normal", kind: "physical", power: 45,  acc: 0.95, stamina: 7,  status: [{ id: "knocked", chance: 0.3, turns: 1 }] },
  platebash:     { name: "Plate Bash",      type: "Metal",  kind: "physical", power: 55,  acc: 1.0,  stamina: 8 },
  grub:          { name: "Grub",            type: "Earth",  kind: "support",  power: 0,   acc: 1.0,  stamina: 10, heal: 0.25 },
  heavylanding:  { name: "Heavy Landing",   type: "Metal",  kind: "physical", power: 90,  acc: 0.9,  stamina: 20, status: [{ id: "knocked", chance: 0.3, turns: 1 }] },
  ironhide:      { name: "Ironhide",        type: "Metal",  kind: "support",  power: 0,   acc: 1.0,  stamina: 15, stat: [{ stat: "def", stages: 2, self: true }, { stat: "res", stages: 2, self: true }], heal: 0.15 },
  // Duskhowl
  yipcall:       { name: "Yip Call",        type: "Spirit", kind: "support",  power: 0,   acc: 0.9,  stamina: 5,  stat: [{ stat: "atk", stages: 1, self: true }], status: [{ id: "fear", chance: 0.7, turns: 4 }] },
  hamstring:     { name: "Hamstring",       type: "Normal", kind: "physical", power: 55,  acc: 0.95, stamina: 9,  stat: [{ stat: "spd", stages: -1 }], status: [{ id: "bleed", chance: 0.3, turns: 5 }] },
  stalk:         { name: "Stalk",           type: "Spirit", kind: "support",  power: 0,   acc: 1.0,  stamina: 8,  status: [{ id: "stalk", chance: 1, turns: 5, self: true }] },
  duskhowl:      { name: "Dusk Howl",       type: "Spirit", kind: "elemental", power: 65, acc: 0.95, stamina: 12, status: [{ id: "fear", chance: 0.4, turns: 5 }] },
  rundown:       { name: "Run Down",        type: "Normal", kind: "physical", power: 75,  acc: 0.95, stamina: 14, bonusVsSlower: true },
  frenzy:        { name: "Frenzy",          type: "Normal", kind: "support",  power: 0,   acc: 1.0,  stamina: 12, stat: [{ stat: "atk", stages: 2, self: true }], status: [{ id: "berserk", chance: 1, turns: 3, self: true }] },
  moonchase:     { name: "Moon Chase",      type: "Spirit", kind: "physical", power: 95,  acc: 0.9,  stamina: 22, status: [{ id: "bleed", chance: 0.35, turns: 5 }] },
  packleader:    { name: "Pack Leader's Call", type: "Spirit", kind: "support", power: 0, acc: 1.0,  stamina: 15, stat: [{ stat: "atk", stages: 1, self: true }], special: "teamAtk" },
};
for (const [id, m] of Object.entries(MOVES)) m.id = id;
export const FIELDS = {
  overgrown: { name: "Overgrown", icon: "🌿", text: "Plant moves +25%, everyone else 20% slower, Tangle lands more often" },
  hotrocks: { name: "Hot Rocks", icon: "🔥", text: "Fire moves +25%, Burn lands more often, Plant creatures 20% slower" },
};

// What each move does, in a line (for the card and the move buttons)
const STAT_NAME = { atk: "Attack", def: "Defense", ele: "Elemental", res: "Resistance", spd: "Speed" };
const SNAME = { poison: "Poison", fear: "Fear", blind: "Blind", knocked: "Knocked down", festering: "Festering", mute: "Mute", confusion: "Confusion", tangle: "Tangle", leech: "Leech", drowsy: "Drowsy",
  burn: "Burn", bleed: "Bleed", paralysis: "Paralysis", wet: "Wet" };
export function moveEffectText(m) {
  const parts = [];
  for (const s of m.stat || []) parts.push(`${s.self ? "" : "foe's "}${STAT_NAME[s.stat]} ${s.stages > 0 ? "up" : "down"}`);
  for (const s of m.status || []) {
    if (s.id === "toxichide") parts.push("poisons attackers 30% (10 turns)");
    else if (s.id === "awake") parts.push("can't get drowsy (5 turns)");
    else if (s.id === "deepcrown") parts.push("for 3 turns survives a knockout with 1 HP and heals 5% a turn");
    else if (s.id === "drift") parts.push("the next hit on it has a 50% chance to miss");
    else if (s.id === "stalk") parts.push("its next hit is a critical hit");
    else if (s.id === "berserk") parts.push("goes berserk for 3 turns");
    else parts.push(`${Math.round(s.chance * 100)}% ${SNAME[s.id] || s.id}${s.id === "knocked" ? "" : ` (${s.turns} turns)`}`);
  }
  if (m.special === "clearOne") parts.push("clears one of its statuses");
  if (m.heal) parts.push(`heals ${Math.round(m.heal * 100)}%`);
  if (m.field) parts.push(`overgrows the field (${m.field.turns} turns)`);
  if (m.bonusVs) parts.unshift(`×1.5 power if the foe has ${SNAME[m.bonusVs] || m.bonusVs}`);
  if (m.special === "molt") parts.push("clears all its statuses and stat drops");
  if (m.special === "tailDrop") parts.push("once a battle: the dropped tail takes the next hit, and it can flee even if tangled");
  if (m.special === "tailFlip") parts.push("swaps out at once, even if tangled; the next one comes in free");
  if (m.special === "playDead") parts.push("the foe's next attack misses; stamina back; foe's Attack down; a wild foe may wander off");
  if (m.special === "groom") parts.push("clears Leech and Bleed");
  if (m.special === "teamAtk") parts.push("your whole team's Attack up");
  if (m.twoTurn) parts.push("two turns: underground (can't be hit), then erupts");
  if (m.drain) parts.push(`heals ${Math.round(m.drain * 100)}% of the damage it deals`);
  if (m.foeStamina) parts.push(`foe loses ${m.foeStamina} stamina`);
  if (m.bonusVsSlower) parts.push("×1.5 power against a slower foe");
  if (m.selfCost) parts.push(`costs ${Math.round(m.selfCost * 100)}% of its current health`);
  if (m.special === "borrow") parts.push("uses the last elemental move the foe used");
  if (m.special === "dawnChorus") parts.push("wakes and calms your whole team (clears Drowsy and Fear)");
  if (m.hits > 1) parts.unshift(`hits ${m.hits} times`);
  if (m.crit) parts.push(`${Math.round(m.crit * 100)}% critical`);
  if (!parts.length) return "";
  const t = parts.join(", ");
  return t[0].toUpperCase() + t.slice(1);
}
