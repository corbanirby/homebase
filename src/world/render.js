import { COLS, ROWS, TS } from "../config.js";
import { TILES } from "./tiles.js";
import { lifeStage, speciesOf, spriteImage, facingOf } from "../creatures/species.jsx";
import { dnaColor } from "../creatures/dna.js";

// ─── Low top-down renderer ────────────────────────────────────────────────────
// Placeholder art drawn in code until real tiles and sprites exist. Ground is drawn
// at half resolution and scaled up, so it reads as chunky pixel art.
const P = TS / 2; // art pixels per tile

// Small deterministic random numbers, so a tile always looks the same
function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const GROUND = {
  grass:  [[95,154,69],[79,138,60],[116,173,82]],
  flower: [[95,154,69],[79,138,60],[116,173,82]],
  tree:   [[95,154,69],[79,138,60],[116,173,82]],
  dirt:   [[138,106,69],[122,92,58],[156,122,82]],
  stone:  [[138,138,134],[118,118,114],[160,160,154]],
  marsh:  [[95,127,72],[80,112,63],[110,143,85]],
  reeds:  [[95,127,72],[80,112,63],[110,143,85]],
  water:  [[63,127,160],[55,111,143],[111,168,196]],
  sand:   [[204,182,128],[188,166,112],[220,200,148]],
  path:   [[150,118,80],[134,104,70],[168,136,96]],
  edge:   [[64,112,56],[54,98,48],[78,128,66]],
  mother: [[95,154,69],[79,138,60],[116,173,82]],
};
export const SOIL_COLORS = { rich:"rgba(60,40,20,0.85)", poor:"rgba(180,150,100,0.85)", sandy:"rgba(240,215,140,0.85)", rocky:"rgba(150,150,150,0.85)", mineral:"rgba(120,200,200,0.85)" };
const FLOWER_COLORS = [[236,120,170],[250,220,90],[245,245,240],[190,150,240]];

export function buildGround(map) {
  const small = document.createElement("canvas");
  small.width = COLS * P; small.height = ROWS * P;
  const sctx = small.getContext("2d");
  const img = sctx.createImageData(small.width, small.height);
  const put = (x, y, [r, g, b]) => { const i = (y * small.width + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255; };
  const tileOf = (c, r) => map[Math.max(0, Math.min(ROWS - 1, r))][Math.max(0, Math.min(COLS - 1, c))];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = map[r][c];
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
      // Blend into the neighbouring tile near the edges
      let src = t;
      const edge = Math.min(x, y, P - 1 - x, P - 1 - y);
      if (edge < 2 && hash(c * P + x, r * P + y, 7) < (edge === 0 ? 0.45 : 0.2)) {
        const nc = x < 2 ? c - 1 : x > P - 3 ? c + 1 : c;
        const nr = y < 2 ? r - 1 : y > P - 3 ? r + 1 : r;
        const n = tileOf(nc, nr);
        if ((n !== "water" || t === "water") && n !== "edge") src = n;
      }
      const pal = GROUND[src] || GROUND.grass;
      const v = hash(c * P + x, r * P + y);
      let col = v < 0.2 ? pal[1] : v < 0.27 ? pal[2] : pal[0];
      if (src === "water" && (y + Math.floor(hash(c, r, x >> 2) * 8)) % 7 === 0 && v < 0.5) col = pal[2];
      if (src === "marsh" && v > 0.94) col = GROUND.water[0];
      if (src === "flower" && v > 0.965) col = FLOWER_COLORS[Math.floor(hash(x, y, c + r) * 4)];
      put(c * P + x, r * P + y, col);
    }
    // Dark shore line where water meets land
    if (t === "water") {
      for (let i = 0; i < P; i++) {
        if (tileOf(c, r - 1) !== "water") put(c * P + i, r * P, [70, 62, 44]);
        if (tileOf(c - 1, r) !== "water") put(c * P, r * P + i, [70, 62, 44]);
        if (tileOf(c + 1, r) !== "water") put(c * P + P - 1, r * P + i, [70, 62, 44]);
      }
    }
  }
  sctx.putImageData(img, 0, 0);
  const big = document.createElement("canvas");
  big.width = COLS * TS; big.height = ROWS * TS;
  const bctx = big.getContext("2d");
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, big.width, big.height);
  return big;
}

