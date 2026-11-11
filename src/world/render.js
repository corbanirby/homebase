import { TS } from "../config.js";
import { PLANT_SPECIES } from "../plants/plants.js";
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
  needles:  [[150,112,72],[132,98,62],[168,128,84]],
  pine:     [[150,112,72],[132,98,62],[168,128,84]],
  clay:     [[176,86,50],[156,72,42],[192,106,64]],
  granite:  [[150,148,140],[130,128,122],[172,170,160]],
  tallgrass:[[84,140,60],[70,124,52],[104,160,72]],
  kudzu:    [[52,104,40],[44,90,34],[70,124,52]],
  creek:    [[86,150,172],[74,136,158],[130,186,206]],
  shoal:    [[80,140,165],[72,124,150],[160,156,144]],
  spring:   [[95,154,69],[79,138,60],[116,173,82]],
  door:     [[95,154,69],[79,138,60],[116,173,82]],
};
export const SOIL_COLORS = { rich:"rgba(60,40,20,0.85)", poor:"rgba(180,150,100,0.85)", sandy:"rgba(240,215,140,0.85)", rocky:"rgba(150,150,150,0.85)", mineral:"rgba(120,200,200,0.85)" };
const FLOWER_COLORS = [[236,120,170],[250,220,90],[245,245,240],[190,150,240]];

