import { type Board, EMPTY, STONE, isCard, monthOf } from './board';
import { reachable } from './path';

/**
 * First available jjak on the board, or null if the position is stuck.
 * `hidden` cells (snow-covered) still block paths but can't be picked.
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
export function countMoves(b: Board): number {
  let n = 0;
  for (let i = 0; i < b.cells.length; i++) {
    const v = b.cells[i];
    if (!isCard(v)) continue;
    const m = monthOf(v);
    for (const j of reachable(b, i)) if (j > i && isCard(b.cells[j]) && monthOf(b.cells[j]) === m) n++;
  }
  return n;
}

/**
 * "Falling leaves": cards drop straight down to fill gaps. Stones act as
 * floors, so each column is compacted segment by segment.
 * Returns the moves as [fromCell, toCell] pairs.
 */
export function applyGravity(b: Board): [number, number][] {
  const moves: [number, number][] = [];
  for (let c = 0; c < b.cols; c++) {
    let write = b.rows - 1;
    for (let r = b.rows - 1; r >= 0; r--) {
      const i = r * b.cols + c;
      const v = b.cells[i];
      if (v === STONE) {
        write = r - 1;
      } else if (isCard(v)) {
        if (r !== write) {
          const to = write * b.cols + c;
          b.cells[to] = v;
          b.cells[i] = EMPTY;
          moves.push([i, to]);
        }
        write--;
      }
    }
  }
  return moves;
}