// ─── Placeholder object sprites (drawn once) ──────────────────────────────────
function pixelCanvas(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); draw(g);
  return c;
}
const TREE = pixelCanvas(24, 34, g => {
  g.fillStyle = "#5c4028"; g.fillRect(10, 22, 4, 11); g.fillStyle = "#47301e"; g.fillRect(10, 22, 1, 11);
  const blob = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  blob(12, 14, 11, "#2e5f36"); blob(9, 11, 8, "#3f7a42"); blob(8, 8, 4, "#5c9a52");
});
const HEDGE = pixelCanvas(24, 30, g => {
  const blob = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  blob(12, 18, 12, "#24502c"); blob(7, 14, 7, "#2f6236"); blob(17, 13, 7, "#2f6236"); blob(8, 10, 3, "#4c8a48"); blob(16, 9, 3, "#4c8a48");
});
// The mother plant: a broad-leafed plant cradling your homebase pod
const MOTHER = pixelCanvas(40, 52, g => {
  g.fillStyle = "#3f6b2e"; g.fillRect(19, 26, 3, 24);
  const leaf = (x, y, w, h, col, flip) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, w, h, flip ? 0.6 : -0.6, 0, Math.PI * 2); g.fill(); };
  leaf(10, 38, 10, 4, "#4f8a3a", false); leaf(30, 38, 10, 4, "#4f8a3a", true);
  leaf(9, 28, 9, 4, "#5f9e44", false); leaf(31, 28, 9, 4, "#5f9e44", true);
  g.fillStyle = "#c9a26a"; g.beginPath(); g.ellipse(20, 15, 10, 13, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e0bf86"; g.beginPath(); g.ellipse(17, 11, 4, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7fe0a0"; g.fillRect(20, 6, 2, 18);
  g.fillStyle = "#4f8a3a"; g.beginPath(); g.ellipse(20, 3, 6, 3, 0, 0, Math.PI * 2); g.fill();
});
const REEDS = [0, 1, 2].map(k => pixelCanvas(16, 18, g => {
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(hash(k, i) * 15), h = 8 + Math.floor(hash(i, k, 3) * 9);
    g.fillStyle = hash(k, i, 5) < 0.5 ? "#7f9f4a" : "#6a8a3e"; g.fillRect(x, 18 - h, 1, h);
    if (hash(k, i, 9) < 0.35) { g.fillStyle = "#7a5434"; g.fillRect(x, 18 - h, 1, 3); }
  }
}));
// Player placeholder: 4 facings × 2 walking frames
function drawPerson(g, facing, frame) {
  const skin = "#e8be96", hair = "#5a3220", shirt = "#3c64c8", pants = "#323246";
  g.fillStyle = hair; g.fillRect(4, 0, 8, 3);
  g.fillStyle = skin; g.fillRect(4, 2, 8, 6);
  g.fillStyle = hair;
  if (facing === "up") g.fillRect(4, 2, 8, 5);
  else if (facing === "left") g.fillRect(8, 2, 4, 4);
  else if (facing === "right") g.fillRect(4, 2, 4, 4);
  else g.fillRect(4, 2, 8, 1);
  g.fillStyle = "#1e1e1e";
  if (facing === "down") { g.fillRect(6, 5, 1, 1); g.fillRect(9, 5, 1, 1); }
  if (facing === "left") g.fillRect(5, 5, 1, 1);
  if (facing === "right") g.fillRect(10, 5, 1, 1);
  g.fillStyle = shirt; g.fillRect(3, 8, 10, 8);
  g.fillStyle = pants;
  const step = frame ? 1 : 0;
  g.fillRect(4, 16, 3, 6 - step); g.fillRect(9, 16, 3, 5 + step);
}
const PERSON = {};
["down", "up", "left", "right"].forEach(f => { PERSON[f] = [0, 1].map(fr => pixelCanvas(16, 22, g => drawPerson(g, f, fr))); });

