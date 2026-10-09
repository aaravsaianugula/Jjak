/**
 * The player model, the Director's adjustment policy, the play-style profile and the
 * on-device analytics service (EXPANSION_PLAN §C1, §C5).
 */
import { chapterMean } from '../src/director/director';
import { beforeEach, describe, expect, it } from 'vitest';
import { bankSpec } from '../src/director/bank';
import { DIRECTOR, decide, pinnedTier, recordAttempt, targetFor, tierD } from '../src/director/director';
import { MODEL, engagement, expected, ingest, performance, proficiency } from '../src/director/model';
import { designedBase } from '../src/director/plan';
import { playStyle } from '../src/director/profile';
import { SKILL } from '../src/director/skills';
import { journeyLevel, rushLevel } from '../src/engine/levels';
import { monthOf } from '../src/engine/board';
import { findPath } from '../src/engine/path';
import { Session } from '../src/engine/session';
import { tracking } from '../src/services/analytics';
import { emit } from '../src/services/events';
import { type AnalyticsSave, type BoardRecord, DAYS_CAP, RECENT_CAP, defaultAnalytics, hydrateAnalytics } from '../src/services/save-analytics';
import { defaultSave, resetSave, save } from '../src/services/storage';
import { PERSONAS, type SimStep, simulate } from './personas';

function fresh() {
  const d = defaultSave();
  for (const k of Object.keys(save) as (keyof typeof save)[]) delete (save as Partial<typeof save>)[k];
  Object.assign(save, d);
}

const rec = (o: Partial<BoardRecord> = {}): BoardRecord => ({
  mode: 'journey', n: 40, tier: 2, d: designedBase(40), mech: [], ms: 70_000, par: 90, pairs: 24, made: 24, cleared: true, ended: 'clear',
  stars: 3, firstMs: 3000, gapMs: 2500, blocked: 1, reselects: 2, hints: 0, shuffles: 0, autoShuffles: 0, bestCombo: 3, fever: 0,
  turns: [8, 10, 6], turnMs: [1500, 2500, 4000], firstTaps: [], hintAfterMs: -1, date: '2026-10-07', hour: 20, ...o,
});
const easy = (o: Partial<BoardRecord> = {}) => rec({ ms: 60_000, blocked: 0, ...o });
const quit = (o: Partial<BoardRecord> = {}) => rec({ cleared: false, ended: 'quit', made: 10, stars: 0, ms: 50_000, ...o });

/** A settled player rated exactly on the curve at level n. */
function settled(n: number): AnalyticsSave {
  const a = defaultAnalytics();
  a.rating = designedBase(n);
  a.dev = MODEL.devMin;
  a.boards = 50;
  // neither struggling nor streaking: alternate a plain clear and a slow-ish one
  a.recent = [rec({ ms: 95_000 }), easy(), rec({ ms: 95_000 })];
  return a;
}

// ───────────────────────────── Persona simulations ─────────────────────────────

const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const BOARDS = 300;
const WARMUP = 40;

interface Summary {
  clean: number;
  /** share of boards where the rating is more than 0.1 from the persona's true skill */
  far: number;
  /** lowest / highest clean rate over any 40-board window */
  windowMin: number;
  windowMax: number;
  /** mean lag-1 autocorrelation of the rating error (≈1 smooth, < 0 zig-zag) */
  ac1: number;
  /** share of consecutive boards whose tier moved by 2 or more */
  jumps: number;
  tiers: number[];
}

function summarise(runs: SimStep[][]): Summary {
  let clean = 0, tot = 0, far = 0, jumps = 0, ac1 = 0;
  let windowMin = 1, windowMax = 0;
  const tiers = [0, 0, 0, 0, 0];
  for (const log of runs) {
    const late = log.slice(WARMUP);
    late.forEach((s, i) => {
      tot++;
      clean += Number(s.clean);
      tiers[s.tier]++;
      if (Math.abs(s.rating - s.theta) > 0.1) far++;
      if (i && Math.abs(s.tier - late[i - 1].tier) >= 2) jumps++;
    });
    for (let i = 0; i + 40 <= late.length; i += 10) {
      const w = late.slice(i, i + 40).filter((s) => s.clean).length / 40;
      windowMin = Math.min(windowMin, w);
      windowMax = Math.max(windowMax, w);
    }
    const errs = late.map((s) => s.rating - s.theta);
    const m = errs.reduce((x, y) => x + y, 0) / errs.length;
    let num = 0, den = 0;
    errs.forEach((e, i) => {
      den += (e - m) ** 2;
      if (i) num += (e - m) * (errs[i - 1] - m);
    });
    ac1 += num / den / runs.length;
  }
  return { clean: clean / tot, far: far / tot, windowMin, windowMax, ac1, jumps: jumps / tot, tiers: tiers.map((t) => t / tot) };
}

