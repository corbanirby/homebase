// ─── Part genes (appearance, in the background for now) ──────────────────────
// Every body part is a gene with two copies; the stronger-ranked copy shows (ties: the
// first). Each species' founder parts are written to match its finished sprite; a wild
// creature or a starter can carry a different hidden copy, so offspring can surprise.
// Parts don't change the drawing yet: the card describes them in words. Later, chosen
// parts get their own sprite variants, and the distance from the founder decides
// whether two creatures can still breed (speciation).
//
// rank: higher shows over lower. weight: how often it turns up as a hidden copy (0: only
// where a species lists it in FOUNDER_HIDDEN, so bird and insect parts never turn up on Ramtarug).
export const LOCI = {
  head:     { label: "Head",     alleles: { wideflat: { name: "wide, flat head", rank: 3, weight: 3 }, shortmuzzle: { name: "short muzzle", rank: 2, weight: 2 }, pointedsnout: { name: "pale, pointed snout", rank: 2, weight: 0 }, armoreddome: { name: "armoured dome head", rank: 1, weight: 1 } } },
  eyes:     { label: "Eyes",     alleles: { round: { name: "big round eyes", rank: 3, weight: 3 }, narrowfierce: { name: "narrow, fierce eyes", rank: 2, weight: 2 }, compound: { name: "compound eyes", rank: 1, weight: 1 }, bulgingred: { name: "big bulging red eyes", rank: 3, weight: 0 }, glossyblack: { name: "glossy black eyes", rank: 2, weight: 0 } } },
  pupils:   { label: "Pupils",   alleles: { bar: { name: "bar pupils", rank: 2, weight: 3 }, slit: { name: "slit pupils", rank: 1, weight: 1 }, dot: { name: "dot pupils", rank: 1, weight: 2 } } },
  ears:     { label: "Ears",     alleles: { round: { name: "round ears", rank: 3, weight: 3 }, pointed: { name: "pointed ears", rank: 2, weight: 2 }, none: { name: "no ears", rank: 1, weight: 1 } } },
  crown:    { label: "Crown",    alleles: { curledhorns: { name: "curled horns", rank: 3, weight: 3 }, gem: { name: "forehead gem", rank: 2, weight: 1 }, none: { name: "bare head", rank: 1, weight: 2 }, tuft: { name: "small crest tuft", rank: 1, weight: 0 } } },
  mouth:    { label: "Mouth",    alleles: { smile: { name: "wide smile", rank: 2, weight: 3 }, open: { name: "open mouth", rank: 1, weight: 1 }, curvedbill: { name: "long, curved bill", rank: 3, weight: 0 } } },
  back:     { label: "Back",     alleles: { none: { name: "plain back", rank: 2, weight: 3 }, rockshell: { name: "rock shell", rank: 1, weight: 1 }, wings: { name: "small wings", rank: 1, weight: 1 }, foldedwings: { name: "folded wings with white bars", rank: 3, weight: 0 }, roofwings: { name: "clear veined wings folded like a roof", rank: 3, weight: 0 } } },
  ridge:    { label: "Ridge",    alleles: { plates: { name: "dorsal plates", rank: 2, weight: 3 }, mane: { name: "mane down the back", rank: 1, weight: 1 }, none: { name: "smooth spine", rank: 1, weight: 1 } } },
  tail:     { label: "Tail",     alleles: { leaf: { name: "leaf tail", rank: 2, weight: 3 }, stub: { name: "stub tail", rank: 1, weight: 1 }, long: { name: "long tail", rank: 1, weight: 1 }, longupright: { name: "long upright tail", rank: 2, weight: 0 }, barepink: { name: "bare pink tail", rank: 2, weight: 0 } } },
  covering: { label: "Covering", alleles: { smooth: { name: "smooth skin", rank: 3, weight: 3 }, fur: { name: "short fur", rank: 2, weight: 1 }, scales: { name: "scales", rank: 1, weight: 1 }, feathers: { name: "feathers", rank: 3, weight: 0 }, shell: { name: "hard insect shell", rank: 3, weight: 0 } } },
  pattern:  { label: "Pattern",  alleles: { spots: { name: "spots", rank: 2, weight: 3 }, patches: { name: "patches", rank: 1, weight: 1 }, stripes: { name: "stripes", rank: 1, weight: 1 }, finestreaks: { name: "fine streaks", rank: 2, weight: 0 }, darkmarkings: { name: "black markings", rank: 2, weight: 0 } } },
  feet:     { label: "Feet",     alleles: { padded: { name: "padded paws", rank: 2, weight: 3 }, flat: { name: "flat paws", rank: 1, weight: 1 }, claws: { name: "clawed feet", rank: 1, weight: 1 }, jointedlegs: { name: "six jointed legs", rank: 2, weight: 0 }, diggingforelegs: { name: "big digging forelegs", rank: 1, weight: 0 } } },
  build:    { label: "Build",    alleles: { stocky: { name: "stocky build", rank: 2, weight: 3 }, lean: { name: "lean build", rank: 1, weight: 1 } } },
  antennae: { label: "Antennae", alleles: { short: { name: "short antennae", rank: 2, weight: 0 }, none: { name: "no antennae", rank: 1, weight: 0 } } },
  haze:     { label: "Haze",     alleles: { violet: { name: "violet haze clinging to the fur", rank: 2, weight: 0 }, none: { name: "no haze", rank: 1, weight: 0 } } },
  shimmer:  { label: "Shimmer",  alleles: { paleblue: { name: "pale-blue shimmer on the wing edges", rank: 2, weight: 0 }, none: { name: "no shimmer", rank: 1, weight: 0 } } },
};
// Founder parts per species, written from its finished sprite. Species without one have no part genes yet.
export const FOUNDERS = {
  // The current in-game Ramtarug: frog-like face, curled horns, orange spots
  ramtarug: { head: "wideflat", eyes: "round", pupils: "bar", ears: "round", crown: "curledhorns", mouth: "smile", back: "none", ridge: "plates", tail: "leaf", covering: "smooth", pattern: "spots", feet: "padded", build: "stocky" },
  // Brown thrasher: long curved bill, narrow fierce eyes, fine streaks on the breast
  scuffinch: { eyes: "narrowfierce", crown: "none", mouth: "curvedbill", back: "foldedwings", tail: "longupright", covering: "feathers", pattern: "finestreaks" },
  // Dog-day cicada: bulging red eyes, clear roofed wings with a pale-blue shimmer, olive shell with black markings
  thrummet: { eyes: "bulgingred", back: "roofwings", shimmer: "paleblue", antennae: "short", covering: "shell", pattern: "darkmarkings", feet: "jointedlegs" },
  // Opossum: pale pointed snout, glossy black eyes, round ears, bare pink tail, a violet haze on grey-white fur
  possumbra: { head: "pointedsnout", eyes: "glossyblack", ears: "round", tail: "barepink", covering: "fur", feet: "claws", haze: "violet" },
};
// Hidden copies a species can carry, by part; a species listed here carries only these
// (any other part stays the founder's). Species not listed draw from every option by weight.
export const FOUNDER_HIDDEN = {
  scuffinch: { crown: ["tuft"], pattern: ["spots"] },
  thrummet: { feet: ["diggingforelegs"] },
  possumbra: { ears: ["pointed"], haze: ["none"] },
};
export const MUTATE_PART = 0.02;
const loci = sp => Object.keys(FOUNDERS[sp] || {});
function weighted(locus, rnd = Math.random) {
  const e = Object.entries(LOCI[locus].alleles), tot = e.reduce((s, [, a]) => s + a.weight, 0);
  let r = rnd() * tot; for (const [id, a] of e) { r -= a.weight; if (r <= 0) return id; } return e[0][0];
}
// A wild creature or starter: the founder's parts, with a chance of a different hidden copy
export function founderParts(species, hiddenChance = 0.35) {
  const f = FOUNDERS[species]; if (!f) return null;
  const parts = {};
  const hid = FOUNDER_HIDDEN[species];
  const hiddenCopy = k => !hid ? weighted(k) : hid[k] ? hid[k][Math.floor(Math.random() * hid[k].length)] : f[k];
  for (const k of loci(species)) parts[k] = [f[k], Math.random() < hiddenChance ? hiddenCopy(k) : f[k]];
  return parts;
}
// A child: one copy from each parent (either of their two), with a small chance a copy mutates
export function childParts(mom, dad) {
  if (!mom?.parts || !dad?.parts) return mom?.parts ? founderParts(mom.species) : null;
  const parts = {};
  for (const k of Object.keys(mom.parts)) {
    const pick = (p) => { let v = p.parts[k][Math.random() < 0.5 ? 0 : 1]; if (Math.random() < MUTATE_PART) v = weighted(k); return v; };
    parts[k] = [pick(mom), dad.parts[k] ? pick(dad) : pick(mom)];
  }
  return parts;
}
// What shows: the stronger copy
export function shownParts(parts) {
  if (!parts) return null;
  const out = {};
  for (const [k, [a, b]] of Object.entries(parts)) {
    const al = LOCI[k]?.alleles || {};
    out[k] = (al[b]?.rank ?? 0) > (al[a]?.rank ?? 0) ? b : a;
  }
  return out;
}
// What it carries but doesn't show
export function hiddenParts(parts) {
  const shown = shownParts(parts) || {}, out = [];
  for (const [k, pair] of Object.entries(parts || {})) for (const v of new Set(pair)) if (v !== shown[k]) out.push({ locus: k, allele: v });
  return out;
}
export const partName = (locus, id) => LOCI[locus]?.alleles?.[id]?.name || id;
// How far its looks have drifted from its species' founder (for breeding limits later)
export function founderDistance(c) {
  const f = FOUNDERS[c.species], shown = shownParts(c.parts); if (!f || !shown) return 0;
  return Object.keys(f).filter(k => shown[k] !== f[k]).length;
}
// Older saves and creatures made before part genes: give them founder parts
export const ensureParts = c => (c.isEgg || c.parts || !FOUNDERS[c.species] ? c : { ...c, parts: founderParts(c.species) });
