import { deriveMoves } from "./moves.js";
import { lifeStage, speciesOf } from "../creatures/species.jsx";

// ─── Type chart (from the design doc's 13-type table, attacking side) ─────────
// Each attack type lists what it hits for 2×, ½ and no effect. Matchups don't have
// to mirror. Against a creature with two types, the two multipliers multiply.
const T = (strong, weak, none = []) => ({ strong, weak, none });
export const TYPE_CHART = {
  Normal:   T([], ["Metal"], ["Spirit"]),
  Fire:     T(["Plant","Bug","Ice","Metal","Fungus"], ["Water","Earth","Fire"]),
  Water:    T(["Fire","Earth","Metal","Poison"], ["Plant","Water","Fungus","Ice"]),
  Plant:    T(["Water","Earth"], ["Fire","Metal","Plant","Air","Bug"]),
  Electric: T(["Water","Air","Metal"], ["Plant","Electric"], ["Earth"]),
  Ice:      T(["Plant","Air","Earth"], ["Fire","Metal","Water","Ice"]),
  Earth:    T(["Fire","Electric","Poison"], ["Water","Plant","Fungus","Bug"], ["Air"]),
  Air:      T(["Bug","Plant"], ["Electric","Ice","Earth","Metal"]),
  Bug:      T(["Plant","Fungus"], ["Fire","Air","Poison","Metal"]),
  Poison:   T(["Plant","Bug","Water","Fungus"], ["Earth","Poison","Spirit"], ["Metal"]),
  Metal:    T(["Ice"], ["Fire","Electric","Metal"]),
  Spirit:   T(["Normal","Spirit"], ["Metal","Bug","Fungus","Plant"]),
  Fungus:   T(["Plant","Bug"], ["Fire","Fungus","Air"]),
};
// Move types still use the old names until moves are renamed in stage 8
const MOVE_TYPE = { normal:"Normal", fire:"Fire", water:"Water", grass:"Plant", electric:"Electric", ice:"Ice",
  poison:"Poison", rock:"Earth", ground:"Earth", dark:"Spirit", ghost:"Spirit", bug:"Bug", flying:"Air", steel:"Metal" };
export const moveType = m => MOVE_TYPE[m?.type] || "Normal";
export function typeMultiplier(atkType, defTypes) {
  const row = TYPE_CHART[atkType]; if (!row) return 1;
  return (defTypes || []).reduce((k, t) => k * (row.none.includes(t) ? 0 : row.strong.includes(t) ? 2 : row.weak.includes(t) ? 0.5 : 1), 1);
}
export const SAME_TYPE_BONUS = 1.25; // using a move of your own type

// Life stage strength (from the design doc): babies about 50%, adolescents 80%,
// adults 100%, elders lose some strength and speed. Condition adds or takes up to 10%.
const STAGE_POWER = { baby:0.5, adolescent:0.8, adult:1, elder:1 };
function conditionFactor(c){
  const food=Math.min(1,(c.fullness??1)/0.6);
  const cond=Math.max(0,Math.min(1,food*0.5+(c.hp??1)*0.2+(c.habitat??1)*0.3));
  return 0.9+cond*0.2;
}

