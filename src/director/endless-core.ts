/**
 * The endless road's generator core (EXPANSION_PLAN §C5): everything about a level
 * past 600 that doesn't need the save, the DOM or a clock it can't be given.
 * It runs in the Web Worker (endless.worker.ts), on the main thread as a fallback,
 * and in the tests. endless.ts owns the save, the worker and the timing.
 *
 * A level past 600 is made in three steps:
 *
 *  1. **Tailoring** (`tailorFor`): the play-style profile (profile.ts) is read into
 *     a few gentle nudges. Stretches build up one level at a time and ease off the
 *     same way, so nothing lurches:
 *       - edge-first scanners: prefer boards whose opening pairs sit nearer the centre
 *       - 2-bend pairs slow them: prefer a little more 2-bend reading, step by step
 *       - favourite mechanics get an extra token in the partner bag (every mechanic
 *         still comes round once per bag, so variety is guaranteed)
 *       - short sessions: one size smaller on ordinary boards
 *       - the board that would end a typical session: a festival-style peak
 *         (a little harder, a lucky pair, an ending that opens up for a combo)
 *  2. **Identity** (`endlessIdentity`): `levelPlan(n)` gives the place, season, slot,
 *     role, shape and the place's idea; the partner mechanics and the goal are
 *     re-drawn from this player's bags, the shape follows the session, and a board
 *     that would feel the same as the one before gets the other shape of its size.
 *  3. **Search** (`runEndlessJob`): the same generate-and-test as the bank
 *     (`searchEndless`: solver-proven clear without reshuffle, foothold, non-trivial,
 *     dead-end band, ≤ 8 × 7, deterministic rebuild, time gate) aimed at the
 *     Director's target, with the tailoring bias and a freshness rule against the
 *     player's last 12 endless levels: never the same structure (shape, mechanics,
 *     goal, stone layout and count, flowers) within the window, never the same feel
 *     (shape, mechanics, goal) twice in a row.
 *
 * Pure: no storage or DOM imports (the worker bundles this file).
 */
import { GOAL_IDS, type GoalId } from '../engine/goals';
import { type LevelSpec, type Mechanic } from '../engine/levels';
import { type Board, isGate } from '../engine/board';
import { buildBoard, maxStones } from '../engine/levels';
import { createRng } from '../engine/rng';
import { bendsOf, initialState, movesOf } from './bots';
import { type MeasureOptions, type Metrics, measure } from './metrics';
import { type Knobs, type LevelPlan, LAYOUTS, PARTNERS, SIZES, WIND_CYCLE, clampKnobs, clashes, knobRange, levelPlan, parOf, planSpec, tierKnobs } from './plan';
import type { PlayStyle } from './profile';
import { type Feature, featureOf, funScore, neighbour, novelty, tierFor } from './search';
import { type Verdict, validate } from './validate';

export const ENDLESS = {
  /** freshness window: the player's last endless levels */
  window: 12,
  /** stretch counters climb one step per level while the trait holds, and ease off the same way */
  stretchMax: 8,
  /** bias weight per stretch step (fitness units; the target term is 3 per unit of d) */
  centreStep: 0.12,
  twoBendStep: 0.15,
  /** a 2-bend pair this much slower than a 1-bend one counts as a blind spot */
  twoBendSlow: 1.6,
  /** play-style data needed before tailoring (share of 20 boards) */
  minConfidence: 0.25,
  /** extra bag tokens for the player's favourite mechanics (at most this many favourites) */
  favourites: 2,
  /** the session-end peak: target lift and the weight on an ending that opens up */
  peakLift: 0.07,
  peakFinale: 0.4,
  /** search sizes (the worker; the main-thread fallback uses `quick`) */
  search: { K: 3, climb: 1, maxAttempts: 10, timeBudgetMs: 450, hardMs: 1300, candidateBudgetMs: 4000, measure: { random: 6, human: 3, budget: 800 } as MeasureOptions },
  quick: { K: 1, climb: 0, maxAttempts: 3, timeBudgetMs: 120, hardMs: 400, candidateBudgetMs: 4000, measure: { random: 4, human: 2, budget: 400 } as MeasureOptions },
  /** a structure this close to a recent level counts as a repeat (features are 0–1 per term) */
  sameEps: 1e-6,
};

