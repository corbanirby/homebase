import { newId } from "../engine/ids.js";
import { randomDNA } from "./dna.js";
import { deriveMoves, levelUpMoves, initLearnset, hasLearnset } from "../battle/moves.js";
import { ensureParts } from "./parts.js";
import { SPECIES, STAGES, lifeStage, stageEnds } from "./species.jsx";

// ─── Creatures that live in your homebase ─────────────────────────────────────
// Everything here runs on real time: age, hunger and health are in milliseconds
// of world time (the ?speed=N test setting scales them).
export const HOUR = 60 * 60 * 1000, DAY = 24 * HOUR;
export const STARVE_MS = 48 * HOUR;   // full to empty, for average metabolism
export const HUNGRY_AT = 0.6;         // below this it goes looking for food
export const WEAK_AT = 0.15;          // below this it's too weak to do much
export const VINE_MAX = 6;

const NAMES = ["Pip","Moss","Bramble","Fen","Tansy","Reed","Bo","Nettle","Wren","Juniper","Sorrel","Clover",
  "Burdock","Teasel","Puck","Marlo","Quill","Hazel","Tumble","Rook","Sedge","Fig","Pebble","Willow",
  "Thistle","Mallow","Kip","Rune","Ember","Lark","Bryn","Oaky","Dune","Cress","Sprig","Tuck"];
