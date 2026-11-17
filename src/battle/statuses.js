// ─── Statuses ────────────────────────────────────────────────────────────────
// One clock for battle and world: a battle turn is worth 5 minutes. Each status a
// creature has is a list of copies, each with its own clock; all copies count down
// together and the level is how many are running (most stack up to 3). After a battle
// the turns left become time; in the next battle the time left becomes turns again.
// The move that causes a status decides how likely it is and how many turns it lasts;
// the status decides what it does. Statuses are added as species get their moves.
export const TURN_MS = 5 * 60 * 1000;
export const STATUS = {
  // 2% of max health a turn per copy (2/4/6%)
  poison:    { name: "Poison",       icon: "☠️", color: "#a855f7", stack: 3, lingers: true },
  // Hesitates 20/30/40% of turns; elemental moves 25% weaker
  fear:      { name: "Fear",         icon: "😨", color: "#94a3b8", stack: 3, lingers: true },
  // Physical moves 30/40/50% less accurate
  blind:     { name: "Blind",        icon: "🌫️", color: "#a8a29e", stack: 3, lingers: true },
  // Loses its next action, takes 25% more damage until it's up; can't be knocked down again for 2 turns
  knocked:   { name: "Knocked down", icon: "💫", color: "#fbbf24", stack: 1, extend: false, lingers: false },
  // No healing of any kind
  festering: { name: "Festering",    icon: "🩸", color: "#b45309", stack: 1, extend: true, lingers: true },
  // Can't use elemental moves
  mute:      { name: "Mute",         icon: "🔇", color: "#64748b", stack: 1, extend: true, lingers: true },
  // 33/45/55% chance to hurt itself instead of acting
  confusion: { name: "Confusion",    icon: "💫", color: "#e879f9", stack: 3, lingers: true },
  // Dawn Chorus: can't become drowsy
  awake:     { name: "Wide awake",   icon: "🌅", color: "#fcd34d", stack: 1, extend: true, lingers: false, self: true },
  // Can't flee or swap out; Speed −20/−35%; at 3 it's Bound: can't dodge or use physical moves
  tangle:    { name: "Tangle",       icon: "🌿", color: "#65a30d", stack: 3, lingers: true },
  // Loses 3% of its max health a round to the creature that leeched it, while that one is still fighting
  leech:     { name: "Leech",        icon: "🩸", color: "#16a34a", stack: 1, extend: true, lingers: false },
  // Speed −20%; falls asleep after 2 rounds (1 at level 2, at once at level 3)
  drowsy:    { name: "Drowsy",       icon: "😪", color: "#a78bfa", stack: 3, lingers: true },
  // Loses its actions until it wakes (or is hit)
  asleep:    { name: "Asleep",       icon: "💤", color: "#818cf8", stack: 1, extend: false, lingers: false },
  // Deep Crown: survives one knockout with 1 HP, and heals 5% a round
  deepcrown: { name: "Deep crown",   icon: "🌱", color: "#84cc16", stack: 1, extend: false, lingers: false, self: true },
  // Toxic Hide's coat: anything that hits it with a physical move may be poisoned
  toxichide: { name: "Toxic hide",   icon: "🛡️", color: "#c084fc", stack: 1, extend: true, lingers: false, self: true },
};
export const FEAR_CHANCE = [0, 0.2, 0.3, 0.4];
export const BLIND_ACC = [1, 0.7, 0.6, 0.5];
export const CONFUSE_CHANCE = [0, 0.33, 0.45, 0.55];

export const level = (fx, id) => (fx || []).filter(f => f.id === id).length;
export const has = (fx, id) => (fx || []).some(f => f.id === id);

