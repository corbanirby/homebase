// ─── Battle backdrops (placeholders) ─────────────────────────────────────────
// One simple painted scene per Atlanta land type, so you can see where you're
// fighting (and whose home ground it is). Drawn in SVG; real art comes later.
// Seen from above at an angle: a thin strip of sky and far scenery at the top,
// ground everywhere else, details shrinking with distance, so both creatures
// stand on the ground. Canvas 400×600: on a phone the foe stands up and right
// (~x 320, y 240), yours low and left (~x 90, y 470).

// Small seeded random, so a scene looks the same every time
const rng = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const H = 140; // horizon
// How big something is at height y (far things small, near things big)
const depth = y => 0.35 + 0.65 * Math.max(0, (y - H) / (600 - H));
// A point on the ground, more of them toward the front
const spot = r => { const t = Math.pow(r(), 0.8); return { x: r() * 420 - 10, y: H + 10 + t * (600 - H - 10) }; };

const SCENES = {
  forest:  { sky: ["#2a4636", "#4b6b4c"], far: "#22402c", ground: ["#55703c", "#2e4622"] },
  pine:    { sky: ["#3a4c5c", "#6d8290"], far: "#1d3328", ground: ["#8a7048", "#55422a"] },
  kudzu:   { sky: ["#4a5c46", "#87a070"], far: "#2f5a27", ground: ["#5a9440", "#2f6224"] },
  meadow:  { sky: ["#5a82a2", "#b9d3da"], far: "#6f9a4f", ground: ["#9bbf66", "#5e8640"] },
  clay:    { sky: ["#6a5a6c", "#d39a70"], far: "#7a4a32", ground: ["#bd6a3c", "#7d3c22"] },
  granite: { sky: ["#4f5d73", "#a3b2c2"], far: "#5b6670", ground: ["#a5a9ab", "#6c7174"] },
  shoal:   { sky: ["#45667e", "#9cc0cf"], far: "#2f5236", ground: ["#5a8fa8", "#2e5a72"] },
  creek:   { sky: ["#3e5a50", "#7fa38c"], far: "#284a32", ground: ["#6a8a48", "#36502a"] },
  river:   { sky: ["#4a6a86", "#abcbd9"], far: "#2c4a33", ground: ["#b3a382", "#7c6e52"] },
};
export const hasBackdrop = biome => !!SCENES[biome];

// The far edge: a treeline, hills or a ridge along the horizon
function horizon(biome, s, r) {
  const els = [];
  if (biome === "pine") {
    for (let i = 0; i < 26; i++) { const x = i * 16 + r() * 8, h = 30 + r() * 26; els.push(<polygon key={"hp" + i} points={`${x},${H - h} ${x - 9},${H + 2} ${x + 9},${H + 2}`} fill={s.far} />); }
  } else if (biome === "meadow" || biome === "clay") {
    els.push(<path key="hh" d={`M -10 ${H + 2} Q 80 ${H - 30} 170 ${H - 8} Q 270 ${H - 34} 410 ${H - 6} L 410 ${H + 2} Z`} fill={s.far} />);
  } else if (biome === "granite") {
    els.push(<path key="hd" d={`M 120 ${H + 2} Q 260 ${H - 70} 420 ${H - 10} L 420 ${H + 2} Z`} fill={s.far} />);
  } else {
    for (let i = 0; i < 22; i++) els.push(<circle key={"ht" + i} cx={i * 19 + r() * 10} cy={H - 4 + r() * 6} r={12 + r() * 10} fill={s.far} />);
  }
  return els;
}

