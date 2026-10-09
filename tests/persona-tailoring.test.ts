/**
 * Tailored boards are harder for the habit they target (EXPANSION_PLAN §C1, Part 1B).
 *
 * For each habit persona, every bank level and middle tier is served twice: the tier's
 * own board, and the board the persona's challenge picks (tailor.ts). Each board is
 * played out by the persona (personas.ts `traceOf`, a random legal order, independent
 * of the solver line the tailoring features were measured on) and read through that
 * persona's weakness. A neutral persona has no weakness, so for it the change is the
 * change in measured d alone. The tailored board must be clearly harder for the habit
 * persona than for the neutral one, while its measured d stays within the tolerance.
 *
 * The scanners (edge, centre) are measured too: their scan-region requests are served
 * the tier's own board (tailor.ts), because leaning on where key pairs sit showed no
 * effect against these personas, so nothing unproven is served.
 */
import { describe, expect, it } from 'vitest';
import { bankSpec } from '../src/director/bank';
import { type ChallengeRequest, type Emphasis, focusOf } from '../src/director/challenge';
import { levelPlan } from '../src/director/plan';
import { TAILOR, tailoredSpec } from '../src/director/tailor';
import { type Style, traceOf, weakness } from './personas';

type Habit = Exclude<Style, 'hinter'>;
/** the habits tailoring serves, and the scanners whose requests stay plain */
const SERVED: Habit[] = ['bendBlind', 'rusher'];
const TARGET: Record<Habit, Emphasis> = {
  edge: { kind: 'region', region: 'centre' },
  centre: { kind: 'region', region: 'edges' },
  bendBlind: { kind: 'shape', shape: 'twoBend' },
  rusher: { kind: 'decoys' },
};
const HABITS = Object.keys(TARGET) as Habit[];
const LEVELS = Array.from({ length: 200 }, (_, i) => 13 + 3 * i).filter((n) => n <= 600 && !levelPlan(n).fixed);
const TIERS = [1, 2, 3];
const request = (n: number, tier: number, emphasis: Emphasis): ChallengeRequest => {
  const focus = focusOf(emphasis);
  return { n, tier, focus, emphasis, weight: 0.8, rotationKey: `${n}:${tier}:${focus}`, why: 'test' };
};
const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);

interface Effect {
  /** boards where the challenge picked an alternate */
  tailored: number;
  served: number;
  /** measured d change (what a neutral persona feels) */
  dd: number[];
  /** extra effective difficulty for each persona: weakness on the tailored board minus on the tier's own */
  dw: Record<Habit, number[]>;
}

function effectOf(target: Habit): Effect {
  const e: Effect = { tailored: 0, served: 0, dd: [], dw: { edge: [], centre: [], bendBlind: [], rusher: [] } };
  for (const n of LEVELS) {
    for (const t of TIERS) {
      e.served++;
      const plain = bankSpec(n, t);
      const tail = tailoredSpec(n, t, request(n, t, TARGET[target]));
      if (tail.seed === plain.seed && tail.tier === plain.tier) continue;
      e.tailored++;
      e.dd.push((tail.difficulty ?? 0) - (plain.difficulty ?? 0));
      for (const h of HABITS) e.dw[h].push(weakness(h, traceOf(tail)) - weakness(h, traceOf(plain)));
    }
  }
  return e;
}

const EFFECTS = Object.fromEntries(HABITS.map((h) => [h, effectOf(h)])) as Record<Habit, Effect>;

describe('tailored boards are harder for the habit they target', () => {
  it('prints the table', () => {
    for (const target of HABITS) {
      const e = EFFECTS[target];
      console.log(
        `[tailor] ${focusOf(TARGET[target]).padEnd(14)} tailored ${e.tailored}/${e.served}  neutral Δd ${mean(e.dd).toFixed(4)}  ` +
          HABITS.map((h) => `${h} ${(mean(e.dw[h]) + mean(e.dd)).toFixed(4)}`).join('  '),
      );
    }
  });

  for (const target of HABITS.filter((h) => !SERVED.includes(h))) {
    it(`${target}: a scan-region request is served the tier's own board`, () => {
      expect(EFFECTS[target].tailored).toBe(0);
    });
  }

  for (const target of SERVED) {
    it(`${target}: its challenge serves boards harder for it than for a neutral player, at the same measured d`, () => {
      const e = EFFECTS[target];
      // tailoring has something to choose on a share of boards (it needs a clear lean within the d tolerance)
      expect(e.tailored / e.served).toBeGreaterThan(0.1);
      // the neutral player barely notices: d stays inside the tier's tolerance
      for (const d of e.dd) expect(Math.abs(d)).toBeLessThanOrEqual(TAILOR.maxDGap + 1e-9);
      expect(Math.abs(mean(e.dd))).toBeLessThan(0.01);
      // the habit persona does: clearly harder on average, and on most tailored boards
      expect(mean(e.dw[target])).toBeGreaterThan(0.01);
      expect(e.dw[target].filter((x) => x > 0).length / e.dw[target].length).toBeGreaterThan(0.6);
    });
  }
});
