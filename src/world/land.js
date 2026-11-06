import { COLS, ROWS } from "../config.js";

// ─── The land ─────────────────────────────────────────────────────────────────
// Every patch (tile) of the homebase has three conditions plus what grows there:
//   temp  0..1  cold → hot
//   wet   0..1  dry → waterlogged
//   soil  "rich" | "poor" | "sandy" | "rocky" | "mineral"
//   veg   0 bare, 1 grass, 2 tall growth (meadow or reeds), 3 forest
//   trample  how worn the patch is from being walked on (paths form at 6+)
// The tile you see is worked out from these. Succession slowly moves veg toward
// what the conditions can support; trampling and dry ground push it back.

// One succession step takes this long in real time (scaled by ?speed=N in the URL for testing)
export const GROW_MS = 6 * 60 * 60 * 1000;      // 6 hours
export const TRAMPLE_FADE_MS = 4 * 60 * 60 * 1000; // a step of wear fades every 4 hours
export const PATH_AT = 6;

export const SOILS = {
  rich:    { label: "Rich",    fert: 0.9 },
  poor:    { label: "Poor",    fert: 0.35 },
  sandy:   { label: "Sandy",   fert: 0.25 },
  rocky:   { label: "Rocky",   fert: 0.1 },
  mineral: { label: "Mineral", fert: 0.3 },
};

export function timeSpeed() {
  try { const n = Number(new URLSearchParams(location.search).get("speed")); return n > 0 ? n : 1; } catch (e) { return 1; }
}

const rnd = n => Math.floor(Math.random() * n);

function cellAt(land, c, r) { return land.cells[r]?.[c]; }

// The most growth these conditions can support
function potential(cell) {
  if (cell.water || cell.fixed) return cell.veg;
  const fert = SOILS[cell.soil].fert;
  if (cell.wet < 0.2) return fert > 0.5 ? 1 : 0;        // too dry: bare or thin grass
  if (cell.wet >= 0.72) return 2;                         // waterlogged: reeds at most
  if (cell.temp < 0.15) return 1;                         // too cold for more than grass
  if (fert < 0.2) return 1;                               // rock: grass at most
  // Poor soil: meadow at most, and only where the ground's small local
  // differences (dips, slopes, stones) let it hold enough water
  if (fert < 0.8) return (cell.micro ?? 0.5) < 0.5 ? 1 : 2;
  return 3;                                               // good conditions: forest
}

// What a patch looks like, from its conditions
export function tileOf(cell) {
  if (cell.mother) return "mother";
  if (cell.edge) return "edge";
  if (cell.water) return "water";
  if (cell.trample >= PATH_AT && cell.veg <= 1) return "path";
  if (cell.wet >= 0.72) return cell.veg >= 2 ? "reeds" : "marsh";
  if (cell.soil === "rocky" && cell.veg <= 1) return "stone";
  if (cell.veg >= 3) return "tree";
  if (cell.veg === 2) return "flower";
  if (cell.veg === 1) return cell.wet < 0.22 ? "dirt" : "grass";
  return cell.soil === "sandy" ? "sand" : "dirt";
}

export function deriveMap(land) {
  return land.cells.map(row => row.map(tileOf));
}

// Wetness and temperature each patch settles toward: water soaks nearby ground,
// trees shade and hold moisture, worn ground dries out.
function baseConditions(land, effects = null) {
  const dist = Array.from({ length: ROWS }, () => Array(COLS).fill(99));
  const q = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (land.cells[r][c].water) { dist[r][c] = 0; q.push([c, r]); }
  for (let i = 0; i < q.length; i++) {
    const [c, r] = q[i];
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      if (dist[nr][nc] > dist[r][c] + 1) { dist[nr][nc] = dist[r][c] + 1; q.push([nc, nr]); }
    }
  }
  return (c, r) => {
    const cell = land.cells[r][c];
    const d = dist[r][c];
    let wet = land.climate.wet + (d <= 1 ? 0.42 : d <= 2 ? 0.3 : Math.max(0, 0.22 - d * 0.035));
    let temp = land.climate.temp;
    if (cell.veg >= 3) { wet += 0.05; temp -= 0.05; }
    if (cell.trample >= PATH_AT) wet -= 0.06;
    if (cell.soil === "sandy") wet -= 0.1;
    if (effects) wet += effects[r][c]; // wetland plants hold water in the ground
    return { wet: Math.max(0, Math.min(0.95, wet)), temp: Math.max(0, Math.min(1, temp)) };
  };
}

