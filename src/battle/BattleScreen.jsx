import { useState, useEffect, useRef } from "react";
import { XP_PER_LEVEL } from "../config.js";
import { lifeStage, speciesOf, spriteImage, useSpritesLoaded, CreatureIcon } from "../creatures/species.jsx";
import { dnaColor } from "../creatures/dna.js";
import { learnMoveAtLevel, TYPE_COLORS } from "./moves.js";
import { makeBattler, executeBattleMove, applyEndOfTurn, aiPickMove } from "./engine.js";

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

export function HpBar({current,max,label,level}){
  const pct=Math.max(0,current/max);
  const col=pct>0.5?"#4ade80":pct>0.25?"#facc15":"#f87171";
  return(
    <div style={{background:"#1a1a2e",border:"1px solid #2a2a4a",borderRadius:6,padding:"6px 10px",minWidth:150}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{color:"#e2e8f0",fontSize:12,fontWeight:"bold"}}>{label}</span>
        <span style={{color:"#64748b",fontSize:10}}>Lv{level}</span>
      </div>
      <div style={{background:"#0f0f1e",borderRadius:3,height:8,overflow:"hidden",marginBottom:3}}>
        <div style={{width:`${pct*100}%`,height:"100%",background:col,borderRadius:3,transition:"width 0.3s"}}/>
      </div>
      <div style={{color:"#64748b",fontSize:10,textAlign:"right"}}>{current}/{max}</div>
    </div>
  );
}

export function StatusBadge({status}){
  if(!status)return null;
  const map={burn:["🔥","#f97316"],poison:["☠️","#a855f7"],paralyze:["⚡","#eab308"],freeze:["🧊","#38bdf8"]};
  const[icon,color]=map[status]||["?","#888"];
  return <span style={{background:color+"33",border:`1px solid ${color}`,borderRadius:4,padding:"1px 5px",fontSize:10,color}}>{icon} {status}</span>;
}

