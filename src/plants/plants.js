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
    regrowHours: 48,           // grazed back, it regrows in about 2 days
    food: 0.5,                 // a full patch is one meal (half a stomach): with regrowth, half a meal a day, so 2 patches per Ramtarug
    seedsPerGather: 2, wetEffect: 0.03,
  },
  cattail: {
    name: "Cattail", icon: "🌾",
    wet: [0.62, 0.86, 1.0], temp: [0.3, 1.0], soils: ["rich", "poor", "sandy", "mineral"],
    stageHours: [1, 10, 24],   // about a day and a half
    spreadHours: 30,
    regrowHours: 72,
    food: 0.75,                // bigger, slower meals: also about half a meal a day
    seedsPerGather: 1, wetEffect: 0.05,
  },
  // ── Brought home from Atlanta (Behavior stage, part 3) ──
  // Trees aren't grazed: Thrummets drink their sap (part 4). They take days to grow.
  oak: {
    name: "Hardwood tree", icon: "🌳", tree: true,
    wet: [0.25, 0.5, 0.82], temp: [0.2, 0.85], soils: ["rich", "poor"],
    stageHours: [8, 48, 96],   // acorn → seedling → sapling → tree: about 6 days
    spreadHours: 400, seedsPerGather: 1, wetEffect: 0.02,
    sapHours: 24, food: 0.6,   // a grown tree's sap refills in a day: 1.2 meals a day, enough for 2 Thrummets
  },
  pine: {
    name: "Loblolly pine", icon: "🌲", tree: true,
    wet: [0.12, 0.38, 0.7], temp: [0.25, 0.95], soils: ["poor", "sandy", "mineral"],
    stageHours: [8, 40, 80],   // about 5 days
    spreadHours: 300, seedsPerGather: 1, wetEffect: 0,
    sapHours: 24, food: 0.5,
  },
  // Wildflowers: Glimmerwick adults sip their nectar (part 4); grazers nibble them too
  wildflower: {
    name: "Wildflowers", icon: "🌼",
    wet: [0.2, 0.45, 0.75], temp: [0.3, 0.95], soils: ["rich", "poor", "sandy"],
    stageHours: [1, 10, 20], spreadHours: 30, regrowHours: 48, food: 0.3,
    nectarHours: 24, nectarFood: 0.3,   // a grown patch's nectar refills in a day: 0.6 meals a day, enough for 1 Glimmerwick
    seedsPerGather: 2, wetEffect: 0.01,
  },
  // Algae: a green mat at the water's edge; Shoalclaws graze it
  algae: {
    name: "Algae", icon: "🟩",
    wet: [0.66, 0.88, 1.0], temp: [0.3, 1.0], soils: ["rich", "poor", "sandy", "mineral", "rocky"],
    stageHours: [0.5, 6, 12], spreadHours: 16, regrowHours: 36, food: 0.4,
    seedsPerGather: 2, wetEffect: 0.02,
  },
  // Kudzu: grows and spreads fast, and smothers other plants next to it. Goats (and Ramtarugs) eat it.
  kudzu: {
    name: "Kudzu", icon: "🍃", smothers: true,
    wet: [0.18, 0.5, 0.85], temp: [0.35, 1.0], soils: ["rich", "poor", "sandy", "mineral"],
    stageHours: [1, 8, 16], spreadHours: 8, regrowHours: 24, food: 0.5,
    seedsPerGather: 2, wetEffect: 0.01,
  },
};
// ─── Pod plants ───────────────────────────────────────────────────────────────
// Four kinds of land, three sizes each. Plant an empty pod and it grows into a pod
// plant of its kind and size; picking it gives 1–3 pods (more in a better spot) and
// takes the plant. Left alone, a grown pod plant slowly seeds the ground next to it.
// Creatures don't eat them.
export const POD_KINDS = {
  wetland: { label: "marsh",  wet: [0.55, 0.82, 1.0],  soils: ["rich", "poor", "mineral"] },
  forest:  { label: "forest", wet: [0.3, 0.55, 0.85],  soils: ["rich", "poor"], shade: true },
  pine:    { label: "pine",   wet: [0.1, 0.3, 0.6],    soils: ["sandy", "poor"] },
  stone:   { label: "stone",  wet: [0.0, 0.2, 0.5],    soils: ["mineral", "sandy"] },
};
const POD_GROW = { small: [2, 10, 12], medium: [3, 18, 27], large: [4, 30, 62] };
const POD_SPREAD = { small: 48, medium: 72, large: 120 };
// Marsh pods keep their old ids so planted ones in older saves still work
export const podPlantId = (size, biome) => biome === "wetland" ? "pod" + size : biome + "pod" + size;
for (const [biome, k] of Object.entries(POD_KINDS)) for (const size of ["small", "medium", "large"]) {
  PLANT_SPECIES[podPlantId(size, biome)] = {
    name: `${size[0].toUpperCase() + size.slice(1)} ${k.label} pod`, icon: "🫛", pod: size, biome,
    wet: [k.wet[0], k.wet[1], k.wet[2]], temp: [0.2, 0.95], soils: k.soils, shade: !!k.shade,
    stageHours: POD_GROW[size], spreadHours: POD_SPREAD[size], regrowHours: 1e9, wetEffect: 0.02,
  };
}
export const GATHER_COOLDOWN_MS = 6 * H;
// How much fullness a plant's food gives (its `food`, or this for remains and anything without one)
export const GRAZE_YIELD = 0.5;
export const yieldOf = p => PLANT_SPECIES[p.species]?.food ?? GRAZE_YIELD;
export const MAX_PLANTS = 140;
// A grazer eats a meal: as much of the plant as it needs, up to all of the leafy top.
// Eaten bare while it's still young (regrowing), the plant dies. Returns the plant and the fullness gained.
// how: "graze" (default), "sap" (a tree: never hurts it; a nymph wears it a little), "nectar" (a
// flower's nectar: doesn't hurt it). k scales what it's worth (scrounging the wrong food: half).
export function eatPlant(p, fullness, cap = 0.98, how = "graze", k = 1, nymph = false) {
  const sp = PLANT_SPECIES[p.species];
  if (how === "nectar") {
    const y = (sp?.nectarFood ?? 0.3) * k, have = p.nectar ?? 1, take = Math.max(0, Math.min(have, (cap - fullness) / y));
    return { plant: { ...p, nectar: have - take }, gained: take * y, killed: false };
  }
  const y = yieldOf(p) * k, take = Math.max(0, Math.min(p.energy, (cap - fullness) / y));
  const energy = p.energy - take;
  if (how === "sap") return { plant: { ...p, energy, wear: (p.wear || 0) + (nymph ? 0.05 : 0) }, gained: take * y, killed: false };
  const killed = p.stage === 2 && energy < 0.05;
  return { plant: { ...p, energy, dead: p.dead || killed }, gained: take * y, killed };
}

