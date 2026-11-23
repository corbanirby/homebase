import { COLS, ROWS } from "../config.js";
import { newId } from "../engine/ids.js";
import { isPassable } from "../world/tiles.js";
import { SPECIES, lifeStage } from "../creatures/species.jsx";
import { HOUR, HUNGRY_AT, WEAK_AT, habitatFit, hungerRate } from "../creatures/resident.js";
import { eatPlant, PLANT_SPECIES } from "../plants/plants.js";
import { addXp, strengthOf } from "../creatures/leveling.js";
import { battleStats } from "../battle/engine.js";
import { levelUpMoves } from "../battle/moves.js";
import { scuffle } from "./scuffle.js";
import { eatCritters, countOn, surfaceStep, JAR_MAX, jarCount, critterName } from "./critters.js";
import { dietOf, SCROUNGE, SCROUNGE_YIELD } from "../creatures/diet.js";
import { SOILS } from "../world/land.js";
import { movePlayer, softCollide } from "./movement.js";
import { tickStatuses, restoreStamina, canHeal } from "../battle/statuses.js";

const STAGE_SPEED = { baby: 0.6, adolescent: 0.85, adult: 1, elder: 0.7 };
const MEAL_TICKS = 60;   // it spends about 3 seconds at a plant, then has eaten its meal

// How a creature would eat this right now (its diet, by species and life stage), or null:
// graze a plant, drink a grown tree's sap, sip a grown flower's nectar, forage a critter
// colony (3+ of the kinds it eats), scavenge remains, or (with nothing it eats anywhere)
// scrounge moss or cattail at half the value
function feedOn(c, p) {
  if (p.dead || p.stage < 2) return null;
  const d = c._diet || dietOf(c);
  if (p._critter) return d.critters.reduce((t, k) => t + (p.col_?.[k] || 0), 0) >= 3 ? "critters" : null;
  if (p.species === "remains") return d.remains && p.energy > 0.2 ? "remains" : null;
  if (d.sap.includes(p.species)) return p.stage === 3 && p.energy > 0.2 ? "sap" : null;
  if (d.nectar.includes(p.species)) return p.stage === 3 && (p.nectar ?? 1) > 0.2 ? "nectar" : null;
  if (d.graze.includes(p.species)) return p.energy > 0.2 ? "graze" : null;
  if (c._scrounge && SCROUNGE.includes(p.species)) return p.energy > 0.2 ? "scrounge" : null;
  return null;
}
const edible = (c, p) => !!feedOn(c, p);

// Nearest plant it can actually walk to, and the tiles to walk through (breadth-first over the grid)
function findFood(c, plants, map, avoid = null) {
  const food = new Map();
  for (const p of plants) if (edible(c, p) && !(c.backOff && c.backOff.id === p.id && c.backOff.until > (c._clock ?? 0))) { const k = Math.floor(p.col) + "," + Math.floor(p.row); if (!food.has(k)) food.set(k, p); }
  if (!food.size) return null;
  const sc = Math.floor(c.col), sr = Math.floor(c.row);
  const prev = new Map([[sc + "," + sr, null]]);
  const queue = [[sc, sr]];
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y] = queue[qi], k = x + "," + y;
    if (food.has(k)) {
      const path = []; let cur = k;
      while (cur) { path.unshift(cur.split(",").map(Number)); cur = prev.get(cur); }
      return { plant: food.get(k), path: path.slice(1) };
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, nk = nx + "," + ny;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || prev.has(nk)) continue;
      if (!food.has(nk) && (nk === avoid || !isPassable(map, nx + 0.5, ny + 0.5))) continue;
      prev.set(nk, k); queue.push([nx, ny]);
    }
  }
  return null;
}

