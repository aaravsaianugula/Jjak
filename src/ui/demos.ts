/**
 * Every animated intro as data: a tiny board and a few beats, played by the
 * demo player (demo.ts) through the real rules. Keyed by mechanic id, plus the
 * Level 6 "match the flower" rule, one per level goal, and the basics the
 * first-minute intro and How to Play are built from.
 *
 * Grid notation (see demo-model.ts): card ids 0–49 (month = id >> 2), `.` empty,
 * `#` stone, `G<m>` gate of month m; suffix `s` snow, `k` knot, `|` / `_` fence
 * on the right / bottom edge. Cells in steps are row * cols + col.
 */
import { type GoalId } from '../engine/goals';
import { type Mechanic } from '../engine/levels';
import { type Wind } from '../engine/moves';
import { type DemoScript, blocked, cap, mark, orient, pair, tap } from './demo-model';

export type { DemoScript } from './demo-model';

/** The mechanics, keyed by id. Wind is authored blowing right; see windDemo(). */
export const MECHANIC_DEMOS: Record<Mechanic, DemoScript> = {
  stones: {
    id: 'stones',
    grid: ['4 . 4', '8 # 8', '20 20 .'],
    steps: [cap('Stones block'), blocked(3, 5), cap('Go around'), pair(0, 2), pair(3, 5)],
    end: ['. . .', '. # .', '20 20 .'],
  },
  leaves: {
    id: 'leaves',
    wind: 'down',
    grid: ['8 . 20', '12 12 8', '4 20 4'],
    steps: [cap('Cards fall'), pair(3, 4), cap('Pairs line up'), pair(3, 5)],
    end: ['. . .', '. . 20', '4 20 4'],
  },
  snow: {
    id: 'snow',
    grid: ['20 8 8', '21 4s 24', '. 4 24'],
    steps: [cap('Under snow'), tap(4), cap('Clear beside it'), pair(1, 2), cap('It turns over'), pair(4, 7)],
    end: ['20 . .', '21 . 24', '. . 24'],
  },
  lucky: {
    id: 'lucky',
    grid: ['48 4 49', '8 5 8'],
    steps: [cap('Lucky cards'), pair(1, 4), cap('Pair them'), pair(0, 2), pair(3, 5)],
    end: ['. . .', '. . .'],
  },
  knots: {
    id: 'knots',
    grid: ['20 8 8', '21 0k 24', '. 1 24'],
    steps: [cap('Tied up'), tap(4), cap('Clear beside it'), pair(1, 2), cap('Untied'), pair(4, 7)],
    end: ['20 . .', '21 . 24', '. . 24'],
  },
  wind: {
    id: 'wind',
    wind: 'right',
    grid: ['0 4 4 0', '20 8 9 21'],
    steps: [cap('Wind blows'), pair(1, 2), cap('Cards drift'), pair(2, 3)],
    end: ['. . . .', '20 8 9 21'],
  },
  gates: {
    id: 'gates',
    grid: ['8 20 8', '4 G0 4', '0 24 0'],
    steps: [mark(4), cap('A pine gate'), blocked(3, 5), mark(6, 8), cap('Pair the pines'), pair(6, 8), mark(), cap('It opens'), pair(3, 5)],
    turn: [[6, 8], [3, 5]],
    end: ['8 20 8', '. . .', '. 24 .'],
  },
  fences: {
    id: 'fences',
    grid: ['4 4 20', '8| 8 20', '24 24 .'],
    steps: [cap('Fences block'), blocked(3, 4), cap('Go around'), pair(0, 1), pair(3, 4)],
    end: ['. . 20', '.| . 20', '24 24 .'],
  },
};

/** Wind blowing the way this board's wind does (left mirrors, up turns it on its side). */
export const windDemo = (dir: Wind | null): DemoScript =>
  dir === 'left' || dir === 'up' ? orient(MECHANIC_DEMOS.wind, dir) : MECHANIC_DEMOS.wind;

