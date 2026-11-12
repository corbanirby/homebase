import { newId } from "../engine/ids.js";
import { isPassable, isCover } from "../world/tiles.js";
import { atlanta, areaKey, AREA } from "../world/atlanta.js";
import { SPECIES, ATLANTA_SPECIES, lifeStage } from "../creatures/species.jsx";
import { makeWild, DAY, STARVE_MS, HOUR } from "../creatures/resident.js";
import { movePlayer } from "./movement.js";
import { incubateCarried, hatchEgg } from "../creatures/breeding.js";
import { PLANT_SPECIES, podPlantId } from "../plants/plants.js";

// ─── Life in the shared world ─────────────────────────────────────────────────
// Each 16×16 area keeps a number for each species, set by how much of the land
// there suits it. You meet them two ways: rustling cover (step in to see what's
// hiding) and creatures out in the open, which react when you get close: the
// bold charge you, the shy run, the rest slip into cover and become a rustle.
const DENSITY = 0.012;  // creatures per tile of perfect land
const REGROW = 0.35;    // share of the gap to full numbers that refills per day
const MAX_RUSTLES = 4, MAX_WILDS = 5;

function capacity(area, sp) {
  const s = SPECIES[sp]; let cap = 0;
  for (const [b, n] of Object.entries(area)) cap += n * (s.biomes[b] || 0);
  return cap * DENSITY * (s.rare ? 0.3 : 1);
}
export function makePops() {
  const w = atlanta(), pops = {};
  for (const [k, area] of Object.entries(w.areas)) { pops[k] = {}; for (const sp of ATLANTA_SPECIES) pops[k][sp] = capacity(area, sp) * (0.7 + Math.random() * 0.3); }
  return { pops, popsAt: Date.now() };
}
// Numbers recover toward what the land can hold while you're away
export function regrowPops(world, now = Date.now(), speed = 1) {
  const w = atlanta(), days = Math.max(0, (now - (world.popsAt || now)) * speed / DAY);
  if (days <= 0) return world;
  const pops = {};
  for (const [k, area] of Object.entries(w.areas)) {
    pops[k] = {};
    for (const sp of ATLANTA_SPECIES) { const cap = capacity(area, sp), cur = world.pops[k]?.[sp] ?? cap; pops[k][sp] = cur + (cap - cur) * Math.min(1, days * REGROW); }
  }
  return { pops, popsAt: now };
}
function density(world, k) {
  const area = atlanta().areas[k]; if (!area) return 0;
  let have = 0, cap = 0;
  for (const sp of ATLANTA_SPECIES) { have += world.pops[k]?.[sp] || 0; cap += capacity(area, sp); }
  return cap > 0 ? Math.min(1, have / cap) : 0;
}
// Which species you'd meet on this tile, weighted by how many live in the area and how well the tile suits each
function pickSpecies(world, col, row) {
  const w = atlanta(), k = areaKey(col, row), b = w.biome[Math.floor(row)]?.[Math.floor(col)];
  const weights = ATLANTA_SPECIES.map(sp => (world.pops[k]?.[sp] || 0) * ((SPECIES[sp].biomes[b] || 0) > 0 ? 1 + 2 * SPECIES[sp].biomes[b] : 0.15));
  const total = weights.reduce((a, x) => a + x, 0); if (total < 0.3) return null;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return ATLANTA_SPECIES[i]; }
  return ATLANTA_SPECIES[ATLANTA_SPECIES.length - 1];
}
// Farther from your door, stronger creatures
export function wildAt(world, col, row, sp = null) {
  sp = sp || pickSpecies(world, col, row); if (!sp) return null;
  const d = distFromDoor(col, row);
  const lv = Math.min(10, 1 + Math.floor(d / 14) + (Math.random() < 0.3 ? 1 : 0));
  return makeWild(sp, col, row, lv, d < 12);
}
export function distFromDoor(col, row) { const { door } = atlanta(); return Math.hypot(col - (door.c + 0.5), row - (door.r + 0.5)); }
export function takeFromPop(world, col, row, sp) {
  const k = areaKey(col, row);
  return { ...world, pops: { ...world.pops, [k]: { ...world.pops[k], [sp]: Math.max(0, (world.pops[k]?.[sp] || 0) - 1) } } };
}
export function newTrip(now = Date.now()) {
  const { door } = atlanta();
  return { player: { col: door.c + 0.5, row: door.r + 1.6, facing: "down", moveAnim: 0 }, wilds: [], rustles: [], bag: [], startedAt: now, lastTile: null };
}

