/**
 * Board model. Cells hold a card id (0–49), EMPTY, STONE, WATER, a TORII of one
 * of two twin pairs, or a GATE keyed to a month. Card ids follow the deck:
 * month = id >> 2 (0–11, 12 = lucky), variant = id & 3.
 */

export const EMPTY = -1;
export const STONE = -2;
/**
 * A stream (개울 · 小川): water a path may cross, but only straight on. It never
 * holds a card and never changes; a path can't bend on it (see path.ts).
 */
export const WATER = -3;
/**
 * A torii (鳥居) of twin pair k (0 or 1) is stored as TORII - k. A path that
 * enters one torii leaves its twin in the same direction (see path.ts).
 */
export const TORII = -4;
export const TORII_PAIRS = 2;
export const isTorii = (v: number): boolean => v <= TORII && v > TORII - TORII_PAIRS;
export const toriiPair = (v: number): number => TORII - v;
export const toriiOf = (pair: number): number => TORII - pair;
export const isWater = (v: number): boolean => v === WATER;
/** Fixed terrain a path may use but no card ever sits on: water and torii. */
export const isTerrain = (v: number): boolean => v === WATER || isTorii(v);
/**
 * Wet ink (먹 · 墨) on a cell with no card: it blocks paths like a stone until
 * it dries. `Board.ink` holds how many more pairs each blot stays wet; when
 * that reaches 0 the cell becomes EMPTY (see rules.ts).
 */
export const INK = -6;
export const isInk = (v: number): boolean => v === INK;
/** A gate (門) of month m is stored as GATE - m. It blocks like a stone until a pair of m is cleared. */
export const GATE = -16;

export const isGate = (v: number): boolean => v <= GATE && v > GATE - 13;
export const gateMonth = (v: number): number => GATE - v;
export const gateOf = (month: number): number => GATE - month;
/** Stones and closed gates: cards slide up against them and paths can't cross them. */
export const isBlock = (v: number): boolean => v === STONE || isGate(v);

/** Fence bits per cell (bamboo fences, 울타리): one on the cell's right edge, one on its bottom edge. */
export const FENCE_RIGHT = 1;
export const FENCE_DOWN = 2;

export interface Board {
  rows: number;
  cols: number;
  /** row-major, length rows * cols */
  cells: number[];
  /**
   * Optional fences on cell edges (FENCE_RIGHT | FENCE_DOWN per cell). Paths can't
   * cross a fence; it never changes, so clones share it.
   */
  walls?: Uint8Array;
  /**
   * Ordered seals (도장 · 印), per cell: 0 for none, else the seal's number. A
   * sealed card can only be picked once every lower number is gone from the
   * board. Seals belong to their card: they go when it is cleared and follow it
   * through a reshuffle.
   */
  seals?: number[];
  /** Wet ink, per cell: pairs left before the blot on that INK cell dries (0 elsewhere). */
  ink?: number[];
}

export interface Point {
  r: number;
  c: number;
  /**
   * Set on the point where a path comes out of a torii: the stretch from the
   * previous point (the torii it went into) to this one is a jump, not a line.
   */
  jump?: true;
}

export const monthOf = (cardId: number): number => cardId >> 2;
export const variantOf = (cardId: number): number => cardId & 3;
export const isCard = (v: number): boolean => v >= 0;

export const idx = (b: Board, r: number, c: number): number => r * b.cols + c;
export const pointOf = (b: Board, i: number): Point => ({ r: Math.floor(i / b.cols), c: i % b.cols });

export function cloneBoard(b: Board): Board {
  const out: Board = b.walls ? { rows: b.rows, cols: b.cols, cells: b.cells.slice(), walls: b.walls } : { rows: b.rows, cols: b.cols, cells: b.cells.slice() };
  if (b.seals) out.seals = b.seals.slice();
  if (b.ink) out.ink = b.ink.slice();
  return out;
}

/** True when a fence stands between two orthogonally adjacent cells. */
export function fenced(b: Board, i: number, j: number): boolean {
  const w = b.walls;
  if (!w) return false;
  if (j === i + 1) return (w[i] & FENCE_RIGHT) !== 0;
  if (j === i - 1) return (w[j] & FENCE_RIGHT) !== 0;
  if (j === i + b.cols) return (w[i] & FENCE_DOWN) !== 0;
  if (j === i - b.cols) return (w[j] & FENCE_DOWN) !== 0;
  return false;
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
