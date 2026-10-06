import { type Board, isCard, monthOf } from './board';
import { reachable } from './path';

/** First available jjak on the board, or null if the position is stuck. */
export function findMove(b: Board): [number, number] | null {
  for (let i = 0; i < b.cells.length; i++) {
    const v = b.cells[i];
    if (!isCard(v)) continue;
    const m = monthOf(v);
    for (const j of reachable(b, i)) {
      if (j > i && isCard(b.cells[j]) && monthOf(b.cells[j]) === m) return [i, j];
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