/** The player's endless-road state that carries from level to level (stored in the save). */
export interface EndlessState {
  /** partner-mechanic bag (tokens left in this round) */
  bag: Mechanic[];
  /** goal bag */
  goals: GoalId[];
  lastPartners: Mechanic[];
  lastGoal: GoalId | null;
  /** stretch counters, 0…stretchMax */
  stretch: { centre: number; twoBend: number };
}

export const defaultEndlessState = (): EndlessState => ({ bag: [], goals: [], lastPartners: [], lastGoal: null, stretch: { centre: 0, twoBend: 0 } });

export const cloneState = (s: EndlessState): EndlessState => ({
  bag: s.bag.slice(),
  goals: s.goals.slice(),
  lastPartners: s.lastPartners.slice(),
  lastGoal: s.lastGoal,
  stretch: { ...s.stretch },
});

export interface Tailoring {
  /** bias weights for the search */
  centreFirst: number;
  twoBend: number;
  finale: number;
  /** mechanics that get an extra bag token */
  favourites: Mechanic[];
  /** one size smaller on ordinary boards */
  short: boolean;
  /** this board would end a typical session: a festival-style peak */
  sessionPeak: boolean;
  /** what was applied, for the dev panel */
  notes: string[];
}

export const NEUTRAL: Tailoring = { centreFirst: 0, twoBend: 0, finale: 0, favourites: [], short: false, sessionPeak: false, notes: [] };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Does this play style find 2-bend pairs slow (their blind spot)? */
export function slowTwoBends(style: PlayStyle): boolean {
  const [, one, two] = style.bends.ms;
  return style.bends.slowest === 2 && one > 0 && two >= ENDLESS.twoBendSlow * one;
}

/**
 * Read a play style into this level's tailoring. Advances the stretch counters
 * in `state` (one step towards the trait per level). `sessionBoards` is how many
 * boards this app session has already played.
 */
export function tailorFor(style: PlayStyle, state: EndlessState, sessionBoards: number): Tailoring {
  const sure = style.confidence >= ENDLESS.minConfidence;
  const step = (v: number, on: boolean) => clamp(v + (on ? 1 : -1), 0, ENDLESS.stretchMax);
  state.stretch = {
    centre: step(state.stretch.centre, sure && style.scan.start === 'edges'),
    twoBend: step(state.stretch.twoBend, sure && slowTwoBends(style)),
  };
  const notes: string[] = [];
  if (state.stretch.centre) notes.push(`centre ×${state.stretch.centre}`);
  if (state.stretch.twoBend) notes.push(`2-bend ×${state.stretch.twoBend}`);
  const favourites = sure ? (style.favourites.filter((m) => (PARTNERS as string[]).includes(m)) as Mechanic[]).slice(0, ENDLESS.favourites) : [];
  if (favourites.length) notes.push(`likes ${favourites.join('+')}`);
  const rhythm = style.session;
  const known = rhythm.count >= 3;
  const short = known && rhythm.length === 'short';
  if (short) notes.push('short boards');
  const sessionPeak = known && sure && rhythm.boardsPerSession >= 2 && sessionBoards + 1 === rhythm.boardsPerSession;
  if (sessionPeak) notes.push('session peak');
  return {
    centreFirst: ENDLESS.centreStep * state.stretch.centre,
    twoBend: ENDLESS.twoBendStep * state.stretch.twoBend,
    finale: sessionPeak ? ENDLESS.peakFinale : 0,
    favourites,
    short,
    sessionPeak,
    notes,
  };
}

// ───────────────────────────── Identity ─────────────────────────────

/** Shapes from small to large (portrait), for stepping a size down or across. */
const SHAPES: [number, number][] = [];
for (const cls of SIZES) for (const s of cls) if (!SHAPES.some(([r, c]) => r === s[0] && c === s[1])) SHAPES.push(s);
SHAPES.sort((a, b) => a[0] * a[1] - b[0] * b[1] || a[0] - b[0]);
/** Smallest board past 600 (the first pass already reached 6 × 5 by its 5th place). */
const MIN_CELLS = 30;

