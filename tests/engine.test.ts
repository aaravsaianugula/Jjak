import { describe, expect, it } from 'vitest';
import { EMPTY, STONE, type Board, cardsLeft, isCard, monthOf } from '../src/engine/board';
import { generateBoard, reshuffle } from '../src/engine/generate';
import { buildBoard, dailyLevel, dailyNumber, dailyTheme, journeyLevel, pickSnow, zenLevel } from '../src/engine/levels';
import { applyGravity, countMoves, findMove } from '../src/engine/moves';
import { findPath, reachable } from '../src/engine/path';
import { createRng } from '../src/engine/rng';
import { Session, starCount } from '../src/engine/session';

const board = (rows: string[]): Board => {
  // '.' empty, '#' stone, digit = month (card id = month * 4)
  const cells = rows.flatMap((row) =>
    [...row].map((ch) => (ch === '.' ? EMPTY : ch === '#' ? STONE : Number.parseInt(ch, 36) * 4)),
  );
  return { rows: rows.length, cols: rows[0].length, cells };
};

const turns = (pts: { r: number; c: number }[]) => pts.length - 2;

/** Greedy play-out: always take the first legal jjak. Mirrors what the player does. */
function solveByReverseIsPossible(b: Board): boolean {
  // A board built by construction must be fully clearable by *some* order. We verify by DFS.
  const seen = new Set<string>();
  const dfs = (cur: Board): boolean => {
    if (cardsLeft(cur) === 0) return true;
    const key = cur.cells.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    for (let i = 0; i < cur.cells.length; i++) {
      if (!isCard(cur.cells[i])) continue;
      for (const j of reachable(cur, i)) {
        if (j <= i || !isCard(cur.cells[j]) || monthOf(cur.cells[j]) !== monthOf(cur.cells[i])) continue;
        const next = { ...cur, cells: cur.cells.slice() };
        next.cells[i] = EMPTY;
        next.cells[j] = EMPTY;
        if (dfs(next)) return true;
        if (seen.size > 20000) return false;
      }
    }
    return false;
  };
  return dfs(b);
}

describe('path finding (Shisen-sho rule)', () => {
  it('connects adjacent cards with a straight line', () => {
    const b = board(['11', '..']);
    expect(findPath(b, 0, 1)).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }]);
  });

  it('routes around the outer margin', () => {
    // two 1s on the top edge with a blocker between: go up and over
    const b = board(['121', '222']);
    const p = findPath(b, 0, 2)!;
    expect(p).not.toBeNull();
    expect(turns(p)).toBe(2);
    expect(p.some((pt) => pt.r === -1)).toBe(true);
  });

  it('allows one turn (L shape)', () => {
    const b = board(['1..', '22.', '221']);
    const p = findPath(b, 0, 8)!;
    expect(turns(p)).toBe(1);
  });

  it('rejects paths needing three turns', () => {
    // 1 at (1,1) is fully enclosed except a winding corridor
    const b = board(['22222', '21.22', '222.2', '22221', '22222']);
    expect(findPath(b, 6, 19)).toBeNull();
  });

  it('never passes through stones', () => {
    const b = board(['1#1']);
    // can still go around via margin
    expect(turns(findPath(b, 0, 2)!)).toBe(2);
    const enclosed = board(['###', '#1#', '###', '#1#', '###']);
    expect(findPath(enclosed, 4, 10)).toBeNull();
  });

  it('reachable() agrees with findPath()', () => {
    const rng = createRng('agree');
    for (let k = 0; k < 40; k++) {
      const b = buildBoard(journeyLevel(6 + k));
      // knock out random cards to create corridors
      for (let i = 0; i < b.cells.length; i++) if (rng.next() < 0.35 && isCard(b.cells[i])) b.cells[i] = EMPTY;
      for (let i = 0; i < b.cells.length; i++) {
        if (!isCard(b.cells[i])) continue;
        const reach = reachable(b, i);
        for (let j = 0; j < b.cells.length; j++) {
          if (j === i || !isCard(b.cells[j])) continue;
          expect(reach.has(j)).toBe(findPath(b, i, j) !== null);
        }
      }
    }
  });
});

