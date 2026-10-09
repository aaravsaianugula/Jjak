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
  const settled = runs.flatMap((r) => r.slice(WARMUP));
  return {
    d: mean(settled.map((s) => s.d)),
    rating: mean(runs.map((r) => r[r.length - 1].rating)),
    tier0: mean(settled.map((s) => Number(s.tier === 0))),
    // the road still rises under it: the last 60 boards against the first 60 settled ones
    climb: mean(runs.map((r) => mean(r.slice(-60).map((s) => s.d)) - mean(r.slice(WARMUP, WARMUP + 60).map((s) => s.d)))),
  };
}

const show = (pts: { d: number; tier0: number }[]) => `d ${pts.map((p) => p.d.toFixed(3)).join(' ')}  tier-0 ${pts.map((p) => p.tier0.toFixed(2)).join(' ')}`;

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

const SWEPT = ['expert', 'strong', 'steady', 'weak'];

describe('assists are read without a cliff', () => {
  for (const who of SWEPT) {
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

/**
 * How many assists, and hints long after the start: a skilled player who leans on several
 * hints (or shuffles) on every board, or hints only after a long look, is eased (served d
 * never rises with the count) but is not pinned to the gentlest tier and still climbs
 * with the road. Neighbouring counts give neighbouring served d.
 */
describe('assist count and late hints are read without a cliff', () => {
  const HINTS = [1, 2, 3, 4, 5, 6];
  const SHUFFLES = [1, 2, 3];
  const LATE_MS = [30_000, 45_000, 60_000, 90_000, 120_000];
  /**
   * The tier-0 share that reads as pinned. The expert and strong players never sit there
   * unassisted. The steady player sits on the boundary between tiers 0 and 1 (tier-0 share
   * about 0.3 unassisted), so easing it by half a tier step moves most of its boards onto
   * tier 0; pinned is nearly all of them (it was 0.86–1.00 with the count cliff).
   */
  const PINNED: Record<string, number> = { expert: 0.25, strong: 0.25, steady: 0.8 };
  /** a little room for run-to-run scatter when checking that more assists never serve harder boards */
  const SCATTER = 0.006;

  for (const who of SWEPT) {
    it(`${who}: 1–6 hints, 1–3 shuffles and a first hint at 30–120 s ease smoothly and never pin`, () => {
      const sweeps = {
        'early hints 1–6': HINTS.map((count) => point(who, { hintMs: 5000, count })),
        'hints 1–6 at 30 s': HINTS.map((count) => point(who, { hintMs: 30_000, count })),
        'shuffles 1–3': SHUFFLES.map((count) => point(who, { shuffle: true, count })),
        'one hint 30–120 s': LATE_MS.map((hintMs) => point(who, { hintMs })),
        'two hints 30–120 s': LATE_MS.map((hintMs) => point(who, { hintMs, count: 2 })),
      };
      for (const [name, pts] of Object.entries(sweeps))
        console.log(`[assists] ${who.padEnd(6)} ${name.padEnd(18)} ${show(pts)}  climb ${pts.map((p) => p.climb.toFixed(2)).join(' ')}  largest step d ${largestSteps(pts).d.toFixed(3)}`);
      for (const [name, pts] of Object.entries(sweeps)) {
        const step = largestSteps(pts);
        expect(step.d, `${who} ${name}: served d`).toBeLessThanOrEqual(MAX_STEP_D);
        for (let i = 1; i < pts.length; i++) expect(pts[i].d, `${who} ${name}: more help, harder boards`).toBeLessThanOrEqual(pts[i - 1].d + SCATTER);
        if (who !== 'weak') {
          // the weak player lives on the gentlest tier with no help at all (model.test.ts)
          for (const p of pts) expect(p.tier0, `${who} ${name}: pinned to tier 0`).toBeLessThan(PINNED[who]);
          for (const p of pts) expect(p.climb, `${who} ${name}: stopped climbing`).toBeGreaterThan(0.05);
        }
      }
    });
  }
});