// ─── A brand-new homebase ─────────────────────────────────────────────────────
// Climate leans toward the starter's biome; for Ramtarug that is a warm, damp wetland.
export function makeLand(climate = { temp: 0.65, wet: 0.42 }) {
  const cells = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => ({
    temp: climate.temp, wet: climate.wet, soil: "poor", veg: 1, trample: 0,
    edge: r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1,
    micro: Math.random(), // small local differences in the ground, fixed for life
  })));
  const land = { climate, cells, lastGrow: Date.now() };
  const blob = (fn, cc, cr, size, density = 0.6) => {
    for (let dr = -size; dr <= size; dr++) for (let dc = -size; dc <= size; dc++) {
      if (dc * dc + dr * dr > size * size + 1 || Math.random() > density) continue;
      const cell = cellAt(land, cc + dc, cr + dr); if (cell && !cell.edge) fn(cell);
    }
  };
  const sc = Math.floor(COLS / 2), sr = Math.floor(ROWS / 2);
  // Pond, kept away from the middle
  let pc, pr;
  do { pc = 6 + rnd(COLS - 12); pr = 5 + rnd(ROWS - 10); } while (Math.hypot(pc - sc, pr - sr) < 8);
  blob(cell => { cell.water = true; }, pc, pr, 3, 1);
  // Soils: mostly poor ground, rich soil around the pond and in a few patches,
  // plus some sandy, rocky and a little mineral ground
  blob(cell => { cell.soil = "rich"; }, pc, pr, 6, 0.85);
  for (let i = 0; i < 3; i++) blob(cell => { cell.soil = "rich"; }, rnd(COLS), rnd(ROWS), 3, 0.8);
  for (let i = 0; i < 2; i++) blob(cell => { if (!cell.water) cell.soil = "sandy"; }, rnd(COLS), rnd(ROWS), 2, 0.8);
  for (let i = 0; i < 2; i++) blob(cell => { if (!cell.water) cell.soil = "rocky"; }, rnd(COLS), rnd(ROWS), 1, 0.9);
  blob(cell => { if (!cell.water) cell.soil = "mineral"; }, rnd(COLS), rnd(ROWS), 1, 0.9);
  // Starting growth: mostly grass, some meadow, a few groves of trees
  for (let i = 0; i < 7; i++) blob(cell => { cell.veg = 2; }, rnd(COLS), rnd(ROWS), 2, 0.5);
  const richSpots = [];
  for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) if (cells[r][c].soil === "rich" && !cells[r][c].water) richSpots.push([c, r]);
  for (let i = 0; i < 5 && richSpots.length; i++) { const [gc, gr] = richSpots[rnd(richSpots.length)]; blob(cell => { if (cell.soil === "rich" && !cell.water) cell.veg = 3; }, gc, gr, 1, 0.8); }
  // Settle conditions, then let the starting growth fit them
  const base = baseConditions(land);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = cells[r][c]; if (cell.edge || cell.water) continue;
    Object.assign(cell, base(c, r));
    cell.veg = Math.min(cell.veg, potential(cell));
    if (cell.wet >= 0.72 && Math.random() < 0.6) cell.veg = 2; // reeds along the shore
  }
  // The mother plant at the center, with clear ground around it
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const cell = cells[sr + dr][sc + dc];
    if (cell.water) cell.water = false;
    if (cell.veg >= 2) cell.veg = 1;
  }
  cells[sr][sc].mother = true; cells[sr][sc].fixed = true;
  return land;
}

