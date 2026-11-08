import { getNextId } from "./ids.js";

// ─── Save / load (this browser only) ──────────────────────────────────────────
// Version 3: the homebase is stored as land (conditions per patch), not tiles.
// Version 2 was built around real-world time. `savedAt` is when the world was last
// written; on load, the catch-up step runs for the time since then.
export const SAVE_VERSION = 5; // v5: creatures live at home on real time (stage 3); older worlds start fresh
const SAVE_KEY = "homebase-save-v2"; // key kept across versions; the version lives inside
const OLD_KEYS = ["homebase-save-v1"];

// Older saves can't be carried over to the new world, so they are cleared once.
try { OLD_KEYS.forEach(k => localStorage.removeItem(k)); } catch (e) { /* storage unavailable */ }

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
    const d = migrate(JSON.parse(raw));
    if (d && d.land && Array.isArray(d.land.cells) && d.state && Array.isArray(d.state.creatures)) return d;
  } catch (e) { /* unreadable save */ }
  return null;
}

// Each future format change adds a step here, so old saves are upgraded instead of lost.
// Version 5 changed what a creature is, so worlds from before it start fresh.
function migrate(d) {
  if (!d || typeof d.v !== "number") return null;
  if (d.v === SAVE_VERSION) return d;
  return null;
}

export function writeSave(land, state, worldTime) {
  try {
    const data = {
      v: SAVE_VERSION, savedAt: Date.now(), worldTime, nextId: getNextId(), land,
      state: { ...state, events: [], floats: [] },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return data;
  } catch (e) { return null; }
}

export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

export function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now"; if (m < 60) return m + " min ago";
  const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
  const d = Math.round(h / 24); return d + (d === 1 ? " day ago" : " days ago");
}
