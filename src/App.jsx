import { useState, useEffect, useRef, useCallback } from "react";

// ─── Map constants ────────────────────────────────────────────────────────────
const COLS = 24, ROWS = 16;
const TW = 32, TH = 18; // tile width / half-height for isometric projection
const ISO_ORIGIN_X_FRAC = 0.5; // where world (0,0) appears horizontally
const ISO_ORIGIN_Y = 48;       // pixels from top

// Convert grid col,row → screen x,y (isometric), with camera offset
function isoProject(col, row, canvasW, cam={x:0,y:0}) {
  const ox = canvasW * ISO_ORIGIN_X_FRAC;
  const x = ox + (col - row) * TW - cam.x;
  const y = ISO_ORIGIN_Y + (col + row) * TH - cam.y;
  return { x, y };
}
// Convert screen x,y → nearest grid col,row
function isoUnproject(sx, sy, canvasW) {
  const ox = canvasW * ISO_ORIGIN_X_FRAC;
  const dx = sx - ox, dy = sy - ISO_ORIGIN_Y;
  const col = Math.round((dx / TW + dy / TH) / 2);
  const row = Math.round((dy / TH - dx / TW) / 2);
  return { col, row };
}

// ─── Tile definitions ─────────────────────────────────────────────────────────
const TILES = {
  grass:   { id:"grass",   label:"Grass",   emoji:"🌿", color:"#4a7c3f", topColor:"#5a9a4a", passable:true  },
  dirt:    { id:"dirt",    label:"Dirt",    emoji:"🟫", color:"#8B6914", topColor:"#a07820", passable:true  },
  water:   { id:"water",   label:"Water",   emoji:"💧", color:"#1a5fb4", topColor:"#2878d4", passable:false },
  stone:   { id:"stone",   label:"Stone",   emoji:"🪨", color:"#555566", topColor:"#6a6a7a", passable:true  },
  tree:    { id:"tree",    label:"Tree",    emoji:"🌲", color:"#2d5a1e", topColor:"#3a7228", passable:false },
  flower:  { id:"flower",  label:"Flower",  emoji:"🌸", color:"#4a7c3f", topColor:"#c8698a", passable:true  },
};
const TILE_IDS = Object.keys(TILES);

function makeDefaultMap() {
  const map = [];
  for (let r = 0; r < ROWS; r++) {
    map.push([]);
    for (let c = 0; c < COLS; c++) map[r].push("grass");
  }
  return map;
}

function makeRandomMap() {
  // Simple noise-based random map with blobs of each tile type
  const map = makeDefaultMap();
  const features = [
    { tile:"water",  count:3, size:3 },
    { tile:"tree",   count:8, size:2 },
    { tile:"stone",  count:4, size:2 },
    { tile:"dirt",   count:5, size:3 },
    { tile:"flower", count:6, size:2 },
  ];
  for (const {tile, count, size} of features) {
    for (let i=0; i<count; i++) {
      const cr=Math.floor(Math.random()*COLS), rr=Math.floor(Math.random()*ROWS);
      for (let dr=-size; dr<=size; dr++) {
        for (let dc=-size; dc<=size; dc++) {
          if (Math.random() > 0.55) continue;
          const r=rr+dr, c=cr+dc;
          if (r>=0&&r<ROWS&&c>=0&&c<COLS) map[r][c]=tile;
        }
      }
    }
  }
  // Ensure center region is passable grass for spawning
  const sc=Math.floor(COLS/2), sr=Math.floor(ROWS/2);
  for (let dr=-2; dr<=2; dr++)
    for (let dc=-2; dc<=2; dc++)
      if (sr+dr>=0&&sr+dr<ROWS&&sc+dc>=0&&sc+dc<COLS)
        map[sr+dr][sc+dc]="grass";
  return map;
}

// ─── Game constants ───────────────────────────────────────────────────────────
const TICK_MS = 50;
const MAX_CREATURES = 36;
const MAX_PLANTS = 50;
const PLANT_SPAWN_INTERVAL = 80;
const CREATURE_LIFESPAN_BASE = 9000; // ~7.5 min at 50ms/tick — long enough to level up
const HUNGER_RATE = 0.003;
const REPRODUCE_COOLDOWN = 300;
const REPRODUCE_HUNGER_MIN = 0.45;
const PLANT_ENERGY = 0.45;
const PLAYER_SPEED = 0.06; // in grid units per tick
const CAPTURE_DIST = 1.8;
const COMBAT_BASE_DAMAGE = 0.008;
const TERRITORY_RADIUS = 3.5; // grid units
const INVENTORY_MAX = 12;
const XP_PER_LEVEL = 100;
const HEAL_RATE = 0.0003;
const BREED_TICKS = 6000;      // ticks between breeding checks (~5 min)
const BREED_HUE_COMPAT = 60;   // max hue difference to be compatible
const BREED_MIN_LEVEL = 3;     // must be at least this level to breed
const BREED_MAX_BAG = 11;      // won't breed if bag already full

// ─── Move pool ────────────────────────────────────────────────────────────────
const MOVE_POOL = [
  { id:"tackle",    name:"Tackle",      power:40,  acc:1.00, type:"normal",   effect:null },
  { id:"scratch",   name:"Scratch",     power:40,  acc:1.00, type:"normal",   effect:null },
  { id:"growl",     name:"Growl",       power:0,   acc:1.00, type:"normal",   effect:"lower_atk" },
  { id:"headbutt",  name:"Headbutt",    power:70,  acc:1.00, type:"normal",   effect:null },
  { id:"slam",      name:"Slam",        power:80,  acc:0.75, type:"normal",   effect:null },
  { id:"ember",     name:"Ember",       power:40,  acc:1.00, type:"fire",     effect:"burn" },
  { id:"flamethrower",name:"Flamethrower",power:90,acc:1.00,type:"fire",     effect:"burn" },
  { id:"bubble",    name:"Bubble",      power:40,  acc:1.00, type:"water",    effect:"lower_spd" },
  { id:"surf",      name:"Surf",        power:90,  acc:1.00, type:"water",    effect:null },
  { id:"vinewhip",  name:"Vine Whip",   power:45,  acc:1.00, type:"grass",    effect:null },
  { id:"razorleaf", name:"Razor Leaf",  power:55,  acc:0.95, type:"grass",    effect:null },
  { id:"thunder",   name:"Thunder",     power:110, acc:0.70, type:"electric", effect:"paralyze" },
  { id:"spark",     name:"Spark",       power:65,  acc:1.00, type:"electric", effect:"paralyze" },
  { id:"icefang",   name:"Ice Fang",    power:65,  acc:0.95, type:"ice",      effect:"freeze" },
  { id:"blizzard",  name:"Blizzard",    power:110, acc:0.70, type:"ice",      effect:"freeze" },
  { id:"poisonsting",name:"Poison Sting",power:15, acc:1.00, type:"poison",   effect:"poison" },
  { id:"sludge",    name:"Sludge",      power:65,  acc:1.00, type:"poison",   effect:"poison" },
  { id:"rockthrow", name:"Rock Throw",  power:50,  acc:0.90, type:"rock",     effect:null },
  { id:"rockblast", name:"Rock Blast",  power:75,  acc:0.90, type:"rock",     effect:null },
  { id:"recover",   name:"Recover",     power:0,   acc:1.00, type:"normal",   effect:"heal" },
  { id:"harden",    name:"Harden",      power:0,   acc:1.00, type:"normal",   effect:"raise_def" },
  { id:"bite",      name:"Bite",        power:60,  acc:1.00, type:"dark",     effect:null },
  { id:"crunch",    name:"Crunch",      power:80,  acc:1.00, type:"dark",     effect:"lower_def" },
];
const TYPE_COLORS = {
  normal:"#a8a878", fire:"#f08030", water:"#6890f0", grass:"#78c850",
  electric:"#f8d030", ice:"#98d8d8", poison:"#a040a0", rock:"#b8a038", dark:"#705848",
};

function deriveMoves(dna) {
  const weak = MOVE_POOL.filter(m => m.type === "normal" && m.power > 0 && m.power <= 45);
  const pick = pool => pool[Math.floor(Math.random() * pool.length)];
  return [pick(weak) || MOVE_POOL[0]];
}

function learnMoveAtLevel(dna, level, knownMoves) {
  const learnLevels = [3,5,8,12,17,23,30];
  if (!learnLevels.includes(level)) return null;
  const maxPower = level>=17?999:level>=12?110:level>=8?90:level>=5?65:45;
  const knownIds = new Set((knownMoves||[]).map(m=>m.id));
  const scored = MOVE_POOL.filter(m => !knownIds.has(m.id) && m.power <= maxPower).map(m => {
    let s = 1;
    if (dna.aggression>0.6 && ['fire','dark','rock','electric'].includes(m.type)) s+=3;
    if (dna.aggression<0.4 && (m.effect==='heal'||m.effect==='raise_def'||m.effect==='lower_atk')) s+=3;
    if (dna.strength>0.6 && m.power>=65) s+=2;
    const ht=['water','grass','ice','poison'];
    if (m.type===ht[Math.floor((dna.hue%360)/90)]) s+=2;
    return {m,s};
  }).sort((a,b)=>b.s-a.s);
  if (!scored.length) return null;
  const top = scored.slice(0,Math.min(3,scored.length));
  return top[Math.floor(Math.random()*top.length)].m;
}

