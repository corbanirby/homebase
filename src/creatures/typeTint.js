// ─── Type tints: background colours from a creature's types (for its current life stage) ───
// Replaces the old hidden "hue" gene colours. Dual types show both colours split with a hard edge.
import { TYPE_COLORS } from "../battle/moves.js";
import { typesOf } from "../battle/engine.js";

// Darken a #rrggbb colour (k: 0 black … 1 as is)
export function shade(hex, k) {
  const n = parseInt((hex || "#888888").slice(1), 16);
  const ch = s => Math.round(((n >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
const colorsOf = c => typesOf(c).slice(0, 2).map(t => TYPE_COLORS[t] || "#888888");
// Background: one solid colour, or two halves (dir "135deg" diagonal for circles, "90deg" side by side for buttons)
export function typeBg(c, k = 0.28, dir = "135deg") {
  const [a, b] = colorsOf(c);
  return b ? `linear-gradient(${dir},${shade(a, k)} 50%,${shade(b, k)} 50%)` : shade(a, k);
}
// A border colour: the main type
export const typeEdge = (c, k = 0.6) => shade(colorsOf(c)[0], k);
