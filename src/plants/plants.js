import { COLS, ROWS } from "../config.js";
import { newId } from "../engine/ids.js";

// ─── Plant species ────────────────────────────────────────────────────────────
// Each plant has the conditions it likes. How well a patch fits decides how fast
// it grows; a patch that doesn't fit at all slowly kills it.
// Stages: 0 seed, 1 sprout, 2 young, 3 mature. Times are real hours per stage.
const H = 60 * 60 * 1000;
export const PLANT_SPECIES = {
  bogmoss: {
    name: "Bog moss", icon: "🟢",
    wet: [0.5, 0.82, 1.0], temp: [0.25, 0.95], soils: ["rich", "poor", "mineral"],
    stageHours: [0.5, 4, 8],   // seed → sprout → young → mature: about half a day
    spreadHours: 14,           // a mature patch drops spores next to itself about this often
    regrowHours: 48,           // grazed food grows back slowly: a patch feeds about one creature
    seedsPerGather: 2, wetEffect: 0.03,
  },
  cattail: {
    name: "Cattail", icon: "🌾",
    wet: [0.62, 0.86, 1.0], temp: [0.3, 1.0], soils: ["rich", "poor", "sandy", "mineral"],
    stageHours: [1, 10, 24],   // about a day and a half
    spreadHours: 30,
    regrowHours: 72,
    seedsPerGather: 1, wetEffect: 0.05,
  },
  // Marsh pod plants: each size is its own seed. A plant in a better spot gives more pods
  // when you pick them, then regrows its pods. They don't spread and creatures don't eat them.
  podsmall: {
    name: "Small marsh pod", icon: "🫛", pod: "small", biome: "wetland",
    wet: [0.55, 0.82, 1.0], temp: [0.3, 0.95], soils: ["rich", "poor", "mineral"],
    stageHours: [2, 10, 12], spreadHours: 1e9, regrowHours: 1e9, seedsPerGather: 1, wetEffect: 0.02,
  },
  podmedium: {
    name: "Medium marsh pod", icon: "🫛", pod: "medium", biome: "wetland",
    wet: [0.58, 0.84, 1.0], temp: [0.3, 0.95], soils: ["rich", "poor", "mineral"],
    stageHours: [3, 18, 27], spreadHours: 1e9, regrowHours: 1e9, seedsPerGather: 1, wetEffect: 0.03,
  },
  podlarge: {
    name: "Large marsh pod", icon: "🫛", pod: "large", biome: "wetland",
    wet: [0.62, 0.86, 1.0], temp: [0.3, 0.95], soils: ["rich", "mineral"],
    stageHours: [4, 30, 62], spreadHours: 1e9, regrowHours: 1e9, seedsPerGather: 1, wetEffect: 0.04,
  },
};
export const GATHER_COOLDOWN_MS = 6 * H;
// How much of a plant's food a grazing creature turns into fullness. Tuned so a new
// homebase feeds about 6 Ramtarugs, rising to about 8 as the plants spread.
export const GRAZE_YIELD = 0.2;
export const MAX_PLANTS = 140;

// How well a patch suits a plant, from 0 (can't live) to 1 (ideal)
export function fitOf(speciesId, cell) {
  const sp = PLANT_SPECIES[speciesId];
  if (!sp || !cell || cell.water || cell.edge || cell.mother) return 0;
  if (!sp.soils.includes(cell.soil)) return 0;
  const [lo, ideal, hi] = sp.wet;
  if (cell.wet < lo || cell.wet > hi) return 0;
  const wetFit = cell.wet <= ideal ? (cell.wet - lo) / (ideal - lo) : 1 - (cell.wet - ideal) / (hi - ideal + 0.0001) * 0.5;
  if (cell.temp < sp.temp[0] || cell.temp > sp.temp[1]) return 0;
  const shade = cell.veg >= 3 ? 0.5 : 1; // little grows well under trees
  return Math.max(0, Math.min(1, (0.25 + wetFit * 0.75) * shade));
}
export function fitWord(fit, cell, speciesId) {
  if (!cell || cell.water) return "Can't plant on water";
  if (cell.edge || cell.mother) return "Can't plant here";
  const sp = PLANT_SPECIES[speciesId];
  if (!sp.soils.includes(cell.soil)) return "Wrong soil";
  if (cell.wet < sp.wet[0]) return "Too dry";
  if (cell.temp < sp.temp[0]) return "Too cold";
  if (cell.temp > sp.temp[1]) return "Too hot";
  if (fit >= 0.75) return "Great spot";
  if (fit >= 0.45) return "Good spot";
  return "Poor spot";
}

