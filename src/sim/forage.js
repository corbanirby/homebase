// ─── Letting a creature out to forage (Behavior stage; decided Nov 25) ─────────
// Out in Atlanta you can let one creature off your vine to find its own food. It
// heads for the nearest thing it eats within its range (8–16 tiles, farther for
// faster creatures): a plant it grazes, a tree's sap, a flower's nectar, ground with
// critters it digs for, or remains. It eats, then comes back to you and its pod,
// catching up if you've walked on.
// While it's out a wild creature may pick a fight: a hungry predator that sees it
// as prey (to the end), or one after the same food (until one gives up at half
// health). The fight plays out where it happens, a round about every 5 seconds;
// walk over and press Help to turn it into a real battle. A hunter (Duskhowl) goes
// after a wild creature it eats and can beat.
import { newId } from "../engine/ids.js";
import { isPassable } from "../world/tiles.js";
import { atlanta } from "../world/atlanta.js";
import { SPECIES, lifeStage, speciesOf } from "../creatures/species.jsx";
import { dietOf } from "../creatures/diet.js";
import { PLANT_SPECIES } from "../plants/plants.js";
import { ATL_CRITTERS, critterName, PER_CRITTER, CRITTERS } from "./critters.js";
import { makeBattler, battleStats, endOfRound, executeBattleMove, aiPickMove, goesFirst } from "../battle/engine.js";
import { toWorld, canHeal } from "../battle/statuses.js";
import { addXp, strengthOf, xpForWin } from "../creatures/leveling.js";
import { levelUpMoves } from "../battle/moves.js";
import { REMAINS_MS, sizeOf } from "../creatures/death.js";

export const ROUND_TICKS = 100;       // a round of a fight out here: about 5 seconds
export const HELP_DIST = 1.6;         // how close you need to be to step in
const EAT_TICKS = { graze: 80, sap: 90, nectar: 70, critters: 110, remains: 100 };
const PREY_MEALS = { small: 2, medium: 4, large: 6 };
const strength = c => strengthOf(battleStats(c));

// How far it will roam: 8–16 tiles by its speed now
export function forageRange(c) {
  const sp = SPECIES[c.species], st = lifeStage(c).id;
  const spd = (sp?.stageStats?.[st]?.spd ?? sp?.base?.spd ?? 1) * (c.dna?.speed ?? 1);
  return Math.max(8, Math.min(16, Math.round(12 * spd)));
}
// Walking pace in tiles per tick (about 1 tile a second for an average creature)
function pace(c) {
  const sp = SPECIES[c.species], st = lifeStage(c);
  return Math.max(0.03, Math.min(0.08, 0.05 * (sp?.base?.spd ?? 1) * (c.dna?.speed ?? 1) * (st.id === "baby" ? 0.7 : st.id === "adolescent" ? 0.9 : 1)));
}

// Can it be let out right now? Returns a reason when it can't.
export function canForage(state, c) {
  if (state.where !== "out" || !c || c.isEgg) return "Only out in Atlanta";
  if (state.trip?.forage) return state.trip.forage.id === c.id ? "Out foraging" : `${state.creatures.find(o => o.id === state.trip.forage.id)?.name || "Another"} is already out`;
  if (!(state.vine || []).includes(c.id)) return "Only from your vine";
  if ((state.vine || []).length <= 1) return "Your last one on the vine stays with you";
  if ((c.hp ?? 1) < 0.25) return "Too hurt to go out";
  if ((c.fullness ?? 1) >= 0.95) return "Not hungry";
  const d = dietOf(c);
  if (d.sun) return "It feeds on sun, not food";
  return null;
}
export function letOut(state, id, tick) {
  const c = state.creatures.find(o => o.id === id), why = canForage(state, c);
  if (why) return { state, why };
  const p = state.trip.player;
  const f = { id, col: p.col + 0.4, row: p.row + 0.2, dcol: 0, drow: 0, phase: "seek", target: null, path: null, R: forageRange(c), home: { col: p.col, row: p.row }, at: tick, eatUntil: 0, fight: null, stuck: 0 };
  return { state: { ...state, trip: { ...state.trip, forage: f } } };
}
export function callBack(state) {
  const f = state.trip?.forage; if (!f || f.fight) return state;
  return { ...state, trip: { ...state.trip, forage: { ...f, phase: "return", target: null, path: null, note: "called" } } };
}

