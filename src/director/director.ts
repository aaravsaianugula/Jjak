/**
 * The adjustment policy (Hunicke's Hamlet) and pacing (Left 4 Dead's AI Director).
 *
 *   target = designedBase(n)                       the authored sawtooth curve
 *          + skillOffset                           clamp(R − base, ±0.2) · confidence
 *          + pacing                                relief −0.1 (−0.15 after 2+ struggles in a row)
 *                                                  after struggle; stretch +0.1 after 3+ fast clean clears
 *          + flow                                  a small nudge (±0.04) toward an 80 % clean-clear rate
 *
 * mapped to the tier (0–4) whose board difficulty is closest. The aim is 75–85 % of
 * boards cleared without assists, with real peaks (the curve's sawtooth) and rests.
 *
 * Pinning: a level's tier is fixed the first time it is started (`save.analytics.tiers`,
 * char n−1), so a retry or replay is the same board. After two failed attempts at an
 * uncleared level (quits or restarts, counted in `save.analytics.tries`), it is re-pinned
 * one tier lower. Levels 1–6 (the teaching levels) are always tier 2.
 */
import { save, persist } from '../services/storage';
import type { AnalyticsSave } from '../services/save-analytics';
import { TIERS, bankSpec } from './bank';
import { MODEL, engagement, isClean } from './model';
import { designedBase } from './plan';

export interface TierChoice {
  tier: number;
  /** target difficulty 0–1 */
  target: number;
  /** why (dev panel): e.g. 'pinned', 'skill', 'relief', 'stretch' */
  reason: string;
}

export const DIRECTOR = {
  /** teaching levels: always the designed tier */
  fixedUpTo: 6,
  designedTier: 2,
  /** the skill offset is clamped to ± this */
  maxOffset: 0.2,
  relief: 0.1,
  deepRelief: 0.15,
  stretch: 0.1,
  /** fast clean clears in a row before a stretch board */
  stretchAfter: 3,
  /** failed attempts at an uncleared level before re-pinning one tier lower */
  reliefAfterTries: 2,
  /** boards before the skill offset counts in full (shrinks toward the curve before) */
  fullConfidenceAt: 6,
  /** clean-clear target and the window/gain of the flow nudge */
  flowTarget: 0.8,
  flowWindow: 12,
  flowMin: 6,
  flowGain: 0.25,
  flowMax: 0.04,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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

export interface TargetParts {
  base: number;
  skill: number;
  pacing: number;
  flow: number;
  target: number;
  reason: 'skill' | 'relief' | 'stretch';
}

/** Recent clean-clear rate (null with too little data). */
export function cleanRate(a: AnalyticsSave, window = DIRECTOR.flowWindow): number | null {
  const rs = a.recent.filter((r) => r.mode !== 'rush').slice(0, window);
  return rs.length >= DIRECTOR.flowMin ? rs.filter(isClean).length / rs.length : null;
}

/** The Director's target difficulty for level n, with its parts (pure; for tests and the dev panel). */
export function targetFor(a: AnalyticsSave, n: number): TargetParts {
  const base = designedBase(n);
  const confidence = clamp(a.boards / DIRECTOR.fullConfidenceAt, 0, 1);
  const skill = clamp(a.rating - base, -DIRECTOR.maxOffset, DIRECTOR.maxOffset) * confidence;
  const eng = engagement(a);
  let pacing = 0;
  let reason: TargetParts['reason'] = 'skill';
  if (eng.mood === 'struggling') {
    pacing = -(eng.struggles >= 2 ? DIRECTOR.deepRelief : DIRECTOR.relief);
    reason = 'relief';
  } else if (eng.streak >= DIRECTOR.stretchAfter) {
    pacing = DIRECTOR.stretch;
    reason = 'stretch';
  }
  const rate = cleanRate(a);
  const flow = rate == null ? 0 : clamp((rate - DIRECTOR.flowTarget) * DIRECTOR.flowGain, -DIRECTOR.flowMax, DIRECTOR.flowMax);
  return { base, skill, pacing, flow, target: clamp(base + skill + pacing + flow, 0, 1), reason };
}

/** Which tier this player gets for Journey level n (pins it on first call). */
export function chooseTier(n: number): TierChoice {
  const a = save.analytics;
  const out = decide(a, n, (save.stars[n] ?? 0) > 0);
  a.last = { n, tier: out.tier, target: out.target, d: tierD(n, out.tier), reason: out.reason };
  persist();
  return out;
}

/** The pure policy behind chooseTier (mutates `a`: pins and the tries counter). */
export function decide(a: AnalyticsSave, n: number, cleared: boolean): TierChoice {
  if (n <= DIRECTOR.fixedUpTo) {
    pinTier(a, n, DIRECTOR.designedTier);
    return { tier: DIRECTOR.designedTier, target: designedBase(n), reason: 'intro' };
  }
  const pinned = pinnedTier(a, n);
  if (pinned != null) {
    if (!cleared && a.tries.n === n && a.tries.count >= DIRECTOR.reliefAfterTries && pinned > 0) {
      // Two failed attempts: the same place and idea, one notch gentler.
      const tier = pinned - 1;
      pinTier(a, n, tier);
      a.tries = { n, count: 0 };
      return { tier, target: tierD(n, tier), reason: 'relief-repin' };
    }
    return { tier: pinned, target: tierD(n, pinned), reason: 'pinned' };
  }
  const t = targetFor(a, n);
  const tier = tierFor(n, t.target);
  pinTier(a, n, tier);
  return { tier, target: t.target, reason: t.reason };
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
