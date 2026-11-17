import { deriveMoves, staminaCost, isLight, masteryTier } from "./moves.js";
import { STATUS, addStatus, tickTurn, level, has, toBattle, maxStamina, FEAR_CHANCE, BLIND_ACC, CONFUSE_CHANCE, STAMINA_TIRING, STAMINA_BACK, statusText } from "./statuses.js";
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
export const moveType = m => MOVE_TYPE[m?.type] || (TYPE_CHART[m?.type] ? m.type : "Normal");
export function typeMultiplier(atkType, defTypes) {
  const row = TYPE_CHART[atkType]; if (!row) return 1;
  return (defTypes || []).reduce((k, t) => k * (row.none.includes(t) ? 0 : row.strong.includes(t) ? 2 : row.weak.includes(t) ? 0.5 : 1), 1);
}
export const SAME_TYPE_BONUS = 1.25; // using a move of your own type

// Life stage strength: babies 70%, adolescents 85% (about Pokémon's first-to-final evolution gap),
// adults 100%, elders lose some strength and speed. Condition adds or takes up to 10%.
const STAGE_POWER = { baby:0.7, adolescent:0.85, adult:1, elder:1 };
function conditionFactor(c){
  const food=Math.min(1,(c.fullness??1)/0.6);
  const cond=Math.max(0,Math.min(1,food*0.5+(c.hp??1)*0.2+(c.habitat??1)*0.3));
  return 0.9+cond*0.2;
}