// Add a status from a move: a new copy (stacking), more turns on the end (extend), or nothing
export function addStatus(fx, id, turns, extra = {}) {
  const def = STATUS[id], list = [...(fx || [])], mine = list.filter(f => f.id === id);
  if (!def) return { fx: list, added: false };
  if (def.stack > 1) {
    if (mine.length >= def.stack) { const oldest = mine.reduce((a, b) => (a.turns <= b.turns ? a : b)); list.splice(list.indexOf(oldest), 1); }
    list.push({ id, turns, ...extra });
    return { fx: list, added: true, level: Math.min(def.stack, mine.length + 1) };
  }
  if (mine.length) {
    if (!def.extend) return { fx: list, added: false };
    return { fx: list.map(f => (f === mine[0] ? { ...f, turns: f.turns + turns } : f)), added: true, level: 1 };
  }
  list.push({ id, turns, ...extra });
  return { fx: list, added: true, level: 1 };
}
// One turn passes: every copy counts down; those that run out are removed
export function tickTurn(fx) {
  const next = [], ended = [];
  for (const f of fx || []) { const t = f.turns - 1; if (t > 0) next.push({ ...f, turns: t }); else ended.push(f.id); }
  return { fx: next, ended: ended.filter(id => !next.some(f => f.id === id)) };
}
export const statusText = (id, lv = 1) => STATUS[id] ? STATUS[id].name + (lv > 1 ? " " + lv : "") : id;

// ── Between battle and world
// A creature keeps its lasting statuses as time left: [{id, ms}]
export const toWorld = fx => (fx || []).filter(f => STATUS[f.id]?.lingers && f.turns > 0).map(f => ({ id: f.id, ms: f.turns * TURN_MS }));
export const toBattle = statuses => (statuses || []).filter(s => s.ms > 0).map(s => ({ id: s.id, turns: Math.max(1, Math.ceil(s.ms / TURN_MS)) }));

// Time passes outside battle. `rate`: 1 on the vine, 0.5 asleep in the bag, 2 resting at home.
// Poison keeps hurting while it lasts (2% of health per copy each 5 minutes). At home, in its
// pod by the mother plant, it can't die of it; anywhere else it can.
export function tickStatuses(c, ms, rate = 1, { home = false } = {}) {
  const list = c.statuses || [];
  if (!list.length) return c;
  const t = ms * rate;
  let hp = c.hp ?? 1, diedOfPoison = false;
  for (const s of list) if (s.id === "poison") hp -= 0.02 * Math.min(s.ms, t) / TURN_MS;
  if (hp <= 0) { if (home) hp = 0.01; else { hp = 0; diedOfPoison = list.some(s => s.id === "poison"); } }
  const statuses = list.map(s => ({ ...s, ms: s.ms - t })).filter(s => s.ms > 0);
  return { ...c, hp: Math.min(c.hp ?? 1, hp), statuses, ...(diedOfPoison ? { diedOfPoison: true } : {}) };
}
export const canHeal = c => !(c.statuses || []).some(s => s.id === "festering");
// What the card shows: each status with its level and time left
export function statusSummary(c) {
  const by = new Map();
  for (const s of c.statuses || []) { const e = by.get(s.id) || { id: s.id, n: 0, ms: 0 }; e.n++; e.ms = Math.max(e.ms, s.ms); by.set(s.id, e); }
  return [...by.values()];
}

// ── Stamina: hidden in battle, a word on the card. Moves spend it; it comes back with rest.
// Species set how much (stamina) and the Stamina gene adds or takes about 10%.
export function maxStamina(c, sp) {
  const gene = c.dna?.stamina ?? 1, k = 0.9 + 0.2 * Math.max(0, Math.min(1, (gene - 0.6) / 0.8));
  return Math.round(100 * (sp?.stamina ?? 1) * k);
}
export const STAMINA_TIRING = 0.25, STAMINA_BACK = 0.3;
// Outside battle: 10% back every 5 minutes on the vine (half in the bag, double at home), slower when hungry
export function restoreStamina(c, ms, rate = 1) {
  if ((c.stamina ?? 1) >= 1 && !c.fatigued) return c;
  const k = (c.fullness ?? 1) < 0.3 ? 0.5 : 1;
  const stamina = Math.min(1, (c.stamina ?? 1) + 0.1 * (ms * rate / TURN_MS) * k);
  return { ...c, stamina, fatigued: c.fatigued && stamina < STAMINA_BACK };
}
export const staminaWord = c => c.fatigued || (c.stamina ?? 1) < 0.3 ? "Exhausted" : (c.stamina ?? 1) < 0.7 ? "Winded" : "Fresh";
