import { type Board, EMPTY, STONE, isCard, monthOf } from './board';
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

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const b: Board = { rows, cols, cells: base.cells.slice() };
    for (const s of slots) b.cells[s] = EMPTY;
    const order = rng.shuffle(pairs.slice());
    const free = new Set(slots);
    let ok = true;

    const partnersOf = (x: number): number[] => {
      const reach = reachable(b, x);
      const out: number[] = [];
      for (const y of reach) if (y !== x && free.has(y)) out.push(y);
      return out;
    };
    // Every free cell must keep at least one partner, or the board is doomed.
    const healthy = (): boolean => {
      for (const f of free) if (partnersOf(f).length === 0) return false;
      return true;
    };

    for (const [ca, cb] of order) {
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
  /** card ids, length must equal playable cells; consecutive entries form pairs */
  cards: number[];
}

export function generateBoard(opts: GenerateOptions, rng: Rng): Board {
  const { rows, cols } = opts;
  const base: Board = { rows, cols, cells: new Array(rows * cols).fill(EMPTY) };
  for (const s of opts.stones ?? []) base.cells[s] = STONE;
  const slots: number[] = [];
  base.cells.forEach((v, i) => v === EMPTY && slots.push(i));
  if (slots.length !== opts.cards.length) {
    throw new Error(`cards (${opts.cards.length}) must fill ${slots.length} slots`);
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < opts.cards.length; i += 2) pairs.push([opts.cards[i], opts.cards[i + 1]]);

  const b = placePairs(base, slots, pairs, rng);
  if (b) return b;
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
  const base: Board = { rows: b.rows, cols: b.cols, cells: b.cells.slice() };
  const out = placePairs(base, slots, pairs, rng, 200);
  if (out) return out;
  // Extremely unlikely; a plain shuffle at least changes the position.
  const vals = rng.shuffle(slots.map((s) => b.cells[s]));
  const cells = b.cells.slice();
  slots.forEach((s, k) => (cells[s] = vals[k]));
  return { rows: b.rows, cols: b.cols, cells };
}
