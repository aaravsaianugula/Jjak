import { describe, expect, it } from 'vitest';
import { cloneState, initialState, movesOf, proveClear, step } from '../src/director/bots';
import { FUN, closingRunOf, funChecks, isEasy, measure, pairTrace } from '../src/director/metrics';
import { levelPlan, planSpec, tierKnobs } from '../src/director/plan';
import { funScore, searchLevel } from '../src/director/search';
import { validate } from '../src/director/validate';
import { type Board, EMPTY, STONE, monthOf } from '../src/engine/board';
import { type LevelSpec, buildBoard } from '../src/engine/levels';

const A = 0; // January
const B = 4; // February
const S = STONE;
const _ = EMPTY;

const spec = (rows: number, cols: number, stones = 0): LevelSpec => ({
  mode: 'journey', number: 99, seed: 'hand', rows, cols, stones, months: 2, variants: true, par: 60, gravity: false, snow: 0,
});

describe('pair traces', () => {
  it('reads an adjacent pair as a short, straight, inside read', () => {
    const b: Board = { rows: 3, cols: 3, cells: [A, A + 1, S, S, S, S, B, S, B + 1] };
    expect(pairTrace(b, 0, 1)).toMatchObject({ bends: 0, length: 1, edge: false, detour: false });
  });

  it('flags a path around the outside of the board as an edge route and a detour', () => {
    // A at both top corners with a stone between: the path leaves the board over the top.
    const b: Board = { rows: 3, cols: 3, cells: [A, S, A + 1, S, S, S, B, S, B + 1] };
    expect(pairTrace(b, 0, 2)).toMatchObject({ bends: 2, length: 4, edge: true, detour: true });
  });

  it('a U-turn inside the board is a detour but not an edge route', () => {
    // 4×3: A at (2,0) and (2,2) with a stone between, open row 1 above them, row 0 walled.
    const b: Board = { rows: 4, cols: 3, cells: [S, S, S, _, _, _, A, S, A + 1, S, S, S] };
    expect(pairTrace(b, 6, 8)).toMatchObject({ bends: 2, length: 4, edge: false, detour: true });
  });
});

// ---------------------------------------------------------------------------
// Hand-built boards whose fun shape is known.

/**
 * Packed 8×7 boards: a ring of stones around the two middle cells, every other cell
 * a card. Only the named easy pairs connect: no two other cards of a flower share a
 * side of the rim (they would meet around the outside) or touch.
 *   BURIED  one easy pair, the two middle cells (behind 44 cards)
 *   ON_RIM  four easy pairs, one on each side of the rim
 */
const BURIED: Board = {
  rows: 8,
  cols: 7,
  cells: [32, 28, 5, 20, 9, 13, 40, 21, 47, 35, 42, 39, 10, 34, 4, 26, S, S, S, 15, 25, 29, 11, S, 44, S, 27, 22, 2, 43, S, 45, S, 38, 0, 14, 7, S, S, S, 17, 12, 8, 16, 6, 23, 3, 31, 36, 41, 30, 37, 24, 33, 1, 46],
};
const ON_RIM: Board = {
  rows: 8,
  cols: 7,
  cells: [20, 39, 44, 45, 2, 17, 28, 16, 29, 25, 18, 31, 10, 5, 42, 47, S, S, S, 13, 24, 36, 19, S, 11, S, 26, 32, 37, 35, S, 21, S, 14, 33, 6, 9, S, S, S, 43, 1, 0, 27, 7, 30, 3, 15, 46, 34, 12, 40, 41, 4, 8, 38],
};

/** Pairs nested along a U-shaped corridor: exactly one pair connects at every step. */
function corridor(): Board {
  const rows = 8;
  const cols = 5;
  const cells = new Array<number>(rows * cols).fill(S);
  const path: number[] = [];
  for (let r = 0; r < rows; r++) path.push(r * cols + 1);
  path.push((rows - 1) * cols + 2);
  for (let r = rows - 1; r >= 1; r--) path.push(r * cols + 3);
  for (let k = 0; k < path.length / 2; k++) {
    cells[path[k]] = k * 4;
    cells[path[path.length - 1 - k]] = k * 4 + 1;
  }
  return { rows, cols, cells };
}

/** Twelve flowers, each pair side by side on a 4×6 board: every pair is open all game. */
function openGrid(): Board {
  const cells: number[] = [];
  for (let m = 0; m < 12; m++) cells.push(m * 4, m * 4 + 1);
  return { rows: 4, cols: 6, cells };
}