// ── Remains out in the world (from battles and hunts), kept in world.remains
export function addWildRemains(world, c, col, row, clock, name = null) {
  return { ...world, remains: [...(world.remains || []), { id: newId(), col, row, species: c.species, name: name || speciesOf(c).name, size: sizeOf(c), diedAt: clock, energy: 1, wild: true }] };
}
export function stepWildRemains(world, clock) {
  const list = world.remains || [];
  const keep = list.filter(r => clock - r.diedAt < REMAINS_MS && r.energy > 0.06);
  return keep.length === list.length ? world : { ...world, remains: keep };
}

// ── A short path over walkable tiles (breadth first, inside a box around both ends)
function bfs(map, from, to, pad = 6) {
  const fc = Math.floor(from.col), fr = Math.floor(from.row), tc = Math.floor(to.col), tr = Math.floor(to.row);
  if (fc === tc && fr === tr) return [];
  const c0 = Math.min(fc, tc) - pad, c1 = Math.max(fc, tc) + pad, r0 = Math.min(fr, tr) - pad, r1 = Math.max(fr, tr) + pad;
  const key = (c, r) => c + "," + r, prev = new Map([[key(fc, fr), null]]), q = [[fc, fr]];
  const goalOk = (c, r) => c === tc && r === tr;
  for (let i = 0; i < q.length; i++) {
    const [c, r] = q[i];
    if (goalOk(c, r)) {
      const path = []; let k = key(c, r);
      while (k) { const [x, y] = k.split(",").map(Number); path.unshift({ col: x + 0.5, row: y + 0.5 }); k = prev.get(k); }
      return path.slice(1);
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = c + dc, nr = r + dr, k = key(nc, nr);
      if (nc < c0 || nc > c1 || nr < r0 || nr > r1 || prev.has(k)) continue;
      // the target tile itself may be a tree (sap) or bank: allow stepping onto it
      if (!goalOk(nc, nr) && !isPassable(map, nc + 0.5, nr + 0.5)) continue;
      if (dc && dr && (!isPassable(map, c + dc + 0.5, r + 0.5) || !isPassable(map, c + 0.5, r + dr + 0.5))) continue; // no corner cutting
      prev.set(k, key(c, r)); q.push([nc, nr]);
    }
  }
  return null;
}

// ── What it goes for: the nearest food it eats within range of where it set off
function findTarget(state, c, f, plants) {
  const d = dietOf(c), w = atlanta(), from = f.home, R = f.R;
  const opts = [];
  const within = (col, row) => Math.hypot(col - from.col, row - from.row) <= R;
  for (const pl of plants) {
    if (!within(pl.col, pl.row)) continue;
    const how = d.sap.includes(pl.species) ? "sap" : d.nectar.includes(pl.species) ? "nectar" : d.graze.includes(pl.species) ? "graze" : null;
    if (how) opts.push({ type: how, key: pl.key, species: pl.species, col: pl.col, row: pl.row });
  }
  if (d.remains) for (const r of state.world.remains || []) if (r.energy > 0.2 && within(r.col, r.row)) opts.push({ type: "remains", id: r.id, col: r.col, row: r.row });
  if (d.critters.length) {
    // look over the ground for land with critters it eats
    let best = null;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, rr = 1.5 + Math.random() * (R - 1.5);
      const col = Math.floor(from.col + Math.cos(a) * rr) + 0.5, row = Math.floor(from.row + Math.sin(a) * rr) + 0.5;
      if (!isPassable(w.tiles, col, row)) continue;
      const kinds = (ATL_CRITTERS[w.biome[Math.floor(row)]?.[Math.floor(col)]] || []).filter(k => d.critters.includes(k));
      if (!kinds.length) continue;
      const dd = Math.hypot(col - f.col, row - f.row);
      if (!best || dd < best.dd) best = { type: "critters", kinds, col, row, dd };
    }
    if (best) opts.push(best);
  }
  // A hunter with nothing else: the nearest wild creature it eats and can beat
  if (d.hunts && !opts.length) {
    const me = strength(c);
    for (const o of state.trip.wilds) if (o.species !== c.species && within(o.col, o.row) && strength(o) <= me) opts.push({ type: "hunt", wildId: o.id, col: o.col, row: o.row });
  }
  if (!opts.length) return null;
  opts.forEach(o => { o.dist = Math.hypot(o.col - f.col, o.row - f.row); });
  return opts.sort((a, b) => a.dist - b.dist)[0];
}