// Ages and hunger for the creatures you're carrying, for time that passes outside
export const VINE_HUNGER = 0.25; // creatures you carry are held in a light hibernation: a quarter as hungry
// Creatures in the bag are sealed in their pods and fully asleep: no hunger, aging at half speed
export const BAG_AGING = 0.5;
export function ageCarried(c, ms, inBag = false) {
  if (c.isEgg) { const e = incubateCarried(c, ms); return e.incubation >= 1 ? hatchEgg(e) : e; }
  if (inBag) { const age = c.age + ms * BAG_AGING; return { ...c, age, stageId: lifeStage({ age, maxAge: c.maxAge }).id }; }
  const age = c.age + ms, st = lifeStage({ age, maxAge: c.maxAge });
  const rate = (c.dna.metabolism ?? 1) / STARVE_MS * VINE_HUNGER, empty = rate > 0 ? c.fullness / rate : Infinity;
  const fullness = Math.max(0, c.fullness - ms * rate);
  const starving = ms > empty ? (c.fullness > 0 ? ms - empty : (c.starving || 0) + ms) : 0;
  return { ...c, age, stageId: st.id, fullness, starving, hp: c.hp < 1 && c.hp > 0.05 ? Math.min(1, c.hp + ms / (24 * HOUR)) : c.hp };
}

function randomCoverNear(map, col, row, rad) {
  for (let i = 0; i < 10; i++) {
    const c = Math.floor(col + (Math.random() * 2 - 1) * rad), r = Math.floor(row + (Math.random() * 2 - 1) * rad);
    if (Math.hypot(c + 0.5 - col, r + 0.5 - row) < 2.5) continue;
    if (isCover(map, c + 0.5, r + 0.5)) return { c, r };
  }
  return null;
}
function nearestCover(map, col, row, rad = 6) {
  let best = null, bd = Infinity;
  for (let r = Math.floor(row - rad); r <= row + rad; r++) for (let c = Math.floor(col - rad); c <= col + rad; c++) {
    if (!isCover(map, c + 0.5, r + 0.5)) continue;
    const d = Math.hypot(c + 0.5 - col, r + 0.5 - row); if (d < bd) { bd = d; best = { c, r }; }
  }
  return best;
}

