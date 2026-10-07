/**
 * The endless road past 600 (EXPANSION_PLAN §C5): gating, validation, determinism
 * from the stored spec, the save slice, relief, pre-generation and rewards.
 * The 1,000-level fuzz is in tests/endless-fuzz-*.test.ts; the persona tailoring
 * simulations in tests/endless-personas.test.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTE, ROUTE_LEVELS, routeOf } from '../src/data/route';
import { measure } from '../src/director/metrics';
import { NEUTRAL, defaultEndlessState, endlessIdentity, feelOfSpec, makeJob, runEndlessJob, safeLayout } from '../src/director/endless-core';
import { endlessEntry, endlessSpec, prepareEndless, pruneEndless } from '../src/director/endless';
import { levelPlan as indexPlan, playLevel, prepareLevel, shownSpec, shownYears } from '../src/director/index';
import { levelPlan } from '../src/director/plan';
import { boardHash, validate } from '../src/director/validate';
import { buildBoard, maxStones } from '../src/engine/levels';
import { Session } from '../src/engine/session';
import { emit } from '../src/services/events';
import { boardReport } from '../src/services/meta';
import { recordClear } from '../src/services/progress';
import { ENDLESS_CAP, hydrateEndless, hydrateJourney } from '../src/services/save-journey';
import { defaultSave, save } from '../src/services/storage';
import { FAST, road } from './endless-helpers';

/** Reset the shared save object in place (storage exports a live binding). */
function fresh(level = 601) {
  const d = defaultSave();
  for (const k of Object.keys(save) as (keyof typeof save)[]) delete (save as Partial<typeof save>)[k];
  Object.assign(save, d);
  save.level = level;
  save.journey.revealed = level > ROUTE_LEVELS;
}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => fresh());

describe('hidden until earned', () => {
  it('the Map shows no Wanderer year until level 600 is behind the player', () => {
    for (const level of [1, 12, 300, 599, 600]) expect(shownYears(level)).toBe(0);
    expect(shownYears(601)).toBe(1);
    expect(shownYears(1200)).toBe(1);
    expect(shownYears(1201)).toBe(2);
  });

  it('levels 1–600 are untouched: shown and prepared from the plan and the bank, never stored', async () => {
    fresh(600);
    for (const n of [1, 7, 300, 599, 600]) {
      expect(shownSpec(n)).toEqual(levelPlan(n).spec);
      expect(await prepareEndless(n)).toEqual(levelPlan(n).spec);
    }
    expect((await prepareLevel(600)).number).toBe(600);
    expect(Object.keys(save.journey.endless.levels)).toEqual([]);
    // Clearing 599 prepares nothing; nothing past 600 is in the save.
    const s = new Session(playLevel(599), 0);
    s.finishedAt = 30_000;
    emit('clear', { session: s, summary: recordClear(s) });
    await tick(120);
    expect(Object.keys(save.journey.endless.levels)).toEqual([]);
  });

  it('a stored slice never keeps a level of the first pass', () => {
    const spec = { ...levelPlan(300).spec };
    const h = hydrateEndless({ levels: { 300: { spec, target: 0.5, offset: 0, relief: 0, src: 'worker', at: 1 } } });
    expect(h.levels).toEqual({});
  });
});

