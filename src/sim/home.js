import { COLS, ROWS } from "../config.js";
import { newId } from "../engine/ids.js";
import { isPassable } from "../world/tiles.js";
import { SPECIES, lifeStage } from "../creatures/species.jsx";
import { HOUR, STARVE_MS, HUNGRY_AT, WEAK_AT, habitatFit } from "../creatures/resident.js";
import { GRAZE_YIELD } from "../plants/plants.js";
import { movePlayer, softCollide } from "./movement.js";

const STAGE_SPEED = { baby: 0.6, adolescent: 0.85, adult: 1, elder: 0.7 };
const BITE_TICKS = 20;   // a bite about once a second
const BITE = 0.12;       // how much one bite fills it, and takes from the plant

// Plants a creature can eat right now, and remains if it's a scavenger
const edible = (c, p) => !p.dead && p.stage >= 2 && p.energy > 0.2 &&
  (p.species === "remains" ? !!SPECIES[c.species]?.scavenger : (SPECIES[c.species]?.eats || []).includes(p.species));

// Nearest plant it can actually walk to, and the tiles to walk through (breadth-first over the grid)
function findFood(c, plants, map, avoid = null) {
  const food = new Map();
  for (const p of plants) if (edible(c, p)) { const k = Math.floor(p.col) + "," + Math.floor(p.row); if (!food.has(k)) food.set(k, p); }
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
  let plants = [...state.plants, ...(state.remains || []).map(r => ({ ...r, species: "remains", stage: 3, _remains: true }))];
  let newFloats = floats.filter(f => tick - f.tick < 45);
  const newEvents = [];
  const player = movePlayer(state.player, input, creatures, map);
  const clock = (state.clock || 0) + dtMs;

  const byId = new Map(creatures.map(c => [c.id, c]));
  const moved = creatures.map(c => {
    if (c.isEgg) return c; // eggs sit where they were laid
    let { col, row, dcol, drow, age, fullness, hp, habitat, wanderTimer, state: cs, targetId, biteTimer, stageId, path, stall = 0 } = c;
    // Growing up
    age += dtMs;
    const st = lifeStage({ age, maxAge: c.maxAge });
    if (st.id !== stageId) {
      stageId = st.id;
      newFloats.push({ id: newId(), col, row, text: `${c.name} is now an ${st.label.toLowerCase()}!`, color: "#fde68a", tick });
      newEvents.push({ type: "grew", id: c.id, stage: st.id, tick });
    }
    // Getting hungry, healing, settling into the patch it's on
    fullness = Math.max(0, fullness - dtMs / STARVE_MS * (c.dna.metabolism ?? 1));
    if (hp < 1) hp = Math.min(1, hp + dtMs / (12 * HOUR));
    const cell = land?.cells[Math.floor(row)]?.[Math.floor(col)];
    habitat += (habitatFit(c, cell) - habitat) * Math.min(1, dtMs / (2 * HOUR));

    const weak = fullness < WEAK_AT;
    const spd = c.dna.speed * 0.03 * (STAGE_SPEED[st.id] || 1) * (weak ? 0.4 : 1);
    // Notice when it's trying to walk but not getting anywhere (being nudged aside by you undoes each step)
    stall = cs === "seek" && Math.hypot(col - (c.lastCol ?? -9), row - (c.lastRow ?? -9)) < spd * 0.3 ? stall + 1 : 0;
    const lastCol = col, lastRow = row;

    // Hungry: find the nearest plant it eats that it can walk to (looked up again every few seconds)
    // (It walks around the patch you're standing on, and plans again if it gets stuck.)
    if (cs !== "eat" && fullness < HUNGRY_AT && (cs !== "seek" || stall > 15 || (tick + c.id) % 100 === 0)) {
      stall = 0;
      const f = findFood({ ...c, col, row }, plants, map, Math.floor(player.col) + "," + Math.floor(player.row));
      if (f) { cs = "seek"; targetId = f.plant.id; path = f.path; }
      else if (cs === "seek") { cs = "wander"; targetId = null; path = null; }
    }
    if (cs === "seek") {
      const t = plants.find(p => p.id === targetId);
      if (!t || !edible(c, t)) { cs = "wander"; targetId = null; path = null; wanderTimer = 0; }
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
      else if (++biteTimer >= BITE_TICKS) {
        biteTimer = 0;
        const take = Math.max(0, Math.min(BITE / GRAZE_YIELD, t.energy - 0.05, (0.98 - fullness) / GRAZE_YIELD));
        fullness += take * GRAZE_YIELD;
        plants = plants.map((p, j) => j === i ? { ...p, energy: p.energy - take } : p);
      }
    }
    if (cs === "wander") {
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
    return { ...c, col, row, dcol, drow, path, stall, lastCol, lastRow, age, fullness, hp, habitat, wanderTimer, state: cs, targetId, biteTimer, stageId };
  });

  return {
    ...state, clock, player,
    plants: plants.filter(p => !p._remains),
    remains: (state.remains || []).map(r => { const f = plants.find(p => p._remains && p.id === r.id); return f ? { ...r, energy: f.energy } : r; }),
    creatures: softCollide(moved, player, map),
    floats: newFloats, events: [...events.slice(-30), ...newEvents], tick,
  };
}