// ─── Battle helpers ───────────────────────────────────────────────────────────
// Six stats: HP, Attack (physical moves), Defense (against physical), Elemental (type
// moves), Resistance (against type moves) and Speed (who acts first, a small dodge chance).
// Each stat = species base × genes × level × life stage × condition (× habitat advantage).
// Genes multiply the growth from levels, so a well-bred line stays ahead at every level.
const GENE_RANGE = { size:[0.7,1.3], strength:[0.4,1.0], speed:[0.6,1.4], hpRange:[0.5,1.5], elemental:[0.6,1.4], resistance:[0.6,1.4] };
// A gene's place in its range, as a multiplier from 0.75 (lowest) to 1.25 (highest)
const g = (c, key) => { const [lo, hi] = GENE_RANGE[key], v = c.dna[key] ?? (lo + hi) / 2; return 0.75 + 0.5 * Math.max(0, Math.min(1, (v - lo) / (hi - lo))); };
// Land each species fights best on (the habitat advantage): its Atlanta land, or for Ramtarug the wet ground
const WET = ["creek", "shoal", "river"];
export function habitatAdvantage(c, biome) {
  if (!biome) return 1;
  const sp = speciesOf(c);
  const likes = sp.biomes ? (sp.biomes[biome] || 0) : (WET.includes(biome) ? 1 : 0);
  return likes >= 0.6 ? 1.1 : 1;
}
export function battleStats(c, biome = null) {
  const lv = c.level || 1, base = speciesOf(c).base || {};
  const st = lifeStage(c).id, k = (STAGE_POWER[st] || 1) * conditionFactor(c) * habitatAdvantage(c, biome);
  // Elders: each species sets how its stats change (default: Attack, Elemental and Speed −15%)
  const eld = speciesOf(c).elder || { atk: 0.85, ele: 0.85, spd: 0.85 };
  const b = key => (base[key] ?? 1) * (st === "elder" ? eld[key] ?? 1 : 1);
  return {
    maxHp: Math.max(6, Math.floor((18 + lv * 8) * b("hp") * g(c, "hpRange") * (0.5 + 0.5 * g(c, "size")) * k)),
    atk: Math.max(1, Math.floor((5 + lv * 3) * b("atk") * g(c, "strength") * k)),
    def: Math.max(1, Math.floor((4 + lv * 2.5) * b("def") * g(c, "size") * k)),
    ele: Math.max(1, Math.floor((5 + lv * 3) * b("ele") * g(c, "elemental") * k)),
    res: Math.max(1, Math.floor((4 + lv * 2.5) * b("res") * g(c, "resistance") * k)),
    spd: Math.max(1, Math.floor((4 + lv * 2.5) * b("spd") * g(c, "speed") * k)),
  };
}
// A creature in battle. `carry` is what it had when it was last switched out this battle
// (stat stages, statuses, stamina stay with it on the bench).
export function makeBattler(c, biome = null, carry = null) {
  const lv=c.level||1, s=battleStats(c, biome), sp=speciesOf(c), maxSta=maxStamina(c, sp);
  const battleHp = c.battleHp!=null ? Math.min(c.battleHp, s.maxHp) : Math.floor((c.hp??1)*s.maxHp);
  return { ...c, level:lv, moves:c.moves||deriveMoves(c.dna), types:sp.types||["Normal"],
    label: c.wild ? `The wild ${sp.name}` : (c.name || sp.name),
    ...s, battleHp, habitatBonus: habitatAdvantage(c, biome) > 1,
    status: carry?.status ?? null,
    statMods: carry?.statMods ? { ...carry.statMods } : { atk:0, def:0, spd:0, ele:0, res:0 },
    fx: carry?.fx ? [...carry.fx] : toBattle(c.statuses),
    maxSta, stamina: carry?.stamina ?? Math.round((c.stamina ?? 1) * maxSta), fatigued: carry?.fatigued ?? !!c.fatigued,
    kdGuard: carry?.kdGuard ?? 0, attacked: false };
}
// What a battler takes to the bench (and back)
export const benchState = b => ({ statMods: b.statMods, fx: b.fx, stamina: b.stamina, fatigued: b.fatigued, kdGuard: b.kdGuard, status: b.status });
const effSpd = b => applyStatMod(b.spd, b.statMods?.spd || 0) * (b.fatigued ? 0.8 : 1);
// Who acts first this turn: the faster one, with a little luck
export function goesFirst(a, b) {
  return effSpd(a) * (0.9 + Math.random() * 0.2) >= effSpd(b);
}
// Physical moves use Attack against Defense; elemental ones Elemental against Resistance.
// Moves from before stage 9 have no kind: Normal ones are physical, the rest elemental.
export const isPhysical = m => m.kind ? m.kind === "physical" : moveType(m) === "Normal";
// Stat stages, ±4: each step up is +25% (×2 at +4); each step down divides the same way (×0.5 at −4)
export const STAGE_CAP = 4;
export function applyStatMod(base, mod) {
  const n = Math.max(-STAGE_CAP, Math.min(STAGE_CAP, mod || 0));
  return Math.floor(base * (n >= 0 ? (4 + n) / 4 : 4 / (4 - n)));
}
const STAT_NAME = { atk:"Attack", def:"Defense", spd:"Speed", ele:"Elemental", res:"Resistance" };
function changeStage(b, stat, stages, msgs) {
  const cur = b.statMods[stat] || 0, next = Math.max(-STAGE_CAP, Math.min(STAGE_CAP, cur + stages));
  if (next === cur) { msgs.push(`${b.label}'s ${STAT_NAME[stat]} won't go any ${stages > 0 ? "higher" : "lower"}!`); return; }
  b.statMods[stat] = next;
  msgs.push(`${b.label}'s ${STAT_NAME[stat]} ${stages > 0 ? "rose" : "fell"}${Math.abs(stages) > 1 ? " sharply" : ""}!`);
}
const STATUS_ON = { poison:"is poisoned", fear:"is afraid", blind:"can't see well", knocked:"is knocked down", festering:"has a festering wound", toxichide:"is coated in toxic slime",
  mute:"can't make a sound", confusion:"is confused", awake:"is wide awake" };