describe('generation (core)', () => {
  const gens = road(601, 36, { size: { K: 3, climb: 1 } });

  it('every generated level passes the bank validators, re-measured from its stored spec', () => {
    for (const g of gens) {
      expect(g.result, `level ${g.n}`).not.toBeNull();
      const spec = JSON.parse(JSON.stringify(g.spec));
      const board = buildBoard(spec);
      const m = measure(spec, board, FAST.measure);
      expect(m.d).toBe(g.spec.difficulty);
      const v = validate(spec, board, m, { plan: g.plan, tier: spec.tier });
      expect(v.reasons, `level ${g.n}`).toEqual([]);
    }
  });

  it('keeps the identity: place, season, slot rhythm, a festival every 12th level, par and goal slots', () => {
    for (const g of gens) {
      const base = levelPlan(g.n);
      expect(g.plan.place.id).toBe(base.place.id);
      expect(g.plan.slot).toBe(base.slot);
      expect(g.plan.role).toBe(base.role);
      expect(!!g.spec.festival).toBe(base.festival);
      expect(!!g.spec.goal).toBe(!!base.goal);
      expect(g.spec.mode).toBe('journey');
      expect(g.spec.number).toBe(g.n);
      expect(g.spec.seed.startsWith(`endless-${g.n}-`)).toBe(true);
      expect(g.spec.par).toBeGreaterThan(0);
    }
  });

  it('is deterministic: the same inputs give the same board', () => {
    const again = road(601, 6, { size: { K: 3, climb: 1 } });
    again.forEach((g, i) => expect(g.spec).toEqual(gens[i].spec));
  });

  it('clustered stones never crowd a board (the layout that stalls the generator)', () => {
    const p = levelPlan(611);
    const many = { stones: maxStones(p.rows, p.cols), layout: 'clusters' as const, months: 12, snow: 0, knots: 0, gates: 0, fences: 0 };
    expect(safeLayout(p, many).layout).toBe('lines');
    expect(safeLayout(p, { ...many, stones: 2 }).layout).toBe('clusters');
  });
});

describe('determinism from the stored spec', () => {
  it('a retry gives the same board, and a restored save rebuilds it exactly', async () => {
    const spec = await prepareEndless(601);
    expect(endlessEntry(601)).not.toBeNull();
    expect(spec.number).toBe(601);
    // A retry: the same spec, the same board.
    expect(await prepareEndless(601)).toEqual(spec);
    expect(endlessSpec(601)).toEqual(spec);
    expect(playLevel(601)).toEqual(spec);
    const hash = boardHash(spec, buildBoard(spec));
    // A restored save: through JSON and the hydrator.
    const restored = hydrateJourney(JSON.parse(JSON.stringify(save.journey)));
    const back = restored.endless.levels[601].spec;
    expect(back).toEqual(spec);
    expect(boardHash(back, buildBoard(back))).toBe(hash);
  });

  it('the shown spec past 600 is the stored board once made (Home and the Map agree with play)', async () => {
    const before = shownSpec(601);
    expect(before).toEqual(levelPlan(601).spec);
    const spec = await prepareEndless(601);
    expect(shownSpec(601)).toEqual(spec);
    expect(indexPlan(601).n).toBe(601);
  });
});

describe('the save stays small', () => {
  it('keeps the current level, the next one and the recent window, capped', async () => {
    for (let n = 601; n <= 640; n++) {
      save.level = n;
      await prepareEndless(n);
      save.stars[n] = 2;
    }
    save.level = 641;
    await prepareEndless(641);
    const keys = Object.keys(save.journey.endless.levels).map(Number).sort((a, b) => a - b);
    expect(keys.length).toBeLessThanOrEqual(ENDLESS_CAP);
    expect(keys).toContain(641);
    for (let n = 641 - 12; n < 641; n++) expect(keys).toContain(n);
    const bytes = JSON.stringify(save.journey.endless).length;
    console.log(`[endless] save slice: ${keys.length} levels, ${bytes} bytes`);
    expect(bytes).toBeLessThan(8000);
    // An old replay keeps its board for a retry, without pushing out the window.
    save.journey.endless.levels[605] = { ...save.journey.endless.levels[641], spec: { ...levelPlan(605).spec }, at: ++save.journey.endless.seq };
    pruneEndless(save.journey.endless, 641);
    expect(save.journey.endless.levels[605]).toBeDefined();
    for (let n = 641 - 12; n <= 641; n++) expect(save.journey.endless.levels[n]).toBeDefined();
  });

  it('hydrates malformed slices to safe values', () => {
    const good = levelPlan(650).spec;
    const h = hydrateEndless({
      levels: {
        650: { spec: good, target: 0.6, offset: 0.01, relief: 1, src: 'main', at: 3 },
        651: { spec: { ...good, number: 999 } },
        652: { spec: { ...good, number: 652, rows: 12 } },
        653: 'x',
        x: { spec: good },
      },
      bag: ['knots', 3, 'wind'],
      goals: 'combo',
      stretch: { centre: 99, twoBend: 'a' },
      seq: -4,
    });
    expect(Object.keys(h.levels)).toEqual(['650']);
    expect(h.levels[650]).toMatchObject({ target: 0.6, relief: 1, src: 'main' });
    expect(h.bag).toEqual(['knots', 'wind']);
    expect(h.goals).toEqual([]);
    expect(h.stretch).toEqual({ centre: 8, twoBend: 0 });
    expect(h.seq).toBe(3);
    expect(hydrateEndless(null).levels).toEqual({});
  });
});

