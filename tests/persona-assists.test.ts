/**
 * No cliff in how assists are read (model.ts `assistNeed`): a player who takes a hint (or
 * a shuffle) on every board they clear anyway is served, and rated, as a smooth function
 * of when the hint comes and how quick the clear is. A step anywhere in that function is
 * the "hint-heavy players sink to the gentlest tier" trap: one second later, or a clear a
 * hair slower, once dropped every persona to the bottom tier (served d 0.55 → 0.21).
 */
import { describe, expect, it } from 'vitest';
import { defaultAnalytics } from '../src/services/save-analytics';
import { PERSONAS, type SimOptions, simulate } from './personas';

const SEEDS = Array.from({ length: 8 }, (_, i) => `assist-${i}`);
const BOARDS = 260;
const WARMUP = 60;
/**
 * The largest change between neighbouring sweep points (2.5 s of hint time, 0.05 × par):
 * about half a tier step. A smooth reading moves served d by a few hundredths per step;
 * the old rule's cliff moved it by 0.35 in one.
 */
const MAX_STEP_D = 0.05;
const MAX_STEP_R = 0.06;

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);

function point(who: string, opts: SimOptions) {
  const runs = SEEDS.map((seed) => simulate(PERSONAS[who], seed, BOARDS, defaultAnalytics(), { freeHints: 1, ...opts }));
  return { d: mean(runs.flatMap((r) => r.slice(WARMUP).map((s) => s.d))), rating: mean(runs.map((r) => r[r.length - 1].rating)) };
}

function largestSteps(points: { d: number; rating: number }[]) {
  let d = 0;
  let rating = 0;
  for (let i = 1; i < points.length; i++) {
    d = Math.max(d, Math.abs(points[i].d - points[i - 1].d));
    rating = Math.max(rating, Math.abs(points[i].rating - points[i - 1].rating));
  }
  return { d, rating };
}

const HINT_MS = Array.from({ length: 11 }, (_, i) => 5000 + 2500 * i);
const PAR_RATIOS = Array.from({ length: 15 }, (_, i) => Math.round((0.9 + 0.05 * i) * 100) / 100);

describe('assists are read without a cliff', () => {
  for (const who of ['expert', 'strong', 'steady']) {
    it(`${who}: served d and rating change smoothly with hint time (5 → 30 s) and pace (0.9 → 1.6 × par)`, () => {
      const sweeps = {
        'hint time': HINT_MS.map((hintMs) => point(who, { hintMs })),
        'pace, early hint': PAR_RATIOS.map((parRatio) => point(who, { hintMs: 5000, parRatio })),
        'pace, shuffle': PAR_RATIOS.map((parRatio) => point(who, { shuffle: true, parRatio })),
      };
      for (const [name, pts] of Object.entries(sweeps)) {
        const step = largestSteps(pts);
        console.log(
          `[assists] ${who.padEnd(6)} ${name.padEnd(16)} d ${pts.map((p) => p.d.toFixed(3)).join(' ')}  rating ${pts.map((p) => p.rating.toFixed(3)).join(' ')}  ` +
            `largest step d ${step.d.toFixed(3)} rating ${step.rating.toFixed(3)}`,
        );
        expect(step.d, `${who} ${name}: served d`).toBeLessThanOrEqual(MAX_STEP_D);
        expect(step.rating, `${who} ${name}: rating`).toBeLessThanOrEqual(MAX_STEP_R);
      }
    });
  }
});

describe('the mastery floor holds a player who leans on help', () => {
  it('a new board is never served below the tier the player has shown it can handle, unless the player is struggling', () => {
    // Late hints on every clean clear pull the flow nudge to its full ease; on a breather
    // the target drops below the rating's lower bound, and only the floor holds the tier.
    let held = 0;
    for (const who of ['steady', 'strong', 'expert'])
      for (const seed of SEEDS.slice(0, 4)) {
        const log = simulate(PERSONAS[who], seed, BOARDS, defaultAnalytics(), { freeHints: 1, hintMs: 30_000 });
        log.forEach((s, i) => {
          if (i === 0 || !['skill', 'stretch', 'breather'].includes(s.reason)) return;
          // smooth steps (one tier from the last board) still apply on top of the floor
          const lowest = Math.min(s.floor, log[i - 1].tier + 1);
          expect(s.tier, `${who} ${seed} board ${i}`).toBeGreaterThanOrEqual(lowest);
          if (s.floor > 0 && s.tier === lowest) held++;
        });
      }
    // the floor is doing work here, not standing idle under every board
    expect(held).toBeGreaterThan(20);
  });
});
