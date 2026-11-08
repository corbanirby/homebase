// ─── Placeholder creature art ─────────────────────────────────────────────────
// Code-drawn stand-ins for the Atlanta species until real sprites exist. Each is
// drawn side-on on a 24×24 grid, outlined, then scaled up to the same 96px frame
// as Ramtarug's sprites. West-facing directions are mirrored; elders are greyed.
const G = 24, SCALE = 4;

function art(g, kind) {
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // Chunky ellipse: whole pixels only, so it stays pixel art
  const el = (cx, cy, rx, ry, c) => { g.fillStyle = c; for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) g.fillRect(cx + x, cy + y, 1, 1); };
  switch (kind) {
    case "kudzoon":
      el(12, 16, 9, 5, "#3f7f2e"); el(7, 12, 4, 3, "#5fa23e"); el(15, 11, 4, 3, "#5fa23e"); el(11, 8, 3, 2, "#7cc04f");
      px(17, 6, 1, 3, "#8a4fb0"); px(18, 5, 1, 2, "#a86fd0"); px(5, 9, 1, 2, "#8a4fb0");
      px(14, 14, 2, 2, "#ffffff"); px(15, 15, 1, 1, "#111111"); px(18, 14, 2, 2, "#ffffff"); px(19, 15, 1, 1, "#111111");
      px(2, 18, 2, 1, "#4f8f34"); px(1, 17, 1, 1, "#4f8f34"); px(1, 16, 2, 1, "#4f8f34");
      px(7, 21, 2, 1, "#2f5f22"); px(15, 21, 2, 1, "#2f5f22"); break;
    case "thrummet":
      el(11, 15, 7, 3, "#4a5a2a"); el(19, 14, 3, 3, "#3a4a22"); px(20, 12, 2, 2, "#d0302a");
      px(8, 14, 6, 1, "#8a9a3a");
      el(10, 10, 8, 3, "rgba(205,235,235,0.8)"); px(4, 10, 12, 1, "#7a9a8a"); px(8, 9, 1, 3, "#7a9a8a");
      px(9, 18, 1, 3, "#2a3218"); px(13, 18, 1, 3, "#2a3218"); px(16, 17, 1, 4, "#2a3218"); break;
    case "scuffinch":
      px(0, 10, 3, 1, "#8a4525"); px(1, 11, 7, 2, "#8a4525");
      el(11, 14, 6, 4, "#a0522d"); el(13, 16, 4, 2, "#f0e0c0");
      px(12, 15, 1, 1, "#5a3a1a"); px(14, 16, 1, 1, "#5a3a1a"); px(13, 17, 1, 1, "#5a3a1a"); px(15, 15, 1, 1, "#5a3a1a");
      px(7, 12, 5, 1, "#f0e0c0"); el(17, 10, 3, 3, "#a0522d");
      px(20, 10, 3, 1, "#3a2a1a"); px(22, 11, 1, 1, "#3a2a1a"); px(18, 9, 1, 1, "#f0d040");
      px(11, 18, 1, 4, "#8a6a4a"); px(13, 18, 1, 4, "#8a6a4a"); break;
    case "flintback":
      px(0, 18, 5, 1, "#6a6a62"); px(2, 17, 3, 1, "#6a6a62");
      el(12, 17, 8, 2, "#7a7a70"); el(20, 16, 3, 2, "#6a6a62");
      for (let x = 7; x <= 17; x += 2) px(x, 14, 1, 1, "#4a4a44");
      px(9, 19, 8, 1, "#e07020"); px(11, 13, 1, 1, "#f0a030"); px(13, 12, 1, 2, "#f06020"); px(15, 13, 1, 1, "#f0a030");
      px(8, 19, 1, 3, "#5a5a52"); px(16, 19, 1, 3, "#5a5a52"); px(21, 15, 1, 1, "#111111"); break;
    case "shoalclaw":
      px(1, 16, 3, 3, "#8a3a22"); el(11, 17, 7, 3, "#a8442a");
      px(7, 15, 1, 5, "#7a2a1a"); px(10, 14, 1, 6, "#7a2a1a"); px(13, 14, 1, 6, "#7a2a1a");
      el(17, 16, 3, 3, "#b85032"); el(21, 12, 2, 2, "#c85a3a"); el(21, 19, 2, 1, "#c85a3a");
      px(23, 12, 1, 1, "#7a2a1a"); px(19, 14, 2, 1, "#c85a3a"); px(19, 18, 2, 1, "#c85a3a");
      px(18, 11, 1, 3, "#7a2a1a"); px(19, 9, 3, 1, "#7a2a1a"); px(18, 14, 1, 1, "#111111");
      px(9, 20, 1, 2, "#7a2a1a"); px(12, 20, 1, 2, "#7a2a1a"); px(15, 20, 1, 2, "#7a2a1a"); break;
    case "glimmerwick":
      el(6, 13, 5, 5, "rgba(250,240,120,0.35)"); el(6, 13, 3, 3, "#f8f070"); px(5, 12, 2, 2, "#ffffd0");
      el(11, 13, 5, 2, "#2a2a2a"); el(16, 12, 2, 2, "#d04040"); px(17, 11, 1, 1, "#f0d040");
      el(11, 10, 5, 2, "rgba(225,225,205,0.65)"); px(18, 10, 2, 1, "#2a2a2a"); px(20, 9, 1, 1, "#2a2a2a");
      px(10, 15, 1, 3, "#2a2a2a"); px(13, 15, 1, 3, "#2a2a2a"); break;
    case "possumbra":
      el(10, 10, 5, 2, "rgba(150,110,220,0.4)");
      px(0, 14, 1, 3, "#e0a0b0"); px(0, 16, 4, 1, "#e0a0b0");
      el(11, 15, 7, 4, "#a8a8b0"); el(18, 13, 4, 3, "#f0eef0");
      px(21, 13, 2, 2, "#f0c0c8"); px(23, 13, 1, 1, "#e08090");
      px(16, 9, 2, 2, "#2a2a30"); px(19, 12, 1, 1, "#111111");
      px(7, 19, 2, 3, "#3a3a40"); px(14, 19, 2, 3, "#3a3a40"); break;
    case "clattershell":
      px(0, 17, 4, 1, "#8a8a90"); el(11, 14, 8, 5, "#8a8a90");
      for (const x of [6, 9, 12, 15]) px(x, 10, 1, 9, "#5a5a64");
      px(8, 9, 6, 1, "#c0c0c8"); el(20, 16, 3, 2, "#a89080"); px(19, 12, 1, 2, "#a89080");
      px(22, 17, 2, 1, "#a89080"); px(20, 15, 1, 1, "#111111");
      px(6, 19, 2, 3, "#7a6a60"); px(15, 19, 2, 3, "#7a6a60"); break;
    case "duskhowl":
      el(11, 12, 10, 7, "rgba(110,80,170,0.2)");
      el(3, 13, 3, 2, "#8a7450"); px(0, 14, 1, 1, "#2a2a2a");
      el(11, 13, 7, 3, "#a08a64"); px(8, 15, 7, 1, "#d0c0a0"); el(18, 10, 3, 3, "#a08a64");
      px(20, 11, 3, 2, "#b09a74"); px(23, 11, 1, 1, "#111111");
      px(17, 5, 1, 3, "#8a7450"); px(19, 5, 1, 3, "#8a7450"); px(19, 9, 1, 1, "#f0c040");
      for (const x of [7, 9, 14, 16]) px(x, 16, 1, 6, "#8a7450"); break;
    default:
      el(12, 15, 7, 5, "#888888");
  }
}

