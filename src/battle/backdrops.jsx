// ─── Battle backdrops (placeholders) ─────────────────────────────────────────
// One simple painted scene per Atlanta land type, so you can see where you're
// fighting (and whose home ground it is). Drawn in SVG; real art comes later.
// Portrait canvas 400×600: the foe stands up and right (~y 230), yours low and left (~y 470).

// Small seeded random, so a scene looks the same every time
const rng = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const SCENES = {
  forest:  { sky: ["#1f3b2c", "#35583c"], far: "#22402c", ground: ["#3c5a2e", "#2a4020"], pad: "#4d6b37" },
  pine:    { sky: ["#2a3a4a", "#4c6170"], far: "#1d3328", ground: ["#6b5634", "#4d3d24"], pad: "#7d6640" },
  kudzu:   { sky: ["#3c4d3a", "#6f8a5a"], far: "#2f5a27", ground: ["#3f7a2e", "#2c5a20"], pad: "#4f8c38" },
  meadow:  { sky: ["#4a6f8f", "#a9c6cf"], far: "#6f9a4f", ground: ["#7fa652", "#5d8240"], pad: "#94b864" },
  clay:    { sky: ["#5a4a5f", "#c48a62"], far: "#7a4a32", ground: ["#a5532e", "#7d3c22"], pad: "#b8673c" },
  granite: { sky: ["#3f4d63", "#8fa0b3"], far: "#7c8288", ground: ["#8d9194", "#686d70"], pad: "#a1a5a8" },
  shoal:   { sky: ["#35566e", "#86aebf"], far: "#2f5236", ground: ["#3f7590", "#2b5670"], pad: "#9a958a" },
  creek:   { sky: ["#2e4a40", "#6d917c"], far: "#284a32", ground: ["#4c6a38", "#36502a"], pad: "#5e7f45" },
  river:   { sky: ["#3a5a76", "#9bbccc"], far: "#2c4a33", ground: ["#4a7f99", "#336179"], pad: "#7f8a6a" },
};
export const hasBackdrop = biome => !!SCENES[biome];

