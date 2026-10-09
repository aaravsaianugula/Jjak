/**
 * Rule mechanics: Ordered seals (도장 · 印) and Ink that dries (먹 · 墨).
 * The rules with their edge cases, the free safety net, the pickers,
 * generation solvable by construction (a seeded fuzz through a solver that may
 * not lean on the safety net), reshuffles carrying both, and boards without the
 * new fields staying exactly what they were.
 */
import { describe, expect, it } from 'vitest';
import { ROUTE, ROUTE_LEVELS_PER_CHAPTER } from '../src/data/route';
import { TIERS, bankEntry, bankSpec, decodeEntry, encodeEntry } from '../src/director/bank';
import { measure } from '../src/director/metrics';
import { fallbackSpec, levelPlan, tierKnobs } from '../src/director/plan';
import { validate } from '../src/director/validate';
import { type Board, EMPTY, INK, STONE, isCard, isInk, monthOf } from '../src/engine/board';
import { generateBoard, reshuffle } from '../src/engine/generate';
import { type LevelSpec, INK_MAX_LIFE, INK_MIN_LIFE, buildBoard, honestSpec, maxStones, pickInk, pickKnots, pickSnow } from '../src/engine/levels';
import { clash } from '../src/engine/mechanics';
import { findMove, legalMoves } from '../src/engine/moves';
import { findPath } from '../src/engine/path';
import { createRng } from '../src/engine/rng';
import { type Freed, type PlayState, applyPair, currentSeal, lockedOf, releaseIfStuck } from '../src/engine/rules';
import { Session } from '../src/engine/session';
import { solve } from '../src/engine/solve';

const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({
  mode: 'journey', number: 99, seed: 'rule', rows: 8, cols: 6, stones: 0, months: 12, variants: true, par: 120, gravity: false, snow: 0, ...over,
});

/**
 * A board from rows of tokens: '#' stone, '.' empty, 'k' wet ink with k pairs
 * to dry (written 'i3'), a card id with an optional seal ('8s1' = card 8, seal 1).
 */
function grid(rows: string[]): Board {
  const cells: number[] = [];
  const seals: number[] = [];
  const ink: number[] = [];
  for (const row of rows) {
    for (const t of row.trim().split(/\s+/)) {
      const [card, seal] = t.split('s');
      seals.push(seal ? Number(seal) : 0);
      ink.push(t.startsWith('i') ? Number(t.slice(1)) : 0);
      cells.push(t === '#' ? STONE : t === '.' ? EMPTY : t.startsWith('i') ? INK : Number(card));
    }
  }
  const b: Board = { rows: rows.length, cols: cells.length / rows.length, cells };
  if (seals.some((s) => s > 0)) b.seals = seals;
  if (ink.some((s) => s > 0)) b.ink = ink;
  return b;
}
const at = (b: Board, r: number, c: number) => r * b.cols + c;
const state = (board: Board): PlayState => ({ board, hidden: new Set(), knots: new Set() });
const freed = (): Freed => ({ dried: [], unsealed: [] });

// ─────────────────────────────── Seals ───────────────────────────────

