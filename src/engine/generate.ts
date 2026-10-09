import { type Board, EMPTY, INK, STONE, gateMonth, gateOf, isBlock, isCard, isGate, isInk, isTerrain, monthOf } from './board';
import { reachable } from './path';
import { type Rng } from './rng';

/**
 * Solvable-by-construction placement.
 *
 * Pairs are placed one at a time. Each pair must be connectable using only the
 * cells that are still unfilled at that moment. Clearing the pairs in reverse
 * placement order is then always legal: when pair k is removed, exactly the
 * pairs placed before it remain — the same occupancy it was placed against.
 *
 * Most-constrained-first (fewest partners) keeps late placements from being
 * boxed in, so retries are rare.
 *
 * Gates (門) open the first time a pair of their month is cleared. In reverse
 * order that is the *last placed* pair of the month, so a gate counts as open
 * for the placements before it and closed from then on. Fences live in
 * `base.walls`, and water and torii never change; `reachable` respects all
 * three, so the guarantee holds for them too.
 *
 * Wet ink (`base.ink`) dries after its count of pairs. Of P pairs, placement k
 * is the (P − k)-th pair cleared, so a blot that lasts L pairs is still wet
 * there when P − k ≤ L: it blocks the last L placements and is open before.
 * Seals are numbered afterwards from the placement order, which is written to
 * `placed` (cell pairs, first placed first) when given.
 */
function placePairs(
  base: Board,
  slots: number[],
  pairs: [number, number][],
  rng: Rng,
  maxAttempts = 40,
  arrange = 0,
  placed?: [number, number][],
): Board | null {
  const { rows, cols } = base;
  // Distance from the board edge: deep cells are filled first so the last
  // placements (= the player's first moves on a full board) sit near the rim.
  const depth = (i: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return Math.min(r, c, rows - 1 - r, cols - 1 - c);
  };

  // The trickiest arrangements fill the rim first, so the player's first moves
  // sit inside the board instead of along its easy edge.
  const rimFirst = arrange > 0.6;
  const hasGates = base.cells.some(isGate);
  const life = base.ink && base.cells.some(isInk) ? base.ink : null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const b: Board = base.walls ? { rows, cols, cells: base.cells.slice(), walls: base.walls } : { rows, cols, cells: base.cells.slice() };
    if (base.ink) b.ink = base.ink.slice();
    for (const s of slots) b.cells[s] = EMPTY;
    const order = rng.shuffle(pairs.slice());
    const free = new Set(slots);
    let ok = true;
    const cellsOf: [number, number][] = [];
    // Gates: index of the last pair of each month in `order` (the first one cleared in reverse).
    const lastOf = new Array(13).fill(-1);
    if (hasGates) order.forEach(([ca], k) => (lastOf[monthOf(ca)] = k));
    let k = 0;
    const P = order.length;
    const passable =
      hasGates || life
        ? (v: number, i: number) => v === EMPTY || (isGate(v) && k < lastOf[gateMonth(v)]) || (v === INK && k < P - life![i])
        : undefined;

    const span = Math.max(1, rows + cols - 2);
    const trick = (x: number, y: number, card: number): number => {
      const yr = Math.floor(y / cols);
      const yc = y % cols;
      const far = (Math.abs(Math.floor(x / cols) - yr) + Math.abs((x % cols) - yc)) / span;
      let twin = 0;
      for (let r = Math.max(0, yr - 1); r <= Math.min(rows - 1, yr + 1) && !twin; r++) {
        for (let c = Math.max(0, yc - 1); c <= Math.min(cols - 1, yc + 1); c++) {
          const v = b.cells[r * cols + c];
          if (isCard(v) && monthOf(v) === monthOf(card)) {
            twin = 1;
            break;
          }
        }
      }
      return 3 * far + 1.5 * twin;
    };
    const partnersOf = (x: number): number[] => {
      const reach = reachable(b, x, passable);
      const out: number[] = [];
      for (const y of reach) if (y !== x && free.has(y)) out.push(y);
      return out;
    };
    // Every free cell must keep at least one partner, or the board is doomed.
    const healthy = (): boolean => {
      for (const f of free) if (partnersOf(f).length === 0) return false;
      return true;
    };

    for (; k < order.length; k++) {
      const [ca, cb] = order[k];
      // Most constrained cell first.
      let x = -1;
      let xPartners: number[] = [];
      for (const f of free) {
        const p = partnersOf(f);
        if (p.length === 0) continue;
        const better =
          x < 0 ||
          p.length < xPartners.length ||
          (p.length === xPartners.length && (rimFirst ? depth(f) < depth(x) : depth(f) > depth(x))) ||
          (p.length === xPartners.length && depth(f) === depth(x) && rng.next() < 0.5);
        if (better) {
          x = f;
          xPartners = p;
        }
      }
      if (x < 0) {
        ok = false;
        break;
      }
      // Prefer deep partners, with noise for variety; keep the rest healthy.
      // A tricky arrangement (Level Director) also prefers partners far from x
      // (long, two-bend reads) and cells right beside an earlier card of the same
      // flower (look-alike pairs: blocked decoys, or tempting wrong matches).
      const keyOf = arrange > 0 ? (y: number) => (1 - arrange) * depth(y) + arrange * trick(x, y, ca) : depth;
      const candidates = xPartners
        .map((y) => ({ y, key: keyOf(y) + rng.next() * 1.5 }))
        .sort((p, q) => q.key - p.key)
        .map((p) => p.y);
      const [p, q] = rng.next() < 0.5 ? [ca, cb] : [cb, ca];
      let done = false;
      for (const y of candidates) {
        b.cells[x] = p;
        b.cells[y] = q;
        free.delete(x);
        free.delete(y);
        if (free.size === 0 || healthy()) {
          done = true;
          cellsOf.push([x, y]);
          break;
        }
        b.cells[x] = EMPTY;
        b.cells[y] = EMPTY;
        free.add(x);
        free.add(y);
      }
      if (!done) {
        ok = false;
        break;
      }
    }
    if (ok) {
      if (placed) placed.push(...cellsOf);
      return b;
    }
  }
  return null;
}

