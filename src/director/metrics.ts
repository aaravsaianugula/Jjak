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
 *   - fun shape, from the human-like scanner's games: an early easy read, a squeeze
 *     in the middle, a closing run of quick pairs (a combo finish)
 *
 * No DOM imports (runs in workers).
 */
import { type Board, isCard, monthOf } from '../engine/board';
import { type LevelSpec, windOf } from '../engine/levels';
import { MECHANICS } from '../engine/mechanics';
import { placementOrder } from '../engine/generate';
import { findPath } from '../engine/path';
import { type PlayState, lockedOf } from '../engine/rules';
import { COMBO_WINDOW_MS, MAX_COMBO } from '../engine/session';
import { type Move, type Playout, bendsOf, cloneState, initialState, movesOf, playout, proveClear, step, visiblePairs } from './bots';

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
  /** easily read legal pairs at the start: 0–1 bend and a short path (see `isEasy`) */
  easyOpen: number;
  /** seconds of play before the human-like scanner makes its first easy (0–1 bend) pair, mean of its games */
  easySeconds: number;
  /** pairs in the scanner's closing run: the last pairs, each with a choice on the board and found inside the combo window (mean of its games) */
  closingRun: number;
  /**
   * Fun shape, each 0–1, from the scanner's games (see `funShape`; `funChecks` has the pass marks):
   *   foothold  an easy pair made early: 1 inside 5 s, 0.5 at 10 s, 0 from 15 s
   *   crunch    share of games with a tight spot in the middle third: at most two
   *             legal pairs while five or more are still on the board
   *   finale    the closing run against a combo finish of eight pairs (or the whole board)
   */
  foothold: number;
  crunch: number;
  finale: number;
  fun: number;
  /** how central the opening pairs sit (0 = all on the rim, 1 = all in the middle) */
  centreFirst: number;
  /** folded difficulty, 0–1 */
  d: number;
  /** the pair-by-pair reading of the board (only when measured with `reading: true`) */
  reading?: BoardReading;
}

// ---------------------------------------------------------------------------
// The reading contract (for tailoring boards to a player's blind spots).
//
// `BoardReading` describes one board the way a player reads it, from the
// solver's proven line:
//   pairs    every pair of that line in order, as a `PairTrace`: its two cells,
//            the bends (0/1/2) and length of its path, whether the path runs along
//            the rim or outside it (edge route), whether it is a long detour, and
//            whether it is critical (it must come before every other legal pair)
//   decoys   same-flower pairs, both pickable, with no path at the start
//   opening  where the easy first reads sit (row/column fractions, 0 = top/left)
// Cells are row-major indices into the board as built. Computed only on request
// (`measure(..., { reading: true })`): the bank and endless searches don't pay it.

export interface PairTrace {
  /** the two cells, in the order the solve picked them */
  a: number;
  b: number;
  /** turns in the path, 0–2 */
  bends: number;
  /** path length in cell steps (corner to corner, Manhattan) */
  length: number;
  /** the path leaves the board or runs along its rim: an edge route */
  edge: boolean;
  /** the path is at least two steps longer than the straight distance: a detour */
  detour: boolean;
  /** legal pairs on the board just before this one */
  legalBefore: number;
  /** pairs that became legal by clearing this one */
  opens: number;
  /** another legal pairing of the same flower at this point leads to a dead end (a tempting wrong match) */
  strands: boolean;
  /**
   * The board hinges on this pair: it must come before every other legal pair. There
   * is at least one other, and each of them, matched now instead, is proven to strand
   * the board (an unfinished proof never counts, as for `strands`). A forced pair (the
   * only legal one) is not critical: there is no order to get wrong.
   */
  critical: boolean;
}

export interface DecoyPair {
  a: number;
  b: number;
}

export interface Foothold {
  a: number;
  b: number;
  /** the pair's mid-point as fractions of the board, 0 = top / left, 1 = bottom / right */
  row: number;
  col: number;
}

export interface OpeningRegion {
  /** the easy first reads (0–1 bend, short), see `isEasy` */
  footholds: Foothold[];
  /** their centroid (0.5, 0.5 when there are none) */
  row: number;
  col: number;
}

export interface BoardReading {
  pairs: PairTrace[];
  decoys: DecoyPair[];
  opening: OpeningRegion;
}

