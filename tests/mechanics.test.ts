/**
 * C3 mechanics: gates (門), bamboo fences (垣) and level goals. Rules, the
 * fence/gate pickers, goal and blossom counting, a solvability fuzz, and the
 * guarantee that boards without the new fields are exactly what they were.
 */
import { describe, expect, it } from 'vitest';
import { type Board, EMPTY, FENCE_DOWN, FENCE_RIGHT, STONE, gateMonth, gateOf, isBlock, isCard, isGate, monthOf } from '../src/engine/board';
import { GOALS, GOAL_IDS, type GoalId, type GoalStats, straightNeed } from '../src/engine/goals';
import { type LevelSpec, buildBoard, dailyLevel, journeyLevel, maxStones, pickFences, pickKnots, pickSnow, rushLevel, windOf, zenLevel } from '../src/engine/levels';
import { clash } from '../src/engine/mechanics';
import { applyGravity, legalMoves } from '../src/engine/moves';
import { findPath, reachable } from '../src/engine/path';
import { createRng } from '../src/engine/rng';
import { type PlayState, applyPair } from '../src/engine/rules';
import { Session, type Stars, starCount, thirdStar } from '../src/engine/session';
import { solve } from '../src/engine/solve';

const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({
  mode: 'journey', number: 99, seed: 'mech', rows: 8, cols: 6, stones: 0, months: 12, variants: true, par: 120, gravity: false, snow: 0, ...over,
});
const state = (board: Board): PlayState => ({ board, hidden: new Set(), knots: new Set() });

/** Play a board to the end through Session.tap, pairs `gap` ms apart. Returns the session. */
function playOut(s: Session, gap: number, pick: (s: Session) => [number, number] | null = (x) => x.findMove(), maxSteps = 400): Session {
  let t = 0;
  for (let k = 0; k < maxSteps && !s.done; k++) {
    const m = pick(s);
    if (!m) throw new Error(`no move on ${s.spec.seed}`);
    t += gap;
    s.tap(m[0], t);
    const r = s.tap(m[1], t);
    expect(r.kind).toBe('match');
  }
  return s;
}

// ─────────────────────────────── Gates ───────────────────────────────

