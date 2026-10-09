import { type Board, EMPTY, STONE, gateMonth, gateOf, isBlock, isCard, isGate, isTerrain, monthOf } from './board';
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
 */
function placePairs(
  base: Board,
  slots: number[],
  pairs: [number, number][],
  rng: Rng,
  maxAttempts = 40,
): Board | null {
  const { rows, cols } = base;
  // Distance from the board edge: deep cells are filled first so the last
  // placements (= the player's first moves on a full board) sit near the rim.
  const depth = (i: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return Math.min(r, c, rows - 1 - r, cols - 1 - c);
  };

  const hasGates = base.cells.some(isGate);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const b: Board = base.walls ? { rows, cols, cells: base.cells.slice(), walls: base.walls } : { rows, cols, cells: base.cells.slice() };
    for (const s of slots) b.cells[s] = EMPTY;
    const order = rng.shuffle(pairs.slice());
    const free = new Set(slots);
    let ok = true;
    // Gates: index of the last pair of each month in `order` (the first one cleared in reverse).
    const lastOf = new Array(13).fill(-1);
    if (hasGates) order.forEach(([ca], k) => (lastOf[monthOf(ca)] = k));
    let k = 0;
    const passable = hasGates ? (v: number) => v === EMPTY || (isGate(v) && k < lastOf[gateMonth(v)]) : undefined;

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
          (p.length === xPartners.length && depth(f) > depth(x)) ||
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
      const candidates = xPartners
        .map((y) => ({ y, key: depth(y) + rng.next() * 1.5 }))
        .sort((p, q) => q.key - p.key)
        .map((p) => p.y);
      const [p, q] = rng.next() < 0.5 ? [ca, cb] : [cb, ca];
      let placed = false;
      for (const y of candidates) {
        b.cells[x] = p;
        b.cells[y] = q;
        free.delete(x);
        free.delete(y);
        if (free.size === 0 || healthy()) {
          placed = true;
          break;
        }
        b.cells[x] = EMPTY;
        b.cells[y] = EMPTY;
        free.add(x);
        free.add(y);
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return b;
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
  /** card ids, length must equal playable cells; consecutive entries form pairs */
  cards: number[];
}

export function generateBoard(opts: GenerateOptions, rng: Rng): Board {
  const { rows, cols } = opts;
  const base: Board = { rows, cols, cells: new Array(rows * cols).fill(EMPTY) };
  if (opts.walls) base.walls = opts.walls;
  for (const s of opts.stones ?? []) base.cells[s] = STONE;
  for (const g of opts.gates ?? []) base.cells[g.cell] = gateOf(g.month);
  for (const t of opts.terrain ?? []) base.cells[t.cell] = t.value;
  const slots: number[] = [];
  base.cells.forEach((v, i) => v === EMPTY && slots.push(i));
  if (slots.length !== opts.cards.length) {
    throw new Error(`cards (${opts.cards.length}) must fill ${slots.length} slots`);
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < opts.cards.length; i += 2) pairs.push([opts.cards[i], opts.cards[i + 1]]);

  const b = placePairs(base, slots, pairs, rng);
  if (b) return b;
  // Fences, terrain and gates are extras: lose the fences first, then turn
  // terrain and then gates into stones.
  if (opts.walls) return generateBoard({ ...opts, walls: undefined }, rng);
  if (opts.terrain?.length) return generateBoard({ ...opts, terrain: [], stones: (opts.stones ?? []).concat(opts.terrain.map((t) => t.cell)) }, rng);
  if (opts.gates?.length) return generateBoard({ ...opts, gates: [], stones: (opts.stones ?? []).concat(opts.gates.map((g) => g.cell)) }, rng);
  // Stones can occasionally wall a region off: drop two at a time and fill the
  // freed cells with a copy of an existing pair.
  const stones = (opts.stones ?? []).slice();
  if (stones.length === 0) throw new Error('board generation failed');
  const cards = opts.cards.concat(opts.cards[0], opts.cards[1]);
  return generateBoard({ rows, cols, stones: stones.slice(0, -2), cards }, rng);
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
  const out = placePairs(base, slots, pairs, rng, 200);
  if (out) return out;
  // The cells themselves can be a dead end (say, a card in a stone pocket with
  // its partner walled off behind it). Re-deal onto open cells, rim first.
  const open: number[] = [];
  b.cells.forEach((v, i) => !isBlock(v) && !isTerrain(v) && open.push(i));
  const rim = (i: number) => {
    const r = Math.floor(i / b.cols);
    const c = i % b.cols;
    return Math.min(r, c, b.rows - 1 - r, b.cols - 1 - c) + rng.next() * 0.5;
  };
  const target = open
    .map((i) => ({ i, k: rim(i) }))
    .sort((p, q) => p.k - q.k)
    .slice(0, slots.length)
    .map((p) => p.i);
  const cleared: Board = { rows: b.rows, cols: b.cols, cells: b.cells.map((v) => (isBlock(v) || isTerrain(v) ? v : EMPTY)) };
  if (b.walls) cleared.walls = b.walls;
  const moved = placePairs(cleared, target, pairs, rng, 200);
  if (moved) return moved;
  // Extremely unlikely; a plain shuffle at least changes the position.
  const vals = rng.shuffle(slots.map((s) => b.cells[s]));
  const cells = b.cells.slice();
  slots.forEach((s, k) => (cells[s] = vals[k]));
  return b.walls ? { rows: b.rows, cols: b.cols, cells, walls: b.walls } : { rows: b.rows, cols: b.cols, cells };
}
