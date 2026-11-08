import { useState, useEffect, useRef, useCallback } from "react";
import { COLS, ROWS, TICK_MS, INVENTORY_MAX, XP_PER_LEVEL, FIGHT_DIST, BREED_TICKS, BREED_HUE_COMPAT, BREED_MIN_LEVEL } from "./config.js";
import { newId, setNextId } from "./engine/ids.js";
import { readSave, writeSave, clearSave, timeAgo } from "./engine/save.js";
import { catchUp, formatDuration } from "./engine/time.js";
import { isPassable } from "./world/tiles.js";
import { makeLand, deriveMap, growLand, trample, timeSpeed, SOILS } from "./world/land.js";
import { buildGround, drawWorld, SOIL_COLORS } from "./world/render.js";
import { randomDNA, dnaColor } from "./creatures/dna.js";
import { makeCreature, makeWildCreature, makePlayer } from "./creatures/factory.js";
import { PLANT_SPECIES, GATHER_COOLDOWN_MS, fitOf, fitWord, makeSeedling, plantKey, startingPlants, plantEffects, growPlants } from "./plants/plants.js";
import { speciesOf, lifeStage, CreatureIcon, SlotSprite } from "./creatures/species.jsx";
import { deriveMoves, learnMoveAtLevel, TYPE_COLORS } from "./battle/moves.js";
import { BattleScreen } from "./battle/BattleScreen.jsx";
import { simulate } from "./sim/simulate.js";
import DPad from "./ui/DPad.jsx";

// Adds what happened to the land while you were away to the away report
function withLand(report,stats,away,plantStats=null){
  if(!stats&&!plantStats) return report;
  const r=report?{...report,lines:[...report.lines]}:{awayMs:away,lines:[]};
  if(plantStats){
    const {sprouted,matured,spread,died}=plantStats;
    if(sprouted) r.lines.push(`${sprouted} ${sprouted===1?"seed":"seeds"} sprouted`);
    if(matured) r.lines.push(`${matured} ${matured===1?"plant":"plants"} grew to full size`);
    if(spread) r.lines.push(`Plants spread to ${spread} new ${spread===1?"spot":"spots"}`);
    if(died) r.lines.push(`${died} ${died===1?"plant":"plants"} wilted in the wrong spot`);
  }
  if(!stats) return r;
  if(stats.grew) r.lines.push(`${stats.grew} ${stats.grew===1?"patch":"patches"} of land grew taller`);
  if(stats.thinned) r.lines.push(`${stats.thinned} ${stats.thinned===1?"patch":"patches"} thinned out`);
  if(stats.pathsFaded) r.lines.push(`${stats.pathsFaded} worn ${stats.pathsFaded===1?"path":"paths"} grew back over`);
  return r;
}

// A brand-new homebase: land, wild creatures, plants, and your starter in the bag
function makeNewWorld(){
  const land=makeLand();
  const map=deriveMap(land);
  const player=makePlayer(map);
  const starter={...makeCreature(player.col,player.row,randomDNA()),level:1,hp:1.0};
  const creatures=[]; let tries=0;
  while(creatures.length<16&&tries++<600){
    const c=Math.floor(Math.random()*COLS)+0.5, r=Math.floor(Math.random()*ROWS)+0.5;
    if(isPassable(map,c,r)&&Math.hypot(c-player.col,r-player.row)>4) creatures.push(makeWildCreature(c,r));
  }
  const plants=startingPlants(land);
  return { land, map, state:{ creatures, plants, player, inventory:[starter], seeds:{bogmoss:5,cattail:3}, events:[], floats:[], tick:0 } };
}