// Elemental moves: the stage 9 kind, or (older moves) any typed move that isn't Normal
export const isElemental = m => m.power > 0 && !isPhysical(m);
// Statuses a type can't get (Poison creatures can't be poisoned; more as species get their moves)
const IMMUNE = { poison: "Poison" };
function giveStatus(b, id, turns, msgs) {
  if (id === "knocked" && (b.kdGuard > 0 || has(b.fx, "knocked"))) return;
  if (IMMUNE[id] && (b.types || []).includes(IMMUNE[id])) { msgs.push(`${b.label} can't be ${id === "poison" ? "poisoned" : "affected"}!`); return; }
  const r = addStatus(b.fx, id, turns);
  if (!r.added) return;
  b.fx = r.fx;
  msgs.push(`${b.label} ${STATUS_ON[id] || "is affected"}${r.level > 1 ? ` (${statusText(id, r.level).toLowerCase()})` : ""}!`);
}
// Spend stamina, with a word when it's running low or gone
function spendStamina(b, cost, msgs) {
  if (!cost) return;
  const before = b.stamina / b.maxSta;
  b.stamina = Math.max(0, b.stamina - cost);
  const after = b.stamina / b.maxSta;
  if (b.stamina <= 0 && !b.fatigued) { b.fatigued = true; msgs.push(`${b.label} is exhausted!`); }
  else if (before > STAMINA_TIRING && after <= STAMINA_TIRING) msgs.push(`${b.label} is tiring.`);
}
export const CRIT_CHANCE = 0.05, CRIT_MULT = 1.5;

