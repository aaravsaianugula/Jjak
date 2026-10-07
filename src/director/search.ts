/**
 * Generate-and-test (Togelius et al.): the solvable-by-construction generator
 * inside a search scored by the bots.
 *
 * For a level identity and a tier (or a target difficulty) it builds K candidate
 * boards from deterministic seeds (`${prefix}-t${tier}-a${k}`), varying the
 * knobs a little around the tier's centre, measures each with the bot personas,
 * throws out anything the hard validators reject, and scores the rest:
 *
 *   fitness = closeness to the target d
 *           + novelty against recent levels (feature-vector distance)
 *           + fun (an opening foothold, a mid-board crunch, an ending that opens up)
 *           + an optional bias hook (endless levels tailor to a play style)
 *
 * The best candidate is then hill-climbed a few steps (one knob at a time,
 * towards the target). Everything is deterministic for the same inputs, except
 * an optional wall-clock budget that can stop the search early.
 *
 * No DOM imports: the bank builder runs this in Node workers, and the endless
 * road (past 600) runs it in a Web Worker with a smaller K and a time budget.
 */
import { type Board } from '../engine/board';
import { type LevelSpec, buildBoard } from '../engine/levels';
import { MECHANIC_IDS } from '../engine/mechanics';
import { GOAL_IDS } from '../engine/goals';
import { createRng } from '../engine/rng';
import { type MeasureOptions, type Metrics, measure } from './metrics';
import { type KnobId, type Knobs, type LevelPlan, LAYOUTS, clampKnobs, knobRange, planSpec, tierKnobs } from './plan';
import { type Verdict, validate } from './validate';

export const TIER_STEP = 0.1;

/** Target difficulty for tier t of a level: the designed base, ±0.1 per tier around the middle. */
export const tierTarget = (base: number, tier: number) => Math.min(1, Math.max(0, base + TIER_STEP * (tier - 2)));
/** The tier whose target is nearest a difficulty. */
export const tierFor = (base: number, target: number) => Math.max(0, Math.min(4, Math.round((target - base) / TIER_STEP) + 2));

/** What novelty compares: shape, mechanics, goal, stone layout, difficulty. */
export type Feature = number[];

export function featureOf(spec: LevelSpec, d: number): Feature {
  const mech = MECHANIC_IDS.map((m) => {
    switch (m) {
      case 'stones': return spec.stones > 0;
      case 'leaves': return spec.gravity === true || spec.gravity === 'down';
      case 'wind': return typeof spec.gravity === 'string' && spec.gravity !== 'down';
      case 'snow': return spec.snow > 0;
      case 'knots': return (spec.knots ?? 0) > 0;
      case 'lucky': return !!spec.lucky;
      case 'gates': return (spec.gates ?? 0) > 0;
      case 'fences': return (spec.fences ?? 0) > 0;
    }
  }).map((on) => (on ? 0.5 : 0));
  const goal = GOAL_IDS.map((g) => (spec.goal === g ? 0.5 : 0));
  const layout = LAYOUTS.map((l) => (spec.stones > 0 && (spec.layout ?? 'spread') === l ? 0.4 : 0));
  return [spec.rows / 8, spec.cols / 7, ...mech, ...goal, ...layout, spec.stones / 6, spec.months / 12, d];
}

const dist = (a: Feature, b: Feature) => {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
};

/** 0–1: how unlike the nearest recent level this is (1 when nothing recent). */
export function novelty(f: Feature, recent: readonly Feature[] = []): number {
  if (!recent.length) return 1;
  let near = Infinity;
  for (const r of recent) near = Math.min(near, dist(f, r));
  return Math.min(1, near / 0.6);
}

/**
 * Optional tailoring for endless levels (C5): weights on measured traits, added
 * to the fitness. Positive centreFirst prefers boards whose opening pairs sit in
 * the middle; positive twoBend prefers more two-bend reading.
 */
export interface Bias {
  centreFirst?: number;
  twoBend?: number;
  /** any extra score from the metrics (keep it small: ±0.3) */
  score?: (m: Metrics, spec: LevelSpec) => number;
}