// How well a patch suits a plant, from 0 (can't live) to 1 (ideal)
export function fitOf(speciesId, cell) {
  const sp = PLANT_SPECIES[speciesId];
  if (!sp || !cell || cell.water || cell.edge || cell.mother) return 0;
  if (!sp.soils.includes(cell.soil)) return 0;
  const [lo, ideal, hi] = sp.wet;
  if (cell.wet < lo || cell.wet > hi) return 0;
  const wetFit = cell.wet <= ideal ? (cell.wet - lo) / (ideal - lo) : 1 - (cell.wet - ideal) / (hi - ideal + 0.0001) * 0.5;
  if (cell.temp < sp.temp[0] || cell.temp > sp.temp[1]) return 0;
  const shade = cell.veg >= 3 && !sp.shade ? 0.5 : 1; // little grows well under trees (forest pods do)
  return Math.max(0, Math.min(1, (0.25 + wetFit * 0.75) * shade));
}
export function fitWord(fit, cell, speciesId) {
  if (!cell || cell.water) return "Can't plant on water";
  if (cell.edge || cell.mother) return "Can't plant here";
  const sp = PLANT_SPECIES[speciesId];
  if (!sp.soils.includes(cell.soil)) return "Wrong soil";
  if (cell.wet < sp.wet[0]) return "Too dry";
  if (cell.wet > sp.wet[2]) return "Too wet";
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
  // Tiles next to grown kudzu: other plants there are slowly smothered (trees more slowly)
  const smother = new Set();
  for (const p of plants) if (!p.dead && p.stage === 3 && PLANT_SPECIES[p.species]?.smothers)
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) smother.add((Math.floor(p.col) + dc) + "," + (Math.floor(p.row) + dr));
  const next = plants.map(p => {
    if (p.dead) return p;
    const sp = PLANT_SPECIES[p.species]; if (!sp) return { ...p, dead: true };
    const cell = land.cells[Math.floor(p.row)]?.[Math.floor(p.col)];
    const fit = fitOf(p.species, cell);
    let { stage, growth, energy, health } = p;
    // Wrong place: slowly wilts and dies
    const smothered = !sp.smothers && (smother.has(plantKey(p)) || p.kzSmother);
    health = fit <= 0.05 ? health - ms / (8 * H) : smothered ? health - ms / ((sp.tree ? 120 : 40) * H) : Math.min(1, health + ms / (24 * H));
    if (health <= 0) { stats.died++; return { ...p, dead: true }; }
    // Grow toward the next stage, faster in a better spot
    if (stage < 3) {
      growth += (ms / (sp.stageHours[stage] * H)) * (0.3 + fit * 0.7);
      // Growing up the first time fills it with food; regrowing after grazing doesn't
      if (growth >= 1) { growth = 0; stage++; if (stage === 1) stats.sprouted++; if (stage === 3) { stats.matured++; if (!p.grazedBack) energy = Math.max(energy, 0.6); } }
      if (stage === 2) energy = Math.min(0.35, energy + ms / ((sp.regrowHours || sp.sapHours || 48) * H) * 0.35);
    } else if (sp.tree) {
      // A grown tree: its sap refills (more slowly while many nymphs feed on its roots)
      const wear = Math.max(0, (p.wear || 0) - ms / (24 * H) * 0.15);
      energy = Math.min(1, energy + ms / (sp.sapHours * H) * Math.max(0.2, 1 - wear));
      p = { ...p, wear };
    } else {
      if (sp.nectarHours) p = { ...p, nectar: Math.min(1, (p.nectar ?? 1) + ms / (sp.nectarHours * H)) };
      // Grazed down to nothing: knocked back to young, it regrows from the roots
      // Grazed bare again and again, it dies (overgrazing)
      // (eating it again while it's young kills it: see eatPlant)
      if (energy < 0.05) { stage = 2; growth = 0.4; energy = 0.1; p = { ...p, grazedBack: true }; }
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