export interface GenerateOptions {
  rows: number;
  cols: number;
  /** cell indices that hold permanent stones */
  stones?: number[];
  /** gates: cell index and the month whose pair opens it */
  gates?: { cell: number; month: number }[];
  /** fence bits per cell (see FENCE_RIGHT / FENCE_DOWN) */
  walls?: Uint8Array;
  /** fixed terrain: water and torii cells (see board.ts), as cell index and value */
  terrain?: { cell: number; value: number }[];
  /** wet ink: cells that start without a card, and how many pairs each stays wet */
  ink?: { cell: number; life: number }[];
  /** this many sealed pairs (numbered in an order the construction clears them in) */
  seals?: number;
  /** card ids, length must equal playable cells; consecutive entries form pairs */
  cards: number[];
  /**
   * 0–1, how tricky the arrangement is (Level Director boards only; 0 = the
   * classic placement, consuming the random stream exactly as before)
   */
  arrange?: number;
}

export function generateBoard(opts: GenerateOptions, rng: Rng): Board {
  const { rows, cols } = opts;
  const base: Board = { rows, cols, cells: new Array(rows * cols).fill(EMPTY) };
  if (opts.walls) base.walls = opts.walls;
  for (const s of opts.stones ?? []) base.cells[s] = STONE;
  for (const g of opts.gates ?? []) base.cells[g.cell] = gateOf(g.month);
  for (const t of opts.terrain ?? []) base.cells[t.cell] = t.value;
  if (opts.ink?.length) {
    base.ink = new Array(rows * cols).fill(0);
    for (const { cell, life } of opts.ink) {
      base.cells[cell] = INK;
      base.ink[cell] = life;
    }
  }
  const slots: number[] = [];
  base.cells.forEach((v, i) => v === EMPTY && slots.push(i));
  if (slots.length !== opts.cards.length) {
    throw new Error(`cards (${opts.cards.length}) must fill ${slots.length} slots`);
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < opts.cards.length; i += 2) pairs.push([opts.cards[i], opts.cards[i + 1]]);

  const placed: [number, number][] = [];
  const b = placePairs(base, slots, pairs, rng, 40, opts.arrange ?? 0, placed);
  if (b) {
    if (opts.seals) sealPairs(b, placed, opts.seals, rng);
    return b;
  }
  // Fences, ink, terrain and gates are extras: lose the fences first, then turn
  // ink, terrain and then gates into stones.
  if (opts.walls) return generateBoard({ ...opts, walls: undefined }, rng);
  if (opts.ink?.length) return generateBoard({ ...opts, ink: undefined, stones: (opts.stones ?? []).concat(opts.ink.map((x) => x.cell)) }, rng);
  if (opts.terrain?.length) return generateBoard({ ...opts, terrain: [], stones: (opts.stones ?? []).concat(opts.terrain.map((t) => t.cell)) }, rng);
  if (opts.gates?.length) return generateBoard({ ...opts, gates: [], stones: (opts.stones ?? []).concat(opts.gates.map((g) => g.cell)) }, rng);
  // Stones can occasionally wall a region off: drop two at a time and fill the
  // freed cells with a copy of an existing pair.
  const stones = (opts.stones ?? []).slice();
  if (stones.length === 0) throw new Error('board generation failed');
  const cards = opts.cards.concat(opts.cards[0], opts.cards[1]);
  return generateBoard({ rows, cols, stones: stones.slice(0, -2), cards, arrange: opts.arrange, seals: opts.seals }, rng);
}