export function makeSeedling(speciesId, c, r, stage = 0) {
  return { id: newId(), type: "plant", species: speciesId, col: c + 0.5, row: r + 0.5,
    stage, growth: 0, energy: stage >= 3 ? 1 : stage === 2 ? 0.35 : 0, health: 1, lastGather: 0, dead: false };
}

export const plantKey = p => Math.floor(p.col) + "," + Math.floor(p.row);

// A new homebase starts with wild moss and cattails where they'd grow naturally
export function startingPlants(land) {
  const out = [], taken = new Set();
  const spots = [];
  for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) spots.push([c, r]);
  spots.sort(() => Math.random() - 0.5);
  const want = { cattail: 8, bogmoss: 12 };
  for (const [c, r] of spots) {
    const cell = land.cells[r][c];
    for (const id of ["cattail", "bogmoss"]) {
      if (want[id] <= 0 || taken.has(c + "," + r)) continue;
      if (fitOf(id, cell) >= 0.5) { out.push(makeSeedling(id, c, r, 1 + Math.floor(Math.random() * 3))); taken.add(c + "," + r); want[id]--; }
    }
  }
  return out;
}

// What plants do to the ground they grow in (wetland plants hold water)
export function plantEffects(plants) {
  const eff = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (const p of plants) {
    if (p.dead || p.stage < 2) continue;
    const c = Math.floor(p.col), r = Math.floor(p.row);
    const w = PLANT_SPECIES[p.species]?.wetEffect || 0;
    for (const [dc, dr, k] of [[0,0,1],[1,0,0.5],[-1,0,0.5],[0,1,0.5],[0,-1,0.5]]) {
      if (eff[r + dr] && eff[r + dr][c + dc] !== undefined) eff[r + dr][c + dc] += w * k;
    }
  }
  return eff;
}

// ─── Growth over real time ────────────────────────────────────────────────────
// Used every second while playing and, in slices, for time you were away.
export function growPlants(plants, land, ms) {
  const stats = { sprouted: 0, matured: 0, spread: 0, died: 0 };
  if (ms <= 0) return { plants, stats };
  if (ms > H) {
    let left = ms, cur = plants;
    while (left > 0) {
      const res = growPlants(cur, land, Math.min(H, left)); left -= H; cur = res.plants;
      for (const k in stats) stats[k] += res.stats[k];
    }
    return { plants: cur, stats };
  }
  const taken = new Set(plants.filter(p => !p.dead).map(plantKey));
  const born = [];
  const next = plants.map(p => {
    if (p.dead) return p;
    const sp = PLANT_SPECIES[p.species]; if (!sp) return { ...p, dead: true };
    const cell = land.cells[Math.floor(p.row)]?.[Math.floor(p.col)];
    const fit = fitOf(p.species, cell);
    let { stage, growth, energy, health } = p;
    // Wrong place: slowly wilts and dies
    health = fit <= 0.05 ? health - ms / (8 * H) : Math.min(1, health + ms / (24 * H));
    if (health <= 0) { stats.died++; return { ...p, dead: true }; }
    // Grow toward the next stage, faster in a better spot
    if (stage < 3) {
      growth += (ms / (sp.stageHours[stage] * H)) * (0.3 + fit * 0.7);
      // Growing up the first time fills it with food; regrowing after grazing doesn't
      if (growth >= 1) { growth = 0; stage++; if (stage === 1) stats.sprouted++; if (stage === 3) { stats.matured++; if (!p.grazedBack) energy = Math.max(energy, 0.6); } }
      if (stage === 2) energy = Math.min(0.35, energy + ms / (sp.regrowHours * H) * 0.35);
    } else {
      // Grazed down to nothing: knocked back to young, it regrows from the roots
      // Grazed bare again and again, it dies (overgrazing)
      if (energy < 0.05) { stage = 2; growth = 0.4; energy = 0.1; health -= 0.5; p = { ...p, grazedBack: true }; if (health <= 0) { stats.died++; return { ...p, dead: true }; } }
      else energy = Math.min(1, energy + ms / (sp.regrowHours * H));
      // Spread to a neighbouring patch that suits it
      if (stage === 3 && Math.random() < (ms / (sp.spreadHours * H)) * fit) {
        const c = Math.floor(p.col) + Math.floor(Math.random() * 3) - 1, r = Math.floor(p.row) + Math.floor(Math.random() * 3) - 1;
        const nCell = land.cells[r]?.[c];
        if (nCell && !taken.has(c + "," + r) && fitOf(p.species, nCell) > 0.3 && plants.length + born.length < MAX_PLANTS) {
          born.push(makeSeedling(p.species, c, r, 0)); taken.add(c + "," + r); stats.spread++;
        }
      }
    }
    return { ...p, stage, growth, energy, health };
  }).filter(p => !p.dead);
  return { plants: [...next, ...born], stats };
}
