/**
 * The richer player model (EXPANSION_PLAN §C1): path-shape and mechanic ratings with
 * confidence, flow states from think time and pair rhythm, typed habits, habit-aware
 * assists (the tier-0 trap), the calm guardrails and the ChallengeRequest rotation.
 */
import { describe, expect, it } from 'vitest';
import { type ChallengeRequest, DIRECTOR, cleanRate, decide, masteryFloor, targetFor, tierD } from '../src/director/director';
import { emphasisOf, familyOf, focusOf, pinnedChallenge } from '../src/director/challenge';
import { flowState } from '../src/director/flow';
import { MODEL, cleanCredit, expected, ingest, performance, struggleOf } from '../src/director/model';
import { designedBase, levelPlan } from '../src/director/plan';
import { playerHabits } from '../src/director/profile';
import { SKILL, shapeOfPath, skillConfidence } from '../src/director/skills';
import { type AnalyticsSave, type BoardRecord, EMPHASES_CAP, defaultAnalytics, hydrateAnalytics, hydrateRecord } from '../src/services/save-analytics';

const rec = (o: Partial<BoardRecord> = {}): BoardRecord => ({
  mode: 'journey', n: 40, tier: 2, d: designedBase(40), mech: [], ms: 80_000, par: 90, pairs: 24, made: 24, cleared: true, ended: 'clear',
  stars: 3, firstMs: 3000, gapMs: 2500, blocked: 1, reselects: 1, hints: 0, shuffles: 0, autoShuffles: 0, bestCombo: 3, fever: 0,
  turns: [8, 10, 6], turnMs: [2400, 2500, 2600], firstTaps: [[0.4, 0.5], [0.6, 0.4], [0.5, 0.5]], hintAfterMs: -1, date: '2026-10-07', hour: 20,
  detour: [3, 2600], edgeRoute: [4, 2500], gapCv: 0.45, longMs: 6000, quickMisses: 0, ...o,
});
const quit = (o: Partial<BoardRecord> = {}) => rec({ cleared: false, ended: 'quit', made: 10, stars: 0, ms: 50_000, ...o });

/** A history of `count` boards built from one template, ingested oldest first. */
function history(o: Partial<BoardRecord>, count = 20, a: AnalyticsSave = defaultAnalytics()): AnalyticsSave {
  for (let i = 0; i < count; i++) ingest(a, rec({ n: 30 + i, d: designedBase(30 + i), ...o }));
  return a;
}

/** A level n whose plan role is `role` (after the teaching levels). */
const levelWithRole = (role: string, from = 13) => {
  for (let n = from; n < 600; n++) if (levelPlan(n).role === role) return n;
  throw new Error(role);
};

describe('path shapes', () => {
  it('classifies bends, detours and routes around the rim', () => {
    // 6 rows × 5 cols; corners as findPath returns them (outer margin = -1 / rows / cols)
    expect(shapeOfPath([{ r: 2, c: 0 }, { r: 2, c: 3 }], 6, 5)).toEqual({ bends: 0, detour: false, edge: false });
    expect(shapeOfPath([{ r: 1, c: 1 }, { r: 1, c: 3 }, { r: 4, c: 3 }], 6, 5)).toEqual({ bends: 1, detour: false, edge: false });
    // a U: out to row 4 and back up — longer than the straight-line distance
    expect(shapeOfPath([{ r: 1, c: 1 }, { r: 4, c: 1 }, { r: 4, c: 3 }, { r: 1, c: 3 }], 6, 5)).toEqual({ bends: 2, detour: true, edge: false });
    // around the top rim
    expect(shapeOfPath([{ r: 0, c: 1 }, { r: -1, c: 1 }, { r: -1, c: 4 }, { r: 0, c: 4 }], 6, 5)).toEqual({ bends: 2, detour: true, edge: true });
    // a Z with no wasted steps is two bends but not a detour
    expect(shapeOfPath([{ r: 0, c: 0 }, { r: 2, c: 0 }, { r: 2, c: 3 }, { r: 5, c: 3 }], 6, 5).detour).toBe(false);
  });
});

