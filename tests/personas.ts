/**
 * Synthetic players for the Director's persona simulations (tests/model.test.ts,
 * tests/persona-habits.test.ts).
 *
 * A persona has a true skill θ(n, played) in board-difficulty units. On a board whose
 * real difficulty is d (the measured d plus a little measurement noise):
 *   P(clean clear) = σ((θ − d) / 0.08 + ln 4)      80 % when the board sits at their skill
 *   otherwise they either quit (more likely the harder the board) or clear with 1–2 hints
 *   (sometimes a shuffle) and well over par. Clean clears take
 *   par · exp(N(ln 0.9 − 1.5 (θ − d), 0.2)), with a few misreads on boards near their limit.
 */
import { createRng, type Rng } from '../src/engine/rng';
import { bankSpec } from '../src/director/bank';
import { bendsOf, cardsOnBoard, initialState, movesOf, step } from '../src/director/bots';
import { plainChallenge } from '../src/director/challenge';
import { DIRECTOR, type TierChoice, decide, recordAttempt, tierD } from '../src/director/director';
import { habitualAssists, ingest, isClean, isCleanOrLight, median } from '../src/director/model';
import { designedBase, roadBase } from '../src/director/plan';
import { shapeOfPath } from '../src/director/skills';
import { buildBoard, windOf } from '../src/engine/levels';
import { mechanicsOf } from '../src/engine/mechanics';
import { findPath } from '../src/engine/path';
import { cellFraction } from '../src/services/analytics';
import { type AnalyticsSave, type BoardRecord, defaultAnalytics } from '../src/services/save-analytics';

export interface Persona {
  name: string;
  /** true skill at level n after `played` boards */
  skill(n: number, played: number): number;
}

export const PERSONAS: Record<string, Persona> = {
  steady: { name: 'steady', skill: (n) => roadBase(n) },
  strong: { name: 'strong', skill: (n) => roadBase(n) + 0.12 },
  weak: { name: 'weak', skill: (n) => roadBase(n) - 0.12 },
  learner: { name: 'learner', skill: (n, p) => roadBase(n) - 0.15 + 0.27 * Math.min(1, p / 200) },
  expert: { name: 'expert', skill: (n) => roadBase(n) + 0.35 },
  novice: { name: 'novice', skill: (n) => roadBase(n) - 0.3 },
};