describe('ordered seals (도장 · 印)', () => {
  it('a sealed card can only be picked once every lower seal is gone', () => {
    const b = grid([
      '0s2 . 1s2 .',
      '8s1 . 9s1 .',
    ]);
    const st = state(b);
    expect(currentSeal(b)).toBe(1);
    expect([...lockedOf(st)].sort()).toEqual([0, 2]);
    expect(legalMoves(b, lockedOf(st))).toEqual([[4, 6]]);
    applyPair(st, 4, 6, null);
    expect(currentSeal(b)).toBe(2);
    expect(lockedOf(st).size).toBe(0);
    expect(legalMoves(b, lockedOf(st))).toEqual([[0, 2]]);
  });

  it('unsealed cards are free as usual, whatever the seals say', () => {
    const b = grid([
      '0s2 . 1s2 .',
      '8s1 # 12 13',
      '#   # 9s1 .',
    ]);
    expect(legalMoves(b, lockedOf(state(b)))).toContainEqual([6, 7]);
  });

  it('the current seal may pair with an unsealed card of its flower; it stays current until its last card goes', () => {
    const b = grid([
      '8s1 9 . 10s1 11',
      '0s2 . . 1s2  .',
    ]);
    const st = state(b);
    applyPair(st, 0, 1, null);
    expect(currentSeal(b)).toBe(1);
    expect(lockedOf(st).has(5)).toBe(true);
    applyPair(st, 3, 4, null);
    expect(currentSeal(b)).toBe(2);
    expect(lockedOf(st).size).toBe(0);
  });

  it('a tap on a card that must wait says which seal comes first, at no cost', () => {
    const b = grid([
      '0s2 . 1s2 .',
      '8s1 . 9s1 .',
    ]);
    const s = new Session(spec({ rows: 2, cols: 4, months: 3 }), 0, b);
    const r = s.tap(0, 10);
    expect(r).toEqual({ kind: 'sealed', cell: 0, first: 1 });
    expect(s.selected).toBe(-1);
    expect(s.blockedTaps).toBe(0);
    s.tap(4, 20);
    expect(s.tap(2, 30).kind).toBe('sealed');
    expect(s.selected).toBe(4);
    const m = s.tap(6, 40);
    expect(m.kind).toBe('match');
    expect(s.tap(0, 50)).toEqual({ kind: 'select', cell: 0 });
  });

  it('the safety net breaks the lowest seal when the order alone leaves no pair', () => {
    // Seal 1's pair waits behind seal 2's pair, which can't go first.
    const b = grid([
      '#  #   #   #   #   #',
      '#  8s1 0s2 1s2 9s1 #',
      '#  #   #   #   #   #',
    ]);
    const st = state(b);
    const out = freed();
    expect(findMove(b, lockedOf(st))).toBeNull();
    expect(releaseIfStuck(st, [], [], out)).toBe(false);
    expect(out.unsealed.sort((x, y) => x - y)).toEqual([at(b, 1, 1), at(b, 1, 4)]);
    expect(currentSeal(b)).toBe(2);
    expect(findMove(b, lockedOf(st))).toEqual([at(b, 1, 2), at(b, 1, 3)]);
  });

  it('a true dead end keeps its seals (the reshuffle carries them)', () => {
    const b = grid([
      '#  #   #  #   #',
      '#  8s1 #  9s1 #',
      '#  #   #  #   #',
      '#  0s2 #  1s2 #',
      '#  #   #  #   #',
    ]);
    const st = state(b);
    const out = freed();
    expect(releaseIfStuck(st, [], [], out)).toBe(true);
    expect(out).toEqual(freed());
    expect(currentSeal(b)).toBe(1);
  });

  it('a reshuffle keeps each seal on its own card', () => {
    const b = grid([
      '8s1 4   9s1 5',
      '0s2 20  1s2 21',
      '24  25  28  29',
    ]);
    for (let k = 0; k < 20; k++) {
      const out = reshuffle(b, createRng(`rs-${k}`));
      const sealOf = (bd: Board) => new Map(bd.cells.map((v, i) => [v, bd.seals?.[i] ?? 0]));
      expect(sealOf(out)).toEqual(sealOf(b));
    }
  });
});

// ─────────────────────────────── Ink ───────────────────────────────