export function executeBattleMove(atk,def,move) {
  const msgs=[];
  let ac={...atk,statMods:{...atk.statMods},fx:[...(atk.fx||[])],teamCure:null}, dc={...def,statMods:{...def.statMods},fx:[...(def.fx||[])]};
  const done=()=>({newAttacker:ac,newDefender:dc,msgs});
  // Losing the turn, in order: knocked down, paralysis, frozen (older moves), fear
  if (has(ac.fx,"knocked")) { ac.fx=ac.fx.filter(f=>f.id!=="knocked"); ac.kdGuard=2; msgs.push(`${ac.label} is getting back up!`); return done(); }
  if (ac.status==="paralyze"&&Math.random()<0.25){msgs.push("Paralyzed! Can't move!");return done();}
  if (ac.status==="freeze"&&Math.random()<0.5){msgs.push("Frozen solid!");return done();}
  const fearLv=level(ac.fx,"fear");
  if (fearLv && Math.random()<FEAR_CHANCE[Math.min(3,fearLv)]) { msgs.push(`${ac.label} hesitates in fear!`); return done(); }
  // Confused: it may hurt itself instead
  const cfLv=level(ac.fx,"confusion");
  if (cfLv && Math.random()<CONFUSE_CHANCE[Math.min(3,cfLv)]) {
    const d=Math.max(1,Math.floor(applyStatMod(ac.atk,ac.statMods.atk||0)/Math.max(1,applyStatMod(ac.def,ac.statMods.def||0))*40*0.18*(0.85+Math.random()*0.15)));
    ac.battleHp=Math.max(0,ac.battleHp-d); msgs.push(`${ac.label} is confused and hurts itself for ${d}!`); return done();
  }
  // A worn-out creature can only manage light moves
  if (ac.fatigued && !isLight(move)) { const light=[...(ac.moves||[])].filter(isLight).sort((a,b)=>staminaCost(a)-staminaCost(b))[0]; if (light) move=light; }
  msgs.push(`${ac.label} used ${move.name}!`);
  // Borrowed Song: sings back the last elemental move the foe used, with its own Elemental
  if (move.special==="borrow") {
    spendStamina(ac, staminaCost(move), msgs);
    const src=dc.lastEle;
    if (!src) { msgs.push("But there's no song to borrow."); return done(); }
    msgs.push(`It sings back ${src.name}!`);
    move={...src,stamina:0};
  }
  if (isElemental(move)) {
    if (has(ac.fx,"mute")) { msgs.push(`${ac.label} can't make a sound!`); return done(); }
    ac.lastEle=move;
  }
  const phys=isPhysical(move), tier=masteryTier(ac.mastery?.[move.id]||0);
  spendStamina(ac, staminaCost(move), msgs);
  if (move.power>0) ac.attacked=true;
  const msgsBeforeHit=msgs.length;
  let acc=Math.min(1,move.acc*(1+0.1*tier));
  if (phys) acc*=BLIND_ACC[Math.min(3,level(ac.fx,"blind"))];
  if (Math.random()>acc){msgs.push("Missed!");return done();}
  // A much faster target sometimes dodges (up to 10%)
  if (move.power>0) {
    const as=effSpd(ac), ds=effSpd(dc);
    if (Math.random() < Math.min(0.1, Math.max(0, (ds - as) / (ds + as) * 0.3))) { msgs.push("It dodged!"); return done(); }
  }
  // Older moves' effects
  if (move.effect==="heal"){ if(has(ac.fx,"festering")){msgs.push(`${ac.label}'s festering wound won't heal!`);return done();} const h=Math.floor(ac.maxHp*0.4);ac.battleHp=Math.min(ac.maxHp,ac.battleHp+h);msgs.push("Restored "+h+" HP!");return done();}
  if (move.effect==="raise_def"){changeStage(ac,"def",1,msgs);return done();}
  if (move.effect==="lower_atk") changeStage(dc,"atk",-1,msgs);
  if (move.effect==="lower_def") changeStage(dc,"def",-1,msgs);
  if (move.effect==="lower_spd") changeStage(dc,"spd",-1,msgs);
  if (move.power>0) {
    const mt=moveType(move), k=typeMultiplier(mt,dc.types);
    if (k===0) { msgs.push("It has no effect…"); return done(); }
    const stab=(ac.types||[]).includes(mt)?SAME_TYPE_BONUS:1, hits=move.hits||1;
    let landed=0;
    for (let h=0; h<hits && dc.battleHp>0; h++) {
      const crit=Math.random() < (move.crit ?? CRIT_CHANCE) * (has(dc.fx,"knocked")?2:1);
      // A critical hit ignores the target's boosts and the attacker's own drops
      const aKey=phys?"atk":"ele", dKey=phys?"def":"res";
      let aMod=ac.statMods[aKey]||0, dMod=dc.statMods[dKey]||0;
      if (crit) { aMod=Math.max(0,aMod); dMod=Math.min(0,dMod); }
      let ea=applyStatMod(phys?ac.atk:(ac.ele??ac.atk),aMod), ed=applyStatMod(phys?dc.def:(dc.res??dc.def),dMod);
      if (ac.fatigued) ea*=0.8;
      if (!phys&&fearLv) ea*=0.75;
      const power=move.power*(1+0.1*tier);
      let dmg=(ea/Math.max(1,ed))*power*0.18*k*stab*(0.85+Math.random()*0.15);
      if (crit) dmg*=CRIT_MULT;
      if (has(dc.fx,"knocked")) dmg*=1.25;
      dmg=Math.max(1,Math.floor(dmg));
      dc.battleHp=Math.max(0,dc.battleHp-dmg); msgs.push("Hit for "+dmg+"!"); landed++;
      if (crit) msgs.push("A critical hit!");
    }
    if (hits>1) msgs.push(`Hit ${landed} ${landed===1?"time":"times"}!`);
    if (k>1) msgs.push(k>=4?"It's devastating!":"It's super effective!");
    else if (k<1) msgs.push("It's not very effective…");
    // Toxic Hide: hitting it with your body can poison you
    if (phys && has(dc.fx,"toxichide") && Math.random()<0.3) giveStatus(ac,"poison",6,msgs);
  }
  // This move's stat changes and statuses
  for (const st of move.stat||[]) if (Math.random() < (st.chance ?? 1)) changeStage(st.self?ac:dc, st.stat, st.stages, msgs);
  for (const st of move.status||[]) {
    const target=st.self?ac:dc;
    if (!st.self && target.battleHp<=0) continue;
    if (Math.random() < st.chance) giveStatus(target, st.id, st.turns, msgs);
  }
  // Dawn Chorus: wakes and calms it, and the rest of your team hears it too
  if (move.special==="dawnChorus") {
    const before=ac.fx.length; ac.fx=ac.fx.filter(f=>!["fear","drowsy","asleep"].includes(f.id));
    msgs.push(before>ac.fx.length?`${ac.label} sings its courage back!`:"The song carries across the whole team.");
    ac.teamCure=["fear","drowsy","asleep"];
  }
  if (move.special==="clearOne") {
    const bad=(ac.fx||[]).find(f=>!STATUS[f.id]?.self);
    if (bad) { ac.fx=ac.fx.filter(f=>f.id!==bad.id); msgs.push(`${ac.label} shakes off ${STATUS[bad.id].name.toLowerCase()}!`); }
    else if (ac.status) { msgs.push(`${ac.label} shakes off its ${ac.status}!`); ac.status=null; }
  }
  if (move.effect==="burn"&&!dc.status&&Math.random()<0.3){dc.status="burn";msgs.push("Burned!");}
  if (move.effect==="poison"&&Math.random()<0.3) giveStatus(dc,"poison",6,msgs);
  if (move.effect==="paralyze"&&!dc.status&&Math.random()<0.3){dc.status="paralyze";msgs.push("Paralyzed!");}
  if (move.effect==="freeze"&&!dc.status&&Math.random()<0.2){dc.status="freeze";msgs.push("Frozen!");}
  if (msgs.length===msgsBeforeHit && move.power===0) msgs.push("Nothing happened.");
  return done();
}
// End of a round, for each creature in the fight: poison hurts, every status counts down a turn,
// and a creature that didn't attack gets a little stamina back
const ENDED = { poison:"is no longer poisoned", fear:"is no longer afraid", blind:"can see again", festering:"'s wound is closing", toxichide:"'s toxic coat wears off",
  mute:"finds its voice again", confusion:"is no longer confused", awake:"settles down" };
