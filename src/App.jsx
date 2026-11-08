import { useState, useEffect, useRef, useCallback } from "react";
import { TICK_MS, XP_PER_LEVEL } from "./config.js";
import { newId, setNextId } from "./engine/ids.js";
import { readSave, writeSave, clearSave, timeAgo } from "./engine/save.js";
import { catchUp, formatDuration } from "./engine/time.js";
import { isPassable } from "./world/tiles.js";
import { makeLand, deriveMap, growLand, trample, timeSpeed, SOILS } from "./world/land.js";
import { buildGround, drawWorld, SOIL_COLORS } from "./world/render.js";
import { dnaColor } from "./creatures/dna.js";
import { makePlayer } from "./creatures/factory.js";
import { makeResident, pickName, DAY, VINE_MAX, HUNGRY_AT, WEAK_AT, conditionOf, conditionWord, fullnessWord, habitatWord, nextStageIn } from "./creatures/resident.js";
import { PLANT_SPECIES, GATHER_COOLDOWN_MS, fitOf, fitWord, makeSeedling, plantKey, startingPlants, plantEffects, growPlants } from "./plants/plants.js";
import { speciesOf, lifeStage, CreatureIcon, SPECIES } from "./creatures/species.jsx";
import { simulateHome } from "./sim/home.js";
import { simulateOutside, outsideAct, atSwapSpot, spotAt, makePops, regrowPops, newTrip, ageCarried, takeFromPop, distFromDoor } from "./sim/outside.js";
import { atlanta, areaKey, BIOME_NAMES } from "./world/atlanta.js";
import { learnMoveAtLevel, deriveMoves } from "./battle/moves.js";
import { BattleScreen } from "./battle/BattleScreen.jsx";
import DPad from "./ui/DPad.jsx";

const ACT_DIST = 1.5; // how close you need to be to a creature to pet it

// Adds what happened to the land and plants while you were away to the away report
function withLand(report,stats,away,plantStats=null){
  const r=report?{...report,awayMs:away,lines:[...report.lines]}:{awayMs:away,lines:[]};
  if(plantStats){
    const {sprouted,matured,spread,died}=plantStats;
    if(sprouted) r.lines.push(`${sprouted} ${sprouted===1?"seed":"seeds"} sprouted`);
    if(matured) r.lines.push(`${matured} ${matured===1?"plant":"plants"} grew to full size`);
    if(spread) r.lines.push(`Plants spread to ${spread} new ${spread===1?"spot":"spots"}`);
    if(died) r.lines.push(`${died} ${died===1?"plant":"plants"} wilted in the wrong spot`);
  }
  if(stats){
    if(stats.grew) r.lines.push(`${stats.grew} ${stats.grew===1?"patch":"patches"} of land grew taller`);
    if(stats.thinned) r.lines.push(`${stats.thinned} ${stats.thinned===1?"patch":"patches"} thinned out`);
    if(stats.pathsFaded) r.lines.push(`${stats.pathsFaded} worn ${stats.pathsFaded===1?"path":"paths"} grew back over`);
  }
  return r;
}

// Everything that changes while you're away: land, plants, creatures.
// While you're out in the shared world, only the ones you carry are with you; the
// homebase is caught up when you walk back through the door.
function advanceAway(state,land,away,speed){
  const ms=away*speed;
  if(state.where==="out"){
    const carried=new Set([...(state.vine||[]),...(state.trip?.bag||[])]);
    return { state:{...state,clock:(state.clock||0)+ms,creatures:state.creatures.map(c=>carried.has(c.id)?ageCarried(c,Math.min(ms,30*DAY)):c)}, landStats:null, report:{awayMs:away,lines:[]} };
  }
  const landStats=growLand(land,ms,plantEffects(state.plants));
  const caught=catchUp(state,land,ms);
  return { state:caught.state, landStats, report:withLand(caught.report,landStats,away,caught.plantStats) };
}
// Older saves and new worlds get the stage 4 fields
const withTripFields=s=>({...s,where:s.where||"home",trip:s.trip||null,world:s.world||makePops(),food:s.food||{bogmoss:2,cattail:1}});
// Experience for creatures that fought but weren't out at the end
function giveXp(c,xp){
  const need=Math.floor(XP_PER_LEVEL*(c.dna.xpRate??1));
  const nxp=(c.xp||0)+xp, nl=Math.floor(nxp/need)+1;
  let moves=c.moves||[];
  if(nl>(c.level||1)){ const m=learnMoveAtLevel(c.dna,nl,moves); if(m) moves=moves.length<4?[...moves,m]:[moves[0],...moves.slice(2),m]; }
  return {...c,xp:nxp,level:Math.max(c.level||1,nl),moves};
}
const BAG_MAX=6;
const FOOD_NAMES={bogmoss:"Moss clump",cattail:"Cattail shoots"};

// A brand-new homebase: land, wild plants, and a pair of baby Ramtarugs next to you
function makeNewWorld(){
  const land=makeLand();
  const map=deriveMap(land);
  const player=makePlayer(map);
  const spots=[[1,0.6],[-1,0.6],[1,-0.6],[-1,-0.6],[0,1],[0,-1],[2,0],[-2,0]].map(([dc,dr])=>({col:player.col+dc,row:player.row+dr}))
    .filter(p=>isPassable(map,p.col,p.row));
  while(spots.length<2) spots.push({col:player.col+(Math.random()-0.5),row:player.row+0.6});
  const she=makeResident({...spots[0],sex:"F",name:pickName()});
  const he=makeResident({...spots[1],sex:"M",name:pickName([she.name])});
  const plants=startingPlants(land);
  return { land, map, state:withTripFields({ creatures:[she,he], vine:[she.id,he.id], plants, player, seeds:{bogmoss:5,cattail:3}, events:[], floats:[], tick:0, clock:0 }) };
}

const fmtAge=ms=>{ const d=Math.floor(ms/DAY), h=Math.floor((ms%DAY)/3600000); return d?`${d} ${d===1?"day":"days"}${h?" "+h+" h":""}`:`${h} ${h===1?"hour":"hours"}`; };
const condColor=v=>v>=0.85?"#86efac":v>=0.65?"#bef264":v>=0.45?"#facc15":"#f87171";