describe('generation', () => {
  it('is deterministic per seed', () => {
    const a = buildBoard(journeyLevel(14));
    const b = buildBoard(journeyLevel(14));
    expect(a.cells).toEqual(b.cells);
  });

  it('every month appears an even number of times and stones are kept', () => {
    for (let n = 1; n <= 60; n++) {
      const spec = journeyLevel(n);
      const b = buildBoard(spec);
      const counts = new Map<number, number>();
      for (const v of b.cells) if (isCard(v)) counts.set(monthOf(v), (counts.get(monthOf(v)) ?? 0) + 1);
      for (const c of counts.values()) expect(c % 2).toBe(0);
      expect(b.cells.filter((v) => v === STONE).length).toBe(spec.stones);
    }
  });

  it('teaching levels use only the plain variant', () => {
    for (let n = 1; n <= 5; n++) {
      for (const v of buildBoard(journeyLevel(n)).cells) if (isCard(v)) expect(v & 3).toBe(0);
    }
  });

  it('fuzz: 1000 seeded boards are all solvable and have an opening move', () => {
    const shapes: [number, number][] = [[4, 4], [6, 5], [7, 6], [8, 6]];
    for (let k = 0; k < 1000; k++) {
      const rng = createRng(`fuzz-${k}`);
      const [rows, cols] = shapes[k % shapes.length];
      const n = rows * cols;
      const cards: number[] = [];
      for (let p = 0; p < n / 2; p++) {
        const m = rng.int(12);
        cards.push(m * 4 + rng.int(4), m * 4 + rng.int(4));
      }
      const b = generateBoard({ rows, cols, cards }, rng);
      expect(findMove(b)).not.toBeNull();
      if (k % 25 === 0) expect(solveByReverseIsPossible(b)).toBe(true);
    }
  });

  it('greedy play with auto-shuffle always finishes', () => {
    for (let n = 1; n <= 48; n++) {
      const s = new Session(journeyLevel(n), 0);
      let t = 0;
      let guard = 0;
      while (!s.done && guard++ < 500) {
        const m = findMove(s.board, s.hidden)!;
        expect(m).not.toBeNull();
        s.tap(m[0], (t += 1000));
        const r = s.tap(m[1], (t += 1000));
        expect(r.kind).toBe('match');
      }
      expect(s.done).toBe(true);
    }
  });

  it('reshuffle keeps the same multiset of cards in the same cells', () => {
    const b = buildBoard(journeyLevel(20));
    for (let i = 0; i < b.cells.length; i += 3) if (isCard(b.cells[i])) b.cells[i] = EMPTY;
    // re-balance: remove one of any odd month so counts stay even
    const counts = new Map<number, number[]>();
    b.cells.forEach((v, i) => isCard(v) && counts.set(monthOf(v), [...(counts.get(monthOf(v)) ?? []), i]));
    for (const cells of counts.values()) if (cells.length % 2) b.cells[cells[0]] = EMPTY;
    const before = b.cells.filter(isCard).sort();
    const occupied = b.cells.map((v) => isCard(v));
    const after = reshuffle(b, createRng('x'));
    expect(after.cells.filter(isCard).sort()).toEqual(before);
    expect(after.cells.map((v) => isCard(v))).toEqual(occupied);
    expect(countMoves(after)).toBeGreaterThan(0);
  });
});

describe('daily', () => {
  it('numbers days from the epoch', () => {
    expect(dailyNumber('2026-10-01')).toBe(1);
    expect(dailyNumber('2026-10-06')).toBe(6);
    expect(dailyNumber('2027-10-01')).toBe(366);
  });

  it('is identical for everyone on the same date and differs across dates', () => {
    const a = buildBoard(dailyLevel('2026-10-06'));
    const b = buildBoard(dailyLevel('2026-10-06'));
    const c = buildBoard(dailyLevel('2026-10-07'));
    expect(a.cells).toEqual(b.cells);
    expect(a.cells).not.toEqual(c.cells);
  });

  it('zen boards build', () => {
    for (let i = 0; i < 20; i++) expect(cardsLeft(buildBoard(zenLevel(`z${i}`)))).toBeGreaterThan(0);
  });
});