// ─── DNA ─────────────────────────────────────────────────────────────────────
function randomDNA() {
  return { hue:Math.random()*360, saturation:60+Math.random()*40, size:0.7+Math.random()*0.6,
    speed:0.6+Math.random()*0.8, lifespan:0.7+Math.random()*0.6, fertility:0.4+Math.random()*0.6,
    strength:0.4+Math.random()*0.6, aggression:0.2+Math.random()*0.8,
    metabolism:0.4+Math.random()*1.2,
    reproRate:0.4+Math.random()*1.2,
    xpRate:0.5+Math.random()*1.0,    // 0.5–1.5: low=levels fast, high=levels slow
    hpRange:0.5+Math.random()*1.0,   // 0.5–1.5: low=fragile/small hp pool, high=tanky
  };
}
function crossDNA(a,b) {
  const m=v=>v+(Math.random()-0.5)*0.08;
  return { hue:(Math.random()<0.5?a.hue:b.hue)+(Math.random()-0.5)*18,
    saturation:m((a.saturation+b.saturation)/2), size:m((a.size+b.size)/2),
    speed:m((a.speed+b.speed)/2), lifespan:m((a.lifespan+b.lifespan)/2),
    fertility:m((a.fertility+b.fertility)/2), strength:m((a.strength+b.strength)/2),
    aggression:m((a.aggression+b.aggression)/2),
    metabolism:m(((a.metabolism??1)+(b.metabolism??1))/2),
    reproRate:m(((a.reproRate??1)+(b.reproRate??1))/2),
    xpRate:m(((a.xpRate??1)+(b.xpRate??1))/2),
    hpRange:m(((a.hpRange??1)+(b.hpRange??1))/2) };
}
function dnaColor(dna,l=55,a=1) {
  const h=((dna.hue%360)+360)%360, s=Math.max(30,Math.min(100,dna.saturation));
  return `hsla(${h},${s}%,${l}%,${a})`;
}

// ─── Factories ────────────────────────────────────────────────────────────────
let nextId=1;

// ─── Save / load (this browser only) ──────────────────────────────────────────
const SAVE_KEY="homebase-save-v1";
function readSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY); if(!raw) return null;
    const d=JSON.parse(raw);
    if(d&&d.v===1&&Array.isArray(d.map)&&d.state&&Array.isArray(d.state.inventory)) return d;
  }catch(e){}
  return null;
}
function writeSave(map,state,tick){
  try{
    const data={v:1,savedAt:Date.now(),tick,nextId,map,state:{...state,events:[],floats:[]}};
    localStorage.setItem(SAVE_KEY,JSON.stringify(data));
    return data;
  }catch(e){ return null; }
}
function clearSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }
function timeAgo(ts){
  const m=Math.round((Date.now()-ts)/60000);
  if(m<1) return "just now"; if(m<60) return m+" min ago";
  const h=Math.round(m/60); if(h<24) return h+(h===1?" hour ago":" hours ago");
  const d=Math.round(h/24); return d+(d===1?" day ago":" days ago");
}
function makeCreature(col,row,dna=null) {
  dna=dna||randomDNA();
  return { id:nextId++, type:"creature", col, row, dna, moves:deriveMoves(dna),
    age:0, maxAge:CREATURE_LIFESPAN_BASE*dna.lifespan,
    hunger:0.8+Math.random()*0.2, hp:1.0, level:1, xp:0,
    reproductionCooldown:Math.floor(REPRODUCE_COOLDOWN/(dna.reproRate??1)),
    breedCooldown:BREED_TICKS,
    dcol:(Math.random()-0.5)*0.04, drow:(Math.random()-0.5)*0.04,
    wanderTimer:0, state:"wander", targetId:null,
    combatTimer:0, dead:false, deathReason:null, capturable:false };
}
function makePlant(col,row) {
  const hue=90+Math.random()*60, maxSize=0.8+Math.random()*0.6;
  return { id:nextId++, type:"plant", col, row, hue,
    size:maxSize*(0.3+Math.random()*0.5), maxSize,
    growthRate:0.0015+Math.random()*0.001,
    energy:0.4+Math.random()*0.4, dead:false };
}
function makePlayer(map) {
  const sc=Math.floor(COLS/2), sr=Math.floor(ROWS/2);
  // Spiral out from center to find the nearest passable tile
  for (let radius=0; radius<Math.max(COLS,ROWS); radius++) {
    for (let dr=-radius; dr<=radius; dr++) {
      for (let dc=-radius; dc<=radius; dc++) {
        if (Math.abs(dr)!==radius && Math.abs(dc)!==radius) continue;
        const c=sc+dc, r=sr+dr;
        if (c>=0&&c<COLS&&r>=0&&r<ROWS&&TILES[map[r]?.[c]]?.passable) {
          return { col:c, row:r, facing:"down", moveAnim:0 };
        }
      }
    }
  }
  return { col:sc, row:sr, facing:"down", moveAnim:0 };
}

// ─── Battle helpers ───────────────────────────────────────────────────────────
function makeBattler(c) {
  const lv=c.level||1;
  const maxHp=Math.floor((20+lv*8+c.dna.size*10)*(c.dna.hpRange??1));
  // If creature already has battleHp from a previous swap, use it.
  // Otherwise derive from world hp (0-1 float).
  const battleHp = c.battleHp!=null ? c.battleHp : Math.floor((c.hp||1)*maxHp);
  return { ...c, level:lv, moves:c.moves||deriveMoves(c.dna),
    maxHp, battleHp,
    atk:Math.floor(5+lv*3+c.dna.strength*8),
    def:Math.floor(3+lv*2+c.dna.size*5),
    spd:Math.floor(3+lv*2+c.dna.speed*6),
    status:null, statMods:{atk:0,def:0,spd:0} };
}
function applyStatMod(base,mod) {
  const t=[0.25,0.28,0.33,0.4,0.5,0.66,1,1.5,2,2.5,3,3.5,4];
  return Math.floor(base*t[mod+6]);
}
function executeBattleMove(atk,def,move) {
  const msgs=[];
  let ac={...atk,statMods:{...atk.statMods}}, dc={...def,statMods:{...def.statMods}};
  if (atk.status==="paralyze"&&Math.random()<0.25){msgs.push("Paralyzed! Can't move!");return{newAttacker:ac,newDefender:dc,msgs};}
  if (atk.status==="freeze"&&Math.random()<0.5){msgs.push("Frozen solid!");return{newAttacker:ac,newDefender:dc,msgs};}
  msgs.push("Used "+move.name+"!");
  if (Math.random()>move.acc){msgs.push("Missed!");return{newAttacker:ac,newDefender:dc,msgs};}
  if (move.effect==="heal"){const h=Math.floor(ac.maxHp*0.4);ac.battleHp=Math.min(ac.maxHp,ac.battleHp+h);msgs.push("Restored "+h+" HP!");return{newAttacker:ac,newDefender:dc,msgs};}
  if (move.effect==="raise_def"){ac.statMods.def=Math.min(3,ac.statMods.def+1);msgs.push("Defense rose!");return{newAttacker:ac,newDefender:dc,msgs};}
  if (move.effect==="lower_atk"){dc.statMods.atk=Math.max(-3,dc.statMods.atk-1);msgs.push("Foe's Attack fell!");}
  if (move.effect==="lower_def"){dc.statMods.def=Math.max(-3,dc.statMods.def-1);msgs.push("Foe's Defense fell!");}
  if (move.effect==="lower_spd"){dc.statMods.spd=Math.max(-3,dc.statMods.spd-1);msgs.push("Foe's Speed fell!");}
  if (move.power>0) {
    const ea=applyStatMod(ac.atk,ac.statMods.atk), ed=applyStatMod(dc.def,dc.statMods.def);
    const dmg=Math.max(1,Math.floor((ea/ed)*move.power*0.18*(0.85+Math.random()*0.15)));
    dc.battleHp=Math.max(0,dc.battleHp-dmg); msgs.push("Hit for "+dmg+"!");
  }
  if (move.effect==="burn"&&!dc.status&&Math.random()<0.3){dc.status="burn";msgs.push("Burned!");}
  if (move.effect==="poison"&&!dc.status&&Math.random()<0.3){dc.status="poison";msgs.push("Poisoned!");}
  if (move.effect==="paralyze"&&!dc.status&&Math.random()<0.3){dc.status="paralyze";msgs.push("Paralyzed!");}
  if (move.effect==="freeze"&&!dc.status&&Math.random()<0.2){dc.status="freeze";msgs.push("Frozen!");}
  return {newAttacker:ac,newDefender:dc,msgs};
}
function applyEndOfTurn(b) {
  if (!b.status||b.status==="paralyze"||b.status==="freeze") return {b,msg:null};
  const dmg=Math.max(1,Math.floor(b.maxHp*0.0625));
  return {b:{...b,battleHp:Math.max(0,b.battleHp-dmg)},msg:(b.status==="burn"?"🔥":"☠️")+" "+dmg+" from "+b.status};
}
function aiPickMove(enemy,player) {
  const mvs=enemy.moves;
  if (enemy.battleHp<enemy.maxHp*0.3){const h=mvs.find(m=>m.effect==="heal");if(h)return h;}
  return [...mvs].sort((a,b)=>b.power-a.power)[0]||mvs[0];
}