export default function Homebase(){
  const canvasRef=useRef(null);
  const stateRef=useRef(null);
  const tickRef=useRef(0);          // world steps since this session's world was loaded
  const animRef=useRef(null);
  const lastFrameRef=useRef(0);     // real time of the previous animation frame
  const accRef=useRef(0);           // real time not yet turned into world steps
  const groundRef=useRef(null);     // pre-drawn ground for the current map
  const hiddenAtRef=useRef(0);      // when the tab was last hidden
  const landRef=useRef(null);       // conditions and growth of every patch
  const landDirtyRef=useRef(false); // the visible tiles need recomputing
  const lastGroundRef=useRef(0);    // when the ground was last redrawn
  const lastTileRef=useRef(new Map()); // the patch each walker was last on, for trampling
  const speedRef=useRef(timeSpeed()); // ?speed=N speeds up time for testing
  const focusRef=useRef(null);      // the creature the Act button would reach
  const outGroundRef=useRef(null);  // painted ground for Atlanta
  const battleRef=useRef(null);     // the battle in progress, if any
  const partyRef=useRef([]);        // your creatures in the battle, lead first
  const[overlay,setOverlay]=useState(null); // null | "wet" | "temp" | "soil" | "veg"
  const overlayRef=useRef(null); overlayRef.current=overlay;
  // Zoom: buttons, pinch on the map, or the mouse wheel. Remembered in this browser.
  const[zoom,setZoomState]=useState(()=>{ try{ const z=Number(localStorage.getItem("homebase-zoom")); return z>=0.5&&z<=2?z:1; }catch(e){ return 1; } });
  const zoomRef=useRef(zoom); zoomRef.current=zoom;
  const setZoom=z=>{ const v=Math.round(Math.max(0.5,Math.min(2,z))*100)/100; setZoomState(v); try{ localStorage.setItem("homebase-zoom",String(v)); }catch(e){ /* ignore */ } };
  const pinchRef=useRef(null);
  const onCanvasTouchStart=e=>{ if(e.touches.length===2){ const[a,b]=e.touches; pinchRef.current={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),z:zoomRef.current}; } };
  const onCanvasTouchMove=e=>{ if(e.touches.length===2&&pinchRef.current){ const[a,b]=e.touches; const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); setZoom(pinchRef.current.z*d/pinchRef.current.d); } };
  const onCanvasTouchEnd=e=>{ if(e.touches.length<2) pinchRef.current=null; };
  const onCanvasWheel=e=>{ setZoom(zoomRef.current*(e.deltaY<0?1.1:1/1.1)); };
  const pausedRef=useRef(false);
  const inputRef=useRef({dx:0,dy:0});
  // Test hook: with ?debug in the address, automated tests can steer and read the world
  useEffect(()=>{ if(/[?&]debug/.test(window.location.search)) window.__hb={stateRef,inputRef,battleRef}; },[]);

  const[saveInfo,setSaveInfo]=useState(()=>readSave());
  const[screen,setScreen]=useState("title"); // title | game
  const[awayReport,setAwayReport]=useState(null);
  const mapRef=useRef(null);
  const[lastSaved,setLastSaved]=useState(0);
  const[confirmNew,setConfirmNew]=useState(false);
  const[dims,setDims]=useState({W:390,H:320});
  const[uiState,setUiState]=useState({creatures:[],plants:0,clock:0,paused:false,vine:[]});
  const[panel,setPanel]=useState(null);   // null | "creatures" | "bag"
  const[cardId,setCardId]=useState(null); // creature whose card is open
  const[renaming,setRenaming]=useState(null); // name being typed, or null
  const[battle,setBattle]=useState(null);
  const[party,setParty]=useState([]);

  const refreshUi=()=>{
    const s=stateRef.current; if(!s) return;
    setUiState(u=>({...u,creatures:s.creatures,vine:s.vine||[],bag:s.trip?.bag||[],where:s.where,plants:s.plants.length,clock:s.clock||0,seeds:s.seeds||{},food:s.food||{},atSwap:s.where==="out"?atSwapSpot(s):true}));
  };

  // Write the current world to this browser's storage
  const saveNow=useCallback(()=>{
    if(!mapRef.current||!stateRef.current) return;
    const d=writeSave(landRef.current,{...stateRef.current,tick:0},stateRef.current.clock||0);
    if(d){ setSaveInfo(d); setLastSaved(Date.now()); }
  },[]);

  // Resume a saved world, then catch up on the time you were away
  const continueGame=useCallback(()=>{
    const d=readSave(); if(!d) { setScreen("title"); return; }
    landRef.current=d.land;
    const away=Date.now()-(d.savedAt||Date.now());
    const {state,report}=advanceAway(withTripFields({...d.state,seeds:d.state.seeds||{bogmoss:5,cattail:3},vine:d.state.vine||[],events:[],floats:[]}),d.land,away,speedRef.current);
    const map=deriveMap(d.land);
    mapRef.current=map; groundRef.current=buildGround(map);
    stateRef.current=state; tickRef.current=0;
    const maxId=[...state.creatures,...state.plants,...(state.trip?.wilds||[])].reduce((m,e)=>Math.max(m,e.id||0),0);
    setNextId(Math.max(d.nextId||1,maxId+1));
    refreshUi();
    if(report&&away>=60000&&state.where!=="out") setAwayReport(report);
    setScreen("game");
  },[]);

  // Start a brand-new homebase
  const startNewWorld=useCallback(()=>{
    const {land,map,state}=makeNewWorld();
    landRef.current=land; mapRef.current=map; groundRef.current=buildGround(map);
    stateRef.current=state; tickRef.current=0;
    refreshUi();
    setScreen("game");
    setTimeout(()=>{ const d=writeSave(land,state,0); if(d){setSaveInfo(d);setLastSaved(Date.now());} },0);
  },[]);

  // Save when the tab is hidden or closed; catch up when it comes back
  useEffect(()=>{
    const onVis=()=>{
      if(document.visibilityState==="hidden"){ hiddenAtRef.current=Date.now(); saveNow(); return; }
      const away=hiddenAtRef.current?Date.now()-hiddenAtRef.current:0;
      hiddenAtRef.current=0; lastFrameRef.current=0; accRef.current=0;
      if(away>=5000&&stateRef.current){
        const {state,report,landStats}=advanceAway(stateRef.current,landRef.current,away,speedRef.current);
        if(landStats) landDirtyRef.current=true;
        stateRef.current=state; refreshUi();
        if(report&&away>=60000&&state.where!=="out") setAwayReport(report);
      }
    };
    document.addEventListener("visibilitychange",onVis);
    window.addEventListener("pagehide",saveNow);
    return()=>{document.removeEventListener("visibilitychange",onVis);window.removeEventListener("pagehide",saveNow);};
  },[saveNow]);

  // ── Seeds: plant in the patch in front of you, gather from mature plants nearby
  const[showSeeds,setShowSeeds]=useState(false);
  const showSeedsRef=useRef(false); showSeedsRef.current=showSeeds;
  const targetTile=()=>{
    const p=stateRef.current?.player; if(!p) return null;
    const [dc,dr]={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[p.facing]||[0,1];
    return {c:Math.floor(p.col)+dc,r:Math.floor(p.row)+dr};
  };
  const gatherable=()=>{
    const s=stateRef.current; if(!s) return null;
    const now=Date.now();
    return s.plants.filter(pl=>pl.stage===3&&(now-(pl.lastGather||0))*speedRef.current>=GATHER_COOLDOWN_MS)
      .map(pl=>({pl,d:Math.hypot(pl.col-s.player.col,pl.row-s.player.row)}))
      .filter(x=>x.d<1.6).sort((a,b)=>a.d-b.d)[0]?.pl||null;
  };
  function gardenInfo(){
    const t=targetTile(), land=landRef.current; if(!t||!land) return null;
    const cell=land.cells[t.r]?.[t.c];
    const occupied=!!stateRef.current.plants.find(pl=>plantKey(pl)===t.c+","+t.r);
    const fits={}; for(const id of Object.keys(PLANT_SPECIES)){ const f=fitOf(id,cell); fits[id]={fit:f,word:occupied?"Already planted":fitWord(f,cell,id)}; }
    const g=gatherable();
    return {target:t,fits,occupied,gather:g?PLANT_SPECIES[g.species].name:null};
  }
  const addFloat=(text,color,at=null)=>{ const s=stateRef.current; const p=at||s.player; stateRef.current={...s,floats:[...s.floats,{id:newId(),col:p.col,row:p.row,text,color,tick:tickRef.current}]}; };
  const plantSeed=id=>{
    const s=stateRef.current, land=landRef.current, t=targetTile(); if(!s||!land||!t) return;
    if(!(s.seeds?.[id]>0)) { addFloat("No seeds left","#f87171"); return; }
    const cell=land.cells[t.r]?.[t.c];
    if(!cell||cell.water||cell.edge||cell.mother||!isPassable(mapRef.current,t.c+0.5,t.r+0.5)) { addFloat("Can't plant there","#f87171"); return; }
    if(s.plants.find(pl=>plantKey(pl)===t.c+","+t.r)) { addFloat("Already planted","#facc15"); return; }
    const f=fitOf(id,cell);
    if(f<=0) { addFloat(fitWord(f,cell,id),"#f87171"); return; }
    stateRef.current={...s,plants:[...s.plants,makeSeedling(id,t.c,t.r,0)],seeds:{...s.seeds,[id]:s.seeds[id]-1}};
    addFloat("🌱 Planted","#86efac");
    setUiState(u=>({...u,seeds:stateRef.current.seeds,garden:gardenInfo()}));
  };
  const gatherSeeds=()=>{
    const g=gatherable(); if(!g) { addFloat("Nothing ripe nearby","#94a3b8"); return; }
    const s=stateRef.current, sp=PLANT_SPECIES[g.species];
    stateRef.current={...s,plants:s.plants.map(pl=>pl.id===g.id?{...pl,lastGather:Date.now(),energy:Math.max(0.1,pl.energy-0.2)}:pl),seeds:{...s.seeds,[g.species]:(s.seeds?.[g.species]||0)+sp.seedsPerGather}};
    addFloat(`+${sp.seedsPerGather} ${sp.name} seed${sp.seedsPerGather>1?"s":""}`,"#86efac");
    setUiState(u=>({...u,seeds:stateRef.current.seeds,garden:gardenInfo()}));
  };

  // ── Act: pet the creature next to you, or gather seeds from a ripe plant
  const nearestCreature=()=>{
    const s=stateRef.current; if(!s) return null;
    let best=null, bd=ACT_DIST;
    for(const c of s.creatures){ const d=Math.hypot(c.col-s.player.col,c.row-s.player.row); if(d<bd){bd=d;best=c;} }
    return best;
  };
  // The mother plant is your door to the shared world
  const nearMother=()=>{
    const s=stateRef.current, map=mapRef.current; if(!s||!map) return false;
    for(let r=0;r<map.length;r++) for(let c=0;c<map[0].length;c++) if(map[r][c]==="mother"&&Math.hypot(c+0.5-s.player.col,r+0.5-s.player.row)<1.9) return true;
    return false;
  };
  // A grown plant next to you with enough on it to pick some food
  const harvestable=()=>{
    const s=stateRef.current; if(!s) return null;
    return s.plants.filter(pl=>pl.stage===3&&pl.energy>=0.4).map(pl=>({pl,d:Math.hypot(pl.col-s.player.col,pl.row-s.player.row)})).filter(x=>x.d<1.6).sort((a,b)=>a.d-b.d)[0]?.pl||null;
  };
  const actHint=()=>{
    const s=stateRef.current; if(!s) return null;
    if(s.where==="out") return outsideAct(s);
    const c=nearestCreature();
    if(c&&Math.hypot(c.col-s.player.col,c.row-s.player.row)<1) return {kind:"pet",label:"Pet "+c.name,id:c.id};
    if(nearMother()) return {kind:"out",label:"Go out"};
    if(c) return {kind:"pet",label:"Pet "+c.name,id:c.id};
    if(harvestable()) return {kind:"harvest",label:"Harvest"};
    return null;
  };
  const doAct=()=>{
    const s0=stateRef.current; if(!s0) return;
    const hint=actHint();
    if(s0.where==="out"){
      if(!hint){ addFloat("Nothing to do here","#94a3b8",s0.trip.player); return; }
      if(hint.kind==="battle"){ startBattle(hint.wild,"approach"); return; }
      if(hint.kind==="home"){ goHome(); return; }
      if(hint.kind==="rest"){
        const carried=new Set([...(s0.vine||[]),...(s0.trip.bag||[])]);
        stateRef.current={...s0,creatures:s0.creatures.map(c=>carried.has(c.id)?{...c,hp:1}:c)};
        addFloat(spotAt(s0)==="spring"?"Your creatures rest at the spring":"Your creatures rest at the shoals","#93c5fd",s0.trip.player);
        refreshUi(); setPanel("creatures"); return;
      }
      return;
    }
    if(hint?.kind==="out"){ goOut(); return; }
    if(hint?.kind==="harvest"){
      const pl=harvestable(); if(!pl) return;
      stateRef.current={...s0,plants:s0.plants.map(p=>p.id===pl.id?{...p,energy:p.energy-0.35}:p),food:{...s0.food,[pl.species]:(s0.food?.[pl.species]||0)+1}};
      addFloat("+1 "+FOOD_NAMES[pl.species],"#86efac"); refreshUi(); return;
    }
    const c=hint?.kind==="pet"?stateRef.current.creatures.find(o=>o.id===hint.id):null;
    if(c){
      const s=stateRef.current;
      stateRef.current={...s,creatures:s.creatures.map(o=>o.id===c.id?{...o,petAt:s.clock||0,dcol:0,drow:0,wanderTimer:40}:o)};
      addFloat("♥","#f9a8d4",{col:c.col,row:c.row-0.4});
      refreshUi(); setCardId(c.id); setRenaming(null);
      return;
    }
    addFloat("Nothing to do here","#94a3b8");
  };

  // ── The door: out to Atlanta and back
  const goOut=()=>{
    const s=stateRef.current;
    const vine=(s.vine||[]).filter(id=>s.creatures.some(c=>c.id===id));
    if(!vine.length){ addFloat("Put a creature on your vine first","#facc15"); return; }
    const now=Date.now();
    stateRef.current={...s,where:"out",vine,trip:newTrip(now),world:regrowPops(s.world||makePops(),now,speedRef.current),floats:[]};
    if(!outGroundRef.current) outGroundRef.current=buildGround(atlanta().tiles);
    addFloat("Atlanta","#c8e6a0",stateRef.current.trip.player);
    setPanel(null); setCardId(null); refreshUi(); saveNow();
  };
  const goHome=(beaten=false)=>{
    const s=stateRef.current; if(!s||s.where!=="out") return;
    const away=Date.now()-(s.trip.startedAt||Date.now());
    const carried=new Set([...(s.vine||[]),...(s.trip.bag||[])]);
    const homeOnly={...s,where:"home",creatures:s.creatures.filter(c=>!carried.has(c.id))};
    const {state:adv,report,landStats}=advanceAway(homeOnly,landRef.current,away,speedRef.current);
    if(landStats) landDirtyRef.current=true;
    // The ones you carried come back through the door with you, and the bag empties into the homebase
    const pl=s.player;
    const back=s.creatures.filter(c=>carried.has(c.id)).map((c,i)=>{
      const a=i/Math.max(1,carried.size)*Math.PI*2;
      let col=pl.col+Math.cos(a)*1.1, row=pl.row+Math.sin(a)*0.8+0.4;
      if(!isPassable(mapRef.current,col,row)){ col=pl.col; row=pl.row+0.5; }
      return {...c,col,row,state:"wander",targetId:null,path:null,dcol:0,drow:0};
    });
    const newcomers=s.trip.bag.length;
    stateRef.current={...adv,clock:s.clock,where:"home",trip:null,world:s.world,creatures:[...adv.creatures,...back],floats:[]};
    const lines=[...(report?.lines||[])];
    if(beaten) lines.unshift("Your creatures were beaten, so you hurried home. They'll recover here.");
    if(newcomers) lines.unshift(`${newcomers} ${newcomers===1?"creature":"creatures"} from your bag moved into your homebase`);
    if(away>=60000||beaten||newcomers) setAwayReport({awayMs:away,lines,title:"Back home"});
    refreshUi(); saveNow();
  };

  // ── Battles out in the shared world
  const startBattle=(wild,how)=>{
    const s=stateRef.current; if(!s||battleRef.current) return;
    const vineC=(s.vine||[]).map(id=>s.creatures.find(c=>c.id===id)).filter(Boolean);
    const lead=vineC.findIndex(c=>(c.hp||0)>0.05);
    const trip={...s.trip,wilds:s.trip.wilds.filter(w=>w.id!==wild.id)};
    if(lead<0){
      stateRef.current={...s,trip};
      addFloat(`A wild ${speciesOf(wild).name} ${how==="charge"?"charged, but":"appeared, but"} your creatures are too hurt to battle. It ran off.`,"#facc15",s.trip.player);
      return;
    }
    const ordered=[vineC[lead],...vineC.filter((_,i)=>i!==lead)];
    partyRef.current=ordered; setParty(ordered);
    stateRef.current={...s,trip};
    const b={wild,how,key:Date.now()}; battleRef.current=b; setBattle(b);
  };
  const swapToFront=idx=>{
    const p=[...partyRef.current]; const t=p[0]; p[0]=p[idx]; p[idx]=t;
    partyRef.current=p; setParty(p);
  };
  const saveBattleHp=(idx,battleHp,maxHp)=>{
    const p=[...partyRef.current];
    if(p[idx]) p[idx]={...p[idx],battleHp,maxHp,hp:Math.max(0,battleHp/maxHp),fainted:battleHp<=0};
    partyRef.current=p; setParty(p);
  };
  // Write what happened in the battle back onto your creatures (health, experience, moves)
  const settleParty=(updates)=>{
    const s=stateRef.current;
    const byId=new Map(updates.map(u=>[u.id,u]));
    stateRef.current={...s,creatures:s.creatures.map(c=>{ const u=byId.get(c.id); return u?{...c,hp:u.hp,xp:u.xp??c.xp,level:u.level??c.level,moves:u.moves??c.moves}:c; })};
  };
  const partyHp=c=>c.battleHp!=null&&c.maxHp?Math.max(c.fainted?0.05:0.05,c.battleHp/c.maxHp):(c.hp??1);
  const endBattle=()=>{ battleRef.current=null; setBattle(null); lastFrameRef.current=0; accRef.current=0; };
  const handleBattleEnd=(result,fp,partIds,xpEach)=>{
    const p=partyRef.current, wild=battleRef.current?.wild;
    endBattle();
    const leadHp=result==="loss"?0.05:fp.battleHp!=null&&fp.maxHp?Math.max(0.05,fp.battleHp/fp.maxHp):Math.max(0.05,fp.hp||0.05);
    const ups=p.map((c,i)=>{
      if(i===0) return {...c,hp:leadHp,xp:fp.xp??c.xp,level:fp.level??c.level,moves:fp.moves??c.moves};
      let u={...c,hp:partyHp(c)};
      if(result==="win"&&xpEach&&partIds?.has?.(c.id)) u=giveXp(u,xpEach);
      return u;
    });
    settleParty(ups);
    const s=stateRef.current;
    if(result==="loss"){
      stateRef.current={...s,creatures:s.creatures.map(c=>(s.vine||[]).includes(c.id)?{...c,hp:Math.min(c.hp,0.1)}:c)};
      goHome(true); return;
    }
    if(wild) addFloat(result==="win"?`The wild ${speciesOf(wild).name} ran off`:"You got away","#cbd5c0",s.trip.player);
    refreshUi(); saveNow();
  };
  const handleBattleCapture=(caught,mine)=>{
    const p=partyRef.current;
    endBattle();
    const leadHp=mine?.battleHp!=null&&mine?.maxHp?Math.max(0.05,mine.battleHp/mine.maxHp):p[0]?.hp??1;
    settleParty(p.map((c,i)=>({...c,hp:i===0?leadHp:partyHp(c)})));
    const s=stateRef.current;
    const name=pickName(s.creatures.map(c=>c.name));
    const pet={...caught,wild:false,name,mood:null,state:"wander",targetId:null,path:null,dcol:0,drow:0,battleHp:null,maxHp:undefined,
      moves:caught.moves||deriveMoves(caught.dna,speciesOf(caught).types),habitat:1,petAt:0};
    const toVine=(s.vine||[]).length<6;
    const trip={...s.trip,bag:toVine?s.trip.bag:[...s.trip.bag,pet.id]};
    stateRef.current={...s,creatures:[...s.creatures,pet],vine:toVine?[...s.vine,pet.id]:s.vine,trip,world:takeFromPop(s.world,caught.col,caught.row,caught.species)};
    addFloat(`Caught a ${speciesOf(pet).name}! Meet ${name}${toVine?"":" (in your bag)"}`,"#86efac",s.trip.player);
    refreshUi(); saveNow();
  };

  // ── Feeding the food you carry
  const feedCreature=id=>{
    const s=stateRef.current, c=s.creatures.find(o=>o.id===id); if(!c) return;
    const kind=(SPECIES[c.species]?.eats||[]).find(k=>(s.food?.[k]||0)>0);
    if(!kind){ addFloat("No food it eats in your bag","#facc15"); return; }
    stateRef.current={...s,food:{...s.food,[kind]:s.food[kind]-1},creatures:s.creatures.map(o=>o.id===id?{...o,fullness:Math.min(1,o.fullness+0.4)}:o)};
    refreshUi(); saveNow();
  };
  // Out in the world, creatures move between vine and bag only at your door, springs and shoals
  const moveBetween=id=>{
    const s=stateRef.current; if(!s||s.where!=="out"||!atSwapSpot(s)) return;
    const onVine=(s.vine||[]).includes(id), bag=s.trip.bag||[];
    if(onVine){
      if(bag.length>=BAG_MAX||s.vine.length<=1) return;
      stateRef.current={...s,vine:s.vine.filter(v=>v!==id),trip:{...s.trip,bag:[...bag,id]}};
    } else {
      if(s.vine.length>=VINE_MAX) return;
      stateRef.current={...s,vine:[...s.vine,id],trip:{...s.trip,bag:bag.filter(b=>b!==id)}};
    }
    refreshUi(); saveNow();
  };

  // ── Creatures: the vine is the (up to six) you'll take through the door
  const toggleVine=id=>{
    const s=stateRef.current; if(!s) return;
    const vine=s.vine||[];
    const next=vine.includes(id)?vine.filter(v=>v!==id):vine.length<VINE_MAX?[...vine,id]:vine;
    stateRef.current={...s,vine:next}; refreshUi(); saveNow();
  };
  const renameCreature=(id,name)=>{
    const clean=name.trim().slice(0,14); if(!clean) return;
    const s=stateRef.current;
    stateRef.current={...s,creatures:s.creatures.map(c=>c.id===id?{...c,name:clean}:c)}; refreshUi(); saveNow();
  };

  // Block selection (but let you type a name)
  useEffect(()=>{
    const isField=t=>t&&t.closest&&t.closest("input");
    const kill=e=>{ if(!isField(e.target)) e.preventDefault(); };
    const killTs=e=>{if(!e.target.closest("button")&&!e.target.closest("[data-scroll]")&&!isField(e.target)&&e.target.tagName.toLowerCase()!=="canvas")e.preventDefault();};
    document.addEventListener("selectstart",kill);
    document.addEventListener("contextmenu",kill);
    document.addEventListener("touchstart",killTs,{passive:false});
    return()=>{document.removeEventListener("selectstart",kill);document.removeEventListener("contextmenu",kill);document.removeEventListener("touchstart",killTs);};
  },[]);

  // Measure
  useEffect(()=>{
    const CTRL=214,TOP=36+30; // header + land readout strip
    const measure=()=>setDims({W:window.innerWidth,H:Math.max(160,window.innerHeight-CTRL-TOP-8)});
    measure();
    window.addEventListener("resize",measure);
    return()=>window.removeEventListener("resize",measure);
  },[]);

  // Game loop: real time is turned into fixed world steps, then the world is drawn
  useEffect(()=>{
    if(screen!=="game")return;
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d");
    const dpr=Math.min(3,window.devicePixelRatio||1);
    canvas.width=Math.round(dims.W*dpr); canvas.height=Math.round(dims.H*dpr);
    lastFrameRef.current=0; accRef.current=0;
    const loop=ts=>{
      animRef.current=requestAnimationFrame(loop);
      if(!stateRef.current||!mapRef.current)return;
      const dt=lastFrameRef.current?Math.min(250,ts-lastFrameRef.current):0;
      lastFrameRef.current=ts;
      if(!pausedRef.current&&!battleRef.current){
        accRef.current+=dt;
        while(accRef.current>=TICK_MS){
          accRef.current-=TICK_MS;
          tickRef.current++;
          const land=landRef.current;
          // Out in Atlanta: the homebase waits, and is caught up when you go home
          if(stateRef.current.where==="out"){
            const next=simulateOutside(stateRef.current,tickRef.current,inputRef.current,TICK_MS*speedRef.current);
            const enc=next._encounter; delete next._encounter;
            stateRef.current=next;
            if(enc){ startBattle(enc.wild,enc.how); break; }
            if(tickRef.current%100===0) saveNow();
            if(tickRef.current%6===0){
              const sN=stateRef.current, act=outsideAct(sN), tp=sN.trip.player, w=atlanta();
              focusRef.current=act?.kind==="battle"?act.wild.id:null;
              const biome=w.biome[Math.floor(tp.row)]?.[Math.floor(tp.col)];
              setUiState(u=>({...u,creatures:sN.creatures,vine:sN.vine||[],bag:sN.trip.bag||[],where:"out",clock:sN.clock||0,food:sN.food||{},act,atSwap:atSwapSpot(sN),
                place:{biome:BIOME_NAMES[biome]||"",lv:Math.min(10,1+Math.floor(distFromDoor(tp.col,tp.row)/14)),area:areaKey(tp.col,tp.row)}}));
            }
            continue;
          }
          stateRef.current=simulateHome(stateRef.current,tickRef.current,inputRef.current,mapRef.current,land,TICK_MS*speedRef.current);
          // Walking wears the ground; enough wear makes a path
          const seen=lastTileRef.current, sNow=stateRef.current;
          const walkers=[{id:"player",col:sNow.player.col,row:sNow.player.row,odds:1},...sNow.creatures.map(c=>({id:c.id,col:c.col,row:c.row,odds:0.15}))];
          for(const w of walkers){
            const key=Math.floor(w.col)+","+Math.floor(w.row);
            if(seen.get(w.id)!==key){ seen.set(w.id,key); if(Math.random()<w.odds&&trample(land,w.col,w.row)) landDirtyRef.current=true; }
          }
          // The land and plants change slowly with real time
          if(tickRef.current%20===0){
            const stepMs=20*TICK_MS*speedRef.current;
            const st=growLand(land,stepMs,plantEffects(stateRef.current.plants));
            const g=growPlants(stateRef.current.plants,land,stepMs);
            stateRef.current={...stateRef.current,plants:g.plants};
            if(st.grew||st.thinned||st.pathsFaded||tickRef.current%200===0) landDirtyRef.current=true;
          }
          if(tickRef.current%100===0) saveNow();
          if(tickRef.current%6===0){
            const s=stateRef.current, pl=s.player, cell=land?.cells[Math.floor(pl.row)]?.[Math.floor(pl.col)];
            const here=cell?{wet:cell.wet,temp:cell.temp,soil:cell.soil,veg:cell.veg,trample:cell.trample,water:cell.water}:null;
            const act=actHint(); focusRef.current=act?.kind==="pet"?act.id:null;
            setUiState(u=>({...u,creatures:s.creatures,vine:s.vine||[],bag:[],where:"home",plants:s.plants.length,clock:s.clock||0,here,seeds:s.seeds||{},food:s.food||{},garden:gardenInfo(),act,atSwap:true}));
          }
        }
      } else accRef.current=0;
      if(stateRef.current.where==="out"){
        const sO=stateRef.current, z=zoomRef.current;
        if(!outGroundRef.current) outGroundRef.current=buildGround(atlanta().tiles);
        ctx.setTransform(dpr*z,0,0,dpr*z,0,0);
        drawWorld(ctx,dims.W/z,dims.H/z,{player:sO.trip.player,creatures:sO.trip.wilds,plants:[],floats:sO.floats||[],rustles:sO.trip.rustles},atlanta().tiles,outGroundRef.current,tickRef.current,null,null,null,focusRef.current);
        return;
      }
      if(landDirtyRef.current&&ts-lastGroundRef.current>400){
        landDirtyRef.current=false; lastGroundRef.current=ts;
        const next=deriveMap(landRef.current);
        if(JSON.stringify(next)!==JSON.stringify(mapRef.current)){ mapRef.current=next; groundRef.current=buildGround(next); }
      }
      const z=zoomRef.current;
      ctx.setTransform(dpr*z,0,0,dpr*z,0,0);
      drawWorld(ctx,dims.W/z,dims.H/z,stateRef.current,mapRef.current,groundRef.current,tickRef.current,overlayRef.current,landRef.current,showSeedsRef.current?targetTile():null,focusRef.current);
    };
    animRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(animRef.current);
  },[screen,dims]);

  const togglePause=useCallback(()=>{
    pausedRef.current=!pausedRef.current;
    setUiState(u=>({...u,paused:pausedRef.current}));
  },[]);

  const day=Math.floor((uiState.clock||0)/DAY)+1;
  const btnBase={background:"rgba(200,230,160,0.09)",border:"1.5px solid rgba(200,230,160,0.2)",borderRadius:10,color:"#c8e6a0",fontFamily:"Georgia,serif",fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:4};
  const sheet={position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:100,display:"flex",flexDirection:"column",overflowY:"auto",WebkitOverflowScrolling:"touch",touchAction:"pan-y",overscrollBehavior:"contain"};
  const closeBtn={background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#94a3b8",fontSize:18,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"};
  const column={maxWidth:400,width:"100%",boxSizing:"border-box",alignSelf:"center",padding:"0 16px"};

  if(screen==="title"&&!saveInfo){
    return(
      <div style={{position:"fixed",inset:0,background:"#0e0e0e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",gap:22,padding:"24px max(20px, env(safe-area-inset-right, 0px)) 24px max(20px, env(safe-area-inset-left, 0px))"}}>
        <div style={{color:"#c8e6a0",fontSize:28,letterSpacing:"0.22em",textTransform:"uppercase"}}>Homebase</div>
        <div style={{color:"#6a7a5a",fontSize:13,textAlign:"center",maxWidth:280,lineHeight:1.6}}>A small world of your own, with creatures to raise.</div>
        <button onClick={startNewWorld} onContextMenu={e=>e.preventDefault()}
          style={{width:"100%",maxWidth:300,borderRadius:10,padding:"13px",fontFamily:"Georgia,serif",fontSize:15,cursor:"pointer",letterSpacing:"0.06em",background:"rgba(200,230,160,0.16)",border:"1.5px solid rgba(200,230,160,0.45)",color:"#e3f5c8",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
          🌱 New homebase
        </button>
        <div style={{color:"#3a4a2a",fontSize:11,textAlign:"center",maxWidth:280,lineHeight:1.6}}>Progress saves automatically in this browser.</div>
      </div>
    );
  }

  if(screen==="title"&&saveInfo){
    const list=saveInfo.state.creatures;
    const tBtn={width:"100%",borderRadius:10,padding:"13px",fontFamily:"Georgia,serif",fontSize:15,cursor:"pointer",letterSpacing:"0.06em",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",userSelect:"none",WebkitUserSelect:"none"};
    const startNew=()=>{ if(!confirmNew){setConfirmNew(true);return;} clearSave(); setSaveInfo(null); setConfirmNew(false); startNewWorld(); };
    return(
      <div style={{position:"fixed",inset:0,background:"#0e0e0e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",gap:22,padding:"24px max(20px, env(safe-area-inset-right, 0px)) 24px max(20px, env(safe-area-inset-left, 0px))"}}>
        <div style={{color:"#c8e6a0",fontSize:28,letterSpacing:"0.22em",textTransform:"uppercase"}}>Homebase</div>
        <div style={{width:"100%",maxWidth:300,boxSizing:"border-box",background:"#141414",border:"1px solid #232a1c",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{color:"#4a6a32",fontSize:10,letterSpacing:"0.14em",textTransform:"uppercase"}}>Saved world · {timeAgo(saveInfo.savedAt)}</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {list.slice(0,12).map(c=>(
              <div key={c.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><CreatureIcon c={c} size={32}/><span style={{color:"#9aa88a",fontSize:9}}>{c.name}</span></div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",color:"#7a8a6a",fontSize:12,fontVariantNumeric:"tabular-nums"}}>
            <span>{list.length} {list.length===1?"creature":"creatures"}</span><span>Day {Math.floor((saveInfo.state.clock||0)/DAY)+1}</span>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:300}}>
          <button onClick={continueGame} onContextMenu={e=>e.preventDefault()}
            style={{...tBtn,background:"rgba(200,230,160,0.16)",border:"1.5px solid rgba(200,230,160,0.45)",color:"#e3f5c8"}}>
            ▶ Continue
          </button>
          <button onClick={startNew} onContextMenu={e=>e.preventDefault()}
            style={{...tBtn,background:confirmNew?"rgba(248,113,113,0.15)":"transparent",border:"1.5px solid "+(confirmNew?"rgba(248,113,113,0.5)":"#2a2a2a"),color:confirmNew?"#f87171":"#7a7a7a",fontSize:14}}>
            {confirmNew?"Tap again to erase this world":"New world"}
          </button>
          {confirmNew&&<button onClick={()=>setConfirmNew(false)} style={{...tBtn,background:"transparent",border:"none",color:"#5a5a5a",fontSize:13,padding:"4px"}}>Keep my world</button>}
        </div>
        <div style={{color:"#3a4a2a",fontSize:11,textAlign:"center",maxWidth:280,lineHeight:1.6}}>Progress saves automatically in this browser.</div>
      </div>
    );
  }

  const creatures=uiState.creatures||[], vine=uiState.vine||[];
  const cardC=cardId!=null?creatures.find(c=>c.id===cardId):null;
  const bar=(v,col)=>(
    <div style={{flex:1,height:6,background:"#1e2618",borderRadius:3,overflow:"hidden"}}>
      <div style={{width:`${Math.round(Math.max(0,Math.min(1,v))*100)}%`,height:"100%",background:col,borderRadius:3,transition:"width 0.6s"}}/>
    </div>
  );

  return(
    <div style={{background:"#0e0e0e",height:"100%",width:"100vw",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"Georgia,serif",userSelect:"none"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"5px 12px",flexShrink:0,background:"rgba(0,0,0,0.5)",borderBottom:"1px solid rgba(200,230,160,0.08)",height:36}}>
        <span style={{color:"#c8e6a0",fontSize:13,letterSpacing:"0.14em",textTransform:"uppercase"}}>{uiState.where==="out"?"Atlanta":"Homebase"}</span>
        <div style={{display:"flex",gap:10,marginLeft:"auto",alignItems:"center"}}>
          <span style={{color:"#4a6a32",fontSize:11}}>🐾 <span style={{color:"#86efac"}}>{creatures.length}</span></span>
          {uiState.where!=="out"&&<span style={{color:"#4a6a32",fontSize:11}}>🌿 <span style={{color:"#4ade80"}}>{uiState.plants}</span></span>}
          <span style={{color:"#6a8a52",fontSize:10,letterSpacing:"0.08em",opacity:Date.now()-lastSaved<2500?1:0,transition:"opacity 0.6s"}}>💾 saved</span>
          <span style={{color:"#6a8a52",fontSize:11,fontVariantNumeric:"tabular-nums"}}>Day {day}</span>
        </div>
      </div>

      {/* Out in Atlanta: where you are and how strong the creatures are around here */}
      {uiState.where==="out"&&(
        <div style={{display:"flex",gap:6,padding:"3px 8px",height:30,flexShrink:0,background:"rgba(0,0,0,0.35)",alignItems:"center",overflowX:"auto"}}>
          {[["📍",uiState.place?.biome||"Atlanta"],["⚔",`Around Lv${uiState.place?.lv||1}`],["🐾",`${creatures.filter(c=>vine.includes(c.id)&&c.hp>0.05).length}/${vine.length} ready`],["🎒",`${(uiState.bag||[]).length}/${BAG_MAX}`]].map(([icon,val])=>(
            <div key={icon} style={{flex:"1 1 0",minWidth:0,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(200,230,160,0.12)",borderRadius:6,color:"#dbeac8",fontSize:11,padding:"3px 4px",whiteSpace:"nowrap"}}>
              <span>{icon}</span><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{val}</span>
            </div>
          ))}
        </div>
      )}
      {/* The patch you're standing on: tap one to see it across the land */}
      {uiState.where!=="out"&&<div style={{display:"flex",gap:6,padding:"3px 8px",height:30,flexShrink:0,background:"rgba(0,0,0,0.35)",alignItems:"center",overflowX:"auto"}}>
        {[
          ["wet","💧",uiState.here?Math.round(uiState.here.wet*100)+"%":"–","Wetness"],
          ["temp","🌡",uiState.here?Math.round(20+uiState.here.temp*80)+"°F":"–","Temperature"],
          ["soil","🪨",uiState.here?SOILS[uiState.here.soil]?.label:"–","Soil"],
          ["veg","🌿",uiState.here?(uiState.here.water?"Water":["Bare","Grass","Tall","Forest"][uiState.here.veg]+(uiState.here.trample>=6?" · path":"")):"–","Growth"],
        ].map(([key,icon,val,label])=>(
          <button key={key} onClick={()=>setOverlay(o=>o===key?null:key)} aria-label={label+": "+val+". Tap to show across the land"} aria-pressed={overlay===key}
            style={{flex:"1 1 0",minWidth:0,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:overlay===key?"rgba(200,230,160,0.2)":"rgba(255,255,255,0.04)",border:"1px solid "+(overlay===key?"rgba(200,230,160,0.55)":"rgba(200,230,160,0.12)"),borderRadius:6,color:"#dbeac8",fontFamily:"Georgia,serif",fontSize:11,padding:"3px 4px",cursor:"pointer",whiteSpace:"nowrap",touchAction:"manipulation"}}>
            <span>{icon}</span><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{val}</span>
          </button>
        ))}
      </div>}

      {/* Canvas */}
      <div style={{position:"relative",flexShrink:0}}>
        {overlay&&uiState.where!=="out"&&(
          <div style={{position:"absolute",top:6,left:6,zIndex:5,background:"rgba(0,0,0,0.65)",borderRadius:6,padding:"5px 8px",display:"flex",gap:8,flexWrap:"wrap",maxWidth:"calc(100% - 12px)",pointerEvents:"none"}}>
            {(overlay==="veg"?[["Bare","rgba(170,120,70,0.85)"],["Grass","rgba(150,200,90,0.85)"],["Tall","rgba(70,160,70,0.85)"],["Forest","rgba(20,90,40,0.9)"],["Path","rgba(220,180,120,0.9)"]]:overlay==="soil"?Object.entries(SOILS).map(([k,v])=>[v.label,SOIL_COLORS[k]]):overlay==="wet"?[["Dry","rgba(230,190,90,0.8)"],["Damp","rgba(90,170,220,0.8)"],["Waterlogged","rgba(40,90,220,0.9)"]]:[["Cool","rgba(80,140,230,0.8)"],["Mild","rgba(200,200,120,0.8)"],["Hot","rgba(230,90,60,0.8)"]]).map(([label,col])=>(
              <span key={label} style={{display:"flex",alignItems:"center",gap:4,color:"#e2e8f0",fontSize:10}}><span style={{width:9,height:9,borderRadius:2,background:col}}/>{label}</span>
            ))}
          </div>
        )}
        <canvas ref={canvasRef} style={{display:"block",width:"100%",height:dims.H,touchAction:"none"}}
          onTouchStart={onCanvasTouchStart} onTouchMove={onCanvasTouchMove} onTouchEnd={onCanvasTouchEnd} onWheel={onCanvasWheel}/>
        <div style={{position:"absolute",right:"max(8px, env(safe-area-inset-right, 0px))",top:8,zIndex:5,display:"flex",flexDirection:"column",gap:6}}>
          {[["+","Zoom in",1.25],["−","Zoom out",0.8]].map(([label,name,k])=>(
            <button key={name} onClick={()=>setZoom(zoom*k)} aria-label={name} disabled={k>1?zoom>=2:zoom<=0.5}
              style={{width:34,height:34,borderRadius:8,background:"rgba(0,0,0,0.55)",border:"1px solid rgba(200,230,160,0.3)",color:"#e3f5c8",fontSize:18,lineHeight:1,cursor:"pointer",opacity:(k>1?zoom>=2:zoom<=0.5)?0.35:1,touchAction:"manipulation"}}>{label}</button>
          ))}
        </div>
        {uiState.paused&&(
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#c8e6a0",fontSize:22,letterSpacing:"0.22em",textTransform:"uppercase"}}>Paused</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{flex:1,position:"relative",touchAction:"none",background:"rgba(0,0,0,0.55)",borderTop:"1px solid rgba(200,230,160,0.08)",display:"flex",flexDirection:"column",padding:"8px max(12px, env(safe-area-inset-right, 0px)) max(28px, calc(env(safe-area-inset-bottom, 0px) + 12px)) max(12px, env(safe-area-inset-left, 0px))",gap:8,overflow:"hidden"}}>
          {showSeeds&&uiState.where!=="out"&&(
          <div style={{position:"absolute",left:158,right:"max(8px, env(safe-area-inset-right, 0px))",top:8,bottom:"max(24px, calc(env(safe-area-inset-bottom, 0px) + 8px))",zIndex:6,background:"#0c100a",border:"1px solid rgba(134,239,172,0.3)",borderRadius:10,padding:"7px 8px",display:"flex",flexDirection:"column",gap:5,overflow:"hidden",touchAction:"manipulation"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{color:"#c8e6a0",fontSize:12,letterSpacing:"0.08em"}}>Seeds</span>
              <button onClick={()=>setShowSeeds(false)} aria-label="Close seeds" style={{background:"transparent",border:"none",color:"#94a3b8",fontSize:16,cursor:"pointer",padding:"0 4px"}}>✕</button>
            </div>
            {Object.entries(PLANT_SPECIES).map(([id,sp])=>{
              const n=uiState.seeds?.[id]||0, f=uiState.garden?.fits?.[id];
              const good=f&&f.fit>0&&!uiState.garden.occupied;
              return(
                <div key={id} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:15}}>{sp.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:"#e2e8f0",fontSize:12}}>{sp.name} <span style={{color:"#86efac"}}>×{n}</span></div>
                    <div style={{color:good?(f.fit>=0.45?"#86efac":"#facc15"):"#f87171",fontSize:10}}>{f?f.word:"–"}</div>
                  </div>
                  <button onClick={()=>plantSeed(id)} disabled={!n||!good}
                    style={{...btnBase,width:54,height:30,fontSize:11,opacity:n&&good?1:0.4,background:"rgba(134,239,172,0.12)",border:"1.5px solid rgba(134,239,172,0.4)",color:"#d1fae5"}}>Plant</button>
                </div>
              );
            })}
            <button onClick={gatherSeeds} disabled={!uiState.garden?.gather}
              style={{...btnBase,height:30,fontSize:11,opacity:uiState.garden?.gather?1:0.4}}>
              {uiState.garden?.gather?`Gather ${uiState.garden.gather} seeds`:"Gather (stand by a grown plant)"}
            </button>
          </div>
        )}
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flex:1}}>
          <DPad inputRef={inputRef}/>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <div style={{display:"flex",gap:8}}>
              <button onClick={doAct} onContextMenu={e=>e.preventDefault()} aria-label={uiState.act?.label||"Act"}
                style={{...btnBase,width:96,height:52,background:uiState.act?"rgba(253,230,138,0.16)":"rgba(253,230,138,0.06)",border:"2px solid "+(uiState.act?"rgba(253,230,138,0.6)":"rgba(253,230,138,0.22)"),color:"#fde68a",fontWeight:"bold",borderRadius:14,flexDirection:"column",gap:2}}>
                <span style={{fontSize:17}}>{{pet:"🤚",harvest:"🌾",out:"🚪",home:"🚪",battle:"⚔️",rest:"💧"}[uiState.act?.kind]||"✋"}</span>
                <span style={{fontSize:10,maxWidth:88,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{uiState.act?.label||"ACT"}</span>
              </button>
              <button onClick={()=>{setPanel("creatures");refreshUi();}} onContextMenu={e=>e.preventDefault()} aria-label="Your creatures"
                style={{...btnBase,width:58,height:52,borderRadius:14,flexDirection:"column",gap:2}}>
                <span style={{fontSize:17}}>🐾</span><span style={{fontSize:9,color:"#86efac"}}>{vine.length}/{VINE_MAX}</span>
              </button>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setPanel("bag")} onContextMenu={e=>e.preventDefault()} aria-label="Bag"
                style={{...btnBase,width:58,height:40}}>
                <span style={{fontSize:14}}>🎒</span>
              </button>
              <button disabled={uiState.where==="out"} onClick={()=>{setShowSeeds(v=>!v);setUiState(u=>({...u,garden:gardenInfo(),seeds:stateRef.current?.seeds||{}}));}} onContextMenu={e=>e.preventDefault()} aria-label="Seeds"
                style={{...btnBase,width:58,height:40,flexDirection:"column",gap:1,opacity:uiState.where==="out"?0.35:1,background:showSeeds?"rgba(134,239,172,0.16)":btnBase.background,border:showSeeds?"1.5px solid rgba(134,239,172,0.5)":btnBase.border}}>
                <span style={{fontSize:14}}>🌱</span><span style={{fontSize:9,color:"#86efac"}}>{Object.values(uiState.seeds||{}).reduce((a,b)=>a+b,0)}</span>
              </button>
              <button onClick={togglePause} onContextMenu={e=>e.preventDefault()} aria-label={uiState.paused?"Resume":"Pause"}
                style={{...btnBase,width:58,height:40}}>
                {uiState.paused?"▶":"⏸"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Your creatures, and the vine of up to six */}
      {panel==="creatures"&&(
        <div data-scroll="" style={sheet}>
          <div style={{...column,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 10px"}}>
            <span style={{color:"#c8e6a0",fontSize:15,letterSpacing:"0.12em",textTransform:"uppercase"}}>🐾 Creatures <span style={{color:"#3a5228",fontSize:11}}>{creatures.length}</span></span>
            <button onClick={()=>setPanel(null)} aria-label="Close" style={closeBtn}>✕</button>
          </div>
          <div style={column}>
            <div style={{color:"#6a7a5a",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>Your vine · {vine.length}/{VINE_MAX}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginBottom:6}}>
              {Array.from({length:VINE_MAX}).map((_,i)=>{
                const c=creatures.find(o=>o.id===vine[i]);
                return(
                  <button key={i} disabled={!c} onClick={()=>c&&(setCardId(c.id),setRenaming(null))} aria-label={c?c.name+", on your vine":"Empty vine slot"}
                    style={{aspectRatio:"1",width:"100%",padding:0,borderRadius:"50%",background:c?dnaColor(c.dna,12):"#121612",border:"2px solid "+(c?"rgba(134,239,172,0.55)":"#1f2a1a"),display:"flex",alignItems:"center",justifyContent:"center",cursor:c?"pointer":"default",touchAction:"manipulation"}}>
                    {c&&<CreatureIcon c={c} size={34}/>}
                  </button>
                );
              })}
            </div>
            <div style={{color:"#4a5a3a",fontSize:11,lineHeight:1.5,marginBottom:14}}>{uiState.where==="out"
              ?(uiState.atSwap?"You're at a resting spot: open a creature's card to move it between your vine and your bag.":"You can move creatures between your vine and your bag at your door, a spring or the river shoals.")
              :"The creatures on your vine are the ones that will come with you through the door."}</div>
            <div style={{color:"#6a7a5a",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>{uiState.where==="out"?`With you · bag ${(uiState.bag||[]).length}/${BAG_MAX}`:"Living here"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {(uiState.where==="out"?creatures.filter(c=>vine.includes(c.id)||(uiState.bag||[]).includes(c.id)):creatures).map(c=>{
                const v=conditionOf(c);
                return(
                  <button key={c.id} onClick={()=>{setCardId(c.id);setRenaming(null);}}
                    style={{display:"flex",alignItems:"center",gap:10,background:"#111611",border:"1px solid "+(vine.includes(c.id)?"rgba(134,239,172,0.35)":"#1e261a"),borderRadius:10,padding:"8px 10px",cursor:"pointer",textAlign:"left",fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
                    <CreatureIcon c={c} size={40}/>
                    <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:3}}>
                      <div style={{color:"#e2e8f0",fontSize:13}}>{c.name} <span style={{color:c.sex==="F"?"#f9a8d4":"#93c5fd"}}>{c.sex==="F"?"♀":"♂"}</span> <span style={{color:"#6b7a5e",fontSize:11}}>· {lifeStage(c).label}</span>{vine.includes(c.id)&&<span style={{color:"#86efac",fontSize:10}}> · on vine</span>}{(uiState.bag||[]).includes(c.id)&&<span style={{color:"#fbbf24",fontSize:10}}> · in bag</span>}</div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:"#6b7a5e",fontSize:10,width:44}}>Fullness</span>{bar(c.fullness,c.fullness>=HUNGRY_AT?"#86efac":c.fullness>=WEAK_AT?"#facc15":"#f87171")}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:"#6b7a5e",fontSize:10,width:44}}>Health</span>{bar(c.hp,c.hp>0.5?"#86efac":c.hp>0.2?"#facc15":"#f87171")}
                      </div>
                    </div>
                    <span style={{color:condColor(v),fontSize:11,whiteSpace:"nowrap"}}>{conditionWord(c)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{height:24}}/>
        </div>
      )}

      {/* Bag: seeds and, later, things you find */}
      {panel==="bag"&&(
        <div data-scroll="" style={sheet}>
          <div style={{...column,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 10px"}}>
            <span style={{color:"#c8e6a0",fontSize:15,letterSpacing:"0.12em",textTransform:"uppercase"}}>🎒 Bag</span>
            <button onClick={()=>setPanel(null)} aria-label="Close" style={closeBtn}>✕</button>
          </div>
          <div style={{...column,display:"flex",flexDirection:"column",gap:8}}>
            <div style={{color:"#6a7a5a",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase"}}>Seeds</div>
            {Object.entries(PLANT_SPECIES).map(([id,sp])=>(
              <div key={id} style={{display:"flex",alignItems:"center",gap:10,background:"#111611",border:"1px solid #1e261a",borderRadius:10,padding:"10px 12px"}}>
                <span style={{fontSize:18}}>{sp.icon}</span>
                <span style={{flex:1,color:"#e2e8f0",fontSize:13}}>{sp.name} seeds</span>
                <span style={{color:"#86efac",fontSize:13,fontVariantNumeric:"tabular-nums"}}>×{uiState.seeds?.[id]||0}</span>
              </div>
            ))}
            <div style={{color:"#6a7a5a",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",marginTop:8}}>Food</div>
            {Object.entries(FOOD_NAMES).map(([id,label])=>(
              <div key={id} style={{display:"flex",alignItems:"center",gap:10,background:"#111611",border:"1px solid #1e261a",borderRadius:10,padding:"10px 12px"}}>
                <span style={{fontSize:18}}>{PLANT_SPECIES[id].icon}</span>
                <span style={{flex:1,color:"#e2e8f0",fontSize:13}}>{label}</span>
                <span style={{color:"#86efac",fontSize:13,fontVariantNumeric:"tabular-nums"}}>×{uiState.food?.[id]||0}</span>
              </div>
            ))}
            <div style={{color:"#4a5a3a",fontSize:11,lineHeight:1.5}}>Harvest food from grown plants at home with Act. Feed a creature from its card.</div>
            <div style={{color:"#6a7a5a",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",marginTop:8}}>Creatures · {(uiState.bag||[]).length}/{BAG_MAX}</div>
            {(uiState.bag||[]).length?(
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {(uiState.bag||[]).map(id=>{ const c=creatures.find(o=>o.id===id); return c&&(
                  <button key={id} onClick={()=>{setCardId(id);setRenaming(null);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"#111611",border:"1px solid #2a3520",borderRadius:10,padding:"6px 8px",cursor:"pointer",touchAction:"manipulation"}}>
                    <CreatureIcon c={c} size={36}/><span style={{color:"#cbd5c0",fontSize:10,fontFamily:"Georgia,serif"}}>{c.name}</span>
                  </button>); })}
              </div>
            ):<div style={{color:"#4a5a3a",fontSize:12,lineHeight:1.5}}>Creatures you catch once your vine is full go here. They move into your homebase when you go home.</div>}
          </div>
        </div>
      )}

      {/* A creature's card */}
      {cardC&&(()=>{
        const c=cardC, st=lifeStage(c), nx=nextStageIn(c), v=conditionOf(c), onVine=vine.includes(c.id);
        const cell=uiState.where==="out"?null:landRef.current?.cells[Math.floor(c.row)]?.[Math.floor(c.col)];
        return(
          <div data-scroll="" style={{...sheet,zIndex:120,background:"rgba(0,0,0,0.8)",justifyContent:"flex-end"}} onClick={e=>{ if(e.target===e.currentTarget){setCardId(null);setRenaming(null);} }}>
            <div style={{...column,padding:0,marginBottom:"max(12px, env(safe-area-inset-bottom, 0px))"}}>
              <div style={{margin:"0 12px",background:"#111511",border:`1px solid ${dnaColor(c.dna,28)}`,borderRadius:14,padding:14,display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{background:dnaColor(c.dna,10),borderRadius:12,padding:4}}><CreatureIcon c={c} size={64}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    {renaming!==null?(
                      <form onSubmit={e=>{e.preventDefault();renameCreature(c.id,renaming);setRenaming(null);}} style={{display:"flex",gap:6}}>
                        <input autoFocus value={renaming} maxLength={14} onChange={e=>setRenaming(e.target.value)} aria-label="Name"
                          style={{flex:1,minWidth:0,background:"#0b0f0b",border:"1px solid rgba(200,230,160,0.4)",borderRadius:6,color:"#e2e8f0",fontFamily:"Georgia,serif",fontSize:16,padding:"4px 8px",userSelect:"text",WebkitUserSelect:"text"}}/>
                        <button type="submit" style={{...btnBase,touchAction:"manipulation",padding:"0 10px",height:32,fontSize:12}}>Done</button>
                      </form>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:"#f1f5e8",fontSize:18}}>{c.name}</span>
                        <span style={{color:c.sex==="F"?"#f9a8d4":"#93c5fd",fontSize:16}} aria-label={c.sex==="F"?"female":"male"}>{c.sex==="F"?"♀":"♂"}</span>
                        <button onClick={()=>setRenaming(c.name)} aria-label="Rename" style={{background:"transparent",border:"none",color:"#6b7a5e",fontSize:13,cursor:"pointer",padding:"2px 4px",touchAction:"manipulation"}}>✎</button>
                      </div>
                    )}
                    <div style={{color:"#8a9a7a",fontSize:12,marginTop:2}}>{speciesOf(c).name} · {st.label} · {fmtAge(c.age)} old</div>
                    <div style={{color:"#5a6a4a",fontSize:11,marginTop:2}}>{(speciesOf(c).types||[]).join(" / ")} · Lv{c.level||1} · {nx?`${nx.stage.label} in ${formatDuration(nx.ms)}`:"In the last part of its life"}</div>
                  </div>
                  <button onClick={()=>{setCardId(null);setRenaming(null);}} aria-label="Close" style={{...closeBtn,alignSelf:"flex-start"}}>✕</button>
                </div>
                <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between"}}>
                  <span style={{color:"#6a7a5a",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase"}}>Condition</span>
                  <span style={{color:condColor(v),fontSize:15}}>{conditionWord(c)}</span>
                </div>
                {[["Fullness",c.fullness,fullnessWord(c.fullness),c.fullness>=HUNGRY_AT?"#86efac":c.fullness>=WEAK_AT?"#facc15":"#f87171"],
                  ["Health",c.hp,Math.round(c.hp*100)+"%","#86efac"],
                  ["Habitat",c.habitat,habitatWord(c,cell),condColor(c.habitat)]].map(([k,val,word,col])=>(
                  <div key={k} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:"#8a9a7a",fontSize:11,width:56}}>{k}</span>{bar(val,col)}
                    <span style={{color:"#cbd5c0",fontSize:11,width:92,textAlign:"right"}}>{word}</span>
                  </div>
                ))}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px 10px"}}>
                  {[["Size",c.dna.size],["Speed",c.dna.speed],["Lifespan",c.dna.lifespan],["Strength",c.dna.strength],["Appetite",c.dna.metabolism??1],["Temper",c.dna.aggression]].map(([k,val])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid #1c2418",paddingBottom:2}}>
                      <span style={{color:"#5a6a4a",fontSize:10}}>{k}</span><span style={{color:"#9aa88a",fontSize:10,fontFamily:"monospace"}}>{val.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {(()=>{ const kind=(SPECIES[c.species]?.eats||[]).find(k=>(uiState.food?.[k]||0)>0), n=(SPECIES[c.species]?.eats||[]).reduce((a,k)=>a+(uiState.food?.[k]||0),0);
                  return <button onClick={()=>feedCreature(c.id)} disabled={!kind||c.fullness>=0.97}
                    style={{...btnBase,touchAction:"manipulation",height:36,fontSize:12,opacity:!kind||c.fullness>=0.97?0.45:1}}>
                    🌿 {!kind?"No food it eats in your bag":c.fullness>=0.97?"Full":`Feed ${FOOD_NAMES[kind].toLowerCase()} (${n} left)`}
                  </button>; })()}
                {uiState.where==="out"?(()=>{ const inBag=(uiState.bag||[]).includes(c.id);
                  const blocked=!uiState.atSwap||(inBag?vine.length>=VINE_MAX:((uiState.bag||[]).length>=BAG_MAX||vine.length<=1));
                  return <button onClick={()=>moveBetween(c.id)} disabled={blocked}
                    style={{...btnBase,touchAction:"manipulation",height:40,fontSize:13,opacity:blocked?0.45:1}}>
                    {!uiState.atSwap?(inBag?"In your bag · swap at a resting spot":"On your vine · swap at a resting spot"):inBag?(vine.length>=VINE_MAX?"Your vine is full":"Move to your vine"):((uiState.bag||[]).length>=BAG_MAX?"Your bag is full":vine.length<=1?"Your last one on the vine":"Move to your bag")}
                  </button>; })():
                <button onClick={()=>toggleVine(c.id)} disabled={!onVine&&vine.length>=VINE_MAX}
                  style={{...btnBase,touchAction:"manipulation",height:40,fontSize:13,opacity:!onVine&&vine.length>=VINE_MAX?0.45:1,background:onVine?"rgba(134,239,172,0.14)":btnBase.background,border:"1.5px solid "+(onVine?"rgba(134,239,172,0.5)":"rgba(200,230,160,0.2)")}}>
                  {onVine?"On your vine · tap to take off":vine.length>=VINE_MAX?"Your vine is full (6)":`Put on your vine (${vine.length}/${VINE_MAX})`}
                </button>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Battle */}
      {battle&&(
        <BattleScreen key={battle.key}
          playerCreature={party[0]}
          wildCreature={battle.wild}
          intro={battle.how==="charge"?`A wild ${speciesOf(battle.wild).name} charges at you!`:battle.how==="rustle"?`A wild ${speciesOf(battle.wild).name} jumps out of the cover!`:null}
          canCatch={vine.length<VINE_MAX||(uiState.bag||[]).length<BAG_MAX}
          onEnd={handleBattleEnd}
          onCapture={handleBattleCapture}
          battleInventory={party}
          onSwapToFront={swapToFront}
          onSaveBattleHp={saveBattleHp}
        />
      )}

      {/* While you were away */}
      {awayReport&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{width:"100%",maxWidth:320,background:"#141414",border:"1px solid #2a3520",borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",gap:10}}>
            <div style={{color:"#c8e6a0",fontSize:15,letterSpacing:"0.08em"}}>{awayReport.title||"While you were away"}</div>
            <div style={{color:"#6a7a5a",fontSize:12}}>{formatDuration(awayReport.awayMs)}</div>
            {awayReport.lines.length
              ?awayReport.lines.map((l,i)=><div key={i} style={{color:"#cbd5c0",fontSize:13,lineHeight:1.5}}>• {l}</div>)
              :<div style={{color:"#cbd5c0",fontSize:13}}>All was quiet in your homebase.</div>}
            <button onClick={()=>setAwayReport(null)} style={{marginTop:4,background:"rgba(200,230,160,0.14)",border:"1.5px solid rgba(200,230,160,0.4)",borderRadius:10,color:"#e3f5c8",fontFamily:"Georgia,serif",fontSize:14,padding:"10px",cursor:"pointer"}}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
