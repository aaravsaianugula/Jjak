/**
 * The rules of one pair, in one place. The game Session, the solver and bots in
 * the Level Director, and the animated demo boards all step through here, so a
 * mechanic behaves the same everywhere it is simulated.
 */
import { type Board, EMPTY, isCard, isGate, gateMonth, monthOf } from './board';
import { type Wind, applyGravity, findMove } from './moves';

/** Everything that changes during play besides score: the cells and the locks. */
export interface PlayState {
  board: Board;
  /** cells whose card is still under snow (can't be picked, still blocks paths) */
  hidden: Set<number>;
  /** cells whose card is still tied with a cord (매듭) */
  knots: Set<number>;
}

export interface StepResult {
  /** sliding moves (falling leaves / wind), [fromCell, toCell] */
  moved: [number, number][];
  /** gate cells opened by this pair (now empty, before any slide) */
  opened: number[];
  /** snow-covered cells uncovered by this pair */
  revealed: number[];
  /** knotted cells untied by this pair (cell numbers after any slide) */
  untied: number[];
}

/** Cells that can't be picked right now (under snow or tied). */
export function lockedOf(st: PlayState): Set<number> {
  if (!st.knots.size) return st.hidden;
  if (!st.hidden.size) return st.knots;
  return new Set([...st.hidden, ...st.knots]);
}

/** A cell is open once it touches an empty cell or sits on the board edge. */
export function isOpen(b: Board, i: number): boolean {
  const { rows, cols, cells } = b;
  const r = Math.floor(i / cols);
  const c = i % cols;
  return (
    r === 0 || c === 0 || r === rows - 1 || c === cols - 1 ||
    cells[i - 1] === EMPTY || cells[i + 1] === EMPTY || cells[i - cols] === EMPTY || cells[i + cols] === EMPTY
  );
}

/**
 * Clear the pair (a, b), which the caller has already checked is legal, and let
 * the board react: gates of that flower open, cards slide with the wind, and
 * snow and knots next to new space let go. Mutates `st`.
 */
export function applyPair(st: PlayState, a: number, b: number, wind: Wind | null): StepResult {
  const cells = st.board.cells;
  const month = monthOf(cells[a]);
  cells[a] = EMPTY;
  cells[b] = EMPTY;
  const opened: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (isGate(cells[i]) && gateMonth(cells[i]) === month) {
      cells[i] = EMPTY;
      opened.push(i);
    }
  }
  let moved: [number, number][] = [];
  if (wind) {
    moved = applyGravity(st.board, wind);
    // Snow and knots travel with their card. Move them all at once: a card may
    // land where another one just left.
    if (moved.length && (st.hidden.size || st.knots.size)) {
      const hid: number[] = [];
      const tied: number[] = [];
      for (const [from, to] of moved) {
        if (st.hidden.delete(from)) hid.push(to);
        if (st.knots.delete(from)) tied.push(to);
      }
      for (const i of hid) st.hidden.add(i);
      for (const i of tied) st.knots.add(i);
    }
  }
  const revealed: number[] = [];
  for (const i of st.hidden) if (isOpen(st.board, i)) revealed.push(i);
  for (const i of revealed) st.hidden.delete(i);
  const untied: number[] = [];
  for (const i of st.knots) if (isOpen(st.board, i)) untied.push(i);
  for (const i of untied) st.knots.delete(i);
  return { moved, opened, revealed, untied };
}

/**
 * The free safety net: when snow or knots are the only reason no pair is
 * possible, release just enough to get going again — knots first (their faces
 * are already known), then snow, then both. Pushes freed cells onto the lists.
 * Returns true if the board still has no move (a reshuffle is needed).
 */
export function releaseIfStuck(st: PlayState, revealed: number[] = [], untied: number[] = []): boolean {
  if (findMove(st.board, lockedOf(st))) return false;
  if (st.hidden.size || st.knots.size) {
    const untieAll = () => {
      untied.push(...st.knots);
      st.knots.clear();
    };
    const meltAll = () => {
      revealed.push(...st.hidden);
      st.hidden.clear();
    };
    if (st.knots.size && findMove(st.board, st.hidden)) untieAll();
    else if (st.hidden.size && findMove(st.board, st.knots)) meltAll();
    else {
      untieAll();
      meltAll();
    }
  }
  return !findMove(st.board);
}

/** Cards still on the board. */
export function cardsOn(b: Board): number {
  let n = 0;
  for (const v of b.cells) if (isCard(v)) n++;
  return n;
}
