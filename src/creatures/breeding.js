import { newId } from "../engine/ids.js";
import { randomDNA } from "./dna.js";
import { SPECIES, lifeStage } from "./species.jsx";
import { HOUR, DAY, habitatFit, conditionOf, pickName } from "./resident.js";
import { deriveMoves } from "../battle/moves.js";

// ─── Genes in two copies ──────────────────────────────────────────────────────
// Every gene comes in two copies, one from each parent. At birth one copy is
// picked at random to show; the other stays hidden but can be passed on, so a
// hidden copy can come back in a grandchild. Each copy passed on has a small
// chance to mutate a little.
export const GENE_KEYS = ["hue", "saturation", "size", "speed", "lifespan", "fertility", "strength", "aggression", "metabolism", "reproRate", "xpRate", "hpRange"];
const MUTATE_CHANCE = 0.05;
function mutate(key, v) {
  if (Math.random() >= MUTATE_CHANCE) return v;
  if (key === "hue") return (v + (Math.random() - 0.5) * 40 + 360) % 360;
  if (key === "saturation") return Math.max(30, Math.min(100, v + (Math.random() - 0.5) * 20));
  return Math.max(0.05, v * (1 + (Math.random() - 0.5) * 0.2));
}
// Two copies for a creature that has only its shown genes (older saves, wild ones): the hidden copy is a random draw
export function genomeFrom(dna, hidden = randomDNA()) {
  const genome = {}, shown = {};
  for (const k of GENE_KEYS) { genome[k] = [dna[k] ?? hidden[k], hidden[k]]; shown[k] = 0; }
  return { genome, shown };
}
export function ensureGenome(c) {
  if (c.genome || c.isEgg) return c;
  const { genome, shown } = genomeFrom(c.dna);
  return { ...c, genome, shown };
}
// What a child gets: one copy from each parent, either of the parent's two
function childGenome(mom, dad) {
  const g = {};
  for (const k of GENE_KEYS) {
    const m = mom.genome?.[k] || [mom.dna[k], mom.dna[k]], d = dad.genome?.[k] || [dad.dna[k], dad.dna[k]];
    g[k] = [mutate(k, m[Math.random() < 0.5 ? 0 : 1]), mutate(k, d[Math.random() < 0.5 ? 0 : 1])];
  }
  return g;
}

// ─── Breeding timings by species ──────────────────────────────────────────────
// Ramtarug (28-day life): courts for about 3 hours, lays half a day later, 2–4
// eggs, eggs hatch in about 2 days, then rests about 4 days. Other species scale
// with their lifespan unless they set their own.
export function breedParams(speciesId) {
  const sp = SPECIES[speciesId] || SPECIES.ramtarug, k = (sp.lifespanDays || 28) / 28;
  return {
    courtMs: 3 * HOUR, layDelayMs: 12 * HOUR * k,
    incubationMs: (sp.incubationDays ?? 2 * k) * DAY,
    restMs: (sp.restDays ?? 4 * k) * DAY,
    clutch: sp.clutch || [2, 4],
  };
}
export const isAdult = c => lifeStage(c).id === "adult";
// Why a creature can or can't breed right now (shown on its card)
export function breedStatus(c, all, clock) {
  if (c.isEgg) return null;
  if (c.noBreed) return "Not breeding (switched off)";
  const st = lifeStage(c).id;
  if (st === "baby" || st === "adolescent") return "Too young to breed";
  if (st === "elder") return "Too old to breed";
  if (conditionOf(c) < 0.65) return "Needs Good condition to breed";
  if (c.sex === "F" && c.layAt) return "Will lay eggs soon";
  if (c.sex === "F" && c.lastClutch != null && clock - c.lastClutch < breedParams(c.species).restMs)
    return "Resting after laying";
  const mate = c.mateId != null ? all.find(o => o.id === c.mateId) : null;
  if (!mate) return "Ready to breed, no mate yet";
  return "Ready to breed with " + mate.name;
}
function canBreed(c, clock) {
  if (c.isEgg || c.wild || c.noBreed || !isAdult(c) || conditionOf(c) < 0.65) return false;
  if (c.sex === "F" && (c.layAt || (c.lastClutch != null && clock - c.lastClutch < breedParams(c.species).restMs))) return false;
  return true;
}

// A plain egg: every species' egg looks the same
function makeEgg(mom, dad, col, row, clock) {
  const pick = c => (c.moves || [])[Math.floor(Math.random() * (c.moves || []).length)];
  const moves = [];
  for (const m of [pick(mom), pick(dad)]) if (m && !moves.some(x => x.id === m.id)) moves.push(m);
  return {
    id: newId(), type: "creature", isEgg: true, species: mom.species, motherId: mom.id, fatherId: dad.id,
    laidBy: mom.name, laidAt: clock, known: true, genome: childGenome(mom, dad), eggMoves: moves,
    generation: Math.max(mom.generation || 1, dad.generation || 1) + 1,
    incubation: 0, col, row, dna: mom.dna, name: null, hp: 1, fullness: 1, age: 0, maxAge: 1, level: 1,
    dcol: 0, drow: 0,
  };
}
// The egg hatches: one copy of each gene is picked to show, and the baby gets a name
export function hatchEgg(egg, names = []) {
  const sp = SPECIES[egg.species] || SPECIES.ramtarug;
  const shown = {}, dna = {};
  for (const k of GENE_KEYS) { shown[k] = Math.random() < 0.5 ? 0 : 1; dna[k] = egg.genome[k][shown[k]]; }
  const moves = egg.eggMoves?.length ? egg.eggMoves : deriveMoves(dna, sp.types);
  return {
    id: egg.id, type: "creature", species: egg.species, name: pickName(names), sex: Math.random() < 0.5 ? "F" : "M",
    col: egg.col, row: egg.row, dna, genome: egg.genome, shown, moves,
    motherId: egg.motherId, fatherId: egg.fatherId, generation: egg.generation, bornAt: null,
    age: 0, maxAge: sp.lifespanDays * DAY * dna.lifespan, stageId: "baby",
    fullness: 0.7, hp: 1, habitat: 1, level: 1, xp: 0,
    dcol: 0, drow: 0, wanderTimer: 0, state: "wander", targetId: null, biteTimer: 0, petAt: 0,
  };
}
// How well the ground suits an egg: 1 develops normally, lower is slower, 0 doesn't develop
export function eggClimate(egg, cell) {
  const f = habitatFit(egg, cell);
  return f >= 0.45 ? 1 : f >= 0.25 ? 0.4 : 0;
}
// Carried eggs keep developing
export function incubateCarried(egg, ms) {
  return { ...egg, incubation: Math.min(1, egg.incubation + ms / breedParams(egg.species).incubationMs) };
}

