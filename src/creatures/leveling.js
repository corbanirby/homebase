// ─── Levels and experience (decided November 20) ─────────────────────────────
// Level is a counter that only goes up. `xp` is the progress toward the next level.
// Each level costs about (2 + level/5) wins against an evenly matched foe, times the
// species' growth group and the creature's XP-rate gene (0.85–1.15).
import { SPECIES } from "./species.jsx";

export const GROWTH = { fast: 0.75, medium: 1, slow: 1.3, veryslow: 1.6 };
// The one tuning number: how many even wins a level costs (raise or lower to speed everything up or down)
export const winsPerLevel = L => 2 + L / 5;
export const xpRateOf = c => Math.max(0.7, Math.min(1.3, c.dna?.xpRate ?? 1));
export const growthOf = c => GROWTH[SPECIES[c.species]?.growth] ?? 1;
// XP a win pays against a foe of this strength
export const winXp = strength => 20 + 8 * strength;
export function xpToNext(c, L = c.level || 1) {
  return Math.max(1, Math.floor(winXp(L) * winsPerLevel(L) * growthOf(c) * xpRateOf(c)));
}
// Add experience: levels up as many times as it covers
export function addXp(c, gained) {
  let level = c.level || 1, xp = (c.xp || 0) + gained, need = xpToNext(c, level);
  while (xp >= need) { xp -= need; level++; need = xpToNext(c, level); }
  return { level, xp: Math.floor(xp) };
}
// Strength: the level an average adult with average genes would need for this stat total
// (an average adult's six stats add up to about 40 + 21.5 × level)
export function strengthOf(b) {
  const total = (b.maxHp || 0) + (b.atk || 0) + (b.def || 0) + (b.ele || 0) + (b.res || 0) + (b.spd || 0);
  return Math.max(1, (total - 40) / 21.5);
}
// XP for beating a foe: from its strength, worth half against one half as strong as yours, up to double against a much stronger one
export function xpForWin(mine, foe) {
  const sf = strengthOf(foe), sm = strengthOf(mine);
  return Math.max(1, Math.round(winXp(sf) * Math.max(0.5, Math.min(2, sf / sm))));
}
// Saves from before November 20: xp was a running total at 100 × the old XP-rate gene (0.5–1.5) per level.
// Keep the level and how far it was into it; squeeze the XP-rate gene into 0.85–1.15.
const squeeze = v => (v == null ? v : 1 + (v - 1) * 0.3);
export function migrateLeveling(c) {
  if (c.levelV >= 2) return c;
  const out = { ...c, levelV: 2 };
  if (c.dna) out.dna = { ...c.dna, xpRate: squeeze(c.dna.xpRate) };
  if (c.genome?.xpRate) out.genome = { ...c.genome, xpRate: c.genome.xpRate.map(squeeze) };
  if (!c.isEgg) {
    const oldNeed = Math.max(1, Math.floor(100 * (c.dna?.xpRate ?? 1))), lv = c.level || 1;
    const frac = Math.max(0, Math.min(0.99, ((c.xp || 0) - (lv - 1) * oldNeed) / oldNeed));
    out.xp = Math.floor(frac * xpToNext(out, lv));
  }
  return out;
}
