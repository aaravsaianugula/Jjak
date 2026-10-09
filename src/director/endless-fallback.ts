/**
 * The endless road's last resort (EXPANSION_PLAN §C5): the search found nothing
 * valid in time, or a level is played before its board was made. Every board the
 * game serves is solver-proven through the real rules, and so is this one: the
 * bank's board for the same place and slot of the first pass (proven when the bank
 * was built; the tests check every bank board's hash), the nearest tier first.
 *
 * It costs nothing: no board is built or solved here. Proving the identity's own
 * board instead was measured at a p95 of 390 ms on the main thread (building an
 * arranged board alone can take 450 ms), too long for a moment the player waits on.
 *
 * No DOM imports.
 */
import { ROUTE_LEVELS } from '../data/route';
import { type LevelSpec } from '../engine/levels';
import { TIERS, bankEntry, bankSpec } from './bank';
import { levelPlan } from './plan';

export function provenFallback(n: number, tier: number): LevelSpec {
  const tiers = Array.from({ length: TIERS }, (_, t) => t).sort((a, b) => Math.abs(a - tier) - Math.abs(b - tier) || a - b);
  const first = ((n - 1) % ROUTE_LEVELS) + 1;
  // The same place and slot; if the bank lacks it (a level its build couldn't fill) or it
  // is a fixed teaching board, the next levels along the road.
  for (let k = 0; k < ROUTE_LEVELS; k++) {
    const m = ((first - 1 + k) % ROUTE_LEVELS) + 1;
    if (levelPlan(m).fixed) continue;
    for (const t of tiers) if (bankEntry(m, t)) return { ...bankSpec(m, t), number: n };
  }
  throw new Error('the level bank has no boards');
}
