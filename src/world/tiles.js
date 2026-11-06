import { COLS, ROWS } from "../config.js";

// ─── Tile definitions ─────────────────────────────────────────────────────────
// passable: creatures and the player can walk here
// cover:    drawn in front of whoever stands in it (tall reeds hide a creature's lower half)
// object:   drawn as an upright object sorted with creatures (trees)
// fast:     walking here is quicker (worn paths)
export const TILES = {
  grass:  { id:"grass",  passable:true  },
  flower: { id:"flower", passable:true  },
  dirt:   { id:"dirt",   passable:true  },
  stone:  { id:"stone",  passable:true  },
  marsh:  { id:"marsh",  passable:true  },
  reeds:  { id:"reeds",  passable:true,  cover:true },
  water:  { id:"water",  passable:false },
  sand:   { id:"sand",   passable:true  },
  path:   { id:"path",   passable:true,  fast:true },
  tree:   { id:"tree",   passable:false, object:true },
  edge:   { id:"edge",   passable:false, object:true }, // the leafy wall at the edge of your pod
  mother: { id:"mother", passable:false, object:true }, // the mother plant
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

export function isFast(map, col, row) {
  const t = tileAt(map, col, row);
  return !!(t && TILES[t]?.fast);
}