const specFor = (b: Board): LevelSpec => ({ ...spec(b.rows, b.cols, b.cells.filter((v) => v === S).length), months: 12 });

describe('fun shape (hand-built boards)', () => {
  it('the board fixtures are what they claim', () => {
    const buried = BURIED;
    expect(movesOf(initialState(specFor(buried), buried))).toHaveLength(1);
    const rim = ON_RIM;
    expect(movesOf(initialState(specFor(rim), rim))).toHaveLength(4);
    const c = corridor();
    const st = initialState(specFor(c), c);
    for (let k = 0; k < 8; k++) {
      const moves = movesOf(st);
      expect(moves).toHaveLength(1);
      step(st, moves[0], null);
    }
    expect(st.board.cells.some((v) => v >= 0)).toBe(false);
  });

  it('an easy pair the scanner finds early is a foothold; one buried in a packed board is not', () => {
    const buried = BURIED;
    const rim = ON_RIM;
    const mb = measure(specFor(buried), buried);
    const mr = measure(specFor(rim), rim);
    // Both have an easy read on the board at the start: the old mark passed both.
    expect(mb.easyOpen).toBe(1);
    expect(mr.easyOpen).toBe(4);
    expect(mb.easySeconds).toBeGreaterThan(FUN.footholdSeconds);
    expect(mr.easySeconds).toBeLessThanOrEqual(FUN.footholdSeconds);
    expect(funChecks(mb).foothold).toBe(false);
    expect(funChecks(mr).foothold).toBe(true);
    expect(mr.foothold).toBeGreaterThan(mb.foothold);
  });

  it('only two-bend reads at the start: no foothold, and the validators refuse it', () => {
    const easy: Board = { rows: 3, cols: 3, cells: [A, A + 1, S, S, S, S, B, S, B + 1] };
    const hard: Board = { rows: 3, cols: 3, cells: [A, S, A + 1, S, S, S, B, S, B + 1] };
    const me = measure(spec(3, 3, 5), easy);
    const mh = measure(spec(3, 3, 5), hard);
    expect(funChecks(me).foothold).toBe(true);
    expect(funChecks(mh).foothold).toBe(false);
    expect(validate(spec(3, 3, 5), hard, mh, { skipRebuild: true }).reasons).toContain('foothold');
    expect(validate(spec(3, 3, 5), easy, me, { skipRebuild: true }).reasons).not.toContain('foothold');
  });

  it('one pair at a time with the board still full is a crunch; an open board thinning out at the end is not', () => {
    const c = corridor();
    const g = openGrid();
    const mc = measure(specFor(c), c);
    const mg = measure(specFor(g), g);
    expect(mc.crunch).toBe(1);
    expect(mg.crunch).toBe(0);
    expect(funChecks(mc).crunch).toBe(true);
    expect(funChecks(mg).crunch).toBe(false);
  });

  it('an ending with a choice of pairs, each found inside the combo window, is a combo finish; a one-at-a-time ending is not', () => {
    const c = corridor();
    const g = openGrid();
    const mc = measure(specFor(c), c);
    const mg = measure(specFor(g), g);
    expect(mg.closingRun).toBeGreaterThanOrEqual(FUN.closingRun);
    expect(mc.closingRun).toBeLessThan(2);
    expect(funChecks(mg).finale).toBe(true);
    expect(funChecks(mc).finale).toBe(false);
    expect(mg.finale).toBeGreaterThan(mc.finale);
  });

  it('a game that ends stuck has no closing run, however quick its last pairs were', () => {
    const quick = { total: 6, moves: [6, 5, 4, 3, 2], scans: [1, 1, 1, 1, 1], bends: [0, 0, 0, 0, 0] };
    expect(closingRunOf({ ...quick, cleared: false })).toBe(0);
    expect(closingRunOf({ ...quick, moves: [...quick.moves, 1], scans: [...quick.scans, 1], bends: [...quick.bends, 0], cleared: true })).toBe(6);
  });

  it('a board the scanner gets stuck on has no combo finish', () => {
    const buried = BURIED;
    const m = measure(specFor(buried), buried);
    expect(m.humanStuck).toBe(1);
    expect(m.closingRun).toBe(0);
    expect(funChecks(m).finale).toBe(false);
  });

  it('a small board passes the finale when its whole game is one quick run', () => {
    const b: Board = { rows: 2, cols: 4, cells: [A, A + 1, B, B + 1, 8, 9, 12, 13] };
    const m = measure({ ...spec(2, 4), months: 4 }, b);
    expect(m.pairs).toBe(4);
    expect(funChecks(m).finale).toBe(true);
  });

  it('an easy read has at most one bend and a path no longer than the long side of the board', () => {
    const b: Board = { rows: 4, cols: 3, cells: new Array(12).fill(EMPTY) };
    expect(isEasy(b, { bends: 1, length: 4 })).toBe(true);
    expect(isEasy(b, { bends: 1, length: 5 })).toBe(false);
    expect(isEasy(b, { bends: 2, length: 3 })).toBe(false);
  });
});

