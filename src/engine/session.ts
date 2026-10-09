import { isBonus } from '../data/deck';
import { type Board, type Point, cardsLeft, cloneBoard, sameMonth } from './board';
import { reshuffle } from './generate';
import { GOALS, type GoalStats } from './goals';
import { type LevelSpec, buildBoard, pickKnots, pickSnow, windOf } from './levels';
import { findMove } from './moves';
import { findPath, pathBends } from './path';
import { type Freed, type PlayState, applyPair, currentSeal, lockedOf, releaseIfStuck } from './rules';
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
      /** gate cells opened by this pair (now empty) */
      opened: number[];
      /** ink blots that dried with this pair, or were dried early by the safety net (now empty) */
      dried: number[];
      /** cells whose seal the safety net broke so play could go on */
      unsealed: number[];
      /** bends in the path (0, 1 or 2) */
      turns: number;
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
  /** the card's seal (도장) must wait: seal `first` goes before it. No penalty. */
  | { kind: 'sealed'; cell: number; first: number }
  | { kind: 'ignore' };

export interface Stars {
  clear: boolean;
  noAssist: boolean;
  underPar: boolean;
  /** goal boards only: the goal was met (it takes the par blossom's place) */
  goal?: boolean;
}

/** The third blossom: the goal on goal boards, otherwise the par time. */
export const thirdStar = (s: Stars) => s.goal ?? s.underPar;
export const starCount = (s: Stars) => Number(s.clear) + Number(s.noAssist) + Number(thirdStar(s));

/**
 * One play-through of a board. Pure game state: the UI feeds it taps and the
 * current time, and renders whatever it reports back.
 */
export class Session implements PlayState, GoalStats {
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
  /** same-flower taps that had no legal path (mis-reads) */
  blockedTaps = 0;
  /** different-flower taps that moved the selection */
  reselects = 0;
  /** pairs by bends in their path: [straight, one bend, two bends] */
  readonly turns: [number, number, number] = [0, 0, 0];
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
    this.totalPairs = cardsLeft(this.board) / 2;
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
    return lockedOf(this);
  }

  get straightPairs(): number {
    return this.turns[0];
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
    if (this.board.seals?.[cell] && this.board.seals[cell] > currentSeal(this.board)) return { kind: 'sealed', cell, first: currentSeal(this.board) };
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
      this.reselects++;
      return { kind: 'reselect', from: a, cell };
    }
    const path = findPath(this.board, a, cell);
    if (!path) {
      this.selected = -1;
      this.blockedTaps++;
      return { kind: 'mismatch', a, b: cell, reason: 'path' };
    }
    return this.applyMatch(a, cell, path, now);
  }

  private applyMatch(a: number, b: number, path: Point[], now: number): TapResult {
    const cards: [number, number] = [this.board.cells[a], this.board.cells[b]];
    this.cleared.add(this.board.cells[a]);
    this.cleared.add(this.board.cells[b]);
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

    const turns = Math.min(2, pathBends(path));
    this.turns[turns]++;
    const wind = windOf(this.spec);
    const { moved, opened, revealed, untied, dried } = applyPair(this, a, b, wind);

    const cleared = cardsLeft(this.board) === 0;
    let reshuffled = false;
    const freed: Freed = { dried, unsealed: [] };
    if (cleared) {
      this.finishedAt = now;
    } else if (releaseIfStuck(this, revealed, untied, freed)) {
      // Snow or knots alone never strand you (released above, for free); a true dead end reshuffles.
      this.redeal(revealed, untied);
      this.autoShuffles++;
      if (wind && wind !== 'down') this.windShuffles++;
      reshuffled = true;
    }
    const { unsealed } = freed;
    return { kind: 'match', a, b, cards, path, combo: this.combo, gained, cleared, reshuffled, moved, revealed, untied, opened, dried, unsealed, turns, lucky, fever, feverStarted, yaku };
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
    this.selected = -1;
    this.shufflesUsed++;
    const melted: number[] = [];
    this.lastUntied = [];
    this.redeal(melted, this.lastUntied);
    this.lastFreed = { dried: [], unsealed: [] };
    if (this.hidden.size || this.knots.size || this.board.seals || this.board.ink) releaseIfStuck(this, melted, this.lastUntied, this.lastFreed);
    return melted;
  }

  /**
   * True after a reshuffle that had to move cards onto different cells (a card
   * walled in by stones): the screen must redraw the board, not just the faces.
   */
  relaid = false;

  /**
   * Reshuffle the cards. Usually they stay in their cells; if they had to be
   * re-dealt onto other cells, snow and knots can't follow a card's identity, so
   * they are released (free, as with any stuck board) and reported.
   */
  private redeal(revealed: number[], untied: number[]): void {
    const before = this.board.cells.map((v) => v >= 0);
    this.board = reshuffle(this.board, this.rng);
    this.relaid = this.board.cells.some((v, i) => (v >= 0) !== before[i]);
    if (this.relaid) {
      revealed.push(...[...this.hidden].filter((i) => this.board.cells[i] >= 0));
      untied.push(...[...this.knots].filter((i) => this.board.cells[i] >= 0));
      this.hidden.clear();
      this.knots.clear();
    }
  }
  /** knots untied by the last shuffle() */
  lastUntied: number[] = [];
  /** seals broken and ink dried by the last shuffle()'s safety net */
  lastFreed: Freed = { dried: [], unsealed: [] };

  stars(): Stars {
    const secs = this.elapsedMs(this.finishedAt || Date.now()) / 1000;
    const out: Stars = {
      clear: this.done,
      noAssist: this.done && this.hintsUsed + this.shufflesUsed + this.autoShuffles - this.windShuffles === 0,
      underPar: this.done && secs <= this.spec.par,
    };
    if (this.spec.goal) out.goal = this.done && this.goalMet();
    return out;
  }

  /** The board's goal (if any) is met so far. */
  goalMet(): boolean {
    const g = this.spec.goal ? GOALS[this.spec.goal] : null;
    return !!g && g.met(this, this.totalPairs);
  }

  /** Pairs on the board at the start. */
  readonly totalPairs: number = 0;

  snapshot(): Board {
    return cloneBoard(this.board);
  }
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