/** "Feel": shape, mechanics and goal. Never the same twice in a row. */
export const feelOf = (s: Pick<LevelSpec, 'rows' | 'cols' | 'goal'> & { mech: readonly string[] }) => `${s.rows}x${s.cols}|${[...s.mech].sort().join('+')}|${s.goal ?? ''}`;

const mechOfSpec = (s: LevelSpec): string[] => {
  const out: string[] = [];
  if (s.stones) out.push('stones');
  if (s.gravity === true || s.gravity === 'down') out.push('leaves');
  else if (s.gravity) out.push('wind');
  if (s.snow) out.push('snow');
  if (s.knots) out.push('knots');
  if (s.lucky) out.push('lucky');
  if (s.gates) out.push('gates');
  if (s.fences) out.push('fences');
  return out;
};
export const feelOfSpec = (s: LevelSpec) => feelOf({ rows: s.rows, cols: s.cols, goal: s.goal, mech: mechOfSpec(s) });

/** A bag draw: the first token passing `ok` that isn't in `avoid`, refilling as needed. */
function drawFrom<T>(bag: T[], refill: () => T[], ok: (x: T) => boolean, avoid: readonly T[]): T | null {
  for (const strict of [true, false]) {
    for (let pass = 0; pass < 2; pass++) {
      const i = bag.findIndex((x) => ok(x) && (!strict || !avoid.includes(x)));
      if (i >= 0) return bag.splice(i, 1)[0];
      bag.push(...refill());
    }
  }
  return null;
}

/**
 * The identity an endless level already has (from its stored spec): the same
 * place, shape, mechanics, wind and goal. Used to make a gentler board for the
 * same level without drawing new partners or goals from the player's bags.
 */
export function identityOf(n: number, spec: LevelSpec): LevelPlan {
  const base = levelPlan(n);
  const has: Record<Mechanic, boolean> = {
    stones: spec.stones > 0,
    leaves: spec.gravity === true || spec.gravity === 'down',
    snow: spec.snow > 0,
    lucky: !!spec.lucky,
    knots: (spec.knots ?? 0) > 0,
    wind: typeof spec.gravity === 'string' && spec.gravity !== 'down',
    gates: (spec.gates ?? 0) > 0,
    fences: (spec.fences ?? 0) > 0,
  };
  const mechanics = (['stones', 'leaves', 'snow', 'lucky', 'knots', 'wind', 'gates', 'fences'] as Mechanic[]).filter((m) => has[m]);
  const wind = has.leaves ? 'down' : has.wind ? (spec.gravity as LevelPlan['wind']) : null;
  const plan: LevelPlan = { ...base, rows: spec.rows, cols: spec.cols, mechanics, wind, lucky: has.lucky, par: spec.par, spec: undefined as unknown as LevelSpec };
  if (spec.goal) plan.goal = spec.goal;
  else delete plan.goal;
  plan.spec = planSpec(plan, tierKnobs(plan, 2), `endless-${n}`);
  plan.par = spec.par;
  return plan;
}

/**
 * The identity of endless level n for this player: `levelPlan(n)` with the partner
 * mechanics and the goal drawn from the player's bags, the shape fitted to their
 * sessions, and a lucky pair on a session-end peak. Mutates `state` (the bags).
 * `prev` is the spec of level n − 1, if known (never the same feel twice in a row).
 */