/** Level 6: the four Pine cards look different, but any two of them pair. */
export const VARIANTS_DEMO: DemoScript = {
  id: 'variants',
  grid: ['3 0 7', '1 4 2'],
  steps: [cap('Pine and pine'), pair(0, 1), cap('Any picture'), pair(3, 5), cap('Match the flower'), pair(2, 4)],
  end: ['. . .', '. . .'],
};

/** One per level goal: the goal chip above the board fills from the demo's own play. */
export const GOAL_DEMOS: Record<GoalId, DemoScript> = {
  combo: {
    id: 'goal-combo',
    goal: 'combo',
    grid: ['0 3 5 6', '9 10 12 15'],
    steps: [cap('Quick pairs'), pair(0, 1), pair(2, 3), pair(4, 5), pair(6, 7), cap('×4 rhythm')],
    end: ['. . . .', '. . . .'],
  },
  clean: {
    id: 'goal-clean',
    goal: 'clean',
    grid: ['8 20 21', '28 36 37', '29 . 9'],
    steps: [cap('Look first'), blocked(0, 8), cap('Clear the way'), pair(1, 2), pair(0, 8)],
    turn: [[1, 2], [0, 8]],
    end: ['. . .', '28 36 37', '29 . .'],
  },
  bloom: {
    id: 'goal-bloom',
    goal: 'bloom',
    grid: ['0 3 5 6 20', '9 10 12 15 22'],
    steps: [cap('Keep going'), pair(0, 1), pair(2, 3), pair(5, 6), pair(7, 8), pair(4, 9), cap('Full bloom')],
    end: ['. . . . .', '. . . . .'],
  },
  straight: {
    id: 'goal-straight',
    goal: 'straight',
    grid: ['0 3 5 6', '9 10 12 15'],
    steps: [cap('No bends'), pair(0, 1), pair(4, 5), pair(2, 3), pair(6, 7), cap('Straight lines')],
    end: ['. . . .', '. . . .'],
  },
};

/**
 * The basics, in the order the first-minute intro plays them. `bends` leaves
 * two pairs on the board for the player's very first pair (`turn: 'any'`).
 */
export const BASIC_DEMOS = {
  bends: {
    id: 'bends',
    bends: true,
    grid: ['8 8 20 36', '4 . . 20', '12 4 36 12'],
    steps: [cap('Same flower'), pair(0, 1), cap('One bend'), pair(4, 9), cap('Two bends'), pair(8, 11)],
    turn: 'any',
    end: ['. . 20 36', '. . . 20', '. . 36 .'],
  },
  blocked: {
    id: 'blocked',
    grid: ['8 20 21', '28 36 37', '29 . 9'],
    steps: [cap('Three bends?'), blocked(0, 8), cap('Clear the way'), pair(1, 2), pair(0, 8)],
    turn: [[1, 2], [0, 8]],
    end: ['. . .', '28 36 37', '29 . .'],
  },
  combo: {
    id: 'combo',
    combo: true,
    grid: ['20 21 4', '12 13 5'],
    steps: [cap('Quick pairs'), pair(0, 1), pair(3, 4), pair(2, 5), cap('Combo')],
    end: ['. . .', '. . .'],
  },
  fever: {
    id: 'fever',
    combo: true,
    grid: ['0 3 5 6 20', '9 10 12 15 22'],
    steps: [cap('Quick pairs'), pair(0, 1), pair(2, 3), pair(5, 6), pair(7, 8), pair(4, 9), cap('Full bloom')],
    end: ['. . . . .', '. . . . .'],
  },
} satisfies Record<string, DemoScript>;

/** Every script, for the tests. */
export const ALL_DEMOS: DemoScript[] = [
  ...Object.values(MECHANIC_DEMOS),
  windDemo('left'),
  windDemo('up'),
  VARIANTS_DEMO,
  ...Object.values(GOAL_DEMOS),
  ...Object.values(BASIC_DEMOS),
];