export interface SearchOptions {
  /** candidates around the tier's centre before hill-climbing (default 6) */
  K?: number;
  /** hill-climb steps from the best candidate (default 2) */
  climb?: number;
  /** most boards built in all, including the retries for validity (default 4·K + 2·climb) */
  maxAttempts?: number;
  /** stop starting new candidates after this many ms once one is valid (wall clock: non-deterministic) */
  timeBudgetMs?: number;
  /** per-candidate time gate for the validators (endless) */
  candidateBudgetMs?: number;
  /** features of recent levels, for novelty */
  recent?: readonly Feature[];
  bias?: Bias;
  /** seed prefix (default `journey-${n}`) */
  seedPrefix?: string;
  /** number the attempts (and seeds) from here, to continue an earlier search */
  attemptOffset?: number;
  /** strongly prefer d ≥ floor (keeps the bank's tiers monotone) */
  floor?: number;
  /** strongly prefer d ≤ ceil */
  ceil?: number;
  /** bot playouts per candidate */
  measure?: MeasureOptions;
  /** weights (defaults: target 3, novelty 0.3, fun 0.25) */
  weights?: { target?: number; novelty?: number; fun?: number };
  now?: () => number;
}

export interface Candidate {
  attempt: number;
  knobs: Knobs;
  spec: LevelSpec;
  board: Board;
  metrics: Metrics;
  verdict: Verdict;
  fitness: number;
  feature: Feature;
  ms: number;
}

export interface SearchResult {
  best: Candidate | null;
  /** every valid candidate, fittest first */
  pool: Candidate[];
  tier: number;
  target: number;
  /** boards built */
  tried: number;
  /** boards that passed every validator */
  valid: number;
  /** rejections by reason */
  rejected: Record<string, number>;
  ms: number;
}

type NumKnob = Exclude<KnobId, 'layout'>;
const STEPS: [NumKnob, number][] = [
  ['stones', 2],
  ['months', 1],
  ['snow', 1],
  ['knots', 1],
  ['gates', 2],
  ['fences', 2],
];

/** One knob one step harder (dir +1) or easier (dir -1), inside the identity's ranges; null if nothing can move. */
export function neighbour(plan: LevelPlan, k: Knobs, dir: 1 | -1, pick: number): Knobs | null {
  const r = knobRange(plan);
  const movable = STEPS.filter(([id]) => (id === 'months' ? r.months[1] > r.months[0] : r[id][1] > r[id][0]));
  for (let i = 0; i < movable.length; i++) {
    const [id, step] = movable[(pick + i) % movable.length];
    const next = clampKnobs(plan, { ...k, [id]: k[id] + dir * step });
    if (next[id] !== k[id]) return next;
  }
  return null;
}

/** Build, measure and validate one candidate. */
export function tryCandidate(plan: LevelPlan, knobs: Knobs, seed: string, tier: number, opts: Pick<SearchOptions, 'measure' | 'candidateBudgetMs' | 'now'> = {}): Omit<Candidate, 'fitness' | 'feature'> {
  const now = opts.now ?? (() => Date.now());
  const t0 = now();
  const spec = plan.fixed ? { ...plan.spec, tier } : planSpec(plan, knobs, seed, tier);
  const board = buildBoard(spec);
  const metrics = measure(spec, board, opts.measure);
  spec.difficulty = metrics.d;
  const ms = now() - t0;
  const verdict = validate(spec, board, metrics, { tier, plan, elapsedMs: ms, timeBudgetMs: opts.candidateBudgetMs });
  return { attempt: 0, knobs, spec, board, metrics, verdict, ms };
}

/**
 * Search for the best board for a level identity at a tier (or a target d).
 * Returns the fittest valid candidate, or best = null if none passed (the
 * caller decides: the bank builder reports it, the endless road retries).
 */
