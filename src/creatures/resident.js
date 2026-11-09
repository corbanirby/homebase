import { newId } from "../engine/ids.js";
import { randomDNA } from "./dna.js";
import { deriveMoves, learnMoveAtLevel } from "../battle/moves.js";
import { XP_PER_LEVEL } from "../config.js";
import { SPECIES, STAGES, lifeStage } from "./species.jsx";

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
export function pickName(taken = []) {
  const free = NAMES.filter(n => !taken.includes(n));
  const pool = free.length ? free : NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function makeResident({ col, row, sex, name, dna = null, species = "ramtarug", clock = 0 }) {
  dna = dna || randomDNA();
  const sp = SPECIES[species];
  return {
    id: newId(), type: "creature", species, name, sex, col, row, dna, moves: deriveMoves(dna, sp.types),
    bornAt: clock, age: 0, maxAge: sp.lifespanDays * DAY * dna.lifespan, stageId: "baby",
    fullness: 0.85 + Math.random() * 0.15, hp: 1, habitat: 1, level: 1, xp: 0,
    dcol: 0, drow: 0, wanderTimer: 0, state: "wander", targetId: null, biteTimer: 0, petAt: 0,
  };
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
  return { stage: STAGES[i + 1], ms: Math.max(0, STAGES[i].until * c.maxAge - c.age) };
}

// A wild creature in the shared world: genes leaning the way its species does,
// a level that rises the farther you go from your door, and any age.
export function makeWild(species, col, row, level = 1, youngOnly = false) {
  const sp = SPECIES[species];
  const dna = randomDNA();
  if (sp.temper) dna.aggression = sp.temper[0] + Math.random() * (sp.temper[1] - sp.temper[0]);
  const c = makeResident({ col, row, species, dna, sex: Math.random() < 0.5 ? "F" : "M", name: null });
  c.age = c.maxAge * (youngOnly ? 0.02 + Math.random() * 0.24 : 0.02 + Math.random() * 0.9);
  c.stageId = lifeStage(c).id;
  c.level = level; c.wild = true;
  c.fullness = 0.7 + Math.random() * 0.3;
  return c;
}

// Bring a creature up to a level, with the experience and moves it would have picked up on the way
export const STARTER_LEVEL = 5;
export function raiseToLevel(c, level) {
  if ((c.level || 1) >= level) return c;
  let moves = c.moves || [];
  for (let l = (c.level || 1) + 1; l <= level; l++) {
    const m = learnMoveAtLevel(c.dna, l, moves);
    if (m) moves = moves.length < 4 ? [...moves, m] : [moves[0], ...moves.slice(2), m];
  }
  const need = Math.floor(XP_PER_LEVEL * (c.dna.xpRate ?? 1));
  return { ...c, level, xp: Math.max(c.xp || 0, (level - 1) * need), moves };
}
