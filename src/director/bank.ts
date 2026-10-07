/**
 * The shipped level bank: levels 1–600 × 5 tiers, built offline (npm run bank).
 * PHASE-0 STUB — the Director agent replaces the body; keep the exports.
 */
import { type LevelSpec } from '../engine/levels';
import { levelPlan } from './plan';

export const TIERS = 5;

/** The validated board spec for level n at tier t (0 gentle … 4 hardest). */
export function bankSpec(n: number, tier: number): LevelSpec {
  return { ...levelPlan(n).spec, tier };
}
