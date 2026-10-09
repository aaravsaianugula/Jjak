/**
 * The rules of one pair, in one place. The game Session, the solver and bots in
 * the Level Director, and the animated demo boards all step through here, so a
 * mechanic behaves the same everywhere it is simulated.
 */
import { type Board, EMPTY, cloneBoard, isCard, isGate, isInk, gateMonth, monthOf } from './board';
import { type Wind, applyGravity, findMove } from './moves';

/**
 * Everything that changes during play besides score: the cells and the locks.
 * Seals and wet ink live on the board itself (`Board.seals`, `Board.ink`).
 */
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
  /** ink blots that dried with this pair (now empty) */
  dried: number[];
}

/** What the safety net let go of besides snow and knots. */
export interface Freed {
  /** ink cells dried early (now empty) */
  dried: number[];
  /** cells whose seal was broken so the order could go on */
  unsealed: number[];
}

export function cloneState(st: PlayState): PlayState {
  return { board: cloneBoard(st.board), hidden: new Set(st.hidden), knots: new Set(st.knots) };
}

/** The lowest seal number still on the board (the one that may go now), or 0 if none. */
export function currentSeal(b: Board): number {
  if (!b.seals) return 0;
  let low = 0;
  for (const x of b.seals) if (x > 0 && (low === 0 || x < low)) low = x;
  return low;
}

/** Sealed cards that must wait: every seal above the current one. */
export function sealWaiting(b: Board): number[] {
  const now = currentSeal(b);
  if (!now) return [];
  const out: number[] = [];
  b.seals!.forEach((x, i) => x > now && out.push(i));
  return out;
}

/** Cells that can't be picked right now (under snow, tied, or sealed behind a lower seal). */
export function lockedOf(st: PlayState): Set<number> {
  const sealed = st.board.seals ? sealWaiting(st.board) : [];
  if (!sealed.length) {
    if (!st.knots.size) return st.hidden;
    if (!st.hidden.size) return st.knots;
  }
  return new Set([...st.hidden, ...st.knots, ...sealed]);
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
 * the board react: their seals go with them, gates of that flower open, every
 * wet blot of ink is a pair closer to dry, cards slide with the wind, and snow
 * and knots next to new space let go. Mutates `st`.
 */
export function applyPair(st: PlayState, a: number, b: number, wind: Wind | null): StepResult {
  const cells = st.board.cells;
  const month = monthOf(cells[a]);
  cells[a] = EMPTY;
  cells[b] = EMPTY;
  const seals = st.board.seals;
  if (seals) {
    seals[a] = 0;
    seals[b] = 0;
    if (!seals.some((x) => x > 0)) delete st.board.seals;
  }
  const opened: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (isGate(cells[i]) && gateMonth(cells[i]) === month) {
      cells[i] = EMPTY;
      opened.push(i);
    }
  }
  const dried: number[] = [];
  const ink = st.board.ink;
  if (ink) {
    for (let i = 0; i < cells.length; i++) {
      if (!isInk(cells[i])) continue;
      ink[i]--;
      if (ink[i] <= 0) {
        ink[i] = 0;
        cells[i] = EMPTY;
        dried.push(i);
      }
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
  return { moved, opened, revealed, untied, dried };
}

/**
 * The free safety net: when snow, knots, the seals' order or wet ink are the
 * only reason no pair is possible, release just enough to get going again.
 * Order and ink go first, since play would lift them anyway: the blot whose
 * drying frees a pair (else the soonest to dry), or the lowest seal, one at a
 * time. Then knots (their faces are already known), then snow, then both.
 * Pushes freed cells onto the lists. Returns true if the board still has no
 * move (a reshuffle is needed); a true dead end keeps its seals and ink.
 */
export function releaseIfStuck(st: PlayState, revealed: number[] = [], untied: number[] = [], freed?: Freed): boolean {
  if (findMove(st.board, lockedOf(st))) return false;
  const out = freed ?? { dried: [], unsealed: [] };
  if (liftOrder(st, out)) return false;
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
  liftOrder(st, out);
  return !findMove(st.board, lockedOf(st));
}

/** Snow and knots as one lock set (the locks liftOrder leaves alone). */
const coverOf = (st: PlayState): ReadonlySet<number> =>
  st.knots.size ? (st.hidden.size ? new Set([...st.hidden, ...st.knots]) : st.knots) : st.hidden;

/** Wet blots, soonest to dry first. */
function wetCells(b: Board): number[] {
  const out: number[] = [];
  if (b.ink) b.cells.forEach((v, i) => isInk(v) && out.push(i));
  return out.sort((x, y) => b.ink![x] - b.ink![y] || x - y);
}

function dry(b: Board, i: number, out: Freed): void {
  b.cells[i] = EMPTY;
  b.ink![i] = 0;
  out.dried.push(i);
}

/**
 * If lifting the seals' order and the wet ink (snow and knots kept) would give
 * a pair, lift as little as it takes and return true; else change nothing.
 */
function liftOrder(st: PlayState, out: Freed): boolean {
  const b = st.board;
  const wet = wetCells(b);
  if (!wet.length && !currentSeal(b)) return false;
  const open = cloneBoard(b);
  for (const i of wet) open.cells[i] = EMPTY;
  if (!findMove(open, coverOf(st))) return false;
  const moving = () => !!findMove(b, lockedOf(st));
  // Ink alone (seals still in force) is enough: dry the blot that frees a pair.
  if (wet.length && findMove(open, lockedOf({ ...st, board: open }))) {
    while (!moving()) {
      const left = wetCells(b);
      if (!left.length) break;
      const frees = left.find((i) => {
        const t = cloneBoard(b);
        t.cells[i] = EMPTY;
        return !!findMove(t, lockedOf({ ...st, board: t }));
      });
      dry(b, frees ?? left[0], out);
    }
    return true;
  }
  // Otherwise break seals from the lowest up, then dry what is still needed.
  while (!moving() && currentSeal(b)) {
    const low = currentSeal(b);
    b.seals!.forEach((x, i) => {
      if (x === low) {
        b.seals![i] = 0;
        out.unsealed.push(i);
      }
    });
    if (!currentSeal(b)) delete b.seals;
  }
  for (const i of wetCells(b)) {
    if (moving()) break;
    dry(b, i, out);
  }
  return true;
}

/** Cards still on the board. */
export function cardsOn(b: Board): number {
  let n = 0;
  for (const v of b.cells) if (isCard(v)) n++;
  return n;
}