// Turn an older (v2) tile map into land, so existing homebases carry over
export function landFromMap(map) {
  const land = makeLand();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = land.cells[r][c], t = map[r]?.[c];
    if (cell.edge || cell.mother) continue;
    cell.water = t === "water";
    if (t === "tree" || t === "reeds" || t === "marsh") cell.soil = "rich";
    cell.veg = { tree: 3, flower: 2, reeds: 2, grass: 1, marsh: 1, dirt: 0, stone: 1 }[t] ?? 1;
    if (t === "stone") cell.soil = "rocky";
    if (t === "marsh" || t === "reeds") cell.wet = 0.8;
  }
  const base = baseConditions(land);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = land.cells[r][c]; if (cell.edge || cell.water || cell.mother) continue;
    Object.assign(cell, base(c, r));
  }
  return land;
}

// ─── Change over time ─────────────────────────────────────────────────────────
// Advance the land by `ms` of real time. Returns how many patches changed in each way.
export function growLand(land, ms, effects = null) {
  const stats = { grew: 0, thinned: 0, pathsFaded: 0 };
  if (ms <= 0) return stats;
  // Long absences are worked through in 6-hour slices, so slow changes like
  // spreading forest happen at the same pace whether you were here or not
  if (ms > GROW_MS) {
    let left = ms;
    while (left > 0) { const part = growLand(land, Math.min(GROW_MS, left), effects); left -= GROW_MS;
      stats.grew += part.grew; stats.thinned += part.thinned; stats.pathsFaded += part.pathsFaded; }
    return stats;
  }
  const base = baseConditions(land, effects);
  const growSteps = ms / GROW_MS, fadeSteps = ms / TRAMPLE_FADE_MS;
  const chance = x => { const whole = Math.floor(x); return whole + (Math.random() < x - whole ? 1 : 0); };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = land.cells[r][c];
    if (cell.edge || cell.water || cell.fixed) continue;
    // Conditions drift toward their natural level
    const b = base(c, r), k = Math.min(1, growSteps);
    cell.wet += (b.wet - cell.wet) * k; cell.temp += (b.temp - cell.temp) * k;
    // Wear fades when nobody walks here
    if (cell.trample > 0) {
      const before = cell.trample;
      cell.trample = Math.max(0, cell.trample - chance(fadeSteps));
      if (before >= PATH_AT && cell.trample < PATH_AT) stats.pathsFaded++;
    }
    // Succession: one step at a time toward what the land supports.
    // Forest only spreads from a neighbouring tree; worn ground can't grow tall.
    const pot = potential(cell);
    let steps = chance(growSteps * (0.5 + cell.temp * 0.5));
    while (steps-- > 0) {
      if (cell.veg < pot) {
        if (cell.trample >= 3) break;
        // Trees are slow: they only creep in from a neighbouring tree, about
        // one patch a week at a forest's edge, and almost never appear alone.
        if (cell.veg === 2 && pot === 3) {
          const nearTree = [[1,0],[-1,0],[0,1],[0,-1]].some(([dc, dr]) => cellAt(land, c + dc, r + dr)?.veg === 3);
          if (Math.random() > (nearTree ? 0.05 : 0.002)) break;
        }
        cell.veg++; stats.grew++;
      } else if (cell.veg > pot) { cell.veg--; stats.thinned++; }
      else break;
    }
  }
  land.lastGrow = (land.lastGrow || Date.now()) + ms;
  return stats;
}

// Walking onto a patch wears it a little; enough wear tramples growth back to grass.
export function trample(land, c, r) {
  const cell = cellAt(land, Math.floor(c), Math.floor(r));
  if (!cell || cell.edge || cell.water || cell.fixed) return false;
  const beforeTile = tileOf(cell);
  cell.trample = Math.min(12, cell.trample + 1);
  if (cell.trample >= 4 && cell.veg === 2) cell.veg = 1;
  return tileOf(cell) !== beforeTile;
}