/** Path facts of a connectable pair (null if the two cells don't connect). */
export function pairTrace(b: Board, i: number, j: number): Pick<PairTrace, 'a' | 'b' | 'bends' | 'length' | 'edge' | 'detour'> | null {
  const path = findPath(b, i, j);
  if (!path) return null;
  const outside = (r: number, c: number) => r < 0 || c < 0 || r >= b.rows || c >= b.cols;
  let length = 0;
  let edge = false;
  for (let k = 1; k < path.length; k++) {
    const p = path[k - 1];
    const q = path[k];
    const len = Math.abs(q.r - p.r) + Math.abs(q.c - p.c);
    length += len;
    if (outside(q.r, q.c)) edge = true;
    // A segment running along the rim itself (not just stepping off a rim cell).
    const alongRow = p.r === q.r && (p.r === 0 || p.r === b.rows - 1);
    const alongCol = p.c === q.c && (p.c === 0 || p.c === b.cols - 1);
    if (len >= 2 && (alongRow || alongCol)) edge = true;
  }
  const s = path[0];
  const t = path[path.length - 1];
  const straight = Math.abs(s.r - t.r) + Math.abs(s.c - t.c);
  return { a: i, b: j, bends: Math.max(0, Math.min(2, path.length - 2)), length, edge, detour: length >= straight + 2 };
}

/** An easy read: at most one bend, and a path no longer than the board's long side. */
export const isEasy = (b: Board, t: Pick<PairTrace, 'bends' | 'length'>) => t.bends <= 1 && t.length <= Math.max(b.rows, b.cols);

/** Pass marks for the fun shape (the audit reports the share of bank boards passing). */
export const FUN = {
  /** the scanner makes its first easy pair inside this many seconds of play */
  footholdSeconds: 10,
  /** a tight spot: at most this many legal pairs… */
  tightMoves: 2,
  /** …while at least this many pairs are still on the board */
  tightLeft: 5,
  /** crunch: at least this share of the scanner's games hit a tight spot in the middle third */
  crunch: 0.5,
  /** a pair found inside the combo window keeps the combo going */
  comboSeconds: COMBO_WINDOW_MS / 1000,
  /** finale: a closing run long enough to reach the top combo and hold it (or the whole board, if smaller) */
  closingRun: MAX_COMBO + 1,
  /** the closing run that scores a full finale */
  fullRun: 8,
};

/** The parts of a scanner game the fun shape reads. */
export type ScannerGame = Pick<Playout, 'cleared' | 'total' | 'moves' | 'scans' | 'bends'>;

/** Seconds a calm player spends finding one pair, from the scanner's cost. */
const SECONDS_BASE = 1.1;
const SECONDS_PER_CELL = 0.3;
const secondsOf = (scan: number) => SECONDS_BASE + scan * SECONDS_PER_CELL;
/** A game that never makes an easy pair counts as this slow. */
const NO_EASY_SECONDS = 3 * FUN.footholdSeconds;

/** Seconds of play until the scanner's first pair with at most one bend. */
export function easySecondsOf(g: ScannerGame): number {
  let t = 0;
  for (let k = 0; k < g.scans.length; k++) {
    t += secondsOf(g.scans[k]);
    if (g.bends[k] <= 1) return Math.min(t, NO_EASY_SECONDS);
  }
  return NO_EASY_SECONDS;
}

/**
 * A tight spot in the middle third of the game: few legal pairs while much of the
 * board is left. (A game the scanner ends stuck is cut short, so its dead end can
 * land in its "middle": a dead end with five or more pairs left counts as a squeeze.)
 */
export function hasTightSpot(g: ScannerGame): boolean {
  const n = g.moves.length;
  const third = Math.max(1, Math.floor(n / 3));
  for (let k = third; k < n - third; k++) if (g.moves[k] <= FUN.tightMoves && g.total - k >= FUN.tightLeft) return true;
  return false;
}

/**
 * The closing run: counted back from the last pair, the pairs made with a choice on
 * the board (two or more legal pairs, or the very last one) and found inside the
 * combo window. 0 for a game that got stuck: there is no finish.
 */
export function closingRunOf(g: ScannerGame): number {
  if (!g.cleared) return 0;
  let run = 0;
  for (let k = g.moves.length - 1; k >= 0; k--) {
    const open = g.moves[k] >= Math.min(2, g.total - k);
    if (!open || secondsOf(g.scans[k]) > FUN.comboSeconds) break;
    run++;
  }
  return run;
}

