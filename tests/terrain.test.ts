/**
 * Path mechanics on terrain: Torii portals (鳥居) and Streams (개울 · 小川).
 * The path rules with their edge cases, reachable() agreeing with findPath(),
 * the pickers, generation solvable by construction (a seeded fuzz through the
 * solver), and boards without the new fields staying exactly what they were.
 */
import { describe, expect, it } from 'vitest';
import { type Board, EMPTY, STONE, TORII, WATER, isCard, isTorii, isWater, toriiOf, toriiPair } from '../src/engine/board';
import { type LevelSpec, buildBoard, honestSpec, maxStones, pickKnots, pickSnow, pickStreams, pickTorii } from '../src/engine/levels';
import { clash } from '../src/engine/mechanics';
import { findPath, pathBends, reachable } from '../src/engine/path';
import { createRng } from '../src/engine/rng';
import { Session } from '../src/engine/session';
import { solve } from '../src/engine/solve';

const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({
  mode: 'journey', number: 99, seed: 'terrain', rows: 8, cols: 6, stones: 0, months: 12, variants: true, par: 120, gravity: false, snow: 0, ...over,
});

/**
 * A board from rows of tokens: '#' stone, '.' empty, '~' water, 'T' / 'U' torii
 * of twin pair 0 / 1, digits a card id.
 */
function grid(rows: string[]): Board {
  const cells: number[] = [];
  for (const row of rows) {
    for (const t of row.trim().split(/\s+/)) {
      cells.push(t === '#' ? STONE : t === '.' ? EMPTY : t === '~' ? WATER : t === 'T' ? toriiOf(0) : t === 'U' ? toriiOf(1) : Number(t));
    }
  }
  return { rows: rows.length, cols: cells.length / rows.length, cells };
}
const at = (b: Board, r: number, c: number) => r * b.cols + c;
const pts = (p: ReturnType<typeof findPath>) => p && p.map((q) => `${q.r},${q.c}${q.jump ? '*' : ''}`);

// ─────────────────────────────── Torii ───────────────────────────────

