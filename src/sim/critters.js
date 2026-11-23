// ─── Critters (Behavior stage, part 2; decided Nov 23) ───────────────────────
// Small animals that live as colonies on each homebase tile, like plants: they grow
// toward a cap set by the ground, spread to neighbouring tiles that suit them, and
// surface now and then so you can see them. Insect-eaters eat them. A colony eaten
// to zero is gone unless critters spread in from a neighbour; gone from the whole
// homebase means bringing more from the world in your critter jar.
// Colonies are stored per tile: state.critters = { "c,r": { worm: 12, snail: 3 } }.
import { COLS, ROWS } from "../config.js";
import { newId } from "../engine/ids.js";
import { SOILS } from "../world/land.js";

const H = 60 * 60 * 1000, DAY = 24 * H;
export const CRITTER_CAP = 20;     // most of one kind a tile can hold
export const PER_CRITTER = 0.05;   // fullness one critter gives (10 make a meal)
export const JAR_MAX = 10;

const bell = (x, lo, mid, hi) => x <= lo || x >= hi ? 0 : x < mid ? (x - lo) / (mid - lo) : (hi - x) / (hi - mid);
const fert = cell => SOILS[cell.soil]?.fert ?? 0.3;

// What each kind needs, how fast it breeds (per day, when there's room), and what it does
export const CRITTERS = {
  worm:    { name: "Earthworm",   plural: "earthworms",  icon: "🪱", color: "#c77d7d", rate: 0.8, decay: true,
             fit: c => Math.min(1, fert(c) * 1.1) * bell(c.wet, 0.25, 0.6, 0.95) },
  beetle:  { name: "Leaf beetle", plural: "leaf beetles", icon: "🪲", color: "#3d5a3a", rate: 1.0, decay: true,
             fit: c => ([0.1, 0.25, 0.6, 1][c.veg] ?? 0) * bell(c.wet, 0.1, 0.45, 0.85) },
  snail:   { name: "Snail",       plural: "snails",      icon: "🐌", color: "#b89a6a", rate: 0.8, pest: 0.002,
             fit: c => bell(c.wet, 0.42, 0.75, 1.01) * (c.veg >= 3 || c.wet >= 0.72 ? 1 : c.veg === 2 ? 0.7 : 0.4) },
  cricket: { name: "Cricket",     plural: "crickets",    icon: "🦗", color: "#7a6a3a", rate: 1.2, pest: 0.001,
             fit: c => ([0.1, 1, 1, 0.3][c.veg] ?? 0) * bell(c.wet, 0.08, 0.35, 0.68) * (c.temp >= 0.3 ? 1 : 0.3) },
  grub:    { name: "Grub",        plural: "grubs",       icon: "🐛", color: "#e8dcc0", rate: 0.6, stunt: 0.001,
             fit: c => ([0.1, 1, 0.8, 0.3][c.veg] ?? 0) * (c.soil === "rocky" ? 0 : 1) * bell(c.wet, 0.2, 0.5, 0.78) },
  ant:     { name: "Ant",         plural: "ants",        icon: "🐜", color: "#5a2a1a", rate: 1.2, bites: true,
             fit: c => bell(c.wet, -0.01, 0.2, 0.5) * ({ sandy: 1, poor: 0.8, mineral: 0.7, rocky: 0.6, rich: 0.4 }[c.soil] ?? 0.5) * (c.veg <= 1 ? 1 : 0.4) },
};
export const CRITTER_KINDS = Object.keys(CRITTERS);
export const critterName = (k, n = 1) => n === 1 ? CRITTERS[k]?.name.toLowerCase() : CRITTERS[k]?.plural;
const usable = cell => cell && !cell.water && !cell.edge && !cell.mother;
export const critterFit = (k, cell) => usable(cell) ? Math.max(0, Math.min(1, CRITTERS[k].fit(cell))) : 0;
export const keyOf = (c, r) => c + "," + r;

// How much room a tile has for a kind: its fit, and for decay-eaters the dead leaves and
// remains there, for plant pests the plants there
function capFor(k, cell, decay, plantsHere) {
  const d = CRITTERS[k];
  let cap = CRITTER_CAP * critterFit(k, cell);
  if (d.decay) cap *= 0.4 + 0.6 * Math.min(1, decay);
  if (d.pest || d.stunt) cap *= 0.4 + 0.6 * Math.min(1, plantsHere / 2 + (cell.veg >= 2 ? 0.5 : 0));
  return cap;
}

