import { isBonus } from '../data/deck';
import { type Board, type Point, EMPTY, cardsLeft, cloneBoard, sameMonth } from './board';
import { reshuffle } from './generate';
import { type LevelSpec, buildBoard, pickKnots, pickSnow, windOf } from './levels';
import { applyGravity, findMove } from './moves';
import { findPath } from './path';
import { createRng, type Rng } from './rng';
import { type Yaku, newYaku } from './yaku';

/** Next jjak within this window keeps the combo alive. */
export const COMBO_WINDOW_MS = 4000;
export const MAX_COMBO = 5;
export const BASE_PAIR_SCORE = 100;
/** Reaching a ×5 combo starts Fever (満開 · 만개, "full bloom"): double score for a few seconds. */
export const FEVER_MS = 6000;
/** Pairing the two lucky bonus cards (ids 48/49): points, and petals credited on clear. */
export const LUCKY_SCORE = 500;
export const LUCKY_PETALS = 10;

export type TapResult =
  | { kind: 'select'; cell: number }
  | { kind: 'deselect'; cell: number }
  | { kind: 'reselect'; from: number; cell: number }
  | { kind: 'mismatch'; a: number; b: number; reason: 'month' | 'path' }
  | {
      kind: 'match';
      a: number;
      b: number;
      /** the two card ids that were paired */
      cards: [number, number];
      path: Point[];
      combo: number;
      gained: number;
      cleared: boolean;
      reshuffled: boolean;
      /** falling-leaves / wind moves, [fromCell, toCell] */
      moved: [number, number][];
      /** snow-covered cells uncovered by this pair */
      revealed: number[];
      /** knotted cells untied by this pair (cell numbers after any slide) */
      untied: number[];
      /** this was the lucky bonus pair (LUCKY_SCORE already added to `gained`) */
      lucky: boolean;
      /** Fever is active for this pair (score doubled) */
      fever: boolean;
      /** this pair started Fever */
      feverStarted: boolean;
      /** card sets completed by this pair (bonus already added to score) */
      yaku: Yaku[];
    }
  | { kind: 'hidden'; cell: number }
  /** the card is tied with a cord (매듭): visible, but can't be picked yet */
  | { kind: 'knotted'; cell: number }
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
  /**
   * Automatic reshuffles on Wind boards. Sideways and upward drift can corner a
   * board in ways no one could plan for, so these don't cost the no-assist blossom.
   */
  windShuffles = 0;
  startedAt: number;
  finishedAt = 0;
  /** cells whose card is still under snow */
  hidden: Set<number>;
  /** cells whose card is still tied with a cord (knots travel with their card) */
  knots: Set<number>;
  /** lucky bonus pairs made on this board */
  luckyPairs = 0;
  private lastMatchAt = -Infinity;
  /** Fever ends at this timestamp */
  feverUntil = -Infinity;
  feverCount = 0;
  /** card ids cleared this board, and the yaku already scored */
  readonly cleared = new Set<number>();
  readonly yakuDone = new Set<string>();
  private rng: Rng;

  constructor(spec: LevelSpec, now: number, board?: Board) {
    this.spec = spec;
    this.board = board ?? buildBoard(spec);
    this.startedAt = now;
    this.rng = createRng(`${spec.seed}-play`);
    this.hidden = pickSnow(this.board, spec.snow, spec.seed);
    this.knots = pickKnots(this.board, spec.knots ?? 0, spec.seed, this.hidden);
    // A walled-in card can still pair with its neighbour; never cover or tie the only way in.
    if ((this.hidden.size || this.knots.size) && !findMove(this.board, this.locked)) {
      const m = findMove(this.board);
      if (m) for (const i of m) this.hidden.delete(i) || this.knots.delete(i);
    }
  }

  /** Cells that can't be picked right now (under snow or tied), though they still block paths. */
  get locked(): Set<number> {
    if (!this.knots.size) return this.hidden;
    if (!this.hidden.size) return this.knots;
    return new Set([...this.hidden, ...this.knots]);
  }

  /** A legal pair the player could make now (respects snow and knots), or null. */
  findMove(): [number, number] | null {
    return findMove(this.board, this.locked);
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
    if (this.knots.has(cell)) return { kind: 'knotted', cell };
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
    const cards: [number, number] = [this.board.cells[a], this.board.cells[b]];
    this.cleared.add(this.board.cells[a]);
    this.cleared.add(this.board.cells[b]);
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
    const yaku = newYaku(this.cleared, this.yakuDone);
    for (const y of yaku) this.yakuDone.add(y.id);
    const lucky = isBonus(cards[0]) && isBonus(cards[1]);
    if (lucky) this.luckyPairs++;
    const gained = BASE_PAIR_SCORE * this.combo * (fever ? 2 : 1) + yaku.reduce((sum, y) => sum + y.bonus, 0) + (lucky ? LUCKY_SCORE : 0);
    this.score += gained;
    this.pairsMade++;

    let moved: [number, number][] = [];
    const wind = windOf(this.spec);
    if (wind) {
      moved = applyGravity(this.board, wind);
      // Snow and knots travel with their card. Move them all at once: a card may
      // land where another one just left.
      if (this.hidden.size || this.knots.size) {
        const hid: number[] = [];
        const tied: number[] = [];
        for (const [from, to] of moved) {
          if (this.hidden.delete(from)) hid.push(to);
          if (this.knots.delete(from)) tied.push(to);
        }
        for (const i of hid) this.hidden.add(i);
        for (const i of tied) this.knots.add(i);
      }
    }
    const revealed = this.thaw();
    const untied = this.untie();

    const cleared = cardsLeft(this.board) === 0;
    let reshuffled = false;
    if (cleared) {
      this.finishedAt = now;
    } else if (!findMove(this.board, this.locked)) {
      // Stuck only because of snow or knots: release them (not the player's fault, no penalty).
      this.release(revealed, untied);
      if (!findMove(this.board)) {
        this.board = reshuffle(this.board, this.rng);
        this.autoShuffles++;
        if (wind && wind !== 'down') this.windShuffles++;
        reshuffled = true;
      }
    }
    return { kind: 'match', a, b, cards, path, combo: this.combo, gained, cleared, reshuffled, moved, revealed, untied, lucky, fever, feverStarted, yaku };
  }

  /**
   * Free just enough to get going again: knots first (their faces are already
   * known), then snow, then both. Pushes the freed cells onto the given lists.
   */
  private release(revealed: number[], untied: number[]): void {
    const untieAll = () => {
      untied.push(...this.knots);
      this.knots.clear();
    };
    const meltAll = () => {
      revealed.push(...this.hidden);
      this.hidden.clear();
    };
    if (this.knots.size && findMove(this.board, this.hidden)) untieAll();
    else if (this.hidden.size && findMove(this.board, this.knots)) meltAll();
    else {
      untieAll();
      meltAll();
    }
  }

  /** A cell is open once it touches an empty cell or sits on the board edge. */
  private isOpen(i: number): boolean {
    const { rows, cols, cells } = this.board;
    const r = Math.floor(i / cols);
    const c = i % cols;
    return (
      r === 0 || c === 0 || r === rows - 1 || c === cols - 1 ||
      cells[i - 1] === EMPTY || cells[i + 1] === EMPTY || cells[i - cols] === EMPTY || cells[i + cols] === EMPTY
    );
  }

  /** Untie knotted cards that now touch an empty cell (or the board edge). */
  private untie(): number[] {
    const out: number[] = [];
    for (const i of this.knots) if (this.isOpen(i)) out.push(i);
    for (const i of out) this.knots.delete(i);
    return out;
  }

  /** Uncover snowy cards that now touch an empty cell (or the board edge). */
  private thaw(): number[] {
    const out: number[] = [];
    for (const i of this.hidden) if (this.isOpen(i)) out.push(i);
    for (const i of out) this.hidden.delete(i);
    return out;
  }

  /** Returns a legal pair to highlight (does not play it). */
  hint(): [number, number] | null {
    const m = findMove(this.board, this.locked);
    if (m) this.hintsUsed++;
    return m;
  }

  /**
   * Player-requested shuffle. Returns any snowy cells melted to avoid a stuck
   * board (knots untied for the same reason are listed in `lastUntied`).
   */
  shuffle(): number[] {
    this.board = reshuffle(this.board, this.rng);
    this.selected = -1;
    this.shufflesUsed++;
    const melted: number[] = [];
    this.lastUntied = [];
    if ((this.hidden.size || this.knots.size) && !findMove(this.board, this.locked)) this.release(melted, this.lastUntied);
    return melted;
  }
  /** knots untied by the last shuffle() */
  lastUntied: number[] = [];

  stars(): Stars {
    const secs = this.elapsedMs(this.finishedAt || Date.now()) / 1000;
    return {
      clear: this.done,
      noAssist: this.done && this.hintsUsed + this.shufflesUsed + this.autoShuffles - this.windShuffles === 0,
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