describe('torii portals (鳥居)', () => {
  it('a path that enters one torii leaves its twin in the same direction, at no bend cost', () => {
    const b = grid([
      '# # # # #',
      '# 0 T # #',
      '# # # # #',
      '# # T 1 #',
      '# # # # #',
    ]);
    const p = findPath(b, at(b, 1, 1), at(b, 3, 3));
    // In at (1,2), out at (3,2): two drawn segments, a jump between them.
    expect(pts(p)).toEqual(['1,1', '1,2', '3,2*', '3,3']);
    expect(pathBends(p!)).toBe(0);
    // And back the other way, through the same pair.
    expect(pts(findPath(b, at(b, 3, 3), at(b, 1, 1)))).toEqual(['3,3', '3,2', '1,2*', '1,1']);
    expect(reachable(b, at(b, 1, 1)).has(at(b, 3, 3))).toBe(true);
    // The same board with stones in place of the torii: no way through.
    const plain = { ...b, cells: b.cells.map((v) => (isTorii(v) ? STONE : v)) };
    expect(findPath(plain, at(b, 1, 1), at(b, 3, 3))).toBeNull();
  });

  it('works entered from any side: straight down in, straight down out of the twin', () => {
    const b = grid([
      '# # # # #',
      '# 0 # T #',
      '# T # 1 #',
      '# # # # #',
    ]);
    expect(pts(findPath(b, at(b, 1, 1), at(b, 2, 3)))).toEqual(['1,1', '2,1', '1,3*', '2,3']);
    expect(pts(findPath(b, at(b, 2, 3), at(b, 1, 1)))).toEqual(['2,3', '1,3', '2,1*', '1,1']);
  });

  it('the 2-bend rule holds over the whole path: a bend each side of the jump is fine, a third is not', () => {
    const rows = [
      '# # # # # # #',
      '# 0 # # # # #',
      '# . T # # # #',
      '# # # # # # #',
      '# # # T . # #',
      '# # # # 1 # #',
      '# # # # # # #',
    ];
    const b = grid(rows);
    const p = findPath(b, at(b, 1, 1), at(b, 5, 4))!;
    expect(pts(p)).toEqual(['1,1', '2,1', '2,2', '4,3*', '4,4', '5,4']);
    expect(pathBends(p)).toBe(2);
    // Move the partner one step on: the path would need a third bend.
    const far = grid(rows.map((r, i) => (i === 5 ? '# # # # . 1 #' : r)));
    expect(findPath(far, at(far, 1, 1), at(far, 5, 5))).toBeNull();
    expect(reachable(far, at(far, 1, 1)).has(at(far, 5, 5))).toBe(false);
  });

  it('a path can’t turn on a torii: if the cell past the twin is blocked, the jump goes nowhere', () => {
    const b = grid([
      '# # # # #',
      '# 0 T # #',
      '# # # # #',
      '# # T # #',
      '# # 1 # #',
    ]);
    // Out of (3,2) heading right is a stone; turning down onto the card would be a bend on the torii.
    expect(findPath(b, at(b, 1, 1), at(b, 4, 2))).toBeNull();
    expect(reachable(b, at(b, 1, 1)).has(at(b, 4, 2))).toBe(false);
  });

  it('a jump can come out onto the outer lane and carry on round the rim', () => {
    const b = grid([
      '# # # #',
      '# 0 T #',
      '# # # T',
      '# # # 1',
    ]);
    const p = findPath(b, at(b, 1, 1), at(b, 3, 3))!;
    expect(pts(p)).toEqual(['1,1', '1,2', '2,3*', '2,4', '3,4', '3,3']);
    expect(pathBends(p)).toBe(2);
  });

  it('two twin pairs are told apart by their mark', () => {
    const b = grid([
      '# # # # #',
      '# 0 T # #',
      '# # U 2 #',
      '# # T 1 #',
      '# U # # #',
    ]);
    expect(pts(findPath(b, at(b, 1, 1), at(b, 3, 3)))).toEqual(['1,1', '1,2', '3,2*', '3,3']);
    const r = reachable(b, at(b, 1, 1));
    expect(r.has(at(b, 3, 3))).toBe(true);
    expect(r.has(at(b, 2, 3))).toBe(false); // what lies past the other pair's torii
  });

  it('a path never ends on a torii, and a torii is never part of a move', () => {
    const b = grid([
      '0 T . 0',
      '. . . .',
      '. . . T',
    ]);
    expect(findPath(b, at(b, 0, 0), at(b, 0, 1))).toBeNull();
    expect(reachable(b, at(b, 0, 0)).has(at(b, 0, 1))).toBe(false);
    expect(toriiPair(b.cells[at(b, 0, 1)])).toBe(0);
    expect(toriiPair(toriiOf(1))).toBe(1);
    expect(TORII).toBe(toriiOf(0));
  });

  it('twins on one line never loop a path forever', () => {
    const b = grid([
      '. T . . T .',
      '1 # 1 # # #',
    ]);
    // Up from (1,2) and right: past (0,4) the ray comes out of (0,1) heading right again, round and round.
    const a = at(b, 1, 2);
    const r = reachable(b, a);
    expect(r.has(at(b, 1, 0))).toBe(true); // over the outer lane
    expect(pathBends(findPath(b, a, at(b, 1, 0))!)).toBe(2);
  });
});

// ─────────────────────────────── Streams ───────────────────────────────

describe('streams (개울 · 小川)', () => {
  it('a path crosses water in a straight line', () => {
    const b = grid([
      '# # # # # #',
      '# 0 ~ ~ 1 #',
      '# # # # # #',
    ]);
    const p = findPath(b, at(b, 1, 1), at(b, 1, 4))!;
    expect(pts(p)).toEqual(['1,1', '1,4']);
    expect(pathBends(p)).toBe(0);
  });

  it('a path can never bend on a water cell', () => {
    const rows = [
      '# # # #',
      '# 0 # #',
      '# ~ 1 #',
      '# # # #',
    ];
    const b = grid(rows);
    expect(findPath(b, at(b, 1, 1), at(b, 2, 2))).toBeNull();
    expect(reachable(b, at(b, 1, 1)).has(at(b, 2, 2))).toBe(false);
    // The same corner on dry ground is a plain one-bend path.
    const dry = grid(rows.map((r) => r.replace('~', '.')));
    expect(pathBends(findPath(dry, at(dry, 1, 1), at(dry, 2, 2))!)).toBe(1);
  });

  it('a path may run along a stream and turn once it is back on dry ground', () => {
    const b = grid([
      '# # # # # #',
      '# 0 ~ ~ . #',
      '# # # # 1 #',
      '# # # # # #',
    ]);
    expect(pts(findPath(b, at(b, 1, 1), at(b, 2, 4)))).toEqual(['1,1', '1,4', '2,4']);
  });

  it('a path may turn on the bank, just before the water', () => {
    const b = grid([
      '# # # # #',
      '# 0 # # #',
      '# . ~ 1 #',
      '# # # # #',
    ]);
    expect(pts(findPath(b, at(b, 1, 1), at(b, 2, 3)))).toEqual(['1,1', '2,1', '2,3']);
  });

  it('a bend that would land on water is taken somewhere dry if there is a way', () => {
    // Straight down and right would turn on the water at (2,1); the path goes right first instead.
    const b = grid([
      '# # # # #',
      '# 0 . # #',
      '# ~ 1 # #',
      '# # # # #',
    ]);
    expect(pts(findPath(b, at(b, 1, 1), at(b, 2, 2)))).toEqual(['1,1', '1,2', '2,2']);
  });

  it('a torii can open onto a stream and the path carries straight across', () => {
    const b = grid([
      '# # # # # #',
      '# 0 T # # #',
      '# # # # # #',
      '# T ~ ~ 1 #',
      '# # # # # #',
    ]);
    expect(pts(findPath(b, at(b, 1, 1), at(b, 3, 4)))).toEqual(['1,1', '1,2', '3,1*', '3,4']);
  });
});

