import { PLAYER_SPEED, PATH_SPEED_BONUS } from "../config.js";
import { isPassable, isFast, isSlow } from "../world/tiles.js";

// Player movement (each axis separately, so you slide along water and trees)
export function movePlayer(player, input, creatures, map) {
  let { col: pc, row: pr, facing, moveAnim } = player;
  const { dx: idx, dy: idy } = input;
  // Soft collision: pushing through a creature slows you a little but never blocks you
  const pushing = creatures.some(c => !c.dead && !c.isEgg && Math.hypot(c.col - pc, c.row - pr) < 0.55);
  const spd = PLAYER_SPEED * (isFast(map, pc, pr + 0.25) ? PATH_SPEED_BONUS : 1) * (isSlow(map, pc, pr + 0.25) ? 0.6 : 1) * (pushing ? 0.7 : 1);
  const COLS = map[0].length, ROWS = map.length;
  const nc = Math.max(0.3, Math.min(COLS - 0.3, pc + idx * spd));
  if (isPassable(map, nc, pr + 0.25)) pc = nc;
  const nr = Math.max(0.3, Math.min(ROWS - 0.1, pr + idy * spd));
  if (isPassable(map, pc, nr + 0.25)) pr = nr;
  if (Math.abs(idx) > Math.abs(idy)) facing = idx < 0 ? "left" : "right";
  else if (idy !== 0) facing = idy < 0 ? "up" : "down";
  const moving = idx !== 0 || idy !== 0;
  moveAnim = moving ? (moveAnim + 0.25) % (Math.PI * 2) : 0;
  return { ...player, col: pc, row: pr, facing, moveAnim };
}

// Soft collision: creatures step aside from you (shy ones more) and keep a little space from each other
export function softCollide(creatures, player, map) {
  const { col: pc, row: pr } = player;
  const crowd = creatures.map(c => {
    if (c.dead || c.isEgg) return c;
    let { col, row } = c;
    const dx = col - pc, dy = row - pr, d = Math.hypot(dx, dy);
    if (d < 0.7 && d > 0.0001) {
      const shove = (0.7 - d) * (0.25 + (1 - (c.dna.aggression ?? 0.5)) * 0.35);
      let nx = col + dx / d * shove, ny = row + dy / d * shove;
      // Walking into you: slide sideways around you instead of stalling against you
      if ((c.dcol || 0) * -dx + (c.drow || 0) * -dy > 0) {
        const px = -dy / d, py = dx / d, sgn = Math.sign((c.dcol || 0) * px + (c.drow || 0) * py) || 1;
        nx += px * sgn * Math.max(shove, 0.03) * 1.5; ny += py * sgn * Math.max(shove, 0.03) * 1.5;
      }
      if (isPassable(map, nx, row)) col = nx;
      if (isPassable(map, col, ny)) row = ny;
    }
    return col === c.col && row === c.row ? c : { ...c, col, row };
  });
  for (let i = 0; i < crowd.length; i++) for (let j = i + 1; j < crowd.length; j++) {
    const a = crowd[i], b = crowd[j]; if (a.dead || b.dead || a.isEgg || b.isEgg) continue;
    const dx = b.col - a.col, dy = b.row - a.row, d = Math.hypot(dx, dy);
    if (d < 0.5 && d > 0.0001) {
      const k = (0.5 - d) * 0.25, ux = dx / d * k, uy = dy / d * k;
      if (isPassable(map, a.col - ux, a.row - uy)) crowd[i] = { ...a, col: a.col - ux, row: a.row - uy };
      if (isPassable(map, b.col + ux, b.row + uy)) crowd[j] = { ...b, col: b.col + ux, row: b.row + uy };
    }
  }
  return crowd;
}
