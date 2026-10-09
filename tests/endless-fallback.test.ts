/**
 * The endless road's last resort: whatever happens to the search, the board served
 * is proven clearable by the solver through the real rules.
 */
import { describe, expect, it } from 'vitest';
import { ROUTE_LEVELS } from '../src/data/route';
import { initialState, proveClear } from '../src/director/bots';
import { provenFallback } from '../src/director/endless-fallback';
import { playLevel } from '../src/director/index';
import { levelPlan } from '../src/director/plan';
import { type LevelSpec, buildBoard, windOf } from '../src/engine/levels';

/** An independent proof with a generous budget. */
const proven = (spec: LevelSpec) => !!proveClear(initialState(spec, buildBoard(spec)), windOf(spec), 60_000).moves;
const SAMPLE = Array.from({ length: 30 }, (_, i) => ROUTE_LEVELS + 1 + i * 41);

describe('endless fallback', () => {
  it("serves the bank's board for the same place, numbered as the endless level, and it is solver-proven", () => {
    for (const n of SAMPLE) {
      const tier = n % 5;
      const spec = provenFallback(n, tier);
      expect(spec.number, `level ${n}`).toBe(n);
      expect(spec.mode).toBe('journey');
      expect(proven(spec), `level ${n} tier ${tier}`).toBe(true);
      const first = levelPlan(((n - 1) % ROUTE_LEVELS) + 1);
      if (!first.fixed) {
        expect(spec.seed.startsWith(`journey-${first.n}-t`), `level ${n}`).toBe(true);
        expect(levelPlan(n).place).toEqual(first.place);
      }
    }
  });

  it('never falls back to a fixed teaching board', () => {
    for (let n = ROUTE_LEVELS + 1; n <= ROUTE_LEVELS + 12; n++) {
      const spec = provenFallback(n, 2);
      const m = Number(/^journey-(\d+)-t/.exec(spec.seed)![1]);
      expect(levelPlan(m).fixed, `level ${n}`).toBe(false);
    }
  });

  it('an endless level played before its board was made is still a proven board', () => {
    for (const n of SAMPLE.slice(0, 6)) {
      const spec = playLevel(n);
      expect(spec.number).toBe(n);
      expect(proven(spec), `level ${n}`).toBe(true);
    }
  });
});
