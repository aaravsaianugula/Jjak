/**
 * Shared helpers for the endless-road tests: a chained run of endless levels through
 * the generator core (no save, no worker, a frozen clock so every run is deterministic),
 * and synthetic play styles.
 */
import { ENDLESS, type EndlessResult, type Tailoring, defaultEndlessState, endlessIdentity, makeJob, runEndlessJob, tailorFor } from '../src/director/endless-core';
import { ingest } from '../src/director/model';
import { type LevelPlan, levelPlan } from '../src/director/plan';
import { type PlayStyle, playStyle } from '../src/director/profile';
import { type LevelSpec } from '../src/engine/levels';
import { type AnalyticsSave, type BoardRecord, defaultAnalytics } from '../src/services/save-analytics';

/** Small, quick search sizes for long runs (the frozen clock never stops a search early). */
export const FAST = { K: 2, climb: 0, maxAttempts: 8, measure: { random: 5, human: 2, budget: 800 } };

export interface Gen {
  n: number;
  plan: LevelPlan;
  spec: LevelSpec;
  result: EndlessResult | null;
  tailoring: Tailoring;
  target: number;
}

export interface RoadOptions {
  style?: (n: number) => PlayStyle;
  target?: (n: number, plan: LevelPlan) => number;
  size?: Partial<typeof ENDLESS.search>;
  sessionBoards?: (n: number) => number;
}

const NEUTRAL_STYLE = playStyle(defaultAnalytics());

/** Generate levels from..from+count-1 in order, as one player's road. */
export function road(from: number, count: number, o: RoadOptions = {}): Gen[] {
  const state = defaultEndlessState();
  const recent: LevelSpec[] = [];
  const out: Gen[] = [];
  for (let n = from; n < from + count; n++) {
    const tailoring = tailorFor(o.style?.(n) ?? NEUTRAL_STYLE, state, o.sessionBoards?.(n) ?? 0);
    const plan = endlessIdentity(n, tailoring, state, recent[recent.length - 1]);
    const target = o.target?.(n, plan) ?? plan.base;
    const job = makeJob(n, plan, target, tailoring, recent, { size: { ...FAST, ...o.size } });
    const result = runEndlessJob(job, () => 0);
    const spec = result?.spec ?? levelPlan(n).spec;
    recent.push(spec);
    if (recent.length > ENDLESS.window) recent.shift();
    out.push({ n, plan, spec, result, tailoring, target });
  }
  return out;
}

export const BASE_RECORD: BoardRecord = {
  mode: 'journey', n: 610, tier: 2, d: 0.55, mech: [], ms: 80_000, par: 90, pairs: 24, made: 24, cleared: true, ended: 'clear',
  stars: 3, firstMs: 3000, gapMs: 2500, blocked: 1, reselects: 0, hints: 0, shuffles: 0, autoShuffles: 0, bestCombo: 3, fever: 0,
  turns: [8, 10, 6], turnMs: [1800, 2000, 2200], firstTaps: [[0.4, 0.5], [0.6, 0.4], [0.5, 0.5]], hintAfterMs: -1, date: '2026-10-07', hour: 20,
};

/** Taps on the rim first (an edge scanner). */
export const EDGE_TAPS: [number, number][] = [[0, 0.4], [1, 0.6], [0.5, 0]];
/** Two-bend pairs take more than twice as long as one-bend ones. */
export const SLOW_TWO: [number, number, number] = [1500, 2000, 4500];

/** An analytics history of `k` boards like `o` (and ten medium app sessions). */
export function historyOf(o: Partial<BoardRecord>, k = 24): AnalyticsSave {
  const a = defaultAnalytics();
  a.sessions = { count: 10, ms: 10 * 12 * 60_000 };
  for (let i = 0; i < k; i++) ingest(a, { ...BASE_RECORD, ...o });
  return a;
}

export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
