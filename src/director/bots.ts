/**
 * Bot personas that play a board through the real rules (`rules.ts`), the way
 * King and Mugrai et al. playtest match-tile levels: instead of guessing how hard
 * a board is, let a few simple players try it and watch where they get stuck.
 *
 *   greedy      takes the first legal pair in reading order (top-left first)
 *   random      any legal pair, uniformly
 *   lookahead   1–2 ply: prefers pairs that leave the most pairs behind, never a dead end it can see
 *   human       an edge-first scanner with a limited view: looks near the last pair and
 *               along the rim first, sees straight and one-bend pairs before two-bend ones
 *
 * A playout never reshuffles: if a board runs out of pairs (after the free release
 * of snow and knots) the bot is "stuck", which the game would have to fix with a
 * reshuffle. No DOM imports: this runs in Node workers and Web Workers.
 */
import { type Board, cloneBoard, isCard, monthOf } from '../engine/board';
import { type LevelSpec, windOf } from '../engine/levels';
import { type Wind, legalMoves } from '../engine/moves';
import { findPath, pathBends } from '../engine/path';
import { type Rng, createRng } from '../engine/rng';
import { type PlayState, applyPair, lockedOf, releaseIfStuck } from '../engine/rules';
import { Session } from '../engine/session';

export type Move = [number, number];
export type BotId = 'greedy' | 'random' | 'lookahead' | 'lookahead2' | 'human';

/** The position a player starts from: the board plus the snow and knots the Session would lay. */
export function initialState(spec: LevelSpec, board: Board): PlayState {
  const s = new Session(spec, 0, cloneBoard(board));
  return { board: s.board, hidden: new Set(s.hidden), knots: new Set(s.knots) };
}

export function cloneState(st: PlayState): PlayState {
  return { board: cloneBoard(st.board), hidden: new Set(st.hidden), knots: new Set(st.knots) };
}

export function cardsOnBoard(b: Board): number {
  let n = 0;
  for (const v of b.cells) if (isCard(v)) n++;
  return n;
}

/** Bends in the best path between two cells (0–2), or -1 if they don't connect. */
export function bendsOf(b: Board, i: number, j: number): number {
  const p = findPath(b, i, j);
  return p ? Math.min(2, pathBends(p)) : -1;
}

/**
 * One step of play with the safety net the game gives for free. Returns false
 * when the board is truly stuck (cards left, no pair even after releasing snow
 * and knots), which the game would answer with a reshuffle.
 */
export function step(st: PlayState, m: Move, wind: Wind | null): boolean {
  applyPair(st, m[0], m[1], wind);
  if (cardsOnBoard(st.board) === 0) return true;
  return !releaseIfStuck(st);
}

/** Legal moves after the free release (the moves a player actually has). */
export function movesOf(st: PlayState): Move[] {
  return legalMoves(st.board, lockedOf(st));
}

export interface BotCtx {
  rng: Rng;
  wind: Wind | null;
  /** cells of the previous pair (before any slide), for the human scanner */
  last: Move | null;
  /** the human scanner's cost for its last choice: cells looked at + bends read */
  scanCost: number;
  /** a per-playout attention style for the human scanner: weight of the rim vs the last pair */
  rimBias: number;
}

export type Bot = (st: PlayState, moves: Move[], ctx: BotCtx) => Move;

const greedy: Bot = (_st, moves) => moves[0];
const random: Bot = (_st, moves, ctx) => moves[ctx.rng.int(moves.length)];

/** Score of a move one ply ahead: pairs left afterwards, -1 for a dead end. */
function after(st: PlayState, m: Move, wind: Wind | null): { next: PlayState; score: number } {
  const next = cloneState(st);
  const ok = step(next, m, wind);
  if (!ok) return { next, score: -1 };
  if (cardsOnBoard(next.board) === 0) return { next, score: 1000 };
  return { next, score: movesOf(next).length };
}

function lookaheadBot(depth: 1 | 2): Bot {
  return (st, moves, ctx) => {
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
      const a = after(st, m, ctx.wind);
      let score = a.score;
      if (depth === 2 && score > 0 && score < 1000) {
        // Best reply: the position this move leads to, looked at one more step.
        let reply = -1;
        for (const m2 of movesOf(a.next)) reply = Math.max(reply, after(a.next, m2, ctx.wind).score);
        score = reply < 0 ? -0.5 : score + 0.5 * reply;
      }
      // Small noise breaks ties without favouring the top-left.
      score += ctx.rng.next() * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  };
}

