// ─── World size ───────────────────────────────────────────────────────────────
export const COLS = 32, ROWS = 24;
export const TS = 32; // on-screen size of one tile, in CSS pixels (low top-down view)

// ─── Time ─────────────────────────────────────────────────────────────────────
// The world steps in fixed slices of real time. Everything that changes over time
// runs on these steps, so the world moves at the same speed on any device.
export const TICK_MS = 50;
// When the game was closed or hidden, this is the longest absence the catch-up
// step will process (longer gaps are treated as this long).
export const MAX_CATCHUP_MS = 30 * 24 * 60 * 60 * 1000;

// ─── Game constants ───────────────────────────────────────────────────────────
export const MAX_CREATURES = 36;
export const MAX_PLANTS = 60;
export const PLANT_SPAWN_INTERVAL = 80;
export const CREATURE_LIFESPAN_BASE = 9000; // ticks; becomes real days in stage 3
export const HUNGER_RATE = 0.003;
export const REPRODUCE_COOLDOWN = 300;
export const REPRODUCE_HUNGER_MIN = 0.45;
export const PLANT_ENERGY = 0.45;
export const PLAYER_SPEED = 0.07; // tiles per tick
export const CAPTURE_DIST = 1.8;
export const FIGHT_DIST = 3;
export const COMBAT_BASE_DAMAGE = 0.008;
export const TERRITORY_RADIUS = 3.5; // tiles
export const INVENTORY_MAX = 12;
export const XP_PER_LEVEL = 100;
export const HEAL_RATE = 0.0003; // per tick, for creatures in the bag
export const BREED_TICKS = 6000;
export const BREED_HUE_COMPAT = 60;
export const BREED_MIN_LEVEL = 3;
export const BREED_MAX_BAG = 11;