export function searchLevel(plan: LevelPlan, tierOrTarget: number | { target: number; tier?: number }, opts: SearchOptions = {}): SearchResult {
  const now = opts.now ?? (() => Date.now());
  const start = now();
  const tier = typeof tierOrTarget === 'number' ? Math.max(0, Math.min(4, Math.round(tierOrTarget))) : tierOrTarget.tier ?? tierFor(plan.base, tierOrTarget.target);
  const target = typeof tierOrTarget === 'number' ? tierTarget(plan.base, tier) : tierOrTarget.target;
  const prefix = opts.seedPrefix ?? `journey-${plan.n}`;
  const tag = typeof tierOrTarget === 'number' ? `t${tier}` : `x${Math.round(target * 100)}`;
  const K = plan.fixed ? 1 : Math.max(1, opts.K ?? 6);
  const climb = plan.fixed ? 0 : opts.climb ?? 2;
  const maxAttempts = plan.fixed ? 1 : opts.maxAttempts ?? 4 * K + 2 * climb;
  const w = { target: 3, novelty: 0.3, fun: 0.25, ...opts.weights };
  const rng = createRng(`${prefix}-${tag}-knobs`);
  const rejected: Record<string, number> = {};
  let tried = 0;
  let valid = 0;
  let best: Candidate | null = null;
  const pool: Candidate[] = [];

  const fitnessOf = (m: Metrics, spec: LevelSpec, feature: Feature): number => {
    let f = -w.target * Math.abs(m.d - target) + w.novelty * novelty(feature, opts.recent) + w.fun * m.fun;
    if (opts.floor != null && m.d < opts.floor) f -= 2 + 10 * (opts.floor - m.d);
    if (opts.ceil != null && m.d > opts.ceil) f -= 2 + 10 * (m.d - opts.ceil);
    const b = opts.bias;
    if (b) {
      if (b.centreFirst) f += b.centreFirst * (m.centreFirst - 0.5);
      if (b.twoBend) f += b.twoBend * (m.twoBend - 0.45);
      if (b.score) f += b.score(m, spec);
    }
    return f;
  };

  const run = (knobs: Knobs): Candidate => {
    const attempt = (opts.attemptOffset ?? 0) + tried++;
    const seed = plan.fixed ? plan.spec.seed : `${prefix}-${tag}-a${attempt}`;
    const c = tryCandidate(plan, knobs, seed, tier, opts);
    const feature = featureOf(c.spec, c.metrics.d);
    const cand: Candidate = { ...c, attempt, feature, fitness: fitnessOf(c.metrics, c.spec, feature) };
    if (cand.verdict.ok) {
      valid++;
      pool.push(cand);
      if (!best || cand.fitness > best.fitness) best = cand;
    } else for (const r of cand.verdict.reasons) rejected[r] = (rejected[r] ?? 0) + 1;
    return cand;
  };
  const outOfTime = () => opts.timeBudgetMs != null && best != null && now() - start > opts.timeBudgetMs;

  // 1. K candidates around the tier's centre: the centre itself, other stone layouts, one-knob neighbours.
  const centre = tierKnobs(plan, tier);
  const hasStones = centre.stones > 0;
  for (let k = 0; k < K && !outOfTime(); k++) {
    let knobs = centre;
    if (k > 0 && hasStones) knobs = { ...knobs, layout: LAYOUTS[(plan.n + k) % LAYOUTS.length] };
    if (k >= 3) knobs = neighbour(plan, knobs, rng.next() < 0.5 ? 1 : -1, rng.int(8)) ?? knobs;
    run(knobs);
  }
  // 2. Hill-climb: from the best, one knob a step towards the target.
  for (let s = 0; s < climb && best && !outOfTime() && tried < maxAttempts; s++) {
    const cur: Candidate = best;
    const gap = target - cur.metrics.d;
    const low = opts.floor != null && cur.metrics.d < opts.floor;
    const high = opts.ceil != null && cur.metrics.d > opts.ceil;
    if (Math.abs(gap) < 0.03 && !low && !high) break;
    const dir: 1 | -1 = low || (!high && gap > 0) ? 1 : -1;
    const next = neighbour(plan, cur.knobs, dir, rng.int(8));
    if (!next) break;
    run(next);
  }
  // 3. Nothing valid yet: more seeds, stepping down through the gentler tiers' knobs and
  // then every count at its minimum (most rejections are dead ends, a missing foothold,
  // or snow and knots finding no walled-in card to sit on).
  const ladder: Knobs[] = [];
  for (let t = tier - 1; t >= 0; t--) ladder.push(tierKnobs(plan, t));
  const r0 = knobRange(plan);
  const low = ladder.length ? ladder[ladder.length - 1] : centre;
  ladder.push(clampKnobs(plan, { ...low, stones: r0.stones[0], snow: r0.snow[0], knots: r0.knots[0], gates: r0.gates[0], fences: r0.fences[0] }));
  for (let i = 0; !best && tried < maxAttempts + 2 * ladder.length && !(opts.timeBudgetMs != null && now() - start > 4 * opts.timeBudgetMs); i++) {
    run(ladder[Math.min(ladder.length - 1, Math.floor(i / 2))]);
  }
  pool.sort((a, b) => b.fitness - a.fitness);
  return { best, pool, tier, target, tried, valid, rejected, ms: now() - start };
}

/**
 * The endless road's entry point (C5): a smaller, time-boxed search for a
 * target difficulty, tailored by a bias and kept fresh against recent levels.
 */
export function searchEndless(plan: LevelPlan, target: number, opts: SearchOptions = {}): SearchResult {
  return searchLevel(plan, { target }, { K: 4, climb: 1, maxAttempts: 16, timeBudgetMs: 1500, measure: { random: 8, human: 4 }, ...opts });
}