// ─── One step of life at home ─────────────────────────────────────────────────
// dtMs is how much world time this step stands for (TICK_MS, times the test speed).
export function simulateHome(state, tick, input, map, land, dtMs) {
  let { creatures, floats, events } = state;
  // Food on the ground: plants, plus remains (stage 3, so scavengers can graze them)
  let critters = state.critters || {};
  let plants = [...state.plants, ...(state.remains || []).map(r => ({ ...r, species: "remains", stage: 3, _remains: true })),
    // Critter colonies, as food for insect-eaters
    ...Object.entries(critters).map(([key, col]) => { const [c, r] = key.split(",").map(Number); return { id: "cr:" + key, key, col_: col, _critter: true, species: "critters", col: c + 0.5, row: r + 0.6, stage: 3, energy: 1 }; })];
  let newFloats = floats.filter(f => tick - f.tick < 45);
  const newEvents = [];
  const player = movePlayer(state.player, input, creatures, map);
  const clock = (state.clock || 0) + dtMs;

  const byId = new Map(creatures.map(c => [c.id, c]));
  const surfacedEaten = new Set();
  const moved = creatures.map(c => {
    if (c.isEgg) return c; // eggs sit where they were laid
    let { col, row, dcol, drow, age, fullness, hp, habitat, wanderTimer, state: cs, targetId, biteTimer, stageId, path, stall = 0 } = c;
    // Growing up
    age += dtMs;
    const st = lifeStage({ age, maxAge: c.maxAge, species: c.species });
    if (st.id !== stageId) {
      stageId = st.id;
      newFloats.push({ id: newId(), col, row, text: `${c.name} is now an ${st.label.toLowerCase()}!`, color: "#fde68a", tick });
      newEvents.push({ type: "grew", id: c.id, stage: st.id, tick });
    }
    // Getting hungry, healing, settling into the patch it's on
    fullness = Math.max(0, fullness - dtMs * hungerRate(c));
    if (SPECIES[c.species]?.appetite && dietOf(c).sun) {
      const cell0 = land?.cells[Math.floor(row)]?.[Math.floor(col)];
      fullness = Math.min(1, fullness + dtMs * sunGain(cell0));
      if (cell0 && !cell0.water) enrich(cell0, dtMs);
    }
    // Resting at home heals fully in about 3 hours
    if (hp < 1 && canHeal(c)) hp = Math.min(1, hp + dtMs / (3 * HOUR));
    const cell = land?.cells[Math.floor(row)]?.[Math.floor(col)];
    habitat += (habitatFit(c, cell) - habitat) * Math.min(1, dtMs / (2 * HOUR));

    const weak = fullness < WEAK_AT;
    const spd = c.dna.speed * (SPECIES[c.species]?.base?.spd ?? 1) * 0.03 * (STAGE_SPEED[st.id] || 1) * (weak ? 0.4 : 1);
    // Notice when it's trying to walk but not getting anywhere (being nudged aside by you undoes each step)
    stall = cs === "seek" && Math.hypot(col - (c.lastCol ?? -9), row - (c.lastRow ?? -9)) < spd * 0.3 ? stall + 1 : 0;
    const lastCol = col, lastRow = row;

    // Hungry: find the nearest plant it eats that it can walk to (looked up again every few seconds)
    // (It walks around the patch you're standing on, and plans again if it gets stuck.)
    if (cs !== "eat" && fullness < HUNGRY_AT && (cs !== "seek" || stall > 15 || (tick + c.id) % 100 === 0)) {
      stall = 0;
      const me = { ...c, col, row, _clock: clock, _diet: dietOf(c) }, avoid = Math.floor(player.col) + "," + Math.floor(player.row);
      // (hunters only scrounge when nearly starving: hunger is what sends them hunting)
      const f = me._diet.sun ? null : findFood(me, plants, map, avoid) || ((!me._diet.hunts || fullness < 0.1) ? findFood({ ...me, _scrounge: true }, plants, map, avoid) : null);
      if (f) { cs = "seek"; targetId = f.plant.id; path = f.path; }
      else if (cs === "seek") { cs = "wander"; targetId = null; path = null; }
    }
    if (cs === "seek") {
      const t = plants.find(p => p.id === targetId);
      if (!t || !(edible(c, t) || edible({ ...c, _scrounge: true }, t))) { cs = "wander"; targetId = null; path = null; wanderTimer = 0; }
      else {
        // Walk tile by tile along the path, then straight to the plant
        while (path && path.length > 1 && Math.hypot(path[0][0] + 0.5 - col, path[0][1] + 0.5 - row) < 0.2) path = path.slice(1);
        const [gx, gy] = path && path.length > 1 ? [path[0][0] + 0.5, path[0][1] + 0.5] : [t.col, t.row];
        const d = Math.hypot(t.col - col, t.row - row), dg = Math.hypot(gx - col, gy - row);
        if (d < 0.45) { cs = "eat"; biteTimer = 0; dcol = 0; drow = 0; path = null; }
        else if (dg > 0.0001) { const k = Math.min(spd, dg); dcol = (gx - col) / dg * k; drow = (gy - row) / dg * k; }
      }
    }
    if (cs === "eat") {
      const i = plants.findIndex(p => p.id === targetId);
      const t = plants[i];
      if (!t || t.dead || t.energy < 0.06 || fullness >= 0.97) { cs = "wander"; targetId = null; wanderTimer = 0; }
      else if (++biteTimer >= MEAL_TICKS) {
        // A whole meal at once: as much of the plant as it needs (grazers eat the leafy top)
        biteTimer = 0;
        if (t._critter) {
          // Insect-eaters: a meal of critters from the colony (10 make a meal)
          const r = eatCritters(critters, t.key, SPECIES[c.species]?.critters || [], fullness);
          critters = r.colonies; fullness += r.gained; if (canHeal(c)) hp = Math.min(1, hp + r.gained * 0.5);
          plants = plants.map((p, j) => j === i ? { ...p, col_: critters[t.key] || {}, energy: critters[t.key] ? 1 : 0 } : p);
          if (r.eaten) surfacedEaten.add(t.key);
        } else {
          const how = feedOn(c, t) || feedOn({ ...c, _scrounge: true }, t) || "graze";
          const r = eatPlant(t, fullness, 0.98, how === "sap" ? "sap" : how === "nectar" ? "nectar" : "graze", how === "scrounge" ? SCROUNGE_YIELD : 1, how === "sap" && st.id === "baby");
          fullness += r.gained; if (canHeal(c)) hp = Math.min(1, hp + r.gained * 0.5); // a meal (+50% full) heals 25%
          plants = plants.map((p, j) => j === i ? r.plant : p);
        }
        cs = "wander"; targetId = null; wanderTimer = 0;
      }
    }
    if (cs === "wander") {
      // Ant nests bite: it won't stand around on one
      if ((critters[Math.floor(col) + "," + Math.floor(row)]?.ant || 0) >= 8 && wanderTimer > 10) wanderTimer = 0;
      if (--wanderTimer <= 0) {
        // Sometimes stop and stand a while, sometimes amble somewhere
        // A creature with a mate tends to drift back toward it
        const mate = c.mateId != null ? byId.get(c.mateId) : null;
        const md = mate ? Math.hypot(mate.col - col, mate.row - row) : 0;
        if (mate && md > 3 && !weak && Math.random() < 0.6) { dcol = (mate.col - col) / md * spd; drow = (mate.row - row) / md * spd; }
        else if (Math.random() < 0.4 || weak) { dcol = 0; drow = 0; }
        else { const a = Math.random() * Math.PI * 2; dcol = Math.cos(a) * spd; drow = Math.sin(a) * spd; }
        wanderTimer = 40 + Math.random() * 100;
      }
    }
    // Step, turning back at water, trees and the edge of the homebase
    if (dcol || drow) {
      // A plant's own patch counts as walkable for the one going to eat it (reeds and wet ground)
      const tp = cs === "seek" ? plants.find(p => p.id === targetId) : null;
      const tk = tp ? Math.floor(tp.col) + "," + Math.floor(tp.row) : "";
      const ok = (x, y) => isPassable(map, x, y) || (tk && Math.floor(x) + "," + Math.floor(y) === tk);
      if (ok(col + dcol, row)) col += dcol; else { dcol = -dcol; if (cs === "wander") wanderTimer = 0; }
      if (ok(col, row + drow)) row += drow; else { drow = -drow; if (cs === "wander") wanderTimer = 0; }
      col = Math.max(0.5, Math.min(COLS - 0.5, col)); row = Math.max(0.5, Math.min(ROWS - 0.5, row));
    }
    let out = { ...c, col, row, dcol, drow, path, stall, lastCol, lastRow, age, fullness, hp, habitat, wanderTimer, state: cs, targetId, biteTimer, stageId };
    // Resting at home, statuses wear off and stamina comes back twice as fast, and poison can't kill
    if (c.statuses?.length) out = tickStatuses(out, dtMs, 2, { home: true });
    if ((c.stamina ?? 1) < 1 || c.fatigued) out = restoreStamina(out, dtMs, 2);
    return out;
  });

  // Kudzoons slowly smother the plants right next to them (trees much more slowly)
  const kz = moved.filter(c => !c.isEgg && dietOf(c).sun);
  // (marked here; the plants' own growth does the smothering, as next to grown kudzu)
  plants = plants.map(p => {
    if (p._remains || p._critter || p.dead) return p;
    const near = kz.some(k => Math.abs(Math.floor(k.col) - Math.floor(p.col)) <= 1 && Math.abs(Math.floor(k.row) - Math.floor(p.row)) <= 1);
    return near === !!p.kzSmother ? p : { ...p, kzSmother: near };
  });

  // Food fights: two hungry creatures at one plant that can't feed them both
  const fought0 = foodFights(moved, plants, clock, tick, newFloats, newEvents);
  // Predators: a very hungry hunter with nothing else to eat goes after a creature it can beat
  const fought = predation(fought0, plants, state.remains, clock, tick, newFloats, newEvents);

  // Critters surface now and then; ones on a tile an insect-eater just fed on are gone.
  // Walk over one to scoop it into your critter jar.
  let surfaced = surfaceStep(critters, (state.surfaced || []).filter(s => !surfacedEaten.has(s.tile)), clock, dtMs);
  let jar = state.jar || {};
  const near = surfaced.find(s => Math.hypot(s.col - player.col, s.row - player.row) < 0.55);
  if (near && jarCount(jar) < JAR_MAX && (input.dx || input.dy)) {
    jar = { ...jar, [near.kind]: (jar[near.kind] || 0) + 1 }; surfaced = surfaced.filter(s => s !== near);
    const col = critters[near.tile];
    if (col?.[near.kind]) { const n = col[near.kind] - 1; const nc = { ...col }; if (n < 0.5) delete nc[near.kind]; else nc[near.kind] = n; critters = { ...critters }; if (Object.keys(nc).length) critters[near.tile] = nc; else delete critters[near.tile]; }
    newFloats.push({ id: newId(), col: player.col, row: player.row - 0.7, text: `Scooped up a ${critterName(near.kind)} (jar ${jarCount(jar)}/${JAR_MAX})`, color: "#d9f99d", tick });
  }

  return {
    ...state, clock, player,
    plants: plants.filter(p => !p._remains && !p._critter), critters, surfaced, jar,
    remains: (state.remains || []).map(r => { const f = plants.find(p => p._remains && p.id === r.id); return f ? { ...r, energy: f.energy } : r; }),
    creatures: softCollide(fought, player, map),
    floats: newFloats, events: [...events.slice(-30), ...newEvents], tick,
  };
}

