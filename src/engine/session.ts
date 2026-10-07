import { type Board, type Point, EMPTY, cardsLeft, cloneBoard, sameMonth } from './board';
import { reshuffle } from './generate';
import { type LevelSpec, buildBoard, pickSnow } from './levels';
import { applyGravity, findMove } from './moves';
import { findPath } from './path';
import { createRng, type Rng } from './rng';

/** Next jjak within this window keeps the combo alive. */
export const COMBO_WINDOW_MS = 4000;
export const MAX_COMBO = 5;
export const BASE_PAIR_SCORE = 100;
/** Reaching a ×5 combo starts Fever (満開 · 만개, "full bloom"): double score for a few seconds. */
export const FEVER_MS = 6000;

export type TapResult =
  | { kind: 'select'; cell: number }
  | { kind: 'deselect'; cell: number }
  | { kind: 'reselect'; from: number; cell: number }
  | { kind: 'mismatch'; a: number; b: number; reason: 'month' | 'path' }
  | {
      kind: 'match';
      a: number;
      b: number;
      path: Point[];
      combo: number;
      gained: number;
      cleared: boolean;
      reshuffled: boolean;
      /** falling-leaves moves, [fromCell, toCell] */
      moved: [number, number][];
      /** snow-covered cells uncovered by this pair */
      revealed: number[];
      /** Fever is active for this pair (score doubled) */
      fever: boolean;
      /** this pair started Fever */
      feverStarted: boolean;
    }
  | { kind: 'hidden'; cell: number }
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
  /** cells whose card is still under snow */
  hidden: Set<number>;
  private lastMatchAt = -Infinity;
  /** Fever ends at this timestamp */
  feverUntil = -Infinity;
  feverCount = 0;
  private rng: Rng;

  constructor(spec: LevelSpec, now: number, board?: Board) {
    this.spec = spec;
    this.board = board ?? buildBoard(spec);
    this.startedAt = now;
    this.rng = createRng(`${spec.seed}-play`);
    this.hidden = pickSnow(this.board, spec.snow, spec.seed);
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
    if (this.hidden.has(cell)) return { kind: 'hidden', cell };
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
    const wasFever = now < this.feverUntil;
    let feverStarted = false;
    if (this.combo >= MAX_COMBO && !wasFever) {
      this.feverUntil = now + FEVER_MS;
      this.feverCount++;
      feverStarted = true;
    }
    const fever = now < this.feverUntil;
    const gained = BASE_PAIR_SCORE * this.combo * (fever ? 2 : 1);
    this.score += gained;
    this.pairsMade++;

    let moved: [number, number][] = [];
    if (this.spec.gravity) {
      moved = applyGravity(this.board);
      // Snow travels with its card.
      for (const [from, to] of moved) {
        if (this.hidden.delete(from)) this.hidden.add(to);
      }
    }
    const revealed = this.thaw();

    const cleared = cardsLeft(this.board) === 0;
    let reshuffled = false;
    if (cleared) {
      this.finishedAt = now;
    } else if (!findMove(this.board, this.hidden)) {
      if (this.hidden.size) {
        // Stuck only because of snow: melt it all (not the player's fault, no penalty).
        revealed.push(...this.hidden);
        this.hidden.clear();
      }
      if (!findMove(this.board)) {
        this.board = reshuffle(this.board, this.rng);
        this.autoShuffles++;
        reshuffled = true;
      }
    }
    return { kind: 'match', a, b, path, combo: this.combo, gained, cleared, reshuffled, moved, revealed, fever, feverStarted };
  }

  /** Uncover snowy cards that now touch an empty cell (or the board edge). */
  private thaw(): number[] {
    const out: number[] = [];
    const { rows, cols, cells } = this.board;
    for (const i of this.hidden) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const open =
        r === 0 || c === 0 || r === rows - 1 || c === cols - 1 ||
        cells[i - 1] === EMPTY || cells[i + 1] === EMPTY || cells[i - cols] === EMPTY || cells[i + cols] === EMPTY;
      if (open) out.push(i);
    }
    for (const i of out) this.hidden.delete(i);
    return out;
  }

  /** Returns a legal pair to highlight (does not play it). */
  hint(): [number, number] | null {
    const m = findMove(this.board, this.hidden);
    if (m) this.hintsUsed++;
    return m;
  }

  /** Player-requested shuffle. Returns any snowy cells melted to avoid a stuck board. */
  shuffle(): number[] {
    this.board = reshuffle(this.board, this.rng);
    this.selected = -1;
    this.shufflesUsed++;
    if (this.hidden.size && !findMove(this.board, this.hidden)) {
      const melted = [...this.hidden];
      this.hidden.clear();
      return melted;
    }
    return [];
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