export function endlessIdentity(n: number, t: Tailoring, state: EndlessState, prev?: LevelSpec | null): LevelPlan {
  const base = levelPlan(n);
  if (base.year < 1 || base.fixed) return base;
  const rng = createRng(`endless-bag-${n}`);
  const focus = base.place.focus;
  const keep = new Set<Mechanic>(['stones', 'lucky']);
  if (focus !== 'basics' && focus !== 'mix') keep.add(focus);
  const set: Mechanic[] = base.mechanics.filter((m) => keep.has(m));
  const partnerSlots = base.mechanics.filter((m) => !keep.has(m)).length;

  // Partners: the player's bag (every mechanic once per round, favourites twice).
  const refill = () => rng.shuffle([...PARTNERS, ...t.favourites.filter((m) => PARTNERS.includes(m))]);
  const used: Mechanic[] = [];
  for (let k = 0; k < partnerSlots; k++) {
    const m = drawFrom(state.bag, refill, (x) => !set.includes(x) && !set.some((y) => clashes(x, y)), state.lastPartners);
    if (!m) break;
    set.push(m);
    used.push(m);
  }
  if (used.length) state.lastPartners = used;

  // Goal: the same slots as the plan, the goal itself from the player's goal bag.
  let goal: GoalId | undefined;
  if (base.goal) {
    goal = drawFrom(state.goals, () => rng.shuffle(GOAL_IDS.slice()), () => true, state.lastGoal ? [state.lastGoal] : []) ?? base.goal;
    state.lastGoal = goal;
  }

  // A festival-style peak at the session's natural end carries a lucky pair.
  if (t.sessionPeak && !set.includes('lucky')) set.push('lucky');

  // Shape: one size smaller for short sessions on ordinary boards.
  let [rows, cols] = [base.rows, base.cols];
  const big = base.role === 'peak' || base.role === 'festival' || t.sessionPeak;
  if (t.short && !big) {
    const i = SHAPES.findIndex(([r, c]) => r === rows && c === cols);
    const smaller = SHAPES.slice(0, Math.max(0, i)).reverse().find(([r, c]) => r * c < rows * cols && r * c >= MIN_CELLS);
    if (smaller) [rows, cols] = smaller;
  }
  const order = (ms: Mechanic[]) => (['stones', 'leaves', 'snow', 'lucky', 'knots', 'wind', 'gates', 'fences'] as Mechanic[]).filter((m) => ms.includes(m));
  const mechanics = order(set);
  // Never the same feel twice in a row: take the other shape of a similar size.
  if (prev && feelOfSpec(prev) === feelOf({ rows, cols, goal, mech: mechanics })) {
    const alt = SHAPES.filter(([r, c]) => (r !== rows || c !== cols) && r * c >= MIN_CELLS).sort(
      (a, b) => Math.abs(a[0] * a[1] - rows * cols) - Math.abs(b[0] * b[1] - rows * cols) || b[0] * b[1] - a[0] * a[1],
    )[0];
    if (alt) [rows, cols] = alt;
  }

  const wind = mechanics.includes('leaves') ? 'down' : mechanics.includes('wind') ? WIND_CYCLE[(base.chapter + base.slot + base.year) % 3] : null;
  const plan: LevelPlan = {
    ...base,
    rows,
    cols,
    mechanics,
    wind,
    lucky: mechanics.includes('lucky'),
    spec: undefined as unknown as LevelSpec,
    par: 0,
  };
  if (goal) plan.goal = goal;
  else delete plan.goal;
  const k2 = tierKnobs(plan, 2);
  plan.par = parOf(plan, (rows * cols - k2.stones - k2.gates) / 2);
  plan.spec = planSpec(plan, k2, `endless-${n}`);
  return plan;
}

// ───────────────────────────── Search ─────────────────────────────

/** Everything the worker needs: plain data (structured-clone safe). */
export interface EndlessJob {
  n: number;
  plan: LevelPlan;
  target: number;
  /** features of the player's recent endless levels (oldest first) */
  recent: Feature[];
  /** feel of level n − 1 */
  prevFeel: string | null;
  bias: { centreFirst: number; twoBend: number; finale: number };
  seedPrefix: string;
  K: number;
  climb: number;
  maxAttempts: number;
  /** stop adding candidates after this once one is valid (wall clock) */
  timeBudgetMs: number;
  /** stop looking for a first valid board after this */
  hardMs: number;
  candidateBudgetMs: number;
  measure: MeasureOptions;
}