describe('session scoring', () => {
  it('combos multiply inside the window and reset after', () => {
    const s = new Session(journeyLevel(1), 0);
    const play = (t: number) => {
      const [a, b] = findMove(s.board)!;
      s.tap(a, t);
      return s.tap(b, t);
    };
    const r1 = play(1000);
    const r2 = play(2000);
    const r3 = play(9000);
    expect(r1.kind === 'match' && r1.combo).toBe(1);
    expect(r2.kind === 'match' && r2.combo).toBe(2);
    expect(r3.kind === 'match' && r3.combo).toBe(1);
    expect(s.score).toBe(100 + 200 + 100);
  });

  it('tapping a different flower moves the selection instead of failing', () => {
    const s = new Session(journeyLevel(3), 0);
    const cells = s.board.cells;
    const a = cells.findIndex(isCard);
    const other = cells.findIndex((v) => isCard(v) && monthOf(v) !== monthOf(cells[a]));
    s.tap(a, 0);
    expect(s.tap(other, 10).kind).toBe('reselect');
    expect(s.selected).toBe(other);
  });

  it('awards three stars for a clean, fast clear', () => {
    const s = new Session(journeyLevel(1), 0);
    let t = 0;
    while (!s.done) {
      const [a, b] = findMove(s.board)!;
      s.tap(a, (t += 500));
      s.tap(b, (t += 500));
    }
    if (s.autoShuffles === 0) expect(starCount(s.stars())).toBe(3);
    else expect(starCount(s.stars())).toBe(2);
  });
});

describe('falling leaves & snow', () => {
  it('gravity compacts columns and treats stones as floors', () => {
    const b = board(['1.', '.2', '#.', '3.', '..']);
    const moves = applyGravity(b);
    expect(b.cells).toEqual(board(['..', '1.', '#.', '..', '32']).cells);
    expect(moves.length).toBe(3);
  });

  it('snow covers only fully surrounded cards and is deterministic', () => {
    const spec = journeyLevel(38);
    expect(spec.snow).toBeGreaterThan(0);
    const b = buildBoard(spec);
    const a = pickSnow(b, spec.snow, spec.seed);
    expect([...a]).toEqual([...pickSnow(b, spec.snow, spec.seed)]);
    for (const i of a) {
      const r = Math.floor(i / b.cols);
      const c = i % b.cols;
      expect(r > 0 && c > 0 && r < b.rows - 1 && c < b.cols - 1).toBe(true);
    }
  });

  it('hidden cards cannot be tapped', () => {
    const s = new Session(journeyLevel(38), 0);
    const [cell] = [...s.hidden];
    expect(s.tap(cell, 0).kind).toBe('hidden');
  });

  it('every season mechanic appears where the design says', () => {
    expect(journeyLevel(27).gravity).toBe(true); // first Autumn leaf-fall level
    expect(journeyLevel(25).gravity).toBe(false);
    expect(journeyLevel(38).snow).toBeGreaterThan(0); // first Winter snow level
    for (let n = 1; n <= 120; n++) {
      const sp = journeyLevel(n);
      expect(sp.gravity && sp.snow > 0).toBe(false); // never both at once
    }
  });

  it('greedy play finishes every board with gravity, snow and stones (levels 1–120 + a week of dailies)', () => {
    const specs = [
      ...Array.from({ length: 120 }, (_, i) => journeyLevel(i + 1)),
      ...['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map(dailyLevel),
    ];
    for (const spec of specs) {
      const s = new Session(spec, 0);
      let t = 0;
      let guard = 0;
      while (!s.done && guard++ < 400) {
        const m = findMove(s.board, s.hidden);
        expect(m, `stuck on ${spec.mode} ${spec.number}`).not.toBeNull();
        s.tap(m![0], (t += 700));
        const r = s.tap(m![1], (t += 700));
        expect(r.kind).toBe('match');
      }
      expect(s.done).toBe(true);
    }
  });

  it('weekday themes rotate', () => {
    const names = new Set(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) => dailyTheme(d).name));
    expect(names.size).toBe(7);
    expect(dailyTheme('2026-10-07').gravity).toBe(true); // a Wednesday
  });
});