// Names are unique among your creatures. A baby is sometimes named after a parent (Pip II, Pip III…);
// when every name is taken, numbered names carry on.
const ROMAN = ["", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export const baseName = n => (n || "").replace(/ [IVX]+$/, "");
function numbered(base, taken, from = 1) {
  for (let i = from; i < ROMAN.length; i++) { const n = i ? base + " " + ROMAN[i] : base; if (!taken.includes(n)) return n; }
  return base + " " + (taken.length + 2);
}
export const AFTER_PARENT = 0.2;
export function pickName(taken = [], parentNames = []) {
  const ps = parentNames.filter(Boolean);
  if (ps.length && Math.random() < AFTER_PARENT) return numbered(baseName(ps[Math.floor(Math.random() * ps.length)]), taken);
  const free = NAMES.filter(n => !taken.includes(n));
  if (free.length) return free[Math.floor(Math.random() * free.length)];
  return numbered(NAMES[Math.floor(Math.random() * NAMES.length)], taken);
}
// Older saves can have two with one name: the later ones get a number
export function uniqueNames(creatures) {
  const taken = []; let changed = false;
  const out = creatures.map(c => {
    if (c.isEgg || !c.name) return c;
    if (!taken.includes(c.name)) { taken.push(c.name); return c; }
    changed = true; const name = numbered(baseName(c.name), [...taken, ...creatures.map(o => o.name)]); taken.push(name); return { ...c, name };
  });
  return changed ? out : creatures;
}

export function makeResident({ col, row, sex, name, dna = null, species = "ramtarug", clock = 0 }) {
  dna = dna || randomDNA();
  const sp = SPECIES[species];
  // Two copies of every gene: the one that shows, and a hidden one it can pass on
  const hidden = randomDNA(), genome = {}, shown = {};
  for (const k of Object.keys(dna)) { genome[k] = [dna[k], hidden[k] ?? dna[k]]; shown[k] = 0; }
  const c = {
    id: newId(), type: "creature", species, name, sex, col, row, dna, genome, shown, generation: 1, moves: deriveMoves(dna, sp.types),
    bornAt: clock, age: 0, maxAge: sp.lifespanDays * DAY * dna.lifespan, stageId: "baby",
    fullness: 0.85 + Math.random() * 0.15, hp: 1, habitat: 1, level: 1, xp: 0,
    dcol: 0, drow: 0, wanderTimer: 0, state: "wander", targetId: null, biteTimer: 0, petAt: 0,
  };
  return ensureParts(hasLearnset(c) ? initLearnset(c) : c);
}

// How well the patch it's on suits it, 0 to 1
export function habitatFit(c, cell) {
  if (!cell) return 0.5;
  const [lo, ideal, hi] = (SPECIES[c.species] || SPECIES.ramtarug).habitat.wet;
  const w = cell.wet;
  if (w <= lo) return Math.max(0, 0.3 - (lo - w) * 2);
  if (w >= hi) return Math.max(0, 0.3 - (w - hi) * 2);
  return w <= ideal ? 0.3 + 0.7 * (w - lo) / (ideal - lo) : 0.3 + 0.7 * (hi - w) / (hi - ideal);
}
export function habitatWord(c, cell) {
  const f = habitatFit(c, cell);
  if (f >= 0.75) return "Loves it here";
  if (f >= 0.45) return "Comfortable";
  const [, ideal] = (SPECIES[c.species] || SPECIES.ramtarug).habitat.wet;
  return cell && cell.wet < ideal ? "Too dry here" : "Too wet here";
}

// Condition: how it's doing overall, from fullness, health and how well its spot suits it
export function conditionOf(c) {
  const food = Math.min(1, (c.fullness ?? 1) / HUNGRY_AT);
  return Math.max(0, Math.min(1, food * 0.5 + (c.hp ?? 1) * 0.2 + (c.habitat ?? 1) * 0.3));
}
export function conditionWord(c) {
  if ((c.fullness ?? 1) < WEAK_AT) return "Weak from hunger";
  const v = conditionOf(c);
  return v >= 0.85 ? "Thriving" : v >= 0.65 ? "Good" : v >= 0.45 ? "Fair" : "Poor";
}
export function fullnessWord(f) {
  return f >= 0.85 ? "Full" : f >= HUNGRY_AT ? "Fed" : f >= WEAK_AT ? "Hungry" : "Starving";
}

// Time until the next life stage, or null for elders
export function nextStageIn(c) {
  const i = STAGES.indexOf(lifeStage(c));
  if (i >= STAGES.length - 1) return null;
  // Skip a stage a species doesn't have (Thrummet goes straight from nymph to adult)
  const ends = stageEnds(c); let j = i + 1;
  while (j < 3 && ends[j] <= ends[j - 1]) j++;
  return { stage: STAGES[j], ms: Math.max(0, ends[i] * c.maxAge - c.age) };
}

// A wild creature in the shared world: genes leaning the way its species does,
// a level that rises the farther you go from your door, and any age.
export function makeWild(species, col, row, level = 1, youngOnly = false) {
  const sp = SPECIES[species];
  const dna = randomDNA();
  if (sp.temper) dna.aggression = sp.temper[0] + Math.random() * (sp.temper[1] - sp.temper[0]);
  const c = makeResident({ col, row, species, dna, sex: Math.random() < 0.5 ? "F" : "M", name: null });
  if (sp.temper) c.genome.aggression[1] = sp.temper[0] + Math.random() * (sp.temper[1] - sp.temper[0]);
  c.age = c.maxAge * (youngOnly ? 0.02 + Math.random() * 0.24 : 0.02 + Math.random() * 0.9);
  c.stageId = lifeStage(c).id;
  c.level = typeof level === "function" ? level(c) : level; c.wild = true;
  c.fullness = 0.7 + Math.random() * 0.3;
  // Species with a move list know what a creature of its level and age would have learned
  return ensureParts(hasLearnset(c) ? initLearnset(c) : c);
}

// Bring a creature up to a level, with the experience and moves it would have picked up on the way
export const STARTER_LEVEL = 5;
export function raiseToLevel(c, level) {
  if ((c.level || 1) >= level) return c;
  if (hasLearnset(c)) return initLearnset({ ...c, level, xp: 0, levelV: 2 });
  const up = levelUpMoves(c, level);
  return { ...c, level, xp: 0, levelV: 2, moves: up.moves };
}
