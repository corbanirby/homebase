import { useState, useEffect } from "react";

// ─── Species & sprites ────────────────────────────────────────────────────────
// Each species has hand-made art for four life stages, eight directions each.
// A creature shows as the species closest to its genes; with one species so far,
// every creature is a Ramtarug.
export const SPECIES = {
  ramtarug: { no:1, name:"Ramtarug", path:"sprites/ramtarug" },
};
export const DIRS8 = ["east","south-east","south","south-west","west","north-west","north","north-east"];
// Life stage by share of lifespan lived; scale shrinks the young since every
// stage's art fills the same 96px frame.
export const STAGES = [
  { id:"baby",       until:0.15, scale:0.6 },
  { id:"adolescent", until:0.35, scale:0.8 },
  { id:"adult",      until:0.80, scale:1.0 },
  { id:"elder",      until:Infinity, scale:1.0 },
];
export function lifeStage(c){
  const f=(c.age||0)/(c.maxAge||1);
  return STAGES.find(s=>f<s.until)||STAGES[3];
}
export function speciesOf(c){ return SPECIES[c.species]||SPECIES.ramtarug; }
const spriteCache={};
const spriteListeners=new Set();
export function spriteImage(sp,stage,dir){
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
Object.values(SPECIES).forEach(sp=>STAGES.forEach(st=>DIRS8.forEach(d=>spriteImage(sp,st.id,d))));
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