describe('save shape', () => {
  it('old records and saves load with safe defaults for the new fields', () => {
    const { detour, edgeRoute, gapCv, longMs, quickMisses, ...old } = rec();
    void [detour, edgeRoute, gapCv, longMs, quickMisses];
    const r = hydrateRecord(old)!;
    expect(r.detour).toEqual([0, 0]);
    expect(r.edgeRoute).toEqual([0, 0]);
    expect(r.gapCv).toBe(-1);
    expect(r.longMs).toBe(0);
    expect(r.quickMisses).toBe(0);
    const bad = hydrateRecord({ ...old, detour: [2, 'x'], edgeRoute: 'no', gapCv: NaN, longMs: -5, quickMisses: 3 })!;
    expect(bad.detour).toEqual([2, 0]);
    expect(bad.edgeRoute).toEqual([0, 0]);
    expect(bad.gapCv).toBe(-1);
    expect(bad.longMs).toBe(0);
    expect(bad.quickMisses).toBe(3);

    const a = hydrateAnalytics({ rating: 0.4, mech: { wind: { n: 3, score: 0.6, quits: 1, replays: 0 } } });
    expect(a.shapes).toEqual({});
    expect(a.emphases).toEqual([]);
    expect(hydrateAnalytics({ foci: 'a5'.repeat(5000) }).foci.length).toBe(1200);
    expect(a.mech.wind.r).toBeCloseTo(0.4);
    expect(a.mech.wind.dev).toBe(SKILL.devStart);
    const b = hydrateAnalytics({
      shapes: { twoBend: { r: 0.3, dev: 0.1, n: 4 }, bogus: { r: 1 }, oneBend: 'x' },
      emphases: [{ n: 9, focus: 'shape:twoBend' }, { n: 'x' }, ...Array.from({ length: 20 }, (_, i) => ({ n: i, focus: 'none' }))],
    });
    expect(b.shapes).toEqual({ twoBend: { r: 0.3, dev: 0.1, n: 4 } });
    expect(b.emphases[0]).toEqual({ n: 9, focus: 'shape:twoBend', w: 0 });
    expect(b.emphases.length).toBe(EMPHASES_CAP);
  });
});

describe('skill ratings by path shape and mechanic', () => {
  it('a reader slow on 2-bend paths gets a low 2-bend rating; confidence grows with evidence', () => {
    const a = history({ turnMs: [1800, 2200, 7000], gapMs: 2300 }, 4);
    const early = skillConfidence(a.shapes.twoBend!);
    history({ turnMs: [1800, 2200, 7000], gapMs: 2300 }, 20, a);
    const s = a.shapes;
    expect(s.twoBend!.r).toBeLessThan(s.straight!.r - 0.05);
    expect(s.twoBend!.r).toBeLessThan(s.oneBend!.r - 0.03);
    expect(skillConfidence(s.twoBend!)).toBeGreaterThan(early);
    // an even reader: shapes stay close to each other
    const even = history({}, 24);
    expect(Math.abs(even.shapes.twoBend!.r - even.shapes.straight!.r)).toBeLessThan(0.04);
  });

  it('detours and rim routes are rated from their own find times', () => {
    const a = history({ detour: [4, 8000], edgeRoute: [5, 2000], gapMs: 2400 }, 20);
    expect(a.shapes.detour!.r).toBeLessThan(a.shapes.edge!.r - 0.05);
  });

  it('mechanic ratings follow results on boards with that mechanic', () => {
    const a = defaultAnalytics();
    for (let i = 0; i < 12; i++) {
      ingest(a, rec({ n: 50 + 2 * i, d: designedBase(50), mech: ['snow'] }));
      ingest(a, quit({ n: 51 + 2 * i, d: designedBase(50), mech: ['wind'] }));
    }
    expect(a.mech.wind.r).toBeLessThan(a.mech.snow.r - 0.05);
    expect(a.mech.wind.dev).toBeLessThan(SKILL.devStart);
  });

  it('time away makes every skill less sure', () => {
    const a = history({ mech: ['snow'] }, 30);
    const before = a.shapes.twoBend!.dev;
    const mBefore = a.mech.snow.dev;
    // 70 days away, then one board: the growth outweighs that board's shrink
    ingest(a, rec({ date: '2026-12-16', mech: ['snow'] }));
    expect(a.shapes.twoBend!.dev).toBeGreaterThan(before);
    expect(a.mech.snow.dev).toBeGreaterThan(mBefore);
  });
});

