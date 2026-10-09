/**
 * The Practice room's data: which mechanics a player has met, and a few gentle boards
 * for each. Everything comes from the mechanic registry and the Level Director's
 * shipped bank, so a new mechanic shows up here as soon as it is in both.
 *
 * Practice boards are the bank's own tier-0 (gentlest) boards for the first levels that
 * feature the mechanic: built by the Director's search and solver-proven like every
 * bank board. They are played in `practice` mode, which never reaches progression:
 * the event bus drops practice events (src/services/events.ts), so level, stars,
 * petals, the skill model and tier pins never see them, and practice clears are not
 * evidence for the per-mechanic proficiency either (the model stays about real play).
 */
import { type LevelSpec, type Mechanic, journeyLevel } from '../engine/levels';
import { MECHANICS, MECHANIC_IDS } from '../engine/mechanics';
import { BANK_LEVELS, bankSpec } from './bank';

/** Boards offered per mechanic. */
export const PRACTICE_BOARDS = 3;

/** The tier practice boards are built at: the gentlest. */
const PRACTICE_TIER = 0;

const firstLevels = new Map<Mechanic, number>();

/** The first Journey level whose board features this mechanic (its identity, the same for everyone). */
export function firstLevelWith(m: Mechanic): number {
  let first = firstLevels.get(m);
  if (first === undefined) {
    first = 0;
    for (let n = 1; n <= BANK_LEVELS && !first; n++) if (MECHANICS[m].on(journeyLevel(n))) first = n;
    firstLevels.set(m, first);
  }
  return first;
}

/**
 * The mechanics this player has met, in library order: its intro was seen, or the
 * first board with it is behind them (`level` is the next Journey level to play).
 * Mechanics still ahead stay hidden, so the room never spoils a later idea.
 */
export function metMechanics(introSeen: (m: Mechanic) => boolean, level: number): Mechanic[] {
  return MECHANIC_IDS.filter((m) => {
    if (introSeen(m)) return true;
    const first = firstLevelWith(m);
    return first > 0 && level > first;
  });
}

const boards = new Map<Mechanic, LevelSpec[]>();

/**
 * A few gentle boards for this mechanic, in road order: the bank's tier-0 boards of
 * the first levels that feature it (the road brings ideas in order, so nothing on them
 * is newer than this one: tests/practice.test.ts checks it). No goal and no
 * festival dressing (practice has no blossoms); numbered 1…PRACTICE_BOARDS.
 */
export function practiceBoards(m: Mechanic): LevelSpec[] {
  const cached = boards.get(m);
  if (cached) return cached.map((s) => ({ ...s }));
  const out: LevelSpec[] = [];
  for (let n = 1; n <= BANK_LEVELS && out.length < PRACTICE_BOARDS; n++) {
    const spec = bankSpec(n, PRACTICE_TIER);
    if (!MECHANICS[m].on(spec)) continue;
    const board: LevelSpec = { ...spec, mode: 'practice', number: out.length + 1, practice: m };
    delete board.goal;
    delete board.festival;
    out.push(board);
  }
  boards.set(m, out);
  return out.map((s) => ({ ...s }));
}
