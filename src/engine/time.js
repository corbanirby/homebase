import { MAX_CATCHUP_MS } from "../config.js";
import { growPlants } from "../plants/plants.js";
import { SPECIES, lifeStage } from "../creatures/species.jsx";
import { HOUR, STARVE_MS, HUNGRY_AT, WEAK_AT, habitatFit } from "../creatures/resident.js";

// ─── Catch-up ─────────────────────────────────────────────────────────────────
// Runs when you come back after the game was closed or hidden. Instead of
// replaying every step, the time away is worked through in one-hour slices:
// plants grow, then each creature ages, gets hungry and, if hungry, walks to
// the nearest plant it eats and grazes it. The land has its own catch-up.
// `ms` is world time (real time away, times the test speed).
export function catchUp(state, land, ms) {
  ms = Math.max(0, Math.min(ms, MAX_CATCHUP_MS));
  const plantStats = { sprouted: 0, matured: 0, spread: 0, died: 0 };
  if (ms < 1000) return { state, report: null, plantStats };

  let plants = state.plants;
  const grew = [], weakNow = new Set();
  let meals = 0;
  let creatures = state.creatures.map(c => ({ ...c }));
  for (let left = ms; left > 0; left -= HOUR) {
    const slice = Math.min(HOUR, left);
    const g = growPlants(plants, land, slice); plants = g.plants;
    for (const k in plantStats) plantStats[k] += g.stats[k];
    for (const c of creatures) {
      c.age += slice;
      const st = lifeStage(c);
      if (st.id !== c.stageId) { c.stageId = st.id; grew.push(`${c.name} grew into ${st.id === "baby" ? "a" : "an"} ${st.label.toLowerCase()}`); }
      c.fullness = Math.max(0, c.fullness - slice / STARVE_MS * (c.dna.metabolism ?? 1));
      if (c.hp < 1) c.hp = Math.min(1, c.hp + slice / (12 * HOUR));
      if (c.fullness < HUNGRY_AT) {
        // Graze the nearest plant it eats; it ends up standing beside it
        const eats = SPECIES[c.species]?.eats || [];
        let best = -1, bd = Infinity;
        plants.forEach((p, i) => { if (p.dead || p.stage < 2 || p.energy <= 0.2 || !eats.includes(p.species)) return; const d = Math.hypot(p.col - c.col, p.row - c.row); if (d < bd) { bd = d; best = i; } });
        if (best >= 0) {
          const p = plants[best], take = Math.min(p.energy - 0.05, 0.97 - c.fullness);
          if (take > 0) {
            c.fullness += take; meals++;
            plants = plants.map((q, i) => i === best ? { ...q, energy: q.energy - take } : q);
            c.col = p.col + (Math.random() - 0.5) * 0.6; c.row = p.row + 0.3; c.state = "wander"; c.targetId = null;
          }
        }
      }
      if (c.fullness < WEAK_AT) weakNow.add(c.name); else weakNow.delete(c.name);
      const cell = land?.cells[Math.floor(c.row)]?.[Math.floor(c.col)];
      c.habitat = habitatFit(c, cell) * 0.5 + (c.habitat ?? 1) * 0.5;
    }
  }

  const lines = [...grew];
  if (meals) lines.push(`Your creatures grazed ${meals} ${meals === 1 ? "time" : "times"}`);
  if (weakNow.size) lines.push(`${[...weakNow].join(" and ")} ${weakNow.size === 1 ? "is" : "are"} weak from hunger. More plants would help.`);
  return { state: { ...state, plants, creatures, clock: (state.clock || 0) + ms }, report: { awayMs: ms, lines }, plantStats };
}

export function formatDuration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "less than a minute";
  if (m < 60) return m + (m === 1 ? " minute" : " minutes");
  const h = Math.floor(m / 60);
  if (h < 24) return h + (h === 1 ? " hour" : " hours") + (m % 60 ? " " + (m % 60) + " min" : "");
  const d = Math.floor(h / 24);
  return d + (d === 1 ? " day" : " days") + (h % 24 ? " " + (h % 24) + " h" : "");
}
