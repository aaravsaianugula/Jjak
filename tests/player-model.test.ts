/**
 * The richer player model (EXPANSION_PLAN §C1): path-shape and mechanic ratings with
 * confidence, flow states from think time and pair rhythm, typed habits, habit-aware
 * assists (the tier-0 trap), the calm guardrails and the ChallengeRequest rotation.
 */
import { describe, expect, it } from 'vitest';
import { type ChallengeRequest, DIRECTOR, decide, masteryFloor, targetFor, tierD } from '../src/director/director';
import { emphasisOf, familyOf, focusOf, pinnedChallenge } from '../src/director/challenge';
import { flowState } from '../src/director/flow';
import { MODEL, expected, habitualAssists, ingest, performance } from '../src/director/model';
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
    expect(habitualAssists(a)).toBe(1);
    expect(flowState(a).state).not.toBe('struggling');
    expect(habitualAssists(norm())).toBe(0);
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
    const slow = { ms: 110_000 };
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
    // two hints are never light, however quick; nor is a hint after a long search
    expect(performance(rec({ hints: 2, hintAfterMs: 3000 }))).toBeLessThan(light - 0.2);
    expect(performance(rec({ hints: 1, hintAfterMs: 30_000 }))).toBeCloseTo(performance(rec()) - 0.27 * 0.5, 6);
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
  it('a habit is a hint on MOST quick clears: a mean of exactly one in two is no habit', () => {
    const mixed = (hinted: number, of: number, extra = 0) => {
      const a = defaultAnalytics();
      for (let i = 0; i < of; i++) ingest(a, rec({ n: 30 + i, hints: (i < hinted ? 1 : 0) + (i < extra ? 1 : 0), ms: 70_000 }));
      return habitualAssists(a);
    };
    expect(mixed(5, 10)).toBe(0);
    expect(mixed(6, 10)).toBe(1);
    expect(mixed(10, 10, 5)).toBe(1);
    expect(mixed(10, 10, 6)).toBe(2);
  });

  it('a hint never earns a harder board: no stretch, and a hint on a slow clear is a miss', () => {
    const n = 150;
    const clean = history({ ms: 60_000, blocked: 0 }, 14);
    const hinted = history({ ms: 60_000, blocked: 0, hints: 1, hintAfterMs: 3000 }, 14);
    expect(habitualAssists(hinted)).toBe(1);
    // the same quick clears with a hint each: never a stretch, never a higher target
    expect(targetFor(clean, n).reason).toBe('stretch');
    expect(targetFor(hinted, n).reason).not.toBe('stretch');
    expect(targetFor(hinted, n).target).toBeLessThan(targetFor(clean, n).target);
    // ...and a light assist never reads as a struggle
    expect(flowState(hinted).state).not.toBe('struggling');
    // slow clears: clean ones count toward the clean rate, hinted ones against it
    const slowClean = history({ ms: 100_000 }, 14);
    const slowHinted = history({ ms: 100_000, hints: 1, hintAfterMs: 3000 }, 14);
    expect(targetFor(slowHinted, n).flow).toBeLessThan(0);
    expect(targetFor(slowHinted, n).target).toBeLessThan(targetFor(slowClean, n).target);
    // quick clears with a hint after a long search: need, so a miss and a struggle
    const needed = history({ ms: 60_000, blocked: 0, hints: 1, hintAfterMs: 30_000 }, 14);
    expect(targetFor(needed, n).flow).toBeLessThan(0);
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
