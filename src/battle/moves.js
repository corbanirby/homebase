// ─── Move pool ────────────────────────────────────────────────────────────────
export const MOVE_POOL = [
  { id:"tackle",    name:"Tackle",      power:40,  acc:1.00, type:"normal",   effect:null },
  { id:"scratch",   name:"Scratch",     power:40,  acc:1.00, type:"normal",   effect:null },
  { id:"growl",     name:"Growl",       power:0,   acc:1.00, type:"normal",   effect:"lower_atk" },
  { id:"headbutt",  name:"Headbutt",    power:70,  acc:1.00, type:"normal",   effect:null },
  { id:"slam",      name:"Slam",        power:80,  acc:0.75, type:"normal",   effect:null },
  { id:"ember",     name:"Ember",       power:40,  acc:1.00, type:"fire",     effect:"burn" },
  { id:"flamethrower",name:"Flamethrower",power:90,acc:1.00,type:"fire",     effect:"burn" },
  { id:"bubble",    name:"Bubble",      power:40,  acc:1.00, type:"water",    effect:"lower_spd" },
  { id:"surf",      name:"Surf",        power:90,  acc:1.00, type:"water",    effect:null },
  { id:"vinewhip",  name:"Vine Whip",   power:45,  acc:1.00, type:"grass",    effect:null },
  { id:"razorleaf", name:"Razor Leaf",  power:55,  acc:0.95, type:"grass",    effect:null },
  { id:"thunder",   name:"Thunder",     power:110, acc:0.70, type:"electric", effect:"paralyze" },
  { id:"spark",     name:"Spark",       power:65,  acc:1.00, type:"electric", effect:"paralyze" },
  { id:"icefang",   name:"Ice Fang",    power:65,  acc:0.95, type:"ice",      effect:"freeze" },
  { id:"blizzard",  name:"Blizzard",    power:110, acc:0.70, type:"ice",      effect:"freeze" },
  { id:"poisonsting",name:"Poison Sting",power:15, acc:1.00, type:"poison",   effect:"poison" },
  { id:"sludge",    name:"Sludge",      power:65,  acc:1.00, type:"poison",   effect:"poison" },
  { id:"rockthrow", name:"Rock Throw",  power:50,  acc:0.90, type:"rock",     effect:null },
  { id:"rockblast", name:"Rock Blast",  power:75,  acc:0.90, type:"rock",     effect:null },
  { id:"recover",   name:"Recover",     power:0,   acc:1.00, type:"normal",   effect:"heal" },
  { id:"harden",    name:"Harden",      power:0,   acc:1.00, type:"normal",   effect:"raise_def" },
  { id:"bite",      name:"Bite",        power:60,  acc:1.00, type:"dark",     effect:null },
  { id:"crunch",    name:"Crunch",      power:80,  acc:1.00, type:"dark",     effect:"lower_def" },
];
export const TYPE_COLORS = {
  normal:"#a8a878", fire:"#f08030", water:"#6890f0", grass:"#78c850",
  electric:"#f8d030", ice:"#98d8d8", poison:"#a040a0", rock:"#b8a038", dark:"#705848",
};

// A first move that fits each type (move names and types are placeholders until stage 8)
const TYPE_FIRST_MOVE = { Plant:"vinewhip", Water:"bubble", Fire:"ember", Electric:"spark", Poison:"poisonsting",
  Earth:"rockthrow", Spirit:"bite", Metal:"harden", Bug:"scratch", Air:"growl", Normal:"tackle" };
export function deriveMoves(dna, types = null) {
  const weak = MOVE_POOL.filter(m => m.type === "normal" && m.power > 0 && m.power <= 45);
  const pick = pool => pool[Math.floor(Math.random() * pool.length)];
  const first = pick(weak) || MOVE_POOL[0];
  const typed = (types || []).map(t => MOVE_POOL.find(m => m.id === TYPE_FIRST_MOVE[t])).find(m => m && m.id !== first.id);
  return typed ? [first, typed] : [first];
}