/**
 * The human-like scanner. Cells are looked at in an attention order (near the
 * last pair, then the rim, with a little noise); the view starts small and grows
 * until it holds a legal pair. Inside the view, fewer bends are seen first.
 */
const VIEW = 6;
const human: Bot = (st, moves, ctx) => {
  const b = st.board;
  const { rows, cols } = b;
  const lr = ctx.last ? (Math.floor(ctx.last[0] / cols) + Math.floor(ctx.last[1] / cols)) / 2 : -1;
  const lc = ctx.last ? ((ctx.last[0] % cols) + (ctx.last[1] % cols)) / 2 : -1;
  const attention: { i: number; k: number }[] = [];
  for (let i = 0; i < b.cells.length; i++) {
    if (!isCard(b.cells[i])) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    const rim = Math.min(r, c, rows - 1 - r, cols - 1 - c);
    const near = ctx.last ? Math.abs(r - lr) + Math.abs(c - lc) : 3;
    attention.push({ i, k: ctx.rimBias * rim + (1 - ctx.rimBias) * 0.6 * near + ctx.rng.next() * 1.2 });
  }
  attention.sort((p, q) => p.k - q.k);
  const rank = new Map<number, number>();
  attention.forEach((a, k) => rank.set(a.i, k));
  // A move is noticed once both its cards are in view.
  const seenAt = moves.map((m) => Math.max(rank.get(m[0]) ?? 99, rank.get(m[1]) ?? 99));
  let view = VIEW;
  let pool: number[] = [];
  for (; ; view += VIEW) {
    pool = [];
    seenAt.forEach((s, k) => s < view && pool.push(k));
    if (pool.length || view >= attention.length) break;
  }
  if (!pool.length) pool = moves.map((_, k) => k);
  let best = pool[0];
  let bestKey = Infinity;
  let bestBends = 0;
  for (const k of pool) {
    const bends = bendsOf(b, moves[k][0], moves[k][1]);
    const key = bends * 4 + seenAt[k] * 0.5 + ctx.rng.next();
    if (key < bestKey) {
      bestKey = key;
      best = k;
      bestBends = bends;
    }
  }
  // Cost: cards looked at until the first pair came into view, then the bends read.
  ctx.scanCost = Math.min(...seenAt) + 1 + 1.5 * bestBends;
  return moves[best];
};

export const BOTS: Record<BotId, Bot> = { greedy, random, lookahead: lookaheadBot(1), lookahead2: lookaheadBot(2), human };

export interface Playout {
  cleared: boolean;
  /** pairs made before the end (or before getting stuck) */
  pairs: number;
  /** pairs on the board at the start */
  total: number;
  /** human scanner only: summed scan cost (cells looked at + bends read) */
  scan: number;
  /** legal moves seen at each step */
  moves: number[];
}

/** Play one board to the end (or to a dead end) with a persona. Never reshuffles. */
export function playout(start: PlayState, wind: Wind | null, bot: BotId | Bot, seed: string | number, maxSteps = 200): Playout {
  const st = cloneState(start);
  const play = typeof bot === 'string' ? BOTS[bot] : bot;
  const rng = createRng(seed);
  const ctx: BotCtx = { rng, wind, last: null, scanCost: 0, rimBias: 0.35 + rng.next() * 0.5 };
  const total = cardsOnBoard(st.board) / 2;
  let pairs = 0;
  let scan = 0;
  const seen: number[] = [];
  for (let k = 0; k < maxSteps; k++) {
    if (cardsOnBoard(st.board) === 0) return { cleared: true, pairs, total, scan, moves: seen };
    let moves = movesOf(st);
    if (!moves.length) {
      if (releaseIfStuck(st)) return { cleared: false, pairs, total, scan, moves: seen };
      moves = movesOf(st);
    }
    seen.push(moves.length);
    const m = play(st, moves, ctx);
    scan += ctx.scanCost;
    ctx.last = m;
    pairs++;
    if (!step(st, m, wind)) return { cleared: cardsOnBoard(st.board) === 0, pairs, total, scan, moves: seen };
  }
  return { cleared: false, pairs, total, scan, moves: seen };
}

/** Convenience: play a spec's board with a persona. */
export function playSpec(spec: LevelSpec, board: Board, bot: BotId, seed: string | number): Playout {
  return playout(initialState(spec, board), windOf(spec), bot, seed);
}

