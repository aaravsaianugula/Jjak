/**
 * What a bank alternate leans on, and which alternates a slot keeps (scripts/build-bank.ts).
 * The Director's ChallengeRequest later reads the same leans back (src/director/tailor.ts).
 */
import { type Knobs, type LevelPlan } from '../../src/director/plan';
import { FEATURE_KEYS, type ReadingFeatures } from '../../src/director/reading';
import { MECH_KNOBS, mechLean } from '../../src/director/tailor';

/** Tailoring alternates kept per (level, tier). */
export const ALTERNATES = 2;
/** an alternate must add at least this much lean (summed over what it leans on more) */
export const MIN_LEAN = 0.08;

/**
 * What a board leans on, as one vector: its reading features, then each counted mechanic
 * (tailor.ts MECH_KNOBS) where it sits in the level's range, as the Director reads it.
 */
export function leanVector(plan: LevelPlan, knobs: Knobs, f: ReadingFeatures): number[] {
  return [...FEATURE_KEYS.map((k) => f[k]), ...MECH_KNOBS.map((k) => mechLean(plan, knobs, k) ?? 0)];
}

/**
 * Greedy: up to ALTERNATES candidates that each lean at least MIN_LEAN more (summed over
 * every entry where they lean more) than the primary and the alternates kept before them.
 * `top` is the primary's lean vector. Reorders `cands`.
 */
export function pickAlternates<T extends { v: number[] }>(top: number[], cands: T[]): T[] {
  const kept: T[] = [];
  let reach = top;
  for (let k = 0; k < ALTERNATES && cands.length; k++) {
    const gain = (v: number[]) => v.reduce((s, x, i) => s + Math.max(0, x - reach[i]), 0);
    cands.sort((a, b) => gain(b.v) - gain(a.v));
    const best = cands.shift()!;
    if (gain(best.v) < MIN_LEAN) break;
    kept.push(best);
    reach = reach.map((x, i) => Math.max(x, best.v[i]));
  }
  return kept;
}