describe('gates (門)', () => {
  it('open only when a pair of their own flower is cleared', () => {
    // 2×4: two gates of month 2, one of month 3, and pairs of months 0, 2 and 1.
    const b: Board = { rows: 2, cols: 4, cells: [0, gateOf(2), 1, gateOf(3), 8, gateOf(2), 9, EMPTY] };
    const st = state(b);
    expect(applyPair(st, 0, 2, null).opened).toEqual([]); // Pine opens nothing
    expect(b.cells.filter(isGate).length).toBe(3);
    const res = applyPair(st, 4, 6, null); // Plum (month 2) opens both of its gates
    expect(res.opened.sort()).toEqual([1, 5]);
    expect(b.cells[1]).toBe(EMPTY);
    expect(b.cells[5]).toBe(EMPTY);
    expect(gateMonth(b.cells[3])).toBe(3); // the other flower's gate stays shut
  });

  it('are not cards: a tap on one is ignored and it never counts as a pair left', () => {
    for (let k = 0; k < 30; k++) {
      const s = new Session(spec({ seed: `gt-${k}`, gates: 4 }), 0);
      const g = s.board.cells.findIndex(isGate);
      if (g < 0) continue;
      expect(s.tap(g, 0).kind).toBe('ignore');
      expect(s.totalPairs * 2).toBe(s.board.cells.filter(isCard).length);
      return;
    }
    throw new Error('no gate board found');
  });

  it('block paths until opened, then let the path through', () => {
    // 3×3, Pine at the top and bottom of the middle column, a Plum gate between them.
    const b: Board = { rows: 3, cols: 3, cells: [8, 0, 9, 5, gateOf(2), 6, 10, 1, 11] };
    expect(findPath(b, 1, 7)).toBeNull();
    applyPair(state(b), 0, 2, null); // a Plum pair (ids 8, 9) opens the gate
    expect(findPath(b, 1, 7)!.length).toBe(2); // straight down through the gate
  });

  it('are floors for falling leaves while shut; the card falls through once open', () => {
    // 4×2. Column 0: a Paulownia card resting on a Willow gate. Column 1: two Willow cards.
    const b: Board = { rows: 4, cols: 2, cells: [44, 40, gateOf(10), 41, EMPTY, 4, EMPTY, 5] };
    const st = state(b);
    expect(applyGravity({ ...b, cells: b.cells.slice() }, 'down')).toEqual([]); // the gate holds it up
    const res = applyPair(st, 1, 3, 'down'); // pair the Willows: the gate opens, then the card falls
    expect(res.opened).toEqual([2]);
    expect(res.moved).toContainEqual([0, 6]);
    expect(b.cells[6]).toBe(44);
  });

  it('are walls for the wind while shut, and open the lane when they go', () => {
    // 1 row: empty, gate(month 1), a Pine card, a Plum pair split around it.
    const b: Board = { rows: 2, cols: 4, cells: [EMPTY, gateOf(1), 0, 1, 4, EMPTY, EMPTY, 5] };
    const st = state(b);
    // Pine pair (0 and 1) clears first: the lane left of the gate stays empty, nothing passes the gate.
    const r1 = applyPair(st, 2, 3, 'left');
    expect(r1.opened).toEqual([]);
    expect(b.cells[1]).toBe(gateOf(1));
    // Plum: the gate opens. Nothing is left in row 0 to drift, but row 1 compacts left.
    const r2 = applyPair(st, 4, 7, 'left');
    expect(r2.opened).toEqual([1]);
    expect(b.cells.slice(0, 4).every((v) => v === EMPTY)).toBe(true);
    // A fresh line with a card behind the gate: after opening it drifts all the way.
    const c: Board = { rows: 1, cols: 5, cells: [EMPTY, gateOf(3), 20, 12, 13] };
    expect(applyGravity({ ...c, cells: c.cells.slice() }, 'left')).toEqual([]);
    const r3 = applyPair(state(c), 3, 4, 'left');
    expect(r3.opened).toEqual([1]);
    expect(r3.moved).toEqual([[2, 0]]);
  });

  it('on gate + wind boards the solver still proves most boards and every move it makes is legal', () => {
    let proven = 0;
    for (let k = 0; k < 24; k++) {
      const s = spec({ seed: `gw-${k}`, rows: 7, cols: 6, gates: 2, stones: 2, gravity: (['down', 'left', 'right', 'up'] as const)[k % 4] });
      const b = buildBoard(s);
      const res = solve(state(b), windOf(s), 40000);
      if (!res.moves) continue;
      proven++;
      const st = state({ ...b, cells: b.cells.slice() });
      for (const [a, c] of res.moves) {
        expect(monthOf(st.board.cells[a])).toBe(monthOf(st.board.cells[c]));
        expect(findPath(st.board, a, c)).not.toBeNull();
        const month = monthOf(st.board.cells[a]);
        const gatesBefore = st.board.cells.map((v, i) => (isGate(v) && gateMonth(v) === month ? i : -1)).filter((i) => i >= 0);
        const r = applyPair(st, a, c, windOf(s));
        expect(r.opened.sort((x, y) => x - y)).toEqual(gatesBefore);
      }
      expect(st.board.cells.some(isCard)).toBe(false);
    }
    expect(proven).toBeGreaterThan(18);
  });

  it('a session reports exactly the gates of the flower just paired', () => {
    let opened = 0;
    for (let k = 0; k < 20; k++) {
      const s = new Session(spec({ seed: `go-${k}`, gates: 4, stones: 2 }), 0);
      let t = 0;
      while (!s.done) {
        const m = s.findMove()!;
        const month = monthOf(s.board.cells[m[0]]);
        const expected = s.board.cells.map((v, i) => (isGate(v) && gateMonth(v) === month ? i : -1)).filter((i) => i >= 0);
        t += 5000;
        s.tap(m[0], t);
        const r = s.tap(m[1], t);
        if (r.kind !== 'match') throw new Error('expected a match');
        expect(r.opened.sort((x, y) => x - y)).toEqual(expected);
        opened += r.opened.length;
      }
      expect(s.board.cells.some(isGate)).toBe(false); // every gate's flower gets paired eventually
    }
    expect(opened).toBeGreaterThan(40);
  });

  it('are placed inside the board, apart from stones and each other, with flowers that are on the board', () => {
    for (let k = 0; k < 60; k++) {
      const s = spec({ seed: `gp-${k}`, gates: 4, stones: 4 });
      const b = buildBoard(s);
      const months = new Set(b.cells.filter(isCard).map(monthOf));
      b.cells.forEach((v, i) => {
        if (!isGate(v)) return;
        const r = Math.floor(i / b.cols);
        const c = i % b.cols;
        expect(r > 0 && c > 0 && r < b.rows - 1 && c < b.cols - 1).toBe(true);
        expect(months.has(gateMonth(v))).toBe(true);
      });
    }
  });
});

