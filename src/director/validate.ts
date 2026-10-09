/**
 * Hard gates (Smith & Mateas: constraints are the design space, never soft
 * scores). A candidate board that fails any of these is rejected and the search
 * makes another; nothing here is ever traded off against fun or novelty.
 *
 *   size         at most 8 rows × 7 columns (cards stay tappable at 360 wide)
 *   solvable     the solver proves a full clear from the very first state,
 *                through the real rules (gates, wind, snow, knots and their free
 *                release), without any reshuffle
 *   identity     every mechanic the level's identity names is really on the board
 *   foothold     enough opening pairs for the tier, and at least one of them an
 *                easy read (0–1 bend, short path) so nobody starts stuck
 *   non-trivial  a minimum share of 2-bend reading on boards of real size
 *   dead ends    the naive dead-end rate sits inside the tier's band
 *   determinism  rebuilding the spec gives the same board, cell for cell
 *   time         (optional) generation stayed inside its budget
 *
 * No DOM imports.
 */
import { type Board, isGate } from '../engine/board';
import { type LevelSpec, buildBoard, windOf } from '../engine/levels';
import { mechanicsOf } from '../engine/mechanics';
import { hashSeed } from '../engine/rng';
import { initialState } from './bots';
import { type Metrics } from './metrics';
import { type LevelPlan, MAX_COLS, MAX_ROWS } from './plan';

/** Per tier (0 gentle … 4 hardest). */
export const BANDS = {
  /** fewest legal pairs at the start */
  opening: [3, 3, 2, 2, 2],
  /** least share of 2-bend pairs along the solve (boards of 14+ pairs) */
  twoBend: [0, 0.1, 0.15, 0.2, 0.2],
  /** naive dead-end rate: [min, max]; boards that slide get a little more room */
  deadEnd: [
    [0, 0.35],
    [0, 0.45],
    [0, 0.6],
    [0, 0.75],
    [0, 0.85],
  ] as [number, number][],
  slideRoom: 0.1,
};

export interface ValidateOptions {
  /** the tier the board is for (defaults to spec.tier, then 2) */
  tier?: number;
  /** the level identity, to check that every named mechanic is on the board */
  plan?: LevelPlan;
  /** milliseconds the candidate took to build and measure, and the budget for it */
  elapsedMs?: number;
  timeBudgetMs?: number;
  /** skip the rebuild-determinism check (the caller already did it) */
  skipRebuild?: boolean;
}

export interface Verdict {
  ok: boolean;
  /** short codes of the gates that failed (empty when ok) */
  reasons: string[];
}

/** A short, stable hash of the board a player will see: cells, fences, snow and knots. */
export function boardHash(spec: LevelSpec, board: Board): string {
  const st = initialState(spec, board);
  const key = `${board.rows}x${board.cols}|${board.cells.join(',')}|${board.walls ? [...board.walls].join('') : ''}|${[...st.hidden].sort((a, b) => a - b).join(',')}|${[...st.knots].sort((a, b) => a - b).join(',')}`;
  return (hashSeed(key) % 36 ** 5).toString(36).padStart(5, '0');
}

export function validate(spec: LevelSpec, board: Board, m: Metrics, opts: ValidateOptions = {}): Verdict {
  const reasons: string[] = [];
  const t = Math.max(0, Math.min(4, Math.round(opts.tier ?? spec.tier ?? 2)));
  const fixed = !!opts.plan?.fixed;

  if (spec.rows > MAX_ROWS || spec.cols > MAX_COLS || board.rows !== spec.rows || board.cols !== spec.cols) reasons.push('size');
  if (!m.solved) reasons.push('unsolved');

  // Identity: every mechanic the level names is on the board as built.
  const st = initialState(spec, board);
  const stones = board.cells.filter((v) => v === -2).length;
  const gates = board.cells.filter(isGate).length;
  if (stones !== spec.stones) reasons.push('stones');
  if ((spec.gates ?? 0) !== gates) reasons.push('gates');
  if ((spec.fences ?? 0) > 0 && !(board.walls && board.walls.some((w) => w !== 0))) reasons.push('fences');
  if (spec.snow > 0 && st.hidden.size === 0) reasons.push('snow');
  if ((spec.knots ?? 0) > 0 && st.knots.size === 0) reasons.push('knots');
  if (spec.lucky && !board.cells.includes(48)) reasons.push('lucky');
  if (opts.plan) {
    const on = mechanicsOf(spec);
    for (const mech of opts.plan.mechanics) if (!on.includes(mech)) reasons.push(`missing:${mech}`);
    if (windOf(spec) !== opts.plan.wind) reasons.push('wind');
  }

  if (!fixed) {
    if (m.opening < Math.min(BANDS.opening[t], Math.max(1, m.pairs - 1)) || m.easyOpen < 1) reasons.push('foothold');
    if (m.pairs >= 14 && m.twoBend < BANDS.twoBend[t]) reasons.push('trivial');
    const [lo, hi] = BANDS.deadEnd[t];
    const room = windOf(spec) ? BANDS.slideRoom : 0;
    if (m.deadEnd < lo || m.deadEnd > hi + room) reasons.push('dead-ends');
  } else if (m.opening < 1 || m.easyOpen < 1) reasons.push('foothold');

  if (!opts.skipRebuild) {
    const again = buildBoard(spec);
    if (again.cells.length !== board.cells.length || again.cells.some((v, i) => v !== board.cells[i])) reasons.push('nondeterministic');
  }
  if (opts.timeBudgetMs != null && opts.elapsedMs != null && opts.elapsedMs > opts.timeBudgetMs) reasons.push('time');
  return { ok: reasons.length === 0, reasons };
}
