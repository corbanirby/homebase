import { useState, useEffect, useRef } from "react";
import { XP_PER_LEVEL } from "../config.js";
import { lifeStage, speciesOf, spriteImage, useSpritesLoaded, CreatureIcon } from "../creatures/species.jsx";
import { dnaColor } from "../creatures/dna.js";
import { levelUpMoves, TYPE_COLORS } from "./moves.js";
import { moveEffectText } from "./movelist.js";
import { makeBattler, executeBattleMove, endOfRound, aiPickMove, goesFirst, benchState, usableMoves, isPhysical } from "./engine.js";
import { STATUS, toWorld } from "./statuses.js";

// ─── Battle components ────────────────────────────────────────────────────────
export function BattleSprite({creature,size=90,flipped=false,shake=false}){
  useSpritesLoaded();
  // Wild foe faces the player (front three-quarter); yours is seen from behind
  const st=lifeStage(creature), sp=speciesOf(creature);
  const img=spriteImage(sp,st.id,flipped?"south-west":"north-east");
  const px=Math.round(size*Math.min(1.25,Math.max(0.75,creature.dna.size))*(0.55+0.45*st.scale));
  return <div style={{width:size,height:size,display:"flex",alignItems:"flex-end",justifyContent:"center",position:"relative"}}>
    <div style={{position:"absolute",bottom:2,width:px*0.7,height:px*0.16,borderRadius:"50%",background:"rgba(0,0,0,0.25)"}}/>
    {img?<img src={img.src} alt={sp.name} width={px} height={px} style={{imageRendering:"pixelated",position:"relative",filter:shake?"brightness(1.6) saturate(1.5)":"none",transition:"filter 0.08s"}}/>:null}
  </div>;
}

// ♀ pink, ♂ blue, next to the name
const SexMark=({sex})=>sex==="F"?<span style={{color:"#f9a8d4",marginLeft:4}} aria-label="female">♀</span>:sex==="M"?<span style={{color:"#93c5fd",marginLeft:4}} aria-label="male">♂</span>:null;
export function HpBar({current,max,label,level,sex=null}){
  const pct=Math.max(0,current/max);
  const col=pct>0.5?"#4ade80":pct>0.25?"#facc15":"#f87171";
  return(
    <div style={{background:"#1a1a2e",border:"1px solid #2a2a4a",borderRadius:6,padding:"6px 10px",minWidth:150}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{color:"#e2e8f0",fontSize:12,fontWeight:"bold"}}>{label}<SexMark sex={sex}/></span>
        <span style={{color:"#64748b",fontSize:10}}>Lv{level}</span>
      </div>
      <div style={{background:"#0f0f1e",borderRadius:3,height:8,overflow:"hidden",marginBottom:3}}>
        <div style={{width:`${pct*100}%`,height:"100%",background:col,borderRadius:3,transition:"width 0.3s"}}/>
      </div>
      <div style={{color:"#64748b",fontSize:10,textAlign:"right"}}>{current}/{max}</div>
    </div>
  );
}