// ─────────────────────────────── Fences ───────────────────────────────

describe('fences (垣)', () => {
  it('block the straight line between two neighbours; the path bends round', () => {
    const b: Board = { rows: 3, cols: 3, cells: Array(9).fill(EMPTY) };
    b.cells[3] = 0;
    b.cells[4] = 1;
    expect(findPath(b, 3, 4)!.length).toBe(2);
    b.walls = new Uint8Array(9);
    b.walls[3] = FENCE_RIGHT;
    expect(findPath(b, 3, 4)!.length).toBe(4); // round through the row above or below: two bends
    // Shut the rows above and below too: now only the outer lane is left, and it needs 3 bends.
    b.walls[0] = FENCE_RIGHT;
    b.walls[6] = FENCE_RIGHT;
    b.cells[1] = 40;
    b.cells[7] = 41;
    expect(findPath(b, 3, 4)).toBeNull();
    expect(reachable(b, 3).has(4)).toBe(false);
  });

  it('a fence below a card stops a vertical path', () => {
    const b: Board = { rows: 3, cols: 1, cells: [0, EMPTY, 1] };
    expect(findPath(b, 0, 2)!.length).toBe(2);
    b.walls = new Uint8Array(3);
    b.walls[1] = FENCE_DOWN;
    // Straight down is fenced; round the outside of the board is still fine.
    const p = findPath(b, 0, 2)!;
    expect(p.length).toBe(4);
  });

  it('reachable() agrees with findPath() on fenced boards with gates and stones', () => {
    for (let k = 0; k < 30; k++) {
      const b = buildBoard(spec({ seed: `fr-${k}`, fences: 10, gates: 2, stones: 4 }));
      expect(b.walls).toBeDefined();
      for (let i = 0; i < b.cells.length; i += 2) {
        if (!isCard(b.cells[i])) continue;
        const r = reachable(b, i);
        for (let j = 0; j < b.cells.length; j++) {
          if (j === i || b.cells[j] === EMPTY) continue;
          expect(r.has(j), `${k}: ${i}→${j}`).toBe(findPath(b, i, j) !== null);
        }
      }
    }
  });

  it('pickFences lays straight runs inside the board, off stones, and never shuts a cell on 3 sides', () => {
    for (let k = 0; k < 200; k++) {
      const rng = createRng(`pf-${k}`);
      const rows = 6 + rng.int(3);
      const cols = 5 + rng.int(2);
      const stones = new Set<number>();
      while (stones.size < 4) stones.add((1 + rng.int(rows - 2)) * cols + 1 + rng.int(cols - 2));
      const count = 4 + rng.int(9);
      const w = pickFences(rows, cols, count, rng, stones);
      let segs = 0;
      for (let i = 0; i < w.length; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        if (w[i] & FENCE_RIGHT) {
          segs++;
          expect(c).toBeLessThan(cols - 1);
          expect(stones.has(i) || stones.has(i + 1)).toBe(false);
        }
        if (w[i] & FENCE_DOWN) {
          segs++;
          expect(r).toBeLessThan(rows - 1);
          expect(stones.has(i) || stones.has(i + cols)).toBe(false);
        }
      }
      expect(segs).toBeLessThanOrEqual(count);
      expect(segs).toBeGreaterThanOrEqual(Math.min(count, 4));
      // Closed sides per cell: fences plus stone neighbours on the board.
      const b: Board = { rows, cols, cells: Array(rows * cols).fill(0), walls: w };
      for (const s of stones) b.cells[s] = STONE;
      for (let i = 0; i < w.length; i++) {
        if (stones.has(i)) continue;
        const r = Math.floor(i / cols);
        const c = i % cols;
        const nbs = [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, r > 0 ? i - cols : -1, r < rows - 1 ? i + cols : -1].filter((n) => n >= 0);
        let closed = 0;
        let fences = 0;
        for (const n of nbs) {
          const fence = (n === i + 1 && w[i] & FENCE_RIGHT) || (n === i - 1 && w[n] & FENCE_RIGHT) || (n === i + cols && w[i] & FENCE_DOWN) || (n === i - cols && w[n] & FENCE_DOWN);
          if (fence) fences++;
          if (fence || isBlock(b.cells[n])) closed++;
        }
        // (Random stones alone may close three sides; a fence never adds to that.)
        if (fences) expect(closed, `pf-${k} cell ${i}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('change the board: most fenced boards have fewer opening moves than without the fences', () => {
    let fewer = 0;
    for (let k = 0; k < 100; k++) {
      const b = buildBoard(spec({ seed: `fu-${k}`, fences: 8, stones: 4 }));
      const bare: Board = { rows: b.rows, cols: b.cols, cells: b.cells.slice() };
      if (legalMoves(bare).length > legalMoves(b).length) fewer++;
    }
    expect(fewer).toBeGreaterThan(45);
  });

  it('never share a board with sliding (the mechanic library and the road both say so)', () => {
    expect(clash('fences', 'wind')).toBe(true);
    expect(clash('fences', 'leaves')).toBe(true);
    for (let n = 1; n <= 1200; n++) {
      const s = journeyLevel(n);
      if (s.fences) expect(windOf(s), `level ${n}`).toBeNull();
    }
  });
});

// ─────────────────────────────── Goals ───────────────────────────────

describe('level goals', () => {
  const stats = (over: Partial<GoalStats> = {}): GoalStats => ({ bestCombo: 1, blockedTaps: 0, feverCount: 0, straightPairs: 0, pairsMade: 0, ...over });

  it('each goal is met exactly when its condition holds', () => {
    expect(GOALS.combo.met(stats({ bestCombo: 3 }), 20)).toBe(false);
    expect(GOALS.combo.met(stats({ bestCombo: 4 }), 20)).toBe(true);
    expect(GOALS.bloom.met(stats({ bestCombo: 4 }), 20)).toBe(false);
    expect(GOALS.bloom.met(stats({ bestCombo: 5, feverCount: 1 }), 20)).toBe(true);
    expect(GOALS.clean.met(stats(), 20)).toBe(true);
    expect(GOALS.clean.met(stats({ blockedTaps: 1 }), 20)).toBe(false);
    expect(straightNeed(8)).toBe(4);
    expect(straightNeed(24)).toBe(6);
    expect(GOALS.straight.met(stats({ straightPairs: 5 }), 24)).toBe(false);
    expect(GOALS.straight.met(stats({ straightPairs: 6 }), 24)).toBe(true);
    // Progress never runs past the target.
    for (const id of GOAL_IDS) {
      const [have, need] = GOALS[id].progress(stats({ bestCombo: 5, feverCount: 2, straightPairs: 30 }), 24);
      expect(have).toBeLessThanOrEqual(need);
    }
  });

  it('Rhythm and Full bloom: met by quick pairs, missed by slow ones', () => {
    for (const id of ['combo', 'bloom'] as GoalId[]) {
      const fast = playOut(new Session(spec({ seed: `gc-${id}`, rows: 6, cols: 5, goal: id }), 0), 300);
      expect(fast.goalMet()).toBe(true);
      expect(fast.stars().goal).toBe(true);
      const slow = playOut(new Session(spec({ seed: `gc-${id}`, rows: 6, cols: 5, goal: id }), 0), 5000);
      expect(slow.bestCombo).toBe(1);
      expect(slow.goalMet()).toBe(false);
      expect(slow.stars().goal).toBe(false);
    }
  });

  it('Clean read: kept with no blocked taps, lost with one', () => {
    for (let k = 0; k < 40; k++) {
      const s = new Session(spec({ seed: `cl-${k}`, goal: 'clean' }), 0);
      // Find two same-flower cards with no path between them right now.
      let blocked: [number, number] | null = null;
      const c = s.board.cells;
      for (let i = 0; i < c.length && !blocked; i++)
        for (let j = i + 1; j < c.length && !blocked; j++)
          if (isCard(c[i]) && isCard(c[j]) && monthOf(c[i]) === monthOf(c[j]) && !s.locked.has(i) && !s.locked.has(j) && !findPath(s.board, i, j)) blocked = [i, j];
      if (!blocked) continue;
      const clean = playOut(new Session(spec({ seed: `cl-${k}`, goal: 'clean' }), 0), 5000);
      expect(clean.goalMet()).toBe(true);
      s.tap(blocked[0], 10);
      expect(s.tap(blocked[1], 20)).toMatchObject({ kind: 'mismatch', reason: 'path' });
      expect(s.goalMet()).toBe(false);
      playOut(s, 5000);
      expect(s.stars()).toMatchObject({ clear: true, goal: false });
      return;
    }
    throw new Error('no board with a blocked pair found');
  });

  it('Straight brush: counts pairs joined with no bend', () => {
    // Prefer straight pairs when there are any, so the goal is met.
    const pickStraight = (s: Session) => {
      const moves = legalMoves(s.board, s.locked);
      return moves.find(([a, b]) => findPath(s.board, a, b)!.length === 2) ?? moves[0] ?? null;
    };
    const s = playOut(new Session(spec({ seed: 'st-1', goal: 'straight' }), 0), 5000, pickStraight);
    expect(s.straightPairs).toBe(s.turns[0]);
    expect(s.turns[0] + s.turns[1] + s.turns[2]).toBe(s.pairsMade);
    expect(s.goalMet()).toBe(s.straightPairs >= straightNeed(s.totalPairs));
    expect(s.goalMet()).toBe(true);
  });

  it('on a goal board the goal is the third blossom, not par', () => {
    // Slow (far over par) but the goal met: three blossoms.
    const slow = playOut(new Session(spec({ seed: 'sc-1', rows: 6, cols: 5, goal: 'clean', par: 1 }), 0), 5000);
    const st = slow.stars();
    expect(st.underPar).toBe(false);
    expect(st.goal).toBe(true);
    expect(thirdStar(st)).toBe(true);
    expect(starCount(st)).toBe(3);
    // Fast (under par) but the goal missed: two blossoms.
    const fast = playOut(new Session(spec({ seed: 'sc-1', rows: 6, cols: 5, goal: 'combo', par: 999 }), 0), 5000);
    fast.finishedAt = fast.startedAt + 1000;
    const st2 = fast.stars();
    expect(st2.underPar).toBe(true);
    expect(st2.goal).toBe(false);
    expect(starCount(st2)).toBe(2);
    // A board without a goal keeps par as the third blossom.
    const plain: Stars = { clear: true, noAssist: false, underPar: true };
    expect(thirdStar(plain)).toBe(true);
    expect(starCount(plain)).toBe(2);
    const none = playOut(new Session(spec({ seed: 'sc-1', rows: 6, cols: 5 }), 0), 5000);
    expect(none.stars().goal).toBeUndefined();
    expect(none.goalMet()).toBe(false);
  });

  it('an unfinished board never earns its goal blossom', () => {
    const s = new Session(spec({ seed: 'uf-1', goal: 'clean' }), 0);
    expect(s.goalMet()).toBe(true); // nothing mis-read yet
    expect(s.stars().goal).toBe(false); // but not cleared
  });
});

// ─────────────────────────────── Solvability fuzz ───────────────────────────────

/** A random non-sliding board with any mix of gates, fences, stones, snow and knots. */
function fuzzSpec(k: number): LevelSpec {
  const rng = createRng(`fuzz-${k}`);
  const [rows, cols] = rng.pick([[6, 5], [7, 4], [6, 6], [7, 6], [8, 5], [8, 6]] as [number, number][]);
  const stones = Math.min(maxStones(rows, cols), 2 * rng.int(4));
  const pairs = (rows * cols - stones) / 2;
  return spec({
    seed: `fuzz-${k}`,
    rows,
    cols,
    stones,
    months: Math.min(12, pairs),
    gates: 2 * rng.int(3),
    fences: rng.next() < 0.6 ? 3 + rng.int(9) : 0,
    snow: rng.next() < 0.4 ? 2 + rng.int(5) : 0,
    knots: rng.next() < 0.4 ? 2 + rng.int(3) : 0,
    lucky: rng.next() < 0.2,
    layout: rng.pick(['spread', 'lines', 'clusters'] as const),
  });
}

describe('solvability fuzz', () => {
  it('the solver clears every board with gates, fences, stones, snow and knots (300 boards)', () => {
    let gates = 0;
    let fences = 0;
    for (let k = 0; k < 300; k++) {
      const s = fuzzSpec(k);
      const b = buildBoard(s);
      if (b.cells.some(isGate)) gates++;
      if (b.walls) fences++;
      const hidden = pickSnow(b, s.snow, s.seed);
      const knots = pickKnots(b, s.knots ?? 0, s.seed, hidden);
      // As the Session does: never cover or tie the only way in.
      const res = solve({ board: b, hidden, knots }, null, 60000);
      expect(res.moves, `fuzz-${k}`).not.toBeNull();
    }
    expect(gates).toBeGreaterThan(150);
    expect(fences).toBeGreaterThan(150);
  });

  it('greedy play with the automatic reshuffle always finishes (300 boards)', () => {
    let reshuffles = 0;
    for (let k = 0; k < 300; k++) {
      const s = new Session(fuzzSpec(k), 0);
      playOut(s, 5000, (x) => x.findMove(), s.totalPairs + 40);
      expect(s.done, `fuzz-${k}`).toBe(true);
      expect(s.board.cells.some(isGate)).toBe(false);
      reshuffles += s.autoShuffles;
    }
    // Dead ends happen to a greedy player, but rarely.
    expect(reshuffles / 300).toBeLessThan(0.5);
  });
});

// ─────────────────────────────── Determinism and old boards ───────────────────────────────

/** FNV-1a, enough to pin a board. */
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

describe('determinism', () => {
  it('the same spec always builds the same gates, fences and cards', () => {
    for (let k = 0; k < 20; k++) {
      const s = fuzzSpec(k);
      const a = buildBoard(s);
      const b = buildBoard(s);
      expect(a.cells).toEqual(b.cells);
      expect(a.walls ? [...a.walls] : null).toEqual(b.walls ? [...b.walls] : null);
      const sa = new Session(s, 0);
      const sb = new Session(s, 0);
      expect([...sa.hidden]).toEqual([...sb.hidden]);
      expect([...sa.knots]).toEqual([...sb.knots]);
    }
  });

  it('pickFences is a pure function of its rng', () => {
    const a = pickFences(8, 6, 10, createRng('pure'), new Set([8, 15]));
    const b = pickFences(8, 6, 10, createRng('pure'), new Set([8, 15]));
    expect([...a]).toEqual([...b]);
  });
});

describe('boards without the new fields are unchanged', () => {
  // Hashes of boards built by the engine before gates, fences and goals existed
  // (commit e0c638c). The Daily is the same board worldwide, so it must never move.
  it('Daily boards (and their snow) are byte-identical to the pre-C3 engine', () => {
    const all: string[] = [];
    for (let d = 1; d <= 21; d++) {
      const s = dailyLevel(`2026-10-${String(d).padStart(2, '0')}`);
      const b = buildBoard(s);
      expect(b.walls).toBeUndefined();
      all.push(`${b.cells.join(',')}|${[...pickSnow(b, s.snow, s.seed)].sort((x, y) => x - y).join(',')}`);
    }
    expect(hash(all.join(';'))).toBe('f8343c2e');
  });

  it('80 fixed specs (stones, snow, knots, lucky, every shape), Zen and Rush build byte-identical boards', () => {
    // Fixed specs, so a change to the level grammar doesn't move this test, only a change to the builder.
    const rng = createRng('golden-specs');
    const all: string[] = [];
    for (let k = 0; k < 80; k++) {
      const [rows, cols] = rng.pick([[4, 4], [6, 4], [6, 5], [7, 4], [6, 6], [8, 5], [7, 6], [8, 6]] as [number, number][]);
      const stones = Math.min(maxStones(rows, cols), 2 * rng.int(4));
      const pairs = (rows * cols - stones) / 2;
      const s: LevelSpec = {
        mode: 'journey', number: k + 1, seed: `golden-${k}`, rows, cols, stones, months: Math.min(12, pairs), variants: rng.next() < 0.8, par: 100,
        gravity: false, snow: rng.next() < 0.3 ? 2 + rng.int(5) : 0, knots: rng.next() < 0.3 ? 2 + rng.int(3) : 0, lucky: rng.next() < 0.2,
      };
      const b = buildBoard(s);
      const hid = pickSnow(b, s.snow, s.seed);
      const kn = pickKnots(b, s.knots ?? 0, s.seed, hid);
      all.push(`${b.cells.join(',')}|${[...hid].sort((x, y) => x - y).join(',')}|${[...kn].sort((x, y) => x - y).join(',')}`);
    }
    expect(hash(all.join(';'))).toBe('56957703');
    const zr: string[] = [];
    for (let k = 0; k < 10; k++) zr.push(buildBoard(zenLevel(`zen-${k}`)).cells.join(','));
    for (let k = 0; k < 6; k++) zr.push(buildBoard(rushLevel('rush-golden', k)).cells.join(','));
    expect(hash(zr.join(';'))).toBe('0ff8e81d');
  });

  it('gates: 0 and fences: 0 are the same as leaving them out', () => {
    for (let k = 0; k < 10; k++) {
      const base = spec({ seed: `z-${k}`, stones: 4, snow: 3 });
      expect(buildBoard({ ...base, gates: 0, fences: 0 }).cells).toEqual(buildBoard(base).cells);
    }
  });
});