describe('flow state from think time, pair rhythm and assists', () => {
  const norm = () => history({ firstMs: 3000, gapMs: 2500, gapCv: 0.5, longMs: 7000, ms: 95_000 }, 10);

  it('reads a normal stretch as flow', () => {
    expect(flowState(norm()).state).toBe('flow');
  });

  it('reads quick, clean, even clears in a row as bored', () => {
    const a = norm();
    for (let i = 0; i < 4; i++) ingest(a, rec({ ms: 55_000, blocked: 0, gapMs: 1800, gapCv: 0.25 }));
    expect(flowState(a).state).toBe('bored');
  });

  it('reads quits and extra assists as struggling', () => {
    const a = norm();
    ingest(a, quit());
    ingest(a, rec({ hints: 2, ms: 160_000 }));
    expect(flowState(a).state).toBe('struggling');
  });

  it('reads long silences before and between pairs as frozen', () => {
    const a = norm();
    for (let i = 0; i < 2; i++) ingest(a, rec({ firstMs: 24_000, longMs: 40_000, gapCv: 1.4, ms: 120_000 }));
    expect(flowState(a).state).toBe('frozen');
  });

  it('reads fast taps with many quick misreads as rushing', () => {
    const a = norm();
    for (let i = 0; i < 3; i++) ingest(a, rec({ gapMs: 1200, blocked: 9, quickMisses: 8, ms: 60_000 }));
    expect(flowState(a).state).toBe('rushing');
  });

  it('a habitual hinter using their usual hint is not struggling', () => {
    const a = history({ hints: 1, hintAfterMs: 4000, ms: 70_000 }, 12);
    expect(flowState(a).state).not.toBe('struggling');
  });
});

describe('habits', () => {
  it('is unknown with thin evidence', () => {
    const h = playerHabits(defaultAnalytics());
    expect(h.scan.start).toBe('unknown');
    expect(h.scan.vertical).toBe('unknown');
    expect(h.tempo.style).toBe('unknown');
    expect(h.slowShapes).toEqual([]);
    expect(h.weakMechanics).toEqual([]);
    expect(h.scan.confidence).toBe(0);
  });

  it('reads scan region, slow shapes, weak mechanics and tempo', () => {
    const edge = playerHabits(history({ firstTaps: [[0, 0.4], [1, 0.6], [0.5, 0]] }, 12));
    expect(edge.scan.start).toBe('edges');
    expect(edge.scan.edge).toBeGreaterThan(0.9);
    expect(edge.scan.confidence).toBeGreaterThan(0.5);
    const centre = playerHabits(history({ firstTaps: [[0.4, 0.5], [0.6, 0.4], [0.5, 0.6]] }, 12));
    expect(centre.scan.start).toBe('centre');
    expect(centre.scan.centre).toBeGreaterThan(0.9);
    const top = playerHabits(history({ firstTaps: [[0, 0.4], [0.2, 0.6], [0.1, 0.5]] }, 12));
    expect(top.scan.vertical).toBe('top');

    const bend = playerHabits(history({ turnMs: [1800, 2200, 7000], gapMs: 2300 }, 20));
    expect(bend.slowShapes[0].shape).toBe('twoBend');
    expect(bend.slowShapes[0].costRatio).toBeGreaterThan(2);
    expect(bend.slowShapes.map((s) => s.shape)).not.toContain('straight');

    const a = defaultAnalytics();
    for (let i = 0; i < 12; i++) {
      ingest(a, rec({ n: 50 + 2 * i, d: designedBase(50), mech: ['snow'] }));
      ingest(a, quit({ n: 51 + 2 * i, d: designedBase(50), mech: ['wind'] }));
    }
    expect(playerHabits(a).weakMechanics[0].id).toBe('wind');

    const rush = playerHabits(history({ gapMs: 1200, blocked: 8, quickMisses: 7 }, 10));
    expect(rush.tempo.style).toBe('rush');
    const freeze = playerHabits(history({ firstMs: 20_000, longMs: 35_000, gapMs: 4000 }, 10));
    expect(freeze.tempo.style).toBe('freeze');
    expect(playerHabits(history({}, 10)).tempo.style).toBe('balanced');
  });
});

