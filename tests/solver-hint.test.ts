/**
 * The generator's placement order as the solver's fallback line: a board built pair
 * by pair clears in reverse placement order when nothing slides. The solver only ever
 * accepts the hint after replaying it through the real rules. And the naive dead-end
 * rate, measured on its own, lets the endless search reject a board before solving it.
 */
import { describe, expect, it } from 'vitest';
import { type Move, initialState, proveClear } from '../src/director/bots';
import { measure, naivePlay } from '../src/director/metrics';
import { deadEndsOk, validate } from '../src/director/validate';
import { levelPlan, planSpec, tierKnobs } from '../src/director/plan';
import { placementOrder } from '../src/engine/generate';
import { buildBoard, windOf } from '../src/engine/levels';

const STATIC = Array.from({ length: 40 }, (_, i) => 31 + i * 13)
  .map((n) => levelPlan(n))
  .filter((p) => !p.fixed && !p.wind && !p.spec.snow && !p.spec.knots);

describe('solver hint from the placement order', () => {
  it('reversed, it clears every static board through the real rules, with no search at all', () => {
    expect(STATIC.length).toBeGreaterThan(10);
    for (const p of STATIC) {
      const spec = planSpec(p, tierKnobs(p, 4), `hint-${p.n}`, 4);
      const board = buildBoard(spec);
      const order = placementOrder(board);
      expect(order, `level ${p.n}`).toBeDefined();
      const proof = proveClear(initialState(spec, board), windOf(spec), 0, order!.slice().reverse());
      expect(proof.moves, `level ${p.n}`).not.toBeNull();
      expect(proof.exhausted).toBe(false);
    }
  });

  it('a hint that breaks the rules is never accepted', () => {
    const p = STATIC[0];
    const spec = planSpec(p, tierKnobs(p, 2), `hint-${p.n}`, 2);
    const board = buildBoard(spec);
    const order = placementOrder(board)!.slice().reverse();
    // Swap the last two pairs' partners: every move is a real card, but the line breaks the rules.
    const garbage: Move[] = order.map((m) => [m[0], m[1]] as Move);
    const k = garbage.length - 2;
    [garbage[k][1], garbage[k + 1][1]] = [garbage[k + 1][1], garbage[k][1]];
    expect(proveClear(initialState(spec, board), windOf(spec), 0, garbage).moves).toBeNull();
  });
});

describe('naive play measured once', () => {
  it('the dead-end rate measured on its own is the one measure reports, and handing it in changes nothing', () => {
    for (const p of STATIC.slice(0, 4)) {
      const spec = planSpec(p, tierKnobs(p, 3), `naive-${p.n}`, 3);
      const board = buildBoard(spec);
      const opts = { random: 6, human: 3, budget: 800 };
      const naive = naivePlay(initialState(spec, board), windOf(spec), spec.seed, opts.random);
      const full = measure(spec, board, opts);
      expect(naive.deadEnd).toBe(full.deadEnd);
      expect(naive.greedyStuck).toBe(full.greedyStuck);
      expect(measure(spec, board, { ...opts, naive })).toEqual(full);
    }
  });

  it('the dead-end gate alone gives the same verdict the validators give', () => {
    for (const p of STATIC.slice(0, 6)) {
      for (const tier of [0, 4]) {
        const spec = planSpec(p, tierKnobs(p, 4), `gate-${p.n}`, tier);
        const board = buildBoard(spec);
        const m = measure(spec, board, { random: 6, human: 2, budget: 800 });
        const v = validate(spec, board, m, { tier, plan: p, skipRebuild: true });
        expect(deadEndsOk(spec, tier, m.deadEnd, p), `level ${p.n} tier ${tier}`).toBe(!v.reasons.includes('dead-ends'));
      }
    }
  });

  it('boards that slide get the extra dead-end room; boards that stay put do not', () => {
    const p = STATIC[0];
    const still = planSpec(p, tierKnobs(p, 0), 'room', 0);
    const windy = { ...still, gravity: 'right' as const };
    expect(deadEndsOk(still, 0, 0.4)).toBe(false);
    expect(deadEndsOk(windy, 0, 0.4)).toBe(true);
    expect(deadEndsOk(windy, 0, 0.5)).toBe(false);
    expect(deadEndsOk(still, 0, 0.9, { fixed: true })).toBe(true);
  });
});
