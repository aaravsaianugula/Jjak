/**
 * The 1,000-level endless fuzz, split over four files so it runs in parallel
 * (tests/endless-fuzz-{a,b,c,d}.test.ts call `fuzz` on a quarter each).
 */
import { expect, it } from 'vitest';
import { feelOfSpec, sameStructure } from '../src/director/endless-core';
import { initialState, proveClear } from '../src/director/bots';
import { placementOrder } from '../src/engine/generate';
import { MAX_COLS, MAX_ROWS, PARTNERS, levelPlan } from '../src/director/plan';
import { featureOf } from '../src/director/search';
import { boardHash } from '../src/director/validate';
import { GOAL_IDS } from '../src/engine/goals';
import { buildBoard, windOf } from '../src/engine/levels';
import { mechanicsOf } from '../src/engine/mechanics';
import { road } from './endless-helpers';

export function fuzz(from: number, count: number): void {
  it(`levels ${from}–${from + count - 1}: always a solvable board, fresh within 12, never the same feel twice in a row`, () => {
    const t0 = Date.now();
    const gens = road(from, count);
    const feats = gens.map((g) => featureOf(g.spec, g.spec.difficulty ?? 0.5));
    let fallbacks = 0;
    let notFresh = 0;
    const seenMech = new Map<string, number[]>();
    const seenGoal = new Map<string, number[]>();
    gens.forEach((g, i) => {
      const { spec, n } = g;
      if (!g.result) fallbacks++;
      else if (!g.result.fresh) notFresh++;
      expect(spec.rows, `level ${n}`).toBeLessThanOrEqual(MAX_ROWS);
      expect(spec.cols, `level ${n}`).toBeLessThanOrEqual(MAX_COLS);
      // Never unsolvable: the solver proves a clear with no reshuffle, and a rebuild is the same board.
      const board = buildBoard(spec);
      // The generator's placement order, reversed, is a line the solver may fall back on (it replays it through the rules).
      const proof = proveClear(initialState(spec, board), windOf(spec), 20_000, placementOrder(board)?.slice().reverse());
      expect(proof.moves, `level ${n} unsolvable`).not.toBeNull();
      expect(boardHash(spec, buildBoard(JSON.parse(JSON.stringify(spec)))), `level ${n} rebuild`).toBe(boardHash(spec, board));
      // The identity's anchors: the festival every 12th level, the place's idea on the board.
      expect(!!spec.festival, `level ${n} festival`).toBe(n % 12 === 0);
      const on = mechanicsOf(spec);
      for (const m of g.plan.mechanics) expect(on, `level ${n} keeps ${m}`).toContain(m);
      const base = levelPlan(n);
      for (const m of base.mechanics) if (m === base.place.focus || m === 'stones') expect(on, `level ${n} keeps the place's ${m}`).toContain(m);
      for (const m of on) (seenMech.get(m) ?? seenMech.set(m, []).get(m)!).push(n);
      if (spec.goal) (seenGoal.get(spec.goal) ?? seenGoal.set(spec.goal, []).get(spec.goal)!).push(n);
      // Freshness: no repeated structure within the last 12, never the same feel twice in a row.
      for (let j = Math.max(0, i - 12); j < i; j++) expect(sameStructure(feats[i], feats[j]), `level ${n} repeats level ${gens[j].n}`).toBe(false);
      if (i > 0) expect(feelOfSpec(spec), `level ${n} feels like ${n - 1}`).not.toBe(feelOfSpec(gens[i - 1].spec));
    });
    // Variety: every partner mechanic and every goal keeps coming round.
    for (const m of PARTNERS) expect(seenMech.get(m)?.length ?? 0, `${m} appears`).toBeGreaterThan(count / 30);
    for (const g of GOAL_IDS) expect(seenGoal.get(g)?.length ?? 0, `goal ${g} appears`).toBeGreaterThan(count / 60);
    // The plan's own board (the last resort) is rare.
    expect(fallbacks).toBeLessThanOrEqual(Math.ceil(count * 0.01));
    console.log(`[endless fuzz] ${from}–${from + count - 1}: ${count} levels, ${fallbacks} plan fallbacks, ${notFresh} stale, ${((Date.now() - t0) / count).toFixed(0)} ms/level`);
  });
}