// ─── Battle helpers ───────────────────────────────────────────────────────────
export function makeBattler(c) {
  const lv=c.level||1;
  const st=lifeStage(c).id, k=(STAGE_POWER[st]||1)*conditionFactor(c), old=st==="elder"?0.85:1;
  const maxHp=Math.max(6,Math.floor((20+lv*8+c.dna.size*10)*(c.dna.hpRange??1)*k));
  // If creature already has battleHp from a previous swap, use it.
  // Otherwise derive from world hp (0-1 float).
  const battleHp = c.battleHp!=null ? c.battleHp : Math.floor((c.hp||1)*maxHp);
  return { ...c, level:lv, moves:c.moves||deriveMoves(c.dna), types:speciesOf(c).types||["Normal"],
    maxHp, battleHp,
    atk:Math.max(1,Math.floor((5+lv*3+c.dna.strength*8)*k*old)),
    def:Math.max(1,Math.floor((3+lv*2+c.dna.size*5)*k)),
    spd:Math.max(1,Math.floor((3+lv*2+c.dna.speed*6)*k*old)),
    status:null, statMods:{atk:0,def:0,spd:0} };
}
export function applyStatMod(base,mod) {
  const t=[0.25,0.28,0.33,0.4,0.5,0.66,1,1.5,2,2.5,3,3.5,4];
  return Math.floor(base*t[mod+6]);
}
export function executeBattleMove(atk,def,move) {
  const msgs=[];
  let ac={...atk,statMods:{...atk.statMods}}, dc={...def,statMods:{...def.statMods}};
  if (atk.status==="paralyze"&&Math.random()<0.25){msgs.push("Paralyzed! Can't move!");return{newAttacker:ac,newDefender:dc,msgs};}
  if (atk.status==="freeze"&&Math.random()<0.5){msgs.push("Frozen solid!");return{newAttacker:ac,newDefender:dc,msgs};}
  msgs.push("Used "+move.name+"!");
  if (Math.random()>move.acc){msgs.push("Missed!");return{newAttacker:ac,newDefender:dc,msgs};}
  if (move.effect==="heal"){const h=Math.floor(ac.maxHp*0.4);ac.battleHp=Math.min(ac.maxHp,ac.battleHp+h);msgs.push("Restored "+h+" HP!");return{newAttacker:ac,newDefender:dc,msgs};}
  if (move.effect==="raise_def"){ac.statMods.def=Math.min(3,ac.statMods.def+1);msgs.push("Defense rose!");return{newAttacker:ac,newDefender:dc,msgs};}
  if (move.effect==="lower_atk"){dc.statMods.atk=Math.max(-3,dc.statMods.atk-1);msgs.push("Foe's Attack fell!");}
  if (move.effect==="lower_def"){dc.statMods.def=Math.max(-3,dc.statMods.def-1);msgs.push("Foe's Defense fell!");}
  if (move.effect==="lower_spd"){dc.statMods.spd=Math.max(-3,dc.statMods.spd-1);msgs.push("Foe's Speed fell!");}
  if (move.power>0) {
    const mt=moveType(move), k=typeMultiplier(mt,dc.types);
    if (k===0) { msgs.push("It has no effect…"); return {newAttacker:ac,newDefender:dc,msgs}; }
    const stab=(ac.types||[]).includes(mt)?SAME_TYPE_BONUS:1;
    const ea=applyStatMod(ac.atk,ac.statMods.atk), ed=applyStatMod(dc.def,dc.statMods.def);
    const dmg=Math.max(1,Math.floor((ea/ed)*move.power*0.18*k*stab*(0.85+Math.random()*0.15)));
    dc.battleHp=Math.max(0,dc.battleHp-dmg); msgs.push("Hit for "+dmg+"!");
    if (k>1) msgs.push(k>=4?"It's devastating!":"It's super effective!");
    else if (k<1) msgs.push("It's not very effective…");
  }
  if (move.effect==="burn"&&!dc.status&&Math.random()<0.3){dc.status="burn";msgs.push("Burned!");}
  if (move.effect==="poison"&&!dc.status&&Math.random()<0.3){dc.status="poison";msgs.push("Poisoned!");}
  if (move.effect==="paralyze"&&!dc.status&&Math.random()<0.3){dc.status="paralyze";msgs.push("Paralyzed!");}
  if (move.effect==="freeze"&&!dc.status&&Math.random()<0.2){dc.status="freeze";msgs.push("Frozen!");}
  return {newAttacker:ac,newDefender:dc,msgs};
}
export function applyEndOfTurn(b) {
  if (!b.status||b.status==="paralyze"||b.status==="freeze") return {b,msg:null};
  const dmg=Math.max(1,Math.floor(b.maxHp*0.0625));
  return {b:{...b,battleHp:Math.max(0,b.battleHp-dmg)},msg:(b.status==="burn"?"🔥":"☠️")+" "+dmg+" from "+b.status};
}
export function aiPickMove(enemy,player) {
  const mvs=enemy.moves;
  if (enemy.battleHp<enemy.maxHp*0.3){const h=mvs.find(m=>m.effect==="heal");if(h)return h;}
  return [...mvs].sort((a,b)=>b.power-a.power)[0]||mvs[0];
}