function details(biome, r) {
  const els = [];
  const k = (el) => els.push(el);
  if (biome === "forest") {
    for (let i = 0; i < 7; i++) { const x = i * 62 + r() * 30 - 10, w = 14 + r() * 10;
      k(<rect key={"t" + i} x={x} y={120} width={w} height={240} fill="#2b2418" opacity="0.8" />);
      k(<circle key={"c" + i} cx={x + w / 2} cy={110 + r() * 30} r={55 + r() * 20} fill="#2c4f2c" opacity="0.9" />); }
    for (let i = 0; i < 25; i++) k(<circle key={"d" + i} cx={r() * 400} cy={380 + r() * 220} r={3 + r() * 5} fill="#a8c46a" opacity="0.18" />);
  } else if (biome === "pine") {
    for (let i = 0; i < 9; i++) { const x = i * 48 + r() * 20, h = 180 + r() * 90, base = 360;
      k(<rect key={"t" + i} x={x - 3} y={base - 40} width={6} height={40} fill="#3a2a1a" />);
      k(<polygon key={"p" + i} points={`${x},${base - h} ${x - 26},${base - 40} ${x + 26},${base - 40}`} fill="#1f3d2a" />); }
    for (let i = 0; i < 40; i++) { const x = r() * 400, y = 390 + r() * 200; k(<line key={"n" + i} x1={x} y1={y} x2={x + 10 + r() * 8} y2={y + r() * 6 - 3} stroke="#8a6f45" strokeWidth="2" opacity="0.45" />); }
  } else if (biome === "kudzu") {
    k(<rect key="pole" x={300} y={80} width={10} height={280} fill="#4a3a2a" />);
    k(<path key="m1" d="M -20 360 Q 60 200 150 300 Q 220 180 330 260 Q 380 160 420 240 L 420 360 Z" fill="#2f6a26" />);
    k(<path key="m2" d="M 270 260 Q 305 70 340 260 Z" fill="#3b7d2e" />);
    for (let i = 0; i < 30; i++) k(<circle key={"f" + i} cx={r() * 400} cy={220 + r() * 140} r={3} fill="#8e5bbf" opacity="0.9" />);
    for (let i = 0; i < 20; i++) k(<path key={"l" + i} d={`M ${r() * 400} ${380 + r() * 200} q 8 -10 16 0 q -8 10 -16 0`} fill="#58a040" opacity="0.6" />);
  } else if (biome === "meadow") {
    k(<path key="h" d="M -20 330 Q 100 270 220 320 Q 320 280 420 320 L 420 360 L -20 360 Z" fill="#5f8a44" />);
    for (let i = 0; i < 60; i++) { const x = r() * 400, y = 370 + r() * 230; k(<line key={"g" + i} x1={x} y1={y} x2={x + r() * 6 - 3} y2={y - 10 - r() * 8} stroke="#4e7334" strokeWidth="2" />); }
    for (let i = 0; i < 25; i++) k(<circle key={"f" + i} cx={r() * 400} cy={360 + r() * 240} r={2.5} fill={["#f4e27a", "#ffffff", "#e9a3c9"][i % 3]} />);
  } else if (biome === "clay") {
    k(<path key="h" d="M -20 320 Q 120 290 220 330 Q 320 300 420 330 L 420 360 L -20 360 Z" fill="#8f4a2c" />);
    for (let i = 0; i < 14; i++) { const x = r() * 400, y = 380 + r() * 220; k(<path key={"c" + i} d={`M ${x} ${y} l ${10 + r() * 20} ${r() * 8 - 4} l ${8 + r() * 12} ${r() * 10 - 5}`} stroke="#6a2f18" strokeWidth="2" fill="none" />); }
    for (let i = 0; i < 6; i++) { const x = r() * 400, y = 330 + r() * 40; k(<path key={"s" + i} d={`M ${x} ${y} q 6 -18 12 0 q 6 -14 12 0`} stroke="#5f6b34" strokeWidth="3" fill="none" />); }
  } else if (biome === "granite") {
    k(<path key="dome" d="M -40 360 Q 200 120 440 360 Z" fill="#7a8087" />);
    k(<path key="dome2" d="M 40 360 Q 200 200 360 360 Z" fill="#868c92" opacity="0.6" />);
    for (let i = 0; i < 20; i++) k(<circle key={"l" + i} cx={r() * 400} cy={240 + r() * 340} r={3 + r() * 6} fill={i % 2 ? "#b4b85a" : "#c9c6a8"} opacity="0.45" />);
    k(<ellipse key="pool" cx={300} cy={540} rx={40} ry={9} fill="#5f7f96" opacity="0.8" />);
  } else if (biome === "shoal" || biome === "river") {
    const river = biome === "river";
    k(<rect key="bank" x={0} y={300} width={400} height={50} fill="#4f6a3a" />);
    for (let i = 0; i < 10; i++) k(<circle key={"t" + i} cx={i * 45 + r() * 20} cy={300} r={22 + r() * 14} fill="#2c4a30" />);
    for (let i = 0; i < 18; i++) { const x = r() * 400, y = 370 + r() * 220; k(<path key={"w" + i} d={`M ${x} ${y} q 10 -4 20 0 q 10 4 20 0`} stroke="#bfe0ea" strokeWidth="2" fill="none" opacity="0.5" />); }
    if (!river) for (let i = 0; i < 7; i++) k(<ellipse key={"r" + i} cx={r() * 400} cy={380 + r() * 200} rx={14 + r() * 16} ry={6 + r() * 5} fill="#8a857a" />);
  } else if (biome === "creek") {
    k(<path key="water" d="M 120 360 Q 160 450 120 600 L 260 600 Q 220 470 250 360 Z" fill="#3f6f86" />);
    for (let i = 0; i < 8; i++) { const y = 380 + i * 26; k(<path key={"w" + i} d={`M ${150 + r() * 40} ${y} q 8 -3 16 0`} stroke="#bfe0ea" strokeWidth="2" fill="none" opacity="0.5" />); }
    for (let i = 0; i < 6; i++) k(<circle key={"t" + i} cx={i * 80 + r() * 30} cy={200 + r() * 40} r={60 + r() * 20} fill="#24452c" opacity="0.9" />);
    for (let i = 0; i < 12; i++) { const x = r() < 0.5 ? r() * 100 : 290 + r() * 110, y = 380 + r() * 200; k(<path key={"f" + i} d={`M ${x} ${y} q -10 -16 -18 -10 M ${x} ${y} q 10 -16 18 -10 M ${x} ${y} l 0 -20`} stroke="#5f8c46" strokeWidth="3" fill="none" />); }
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
      <rect width="400" height="360" fill={`url(#sky-${biome})`} />
      <rect y="250" width="400" height="110" fill={s.far} opacity="0.5" />
      <rect y="350" width="400" height="250" fill={`url(#gr-${biome})`} />
      {details(biome, r)}
      {/* darken the bottom a little so the log and buttons stay readable */}
      <rect y="0" width="400" height="600" fill="#0b1020" opacity="0.18" />
    </svg>
  );
}
