/**
 * The player model: Hunicke's "evaluation function" (how is this player doing?).
 * Pure functions over `save.analytics` (src/services/save-analytics.ts); nothing
 * here touches the DOM or the network, and nothing ever leaves the device.
 *
 * Three outputs feed the Director (director.ts) and the play-style profile (profile.ts):
 *
 *  1. A **skill rating** R in board-difficulty units (the same 0–1 scale as a bank
 *     board's measured `difficulty`). R is the difficulty at which this player is in
 *     flow: a board with d = R is expected to score `MODEL.atRating`, which is what a
 *     typical clean clear a little over par scores. It is an Elo/Glicko-style update:
 *
 *        E(R, d) = 1 / (1 + exp(-((R − d) / S + logit(atRating))))     expected score
 *        R'      = R + clamp(K · dev · w · (p − E), ±maxStep)          one board
 *        dev'    = max(devMin, dev · devDecay^w)                         more sure
 *        dev     = min(devMax, √(dev² + idle² · days away))             less sure after a break
 *
 *     p is the board's performance score (`performance()`), w the board's weight
 *     (Journey 1, Daily ½, Zen 0.4, replays ½, early abandons 0.3). The step shrinks
 *     with experience (dev), so one bad board can't swing it.
 *  2. **Per-mechanic proficiency**: an exponential average of p over boards with that
 *     mechanic, plus quits and replays (enjoyment), in `save.analytics.mech`.
 *  3. An **engagement signal** from the last few boards: frustration (quits, restarts,
 *     assists, far over par, many blocked taps) vs boredom (fast, clean clears in a row).
 */
import { type LevelSpec } from '../engine/levels';
import { MECHANICS, mechanicsOf } from '../engine/mechanics';
import { type AnalyticsSave, type BoardRecord, DAYS_CAP, RECENT_CAP } from '../services/save-analytics';
import { designedBase } from './plan';

