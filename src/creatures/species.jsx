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
const HOMEFOOD = ["bogmoss", "cattail"];
export const SPECIES = {
  ramtarug: { no:1, name:"Ramtarug", path:"sprites/ramtarug", types:["Poison"], lifespanDays:28,
    habitat:{ wet:[0.22,0.55,0.95] }, eats:HOMEFOOD, diet:"Moss and reeds", native:"Coastal-plain swamps (Okefenokee)", sizeMul:1 },
  kudzoon: { no:2, name:"Kudzoon", art:"kudzoon", types:["Plant"], lifespanDays:30, habitat:{ wet:[0.15,0.45,0.85] }, eats:HOMEFOOD,
    diet:"Sunlight and soil; spreads fast", based:"Kudzu", biomes:{ kudzu:1, forest:0.25, clay:0.2, meadow:0.15 }, sizeMul:1.0, temper:[0.3,0.8] },
  thrummet: { no:3, name:"Thrummet", art:"thrummet", types:["Bug","Air"], lifespanDays:35, habitat:{ wet:[0.2,0.5,0.85] }, eats:HOMEFOOD,
    diet:"Tree sap", based:"Cicada", biomes:{ forest:1, pine:0.4, kudzu:0.2 }, sizeMul:0.6, temper:[0.2,0.6] },
  scuffinch: { no:4, name:"Scuffinch", art:"scuffinch", types:["Air"], lifespanDays:21, habitat:{ wet:[0.15,0.45,0.8] }, eats:HOMEFOOD,
    diet:"Bugs scratched out of leaf litter", based:"Brown thrasher", biomes:{ meadow:0.8, forest:0.6, kudzu:0.4, clay:0.3 }, sizeMul:0.7, temper:[0.45,1.0] },
  flintback: { no:5, name:"Flintback", art:"flintback", types:["Earth","Fire"], lifespanDays:24, habitat:{ wet:[0.05,0.25,0.6] }, eats:HOMEFOOD,
    diet:"Bugs", based:"Fence lizard on hot granite", biomes:{ granite:1, clay:0.3, pine:0.2 }, sizeMul:0.7, temper:[0.2,0.7] },
  shoalclaw: { no:6, name:"Shoalclaw", art:"shoalclaw", types:["Water","Earth"], lifespanDays:18, habitat:{ wet:[0.5,0.85,1.0] }, eats:HOMEFOOD,
    diet:"Algae and debris on the riverbed", based:"Chattahoochee crayfish", biomes:{ shoal:1, creek:0.8, river:0.3 }, sizeMul:0.7, temper:[0.4,1.0] },
  glimmerwick: { no:7, name:"Glimmerwick", art:"glimmerwick", types:["Electric","Bug"], lifespanDays:14, habitat:{ wet:[0.3,0.6,0.95] }, eats:HOMEFOOD,
    diet:"Nectar and dew", based:"Firefly", biomes:{ meadow:0.9, creek:0.7, forest:0.3 }, sizeMul:0.5, temper:[0.1,0.5] },
  possumbra: { no:8, name:"Possumbra", art:"possumbra", types:["Spirit","Normal"], lifespanDays:20, habitat:{ wet:[0.15,0.5,0.9] }, eats:HOMEFOOD,
    diet:"Almost anything", based:"Opossum (plays dead)", biomes:{ forest:0.6, kudzu:0.6, pine:0.5, meadow:0.4, clay:0.4, creek:0.3 }, sizeMul:0.9, temper:[0.05,0.45] },
  clattershell: { no:9, name:"Clattershell", art:"clattershell", types:["Metal","Earth"], lifespanDays:32, habitat:{ wet:[0.1,0.35,0.7] }, eats:HOMEFOOD,
    diet:"Grubs and roots", based:"Armadillo", biomes:{ pine:1, clay:0.8, forest:0.2 }, sizeMul:0.9, temper:[0.2,0.6] },
  duskhowl: { no:10, name:"Duskhowl", art:"duskhowl", types:["Normal","Spirit"], lifespanDays:40, habitat:{ wet:[0.1,0.4,0.8] }, eats:HOMEFOOD,
    diet:"Hunts smaller creatures", based:"Coyote", biomes:{ meadow:0.3, forest:0.3, pine:0.3, clay:0.3, kudzu:0.2 }, sizeMul:1.3, temper:[0.55,1.0], rare:true },
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
export function lifeStage(c){
  const f=(c.age||0)/(c.maxAge||1);
  return STAGES.find(s=>f<s.until)||STAGES[3];
}
export function speciesOf(c){ return SPECIES[c.species]||SPECIES.ramtarug; }
const spriteCache={};
const spriteListeners=new Set();
export function spriteImage(sp,stage,dir){
  if(sp.art) return placeholderSprite(sp.art,stage,dir,()=>spriteListeners.forEach(f=>f()));
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
export function CreatureIcon({c,size=28,dir="south-east"}){
  useSpritesLoaded();
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

