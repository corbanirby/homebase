// ─── DNA ─────────────────────────────────────────────────────────────────────
export function randomDNA() {
  return { hue:Math.random()*360, saturation:60+Math.random()*40, size:0.7+Math.random()*0.6,
    speed:0.6+Math.random()*0.8, lifespan:0.7+Math.random()*0.6, fertility:0.4+Math.random()*0.6,
    strength:0.4+Math.random()*0.6, aggression:0.2+Math.random()*0.8,
    metabolism:0.4+Math.random()*1.2,
    reproRate:0.4+Math.random()*1.2,
    xpRate:0.5+Math.random()*1.0,    // 0.5–1.5: low=levels fast, high=levels slow
    hpRange:0.5+Math.random()*1.0,   // 0.5–1.5: low=fragile/small hp pool, high=tanky
    elemental:0.6+Math.random()*0.8, // 0.6–1.4: power of type moves
    resistance:0.6+Math.random()*0.8,// 0.6–1.4: holding up against type moves
  };
}
export function crossDNA(a,b) {
  const m=v=>v+(Math.random()-0.5)*0.08;
  return { hue:(Math.random()<0.5?a.hue:b.hue)+(Math.random()-0.5)*18,
    saturation:m((a.saturation+b.saturation)/2), size:m((a.size+b.size)/2),
    speed:m((a.speed+b.speed)/2), lifespan:m((a.lifespan+b.lifespan)/2),
    fertility:m((a.fertility+b.fertility)/2), strength:m((a.strength+b.strength)/2),
    aggression:m((a.aggression+b.aggression)/2),
    metabolism:m(((a.metabolism??1)+(b.metabolism??1))/2),
    reproRate:m(((a.reproRate??1)+(b.reproRate??1))/2),
    xpRate:m(((a.xpRate??1)+(b.xpRate??1))/2),
    hpRange:m(((a.hpRange??1)+(b.hpRange??1))/2) };
}

export function dnaColor(dna,l=55,a=1) {
  const h=((dna.hue%360)+360)%360, s=Math.max(30,Math.min(100,dna.saturation));
  return `hsla(${h},${s}%,${l}%,${a})`;
}
