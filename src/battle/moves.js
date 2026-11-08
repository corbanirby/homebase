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