const foodWord = t => t.type === "sap" ? `${PLANT_SPECIES[t.species]?.name.toLowerCase() || "tree"} sap`
  : t.type === "nectar" ? "wildflower nectar" : t.type === "graze" ? (PLANT_SPECIES[t.species]?.name.toLowerCase() || "plants")
  : t.type === "remains" ? "remains" : t.type === "critters" ? t.kinds.map(k => CRITTERS[k]?.plural).join(" and ") : "prey";

// Walk toward a point along a path (re-planned when needed); returns the new position
function walk(map, f, goal, spd) {
  let path = f.path;
  if (!path || f.goalKey !== Math.floor(goal.col) + "," + Math.floor(goal.row)) { path = bfs(map, f, goal) || []; }
  const next = path[0] || goal;
  const dx = next.col - f.col, dy = next.row - f.row, d = Math.hypot(dx, dy);
  let col = f.col, row = f.row, dcol = 0, drow = 0;
  if (d > 0.001) {
    const s = Math.min(spd, d); dcol = dx / d * s; drow = dy / d * s;
    col += dcol; row += drow;
  }
  if (path.length && Math.hypot(path[0].col - col, path[0].row - row) < 0.15) path = path.slice(1);
  return { ...f, col, row, dcol, drow, path, goalKey: Math.floor(goal.col) + "," + Math.floor(goal.row) };
}

// One round of a fight, with the real battle rules
function fightRound(A, B, quitA, quitB) {
  const order = goesFirst(A, B) ? ["A", "B"] : ["B", "A"];
  for (const x of order) {
    if (quitA(A) || quitB(B)) break;
    const att = x === "A" ? A : B, def = x === "A" ? B : A;
    const move = aiPickMove(att, def); if (!move) continue;
    const r = executeBattleMove(att, def, move);
    if (x === "A") { A = r.newAttacker; B = r.newDefender; } else { B = r.newAttacker; A = r.newDefender; }
  }
  if (!quitA(A) && !quitB(B)) { A = endOfRound(A).b; B = endOfRound(B).b; }
  return { A, B };
}

// What the fight did to your creature, written back onto it
const fromBattler = (c, A) => ({ ...c, hp: Math.max(0, Math.min(1, A.battleHp / A.maxHp)), statuses: toWorld(A.fx), stamina: A.maxSta ? A.stamina / A.maxSta : c.stamina, fatigued: !!A.fatigued });
// The wild one as it stands, for a real battle
export function wildFromFight(fight) {
  const B = fight.B;
  return { ...fight.wild, hp: Math.max(0.02, B.battleHp / B.maxHp), statuses: toWorld(B.fx), stamina: B.maxSta ? B.stamina / B.maxSta : 1, fatigued: !!B.fatigued, mood: null };
}
export { fromBattler };