describe('ink that dries (먹 · 墨)', () => {
  it('wet ink blocks a path like a stone; the same cell dry lets it through', () => {
    const boxed = grid([
      '# # # # #',
      '# 0 i2 1 #',
      '# # # # #',
    ]);
    expect(findPath(boxed, at(boxed, 1, 1), at(boxed, 1, 3))).toBeNull();
    boxed.cells[at(boxed, 1, 2)] = EMPTY;
    expect(findPath(boxed, at(boxed, 1, 1), at(boxed, 1, 3))).not.toBeNull();
  });

  it('dries after exactly its count of pairs, then paths cross it', () => {
    const b = grid([
      '# # # #  # # #',
      '# 0 # i2 # 1 #',
      '# # # .  # # #',
      '8 9 # #  # 12 13',
    ]);
    const st = state(b);
    const ink = at(b, 1, 3);
    let r = applyPair(st, at(b, 3, 0), at(b, 3, 1), null);
    expect(r.dried).toEqual([]);
    expect(b.cells[ink]).toBe(INK);
    expect(b.ink![ink]).toBe(1);
    r = applyPair(st, at(b, 3, 5), at(b, 3, 6), null);
    expect(r.dried).toEqual([ink]);
    expect(b.cells[ink]).toBe(EMPTY);
    expect(b.ink![ink]).toBe(0);
  });

  it('drying opens space: a snowy card beside the blot turns over', () => {
    const b = grid([
      '#  #  #  #',
      '#  0  i1 4',
      '#  #  #  #',
      '8  9  #  1',
    ]);
    const st: PlayState = { board: b, hidden: new Set([at(b, 1, 1)]), knots: new Set() };
    const r = applyPair(st, at(b, 3, 0), at(b, 3, 1), null);
    expect(r.dried).toEqual([at(b, 1, 2)]);
    expect(r.revealed).toEqual([at(b, 1, 1)]);
  });

  it('is never tapped, never holds a card, and is never a move', () => {
    const b = grid(['0 i3 1']);
    const s = new Session(spec({ rows: 1, cols: 3, months: 1 }), 0, b);
    expect(s.tap(1, 0).kind).toBe('ignore');
    expect(findPath(b, 0, 1)).toBeNull();
  });

  it('the safety net dries the blot that frees a pair (not simply the soonest) when wet ink alone leaves no pair', () => {
    const b = grid([
      '# # #  # # # #',
      '# 0 i5 1 i2 4 #',
      '# # #  # # #  #',
      '# 5 #  # # #  #',
    ]);
    // 0–1 wait on the long blot, 4–5 on nothing but stones; only drying helps.
    const st = state(b);
    const out = freed();
    expect(findMove(b, lockedOf(st))).toBeNull();
    expect(releaseIfStuck(st, [], [], out)).toBe(false);
    expect(out.dried).toEqual([at(b, 1, 2)]);
    expect(b.ink![at(b, 1, 4)]).toBe(2);
  });

  it('pickInk lays an even count of blots off the rim, apart from each other and from blocked cells', () => {
    for (let k = 0; k < 60; k++) {
      const rng = createRng(`pi-${k}`);
      const blocked = new Set([7, 8]);
      const out = pickInk(7, 6, 2 + 2 * (k % 2), rng, blocked);
      expect(out.length).toBe(2 + 2 * (k % 2));
      for (const { cell, life } of out) {
        const r = Math.floor(cell / 6);
        const c = cell % 6;
        expect(r > 0 && c > 0 && r < 6 && c < 5, `rim ${cell}`).toBe(true);
        expect(blocked.has(cell)).toBe(false);
        expect(life).toBeGreaterThanOrEqual(INK_MIN_LIFE);
        expect(life).toBeLessThanOrEqual(INK_MAX_LIFE);
        for (const o of out) if (o.cell !== cell) expect(Math.abs(Math.floor(o.cell / 6) - r) + Math.abs((o.cell % 6) - c)).toBeGreaterThan(1);
      }
    }
  });

  it('a reshuffle keeps the blots where they are, with their time left', () => {
    const b = grid([
      '0 4  1 5',
      '8 i3 9 i2',
      '20 21 24 25',
    ]);
    for (let k = 0; k < 20; k++) {
      const out = reshuffle(b, createRng(`ri-${k}`));
      expect(out.cells[5]).toBe(INK);
      expect(out.cells[7]).toBe(INK);
      expect(out.ink).toEqual(b.ink);
    }
  });
});

// ─────────────────────────────── Generation ───────────────────────────────