describe('assisted clears still count as progress (the tier-0 trap)', () => {
  it('a habitual hint on a board at their level barely moves the rating; extra assists still do', () => {
    const hinter = history({ hints: 1, hintAfterMs: 4000, ms: 70_000 }, 20);
    const before = hinter.rating;
    ingest(hinter, rec({ n: 60, d: before, hints: 1, hintAfterMs: 4000, ms: 75_000 }));
    expect(Math.abs(hinter.rating - before)).toBeLessThan(0.01);
    const r2 = hinter.rating;
    ingest(hinter, rec({ n: 61, d: r2, hints: 3, shuffles: 1, ms: 150_000 }));
    expect(hinter.rating).toBeLessThan(r2 - 0.002);
  });

  it('partial credit: an assisted clear scores between a quit and a clean clear, scaled by assists', () => {
    const slow = { ms: 140_000 }; // over 1.5 × par: assists cost their full price
    const clean = performance(rec(slow));
    const one = performance(rec({ ...slow, hints: 1 }));
    const two = performance(rec({ ...slow, hints: 2 }));
    const q = performance(quit());
    expect(clean).toBeGreaterThan(one);
    expect(one).toBeGreaterThan(two);
    expect(two).toBeGreaterThan(q + 0.2);
    // a light assist (one early hint on a quick clear) costs a little; on a slow clear, in full
    const light = performance(rec({ hints: 1, hintAfterMs: 3000 }));
    expect(light).toBeCloseTo(performance(rec()) - 0.27 * MODEL.lightCost, 6);
    expect(clean - one).toBeCloseTo(0.27 * 0.5, 6);
    // a second hint costs more, however quick, and a hint after a long search more than an early one
    expect(performance(rec({ hints: 2, hintAfterMs: 3000 }))).toBeLessThan(light - 0.02);
    // a hint at 40 s or later on a quick clear: need = cap · (1 − e^(−lateNeed / cap)), about 0.11
    const lateNeed = MODEL.quickNeedMax * (1 - Math.exp(-MODEL.lateNeed / MODEL.quickNeedMax));
    expect(performance(rec({ hints: 1, hintAfterMs: 40_000 }))).toBeCloseTo(performance(rec()) - 0.27 * (MODEL.lightCost + (0.5 - MODEL.lightCost) * lateNeed), 9);
    expect(performance(rec({ hints: 1, hintAfterMs: 120_000 }))).toBeCloseTo(performance(rec({ hints: 1, hintAfterMs: 40_000 })), 9);
    // on a slow clear (1.5 × par and over) any assist costs its full price: a hint 0.5, a shuffle 0.6
    const slowest = { ms: 1.5 * 90_000 };
    expect(performance(rec({ ...slowest, hints: 1, hintAfterMs: 3000 }))).toBeCloseTo(performance(rec(slowest)) - 0.27 * 0.5, 6);
    expect(performance(rec({ ...slowest, shuffles: 1 }))).toBeCloseTo(performance(rec(slowest)) - 0.27 * 0.6, 6);
    // shuffles get the same treatment: one on a quick clear is light
    expect(performance(rec({ shuffles: 1 }))).toBeCloseTo(performance(rec()) - 0.27 * MODEL.lightCost, 6);
  });

  it('no cliff: the score and the clean credit fall smoothly with hint time, pace and assist count', () => {
    /** the largest change between neighbouring points of a sweep, and whether it never rises */
    const sweep = (xs: number[], f: (x: number) => number) => {
      const ys = xs.map(f);
      let step = 0;
      let rises = false;
      for (let i = 1; i < ys.length; i++) {
        step = Math.max(step, Math.abs(ys[i] - ys[i - 1]));
        if (ys[i] > ys[i - 1] + 1e-12) rises = true;
      }
      return { step, rises, first: ys[0], last: ys[ys.length - 1] };
    };
    const range = (lo: number, hi: number, by: number) => Array.from({ length: Math.round((hi - lo) / by) + 1 }, (_, i) => lo + i * by);
    const hintAt = (ms: number, more: Partial<BoardRecord> = {}) => rec({ ms: 70_000, blocked: 0, hints: 1, hintAfterMs: ms, ...more });
    const paced = (ratio: number, more: Partial<BoardRecord>) => rec({ ms: ratio * 90_000, blocked: 0, ...more });
    const cases = [
      // hint time 0–60 s on a quick clear, in 0.5 s steps (the old rule jumped 0.12 at 10 s)
      sweep(range(0, 60_000, 500), (t) => performance(hintAt(t))),
      sweep(range(0, 60_000, 500), (t) => cleanCredit(hintAt(t))),
      // pace 0.8–1.8 × par in 0.01 steps, for an early hint and for a shuffle
      sweep(range(0.8, 1.8, 0.01), (x) => performance(paced(x, { hints: 1, hintAfterMs: 3000 }))),
      sweep(range(0.8, 1.8, 0.01), (x) => cleanCredit(paced(x, { hints: 1, hintAfterMs: 3000 }))),
      sweep(range(0.8, 1.8, 0.01), (x) => performance(paced(x, { shuffles: 1 }))),
      sweep(range(0.8, 1.8, 0.01), (x) => cleanCredit(paced(x, { shuffles: 1 }))),
      // blocked taps beside the hint, 0–0.6 per pair: a hint while misreading is need
      sweep(range(0, 14, 0.25), (b) => cleanCredit(hintAt(3000, { blocked: b }))),
    ];
    for (const c of cases) {
      expect(c.rises).toBe(false);
      expect(c.step).toBeLessThan(0.03);
      expect(c.last).toBeLessThan(c.first);
    }
    // credit runs the whole way: an early hint on a quick clear is a clean clear, a slow assisted clear a miss
    expect(cleanCredit(hintAt(3000))).toBe(1);
    expect(cleanCredit(hintAt(3000, { blocked: 0.4 * 24 }))).toBeCloseTo(1 - MODEL.misreadNeed, 9);
    expect(cleanCredit(paced(1.6, { hints: 1, hintAfterMs: 3000 }))).toBe(0);
    // each further assist costs more, by at most one full hint's price
    const byCount = [0, 1, 2, 3, 4].map((k) => performance(rec({ ms: 70_000, blocked: 0, hints: k, hintAfterMs: k ? 3000 : -1 })));
    for (let k = 1; k < byCount.length; k++) {
      expect(byCount[k]).toBeLessThan(byCount[k - 1]);
      expect(byCount[k - 1] - byCount[k]).toBeLessThanOrEqual(0.27 * 0.5 + 1e-9);
    }
    const creditByCount = [1, 2, 3, 4].map((k) => cleanCredit(rec({ ms: 70_000, blocked: 0, hints: k, hintAfterMs: 3000 })));
    for (let k = 1; k < creditByCount.length; k++) expect(creditByCount[k]).toBeLessThan(creditByCount[k - 1]);
  });

  it('struggle: a quick clear never reads as one however many hints; a slow assisted clear does, smoothly', () => {
    const quick = (hints: number, hintAfterMs = 3000) => rec({ ms: 70_000, blocked: 0, hints, hintAfterMs });
    const at = (ratio: number, hints: number) => rec({ ms: ratio * 90_000, blocked: 0, hints, hintAfterMs: hints ? 3000 : -1 });
    // two early hints on a quick clear: 0.35 · 2 · need, need = cap · (1 − e^(−0.15 / cap))
    expect(struggleOf(quick(2))).toBeCloseTo(0.35 * 2 * MODEL.quickNeedMax * (1 - Math.exp(-MODEL.extraNeed / MODEL.quickNeedMax)), 9);
    expect(struggleOf(quick(2))).toBeCloseTo(0.0664, 4);
    for (const k of [1, 2, 3, 6, 12]) expect(struggleOf(quick(k, 90_000))).toBeLessThan(0.35 * 2 * MODEL.quickNeedMax + 1e-9);
    // slow and assisted: one hint at 1.5 × par 0.35 + 0.1, a struggle from about 1.6 ×; two hints at 1.7 × par 0.7 + 0.18
    expect(struggleOf(at(1.5, 1))).toBeCloseTo(0.45, 9);
    expect(struggleOf(at(1.8, 1))).toBeGreaterThanOrEqual(0.5);
    expect(struggleOf(at(1.7, 2))).toBeCloseTo(0.88, 9);
    // slowness alone: a straight ramp, 0 to 1.25 × par, 0.4 from 2.25 ×, no step
    expect(struggleOf(at(1.25, 0))).toBe(0);
    expect(struggleOf(at(2.25, 0))).toBeCloseTo(0.4, 9);
    for (let x = 0.8; x < 2.6; x += 0.01) {
      expect(Math.abs(struggleOf(at(x + 0.01, 0)) - struggleOf(at(x, 0)))).toBeLessThan(0.005);
      expect(Math.abs(struggleOf(at(x + 0.01, 1)) - struggleOf(at(x, 1)))).toBeLessThan(0.02);
    }
  });

  it('genuine struggle still brings relief: slow clears with hints', () => {
    const n = 150;
    const a = history({ ms: 80_000 }, 12);
    expect(targetFor(a, n).reason).not.toBe('relief');
    ingest(a, rec({ n: 60, ms: 1.7 * 90_000, hints: 2, hintAfterMs: 25_000, blocked: 4 }));
    expect(flowState(a).state).toBe('struggling');
    expect(targetFor(a, n).reason).toBe('relief');
    // and a quick clear with the same two hints does not
    const b = history({ ms: 80_000 }, 12);
    ingest(b, rec({ n: 60, ms: 70_000, hints: 2, hintAfterMs: 3000, blocked: 1 }));
    expect(flowState(b).state).not.toBe('struggling');
  });

  it('the floor rises with mastery evidence (rating up, deviation down)', () => {
    const n = 200;
    const a = defaultAnalytics();
    a.rating = designedBase(n) - 0.25;
    a.dev = 0.25;
    const low = masteryFloor(a, n);
    a.rating = designedBase(n) + 0.15;
    const mid = masteryFloor(a, n);
    a.dev = MODEL.devMin;
    const high = masteryFloor(a, n);
    expect(low).toBe(0);
    expect(mid).toBeGreaterThanOrEqual(low);
    expect(high).toBeGreaterThan(mid);
    expect(tierD(n, high)).toBeLessThanOrEqual(a.rating);
  });
});