function details(biome, r) {
  const els = [], k = el => els.push(el);
  const scatter = (n, draw) => { const pts = Array.from({ length: n }, () => spot(r)).sort((a, b) => a.y - b.y); pts.forEach((p, i) => k(draw(p, depth(p.y), i))); };
  if (biome === "forest" || biome === "pine") {
    const pine = biome === "pine";
    // Trunks at the sides frame the clearing
    for (const [x, w] of [[-10, 46], [370, 50], [30, 22], [335, 24]]) k(<rect key={"tr" + x} x={x} y={0} width={w} height={x < 0 || x > 360 ? 600 : 300} fill={pine ? "#3d2c1c" : "#2e2618"} opacity={x < 0 || x > 360 ? 0.95 : 0.7} />);
    scatter(pine ? 55 : 40, (p, d, i) => pine
      ? <line key={"n" + i} x1={p.x} y1={p.y} x2={p.x + 12 * d} y2={p.y + (r() * 6 - 3) * d} stroke="#5c4428" strokeWidth={2 * d} opacity="0.6" />
      : <ellipse key={"l" + i} cx={p.x} cy={p.y} rx={7 * d} ry={3.5 * d} fill={["#7a6a2e", "#8a4f24", "#6e7a34"][i % 3]} opacity="0.7" />);
  } else if (biome === "kudzu") {
    scatter(26, (p, d, i) => <path key={"c" + i} d={`M ${p.x - 28 * d} ${p.y} Q ${p.x} ${p.y - 26 * d} ${p.x + 28 * d} ${p.y} Z`} fill="#3d7a2c" opacity="0.85" />);
    scatter(40, (p, d, i) => <circle key={"f" + i} cx={p.x} cy={p.y} r={2.6 * d} fill="#8e5bbf" />);
  } else if (biome === "meadow") {
    scatter(90, (p, d, i) => <line key={"g" + i} x1={p.x} y1={p.y} x2={p.x + (r() * 6 - 3) * d} y2={p.y - (10 + r() * 8) * d} stroke="#577d38" strokeWidth={2 * d} />);
    scatter(40, (p, d, i) => <circle key={"f" + i} cx={p.x} cy={p.y} r={2.4 * d} fill={["#f4e27a", "#ffffff", "#e9a3c9"][i % 3]} />);
  } else if (biome === "clay") {
    scatter(18, (p, d, i) => <path key={"c" + i} d={`M ${p.x} ${p.y} l ${(14 + r() * 18) * d} ${(r() * 8 - 4) * d} l ${(10 + r() * 12) * d} ${(r() * 10 - 5) * d}`} stroke="#6a2f18" strokeWidth={2 * d} fill="none" />);
    scatter(10, (p, d, i) => <path key={"s" + i} d={`M ${p.x} ${p.y} q ${6 * d} ${-18 * d} ${12 * d} 0 q ${6 * d} ${-14 * d} ${12 * d} 0`} stroke="#5f6b34" strokeWidth={3 * d} fill="none" />);
  } else if (biome === "granite") {
    scatter(16, (p, d, i) => <path key={"k" + i} d={`M ${p.x} ${p.y} l ${(20 + r() * 20) * d} ${(r() * 6 - 3) * d}`} stroke="#5d6265" strokeWidth={2 * d} />);
    scatter(26, (p, d, i) => <ellipse key={"l" + i} cx={p.x} cy={p.y} rx={(5 + r() * 7) * d} ry={(3 + r() * 3) * d} fill={i % 2 ? "#b4b85a" : "#d0ccb0"} opacity="0.5" />);
    k(<ellipse key="pool" cx={330} cy={560} rx={48} ry={12} fill="#6a8ca3" opacity="0.85" />);
  } else if (biome === "shoal") {
    scatter(22, (p, d, i) => <path key={"w" + i} d={`M ${p.x} ${p.y} q ${10 * d} ${-4 * d} ${20 * d} 0 q ${10 * d} ${4 * d} ${20 * d} 0`} stroke="#cfe7ee" strokeWidth={2 * d} fill="none" opacity="0.5" />);
    scatter(12, (p, d, i) => <ellipse key={"r" + i} cx={p.x} cy={p.y} rx={(16 + r() * 14) * d} ry={(6 + r() * 4) * d} fill="#8f8a7e" />);
    // Flat rocks the creatures stand on
    k(<ellipse key="rf" cx={322} cy={240} rx={80} ry={18} fill="#9a958a" />);
    k(<ellipse key="rp" cx={92} cy={472} rx={100} ry={24} fill="#a29d91" />);
  } else if (biome === "creek") {
    k(<path key="water" d={`M 225 ${H} Q 215 300 190 380 Q 160 470 185 600 L 285 600 Q 255 470 270 380 Q 285 300 240 ${H} Z`} fill="#4a7f99" />);
    for (let i = 0; i < 9; i++) { const y = H + 30 + i * 52, d = depth(y), x = 205 + (y > 380 ? -10 : 10); k(<path key={"w" + i} d={`M ${x} ${y} q ${8 * d} ${-3 * d} ${16 * d} 0`} stroke="#cfe7ee" strokeWidth={2 * d} fill="none" opacity="0.55" />); }
    scatter(16, (p, d, i) => (p.x > 160 && p.x < 300) ? null : <path key={"f" + i} d={`M ${p.x} ${p.y} q ${-10 * d} ${-16 * d} ${-18 * d} ${-10 * d} M ${p.x} ${p.y} q ${10 * d} ${-16 * d} ${18 * d} ${-10 * d} M ${p.x} ${p.y} l 0 ${-20 * d}`} stroke="#4f7a38" strokeWidth={3 * d} fill="none" />);
  } else if (biome === "river") {
    // The Chattahoochee runs across the back; you're on a gravel bar
    k(<rect key="water" x={0} y={H} width={400} height={80} fill="#4f86a0" />);
    for (let i = 0; i < 10; i++) k(<path key={"w" + i} d={`M ${r() * 400} ${H + 12 + r() * 60} q 8 -3 16 0 q 8 3 16 0`} stroke="#cfe7ee" strokeWidth="1.6" fill="none" opacity="0.5" />);
    k(<path key="edge" d={`M -10 ${H + 80} Q 120 ${H + 66} 240 ${H + 82} Q 330 ${H + 92} 410 ${H + 76} L 410 ${H + 96} L -10 ${H + 96} Z`} fill="#c2b493" />);
    scatter(60, (p, d, i) => p.y < H + 90 ? null : <ellipse key={"g" + i} cx={p.x} cy={p.y} rx={(3 + r() * 4) * d} ry={(2 + r() * 2) * d} fill={["#8d8576", "#a59b86", "#6f6a60"][i % 3]} />);
  }
  return els;
}

export function BattleBackdrop({ biome }) {
  const s = SCENES[biome]; if (!s) return null;
  const r = rng([...biome].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 2147483646 + 1);
  return (
    <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: -1 }}>
      <defs>
        <linearGradient id={"sky-" + biome} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.sky[0]} /><stop offset="1" stopColor={s.sky[1]} /></linearGradient>
        <linearGradient id={"gr-" + biome} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.ground[0]} /><stop offset="1" stopColor={s.ground[1]} /></linearGradient>
      </defs>
      <rect width="400" height={H + 2} fill={`url(#sky-${biome})`} />
      <rect y={H} width="400" height={600 - H} fill={`url(#gr-${biome})`} />
      {horizon(biome, s, r)}
      {details(biome, r)}
      {/* a soft haze near the horizon, and a slight darkening so the boxes and log stay readable */}
      <rect y={H} width="400" height="60" fill={s.sky[1]} opacity="0.18" />
      <rect width="400" height="600" fill="#0b1020" opacity="0.15" />
    </svg>
  );
}