describe('pacing past 600', () => {
  it('two failed attempts at an uncleared level make it again, a step gentler', async () => {
    fresh(605);
    const first = await prepareEndless(605);
    const before = endlessEntry(605)!;
    save.analytics.tries = { n: 605, count: 2 };
    const again = await prepareEndless(605);
    const after = endlessEntry(605)!;
    expect(after.relief).toBe(1);
    expect(after.target).toBeLessThanOrEqual(before.target - 0.1 + 1e-9);
    expect(again.seed).not.toBe(first.seed);
    expect(save.analytics.tries.count).toBe(0);
    // A cleared level is never re-made.
    save.stars[605] = 1;
    save.analytics.tries = { n: 605, count: 3 };
    expect(await prepareEndless(605)).toEqual(again);
  });

  it('a session-end board becomes a festival-style peak; short sessions get smaller boards', () => {
    const base = levelPlan(626); // an ordinary focus board
    const st = defaultEndlessState();
    const peak = endlessIdentity(626, { ...NEUTRAL, sessionPeak: true, finale: 0.4 }, st);
    expect(peak.lucky).toBe(true);
    expect(peak.rows * peak.cols).toBe(base.rows * base.cols);
    const short = endlessIdentity(626, { ...NEUTRAL, short: true }, defaultEndlessState());
    expect(short.rows * short.cols).toBeLessThan(base.rows * base.cols);
    expect(short.rows * short.cols).toBeGreaterThanOrEqual(30);
    expect(short.par).toBeLessThan(base.par + 1);
    // Peaks and festivals keep their size.
    const fest = endlessIdentity(624, { ...NEUTRAL, short: true }, defaultEndlessState());
    expect([fest.rows, fest.cols]).toEqual([levelPlan(624).rows, levelPlan(624).cols]);
  });

  it('never the same feel twice in a row: a repeat takes the other shape of its size', () => {
    const st = defaultEndlessState();
    const a = endlessIdentity(619, NEUTRAL, st);
    const prev = { ...a.spec, number: 618 };
    const b = endlessIdentity(619, NEUTRAL, defaultEndlessState(), prev);
    expect(feelOfSpec(b.spec)).not.toBe(feelOfSpec(prev));
  });

  it('a search under a frozen clock, and the quick fallback, both return a valid board', () => {
    const plan = endlessIdentity(647, NEUTRAL, defaultEndlessState());
    for (const size of [{}, { K: 1, climb: 0, maxAttempts: 3, timeBudgetMs: 120, hardMs: 400, measure: { random: 4, human: 2, budget: 400 } }]) {
      const r = runEndlessJob(makeJob(647, plan, plan.base, NEUTRAL, [], { size }), () => 0);
      expect(r).not.toBeNull();
      expect(r!.spec.difficulty).toBeGreaterThan(0);
    }
  });
});