describe('calm guardrails', () => {
  function settled(n: number, tier: number): AnalyticsSave {
    const a = defaultAnalytics();
    a.rating = tierD(n, tier);
    a.dev = MODEL.devMin;
    a.boards = 60;
    a.recent = [rec({ n: n - 1, tier, ms: 95_000 }), rec({ n: n - 2, tier, ms: 60_000, blocked: 0 }), rec({ n: n - 3, tier, ms: 95_000 })];
    return a;
  }

  it('never moves more than one tier from the last board, even in deep relief', () => {
    const n = 150;
    const a = settled(n, 4);
    a.recent = [quit({ n: n - 1, tier: 4 }), quit({ n: n - 2, tier: 4 }), quit({ n: n - 3, tier: 4 }), ...a.recent];
    a.rating = tierD(n, 0);
    const c = decide(a, n, false);
    expect(c.tier).toBe(3);
    expect(c.reason).toBe('relief');
  });

  it('gives a breather after a peak or festival board', () => {
    const peak = levelWithRole('peak', 100);
    const fest = levelWithRole('festival', 100);
    const next = fest + 1;
    const a = settled(next, 2);
    a.recent[0] = rec({ n: fest, tier: 2, ms: 95_000 });
    const after = targetFor(a, next);
    expect(after.reason).toBe('breather');
    const b = settled(next, 2);
    b.recent[0] = rec({ n: next - 5, tier: 2, ms: 95_000 });
    expect(after.target).toBeLessThan(targetFor(b, next).target - 0.03);
    // a peak followed by the festival is not softened (the festival is the chapter's finale)
    const c = settled(fest, 2);
    c.recent[0] = rec({ n: peak, tier: 2, ms: 95_000 });
    expect(targetFor(c, fest).reason).not.toBe('breather');
  });

  it('a relief re-pin after two failed tries still applies', () => {
    const n = 120;
    const a = settled(n, 2);
    decide(a, n, false);
    a.tries = { n, count: DIRECTOR.reliefAfterTries };
    expect(decide(a, n, false)).toMatchObject({ tier: 1, reason: 'relief-repin' });
  });
});

