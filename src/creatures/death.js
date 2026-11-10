import { newId } from "../engine/ids.js";
import { SPECIES, lifeStage } from "./species.jsx";
import { HOUR, DAY, conditionOf } from "./resident.js";
import { PLANT_SPECIES } from "../plants/plants.js";

// ─── Death ────────────────────────────────────────────────────────────────────
// Creatures die of old age or hunger, never in battle (fainting comes later).
//  - Old age: from 95% of its lifespan the chance rises, so most die around 100%
//    and none live past 112%. Good condition slows it; poor condition speeds it.
//  - Hunger: once its stomach is empty, health drains, and it dies after its
//    species' time on empty (a day for Ramtarug) unless it eats.
export const REMAINS_MS = 2 * DAY;
export const OLD_AGE_FROM = 0.95, OLD_AGE_LAST = 1.12;
export const fastMs = c => (SPECIES[c.species]?.fastHours ?? 24) * HOUR;
export const inLastDays = c => !c.isEgg && c.age / c.maxAge >= OLD_AGE_FROM;

// `hungerCounted`: the caller already added time on empty to c.starving (carried creatures)
export function stepMortality(creatures, ms, { hungerCounted = false } = {}) {
  const alive = [], died = [];
  for (const c0 of creatures) {
    if (c0.isEgg || c0.wild) { alive.push(c0); continue; }
    const c = { ...c0 };
    if (!hungerCounted) c.starving = c.fullness <= 0.001 ? (c.starving || 0) + ms : 0;
    if (c.starving > 0) c.hp = Math.min(c.hp, Math.max(0.02, 1 - c.starving / fastMs(c)));
    if (c.starving >= fastMs(c)) { died.push({ c, cause: "hunger" }); continue; }
    const x = c.age / c.maxAge;
    if (x >= OLD_AGE_FROM) {
      if (c.fate == null) c.fate = -Math.log(Math.random() || 1e-9);
      // Rises from nothing at 95%; tuned so half are gone by 100% in average condition
      const ramp = (x - OLD_AGE_FROM) / (1 - OLD_AGE_FROM);
      const rate = Math.LN2 / (0.025 * c.maxAge) * ramp * (1.6 - conditionOf(c));
      c.wear = (c.wear || 0) + rate * ms;
      if (c.wear >= c.fate || x >= OLD_AGE_LAST) { died.push({ c, cause: "old age" }); continue; }
    }
    alive.push(c);
  }
  return { alive, died };
}

const sizeOf = c => {
  const s = (SPECIES[c.species]?.sizeMul || 1) * (c.dna.size || 1) * lifeStage(c).scale;
  return s < 0.7 ? "small" : s < 1.05 ? "medium" : "large";
};
export const causeText = cause => cause === "hunger" ? "hunger" : cause === "released" ? "released" : "old age";

// Take the dead out of the living: remember them, leave remains (at home), free their mates,
// and take them off the vine, out of the bag and out of your arms.
export function applyDeaths(state, died, clock, { leaveRemains = true } = {}) {
  if (!died.length) return { state, lines: [] };
  const ids = new Set(died.map(d => d.c.id));
  const all = [...state.creatures, ...(state.remembered || [])];
  const remembered = [...(state.remembered || [])], remains = [...(state.remains || [])], lines = [];
  for (const { c, cause } of died) {
    const descendants = countDescendants(c.id, all);
    remembered.push({
      id: c.id, name: c.name, species: c.species, sex: c.sex, generation: c.generation || 1,
      motherId: c.motherId ?? null, fatherId: c.fatherId ?? null, mateId: c.mateId ?? null,
      dna: c.dna, level: c.level || 1, age: c.age, maxAge: c.maxAge, stageId: lifeStage(c).id,
      livedMs: c.age, cause, diedAt: clock, dead: cause !== "released", released: cause === "released",
    });
    if (leaveRemains && cause !== "released") remains.push({ id: newId(), col: c.col, row: c.row, species: c.species, name: c.name, size: sizeOf(c), diedAt: clock, energy: 3 });
    const days = Math.max(1, Math.round(c.age / DAY));
    if (cause === "released") { lines.push(`${c.name} was released into the wild`); continue; }
    lines.push(`${c.name} died of ${causeText(cause)} at ${days} ${days === 1 ? "day" : "days"} old${descendants ? `, leaving ${descendants} ${descendants === 1 ? "descendant" : "descendants"}` : ""}`);
  }
  const creatures = state.creatures.filter(c => !ids.has(c.id)).map(c => ids.has(c.mateId) ? { ...c, mateId: null, court: 0 } : c);
  const trip = state.trip ? { ...state.trip, bag: (state.trip.bag || []).filter(id => !ids.has(id)) } : state.trip;
  return {
    // Its pod goes back to being an empty seed you can give to another creature
    state: { ...state, creatures, remembered, remains, trip,
      pods: (state.pods || []).map(p => ids.has(p.creatureId) ? { ...p, creatureId: null, food: 0 } : p),
      vine: (state.vine || []).filter(id => !ids.has(id)), pack: (state.pack || []).filter(id => !ids.has(id)),
      holding: ids.has(state.holding) ? null : state.holding },
    lines,
  };
}
export function countDescendants(id, all) {
  const seen = new Set(), stack = [id];
  while (stack.length) {
    const p = stack.pop();
    for (const c of all) if (!c.isEgg && (c.motherId === p || c.fatherId === p) && !seen.has(c.id)) { seen.add(c.id); stack.push(c.id); }
  }
  return seen.size;
}

// ─── Remains ──────────────────────────────────────────────────────────────────
// They lie for about two days. Plants within two patches grow and regrow faster,
// and when the remains are gone the ground beneath is left richer. Scavengers eat them.
export function stepRemains(remains, plants, land, ms, clock) {
  if (!remains?.length) return { remains: remains || [], plants };
  const keep = [];
  for (const r of remains) {
    if (clock - r.diedAt < REMAINS_MS && r.energy > 0.06) { keep.push(r); continue; }
    const cell = land?.cells[Math.floor(r.row)]?.[Math.floor(r.col)];
    if (cell && !cell.water && (cell.soil === "poor" || cell.soil === "sandy")) cell.soil = "rich";
  }
  const near = p => keep.some(r => Math.hypot(r.col - p.col, r.row - p.row) <= 2.2);
  const fed = plants.map(p => {
    if (p.dead || !near(p)) return p;
    const sp = PLANT_SPECIES[p.species]; if (!sp) return p;
    if (p.stage < 3) return { ...p, growth: p.growth + ms / (sp.stageHours[p.stage] * HOUR) * 0.5 };
    return { ...p, energy: Math.min(1, p.energy + ms / (sp.regrowHours * HOUR)) };
  });
  return { remains: keep, plants: fed };
}
