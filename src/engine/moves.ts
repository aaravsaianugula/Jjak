import { type Board, EMPTY, isBlock, isCard, monthOf } from './board';
import { reachable } from './path';

/**
 * First available jjak on the board, or null if the position is stuck.
 * `hidden` cells (snow-covered or knotted) still block paths but can't be picked.
 */
export function findMove(b: Board, hidden?: ReadonlySet<number>): [number, number] | null {
  for (let i = 0; i < b.cells.length; i++) {
    const v = b.cells[i];
    if (!isCard(v) || hidden?.has(i)) continue;
    const m = monthOf(v);
    for (const j of reachable(b, i)) {
      if (j > i && isCard(b.cells[j]) && !hidden?.has(j) && monthOf(b.cells[j]) === m) return [i, j];
    }
  }
  return null;
}

/** Number of distinct legal jjaks (used for difficulty telemetry and tests). */
export function countMoves(b: Board, hidden?: ReadonlySet<number>): number {
  return legalMoves(b, hidden).length;
}

/**
 * Every legal jjak [i, j] (i < j) right now. Months with fewer than two pickable
 * cards are skipped without a path search, so this stays cheap for the bots.
 */
export function legalMoves(b: Board, hidden?: ReadonlySet<number>): [number, number][] {
  const count = new Array(13).fill(0);
  for (let i = 0; i < b.cells.length; i++) {
    const v = b.cells[i];
    if (isCard(v) && !hidden?.has(i)) count[monthOf(v)]++;
  }
  const out: [number, number][] = [];
  for (let i = 0; i < b.cells.length; i++) {
    const v = b.cells[i];
    if (!isCard(v) || hidden?.has(i)) continue;
    const m = monthOf(v);
    if (count[m] < 2) continue;
    for (const j of reachable(b, i)) {
      if (j > i && isCard(b.cells[j]) && !hidden?.has(j) && monthOf(b.cells[j]) === m) out.push([i, j]);
    }
  }
  return out;
}

/** Which way cards slide after each pair: falling leaves are 'down', wind blows the other three ways. */
export type Wind = 'down' | 'left' | 'right' | 'up';
export const WINDS: readonly Wind[] = ['down', 'left', 'right', 'up'];

/**
 * "Falling leaves" and "Wind": cards slide in `dir` to fill gaps. Stones and closed
 * gates act as floors (or walls), so each line is compacted segment by segment.
 * Returns the moves as [fromCell, toCell] pairs.
 */
export function applyGravity(b: Board, dir: Wind = 'down'): [number, number][] {
  const moves: [number, number][] = [];
  const vertical = dir === 'down' || dir === 'up';
  const lines = vertical ? b.cols : b.rows;
  const len = vertical ? b.rows : b.cols;
  // Walk each line starting from the side the cards slide towards.
  const towardStart = dir === 'up' || dir === 'left';
  for (let line = 0; line < lines; line++) {
    const cellAt = (k: number) => {
      const p = towardStart ? k : len - 1 - k;
      return vertical ? p * b.cols + line : line * b.cols + p;
    };
    let write = 0;
    for (let k = 0; k < len; k++) {
      const i = cellAt(k);
      const v = b.cells[i];
      if (isBlock(v)) {
        write = k + 1;
      } else if (isCard(v)) {
        if (k !== write) {
          const to = cellAt(write);
          b.cells[to] = v;
          b.cells[i] = EMPTY;
          moves.push([i, to]);
        }
        write++;
      }
    }
  }
  return moves;
}
