import { MAX_CATCHUP_MS } from "../config.js";
import { growPlants, eatPlant } from "../plants/plants.js";
import { growCritters, eatCritters, countOn } from "../sim/critters.js";
import { dietOf, SCROUNGE, SCROUNGE_YIELD } from "../creatures/diet.js";
import { sunGain } from "../sim/home.js";
import { SPECIES, lifeStage } from "../creatures/species.jsx";
import { HOUR, HUNGRY_AT, WEAK_AT, habitatFit, hungerRate } from "../creatures/resident.js";
import { stepBreeding, nestFinder } from "../creatures/breeding.js";
import { stepMortality, applyDeaths, stepRemains } from "../creatures/death.js";
import { tickStatuses, restoreStamina, canHeal } from "../battle/statuses.js";

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

  let plants = state.plants, critters = state.critters || {};
  const grew = [], weakNow = new Set();
  let meals = 0;
  let creatures = state.creatures.map(c => ({ ...c }));
  const laid = [], hatched = [], paired = [], deaths = [], failed = [];
  let rest = { vine: state.vine, pack: state.pack, holding: state.holding, trip: state.trip, remembered: state.remembered || [], remains: state.remains || [] };
  const nest = nestFinder(land);
  let t = state.clock || 0;
  for (let left = ms; left > 0; left -= HOUR) {
    const slice = Math.min(HOUR, left);
    const g = growPlants(plants, land, slice); plants = g.plants;
    const gc = growCritters(critters, land, plants, rest.remains, slice); critters = gc.colonies; plants = gc.plants;
    for (const k in plantStats) plantStats[k] += g.stats[k];
    for (const c of creatures) {
      if (c.isEgg) continue;
      c.age += slice;
      const st = lifeStage(c);
      if (st.id !== c.stageId) { c.stageId = st.id; grew.push(`${c.name} grew into ${st.id === "baby" ? "a" : "an"} ${st.label.toLowerCase()}`); }
      c.fullness = Math.max(0, c.fullness - slice * hungerRate(c));
      if (c.hp < 1 && canHeal(c)) c.hp = Math.min(1, c.hp + slice / (3 * HOUR));
      if (c.statuses?.length) Object.assign(c, tickStatuses(c, slice, 2, { home: true }));
      if ((c.stamina ?? 1) < 1 || c.fatigued) Object.assign(c, restoreStamina(c, slice, 2));
      // Eating by diet: Kudzoon basks; insect-eaters forage the nearest colony with enough of
      // what they eat; others graze, drink sap or sip nectar at the nearest plant they eat;
      // with nothing they eat at home, they scrounge moss or cattail at half the value
      const dt = dietOf(c);
      if (dt.sun) c.fullness = Math.min(1, c.fullness + slice * sunGain(land?.cells[Math.floor(c.row)]?.[Math.floor(c.col)]));
      if (c.fullness < HUNGRY_AT && dt.critters.length) {
        let bk = null, bd = Infinity;
        for (const key of Object.keys(critters)) { if (countOn(critters, key, dt.critters) < 3) continue; const [x, y] = key.split(",").map(Number), d = Math.hypot(x + 0.5 - c.col, y + 0.5 - c.row); if (d < bd) { bd = d; bk = key; } }
        if (bk) {
          const r = eatCritters(critters, bk, dt.critters, c.fullness, 0.97);
          if (r.gained > 0) {
            critters = r.colonies; c.fullness += r.gained; if (canHeal(c)) c.hp = Math.min(1, c.hp + r.gained * 0.5); meals++;
            const [x, y] = bk.split(",").map(Number); c.col = x + 0.5; c.row = y + 0.6; c.state = "wander"; c.targetId = null;
          }
        }
      }
      if (c.fullness < HUNGRY_AT && !dt.sun) {
        const howOf = (p, scrounge) => {
          if (p.dead || p.stage < 2) return null;
          if (dt.sap.includes(p.species)) return p.stage === 3 && p.energy > 0.2 ? "sap" : null;
          if (dt.nectar.includes(p.species)) return p.stage === 3 && (p.nectar ?? 1) > 0.2 ? "nectar" : null;
          if (dt.graze.includes(p.species)) return p.energy > 0.2 ? "graze" : null;
          return scrounge && SCROUNGE.includes(p.species) && p.energy > 0.2 ? "scrounge" : null;
        };
        const nearest = scrounge => { let best = -1, bd = Infinity, how = null; plants.forEach((p, i) => { const h = howOf(p, scrounge); if (!h) return; const d = Math.hypot(p.col - c.col, p.row - c.row); if (d < bd) { bd = d; best = i; how = h; } }); return { best, how }; };
        let { best, how } = nearest(false);
        if (best < 0 && !dt.critters.length && !dt.remains) ({ best, how } = nearest(true));
        else if (best < 0 && c.fullness < WEAK_AT * 2) ({ best, how } = nearest(true));
        if (best >= 0) {
          const p = plants[best], r = eatPlant(p, c.fullness, 0.97, how === "sap" ? "sap" : how === "nectar" ? "nectar" : "graze", how === "scrounge" ? SCROUNGE_YIELD : 1, how === "sap" && lifeStage(c).id === "baby");
          if (r.gained > 0) {
            c.fullness += r.gained; if (canHeal(c)) c.hp = Math.min(1, c.hp + r.gained * 0.5); meals++;
            plants = plants.map((q, i) => i === best ? r.plant : q).filter(q => !q.dead);
            c.col = p.col + (Math.random() - 0.5) * 0.6; c.row = p.row + 0.3; c.state = "wander"; c.targetId = null;
          }
        }
      }
      if (c.fullness < WEAK_AT) weakNow.add(c.name); else weakNow.delete(c.name);
      const cell = land?.cells[Math.floor(c.row)]?.[Math.floor(c.col)];
      c.habitat = habitatFit(c, cell) * 0.5 + (c.habitat ?? 1) * 0.5;
    }
    // Pairs court, lay and eggs hatch
    t += slice;
    const b = stepBreeding(creatures, land, slice, t, { away: true, nest });
    creatures = b.creatures;
    for (const e of b.events) (e.type === "laid" ? laid : e.type === "hatched" ? hatched : e.type === "eggFailed" ? failed : paired).push(e);
    // Old age and hunger; remains feed the plants around them and then fade
    const m = stepMortality(creatures, slice);
    const d = applyDeaths({ ...rest, creatures: m.alive }, m.died, t);
    creatures = d.state.creatures; deaths.push(...d.lines);
    rest = { vine: d.state.vine, pack: d.state.pack, holding: d.state.holding, trip: d.state.trip, remembered: d.state.remembered, remains: d.state.remains };
    const rm = stepRemains(rest.remains, plants, land, slice, t);
    rest.remains = rm.remains; plants = rm.plants;
  }

  const lines = [...deaths, ...grew];
  if (failed.length) lines.push(`${failed.length} ${failed.length === 1 ? "egg" : "eggs"} didn't make it on ground that didn't suit ${failed.length === 1 ? "it" : "them"}`);
  for (const p of paired) lines.push(`${p.a} and ${p.b} paired up`);
  for (const l of laid) lines.push(`${l.mother} laid ${l.n} ${l.n === 1 ? "egg" : "eggs"}`);
  if (hatched.length) lines.push(`${hatched.length} ${hatched.length === 1 ? "egg" : "eggs"} hatched: ${hatched.map(h => h.name).join(", ")}`);
  if (meals) lines.push(`Your creatures grazed ${meals} ${meals === 1 ? "time" : "times"}`);
  const alive = new Set(creatures.map(c => c.name)), weakLeft = [...weakNow].filter(n => alive.has(n));
  if (weakLeft.length) lines.push(`${weakLeft.join(" and ")} ${weakLeft.length === 1 ? "is" : "are"} weak from hunger. Feed ${weakLeft.length === 1 ? "it" : "them"} soon or ${weakLeft.length === 1 ? "it" : "they"} will starve; more plants would help.`);
  return { state: { ...state, ...rest, plants, critters, surfaced: [], creatures, clock: (state.clock || 0) + ms }, report: { awayMs: ms, lines }, plantStats };
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
