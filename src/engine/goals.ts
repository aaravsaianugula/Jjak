/**
 * Level goals: on a goal board, the third blossom is earned by the goal instead
 * of the par time. A goal never fails the level; at worst it costs that blossom.
 * Each goal rewards reading the board well, never a gimmick.
 */

export type GoalId = 'combo' | 'clean' | 'bloom' | 'straight';

/** What a goal needs from a finished (or running) board. */
export interface GoalStats {
  bestCombo: number;
  /** taps on a same-flower card with no legal path (a mis-read) */
  blockedTaps: number;
  feverCount: number;
  /** pairs joined by a straight line (no bends) */
  straightPairs: number;
  pairsMade: number;
}

export interface GoalDef {
  id: GoalId;
  /** short name for chips and the title card */
  name: string;
  native: string;
  /** one line: what earns the blossom */
  text: string;
  met(s: GoalStats, pairs: number): boolean;
  /** progress for the HUD, [have, need] */
  progress(s: GoalStats, pairs: number): [number, number];
}

/** Straight pairs needed: about a quarter of the board, at least 4. */
export const straightNeed = (pairs: number) => Math.max(4, Math.round(pairs / 4));

export const GOALS: Record<GoalId, GoalDef> = {
  combo: {
    id: 'combo',
    name: 'Rhythm',
    native: '장단 · 拍子',
    text: 'Reach a ×4 combo',
    met: (s) => s.bestCombo >= 4,
    progress: (s) => [Math.min(4, s.bestCombo), 4],
  },
  clean: {
    id: 'clean',
    name: 'Clean read',
    native: '눈썰미 · 見極め',
    text: 'Never tap a pair whose path is blocked',
    met: (s) => s.blockedTaps === 0,
    progress: (s) => [s.blockedTaps === 0 ? 1 : 0, 1],
  },
  bloom: {
    id: 'bloom',
    name: 'Full bloom',
    native: '만개 · 満開',
    text: 'Reach full bloom (a ×5 combo)',
    met: (s) => s.feverCount > 0,
    progress: (s) => [Math.min(5, s.bestCombo), 5],
  },
  straight: {
    id: 'straight',
    name: 'Straight brush',
    native: '일필 · 一筆',
    text: 'Join pairs with straight lines',
    met: (s, pairs) => s.straightPairs >= straightNeed(pairs),
    progress: (s, pairs) => [Math.min(straightNeed(pairs), s.straightPairs), straightNeed(pairs)],
  },
};

export const GOAL_IDS = Object.keys(GOALS) as GoalId[];