describe('persona simulations', () => {
  const results: Record<string, Summary> = {};
  for (const p of Object.values(PERSONAS)) results[p.name] = summarise(SEEDS.map((s) => simulate(p, `${p.name}-${s}`, BOARDS)));

  it('prints the table', () => {
    for (const [name, r] of Object.entries(results)) {
      console.log(
        `${name.padEnd(8)} clean ${(r.clean * 100).toFixed(1)}%  window ${(r.windowMin * 100).toFixed(0)}–${(r.windowMax * 100).toFixed(0)}%  ` +
          `far ${(r.far * 100).toFixed(1)}%  ac1 ${r.ac1.toFixed(2)}  jumps ${(r.jumps * 100).toFixed(1)}%  tiers ${r.tiers.map((t) => t.toFixed(2)).join(' ')}`,
      );
    }
  });

  for (const name of ['steady', 'strong', 'weak', 'learner']) {
    it(`${name}: converges into the 75–85 % clean-clear band without oscillating`, () => {
      const r = results[name];
      if (name === 'weak') {
        // The weak player lives on the bank's gentlest tier; its floor (a level never
        // drops its place's mechanics or shape) keeps them a little under the band.
        expect(r.tiers[0]).toBeGreaterThan(0.75);
        expect(r.clean).toBeGreaterThanOrEqual(0.65);
      } else expect(r.clean).toBeGreaterThanOrEqual(0.75);
      expect(r.clean).toBeLessThanOrEqual(0.85);
      // the rating tracks true skill…
      expect(r.far).toBeLessThan(0.05);
      // …smoothly (an oscillating controller has a negative lag-1 autocorrelation)
      expect(r.ac1).toBeGreaterThan(0.6);
      // no stretch of 40 boards turns into a wall or a walk
      expect(r.windowMin).toBeGreaterThanOrEqual(name === 'weak' ? 0.4 : 0.6);
      expect(r.windowMax).toBeLessThanOrEqual(0.97);
      // pacing moves one tier at a time, with the odd deep relief
      expect(r.jumps).toBeLessThan(0.1);
    });
  }

  it('players beyond the tier range sit at the end tier (the plan caps offsets at ±0.2)', () => {
    expect(results.expert.tiers[4]).toBeGreaterThan(0.9);
    expect(results.novice.tiers[0]).toBeGreaterThan(0.9);
  });

  it('the strong player gets harder boards than the weak one', () => {
    const mean = (t: number[]) => t.reduce((s, v, i) => s + v * i, 0);
    expect(mean(results.strong.tiers)).toBeGreaterThan(mean(results.steady.tiers) + 0.5);
    expect(mean(results.steady.tiers)).toBeGreaterThan(mean(results.weak.tiers) + 0.5);
  });

  it('one bad board does not swing a settled rating', () => {
    const a = defaultAnalytics();
    simulate(PERSONAS.steady, 'swing', 120, a);
    const before = a.rating;
    ingest(a, quit({ n: 120, d: designedBase(120) }));
    expect(before - a.rating).toBeGreaterThan(0);
    expect(before - a.rating).toBeLessThan(0.03);
    expect(a.dev).toBeLessThan(0.1);
  });
});

// ───────────────────────────── Model ─────────────────────────────