// ── One step (every tick while one is out). Returns { state, events }.
export function stepForage(state, tick, plants, speed = 1) {
  let f = state.trip?.forage; if (!f) return { state, events: [] };
  const w = atlanta(), map = w.tiles, events = [];
  let creatures = state.creatures, world = state.world, wilds = state.trip.wilds, floats = state.floats || [];
  const c = creatures.find(o => o.id === f.id);
  if (!c) return { state: { ...state, trip: { ...state.trip, forage: null } }, events };
  const p = state.trip.player;
  const say = (text, color = "#d9f99d", at = p) => floats = [...floats, { id: newId(), col: at.col, row: at.row - 0.6, text, color, tick }];
  const setC = n => { creatures = creatures.map(o => o.id === n.id ? n : o); };

  // ── A fight in progress
  if (f.fight) {
    const fi = f.fight;
    if (tick < fi.nextAt) return { state: { ...state, floats }, events };
    const giveUp = fi.kind === "food" ? 0.5 : 0;
    const quit = x => x.battleHp <= x.maxHp * giveUp;
    let { A, B } = fightRound(fi.A, fi.B, quit, quit);
    const rounds = fi.rounds + 1, wildName = speciesOf(fi.wild).name;
    // A chased creature may slip away (faster ones more often)
    const preySlips = (fi.kind === "prey" && Math.random() < (A.spd > B.spd ? 0.18 : 0.04)) || (fi.kind === "hunt" && Math.random() < (B.spd > A.spd ? 0.18 : 0.04));
    if (!quit(A) && !quit(B) && !preySlips && rounds < 30) {
      return { state: { ...state, floats, trip: { ...state.trip, forage: { ...f, fight: { ...fi, A, B, rounds, nextAt: tick + ROUND_TICKS } } } }, events };
    }
    // It's over
    let mine = fromBattler(c, A);
    const aLost = quit(A) && !quit(B) ? true : quit(B) && !quit(A) ? false : A.battleHp / A.maxHp < B.battleHp / B.maxHp;
    if (preySlips && !(quit(A) || quit(B))) {
      if (fi.kind === "prey") { say(`${c.name} got away from the wild ${wildName}!`, "#fde68a"); setC(mine); f = { ...f, fight: null, phase: "return", target: null, path: null }; }
      else { say(`The wild ${wildName} got away from ${c.name}`, "#fde68a"); setC(mine); wilds = [...wilds, { ...wildFromFight(fi), col: fi.col + 1, row: fi.row, mood: "flee" }]; f = { ...f, fight: null, phase: "return", target: null, path: null }; }
    } else if (aLost) {
      if (fi.kind === "food") {
        say(`${c.name} gave up the fight and ran back`, "#fde68a"); setC({ ...mine, hp: Math.max(0.05, mine.hp) });
        wilds = [...wilds, { ...wildFromFight(fi), mood: null }];
        f = { ...f, fight: null, phase: "return", target: null, path: null };
      } else {
        // Killed out here
        setC({ ...mine, hp: 0 });
        events.push({ type: "forageDied", id: c.id, col: f.col, row: f.row, by: wildName, cause: "hunted" });
        if (fi.kind === "prey") wilds = [...wilds, { ...wildFromFight(fi), mood: "flee", fullness: 1 }];
        f = null;
      }
    } else {
      // Your creature won
      const xp = xpForWin(fi.wild), g = addXp(mine, xp), up = levelUpMoves(mine, g.level);
      mine = { ...mine, xp: g.xp, level: g.level, moves: up.moves, learned: up.learned, hp: Math.max(0.05, mine.hp) };
      if (g.level > (c.level || 1)) say(`${c.name} grew to level ${g.level}!`, "#fde68a");
      if (fi.kind === "food") {
        say(`${c.name} drove off the wild ${wildName}`, "#a7f3d0");
        wilds = [...wilds, { ...wildFromFight(fi), mood: "flee" }];
        setC(mine); f = { ...f, fight: null, phase: "seek" };          // back to the food
      } else {
        // The wild one dies here: one fewer in the area, remains left; a hunter eats
        events.push({ type: "wildKilled", wild: fi.wild });
        world = addWildRemains(world, fi.wild, fi.col, fi.row, state.clock || 0);
        if (fi.kind === "hunt") {
          const meals = PREY_MEALS[SPECIES[fi.wild.species]?.appetite] ?? 3, gain = Math.min(0.98 - mine.fullness, meals * 0.5);
          mine = { ...mine, fullness: mine.fullness + gain, hp: canHeal(mine) ? Math.min(1, mine.hp + gain * 0.5) : mine.hp, starving: 0 };
          say(`${c.name} caught and ate a wild ${wildName}`, "#f87171");
        } else say(`${c.name} fought off the wild ${wildName}, and it didn't survive`, "#a7f3d0");
        setC(mine); f = { ...f, fight: null, phase: "return", target: null, path: null };
      }
    }
    return { state: { ...state, creatures, world, floats, trip: { ...state.trip, wilds, forage: f } }, events };
  }

  const spd = pace(c);
  // ── Looking for food
  if (f.phase === "seek") {
    if (!f.target || (f.target.type === "hunt" && !wilds.some(o => o.id === f.target.wildId))) {
      const t = findTarget(state, c, f, plants);
      if (!t) { say(`${c.name} found nothing it eats nearby`, "#facc15"); f = { ...f, phase: "return", path: null }; }
      else { f = { ...f, target: t, path: null }; say(`${c.name} is off after ${t.type === "hunt" ? `a wild ${speciesOf(wilds.find(o => o.id === t.wildId)).name}` : foodWord(t)}`); }
    } else {
      let goal = f.target;
      if (goal.type === "hunt") { const o = wilds.find(x => x.id === goal.wildId); goal = { ...goal, col: o.col, row: o.row }; f = { ...f, target: goal }; }
      const before = { col: f.col, row: f.row };
      f = walk(map, f, goal, spd * (goal.type === "hunt" ? 1.4 : 1));
      f = Math.hypot(f.col - before.col, f.row - before.row) < spd * 0.2 ? { ...f, stuck: (f.stuck || 0) + 1 } : { ...f, stuck: 0 };
      const reach = goal.type === "sap" ? 1.0 : 0.6;
      if (Math.hypot(goal.col - f.col, goal.row - f.row) < reach) {
        if (goal.type === "hunt") {
          const o = wilds.find(x => x.id === goal.wildId);
          wilds = wilds.filter(x => x.id !== o.id);
          f = startFight(f, c, o, "hunt", tick);
          say(`${c.name} is attacking a wild ${speciesOf(o).name}!`, "#fca5a5");
        } else f = { ...f, phase: "eat", eatUntil: tick + (EAT_TICKS[goal.type] || 90), dcol: 0, drow: 0 };
      } else if (f.stuck > 60) { say(`${c.name} couldn't reach the food`, "#facc15"); f = { ...f, phase: "return", target: null, path: null }; }
    }
  } else if (f.phase === "eat") {
    if (tick >= f.eatUntil) {
      const t = f.target, need = Math.max(0, 0.98 - (c.fullness ?? 0));
      let gain = 0, ok = true;
      if (t.type === "graze") {
        const still = plants.some(pl => pl.key === t.key);
        if (!still) ok = false;
        else { gain = Math.min(need, PLANT_SPECIES[t.species]?.food ?? 0.5); world = { ...world, picked: { ...(world.picked || {}), [t.key]: Date.now() + 2 * 24 * 3600e3 / speed } }; }
      } else if (t.type === "sap" || t.type === "nectar") gain = need;
      else if (t.type === "critters") { const n = 6 + Math.floor(Math.random() * 7); gain = Math.min(need, n * PER_CRITTER); }
      else if (t.type === "remains") {
        const r = (world.remains || []).find(x => x.id === t.id);
        if (!r || r.energy <= 0.06) ok = false;
        else { gain = Math.min(need, 0.5); world = { ...world, remains: world.remains.filter(x => x.id !== r.id) }; } // one meal, then gone
      }
      if (ok && gain > 0.005) {
        setC({ ...c, fullness: (c.fullness ?? 0) + gain, hp: canHeal(c) ? Math.min(1, (c.hp ?? 1) + gain * 0.5) : c.hp, starving: 0 });
        say(`${c.name} ${t.type === "sap" ? "drank sap" : t.type === "nectar" ? "sipped nectar" : t.type === "critters" ? `dug up ${t.kinds.map(k => critterName(k, 2)).join(" and ")}` : t.type === "remains" ? "ate the remains" : `grazed ${foodWord(t)}`}`, "#a7f3d0");
      } else if (!ok) say(`Someone got to the ${foodWord(t)} first`, "#facc15");
      f = { ...f, phase: "return", target: null, path: null };
    }
  } else if (f.phase === "return") {
    const d = Math.hypot(p.col - f.col, p.row - f.row);
    // It hurries to catch up with you
    const s = d > 3 ? Math.max(spd * 1.6, 0.12) : spd * 1.3;
    if (tick % 15 === 0) f = { ...f, path: null };
    f = walk(map, f, p, s);
    if (d < 0.8) {
      say(`${c.name} is back in its pod${f.note === "called" ? "" : (creatures.find(o => o.id === c.id).fullness >= 0.6 ? ", well fed" : "")}`, "#cbd5c0");
      return { state: { ...state, creatures, world, floats, trip: { ...state.trip, wilds, forage: null } }, events: [...events, { type: "back" }] };
    }
  }

  // ── Trouble: a wild creature nearby may come for it (checked now and then)
  if (f && !f.fight && f.phase !== "return" && tick % 20 === 0) {
    const cur = creatures.find(o => o.id === c.id), me = strength(cur), md = dietOf(cur), t = f.target;
    for (const o of wilds) {
      if (o.mood === "stalk" || Math.hypot(o.col - f.col, o.row - f.row) > 5) continue;
      const od = dietOf(o);
      if (od.hunts && o.species !== cur.species && strength(o) >= me * 0.9 && Math.random() < 0.3) {
        wilds = wilds.map(x => x.id === o.id ? { ...x, mood: "stalk", stalk: "prey" } : x);
        say(`A wild ${speciesOf(o).name} is stalking ${cur.name}!`, "#f87171"); events.push({ type: "trouble" }); break;
      }
      const same = t && ((["graze", "sap", "nectar"].includes(t.type) && (od.graze.includes(t.species) || od.sap.includes(t.species) || od.nectar.includes(t.species)))
        || (t.type === "critters" && t.kinds.some(k => od.critters.includes(k))) || (t.type === "remains" && od.remains));
      if (same && (o.dna?.aggression ?? 0.5) > 0.55 && Math.random() < 0.15) {
        wilds = wilds.map(x => x.id === o.id ? { ...x, mood: "stalk", stalk: "food" } : x);
        say(`A wild ${speciesOf(o).name} wants ${cur.name}'s food!`, "#fca5a5"); events.push({ type: "trouble" }); break;
      }
    }
  }
  // Stalkers close in; on reaching it the fight starts
  if (f && !f.fight) {
    const ff = f;
    wilds = wilds.map(o => {
      if (o.mood !== "stalk") return o;
      const dx = ff.col - o.col, dy = ff.row - o.row, d = Math.hypot(dx, dy) || 1, s = pace(o) * 1.5;
      let col = o.col, row = o.row; const dcol = dx / d * s, drow = dy / d * s;
      if (isPassable(map, col + dcol, row)) col += dcol; if (isPassable(map, col, row + drow)) row += drow;
      return { ...o, col, row, dcol, drow };
    });
    const att = wilds.find(o => o.mood === "stalk" && Math.hypot(o.col - f.col, o.row - f.row) < 0.7);
    if (att) {
      wilds = wilds.filter(o => o.id !== att.id);
      f = startFight(f, creatures.find(o => o.id === c.id), att, att.stalk === "prey" ? "prey" : "food", tick);
      say(`${c.name} is being attacked by a wild ${speciesOf(att).name}! Go help!`, "#f87171");
      events.push({ type: "fight" });
    }
  }
  return { state: { ...state, creatures, world, floats, trip: { ...state.trip, wilds, forage: f } }, events };
}