describe('board reading (the tailoring contract)', () => {
  it('traces every pair of the solve, in order, as a real clear', () => {
    const p = levelPlan(130);
    const s = planSpec(p, tierKnobs(p, 3), 'reading-130', 3);
    const board = buildBoard(s);
    const m = measure(s, board, { reading: true });
    const r = m.reading!;
    expect(r.pairs.length).toBe(m.pairs);
    const st = initialState(s, board);
    for (const t of r.pairs) {
      expect(movesOf(st).some(([a, b]) => (a === t.a && b === t.b) || (a === t.b && b === t.a))).toBe(true);
      expect([0, 1, 2]).toContain(t.bends);
      expect(t.length).toBeGreaterThanOrEqual(1);
      step(st, [t.a, t.b], null);
    }
    // Footholds are the easy opening pairs, placed as row/column fractions.
    expect(r.opening.footholds.length).toBe(m.easyOpen);
    for (const f of r.opening.footholds) {
      expect(f.row).toBeGreaterThanOrEqual(0);
      expect(f.row).toBeLessThanOrEqual(1);
      expect(f.col).toBeGreaterThanOrEqual(0);
      expect(f.col).toBeLessThanOrEqual(1);
    }
    // Decoys: same flower, both pickable, no path at the start.
    const st0 = initialState(s, board);
    const legal = movesOf(st0);
    for (const { a, b } of r.decoys) {
      expect(monthOf(board.cells[a])).toBe(monthOf(board.cells[b]));
      expect(legal.some(([x, y]) => (x === a && y === b) || (x === b && y === a))).toBe(false);
    }
  });

  it('an unfinished proof never counts as a dead end', () => {
    // A board with a stranding wrong match at the normal budget…
    let found = false;
    for (let k = 0; k < 12 && !found; k++) {
      const p = levelPlan(200 + k);
      if (p.fixed || p.wind) continue;
      const s = planSpec(p, tierKnobs(p, 4), `strand-${k}`, 4);
      const board = buildBoard(s);
      if (!measure(s, board, { reading: true }).reading!.pairs.some((t) => t.strands)) continue;
      found = true;
      // …claims none when no proof can finish.
      const r = measure(s, board, { reading: true, strandBudget: 1 }).reading!;
      expect(r.pairs.length).toBeGreaterThan(0);
      expect(r.pairs.some((t) => t.strands)).toBe(false);
    }
    expect(found).toBe(true);
  });

  it('a forced pair (the only legal one) opens the next but is not critical: there is no order to get wrong', () => {
    // A corridor walled by stones: B B sits between the two A cards.
    const b: Board = { rows: 3, cols: 4, cells: [S, S, S, S, A, B, B + 1, A + 1, S, S, S, S] };
    const r = measure(spec(3, 4, 8), b, { reading: true }).reading!;
    expect(r.pairs.map((t) => [t.a, t.b].sort((x, y) => x - y))).toEqual([[5, 6], [4, 7]]);
    expect(r.pairs[0]).toMatchObject({ legalBefore: 1, opens: 1, strands: false, critical: false });
    expect(r.pairs[1]).toMatchObject({ legalBefore: 1, opens: 0, critical: false, bends: 0, length: 3 });
    expect(r.decoys).toEqual([{ a: 4, b: 7 }]);
    expect(r.opening.footholds).toEqual([{ a: 5, b: 6, row: 0.5, col: 0.5 }]);
  });

  it('two independent legal pairs: either order works, so neither is critical (even the one that opens a pair)', () => {
    const C = 8; // March
    // Two walled corridors: A B B A (B B opens A A) and C C.
    const b: Board = { rows: 5, cols: 4, cells: [S, S, S, S, A, B, B + 1, A + 1, S, S, S, S, S, C, C + 1, S, S, S, S, S] };
    const r = measure({ ...spec(5, 4, 14), months: 3 }, b, { reading: true }).reading!;
    expect(r.pairs.length).toBe(3);
    expect(r.pairs[0].legalBefore).toBe(2);
    for (const t of r.pairs) expect(t.critical).toBe(false);
  });

  it('a pair is critical exactly when it must come before every other legal pair (each one, played now, proven to strand the board)', () => {
    const deadAfter = (st: ReturnType<typeof initialState>, m: [number, number], wind: null) => {
      const x = cloneState(st);
      if (!step(x, m, wind)) return x.board.cells.some((v) => v >= 0);
      const proof = proveClear(x, wind, 200000);
      return !proof.moves && !proof.exhausted;
    };
    let critical = 0;
    let open = 0;
    for (let k = 0; k < 40 && critical < 3; k++) {
      const p = levelPlan(200 + k);
      if (p.fixed || p.wind) continue;
      const s = planSpec(p, tierKnobs(p, 4), `critical-${k}`, 4);
      const board = buildBoard(s);
      const r = measure(s, board, { reading: true }).reading!;
      const st = initialState(s, board);
      for (const t of r.pairs) {
        const others = movesOf(st).filter(([a, b]) => !(a === t.a && b === t.b) && !(a === t.b && b === t.a));
        if (t.critical) {
          critical++;
          expect(others.length).toBeGreaterThan(0);
          for (const w of others) expect(deadAfter(st, w, null)).toBe(true);
        } else if (others.length) {
          // an order that is free: some other pair could come first and the board still clears
          open++;
          if (open % 7 === 0) expect(others.some((w) => !deadAfter(st, w, null))).toBe(true);
        }
        step(st, [t.a, t.b], null);
      }
    }
    expect(critical).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(critical);
  });

  it('a pair flagged as stranding really has a tempting wrong match that dead-ends', () => {
    let flagged = 0;
    for (let k = 0; k < 12 && flagged < 3; k++) {
      const p = levelPlan(200 + k);
      if (p.fixed || p.wind) continue;
      const s = planSpec(p, tierKnobs(p, 4), `strand-${k}`, 4);
      const board = buildBoard(s);
      const r = measure(s, board, { reading: true }).reading!;
      const st = initialState(s, board);
      for (const t of r.pairs) {
        if (t.strands) {
          flagged++;
          // Some other legal pairing of this flower, right now, leaves no clear at all.
          const month = monthOf(st.board.cells[t.a]);
          const wrong = movesOf(st).filter(([a, b]) => monthOf(st.board.cells[a]) === month && !(a === t.a && b === t.b) && !(a === t.b && b === t.a));
          const dead = wrong.some((m) => {
            const x = cloneState(st);
            if (!step(x, m, null)) return true;
            const proof = proveClear(x, null, 200000);
            return !proof.moves && !proof.exhausted;
          });
          expect(dead).toBe(true);
        }
        step(st, [t.a, t.b], null);
      }
    }
    expect(flagged).toBeGreaterThan(0);
  });
});