export default function Homebase(){
  const canvasRef=useRef(null);
  const stateRef=useRef(null);
  const tickRef=useRef(0);          // world steps since this world began
  const animRef=useRef(null);
  const lastFrameRef=useRef(0);     // real time of the previous animation frame
  const accRef=useRef(0);           // real time not yet turned into world steps
  const groundRef=useRef(null);     // pre-drawn ground for the current map
  const hiddenAtRef=useRef(0);      // when the tab was last hidden
  const landRef=useRef(null);       // conditions and growth of every patch
  const landDirtyRef=useRef(false); // the visible tiles need recomputing
  const lastGroundRef=useRef(0);    // when the ground was last redrawn
  const lastTileRef=useRef(new Map()); // the patch each walker was last on, for trampling
  const speedRef=useRef(timeSpeed()); // ?speed=N speeds up land changes for testing
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
  const inputRef=useRef({dx:0,dy:0,capturePressed:false,fightPressed:false});
  const battleRef=useRef(null);

  const[saveInfo,setSaveInfo]=useState(()=>readSave());
  const[screen,setScreen]=useState("title"); // title | game | gameover
  const[mapData,setMapData]=useState(null);
  const[awayReport,setAwayReport]=useState(null);
  const mapRef=useRef(null);
  const[lastSaved,setLastSaved]=useState(0);
  const[confirmNew,setConfirmNew]=useState(false);

  // Write the current world to this browser's storage
  const saveNow=useCallback(()=>{
    if(!mapRef.current||!stateRef.current) return;
    if(!stateRef.current.inventory.length) return; // nothing worth resuming
    const d=writeSave(landRef.current,{...stateRef.current,tick:tickRef.current},tickRef.current*TICK_MS);
    if(d){ setSaveInfo(d); setLastSaved(Date.now()); }
  },[]);

  // Resume a saved world, then run the catch-up step for the time you were away
  const continueGame=useCallback(()=>{
    const d=readSave(); if(!d) { setScreen("title"); return; }
    landRef.current=d.land;
    const away=Date.now()-(d.savedAt||Date.now());
    const awayScaled=away*speedRef.current;
    const landStats=growLand(d.land,awayScaled,plantEffects(d.state.plants||[]));
    const grown=growPlants(d.state.plants||[],d.land,awayScaled);
    const map=deriveMap(d.land);
    mapRef.current=map; groundRef.current=buildGround(map); setMapData(map);
    const caught=catchUp({...d.state,plants:grown.plants,seeds:d.state.seeds||{bogmoss:5,cattail:3},events:[],floats:[]},away);
    const state=caught.state, report=withLand(caught.report,landStats,away,grown.stats);
    stateRef.current=state;
    tickRef.current=d.state.tick||Math.floor((d.worldTime||0)/TICK_MS);
    const maxId=[...state.creatures,...state.plants,...state.inventory].reduce((m,e)=>Math.max(m,e.id||0),0);
    setNextId(Math.max(d.nextId||1,maxId+1));
    setUiState(u=>({...u,creatures:state.creatures.length,plants:state.plants.length,tick:tickRef.current,inventory:state.inventory}));
    if(report&&away>=60000) setAwayReport(report);
    setScreen("game");
  },[]);

  // Start a brand-new homebase
  const startNewWorld=useCallback(()=>{
    const {land,map,state}=makeNewWorld();
    landRef.current=land; mapRef.current=map; groundRef.current=buildGround(map); setMapData(map);
    stateRef.current=state; tickRef.current=0;
    setUiState(u=>({...u,creatures:state.creatures.length,plants:state.plants.length,tick:0,inventory:state.inventory}));
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
        const awayScaled=away*speedRef.current;
        const landStats=landRef.current?growLand(landRef.current,awayScaled,plantEffects(stateRef.current.plants)):null;
        if(landStats) landDirtyRef.current=true;
        const grown=growPlants(stateRef.current.plants,landRef.current,awayScaled);
        const caught=catchUp({...stateRef.current,plants:grown.plants},away);
        const state=caught.state, report=withLand(caught.report,landStats,away,grown.stats);
        stateRef.current=state;
        setUiState(u=>({...u,inventory:state.inventory,plants:state.plants.length}));
        if(report&&away>=60000) setAwayReport(report);
      }
    };
    document.addEventListener("visibilitychange",onVis);
    window.addEventListener("pagehide",saveNow);
    return()=>{document.removeEventListener("visibilitychange",onVis);window.removeEventListener("pagehide",saveNow);};
  },[saveNow]);
  const[dims,setDims]=useState({W:390,H:320});
  const[uiState,setUiState]=useState({creatures:0,plants:0,tick:0,inventory:[],paused:false});
  const[battle,setBattle]=useState(null);
  const[showBag,setShowBag]=useState(false);
  const[selectedInv,setSelectedInv]=useState(null);
  const[moveFrom,setMoveFrom]=useState(null); // bag slot being moved, or null
  const swapSlots=(a,b)=>{
    const s=stateRef.current; if(!s||a===b||!s.inventory[a]||!s.inventory[b]) return;
    const inv=[...s.inventory]; [inv[a],inv[b]]=[inv[b],inv[a]];
    stateRef.current={...s,inventory:inv}; setUiState(u=>({...u,inventory:inv}));
  };
  const openBag=()=>{ setShowBag(p=>!p); setSelectedInv(stateRef.current?.inventory.length?0:null); setMoveFrom(null); };
  const closeBag=()=>{ setShowBag(false); setSelectedInv(null); setMoveFrom(null); };

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
  const addFloat=(text,color)=>{ const s=stateRef.current; stateRef.current={...s,floats:[...s.floats,{id:newId(),col:s.player.col,row:s.player.row,text,color,tick:tickRef.current}]}; };
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

  // Block selection
  useEffect(()=>{
    const kill=e=>e.preventDefault();
    const killTs=e=>{if(!e.target.closest("button")&&!e.target.closest("[data-scroll]")&&e.target.tagName.toLowerCase()!=="canvas")e.preventDefault();};
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

  // Camera-based rendering — no pre-render needed

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
      if(!pausedRef.current&&!battle){
        accRef.current+=dt;
        while(accRef.current>=TICK_MS){
          accRef.current-=TICK_MS;
          tickRef.current++;
          stateRef.current=simulate(stateRef.current,tickRef.current,inputRef,mapRef.current);
          // Walking wears the ground; enough wear makes a path
          const land=landRef.current, seen=lastTileRef.current, sNow=stateRef.current;
          const walkers=[{id:"player",col:sNow.player.col,row:sNow.player.row,odds:1},...sNow.creatures.map(c=>({id:c.id,col:c.col,row:c.row,odds:0.15}))];
          for(const w of walkers){
            const key=Math.floor(w.col)+","+Math.floor(w.row);
            if(seen.get(w.id)!==key){ seen.set(w.id,key); if(Math.random()<w.odds&&trample(land,w.col,w.row)) landDirtyRef.current=true; }
          }
          // The land changes slowly with real time
          if(tickRef.current%20===0){
            const stepMs=20*TICK_MS*speedRef.current;
            const st=growLand(land,stepMs,plantEffects(stateRef.current.plants));
            const g=growPlants(stateRef.current.plants,land,stepMs);
            stateRef.current={...stateRef.current,plants:g.plants};
            if(st.grew||st.thinned||st.pathsFaded||tickRef.current%200===0) landDirtyRef.current=true;
          }
          if(inputRef.current.fightPressed){
            inputRef.current.fightPressed=false;
            const s=stateRef.current;
            const {col:pc2,row:pr2}=s.player;
            const wild=s.creatures.filter(c=>!c.dead).reduce((best,c)=>{
              const d=Math.hypot(c.col-pc2,c.row-pr2);
              return (!best||d<best.d)?{c,d}:best;
            },null);
            if(wild&&wild.d<FIGHT_DIST){
              const inv=s.inventory;
              if(inv.length>0){const b={playerCreature:inv[0],wildCreature:wild.c};battleRef.current=b;setBattle(b);}
              else{const starter=makeCreature(pc2,pr2);starter.level=1;starter.moves=deriveMoves(starter.dna);const b={playerCreature:starter,wildCreature:wild.c,isStarter:true};battleRef.current=b;setBattle(b);}
              break;
            } else {
              stateRef.current={...s,floats:[...s.floats,{id:newId(),col:s.player.col,row:s.player.row,text:"No creature nearby!",color:"#f87171",tick:tickRef.current}]};
            }
          }
          if(tickRef.current%100===0) saveNow();
          if(tickRef.current%6===0){
            const pl=stateRef.current.player, cell=landRef.current?.cells[Math.floor(pl.row)]?.[Math.floor(pl.col)];
            const here=cell?{wet:cell.wet,temp:cell.temp,soil:cell.soil,veg:cell.veg,trample:cell.trample,water:cell.water}:null;
            setUiState(u=>({...u,creatures:stateRef.current.creatures.length,plants:stateRef.current.plants.length,tick:tickRef.current,inventory:stateRef.current.inventory,here,seeds:stateRef.current.seeds||{},garden:gardenInfo()}));
          }
        }
      } else accRef.current=0;
      if(landDirtyRef.current&&ts-lastGroundRef.current>400){
        landDirtyRef.current=false; lastGroundRef.current=ts;
        const next=deriveMap(landRef.current);
        if(JSON.stringify(next)!==JSON.stringify(mapRef.current)){ mapRef.current=next; groundRef.current=buildGround(next); }
      }
      const z=zoomRef.current;
      ctx.setTransform(dpr*z,0,0,dpr*z,0,0);
      drawWorld(ctx,dims.W/z,dims.H/z,stateRef.current,mapRef.current,groundRef.current,tickRef.current,overlayRef.current,landRef.current,showSeedsRef.current?targetTile():null);
    };
    animRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(animRef.current);
  },[screen,battle,dims]);

  const battleEndedAt=useRef(0);
  const togglePause=useCallback(()=>{
    if(Date.now()-battleEndedAt.current<600) return; // ignore a tap that started on the battle screen
    pausedRef.current=!pausedRef.current;
    setUiState(u=>({...u,paused:pausedRef.current}));
  },[]);
  const handleCapture=useCallback(()=>{inputRef.current.capturePressed=true;},[]);
  const handleFight=useCallback(()=>{inputRef.current.fightPressed=true;},[]);

  const handleSwapToFront=useCallback((idx)=>{
    if(!stateRef.current||idx===0)return;
    const s=stateRef.current;
    const inv=[...s.inventory];
    const tmp=inv[0]; inv[0]=inv[idx]; inv[idx]=tmp;
    stateRef.current={...s,inventory:inv};
    setUiState(u=>({...u,inventory:inv}));
  },[]);

  const handleSaveBattleHp=useCallback((idx,battleHp,maxHp)=>{
    if(!stateRef.current)return;
    const s=stateRef.current;
    const inv=[...s.inventory];
    if(inv[idx]) inv[idx]={...inv[idx],battleHp,maxHp,hp:Math.max(0,battleHp/maxHp),fainted:battleHp<=0};
    stateRef.current={...s,inventory:inv};
    setUiState(u=>({...u,inventory:inv})); // the battle's swap list reads this
  },[]);

  // After a battle: turn any mid-battle HP into bag HP, and remove creatures that fainted
  const settleAfterBattle=(inv)=>inv
    .filter(c=>!c.fainted)
    .map(c=>c.battleHp!=null&&c.maxHp?{...c,hp:Math.max(0.05,c.battleHp/c.maxHp),battleHp:null}:c);

  // Shared XP for creatures that fought but weren't out at the end
  const giveXp=(c,xp)=>{
    const need=Math.floor(XP_PER_LEVEL*(c.dna.xpRate??1));
    const nxp=(c.xp||0)+xp, nl=Math.floor(nxp/need)+1;
    let moves=c.moves||[];
    if(nl>(c.level||1)){ const m=learnMoveAtLevel(c.dna,nl,moves); if(m) moves=moves.length<4?[...moves,m]:[moves[0],...moves.slice(2),m]; }
    return {...c,xp:nxp,level:Math.max(c.level||1,nl),moves};
  };

  const handleBattleEnd=useCallback((result,finalCreature,partIds,xpEach)=>{
    const wasStarter=battleRef.current&&battleRef.current.isStarter;
    setBattle(null); battleRef.current=null;
    battleEndedAt.current=Date.now();
    if(!stateRef.current)return;
    const s0=stateRef.current;
    const lead=s0.inventory[0];
    const rest=settleAfterBattle(s0.inventory.slice(1)).map(c=>
      result==="win"&&xpEach&&partIds&&partIds.has&&partIds.has(c.id)?giveXp(c,xpEach):c);
    const s={...s0,inventory:lead?[lead,...rest]:rest};
    if(wasStarter&&result==="win"){
      const starterHp = finalCreature.battleHp != null && finalCreature.maxHp
        ? Math.max(0.2, finalCreature.battleHp / finalCreature.maxHp)
        : Math.max(0.2, finalCreature.hp || 0.2);
      const starter={...finalCreature,hp:starterHp,battleHp:null};
      stateRef.current={...s,inventory:[starter]};
    } else if(result==="win"||result==="flee"){
      if(s.inventory.length>0){
        // Compute ratio explicitly — never trust finalCreature.hp (stale from makeBattler)
        const endHp = finalCreature.battleHp != null && finalCreature.maxHp
          ? Math.max(0.05, finalCreature.battleHp / finalCreature.maxHp)
          : Math.max(0.05, finalCreature.hp || 0.05);
        const updated={...s.inventory[0],...finalCreature,
          hp: endHp,
          battleHp:null, level:finalCreature.level,xp:finalCreature.xp,moves:finalCreature.moves};
        stateRef.current={...s,inventory:[updated,...s.inventory.slice(1)]};
      }
    } else {
      if(wasStarter) stateRef.current={...s,inventory:[{...finalCreature,hp:0.1}]};
      else stateRef.current={...s,inventory:s.inventory.slice(1)};
    }
    const remaining=stateRef.current.inventory;
    setUiState(u=>({...u,inventory:remaining}));
    // Game over if no creatures left
    if(!wasStarter && remaining.length===0) {
      clearSave(); setSaveInfo(null);
      setTimeout(()=>setScreen("gameover"), 600);
    } else saveNow();
  },[saveNow]);

  const handleBattleCapture=useCallback((capturedWild,playerBattleState)=>{
    setBattle(null); battleRef.current=null;
    if(!stateRef.current)return;
    const s=stateRef.current;
    const endHp = playerBattleState?.battleHp != null && playerBattleState?.maxHp
      ? Math.max(0.05, playerBattleState.battleHp / playerBattleState.maxHp)
      : Math.max(0.05, s.inventory[0]?.hp || 0.05);
    battleEndedAt.current=Date.now();
    const playerBack={...s.inventory[0], hp:endHp, battleHp:null};
    const rest=settleAfterBattle(s.inventory.slice(1));
    const newInv=1+rest.length<INVENTORY_MAX
      ?[playerBack,...rest,{...capturedWild,moves:capturedWild.moves||deriveMoves(capturedWild.dna)}]
      :[playerBack,...rest];
    stateRef.current={...s,inventory:newInv,creatures:s.creatures.map(c=>c.id===capturedWild.id?{...c,dead:true,deathReason:"captured"}:c)};
    setUiState(u=>({...u,inventory:stateRef.current.inventory}));
    saveNow();
  },[saveNow]);

  const elapsed=Math.floor(uiState.tick*TICK_MS/1000); // world time this session's world has run
  const timeStr=`${Math.floor(elapsed/60).toString().padStart(2,"0")}:${(elapsed%60).toString().padStart(2,"0")}`;
  const btnBase={background:"rgba(200,230,160,0.09)",border:"1.5px solid rgba(200,230,160,0.2)",borderRadius:10,color:"#c8e6a0",fontFamily:"Georgia,serif",fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:4};

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
    const inv=saveInfo.state.inventory;
    const topLv=inv.reduce((m,c)=>Math.max(m,c.level||1),1);
    const secs=Math.floor((saveInfo.worldTime||0)/1000);
    const played=secs>=3600?Math.floor(secs/3600)+"h "+Math.floor((secs%3600)/60)+"m":Math.floor(secs/60)+"m "+(secs%60)+"s";
    const tBtn={width:"100%",borderRadius:10,padding:"13px",fontFamily:"Georgia,serif",fontSize:15,cursor:"pointer",letterSpacing:"0.06em",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",userSelect:"none",WebkitUserSelect:"none"};
    const startNew=()=>{ if(!confirmNew){setConfirmNew(true);return;} clearSave(); setSaveInfo(null); setConfirmNew(false); startNewWorld(); };
    return(
      <div style={{position:"fixed",inset:0,background:"#0e0e0e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",gap:22,padding:"24px max(20px, env(safe-area-inset-right, 0px)) 24px max(20px, env(safe-area-inset-left, 0px))"}}>
        <div style={{color:"#c8e6a0",fontSize:28,letterSpacing:"0.22em",textTransform:"uppercase"}}>Homebase</div>
        <div style={{width:"100%",maxWidth:300,boxSizing:"border-box",background:"#141414",border:"1px solid #232a1c",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{color:"#4a6a32",fontSize:10,letterSpacing:"0.14em",textTransform:"uppercase"}}>Saved world · {timeAgo(saveInfo.savedAt)}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {inv.slice(0,INVENTORY_MAX).map(c=>(
              <div key={c.id} title={"Lv"+(c.level||1)} style={{position:"relative"}}><CreatureIcon c={c} size={30}/><span style={{position:"absolute",right:-2,bottom:-2,color:"#fbbf24",fontSize:8,fontWeight:"bold"}}>{c.level||1}</span></div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",color:"#7a8a6a",fontSize:12,fontVariantNumeric:"tabular-nums"}}>
            <span>{inv.length} in bag · best Lv{topLv}</span><span>{played} played</span>
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

  if(screen==="gameover") return (
    <div style={{position:"fixed",inset:0,background:"#0a0a0a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",gap:24,zIndex:500}}>
      <div style={{fontSize:48}}>💀</div>
      <div style={{color:"#f87171",fontSize:22,letterSpacing:"0.12em",textTransform:"uppercase"}}>All Creatures Fainted</div>
      <div style={{color:"#3a3a3a",fontSize:13,textAlign:"center",maxWidth:260,lineHeight:1.7}}>
        Your team has fallen. Start over in the same homebase, or begin a new one.
      </div>
      <div style={{display:"flex",gap:12,flexDirection:"column",alignItems:"center",width:"100%",maxWidth:260}}>
        <button
          
          onClick={startNewWorld}
          onContextMenu={e=>e.preventDefault()}
          style={{width:"100%",background:"rgba(248,113,113,0.15)",border:"1.5px solid rgba(248,113,113,0.4)",borderRadius:10,color:"#f87171",padding:"12px",fontFamily:"Georgia,serif",fontSize:14,cursor:"pointer",letterSpacing:"0.06em",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"}}>
          🌱 New homebase
        </button>
        <button
          
          onClick={()=>{
            if(mapData){
              const player=makePlayer(mapData);
              const starter={...makeCreature(player.col,player.row,randomDNA()),level:1,hp:1.0};
              stateRef.current={...stateRef.current,inventory:[starter],player};
              setUiState(u=>({...u,inventory:[starter]}));
              setScreen("game");
              setTimeout(saveNow,0);
            }
          }}
          onContextMenu={e=>e.preventDefault()}
          style={{width:"100%",background:"rgba(200,230,160,0.09)",border:"1.5px solid rgba(200,230,160,0.2)",borderRadius:10,color:"#c8e6a0",padding:"12px",fontFamily:"Georgia,serif",fontSize:14,cursor:"pointer",letterSpacing:"0.06em",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"}}>
          🔁 Try again (same homebase)
        </button>
      </div>
    </div>
  );

  return(
    <div style={{background:"#0e0e0e",height:"100%",width:"100vw",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"Georgia,serif",userSelect:"none"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"5px 12px",flexShrink:0,background:"rgba(0,0,0,0.5)",borderBottom:"1px solid rgba(200,230,160,0.08)",height:36}}>
        <span style={{color:"#c8e6a0",fontSize:13,letterSpacing:"0.14em",textTransform:"uppercase"}}>Homebase</span>
        <div style={{display:"flex",gap:10,marginLeft:"auto",alignItems:"center"}}>
          <span style={{color:"#4a6a32",fontSize:11}}>🐾 <span style={{color:"#86efac"}}>{uiState.creatures}</span></span>
          <span style={{color:"#4a6a32",fontSize:11}}>🌿 <span style={{color:"#4ade80"}}>{uiState.plants}</span></span>
          <span style={{color:"#6a8a52",fontSize:10,letterSpacing:"0.08em",opacity:Date.now()-lastSaved<2500?1:0,transition:"opacity 0.6s"}}>💾 saved</span>
          <span style={{color:"#3a5228",fontFamily:"monospace",fontSize:11}}>{timeStr}</span>
        </div>
      </div>

      {/* The patch you're standing on: tap one to see it across the land */}
      <div style={{display:"flex",gap:6,padding:"3px 8px",height:30,flexShrink:0,background:"rgba(0,0,0,0.35)",alignItems:"center",overflowX:"auto"}}>
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
      </div>

      {/* Canvas */}
      <div style={{position:"relative",flexShrink:0}}>
        {overlay&&(
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
        {uiState.paused&&!battle&&(
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#c8e6a0",fontSize:22,letterSpacing:"0.22em",textTransform:"uppercase"}}>Paused</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{flex:1,position:"relative",touchAction:"none",background:"rgba(0,0,0,0.55)",borderTop:"1px solid rgba(200,230,160,0.08)",display:"flex",flexDirection:"column",padding:"8px max(12px, env(safe-area-inset-right, 0px)) max(28px, calc(env(safe-area-inset-bottom, 0px) + 12px)) max(12px, env(safe-area-inset-left, 0px))",gap:8,overflow:"hidden"}}>
          {showSeeds&&!battle&&(
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
              <button onClick={handleFight} onContextMenu={e=>e.preventDefault()}
                style={{...btnBase,width:70,height:52,background:"rgba(239,68,68,0.15)",border:"2px solid rgba(239,68,68,0.45)",color:"#f87171",fontWeight:"bold",borderRadius:14,flexDirection:"column",gap:2}}>
                <span style={{fontSize:18}}>⚔️</span><span style={{fontSize:10}}>FIGHT</span>
              </button>
              <button onClick={handleCapture} onContextMenu={e=>e.preventDefault()}
                style={{...btnBase,width:70,height:52,background:"rgba(251,191,36,0.15)",border:"2px solid rgba(251,191,36,0.45)",color:"#fbbf24",fontWeight:"bold",borderRadius:14,flexDirection:"column",gap:2}}>
                <span style={{fontSize:18}}>⚡</span><span style={{fontSize:10}}>CATCH</span>
              </button>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={openBag} onContextMenu={e=>e.preventDefault()}
                style={{...btnBase,width:58,height:40,flexDirection:"column",gap:1}}>
                <span style={{fontSize:14}}>🎒</span><span style={{fontSize:9,color:"#86efac"}}>{uiState.inventory.length}/{INVENTORY_MAX}</span>
              </button>
              <button onClick={()=>{setShowSeeds(v=>!v);setUiState(u=>({...u,garden:gardenInfo(),seeds:stateRef.current?.seeds||{}}));}} onContextMenu={e=>e.preventDefault()} aria-label="Seeds"
                style={{...btnBase,width:58,height:40,flexDirection:"column",gap:1,background:showSeeds?"rgba(134,239,172,0.16)":btnBase.background,border:showSeeds?"1.5px solid rgba(134,239,172,0.5)":btnBase.border}}>
                <span style={{fontSize:14}}>🌱</span><span style={{fontSize:9,color:"#86efac"}}>{Object.values(uiState.seeds||{}).reduce((a,b)=>a+b,0)}</span>
              </button>
              <button onClick={togglePause} onContextMenu={e=>e.preventDefault()}
                style={{...btnBase,width:58,height:40}}>
                {uiState.paused?"▶":"⏸"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bag overlay */}
      {showBag&&(
        <div data-scroll="" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:100,display:"flex",flexDirection:"column",overflowY:"auto",WebkitOverflowScrolling:"touch",touchAction:"pan-y",overscrollBehavior:"contain"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 10px"}}>
            <span style={{color:"#c8e6a0",fontSize:15,letterSpacing:"0.12em",textTransform:"uppercase"}}>🎒 Bag <span style={{color:"#3a5228",fontSize:11}}>{uiState.inventory.length}/{INVENTORY_MAX}</span></span>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <button onClick={closeBag} onContextMenu={e=>e.preventDefault()}
                style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#94a3b8",fontSize:18,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"none",userSelect:"none",WebkitUserSelect:"none",WebkitTapHighlightColor:"transparent"}}>✕</button>
            </div>
          </div>
          {moveFrom!==null&&uiState.inventory[moveFrom]&&(
            <div style={{margin:"0 16px 10px",maxWidth:400,alignSelf:"center",width:"calc(100% - 32px)",boxSizing:"border-box",display:"flex",alignItems:"center",gap:10,background:"rgba(96,165,250,0.12)",border:"1px solid rgba(96,165,250,0.4)",borderRadius:10,padding:"9px 12px"}}>
              <span style={{color:"#93c5fd",fontSize:12,flex:1}}>Tap the creature to trade places with</span>
              <button onClick={()=>setMoveFrom(null)} style={{background:"transparent",border:"1px solid rgba(147,197,253,0.5)",borderRadius:8,color:"#93c5fd",fontFamily:"Georgia,serif",fontSize:12,padding:"6px 12px",cursor:"pointer"}}>Cancel</button>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"0 16px",maxWidth:400,width:"100%",boxSizing:"border-box",alignSelf:"center"}}>
            {Array.from({length:INVENTORY_MAX}).map((_,i)=>{
              const c=uiState.inventory[i]; const isSel=selectedInv===i;
              return(
                <button key={i} disabled={!c}
                  aria-label={c?"Lv"+(c.level||1)+" creature, slot "+(i+1):"Empty slot"}
                  onClick={()=>{ if(!c) return;
                    if(moveFrom!==null){ swapSlots(moveFrom,i); setSelectedInv(i); setMoveFrom(null); }
                    else setSelectedInv(i); }}
                  onContextMenu={e=>e.preventDefault()}
                  style={{aspectRatio:"1",width:"100%",padding:0,borderRadius:10,background:c?dnaColor(c.dna,10):"#141414",border:`2px ${moveFrom!==null&&c&&i!==moveFrom?"dashed":"solid"} ${i===moveFrom?"#60a5fa":isSel?"#fbbf24":moveFrom!==null&&c?"rgba(96,165,250,0.55)":c?dnaColor(c.dna,30):"#1e1e1e"}`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",cursor:c?"pointer":"default",userSelect:"none",WebkitUserSelect:"none",WebkitTapHighlightColor:"transparent",boxShadow:isSel?`0 0 12px ${dnaColor(c&&c.dna,55,0.4)}`:"none"}}>
                  {c&&(()=>{
                    // Check if compatible with any other bag creature
                    const compatible = uiState.inventory.some((o,oi) => oi!==i && o &&
                      (o.level||1)>=BREED_MIN_LEVEL && (c.level||1)>=BREED_MIN_LEVEL &&
                      Math.abs((((c.dna.hue-o.dna.hue)+540)%360)-180) <= BREED_HUE_COMPAT);
                    const readyToBreed = compatible && (c.breedCooldown??BREED_TICKS)===0 && c.hp>=0.5;
                    return <>
                      <SlotSprite c={c}/>
                      <div style={{position:"absolute",bottom:4,left:5,right:5,height:3,background:"#222",borderRadius:2}}>
                        <div style={{width:`${Math.max(0,c.hp)*100}%`,height:"100%",background:c.hp>.5?"#4ade80":c.hp>.25?"#facc15":"#f87171",borderRadius:2,transition:"width 1s"}}/>
                      </div>
                      <div style={{position:"absolute",top:3,right:5,color:"#fbbf24",fontSize:8,fontWeight:"bold"}}>L{c.level||1}</div>
                      {c.hp<1&&!readyToBreed&&<div style={{position:"absolute",top:3,left:5,fontSize:8}}>💤</div>}
                      {readyToBreed&&<div style={{position:"absolute",top:2,left:4,fontSize:9}}>💕</div>}
                      {i===0&&<div style={{position:"absolute",bottom:9,left:0,right:0,textAlign:"center",color:"#fbbf24",fontSize:7,letterSpacing:"0.1em"}}>LEAD</div>}
                    </>;
                  })()}
                </button>
              );
            })}
          </div>
          {selectedInv!==null&&uiState.inventory[selectedInv]&&(()=>{
            const c=uiState.inventory[selectedInv];
            return(
              <div style={{margin:"12px 16px 0",maxWidth:400,alignSelf:"center",width:"calc(100% - 32px)",boxSizing:"border-box",background:"#111",borderRadius:12,padding:"14px",border:`1px solid ${dnaColor(c.dna,30)}`}}>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <button disabled={selectedInv===0} onClick={()=>{swapSlots(selectedInv,0);setSelectedInv(0);setMoveFrom(null);}}
                    style={{flex:1,background:selectedInv===0?"transparent":"rgba(251,191,36,0.12)",border:"1px solid "+(selectedInv===0?"#2a2a2a":"rgba(251,191,36,0.45)"),borderRadius:8,color:selectedInv===0?"#6b5a2a":"#fbbf24",fontFamily:"Georgia,serif",fontSize:12,padding:"8px",cursor:selectedInv===0?"default":"pointer"}}>
                    {selectedInv===0?"★ Fights first":"★ Make lead"}
                  </button>
                  <button disabled={uiState.inventory.length<2} onClick={()=>setMoveFrom(moveFrom===selectedInv?null:selectedInv)}
                    style={{flex:1,background:moveFrom===selectedInv?"rgba(96,165,250,0.2)":"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.45)",borderRadius:8,color:"#93c5fd",fontFamily:"Georgia,serif",fontSize:12,padding:"8px",cursor:"pointer",opacity:uiState.inventory.length<2?0.4:1}}>
                    {moveFrom===selectedInv?"Cancel move":"↔ Move"}
                  </button>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <CreatureIcon c={c} size={44}/>
                  <div>
                    <div style={{color:"#e2e8f0",fontSize:13,fontWeight:"bold"}}>Lv{c.level||1} {speciesOf(c).name} <span style={{color:"#94a3b8",fontWeight:"normal",fontSize:11}}>· {({baby:"Baby",adolescent:"Adolescent",adult:"Adult",elder:"Elder"})[lifeStage(c).id]}</span></div>
                    <div style={{color:"#475569",fontSize:10}}>XP: {c.xp||0} / {Math.floor((c.level||1)*100*(c.dna.xpRate??1))}</div>
                    {c.hp<1&&<div style={{color:"#4ade80",fontSize:10}}>💤 Resting — HP recovering</div>}
                  {(()=>{
                    const cd = c.breedCooldown ?? BREED_TICKS;
                    const pct = Math.round((1 - cd/BREED_TICKS)*100);
                    const compatible = uiState.inventory.some((o,oi) => oi!==selectedInv && o &&
                      (o.level||1)>=BREED_MIN_LEVEL &&
                      Math.abs((((c.dna.hue-o.dna.hue)+540)%360)-180)<=BREED_HUE_COMPAT);
                    if (cd===0 && compatible) return <div style={{color:"#f472b6",fontSize:10}}>💕 Ready to breed!</div>;
                    if (compatible) return <div style={{color:"#64748b",fontSize:10}}>💕 Compatible — {pct}% ready</div>;
                    return <div style={{color:"#374151",fontSize:10}}>No compatible partner in bag</div>;
                  })()}
                  </div>
                  <div style={{flex:1,height:4,background:"#1e293b",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${Math.min(100,((c.xp||0)%Math.floor(XP_PER_LEVEL*(c.dna.xpRate??1)))/Math.floor(XP_PER_LEVEL*(c.dna.xpRate??1))*100)}%`,height:"100%",background:"#818cf8",borderRadius:2}}/>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 14px",marginBottom:12}}>
                  {[["HP",`${Math.round((c.hp||0)*100)}%`],["Strength",c.dna.strength.toFixed(2)],["Speed",c.dna.speed.toFixed(2)],["Size",c.dna.size.toFixed(2)],["Aggression",c.dna.aggression.toFixed(2)],["Fertility",c.dna.fertility.toFixed(2)],["Metabolism",(c.dna.metabolism??1).toFixed(2)],["Repro Rate",(c.dna.reproRate??1).toFixed(2)],["XP Rate",(c.dna.xpRate??1).toFixed(2)],["HP Range",(c.dna.hpRange??1).toFixed(2)]].map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid #1e1e1e",paddingBottom:3}}>
                      <span style={{color:"#475569",fontSize:10}}>{k}</span>
                      <span style={{color:"#94a3b8",fontFamily:"monospace",fontSize:10}}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{color:"#3a5228",fontSize:9,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.1em"}}>Moves</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                  {(c.moves||[]).map(m=>(
                    <div key={m.id} style={{background:`${TYPE_COLORS[m.type]}18`,border:`1px solid ${TYPE_COLORS[m.type]}55`,borderRadius:6,padding:"5px 7px"}}>
                      <div style={{color:TYPE_COLORS[m.type],fontSize:11,fontWeight:"bold",marginBottom:1}}>{m.name}</div>
                      <div style={{display:"flex",gap:5,fontSize:9,color:"#475569"}}>
                        <span>{m.type}</span>
                        {m.power>0&&<span>PWR {m.power}</span>}
                        {m.acc<1&&<span>{Math.round(m.acc*100)}%</span>}
                        {m.effect&&<span style={{color:"#fbbf24"}}>✦</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <div style={{height:20}}/>
        </div>
      )}

      {/* While you were away */}
      {awayReport&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{width:"100%",maxWidth:320,background:"#141414",border:"1px solid #2a3520",borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",gap:10}}>
            <div style={{color:"#c8e6a0",fontSize:15,letterSpacing:"0.08em"}}>While you were away</div>
            <div style={{color:"#6a7a5a",fontSize:12}}>{formatDuration(awayReport.awayMs)}</div>
            {awayReport.lines.length
              ?awayReport.lines.map((l,i)=><div key={i} style={{color:"#cbd5c0",fontSize:13,lineHeight:1.5}}>• {l}</div>)
              :<div style={{color:"#cbd5c0",fontSize:13}}>All was quiet in your homebase.</div>}
            <button onClick={()=>setAwayReport(null)} style={{marginTop:4,background:"rgba(200,230,160,0.14)",border:"1.5px solid rgba(200,230,160,0.4)",borderRadius:10,color:"#e3f5c8",fontFamily:"Georgia,serif",fontSize:14,padding:"10px",cursor:"pointer"}}>Continue</button>
          </div>
        </div>
      )}

      {/* Battle */}
      {battle&&(
        <BattleScreen
          playerCreature={battle.playerCreature}
          wildCreature={battle.wildCreature}
          onEnd={handleBattleEnd}
          onCapture={handleBattleCapture}
          battleInventory={uiState.inventory}
          onSwapToFront={handleSwapToFront}
          onSaveBattleHp={handleSaveBattleHp}
        />
      )}
    </div>
  );
}