export function learnMoveAtLevel(dna, level, knownMoves) {
  const learnLevels = [3,5,8,12,17,23,30];
  if (!learnLevels.includes(level)) return null;
  const maxPower = level>=17?999:level>=12?110:level>=8?90:level>=5?65:45;
  const knownIds = new Set((knownMoves||[]).map(m=>m.id));
  const scored = MOVE_POOL.filter(m => !knownIds.has(m.id) && m.power <= maxPower).map(m => {
    let s = 1;
    if (dna.aggression>0.6 && ['fire','dark','rock','electric'].includes(m.type)) s+=3;
    if (dna.aggression<0.4 && (m.effect==='heal'||m.effect==='raise_def'||m.effect==='lower_atk')) s+=3;
    if (dna.strength>0.6 && m.power>=65) s+=2;
    const ht=['water','grass','ice','poison'];
    if (m.type===ht[Math.floor((dna.hue%360)/90)]) s+=2;
    return {m,s};
  }).sort((a,b)=>b.s-a.s);
  if (!scored.length) return null;
  const top = scored.slice(0,Math.min(3,scored.length));
  return top[Math.floor(Math.random()*top.length)].m;
}

// ─── Stage 9: learnsets, bring 4, mastery ─────────────────────────────────────
import { MOVES } from "./movelist.js";
import { SPECIES, lifeStage } from "../creatures/species.jsx";
Object.assign(TYPE_COLORS, {
  Normal:"#a8a878", Fire:"#f08030", Water:"#6890f0", Plant:"#78c850", Electric:"#f8d030", Ice:"#98d8d8",
  Poison:"#b05ad0", Earth:"#b8a038", Air:"#a890f0", Bug:"#a8b820", Spirit:"#8a7aa8", Metal:"#b8b8d0", Fungus:"#c08a6a",
});
export const moveById = id => MOVES[id] || MOVE_POOL.find(m => m.id === id) || null;
// Stamina a move costs (moves from before stage 9 cost by their power)
export const staminaCost = m => m.stamina ?? (m.power > 0 ? Math.round(m.power / 8) : 5);
export const isLight = m => staminaCost(m) <= 5;
// Mastery: Novice, Practiced, Mastered — each step about 10% more power and accuracy
export const MASTERY = [{ name: "Novice", at: 0 }, { name: "Practiced", at: 15 }, { name: "Mastered", at: 50 }];
export const masteryTier = uses => (uses >= MASTERY[2].at ? 2 : uses >= MASTERY[1].at ? 1 : 0);

const STAGE_ORDER = { baby: 0, adolescent: 1, adult: 2, elder: 3 };
export const hasLearnset = c => !!SPECIES[c.species]?.learnset;
// The species' moves a creature has earned: its level is high enough and it has reached the stage
export function earnedMoves(c, lv = c.level || 1) {
  const ls = SPECIES[c.species]?.learnset || [], st = STAGE_ORDER[lifeStage(c).id] ?? 0;
  return ls.filter(e => e.lv <= lv && (STAGE_ORDER[e.stage] ?? 0) <= st).map(e => e.move);
}
// Set a creature up on its species' list (new creatures, and older saves the first time)
export function initLearnset(c, extra = []) {
  if (!hasLearnset(c)) return c;
  const learned = [...new Set([...earnedMoves(c), ...extra.filter(id => moveById(id))])];
  const pick = [...learned].reverse().slice(0, 4).reverse();
  return { ...c, learned, moves: pick.map(moveById), mastery: c.mastery || {}, learnsetV: 1 };
}
// Keep move details current with the move list (older saves stored copies)
export const refreshMoves = c => (c.moves ? { ...c, moves: c.moves.map(m => MOVES[m.id] || m) } : c);
// On a level-up: species with a list learn whatever they've newly earned (and equip it if there's room);
// the rest still pick up moves the old way
export function levelUpMoves(c, newLevel) {
  if (newLevel <= (c.level || 1)) return { moves: c.moves || [], learned: c.learned, names: [] };
  if (hasLearnset(c)) {
    const known = new Set(c.learned || []), fresh = earnedMoves(c, newLevel).filter(id => !known.has(id));
    let moves = [...(c.moves || [])];
    for (const id of fresh) if (moves.length < 4) moves.push(moveById(id));
    return { moves, learned: [...(c.learned || []), ...fresh], names: fresh.map(id => moveById(id).name) };
  }
  let moves = c.moves || [], names = [];
  for (let l = (c.level || 1) + 1; l <= newLevel; l++) {
    const m = learnMoveAtLevel(c.dna, l, moves);
    if (m) { moves = moves.length < 4 ? [...moves, m] : [moves[0], ...moves.slice(2), m]; names.push(m.name); }
  }
  return { moves, learned: c.learned, names };
}
