/**
 * Board model. Cells hold a card id (0–47), EMPTY, or STONE.
 * Card ids follow the deck: month = id >> 2 (0–11), variant = id & 3.
 */

export const EMPTY = -1;
export const STONE = -2;

export interface Board {
  rows: number;
  cols: number;
  /** row-major, length rows * cols */
  cells: number[];
}

export interface Point {
  r: number;
  c: number;
}

export const monthOf = (cardId: number): number => cardId >> 2;
export const variantOf = (cardId: number): number => cardId & 3;
export const isCard = (v: number): boolean => v >= 0;

export const idx = (b: Board, r: number, c: number): number => r * b.cols + c;
export const pointOf = (b: Board, i: number): Point => ({ r: Math.floor(i / b.cols), c: i % b.cols });

export function cloneBoard(b: Board): Board {
  return { rows: b.rows, cols: b.cols, cells: b.cells.slice() };
}

export function cardsLeft(b: Board): number {
  let n = 0;
  for (const v of b.cells) if (isCard(v)) n++;
  return n;
}

/** Two cells form a jjak when both hold cards of the same month. */
export function sameMonth(b: Board, i: number, j: number): boolean {
  const a = b.cells[i];
  const c = b.cells[j];
  return i !== j && isCard(a) && isCard(c) && monthOf(a) === monthOf(c);
}