// ─── World simulation ─────────────────────────────────────────────────────────
function simulate(state, tick, inputRef, map, W) {
  let {creatures,plants,player,inventory,events,floats} = state;
  const newEvents=[]; let newFloats=floats.filter(f=>tick-f.tick<45);

  // Plants grow
  plants=plants.map(p=>{const ns=Math.min(p.maxSize,p.size+p.growthRate);return{...p,size:ns,energy:ns/p.maxSize};}).filter(p=>!p.dead);
  if (tick%PLANT_SPAWN_INTERVAL===0&&plants.length<MAX_PLANTS) {
    let tries=0; while(tries++<20){const c=Math.floor(Math.random()*COLS),r=Math.floor(Math.random()*ROWS);if(TILES[map[r][c]]?.passable){plants=[...plants,makePlant(c,r)];break;}}
  }

  // Respawn wild creatures if population drops too low (every ~30s)
  const RESPAWN_INTERVAL = 600;
  const MIN_WILD = 8;
  if (tick%RESPAWN_INTERVAL===0 && creatures.filter(c=>!c.dead).length < MIN_WILD) {
    let tries=0;
    while(tries++<50){
      const c=Math.floor(Math.random()*COLS), r=Math.floor(Math.random()*ROWS);
      if(TILES[map[r][c]]?.passable && Math.hypot(c-pc,r-pr)>5){
        creatures=[...creatures,makeCreature(c,r)];
        break;
      }
    }
  }

  // Player movement
  let {col:pc,row:pr,facing,moveAnim}=player;
  const {dx:idx,dy:idy,capturePressed}=inputRef.current;
  let nc=pc+idx*PLAYER_SPEED, nr=pr+idy*PLAYER_SPEED;
  nc=Math.max(0,Math.min(COLS-1,nc)); nr=Math.max(0,Math.min(ROWS-1,nr));
  // Collision with impassable tiles
  const tc=Math.round(nc), tr=Math.round(nr);
  if (map[tr]&&map[tr][tc]&&TILES[map[tr][tc]]?.passable===false) { nc=pc; nr=pr; }
  else { pc=nc; pr=nr; }
  if (idx<0) facing="left"; else if (idx>0) facing="right";
  else if (idy<0) facing="up"; else if (idy>0) facing="down";
  const moving=idx!==0||idy!==0;
  moveAnim=moving?(moveAnim+0.25)%(Math.PI*2):0;

  // Catch
  let newInventory=[...inventory];
  if (capturePressed) {
    inputRef.current.capturePressed=false;
    const nearby=creatures.filter(c=>!c.dead&&Math.hypot(c.col-pc,c.row-pr)<CAPTURE_DIST);
    if (!nearby.length) newFloats=[...newFloats,{id:nextId++,col:pc,row:pr,text:"Nothing nearby!",color:"#94a3b8",tick}];
    else if (newInventory.length>=INVENTORY_MAX) newFloats=[...newFloats,{id:nextId++,col:pc,row:pr,text:"Bag full!",color:"#f87171",tick}];
    else if (!newInventory.length) newFloats=[...newFloats,{id:nextId++,col:pc,row:pr,text:"Walk into a creature!",color:"#facc15",tick}];
    else {
      const t=nearby.reduce((b,c)=>Math.hypot(c.col-pc,c.row-pr)<Math.hypot(b.col-pc,b.row-pr)?c:b);
      const ch=Math.min(0.95,Math.max(0.05,0.05+(1-t.hp)*0.947));
      const pct=Math.round(ch*100);
      if (Math.random()<ch) {
        newInventory=[...newInventory,{...t,capturedAt:tick}];
        creatures=creatures.map(c=>c.id===t.id?{...c,dead:true,deathReason:"captured"}:c);
        newFloats=[...newFloats,{id:nextId++,col:t.col,row:t.row,text:"Caught! ("+pct+"%)",color:"#fbbf24",tick}];
        newEvents.push({type:"capture",col:t.col,row:t.row,tick});
      } else newFloats=[...newFloats,{id:nextId++,col:t.col,row:t.row,text:"Escaped! ("+pct+"%)",color:"#f87171",tick}];
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
    if(ns==="eat"){const t=plants.find(p=>p.id===nt&&!p.dead);if(!t||t.energy<0.05){ns="wander";nt=null;}else{hunger=Math.min(1,hunger+Math.min(PLANT_ENERGY,1-hunger));const pi=plants.findIndex(p=>p.id===nt);if(pi!==-1)plants=plants.map((p,i)=>i===pi?{...p,size:Math.max(0.05,p.size-0.25),energy:Math.max(0,p.energy-0.4)}:p);if(hunger>=0.95){ns="wander";nt=null;}}}
    if(ns==="reproduce"){const p2=living.find(o=>o.id===nt);if(!p2||p2.dead||Math.hypot(p2.col-col,p2.row-row)>4){ns="wander";nt=null;}else if(reproductionCooldown===0){const child=makeCreature(col+(Math.random()-0.5)*0.5,row+(Math.random()-0.5)*0.5,crossDNA(dna,p2.dna));newBorn.push(child);newEvents.push({type:"birth",col:child.col,row:child.row,tick});reproductionCooldown=Math.floor(REPRODUCE_COOLDOWN/(dna.reproRate??1));hunger=Math.max(0.1,hunger-0.3);ns="wander";nt=null;}}
    if(ns==="wander"){wanderTimer--;if(wanderTimer<=0){dcol=(Math.random()-0.5)*spd*2;drow=(Math.random()-0.5)*spd*2;wanderTimer=30+Math.random()*60;}}
    col+=dcol; row+=drow;
    col=Math.max(0.2,Math.min(COLS-1.2,col)); row=Math.max(0.2,Math.min(ROWS-1.2,row));
    return{...c,col,row,dcol,drow,hunger,age,maxAge,reproductionCooldown,wanderTimer,state:ns,targetId:nt,dna,hp,combatTimer,capturable};
  });

  const hitEvts=newEvents.filter(e=>e.type==="hit");
  const damaged=updated.map(c=>{
    const hits=hitEvts.filter(h=>h.targetId===c.id);if(!hits.length)return c;
    const dmg=hits.reduce((s,h)=>s+h.damage,0);
    const nHp=Math.max(0,c.hp-dmg);
    if(nHp<0.3&&c.hp>=0.3) newFloats=[...newFloats,{id:nextId++,col:c.col,row:c.row,text:"⚡ CATCH",color:"#fbbf24",tick}];
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
        newFloats = [...newFloats, { id:nextId++, col:pc, row:pr, text:"💕 New creature!", color:"#f472b6", tick }];
      }
    }
  }
  const finalInv = breedBaby ? [...healedInv, breedBaby] : healedInv;

  return {
    creatures:[...damaged.filter(c=>!c.dead),...newBorn],
    plants, player:{...player,col:pc,row:pr,facing,moveAnim},
    inventory:finalInv, events:[...events.slice(-30),...newEvents], floats:newFloats, tick,
  };
}

// ─── Isometric renderer ───────────────────────────────────────────────────────
function drawIsoTile(ctx, col, row, tileId, canvasW, highlight=false, cam={x:0,y:0}) {
  const {x,y}=isoProject(col,row,canvasW,cam);
  const t=TILES[tileId]||TILES.grass;
  const w=TW, h=TH;

  // Left face
  ctx.fillStyle=t.color;
  ctx.beginPath();
  ctx.moveTo(x,y+h); ctx.lineTo(x-w,y); ctx.lineTo(x-w,y+6); ctx.lineTo(x,y+h+6);
  ctx.closePath(); ctx.fill();

  // Right face
  ctx.fillStyle=shadeColor(t.color,-20);
  ctx.beginPath();
  ctx.moveTo(x,y+h); ctx.lineTo(x+w,y); ctx.lineTo(x+w,y+6); ctx.lineTo(x,y+h+6);
  ctx.closePath(); ctx.fill();

  // Top face
  ctx.fillStyle=highlight?"#ffffff44":t.topColor;
  ctx.beginPath();
  ctx.moveTo(x,y); ctx.lineTo(x+w,y-h); ctx.lineTo(x,y-h*2); ctx.lineTo(x-w,y-h);
  ctx.closePath(); ctx.fill();

  // Tile edge outline
  ctx.strokeStyle="rgba(0,0,0,0.18)"; ctx.lineWidth=0.5;
  ctx.beginPath();
  ctx.moveTo(x,y); ctx.lineTo(x+w,y-h); ctx.lineTo(x,y-h*2); ctx.lineTo(x-w,y-h); ctx.closePath();
  ctx.stroke();

  // Special decorations on top
  if (tileId==="tree") drawIsoTree(ctx,x,y-h*2);
  if (tileId==="flower") drawIsoFlower(ctx,x,y-h*2);
  if (tileId==="water") drawIsoWater(ctx,x,y-h*2,canvasW);
}