describe('boards with seals and ink', () => {
  it('seal numbers 1…k on two cards of one flower each, distinct flowers, never the lucky pair', () => {
    for (let k = 0; k < 40; k++) {
      const s = spec({ seed: `bs-${k}`, seals: 2 + (k % 3), stones: 2, lucky: k % 4 === 0 });
      const b = buildBoard(s);
      const n = s.seals!;
      const months = new Set<number>();
      for (let x = 1; x <= n; x++) {
        const cells = b.cells.map((_, i) => i).filter((i) => b.seals![i] === x);
        expect(cells.length, `seal ${x}`).toBe(2);
        expect(monthOf(b.cells[cells[0]])).toBe(monthOf(b.cells[cells[1]]));
        expect(monthOf(b.cells[cells[0]])).toBeLessThan(12);
        months.add(monthOf(b.cells[cells[0]]));
      }
      expect(months.size).toBe(n);
      expect(Math.max(...b.seals!)).toBe(n);
      expect(honestSpec(s)).toEqual(s);
    }
  });

  it('wet ink on the asked cells, every other free cell a card', () => {
    for (let k = 0; k < 40; k++) {
      const s = spec({ seed: `bi-${k}`, ink: 2 + 2 * (k % 2), stones: 2 });
      const b = buildBoard(s);
      expect(b.cells.filter(isInk).length).toBe(s.ink);
      expect(b.cells.filter((v) => v === EMPTY).length).toBe(0);
      b.cells.forEach((v, i) => {
        if (isInk(v)) expect(b.ink![i]).toBeGreaterThanOrEqual(INK_MIN_LIFE);
        else expect(b.ink![i]).toBe(0);
      });
      expect(honestSpec(s)).toEqual(s);
    }
  });

  it('clash with sliding (and seals with snow and knots), mix with terrain', () => {
    for (const m of ['seals', 'ink'] as const) {
      expect(clash(m, 'leaves')).toBe(true);
      expect(clash(m, 'wind')).toBe(true);
      expect(clash(m, 'torii')).toBe(false);
      expect(clash(m, 'streams')).toBe(false);
      expect(clash(m, 'gates')).toBe(false);
    }
    expect(clash('seals', 'snow')).toBe(true);
    expect(clash('seals', 'knots')).toBe(true);
    expect(clash('ink', 'snow')).toBe(false);
    expect(clash('seals', 'ink')).toBe(false);
  });

  it('seals: 0 and ink: 0 are the same as leaving them out', () => {
    for (let k = 0; k < 10; k++) {
      const base = spec({ seed: `rz-${k}`, stones: 4, snow: 3, gates: 2, fences: 4, torii: 1 });
      const plain = buildBoard(base);
      const zero = buildBoard({ ...base, seals: 0, ink: 0 });
      expect(zero.cells).toEqual(plain.cells);
      expect(zero.seals).toBeUndefined();
      expect(zero.ink).toBeUndefined();
    }
  });
});

describe('generation honours the drying time', () => {
  // A corridor along the middle row; the rim around it is stone.
  const corridor = (cols: number) => Array.from({ length: 3 * cols }, (_, i) => i).filter((i) => i < cols || i >= 2 * cols);

  it('never places a pair through ink that is still wet when that pair is cleared', () => {
    // One pair either side of a blot that lasts its one pair: no honest way to place it.
    const b = generateBoard({ rows: 3, cols: 3, stones: corridor(3), ink: [{ cell: 4, life: 1 }], cards: [0, 1] }, createRng('wet'));
    const st = state(b);
    expect(solve(st, null, 1000, { strict: true }).moves, 'a strict clear').not.toBeNull();
  });

  it('may place a pair through ink that has dried by the time it is cleared', () => {
    // Two pairs: the blot (one pair) is dry for the second clear, which needs it.
    const b = generateBoard({ rows: 3, cols: 5, stones: corridor(5), ink: [{ cell: 6, life: 1 }], cards: [0, 1, 4, 5] }, createRng('dry'));
    expect(b.cells[6]).toBe(INK);
    expect(solve(state(b), null, 1000, { strict: true }).moves).not.toBeNull();
  });
});