const sigma = (x: number) => 1 / (1 + Math.exp(-x));
const gauss = (rng: Rng) => {
  const u = Math.max(1e-9, rng.next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
};

export const PAIRS = 24;
export const PAR = 90;

/** One board played by a persona of skill θ on a board of real difficulty d. */
export function playBoard(rng: Rng, theta: number, d: number, n: number, tier: number, measured: number): BoardRecord {
  const gap = theta - d;
  const base: BoardRecord = {
    mode: 'journey', n, tier, d: measured, mech: n % 3 === 0 ? ['stones'] : n % 3 === 1 ? ['snow'] : [], ms: 0, par: PAR, pairs: PAIRS,
    made: PAIRS, cleared: true, ended: 'clear', stars: 3, firstMs: 3000, gapMs: 2500, blocked: 0, reselects: 0, hints: 0, shuffles: 0,
    autoShuffles: 0, bestCombo: 3, fever: 0, turns: [8, 10, 6], turnMs: [1500, 2500, 4000], firstTaps: [], hintAfterMs: -1,
    date: '2026-10-07', hour: 20,
  };
  const pClean = sigma(gap / 0.08 + Math.log(4));
  if (rng.next() < pClean) {
    const r = Math.exp(Math.log(0.9) - 1.5 * gap + 0.2 * gauss(rng));
    const blocked = Math.round(PAIRS * Math.max(0, 0.08 - 0.3 * gap) * 2 * rng.next());
    return { ...base, ms: r * PAR * 1000, blocked, stars: r <= 1 ? 3 : 2 };
  }
  const pQuit = Math.min(0.8, Math.max(0.1, 0.35 - 2 * gap));
  if (rng.next() < pQuit) {
    const made = Math.round(PAIRS * (0.2 + 0.5 * rng.next()));
    return { ...base, cleared: false, ended: rng.next() < 0.5 ? 'quit' : 'restart', made, ms: 60_000 * (0.5 + rng.next()), stars: 0, blocked: 3 };
  }
  const r = Math.exp(Math.log(1.4) - gap + 0.25 * gauss(rng));
  return { ...base, ms: r * PAR * 1000, hints: 1 + Number(rng.next() < 0.4), shuffles: Number(rng.next() < 0.2), blocked: 4, stars: 1 };
}

/** The Director's choice for a level (the real `decide`, or a control policy in tests). */
export type Policy = (a: AnalyticsSave, n: number, cleared: boolean) => TierChoice;

export interface SimOptions {
  /** the policy that picks the tier (default: the real Director) */
  policy?: Policy;
  /** share of clean clears on which the player takes a hint anyway (habit, not need) */
  freeHints?: number;
}

/** A control with no Director: every level at the designed tier, nothing leaned on. */
export const fixedTier: Policy = (_a, n) => ({ tier: DIRECTOR.designedTier, target: tierD(n, DIRECTOR.designedTier), reason: 'fixed', challenge: plainChallenge(n, DIRECTOR.designedTier, 'fixed') });

export interface SimStep {
  n: number;
  tier: number;
  reason: string;
  d: number;
  theta: number;
  rating: number;
  clean: boolean;
  cleared: boolean;
}

/**
 * A persona plays `boards` Journey boards from level 1, through the real Director
 * (`decide`) and model (`ingest`): quits retry the same level (pinned tier, relief
 * re-pin after two failures), clears move on.
 */
export function simulate(p: Persona, seed: string, boards = 300, a: AnalyticsSave = defaultAnalytics(), opts: SimOptions = {}): SimStep[] {
  const rng = createRng(seed);
  // Free hints draw from their own stream, so every hint rate sees the same boards and luck.
  const hintRng = createRng(`${seed}:hints`);
  const policy = opts.policy ?? decide;
  const stars: Record<number, number> = {};
  const log: SimStep[] = [];
  let n = 1;
  for (let played = 0; played < boards; played++) {
    const wasCleared = !!stars[n];
    const choice = policy(a, n, wasCleared);
    const measured = tierD(n, choice.tier);
    const real = measured + 0.03 * gauss(rng);
    const theta = p.skill(n, played);
    let rec = playBoard(rng, theta, real, n, choice.tier, measured);
    // A habitual hinter: takes a hint early on a board it clears cleanly anyway (no time cost).
    if (opts.freeHints && hintRng.next() < opts.freeHints && isClean(rec)) rec = { ...rec, hints: 1, hintAfterMs: 3000, stars: 2 };
    ingest(a, rec, { replay: wasCleared });
    recordAttempt(a, n, rec.ended, wasCleared);
    log.push({ n, tier: choice.tier, reason: choice.reason, d: measured, theta, rating: a.rating, clean: isClean(rec), cleared: rec.cleared });
    if (rec.cleared) {
      stars[n] = 1;
      n++;
    }
  }
  return log;
}

// ───────────────────────────── Habit personas on real boards ─────────────────────────────
//
// These personas play the real bank board for (level, tier) through the real rules
// (bots.ts `step` on the solver-proven bank boards). The pairs a playout makes (bends,
// detours, rim routes, positions) set the record's per-shape find times and rhythm, and
// the opening position's legal pairs set the first taps the way each habit looks
// (rim first, centre first, fewest bends first): the same fields the analytics service
// records in the game. One playout per (level, tier) is shared by every persona (it is
// the costly part); habits then differ in what each pair costs them to find. Outcome odds
// use the skill-vs-difficulty curve of `playBoard`, plus a weakness term from the board's
// content (a bend-blind reader on a board full of 2-bend paths finds it harder).

export type Style = 'edge' | 'centre' | 'bendBlind' | 'rusher' | 'hinter';

export interface HabitPersona {
  name: Style;
  /** true skill at level n after `played` boards */
  skill(n: number, played: number): number;
}

/**
 * Each persona sits off the road by a skill offset the policy must correct: the designed
 * tier alone (`fixedTier`) gives each of them a clean rate outside the 75–85 % band.
 */
export const HABIT_OFFSET: Record<Style, number> = { edge: 0.15, centre: -0.04, bendBlind: 0.18, rusher: 0.18, hinter: 0.12 };

export const HABIT_PERSONAS: Record<Style, HabitPersona> = {
  edge: { name: 'edge', skill: (n) => roadBase(n) + HABIT_OFFSET.edge },
  centre: { name: 'centre', skill: (n) => roadBase(n) + HABIT_OFFSET.centre },
  bendBlind: { name: 'bendBlind', skill: (n) => roadBase(n) + HABIT_OFFSET.bendBlind },
  rusher: { name: 'rusher', skill: (n) => roadBase(n) + HABIT_OFFSET.rusher },
  // learns as it goes: from well under the road to above it over its first 200 boards
  hinter: { name: 'hinter', skill: (n, p) => roadBase(n) + HABIT_OFFSET.hinter - 0.12 + 0.2 * Math.min(1, p / 200) },
};

interface TracePair {
  bends: number;
  detour: boolean;
  edge: boolean;
  /** both cards on the outer ring */
  rim: boolean;
}

interface Opening {
  cells: [[number, number], [number, number]];
  /** mean ring depth of the two cards (0 = outer ring) and the path's bends */
  depth: number;
  bends: number;
}

interface Trace {
  pairs: TracePair[];
  /** the legal pairs at the start, for the first taps */
  opening: Opening[];
  total: number;
  par: number;
  mech: string[];
  twoShare: number;
  rimShare: number;
}

const ring = (rows: number, cols: number, i: number) => {
  const r = Math.floor(i / cols);
  const c = i % cols;
  return Math.min(r, c, rows - 1 - r, cols - 1 - c);
};

const traces = new Map<string, Trace>();

/** A playout of the real bank board for (n, tier), random legal order: cached. */
export function traceOf(n: number, tier: number): Trace {
  const key = `${n}:${tier}`;
  const hit = traces.get(key);
  if (hit) return hit;
  const spec = bankSpec(n, tier);
  const st = initialState(spec, buildBoard(spec));
  const wind = windOf(spec);
  const rng = createRng(key);
  const { rows, cols } = st.board;
  const total = cardsOnBoard(st.board) / 2;
  const opening: Opening[] = movesOf(st).map((m) => ({
    cells: [cellFraction(rows, cols, m[0]), cellFraction(rows, cols, m[1])],
    depth: (ring(rows, cols, m[0]) + ring(rows, cols, m[1])) / 2,
    bends: bendsOf(st.board, m[0], m[1]),
  }));
  const pairs: TracePair[] = [];
  for (let k = 0; k < 200 && cardsOnBoard(st.board) > 0; k++) {
    const moves = movesOf(st);
    if (!moves.length) break; // stuck: the game would reshuffle; the pairs so far are the read
    const m = moves[rng.int(moves.length)];
    const path = findPath(st.board, m[0], m[1]);
    if (!path) throw new Error(`legal move without a path at level ${n} tier ${tier}`);
    pairs.push({ ...shapeOfPath(path, rows, cols), rim: ring(rows, cols, m[0]) === 0 && ring(rows, cols, m[1]) === 0 });
    if (!step(st, m, wind)) break;
  }
  const share = (f: (p: TracePair) => boolean) => (pairs.length ? pairs.filter(f).length / pairs.length : 0);
  const t: Trace = { pairs, opening, total, par: spec.par, mech: mechanicsOf(spec), twoShare: share((p) => p.bends === 2), rimShare: share((p) => p.rim) };
  traces.set(key, t);
  return t;
}

/** The first three taps: the two opening pairs this habit sees first (lower rank = seen first). */
function firstTaps(style: Style, t: Trace, rng: Rng): [number, number][] {
  const rank = (o: Opening) => {
    const noise = rng.next() * 0.5;
    if (style === 'edge') return o.depth + noise;
    if (style === 'centre') return -o.depth + noise;
    if (style === 'bendBlind') return o.bends + noise;
    return noise * 4;
  };
  return t.opening
    .map((o) => ({ o, r: rank(o) }))
    .sort((x, y) => x.r - y.r)
    .slice(0, 2)
    .flatMap((x) => x.o.cells)
    .slice(0, 3);
}

/** Find-time multiplier for one pair: what every reader pays for a longer read. */
const baseCost = (p: TracePair) => 1 + 0.2 * Number(p.detour) + 0.1 * Number(p.edge) + 0.15 * p.bends;

/** Find-time multiplier for one pair, by habit. */
function pairCost(style: Style, p: TracePair): number {
  let f = baseCost(p);
  if (style === 'bendBlind' && p.bends === 2) f *= 2.2;
  if (style === 'edge' && !p.rim) f *= 1.6;
  if (style === 'centre' && p.rim) f *= 1.6;
  if (style === 'rusher') f *= 0.6;
  return f;
}

/** Extra effective difficulty from the board's content against the persona's blind spot. */
function weakness(style: Style, t: Trace): number {
  if (style === 'bendBlind') return 0.3 * (t.twoShare - 0.4);
  if (style === 'edge') return 0.15 * (0.5 - t.rimShare);
  if (style === 'centre') return 0.15 * (t.rimShare - 0.3);
  return 0;
}

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

/** One board by a habit persona of skill θ: the record built from its real play of the board. */
export function playHabitBoard(rng: Rng, style: Style, theta: number, d: number, n: number, tier: number, measured: number): BoardRecord {
  const t = traceOf(n, tier);
  const gap = theta - (d + weakness(style, t));
  // A typical reader clears a board at their skill in about 0.9 × par (as `playBoard`).
  const meanCost = t.pairs.length ? sum(t.pairs.map(baseCost)) / t.pairs.length : 1;
  const pace = ((0.9 * t.par * 1000) / (t.total * meanCost)) * Math.exp(-1.5 * gap);
  const finds = t.pairs.map((p) => pace * pairCost(style, p) * Math.exp(0.25 * gauss(rng)));
  const think = (style === 'rusher' ? 800 : 1800) * Math.exp(0.3 * gauss(rng));
  const clean = rng.next() < sigma(gap / 0.08 + Math.log(4));
  const habitHint = style === 'hinter' && rng.next() < 0.8;
  // A hinter reaches for a hint where others give up.
  const pQuit = Math.min(0.8, Math.max(0.1, 0.35 - 2 * gap)) * (style === 'hinter' ? 0.3 : 1);
  const quit = !clean && rng.next() < pQuit;
  const made = quit ? Math.max(1, Math.round(t.total * (0.2 + 0.5 * rng.next()))) : t.total;
  const played = finds.slice(0, made);
  // Assisted clears are slower and take hints (a habitual hinter adds its usual one).
  const slow = clean || quit ? 1 : Math.exp(0.35 + 0.25 * gauss(rng));
  const hints = quit ? 0 : (clean ? 0 : 1 + Number(rng.next() < 0.4)) + Number(habitHint);
  const shuffles = !clean && !quit && rng.next() < 0.2 ? 1 : 0;
  // Pairs past a stuck trace (the game's reshuffle) are found at the usual pace.
  const ms = think + (sum(played) * made) / Math.max(1, played.length) * slow;
  const perPair = style === 'rusher' ? 0.3 + 0.15 * rng.next() : Math.max(0, 0.08 - 0.3 * gap) * 2 * rng.next();
  const blocked = Math.round(made * perPair) + (clean ? 0 : 3);
  const quickMisses = style === 'rusher' ? Math.round(blocked * 0.8) : 0;
  // Counts take every pair made; find times skip the first pair (its time is the opening
  // think, read separately as firstMs), as the analytics service does.
  const count = (f: (p: TracePair) => boolean) => played.filter((_, i) => f(t.pairs[i])).length;
  const by = (f: (p: TracePair) => boolean): number[] => played.filter((_, i) => i > 0 && f(t.pairs[i]));
  const med = (xs: number[]) => Math.round(median(xs));
  const gaps = played.slice(1);
  const mean = gaps.length ? sum(gaps) / gaps.length : 0;
  const sd = gaps.length ? Math.sqrt(sum(gaps.map((g) => (g - mean) ** 2)) / gaps.length) : 0;
  return {
    mode: 'journey', n, tier, d: measured, mech: t.mech, ms, par: t.par, pairs: t.total, made, cleared: !quit,
    ended: quit ? (rng.next() < 0.5 ? 'quit' : 'restart') : 'clear',
    stars: quit ? 0 : 3 - Number(!clean) - Number(ms / 1000 > t.par),
    firstMs: Math.round(think + (played[0] ?? 0)), gapMs: med(gaps), blocked, reselects: 0, hints, shuffles, autoShuffles: 0,
    bestCombo: 3, fever: 0,
    turns: [0, 1, 2].map((k) => count((p) => p.bends === k)) as [number, number, number],
    turnMs: [0, 1, 2].map((k) => med(by((p) => p.bends === k))) as [number, number, number],
    firstTaps: firstTaps(style, t, rng),
    hintAfterMs: hints ? Math.round(habitHint ? 4000 + 2000 * rng.next() : 20_000 + 20_000 * rng.next()) : -1,
    date: '2026-10-07', hour: 20,
    detour: [count((p) => p.detour), med(by((p) => p.detour))],
    edgeRoute: [count((p) => p.edge), med(by((p) => p.edge))],
    gapCv: gaps.length >= 3 && mean > 0 ? Math.round((sd / mean) * 100) / 100 : -1,
    longMs: Math.round(Math.max(0, ...gaps)),
    quickMisses,
  };
}

export interface HabitStep extends SimStep {
  focus: string;
  /** the policy's target and the designed curve at this level (target − base = where the policy aims) */
  target: number;
  base: number;
  /** the assist habit the model read before this board */
  habit: number;
  /** cleared clean or with a light assist (a quick clear with one hint, model.ts) */
  cleanOrLight: boolean;
}

/** A habit persona plays `boards` Journey boards from level 1 through the real Director and model. */
export function simulateHabits(p: HabitPersona, seed: string, boards = 300, a: AnalyticsSave = defaultAnalytics(), policy: Policy = decide): HabitStep[] {
  const rng = createRng(seed);
  const stars: Record<number, number> = {};
  const log: HabitStep[] = [];
  let n = 1;
  for (let played = 0; played < boards; played++) {
    const wasCleared = !!stars[n];
    const choice = policy(a, n, wasCleared);
    const measured = tierD(n, choice.tier);
    const real = measured + 0.03 * gauss(rng);
    const theta = p.skill(n, played);
    const habit = habitualAssists(a);
    const rec = playHabitBoard(rng, p.name, theta, real, n, choice.tier, measured);
    ingest(a, rec, { replay: wasCleared });
    recordAttempt(a, n, rec.ended, wasCleared);
    log.push({
      n, tier: choice.tier, reason: choice.reason, d: measured, theta, rating: a.rating, clean: isClean(rec), cleared: rec.cleared,
      focus: choice.challenge.focus, habit, cleanOrLight: isCleanOrLight(rec), target: choice.target, base: designedBase(n),
    });
    if (rec.cleared) {
      stars[n] = 1;
      n++;
    }
  }
  return log;
}
