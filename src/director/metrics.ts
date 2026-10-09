/**
 * Board metrics: what the bots see when they play a board, folded into one
 * difficulty number d ∈ [0, 1]. Everything steps through the real rules.
 *
 * Measured (see docs/EXPANSION_PLAN.md §C1, layer 4):
 *   - legal moves along a proven solve: opening, minimum, average
 *   - share of 2-bend pairs among the legal pairs along that solve
 *   - blocked decoys: same-flower pairs both visible and pickable, but with no path
 *   - naive dead-end rate: random and greedy playouts that get stuck (would need a reshuffle)
 *   - mechanic load: what the board's twists add (library weights × how much of each)
 *   - estimated human solve time: the human-like scanner's search cost, in seconds
 *   - fun shape: an opening foothold, a mid-board crunch, an ending that opens up
 *
 * No DOM imports (runs in workers).
 */
import { type Board } from '../engine/board';
import { type LevelSpec, windOf } from '../engine/levels';
import { MECHANICS } from '../engine/mechanics';
import { type PlayState } from '../engine/rules';
import { type Move, bendsOf, cloneState, initialState, movesOf, playout, proveClear, step, visiblePairs } from './bots';

export interface Metrics {
  pairs: number;
  /** the solver proved a full clear from the start, without any reshuffle */
  solved: boolean;
  /** solver nodes used */
  nodes: number;
  /** legal pairs at the start */
  opening: number;
  /** fewest legal pairs at any point along the solve */
  minMoves: number;
  /** average legal pairs along the solve */
  avgMoves: number;
  /** legal pairs per pair still on the board, averaged along the solve (and its minimum) */
  avgRatio: number;
  minRatio: number;
  /** share of the legal pairs along the solve that need two bends */
  twoBend: number;
  /** blocked decoys: share of visible same-flower pairs with no path (average along the solve) */
  decoys: number;
  /** share of naive playouts (random + greedy) that end stuck */
  deadEnd: number;
  /** the greedy bot (first pair in reading order) got stuck */
  greedyStuck: boolean;
  /** share of the human-like scanner's playouts that end stuck */
  humanStuck: number;
  /** 0–1: what the mechanics add (library weight × intensity, summed and scaled) */
  mechLoad: number;
  /** estimated seconds for a calm human clear (search-cost model) */
  humanTime: number;
  /** fun shape, each 0–1 */
  foothold: number;
  crunch: number;
  finale: number;
  fun: number;
  /** how central the opening pairs sit (0 = all on the rim, 1 = all in the middle) */
  centreFirst: number;
  /** folded difficulty, 0–1 */
  d: number;
}