/** A random non-sliding board with seals and/or ink, mixed with the static mechanics they allow. */
function fuzzSpec(k: number): LevelSpec {
  const rng = createRng(`rfuzz-${k}`);
  const [rows, cols] = rng.pick([[6, 5], [7, 4], [6, 6], [7, 6], [8, 5], [8, 6], [8, 7]] as [number, number][]);
  const seals = rng.next() < 0.7 ? 2 + rng.int(3) : 0;
  const ink = seals === 0 || rng.next() < 0.5 ? 2 + 2 * rng.int(2) : 0;
  const stones = Math.min(maxStones(rows, cols), 2 * rng.int(3));
  const torii = rng.next() < 0.2 ? 1 : 0;
  const pairs = (rows * cols - stones - ink - 2 * torii) / 2;
  const covers = seals === 0;
  return spec({
    seed: `rfuzz-${k}`,
    rows,
    cols,
    stones,
    months: Math.min(12, Math.floor(pairs)),
    seals,
    ink,
    torii,
    gates: rng.next() < 0.3 ? 2 : 0,
    fences: rng.next() < 0.3 ? 3 + rng.int(5) : 0,
    snow: covers && rng.next() < 0.4 ? 2 + rng.int(4) : 0,
    knots: covers && rng.next() < 0.4 ? 2 + rng.int(3) : 0,
    layout: rng.pick(['spread', 'lines', 'clusters'] as const),
  });
}

describe('solvability fuzz (seals and ink)', () => {
  it('a solver that may never break a seal or dry ink early clears every board (300 boards)', () => {
    let sealed = 0;
    let inked = 0;
    for (let k = 0; k < 300; k++) {
      const s = fuzzSpec(k);
      const b = buildBoard(s);
      if (b.seals) sealed++;
      if (b.cells.some(isInk)) inked++;
      const hidden = pickSnow(b, s.snow, s.seed);
      const knots = pickKnots(b, s.knots ?? 0, s.seed, hidden);
      const res = solve({ board: b, hidden, knots }, null, 60000, { strict: true });
      expect(res.moves, `rfuzz-${k}`).not.toBeNull();
      // Replay: every sealed card goes while its seal is the lowest, every blot dries on time.
      const st: PlayState = { board: structuredClone(b), hidden: new Set(hidden), knots: new Set(knots) };
      for (const [x, y] of res.moves!) {
        expect(lockedOf(st).has(x) || lockedOf(st).has(y), `rfuzz-${k}`).toBe(false);
        expect(findPath(st.board, x, y), `rfuzz-${k}`).not.toBeNull();
        applyPair(st, x, y, null);
        const out = freed();
        if (st.board.cells.some(isCard)) releaseIfStuck(st, [], [], out);
        expect(out, `rfuzz-${k}`).toEqual(freed());
      }
    }
    expect(sealed).toBeGreaterThan(180);
    expect(inked).toBeGreaterThan(130);
  });

  it('the strict solver refuses a board that needs the safety net', () => {
    const b = grid([
      '#  #   #   #   #   #',
      '#  8s1 0s2 1s2 9s1 #',
      '#  #   #   #   #   #',
      '12 13  #   #   #   #',
    ]);
    expect(solve(state(b), null, 1000, { strict: true }).moves).toBeNull();
    expect(solve(state(b), null, 1000).moves).not.toBeNull();
  });

  it('the same spec always builds the same seals and ink', () => {
    for (let k = 0; k < 20; k++) {
      const s = fuzzSpec(k);
      const [a, b] = [buildBoard(s), buildBoard(s)];
      expect(a).toEqual(b);
    }
  });
});

// ─────────────────────────────── The Director ───────────────────────────────