export function endOfRound(b0) {
  const b={...b0,fx:[...(b0.fx||[])]}, msgs=[];
  if (b.battleHp<=0) return {b,msgs};
  const pz=level(b.fx,"poison");
  if (pz) { const d=Math.max(1,Math.floor(b.maxHp*0.02*pz)); b.battleHp=Math.max(0,b.battleHp-d); msgs.push(`☠️ ${b.label} takes ${d} from poison`); }
  if (b.status==="burn"||b.status==="poison") { const d=Math.max(1,Math.floor(b.maxHp*0.0625)); b.battleHp=Math.max(0,b.battleHp-d); msgs.push((b.status==="burn"?"🔥":"☠️")+" "+d+" from "+b.status); }
  // Knocked down lasts until it next tries to act
  const kd=b.fx.filter(f=>f.id==="knocked"), t=tickTurn(b.fx.filter(f=>f.id!=="knocked"));
  b.fx=[...t.fx,...kd];
  for (const id of t.ended) if (ENDED[id]) msgs.push(`${b.label}${ENDED[id].startsWith("'")?"":" "}${ENDED[id]}.`);
  if (b.kdGuard>0) b.kdGuard--;
  if (!b.attacked) {
    b.stamina=Math.min(b.maxSta,b.stamina+Math.round(b.maxSta*0.05));
    if (b.fatigued && b.stamina/b.maxSta>=STAMINA_BACK) { b.fatigued=false; msgs.push(`${b.label} got its second wind.`); }
  }
  b.attacked=false;
  return {b,msgs};
}
// Kept for anything still calling it: same as the end of a round
export function applyEndOfTurn(b) { const r=endOfRound(b); return {b:r.b,msg:r.msgs.join(" · ")||null}; }
// Moves it can use right now (a Fatigued creature only manages light ones)
export function usableMoves(b) {
  let mvs=b.moves||[];
  if (has(b.fx,"mute")) { const loud=mvs.filter(m=>!isElemental(m)); if (loud.length) mvs=loud; }
  if (!b.fatigued) return mvs;
  const light=mvs.filter(isLight);
  return light.length?light:[...mvs].sort((a,c)=>staminaCost(a)-staminaCost(c)).slice(0,1);
}
export function aiPickMove(enemy,player) {
  let mvs=usableMoves(enemy).filter(m=>m.special!=="borrow"||player?.lastEle);
  if (!mvs.length) mvs=usableMoves(enemy);
  if (enemy.battleHp<enemy.maxHp*0.3){const h=mvs.find(m=>m.effect==="heal");if(h)return h;}
  // Now and then something other than its strongest hit (a support move, a status move)
  const others=mvs.filter(m=>m.power===0||m.status||m.special);
  if (others.length && Math.random()<0.3) return others[Math.floor(Math.random()*others.length)];
  return [...mvs].sort((a,b)=>b.power*(b.hits||1)-a.power*(a.hits||1))[0]||mvs[0];
}