describe('model', () => {
  it('scores boards in a sensible order', () => {
    const fastClean = performance(easy({ ms: 50_000 }));
    const slowClean = performance(rec({ ms: 150_000 }));
    const assisted = performance(rec({ hints: 2, ms: 120_000 }));
    const q = performance(quit());
    expect(fastClean).toBeGreaterThan(slowClean);
    expect(slowClean).toBeGreaterThan(assisted);
    expect(assisted).toBeGreaterThan(q);
    expect(q).toBeLessThanOrEqual(0.2);
    expect(fastClean).toBeLessThanOrEqual(1);
  });

  it('expects more of a stronger player', () => {
    expect(expected(0.5, 0.5)).toBeCloseTo(MODEL.atRating, 5);
    expect(expected(0.6, 0.5)).toBeGreaterThan(expected(0.5, 0.5));
    expect(expected(0.4, 0.5)).toBeLessThan(expected(0.5, 0.5));
  });

  it('starts the rating at the first board (the curve is the prior)', () => {
    const a = defaultAnalytics();
    ingest(a, easy({ n: 7, d: 0.16 }));
    expect(a.rating).toBeGreaterThan(0.16);
    expect(a.rating).toBeLessThan(0.25);
    expect(a.boards).toBe(1);
  });

  it('ignores Rush and counts Daily and Zen at lower weight', () => {
    const a = defaultAnalytics();
    a.boards = 5;
    a.rating = 0.4;
    ingest(a, quit({ mode: 'rush' }));
    expect(a.recent).toHaveLength(0);
    const j = { ...a, recent: [] as BoardRecord[] };
    const dly = { ...a, recent: [] as BoardRecord[] };
    ingest(j, quit({ d: 0.4 }));
    ingest(dly, quit({ mode: 'daily', n: 0, d: 0.4 }));
    expect(0.4 - j.rating).toBeGreaterThan(0.4 - dly.rating);
    expect(dly.rating).toBeLessThan(0.4);
  });

  it('tracks per-mechanic proficiency, quits and replays', () => {
    const a = defaultAnalytics();
    for (let i = 0; i < 6; i++) ingest(a, easy({ mech: ['stones'] }));
    for (let i = 0; i < 6; i++) ingest(a, quit({ mech: ['wind'] }));
    ingest(a, easy({ mech: ['stones'] }), { replay: true });
    expect(a.mech.stones.n).toBe(7);
    expect(a.mech.stones.replays).toBe(1);
    expect(a.mech.wind.quits).toBe(6);
    expect(proficiency(a, 'stones').relative).toBeGreaterThan(0);
    expect(proficiency(a, 'wind').relative).toBeLessThan(0);
    expect(proficiency(a, 'gates')).toMatchObject({ n: 0, confidence: 0 });
  });

  it('reads frustration and boredom from the last boards', () => {
    const a = defaultAnalytics();
    expect(engagement(a).mood).toBe('flow');
    a.recent = [quit(), rec({ hints: 2 })];
    expect(engagement(a).mood).toBe('struggling');
    expect(engagement(a).frustration).toBeGreaterThan(0.5);
    a.recent = [easy(), easy(), easy(), rec({ ms: 95_000 })];
    expect(engagement(a)).toMatchObject({ mood: 'cruising', streak: 3 });
    expect(engagement(a).boredom).toBeGreaterThan(0.6);
  });

  it('caps the recent records and the days', () => {
    const a = defaultAnalytics();
    for (let i = 0; i < RECENT_CAP + 25; i++) {
      const d = new Date(2026, 0, 1 + i);
      ingest(a, easy({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }));
    }
    for (let i = 0; i < DAYS_CAP; i++) ingest(a, easy({ date: `2027-0${1 + (i % 9)}-${String(1 + Math.floor(i / 9)).padStart(2, '0')}` }));
    expect(a.recent).toHaveLength(RECENT_CAP);
    expect(a.days.length).toBeLessThanOrEqual(DAYS_CAP);
    expect(new Set(a.days).size).toBe(a.days.length);
  });

  it('grows dev after time away', () => {
    const a = defaultAnalytics();
    a.dev = MODEL.devMin;
    a.boards = 30;
    a.days = ['2026-09-01'];
    ingest(a, easy({ date: '2026-10-01' }));
    expect(a.dev).toBeGreaterThan(MODEL.devMin);
  });
});

// ───────────────────────────── Director ─────────────────────────────