export interface EndlessResult {
  spec: LevelSpec;
  d: number;
  feature: Feature;
  /** met the freshness rule */
  fresh: boolean;
  tried: number;
  valid: number;
  ms: number;
  /** the traits the tailoring steers */
  centreFirst: number;
  twoBend: number;
  finale: number;
  rejected: Record<string, number>;
}

/** The feature without d: what makes two boards "the same structure". */
export const structure = (f: Feature) => f.slice(0, -1);

export function sameStructure(a: Feature, b: Feature): boolean {
  const x = structure(a);
  const y = structure(b);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > ENDLESS.sameEps) return false;
  return true;
}

export function isFresh(spec: LevelSpec, feature: Feature, recent: readonly Feature[], prevFeel: string | null): boolean {
  if (prevFeel && feelOfSpec(spec) === prevFeel) return false;
  return !recent.some((r) => sameStructure(r, feature));
}

/** Build the job for level n (the search sizes default to the worker's). */
export function makeJob(
  n: number,
  plan: LevelPlan,
  target: number,
  t: Tailoring,
  recent: readonly LevelSpec[],
  opts: { seedPrefix?: string; size?: Partial<typeof ENDLESS.search> } = {},
): EndlessJob {
  const size = { ...ENDLESS.search, ...opts.size };
  const prev = recent.length ? recent[recent.length - 1] : null;
  return {
    n,
    plan,
    target: clamp(target, 0, 1),
    recent: recent.slice(-ENDLESS.window).map((s) => featureOf(s, s.difficulty ?? 0.5)),
    prevFeel: prev && prev.number === n - 1 ? feelOfSpec(prev) : null,
    bias: { centreFirst: t.centreFirst, twoBend: t.twoBend, finale: t.finale },
    seedPrefix: opts.seedPrefix ?? `endless-${n}`,
    K: size.K,
    climb: size.climb,
    maxAttempts: size.maxAttempts,
    timeBudgetMs: size.timeBudgetMs,
    hardMs: size.hardMs,
    candidateBudgetMs: size.candidateBudgetMs,
    measure: size.measure,
  };
}

/** Knob variations that change the structure (for when every candidate repeats a recent level). */
function variants(plan: LevelPlan, k: Knobs): Knobs[] {
  const out: Knobs[] = [];
  const key = (x: Knobs) => JSON.stringify(x);
  const push = (x: Knobs) => {
    const c = clampKnobs(plan, x);
    if (key(c) !== key(k) && !out.some((o) => key(o) === key(c))) out.push(c);
  };
  push({ ...k, months: k.months - 1 });
  if (k.stones) for (const layout of LAYOUTS) if (layout !== k.layout) push({ ...k, layout });
  push({ ...k, stones: k.stones + 2 });
  push({ ...k, stones: k.stones - 2 });
  push({ ...k, months: k.months + 1 });
  push({ ...k, months: k.months - 2 });
  return out;
}

/** Centre-ness of a cell, 0 on the rim to 1 in the very middle (as metrics.ts). */
function centreOf(b: Board, i: number): number {
  const r = Math.floor(i / b.cols);
  const c = i % b.cols;
  const depth = Math.min(r, c, b.rows - 1 - r, b.cols - 1 - c);
  return Math.min(1, depth / Math.max(1, Math.floor((Math.min(b.rows, b.cols) - 1) / 2)));
}

/**
 * Clustered stones crowd a board fast: at 60 % of the most stones a board can hold,
 * one build in ten can't fit them (the generator retries for up to a second and then
 * drops stones). Measured over years 1–2; lines and spread never do. So a crowded
 * board lays its stones in lines instead.
 */
export function safeLayout(plan: Pick<LevelPlan, 'rows' | 'cols'>, k: Knobs): Knobs {
  return k.layout === 'clusters' && k.stones >= 0.6 * maxStones(plan.rows, plan.cols) ? { ...k, layout: 'lines' } : k;
}

interface Built {
  knobs: Knobs;
  spec: LevelSpec;
  board: Board;
  /** the cheap look at the opening the tailoring steers by */
  cheap: number;
  ms: number;
}

