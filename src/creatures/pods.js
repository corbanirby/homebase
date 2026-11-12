import { newId } from "../engine/ids.js";
import { SPECIES } from "./species.jsx";
import { PLANT_SPECIES, fitOf } from "../plants/plants.js";

// ─── Pods ─────────────────────────────────────────────────────────────────────
// A pod is a creature's own small world. Every creature you carry has one; empty
// pods are what you catch with, and they don't take space in your bag. Pods come
// in sizes by seed type (small, medium, large) and carry the biome they grew in.
// Once a pod holds a creature it grows with it, so size only matters when catching.
export const POD_SIZES = ["small", "medium", "large"];
export const POD_FOOD_MAX = 3;
export const BIOME_LABEL = { wetland: "marsh" };
export const POD_ICON_COLOR = { wetland: "#b9c97a", forest: "#8fbf5a", pine: "#c9a46a", stone: "#b8b8c0" };
export const podName = p => `${p.size[0].toUpperCase() + p.size.slice(1)} ${BIOME_LABEL[p.biome] || p.biome} pod`;
export const makePod = (size, biome = "wetland", creatureId = null) => ({ id: newId(), size, biome, creatureId, food: 0 });

// The size a species grows to: small, medium or large
export function sizeClass(speciesId) {
  const m = SPECIES[speciesId]?.sizeMul ?? 1;
  return m <= 0.75 ? "small" : m <= 1.1 ? "medium" : "large";
}
// Which Atlanta land counts as each pod biome
const BIOME_LANDS = { wetland: ["creek", "shoal", "river"], forest: ["forest"], pine: ["pine", "clay"], stone: ["granite"] };
// How well a pod suits a species, as a catch multiplier: size (a cramped pod is worse
// than a roomy one) times biome (a pod from its own kind of land is best)
export function podFit(pod, speciesId) {
  const d = POD_SIZES.indexOf(pod.size) - POD_SIZES.indexOf(sizeClass(speciesId));
  const size = d === 0 ? 1 : d === 1 ? 0.8 : d >= 2 ? 0.6 : d === -1 ? 0.5 : 0.25;
  const sp = SPECIES[speciesId] || {};
  const native = speciesId === "ramtarug" && pod.biome === "wetland" ? 1 : 0;
  const aff = Math.max(native, ...(BIOME_LANDS[pod.biome] || []).map(b => sp.biomes?.[b] || 0));
  const biome = 0.6 + 0.6 * aff;
  return size * biome;
}
export const fitLabel = k => k >= 1 ? "Great fit" : k >= 0.75 ? "Good fit" : k >= 0.5 ? "Poor fit" : "Bad fit";
// The empty pod that suits a species best
export function bestPod(pods, speciesId) {
  return pods.filter(p => p.creatureId == null).sort((a, b) => podFit(b, speciesId) - podFit(a, speciesId))[0] || null;
}

// Picking a ripe pod plant: more pods from a plant in a better spot (1 to 3), then it regrows them
export function podsFromPlant(plant, cell) {
  const sp = PLANT_SPECIES[plant.species];
  const fit = fitOf(plant.species, cell);
  const n = fit >= 0.8 ? 3 : fit >= 0.45 ? 2 : 1;
  return Array.from({ length: n }, () => makePod(sp.pod, sp.biome));
}

// New homebases (and older saves) start with a pod for each creature and 9 empty pods (4 small, 3 medium, 2 large)
export function starterPods(creatures) {
  const pods = [];
  const owned = creatures.filter(c => !c.isEgg).map(c => {
    const p = makePod(sizeClass(c.species), "wetland", c.id); pods.push(p);
    return { ...c, podId: p.id };
  });
  for (const s of ["small", "small", "small", "small", "medium", "medium", "medium", "large", "large"]) pods.push(makePod(s));
  return { pods, creatures: owned };
}
// Pods are the seeds of pod plants: plant an empty pod and it grows into a pod plant of
// its size. Older saves had separate pod seeds; they become empty pods.
export const POD_PLANT = { small: "podsmall", medium: "podmedium", large: "podlarge" };
export function podSeedsToPods(state) {
  const seeds = { ...(state.seeds || {}) }, pods = [...(state.pods || [])];
  let changed = false;
  for (const [size, id] of Object.entries(POD_PLANT)) {
    if (seeds[id] == null) continue;
    for (let i = 0; i < seeds[id]; i++) pods.push(makePod(size));
    delete seeds[id]; changed = true;
  }
  return changed ? { ...state, seeds, pods } : state;
}
