import { newId } from "../engine/ids.js";
import { isPassable, isCover } from "../world/tiles.js";
import { atlanta, areaKey, AREA, WORLD_V } from "../world/atlanta.js";
import { SPECIES, ATLANTA_SPECIES, lifeStage } from "../creatures/species.jsx";
import { makeWild, DAY, HOUR, hungerRate } from "../creatures/resident.js";
import { movePlayer } from "./movement.js";
import { incubateCarried, hatchEgg } from "../creatures/breeding.js";
import { PLANT_SPECIES, podPlantId } from "../plants/plants.js";
import { tickStatuses, restoreStamina, canHeal } from "../battle/statuses.js";
import { surfaceOutside, JAR_MAX, jarCount, critterName } from "./critters.js";
import { dietOf } from "../creatures/diet.js";

// ─── Life in the shared world ─────────────────────────────────────────────────
// Each 16×16 area keeps a number for each species, set by how much of the land
// there suits it. You meet them two ways: rustling cover (step in to see what's
// hiding) and creatures out in the open, which react when you get close: the
// bold charge you, the shy run, the rest slip into cover and become a rustle.
const DENSITY = 0.012;  // creatures per tile of perfect land
const REGROW = 0.35;    // share of the gap to full numbers that refills per day
const MAX_RUSTLES = 4, MAX_WILDS = 5;