// ─── Camera ───────────────────────────────────────────────────────────────────
export function cameraFor(player, W, H) {
  const mw = COLS * TS, mh = ROWS * TS;
  let x = player.col * TS - W / 2, y = player.row * TS - H / 2;
  x = mw <= W ? (mw - W) / 2 : Math.max(0, Math.min(mw - W, x));
  y = mh <= H ? (mh - H) / 2 : Math.max(0, Math.min(mh - H, y));
  return { x: Math.round(x), y: Math.round(y) };
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
export function drawWorld(ctx, W, H, state, map, ground, tick, overlay = null, land = null) {
  const cam = cameraFor(state.player, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0e0e0e"; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(ground, -cam.x, -cam.y);
  if (overlay && land) drawOverlay(ctx, overlay, land, cam, W, H);

  // Everything upright is sorted by where it touches the ground, back to front
  const items = [];
  const c0 = Math.max(0, Math.floor(cam.x / TS) - 1), c1 = Math.min(COLS - 1, Math.ceil((cam.x + W) / TS) + 1);
  const r0 = Math.max(0, Math.floor(cam.y / TS) - 1), r1 = Math.min(ROWS - 1, Math.ceil((cam.y + H) / TS) + 2);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const t = map[r][c];
    if (t === "mother") items.push({ y: r + 0.95, draw: () => drawMother(ctx, c, r, cam, tick) });
    else if (t === "edge") items.push({ y: r + 0.95, draw: () => drawHedge(ctx, c, r, cam) });
    else if (TILES[t]?.object) items.push({ y: r + 0.95, draw: () => drawTree(ctx, c, r, cam) });
    else if (TILES[t]?.cover) items.push({ y: r + 0.98, draw: () => drawReeds(ctx, c, r, cam) });
  }
  for (const p of state.plants) items.push({ y: p.row, draw: () => drawPlant(ctx, p, cam) });
  for (const cr of state.creatures) items.push({ y: cr.row, draw: () => drawCreature(ctx, cr, tick, cam) });
  items.push({ y: state.player.row, draw: () => drawPlayer(ctx, state.player, cam) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  drawFloats(ctx, state.floats, tick, cam);
}

function drawTree(ctx, c, r, cam) {
  const x = c * TS - cam.x, y = r * TS - cam.y;
  ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x + TS / 2, y + TS - 3, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.drawImage(TREE, x + TS / 2 - 24, y + TS - 68, 48, 68);
}
function drawHedge(ctx, c, r, cam) {
  const x = c * TS - cam.x, y = r * TS - cam.y;
  ctx.drawImage(HEDGE, x - 8, y + TS - 60, 48, 60);
}
function drawMother(ctx, c, r, cam, tick) {
  const x = c * TS - cam.x, y = r * TS - cam.y;
  ctx.globalAlpha = 0.28; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x + TS / 2, y + TS - 3, 20, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  const glow = 0.25 + Math.sin(tick * 0.06) * 0.12;
  ctx.globalAlpha = glow; ctx.fillStyle = "#9ff0b8"; ctx.beginPath(); ctx.ellipse(x + TS / 2, y + TS - 70, 24, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.drawImage(MOTHER, x + TS / 2 - 40, y + TS - 104, 80, 104);
}
function drawOverlay(ctx, mode, land, cam, W, H) {
  const c0 = Math.max(0, Math.floor(cam.x / TS)), c1 = Math.min(COLS - 1, Math.ceil((cam.x + W) / TS));
  const r0 = Math.max(0, Math.floor(cam.y / TS)), r1 = Math.min(ROWS - 1, Math.ceil((cam.y + H) / TS));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const cell = land.cells[r][c]; if (cell.edge) continue;
    let col;
    if (mode === "soil") col = SOIL_COLORS[cell.soil];
    else if (mode === "wet") col = cell.water ? "rgba(40,90,220,0.9)" : `hsla(${Math.round(42 + cell.wet * 180)},70%,${Math.round(60 - cell.wet * 20)}%,0.65)`;
    else col = `hsla(${Math.round(220 - cell.temp * 215)},70%,55%,0.6)`;
    ctx.fillStyle = col; ctx.fillRect(c * TS - cam.x + 1, r * TS - cam.y + 1, TS - 2, TS - 2);
  }
}
function drawReeds(ctx, c, r, cam) {
  const x = c * TS - cam.x, y = r * TS - cam.y;
  ctx.drawImage(REEDS[(c * 7 + r * 3) % 3], x, y + TS - 36, TS, 36);
}
function drawPlant(ctx, p, cam) {
  const x = Math.round(p.col * TS - cam.x), y = Math.round(p.row * TS - cam.y);
  const s = Math.max(3, Math.round(4 + p.size * 7));
  const hue = p.hue;
  ctx.fillStyle = `hsl(${hue},45%,26%)`; ctx.fillRect(x - s, y - s + 2, s * 2, s);
  ctx.fillStyle = `hsl(${hue},50%,36%)`; ctx.fillRect(x - s + 2, y - s - 1, s * 2 - 4, s);
  ctx.fillStyle = `hsl(${hue},55%,50%)`; ctx.fillRect(x - s + 4, y - s - 1, Math.max(2, s - 4), 2);
  if (p.energy > 0.7) { ctx.fillStyle = "#e05a6a"; ctx.fillRect(x - 2, y - s + 2, 2, 2); ctx.fillRect(x + 3, y - s + 4, 2, 2); }
}
function drawCreature(ctx, c, tick, cam) {
  const x = c.col * TS - cam.x, footY = c.row * TS - cam.y + 6;
  const st = lifeStage(c), sp = speciesOf(c);
  const img = spriteImage(sp, st.id, facingOf(c));
  const h = 50 * c.dna.size * st.scale, r = h * 0.3;
  if (c.capturable) {
    ctx.globalAlpha = 0.2 + Math.sin(tick * 0.18) * 0.12; ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.ellipse(x, footY - 2, r * 1.3, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x, footY - 1, r * 0.95, r * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  const moving = Math.hypot(c.dcol, c.drow) > 0.004;
  const bob = moving ? Math.round(Math.abs(Math.sin(tick * 0.25 + c.id)) * 1.5) : 0;
  const top = footY - h - bob;
  if (img) {
    ctx.drawImage(img, Math.round(x - h / 2), Math.round(top), Math.round(h), Math.round(h));
    if (c.state === "combat") { ctx.globalAlpha = 0.18 + Math.sin(tick * 0.4) * 0.1; ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.ellipse(x, top + h * 0.6, h * 0.42, h * 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  } else { ctx.fillStyle = dnaColor(c.dna, 55); ctx.beginPath(); ctx.arc(x, footY - r, r, 0, Math.PI * 2); ctx.fill(); }
  const bw = Math.max(16, h * 0.5), bh = 3, bx = Math.round(x - bw / 2), by = Math.round(top + h * 0.1 - 7);
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = c.hp > .6 ? "#4ade80" : c.hp > .3 ? "#facc15" : "#f87171"; ctx.fillRect(bx, by, bw * c.hp, bh);
  ctx.fillStyle = "#fff"; ctx.font = "bold 9px Georgia"; ctx.textAlign = "center";
  ctx.fillText("L" + (c.level || 1), x, footY + 10); ctx.textAlign = "left";
  if (c.capturable) { ctx.font = "10px serif"; ctx.fillText("⚡", bx + bw + 1, by + 6); }
}
function drawPlayer(ctx, p, cam) {
  const x = Math.round(p.col * TS - cam.x), footY = Math.round(p.row * TS - cam.y + 6);
  ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x, footY - 1, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  const frames = PERSON[p.facing] || PERSON.down;
  const walking = p.moveAnim > 0;
  const fr = walking && Math.sin(p.moveAnim * 2) > 0 ? 1 : 0;
  const bob = walking ? Math.round(Math.abs(Math.sin(p.moveAnim * 2))) : 0;
  ctx.drawImage(frames[fr], x - 16, footY - 44 - bob, 32, 44);
}
function drawFloats(ctx, floats, tick, cam) {
  for (const f of floats) {
    const age = tick - f.tick, a = Math.max(0, 1 - age / 45);
    ctx.globalAlpha = a; ctx.fillStyle = f.color; ctx.font = "bold 12px Georgia"; ctx.textAlign = "center";
    ctx.fillText(f.text, f.col * TS - cam.x, f.row * TS - cam.y - 50 - age * 0.6);
    ctx.globalAlpha = 1; ctx.textAlign = "left";
  }
}