export interface TierSearch {
  /** the chosen candidate per tier 0–4, d non-decreasing */
  picks: Candidate[];
  /** boards built across all tiers */
  tried: number;
  rejected: Record<string, number>;
  /** the tiers had to be re-searched to keep d monotone */
  repaired: boolean;
}

/**
 * Pick one board per tier so d never falls as the tier rises, maximising the
 * summed fitness (a small dynamic programme over each tier's valid pool). If no
 * monotone choice exists, the offending tier is searched again with a floor
 * (or the tier below with a ceiling) and the pick is redone.
 */
export function chooseMonotone(pools: Candidate[][], slack = 0): Candidate[] | null {
  const T = pools.length;
  const score: number[][] = [];
  const from: number[][] = [];
  for (let t = 0; t < T; t++) {
    score.push(pools[t].map(() => -Infinity));
    from.push(pools[t].map(() => -1));
    pools[t].forEach((c, i) => {
      if (t === 0) {
        score[t][i] = c.fitness;
        return;
      }
      pools[t - 1].forEach((p, j) => {
        if (p.metrics.d <= c.metrics.d + slack && score[t - 1][j] + c.fitness > score[t][i]) {
          score[t][i] = score[t - 1][j] + c.fitness;
          from[t][i] = j;
        }
      });
    });
  }
  let bi = -1;
  pools[T - 1].forEach((_, i) => {
    if (score[T - 1][i] > -Infinity && (bi < 0 || score[T - 1][i] > score[T - 1][bi])) bi = i;
  });
  if (bi < 0) return null;
  const picks: Candidate[] = [];
  for (let t = T - 1; t >= 0; t--) {
    picks.unshift(pools[t][bi]);
    bi = from[t][bi];
  }
  return picks;
}

/** Search all five tiers of a level and keep d monotone in the tier. */
export function searchTiers(plan: LevelPlan, opts: SearchOptions & { recentByTier?: Feature[][] } = {}): TierSearch | null {
  const rejected: Record<string, number> = {};
  let tried = 0;
  const offsets = [0, 0, 0, 0, 0];
  const pools: Candidate[][] = [];
  const runTier = (t: number, extra: SearchOptions = {}) => {
    const r = searchLevel(plan, t, { ...opts, recent: opts.recentByTier?.[t] ?? opts.recent, attemptOffset: offsets[t], ...extra });
    offsets[t] += r.tried;
    tried += r.tried;
    for (const [k, v] of Object.entries(r.rejected)) rejected[k] = (rejected[k] ?? 0) + v;
    return r.pool;
  };
  for (let t = 0; t < (plan.fixed ? 1 : 5); t++) pools.push(runTier(t));
  if (plan.fixed) {
    const c = pools[0][0];
    if (!c) return null;
    // One teaching board for every tier.
    return { picks: [0, 1, 2, 3, 4].map((t) => ({ ...c, spec: { ...c.spec, tier: t } })), tried, rejected, repaired: false };
  }
  let picks = chooseMonotone(pools);
  let repaired = false;
  for (let round = 0; !picks && round < 4; round++) {
    repaired = true;
    // Walk up the tiers keeping the lowest reachable d; the first tier with
    // nothing at or above it is searched again with a floor, and the tier below
    // with a ceiling.
    let t = 0;
    let reach = -Infinity;
    for (; t < 5; t++) {
      const ok = pools[t].map((c) => c.metrics.d).filter((d) => d >= reach);
      if (!ok.length) break;
      reach = Math.min(...ok);
    }
    if (t >= 5) break;
    if (t === 0 || !pools[t - 1].length) {
      pools[t].push(...runTier(t, { K: 4, climb: 2 }));
    } else {
      pools[t].push(...runTier(t, { K: 4, climb: 3, floor: reach }));
      const hi = Math.max(...pools[t].map((c) => c.metrics.d), -Infinity);
      if (hi < reach) pools[t - 1].push(...runTier(t - 1, { K: 4, climb: 3, ceil: hi }));
    }
    picks = chooseMonotone(pools);
  }
  // Last resorts, so a level never goes missing: a hair of slack, then the best board per tier.
  if (!picks) picks = chooseMonotone(pools, 0.03);
  if (!picks && pools.every((p) => p.length)) picks = pools.map((p) => p.reduce((a, b) => (b.fitness > a.fitness ? b : a)));
  return picks ? { picks, tried, rejected, repaired } : null;
}