// How often a species turns up on a land type (its rarity tier there)
const landTier = (sp, b) => (SPECIES[sp].found || SPECIES[sp].biomes || {})[b] || 0;
function capacity(area, sp) {
  const s = SPECIES[sp]; let cap = 0;
  for (const [b, n] of Object.entries(area)) cap += n * landTier(sp, b);
  return cap * DENSITY * (s.rarity ?? 1);
}
export function makePops() {
  const w = atlanta(), pops = {}, lv = {};
  for (const [k, area] of Object.entries(w.areas)) { pops[k] = {}; for (const sp of ATLANTA_SPECIES) pops[k][sp] = capacity(area, sp) * (0.7 + Math.random() * 0.3); lv[k] = Math.max(1, areaPotential(k) * 0.5); }
  return { v: WORLD_V, pops, popsAt: Date.now(), lv };
}
// ─── Area levels ──────────────────────────────────────────────────────────────
// Each population area has a potential (up to 50): low by your door, high in remote,
// wild land (forest, river, granite, pines). Left alone, an area's level grows about
// 2 a day up to its potential, then keeps growing more slowly with no cap: half a
// level a day for the next 20, then each 10 more takes twice as long as the last.
// Battles won and creatures caught there knock it back down.
const potentials = {};
const WILD_LAND = { forest: 1, granite: 1, river: 1, shoal: 1, creek: 1, pine: 0.8, kudzu: 0.6, clay: 0.6, meadow: 0.3 };
export function areaPotential(k) {
  if (potentials[k] != null) return potentials[k];
  const w = atlanta(), [cx, cy] = k.split(",").map(Number), area = w.areas[k] || {};
  const col = (cx + 0.5) * AREA, row = (cy + 0.5) * AREA, d = distFromDoor(col, row), maxD = Math.hypot(w.W, w.H) / 2;
  let tot = 0, wild = 0; for (const [b, n] of Object.entries(area)) { tot += n; wild += n * (WILD_LAND[b] ?? 0.5); }
  const f = Math.pow(Math.min(1, d / (maxD * 0.85)), 1.15) * (0.7 + 0.4 * (tot ? wild / tot : 0.5));
  return (potentials[k] = d < 20 ? 3 : Math.max(3, Math.min(50, Math.round(2 + 48 * f))));
}
export function levelRate(L, P) {
  if (L < P) return 2;
  const e = L - P;
  return e < 20 ? 0.5 : 0.25 * Math.pow(0.5, (e - 20) / 10);
}
function growLevel(L, P, days) {
  let t = days;
  while (t > 0) { const dt = Math.min(0.25, t), r = levelRate(L, P); L = L < P ? Math.min(P, L + r * dt) : L + r * dt; t -= dt; }
  return L;
}
export const areaLevel = (world, k) => world?.lv?.[k] ?? Math.max(1, areaPotential(k) * 0.5);
// A battle won or a creature caught here: the strong are thinned out and young ones fill in
export function disturbArea(world, col, row) {
  const k = areaKey(col, row), L = areaLevel(world, k);
  return { ...world, lv: { ...(world.lv || {}), [k]: Math.max(1, L - (1 + 0.03 * L)) } };
}
// Numbers recover toward what the land can hold while you're away
export function regrowPops(world, now = Date.now(), speed = 1) {
  const w = atlanta(), days = Math.max(0, (now - (world.popsAt || now)) * speed / DAY);
  if (days <= 0) return world;
  const pops = {}, lv = {};
  for (const [k, area] of Object.entries(w.areas)) {
    pops[k] = {};
    // Predators (Duskhowl) can only be as many as their prey can feed; where there are
    // predators, prey numbers are held a little lower
    const cur0 = sp => world.pops[k]?.[sp] ?? capacity(area, sp);
    const hunters = ATLANTA_SPECIES.filter(sp => SPECIES[sp].appetite === "large" && sp === "duskhowl"), prey = ATLANTA_SPECIES.filter(sp => !hunters.includes(sp) && SPECIES[sp].appetite !== "large");
    const preyN = prey.reduce((t, sp) => t + cur0(sp), 0), preyCap = prey.reduce((t, sp) => t + capacity(area, sp), 0) || 1;
    const huntN = hunters.reduce((t, sp) => t + cur0(sp), 0);
    for (const sp of ATLANTA_SPECIES) {
      let cap = capacity(area, sp);
      if (hunters.includes(sp)) cap *= Math.max(0.2, Math.min(1.3, preyN / preyCap));
      else if (prey.includes(sp)) cap *= Math.max(0.75, 1 - 0.08 * huntN);
      const cur = cur0(sp); pops[k][sp] = cur + (cap - cur) * Math.min(1, days * REGROW);
    }
    lv[k] = growLevel(areaLevel(world, k), areaPotential(k), days);
  }
  return { ...world, pops, popsAt: now, lv };
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
  const L = areaLevel(world, k);
  const weights = ATLANTA_SPECIES.map(sp => L < (SPECIES[sp].minAreaLevel || 0) ? 0 : (world.pops[k]?.[sp] || 0) * (landTier(sp, b) > 0 ? 1 + 2 * landTier(sp, b) : 0.15));
  const total = weights.reduce((a, x) => a + x, 0); if (total < 0.3) return null;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return ATLANTA_SPECIES[i]; }
  return ATLANTA_SPECIES[ATLANTA_SPECIES.length - 1];
}
// A wild creature here: its level spreads around the area's level (young ones lower, old ones higher)
export function wildAt(world, col, row, sp = null) {
  sp = sp || pickSpecies(world, col, row); if (!sp) return null;
  const d = distFromDoor(col, row), L = areaLevel(world, areaKey(col, row));
  // Young ones come in lower than the area's level, old ones a little higher
  const lvAt = c => Math.max(1, Math.round(L * ({ baby: 0.6, adolescent: 0.8, adult: 1, elder: 1.1 }[lifeStage(c).id]) * (0.9 + Math.random() * 0.2)));
  return makeWild(sp, col, row, lvAt, d < 12, { areaLevel: L });
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
export function ageCarried(c, ms, inBag = false, all = []) {
  if (c.isEgg) {
    const e = incubateCarried(c, ms); if (e.incubation < 1) return e;
    return hatchEgg(e, all.filter(o => !o.isEgg).map(o => o.name), [e.motherId, e.fatherId].map(id => all.find(o => o.id === id)?.name));
  }
  // Statuses and stamina run on the same clock: half speed asleep in the bag, normal on the vine
  if (inBag) { const age = c.age + ms * BAG_AGING; return restoreStamina(tickStatuses({ ...c, age, stageId: lifeStage({ age, maxAge: c.maxAge, species: c.species }).id }, ms, 0.5), ms, 0.5); }
  const age = c.age + ms, st = lifeStage({ age, maxAge: c.maxAge, species: c.species });
  const rate = hungerRate(c) * VINE_HUNGER, empty = rate > 0 ? c.fullness / rate : Infinity;
  const fullness = Math.max(0, c.fullness - ms * rate);
  const starving = ms > empty ? (c.fullness > 0 ? ms - empty : (c.starving || 0) + ms) : 0;
  const heal = c.hp < 1 && c.hp > 0.05 && canHeal(c); // vine heals fully in ~12 h (not while festering)
  return restoreStamina(tickStatuses({ ...c, age, stageId: st.id, fullness, starving, hp: heal ? Math.min(1, c.hp + ms / (12 * HOUR)) : c.hp }, ms, 1), ms, 1);
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
    let n = ageCarried(c, dtMs, inBag.has(c.id), state.creatures);
    // Hungry on the vine: it eats from the food packed in its pod
    if (!n.isEgg && !inBag.has(c.id) && n.fullness < 0.6) {
      const pod = pods.find(p => p.creatureId === c.id);
      if (pod && pod.food > 0) { n = { ...n, fullness: Math.min(1, n.fullness + 0.3), hp: n.hp > 0 ? Math.min(1, n.hp + 0.15) : n.hp, starving: 0 }; pods = pods.map(p => p === pod ? { ...p, food: p.food - 1 } : p); }
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

  // Critters surface near you now and then; walk over one to scoop it into your critter jar
  const clockNow = (state.clock || 0) + dtMs;
  let surfaced = surfaceOutside(trip.surfaced, player, (c, r) => w.biome[r]?.[c], clockNow, dtMs);
  let jar = state.jar || {};
  const near = surfaced.find(s => Math.hypot(s.col - pc, s.row - pr) < 0.6);
  if (near) {
    if (jarCount(jar) < JAR_MAX) {
      jar = { ...jar, [near.kind]: (jar[near.kind] || 0) + 1 }; surfaced = surfaced.filter(s => s !== near);
      floats.push({ id: newId(), col: pc, row: pr - 0.7, text: `Scooped up a ${critterName(near.kind)} (jar ${jarCount(jar)}/${JAR_MAX})`, color: "#d9f99d", tick });
    } else if (!trip.jarFullAt || tick - trip.jarFullAt > 100) { floats.push({ id: newId(), col: pc, row: pr - 0.7, text: "Your critter jar is full", color: "#facc15", tick }); trip = { ...trip, jarFullAt: tick }; }
  }

  return {
    ...state, creatures, floats, pods, jar,
    trip: { ...trip, player, wilds, rustles, surfaced, lastTile: tileKey },
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
    // (kudzu grows in its own thickets, so cover is fine there)
    if (!isPassable(w.tiles, c + 0.5, r + 0.5) || (isCover(w.tiles, c + 0.5, r + 0.5) && b !== "kudzu") || WET.has(t) || t === "door") continue;
    if (distFromDoor(c + 0.5, r + 0.5) < 4) continue;
    let bank = false;
    for (let dr = -1; dr <= 1 && !bank; dr++) for (let dc = -1; dc <= 1; dc++) if (WET.has(w.tiles[r + dr][c + dc])) { bank = true; break; }
    const h = h2(c, r, 41), z = h2(c, r, 43), size = z < 0.55 ? "small" : z < 0.85 ? "medium" : "large";
    let species = null;
    if (bank) species = h < 0.09 ? "bogmoss" : h < 0.15 ? "cattail" : h < 0.19 ? podPlantId(size, "wetland") : h < 0.23 ? "algae" : null;
    else if (b === "forest") species = h < 0.018 ? podPlantId(size, "forest") : h < 0.035 ? "oak" : null;
    else if (b === "pine") species = h < 0.02 ? podPlantId(size, "pine") : h < 0.035 ? "pine" : null;
    else if (b === "clay") species = h < 0.02 ? podPlantId(size, "pine") : null;
    else if (b === "granite") species = h < 0.04 ? podPlantId(size, "stone") : null;
    else if (b === "meadow") species = h < 0.02 ? "wildflower" : null;
    else if (b === "kudzu") species = h < 0.045 ? "kudzu" : null;
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
  const n = pod ? 1 + Math.floor(Math.random() * 3) : PLANT_SPECIES[pl.species]?.tree ? 1 + (Math.random() < 0.3 ? 1 : 0) : 2 + (Math.random() < 0.5 ? 1 : 0);
  const until = now + WILD_REGROW_MS[pod ? "pod" : "food"] / speed;
  return { world: { ...world, picked: { ...(world.picked || {}), [pl.key]: until } }, n, pod };
}

// Letting your vine creatures feed at a wild plant: those that drink its sap (trees), sip its
// nectar (wildflowers) or graze it, and aren't full. Sap and nectar don't use the plant up;
// grazing eats it (it's gone until it regrows) and one plant is one plant's worth of food.
export function wildFeeders(state, pl) {
  const vine = new Set(state.vine || []);
  return state.creatures.filter(c => vine.has(c.id) && !c.isEgg && (c.fullness ?? 1) < 0.95 && (() => {
    const d = dietOf(c); return d.sap.includes(pl.species) || d.nectar.includes(pl.species) || d.graze.includes(pl.species);
  })());
}
export function feedAtWild(state, pl, speed = 1, now = Date.now()) {
  const who = wildFeeders(state, pl), sp = PLANT_SPECIES[pl.species];
  let left = (sp?.food ?? 0.5), grazed = false;
  const fed = [];
  const creatures = state.creatures.map(c => {
    if (!who.includes(c)) return c;
    const d = dietOf(c), drink = d.sap.includes(pl.species) || d.nectar.includes(pl.species);
    let gain = 0.98 - (c.fullness ?? 0);
    if (!drink) { gain = Math.min(gain, left); left -= gain; if (gain > 0) grazed = true; }
    if (gain <= 0.005) return c;
    fed.push({ name: c.name, how: d.sap.includes(pl.species) ? "drank sap" : d.nectar.includes(pl.species) ? "sipped nectar" : "grazed" });
    return { ...c, fullness: (c.fullness ?? 0) + gain, hp: canHeal(c) ? Math.min(1, (c.hp ?? 1) + gain * 0.5) : c.hp, starving: 0 };
  });
  const world = grazed ? { ...state.world, picked: { ...(state.world?.picked || {}), [pl.key]: now + WILD_REGROW_MS.food / speed } } : state.world;
  return { state: { ...state, creatures, world }, fed, grazed };
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
  if (pl) return { kind: "forage", label: PLANT_SPECIES[pl.species].pod ? "Pick pods" : { oak: "Gather acorns", pine: "Dig a seedling", wildflower: "Gather seeds", kudzu: "Take cuttings", algae: "Scoop algae" }[pl.species] || "Pick " + PLANT_SPECIES[pl.species].name.toLowerCase(), key: pl.key, feed: wildFeeders(state, pl).length ? { key: pl.key, n: wildFeeders(state, pl).length } : null };
  const spot = spotAt(state);
  if (spot === "door") return { kind: "home", label: "Go home" };
  if (spot) return { kind: "rest", label: "Rest" };
  return null;
}
// Where you can move creatures between your vine and your bag
export function atSwapSpot(state) { return state.where !== "out" || !!spotAt(state); }
export { AREA };