describe('ChallengeRequest', () => {
  const bendBlind = () => history({ turnMs: [1800, 2200, 7000], gapMs: 2300, firstTaps: [[0, 0.4], [1, 0.6], [0.5, 0]] }, 24);

  it('carries the tier and leans on a blind spot inside it', () => {
    const a = bendBlind();
    const n = levelWithRole('focus', 150);
    const c = decide(a, n, false);
    const ch: ChallengeRequest = c.challenge;
    expect(ch.tier).toBe(c.tier);
    expect(ch.n).toBe(n);
    expect(['shape:twoBend', 'region:centre']).toContain(ch.focus);
    expect(ch.weight).toBeGreaterThan(0);
    expect(ch.weight).toBeLessThanOrEqual(1);
    expect(ch.rotationKey).toContain(String(n));
  });

  it('rotates: never the same focus twice in a row, and a blind spot waits two boards before it returns', () => {
    const a = bendBlind();
    const foci: string[] = [];
    for (let n = 150; n < 174; n++) {
      const c = decide(a, n, false);
      foci.push(c.challenge.focus);
      ingest(a, rec({ n, d: tierD(n, c.tier), tier: c.tier, turnMs: [1800, 2200, 7000], gapMs: 2300, firstTaps: [[0, 0.4], [1, 0.6], [0.5, 0]] }));
    }
    for (let i = 1; i < foci.length; i++) {
      if (foci[i] !== 'none') expect(foci[i], `board ${i}`).not.toBe(foci[i - 1]);
      if (foci[i] !== 'none' && i >= 2) expect(foci[i], `board ${i}`).not.toBe(foci[i - 2]);
    }
    expect(new Set(foci.filter((f) => f !== 'none')).size).toBeGreaterThanOrEqual(2);
    expect(foci.filter((f) => f === 'shape:twoBend').length).toBeGreaterThanOrEqual(4);
    expect(a.emphases.length).toBeLessThanOrEqual(EMPHASES_CAP);
  });

  it('is calm on relief, rest and teaching boards, and a retry keeps its focus', () => {
    const a = bendBlind();
    a.recent = [quit({ n: 149 }), quit({ n: 148 }), ...a.recent];
    expect(decide(a, 150, false).challenge).toMatchObject({ focus: 'none', weight: 0 });
    const b = bendBlind();
    expect(decide(b, levelWithRole('rest', 150), false).challenge.focus).toBe('none');
    expect(decide(bendBlind(), 3, false).challenge.focus).toBe('none');
    const c = bendBlind();
    const n = levelWithRole('focus', 160);
    const first = decide(c, n, false).challenge;
    expect(decide(c, n, false).challenge.focus).toBe(first.focus);
  });

  it('only names mechanics on the level, and never raises the tier', () => {
    const a = defaultAnalytics();
    for (let i = 0; i < 12; i++) {
      ingest(a, rec({ n: 50 + 2 * i, d: designedBase(50), mech: ['snow'] }));
      ingest(a, quit({ n: 51 + 2 * i, d: designedBase(50), mech: ['wind'] }));
    }
    for (let n = 200; n < 230; n++) {
      const plain = structuredClone(a);
      const c = decide(a, n, false);
      if (c.challenge.emphasis.kind === 'mechanic') expect(levelPlan(n).mechanics as string[]).toContain(c.challenge.emphasis.id);
      // the challenge never changes the tier the policy picked
      plain.emphases = [];
      expect(decide(plain, n, false).tier).toBe(c.tier);
      ingest(a, rec({ n, d: tierD(n, c.tier), tier: c.tier, mech: levelPlan(n).mechanics }));
    }
  });

  it('expected() is unchanged (the rating scale the bank is tuned to)', () => {
    expect(expected(0.5, 0.5)).toBeCloseTo(MODEL.atRating, 6);
  });
});