// ─── One step outside ─────────────────────────────────────────────────────────
export function simulateOutside(state, tick, input, dtMs) {
  const w = atlanta(), map = w.tiles;
  let trip = state.trip, world = state.world;
  let floats = (state.floats || []).filter(f => tick - f.tick < 45);
  const events = [];
  const carried = new Set([...(state.vine || []), ...(trip.bag || [])]);
  const player = movePlayer(trip.player, input, trip.wilds, map);
  const pc = player.col, pr = player.row;

  // Your creatures grow up and get hungry out here too
  const inBag = new Set(trip.bag || []);
  let pods = state.pods || [];
  const creatures = state.creatures.map(c => {
    if (!carried.has(c.id)) return c;
    let n = ageCarried(c, dtMs, inBag.has(c.id));
    // Hungry on the vine: it eats from the food packed in its pod
    if (!n.isEgg && !inBag.has(c.id) && n.fullness < 0.6) {
      const pod = pods.find(p => p.creatureId === c.id);
      if (pod && pod.food > 0) { n = { ...n, fullness: Math.min(1, n.fullness + 0.3), starving: 0 }; pods = pods.map(p => p === pod ? { ...p, food: p.food - 1 } : p); }
    }
    if (c.isEgg && !n.isEgg) { floats.push({ id: newId(), col: pc, row: pr - 0.6, text: `An egg hatched in your bag! Meet ${n.name}`, color: "#fde68a", tick }); return n; }
    if (!c.isEgg && n.stageId !== c.stageId) floats.push({ id: newId(), col: pc, row: pr - 0.6, text: `${c.name} is now an ${lifeStage(n).label.toLowerCase()}!`, color: "#fde68a", tick });
    return n;
  });

  // Rustling cover: something's hiding in there
  let rustles = trip.rustles.filter(x => x.until > tick);
  if (tick % 20 === 0 && rustles.length < MAX_RUSTLES && Math.random() < 0.15 + 0.4 * density(world, areaKey(pc, pr))) {
    const spot = randomCoverNear(map, pc, pr, 9);
    if (spot && !rustles.some(x => x.c === spot.c && x.r === spot.r)) {
      const sp = pickSpecies(world, spot.c + 0.5, spot.r + 0.5);
      if (sp) rustles.push({ c: spot.c, r: spot.r, species: sp, until: tick + 160 + Math.floor(Math.random() * 160) });
    }
  }

  // Creatures out in the open
  let wilds = trip.wilds;
  if (tick % 60 === 0 && wilds.length < MAX_WILDS && Math.random() < 0.25 + 0.5 * density(world, areaKey(pc, pr))) {
    const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 5;
    const c = pc + Math.cos(a) * d, r = pr + Math.sin(a) * d;
    if (isPassable(map, c, r) && !isCover(map, c, r) && distFromDoor(c, r) > 4) { const wd = wildAt(world, c, r); if (wd) wilds = [...wilds, { ...wd, mood: null }]; }
  }
  wilds = wilds.map(c => {
    let { col, row, dcol, drow, wanderTimer, mood } = c;
    const dx = pc - col, dy = pr - row, d = Math.hypot(dx, dy);
    const st = lifeStage(c);
    const spd = c.dna.speed * (SPECIES[c.species]?.base?.spd ?? 1) * 0.03 * (st.id === "baby" ? 0.6 : st.id === "adolescent" ? 0.85 : 1);
    // Close enough to notice you: each decides once, by its temper
    if (!mood && d < 4) {
      const ag = c.dna.aggression;
      mood = ag > 0.7 ? "charge" : ag < 0.35 ? "flee" : "hide";
      floats.push({ id: newId(), col, row: row - 0.2, text: mood === "charge" ? "!" : mood === "flee" ? "?!" : "…", color: mood === "charge" ? "#f87171" : "#e2e8f0", tick });
    }
    if (mood === "charge") { dcol = dx / d * spd * 1.4; drow = dy / d * spd * 1.4; if (d < 0.65) events.push({ type: "encounter", wild: c, how: "charge" }); }
    else if (mood === "flee") { dcol = -dx / (d || 1) * spd * 1.5; drow = -dy / (d || 1) * spd * 1.5; }
    else if (mood === "hide") {
      const cv = nearestCover(map, col, row);
      if (!cv) mood = "flee";
      else {
        const tx = cv.c + 0.5, ty = cv.r + 0.5, td = Math.hypot(tx - col, ty - row);
        if (td < 0.3) { rustles = [...rustles.filter(x => !(x.c === cv.c && x.r === cv.r)), { c: cv.c, r: cv.r, species: c.species, wild: c, until: tick + 400 }]; return null; }
        dcol = (tx - col) / td * spd * 1.3; drow = (ty - row) / td * spd * 1.3;
      }
    } else if (--wanderTimer <= 0) {
      if (Math.random() < 0.4) { dcol = 0; drow = 0; } else { const a = Math.random() * Math.PI * 2; dcol = Math.cos(a) * spd; drow = Math.sin(a) * spd; }
      wanderTimer = 40 + Math.random() * 100;
    }
    if (isPassable(map, col + dcol, row)) col += dcol; else { dcol = -dcol; wanderTimer = 0; }
    if (isPassable(map, col, row + drow)) row += drow; else { drow = -drow; wanderTimer = 0; }
    if (Math.hypot(pc - col, pr - row) > 18) return null; // wandered off
    return { ...c, col, row, dcol, drow, wanderTimer, mood };
  }).filter(Boolean);

  // Stepping into cover: into a rustle there's surely something; elsewhere, now and then
  const tileKey = Math.floor(pc) + "," + Math.floor(pr);
  if (tileKey !== trip.lastTile && events.length === 0) {
    const ru = rustles.find(x => x.c + "," + x.r === tileKey);
    if (ru) {
      const wd = ru.wild ? { ...ru.wild, col: pc + 0.6, row: pr } : wildAt(world, pc, pr, ru.species);
      rustles = rustles.filter(x => x !== ru);
      if (wd) events.push({ type: "encounter", wild: wd, how: "rustle" });
    } else if (isCover(map, pc, pr) && Math.random() < 0.025) {
      const wd = wildAt(world, pc, pr); if (wd) events.push({ type: "encounter", wild: wd, how: "surprise" });
    }
  }

  return {
    ...state, creatures, floats, pods,
    trip: { ...trip, player, wilds, rustles, lastTile: tileKey },
    events: [...(state.events || []).slice(-30), ...events.map(e => ({ ...e, tick }))],
    tick, clock: (state.clock || 0) + dtMs, world,
    _encounter: events[0] || null,
  };
}