// A new homebase (or an older save) starts with a thin natural set: a few colonies of
// earthworms, crickets and snails on ground that suits them. Leaf beetles, grubs and ants
// (and anything that dies out) you bring from the world in your critter jar.
export const NATIVE_CRITTERS = ["worm", "cricket", "snail"];
export function seedCritters(land, rnd = Math.random) {
  const out = {};
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = land.cells[r]?.[c]; if (!usable(cell)) continue;
    for (const k of NATIVE_CRITTERS) {
      const f = critterFit(k, cell);
      if (f > 0.5 && rnd() < 0.08) (out[keyOf(c, r)] ||= {})[k] = Math.round(CRITTER_CAP * f * 0.4);
    }
  }
  return out;
}

// Time passes: colonies breed toward their cap, crowded ones spread, pests eat plants,
// worms help them grow. Works in slices of up to an hour. Returns colonies and plants.
export function growCritters(colonies, land, plants, remains, ms) {
  if (!colonies || ms <= 0) return { colonies: colonies || {}, plants };
  if (ms > H) {
    let left = ms, col = colonies, pl = plants;
    while (left > 0) { const r = growCritters(col, land, pl, remains, Math.min(H, left)); col = r.colonies; pl = r.plants; left -= H; }
    return { colonies: col, plants: pl };
  }
  const days = ms / DAY;
  const byTile = new Map();
  for (const p of plants) if (!p.dead) { const k = keyOf(Math.floor(p.col), Math.floor(p.row)); (byTile.get(k) || byTile.set(k, []).get(k)).push(p); }
  const remainsNear = new Set();
  for (const rm of remains || []) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) remainsNear.add(keyOf(Math.floor(rm.col) + dc, Math.floor(rm.row) + dr));
  const next = {}, moves = [];
  const plantChange = new Map(); // plant id -> energy change
  for (const [key, col] of Object.entries(colonies)) {
    const [c, r] = key.split(",").map(Number), cell = land.cells[r]?.[c];
    if (!usable(cell)) continue;
    const here = byTile.get(key) || [];
    const decay = ([0.15, 0.35, 0.6, 1][cell.veg] ?? 0.3) + (remainsNear.has(key) ? 0.6 : 0);
    const out = {};
    for (const [k, n0] of Object.entries(col)) {
      if (!CRITTERS[k] || n0 <= 0) continue;
      const cap = capFor(k, cell, decay, here.length);
      // Logistic growth (or dying back if the tile can't hold this many any more)
      let n = cap > 0.5 ? n0 + CRITTERS[k].rate * days * n0 * (1 - n0 / cap) : n0 - n0 * days;
      n = Math.max(0, Math.min(CRITTER_CAP, n));
      if (n < 0.5) continue;                  // died out here
      out[k] = n;
      // Crowded: some move to a neighbouring tile that suits them
      if (n > cap * 0.6 && Math.random() < days * 2) {
        const [dc, dr] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
        const nc = c + dc, nr = r + dr, ncell = land.cells[nr]?.[nc];
        if (critterFit(k, ncell) > 0.2) { const m = Math.min(3, n * 0.15); out[k] -= m; moves.push([keyOf(nc, nr), k, m]); }
      }
      // What they do to the plants on their tile
      const d = CRITTERS[k];
      for (const p of here) {
        let e = 0;
        if (d.pest) e -= d.pest * n * (ms / H);                       // snails and crickets eat it
        if (d.stunt && p.stage < 3) e -= d.stunt * n * (ms / H);      // grubs eat roots of growing plants
        if (k === "worm") e += 0.0004 * n * (ms / H);                 // worms help it grow
        if (e) plantChange.set(p.id, (plantChange.get(p.id) || 0) + e);
      }
    }
    if (Object.keys(out).length) next[key] = out;
  }
  for (const [key, k, m] of moves) { const t = (next[key] ||= {}); t[k] = Math.min(CRITTER_CAP, (t[k] || 0) + m); }
  const newPlants = plantChange.size ? plants.map(p => {
    const e = plantChange.get(p.id); if (!e) return p;
    return { ...p, energy: Math.max(0, Math.min(1, (p.energy ?? 0) + e)) };
  }) : plants;
  return { colonies: next, plants: newPlants };
}