export interface Proof {
  /** a clearing sequence (replayed and checked through the rules), or null */
  moves: Move[] | null;
  nodes: number;
  /** the node budget ran out before an answer */
  exhausted: boolean;
}

const stateKey = (st: PlayState) =>
  st.hidden.size || st.knots.size ? `${st.board.cells.join(',')}|${[...st.hidden].sort().join(',')}|${[...st.knots].sort().join(',')}` : st.board.cells.join(',');

/**
 * The solver persona: a depth-first search over legal pairs through the real
 * rules, without any reshuffle. On boards where cards stay put, clearing a pair
 * only ever opens space (paths, gates, snow and knots all react to space), so the
 * only real decisions are how to pair the cards of a flower with four (or six)
 * left. The search commits to "safe" pairs without branching: the last two cards
 * of a flower, or one pair of a flower whose other two cards are joined too.
 * Wind and falling leaves move cards, so there every pair is a decision and the
 * search orders them by how many pairs they leave. The found line is replayed
 * from the start before it is returned, so a proof is always a real clear.
 */
export function proveClear(start: PlayState, wind: Wind | null, budget = 6000): Proof {
  const seen = new Set<string>();
  const path: Move[] = [];
  let nodes = 0;
  let exhausted = false;
  const monthCount = (b: Board) => {
    const count = new Array(13).fill(0);
    for (const v of b.cells) if (isCard(v)) count[monthOf(v)]++;
    return count;
  };

  const dfs = (st: PlayState): boolean => {
    if (cardsOnBoard(st.board) === 0) return true;
    if (++nodes > budget) {
      exhausted = true;
      return false;
    }
    const key = stateKey(st);
    if (seen.has(key)) return false;
    seen.add(key);
    const moves = movesOf(st);
    if (!moves.length) return false;
    const count = monthCount(st.board);
    if (!wind) {
      // Safe pairs: commit without branching.
      const locked = lockedOf(st);
      for (const m of moves) {
        const month = monthOf(st.board.cells[m[0]]);
        let safe = count[month] === 2;
        if (!safe && count[month] === 4) {
          const rest: number[] = [];
          st.board.cells.forEach((v, i) => i !== m[0] && i !== m[1] && isCard(v) && monthOf(v) === month && rest.push(i));
          safe = rest.length === 2 && !locked.has(rest[0]) && !locked.has(rest[1]) && bendsOf(st.board, rest[0], rest[1]) >= 0;
        }
        if (!safe) continue;
        const next = cloneState(st);
        if (!step(next, m, wind)) break; // a release corner case: fall back to branching
        path.push(m);
        if (dfs(next)) return true;
        path.pop();
        return false;
      }
    }
    // Branch: try each pair, the ones leaving the most pairs first.
    const scored: { m: Move; next: PlayState; score: number }[] = [];
    for (const m of moves) {
      const next = cloneState(st);
      if (!step(next, m, wind)) {
        if (cardsOnBoard(next.board) === 0) scored.push({ m, next, score: 1e6 });
        continue;
      }
      const month = monthOf(st.board.cells[m[0]]);
      scored.push({ m, next, score: movesOf(next).length + (count[month] === 2 ? 50 : 0) });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const { m, next } of scored) {
      path.push(m);
      if (dfs(next)) return true;
      path.pop();
      if (exhausted) return false;
    }
    return false;
  };

  const found = dfs(cloneState(start));
  if (!found) return { moves: null, nodes, exhausted };
  // Replay the line from the start: every pair legal, no reshuffle, board empty.
  const st = cloneState(start);
  for (const m of path) {
    const legal = movesOf(st).some((x) => x[0] === m[0] && x[1] === m[1]);
    if (!legal) return { moves: null, nodes, exhausted: false };
    if (!step(st, m, wind) && cardsOnBoard(st.board) > 0) return { moves: null, nodes, exhausted: false };
  }
  return cardsOnBoard(st.board) === 0 ? { moves: path.slice(), nodes, exhausted: false } : { moves: null, nodes, exhausted: false };
}

/** Same-flower pairs a player can see right now (both cards pickable), joined or not. */
export function visiblePairs(st: PlayState): number {
  const locked = lockedOf(st);
  const count = new Array(13).fill(0);
  st.board.cells.forEach((v, i) => {
    if (isCard(v) && !locked.has(i)) count[monthOf(v)]++;
  });
  return count.reduce((s, c) => s + (c * (c - 1)) / 2, 0);
}