// ─── One breeding step at home ────────────────────────────────────────────────
// Pairs form (yours or their own choice), court when close, lay a clutch in a
// spot that suits the species, and eggs incubate and hatch. `away` skips the
// need to be close (for time worked through while you were gone).
export function stepBreeding(creatures, land, ms, clock, { away = false, nest = null } = {}) {
  const events = [];
  let list = creatures.map(c => ({ ...c }));
  const byId = new Map(list.map(c => [c.id, c]));
  const near = (a, b) => away || Math.hypot(a.col - b.col, a.row - b.row) < 3.5;
  // Unpaired adults find a partner of their own species
  for (const f of list) {
    if (f.sex !== "F" || f.mateId != null || !canBreed(f, clock)) continue;
    const m = list.filter(o => o.sex === "M" && o.species === f.species && o.mateId == null && canBreed(o, clock) && (away || Math.hypot(o.col - f.col, o.row - f.row) < 5))
      .sort((a, b) => Math.hypot(a.col - f.col, a.row - f.row) - Math.hypot(b.col - f.col, b.row - f.row))[0];
    if (m) { f.mateId = m.id; m.mateId = f.id; f.bondedBy = m.bondedBy = "self"; events.push({ type: "paired", a: f.name, b: m.name }); }
  }
  for (const f of list) {
    if (f.isEgg || f.sex !== "F") continue;
    const m = f.mateId != null ? byId.get(f.mateId) : null;
    // Courting: both ready and close together
    if (!f.layAt && m && m.mateId === f.id && canBreed(f, clock) && canBreed(m, clock) && near(f, m)) {
      f.court = (f.court || 0) + ms;
      if (f.court >= breedParams(f.species).courtMs) { f.court = 0; f.layAt = clock + breedParams(f.species).layDelayMs; f.layFather = m.id; }
    }
    // Laying: a clutch on the nearest ground that suits the species
    if (f.layAt && clock >= f.layAt) {
      const dad = byId.get(f.layFather) || m; f.layAt = null;
      if (!dad) continue;
      const p = breedParams(f.species), fert = Math.max(0, Math.min(1, ((f.dna.fertility ?? 0.7) - 0.4) / 0.6));
      const n = Math.max(1, Math.round(p.clutch[0] + (p.clutch[1] - p.clutch[0]) * fert + (Math.random() - 0.5)));
      const spot = nest ? nest(f) : { col: f.col, row: f.row };
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        list.push(makeEgg(f, dad, spot.col + Math.cos(a) * 0.35, spot.row + Math.sin(a) * 0.25, clock));
      }
      f.lastClutch = clock;
      f.children = (f.children || 0) + n; dad.children = (dad.children || 0) + n;
      events.push({ type: "laid", mother: f.name, n, col: spot.col, row: spot.row });
    }
  }
  // Eggs incubate on suitable ground, and hatch
  const names = list.filter(c => !c.isEgg).map(c => c.name);
  list = list.map(e => {
    if (!e.isEgg) return e;
    const cell = land?.cells[Math.floor(e.row)]?.[Math.floor(e.col)];
    const k = eggClimate(e, cell);
    const inc = Math.min(1, e.incubation + (ms / breedParams(e.species).incubationMs) * k);
    if (inc >= 1) { const baby = hatchEgg({ ...e, incubation: 1 }, names); names.push(baby.name); events.push({ type: "hatched", name: baby.name, col: e.col, row: e.row, species: e.species }); return baby; }
    return { ...e, incubation: inc };
  });
  return { creatures: list, events };
}

// Where a mother lays: the nearest open patch that suits her species, sheltered cover first
export function nestFinder(land) {
  return f => {
    if (!land) return { col: f.col, row: f.row };
    let best = null, bs = -1;
    const c0 = Math.floor(f.col), r0 = Math.floor(f.row);
    for (let r = r0 - 4; r <= r0 + 4; r++) for (let c = c0 - 4; c <= c0 + 4; c++) {
      const cell = land.cells[r]?.[c];
      if (!cell || cell.water || cell.edge || cell.mother || cell.veg >= 3) continue;
      const fit = habitatFit(f, cell); if (fit < 0.45) continue;
      const score = fit + (cell.veg === 2 ? 0.3 : 0) - Math.hypot(c + 0.5 - f.col, r + 0.5 - f.row) * 0.05;
      if (score > bs) { bs = score; best = { col: c + 0.5, row: r + 0.5 }; }
    }
    return best || { col: f.col, row: f.row };
  };
}