describe('pre-generation and rewards', () => {
  it('clearing an endless board prepares the next one in the background', async () => {
    fresh(610);
    const spec = await prepareLevel(610);
    const s = new Session(spec, 0);
    s.pairsMade = s.totalPairs;
    s.finishedAt = 40_000;
    const summary = recordClear(s);
    expect(save.level).toBe(611);
    emit('clear', { session: s, summary });
    await tick(80);
    const next = await prepareEndless(611);
    expect(endlessEntry(611)?.spec).toEqual(next);
  });

  it('endless boards still pay: blossoms on first clear, lanterns, chapter gifts, Flower Path XP, the place-year stamp', async () => {
    fresh(612);
    const spec = await prepareLevel(612);
    expect(spec.festival).toBe(true);
    const s = new Session(spec, 0);
    s.pairsMade = s.totalPairs;
    s.score = 3000;
    s.finishedAt = 30_000;
    const hints = save.hints;
    const xp = save.meta.xp;
    emit('start', { session: s });
    const summary = recordClear(s);
    emit('clear', { session: s, summary });
    expect(summary.firstClear).toBe(true);
    expect(summary.petals).toBeGreaterThan(0);
    expect(summary.lantern).toBeDefined(); // 612 is a lantern level (every 4th)
    expect(save.hints).toBeGreaterThan(hints);
    const place = routeOf(612).chapter;
    expect(place).toBe(ROUTE[0]);
    expect(summary.stamp).toMatchObject({ id: place.id, year: 1 });
    expect(save.journey.yearStamps[`${place.id}@1`]).toBeTruthy();
    expect(save.meta.xp).toBeGreaterThan(xp);
    expect(boardReport(s)?.xp).toBeGreaterThan(0);
    // Petals stay first-clear only (for the same blossoms).
    const replay = new Session(spec, 0);
    replay.pairsMade = replay.totalPairs;
    replay.finishedAt = 30_000;
    const again = recordClear(replay);
    expect(again.firstClear).toBe(false);
    expect(again.petals).toBe(0);
    expect(again.stamp).toBeUndefined();
  });
});

describe('review fixes', () => {
  it('a stored endless spec with a goal or layout this build does not know is generated again, not trusted', () => {
    const spec = { ...levelPlan(605).spec, number: 605 };
    const keep = hydrateEndless({ levels: { 605: { spec, target: 0.5, offset: 0, relief: 0, src: 'worker', at: 1 } } });
    expect(keep.levels[605]).toBeTruthy();
    for (const bad of [{ goal: 'speed' }, { layout: 'spiral' }]) {
      const h = hydrateEndless({ levels: { 605: { spec: { ...spec, ...bad }, target: 0.5, offset: 0, relief: 0, src: 'worker', at: 1 } } });
      expect(h.levels[605]).toBeUndefined();
    }
  });

  it('identityOf keeps a level’s own place, shape, mechanics and goal (relief never redraws them)', async () => {
    const { identityOf } = await import('../src/director/endless-core');
    const state = defaultEndlessState();
    const first = endlessIdentity(640, NEUTRAL, state);
    const spec = first.spec;
    const again = identityOf(640, spec);
    expect([again.rows, again.cols]).toEqual([spec.rows, spec.cols]);
    expect(again.mechanics).toEqual(first.mechanics);
    expect(again.goal).toBe(first.goal);
    expect(again.wind).toBe(first.wind);
  });

  it('honestSpec never promises gates or fences the built board does not have', async () => {
    const { honestSpec } = await import('../src/engine/levels');
    for (let k = 0; k < 30; k++) {
      const s = honestSpec({ ...levelPlan(170).spec, seed: `honest-${k}`, gates: 4, fences: 8 });
      const b = buildBoard(s);
      if (s.gates) expect(b.cells.some((v) => v <= -16)).toBe(true);
      if (s.fences) expect(b.walls).toBeTruthy();
    }
  });
});
