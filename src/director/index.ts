/**
 * The Level Director: the one entry point the app uses to get a Journey board.
 *
 *   levelPlan(n)    the level's stable identity (place, role, shape, mechanics,
 *                   goal, par). The same for every player; Map and Home show it.
 *   playLevel(n)    the board this player gets for level n: the identity filled
 *                   in at their skill tier (levels 1–600 from the offline-built
 *                   bank, past 600 from the endless generator). Sync.
 *   prepareLevel(n) the same, but may generate first (endless levels, in a worker).
 *
 * Layers (see docs/EXPANSION_PLAN.md §C1):
 *   plan.ts      authored level grammar + designed difficulty curve
 *   model.ts     player model (rating, per-mechanic proficiency, engagement)
 *   director.ts  adjustment policy: target difficulty → tier, pacing, pinning
 *   search.ts    candidates + bots + fitness (offline bank builder and endless)
 *   validate.ts  hard gates
 *   bank.ts      the shipped level bank (1–600 × 5 tiers)
 *   endless.ts   levels past 600 (C5)
 */
import { ROUTE_LEVELS, routeOf } from '../data/route';
import { type LevelSpec } from '../engine/levels';
import { bankSpec } from './bank';
import { chooseTier } from './director';
import { endlessSpec, prepareEndless } from './endless';
import { levelPlan } from './plan';

export { type LevelPlan, designedBase, levelPlan } from './plan';

export function playLevel(n: number): LevelSpec {
  if (n > ROUTE_LEVELS) return endlessSpec(n);
  return bankSpec(n, chooseTier(n).tier);
}

/**
 * Wanderer years the Map may show for a player at `level` (0 = the first pass only):
 * nothing past 600 until level 600 is behind them.
 */
export const shownYears = (level: number): number => (level > ROUTE_LEVELS ? routeOf(level).year : 0);

/**
 * The spec to *show* for level n (Home, the Map): its identity, or for an endless
 * level the board already made for this player. No side effects (unlike playLevel).
 */
export function shownSpec(n: number): LevelSpec {
  return n > ROUTE_LEVELS ? endlessSpec(n) : levelPlan(n).spec;
}

export async function prepareLevel(n: number): Promise<LevelSpec> {
  if (n > ROUTE_LEVELS) return prepareEndless(n);
  return playLevel(n);
}