function drawIsoTree(ctx,x,y) {
  // Trunk
  ctx.fillStyle="#5c3d1e";
  ctx.fillRect(x-3,y,6,10);
  // Canopy
  ctx.fillStyle="#2d7d1e";
  ctx.beginPath(); ctx.arc(x,y-4,12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#3a9a28";
  ctx.beginPath(); ctx.arc(x-3,y-8,8,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+4,y-6,7,0,Math.PI*2); ctx.fill();
}

function drawIsoFlower(ctx,x,y) {
  const colors=["#f87171","#fb923c","#fbbf24","#a78bfa","#f472b6"];
  for(let i=0;i<3;i++) {
    ctx.fillStyle=colors[Math.floor((x*7+i*3)%colors.length)];
    ctx.beginPath(); ctx.arc(x+(i-1)*7,y+2,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fef08a";
    ctx.beginPath(); ctx.arc(x+(i-1)*7,y+2,1.5,0,Math.PI*2); ctx.fill();
  }
}

function drawIsoWater(ctx,x,y) {
  ctx.fillStyle="rgba(100,180,255,0.25)";
  ctx.beginPath();
  ctx.moveTo(x,y); ctx.lineTo(x+TW,y-TH); ctx.lineTo(x,y-TH*2); ctx.lineTo(x-TW,y-TH);
  ctx.closePath(); ctx.fill();
}

function shadeColor(hex,amt) {
  // Works on css color strings too; simple HSL shift for our named colors
  // We'll just darken by returning a slightly modified rgba
  return hex+"cc";
}

function drawPlantIso(ctx,plant,canvasW,cam) {
  const {x,y}=isoProject(plant.col,plant.row,canvasW,cam);
  const r=plant.size*14;
  const ty=y-TH*2;
  ctx.globalAlpha=0.2; ctx.fillStyle="#000";
  ctx.beginPath(); ctx.ellipse(x,ty+4,r*0.7,r*0.3,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  for(let i=0;i<3;i++){
    const a=(i/3)*Math.PI*2;
    ctx.fillStyle=`hsl(${plant.hue},65%,38%)`;
    ctx.beginPath(); ctx.arc(x+Math.cos(a)*r*0.4,ty+Math.sin(a)*r*0.35-r*0.2,r*0.48,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle=`hsl(${plant.hue},65%,55%)`;
  ctx.beginPath(); ctx.arc(x,ty-r*0.2,r*0.32,0,Math.PI*2); ctx.fill();
}

function drawCreatureIso(ctx,c,tick,canvasW,cam) {
  const {x,y}=isoProject(c.col,c.row,canvasW,cam);
  const ty=y-TH*2;
  const r=8*c.dna.size;
  const lr=c.age/c.maxAge;
  // Capturable glow
  if(c.capturable){ctx.globalAlpha=0.2+Math.sin(tick*0.18)*0.12;ctx.strokeStyle="#fbbf24";ctx.lineWidth=2.5;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(x,ty,r+6,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
  // Shadow
  ctx.globalAlpha=0.25;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(x,ty+r+2,r*0.8,r*0.3,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // Body
  const ll=55-lr*18;
  ctx.fillStyle=dnaColor(c.dna,ll); ctx.beginPath(); ctx.arc(x,ty,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=dnaColor(c.dna,ll-15); ctx.lineWidth=r*0.22;
  ctx.beginPath(); ctx.arc(x,ty,r*0.6,0,Math.PI*2); ctx.stroke();
  if(c.state==="combat"){ctx.globalAlpha=0.25+Math.sin(tick*0.4)*0.14;ctx.fillStyle="#ef4444";ctx.beginPath();ctx.arc(x,ty,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  // Eyes
  const eo=r*0.36;
  ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(x-eo,ty-r*0.1,r*0.2,0,Math.PI*2);ctx.arc(x+eo,ty-r*0.1,r*0.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#111";ctx.beginPath();ctx.arc(x-eo+1,ty-r*0.1,r*0.11,0,Math.PI*2);ctx.arc(x+eo+1,ty-r*0.1,r*0.11,0,Math.PI*2);ctx.fill();
  // HP bar
  const bw=r*2,bh=2.5,bx=x-bw/2,by=ty-r-10;
  ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle=c.hp>.6?"#4ade80":c.hp>.3?"#facc15":"#f87171";ctx.fillRect(bx,by,bw*c.hp,bh);
  // Level
  ctx.fillStyle="#fff";ctx.font=`bold ${Math.max(7,r*0.65)}px Georgia`;ctx.textAlign="center";
  ctx.fillText("L"+(c.level||1),x,ty+r+9);ctx.textAlign="left";
  if(c.capturable){ctx.font=`${r*0.85}px serif`;ctx.fillText("⚡",x-r*1.9,ty-r*0.2);}
}

function drawPlayerIso(ctx,player,tick,canvasW,cam) {
  const {x,y}=isoProject(player.col,player.row,canvasW,cam);
  const ty=y-TH*2;
  const {facing,moveAnim}=player;
  const bobY=Math.sin(moveAnim)*1.5;
  const py=ty+bobY;
  const isSide=facing==="left"||facing==="right";
  const sf=facing==="left"?-1:1;

  ctx.save();
  if(isSide){ctx.translate(x,0);ctx.scale(sf,1);ctx.translate(-x,0);}

  // Shadow
  ctx.globalAlpha=0.3;ctx.fillStyle="#000";
  ctx.beginPath();ctx.ellipse(x+1,ty+11,9,3.5,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;

  const ls=Math.sin(moveAnim)*3;

  if(facing==="up"){
    ctx.fillStyle="#334155";ctx.fillRect(x-5,py+5,4,8+ls*0.4);ctx.fillRect(x+1,py+5,4,8-ls*0.4);
    ctx.fillStyle="#1e293b";ctx.fillRect(x-6,py+11+ls*0.4,5,3);ctx.fillRect(x+1,py+11-ls*0.4,5,3);
    ctx.fillStyle="#1d4ed8";ctx.fillRect(x-6,py-3,12,10);
    const as=Math.sin(moveAnim)*4;
    ctx.fillStyle="#1d4ed8";ctx.fillRect(x-10,py-2+as,3,7);ctx.fillRect(x+7,py-2-as,3,7);
    ctx.fillStyle="#fcd5a0";ctx.fillRect(x-2,py-5,4,4);
    ctx.beginPath();ctx.arc(x,py-9,6.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#78350f";ctx.beginPath();ctx.arc(x,py-9,6.5,0,Math.PI*2);ctx.fill();
  } else if(isSide){
    ctx.fillStyle="#334155";ctx.fillRect(x-1,py+5,4,8+ls*0.5);ctx.fillStyle="#283548";ctx.fillRect(x-4,py+5,4,8-ls*0.5);
    ctx.fillStyle="#1e293b";ctx.fillRect(x,py+12+ls*0.5,6,3);ctx.fillStyle="#16202c";ctx.fillRect(x-4,py+12-ls*0.5,6,3);
    ctx.fillStyle="#1d4ed8";ctx.fillRect(x-4,py-3,9,10);
    const as=Math.sin(moveAnim)*5;
    ctx.fillStyle="#1565c0";ctx.fillRect(x+3,py-2-as*0.5,3,8);ctx.fillStyle="#1d4ed8";ctx.fillRect(x-3,py-2+as*0.5,3,8);
    ctx.fillStyle="#fcd5a0";ctx.fillRect(x-1,py-5,4,4);
    ctx.beginPath();ctx.arc(x+1,py-9,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#78350f";ctx.beginPath();ctx.arc(x+1,py-10,5.5,Math.PI*0.8,Math.PI*2);ctx.fill();ctx.fillRect(x-4,py-13,10,4);
    ctx.beginPath();ctx.arc(x+4,py-14,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fcd5a0";ctx.beginPath();ctx.arc(x+1,py-9,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#78350f";ctx.beginPath();ctx.arc(x+1,py-10,5.5,Math.PI*0.8,Math.PI*2);ctx.fill();ctx.fillRect(x-4,py-13,10,4);
    ctx.fillStyle="#1e293b";ctx.beginPath();ctx.arc(x+4,py-9,1.2,0,Math.PI*2);ctx.fill();
  } else {
    const as=Math.sin(moveAnim)*4;
    ctx.fillStyle="#334155";ctx.fillRect(x-5,py+5,4,8+ls*0.4);ctx.fillRect(x+1,py+5,4,8-ls*0.4);
    ctx.fillStyle="#1e293b";ctx.fillRect(x-6,py+11+ls*0.4,5,3);ctx.fillRect(x+1,py+11-ls*0.4,5,3);
    ctx.fillStyle="#1d4ed8";ctx.fillRect(x-6,py-3,12,10);ctx.fillStyle="#3b82f6";ctx.fillRect(x-2,py-3,4,3);
    ctx.fillStyle="#1d4ed8";ctx.fillRect(x-10,py-2+as,3,7);ctx.fillRect(x+7,py-2-as,3,7);
    ctx.fillStyle="#fcd5a0";ctx.beginPath();ctx.arc(x-8,py+5+as,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+8,py+5-as,2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fcd5a0";ctx.fillRect(x-2,py-5,4,4);ctx.beginPath();ctx.arc(x,py-9,6.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#78350f";ctx.beginPath();ctx.arc(x,py-10,6,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(x-6,py-11,12,4);
    ctx.beginPath();ctx.arc(x+3,py-15,2.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#1e293b";ctx.beginPath();ctx.arc(x-2,py-8,1.1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+2,py-8,1.1,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

function drawFloatsIso(ctx,floats,tick,canvasW,cam) {
  ctx.textAlign="center";
  for(const f of floats){
    const age=tick-f.tick;if(age>45)continue;
    const {x,y}=isoProject(f.col,f.row,canvasW,cam);
    ctx.globalAlpha=Math.max(0,1-age/45);ctx.fillStyle=f.color;
    ctx.font="bold 11px Georgia,serif";ctx.fillText(f.text,x,y-TH*2-20-age*0.5);
  }
  ctx.globalAlpha=1;ctx.textAlign="left";
}

// ─── Battle components ────────────────────────────────────────────────────────
function BattleSprite({creature,size=90,flipped=false,shake=false}){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const ctx=c.getContext("2d");ctx.clearRect(0,0,size,size);
    const cx=size/2,cy=size/2+8,r=size*0.3*creature.dna.size,dna=creature.dna;
    if(flipped){ctx.save();ctx.translate(size,0);ctx.scale(-1,1);}
    ctx.globalAlpha=0.2;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(cx,cy+r+4,r*0.9,r*0.3,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle=dnaColor(dna,55);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=dnaColor(dna,40);ctx.lineWidth=r*0.22;ctx.beginPath();ctx.arc(cx,cy,r*0.6,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=dnaColor(dna,70,0.5);
    for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2+dna.hue*0.017;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r*0.45,cy+Math.sin(a)*r*0.45,r*0.18,0,Math.PI*2);ctx.fill();}
    const eo=r*0.35;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(cx-eo,cy-r*0.12,r*0.22,0,Math.PI*2);ctx.arc(cx+eo,cy-r*0.12,r*0.22,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#111";ctx.beginPath();ctx.arc(cx-eo+1,cy-r*0.12,r*0.13,0,Math.PI*2);ctx.arc(cx+eo+1,cy-r*0.12,r*0.13,0,Math.PI*2);ctx.fill();
    if(flipped)ctx.restore();
  },[creature,size,flipped]);
  return <canvas ref={ref} width={size} height={size} style={{imageRendering:"pixelated",filter:shake?"brightness(1.6) saturate(1.5)":"none",transition:"filter 0.08s"}}/>;
}

function HpBar({current,max,label,level}){
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

function StatusBadge({status}){
  if(!status)return null;
  const map={burn:["🔥","#f97316"],poison:["☠️","#a855f7"],paralyze:["⚡","#eab308"],freeze:["🧊","#38bdf8"]};
  const[icon,color]=map[status]||["?","#888"];
  return <span style={{background:color+"33",border:`1px solid ${color}`,borderRadius:4,padding:"1px 5px",fontSize:10,color}}>{icon} {status}</span>;
}

function BattleScreen({playerCreature,wildCreature,onEnd,onCapture,battleInventory,onSwapToFront,onSaveBattleHp}){
  const[phase,setPhase]=useState("player_turn");
  const[player,setPlayer]=useState(()=>makeBattler(playerCreature));
  const[enemy,setEnemy]=useState(()=>makeBattler(wildCreature));
  const[activeCreature,setActiveCreature]=useState(playerCreature); // tracks sprite
  const[log,setLog]=useState(["A wild Lv"+(wildCreature.level||1)+" creature appeared!"]);
  const[shakeP,setShakeP]=useState(false);
  const[shakeE,setShakeE]=useState(false);
  const[pending,setPending]=useState(null);
  const[showSwap,setShowSwap]=useState(false);
  const[participantIds,setParticipantIds]=useState(new Set([playerCreature.id])); // for XP split
  const logRef=useRef(null);
  const playerRef=useRef(player);
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
        const p=playerRef.current, e=enemyRef.current;
        if(e.battleHp<=0) setTimeout(()=>endBattle("win",p,e),300);
        else if(p.battleHp<=0){
          const remaining=(battleInventory||[]).filter((_,i)=>i>0&&battleInventory[i]&&(battleInventory[i].hp||0)>0.05);
          if(remaining.length>0) setPhase("forced_swap");
          else setTimeout(()=>endBattle("loss",p,e),300);
        }
        else setPhase("player_turn");
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
      setTimeout(()=>onEnd("win",{...fp,xp:nxp,level:nl,moves:nm,hp:fp.battleHp/fp.maxHp},participantIds),lu?1800:1200);
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
    if(phase!=="player_turn")return;
    setPhase("message");
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
    // We need to delay enemy turn until items drain — encode it as a callback on last item
    const lastItem=items[items.length-1];
    items[items.length-1]={
      ...lastItem,
      applyState:()=>{
        if(lastItem.applyState) lastItem.applyState();
        // Fire enemy turn after a short pause post-last-message
        setTimeout(()=>doEnemyTurn(currentEnemy,playerAfterMove,[]),300);
      }
    };
    setPending(items);
  }

  function tryCapture(){
    if(phase!=="player_turn")return;
    setPhase("message");
    const ch=Math.min(0.95,Math.max(0.05,0.05+(1-enemy.battleHp/enemy.maxHp)*0.947));
    const pct=Math.round(ch*100);
    if(Math.random()<ch){
      setPending([{msg:"Threw a catch... Caught! ("+pct+"% chance)"}]);
      setTimeout(()=>onCapture({...wildCreature,hp:enemy.battleHp/enemy.maxHp,level:enemy.level},{battleHp:player.battleHp,maxHp:player.maxHp}),1400);
    } else {
      const{b:eAfter}=applyEndOfTurn(enemy);
      doEnemyTurn(eAfter,player,[{msg:"Threw a catch... Escaped! ("+pct+"%) — weaken more!"}]);
    }
  }

  function handleSwap(idx){
    if(phase!=="player_turn")return;
    if(idx===0)return;
    setShowSwap(false);
    setPhase("message");
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
          <HpBar current={enemy.battleHp} max={enemy.maxHp} label="Wild" level={enemy.level}/>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <StatusBadge status={enemy.status}/>
            <BattleSprite creature={wildCreature} size={88} flipped={true} shake={shakeE}/>
          </div>
        </div>
        <div style={{textAlign:"center",color:"rgba(255,255,255,0.07)",fontSize:26,letterSpacing:8}}>— vs —</div>
        <div style={{display:"flex",justifyContent:"flex-start",alignItems:"flex-end",gap:12}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <StatusBadge status={player.status}/>
            <BattleSprite creature={activeCreature} size={88} shake={shakeP}/>
          </div>
          <HpBar current={player.battleHp} max={player.maxHp} label="Yours" level={player.level}/>
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
                  onTouchStart={e=>{e.preventDefault();e.stopPropagation();handleMove(move);}}
                  onMouseDown={()=>handleMove(move)}
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
              <button onTouchStart={e=>{e.preventDefault();e.stopPropagation();tryCapture();}} onMouseDown={tryCapture} onContextMenu={e=>e.preventDefault()}
                style={{...btnStyle,background:"rgba(251,191,36,0.15)",border:"1.5px solid rgba(251,191,36,0.5)",borderRadius:8,padding:"7px 4px",color:"#fbbf24",fontSize:11}}>
                ⚡ CATCH<br/><span style={{fontSize:9,opacity:0.8}}>({catchPct}%)</span>
              </button>
              <button onTouchStart={e=>{e.preventDefault();e.stopPropagation();setShowSwap(true);}} onMouseDown={()=>setShowSwap(true)} onContextMenu={e=>e.preventDefault()}
                style={{...btnStyle,background:"rgba(96,165,250,0.15)",border:"1.5px solid rgba(96,165,250,0.4)",borderRadius:8,padding:"7px 4px",color:"#60a5fa",fontSize:11}}>
                🔄 SWAP<br/><span style={{fontSize:9,opacity:0.8}}>(costs turn)</span>
              </button>
              <button onTouchStart={e=>{e.preventDefault();e.stopPropagation();onEnd("flee",{...player,hp:player.battleHp/player.maxHp});}} onMouseDown={()=>onEnd("flee",{...player,hp:player.battleHp/player.maxHp})} onContextMenu={e=>e.preventDefault()}
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
                if(i===0||!c||(c.hp||0)<=0.05)return null;
                return(
                  <button key={i}
                    onTouchStart={e=>{e.preventDefault();e.stopPropagation();
                      onSwapToFront(i);
                      const inc=battleInventory[i];
                      const nb=makeBattler(inc);
                      setPlayer(nb);setActiveCreature(inc);
                      setParticipantIds(prev=>new Set([...prev,inc.id]));
                      setPhase("player_turn");
                      setLog(l=>[...l,"Go, new creature!"]);
                    }}
                    onMouseDown={()=>{
                      onSwapToFront(i);
                      const inc=battleInventory[i];
                      const nb=makeBattler(inc);
                      setPlayer(nb);setActiveCreature(inc);
                      setParticipantIds(prev=>new Set([...prev,inc.id]));
                      setPhase("player_turn");
                      setLog(l=>[...l,"Go, new creature!"]);
                    }}
                    onContextMenu={e=>e.preventDefault()}
                    style={{...btnStyle,background:dnaColor(c.dna,15),border:`1.5px solid ${dnaColor(c.dna,35)}`,borderRadius:8,padding:"6px 10px",color:"#e2e8f0",fontSize:11}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:dnaColor(c.dna,55)}}/>
                      <span>Lv{c.level||1}</span>
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
              {(battleInventory||[]).map((c,i)=>(
                <button key={i}
                  onTouchStart={e=>{e.preventDefault();e.stopPropagation();handleSwap(i);}}
                  onMouseDown={()=>handleSwap(i)}
                  onContextMenu={e=>e.preventDefault()}
                  style={{...btnStyle,background:i===0?"rgba(255,255,255,0.05)":dnaColor(c.dna,15),border:`1.5px solid ${i===0?"#333":dnaColor(c.dna,35)}`,borderRadius:8,padding:"6px 10px",color:i===0?"#475569":"#e2e8f0",fontSize:11,opacity:i===0?0.5:1,cursor:i===0?"default":"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:dnaColor(c.dna,55),flexShrink:0}}/>
                    <span>Lv{c.level||1}</span>
                    {i===0&&<span style={{fontSize:9,color:"#475569"}}>(active)</span>}
                  </div>
                  <div style={{width:50,height:3,background:"#222",borderRadius:2,marginTop:3}}>
                    <div style={{width:`${(c.hp||0)*100}%`,height:"100%",background:c.hp>.5?"#4ade80":"#f87171",borderRadius:2}}/>
                  </div>
                </button>
              ))}
            </div>
            <button onTouchStart={e=>{e.preventDefault();e.stopPropagation();setShowSwap(false);}} onMouseDown={()=>setShowSwap(false)} onContextMenu={e=>e.preventDefault()}
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

// ─── Analog Joystick ──────────────────────────────────────────────────────────
// Maps 360° touch input to isometric axes:
//   screen up-left  → grid col--, row-- (iso "up")
//   screen up-right → grid col++, row-- (iso "right")
// The iso grid is rotated 45°, so we rotate input by -45° to align with grid axes.
function DPad({inputRef}){
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
    // Rotate -45° to align screen axes with isometric grid axes
    const angle=Math.atan2(ry,rx)-Math.PI/4;
    const mag=clamped/maxR;
    const DEAD=0.15;
    const dx=Math.abs(Math.cos(angle)*mag)>DEAD?Math.cos(angle)*mag:0;
    const dy=Math.abs(Math.sin(angle)*mag)>DEAD?Math.sin(angle)*mag:0;
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
      {[["↖","up-left",-1,-1],["↗","up-right",1,-1],["↙","dn-left",-1,1],["↘","dn-right",1,1]].map(([label,key,dx,dy])=>(
        <div key={key} style={{position:"absolute",left:center+dx*(maxR*0.65)-10,top:center+dy*(maxR*0.65)-10,width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(200,230,160,0.25)",fontSize:14,pointerEvents:"none"}}>{label}</div>
      ))}
      {/* Knob */}
      <div style={{position:"absolute",left:center+knob.x-20,top:center+knob.y-20,width:40,height:40,borderRadius:"50%",background:knob.active?"rgba(200,230,160,0.35)":"rgba(200,230,160,0.15)",border:`2px solid rgba(200,230,160,${knob.active?0.7:0.3})`,transition:knob.active?"none":"left 0.1s, top 0.1s",pointerEvents:"none",boxShadow:knob.active?"0 0 12px rgba(200,230,160,0.3)":"none"}}/>
    </div>
  );
}

// ─── Map Editor ───────────────────────────────────────────────────────────────
function MapEditor({onDone}){
  const canvasRef=useRef(null);
  const containerRef=useRef(null);
  const[map,setMap]=useState(makeDefaultMap);
  const[selectedTile,setSelectedTile]=useState("grass");
  const[painting,setPainting]=useState(false);
  const[canvasSize,setCanvasSize]=useState({w:300,h:200,cell:12});

  // Measure container and compute cell size to fill it exactly
  useEffect(()=>{
    function measure(){
      if(!containerRef.current)return;
      const rect=containerRef.current.getBoundingClientRect();
      const w=Math.floor(rect.width); // available width
      const h=Math.floor(rect.height);// available height
      // Cell size that fits all columns in width, all rows in height — take min
      const cellW=Math.floor(w/COLS);
      const cellH=Math.floor(h/ROWS);
      const cell=Math.max(8,Math.min(cellW,cellH));
      setCanvasSize({w:cell*COLS,h:cell*ROWS,cell});
    }
    measure();
    window.addEventListener("resize",measure);
    return()=>window.removeEventListener("resize",measure);
  },[]);

  // Convert event coords to grid cell, accounting for actual canvas pixel size vs display size
  function getCell(e){
    const canvas=canvasRef.current;if(!canvas)return null;
    const rect=canvas.getBoundingClientRect();
    // rect gives CSS display size; canvas.width/height is actual pixel size
    const scaleX=canvas.width/rect.width;
    const scaleY=canvas.height/rect.height;
    const clientX=e.clientX||(e.touches&&e.touches[0]?.clientX)||0;
    const clientY=e.clientY||(e.touches&&e.touches[0]?.clientY)||0;
    const px=(clientX-rect.left)*scaleX;
    const py=(clientY-rect.top)*scaleY;
    const col=Math.floor(px/canvasSize.cell);
    const row=Math.floor(py/canvasSize.cell);
    if(col<0||col>=COLS||row<0||row>=ROWS)return null;
    return{col,row};
  }

  function paint(e){
    const cell=getCell(e);
    if(!cell)return;
    setMap(m=>{const nm=m.map(r=>[...r]);nm[cell.row][cell.col]=selectedTile;return nm;});
  }

  // Draw grid
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const {w,h,cell}=canvasSize;
    canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#1a1a1a"; ctx.fillRect(0,0,w,h);
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const t=TILES[map[r][c]]||TILES.grass;
        const x=c*cell, y=r*cell;
        ctx.fillStyle=t.topColor;
        ctx.fillRect(x+1,y+1,cell-2,cell-2);
        ctx.strokeStyle="rgba(0,0,0,0.3)"; ctx.lineWidth=1;
        ctx.strokeRect(x,y,cell,cell);
        if(cell>=14){
          ctx.font=`${Math.floor(cell*0.55)}px serif`;
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(t.emoji,x+cell/2,y+cell/2);
        }
      }
    }
    ctx.textAlign="left"; ctx.textBaseline="alphabetic";
  },[map,canvasSize]);

  return(
    <div style={{position:"fixed",inset:0,background:"#111",display:"flex",flexDirection:"column",zIndex:300,fontFamily:"Georgia,serif",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"}}>
      {/* Header */}
      <div style={{padding:"10px 14px",borderBottom:"1px solid #222",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <span style={{color:"#c8e6a0",fontSize:14,letterSpacing:"0.1em",textTransform:"uppercase"}}>🗺 Map Editor</span>
        <button
          onTouchStart={e=>{e.preventDefault();e.stopPropagation();setMap(makeRandomMap());}}
          onClick={()=>setMap(makeRandomMap())}
          onContextMenu={e=>e.preventDefault()}
          style={{marginLeft:"auto",background:"rgba(100,116,139,0.15)",border:"1.5px solid rgba(100,116,139,0.3)",borderRadius:8,color:"#94a3b8",padding:"7px 12px",fontFamily:"Georgia,serif",fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"}}>
          🎲 Random
        </button>
        <button
          onTouchStart={e=>{e.preventDefault();e.stopPropagation();onDone(map);}}
          onClick={()=>onDone(map)}
          onContextMenu={e=>e.preventDefault()}
          style={{background:"rgba(200,230,160,0.15)",border:"1.5px solid rgba(200,230,160,0.4)",borderRadius:8,color:"#c8e6a0",padding:"7px 14px",fontFamily:"Georgia,serif",fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"}}>
          ✓ Enter World
        </button>
      </div>

      {/* Tile palette */}
      <div style={{display:"flex",gap:5,padding:"8px 12px",flexWrap:"wrap",flexShrink:0,borderBottom:"1px solid #1a1a1a",touchAction:"none"}}>
        {TILE_IDS.map(id=>{
          const t=TILES[id];
          const sel=selectedTile===id;
          return(
            <button key={id}
              onTouchStart={e=>{e.preventDefault();e.stopPropagation();setSelectedTile(id);}}
              onClick={()=>setSelectedTile(id)}
              onContextMenu={e=>e.preventDefault()}
              style={{background:sel?t.topColor+"cc":"rgba(255,255,255,0.06)",border:`2px solid ${sel?t.topColor:"#2a2a2a"}`,borderRadius:8,padding:"5px 9px",color:sel?"#fff":"#888",fontFamily:"Georgia,serif",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4,WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none",flexShrink:0}}>
              <span style={{fontSize:15}}>{t.emoji}</span>{t.label}
            </button>
          );
        })}
      </div>

      {/* Canvas fills remaining space exactly */}
      <div ref={containerRef} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",touchAction:"none"}}>
        <canvas ref={canvasRef}
          style={{display:"block",cursor:"crosshair",touchAction:"none",imageRendering:"pixelated"}}
          onMouseDown={e=>{setPainting(true);paint(e);}}
          onMouseMove={e=>{if(painting)paint(e);}}
          onMouseUp={()=>setPainting(false)}
          onMouseLeave={()=>setPainting(false)}
          onTouchStart={e=>{e.preventDefault();e.stopPropagation();setPainting(true);paint(e);}}
          onTouchMove={e=>{e.preventDefault();e.stopPropagation();if(painting)paint(e);}}
          onTouchEnd={e=>{e.preventDefault();e.stopPropagation();setPainting(false);}}
          onContextMenu={e=>e.preventDefault()}
        />
      </div>
      <div style={{color:"#2a3a1a",fontSize:11,textAlign:"center",padding:"6px",flexShrink:0}}>tap or drag to paint · selected: <span style={{color:"#c8e6a0"}}>{TILES[selectedTile].emoji} {TILES[selectedTile].label}</span></div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Homebase(){
  const canvasRef=useRef(null);
  const stateRef=useRef(null);
  const tickRef=useRef(0);
  const animRef=useRef(null);
  const lastTickRef=useRef(0);
  const groundRef=useRef(null); // pre-rendered map canvas
  const pausedRef=useRef(false);
  const inputRef=useRef({dx:0,dy:0,capturePressed:false,fightPressed:false});
  const battleRef=useRef(null);

  const[saveInfo,setSaveInfo]=useState(()=>readSave());
  const[screen,setScreen]=useState(()=>readSave()?"title":"editor"); // title | editor | game | gameover
  const[mapData,setMapData]=useState(null);
  const mapRef=useRef(null);
  const[lastSaved,setLastSaved]=useState(0);
  const[confirmNew,setConfirmNew]=useState(false);

  // Write the current world to this browser's storage
  const saveNow=useCallback(()=>{
    if(!mapRef.current||!stateRef.current) return;
    if(!stateRef.current.inventory.length) return; // nothing worth resuming
    const d=writeSave(mapRef.current,stateRef.current,tickRef.current);
    if(d){ setSaveInfo(d); setLastSaved(Date.now()); }
  },[]);

  // Resume a saved world
  const continueGame=useCallback(()=>{
    const d=readSave(); if(!d) { setScreen("editor"); return; }
    mapRef.current=d.map; setMapData(d.map);
    stateRef.current={...d.state,events:[],floats:[]};
    tickRef.current=d.tick||0;
    const maxId=[...d.state.creatures,...d.state.plants,...d.state.inventory].reduce((m,e)=>Math.max(m,e.id||0),0);
    nextId=Math.max(d.nextId||1,maxId+1);
    setUiState(u=>({...u,creatures:d.state.creatures.length,plants:d.state.plants.length,tick:tickRef.current,inventory:d.state.inventory}));
    setScreen("game");
  },[]);

  // Save when the tab is hidden or closed
  useEffect(()=>{
    const onHide=()=>{ if(document.visibilityState==="hidden") saveNow(); };
    document.addEventListener("visibilitychange",onHide);
    window.addEventListener("pagehide",saveNow);
    return()=>{document.removeEventListener("visibilitychange",onHide);window.removeEventListener("pagehide",saveNow);};
  },[saveNow]);
  const[dims,setDims]=useState({W:390,H:320});
  const[uiState,setUiState]=useState({creatures:0,plants:0,tick:0,inventory:[],paused:false});
  const[battle,setBattle]=useState(null);
  const[showBag,setShowBag]=useState(false);
  const[selectedInv,setSelectedInv]=useState(null);

  // Block selection
  useEffect(()=>{
    const kill=e=>e.preventDefault();
    const killTs=e=>{if(!e.target.closest("button")&&e.target.tagName.toLowerCase()!=="canvas")e.preventDefault();};
    document.addEventListener("selectstart",kill);
    document.addEventListener("contextmenu",kill);
    document.addEventListener("touchstart",killTs,{passive:false});
    return()=>{document.removeEventListener("selectstart",kill);document.removeEventListener("contextmenu",kill);document.removeEventListener("touchstart",killTs);};
  },[]);

  // Measure
  useEffect(()=>{
    const CTRL=214,TOP=36;
    const measure=()=>setDims({W:window.innerWidth,H:Math.max(160,window.innerHeight-CTRL-TOP-8)});
    measure();
    window.addEventListener("resize",measure);
    return()=>window.removeEventListener("resize",measure);
  },[]);

  // Render map to offscreen canvas
  function renderMap(map,W,H){
    const gc=document.createElement("canvas"); gc.width=W; gc.height=H;
    const ctx=gc.getContext("2d");
    ctx.fillStyle="#1a1a1a"; ctx.fillRect(0,0,W,H);
    // Draw in painter's order: row+col ascending
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) drawIsoTile(ctx,c,r,map[r][c],W);
    return gc;
  }

  // Start game after editor
  const handleMapDone=useCallback((map)=>{
    mapRef.current=map;
    setMapData(map);
    setScreen("game");
    const W=window.innerWidth, H=Math.max(160,window.innerHeight-214-36-8);
    // Make starter creature
    const starterDNA=randomDNA();
    const sc=Math.floor(COLS/2), sr=Math.floor(ROWS/2);
    const starter={...makeCreature(sc,sr,starterDNA),level:1,hp:1.0};
    // Spawn wild creatures (avoid impassable tiles)
    const wildCreatures=[];
    let tries=0;
    while(wildCreatures.length<20&&tries++<400){
      const c=Math.floor(Math.random()*COLS), r=Math.floor(Math.random()*ROWS);
      if(TILES[map[r][c]]?.passable&&Math.hypot(c-sc,r-sr)>4) wildCreatures.push(makeCreature(c,r));
    }
    const wildPlants=[];
    tries=0;
    while(wildPlants.length<15&&tries++<200){
      const c=Math.floor(Math.random()*COLS), r=Math.floor(Math.random()*ROWS);
      if(TILES[map[r][c]]?.passable) wildPlants.push(makePlant(c,r));
    }
    stateRef.current={
      creatures:wildCreatures, plants:wildPlants,
      player:makePlayer(map),
      inventory:[starter], events:[], floats:[], tick:0,
    };
    tickRef.current=0;
    setUiState(u=>({...u,inventory:[starter]}));
    saveNow();
  },[saveNow]);

  // Camera-based rendering — no pre-render needed

  // Game loop
  useEffect(()=>{
    if(screen!=="game")return;
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d");
    const loop=ts=>{
      animRef.current=requestAnimationFrame(loop);
      if(!stateRef.current)return;
      if(ts-lastTickRef.current<TICK_MS)return;
      lastTickRef.current=ts;
      if(!pausedRef.current&&!battle){
        tickRef.current++;
        stateRef.current=simulate(stateRef.current,tickRef.current,inputRef,mapData,dims.W);
        // Check fight button press
        if(inputRef.current.fightPressed){
          inputRef.current.fightPressed=false;
          const s=stateRef.current;
          const {col:pc2,row:pr2}=s.player;
          const wild=s.creatures.filter(c=>!c.dead).reduce((best,c)=>{
            const d=Math.hypot(c.col-pc2,c.row-pr2);
            return (!best||d<best.d)?{c,d}:best;
          },null);
          if(wild&&wild.d<4){
            const inv=s.inventory;
            if(inv.length>0){const b={playerCreature:inv[0],wildCreature:wild.c};battleRef.current=b;setBattle(b);}
            else{const starter=makeCreature(pc2,pr2);starter.level=1;starter.moves=deriveMoves(starter.dna);const b={playerCreature:starter,wildCreature:wild.c,isStarter:true};battleRef.current=b;setBattle(b);}
          } else {
            // No creature in range — show float
            stateRef.current={...s,floats:[...s.floats,{id:nextId++,col:s.player.col,row:s.player.row,text:"No creature nearby!",color:"#f87171",tick:tickRef.current}]};
          }
        }
        if(tickRef.current%100===0) saveNow();
        if(tickRef.current%6===0) setUiState(u=>({...u,creatures:stateRef.current.creatures.length,plants:stateRef.current.plants.length,tick:tickRef.current,inventory:stateRef.current.inventory}));
      }
      // Draw
      const s=stateRef.current;
      const W=dims.W, H=dims.H;
      // Camera: keep player centered on screen
      // Player screen pos without camera: isoProject(col,row,W,{x:0,y:0})
      const rawPx=W*ISO_ORIGIN_X_FRAC+(s.player.col-s.player.row)*TW;
      const rawPy=ISO_ORIGIN_Y+(s.player.col+s.player.row)*TH;
      const cam={x:rawPx-W/2, y:rawPy-H/2};
      // Render map tiles with camera
      ctx.fillStyle="#1a1a1a"; ctx.fillRect(0,0,W,H);
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) drawIsoTile(ctx,c,r,mapData[r][c],W,false,cam);
      // Sort by row+col for painter's order
      const allEntities=[...s.plants,...s.creatures].sort((a,b)=>(a.row+a.col)-(b.row+b.col));
      for(const e of allEntities){
        if(e.type==="plant") drawPlantIso(ctx,e,W,cam);
        else drawCreatureIso(ctx,e,tickRef.current,W,cam);
      }
      drawPlayerIso(ctx,s.player,tickRef.current,W,cam);
      drawFloatsIso(ctx,s.floats,tickRef.current,W,cam);
    };
    animRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(animRef.current);
  },[screen,battle,dims,mapData]);

  const togglePause=useCallback(()=>{pausedRef.current=!pausedRef.current;setUiState(u=>({...u,paused:!u.paused}));},[]);
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
    if(inv[idx]) inv[idx]={...inv[idx],battleHp,maxHp};
    stateRef.current={...s,inventory:inv};
  },[]);

  const handleBattleEnd=useCallback((result,finalCreature)=>{
    const wasStarter=battleRef.current&&battleRef.current.isStarter;
    setBattle(null); battleRef.current=null;
    if(!stateRef.current)return;
    const s=stateRef.current;
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
    const playerBack={...s.inventory[0], hp:endHp, battleHp:null};
    const newInv=s.inventory.length<INVENTORY_MAX
      ?[playerBack,...s.inventory.slice(1),{...capturedWild,moves:capturedWild.moves||deriveMoves(capturedWild.dna)}]
      :[playerBack,...s.inventory.slice(1)];
    stateRef.current={...s,inventory:newInv,creatures:s.creatures.map(c=>c.id===capturedWild.id?{...c,dead:true,deathReason:"captured"}:c)};
    setUiState(u=>({...u,inventory:stateRef.current.inventory}));
    saveNow();
  },[saveNow]);

  const elapsed=Math.floor(uiState.tick*TICK_MS/1000);
  const timeStr=`${Math.floor(elapsed/60).toString().padStart(2,"0")}:${(elapsed%60).toString().padStart(2,"0")}`;
  const btnBase={background:"rgba(200,230,160,0.09)",border:"1.5px solid rgba(200,230,160,0.2)",borderRadius:10,color:"#c8e6a0",fontFamily:"Georgia,serif",fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:4};

  if(screen==="title"&&saveInfo){
    const inv=saveInfo.state.inventory;
    const topLv=inv.reduce((m,c)=>Math.max(m,c.level||1),1);
    const secs=Math.floor((saveInfo.tick||0)*TICK_MS/1000);
    const played=secs>=3600?Math.floor(secs/3600)+"h "+Math.floor((secs%3600)/60)+"m":Math.floor(secs/60)+"m "+(secs%60)+"s";
    const tBtn={width:"100%",borderRadius:10,padding:"13px",fontFamily:"Georgia,serif",fontSize:15,cursor:"pointer",letterSpacing:"0.06em",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",userSelect:"none",WebkitUserSelect:"none"};
    const startNew=()=>{ if(!confirmNew){setConfirmNew(true);return;} clearSave(); setSaveInfo(null); setConfirmNew(false); setScreen("editor"); };
    return(
      <div style={{position:"fixed",inset:0,background:"#0e0e0e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",gap:22,padding:"24px max(20px, env(safe-area-inset-right, 0px)) 24px max(20px, env(safe-area-inset-left, 0px))"}}>
        <div style={{color:"#c8e6a0",fontSize:28,letterSpacing:"0.22em",textTransform:"uppercase"}}>Homebase</div>
        <div style={{width:"100%",maxWidth:300,boxSizing:"border-box",background:"#141414",border:"1px solid #232a1c",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{color:"#4a6a32",fontSize:10,letterSpacing:"0.14em",textTransform:"uppercase"}}>Saved world · {timeAgo(saveInfo.savedAt)}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {inv.slice(0,INVENTORY_MAX).map(c=>(
              <div key={c.id} title={"Lv"+(c.level||1)} style={{width:26,height:26,borderRadius:"50%",background:dnaColor(c.dna,55),boxShadow:"0 0 8px "+dnaColor(c.dna,55,0.4),display:"flex",alignItems:"center",justifyContent:"center",color:"#0e0e0e",fontSize:9,fontWeight:"bold"}}>{c.level||1}</div>
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

  if(screen==="editor") return <MapEditor onDone={handleMapDone}/>;

  if(screen==="gameover") return (
    <div style={{position:"fixed",inset:0,background:"#0a0a0a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",gap:24,zIndex:500}}>
      <div style={{fontSize:48}}>💀</div>
      <div style={{color:"#f87171",fontSize:22,letterSpacing:"0.12em",textTransform:"uppercase"}}>All Creatures Fainted</div>
      <div style={{color:"#3a3a3a",fontSize:13,textAlign:"center",maxWidth:260,lineHeight:1.7}}>
        Your team has fallen. Return to the world and rebuild from scratch.
      </div>
      <div style={{display:"flex",gap:12,flexDirection:"column",alignItems:"center",width:"100%",maxWidth:260}}>
        <button
          onTouchStart={e=>{e.preventDefault();e.stopPropagation();setScreen("editor");setMapData(null);}}
          onClick={()=>{setScreen("editor");setMapData(null);}}
          onContextMenu={e=>e.preventDefault()}
          style={{width:"100%",background:"rgba(248,113,113,0.15)",border:"1.5px solid rgba(248,113,113,0.4)",borderRadius:10,color:"#f87171",padding:"12px",fontFamily:"Georgia,serif",fontSize:14,cursor:"pointer",letterSpacing:"0.06em",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"}}>
          🗺 Rebuild Homebase
        </button>
        <button
          onTouchStart={e=>{e.preventDefault();e.stopPropagation();
            // Keep the map, just restart with a new starter
            if(mapData){
              const starterDNA=randomDNA();
              const sc=Math.floor(COLS/2),sr=Math.floor(ROWS/2);
              const starter={...makeCreature(sc,sr,starterDNA),level:1,hp:1.0};
              stateRef.current={...stateRef.current,inventory:[starter],player:makePlayer(mapData)};
              setUiState(u=>({...u,inventory:[starter]}));
              setScreen("game");
              setTimeout(saveNow,0);
            }
          }}
          onClick={()=>{
            if(mapData){
              const starterDNA=randomDNA();
              const sc=Math.floor(COLS/2),sr=Math.floor(ROWS/2);
              const starter={...makeCreature(sc,sr,starterDNA),level:1,hp:1.0};
              stateRef.current={...stateRef.current,inventory:[starter],player:makePlayer(mapData)};
              setUiState(u=>({...u,inventory:[starter]}));
              setScreen("game");
              setTimeout(saveNow,0);
            }
          }}
          onContextMenu={e=>e.preventDefault()}
          style={{width:"100%",background:"rgba(200,230,160,0.09)",border:"1.5px solid rgba(200,230,160,0.2)",borderRadius:10,color:"#c8e6a0",padding:"12px",fontFamily:"Georgia,serif",fontSize:14,cursor:"pointer",letterSpacing:"0.06em",WebkitTapHighlightColor:"transparent",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"}}>
          🌱 Try Again (same map)
        </button>
      </div>
    </div>
  );

  return(
    <div style={{background:"#0e0e0e",height:"100%",width:"100vw",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"Georgia,serif",userSelect:"none",touchAction:"none"}}>
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

      {/* Canvas */}
      <div style={{position:"relative",flexShrink:0}}>
        <canvas ref={canvasRef} width={dims.W} height={dims.H} style={{display:"block",width:"100%",height:dims.H}}/>
        {uiState.paused&&!battle&&(
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#c8e6a0",fontSize:22,letterSpacing:"0.22em",textTransform:"uppercase"}}>Paused</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{flex:1,background:"rgba(0,0,0,0.55)",borderTop:"1px solid rgba(200,230,160,0.08)",display:"flex",flexDirection:"column",padding:"8px max(12px, env(safe-area-inset-right, 0px)) max(28px, calc(env(safe-area-inset-bottom, 0px) + 12px)) max(12px, env(safe-area-inset-left, 0px))",gap:8,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flex:1}}>
          <DPad inputRef={inputRef}/>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <div style={{display:"flex",gap:8}}>
              <button onTouchStart={e=>{e.preventDefault();e.stopPropagation();handleFight();}} onMouseDown={handleFight} onContextMenu={e=>e.preventDefault()}
                style={{...btnBase,width:70,height:52,background:"rgba(239,68,68,0.15)",border:"2px solid rgba(239,68,68,0.45)",color:"#f87171",fontWeight:"bold",borderRadius:14,flexDirection:"column",gap:2}}>
                <span style={{fontSize:18}}>⚔️</span><span style={{fontSize:10}}>FIGHT</span>
              </button>
              <button onTouchStart={e=>{e.preventDefault();e.stopPropagation();handleCapture();}} onMouseDown={handleCapture} onContextMenu={e=>e.preventDefault()}
                style={{...btnBase,width:70,height:52,background:"rgba(251,191,36,0.15)",border:"2px solid rgba(251,191,36,0.45)",color:"#fbbf24",fontWeight:"bold",borderRadius:14,flexDirection:"column",gap:2}}>
                <span style={{fontSize:18}}>⚡</span><span style={{fontSize:10}}>CATCH</span>
              </button>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onTouchStart={e=>{e.preventDefault();e.stopPropagation();setShowBag(p=>!p);setSelectedInv(null);}} onClick={()=>{setShowBag(p=>!p);setSelectedInv(null);}} onContextMenu={e=>e.preventDefault()}
                style={{...btnBase,width:58,height:40,flexDirection:"column",gap:1}}>
                <span style={{fontSize:14}}>🎒</span><span style={{fontSize:9,color:"#86efac"}}>{uiState.inventory.length}/{INVENTORY_MAX}</span>
              </button>
              <button onTouchStart={e=>{e.preventDefault();e.stopPropagation();togglePause();}} onClick={togglePause} onContextMenu={e=>e.preventDefault()}
                style={{...btnBase,width:58,height:40}}>
                {uiState.paused?"▶":"⏸"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bag overlay */}
      {showBag&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:100,display:"flex",flexDirection:"column",overflow:"auto",touchAction:"pan-y"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 10px"}}>
            <span style={{color:"#c8e6a0",fontSize:15,letterSpacing:"0.12em",textTransform:"uppercase"}}>🎒 Bag <span style={{color:"#3a5228",fontSize:11}}>{uiState.inventory.length}/{INVENTORY_MAX}</span></span>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {selectedInv!==null&&<span style={{color:"#60a5fa",fontSize:11}}>tap another to swap</span>}
              <button onTouchStart={e=>{e.preventDefault();e.stopPropagation();setShowBag(false);setSelectedInv(null);}} onClick={()=>{setShowBag(false);setSelectedInv(null);}} onContextMenu={e=>e.preventDefault()}
                style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#94a3b8",fontSize:18,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"none",userSelect:"none",WebkitUserSelect:"none",WebkitTapHighlightColor:"transparent"}}>✕</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"0 16px",maxWidth:400,width:"100%",alignSelf:"center"}}>
            {Array.from({length:INVENTORY_MAX}).map((_,i)=>{
              const c=uiState.inventory[i]; const isSel=selectedInv===i;
              return(
                <div key={i}
                  onTouchStart={e=>{e.preventDefault();e.stopPropagation();if(!c)return;if(selectedInv===null){setSelectedInv(i);}else if(selectedInv===i){setSelectedInv(null);}else{// Swap the two slots
                    const s=stateRef.current;if(!s)return;
                    const inv=[...s.inventory];const tmp=inv[selectedInv];inv[selectedInv]=inv[i];inv[i]=tmp;
                    stateRef.current={...s,inventory:inv};setUiState(u=>({...u,inventory:inv}));setSelectedInv(null);}}}
                  onClick={()=>{if(!c)return;if(selectedInv===null){setSelectedInv(i);}else if(selectedInv===i){setSelectedInv(null);}else{const s=stateRef.current;if(!s)return;const inv=[...s.inventory];const tmp=inv[selectedInv];inv[selectedInv]=inv[i];inv[i]=tmp;stateRef.current={...s,inventory:inv};setUiState(u=>({...u,inventory:inv}));setSelectedInv(null);}}}
                  onContextMenu={e=>e.preventDefault()}
                  style={{aspectRatio:"1",borderRadius:10,background:c?dnaColor(c.dna,10):"#141414",border:`2px solid ${isSel?"#fbbf24":c?dnaColor(c.dna,30):"#1e1e1e"}`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",cursor:c?"pointer":"default",touchAction:"none",userSelect:"none",WebkitUserSelect:"none",boxShadow:isSel?`0 0 12px ${dnaColor(c&&c.dna,55,0.4)}`:"none"}}>
                  {c&&(()=>{
                    // Check if compatible with any other bag creature
                    const compatible = uiState.inventory.some((o,oi) => oi!==i && o &&
                      (o.level||1)>=BREED_MIN_LEVEL && (c.level||1)>=BREED_MIN_LEVEL &&
                      Math.abs((((c.dna.hue-o.dna.hue)+540)%360)-180) <= BREED_HUE_COMPAT);
                    const readyToBreed = compatible && (c.breedCooldown??BREED_TICKS)===0 && c.hp>=0.5;
                    return <>
                      <div style={{width:"54%",height:"54%",borderRadius:"50%",background:dnaColor(c.dna,55),boxShadow:`0 0 10px ${dnaColor(c.dna,55,0.5)}`}}/>
                      <div style={{position:"absolute",bottom:4,left:5,right:5,height:3,background:"#222",borderRadius:2}}>
                        <div style={{width:`${Math.max(0,c.hp)*100}%`,height:"100%",background:c.hp>.5?"#4ade80":c.hp>.25?"#facc15":"#f87171",borderRadius:2,transition:"width 1s"}}/>
                      </div>
                      <div style={{position:"absolute",top:3,right:5,color:"#fbbf24",fontSize:8,fontWeight:"bold"}}>L{c.level||1}</div>
                      {c.hp<1&&!readyToBreed&&<div style={{position:"absolute",top:3,left:5,fontSize:8}}>💤</div>}
                      {readyToBreed&&<div style={{position:"absolute",top:2,left:4,fontSize:9}}>💕</div>}
                    </>;
                  })()}
                </div>
              );
            })}
          </div>
          {selectedInv!==null&&uiState.inventory[selectedInv]&&(()=>{
            const c=uiState.inventory[selectedInv];
            return(
              <div style={{margin:"12px 16px 0",maxWidth:400,alignSelf:"center",width:"calc(100% - 32px)",background:"#111",borderRadius:12,padding:"14px",border:`1px solid ${dnaColor(c.dna,30)}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:dnaColor(c.dna,55),boxShadow:`0 0 10px ${dnaColor(c.dna,55,0.5)}`,flexShrink:0}}/>
                  <div>
                    <div style={{color:"#e2e8f0",fontSize:13,fontWeight:"bold"}}>Lv{c.level||1} Creature</div>
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