// ─── Kudzoon: sun and soil ───────────────────────────────────────────────────
// Out in the open (no tree overhead, not in water) it fills up: about 1 meal a day on
// poor soil, nearly 2 on rich soil; in shade very little. Where it sits, poor soil slowly
// gets richer (kudzu fixes nitrogen): about two days of sitting raises it a step.
const SUN_PER_MS = 0.04 / HOUR;
export function sunGain(cell) {
  if (!cell || cell.water || cell.edge) return 0;
  const fert = SOILS[cell.soil]?.fert ?? 0.3;
  return SUN_PER_MS * (cell.veg >= 3 ? 0.15 : 0.4 + 0.6 * fert);
}
function enrich(cell, ms) {
  if (cell.soil !== "poor" && cell.soil !== "sandy") return;
  cell.enrich = (cell.enrich || 0) + ms / (48 * HOUR);
  if (cell.enrich >= 1) { cell.soil = cell.soil === "sandy" ? "poor" : "rich"; cell.enrich = 0; }
}

// ─── Food fights (decided Nov 23) ─────────────────────────────────────────────
// Two hungry creatures eating at the same plant, when it can't fill them both:
// - if one already won here (it stays dominant for about a day), the other backs off;
// - otherwise temper decides: if either is aggressive (temper gene 0.5+) they scuffle,
//   a short battle off screen that stops when one gives up at half health; if both are
//   calm, the calmer one backs down. The winner eats; the loser looks elsewhere for an hour.
// Both earn a quarter of the XP that fight would pay in the wild.
const DAY_MS = 24 * HOUR;
const FIGHT_TEMPER = 0.5;
function foodFights(creatures, plants, clock, tick, floats, events) {
  const eaters = new Map();
  for (const c of creatures) if (!c.isEgg && c.state === "eat" && c.targetId != null) (eaters.get(c.targetId) || eaters.set(c.targetId, []).get(c.targetId)).push(c);
  if (![...eaters.values()].some(l => l.length > 1)) return creatures;
  const changed = new Map();
  const cur = c => changed.get(c.id) || c;
  for (const [pid, list] of eaters) {
    if (list.length < 2) continue;
    const plant = plants.find(p => p.id === pid); if (!plant) continue;
    const y = PLANT_SPECIES[plant.species]?.food ?? 0.5;
    const [a0, b0] = list, a = cur(a0), b = cur(b0);
    // Enough for both: they share
    if (plant.energy * y >= (0.98 - a.fullness) + (0.98 - b.fullness) * 0.8) continue;
    const backOff = (loser, winner, fight) => {
      changed.set(loser.id, { ...loser, state: "wander", targetId: null, wanderTimer: 20, backOff: { id: pid, until: clock + HOUR } });
      if (!fight) changed.set(winner.id, { ...winner, dominates: { ...(winner.dominates || {}), [loser.id]: clock + DAY_MS } });
    };
    if ((a.dominates?.[b.id] ?? 0) > clock) { backOff(b, a); continue; }
    if ((b.dominates?.[a.id] ?? 0) > clock) { backOff(a, b); continue; }
    const ta = a.dna?.aggression ?? 0.5, tb = b.dna?.aggression ?? 0.5;
    if (Math.max(ta, tb) < FIGHT_TEMPER) { if (ta <= tb) backOff(a, b); else backOff(b, a); continue; }
    // Scuffle
    const r = scuffle(a, b);
    const win = r.winner === "a" ? a : b, lose = r.winner === "a" ? b : a;
    const give = (c, hpFrac, xp) => {
      const g = addXp(c, Math.max(1, Math.round(xp / 4))), up = levelUpMoves(c, g.level);
      if (g.level > (c.level || 1)) floats.push({ id: newId(), col: c.col, row: c.row - 0.9, text: `${c.name} grew to Lv${g.level}!`, color: "#93c5fd", tick });
      return { ...c, hp: Math.max(0.05, Math.min(c.hp ?? 1, hpFrac)), xp: g.xp, level: g.level, moves: up.moves, learned: up.learned };
    };
    const w = give(win, r.winner === "a" ? r.aHp : r.bHp, r.winner === "a" ? r.aXp : r.bXp);
    const l = give(lose, r.winner === "a" ? r.bHp : r.aHp, r.winner === "a" ? r.bXp : r.aXp);
    changed.set(w.id, { ...w, dominates: { ...(w.dominates || {}), [l.id]: clock + DAY_MS } });
    changed.set(l.id, { ...l, state: "wander", targetId: null, wanderTimer: 20, biteTimer: 0, backOff: { id: pid, until: clock + HOUR } });
    const what = (PLANT_SPECIES[plant.species]?.name || "food").toLowerCase();
    const text = `${a.name} and ${b.name} fought over the ${what}: ${w.name} won`;
    floats.push({ id: newId(), col: w.col, row: w.row - 0.6, text, color: "#fca5a5", tick });
    events.push({ type: "fight", a: a.name, b: b.name, winner: w.name, text, tick });
  }
  return changed.size ? creatures.map(c => changed.get(c.id) || c) : creatures;
}

