/**
 * Flow detection (EXPANSION_PLAN §C1, player model): where the player is right now,
 * read from the last few boards against their own norms.
 *
 *   struggling  quits, restarts, assists beyond their habit, far over par
 *   frozen      long silences: the think time before the first pair is far above
 *               their usual, or one pair took many times their usual gap
 *   rushing     quick taps with many fast misreads (blocked taps right after a select)
 *   bored       quick, clean clears in a row
 *   flow        none of these
 *
 * Priority runs in that order: a struggling player is never "bored". Pure; no DOM.
 */
import type { AnalyticsSave, BoardRecord } from '../services/save-analytics';
import { engagement, median } from './model';

export type FlowState = 'flow' | 'bored' | 'struggling' | 'frozen' | 'rushing';

export interface FlowReading {
  state: FlowState;
  /** recency-weighted share (0–1) of recent boards that showed a freeze */
  freeze: number;
  /** recency-weighted share (0–1) of recent boards that showed rushing */
  rush: number;
  /** the player's usual think time and gap between pairs (ms), the norms the signals are read against */
  normFirstMs: number;
  normGapMs: number;
  /** boards it was read from */
  seen: number;
}

export const FLOW = {
  /** boards read, most recent first, and their weights */
  recency: [1, 0.7, 0.5, 0.35, 0.25],
  /** a think time this many times their usual is a freeze */
  thinkFreeze: 2.5,
  /** one pair taking this many times their usual gap is a freeze */
  longFreeze: 8,
  /** fast misreads (quick misses + half the other blocked taps) per pair that read as rushing */
  rushRate: 0.25,
  /** share of recent boards that must show a sign */
  share: 0.5,
  /** easy clears in a row before boredom */
  boredStreak: 3,
  /** norms with no history */
  firstMs: 4000,
  gapMs: 2500,
};

const positive = (xs: number[]) => xs.filter((v) => v > 0);

/** A board showed a freeze, against the player's norms. */
export function frozeOn(r: BoardRecord, normFirstMs: number): boolean {
  const think = r.firstMs > 0 && r.firstMs / normFirstMs >= FLOW.thinkFreeze;
  const long = (r.longMs ?? 0) > 0 && r.gapMs > 0 && (r.longMs ?? 0) / r.gapMs >= FLOW.longFreeze;
  return think || long;
}

/** A board showed rushing: many fast misreads at (or above) the player's usual pace. */
export function rushedOn(r: BoardRecord, normGapMs: number): boolean {
  const misreads = ((r.quickMisses ?? 0) + 0.5 * Math.max(0, r.blocked - (r.quickMisses ?? 0))) / Math.max(1, r.made || r.pairs);
  return misreads >= FLOW.rushRate && (r.gapMs <= 0 || r.gapMs <= normGapMs * 1.1);
}

export function flowState(a: AnalyticsSave): FlowReading {
  const rs = a.recent.filter((r) => r.mode !== 'rush');
  const normFirstMs = median(positive(rs.map((r) => r.firstMs))) || FLOW.firstMs;
  const normGapMs = median(positive(rs.map((r) => r.gapMs))) || FLOW.gapMs;
  const last = rs.slice(0, FLOW.recency.length);
  let w = 0;
  let freeze = 0;
  let rush = 0;
  last.forEach((r, i) => {
    w += FLOW.recency[i];
    if (frozeOn(r, normFirstMs)) freeze += FLOW.recency[i];
    if (rushedOn(r, normGapMs)) rush += FLOW.recency[i];
  });
  freeze = w ? freeze / w : 0;
  rush = w ? rush / w : 0;
  const eng = engagement(a);
  const state: FlowState =
    eng.mood === 'struggling' ? 'struggling'
    : freeze >= FLOW.share ? 'frozen'
    : rush >= FLOW.share ? 'rushing'
    : eng.streak >= FLOW.boredStreak ? 'bored'
    : 'flow';
  return { state, freeze, rush, normFirstMs, normGapMs, seen: last.length };
}