describe('verifier fixes on the player model', () => {
  it('a hint never earns a harder board: no stretch, and a hint on a slow clear is a miss', () => {
    const n = 150;
    const clean = history({ ms: 60_000, blocked: 0 }, 14);
    const hinted = history({ ms: 60_000, blocked: 0, hints: 1, hintAfterMs: 3000 }, 14);
    // the same quick clears with a hint each: never a stretch, never a higher target
    expect(targetFor(clean, n).reason).toBe('stretch');
    expect(targetFor(hinted, n).reason).not.toBe('stretch');
    expect(targetFor(hinted, n).target).toBeLessThan(targetFor(clean, n).target);
    // ...and a light assist never reads as a struggle
    expect(flowState(hinted).state).not.toBe('struggling');
    // slow clears: clean ones count toward the clean rate, hinted ones less the slower they are
    const slowClean = history({ ms: 100_000 }, 14);
    const slowHinted = history({ ms: 100_000, hints: 1, hintAfterMs: 3000 }, 14);
    const slowerHinted = history({ ms: 120_000, hints: 1, hintAfterMs: 3000 }, 14);
    expect(targetFor(slowHinted, n).flow).toBeLessThanOrEqual(targetFor(slowClean, n).flow);
    expect(targetFor(slowHinted, n).target).toBeLessThan(targetFor(slowClean, n).target);
    expect(targetFor(slowerHinted, n).flow).toBeLessThan(targetFor(slowHinted, n).flow);
    // a hint on a clear at 1.5 × par or slower is a miss
    expect(targetFor(history({ ms: 140_000, hints: 1, hintAfterMs: 3000 }, 14), n).flow).toBeLessThan(0);
    // quick clears with a hint after a long search: more need than an early hint
    const needed = history({ ms: 60_000, blocked: 0, hints: 1, hintAfterMs: 40_000 }, 14);
    expect(cleanRate(needed)!.lenient).toBeLessThan(cleanRate(hinted)!.lenient);
    expect(targetFor(needed, n).target).toBeLessThan(targetFor(hinted, n).target);
  });

  it('a stop-start pair rhythm (far above their usual) reads as a freeze', () => {
    const a = history({ firstMs: 3000, gapMs: 2500, gapCv: 0.45, longMs: 7000, ms: 95_000 }, 10);
    for (let i = 0; i < 3; i++) ingest(a, rec({ gapCv: 1.6, longMs: 9000 }));
    expect(flowState(a).state).toBe('frozen');
    const b = history({ firstMs: 3000, gapMs: 2500, gapCv: 1.5, longMs: 7000, ms: 95_000 }, 13);
    // an uneven rhythm that is their usual is not a freeze
    expect(flowState(b).state).toBe('flow');
  });

  it('a rushing player gets decoys first', () => {
    const a = history({ gapMs: 1200, blocked: 9, quickMisses: 8, ms: 60_000, turnMs: [1800, 2200, 4000] }, 14);
    expect(flowState(a).state).toBe('rushing');
    const n = levelWithRole('focus', 150);
    expect(decide(a, n, false).challenge.focus).toBe('decoys');
  });

  it('no unearned breather: replaying an old peak and then starting a new level', () => {
    const peak = levelWithRole('peak', 100);
    const n = levelWithRole('focus', peak + 30);
    const a = defaultAnalytics();
    a.rating = tierD(n, 2);
    a.dev = MODEL.devMin;
    a.boards = 60;
    a.recent = [rec({ n: peak, tier: 2, ms: 95_000 }), rec({ n: n - 1, tier: 2, ms: 95_000 }), rec({ n: n - 2, tier: 2, ms: 60_000 })];
    expect(targetFor(a, n).reason).not.toBe('breather');
    a.recent[0] = rec({ n: peak, tier: 2, ms: 95_000 });
    expect(targetFor(a, peak + 1).reason === 'breather' || levelPlan(peak + 1).role === 'festival').toBe(true);
  });

  it('a replay long after is the same board: focus and weight are pinned with the tier', () => {
    const a = history({ turnMs: [1800, 2200, 7000], gapMs: 2300, firstTaps: [[0, 0.4], [1, 0.6], [0.5, 0]] }, 24);
    const first: ChallengeRequest[] = [];
    for (let n = 150; n < 150 + 3 * EMPHASES_CAP; n++) {
      const c = decide(a, n, false);
      first.push(c.challenge);
      ingest(a, rec({ n, d: tierD(n, c.tier), tier: c.tier, turnMs: [1800, 2200, 7000], gapMs: 2300, firstTaps: [[0, 0.4], [1, 0.6], [0.5, 0]] }));
    }
    expect(first.some((c) => c.focus !== 'none')).toBe(true);
    // the save goes through a reload, too
    const b = hydrateAnalytics(JSON.parse(JSON.stringify(a)));
    for (const c of first) {
      const again = decide(b, c.n, true).challenge;
      expect({ n: again.n, tier: again.tier, focus: again.focus, weight: again.weight, rotationKey: again.rotationKey }).toEqual({
        n: c.n, tier: c.tier, focus: c.focus, weight: c.weight, rotationKey: c.rotationKey,
      });
    }
  });

  it('rotation: one blind spot is never leaned on more than three boards in any eight', () => {
    // a reader with a single strong blind spot (2-bend paths), nothing else to lean on
    const tpl = { turnMs: [1800, 2200, 9000] as [number, number, number], gapMs: 2300, firstTaps: [[0.2, 0.5], [0.6, 0.0], [1, 0.5]] as [number, number][] };
    const a = history(tpl, 24);
    const fam: string[] = [];
    for (let n = 150; n < 190; n++) {
      const c = decide(a, n, false);
      fam.push(familyOf(c.challenge.focus));
      ingest(a, rec({ n, d: tierD(n, c.tier), tier: c.tier, ...tpl }));
    }
    expect(fam.filter((f) => f === 'bends2').length).toBeGreaterThanOrEqual(6);
    for (let i = 0; i + 8 <= fam.length; i++) expect(fam.slice(i, i + 8).filter((f) => f === 'bends2').length, `boards ${i}–${i + 7}`).toBeLessThanOrEqual(3);
  });

  it('malformed stored foci never become an emphasis', () => {
    for (const bad of ['shape:whatever', 'mech:x', 'region:foo', 'decoys:extra', '', 'none', 'shape:', 'mech:snow:2']) {
      expect(emphasisOf(bad), bad).toEqual({ kind: 'none' });
    }
    expect(emphasisOf('mech:snow')).toEqual({ kind: 'mechanic', id: 'snow' });
    expect(emphasisOf('shape:detour')).toEqual({ kind: 'shape', shape: 'detour' });
    const a = hydrateAnalytics({ foci: 'zz9!x1a5', emphases: [{ n: 200, focus: 'shape:whatever', w: 0.7 }] });
    expect(a.emphases).toEqual([]);
    for (let n = 1; n <= 4; n++) {
      const ch = pinnedChallenge(a, n, 2);
      if (ch.focus === 'none') expect(ch.weight).toBe(0);
      else expect(focusOf(emphasisOf(ch.focus))).toBe(ch.focus);
    }
  });
});