/** The fun shape of a board, from the scanner's games on it. */
export function funShape(games: readonly ScannerGame[]): Pick<Metrics, 'easySeconds' | 'closingRun' | 'foothold' | 'crunch' | 'finale'> {
  if (!games.length) return { easySeconds: NO_EASY_SECONDS, closingRun: 0, foothold: 0, crunch: 0, finale: 0 };
  const mean = (f: (g: ScannerGame) => number) => games.reduce((s, g) => s + f(g), 0) / games.length;
  const easySeconds = mean(easySecondsOf);
  const closingRun = mean(closingRunOf);
  return {
    easySeconds,
    closingRun,
    foothold: clamp01(1.5 - easySeconds / FUN.footholdSeconds),
    crunch: mean((g) => (hasTightSpot(g) ? 1 : 0)),
    finale: clamp01(closingRun / Math.max(1, Math.min(FUN.fullRun, games[0].total))),
  };
}

/** Which fun marks a board passes. */
export function funChecks(m: Pick<Metrics, 'pairs' | 'easySeconds' | 'crunch' | 'closingRun'>): { foothold: boolean; crunch: boolean; finale: boolean } {
  return {
    foothold: m.easySeconds <= FUN.footholdSeconds,
    crunch: m.crunch >= FUN.crunch,
    finale: m.closingRun >= Math.min(FUN.closingRun, m.pairs),
  };
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
  /** also trace the board pair by pair (`Metrics.reading`); off in the searches */
  reading?: boolean;
  /** solver nodes per wrong-match check in the reading (default 4000): "no clear" only counts if the proof finishes inside it */
  strandBudget?: number;
  /** a clearing line for the solver to fall back on when its budget runs out (`measure` passes the generator's, reversed) */
  hint?: readonly Move[];
  /** naive play already measured with `naivePlay` (same seed and count): not played again */
  naive?: NaivePlay;
}

export interface NaivePlay {
  /** share of naive playouts (random + greedy) that end stuck */
  deadEnd: number;
  /** the greedy bot got stuck */
  greedyStuck: boolean;
}

