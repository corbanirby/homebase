// ─── The temporary shared world: a generated Atlanta ──────────────────────────
// Until the shared world is placed by GPS, everyone's door opens onto the same
// generated piece of Atlanta: the Chattahoochee with its rocky shoals, creeks
// through hardwood forest, loblolly pine stands on red clay, granite outcrops,
// kudzu fields and a powerline-cut meadow. It's built from a fixed seed, so it's
// the same every trip and never needs saving.
export const ATL_W = 128, ATL_H = 96;
export const AREA = 16; // population areas are 16×16 tiles
const SEED = 1837;      // the year Atlanta was founded (as Terminus)

function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// Smooth noise from a grid of random values
function noise(x, y, scale, s) {
  const gx = x / scale, gy = y / scale, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const sm = t => t * t * (3 - 2 * t);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s), c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return (a + (b - a) * sm(fx)) * (1 - sm(fy)) + (c + (d - c) * sm(fx)) * sm(fy);
}

let cached = null;
export function atlanta() {
  if (cached) return cached;
  const rnd = mulberry(SEED);
  const W = ATL_W, H = ATL_H;
  const tiles = Array.from({ length: H }, () => Array(W).fill("grass"));
  const biome = Array.from({ length: H }, () => Array(W).fill("meadow"));
  const set = (c, r, t, b) => { if (c > 0 && r > 0 && c < W - 1 && r < H - 1) { tiles[r][c] = t; if (b) biome[r][c] = b; } };
  const blob = (cx, cy, rad, fn) => { for (let r = cy - rad - 2; r <= cy + rad + 2; r++) for (let c = cx - rad - 2; c <= cx + rad + 2; c++) { const d = Math.hypot(c - cx, r - cy) + (noise(c, r, 3, 11) - 0.5) * 3; if (d <= rad && c > 0 && r > 0 && c < W - 1 && r < H - 1) fn(c, r, d); } };

  // Upland ground: pine on clay where it's drier, hardwoods where it's damper, meadow between
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const n = noise(c, r, 18, 1), m = noise(c, r, 7, 2), v = hash2(c, r, 3);
    if (n < 0.36) { biome[r][c] = "pine"; tiles[r][c] = v < 0.3 ? "pine" : m < 0.45 ? "clay" : "needles"; }
    else if (n > 0.62) { biome[r][c] = "forest"; tiles[r][c] = v < 0.32 ? "tree" : v < 0.4 ? "tallgrass" : "grass"; }
    else { biome[r][c] = "meadow"; tiles[r][c] = v < 0.05 ? "tree" : m > 0.6 ? "tallgrass" : v < 0.25 ? "flower" : "grass"; }
  }
  // Red clay banks
  for (let i = 0; i < 6; i++) blob(8 + Math.floor(rnd() * (W - 16)), 8 + Math.floor(rnd() * (H - 16)), 2 + Math.floor(rnd() * 3), (c, r) => { tiles[r][c] = "clay"; biome[r][c] = "clay"; });
  // Kudzu smothering forest edges
  for (let i = 0; i < 6; i++) blob(10 + Math.floor(rnd() * (W - 20)), 10 + Math.floor(rnd() * (H - 20)), 3 + Math.floor(rnd() * 4), (c, r) => { tiles[r][c] = hash2(c, r, 9) < 0.06 ? "tree" : "kudzu"; biome[r][c] = "kudzu"; });
  // Granite outcrops, one of them big (a Stone Mountain stand-in)
  blob(Math.floor(W * 0.8), Math.floor(H * 0.22), 9, (c, r) => { tiles[r][c] = "granite"; biome[r][c] = "granite"; });
  for (let i = 0; i < 3; i++) blob(10 + Math.floor(rnd() * (W - 20)), 10 + Math.floor(rnd() * (H - 20)), 3 + Math.floor(rnd() * 3), (c, r) => { tiles[r][c] = "granite"; biome[r][c] = "granite"; });
  // The powerline cut: a straight mown band of meadow across the land
  for (let c = 0; c < W; c++) { const r0 = Math.round(H * 0.15 + c * 0.55); for (let k = -2; k <= 2; k++) { const r = r0 + k; if (r > 0 && r < H - 1 && tiles[r][c] !== "granite") { tiles[r][c] = hash2(c, r, 4) < 0.25 ? "tallgrass" : hash2(c, r, 5) < 0.3 ? "flower" : "grass"; biome[r][c] = "meadow"; } } }

  // The Chattahoochee: a wide river meandering from the north-west to the south
  const river = [];
  for (let c = 0; c < W; c++) river.push(H * 0.62 - c * 0.18 + Math.sin(c / 11) * 5 + Math.sin(c / 4.3) * 1.5);
  // Rocky shoals at a few spots along it, where you can wade across
  const shoalAt = [18, 47, 79, 108];
  for (let c = 0; c < W; c++) {
    const rc = river[c];
    for (let r = Math.floor(rc - 6); r <= Math.ceil(rc + 6); r++) {
      const d = Math.abs(r - rc);
      const shoal = shoalAt.some(s => Math.abs(c - s) <= 2);
      if (d <= 1.8) set(c, r, shoal ? "shoal" : "water", shoal ? "shoal" : "river");
      else if (d <= 2.8) set(c, r, hash2(c, r, 6) < 0.5 ? "sand" : "grass", "forest");
      else if (d <= 6 && tiles[r]?.[c] !== "granite") set(c, r, hash2(c, r, 7) < 0.3 ? "tree" : hash2(c, r, 8) < 0.2 ? "tallgrass" : "grass", "forest"); // bottomland hardwoods
    }
  }
  // Creeks: shallow, wadeable, winding up from the river through the woods
  for (let i = 0; i < 5; i++) {
    let c = 10 + Math.floor(rnd() * (W - 20)), r = Math.round(river[c]);
    const dir = rnd() < 0.5 ? -1 : 1, len = 18 + Math.floor(rnd() * 22);
    for (let k = 0; k < len; k++) {
      r += dir; c += Math.round((noise(k, i, 4, 12) - 0.5) * 2.4);
      if (r < 2 || r > H - 3 || c < 2 || c > W - 3) break;
      if (tiles[r][c] === "water" || tiles[r][c] === "shoal") continue;
      set(c, r, "creek", "creek");
      for (const [dc, dr] of [[1, 0], [-1, 0]]) if (tiles[r + dr][c + dc] !== "creek" && hash2(c + dc, r, 13) < 0.5) set(c + dc, r + dr, "tallgrass", "forest");
    }
  }
  // Springs: clear pools in the woods where creatures can rest (a swap spot)
  const springs = [];
  for (let tries = 0; springs.length < 5 && tries < 500; tries++) {
    const c = 6 + Math.floor(rnd() * (W - 12)), r = 6 + Math.floor(rnd() * (H - 12));
    if (biome[r][c] !== "forest" && biome[r][c] !== "creek") continue;
    if (springs.some(s => Math.hypot(s.c - c, s.r - r) < 22)) continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) set(c + dc, r + dr, "grass", "forest");
    set(c, r, "spring", "creek"); springs.push({ c, r });
  }

  // Your door opens in an open patch of meadow near the middle
  let door = { c: Math.floor(W / 2), r: Math.floor(H / 2) };
  for (let rad = 0; rad < 40; rad++) {
    const ok = (c, r) => ["grass", "flower", "tallgrass"].includes(tiles[r]?.[c]);
    let found = null;
    for (let k = 0; k < 60 && !found; k++) {
      const a = k / 60 * Math.PI * 2, c = Math.round(W / 2 + Math.cos(a) * rad), r = Math.round(H / 2 + Math.sin(a) * rad);
      let open = true; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (!ok(c + dc, r + dr)) open = false;
      if (open) found = { c, r };
    }
    if (found) { door = found; break; }
  }
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (tiles[door.r + dr][door.c + dc] === "tallgrass") set(door.c + dc, door.r + dr, "grass");
  set(door.c, door.r, "door", "meadow");

  // The leafy wall of the giant pod at the edge of what's been grown so far
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (r === 0 || c === 0 || r === H - 1 || c === W - 1) tiles[r][c] = "edge";

  // How much of each kind of land is in each population area
  const areas = {};
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const k = Math.floor(c / AREA) + "," + Math.floor(r / AREA);
    (areas[k] ||= {})[biome[r][c]] = ((areas[k] || {})[biome[r][c]] || 0) + 1;
  }
  cached = { tiles, biome, door, springs, areas, W, H };
  return cached;
}

export const areaKey = (col, row) => Math.floor(col / AREA) + "," + Math.floor(row / AREA);
export const BIOME_NAMES = { river: "Chattahoochee", shoal: "River shoals", creek: "Creek", forest: "Hardwood forest", pine: "Loblolly pines",
  clay: "Red clay", granite: "Granite outcrop", kudzu: "Kudzu", meadow: "Meadow" };