function startFight(f, c, wild, kind, tick) {
  const A = makeBattler(c), B = makeBattler({ ...wild, wild: true });
  return { ...f, phase: "fight", dcol: 0, drow: 0, path: null, fight: { kind, wild: { ...wild, mood: null, stalk: null }, A, B, rounds: 0, nextAt: tick + ROUND_TICKS, col: (f.col + wild.col) / 2, row: (f.row + wild.row) / 2, wildPos: { col: wild.col, row: wild.row } } };
}

// What to draw: your creature, the one it's fighting, and health bars over both
export function forageSprites(state) {
  const f = state.trip?.forage; if (!f) return { creatures: [], bars: [] };
  const c = state.creatures.find(o => o.id === f.id); if (!c) return { creatures: [], bars: [] };
  const mine = { ...c, col: f.col, row: f.row, dcol: f.dcol || 0, drow: f.drow || 0, state: f.phase === "eat" ? "eat" : "wander", wild: false };
  if (!f.fight) return { creatures: [mine], bars: [] };
  const fi = f.fight, o = { ...fi.wild, col: fi.wildPos.col, row: fi.wildPos.row, dcol: (f.col - fi.wildPos.col) * 0.01, drow: (f.row - fi.wildPos.row) * 0.01 };
  const me = { ...mine, dcol: (fi.wildPos.col - f.col) * 0.01, drow: (fi.wildPos.row - f.row) * 0.01 };
  return { creatures: [me, o], bars: [{ col: f.col, row: f.row, v: fi.A.battleHp / fi.A.maxHp, mine: true }, { col: o.col, row: o.row, v: fi.B.battleHp / fi.B.maxHp }] };
}