/** Naive play: `random` random-legal playouts and one greedy one, never reshuffling. */
export function naivePlay(start: PlayState, wind: ReturnType<typeof windOf>, seed: string, random = 12): NaivePlay {
  let stuck = 0;
  for (let k = 0; k < random; k++) if (!playout(start, wind, 'random', `${seed}-r${k}`).cleared) stuck++;
  const greedyStuck = !playout(start, wind, 'greedy', `${seed}-g`).cleared;
  return { deadEnd: (stuck + (greedyStuck ? 1 : 0)) / (random + 1), greedyStuck };
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
  if (spec.seals) load += MECHANICS.seals.weight * clamp01(spec.seals / 4);
  if (spec.ink) load += MECHANICS.ink.weight * clamp01(spec.ink / 4);
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

/** Measure a board (built from `spec` unless given). */
export function measure(spec: LevelSpec, board: Board, opts: MeasureOptions = {}): Metrics {
  const start = initialState(spec, board);
  const order = opts.hint ? null : placementOrder(board);
  return measureState(spec, start, order ? { ...opts, hint: order.slice().reverse() } : opts);
}

export function measureState(spec: LevelSpec, start: PlayState, opts: MeasureOptions = {}): Metrics {
  const wind = windOf(spec);
  const seed = opts.seed ?? spec.seed;
  const total = start.board.cells.filter((v) => v >= 0).length / 2;

  // 1. The solver's line, replayed: legal moves, 2-bend share and decoys at each step.
  const sol = proveClear(start, wind, opts.budget ?? 6000, opts.hint);
  const line: Move[] = sol.moves ?? [];
  const counts: number[] = [];
  let legal = 0;
  let twoBends = 0;
  let decoySum = 0;
  let decoySteps = 0;
  let centreSum = 0;
  let easyOpen = 0;
  {
    const st = cloneState(start);
    const moves0 = movesOf(st);
    for (const m of moves0) {
      centreSum += (centreOf(st.board, m[0]) + centreOf(st.board, m[1])) / 2;
      const t = pairTrace(st.board, m[0], m[1]);
      if (t && isEasy(st.board, t)) easyOpen++;
    }
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
  const { deadEnd, greedyStuck } = opts.naive ?? naivePlay(start, wind, seed, opts.random ?? 12);

  // 3. The human-like scanner: time and fun shape.
  const H = opts.human ?? 6;
  let humanStuck = 0;
  let time = 0;
  const games: Playout[] = [];
  const locks = start.hidden.size + start.knots.size;
  for (let k = 0; k < H; k++) {
    const p = playout(start, wind, 'human', `${seed}-h${k}`);
    const perPair = p.pairs ? (p.pairs * SECONDS_BASE + p.scan * SECONDS_PER_CELL) / p.pairs : SECONDS_BASE;
    // A stuck board costs the rest at the same pace plus a reshuffle's re-read.
    time += perPair * total + (p.cleared ? 0 : 10) + (wind ? 0.35 * total : 0) + 0.6 * locks + 1.2 * (spec.gates ?? 0);
    if (!p.cleared) humanStuck++;
    games.push(p);
  }
  const humanTime = H ? time / H : 0;

  // 4. Fun shape, from the scanner's games. The finale weighs most: a satisfying run at the end.
  const shape = funShape(games);
  const fun = 0.25 * shape.foothold + 0.3 * shape.crunch + 0.45 * shape.finale;

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
    easyOpen,
    ...shape,
    fun,
    centreFirst: opening ? centreSum / opening : 0,
    d: 0,
  };
  m.d = foldD(m);
  if (opts.reading) m.reading = readLine(start, wind, line, opts.strandBudget ?? 4000);
  return m;
}

/** Order-free key of a pair of cells. */
const pairKey = (m: Move) => (m[0] < m[1] ? m[0] * 4096 + m[1] : m[1] * 4096 + m[0]);
const cardsLeft = (st: PlayState) => st.board.cells.reduce((n, v) => n + (isCard(v) ? 1 : 0), 0);

/** The pair-by-pair reading along a proven line (see `BoardReading`). */
function readLine(start: PlayState, wind: ReturnType<typeof windOf>, line: Move[], strandBudget: number): BoardReading {
  const { rows, cols } = start.board;
  const st = cloneState(start);
  const frac = (i: number, j: number) => ({
    row: rows > 1 ? (Math.floor(i / cols) + Math.floor(j / cols)) / 2 / (rows - 1) : 0.5,
    col: cols > 1 ? ((i % cols) + (j % cols)) / 2 / (cols - 1) : 0.5,
  });

  // Opening: the easy first reads, and the decoys (same flower, both pickable, no path).
  const moves0 = movesOf(st);
  const footholds: Foothold[] = [];
  for (const m of moves0) {
    const t = pairTrace(st.board, m[0], m[1]);
    if (t && isEasy(st.board, t)) footholds.push({ a: m[0], b: m[1], ...frac(m[0], m[1]) });
  }
  const legal0 = new Set(moves0.map(pairKey));
  const locked = lockedOf(st);
  const open: number[] = [];
  st.board.cells.forEach((v, i) => isCard(v) && !locked.has(i) && open.push(i));
  const decoys: DecoyPair[] = [];
  for (let x = 0; x < open.length; x++) {
    for (let y = x + 1; y < open.length; y++) {
      const a = open[x];
      const b = open[y];
      if (monthOf(st.board.cells[a]) === monthOf(st.board.cells[b]) && !legal0.has(pairKey([a, b]))) decoys.push({ a, b });
    }
  }
  const centroid = (k: 'row' | 'col') => (footholds.length ? footholds.reduce((s, f) => s + f[k], 0) / footholds.length : 0.5);

  // Matching w now leaves no clear, proven inside the budget (unfinished proofs don't count).
  const deadAfter = (w: Move): boolean => {
    const x = cloneState(st);
    if (!step(x, w, wind)) return cardsLeft(x) > 0;
    const p = proveClear(x, wind, strandBudget);
    return !p.moves && !p.exhausted;
  };

  // The line, pair by pair.
  const pairs: PairTrace[] = [];
  let moves = moves0;
  for (const m of line) {
    const t = pairTrace(st.board, m[0], m[1]);
    const month = monthOf(st.board.cells[m[0]]);
    const others = moves.filter((w) => pairKey(w) !== pairKey(m));
    const strands = others.some((w) => monthOf(st.board.cells[w[0]]) === month && deadAfter(w));
    // Critical: every other legal pair dead-ends (stops at the first one that doesn't).
    const critical = others.length > 0 && others.every(deadAfter);
    const before = new Set(moves.map(pairKey));
    step(st, m, wind);
    const next = movesOf(st);
    const opens = next.filter((n) => !before.has(pairKey(n))).length;
    pairs.push({
      a: m[0],
      b: m[1],
      bends: t?.bends ?? 0,
      length: t?.length ?? 0,
      edge: t?.edge ?? false,
      detour: t?.detour ?? false,
      legalBefore: moves.length,
      opens,
      strands,
      critical,
    });
    moves = next;
  }
  return { pairs, decoys, opening: { footholds, row: centroid('row'), col: centroid('col') } };
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