describe('director', () => {
  const N = 150;

  it('keeps levels 1–6 at the designed tier', () => {
    const a = defaultAnalytics();
    a.rating = 1;
    a.boards = 50;
    for (let n = 1; n <= 6; n++) expect(decide(a, n, false)).toMatchObject({ tier: 2, reason: 'intro' });
    expect(a.tiers).toBe('222222');
  });

  it('follows skill on a settled player, clamped to ±0.2', () => {
    const a = settled(N);
    expect(decide({ ...a }, N, false).tier).toBe(2);
    expect(decide({ ...a, tiers: '', rating: chapterMean(N) + 0.1 }, N, false).tier).toBe(3);
    // Far above the curve: the offset is clamped, and the tier climbs one step per board.
    expect(decide({ ...a, tiers: '', rating: chapterMean(N) + 0.6 }, N, false).tier).toBe(3);
    expect(decide({ ...a, tiers: '', recent: [], rating: chapterMean(N) + 0.6 }, N, false).tier).toBe(4);
    expect(targetFor({ ...a, rating: chapterMean(N) - 0.6 }, N).skill).toBeCloseTo(-DIRECTOR.maxOffset, 5);
  });

  it('shrinks the skill offset toward the curve while it knows little', () => {
    const a = settled(N);
    a.rating = designedBase(N) + 0.2;
    a.boards = 3;
    expect(targetFor(a, N).skill).toBeCloseTo(0.1, 5);
  });

  it('gives a relief board after struggle', () => {
    const a = settled(N);
    a.recent = [quit(), ...a.recent];
    const t = targetFor(a, N);
    expect(t.reason).toBe('relief');
    expect(t.pacing).toBeCloseTo(-DIRECTOR.relief, 5);
    expect(decide(a, N, false).tier).toBe(1);
    a.recent = [quit(), quit(), ...a.recent];
    expect(targetFor(a, N).pacing).toBeCloseTo(-DIRECTOR.deepRelief, 5);
  });

  it('gives a stretch board after an easy streak', () => {
    const a = settled(N);
    a.recent = [easy(), easy(), easy(), ...a.recent];
    const t = targetFor(a, N);
    expect(t.reason).toBe('stretch');
    expect(t.pacing).toBeCloseTo(DIRECTOR.stretch, 5);
    expect(decide(a, N, false).tier).toBe(3);
  });

  it('pins a level: a retry or replay is the same board', () => {
    const a = settled(N);
    const first = decide(a, N, false);
    expect(pinnedTier(a, N)).toBe(first.tier);
    expect(a.tiers).toHaveLength(N);
    a.rating += 0.3;
    a.recent = [easy(), easy(), easy()];
    expect(decide(a, N, false)).toMatchObject({ tier: first.tier, reason: 'pinned' });
    expect(decide(a, N, true)).toMatchObject({ tier: first.tier, reason: 'pinned' });
    // the pinned tier's difficulty is its bank board's measured d (the curve only stands in without a bank entry)
    expect(tierD(N, first.tier)).toBe(bankSpec(N, first.tier).difficulty ?? designedBase(N) + (first.tier - 2) * MODEL.tierStep);
  });

  it('re-pins one tier lower after two failed attempts at an uncleared level', () => {
    const a = settled(N);
    const first = decide(a, N, false).tier;
    recordAttempt(a, N, 'quit', false);
    expect(decide(a, N, false).tier).toBe(first);
    recordAttempt(a, N, 'restart', false);
    expect(decide(a, N, false)).toMatchObject({ tier: first - 1, reason: 'relief-repin' });
    expect(pinnedTier(a, N)).toBe(first - 1);
    expect(a.tries.count).toBe(0);
    expect(decide(a, N, false)).toMatchObject({ tier: first - 1, reason: 'pinned' });
    // a clear resets; failures on a cleared level never re-pin
    recordAttempt(a, N, 'quit', false);
    recordAttempt(a, N, 'clear', false);
    expect(a.tries).toEqual({ n: N, count: 0 });
    recordAttempt(a, N, 'quit', true);
    recordAttempt(a, N, 'quit', true);
    expect(decide(a, N, true).reason).toBe('pinned');
  });

  it('chooseTier records the choice for the dev panel', async () => {
    fresh();
    const { chooseTier } = await import('../src/director/director');
    const c = chooseTier(N);
    expect(save.analytics.last).toMatchObject({ n: N, tier: c.tier, reason: c.reason });
  });
});

// ───────────────────────────── Save slice ─────────────────────────────

