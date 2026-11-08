
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
  // Atlanta (the shared world)
  needles:  { id:"needles",  passable:true  },              // pine-needle floor
  clay:     { id:"clay",     passable:true  },              // red Georgia clay
  granite:  { id:"granite",  passable:true  },              // bare granite outcrop
  tallgrass:{ id:"tallgrass",passable:true,  cover:true },  // creatures hide in it
  kudzu:    { id:"kudzu",    passable:true,  cover:true },
  creek:    { id:"creek",    passable:true,  slow:true },   // shallow, wadeable
  shoal:    { id:"shoal",    passable:true,  slow:true },   // rocky rapids you can wade across
  pine:     { id:"pine",     passable:false, object:true },
  spring:   { id:"spring",   passable:false, object:true }, // a resting spot
  door:     { id:"door",     passable:false, object:true }, // your doorway home
};

export function tileAt(map, col, row) {
  const r = Math.floor(row), c = Math.floor(col);
  if (r < 0 || r >= map.length || c < 0 || c >= map[0].length) return null;
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

export function isSlow(map, col, row) {
  const t = tileAt(map, col, row);
  return !!(t && TILES[t]?.slow);
}
export function isCover(map, col, row) {
  const t = tileAt(map, col, row);
  return !!(t && TILES[t]?.cover);
}