// ─── Predation at home (decided Nov 23) ───────────────────────────────────────
// A hunter (Duskhowl) hunts only when it's very hungry, nothing else it eats is around,
// and only a creature it's strong enough to beat. First it eyes its prey (a warning:
// feed it and it stops); after about an hour it attacks: a battle off screen with the
// real rules, to the end. Faster prey can slip away partway. If the hunter wins, the
// prey dies (its remains are left for scavengers) and the hunter eats. If not, the hunter
// is hurt, still hungry, and won't try again for a couple of hours.
// A very hungry Possumbra with nothing else to eat may raid an egg the same way (no fight).
const VERY_HUNGRY = 0.2, EYE_MS = HOUR, HUNT_REST = 2 * HOUR;
const PREY_MEALS = { small: 2, medium: 4, large: 6 };   // meals a kill is worth, by the prey's size
const strength = c => strengthOf(battleStats(c));
export function predation(creatures, plants, remains, clock, tick, floats, events) {
  const changed = new Map(), gone = new Set();
  const cur = c => changed.get(c.id) || c;
  const hasOtherFood = (c, d) => (d.remains && (remains || []).some(r => (r.energy ?? 1) > 0.2)) ||
    plants.some(p => !p.dead && !p._remains && !p._critter && p.stage >= 2 && p.energy > 0.2 && (d.graze.includes(p.species) || d.sap.includes(p.species) || d.nectar.includes(p.species)));
  for (const c0 of creatures) {
    if (c0.isEgg || gone.has(c0.id)) continue;
    const c = cur(c0), d = dietOf(c), eggEater = c.species === "possumbra";
    if (!d.hunts && !eggEater) continue;
    if (c.fullness >= VERY_HUNGRY || (c.huntRest || 0) > clock) { if (c.stalk) changed.set(c.id, { ...c, stalk: null }); continue; }
    if ((tick + c.id) % 40 !== 0 && !c.stalk) continue;          // looks around now and then
    if (hasOtherFood(c, d)) { if (c.stalk) changed.set(c.id, { ...c, stalk: null }); continue; }
    // Pick (or keep) its target: the nearest one it can beat (an egg, for a Possumbra)
    let prey = c.stalk ? creatures.map(cur).find(o => o.id === c.stalk.id && !gone.has(o.id)) : null;
    if (!prey) {
      const me = strength(c);
      const options = creatures.map(cur).filter(o => o.id !== c.id && !gone.has(o.id) && !o.diedOf &&
        (d.hunts ? !o.isEgg && o.species !== c.species && strength(o) <= me : eggEater && o.isEgg));
      prey = options.sort((a, b) => Math.hypot(a.col - c.col, a.row - c.row) - Math.hypot(b.col - c.col, b.row - c.row))[0];
      if (!prey) continue;
      changed.set(c.id, { ...c, stalk: { id: prey.id, at: clock } });
      const what = prey.isEgg ? "an egg" : prey.name;
      const text = `${c.name} is eyeing ${what}…`;
      floats.push({ id: newId(), col: c.col, row: c.row - 0.8, text, color: "#fca5a5", tick });
      events.push({ type: "stalk", text, tick });
      continue;
    }
    if (clock - c.stalk.at < EYE_MS) continue;
    // The attack
    if (prey.isEgg) {
      gone.add(prey.id);
      changed.set(c.id, { ...c, stalk: null, fullness: Math.min(1, c.fullness + 0.5), state: "wander", targetId: null });
      const text = `${c.name} ate an egg`;
      floats.push({ id: newId(), col: prey.col, row: prey.row - 0.6, text, color: "#fca5a5", tick }); events.push({ type: "eggEaten", text, tick });
      continue;
    }
    const r = scuffle(c, prey, { giveUpAt: 0, maxRounds: 40, escape: (A, B) => Math.random() < (B.spd > A.spd ? 0.2 : 0.04) });
    if (r.winner === "a") {
      const meals = PREY_MEALS[SPECIES[prey.species]?.appetite] ?? 3;
      const g = addXp(c, r.aXp), up = levelUpMoves(c, g.level);
      changed.set(c.id, { ...c, stalk: null, hp: Math.max(0.05, Math.min(c.hp ?? 1, r.aHp)), fullness: Math.min(1, c.fullness + meals * 0.5), xp: g.xp, level: g.level, moves: up.moves, learned: up.learned, state: "wander", targetId: null });
      changed.set(prey.id, { ...prey, hp: 0, diedOfPoison: true, diedOf: "hunted", killedBy: c.name });
      gone.add(prey.id);
      const text = `${c.name} caught and ate ${prey.name}`;
      floats.push({ id: newId(), col: prey.col, row: prey.row - 0.6, text, color: "#f87171", tick }); events.push({ type: "hunted", text, tick });
    } else {
      changed.set(c.id, { ...c, stalk: null, huntRest: clock + HUNT_REST, hp: Math.max(0.05, Math.min(c.hp ?? 1, r.aHp)) });
      changed.set(prey.id, { ...prey, hp: Math.max(0.05, Math.min(prey.hp ?? 1, r.bHp)) });
      const text = r.escaped ? `${prey.name} got away from ${c.name}!` : `${prey.name} fought off ${c.name}!`;
      floats.push({ id: newId(), col: prey.col, row: prey.row - 0.6, text, color: "#fde68a", tick }); events.push({ type: "huntFailed", text, tick });
    }
  }
  if (!changed.size && !gone.size) return creatures;
  // Eggs eaten are simply gone; creatures killed stay until the deaths step takes them (leaving remains)
  return creatures.filter(c => !(c.isEgg && gone.has(c.id))).map(c => changed.get(c.id) || c);
}
