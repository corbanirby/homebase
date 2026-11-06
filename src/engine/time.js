import { TICK_MS, MAX_CATCHUP_MS, HEAL_RATE, BREED_TICKS } from "../config.js";

// ─── Catch-up ─────────────────────────────────────────────────────────────────
// Runs when you come back after the game was closed or hidden. Instead of
// replaying every step, each system works out where it would be now.
// This covers resting; plants and land have their own catch-up; later stages add aging, hunger,
// eggs and births, each as its own step here.
export function catchUp(state, awayMs) {
  const ms = Math.max(0, Math.min(awayMs, MAX_CATCHUP_MS));
  const ticks = Math.floor(ms / TICK_MS);
  if (ticks <= 0) return { state, report: null };

  let healed = 0;
  const inventory = state.inventory.map(c => {
    const hp = Math.min(1, (c.hp || 0) + HEAL_RATE * ticks);
    if ((c.hp || 0) < 1 && hp >= 1) healed++;
    return { ...c, hp, breedCooldown: Math.max(0, (c.breedCooldown ?? BREED_TICKS) - ticks) };
  });

  const lines = [];
  if (healed) lines.push(`${healed} ${healed === 1 ? "creature" : "creatures"} in your bag rested back to full health`);
  const report = { awayMs: ms, lines };
  return { state: { ...state, inventory }, report };
}

export function formatDuration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "less than a minute";
  if (m < 60) return m + (m === 1 ? " minute" : " minutes");
  const h = Math.floor(m / 60);
  if (h < 24) return h + (h === 1 ? " hour" : " hours") + (m % 60 ? " " + (m % 60) + " min" : "");
  const d = Math.floor(h / 24);
  return d + (d === 1 ? " day" : " days") + (h % 24 ? " " + (h % 24) + " h" : "");
}