/**
 * Seals (도장 · 印): number `count` placed pairs 1…count, one per flower (never
 * the lucky pair), drawn from across the placement order. The pair placed last
 * is cleared first in the construction, so the latest placed of the chosen
 * pairs gets seal 1: the construction's own order clears them 1, 2, 3…
 */
function sealPairs(b: Board, placed: [number, number][], count: number, rng: Rng): void {
  const months = new Set<number>();
  const chosen: number[] = [];
  for (const k of rng.shuffle(placed.map((_, k) => k))) {
    if (chosen.length >= count) break;
    const m = monthOf(b.cells[placed[k][0]]);
    if (m >= 12 || months.has(m)) continue;
    months.add(m);
    chosen.push(k);
  }
  if (!chosen.length) return;
  chosen.sort((x, y) => y - x);
  b.seals = new Array(b.cells.length).fill(0);
  chosen.forEach((k, n) => {
    b.seals![placed[k][0]] = n + 1;
    b.seals![placed[k][1]] = n + 1;
  });
}

/**
 * After a reshuffle, give each seal back to its own card (by card id; a copy
 * of the same card is the same face). Ink stays where it is, with its time left.
 */
function carryMarks(from: Board, to: Board): Board {
  if (from.ink) to.ink = from.ink.slice();
  if (from.seals) {
    const sealOf = new Map<number, number[]>();
    from.seals.forEach((x, i) => {
      if (!x) return;
      const id = from.cells[i];
      if (!sealOf.has(id)) sealOf.set(id, []);
      sealOf.get(id)!.push(x);
    });
    to.seals = new Array(to.cells.length).fill(0);
    to.cells.forEach((v, i) => {
      const list = sealOf.get(v);
      if (list?.length) to.seals![i] = list.shift()!;
    });
  }
  return to;
}

/**
 * Re-deal the remaining cards into their current cells so the position is
 * solvable again. Used for the Shuffle tool and automatic dead-end recovery.
 */
export function reshuffle(b: Board, rng: Rng): Board {
  const slots: number[] = [];
  const byMonth = new Map<number, number[]>();
  b.cells.forEach((v, i) => {
    if (!isCard(v)) return;
    slots.push(i);
    const m = monthOf(v);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(v);
  });
  const pairs: [number, number][] = [];
  for (const list of byMonth.values()) {
    rng.shuffle(list);
    for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
  }
  const base: Board = b.walls ? { rows: b.rows, cols: b.cols, cells: b.cells.slice(), walls: b.walls } : { rows: b.rows, cols: b.cols, cells: b.cells.slice() };
  if (b.ink) base.ink = b.ink;
  const out = placePairs(base, slots, pairs, rng, 200);
  if (out) return carryMarks(b, out);
  // The cells themselves can be a dead end (say, a card in a stone pocket with
  // its partner walled off behind it). Re-deal onto open cells, rim first. A
  // few cells on the rim can still be a dead end of their own (two far corners
  // need three bends; fences can part neighbours), so each try draws the cells
  // again, looser each time.
  const open: number[] = [];
  const fixedCell = (v: number) => isBlock(v) || isTerrain(v) || isInk(v);
  b.cells.forEach((v, i) => !fixedCell(v) && open.push(i));
  const cleared: Board = { rows: b.rows, cols: b.cols, cells: b.cells.map((v) => (fixedCell(v) ? v : EMPTY)) };
  if (b.walls) cleared.walls = b.walls;
  if (b.ink) cleared.ink = b.ink;
  for (let tries = 0; tries < 12; tries++) {
    const noise = 0.5 + tries;
    const rim = (i: number) => {
      const r = Math.floor(i / b.cols);
      const c = i % b.cols;
      return Math.min(r, c, b.rows - 1 - r, b.cols - 1 - c) + rng.next() * noise;
    };
    const target = open
      .map((i) => ({ i, k: rim(i) }))
      .sort((p, q) => p.k - q.k)
      .slice(0, slots.length)
      .map((p) => p.i);
    const moved = placePairs(cleared, target, pairs, rng, tries === 0 ? 200 : 40);
    if (moved) return carryMarks(b, moved);
  }
  // Extremely unlikely; a plain shuffle at least changes the position.
  const vals = rng.shuffle(slots.map((s) => b.cells[s]));
  const cells = b.cells.slice();
  slots.forEach((s, k) => (cells[s] = vals[k]));
  return carryMarks(b, b.walls ? { rows: b.rows, cols: b.cols, cells, walls: b.walls } : { rows: b.rows, cols: b.cols, cells });
}