describe('fitness prefers fun boards', () => {
  const base = { pairs: 20, easySeconds: 5, crunch: 0.6, closingRun: 7, fun: 0.7 };
  it('a board with no early easy read loses to one with a foothold', () => {
    expect(funScore({ ...base, easySeconds: 14 })).toBeLessThan(funScore(base) - 0.1);
  });
  it('a mid-board crunch and a combo finish each score', () => {
    expect(funScore({ ...base, crunch: 0.2 })).toBeLessThan(funScore(base));
    expect(funScore({ ...base, closingRun: 3 })).toBeLessThan(funScore(base));
  });
  it('a combo finish outweighs being 0.06 further from the target difficulty', () => {
    // fitness = -3·|d − target| + 0.3·funScore (+ novelty): the finale mark alone must cover 0.18.
    const withFinale = { ...base, closingRun: 6, fun: 0.6 };
    const without = { ...base, closingRun: 5, fun: 0.6 };
    expect(0.3 * (funScore(withFinale) - funScore(without))).toBeGreaterThan(3 * 0.06);
  });
  it('the search ranks equally close candidates by fun', () => {
    const p = levelPlan(150);
    const r = searchLevel(p, 2, { K: 4, climb: 0, measure: { random: 6, human: 3 }, weights: { target: 0, novelty: 0 } });
    for (let i = 1; i < r.pool.length; i++) expect(funScore(r.pool[i - 1].metrics)).toBeGreaterThanOrEqual(funScore(r.pool[i].metrics));
  });
});