describe('the road brings seals in at Takayama and ink at Jeonju', () => {
  const chapterLevels = (index: number) => Array.from({ length: ROUTE_LEVELS_PER_CHAPTER }, (_, s) => index * ROUTE_LEVELS_PER_CHAPTER + s + 1);

  it('introduces each alone on the second board of its chapter, never before', () => {
    expect(ROUTE[30].id).toBe('takayama');
    expect(ROUTE[34].id).toBe('jeonju');
    for (const [m, ch] of [['seals', 30], ['ink', 34]] as const) {
      expect(ROUTE[ch].focus).toBe(m);
      const intro = levelPlan(ch * ROUTE_LEVELS_PER_CHAPTER + 2);
      expect(intro.introduces).toBe(m);
      expect(intro.mechanics).toEqual([m]);
      for (let n = 1; n < intro.n; n++) expect(levelPlan(n).mechanics, `level ${n}`).not.toContain(m);
      const on = chapterLevels(ch).filter((n) => levelPlan(n).mechanics.includes(m)).length;
      expect(on, m).toBeGreaterThanOrEqual(6);
    }
  });

  it('come back later as partners from the bag, never with sliding', () => {
    for (const [m, ch] of [['seals', 30], ['ink', 34]] as const) {
      const later = [];
      for (let n = (ch + 1) * ROUTE_LEVELS_PER_CHAPTER + 1; n <= 600; n++) if (levelPlan(n).mechanics.includes(m) && levelPlan(n).place.focus !== m) later.push(n);
      expect(later.length, m).toBeGreaterThanOrEqual(8);
      for (let n = 1; n <= 900; n++) {
        const p = levelPlan(n);
        if (p.mechanics.includes(m)) expect(p.wind, `level ${n}`).toBeNull();
        if (m === 'seals' && p.mechanics.includes(m)) expect(p.mechanics.filter((x) => x === 'snow' || x === 'knots'), `level ${n}`).toEqual([]);
      }
    }
  });

  it('the plan’s specs carry the counts the tiers ask for', () => {
    for (const ch of [30, 34]) {
      for (const n of chapterLevels(ch)) {
        const p = levelPlan(n);
        for (let t = 0; t < 5; t++) {
          const k = tierKnobs(p, t);
          expect(k.seals > 0, `${n}/${t}`).toBe(p.mechanics.includes('seals'));
          expect(k.ink > 0, `${n}/${t}`).toBe(p.mechanics.includes('ink'));
          expect(k.ink % 2).toBe(0);
        }
      }
    }
  });

  it('bank entries carry the two new knobs', () => {
    const e = { attempt: 7, knobs: { stones: 2, layout: 'spread' as const, months: 9, snow: 0, knots: 0, gates: 0, fences: 0, torii: 1, streams: 2, seals: 3, ink: 4 }, d: 0.412, hash: 'abcde' };
    const s = encodeEntry(e);
    expect(s.length).toBe(20);
    expect(decodeEntry(s)).toEqual(e);
  });

  it('validators reject a board missing its seals or its ink', () => {
    const n = 30 * ROUTE_LEVELS_PER_CHAPTER + 2;
    const s1 = fallbackSpec(n, 2);
    const b1 = buildBoard(s1);
    const plan = levelPlan(n);
    expect(validate(s1, b1, measure(s1, b1), { plan }).reasons).not.toContain('seals');
    const bare = { ...b1, seals: undefined };
    expect(validate(s1, bare, measure(s1, b1), { plan, skipRebuild: true }).reasons).toContain('seals');
    const n2 = 34 * ROUTE_LEVELS_PER_CHAPTER + 2;
    const s2 = fallbackSpec(n2, 2);
    const b2 = buildBoard(s2);
    const stones = { ...b2, cells: b2.cells.map((v) => (isInk(v) ? STONE : v)) };
    expect(validate(s2, stones, measure(s2, b2), { plan: levelPlan(n2), skipRebuild: true }).reasons).toContain('ink');
  });

  it('every bank entry of the two chapters (all tiers) validates and carries its mechanic', () => {
    for (const ch of [30, 34]) {
      for (const n of chapterLevels(ch)) {
        const plan = levelPlan(n);
        for (let t = 0; t < TIERS; t++) {
          expect(bankEntry(n, t), `${n}/${t}`).not.toBeNull();
          const spec = bankSpec(n, t);
          const board = buildBoard(spec);
          const v = validate(spec, board, measure(spec, board), { tier: t, plan });
          expect(v.reasons, `level ${n} tier ${t}`).toEqual([]);
          if (plan.mechanics.includes('seals')) expect(!!board.seals, `${n}/${t}`).toBe(true);
          if (plan.mechanics.includes('ink')) expect(board.cells.some(isInk), `${n}/${t}`).toBe(true);
        }
      }
    }
  });
});