describe('analytics save slice', () => {
  it('hydrates malformed analytics to safe values', () => {
    const a = hydrateAnalytics({
      rating: 'x', dev: -4, boards: NaN, tiers: '12x4z..9', tries: 5, days: ['2026-10-01', 3, null], sessions: { count: 'many' },
      mech: { stones: { n: 'a', score: 9 }, wind: null },
      recent: [
        null, 7, 'board', { mode: 'chess' },
        { mode: 'journey', cleared: 'yes', turns: [1, 'x'], firstTaps: [[0, 2], 'a', [0.5]], mech: ['stones', 3], hour: 99 },
      ],
      last: { n: 'x', reason: 4 },
    });
    expect(a.rating).toBe(0.35);
    expect(a.dev).toBe(0.02);
    expect(a.boards).toBe(0);
    expect(a.tiers).toBe('12.4....');
    expect(a.tries).toEqual({ n: 0, count: 0 });
    expect(a.days).toEqual(['2026-10-01']);
    expect(a.sessions).toEqual({ count: 0, ms: 0 });
    // the per-mechanic skill rating hydrates from the overall rating, with a fresh deviation
    expect(a.mech).toEqual({ stones: { n: 0, score: 1, quits: 0, replays: 0, r: a.rating, dev: SKILL.devStart } });
    expect(a.recent).toHaveLength(1);
    expect(a.recent[0]).toMatchObject({ cleared: false, ended: 'quit', turns: [0, 0, 0], firstTaps: [[0, 1]], mech: ['stones'], hour: 23, d: -1 });
    expect(a.last).toMatchObject({ n: 0, reason: '' });
    // everything downstream copes
    expect(() => playStyle(a)).not.toThrow();
    expect(() => decide(a, 100, false)).not.toThrow();
    expect(() => ingest(a, easy())).not.toThrow();
    expect(hydrateAnalytics(null)).toEqual(defaultAnalytics());
    expect(hydrateAnalytics('nope')).toEqual(defaultAnalytics());
  });

  it('reset progress clears analytics', async () => {
    fresh();
    ingest(save.analytics, easy());
    save.analytics.tiers = '2223';
    save.analytics.sessions = { count: 4, ms: 1000 };
    await resetSave();
    expect(save.analytics).toEqual(defaultAnalytics());
  });
});

// ───────────────────────────── Profile ─────────────────────────────

describe('play-style profile', () => {
  it('has sensible defaults with no data', () => {
    const p = playStyle(defaultAnalytics());
    expect(p).toMatchObject({ boards: 0, confidence: 0, mood: 'flow' });
    expect(p.scan).toMatchObject({ edge: 0.5, top: 0.5, start: 'mixed', vertical: 'mixed', samples: 0 });
    expect(p.bends).toMatchObject({ ms: [0, 0, 0], twoBendCost: 1, slowest: null });
    expect(p.speed.style).toBe('steady');
    expect(p.assists.habit).toBe('never');
    expect(p.session).toMatchObject({ length: 'medium', hour: -1, boardsPerSession: 3 });
    expect(p.mechanics).toEqual([]);
  });

  it('reads scan pattern, bends, speed, tastes, assists and rhythm', () => {
    const a = defaultAnalytics();
    for (let i = 0; i < 8; i++) {
      ingest(a, easy({ firstTaps: [[0, 0.3], [0, 1], [0.2, 0]], turnMs: [1200, 2000, 6000], turns: [6, 8, 10], ms: 55_000, blocked: 4, mech: ['snow'], hour: 7 }), { replay: i < 3 });
    }
    for (let i = 0; i < 4; i++) ingest(a, quit({ mech: ['wind'], hints: 1, hintAfterMs: 20_000, hour: 7 }));
    a.sessions = { count: 5, ms: 5 * 3 * 60_000 };
    const p = playStyle(a);
    expect(p.scan).toMatchObject({ start: 'edges', vertical: 'top' });
    expect(p.bends.slowest).toBe(2);
    expect(p.bends.twoBendCost).toBeCloseTo(5, 5);
    expect(p.bends.twoShare).toBeGreaterThan(0.3);
    expect(p.speed.style).toBe('fast-loose');
    expect(p.favourites).toEqual(['snow']);
    expect(p.blindSpots).toEqual(['wind']);
    expect(p.mechanics.find((m) => m.id === 'wind')!.enjoyment).toBeLessThan(0);
    expect(p.assists).toMatchObject({ habit: 'sometimes', firstHintMs: 20_000 });
    expect(p.session).toMatchObject({ length: 'short', hour: 7 });
  });
});

// ───────────────────────────── Analytics service ─────────────────────────────

