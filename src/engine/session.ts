import { type Board, type Point, EMPTY, cardsLeft, cloneBoard, sameMonth } from './board';
import { reshuffle } from './generate';
import { type LevelSpec, buildBoard } from './levels';
import { findMove } from './moves';
import { findPath } from './path';
import { createRng, type Rng } from './rng';

/** Next jjak within this window keeps the combo alive. */
export const COMBO_WINDOW_MS = 4000;
export const MAX_COMBO = 5;
export const BASE_PAIR_SCORE = 100;

export type TapResult =
  | { kind: 'select'; cell: number }
  | { kind: 'deselect'; cell: number }
  | { kind: 'reselect'; from: number; cell: number }
  | { kind: 'mismatch'; a: number; b: number; reason: 'month' | 'path' }
  | { kind: 'match'; a: number; b: number; path: Point[]; combo: number; gained: number; cleared: boolean; reshuffled: boolean }
  | { kind: 'ignore' };

export interface Stars {
  clear: boolean;
  noAssist: boolean;
  underPar: boolean;
}

export const starCount = (s: Stars) => Number(s.clear) + Number(s.noAssist) + Number(s.underPar);

/**
 * One play-through of a board. Pure game state: the UI feeds it taps and the
 * current time, and renders whatever it reports back.
 */
export class Session {
  readonly spec: LevelSpec;
  board: Board;
  selected = -1;
  score = 0;
  combo = 0;
  bestCombo = 0;
  pairsMade = 0;
  hintsUsed = 0;
  shufflesUsed = 0;
  autoShuffles = 0;
  startedAt: number;
  finishedAt = 0;
  private lastMatchAt = -Infinity;
  private rng: Rng;

  constructor(spec: LevelSpec, now: number, board?: Board) {
    this.spec = spec;
    this.board = board ?? buildBoard(spec);
    this.startedAt = now;
    this.rng = createRng(`${spec.seed}-play`);
  }

  get done(): boolean {
    return this.finishedAt > 0;
  }

  elapsedMs(now: number): number {
    return (this.done ? this.finishedAt : now) - this.startedAt;
  }

  tap(cell: number, now: number): TapResult {
    if (this.done || cell < 0 || cell >= this.board.cells.length) return { kind: 'ignore' };
    if (this.board.cells[cell] < 0) return { kind: 'ignore' };
    if (this.selected < 0) {
      this.selected = cell;
      return { kind: 'select', cell };
    }
    if (this.selected === cell) {
      this.selected = -1;
      return { kind: 'deselect', cell };
    }
    const a = this.selected;
    if (!sameMonth(this.board, a, cell)) {
      // Tapping a different flower just moves the selection — gentle, not punishing.
      this.selected = cell;
      return { kind: 'reselect', from: a, cell };
    }
    const path = findPath(this.board, a, cell);
    if (!path) {
      this.selected = -1;
      return { kind: 'mismatch', a, b: cell, reason: 'path' };
    }
    return this.applyMatch(a, cell, path, now);
  }

  private applyMatch(a: number, b: number, path: Point[], now: number): TapResult {
    this.board.cells[a] = EMPTY;
    this.board.cells[b] = EMPTY;
    this.selected = -1;
    this.combo = now - this.lastMatchAt <= COMBO_WINDOW_MS ? Math.min(MAX_COMBO, this.combo + 1) : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastMatchAt = now;
    const gained = BASE_PAIR_SCORE * this.combo;
    this.score += gained;
    this.pairsMade++;

    const cleared = cardsLeft(this.board) === 0;
    let reshuffled = false;
    if (cleared) {
      this.finishedAt = now;
    } else if (!findMove(this.board)) {
      this.board = reshuffle(this.board, this.rng);
      this.autoShuffles++;
      reshuffled = true;
    }
    return { kind: 'match', a, b, path, combo: this.combo, gained, cleared, reshuffled };
  }

  /** Returns a legal pair to highlight (does not play it). */
  hint(): [number, number] | null {
    const m = findMove(this.board);
    if (m) this.hintsUsed++;
    return m;
  }

  shuffle(): void {
    this.board = reshuffle(this.board, this.rng);
    this.selected = -1;
    this.shufflesUsed++;
  }

  stars(): Stars {
    const secs = this.elapsedMs(this.finishedAt || Date.now()) / 1000;
    return {
      clear: this.done,
      noAssist: this.done && this.hintsUsed + this.shufflesUsed + this.autoShuffles === 0,
      underPar: this.done && secs <= this.spec.par,
    };
  }

  snapshot(): Board {
    return cloneBoard(this.board);
  }
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