export interface MeasureOptions {
  /** random-legal playouts (default 12) */
  random?: number;
  /** human-like playouts (default 6) */
  human?: number;
  /** solver node budget (default 20000) */
  budget?: number;
  /** seed for the playouts (default: the spec's seed) */
  seed?: string;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Intensity of each twist on the spec, 0–1, times the library weight, scaled into 0–1. */
export function mechanicLoad(spec: LevelSpec, pairs: number): number {
  const p = Math.max(1, pairs);
  const w = windOf(spec);
  let load = 0;
  if (spec.stones) load += MECHANICS.stones.weight * clamp01(spec.stones / 6);
  if (w === 'down') load += MECHANICS.leaves.weight;
  else if (w) load += MECHANICS.wind.weight;
  if (spec.snow) load += MECHANICS.snow.weight * clamp01(spec.snow / (0.45 * p));
  if (spec.knots) load += MECHANICS.knots.weight * clamp01(spec.knots / (0.3 * p));
  if (spec.gates) load += MECHANICS.gates.weight * clamp01(spec.gates / 6);
  if (spec.fences) load += MECHANICS.fences.weight * clamp01(spec.fences / 14);
  if (spec.torii) load += MECHANICS.torii.weight * clamp01(spec.torii / 2);
  if (spec.streams) load += MECHANICS.streams.weight * clamp01(spec.streams / 6);
  // Two strong ideas at full strength reach about 0.25; three about 0.35.
  return clamp01(load / 0.36);
}

/** Centre-ness of a cell, 0 on the rim to 1 in the very middle. */
function centreOf(b: Board, i: number): number {
  const r = Math.floor(i / b.cols);
  const c = i % b.cols;
  const depth = Math.min(r, c, b.rows - 1 - r, b.cols - 1 - c);
  const maxDepth = Math.max(1, Math.floor((Math.min(b.rows, b.cols) - 1) / 2));
  return clamp01(depth / maxDepth);
}

/** Seconds a calm player spends finding one pair, from the scanner's cost. */
const SECONDS_BASE = 1.1;
const SECONDS_PER_CELL = 0.3;

/** Measure a board (built from `spec` unless given). */
export function measure(spec: LevelSpec, board: Board, opts: MeasureOptions = {}): Metrics {
  const start = initialState(spec, board);
  return measureState(spec, start, opts);
}

export function measureState(spec: LevelSpec, start: PlayState, opts: MeasureOptions = {}): Metrics {
  const wind = windOf(spec);
  const seed = opts.seed ?? spec.seed;
  const total = start.board.cells.filter((v) => v >= 0).length / 2;

  // 1. The solver's line, replayed: legal moves, 2-bend share and decoys at each step.
  const sol = proveClear(start, wind, opts.budget ?? 6000);
  const line: Move[] = sol.moves ?? [];
  const counts: number[] = [];
  let legal = 0;
  let twoBends = 0;
  let decoySum = 0;
  let decoySteps = 0;
  let centreSum = 0;
  {
    const st = cloneState(start);
    const moves0 = movesOf(st);
    for (const m of moves0) centreSum += (centreOf(st.board, m[0]) + centreOf(st.board, m[1])) / 2;
    for (let k = 0; k <= line.length; k++) {
      const moves = k === 0 ? moves0 : movesOf(st);
      if (k < line.length || moves.length) counts.push(moves.length);
      for (const m of moves) if (bendsOf(st.board, m[0], m[1]) === 2) twoBends++;
      legal += moves.length;
      const vis = visiblePairs(st);
      if (vis > 0) {
        decoySum += Math.max(0, vis - moves.length) / vis;
        decoySteps++;
      }
      if (k === line.length) break;
      step(st, line[k], wind);
    }
  }
  if (!line.length) counts.length = Math.min(counts.length, 1);
  const opening = counts[0] ?? 0;
  // The last few pairs are always easy (whatever is left mostly connects): judge the body.
  const body = counts.slice(0, Math.max(1, counts.length - 3));
  const minMoves = body.length ? Math.min(...body) : 0;
  const avgMoves = body.length ? body.reduce((a, b) => a + b, 0) / body.length : 0;
  // The same, relative to the pairs still on the board: 3 pairs to choose from is
  // plenty on a 4×4 and scarce on an 8×6.
  const ratios = body.map((c, k) => c / Math.max(1, total - k));
  const avgRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  const minRatio = ratios.length ? Math.min(...ratios) : 0;

  // 2. Naive play: random-legal and greedy playouts that never reshuffle.
  const R = opts.random ?? 12;
  let stuck = 0;
  for (let k = 0; k < R; k++) if (!playout(start, wind, 'random', `${seed}-r${k}`).cleared) stuck++;
  const greedyStuck = !playout(start, wind, 'greedy', `${seed}-g`).cleared;
  const deadEnd = (stuck + (greedyStuck ? 1 : 0)) / (R + 1);

  // 3. The human-like scanner: time and fun shape.
  const H = opts.human ?? 6;
  let humanStuck = 0;
  let time = 0;
  const shapes: number[][] = [];
  const locks = start.hidden.size + start.knots.size;
  for (let k = 0; k < H; k++) {
    const p = playout(start, wind, 'human', `${seed}-h${k}`);
    const perPair = p.pairs ? (p.pairs * SECONDS_BASE + p.scan * SECONDS_PER_CELL) / p.pairs : SECONDS_BASE;
    // A stuck board costs the rest at the same pace plus a reshuffle's re-read.
    time += perPair * total + (p.cleared ? 0 : 10) + (wind ? 0.35 * total : 0) + 0.6 * locks + 1.2 * (spec.gates ?? 0);
    if (!p.cleared) humanStuck++;
    else shapes.push(p.moves);
  }
  const humanTime = H ? time / H : 0;

  // 4. Fun shape, from the scanner's games (or the solve if it never finished).
  if (!shapes.length) shapes.push(counts);
  let foothold = 0;
  let crunch = 0;
  let finale = 0;
  for (const s of shapes) {
    const n = s.length;
    const third = Math.max(1, Math.floor(n / 3));
    const open = s[0] ?? 0;
    const mid = s.slice(third, Math.max(third + 1, n - third));
    const end = s.slice(n - third);
    const midMin = mid.length ? Math.min(...mid) : open;
    foothold += clamp01((open - 1) / 3);
    crunch += open > 0 ? clamp01(1 - midMin / open) : 0;
    // Pairs left in the last third vs legal moves there: 1 when (almost) everything connects.
    let fin = 0;
    end.forEach((m, k) => {
      const left = end.length - k;
      fin += clamp01(m / Math.max(1, left));
    });
    finale += end.length ? fin / end.length : 0;
  }
  foothold /= shapes.length;
  crunch /= shapes.length;
  finale /= shapes.length;
  const fun = (foothold + crunch + finale) / 3;

  const m: Metrics = {
    pairs: total,
    solved: !!sol.moves && !sol.exhausted,
    nodes: sol.nodes,
    opening,
    minMoves,
    avgMoves,
    avgRatio,
    minRatio,
    twoBend: legal ? twoBends / legal : 0,
    decoys: decoySteps ? decoySum / decoySteps : 0,
    deadEnd,
    greedyStuck,
    humanStuck: H ? humanStuck / H : 0,
    mechLoad: mechanicLoad(spec, total),
    humanTime,
    foothold,
    crunch,
    finale,
    fun,
    centreFirst: opening ? centreSum / opening : 0,
    d: 0,
  };
  m.d = foldD(m);
  return m;
}


/**
 * Fold the metrics into d ∈ [0, 1]. Each term is normalised to 0–1 against the
 * range seen across the whole road (a 4×4 teaching board to a crowded 8×7 peak):
 *
 *   effort    estimated human time (bigger, busier boards take longer to read)
 *   scarcity  few legal pairs per pair left, on average and at the tightest point
 *   reading   2-bend share and blocked decoys (pairs that look right but aren't)
 *   traps     naive dead-end rate, and the human-like scanner getting stuck
 *   twists    mechanic load
 *
 * The weighted sum (`rawD`) is then stretched linearly so the easiest teaching
 * board sits near 0 and the hardest boards the generator can make near 1.
 */
export function rawD(m: Pick<Metrics, 'humanTime' | 'avgRatio' | 'minRatio' | 'twoBend' | 'decoys' | 'deadEnd' | 'humanStuck' | 'mechLoad'>): number {
  const effort = clamp01((m.humanTime - 15) / 120);
  const scarcity = 0.6 * clamp01(1 - (m.avgRatio - 0.25) / 1.0) + 0.4 * clamp01(1 - (m.minRatio - 0.05) / 0.6);
  const reading = 0.5 * clamp01((m.twoBend - 0.2) / 0.45) + 0.5 * clamp01((m.decoys - 0.2) / 0.5);
  const traps = 0.7 * clamp01(m.deadEnd / 0.7) + 0.3 * m.humanStuck;
  return 0.25 * effort + 0.3 * scarcity + 0.12 * reading + 0.18 * traps + 0.15 * m.mechLoad;
}

export const D_LO = 0.05;
export const D_HI = 0.7;

export function foldD(m: Parameters<typeof rawD>[0]): number {
  return Math.round(clamp01((rawD(m) - D_LO) / (D_HI - D_LO)) * 1000) / 1000;
}