const BADGE_LEGACY={burn:["🔥","#f97316","burn"],poison:["☠️","#a855f7","poison"],paralyze:["⚡","#eab308","paralyzed"],freeze:["🧊","#38bdf8","frozen"]};
// Every status it has, with its level (copies running) and turns left
export function StatusBadges({b}){
  const by=new Map();
  for(const f of b.fx||[]){ const e=by.get(f.id)||{id:f.id,n:0,turns:0}; e.n++; e.turns=Math.max(e.turns,f.turns); by.set(f.id,e); }
  const items=[...by.values()].map(e=>{ const d=STATUS[e.id]||{}; return {key:e.id,icon:d.icon||"?",color:d.color||"#888",text:(d.name||e.id)+(e.n>1?" "+e.n:"")+(e.id==="knocked"?"":` · ${e.turns}`)}; });
  if(b.status&&BADGE_LEGACY[b.status]){ const[icon,color,text]=BADGE_LEGACY[b.status]; items.push({key:"legacy",icon,color,text}); }
  if(!items.length) return null;
  return <div style={{display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center",maxWidth:150}}>
    {items.map(i=><span key={i.key} style={{background:i.color+"33",border:`1px solid ${i.color}`,borderRadius:4,padding:"1px 5px",fontSize:10,color:i.color,whiteSpace:"nowrap"}}>{i.icon} {i.text}</span>)}
  </div>;
}

export function BattleScreen({playerCreature,wildCreature,onEnd,onCapture,battleInventory,onSwapToFront,onSaveBattleHp,intro=null,canCatch=true,pods=[],onPodBroken=null,biome=null}){
  const[showPods,setShowPods]=useState(false);
  const[phase,setPhase]=useState("player_turn");
  const[player,setPlayer]=useState(()=>makeBattler(playerCreature,biome));
  const[enemy,setEnemy]=useState(()=>makeBattler({...wildCreature,wild:true},biome));
  const[activeCreature,setActiveCreature]=useState(playerCreature); // tracks sprite
  const[log,setLog]=useState(()=>{
    const l=[intro||("A wild Lv"+(wildCreature.level||1)+" "+speciesOf(wildCreature).name+" appeared!")];
    if(enemy.habitatBonus) l.push(`The ${speciesOf(wildCreature).name} is on its home ground (+10%).`);
    if(player.habitatBonus) l.push(`${playerCreature.name||"Yours"} feels at home here (+10%).`);
    return l;
  });
  const[shakeP,setShakeP]=useState(false);
  const[shakeE,setShakeE]=useState(false);
  const[pending,setPending]=useState(null);
  const[showSwap,setShowSwap]=useState(false);
  const[participantIds,setParticipantIds]=useState(new Set([playerCreature.id])); // for XP split
  const logRef=useRef(null);
  const playerRef=useRef(player);
  const busyRef=useRef(false);        // true from the moment you act until your next turn starts
  const afterQueueRef=useRef(null);   // runs once the current messages finish (e.g. the foe's turn)
  // Time in battle: each round is a turn (5 minutes) for every creature you carry
  const roundRef=useRef(0);
  // Creatures on the bench keep their stat stages, statuses and stamina (and their clocks keep running)
  const benchRef=useRef(new Map());
  // How often each of your creatures used each move (mastery)
  const usesRef=useRef({});
  // Statuses Dawn Chorus has cleared from the whole team
  const curedRef=useRef(new Set());
  // Single gate for every player action: blocks double taps before React re-renders
  function claimTurn(){
    if(phase!=="player_turn"||busyRef.current) return false;
    busyRef.current=true; setPhase("message"); return true;
  }
  function giveTurnBack(){ busyRef.current=false; setPhase("player_turn"); }
  const enemyRef=useRef(enemy);
  useEffect(()=>{playerRef.current=player;},[player]);
  useEffect(()=>{enemyRef.current=enemy;},[enemy]);
  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[log]);

  // Message queue — items are { msg, applyState? }
  // applyState() fires when that message is displayed, syncing HP bar with log
  useEffect(()=>{
    if(!pending||!pending.length)return;
    const timer=setTimeout(()=>{
      const[item,...rest]=pending;
      if(item.applyState) item.applyState();
      setLog(l=>[...l,String(item.msg||'')]);
      if(!rest.length){
        setPending(null);
        if(afterQueueRef.current){
          const next=afterQueueRef.current; afterQueueRef.current=null;
          setTimeout(next,300); return;
        }
        settleTurn();
      } else setPending(rest);
    },700);
    return()=>clearTimeout(timer);
  },[pending]);

  // After a turn's messages: someone fainted, or it's your turn again
  function settleTurn(){
    const p=playerRef.current, e=enemyRef.current;
    if(e.battleHp<=0) setTimeout(()=>endBattle("win",p,e),300);
    else if(p.battleHp<=0){
      const remaining=(battleInventory||[]).filter((_,i)=>i>0&&battleInventory[i]&&(battleInventory[i].hp||0)>0.05);
      if(remaining.length>0) setPhase("forced_swap");
      else setTimeout(()=>endBattle("loss",p,e),300);
    }
    else giveTurnBack();
  }
  // A benched creature catches up on the rounds it sat out (poison keeps hurting, stamina comes back)
  function catchUpBench(b,rounds){
    let x=b;
    for(let i=0;i<rounds&&x.battleHp>0;i++){ x=endOfRound(x).b; x={...x,stamina:Math.min(x.maxSta,x.stamina+Math.round(x.maxSta*0.05))}; }
    return x;
  }
  function benchFor(c){
    const saved=benchRef.current.get(c.id);
    if(!saved){ const cured=curedRef.current; return {b:makeBattler(cured.size?{...c,statuses:(c.statuses||[]).filter(x=>!cured.has(x.id))}:c,biome),rounds:0}; }
    return {b:catchUpBench(makeBattler(c,biome,saved),roundRef.current-saved.at),rounds:roundRef.current-saved.at};
  }
  // What the battle did to everyone you carry: statuses and stamina going back into the world
  function battleResults(active){
    const updates={};
    const put=b=>{ updates[b.id]={statuses:toWorld(b.fx),stamina:b.maxSta?b.stamina/b.maxSta:1,fatigued:!!b.fatigued,hp:b.battleHp/b.maxHp}; };
    if(active) put(active);
    for(const c of battleInventory||[]){
      if(!c||c.id===active?.id||!benchRef.current.has(c.id)) continue;
      put(benchFor(c).b);
    }
    return {rounds:roundRef.current,updates,uses:usesRef.current,cured:[...curedRef.current],entered:[...benchRef.current.keys(),active?.id].filter(Boolean)};
  }
  function endBattle(result,fp,fe){
    const extra=battleResults(fp);
    if(result==="win"){
      const totalXp=Math.floor(20+(fe.level||1)*8);
      const numPart=participantIds.size||1;
      const xpEach=Math.max(1,Math.floor(totalXp/numPart));
      const xpMsg=numPart>1?" (split "+numPart+" ways)":"";
      const xpNeeded=Math.floor(XP_PER_LEVEL*(fp.dna.xpRate??1));
      const nxp=(fp.xp||0)+xpEach, nl=Math.floor(nxp/xpNeeded)+1;
      const lu=nl>(fp.level||1);
      const up=levelUpMoves(fp,nl);
      const lvMsg=lu?" Level UP → Lv"+nl+"!":"";
      setLog(l=>{const m=[...l,"Won! +"+xpEach+" XP"+xpMsg+"."+lvMsg];for(const n of up.names) m.push(`${fp.label} learned ${n}!`);return m;});
      setPhase("end");
      setTimeout(()=>onEnd("win",{...fp,xp:nxp,level:Math.max(fp.level||1,nl),moves:up.moves,learned:up.learned,hp:fp.battleHp/fp.maxHp},participantIds,xpEach,extra),lu?1800:1200);
    } else {
      setLog(l=>[...l,"Your creature fainted..."]);
      setPhase("end");
      setTimeout(()=>onEnd("loss",{...fp,hp:0.05},null,0,extra),1200);
    }
  }
  // Show a creature's move results one message at a time; HP changes when the first result shows
  function queueMove(items,r,before,mine){
    const [first,...rest]=r.msgs;
    items.push({msg:first});
    // A song for the whole team: the ones on the bench (and the ones yet to come out) hear it too
    if(mine&&r.newAttacker.teamCure){
      const ids=r.newAttacker.teamCure; ids.forEach(id=>curedRef.current.add(id));
      for(const [k,v] of benchRef.current) benchRef.current.set(k,{...v,fx:(v.fx||[]).filter(f=>!ids.includes(f.id))});
      r={...r,newAttacker:{...r.newAttacker,teamCure:null}};
    }
    const apply=()=>{
      const a=r.newAttacker, d=r.newDefender;
      if(mine){ setPlayer(a); playerRef.current=a; setEnemy(d); enemyRef.current=d; if(d.battleHp<before.battleHp){setShakeE(true);setTimeout(()=>setShakeE(false),200);} }
      else { setEnemy(a); enemyRef.current=a; setPlayer(d); playerRef.current=d; if(d.battleHp<before.battleHp){setShakeP(true);setTimeout(()=>setShakeP(false),200);} }
    };
    if(rest.length){ items.push({msg:rest[0],applyState:apply}); for(let i=1;i<rest.length;i++) items.push({msg:rest[i]}); }
    else items[items.length-1]={...items[items.length-1],applyState:apply};
  }
  // The end of a round: poison, statuses counting down, stamina for the ones that rested
  function queueRoundEnd(items,p,e){
    roundRef.current++;
    const rp=endOfRound(p), re=endOfRound(e);
    for(const m of rp.msgs) items.push({msg:m});
    for(const m of re.msgs) items.push({msg:m});
    const apply=()=>{ setPlayer(rp.b); playerRef.current=rp.b; setEnemy(re.b); enemyRef.current=re.b; };
    if(rp.msgs.length||re.msgs.length){ const i=items.length-rp.msgs.length-re.msgs.length; items[i]={...items[i],applyState:apply}; }
    else apply();
    return {p:rp.b,e:re.b};
  }

  // The foe's action. `endsRound` when it's the second action of the round.
  function doEnemyTurn(currentEnemy, currentPlayer, extraMsgs=[], then=null, endsRound=true) {
    const em=aiPickMove(currentEnemy,currentPlayer);
    const r=executeBattleMove(currentEnemy,currentPlayer,em);
    const items=extraMsgs.map(m=>typeof m==='string'?{msg:m}:m);
    queueMove(items,r,currentPlayer,false);
    let p=r.newDefender, e=r.newAttacker;
    if(endsRound&&p.battleHp>0&&e.battleHp>0) ({p,e}=queueRoundEnd(items,p,e));
    playerRef.current=p; enemyRef.current=e;
    if(then) afterQueueRef.current=then;
    setPending(items);
  }

  // The faster creature acts first. If the foe is quicker it moves, then you do (if you're still standing).
  function handleMove(move){
    if(!claimTurn())return;
    const u=usesRef.current[player.id]||(usesRef.current[player.id]={}); u[move.id]=(u[move.id]||0)+1;
    if(!goesFirst(player,enemy)){
      doEnemyTurn(enemy,player,[{msg:`The wild ${speciesOf(wildCreature).name} is quicker!`}],()=>{
        const p=playerRef.current, e=enemyRef.current;
        if(p.battleHp<=0||e.battleHp<=0){ settleTurn(); return; }
        playerAct(move,p,e,false);
      },false);
      return;
    }
    playerAct(move,player,enemy,true);
  }
  function playerAct(move,player,enemy,thenFoe){
    const r1=executeBattleMove(player,enemy,move);
    const items=[];
    queueMove(items,r1,enemy,true);
    let p=r1.newAttacker, e=r1.newDefender;
    if(e.battleHp<=0||p.battleHp<=0){ playerRef.current=p; enemyRef.current=e; setPending(items); return; }
    // When the foe already moved this round, the round ends here
    if(!thenFoe){ ({p,e}=queueRoundEnd(items,p,e)); playerRef.current=p; enemyRef.current=e; setPending(items); return; }
    playerRef.current=p; enemyRef.current=e;
    afterQueueRef.current=()=>doEnemyTurn(enemyRef.current,playerRef.current,[]);
    setPending(items);
  }

  // You open an empty pod in front of it; how well the pod suits it changes the chance.
  // For now a refusal sometimes means it attacks the pod and breaks it (stage 11 brings the full scene).
  const baseChance=()=>Math.min(0.95,Math.max(0.05,0.05+(1-enemy.battleHp/enemy.maxHp)*0.947));
  const podChance=pod=>Math.min(0.95,Math.max(0.03,baseChance()*pod.fit));
  function tryCapture(pod){
    if(!pod||!claimTurn())return;
    setShowPods(false);
    const ch=podChance(pod), name=speciesOf(wildCreature).name;
    if(Math.random()<ch){
      const e=enemyRef.current;
      // It comes home with whatever it has (poison and all)
      const caught={...wildCreature,hp:e.battleHp/e.maxHp,level:e.level,statuses:toWorld(e.fx),stamina:e.stamina/e.maxSta,fatigued:!!e.fatigued};
      const mine={battleHp:player.battleHp,maxHp:player.maxHp};
      const extra=battleResults(playerRef.current);
      afterQueueRef.current=()=>{ setPhase("end"); setTimeout(()=>onCapture(caught,mine,pod.id,extra),400); };
      setPending([{msg:`You open the ${pod.label.toLowerCase()}... the ${name} steps inside!`}]);
    } else {
      const broke=Math.random()<0.25;
      if(broke&&onPodBroken) onPodBroken(pod.id);
      doEnemyTurn(enemy,player,[{msg:broke?`You open the ${pod.label.toLowerCase()}... the ${name} attacks it, and the pod breaks!`:`You open the ${pod.label.toLowerCase()}... the ${name} backs away. Weaken it more.`}]);
    }
  }

  // Switching: the one going out keeps what it had on the bench; the one coming in brings back its own
  function sendIn(idx){
    const out=playerRef.current;
    benchRef.current.set(out.id,{...benchState(out),at:roundRef.current});
    onSaveBattleHp(0, out.battleHp, out.maxHp);
    onSwapToFront(idx);
    const incoming=battleInventory[idx];
    const {b}=benchFor(incoming);
    benchRef.current.delete(incoming.id);
    setPlayer(b); playerRef.current=b;
    setActiveCreature(incoming);
    setParticipantIds(prev=>new Set([...prev,incoming.id]));
    return b;
  }
  function handleSwap(idx){
    if(idx===0)return;
    const c=battleInventory[idx]; if(!c||c.fainted||(c.hp||0)<=0.05)return;
    if(!claimTurn())return;
    setShowSwap(false);
    const b=sendIn(idx);
    doEnemyTurn(enemy,b,[{msg:`Go, ${b.label}!`}]);
  }
  function fleeBattle(){
    const p=playerRef.current;
    onEnd("flee",{...p,hp:p.battleHp/p.maxHp},null,0,battleResults(p));
  }

  const bg="linear-gradient(180deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%)";
  const btnStyle={fontFamily:"Georgia,serif",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"};

  return(
    <div style={{position:"fixed",inset:0,background:bg,display:"flex",flexDirection:"column",zIndex:200,fontFamily:"Georgia,serif",overflow:"hidden"}}>
      {/* Battle field */}
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"space-around",padding:"8px 16px"}}>
        <div style={{display:"flex",justifyContent:"flex-end",alignItems:"flex-end",gap:12}}>
          <HpBar current={enemy.battleHp} max={enemy.maxHp} label={"Wild "+speciesOf(wildCreature).name} level={enemy.level} sex={wildCreature.sex}/>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <StatusBadges b={enemy}/>
            <BattleSprite creature={wildCreature} size={120} flipped={true} shake={shakeE}/>
          </div>
        </div>
        <div style={{textAlign:"center",color:"rgba(255,255,255,0.07)",fontSize:26,letterSpacing:8}}>— vs —</div>
        <div style={{display:"flex",justifyContent:"flex-start",alignItems:"flex-end",gap:12}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <StatusBadges b={player}/>
            <BattleSprite creature={activeCreature} size={120} shake={shakeP}/>
          </div>
          <HpBar current={player.battleHp} max={player.maxHp} label={activeCreature.name||"Yours"} level={player.level} sex={activeCreature.sex}/>
        </div>
      </div>

      {/* Log */}
      <div ref={logRef} style={{height:60,background:"rgba(0,0,0,0.5)",borderTop:"1px solid #1e293b",padding:"6px 14px",overflowY:"auto",fontSize:12,color:"#cbd5e1",lineHeight:1.5}}>
        {log.slice(-4).map((l,i)=><div key={i} style={{opacity:i===log.slice(-4).length-1?1:0.5}}>{l}</div>)}
      </div>

      {/* Actions */}
      <div style={{background:"#0f172a",borderTop:"1px solid #1e293b",padding:"8px 10px"}}>
        {phase==="player_turn"&&showPods&&(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <div style={{color:"#fbbf24",fontSize:11}}>Open which pod? A pod that suits it works better.</div>
            {pods.map(p=>(
              <button key={p.id} onClick={()=>tryCapture(p)} onContextMenu={e=>e.preventDefault()}
                style={{...btnStyle,display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(251,191,36,0.08)",border:"1.5px solid rgba(251,191,36,0.35)",borderRadius:8,padding:"8px 10px",color:"#fde68a",fontSize:12}}>
                <span>🫛 {p.label}{p.count>1?` ×${p.count}`:""}</span>
                <span style={{fontSize:11,color:p.fit>=0.75?"#86efac":p.fit>=0.5?"#facc15":"#f87171"}}>{p.fitWord} · {Math.round(podChance(p)*100)}%</span>
              </button>
            ))}
            <button onClick={()=>setShowPods(false)} style={{...btnStyle,background:"transparent",border:"1px solid #334155",borderRadius:8,padding:"6px",color:"#94a3b8",fontSize:11}}>Back</button>
          </div>
        )}
        {phase==="player_turn"&&!showSwap&&!showPods&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
              {(()=>{ const ok=new Set(usableMoves(player).map(m=>m.id)); return player.moves.map(move=>{ const can=ok.has(move.id), fx=moveEffectText(move); return(
                <button key={move.id} disabled={!can}
                  onClick={()=>handleMove(move)}
                  onContextMenu={e=>e.preventDefault()}
                  style={{...btnStyle,background:`${TYPE_COLORS[move.type]}22`,border:`1.5px solid ${TYPE_COLORS[move.type]}88`,borderRadius:8,padding:"7px 6px",color:"#e2e8f0",fontSize:12,textAlign:"left",opacity:can?1:0.4}}>
                  <div style={{fontWeight:"bold",marginBottom:1}}>{move.name}</div>
                  <div style={{display:"flex",gap:6,fontSize:10,color:"#94a3b8",flexWrap:"wrap"}}>
                    <span style={{color:TYPE_COLORS[move.type]}}>{move.kind?move.type:move.type}</span>
                    <span>{move.power>0?(isPhysical(move)?"Phys":"Elem"):"Support"}</span>
                    {move.power>0&&<span>PWR {move.power}</span>}
                    {move.acc<1&&<span>ACC {Math.round(move.acc*100)}%</span>}
                    {(move.effect||fx)&&<span style={{color:"#fbbf24"}} title={fx||move.effect}>✦</span>}
                  </div>
                  {!can&&<div style={{fontSize:9,color:"#f87171"}}>Too tired</div>}
                </button>); }); })()}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <button onClick={()=>setShowPods(true)} disabled={!canCatch||!pods.length} onContextMenu={e=>e.preventDefault()}
                style={{...btnStyle,background:"rgba(251,191,36,0.15)",border:"1.5px solid rgba(251,191,36,0.5)",borderRadius:8,padding:"7px 4px",color:"#fbbf24",fontSize:11,opacity:canCatch&&pods.length?1:0.4}}>
                🫛 OPEN POD<br/><span style={{fontSize:9,opacity:0.8}}>{!canCatch?"(bag full)":!pods.length?"(no empty pods)":`(${pods.length} empty)`}</span>
              </button>
              <button onClick={()=>setShowSwap(true)} onContextMenu={e=>e.preventDefault()}
                style={{...btnStyle,background:"rgba(96,165,250,0.15)",border:"1.5px solid rgba(96,165,250,0.4)",borderRadius:8,padding:"7px 4px",color:"#60a5fa",fontSize:11}}>
                🔄 SWAP<br/><span style={{fontSize:9,opacity:0.8}}>(costs turn)</span>
              </button>
              <button onClick={fleeBattle} onContextMenu={e=>e.preventDefault()}
                style={{...btnStyle,background:"rgba(100,116,139,0.15)",border:"1.5px solid rgba(100,116,139,0.4)",borderRadius:8,padding:"7px 4px",color:"#94a3b8",fontSize:11}}>
                🏃 FLEE
              </button>
            </div>
          </>
        )}
        {phase==="forced_swap"&&(
          <div>
            <div style={{color:"#f87171",fontSize:12,marginBottom:8,fontWeight:"bold"}}>💀 Your creature fainted! Choose next:</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(battleInventory||[]).map((c,i)=>{
                if(i===0||!c||c.fainted||(c.hp||0)<=0.05)return null;
                return(
                  <button key={i}
                    
                    onClick={()=>{
                      const nb=sendIn(i);
                      giveTurnBack();
                      setLog(l=>[...l,`Go, ${nb.label}!`]);
                    }}
                    onContextMenu={e=>e.preventDefault()}
                    style={{...btnStyle,background:dnaColor(c.dna,15),border:`1.5px solid ${dnaColor(c.dna,35)}`,borderRadius:8,padding:"6px 10px",color:"#e2e8f0",fontSize:11}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <CreatureIcon c={c} size={22}/>
                      <span>{c.name} · Lv{c.level||1}</span>
                    </div>
                    <div style={{width:50,height:3,background:"#222",borderRadius:2,marginTop:3}}>
                      <div style={{width:`${(c.hp||0)*100}%`,height:"100%",background:"#4ade80",borderRadius:2}}/>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {phase==="player_turn"&&showSwap&&(
          <div>
            <div style={{color:"#60a5fa",fontSize:11,marginBottom:6}}>Choose a creature to send in (costs a turn):</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
              {(battleInventory||[]).map((c,i)=>{ const out=i===0||c.fainted||(c.hp||0)<=0.05; return(
                <button key={i} disabled={out}
                  onClick={()=>handleSwap(i)}
                  onContextMenu={e=>e.preventDefault()}
                  style={{...btnStyle,background:out?"rgba(255,255,255,0.05)":dnaColor(c.dna,15),border:`1.5px solid ${out?"#333":dnaColor(c.dna,35)}`,borderRadius:8,padding:"6px 10px",color:out?"#475569":"#e2e8f0",fontSize:11,opacity:out?0.5:1,cursor:out?"default":"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <CreatureIcon c={c} size={22}/>
                    <span>{c.name} · Lv{c.level||1}</span>
                    {i===0&&<span style={{fontSize:9,color:"#475569"}}>(out now)</span>}
                    {i!==0&&out&&<span style={{fontSize:9,color:"#f87171"}}>(fainted)</span>}
                  </div>
                  <div style={{width:50,height:3,background:"#222",borderRadius:2,marginTop:3}}>
                    <div style={{width:`${(c.hp||0)*100}%`,height:"100%",background:c.hp>.5?"#4ade80":"#f87171",borderRadius:2}}/>
                  </div>
                </button>
              );})}
            </div>
            <button onClick={()=>setShowSwap(false)} onContextMenu={e=>e.preventDefault()}
              style={{...btnStyle,background:"transparent",border:"1px solid #333",borderRadius:6,padding:"5px 12px",color:"#475569",fontSize:11}}>
              ← Back
            </button>
          </div>
        )}
        {phase!=="player_turn"&&(
          <div style={{textAlign:"center",color:"#475569",padding:12,fontSize:13}}>{phase==="end"?"Battle ended…":"…"}</div>
        )}
      </div>
    </div>
  );
}

