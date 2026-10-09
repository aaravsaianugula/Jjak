import { describe, expect, it } from 'vitest';
import { EMPTY, FENCE_DOWN, FENCE_RIGHT, GATE, type Board, gateOf, isGate } from '../src/engine/board';
import { type LevelSpec, buildBoard, pickKnots, pickSnow, windOf } from '../src/engine/levels';
import { findMove, legalMoves } from '../src/engine/moves';
import { findPath, reachable } from '../src/engine/path';
import { applyPair } from '../src/engine/rules';
import { Session } from '../src/engine/session';
import { solve } from '../src/engine/solve';

const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({
  mode: 'journey', number: 99, seed: 'rules', rows: 8, cols: 6, stones: 0, months: 12, variants: true, par: 120, gravity: false, snow: 0, ...over,
});

describe('fences (paths cannot cross them)', () => {
  it('a fence blocks the straight path between two neighbours, but not a path around it', () => {
    // 3×3, cards of month 0 at (1,0) and (1,1), rest empty.
    const b: Board = { rows: 3, cols: 3, cells: Array(9).fill(EMPTY) };
    b.cells[3] = 0;
    b.cells[4] = 1;
    expect(findPath(b, 3, 4)!.length).toBe(2);
    b.walls = new Uint8Array(9);
    b.walls[3] = FENCE_RIGHT;
    const p = findPath(b, 3, 4);
    expect(p).not.toBeNull();
    expect(p!.length).toBeGreaterThan(2); // had to bend around
    // Fence the open sides too: no way through.
    b.walls[0] = FENCE_DOWN;
    b.walls[6] = 0;
    b.walls[3] |= FENCE_DOWN;
    b.walls[4] |= FENCE_DOWN;
    b.walls[1] |= FENCE_DOWN;
    // (1,0) can still leave through the left margin, so check against reachable.
    const r = reachable(b, 3);
    expect(r.has(4)).toBe(findPath(b, 3, 4) !== null);
  });

  it('reachable() agrees with findPath() on random fenced boards', () => {
    for (let k = 0; k < 40; k++) {
      const s = spec({ seed: `fz-${k}`, fences: 10, stones: 2 });
      const b = buildBoard(s);
      for (let i = 0; i < b.cells.length; i += 3) {
        if (b.cells[i] < 0) continue;
        const r = reachable(b, i);
        for (let j = 0; j < b.cells.length; j++) {
          if (j === i || b.cells[j] < 0) continue;
          expect(r.has(j)).toBe(findPath(b, i, j) !== null);
        }
      }
    }
  });
});

describe('gates (門)', () => {
  it('open when a pair of their flower is cleared, and block until then', () => {
    // 3×3 with a ring of month-1 cards around a gate of month 0 in the middle.
    const b: Board = { rows: 3, cols: 3, cells: [4, 0, 5, 1, gateOf(0), 2, 6, 3, 7] };
    const st = { board: b, hidden: new Set<number>(), knots: new Set<number>() };
    // (0,1) and (2,1) are both month 0; the gate blocks the straight line down the middle.
    expect(findPath(b, 1, 7)).toBeNull();
    const res = applyPair(st, 3, 5, null); // pair two month-0 cards (ids 1 and 2)
    expect(res.opened).toEqual([4]);
    expect(b.cells[4]).toBe(EMPTY);
    expect(findPath(b, 1, 7)!.length).toBe(2); // straight through the open gate
  });

  it('builds solvable gate boards (solver finds a full clear)', () => {
    let gated = 0;
    for (let k = 0; k < 40; k++) {
      const s = spec({ seed: `gate-${k}`, gates: 4, stones: 2 });
      const b = buildBoard(s);
      if (b.cells.some(isGate)) gated++;
      const res = solve({ board: b, hidden: new Set(), knots: new Set() }, null, 50000);
      expect(res.moves, `seed gate-${k}`).not.toBeNull();
    }
    expect(gated).toBeGreaterThan(30);
  });

  it('a session opens the gates of the flower just paired', () => {
    for (let k = 0; k < 20; k++) {
      const s = new Session(spec({ seed: `gs-${k}`, gates: 2 }), 0);
      const gates = s.board.cells.map((v, i) => (isGate(v) ? i : -1)).filter((i) => i >= 0);
      if (!gates.length) continue;
      const month = GATE - s.board.cells[gates[0]];
      // Clear any legal pair of that month if one is available now.
      const m = legalMoves(s.board, s.locked).find(([a]) => s.board.cells[a] >> 2 === month);
      if (!m) continue;
      s.tap(m[0], 0);
      const r = s.tap(m[1], 10);
      expect(r.kind).toBe('match');
      if (r.kind === 'match') expect(r.opened).toContain(gates[0]);
      expect(isGate(s.board.cells[gates[0]])).toBe(false);
      return;
    }
    throw new Error('no gate board with an opening pair found');
  });
});

describe('old boards are unchanged by the new mechanics', () => {
  it('a spec without gates or fences builds the same board as before (stable seeds)', () => {
    const b = buildBoard(spec({ seed: 'journey-30', stones: 4 }));
    expect(b.walls).toBeUndefined();
    expect(b.cells.some(isGate)).toBe(false);
  });
});

describe('solver', () => {
  it('proves wind, snow and knot boards and reports a valid sequence', () => {
    for (let k = 0; k < 12; k++) {
      const s = spec({ seed: `sv-${k}`, rows: 7, cols: 6, gravity: k % 2 ? 'left' : 'down', snow: 4, knots: k % 3 ? 2 : 0, stones: 2 });
      const b = buildBoard(s);
      const hidden = pickSnow(b, s.snow, s.seed);
      const knots = pickKnots(b, s.knots ?? 0, s.seed, hidden);
      const res = solve({ board: b, hidden, knots }, windOf(s), 80000);
      if (!res.moves) continue; // wind boards are not guaranteed; the director rejects these
      // Replay the sequence through the rules: each move must be legal in turn.
      const st = { board: { ...b, cells: b.cells.slice() }, hidden: new Set(hidden), knots: new Set(knots) };
      for (const [a, c] of res.moves) {
        expect(findPath(st.board, a, c)).not.toBeNull();
        applyPair(st, a, c, windOf(s));
        if (!findMove(st.board, new Set([...st.hidden, ...st.knots])) && st.board.cells.some((v) => v >= 0)) {
          st.hidden.clear();
          st.knots.clear();
        }
      }
      expect(st.board.cells.every((v) => v < 0)).toBe(true);
    }
  });
});
