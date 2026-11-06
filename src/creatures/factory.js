import { COLS, ROWS, CREATURE_LIFESPAN_BASE, REPRODUCE_COOLDOWN, BREED_TICKS } from "../config.js";
import { newId } from "../engine/ids.js";
import { randomDNA } from "./dna.js";
import { deriveMoves } from "../battle/moves.js";
import { isPassable } from "../world/tiles.js";

// Wild creatures that spawn into the world arrive at a random age, so every life stage shows up
export function makeWildCreature(col,row){
  const c=makeCreature(col,row);
  c.age=Math.floor(c.maxAge*(0.03+Math.random()*0.82));
  return c;
}
export function makeCreature(col,row,dna=null) {
  dna=dna||randomDNA();
  return { id:newId(), type:"creature", species:"ramtarug", col, row, dna, moves:deriveMoves(dna),
    age:0, maxAge:CREATURE_LIFESPAN_BASE*dna.lifespan,
    hunger:0.8+Math.random()*0.2, hp:1.0, level:1, xp:0,
    reproductionCooldown:Math.floor(REPRODUCE_COOLDOWN/(dna.reproRate??1)),
    breedCooldown:BREED_TICKS,
    dcol:(Math.random()-0.5)*0.04, drow:(Math.random()-0.5)*0.04,
    wanderTimer:0, state:"wander", targetId:null,
    combatTimer:0, dead:false, deathReason:null, capturable:false };
}
export function makePlant(col,row) {
  const hue=90+Math.random()*60, maxSize=0.8+Math.random()*0.6;
  return { id:newId(), type:"plant", col, row, hue,
    size:maxSize*(0.3+Math.random()*0.5), maxSize,
    growthRate:0.0015+Math.random()*0.001,
    energy:0.4+Math.random()*0.4, dead:false };
}
export function makePlayer(map) {
  const sc=Math.floor(COLS/2)+0.5, sr=Math.floor(ROWS/2)+0.5;
  // Spiral out from the center to the nearest walkable tile
  for (let radius=0; radius<Math.max(COLS,ROWS); radius++) {
    for (let dr=-radius; dr<=radius; dr++) for (let dc=-radius; dc<=radius; dc++) {
      if (Math.abs(dr)!==radius && Math.abs(dc)!==radius) continue;
      if (isPassable(map,sc+dc,sr+dr)) return { col:sc+dc, row:sr+dr, facing:"down", moveAnim:0 };
    }
  }
  return { col:sc, row:sr, facing:"down", moveAnim:0 };
}
