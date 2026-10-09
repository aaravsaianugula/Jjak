/**
 * The adjustment policy (Hunicke's Hamlet) and pacing (Left 4 Dead's AI Director).
 *
 *   target = designedBase(n)                       the authored sawtooth curve
 *          + skillOffset                           clamp(R − chapterMean(n), ±0.2) · confidence
 *            (measured against the chapter's average, so the sawtooth's peaks and rests
 *            survive and a player of skill R averages boards of difficulty R)
 *          + pacing                                from the flow state (flow.ts):
 *                                                  struggling → relief −0.08 (−0.14 after 2+ struggles)
 *                                                  frozen     → ease −0.05
 *                                                  after a peak or festival → breather −0.06
 *                                                  bored (3+ quick clean clears) → stretch +0.08
 *                                                  rushing    → none (their quick clears aren't
 *                                                  boredom; the challenge leans on decoys instead)
 *          + flow                                  a nudge (±0.1, over the last 20 boards) toward an 80 % clean-clear rate,
 *            "clean" being clean or a light assist (one hint on a quick clear, model.ts):
 *            a hint on a slow clear counts as a miss, so hints never earn a harder board;
 *            stretch boards follow strictly clean streaks only.
 *
 * mapped to the tier (0–4) whose board difficulty is closest, then:
 *  - a **mastery floor** (`masteryFloor`): never below the tier the player has shown,
 *    with confidence, they can handle (rating − 2·dev − 0.05), unless they are
 *    struggling or frozen right now. It rises as the rating rises and the deviation
 *    shrinks, so nobody is trapped on the gentlest tier.
 *  - **hysteresis**: the previous board's tier is kept unless another is clearly closer
 *    (by `hold`), so measurement scatter between levels doesn't flip tiers;
 *  - **smooth steps**: at most one tier from the previous Journey board, always.
 *
 * The aim is 75–85 % of boards cleared without assists, with real peaks (the curve's
 * sawtooth) and rests. The tier is the main control; the `ChallengeRequest`
 * (challenge.ts) only says what to lean on inside it and never changes it.
 *
 * Pinning: a level's tier is fixed the first time it is started (`save.analytics.tiers`,
 * char n−1), and its challenge beside it (`foci`), so a retry or replay is the same board. After two failed attempts at an
 * uncleared level (quits or restarts, counted in `save.analytics.tries`), it is re-pinned
 * one tier lower. Levels 1–6 (the teaching levels) are always tier 2.
 */
import { save, persist } from '../services/storage';
import type { AnalyticsSave } from '../services/save-analytics';
import { TIERS, bankSpec } from './bank';
import { type ChallengeRequest, noteChallenge, pinChallenge, pinnedChallenge, planChallenge, plainChallenge } from './challenge';
import { flowState } from './flow';
import { MODEL, cleanCredit, engagement, isClean } from './model';
import { designedBase, levelPlan } from './plan';
import { LEVELS_PER_CHAPTER } from '../engine/levels';
import { ROUTE_LEVELS } from '../data/route';

export type { ChallengeRequest, Emphasis } from './challenge';

export interface TierChoice {
  tier: number;
  /** target difficulty 0–1 */
  target: number;
  /** why (dev panel): e.g. 'pinned', 'skill', 'relief', 'stretch', 'breather' */
  reason: string;
  /** what to lean on inside the tier (for the search's fitness; never changes the tier) */
  challenge: ChallengeRequest;
}