// The ground is painted in 16×16-tile chunks, each only when it first comes into
// view, at half resolution (scaled up when drawn) so a big map stays light on a phone.
const CHUNK = 16;
export function buildGround(map) { return { map, chunks: new Map() }; }
function paintChunk(map, cx, cy) {
  const ROWS = map.length, COLS = map[0].length;
  const small = document.createElement("canvas");
  small.width = CHUNK * P; small.height = CHUNK * P;
  const sctx = small.getContext("2d");
  const img = sctx.createImageData(small.width, small.height);
  const ox = cx * CHUNK, oy = cy * CHUNK;
  const put = (x, y, [r, g, b]) => { x -= ox * P; y -= oy * P; if (x < 0 || y < 0 || x >= small.width || y >= small.height) return; const i = (y * small.width + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255; };
  const tileOf = (c, r) => map[Math.max(0, Math.min(ROWS - 1, r))][Math.max(0, Math.min(COLS - 1, c))];
  const wet = t => t === "water" || t === "creek" || t === "shoal";
  for (let r = oy; r < Math.min(ROWS, oy + CHUNK); r++) for (let c = ox; c < Math.min(COLS, ox + CHUNK); c++) {
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
      if (wet(src) && (y + Math.floor(hash(c, r, x >> 2) * 8)) % 7 === 0 && v < 0.5) col = src === "water" ? pal[2] : [190, 220, 230];
      if (src === "shoal" && hash(c * 3 + (x >> 2), r * 3 + (y >> 2), 21) < 0.38) col = hash(c, r, x + y) < 0.5 ? [132, 128, 118] : [156, 152, 140];
      if (src === "marsh" && v > 0.94) col = GROUND.water[0];
      if (src === "granite" && v > 0.97) col = [178, 186, 120]; // lichen
      if (src === "needles" && v > 0.93) col = [110, 78, 48];
      if (src === "clay" && v > 0.95) col = [210, 140, 96];
      if (src === "flower" && v > 0.965) col = FLOWER_COLORS[Math.floor(hash(x, y, c + r) * 4)];
      put(c * P + x, r * P + y, col);
    }
    // Dark shore line where water meets land
    if (t === "water") {
      for (let i = 0; i < P; i++) {
        if (!wet(tileOf(c, r - 1))) put(c * P + i, r * P, [70, 62, 44]);
        if (!wet(tileOf(c - 1, r))) put(c * P, r * P + i, [70, 62, 44]);
        if (!wet(tileOf(c + 1, r))) put(c * P + P - 1, r * P + i, [70, 62, 44]);
      }
    }
  }
  sctx.putImageData(img, 0, 0);
  return small;
}
function drawGround(ctx, ground, cam, W, H) {
  const map = ground.map, span = CHUNK * TS;
  const cx0 = Math.max(0, Math.floor(cam.x / span)), cx1 = Math.min(Math.ceil(map[0].length / CHUNK) - 1, Math.floor((cam.x + W) / span));
  const cy0 = Math.max(0, Math.floor(cam.y / span)), cy1 = Math.min(Math.ceil(map.length / CHUNK) - 1, Math.floor((cam.y + H) / span));
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const k = cx + "," + cy;
    let ch = ground.chunks.get(k);
    if (!ch) { ch = paintChunk(map, cx, cy); ground.chunks.set(k, ch); }
    ctx.drawImage(ch, cx * span - cam.x, cy * span - cam.y, span, span);
  }
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
const TALLGRASS = [0, 1, 2].map(k => pixelCanvas(16, 18, g => {
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(hash(k, i, 31) * 15), h = 7 + Math.floor(hash(i, k, 33) * 8);
    g.fillStyle = hash(k, i, 35) < 0.5 ? "#6fa64a" : "#5b8f3e"; g.fillRect(x, 18 - h, 1, h);
    if (hash(k, i, 37) < 0.25) { g.fillStyle = "#c9c27a"; g.fillRect(x, 18 - h, 1, 2); }
  }
}));
const KUDZU = [0, 1, 2].map(k => pixelCanvas(16, 18, g => {
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(hash(k, i, 41) * 14), y = 4 + Math.floor(hash(i, k, 43) * 12);
    g.fillStyle = hash(k, i, 45) < 0.5 ? "#3f8a32" : "#2f6f28"; g.fillRect(x, y, 3, 2); g.fillRect(x + 1, y - 1, 1, 1);
  }
  if (hash(k, 9, 47) < 0.6) { g.fillStyle = "#8a4fb0"; g.fillRect(4 + k * 3, 3, 1, 3); }
}));
const PINE = pixelCanvas(20, 40, g => {
  g.fillStyle = "#5c3a22"; g.fillRect(9, 14, 3, 26);
  const tuft = (x, y, w, col) => { g.fillStyle = col; g.fillRect(x - w, y, w * 2, 3); g.fillRect(x - w + 1, y - 1, w * 2 - 2, 1); };
  tuft(10, 4, 5, "#2f5a2c"); tuft(10, 9, 7, "#2a5228"); tuft(10, 14, 6, "#2f5a2c"); tuft(9, 2, 3, "#3f7238");
});
const DOOR = pixelCanvas(40, 52, g => {
  g.fillStyle = "#3f6b2e"; g.fillRect(4, 18, 6, 32); g.fillRect(30, 18, 6, 32);
  g.fillStyle = "#4f8a3a"; g.beginPath(); g.arc(20, 20, 16, Math.PI, 0); g.lineWidth = 6; g.strokeStyle = "#4f8a3a"; g.stroke();
  g.fillStyle = "#c9a26a"; g.fillRect(10, 18, 20, 32); g.beginPath(); g.arc(20, 18, 10, Math.PI, 0); g.fill();
  g.fillStyle = "#9ff0b8"; g.fillRect(12, 20, 16, 30); g.beginPath(); g.arc(20, 20, 8, Math.PI, 0); g.fill();
  g.fillStyle = "#5f9e44"; [[6, 14], [34, 14], [20, 2], [10, 6], [30, 6]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 5, 3, 0.4, 0, Math.PI * 2); g.fill(); });
});
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
export function cameraFor(player, W, H, map) {
  const mw = map[0].length * TS, mh = map.length * TS;
  let x = player.col * TS - W / 2, y = player.row * TS - H / 2;
  x = mw <= W ? (mw - W) / 2 : Math.max(0, Math.min(mw - W, x));
  y = mh <= H ? (mh - H) / 2 : Math.max(0, Math.min(mh - H, y));
  return { x: Math.round(x), y: Math.round(y) };
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
export function drawWorld(ctx, W, H, state, map, ground, tick, overlay = null, land = null, target = null, focusId = null) {
  const cam = cameraFor(state.player, W, H, map);
  const COLS = map[0].length, ROWS = map.length;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0e0e0e"; ctx.fillRect(0, 0, W, H);
  drawGround(ctx, ground, cam, W, H);
  if (overlay && land) drawOverlay(ctx, overlay, land, cam, W, H);
  if (target) { // the patch you'd plant in
    ctx.strokeStyle = "rgba(190,255,190,0.85)"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.strokeRect(target.c * TS - cam.x + 2, target.r * TS - cam.y + 2, TS - 4, TS - 4); ctx.setLineDash([]);
  }

  // Everything upright is sorted by where it touches the ground, back to front
  const items = [];
  const rustling = new Set((state.rustles || []).map(x => x.c + "," + x.r));
  const c0 = Math.max(0, Math.floor(cam.x / TS) - 1), c1 = Math.min(COLS - 1, Math.ceil((cam.x + W) / TS) + 1);
  const r0 = Math.max(0, Math.floor(cam.y / TS) - 1), r1 = Math.min(ROWS - 1, Math.ceil((cam.y + H) / TS) + 2);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const t = map[r][c];
    if (t === "mother") items.push({ y: r + 0.95, draw: () => drawMother(ctx, c, r, cam, tick) });
    else if (t === "door") items.push({ y: r + 0.95, draw: () => drawDoor(ctx, c, r, cam, tick) });
    else if (t === "spring") items.push({ y: r + 0.3, draw: () => drawSpring(ctx, c, r, cam, tick) });
    else if (t === "pine") items.push({ y: r + 0.95, draw: () => drawPine(ctx, c, r, cam) });
    else if (t === "edge") items.push({ y: r + 0.95, draw: () => drawHedge(ctx, c, r, cam) });
    else if (TILES[t]?.object) items.push({ y: r + 0.95, draw: () => drawTree(ctx, c, r, cam) });
    else if (TILES[t]?.cover) items.push({ y: r + 0.98, draw: () => drawCover(ctx, t, c, r, cam, tick, rustling.has(c + "," + r)) });
  }
  for (const p of state.plants) items.push({ y: p.row, draw: () => drawPlant(ctx, p, cam) });
  // Dens: at home, each creature's pod is planted around the mother plant
  if (state.pods && state.pods.length) {
    let mc = -1, mr = -1;
    for (let r = 0; r < ROWS && mc < 0; r++) for (let c = 0; c < COLS; c++) if (map[r][c] === "mother") { mc = c; mr = r; break; }
    const home = new Set(state.creatures.filter(c => !c.isEgg).map(c => c.id));
    const dens = state.pods.filter(p => home.has(p.creatureId));
    if (mc >= 0) dens.forEach((p, i) => {
      const a = -Math.PI / 2 + (i / Math.max(dens.length, 6)) * Math.PI * 2, rad = 2.1 + (i >= 12 ? 1 : 0);
      const col = mc + 0.5 + Math.cos(a) * rad, row = mr + 0.6 + Math.sin(a) * rad * 0.8;
      items.push({ y: row, draw: () => drawDen(ctx, col, row, p.size, cam) });
    });
  }
  for (const rm of state.remains || []) items.push({ y: rm.row - 0.3, draw: () => drawRemains(ctx, rm, cam, state.clock || 0) });
  for (const cr of state.creatures) items.push({ y: cr.row, draw: () => drawCreature(ctx, cr, tick, cam, cr.id === focusId) });
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
function drawPine(ctx, c, r, cam) {
  const x = c * TS - cam.x, y = r * TS - cam.y;
  ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x + TS / 2, y + TS - 3, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.drawImage(PINE, x + TS / 2 - 20, y + TS - 80, 40, 80);
}
function drawDoor(ctx, c, r, cam, tick) {
  const x = c * TS - cam.x, y = r * TS - cam.y;
  ctx.globalAlpha = 0.25 + Math.sin(tick * 0.06) * 0.1; ctx.fillStyle = "#9ff0b8"; ctx.beginPath(); ctx.ellipse(x + TS / 2, y + TS - 40, 26, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.drawImage(DOOR, x + TS / 2 - 40, y + TS - 104, 80, 104);
}
function drawSpring(ctx, c, r, cam, tick) {
  const x = c * TS - cam.x + TS / 2, y = r * TS - cam.y + TS / 2;
  ctx.fillStyle = "#8a8678"; ctx.beginPath(); ctx.ellipse(x, y, 17, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5fb8d8"; ctx.beginPath(); ctx.ellipse(x, y, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#bfe9f5"; const k = (tick * 0.04) % 1;
  ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(x, y, 4 + k * 8, 2 + k * 5, 0, 0, Math.PI * 2); ctx.strokeStyle = "#e6fbff"; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillRect(x - 6, y - 3, 3, 1);
}
function drawOverlay(ctx, mode, land, cam, W, H) {
  const COLS = land.cells[0].length, ROWS = land.cells.length;
  const c0 = Math.max(0, Math.floor(cam.x / TS)), c1 = Math.min(COLS - 1, Math.ceil((cam.x + W) / TS));
  const r0 = Math.max(0, Math.floor(cam.y / TS)), r1 = Math.min(ROWS - 1, Math.ceil((cam.y + H) / TS));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const cell = land.cells[r][c]; if (cell.edge) continue;
    let col;
    if (mode === "soil") col = SOIL_COLORS[cell.soil];
    else if (mode === "veg") col = cell.water ? "rgba(40,90,220,0.6)" : cell.trample >= 6 && cell.veg <= 1 ? "rgba(220,180,120,0.9)" : ["rgba(170,120,70,0.85)","rgba(150,200,90,0.85)","rgba(70,160,70,0.85)","rgba(20,90,40,0.9)"][cell.veg];
    else if (mode === "wet") col = cell.water ? "rgba(40,90,220,0.9)" : `hsla(${Math.round(42 + cell.wet * 180)},70%,${Math.round(60 - cell.wet * 20)}%,0.65)`;
    else col = `hsla(${Math.round(220 - cell.temp * 215)},70%,55%,0.6)`;
    ctx.fillStyle = col; ctx.fillRect(c * TS - cam.x + 1, r * TS - cam.y + 1, TS - 2, TS - 2);
  }
}
// Cover a creature can hide in; a rustling patch shakes and throws off a leaf or two
function drawCover(ctx, t, c, r, cam, tick, rustle) {
  const jig = rustle ? Math.round(Math.sin(tick * 0.9 + c) * 2) : 0;
  const x = c * TS - cam.x + jig, y = r * TS - cam.y;
  const set = t === "kudzu" ? KUDZU : t === "tallgrass" ? TALLGRASS : REEDS;
  ctx.drawImage(set[(c * 7 + r * 3) % 3], x, y + TS - 36, TS, 36);
  if (rustle) {
    ctx.fillStyle = t === "kudzu" ? "#7cc04f" : "#b6d68a";
    for (let i = 0; i < 3; i++) { const p = (tick * 0.05 + i / 3) % 1; ctx.globalAlpha = 1 - p; ctx.fillRect(x + 6 + i * 9, y + TS - 30 - p * 16, 3, 2); }
    ctx.globalAlpha = 1;
  }
}
function drawPlant(ctx, p, cam) {
  const x = Math.round(p.col * TS - cam.x), y = Math.round(p.row * TS - cam.y + 8);
  const px = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + dx * 2, y + dy * 2, w * 2, h * 2); };
  if (p.stage === 0) { px(-3, -1, 6, 1, "#6b4a2c"); px(-2, -2, 4, 1, "#7f5a36"); px(0, -2, 1, 1, "#c8a46a"); return; } // a seed in a little mound of soil
  if (p.stage === 1) { px(-1, -2, 1, 2, "#7fc26a"); px(0, -3, 1, 3, "#94d47a"); return; } // sprout
  const full = p.stage === 3 ? 0.5 + p.energy * 0.5 : 0.55;
  if (p.species === "cattail") {
    const n = p.stage === 3 ? 5 : 3, h = Math.round((p.stage === 3 ? 11 : 6) * full);
    for (let i = 0; i < n; i++) {
      const dx = -3 + Math.round(i * 6 / Math.max(1, n - 1)), hh = h - (i % 2) * 2;
      px(dx, -hh, 1, hh, i % 2 ? "#5f8f3a" : "#77a64a");
      if (p.stage === 3 && i % 2 === 0 && p.energy > 0.3) px(dx, -hh - 2, 1, 3, "#7a4a28");
    }
  } else if (PLANT_SPECIES[p.species]?.pod) {
    // Marsh pod plant: a leafy stalk hung with round pods, bigger pods for the bigger seed types
    const big = { small: 1, medium: 2, large: 3 }[PLANT_SPECIES[p.species].pod];
    const h = p.stage === 3 ? 7 + big * 2 : 5;
    px(0, -h, 1, h, "#4f7f2e"); px(-2, -h + 2, 2, 1, "#6a9f3c"); px(1, -h + 4, 2, 1, "#6a9f3c");
    if (p.stage === 3) for (const [dx, dy] of [[-2 - big, -h + 3], [1, -h + 5], [-1 - big, -h + 7]].slice(0, 2 + (big > 1 ? 1 : 0))) {
      px(dx, dy, big + 1, big + 1, "#2f3a1e"); px(dx, dy, big, big, "#b9c97a"); px(dx, dy, 1, 1, "#e6efb0");
    }
  } else { // bog moss: a soft cushion that swells as it grows
    const w = Math.round((p.stage === 3 ? 6 : 4) * full) + 1;
    px(-w, -2, w * 2, 2, "#4f7f2e"); px(-w + 1, -3, w * 2 - 2, 1, "#6a9f3c"); px(-w + 2, -4, Math.max(1, w * 2 - 4), 1, "#8cc152");
    if (p.stage === 3 && p.energy > 0.5) { px(-2, -5, 1, 1, "#d0503c"); px(2, -5, 1, 1, "#d0503c"); }
  }
  if (p.health < 0.6) { ctx.globalAlpha = 0.35; ctx.fillStyle = "#8a6a3a"; ctx.fillRect(x - 10, y - 20, 20, 20); ctx.globalAlpha = 1; }
}
// A den: a pod planted in the ground with its arched doorway open
function drawDen(ctx, col, row, size, cam) {
  const x = col * TS - cam.x, y = row * TS - cam.y + 4, k = { small: 0.7, medium: 1, large: 1.3 }[size] || 1;
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(x, y + 1, 9 * k, 3 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2f3a1e"; ctx.beginPath(); ctx.ellipse(x, y - 5 * k, 8.5 * k, 7.5 * k, 0, Math.PI, 0); ctx.lineTo(x + 8.5 * k, y); ctx.lineTo(x - 8.5 * k, y); ctx.fill();
  ctx.fillStyle = "#9fb860"; ctx.beginPath(); ctx.ellipse(x, y - 5 * k, 7.5 * k, 6.5 * k, 0, Math.PI, 0); ctx.lineTo(x + 7.5 * k, y); ctx.lineTo(x - 7.5 * k, y); ctx.fill();
  ctx.fillStyle = "#c9dc8a"; ctx.fillRect(x - 5 * k, y - 9 * k, 2 * k, 2 * k);
  ctx.fillStyle = "#1c2412"; ctx.beginPath(); ctx.ellipse(x, y - 2 * k, 3 * k, 3.5 * k, 0, Math.PI, 0); ctx.lineTo(x + 3 * k, y); ctx.lineTo(x - 3 * k, y); ctx.fill();
}
// Remains: one plain look per body size (small, medium, large), fading over their last half-day
const REMAINS_MS = 2 * 24 * 3600000;
function drawRemains(ctx, r, cam, clock) {
  const x = r.col * TS - cam.x, y = r.row * TS - cam.y + 4;
  const k = { small: 0.6, medium: 1, large: 1.45 }[r.size] || 1;
  const left = 1 - (clock - r.diedAt) / REMAINS_MS;
  ctx.globalAlpha = Math.max(0.15, Math.min(1, left * 4)) * Math.min(1, 0.4 + (r.energy ?? 1) / 3);
  // a patch of darker, richer ground with a few sprouts
  ctx.fillStyle = "rgba(60,44,28,0.45)"; ctx.beginPath(); ctx.ellipse(x, y, 14 * k, 5 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#6fb24a"; for (const [dx, dy] of [[-11, -1], [10, 1], [-4, 3]]) ctx.fillRect(x + dx * k, y + dy * k - 3, 1, 3);
  // a few pale bones: a skull, ribs and a long bone
  ctx.fillStyle = "#2a2622";
  ctx.beginPath(); ctx.ellipse(x - 6 * k, y - 3 * k, 4 * k + 1, 3 * k + 1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8e0cc";
  ctx.beginPath(); ctx.ellipse(x - 6 * k, y - 3 * k, 4 * k, 3 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a2622"; ctx.fillRect(x - 8 * k, y - 4 * k, Math.max(1, 1.5 * k), Math.max(1, 1.5 * k));
  ctx.strokeStyle = "#e8e0cc"; ctx.lineWidth = Math.max(1, 1.4 * k);
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + (1 + i * 3) * k, y - 1 * k, 3 * k, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x + 2 * k, y + 2 * k); ctx.lineTo(x + 11 * k, y + 1 * k); ctx.stroke();
  ctx.globalAlpha = 1;
}
// Every species' egg looks the same, so what's inside is a surprise. It rocks a little when it's nearly ready.
function drawEgg(ctx, c, tick, cam, focused) {
  const x = c.col * TS - cam.x, y = c.row * TS - cam.y + 4;
  const rock = (c.incubation || 0) > 0.85 ? Math.sin(tick * 0.4 + c.id) * 0.18 : 0;
  ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x, y + 1, 5, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rock);
  ctx.fillStyle = "#2a2420"; ctx.beginPath(); ctx.ellipse(0, -6, 5.5, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#efe6cf"; ctx.beginPath(); ctx.ellipse(0, -6, 4.5, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fffaf0"; ctx.fillRect(-2, -10, 2, 2);
  ctx.fillStyle = "#a08a6a"; ctx.fillRect(1, -7, 1, 1); ctx.fillRect(-2, -4, 1, 1); ctx.fillRect(2, -3, 1, 1);
  ctx.restore();
  if (focused) { ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6 + Math.sin(tick * 0.15) * 0.2; ctx.beginPath(); ctx.ellipse(x, y + 1, 8, 3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
}
function drawCreature(ctx, c, tick, cam, focused) {
  if (c.isEgg) return drawEgg(ctx, c, tick, cam, focused);
  const x = c.col * TS - cam.x, footY = c.row * TS - cam.y + 6;
  const st = lifeStage(c), sp = speciesOf(c);
  const img = spriteImage(sp, st.id, facingOf(c));
  const h = 50 * c.dna.size * st.scale * (sp.sizeMul || 1), r = h * 0.3;
  if (focused) { // the creature the Act button would reach
    ctx.globalAlpha = 0.55 + Math.sin(tick * 0.15) * 0.2; ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, footY - 1, r * 1.35, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x, footY - 1, r * 0.95, r * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  const moving = Math.hypot(c.dcol, c.drow) > 0.004;
  const weak = (c.fullness ?? 1) < 0.15;
  const bob = moving ? Math.round(Math.abs(Math.sin(tick * 0.25 + c.id)) * 1.5) : c.state === "eat" ? Math.round(Math.abs(Math.sin(tick * 0.12)) * 2) : 0;
  const top = footY - h + bob * (c.state === "eat" ? 1 : -1);
  if (img) {
    if (weak) ctx.globalAlpha = 0.75;
    ctx.drawImage(img, Math.round(x - h / 2), Math.round(top), Math.round(h), Math.round(h));
    ctx.globalAlpha = 1;
  } else { ctx.fillStyle = dnaColor(c.dna, 55); ctx.beginPath(); ctx.arc(x, footY - r, r, 0, Math.PI * 2); ctx.fill(); }
  // Name under its feet, and a bubble when it's hungry or weak
  ctx.font = "bold 9px Georgia"; ctx.textAlign = "center";
  // Roaming wild creatures carry no label, for surprise; you see level and sex in the battle
  const label = c.wild ? "" : (c.name || "") + (c.sex === "F" ? " ♀" : c.sex === "M" ? " ♂" : "");
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillText(label, x + 1, footY + 11);
  ctx.fillStyle = focused ? "#fde68a" : "#f1f5e8"; ctx.fillText(label, x, footY + 10);
  if (!c.wild && (weak || (c.fullness ?? 1) < 0.6)) {
    const by = Math.round(top + h * 0.15 - 6);
    ctx.font = "11px serif"; ctx.fillText(weak ? "💤" : "🌿", x + h * 0.32, by);
  }
  ctx.textAlign = "left";
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