// ─────────────────────────────── Path agreement ───────────────────────────────

describe('reachable() agrees with findPath()', () => {
  it('on random boards with torii, water, stones, empty cells and fences', () => {
    const rng = createRng('agree');
    for (let k = 0; k < 120; k++) {
      const rows = 4 + rng.int(4);
      const cols = 4 + rng.int(3);
      const cells: number[] = [];
      for (let i = 0; i < rows * cols; i++) {
        const x = rng.next();
        cells.push(x < 0.3 ? EMPTY : x < 0.42 ? WATER : x < 0.5 ? STONE : rng.int(4));
      }
      // One or two twin pairs on distinct cells.
      const spots = rng.shuffle([...cells.keys()]).slice(0, 4);
      cells[spots[0]] = cells[spots[1]] = toriiOf(0);
      if (rng.next() < 0.5) cells[spots[2]] = cells[spots[3]] = toriiOf(1);
      const b: Board = { rows, cols, cells };
      if (rng.next() < 0.4) {
        b.walls = new Uint8Array(rows * cols);
        for (let i = 0; i < b.walls.length; i++) b.walls[i] = rng.int(4) === 0 ? 1 + rng.int(3) : 0;
      }
      for (let i = 0; i < cells.length; i++) {
        if (!isCard(cells[i])) continue;
        const r = reachable(b, i);
        for (let j = 0; j < cells.length; j++) {
          if (j === i || !isCard(cells[j])) continue;
          const p = findPath(b, i, j);
          expect(r.has(j), `${k}: ${i}→${j}`).toBe(p !== null);
          if (p) expect(pathBends(p)).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});

// ─────────────────────────────── Pickers and generation ───────────────────────────────

describe('pickTorii and pickStreams', () => {
  it('pickTorii gives each pair two cells apart, on different rows and columns, off blocked cells', () => {
    for (let k = 0; k < 200; k++) {
      const rng = createRng(`pt-${k}`);
      const rows = 6 + rng.int(3);
      const cols = 5 + rng.int(3);
      const blocked = new Set<number>([rows + 2, 2 * cols + 3]);
      const pairs = 1 + rng.int(2);
      const t = pickTorii(rows, cols, pairs, rng, blocked);
      expect(t.length).toBe(pairs);
      const all = t.flat();
      expect(new Set(all).size).toBe(all.length);
      for (const [a, b] of t) {
        expect(blocked.has(a) || blocked.has(b)).toBe(false);
        const [ar, ac] = [Math.floor(a / cols), a % cols];
        const [br, bc] = [Math.floor(b / cols), b % cols];
        expect(ar).not.toBe(br);
        expect(ac).not.toBe(bc);
        expect(Math.abs(ar - br) + Math.abs(ac - bc)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('pickStreams lays an even number of water cells in short straight runs, off blocked cells', () => {
    for (let k = 0; k < 200; k++) {
      const rng = createRng(`ps-${k}`);
      const rows = 6 + rng.int(3);
      const cols = 5 + rng.int(3);
      const blocked = new Set<number>([cols + 1, 3 * cols + 2]);
      const count = 2 + 2 * rng.int(3);
      const w = pickStreams(rows, cols, count, rng, blocked);
      expect(w.length % 2).toBe(0);
      expect(w.length).toBeLessThanOrEqual(count);
      expect(w.length).toBeGreaterThanOrEqual(2);
      for (const i of w) expect(blocked.has(i)).toBe(false);
      // Every water cell touches another one in a straight line (runs of 2–3).
      const set = new Set(w);
      for (const i of w) {
        const c = i % cols;
        const n = [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, i - cols, i + cols].filter((j) => set.has(j));
        expect(n.length, `ps-${k} cell ${i}`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('boards with torii and streams', () => {
  it('build the asked terrain: two cells per twin pair, the water count, every other cell a card', () => {
    for (let k = 0; k < 40; k++) {
      const s = spec({ seed: `bt-${k}`, torii: 1 + (k % 2), streams: 4, stones: 2 });
      const b = buildBoard(s);
      for (let p = 0; p < 2; p++) expect(b.cells.filter((v) => v === toriiOf(p)).length).toBe(p < (s.torii ?? 0) ? 2 : 0);
      expect(b.cells.filter(isWater).length).toBe(4);
      expect(b.cells.filter((v) => v === EMPTY).length).toBe(0);
      expect(honestSpec(s)).toEqual(s);
    }
  });

  it('a session counts a portal path as the bends it really has', () => {
    let jumps = 0;
    for (let k = 0; k < 30 && jumps < 3; k++) {
      const s = new Session(spec({ seed: `sj-${k}`, rows: 6, cols: 5, months: 12, torii: 2 }), 0);
      for (let t = 0; t < 200 && !s.done; t++) {
        const m = s.findMove();
        if (!m) break;
        s.tap(m[0], t * 5000);
        const r = s.tap(m[1], t * 5000);
        if (r.kind !== 'match') throw new Error('not a match');
        expect(r.turns).toBe(pathBends(r.path));
        if (r.path.some((p) => p.jump)) jumps++;
      }
    }
    expect(jumps).toBeGreaterThan(0);
  });

  it('clash with the sliding mechanics: terrain cells can’t move', () => {
    for (const m of ['torii', 'streams'] as const) {
      expect(clash(m, 'leaves')).toBe(true);
      expect(clash(m, 'wind')).toBe(true);
    }
  });
});

/** A random non-sliding board with torii and/or streams, mixed with the other static mechanics. */
function fuzzSpec(k: number): LevelSpec {
  const rng = createRng(`tfuzz-${k}`);
  const [rows, cols] = rng.pick([[6, 5], [7, 4], [6, 6], [7, 6], [8, 5], [8, 6], [8, 7]] as [number, number][]);
  const torii = rng.next() < 0.7 ? 1 + rng.int(2) : 0;
  const streams = torii === 0 || rng.next() < 0.5 ? 2 + 2 * rng.int(3) : 0;
  const stones = Math.min(maxStones(rows, cols), 2 * rng.int(3));
  const pairs = (rows * cols - stones - 2 * torii - streams) / 2;
  return spec({
    seed: `tfuzz-${k}`,
    rows,
    cols,
    stones,
    months: Math.min(12, Math.floor(pairs)),
    torii,
    streams,
    gates: rng.next() < 0.3 ? 2 : 0,
    fences: rng.next() < 0.3 ? 3 + rng.int(5) : 0,
    snow: rng.next() < 0.3 ? 2 + rng.int(4) : 0,
    knots: rng.next() < 0.3 ? 2 + rng.int(3) : 0,
    layout: rng.pick(['spread', 'lines', 'clusters'] as const),
  });
}

describe('solvability fuzz (torii and streams)', () => {
  it('the solver clears every board with torii, streams and the other static mechanics (300 boards)', () => {
    let torii = 0;
    let water = 0;
    for (let k = 0; k < 300; k++) {
      const s = fuzzSpec(k);
      const b = buildBoard(s);
      if (b.cells.some(isTorii)) torii++;
      if (b.cells.some(isWater)) water++;
      const hidden = pickSnow(b, s.snow, s.seed);
      const knots = pickKnots(b, s.knots ?? 0, s.seed, hidden);
      const res = solve({ board: b, hidden, knots }, null, 60000);
      expect(res.moves, `tfuzz-${k}`).not.toBeNull();
    }
    expect(torii).toBeGreaterThan(180);
    expect(water).toBeGreaterThan(130);
  });

  it('the same spec always builds the same terrain and cards', () => {
    for (let k = 0; k < 20; k++) {
      const s = fuzzSpec(k);
      expect(buildBoard(s).cells).toEqual(buildBoard(s).cells);
    }
  });

  it('torii: 0 and streams: 0 are the same as leaving them out', () => {
    for (let k = 0; k < 10; k++) {
      const base = spec({ seed: `tz-${k}`, stones: 4, snow: 3, gates: 2, fences: 4 });
      expect(buildBoard({ ...base, torii: 0, streams: 0 }).cells).toEqual(buildBoard(base).cells);
    }
  });
});
