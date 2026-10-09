/**
 * The designed difficulty curve (plan.ts) and the arrangement knob that lets the
 * generator reach its top end through card placement rather than smaller cards.
 */
import { describe, expect, it } from 'vitest';
import { ROUTE_LEVELS } from '../src/data/route';
import { bankEntry } from '../src/director/bank';
import { initialState, proveClear } from '../src/director/bots';
import { measure } from '../src/director/metrics';
import { arrangeOf, designedBase, levelPlan, planSpec, roadBase, tierKnobs } from '../src/director/plan';
import { buildBoard, windOf } from '../src/engine/levels';

const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
const levelsOf = (fromCh: number, toCh: number) => Array.from({ length: (toCh - fromCh) * 12 }, (_, i) => fromCh * 12 + i + 1).filter((n) => !levelPlan(n).fixed);

describe('designed curve', () => {
  it('climbs clearly across the road: about 0.25 in the first five places, 0.65+ in the last five', () => {
    expect(mean(levelsOf(0, 5).map(designedBase))).toBeLessThan(0.3);
    expect(mean(levelsOf(45, 50).map(designedBase))).toBeGreaterThanOrEqual(0.65);
    // Every place's mean sits above the place five before it.
    for (let ch = 5; ch < 50; ch++) expect(mean(levelsOf(ch, ch + 1).map(designedBase))).toBeGreaterThan(mean(levelsOf(ch - 5, ch - 4).map(designedBase)));
  });

  it('has a memorable sawtooth in every chapter: the peak stands clear, the festival below it, open and rest are the dips', () => {
    for (let ch = 1; ch < 50; ch++) {
      const b = Array.from({ length: 12 }, (_, s) => designedBase(ch * 12 + s + 1));
      const others = b.filter((_, s) => s !== 10);
      expect(b[10] - Math.max(...others), `chapter ${ch + 1}`).toBeGreaterThanOrEqual(0.05);
      expect(b[11]).toBeLessThan(b[10]);
      expect(b[11]).toBeGreaterThan(mean(b));
      const sorted = b.slice().sort((x, y) => x - y);
      expect(b[6]).toBeLessThanOrEqual(sorted[1]);
      expect(b[0]).toBeLessThanOrEqual(sorted[1]);
    }
  });

  it('the road never steps down, not even where a new year starts, and leaves room above it', () => {
    let prev = roadBase(1);
    for (let n = 2; n <= 6 * ROUTE_LEVELS; n++) {
      const b = roadBase(n);
      expect(b, `level ${n}`).toBeGreaterThanOrEqual(prev);
      expect(b, `level ${n}`).toBeLessThanOrEqual(0.75);
      prev = b;
    }
  });

  it('Wanderer years carry on from the end of the first pass', () => {
    const lastFive = mean(levelsOf(45, 50).map(designedBase));
    const year1 = mean(Array.from({ length: 120 }, (_, i) => designedBase(ROUTE_LEVELS + 13 + i)));
    expect(year1).toBeGreaterThanOrEqual(lastFive - 0.05);
  });
});

describe('arrangement', () => {
  it('is off on teaching boards, never falls with the tier, and rises along the road', () => {
    for (let n = 1; n <= 6; n++) for (let t = 0; t < 5; t++) expect(arrangeOf(levelPlan(n), t)).toBe(0);
    for (let n = 7; n <= 600; n += 5) {
      const p = levelPlan(n);
      for (let t = 1; t < 5; t++) expect(arrangeOf(p, t)).toBeGreaterThanOrEqual(arrangeOf(p, t - 1));
    }
    const at = (from: number, t: number) => mean(levelsOf(from, from + 5).map((n) => arrangeOf(levelPlan(n), t)));
    expect(at(45, 2)).toBeGreaterThan(at(0, 2) + 0.4);
    expect(at(45, 4)).toBeGreaterThan(0.9);
  });

  it('a tricky arrangement stays solvable by construction and reads harder on the same knobs', () => {
    let plain = 0;
    let tricky = 0;
    let boards = 0;
    for (const n of [130, 205, 290, 380, 455, 530]) {
      const p = levelPlan(n);
      for (let s = 0; s < 3; s++) {
        const base = planSpec(p, tierKnobs(p, 3), `arr-${n}-${s}`, 3);
        const a = { ...base, arrange: undefined };
        const b = { ...base, arrange: 1 };
        const ba = buildBoard(a);
        const bb = buildBoard(b);
        const proof = proveClear(initialState(b, bb), windOf(b), 200000);
        expect(proof.moves, `level ${n} seed ${s}`).not.toBeNull();
        plain += measure(a, ba, { random: 8, human: 4 }).d;
        tricky += measure(b, bb, { random: 8, human: 4 }).d;
        boards++;
      }
    }
    expect(tricky / boards).toBeGreaterThan(plain / boards + 0.05);
  });
});

describe('the bank climbs', () => {
  it('tier 2 rises from about 0.25 to 0.6+ across the road, tier 4 reaches 0.8+ late, by measured d', () => {
    const at = (fromCh: number, toCh: number, t: number) => mean(levelsOf(fromCh, toCh).map((n) => bankEntry(n, t)!.d));
    expect(at(0, 5, 2)).toBeLessThan(0.32);
    expect(at(45, 50, 2)).toBeGreaterThanOrEqual(0.6);
    expect(at(45, 50, 4)).toBeGreaterThanOrEqual(0.8);
  });
});
