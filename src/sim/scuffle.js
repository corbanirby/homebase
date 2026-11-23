// ─── Scuffles: battles at home, run off screen with the real battle rules ─────
// Food fights stop when one gives up (by default at half health), so nobody faints.
// Hunts (Behavior stage, part 5) run to the end. Both sides pick moves like a wild creature.
import { makeBattler, executeBattleMove, endOfRound, aiPickMove, goesFirst } from "../battle/engine.js";
import { xpForWin } from "../creatures/leveling.js";

export function scuffle(a, b, { giveUpAt = 0.5, maxRounds = 30, escape = null } = {}) {
  let A = makeBattler(a), B = makeBattler(b);
  const quit = x => x.battleHp <= x.maxHp * giveUpAt;
  let rounds = 0, escaped = false;
  for (; rounds < maxRounds && !quit(A) && !quit(B); rounds++) {
    const aFirst = goesFirst(A, B);
    const order = aFirst ? [["A", "B"], ["B", "A"]] : [["B", "A"], ["A", "B"]];
    for (const [x, y] of order) {
      const att = x === "A" ? A : B, def = y === "A" ? A : B;
      if (quit(att) || quit(def)) break;
      const move = aiPickMove(att, def);
      if (!move) continue;
      const r = executeBattleMove(att, def, move);
      if (x === "A") { A = r.newAttacker; B = r.newDefender; } else { B = r.newAttacker; A = r.newDefender; }
    }
    A = endOfRound(A).b; B = endOfRound(B).b;
    // A hunted creature may slip away partway (faster ones more often)
    if (escape && escape(A, B, rounds)) { escaped = true; break; }
  }
  const aLost = quit(A) && !quit(B) ? true : quit(B) && !quit(A) ? false : A.battleHp / A.maxHp < B.battleHp / B.maxHp;
  return {
    winner: escaped ? null : aLost ? "b" : "a", escaped, rounds,
    aHp: Math.max(0, A.battleHp / A.maxHp), bHp: Math.max(0, B.battleHp / B.maxHp),
    // What each would earn for beating the other in the wild
    aXp: xpForWin(B), bXp: xpForWin(A),
  };
}
