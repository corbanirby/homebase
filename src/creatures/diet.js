// ─── Diets (Behavior stage, part 4; decided Nov 22–23) ───────────────────────
// What each species eats, by life stage. Food comes in kinds:
//   graze  – plants it eats down (the leafy top; the plant regrows from its roots)
//   sap    – drinks from grown trees without hurting them (each tree's sap refills)
//   nectar – sips from grown wildflowers (each patch's nectar refills)
//   critters – kinds of critter it forages (10 make a meal)
//   remains – scavenges remains
//   sun    – Kudzoon: doesn't eat; fills up basking on open, sunny ground with decent soil
// If nothing it eats is anywhere at home, a hungry creature scrounges moss or cattail at
// half the value, so it stays alive (but hungry) until its home has the right food.
// Hand-feeding works with any food you carry; its own food first.
import { SPECIES, lifeStage } from "./species.jsx";

const D = {
  ramtarug:     { graze: ["bogmoss", "cattail", "kudzu", "wildflower"] },
  kudzoon:      { sun: true },
  thrummet:     { sap: ["oak", "pine"] },                         // nymphs drink from the roots, adults from the trunk
  scuffinch:    { critters: ["worm", "beetle", "cricket", "grub"], graze: ["wildflower"] }, // and seeds
  flintback:    { critters: ["beetle", "cricket", "ant"] },
  shoalclaw:    { graze: ["algae"], critters: ["snail"], remains: true },
  glimmerwick:  { nectar: ["wildflower"], baby: { critters: ["snail"] } }, // larvae hunt snails; adults sip nectar
  possumbra:    { graze: ["bogmoss", "cattail", "kudzu", "wildflower"], critters: ["worm", "beetle", "snail", "grub"], remains: true },
  clattershell: { critters: ["worm", "grub", "ant"], graze: ["cattail"] },  // and roots
  duskhowl:     { remains: true, hunts: true },                  // hunting comes in part 5
};
export const SCROUNGE = ["bogmoss", "cattail"];
export const SCROUNGE_YIELD = 0.5;

export function dietOf(c) {
  const d = D[c.species] || { graze: SPECIES[c.species]?.eats || SCROUNGE };
  const st = lifeStage(c).id;
  const over = d[st];
  const base = over ? { ...d, ...over, graze: over.graze ?? [], sap: over.sap ?? [], nectar: over.nectar ?? [] } : d;
  return { graze: base.graze || [], sap: base.sap || [], nectar: base.nectar || [], critters: base.critters || [], remains: !!base.remains, sun: !!base.sun, hunts: !!base.hunts };
}
// In words, for the card
export function dietWords(c) {
  const d = dietOf(c), out = [];
  if (d.sun) out.push("sun and soil");
  if (d.graze.length) out.push(d.graze.map(k => ({ bogmoss: "moss", cattail: "cattail", kudzu: "kudzu", wildflower: "wildflowers", algae: "algae" }[k] || k)).join(", "));
  if (d.sap.length) out.push("tree sap");
  if (d.nectar.length) out.push("flower nectar");
  if (d.critters.length) out.push(d.critters.map(k => ({ worm: "earthworms", beetle: "leaf beetles", snail: "snails", cricket: "crickets", grub: "grubs", ant: "ants" }[k])).join(", "));
  if (d.remains) out.push("remains");
  if (d.hunts) out.push("other creatures");
  return out.join("; ");
}
// The food items (gathered plants) it eats, for hand-feeding
export const itemFoods = c => { const d = dietOf(c); return [...d.graze, ...d.sap, ...d.nectar]; };
