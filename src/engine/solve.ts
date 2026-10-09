/**
 * A full solver: depth-first search over legal pairs, stepping through the real
 * rules (gates, wind, snow, knots and the free release of snow and knots). It
 * proves a board can be cleared without any reshuffle by returning one clearing
 * sequence. Visited positions are remembered, and the search gives up after a
 * node budget (callers treat that as "not proven").
 */
import { type Board, isCard, monthOf } from './board';
import { type Wind, legalMoves } from './moves';
import { type Freed, type PlayState, applyPair, cloneState, lockedOf, releaseIfStuck } from './rules';

export { cloneState };

export interface SolveResult {
  /** a clearing sequence, or null if none was found inside the budget */
  moves: [number, number][] | null;
  /** search nodes expanded */
  nodes: number;
  /** true if the budget ran out before an answer */
  exhausted: boolean;
}

const keyOf = (st: PlayState) =>
  `${st.board.cells.join(',')}|${[...st.hidden].sort().join(',')}|${[...st.knots].sort().join(',')}` +
  (st.board.seals ? `|s${st.board.seals.join('')}` : '') +
  (st.board.ink ? `|i${st.board.ink.join('')}` : '');

export interface SolveOptions {
  /**
   * Never lean on the free release of seals and ink: a position that would need
   * a seal broken or a blot dried early counts as a dead end. Proves a board
   * clears in the seals' order with the ink drying only by itself.
   */
  strict?: boolean;
}

/**
 * Search for a full clear. Moves are tried in an order that finishes most boards
 * on the first dive: pairs that leave the most moves behind come first.
 */
export function solve(start: PlayState, wind: Wind | null, budget = 20000, opts: SolveOptions = {}): SolveResult {
  const seen = new Set<string>();
  let nodes = 0;
  let exhausted = false;
  const path: [number, number][] = [];

  // Without sliding, a pair that can't be chosen any other way is always safe to
  // take (see forced()); taking those first keeps the search narrow.
  const dfs = (from: PlayState): boolean => {
    const mark = path.length;
    let st = from;
    if (!wind) {
      st = cloneState(from);
      if (!forced(st, path, opts.strict === true)) {
        path.length = mark;
        return false;
      }
    }
    if (search(st)) return true;
    path.length = mark;
    return false;
  };

  const search = (st: PlayState): boolean => {
    let left = 0;
    for (const v of st.board.cells) if (isCard(v)) left++;
    if (left === 0) return true;
    if (++nodes > budget) {
      exhausted = true;
      return false;
    }
    const k = keyOf(st);
    if (seen.has(k)) return false;
    seen.add(k);
    const moves = legalMoves(st.board, lockedOf(st));
    if (!moves.length) return false;
    // Order: try each move one step ahead and prefer positions with more options.
    const scored = moves.map((m) => {
      const next = cloneState(st);
      applyPair(next, m[0], m[1], wind);
      const stuck = cardsLeft(next.board) > 0 && release(next, opts.strict === true) !== 'moving';
      return { m, next, score: stuck ? -1 : legalMoves(next.board, lockedOf(next)).length };
    });
    scored.sort((a, b) => b.score - a.score);
    for (const { m, next, score } of scored) {
      if (score < 0) continue;
      path.push(m);
      if (dfs(next)) return true;
      path.pop();
      if (exhausted) return false;
    }
    return false;
  };

  const ok = dfs(cloneState(start));
  return { moves: ok ? path.slice() : null, nodes, exhausted };
}

/**
 * Take every safe pair, repeatedly (boards without sliding only). Clearing cards
 * never closes a path there: gates only open, snow and knots only let go. So a
 * flower with just two cards left, or with four that split into two pairs that
 * are both legal now, has no choice worth keeping open: clear them. Pushes the
 * moves onto `path` and mutates `st`. Returns false only for a strict search
 * that had to lean on the seals' or the ink's safety net (a dead end there).
 */
function forced(st: PlayState, path: [number, number][], strict: boolean): boolean {
  for (let guard = 0; guard < 64; guard++) {
    const count = new Array(13).fill(0);
    for (const v of st.board.cells) if (isCard(v)) count[monthOf(v)]++;
    const byMonth = new Map<number, [number, number][]>();
    for (const m of legalMoves(st.board, lockedOf(st))) {
      const month = monthOf(st.board.cells[m[0]]);
      if (count[month] !== 2 && count[month] !== 4) continue;
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(m);
    }
    let take: [number, number][] | null = null;
    for (const [month, ms] of byMonth) {
      if (count[month] === 2) take = [ms[0]];
      else {
        for (let i = 0; i < ms.length && !take; i++)
          for (let j = i + 1; j < ms.length && !take; j++)
            if (new Set([...ms[i], ...ms[j]]).size === 4) take = [ms[i], ms[j]];
      }
      if (take) break;
    }
    if (!take) return true;
    for (const m of take) {
      // The second pair of four stays legal: clearing the first only opens space.
      applyPair(st, m[0], m[1], null);
      path.push(m);
    }
    if (cardsLeft(st.board) > 0) {
      const r = release(st, strict);
      if (r === 'lifted') return false;
      if (r === 'stuck') return true;
    }
  }
  return true;
}

/**
 * The safety net: 'stuck' when no pair is left even after it, 'lifted' when a
 * strict search needed seals or ink lifted to go on, else 'moving'.
 */
function release(st: PlayState, strict: boolean): 'moving' | 'stuck' | 'lifted' {
  const freed: Freed = { dried: [], unsealed: [] };
  if (releaseIfStuck(st, [], [], freed)) return 'stuck';
  return strict && (freed.dried.length > 0 || freed.unsealed.length > 0) ? 'lifted' : 'moving';
}

function cardsLeft(b: Board): number {
  let n = 0;
  for (const v of b.cells) if (isCard(v)) n++;
  return n;
}
