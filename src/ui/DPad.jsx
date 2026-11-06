import { useState, useRef, useCallback } from "react";

// ─── Analog Joystick ──────────────────────────────────────────────────────────
// Top-down map: screen directions map straight onto the grid (right = col+, down = row+).
export default function DPad({inputRef}){
  const size=134,center=size/2,maxR=50;
  const padRef=useRef(null);
  const[knob,setKnob]=useState({x:0,y:0,active:false});

  const applyTouch=useCallback((tx,ty,active)=>{
    if(!active){
      inputRef.current.dx=0;inputRef.current.dy=0;
      setKnob({x:0,y:0,active:false});return;
    }
    const rect=padRef.current.getBoundingClientRect();
    let rx=tx-rect.left-center, ry=ty-rect.top-center;
    const dist=Math.sqrt(rx*rx+ry*ry);
    const clamped=Math.min(dist,maxR);
    if(dist>0){rx=rx/dist*clamped;ry=ry/dist*clamped;}
    const angle=Math.atan2(ry,rx);
    const mag=clamped/maxR;
    const DEAD=0.15;
    const dx=mag>DEAD?Math.cos(angle)*mag:0;
    const dy=mag>DEAD?Math.sin(angle)*mag:0;
    inputRef.current.dx=dx;inputRef.current.dy=dy;
    setKnob({x:rx,y:ry,active:true});
  },[inputRef]);

  return(
    <div ref={padRef}
      
      onTouchStart={e=>{e.preventDefault();e.stopPropagation();const t=e.touches[0];applyTouch(t.clientX,t.clientY,true);}}
      onTouchMove={e=>{e.preventDefault();e.stopPropagation();const t=e.touches[0];applyTouch(t.clientX,t.clientY,true);}}
      onTouchEnd={e=>{e.preventDefault();e.stopPropagation();applyTouch(0,0,false);}}
      onTouchCancel={e=>{e.preventDefault();applyTouch(0,0,false);}}
      onMouseDown={e=>{applyTouch(e.clientX,e.clientY,true);}}
      onMouseMove={e=>{if(e.buttons)applyTouch(e.clientX,e.clientY,true);}}
      onMouseUp={()=>applyTouch(0,0,false)}
      onMouseLeave={()=>applyTouch(0,0,false)}
      onContextMenu={e=>e.preventDefault()}
      style={{position:"relative",width:size,height:size,flexShrink:0,touchAction:"none",userSelect:"none",WebkitUserSelect:"none",cursor:"pointer"}}>
      {/* Outer ring */}
      <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(200,230,160,0.06)",border:"1.5px solid rgba(200,230,160,0.18)"}}/>
      {/* Inner dead zone ring */}
      <div style={{position:"absolute",left:center-18,top:center-18,width:36,height:36,borderRadius:"50%",background:"rgba(200,230,160,0.04)",border:"1px solid rgba(200,230,160,0.12)"}}/>
      {/* Direction hints */}
      {[["↑","up",0,-1],["→","right",1,0],["↓","down",0,1],["←","left",-1,0]].map(([label,key,dx,dy])=>(
        <div key={key} style={{position:"absolute",left:center+dx*(maxR*0.65)-10,top:center+dy*(maxR*0.65)-10,width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(200,230,160,0.25)",fontSize:14,pointerEvents:"none"}}>{label}</div>
      ))}
      {/* Knob */}
      <div style={{position:"absolute",left:center+knob.x-20,top:center+knob.y-20,width:40,height:40,borderRadius:"50%",background:knob.active?"rgba(200,230,160,0.35)":"rgba(200,230,160,0.15)",border:`2px solid rgba(200,230,160,${knob.active?0.7:0.3})`,transition:knob.active?"none":"left 0.1s, top 0.1s",pointerEvents:"none",boxShadow:knob.active?"0 0 12px rgba(200,230,160,0.3)":"none"}}/>
    </div>
  );
}

