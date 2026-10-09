/**
 * Tailoring inside the tier (EXPANSION_PLAN §C1, Part 1B): the Director's
 * `ChallengeRequest` picks, among the bank's pre-measured boards for a level and tier
 * (bank.ts alternates), the one that leans most on the player's blind spot:
 *
 *   shape:twoBend / detour / edge          more of the path shape they read slowest
 *   decoys                                  more believable wrong pairs (for a rusher)
 *   mech:<id>                               more of a weaker mechanic, inside the level's
 *                                           own range (only levels that have it)
 *
 * Scan-region requests (region:*) are served the tier's own board: the bank measures
 * where key pairs sit (reading.ts keyCentre…keyBottom), but against the scanner personas
 * that lean showed no effect (tests/persona-tailoring.test.ts), so it is not used until
 * a scan-region measure is shown to work.
 *
 * It adds challenge inside the tier and never replaces it: every candidate is a
 * validated, solver-proven board with a foothold, within `maxDGap` of the tier's d.
 * The choice is a pure function of (level, tier, focus, weight), all pinned with the
 * tier (challenge.ts), so a retry or replay is the same board. Daily, Rush, Zen and
 * Practice never come here (they don't use the Journey bank through the Director).
 */
import { type BankCandidate, bankCandidates, bankSpec, candidateSpec } from './bank';
import { type ChallengeRequest, type Emphasis } from './challenge';
import { type Knobs, type LevelPlan, knobRange, levelPlan } from './plan';
import { type FeatureKey, type ReadingFeatures } from './reading';
import { type LevelSpec } from '../engine/levels';

export const TAILOR = {
  /** an alternate's d is within this of the tier's board (the bank builder keeps it so) */
  maxDGap: 0.04,
  /** the lean an alternate must add over the tier's board at full weight (more at lower weight) */
  minGain: 0.08,
};

const SHAPE: Partial<Record<string, FeatureKey>> = { twoBend: 'twoBend', detour: 'detour', edge: 'edge' };
const MECH_KNOB: Partial<Record<string, keyof Knobs>> = { stones: 'stones', snow: 'snow', knots: 'knots', gates: 'gates', fences: 'fences' };

/**
 * How much a board leans on an emphasis, 0–1, or null when the emphasis has no
 * measure on this board (no features, a shape the reading doesn't separate, a
 * mechanic the level doesn't have or that has no count).
 */
export function leanOf(f: ReadingFeatures | null, e: Emphasis, knobs: Knobs, plan: LevelPlan): number | null {
  if (e.kind === 'mechanic') {
    const k = MECH_KNOB[e.id];
    if (!k || !(plan.mechanics as string[]).includes(e.id) || typeof knobs[k] !== 'number') return null;
    const [lo, hi] = knobRange(plan)[k as Exclude<keyof Knobs, 'layout'>] as [number, number];
    return hi > lo ? Math.min(1, Math.max(0, ((knobs[k] as number) - lo) / (hi - lo))) : null;
  }
  if (!f) return null;
  if (e.kind === 'shape') {
    const k = SHAPE[e.shape];
    return k ? f[k] : null;
  }
  if (e.kind === 'decoys') return f.decoys;
  return null;
}

export interface Choosable {
  d: number;
  features: ReadingFeatures | null;
  knobs?: Knobs;
}

/**
 * The index of the board to serve: the tier's own (0) unless an alternate within the
 * d tolerance leans clearly more on the request's emphasis (by minGain / weight).
 */
export function chooseCandidate(cands: readonly Choosable[], ch: ChallengeRequest, plan: LevelPlan = levelPlan(ch.n)): number {
  if (ch.weight <= 0 || cands.length < 2) return 0;
  const lean = (c: Choosable) => leanOf(c.features, ch.emphasis, c.knobs ?? ({} as Knobs), plan);
  const base = lean(cands[0]);
  if (base == null) return 0;
  const need = TAILOR.minGain / Math.min(1, ch.weight);
  let best = 0;
  let bestGain = 0;
  cands.forEach((c, i) => {
    if (i === 0 || Math.abs(c.d - cands[0].d) > TAILOR.maxDGap + 1e-9) return;
    const v = lean(c);
    if (v == null) return;
    const gain = v - base;
    if (gain >= need && gain > bestGain) {
      best = i;
      bestGain = gain;
    }
  });
  return best;
}

const choosable = (c: BankCandidate): Choosable => ({ d: c.entry.d, features: c.features, knobs: c.entry.knobs });

/** The board for Journey level n at the pinned tier, tailored by the pinned challenge. */
export function tailoredSpec(n: number, tier: number, ch: ChallengeRequest): LevelSpec {
  const cands = bankCandidates(n, tier);
  const i = cands.length > 1 ? chooseCandidate(cands.map(choosable), ch) : 0;
  return i === 0 ? bankSpec(n, tier) : candidateSpec(n, tier, cands[i].entry);
}