// Dark outline around the drawn shape, and grey for elders
function finish(g, elder) {
  const im = g.getImageData(0, 0, G, G), d = im.data;
  const solid = i => d[i * 4 + 3] > 140;
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const i = y * G + x;
    if (d[i * 4 + 3] > 40) {
      if (elder) { const k = i * 4, m = (d[k] + d[k + 1] + d[k + 2]) / 3; for (let j = 0; j < 3; j++) out[k + j] = d[k + j] * 0.55 + m * 0.45; }
      continue;
    }
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < G && ny < G && solid(ny * G + nx); });
    if (n) { out[i * 4] = 22; out[i * 4 + 1] = 20; out[i * 4 + 2] = 24; out[i * 4 + 3] = 225; }
  }
  g.putImageData(new ImageData(out, G, G), 0, 0);
}

const cache = {};
export function placeholderSprite(kind, stage, dir, onload = null) {
  const west = dir.includes("west");
  const key = kind + "/" + (stage === "elder" ? "elder" : "young") + "/" + (west ? "w" : "e");
  let img = cache[key];
  if (!img) {
    const small = document.createElement("canvas"); small.width = G; small.height = G;
    const g = small.getContext("2d");
    art(g, kind); finish(g, stage === "elder");
    const big = document.createElement("canvas"); big.width = G * SCALE; big.height = G * SCALE;
    const b = big.getContext("2d"); b.imageSmoothingEnabled = false;
    if (west) { b.translate(big.width, 0); b.scale(-1, 1); }
    b.drawImage(small, 0, 0, big.width, big.height);
    img = new Image(); if (onload) img.onload = onload; img.src = big.toDataURL();
    cache[key] = img;
  }
  return img.complete && img.naturalWidth ? img : null;
}