// Eat a meal from a tile's colonies: up to what fills it (10 critters = a meal).
// Takes from the kinds it eats, the most plentiful first.
export function eatCritters(colonies, key, kinds, fullness, cap = 0.98) {
  const col = colonies[key]; if (!col) return { colonies, gained: 0, eaten: 0 };
  let want = Math.floor((cap - fullness) / PER_CRITTER), eaten = 0;
  const left = { ...col };
  for (const k of kinds.filter(k => (left[k] || 0) >= 1).sort((a, b) => left[b] - left[a])) {
    const take = Math.min(want, Math.floor(left[k])); left[k] -= take; want -= take; eaten += take;
    if (left[k] < 0.5) delete left[k];
    if (want <= 0) break;
  }
  const next = { ...colonies };
  if (Object.keys(left).length) next[key] = left; else delete next[key];
  return { colonies: next, gained: eaten * PER_CRITTER, eaten };
}
// How many of these kinds a tile has
export const countOn = (colonies, key, kinds) => kinds.reduce((t, k) => t + (colonies?.[key]?.[k] || 0), 0);

// Surfacing: a few at a time come up where colonies are, wander a little, and go back down.
// Each lives about 10–20 seconds. `rate` is the chance per critter per second.
export const SURFACE_MAX = 10;
export function surfaceStep(colonies, surfaced, clock, dtMs) {
  let list = (surfaced || []).filter(s => s.until > clock).map(s => ({ ...s, col: s.col + s.dx * dtMs / 1000, row: s.row + s.dy * dtMs / 1000 }));
  if (list.length < SURFACE_MAX) {
    const secs = dtMs / 1000;
    for (const [key, col] of Object.entries(colonies || {})) {
      for (const [k, n] of Object.entries(col)) {
        if (Math.random() < n * 0.0006 * secs && list.length < SURFACE_MAX) {
          const [c, r] = key.split(",").map(Number), a = Math.random() * Math.PI * 2, sp = 0.05 + Math.random() * 0.1;
          list.push({ id: newId(), kind: k, col: c + 0.2 + Math.random() * 0.6, row: r + 0.3 + Math.random() * 0.6, dx: Math.cos(a) * sp, dy: Math.sin(a) * sp * 0.5, tile: key, until: clock + (10 + Math.random() * 10) * 1000 });
        }
      }
    }
  }
  return list;
}

// ─── Out in Atlanta: which critters turn up on each land type ────────────────
export const ATL_CRITTERS = {
  forest: ["beetle", "worm", "snail"], meadow: ["cricket", "grub", "ant"], kudzu: ["beetle", "snail", "cricket"],
  clay: ["ant", "cricket"], pine: ["ant", "beetle"], granite: ["ant"], creek: ["snail", "worm"],
  shoal: ["snail"], river: ["snail"],
};
// Now and then one surfaces near you on suitable land (no colonies tracked out there)
export function surfaceOutside(surfaced, player, biomeAt, clock, dtMs) {
  let list = (surfaced || []).filter(s => s.until > clock).map(s => ({ ...s, col: s.col + s.dx * dtMs / 1000, row: s.row + s.dy * dtMs / 1000 }));
  if (list.length < 6 && Math.random() < 0.3 * dtMs / 1000) {
    const a = Math.random() * Math.PI * 2, d = 2 + Math.random() * 5;
    const col = player.col + Math.cos(a) * d, row = player.row + Math.sin(a) * d * 0.7;
    const kinds = ATL_CRITTERS[biomeAt(Math.floor(col), Math.floor(row))];
    if (kinds) {
      const k = kinds[Math.floor(Math.random() * kinds.length)], b = Math.random() * Math.PI * 2, sp = 0.05 + Math.random() * 0.1;
      list.push({ id: newId(), kind: k, col, row, dx: Math.cos(b) * sp, dy: Math.sin(b) * sp * 0.5, until: clock + (12 + Math.random() * 10) * 1000 });
    }
  }
  return list;
}
export const jarCount = jar => Object.values(jar || {}).reduce((t, n) => t + n, 0);
