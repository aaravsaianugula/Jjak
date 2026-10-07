/**
 * The Level Director: the one entry point the app uses to get a Journey board.
 *
 *   levelPlan(n)    the level's stable identity (place, role, mechanics, goal,
 *                   shape, par). The same for every player; Map and Home show it.
 *   playLevel(n)    the board this player gets for level n: the identity filled
 *                   in at their skill tier (levels 1–600 from the offline-built
 *                   bank, past 600 from the endless generator). Sync.
 *   prepareLevel(n) the same, but may generate (endless levels, in a worker).
 *
 * Contract frozen in phase 0; the implementations live in ./plan.ts,
 * ./director.ts, ./bank.ts and ./endless.ts.
 */
import { type LevelSpec, journeyLevel } from '../engine/levels';

/** A level's stable identity. Only the board inside it adapts to the player. */
export interface LevelPlan {
  n: number;
  /** the designed difficulty for this level before any player offset, 0–1 */
  base: number;
  /** the spec at the middle tier (tier 2), used for display and as a fallback */
  spec: LevelSpec;
}

export function levelPlan(n: number): LevelPlan {
  const spec = journeyLevel(n);
  return { n, base: 0.5, spec };
}

export function playLevel(n: number): LevelSpec {
  return journeyLevel(n);
}

export async function prepareLevel(n: number): Promise<LevelSpec> {
  return playLevel(n);
}