// ─── Wild plants ──────────────────────────────────────────────────────────────
// Moss, cattail and marsh pods grow on the wet banks of creeks, springs and the
// river; forest, pine and stone pods grow in their own land. Their spots are fixed
// (same map every trip). Picking one takes it, and it grows back after a few days,
// the way the creature numbers recover. state.world.picked holds when each regrows.
const WILD_REGROW_MS = { food: 2 * DAY, pod: 3 * DAY };
function h2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
let wildSpots = null;
export function wildPlantSpots() {
  if (wildSpots) return wildSpots;
  const w = atlanta(), out = [], WET = new Set(["creek", "water", "shoal", "spring"]);
  for (let r = 1; r < w.H - 1; r++) for (let c = 1; c < w.W - 1; c++) {
    const t = w.tiles[r][c], b = w.biome[r][c];
    if (!isPassable(w.tiles, c + 0.5, r + 0.5) || isCover(w.tiles, c + 0.5, r + 0.5) || WET.has(t) || t === "door") continue;
    if (distFromDoor(c + 0.5, r + 0.5) < 4) continue;
    let bank = false;
    for (let dr = -1; dr <= 1 && !bank; dr++) for (let dc = -1; dc <= 1; dc++) if (WET.has(w.tiles[r + dr][c + dc])) { bank = true; break; }
    const h = h2(c, r, 41), z = h2(c, r, 43), size = z < 0.55 ? "small" : z < 0.85 ? "medium" : "large";
    let species = null;
    if (bank) species = h < 0.09 ? "bogmoss" : h < 0.15 ? "cattail" : h < 0.19 ? podPlantId(size, "wetland") : null;
    else if (b === "forest") species = h < 0.018 ? podPlantId(size, "forest") : null;
    else if (b === "pine" || b === "clay") species = h < 0.02 ? podPlantId(size, "pine") : null;
    else if (b === "granite") species = h < 0.04 ? podPlantId(size, "stone") : null;
    if (species) out.push({ key: c + "," + r, species, col: c + 0.5, row: r + 0.5, stage: 3, energy: 1, health: 1, wild: true });
  }
  wildSpots = out;
  return out;
}
// The wild plants standing right now (picked ones are gone until they regrow)
export function wildPlants(world, now = Date.now()) {
  const picked = world?.picked || {};
  return wildPlantSpots().filter(p => !(picked[p.key] > now));
}
export function nearWildPlant(state, now = Date.now()) {
  const p = state.trip.player;
  return wildPlants(state.world, now).map(pl => ({ pl, d: Math.hypot(pl.col - p.col, pl.row - p.row) })).filter(x => x.d < 1.1).sort((a, b) => a.d - b.d)[0]?.pl || null;
}
// Picking a wild plant: food plants give 2–3, pod plants 1–3 pods. It regrows in a few days.
export function pickWild(world, pl, speed = 1, now = Date.now()) {
  const pod = !!PLANT_SPECIES[pl.species]?.pod;
  const n = pod ? 1 + Math.floor(Math.random() * 3) : 2 + (Math.random() < 0.5 ? 1 : 0);
  const until = now + WILD_REGROW_MS[pod ? "pod" : "food"] / speed;
  return { world: { ...world, picked: { ...(world.picked || {}), [pl.key]: until } }, n, pod };
}

// A resting spot you're standing at: your door, a spring, or a river shoal
export function spotAt(state) {
  const w = atlanta(), p = state.trip.player;
  if (Math.hypot(w.door.c + 0.5 - p.col, w.door.r + 0.5 - p.row) < 1.8) return "door";
  if (w.springs.some(s => Math.hypot(s.c + 0.5 - p.col, s.r + 0.5 - p.row) < 1.8)) return "spring";
  if (w.tiles[Math.floor(p.row)]?.[Math.floor(p.col)] === "shoal") return "shoal";
  return null;
}
// What Act would do here
export function outsideAct(state) {
  const p = state.trip.player;
  const near = state.trip.wilds.map(c => ({ c, d: Math.hypot(c.col - p.col, c.row - p.row) })).filter(x => x.d < 1.6).sort((a, b) => a.d - b.d)[0];
  if (near) return { kind: "battle", label: "Battle", wild: near.c };
  const pl = nearWildPlant(state);
  if (pl) return { kind: "forage", label: PLANT_SPECIES[pl.species].pod ? "Pick pods" : "Pick " + PLANT_SPECIES[pl.species].name.toLowerCase(), key: pl.key };
  const spot = spotAt(state);
  if (spot === "door") return { kind: "home", label: "Go home" };
  if (spot) return { kind: "rest", label: "Rest" };
  return null;
}
// Where you can move creatures between your vine and your bag
export function atSwapSpot(state) { return state.where !== "out" || !!spotAt(state); }
export { AREA };