interface Measured extends Built {
  metrics: Metrics;
  verdict: Verdict;
  feature: Feature;
  fitness: number;
}

/**
 * Run one endless search (worker or main thread): the bank's generate-and-test with
 * a wall-clock budget. Every candidate is built, measured by the bots and put through
 * the same hard validators as the bank; the fittest valid board that is also fresh
 * wins (else the fittest valid one). Returns null only if nothing valid turned up
 * before the hard deadline (the caller falls back to the plan's own board).
 *
 * Tailoring screens seeds cheaply first: with a stretch on, each knob setting builds
 * one or two extra boards and measures only the one whose opening leans the way the
 * player is being stretched (opening pairs nearer the centre, more 2-bend pairs).
 */
export function runEndlessJob(job: EndlessJob, now: () => number = () => Date.now()): EndlessResult | null {
  const start = now();
  const elapsed = () => now() - start;
  const { plan, bias } = job;
  const tier = tierFor(plan.base, job.target);
  const rng = createRng(`${job.seedPrefix}-knobs`);
  const rejected: Record<string, number> = {};
  const pool: Measured[] = [];
  let attempt = 0;
  let tried = 0;
  const hardMs = Math.max(job.hardMs, job.timeBudgetMs);

  const build = (knobs: Knobs): Built => {
    const t0 = now();
    const spec = planSpec(plan, knobs, `${job.seedPrefix}-a${attempt++}`, tier);
    const board = buildBoard(spec);
    let cheap = 0;
    if (bias.centreFirst || bias.twoBend) {
      const st = initialState(spec, board);
      const moves = movesOf(st);
      let cf = 0;
      let two = 0;
      for (const [a, b] of moves) {
        cf += (centreOf(st.board, a) + centreOf(st.board, b)) / 2;
        if (bendsOf(st.board, a, b) === 2) two++;
      }
      const k = Math.max(1, moves.length);
      cheap = bias.centreFirst * (cf / k) + bias.twoBend * (two / k);
    }
    return { knobs, spec, board, cheap, ms: now() - t0 };
  };
  const fresh = (spec: LevelSpec, feature: Feature) => isFresh(spec, feature, job.recent, job.prevFeel);
  const evaluate = (b: Built): Measured | null => {
    // The cheap identity gates first (a stone layout that can't fit its count): no need to measure.
    const stones = b.board.cells.filter((v) => v === -2).length;
    const gates = b.board.cells.filter(isGate).length;
    if (stones !== b.spec.stones || gates !== (b.spec.gates ?? 0)) {
      tried++;
      const r = stones !== b.spec.stones ? 'stones' : 'gates';
      rejected[r] = (rejected[r] ?? 0) + 1;
      return null;
    }
    const t0 = now();
    const metrics = measure(b.spec, b.board, job.measure);
    b.spec.difficulty = metrics.d;
    const verdict = validate(b.spec, b.board, metrics, { tier, plan, elapsedMs: b.ms + now() - t0, timeBudgetMs: job.candidateBudgetMs, skipRebuild: true });
    const feature = featureOf(b.spec, metrics.d);
    let fitness = -3 * Math.abs(metrics.d - job.target) + 0.3 * novelty(feature, job.recent) + 0.3 * funScore(metrics);
    fitness += bias.centreFirst * (metrics.centreFirst - 0.5) + bias.twoBend * (metrics.twoBend - 0.45) + bias.finale * (metrics.finale - 0.5);
    if (!fresh(b.spec, feature)) fitness -= 3;
    tried++;
    const m: Measured = { ...b, metrics, verdict, feature, fitness };
    if (verdict.ok) pool.push(m);
    else for (const r of verdict.reasons) rejected[r] = (rejected[r] ?? 0) + 1;
    return m;
  };
  /** Build `1 + extra` boards for a knob setting and measure the one the tailoring likes best. */
  const extra = bias.centreFirst || bias.twoBend ? (bias.centreFirst >= 4 * ENDLESS.centreStep || bias.twoBend >= 4 * ENDLESS.twoBendStep ? 2 : 1) : 0;
  const tryKnobs = (raw: Knobs, screen = extra) => {
    const knobs = safeLayout(plan, raw);
    let pick = build(knobs);
    // Screening is a luxury: only in the first half of the budget.
    for (let i = 0; i < screen && elapsed() < job.timeBudgetMs / 2; i++) {
      const b = build(knobs);
      if (b.cheap > pick.cheap) pick = b;
    }
    return evaluate(pick);
  };
  const best = () => pool.reduce<Measured | null>((a, b) => (!a || b.fitness > a.fitness ? b : a), null);
  const overBudget = () => pool.length > 0 && elapsed() > job.timeBudgetMs;

  // 1. K candidates around the tier's centre: the centre itself, other stone layouts, one-knob neighbours.
  const centre = tierKnobs(plan, tier);
  // (Two misses in a row with nothing valid: skip ahead to the gentler ladder.)
  for (let k = 0; k < job.K && !overBudget() && elapsed() < hardMs && !(pool.length === 0 && tried >= 2); k++) {
    let knobs = centre;
    if (k > 0 && centre.stones > 0) knobs = { ...knobs, layout: LAYOUTS[(plan.n + k) % LAYOUTS.length] };
    if (k >= 3) knobs = neighbour(plan, knobs, rng.next() < 0.5 ? 1 : -1, rng.int(8)) ?? knobs;
    tryKnobs(knobs);
  }
  // 2. Hill-climb a step towards the target.
  for (let s = 0; s < job.climb && !overBudget(); s++) {
    const cur = best();
    if (!cur) break;
    const gap = job.target - cur.metrics.d;
    if (Math.abs(gap) < 0.03) break;
    const next = neighbour(plan, cur.knobs, gap > 0 ? 1 : -1, rng.int(8));
    if (!next) break;
    tryKnobs(next, 0);
  }
  // 3. Nothing valid yet: step down through the gentler tiers' knobs, then every count at its minimum.
  const ladder: Knobs[] = [];
  for (let t = tier - 1; t >= 0; t--) ladder.push(tierKnobs(plan, t));
  const r0 = knobRange(plan);
  const low = ladder.length ? ladder[ladder.length - 1] : centre;
  ladder.push(clampKnobs(plan, { ...low, stones: r0.stones[0], snow: r0.snow[0], knots: r0.knots[0], gates: r0.gates[0], fences: r0.fences[0] }));
  for (let i = 0; !pool.length && tried < job.maxAttempts + 2 * ladder.length && (i === 0 || elapsed() < hardMs); i++) {
    tryKnobs(ladder[Math.min(ladder.length - 1, Math.floor(i / 2))], 0);
  }
  // 4. Freshness: if every valid board repeats a recent one, nudge one knob that changes the structure.
  const sorted = () => pool.slice().sort((a, b) => b.fitness - a.fitness);
  if (pool.length && !pool.some((c) => fresh(c.spec, c.feature))) {
    let i = 0;
    for (const knobs of variants(plan, sorted()[0].knobs)) {
      if (i++ >= 4 || elapsed() > hardMs) break;
      const c = tryKnobs(knobs, 0);
      if (c?.verdict.ok && fresh(c.spec, c.feature)) break;
    }
  }
  // 5. The winner: fresh first, and its rebuild must give the same board, cell for cell.
  const ranked = sorted().sort((a, b) => Number(fresh(b.spec, b.feature)) - Number(fresh(a.spec, a.feature)));
  for (const c of ranked) {
    const again = buildBoard(c.spec);
    if (again.cells.length !== c.board.cells.length || again.cells.some((v, i) => v !== c.board.cells[i])) {
      rejected.nondeterministic = (rejected.nondeterministic ?? 0) + 1;
      continue;
    }
    return {
      spec: c.spec,
      d: c.metrics.d,
      feature: c.feature,
      fresh: fresh(c.spec, c.feature),
      tried,
      valid: pool.length,
      ms: elapsed(),
      centreFirst: c.metrics.centreFirst,
      twoBend: c.metrics.twoBend,
      finale: c.metrics.finale,
      rejected,
    };
  }
  return null;
}