export const DIRECTOR = {
  /** teaching levels: always the designed tier */
  fixedUpTo: 6,
  designedTier: 2,
  /** the skill offset is clamped to ± this */
  maxOffset: 0.2,
  relief: 0.08,
  deepRelief: 0.14,
  stretch: 0.08,
  /** after a long silence (frozen) */
  ease: 0.05,
  /** after a peak or festival board */
  breather: 0.06,
  /** fast clean clears in a row before a stretch board */
  stretchAfter: 3,
  /** failed attempts at an uncleared level before re-pinning one tier lower */
  reliefAfterTries: 2,
  /** boards before the skill offset counts in full (shrinks toward the curve before) */
  fullConfidenceAt: 6,
  /** clean-clear target and the window/gain of the flow nudge */
  flowTarget: 0.8,
  flowWindow: 20,
  flowMin: 6,
  /**
   * Aim a touch below skill on average: the sawtooth's peaks cost more clean
   * clears than its rests give back (success is concave above 50 %).
   */
  aim: -0.025,
  flowGain: 1.5,
  flowMax: 0.1,
  /**
   * Hysteresis: keep the last board's tier unless another sits this much closer to the
   * target. Bank boards' measured d scatter a little from level to level, so without it
   * the nearest tier flips back and forth on noise; pacing moves (≥ 0.05) still act.
   */
  hold: 0.035,
  /** mastery floor: rating − devs · dev − margin */
  floorDevs: 2,
  floorMargin: 0.05,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const PEAKS = new Set(['peak', 'festival']);

/** The pinned tier for level n, or null. */
export function pinnedTier(a: AnalyticsSave, n: number): number | null {
  const c = a.tiers.charAt(n - 1);
  return c >= '0' && c <= '4' ? Number(c) : null;
}

export function pinTier(a: AnalyticsSave, n: number, tier: number): void {
  const t = a.tiers.padEnd(n, '.');
  a.tiers = t.slice(0, n - 1) + String(clamp(Math.round(tier), 0, TIERS - 1)) + t.slice(n);
}

/** Board difficulty of level n at tier t: the bank's measured d, else the curve ± 0.1 per tier. */
export function tierD(n: number, t: number): number {
  try {
    const d = bankSpec(n, t).difficulty;
    if (typeof d === 'number' && Number.isFinite(d)) return d;
  } catch {
    /* fall through to the curve */
  }
  return clamp(designedBase(n) + (t - DIRECTOR.designedTier) * MODEL.tierStep, 0, 1);
}

/** The tier whose board difficulty is closest to `target` (ties go to the gentler tier). */
export function tierFor(n: number, target: number): number {
  let best = DIRECTOR.designedTier;
  let gap = Infinity;
  for (let t = 0; t < TIERS; t++) {
    const g = Math.abs(tierD(n, t) - target);
    if (g < gap - 1e-9) {
      gap = g;
      best = t;
    }
  }
  return best;
}

/**
 * The lowest tier level n may get while the player isn't struggling: the highest tier
 * whose board sits at or under the rating's lower confidence bound (R − 2·dev − 0.05).
 * More evidence (smaller dev) and a higher rating raise it.
 */
export function masteryFloor(a: AnalyticsSave, n: number): number {
  const bound = a.rating - DIRECTOR.floorDevs * a.dev - DIRECTOR.floorMargin;
  let floor = 0;
  for (let t = 0; t < TIERS; t++) if (tierD(n, t) <= bound) floor = t;
  return floor;
}

export interface TargetParts {
  base: number;
  skill: number;
  pacing: number;
  flow: number;
  target: number;
  reason: 'skill' | 'relief' | 'stretch' | 'ease' | 'breather';
}

/** Mean designed difficulty of the chapter that holds level n (the sawtooth's centre line). */
export function chapterMean(n: number): number {
  const first = Math.floor((n - 1) / LEVELS_PER_CHAPTER) * LEVELS_PER_CHAPTER + 1;
  let sum = 0;
  for (let k = first; k < first + LEVELS_PER_CHAPTER; k++) sum += designedBase(k);
  return sum / LEVELS_PER_CHAPTER;
}

/**
 * Recent clean-clear rates (null with too little data): `strict` counts no assist at
 * all (the dev panel), `lenient` is the mean clean credit (model.ts `cleanCredit`): an
 * assisted clear counts in part, by how little its assists look like need.
 */
export function cleanRate(a: AnalyticsSave, window = DIRECTOR.flowWindow): { strict: number; lenient: number } | null {
  const rs = a.recent.filter((r) => r.mode !== 'rush').slice(0, window);
  if (rs.length < DIRECTOR.flowMin) return null;
  return { strict: rs.filter(isClean).length / rs.length, lenient: rs.reduce((sum, r) => sum + cleanCredit(r), 0) / rs.length };
}

/**
 * The flow nudge toward the clean-clear target, read on the lenient rate. An early hint
 * on a quick clear counts as it would have without the hint; a hint on a clear at 1.5 ×
 * par or slower counts as a miss, with a smooth ramp between. So a hint can only ever
 * take board difficulty down, never up.
 */
export function flowNudge(rate: { strict: number; lenient: number } | null): number {
  if (!rate) return 0;
  return clamp((rate.lenient - DIRECTOR.flowTarget) * DIRECTOR.flowGain, -DIRECTOR.flowMax, DIRECTOR.flowMax);
}

/** Level n follows a peak or festival the player just played (n − 1), and is not one: breathe. */
export function breatherDue(a: AnalyticsSave, n: number): boolean {
  if (n > ROUTE_LEVELS) return false;
  const prev = a.recent.find((r) => r.mode === 'journey' && r.n > 0);
  return !!prev && prev.n === n - 1 && PEAKS.has(levelPlan(prev.n).role) && !PEAKS.has(levelPlan(n).role);
}

/** The Director's target difficulty for level n, with its parts (pure; for tests and the dev panel). */
export function targetFor(a: AnalyticsSave, n: number): TargetParts {
  const base = designedBase(n);
  const confidence = clamp(a.boards / DIRECTOR.fullConfidenceAt, 0, 1);
  const skill = clamp(a.rating - chapterMean(n), -DIRECTOR.maxOffset, DIRECTOR.maxOffset) * confidence;
  const state = flowState(a).state;
  let pacing = 0;
  let reason: TargetParts['reason'] = 'skill';
  if (state === 'struggling') {
    pacing = -(engagement(a).struggles >= 2 ? DIRECTOR.deepRelief : DIRECTOR.relief);
    reason = 'relief';
  } else if (state === 'frozen') {
    pacing = -DIRECTOR.ease;
    reason = 'ease';
  } else if (breatherDue(a, n)) {
    pacing = -DIRECTOR.breather;
    reason = 'breather';
  } else if (state === 'bored') {
    pacing = DIRECTOR.stretch;
    reason = 'stretch';
  }
  const flow = flowNudge(cleanRate(a));
  return { base, skill, pacing, flow, target: clamp(base + skill + pacing + flow + DIRECTOR.aim * confidence, 0, 1), reason };
}

/** Which tier this player gets for Journey level n (pins it on first call). */
export function chooseTier(n: number): TierChoice {
  const a = save.analytics;
  const out = decide(a, n, (save.stars[n] ?? 0) > 0);
  a.last = { n, tier: out.tier, target: out.target, d: tierD(n, out.tier), reason: out.reason };
  persist();
  return out;
}

/** The pure policy behind chooseTier (mutates `a`: pins, the tries counter and the emphasis record). */
export function decide(a: AnalyticsSave, n: number, cleared: boolean): TierChoice {
  if (n <= DIRECTOR.fixedUpTo) {
    pinTier(a, n, DIRECTOR.designedTier);
    const tier = DIRECTOR.designedTier;
    return { tier, target: designedBase(n), reason: 'intro', challenge: plainChallenge(n, tier, 'intro') };
  }
  const pinned = pinnedTier(a, n);
  if (pinned != null) {
    if (!cleared && a.tries.n === n && a.tries.count >= DIRECTOR.reliefAfterTries && pinned > 0) {
      // Two failed attempts: the same place and idea, one notch gentler, nothing leaned on.
      const tier = pinned - 1;
      pinTier(a, n, tier);
      a.tries = { n, count: 0 };
      const challenge = plainChallenge(n, tier, 'relief-repin');
      pinChallenge(a, challenge);
      noteChallenge(a, challenge);
      return { tier, target: tierD(n, tier), reason: 'relief-repin', challenge };
    }
    return { tier: pinned, target: tierD(n, pinned), reason: 'pinned', challenge: pinnedChallenge(a, n, pinned) };
  }
  const t = targetFor(a, n);
  const calm = t.reason === 'relief' || t.reason === 'ease';
  let tier = tierFor(n, t.target);
  const prev = a.recent.find((r) => r.mode === 'journey' && r.tier >= 0);
  if (prev && tier !== prev.tier && Math.abs(tierD(n, prev.tier) - t.target) <= Math.abs(tierD(n, tier) - t.target) + DIRECTOR.hold) tier = prev.tier;
  if (!calm) tier = Math.max(tier, masteryFloor(a, n));
  // Smooth steps: at most one tier from the last Journey board, so pacing reads as a
  // breath, not a lurch (deep relief comes from the target, and from re-pinning).
  if (prev) tier = clamp(tier, prev.tier - 1, prev.tier + 1);
  pinTier(a, n, tier);
  const role = levelPlan(n).role;
  const quiet = calm || t.reason === 'breather' ? t.reason : role === 'rest' || role === 'tutorial' ? role : null;
  const challenge = planChallenge(a, n, tier, quiet);
  pinChallenge(a, challenge);
  noteChallenge(a, challenge);
  return { tier, target: t.target, reason: t.reason, challenge };
}

/**
 * Count an attempt at Journey level n (the analytics service calls it when a board
 * ends). A quit or restart at an uncleared level adds a failed try; a clear resets it.
 */
export function recordAttempt(a: AnalyticsSave, n: number, ended: 'clear' | 'quit' | 'restart', wasCleared: boolean): void {
  if (ended === 'clear') {
    if (a.tries.n === n) a.tries = { n, count: 0 };
    return;
  }
  if (wasCleared) return;
  a.tries = a.tries.n === n ? { n, count: a.tries.count + 1 } : { n, count: 1 };
}