export const MODEL = {
  /** logistic scale in d units: R − d = +S lifts E from 0.70 to ~0.86 */
  scale: 0.1,
  /** expected score on a board exactly at the player's rating (their flow point) */
  atRating: 0.82,
  /** step factor: ΔR = K · dev · w · (p − E) */
  k: 0.5,
  /** largest change one board can make */
  maxStep: 0.05,
  devMin: 0.05,
  devMax: 0.3,
  /** dev shrinks by this factor per full-weight board */
  devDecay: 0.93,
  /** dev grows by √days · this while away */
  devIdle: 0.015,
  /** board weights by mode */
  weight: { journey: 1, daily: 0.5, zen: 0.4, rush: 0 } as Record<BoardRecord['mode'], number>,
  /** replaying an already-cleared board (the player has seen it) */
  replayWeight: 0.5,
  /** per-mechanic score: exponential average factor */
  mechAlpha: 0.2,
  /** one tier step in d units */
  tierStep: 0.1,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const logit = (p: number) => Math.log(p / (1 - p));

export function median(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ───────────────────────────── Board difficulty ─────────────────────────────

/**
 * A rough difficulty for a spec with no measured `difficulty` (old specs, Daily,
 * Zen): board size, flower count, stones and mechanic weights. Clamped 0.05–0.95.
 */
export function estimateD(spec: LevelSpec): number {
  const cells = spec.rows * spec.cols - spec.stones;
  const size = clamp((cells - 16) / (48 - 16), 0, 1);
  const months = clamp((spec.months - 4) / 8, 0, 1);
  const mech = mechanicsOf(spec).reduce((sum, m) => sum + MECHANICS[m].weight, 0);
  return clamp(0.08 + 0.25 * size + 0.1 * months + (spec.variants ? 0.04 : 0) + mech + 0.01 * spec.stones, 0.05, 0.95);
}

/** The difficulty the model uses for a spec: measured if known, else the curve (Journey) or the estimate. */
export function specD(spec: LevelSpec): number {
  if (typeof spec.difficulty === 'number' && Number.isFinite(spec.difficulty)) return clamp(spec.difficulty, 0, 1);
  if (spec.mode === 'journey') return clamp(designedBase(spec.number) + ((spec.tier ?? 2) - 2) * MODEL.tierStep, 0, 1);
  return estimateD(spec);
}

// ───────────────────────────── Evaluation ─────────────────────────────

/** Assists the player chose (or caused): hints, shuffles, dead-end reshuffles. */
export const assistsOf = (r: Pick<BoardRecord, 'hints' | 'shuffles' | 'autoShuffles'>) => r.hints + r.shuffles + r.autoShuffles;

/** Time vs par (1 = exactly par). 1 when par is unknown. */
export const parRatio = (r: Pick<BoardRecord, 'ms' | 'par'>) => (r.par > 0 ? r.ms / 1000 / r.par : 1);

/** Cleared with no hint, shuffle or dead-end reshuffle. */
export const isClean = (r: BoardRecord) => r.cleared && assistsOf(r) === 0;

/**
 * Performance on one board, 0–1.
 *   abandoned:  0.05 + 0.15 · progress                       (0.05–0.20)
 *   cleared:    0.45 + 0.27 · clean + 0.20 · speed + 0.08 · accuracy
 *     clean    = 1 − 0.5·hints − 0.6·shuffles − 0.35·dead-end reshuffles (≥ 0)
 *     speed    = (1.75 − time/par), clamped 0–1 (≤ 0.75 par → 1, ≥ 1.75 par → 0)
 *     accuracy = 1 − 3 · blocked taps per pair (≥ 0)
 */
export function performance(r: BoardRecord): number {
  if (!r.cleared) return 0.05 + 0.15 * clamp(r.pairs > 0 ? r.made / r.pairs : 0, 0, 1);
  const clean = clamp(1 - 0.5 * r.hints - 0.6 * r.shuffles - 0.35 * r.autoShuffles, 0, 1);
  const speed = clamp(1.75 - parRatio(r), 0, 1);
  const accuracy = clamp(1 - (3 * r.blocked) / Math.max(1, r.pairs), 0, 1);
  return clamp(0.45 + 0.27 * clean + 0.2 * speed + 0.08 * accuracy, 0, 1);
}

/** Expected performance of a player rated R on a board of difficulty d. */
export function expected(R: number, d: number): number {
  return 1 / (1 + Math.exp(-((R - d) / MODEL.scale + logit(MODEL.atRating))));
}

export interface IngestOptions {
  /** an already-cleared Journey level played again */
  replay?: boolean;
}

/** How much a board counts toward the rating. */
export function boardWeight(r: BoardRecord, opts: IngestOptions = {}): number {
  let w = MODEL.weight[r.mode] ?? 0;
  if (opts.replay) w *= MODEL.replayWeight;
  // Left almost at once: more likely an interruption than a verdict on the board.
  if (!r.cleared && r.made / Math.max(1, r.pairs) < 0.15 && r.ms < 20_000) w *= 0.3;
  return w;
}

const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return y && m && d ? Math.round(new Date(y, m - 1, d).getTime() / 86_400_000) : NaN;
};

/** Note a day with play (most recent first, deduplicated, capped). */
export function noteDay(a: AnalyticsSave, date: string): void {
  if (!date || a.days[0] === date) return;
  a.days = [date, ...a.days.filter((d) => d !== date)].slice(0, DAYS_CAP);
}

/**
 * Fold one board into the model (mutates `a`): recent list, days, per-mechanic
 * stats, rating and dev. Rush boards are ignored. Returns the board's score p.
 */
export function ingest(a: AnalyticsSave, r: BoardRecord, opts: IngestOptions = {}): number {
  if (r.mode === 'rush') return 0;
  const p = performance(r);
  // Days away make the model less sure (Glicko's rating-period growth).
  const prev = a.days[0];
  if (prev && r.date && prev !== r.date) {
    const away = dayNumber(r.date) - dayNumber(prev) - 1;
    if (away > 0) a.dev = Math.min(MODEL.devMax, Math.sqrt(a.dev * a.dev + MODEL.devIdle * MODEL.devIdle * away));
  }
  noteDay(a, r.date);
  a.recent = [r, ...a.recent].slice(0, RECENT_CAP);

  for (const m of r.mech) {
    const st = (a.mech[m] ??= { n: 0, score: p, quits: 0, replays: 0 });
    st.score = st.n === 0 ? p : st.score + MODEL.mechAlpha * (p - st.score);
    st.n++;
    if (r.ended === 'quit') st.quits++;
    if (opts.replay) st.replays++;
  }

  const w = boardWeight(r, opts);
  if (w > 0 && r.d >= 0) {
    // No history yet: the designed curve is the prior, so start at this board.
    if (a.boards === 0) a.rating = r.d;
    const step = MODEL.k * a.dev * w * (p - expected(a.rating, r.d));
    a.rating = clamp(a.rating + clamp(step, -MODEL.maxStep, MODEL.maxStep), 0, 1.5);
    a.dev = Math.max(MODEL.devMin, a.dev * Math.pow(MODEL.devDecay, w));
    a.boards++;
  }
  return p;
}

// ───────────────────────────── Proficiency ─────────────────────────────

export interface Proficiency {
  /** boards played with it */
  n: number;
  /** rolling score 0–1 (0.5 with no data) */
  score: number;
  /** score relative to the player's overall recent level, about −0.5…0.5 (0 = typical for them) */
  relative: number;
  /** 0–1: how much to trust it (grows with boards played) */
  confidence: number;
}

/** Mean score over recent rated boards (0.7 with no data). */
export function overallScore(a: AnalyticsSave): number {
  const rs = a.recent.filter((r) => r.mode !== 'rush');
  return rs.length ? rs.reduce((s, r) => s + performance(r), 0) / rs.length : 0.7;
}

export function proficiency(a: AnalyticsSave, mech: string): Proficiency {
  const st = a.mech[mech];
  if (!st || st.n === 0) return { n: 0, score: 0.5, relative: 0, confidence: 0 };
  const confidence = clamp(st.n / 8, 0, 1);
  return { n: st.n, score: st.score, relative: (st.score - overallScore(a)) * confidence, confidence };
}

// ───────────────────────────── Engagement ─────────────────────────────

export interface Engagement {
  /** 0–1, recency-weighted: quits, restarts, assists, far over par, many blocked taps */
  frustration: number;
  /** 0–1, recency-weighted share of fast clean clears */
  boredom: number;
  /** fast clean clears in a row, most recent first */
  streak: number;
  /** struggles (score ≥ 0.5 on `struggleOf`) in a row, most recent first */
  struggles: number;
  mood: 'struggling' | 'flow' | 'cruising';
  /** boards it was read from */
  seen: number;
}

/** How much one board looked like a struggle, 0–1. */
export function struggleOf(r: BoardRecord): number {
  if (!r.cleared) return 1;
  const ratio = parRatio(r);
  const slow = ratio > 2 ? 0.4 : ratio > 1.5 ? 0.2 : 0;
  const misreads = r.blocked / Math.max(1, r.pairs) > 0.35 ? 0.2 : 0;
  return clamp(0.35 * assistsOf(r) + slow + misreads, 0, 1);
}

/** A fast, clean clear: under par, no assists, few misreads. */
export const isEasy = (r: BoardRecord) => isClean(r) && parRatio(r) <= 1 && r.blocked / Math.max(1, r.pairs) < 0.2;

const RECENCY = [1, 0.7, 0.5, 0.35, 0.25];

export function engagement(a: AnalyticsSave): Engagement {
  const rs = a.recent.filter((r) => r.mode !== 'rush');
  const last = rs.slice(0, RECENCY.length);
  let wsum = 0;
  let fr = 0;
  let bo = 0;
  last.forEach((r, i) => {
    wsum += RECENCY[i];
    fr += RECENCY[i] * struggleOf(r);
    bo += RECENCY[i] * (isEasy(r) ? 1 : 0);
  });
  let streak = 0;
  while (streak < rs.length && isEasy(rs[streak])) streak++;
  let struggles = 0;
  while (struggles < rs.length && struggleOf(rs[struggles]) >= 0.5) struggles++;
  const frustration = wsum ? fr / wsum : 0;
  const boredom = wsum ? bo / wsum : 0;
  const mood = frustration >= 0.45 || struggles >= 1 ? 'struggling' : streak >= 3 ? 'cruising' : 'flow';
  return { frustration, boredom, streak, struggles, mood, seen: last.length };
}