describe('analytics service (events → records)', () => {
  beforeEach(fresh);

  /** Play a board through its taps until cleared (or `pairs` pairs), emitting tap events. */
  function play(s: Session, pairs = Infinity, from = s.startedAt) {
    let t = from;
    for (let made = 0; made < pairs && !s.done; made++) {
      const m = s.findMove();
      if (!m) break;
      for (const cell of m) {
        t += 700;
        emit('tap', { session: s, cell, result: s.tap(cell, t), now: t });
      }
    }
    return t;
  }

  it('builds one record per cleared board and feeds the model', () => {
    const spec = { ...journeyLevel(30), tier: 3, difficulty: 0.31 };
    const s = new Session(spec, 1000);
    emit('start', { session: s });
    expect(tracking()).toBe(s);
    play(s);
    expect(s.done).toBe(true);
    emit('clear', { session: s, summary: { stars: 3, firstClear: true, petals: 0, drawn: null } });
    const a = save.analytics;
    expect(a.recent).toHaveLength(1);
    const r = a.recent[0];
    expect(r).toMatchObject({ mode: 'journey', n: 30, tier: 3, d: 0.31, cleared: true, ended: 'clear', stars: 3, made: s.totalPairs, pairs: s.totalPairs });
    expect(r.firstMs).toBe(1400);
    expect(r.gapMs).toBeGreaterThanOrEqual(1400);
    expect(r.firstTaps).toHaveLength(3);
    for (const [y, x] of r.firstTaps) expect(Math.min(y, x)).toBeGreaterThanOrEqual(0);
    expect(r.turns.reduce((x, y) => x + y, 0)).toBe(s.totalPairs);
    expect(r.ms).toBe(s.elapsedMs(s.finishedAt));
    expect(a.boards).toBe(1);
    expect(a.days).toHaveLength(1);
    expect(tracking()).toBeNull();
  });

  it('records path shapes, pair rhythm, the longest find and fast misreads', () => {
    const s = new Session({ ...journeyLevel(30), tier: 2 }, 0);
    emit('start', { session: s });
    // two blocked taps on a same-flower pair with no path: one quick, one after a long look
    const cells = s.board.cells;
    let blocked: [number, number] | null = null;
    for (let i = 0; i < cells.length && !blocked; i++)
      for (let j = i + 1; j < cells.length && !blocked; j++)
        if (cells[i] >= 0 && cells[j] >= 0 && monthOf(cells[i]) === monthOf(cells[j]) && !findPath(s.board, i, j) && !s.hidden.has(i) && !s.hidden.has(j) && !s.knots.has(i) && !s.knots.has(j)) blocked = [i, j];
    expect(blocked).not.toBeNull();
    const [i, j] = blocked!;
    const tap = (cell: number, t: number) => emit('tap', { session: s, cell, result: s.tap(cell, t), now: t });
    tap(i, 100);
    tap(j, 400);
    tap(i, 600);
    tap(j, 5000);
    play(s, Infinity, 5000);
    emit('clear', { session: s, summary: { stars: 3, firstClear: true, petals: 0, drawn: null } });
    const r = save.analytics.recent[0];
    expect(r.blocked).toBe(2);
    expect(r.quickMisses).toBe(1);
    // detours and rim routes always take two bends
    expect(r.detour![0]).toBeLessThanOrEqual(r.turns[2]);
    expect(r.edgeRoute![0]).toBeLessThanOrEqual(r.turns[2]);
    expect(r.edgeRoute![0]).toBeGreaterThan(0);
    expect(r.gapCv).toBeGreaterThanOrEqual(0);
    expect(r.longMs).toBeGreaterThanOrEqual(r.gapMs);
    expect(r.longMs).toBeGreaterThanOrEqual(r.firstMs);
  });

  it('records quits and restarts, counts failed tries and replays', () => {
    const spec = journeyLevel(31);
    const s = new Session(spec, 0);
    emit('start', { session: s });
    play(s, 3);
    emit('leave', { session: s, reason: 'restart' });
    const s2 = new Session(spec, 0);
    emit('start', { session: s2 });
    play(s2, 2);
    emit('leave', { session: s2, reason: 'quit' });
    const a = save.analytics;
    expect(a.recent.map((r) => r.ended)).toEqual(['quit', 'restart']);
    expect(a.recent[1].made).toBe(3);
    expect(a.tries).toEqual({ n: 31, count: 2 });
    // a replay of a cleared level counts as a replay for its mechanics
    save.stars[31] = 2;
    const s3 = new Session(spec, 0);
    emit('start', { session: s3 });
    play(s3);
    emit('clear', { session: s3, summary: { stars: 2, firstClear: false, petals: 0, drawn: null } });
    for (const m of a.recent[0].mech) expect(a.mech[m].replays).toBe(1);
  });

  it('skips Rush boards but counts the day', () => {
    const s = new Session(rushLevel('rush-1', 0), 0);
    emit('start', { session: s });
    play(s, 2);
    emit('leave', { session: s, reason: 'quit' });
    expect(save.analytics.recent).toHaveLength(0);
    expect(save.analytics.days).toHaveLength(1);
  });
});
