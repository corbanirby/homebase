import { useState, useEffect } from "react";

import { placeholderSprite } from "./placeholderArt.js";

// ─── Species & sprites ────────────────────────────────────────────────────────
// Each species has art for four life stages, eight directions each. Ramtarug has
// hand-made sprites; the Atlanta species use code-drawn placeholders for now.
//   types:        battle types (from the 13)
//   lifespanDays: real days for a creature with average lifespan genes
//   habitat.wet:  [too dry below, ideal, too wet above] for the patch it stands on
//   eats:         plant species it grazes at home (for now every species grazes moss and cattail)
//   diet:         what it eats in the wild, for when those foods exist
//   biomes:       how much it likes each kind of Atlanta land (0–1), which sets wild populations
//   sizeMul:      drawn size compared with an average creature
//   temper:       range of the aggression gene for wild ones (low runs or hides, high charges you)
//   fastHours:    how long it survives on an empty stomach before starving to death
//   scavenger:    eats remains
//   learnset:     moves learned at a level, some only once it reaches a life stage (stage 9)
//   elder:        how its stats change as an elder (default: Attack, Elemental and Speed −15%)
//   stamina:      how much stamina it has compared with an average creature
//   base:         battle stats compared with an average creature (1.0): hp, atk, def, ele (Elemental), res (Resistance), spd
const HOMEFOOD = ["bogmoss", "cattail"];
export const SPECIES = {
  ramtarug: { no:1, name:"Ramtarug", base:{hp:1.05,atk:1.0,def:1.0,ele:1.0,res:1.0,spd:0.95}, fastHours:24, path:"sprites/ramtarug", types:["Poison"], lifespanDays:28,
    habitat:{ wet:[0.22,0.55,0.95] }, eats:HOMEFOOD, diet:"Moss and reeds", native:"Coastal-plain swamps (Okefenokee)", sizeMul:1,
    // Elders stop fighting fast and start enduring
    elder:{ def:1.1, res:1.1, atk:0.85, spd:0.85 }, stamina:1,
    learnset:[ {lv:1,move:"bump"}, {lv:7,move:"sourspit"}, {lv:10,move:"warningspots"}, {lv:17,move:"mudkick"},
      {lv:23,stage:"adolescent",move:"ram"}, {lv:29,stage:"adolescent",move:"foulbite"}, {lv:36,stage:"adult",move:"swampgas"},
      {lv:40,stage:"adult",move:"toxichide"}, {lv:46,stage:"adult",move:"skullcrack"}, {lv:52,stage:"elder",move:"oldramsstand"} ] },
  kudzoon: { no:2, name:"Kudzoon", base:{hp:1.15,atk:0.85,def:1.0,ele:1.05,res:1.05,spd:0.75}, fastHours:96, art:"kudzoon", types:["Plant"], lifespanDays:40, habitat:{ wet:[0.15,0.45,0.85] }, eats:HOMEFOOD,
    diet:"Sunlight and soil; spreads fast", based:"Kudzu", biomes:{ kudzu:1, forest:0.25, clay:0.2, meadow:0.15 }, sizeMul:1.0, temper:[0.3,0.8],
    // Old kudzu crowns live for decades: a long life, and a long, tough elder stage (from 70% of its life)
    stageEnds:[0.107,0.286,0.70], elder:{ hp:1.1, def:1.15, res:1.15, spd:0.8, atk:0.95 }, stamina:1.2, trait:"footADay",
    learnset:[ {lv:1,move:"vinewhip"}, {lv:6,move:"creepingrunner"}, {lv:11,move:"taproot"}, {lv:16,move:"leaffold"},
      {lv:22,stage:"adolescent",move:"smother"}, {lv:30,stage:"adult",move:"grapebloom"}, {lv:34,stage:"adult",move:"blankethills"},
      {lv:40,stage:"adult",move:"strangle"}, {lv:44,stage:"adult",move:"topple"}, {lv:48,stage:"adult",move:"deepcrown"},
      {lv:54,stage:"elder",move:"woodycrown"} ] },
  thrummet: { no:3, name:"Thrummet", base:{hp:0.85,atk:0.95,def:0.9,ele:1.05,res:0.9,spd:1.2}, fastHours:12, art:"thrummet", types:["Bug","Air"], lifespanDays:35, habitat:{ wet:[0.2,0.5,0.85] }, eats:HOMEFOOD,
    diet:"Tree sap", based:"Cicada", biomes:{ forest:1, pine:0.4, kudzu:0.2 }, sizeMul:0.6, temper:[0.2,0.6],
    // No adolescence: a long underground nymph (Bug/Earth), then a short loud winged adult (Bug/Air)
    stageEnds:[0.7,0.7,0.95], stageTypes:{ baby:["Bug","Earth"] }, elder:{ spd:0.8, ele:1.1 }, stamina:0.9,
    learnset:[ {lv:1,move:"pierce"}, {lv:6,move:"saptap"}, {lv:11,move:"digin"}, {lv:16,move:"emergence"},
      {lv:22,stage:"adult",move:"molt"}, {lv:26,stage:"adult",move:"drone"}, {lv:32,stage:"adult",move:"wingwhir"},
      {lv:38,stage:"adult",move:"chorusswell"}, {lv:44,stage:"adult",move:"seventeenyears"} ] },
  scuffinch: { no:4, name:"Scuffinch", base:{hp:0.9,atk:1.1,def:0.85,ele:0.9,res:0.9,spd:1.3}, fastHours:24, art:"scuffinch", types:["Air"], lifespanDays:21, habitat:{ wet:[0.15,0.45,0.8] }, eats:HOMEFOOD,
    diet:"Bugs scratched out of leaf litter", based:"Brown thrasher", biomes:{ meadow:0.8, forest:0.6, kudzu:0.4, clay:0.3 }, sizeMul:0.7, temper:[0.45,1.0],
    // The old singer: slower, wiser
    elder:{ spd:0.8, atk:0.9, ele:1.1, res:1.05 }, stamina:0.8,
    learnset:[ {lv:1,move:"peck"}, {lv:5,move:"leafflick"}, {lv:9,move:"wingattack"}, {lv:14,move:"doublephrase"},
      {lv:20,stage:"adolescent",move:"dirtscuff"}, {lv:26,stage:"adolescent",move:"borrowedsong"}, {lv:32,stage:"adult",move:"hedgedive"},
      {lv:36,stage:"adult",move:"dawnchorus"}, {lv:40,stage:"adult",move:"scoldingcall"}, {lv:44,stage:"adult",move:"nestfury"},
      {lv:50,stage:"elder",move:"thousandsongs"} ] },
  flintback: { no:5, name:"Flintback", base:{hp:0.9,atk:1.0,def:1.05,ele:1.15,res:0.95,spd:1.1}, fastHours:36, art:"flintback", types:["Earth","Fire"], lifespanDays:24, habitat:{ wet:[0.05,0.25,0.6] }, eats:HOMEFOOD,
    diet:"Bugs", based:"Fence lizard on hot granite", biomes:{ granite:1, clay:0.3, pine:0.2 }, sizeMul:0.7, temper:[0.2,0.7],
    elder:{ spd:0.85, ele:1.1, res:1.05 }, stamina:1.0,
    learnset:[ {lv:1,move:"flintstrike"}, {lv:5,move:"pushups"}, {lv:10,move:"gritspray"}, {lv:15,move:"bask"},
      {lv:21,stage:"adolescent",move:"hotstone"}, {lv:27,stage:"adolescent",move:"taildrop"}, {lv:33,stage:"adult",move:"flintflash"},
      {lv:38,stage:"adult",move:"hotrocks"}, {lv:44,stage:"adult",move:"graniteslam"}, {lv:50,stage:"elder",move:"oldcoal"} ] },
  shoalclaw: { no:6, name:"Shoalclaw", base:{hp:0.95,atk:1.2,def:1.2,ele:0.85,res:0.95,spd:0.85}, fastHours:24, art:"shoalclaw", types:["Water","Earth"], lifespanDays:18, habitat:{ wet:[0.5,0.85,1.0] }, eats:HOMEFOOD,
    diet:"Algae and debris on the riverbed", based:"Chattahoochee crayfish", biomes:{ shoal:1, creek:0.8, river:0.3 }, sizeMul:0.7, temper:[0.4,1.0],
    elder:{ atk:1.1, def:1.1, spd:0.8 }, stamina:1.0,
    learnset:[ {lv:1,move:"pinch"}, {lv:5,move:"siltcloud"}, {lv:9,move:"splash"}, {lv:14,move:"clawclamp"},
      {lv:19,stage:"adolescent",move:"mudfort"}, {lv:24,stage:"adolescent",move:"tailflip"}, {lv:29,stage:"adult",move:"riverbedrake"},
      {lv:34,stage:"adult",move:"crushingclaw"}, {lv:40,stage:"elder",move:"oldpincer"} ] },
  glimmerwick: { no:7, name:"Glimmerwick", base:{hp:0.75,atk:0.7,def:0.75,ele:1.35,res:1.0,spd:1.35}, fastHours:12, art:"glimmerwick", types:["Electric","Bug"], lifespanDays:14, habitat:{ wet:[0.3,0.6,0.95] }, eats:HOMEFOOD,
    diet:"Nectar and dew", based:"Firefly", biomes:{ meadow:0.9, creek:0.7, forest:0.3 }, sizeMul:0.5, temper:[0.1,0.5],
    // Afterglow: whatever knocks it out may be left paralyzed
    trait:"afterglow", elder:{ spd:0.8, ele:1.05 }, stamina:0.7,
    learnset:[ {lv:1,move:"zap"}, {lv:4,move:"flashpattern"}, {lv:8,move:"shock"}, {lv:12,move:"nightswarm"},
      {lv:17,stage:"adolescent",move:"falsesignal"}, {lv:22,stage:"adult",move:"glowwormdrift"}, {lv:27,stage:"adult",move:"heatlightning"},
      {lv:33,stage:"elder",move:"lastlight"} ] },
  possumbra: { no:8, name:"Possumbra", base:{hp:1.05,atk:0.9,def:0.95,ele:1.05,res:1.15,spd:0.9}, fastHours:48, scavenger:true, art:"possumbra", types:["Spirit","Normal"], lifespanDays:20, habitat:{ wet:[0.15,0.5,0.9] }, eats:HOMEFOOD,
    diet:"Almost anything", based:"Opossum (plays dead)", biomes:{ forest:0.6, kudzu:0.6, pine:0.5, meadow:0.4, clay:0.4, creek:0.3 }, sizeMul:0.9, temper:[0.05,0.45],
    // Venom-Proof: can't be poisoned
    trait:"venomProof", elder:{ hp:1.1, res:1.1, spd:0.85 }, stamina:1.1,
    learnset:[ {lv:1,move:"bite"}, {lv:5,move:"fiftytoothhiss"}, {lv:10,move:"moonlessstare"}, {lv:15,move:"tailgrip"},
      {lv:21,stage:"adolescent",move:"playdead"}, {lv:27,stage:"adolescent",move:"tickgroom"}, {lv:33,stage:"adult",move:"scavenge"},
      {lv:39,stage:"adult",move:"graveyardshift"}, {lv:46,stage:"elder",move:"deathscent"} ] },
  clattershell: { no:9, name:"Clattershell", base:{hp:1.0,atk:0.95,def:1.45,ele:0.75,res:1.3,spd:0.6}, fastHours:48, art:"clattershell", types:["Metal","Earth"], lifespanDays:32, habitat:{ wet:[0.1,0.35,0.7] }, eats:HOMEFOOD,
    diet:"Grubs and roots", based:"Armadillo", biomes:{ pine:1, clay:0.8, forest:0.2 }, sizeMul:0.9, temper:[0.2,0.6],
    elder:{ def:1.1, spd:0.8 }, stamina:1.2,
    learnset:[ {lv:1,move:"bump"}, {lv:6,move:"brace"}, {lv:11,move:"pounce"}, {lv:17,move:"platebash"},
      {lv:23,stage:"adolescent",move:"dig"}, {lv:35,stage:"adult",move:"grub"}, {lv:41,stage:"adult",move:"heavylanding"},
      {lv:48,stage:"elder",move:"ironhide"} ] },
  duskhowl: { no:10, name:"Duskhowl", base:{hp:1.15,atk:1.25,def:1.05,ele:1.0,res:1.0,spd:1.15}, fastHours:72, scavenger:true, art:"duskhowl", types:["Normal","Spirit"], lifespanDays:40, habitat:{ wet:[0.1,0.4,0.8] }, eats:HOMEFOOD,
    diet:"Hunts smaller creatures", based:"Coyote", biomes:{ meadow:0.3, forest:0.3, pine:0.3, clay:0.3, kudzu:0.2 }, sizeMul:1.3, temper:[0.55,1.0], rare:true,
    elder:{ atk:0.9, ele:1.1, res:1.1 }, stamina:1.3,
    learnset:[ {lv:1,move:"bite"}, {lv:7,move:"yipcall"}, {lv:13,move:"hamstring"}, {lv:19,move:"stalk"},
      {lv:26,stage:"adolescent",move:"duskhowl"}, {lv:33,stage:"adult",move:"rundown"}, {lv:40,stage:"adult",move:"frenzy"},
      {lv:47,stage:"adult",move:"moonchase"}, {lv:55,stage:"elder",move:"packleader"} ] },
};
export const ATLANTA_SPECIES = Object.keys(SPECIES).filter(k => SPECIES[k].biomes);
export const DIRS8 = ["east","south-east","south","south-west","west","north-west","north","north-east"];
// Life stage by share of lifespan lived; scale shrinks the young since every
// stage's art fills the same 96px frame. For a 28-day Ramtarug that's about
// 3 days a baby, 5 an adolescent, 16 an adult and 4 an elder.
export const STAGES = [
  { id:"baby",       until:0.107, scale:0.6, label:"Baby" },
  { id:"adolescent", until:0.286, scale:0.8, label:"Adolescent" },
  { id:"adult",      until:0.857, scale:1.0, label:"Adult" },
  { id:"elder",      until:Infinity, scale:1.0, label:"Elder" },
];
// Where each stage ends, as a share of its life. Species can set their own (stageEnds:[baby, adolescent, adult]).
export const stageEnds=c=>SPECIES[c?.species]?.stageEnds||[STAGES[0].until,STAGES[1].until,STAGES[2].until];
export function lifeStage(c){
  const f=(c.age||0)/(c.maxAge||1), ends=stageEnds(c);
  const i=ends.findIndex(e=>f<e);
  return STAGES[i<0?3:i];
}
export function speciesOf(c){ return SPECIES[c.species]||SPECIES.ramtarug; }
const spriteCache={};
const spriteListeners=new Set();
export function spriteImage(sp,stage,dir){
  if(sp.art) return placeholderSprite(sp.art,stage,dir);
  const key=`${sp.path}/${stage}/${dir}.png`;
  let img=spriteCache[key];
  if(!img){
    img=new Image();
    img.onload=()=>spriteListeners.forEach(f=>f());
    img.src=(import.meta.env.BASE_URL||"/")+key;
    spriteCache[key]=img;
  }
  return img.complete&&img.naturalWidth?img:null;
}
// Preload every stage and direction so sprites never pop in mid-game
Object.values(SPECIES).filter(sp=>!sp.art).forEach(sp=>STAGES.forEach(st=>DIRS8.forEach(d=>spriteImage(sp,st.id,d))));
export function useSpritesLoaded(){
  const [,setV]=useState(0);
  useEffect(()=>{const f=()=>setV(v=>v+1);spriteListeners.add(f);return()=>spriteListeners.delete(f);},[]);
}
// Facing from movement on the top-down map; remembered while standing still
const facingById=new Map();
export function facingOf(c){
  const sx=c.dcol, sy=c.drow;
  if(Math.hypot(sx,sy)>0.004){
    const a=Math.atan2(sy,sx);
    const i=((Math.round(a/(Math.PI/4))%8)+8)%8;
    facingById.set(c.id,DIRS8[i]);
  }
  return facingById.get(c.id)||"south-east";
}
// A plain egg: the same for every species
export function EggIcon({size=28}){
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Egg" style={{flexShrink:0}}>
    <ellipse cx="12" cy="13" rx="7.5" ry="9.5" fill="#2a2420"/>
    <ellipse cx="12" cy="13" rx="6.3" ry="8.3" fill="#efe6cf"/>
    <rect x="8.5" y="7" width="2.5" height="2.5" fill="#fffaf0"/>
    <rect x="14" y="12" width="1.5" height="1.5" fill="#a08a6a"/><rect x="10" y="16" width="1.5" height="1.5" fill="#a08a6a"/><rect x="15" y="17" width="1.2" height="1.2" fill="#a08a6a"/>
  </svg>;
}
export function CreatureIcon({c,size=28,dir="south-east"}){
  useSpritesLoaded();
  if(c?.isEgg) return <div style={{width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><EggIcon size={Math.round(size*0.7)}/></div>;
  const st=lifeStage(c), sp=speciesOf(c);
  const img=spriteImage(sp,st.id,dir);
  const px=Math.round(size*(0.75+0.25*st.scale));
  return <div style={{width:size,height:size,display:"flex",alignItems:"flex-end",justifyContent:"center",flexShrink:0}}>
    {img?<img src={img.src} alt={sp.name} width={px} height={px} style={{imageRendering:"pixelated",display:"block"}}/>:null}
  </div>;
}

export function SlotSprite({c}){
  useSpritesLoaded();
  const st=lifeStage(c), img=spriteImage(speciesOf(c),st.id,"south-east");
  const w=Math.round((62+20*st.scale));
  return img?<img src={img.src} alt="" style={{width:w+"%",imageRendering:"pixelated",display:"block",marginTop:-4,pointerEvents:"none"}}/>:null;
}

