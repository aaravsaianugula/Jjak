import { describe, expect, it } from 'vitest';
import { cloneState, initialState, movesOf, proveClear, step } from '../src/director/bots';
import { FUN, funChecks, funShape, isEasy, measure, pairTrace } from '../src/director/metrics';
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

describe('fun shape', () => {
  it('an easily read opening pair is a foothold; only two-bend reads at the start are not', () => {
    const easy: Board = { rows: 3, cols: 3, cells: [A, A + 1, S, S, S, S, B, S, B + 1] };
    const hard: Board = { rows: 3, cols: 3, cells: [A, S, A + 1, S, S, S, B, S, B + 1] };
    const me = measure(spec(3, 3, 5), easy);
    const mh = measure(spec(3, 3, 5), hard);
    expect(me.easyOpen).toBe(1);
    expect(mh.easyOpen).toBe(0);
    expect(funChecks(me).foothold).toBe(true);
    expect(funChecks(mh).foothold).toBe(false);
    // The validators refuse a board with no easy first read.
    expect(validate(spec(3, 3, 5), hard, mh, { skipRebuild: true }).reasons).toContain('foothold');
    expect(validate(spec(3, 3, 5), easy, me, { skipRebuild: true }).reasons).not.toContain('foothold');
  });

  it('a mid-board dip in legal pairs is a crunch; a flat game is not', () => {
    // The tightest point is mid-way through the middle third, not at its edge.
    const dip = funShape([8, 7, 6, 5, 2, 3, 5, 4, 3, 2, 1]);
    const flat = funShape([8, 8, 8, 8, 8, 8, 7, 6, 5, 3, 1]);
    expect(dip.crunch).toBeGreaterThanOrEqual(FUN.crunch);
    expect(flat.crunch).toBeLessThan(FUN.crunch);
  });

  it('an ending where nearly every pair left connects is a combo finish; a tight one is not', () => {
    const open = funShape([6, 5, 3, 2, 2, 4, 5, 4, 3, 2, 1]);
    const tight = funShape([6, 5, 3, 2, 2, 3, 2, 1, 1, 1, 1]);
    expect(open.finale).toBeGreaterThanOrEqual(FUN.finale);
    expect(tight.finale).toBeLessThan(FUN.finale);
  });

  it('an easy read has at most one bend and a path no longer than the long side of the board', () => {
    const b: Board = { rows: 4, cols: 3, cells: new Array(12).fill(EMPTY) };
    expect(isEasy(b, { bends: 1, length: 4 })).toBe(true);
    expect(isEasy(b, { bends: 1, length: 5 })).toBe(false);
    expect(isEasy(b, { bends: 2, length: 3 })).toBe(false);
  });

  it('a slow first read (over 10 s) is not a foothold even with an easy pair on the board', () => {
    expect(funChecks({ easyOpen: 2, firstSeconds: 12, crunch: 0.5, finale: 0.9 }).foothold).toBe(false);
    expect(funChecks({ easyOpen: 2, firstSeconds: 6, crunch: 0.5, finale: 0.9 }).foothold).toBe(true);
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
  const base = { easyOpen: 2, firstSeconds: 4, crunch: 0.5, finale: 0.9, fun: 0.7 };
  it('a board with no easy first read loses to one with a foothold', () => {
    expect(funScore({ ...base, easyOpen: 0 })).toBeLessThan(funScore(base) - 0.3);
    expect(funScore({ ...base, firstSeconds: 14 })).toBeLessThan(funScore(base) - 0.3);
  });
  it('a mid-board crunch and an ending that opens up each score', () => {
    expect(funScore({ ...base, crunch: 0.2 })).toBeLessThan(funScore(base));
    expect(funScore({ ...base, finale: 0.5 })).toBeLessThan(funScore(base));
  });
  it('the search ranks equally close candidates by fun', () => {
    const p = levelPlan(150);
    const r = searchLevel(p, 2, { K: 4, climb: 0, measure: { random: 6, human: 3 }, weights: { target: 0, novelty: 0 } });
    for (let i = 1; i < r.pool.length; i++) expect(funScore(r.pool[i - 1].metrics)).toBeGreaterThanOrEqual(funScore(r.pool[i].metrics));
  });
});