export function BattleScreen({playerCreature,wildCreature,onEnd,onCapture,battleInventory,onSwapToFront,onSaveBattleHp,intro=null,canCatch=true}){
  const[phase,setPhase]=useState("player_turn");
  const[player,setPlayer]=useState(()=>makeBattler(playerCreature));
  const[enemy,setEnemy]=useState(()=>makeBattler(wildCreature));
  const[activeCreature,setActiveCreature]=useState(playerCreature); // tracks sprite
  const[log,setLog]=useState([intro||("A wild Lv"+(wildCreature.level||1)+" "+speciesOf(wildCreature).name+" appeared!")]);
  const[shakeP,setShakeP]=useState(false);
  const[shakeE,setShakeE]=useState(false);
  const[pending,setPending]=useState(null);
  const[showSwap,setShowSwap]=useState(false);
  const[participantIds,setParticipantIds]=useState(new Set([playerCreature.id])); // for XP split
  const logRef=useRef(null);
  const playerRef=useRef(player);
  const busyRef=useRef(false);        // true from the moment you act until your next turn starts
  const afterQueueRef=useRef(null);   // runs once the current messages finish (e.g. the foe's turn)
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
      // Apply any deferred state update for this message
      if(item.applyState) item.applyState();
      setLog(l=>[...l,String(item.msg||'')]);
      if(!rest.length){
        setPending(null);
        if(afterQueueRef.current){
          const next=afterQueueRef.current; afterQueueRef.current=null;
          setTimeout(next,300); return;
        }
        const p=playerRef.current, e=enemyRef.current;
        if(e.battleHp<=0) setTimeout(()=>endBattle("win",p,e),300);
        else if(p.battleHp<=0){
          const remaining=(battleInventory||[]).filter((_,i)=>i>0&&battleInventory[i]&&(battleInventory[i].hp||0)>0.05);
          if(remaining.length>0) setPhase("forced_swap");
          else setTimeout(()=>endBattle("loss",p,e),300);
        }
        else giveTurnBack();
      } else setPending(rest);
    },700);
    return()=>clearTimeout(timer);
  },[pending]);

  function endBattle(result,fp,fe){
    if(result==="win"){
      const totalXp=Math.floor(20+(fe.level||1)*8);
      const numPart=participantIds.size||1;
      const xpEach=Math.max(1,Math.floor(totalXp/numPart));
      const xpMsg=numPart>1?" (split "+numPart+" ways)":"";
      const xpNeeded=Math.floor(XP_PER_LEVEL*(fp.dna.xpRate??1));
      const nxp=(fp.xp||0)+xpEach, nl=Math.floor(nxp/xpNeeded)+1;
      const lu=nl>(fp.level||1);
      let nm=fp.moves||[];
      let lmsg=null;
      if(lu){const learned=learnMoveAtLevel(fp.dna,nl,nm);if(learned){nm=nm.length<4?[...nm,learned]:[nm[0],...nm.slice(2),learned];lmsg="Learned "+learned.name+"!";}}
      const lvMsg=lu?" Level UP → Lv"+nl+"!":"";
      setLog(l=>{const m=[...l,"Won! +"+xpEach+" XP"+xpMsg+"."+lvMsg];if(lmsg)m.push(lmsg);return m;});
      setPhase("end");
      setTimeout(()=>onEnd("win",{...fp,xp:nxp,level:nl,moves:nm,hp:fp.battleHp/fp.maxHp},participantIds,xpEach),lu?1800:1200);
    } else {
      setLog(l=>[...l,"Your creature fainted..."]);
      setPhase("end");
      setTimeout(()=>onEnd("loss",{...fp,hp:0.05}),1200);
    }
  }

  // Build a pending queue where state updates are deferred to match log display
  function doEnemyTurn(currentEnemy, currentPlayer, extraMsgs=[]) {
    const em=aiPickMove(currentEnemy,currentPlayer);
    const r=executeBattleMove(currentEnemy,currentPlayer,em);
    let finalPlayer=r.newDefender;
    let finalEnemy=r.newAttacker;

    // Start with pre-action messages — extraMsgs may be strings or {msg} objects
    const items=extraMsgs.map(m=>typeof m==='string'?{msg:m}:m);

    // "Foe used X!" — no HP change yet
    items.push({msg:"Foe used "+em.name+"!"});

    // Damage messages — apply HP reduction when each shows
    const dmgMsgs=r.msgs.slice(1); // skip the "Used X!" repeat
    if(dmgMsgs.length>0){
      // First damage message triggers the HP drop + shake
      const afterDmgPlayer=r.newDefender;
      const afterDmgEnemy=r.newAttacker;
      items.push({
        msg:dmgMsgs[0],
        applyState:()=>{
          setPlayer(afterDmgPlayer); playerRef.current=afterDmgPlayer;
          setEnemy(afterDmgEnemy);  enemyRef.current=afterDmgEnemy;
          if(afterDmgPlayer.battleHp<currentPlayer.battleHp){
            setShakeP(true);setTimeout(()=>setShakeP(false),200);
          }
        }
      });
      // Remaining damage messages (stat drops, etc.)
      for(let i=1;i<dmgMsgs.length;i++) items.push({msg:dmgMsgs[i]});
    } else {
      // No damage messages (miss, stat move) — still update state on move message
      items[items.length-1]={
        ...items[items.length-1],
        applyState:()=>{
          setPlayer(finalPlayer); playerRef.current=finalPlayer;
          setEnemy(finalEnemy);  enemyRef.current=finalEnemy;
        }
      };
    }

    // End of turn status (burn/poison tick)
    const{b:pAfter,msg:pMsg}=applyEndOfTurn(finalPlayer);
    if(pMsg){
      finalPlayer=pAfter;
      items.push({msg:pMsg, applyState:()=>{setPlayer(pAfter);playerRef.current=pAfter;}});
    }
    const{b:eAfter2,msg:eMsg2}=applyEndOfTurn(finalEnemy);
    if(eMsg2){
      finalEnemy=eAfter2;
      items.push({msg:eMsg2, applyState:()=>{setEnemy(eAfter2);enemyRef.current=eAfter2;}});
    }

    // Ensure refs end up with final values
    playerRef.current=finalPlayer;
    enemyRef.current=finalEnemy;

    setPending(items);
  }

  function handleMove(move){
    if(!claimTurn())return;
    const r1=executeBattleMove(player,enemy,move);
    const items=[];

    // "Used X!" message — no HP change yet
    items.push({msg:r1.msgs[0]||("Used "+move.name+"!")});

    // Damage/effect messages — apply on display
    const dmgMsgs1=r1.msgs.slice(1);
    if(dmgMsgs1.length>0){
      items.push({
        msg:dmgMsgs1[0],
        applyState:()=>{
          setPlayer(r1.newAttacker); playerRef.current=r1.newAttacker;
          setEnemy(r1.newDefender);  enemyRef.current=r1.newDefender;
          if(r1.newDefender.battleHp<enemy.battleHp){setShakeE(true);setTimeout(()=>setShakeE(false),200);}
        }
      });
      for(let i=1;i<dmgMsgs1.length;i++) items.push({msg:dmgMsgs1[i]});
    } else {
      items[0]={...items[0],applyState:()=>{
        setPlayer(r1.newAttacker);playerRef.current=r1.newAttacker;
        setEnemy(r1.newDefender);enemyRef.current=r1.newDefender;
      }};
    }

    // If enemy faints, stop here
    if(r1.newDefender.battleHp<=0){
      playerRef.current=r1.newAttacker; enemyRef.current=r1.newDefender;
      setPending(items); return;
    }

    // End of turn status on enemy
    let currentEnemy=r1.newDefender;
    const{b:eAfter,msg:eMsg}=applyEndOfTurn(currentEnemy);
    if(eMsg){
      currentEnemy=eAfter;
      items.push({msg:eMsg,applyState:()=>{setEnemy(eAfter);enemyRef.current=eAfter;}});
    }
    if(eAfter.battleHp<=0){
      playerRef.current=r1.newAttacker; enemyRef.current=currentEnemy;
      setPending(items); return;
    }

    // Queue enemy turn after all player messages resolve
    playerRef.current=r1.newAttacker; enemyRef.current=currentEnemy;
    const playerAfterMove=r1.newAttacker;
    // Foe acts only after your messages finish; input stays locked until then
    afterQueueRef.current=()=>doEnemyTurn(currentEnemy,playerAfterMove,[]);
    setPending(items);
  }

  function tryCapture(){
    if(!claimTurn())return;
    const ch=Math.min(0.95,Math.max(0.05,0.05+(1-enemy.battleHp/enemy.maxHp)*0.947));
    const pct=Math.round(ch*100);
    if(Math.random()<ch){
      const caught={...wildCreature,hp:enemy.battleHp/enemy.maxHp,level:enemy.level};
      const mine={battleHp:player.battleHp,maxHp:player.maxHp};
      afterQueueRef.current=()=>{ setPhase("end"); setTimeout(()=>onCapture(caught,mine),400); };
      setPending([{msg:"Threw a catch... Caught! ("+pct+"% chance)"}]);
    } else {
      const{b:eAfter}=applyEndOfTurn(enemy);
      doEnemyTurn(eAfter,player,[{msg:"Threw a catch... Escaped! ("+pct+"%) — weaken more!"}]);
    }
  }

  function handleSwap(idx){
    if(idx===0)return;
    const c=battleInventory[idx]; if(!c||c.fainted||(c.hp||0)<=0.05)return;
    if(!claimTurn())return;
    setShowSwap(false);
    // Save current battler's HP back to inventory slot 0 before swapping
    onSaveBattleHp(0, player.battleHp, player.maxHp);
    onSwapToFront(idx);
    const incoming=battleInventory[idx];
    // incoming already has battleHp if it was previously in battle
    const newBattler=makeBattler(incoming);
    setPlayer(newBattler);
    setActiveCreature(incoming);
    setParticipantIds(prev=>new Set([...prev,incoming.id]));
    const{b:eAfter}=applyEndOfTurn(enemy);
    doEnemyTurn(eAfter,newBattler,[{msg:"Switched to new creature!"}]);
  }

  const catchPct=Math.round(Math.min(95,Math.max(5,5+(1-enemy.battleHp/enemy.maxHp)*94.7)));
  const bg="linear-gradient(180deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%)";
  const btnStyle={fontFamily:"Georgia,serif",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"};

  return(
    <div style={{position:"fixed",inset:0,background:bg,display:"flex",flexDirection:"column",zIndex:200,fontFamily:"Georgia,serif",overflow:"hidden"}}>
      {/* Battle field */}
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"space-around",padding:"8px 16px"}}>
        <div style={{display:"flex",justifyContent:"flex-end",alignItems:"flex-end",gap:12}}>
          <HpBar current={enemy.battleHp} max={enemy.maxHp} label={"Wild "+speciesOf(wildCreature).name} level={enemy.level}/>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <StatusBadge status={enemy.status}/>
            <BattleSprite creature={wildCreature} size={120} flipped={true} shake={shakeE}/>
          </div>
        </div>
        <div style={{textAlign:"center",color:"rgba(255,255,255,0.07)",fontSize:26,letterSpacing:8}}>— vs —</div>
        <div style={{display:"flex",justifyContent:"flex-start",alignItems:"flex-end",gap:12}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <StatusBadge status={player.status}/>
            <BattleSprite creature={activeCreature} size={120} shake={shakeP}/>
          </div>
          <HpBar current={player.battleHp} max={player.maxHp} label={activeCreature.name||"Yours"} level={player.level}/>
        </div>
      </div>

      {/* Log */}
      <div ref={logRef} style={{height:60,background:"rgba(0,0,0,0.5)",borderTop:"1px solid #1e293b",padding:"6px 14px",overflowY:"auto",fontSize:12,color:"#cbd5e1",lineHeight:1.5}}>
        {log.slice(-4).map((l,i)=><div key={i} style={{opacity:i===log.slice(-4).length-1?1:0.5}}>{l}</div>)}
      </div>

      {/* Actions */}
      <div style={{background:"#0f172a",borderTop:"1px solid #1e293b",padding:"8px 10px"}}>
        {phase==="player_turn"&&!showSwap&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
              {player.moves.map(move=>(
                <button key={move.id}
                  
                  onClick={()=>handleMove(move)}
                  onContextMenu={e=>e.preventDefault()}
                  style={{...btnStyle,background:`${TYPE_COLORS[move.type]}22`,border:`1.5px solid ${TYPE_COLORS[move.type]}88`,borderRadius:8,padding:"7px 6px",color:"#e2e8f0",fontSize:12,textAlign:"left"}}>
                  <div style={{fontWeight:"bold",marginBottom:1}}>{move.name}</div>
                  <div style={{display:"flex",gap:6,fontSize:10,color:"#94a3b8"}}>
                    <span style={{color:TYPE_COLORS[move.type]}}>{move.type}</span>
                    {move.power>0&&<span>PWR {move.power}</span>}
                    {move.acc<1&&<span>ACC {Math.round(move.acc*100)}%</span>}
                    {move.effect&&<span style={{color:"#fbbf24"}}>✦</span>}
                  </div>
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <button onClick={tryCapture} disabled={!canCatch} onContextMenu={e=>e.preventDefault()}
                style={{...btnStyle,background:"rgba(251,191,36,0.15)",border:"1.5px solid rgba(251,191,36,0.5)",borderRadius:8,padding:"7px 4px",color:"#fbbf24",fontSize:11,opacity:canCatch?1:0.4}}>
                ⚡ CATCH<br/><span style={{fontSize:9,opacity:0.8}}>{canCatch?`(${catchPct}%)`:"(bag full)"}</span>
              </button>
              <button onClick={()=>setShowSwap(true)} onContextMenu={e=>e.preventDefault()}
                style={{...btnStyle,background:"rgba(96,165,250,0.15)",border:"1.5px solid rgba(96,165,250,0.4)",borderRadius:8,padding:"7px 4px",color:"#60a5fa",fontSize:11}}>
                🔄 SWAP<br/><span style={{fontSize:9,opacity:0.8}}>(costs turn)</span>
              </button>
              <button onClick={()=>onEnd("flee",{...player,hp:player.battleHp/player.maxHp})} onContextMenu={e=>e.preventDefault()}
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
                      onSaveBattleHp(0,0,player.maxHp);
                      onSwapToFront(i);
                      const inc=battleInventory[i];
                      const nb=makeBattler(inc);
                      setPlayer(nb);setActiveCreature(inc);
                      setParticipantIds(prev=>new Set([...prev,inc.id]));
                      giveTurnBack();
                      setLog(l=>[...l,"Go, new creature!"]);
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

