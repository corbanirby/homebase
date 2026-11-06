import { COLS, ROWS } from "../config.js";

// ─── Tile definitions ─────────────────────────────────────────────────────────
// passable: creatures and the player can walk here
// cover:    drawn in front of whoever stands in it (tall reeds hide a creature's lower half)
// object:   drawn as an upright object sorted with creatures (trees)
export const TILES = {
  grass:  { id:"grass",  passable:true  },
  flower: { id:"flower", passable:true  },
  dirt:   { id:"dirt",   passable:true  },
  stone:  { id:"stone",  passable:true  },
  marsh:  { id:"marsh",  passable:true  },
  reeds:  { id:"reeds",  passable:true,  cover:true },
  water:  { id:"water",  passable:false },
  tree:   { id:"tree",   passable:false, object:true },
};

export function tileAt(map, col, row) {
  const r = Math.floor(row), c = Math.floor(col);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  return map[r][c];
}
export function isPassable(map, col, row) {
  const t = tileAt(map, col, row);
  return !!(t && TILES[t]?.passable);
}

// A fresh homebase: meadow with a pond ringed by marsh and reeds, a few trees,
// dirt and stone patches, flowers. Replaced by condition-driven succession in stage 1.
export function makeWorldMap() {
  const map = Array.from({ length: ROWS }, () => Array(COLS).fill("grass"));
  const blob = (tile, cc, cr, size, density = 0.55) => {
    for (let dr = -size; dr <= size; dr++) for (let dc = -size; dc <= size; dc++) {
      if (dc * dc + dr * dr > size * size + 1) continue;
      if (Math.random() > density) continue;
      const r = cr + dr, c = cc + dc;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) map[r][c] = tile;
    }
  };
  const rnd = n => Math.floor(Math.random() * n);
  // Pond with a marsh rim and reeds along the shore
  const sc = Math.floor(COLS / 2), sr = Math.floor(ROWS / 2);
  let pc, pr;
  do { pc = 6 + rnd(COLS - 12); pr = 5 + rnd(ROWS - 10); } while (Math.hypot(pc - sc, pr - sr) < 8);
  blob("marsh", pc, pr, 5, 0.9);
  blob("water", pc, pr, 3, 1);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (map[r][c] !== "marsh") continue;
    const nearWater = [[1,0],[-1,0],[0,1],[0,-1]].some(([dc, dr]) => map[r + dr]?.[c + dc] === "water");
    if (nearWater ? Math.random() < 0.75 : Math.random() < 0.2) map[r][c] = "reeds";
  }
  for (let i = 0; i < 4; i++) blob("dirt", rnd(COLS), rnd(ROWS), 2);
  for (let i = 0; i < 3; i++) blob("stone", rnd(COLS), rnd(ROWS), 1);
  for (let i = 0; i < 7; i++) blob("flower", rnd(COLS), rnd(ROWS), 1, 0.4);
  for (let i = 0; i < 10; i++) {
    const c = rnd(COLS), r = rnd(ROWS);
    if (map[r][c] === "grass" || map[r][c] === "flower") map[r][c] = "tree";
  }
  // Border of trees so the homebase reads as an enclosed clearing
  for (let c = 0; c < COLS; c++) { if (Math.random() < 0.7) map[0][c] = "tree"; if (Math.random() < 0.7) map[ROWS - 1][c] = "tree"; }
  for (let r = 0; r < ROWS; r++) { if (Math.random() < 0.7) map[r][0] = "tree"; if (Math.random() < 0.7) map[r][COLS - 1] = "tree"; }
  // Keep the middle clear for the player
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const t = map[sr + dr]?.[sc + dc];
    if (t === "tree" || t === "water") map[sr + dr][sc + dc] = "grass";
  }
  return map;
}
