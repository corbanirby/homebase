import { COLS, ROWS, MAX_CREATURES, HUNGER_RATE, REPRODUCE_COOLDOWN,
  REPRODUCE_HUNGER_MIN, PLANT_ENERGY, PLAYER_SPEED, CAPTURE_DIST, COMBAT_BASE_DAMAGE, TERRITORY_RADIUS,
  INVENTORY_MAX, HEAL_RATE, PATH_SPEED_BONUS, BREED_TICKS, BREED_HUE_COMPAT, BREED_MIN_LEVEL, BREED_MAX_BAG } from "../config.js";
import { newId } from "../engine/ids.js";
import { isPassable, isFast } from "../world/tiles.js";
import { makeCreature, makeWildCreature } from "../creatures/factory.js";
import { crossDNA } from "../creatures/dna.js";
import { deriveMoves } from "../battle/moves.js";

// ─── World simulation ─────────────────────────────────────────────────────────
export function simulate(state, tick, inputRef, map) {
  let {creatures,plants,player,inventory,events,floats} = state;
  const newEvents=[]; let newFloats=floats.filter(f=>tick-f.tick<45);

  // Player movement (each axis separately, so you slide along water and trees)
  let {col:pc,row:pr,facing,moveAnim}=player;
  const {dx:idx,dy:idy,capturePressed}=inputRef.current;
  // Soft collision: pushing through a creature slows you a little but never blocks you
  const pushing=creatures.some(c=>!c.dead&&Math.hypot(c.col-pc,c.row-pr)<0.55);
  const spd=PLAYER_SPEED*(isFast(map,pc,pr+0.25)?PATH_SPEED_BONUS:1)*(pushing?0.7:1);
  const nc=Math.max(0.3,Math.min(COLS-0.3,pc+idx*spd));
  if(isPassable(map,nc,pr+0.25)) pc=nc;
  const nr=Math.max(0.3,Math.min(ROWS-0.1,pr+idy*spd));
  if(isPassable(map,pc,nr+0.25)) pr=nr;
  if(Math.abs(idx)>Math.abs(idy)) facing=idx<0?"left":"right";
  else if(idy!==0) facing=idy<0?"up":"down";
  const moving=idx!==0||idy!==0;
  moveAnim=moving?(moveAnim+0.25)%(Math.PI*2):0;

  // Respawn wild creatures if population drops too low (every ~30s)
  const RESPAWN_INTERVAL = 600;
  const MIN_WILD = 8;
  if (tick%RESPAWN_INTERVAL===0 && creatures.filter(c=>!c.dead).length < MIN_WILD) {
    let tries=0;
    while(tries++<50){
      const c=Math.floor(Math.random()*COLS)+0.5, r=Math.floor(Math.random()*ROWS)+0.5;
      if(isPassable(map,c,r) && Math.hypot(c-pc,r-pr)>5){
        creatures=[...creatures,makeWildCreature(c,r)];
        break;
      }
    }
  }

  // Catch
  let newInventory=[...inventory];
  if (capturePressed) {
    inputRef.current.capturePressed=false;
    const nearby=creatures.filter(c=>!c.dead&&Math.hypot(c.col-pc,c.row-pr)<CAPTURE_DIST);
    if (!nearby.length) newFloats=[...newFloats,{id:newId(),col:pc,row:pr,text:"Nothing nearby!",color:"#94a3b8",tick}];
    else if (newInventory.length>=INVENTORY_MAX) newFloats=[...newFloats,{id:newId(),col:pc,row:pr,text:"Bag full!",color:"#f87171",tick}];
    else if (!newInventory.length) newFloats=[...newFloats,{id:newId(),col:pc,row:pr,text:"Walk into a creature!",color:"#facc15",tick}];
    else {
      const t=nearby.reduce((b,c)=>Math.hypot(c.col-pc,c.row-pr)<Math.hypot(b.col-pc,b.row-pr)?c:b);
      const ch=Math.min(0.95,Math.max(0.05,0.05+(1-t.hp)*0.947));
      const pct=Math.round(ch*100);
      if (Math.random()<ch) {
        newInventory=[...newInventory,{...t,capturedAt:tick}];
        creatures=creatures.map(c=>c.id===t.id?{...c,dead:true,deathReason:"captured"}:c);
        newFloats=[...newFloats,{id:newId(),col:t.col,row:t.row,text:"Caught! ("+pct+"%)",color:"#fbbf24",tick}];
        newEvents.push({type:"capture",col:t.col,row:t.row,tick});
      } else newFloats=[...newFloats,{id:newId(),col:t.col,row:t.row,text:"Escaped! ("+pct+"%)",color:"#f87171",tick}];
    }
  }

  // Creature AI
  const living=creatures.filter(c=>!c.dead);
  const newBorn=[];
  const updated=living.map(c=>{
    let {col,row,dcol,drow,hunger,age,maxAge,reproductionCooldown,wanderTimer,state:cs,targetId,dna,hp,combatTimer,capturable}=c;
    const spd=dna.speed*0.04;
    age++; reproductionCooldown=Math.max(0,reproductionCooldown-1); combatTimer=Math.max(0,combatTimer-1);
    if(age>=maxAge){newEvents.push({type:"death",reason:"age",col,row,tick});return{...c,dead:true};}
    if(hunger<=0){newEvents.push({type:"death",reason:"hunger",col,row,tick});return{...c,dead:true};}
    if(hp<=0){newEvents.push({type:"death",reason:"combat",col,row,tick});return{...c,dead:true};}
    hunger=Math.max(0,hunger-HUNGER_RATE*(dna.metabolism??1));
    // Nibbling the grass and reeds they walk through keeps them going between real meals
    { const t=map[Math.floor(row)]?.[Math.floor(col)]; if(t==="grass"||t==="flower"||t==="reeds"||t==="marsh") hunger=Math.min(1,hunger+HUNGER_RATE*0.9); }
    capturable=hp<0.35;
    if(cs!=="combat"&&hp<1.0) hp=Math.min(1.0,hp+0.0006);
    const lp=plants.filter(p=>!p.dead&&p.energy>0.2);
    let ns=cs,nt=targetId;
    if(cs!=="combat"){
      if(dna.aggression>0.82){
        const e=living.filter(o=>o.id!==c.id&&Math.hypot(o.col-col,o.row-row)<TERRITORY_RADIUS*dna.aggression);
        if(e.length){const n=e.reduce((b,o)=>Math.hypot(o.col-col,o.row-row)<b.d?{o,d:Math.hypot(o.col-col,o.row-row)}:b,{o:null,d:Infinity});if(n.o){ns="combat";nt=n.o.id;}}
      }
      if(ns!=="combat"){
        if(hunger<0.5&&lp.length){const n=lp.reduce((b,p)=>Math.hypot(p.col-col,p.row-row)<b.d?{p,d:Math.hypot(p.col-col,p.row-row)}:b,{p:null,d:Infinity});if(n.p){ns="seek";nt=n.p.id;}}
        else if(reproductionCooldown===0&&hunger>=REPRODUCE_HUNGER_MIN&&living.length<MAX_CREATURES){const pr2=living.find(o=>o.id!==c.id&&o.reproductionCooldown===0&&o.hunger>=REPRODUCE_HUNGER_MIN&&Math.hypot(o.col-col,o.row-row)<6);if(pr2){ns="reproduce";nt=pr2.id;}}
        else if(ns!=="seek") ns="wander";
      }
    }
    if(ns==="combat"){const e=living.find(o=>o.id===nt&&!o.dead);if(!e||Math.hypot(e.col-col,e.row-row)>TERRITORY_RADIUS*1.5){ns="wander";nt=null;}else{const d=Math.hypot(e.col-col,e.row-row);if(d>0.8){dcol=((e.col-col)/d)*spd*1.2;drow=((e.row-row)/d)*spd*1.2;}else{if(combatTimer===0){newEvents.push({type:"hit",targetId:e.id,damage:COMBAT_BASE_DAMAGE*dna.strength,col:e.col,row:e.row,tick});combatTimer=18;}dcol*=0.5;drow*=0.5;}}}
    if(ns==="seek"){const t=plants.find(p=>p.id===nt&&!p.dead);if(!t||t.energy<0.1){ns="wander";nt=null;}else{const d=Math.hypot(t.col-col,t.row-row);if(d<0.5){ns="eat";}else{dcol=((t.col-col)/d)*spd;drow=((t.row-row)/d)*spd;}}}
    if(ns==="eat"){const t=plants.find(p=>p.id===nt&&!p.dead);if(!t||t.energy<0.05){ns="wander";nt=null;}else{hunger=Math.min(1,hunger+Math.min(PLANT_ENERGY,1-hunger));const pi=plants.findIndex(p=>p.id===nt);if(pi!==-1)plants=plants.map((p,i)=>i===pi?{...p,energy:Math.max(0,p.energy-0.4)}:p);if(hunger>=0.95){ns="wander";nt=null;}}}
    if(ns==="reproduce"){const p2=living.find(o=>o.id===nt);if(!p2||p2.dead||Math.hypot(p2.col-col,p2.row-row)>4){ns="wander";nt=null;}else if(reproductionCooldown===0){const child=makeCreature(col+(Math.random()-0.5)*0.5,row+(Math.random()-0.5)*0.5,crossDNA(dna,p2.dna));newBorn.push(child);newEvents.push({type:"birth",col:child.col,row:child.row,tick});reproductionCooldown=Math.floor(REPRODUCE_COOLDOWN/(dna.reproRate??1));hunger=Math.max(0.1,hunger-0.3);ns="wander";nt=null;}}
    if(ns==="wander"){wanderTimer--;if(wanderTimer<=0){dcol=(Math.random()-0.5)*spd*2;drow=(Math.random()-0.5)*spd*2;wanderTimer=30+Math.random()*60;}}
    // Step, turning back at water, trees and the edge of the homebase
    if(isPassable(map,col+dcol,row)) col+=dcol; else { dcol=-dcol; wanderTimer=0; }
    if(isPassable(map,col,row+drow)) row+=drow; else { drow=-drow; wanderTimer=0; }
    col=Math.max(0.5,Math.min(COLS-0.5,col)); row=Math.max(0.5,Math.min(ROWS-0.5,row));
    return{...c,col,row,dcol,drow,hunger,age,maxAge,reproductionCooldown,wanderTimer,state:ns,targetId:nt,dna,hp,combatTimer,capturable};
  });

  const hitEvts=newEvents.filter(e=>e.type==="hit");
  const damaged=updated.map(c=>{
    const hits=hitEvts.filter(h=>h.targetId===c.id);if(!hits.length)return c;
    const dmg=hits.reduce((s,h)=>s+h.damage,0);
    const nHp=Math.max(0,c.hp-dmg);
    if(nHp<0.3&&c.hp>=0.3) newFloats=[...newFloats,{id:newId(),col:c.col,row:c.row,text:"⚡ CATCH",color:"#fbbf24",tick}];
    return{...c,hp:nHp};
  });

  // Rest heal + passive breeding
  let breedBaby = null;
  const healedInv = newInventory.map(c => ({
    ...c,
    hp: Math.min(1, (c.hp||0) + HEAL_RATE),
    breedCooldown: Math.max(0, (c.breedCooldown ?? BREED_TICKS) - 1),
  }));

  // Check for breeding pairs: two creatures with low cooldown, compatible hue, min level
  if (healedInv.length >= 2 && healedInv.length <= BREED_MAX_BAG) {
    for (let i = 0; i < healedInv.length && !breedBaby; i++) {
      const a = healedInv[i];
      if ((a.breedCooldown??1) > 0 || (a.level||1) < BREED_MIN_LEVEL || a.hp < 0.5) continue;
      for (let j = i + 1; j < healedInv.length && !breedBaby; j++) {
        const b = healedInv[j];
        if ((b.breedCooldown??1) > 0 || (b.level||1) < BREED_MIN_LEVEL || b.hp < 0.5) continue;
        // Hue compatibility check (circular distance)
        const hueDiff = Math.abs(((a.dna.hue - b.dna.hue) + 540) % 360 - 180);
        if (hueDiff > BREED_HUE_COMPAT) continue;
        // Breed! Cross DNA with extra mutations for surprise
        const childDNA = crossDNA(a.dna, b.dna);
        // Extra random mutation on 2 genes for surprise
        const geneKeys = Object.keys(childDNA);
        for (let m = 0; m < 2; m++) {
          const g = geneKeys[Math.floor(Math.random() * geneKeys.length)];
          if (g === 'hue') childDNA[g] = (childDNA[g] + (Math.random()-0.5)*60 + 360) % 360;
          else childDNA[g] = Math.max(0.1, Math.min(1.5, childDNA[g] + (Math.random()-0.5)*0.25));
        }
        breedBaby = makeCreature(pc, pr, childDNA);
        breedBaby.level = 1;
        breedBaby.moves = deriveMoves(childDNA);
        // Reset cooldowns on both parents
        healedInv[i] = { ...healedInv[i], breedCooldown: BREED_TICKS };
        healedInv[j] = { ...healedInv[j], breedCooldown: BREED_TICKS };
        newFloats = [...newFloats, { id:newId(), col:pc, row:pr, text:"💕 New creature!", color:"#f472b6", tick }];
      }
    }
  }
  const finalInv = breedBaby ? [...healedInv, breedBaby] : healedInv;

  // Soft collision: creatures step aside from you (shy ones more) and keep a little space from each other
  let crowd=damaged.map(c=>{
    if(c.dead) return c;
    let {col,row}=c;
    const dx=col-pc, dy=row-pr, d=Math.hypot(dx,dy);
    if(d<0.7&&d>0.0001){
      const shove=(0.7-d)*(0.25+(1-(c.dna.aggression??0.5))*0.35);
      const nx=col+dx/d*shove, ny=row+dy/d*shove;
      if(isPassable(map,nx,row)) col=nx;
      if(isPassable(map,col,ny)) row=ny;
    }
    return col===c.col&&row===c.row?c:{...c,col,row};
  });
  for(let i=0;i<crowd.length;i++) for(let j=i+1;j<crowd.length;j++){
    const a=crowd[i], b=crowd[j]; if(a.dead||b.dead) continue;
    const dx=b.col-a.col, dy=b.row-a.row, d=Math.hypot(dx,dy);
    if(d<0.5&&d>0.0001){
      const k=(0.5-d)*0.25, ux=dx/d*k, uy=dy/d*k;
      if(isPassable(map,a.col-ux,a.row-uy)) crowd[i]={...a,col:a.col-ux,row:a.row-uy};
      if(isPassable(map,b.col+ux,b.row+uy)) crowd[j]={...b,col:b.col+ux,row:b.row+uy};
    }
  }

  return {
    ...state, // keep everything this step doesn't touch (seeds, and more in later stages)
    creatures:[...crowd.filter(c=>!c.dead),...newBorn],
    plants, player:{...player,col:pc,row:pr,facing,moveAnim},
    inventory:finalInv, events:[...events.slice(-30),...newEvents], floats:newFloats, tick,
  };
}
