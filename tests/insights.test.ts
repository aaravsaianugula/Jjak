/**
 * "Your play style": the insight rules over the on-device player model
 * (src/director/insights.ts). Synthetic analytics in, plain sentences out; a claim
 * only where the evidence carries it.
 */
import { describe, expect, it } from 'vitest';
import {
  INSIGHT,
  MASTERY,
  bestRuns,
  insightsFrom,
  masteryBand,
  playInsights,
  playStyleReport,
  trendLine,
  trendSeries,
  trendSummary,
} from '../src/director/insights';
import { ingest } from '../src/director/model';
import { designedBase } from '../src/director/plan';
import { type PlayerHabits } from '../src/director/profile';
import { SKILL } from '../src/director/skills';
import { type AnalyticsSave, type BoardRecord, type MechanicStat, TRAIL_CAP, defaultAnalytics, hydrateAnalytics } from '../src/services/save-analytics';

const rec = (o: Partial<BoardRecord> = {}): BoardRecord => ({
  mode: 'journey', n: 40, tier: 2, d: designedBase(40), mech: [], ms: 80_000, par: 90, pairs: 24, made: 24, cleared: true, ended: 'clear',
  stars: 3, firstMs: 3000, gapMs: 2500, blocked: 1, reselects: 1, hints: 0, shuffles: 0, autoShuffles: 0, bestCombo: 3, fever: 0,
  turns: [8, 10, 6], turnMs: [2400, 2500, 2600], firstTaps: [[0.4, 0.5], [0.6, 0.4], [0.5, 0.5]], hintAfterMs: -1, date: '2026-10-07', hour: 20,
  detour: [3, 2600], edgeRoute: [4, 2500], gapCv: 0.45, longMs: 6000, quickMisses: 0, ...o,
});

function history(o: Partial<BoardRecord>, count = 20, a: AnalyticsSave = defaultAnalytics()): AnalyticsSave {
  for (let i = 0; i < count; i++) ingest(a, rec({ n: 30 + i, d: designedBase(30 + i), ...o }));
  return a;
}

/** Habits with nothing known: every field unknown, every confidence 0. */
const blank = (): PlayerHabits => ({
  boards: 0,
  scan: { edge: 0, centre: 0, top: 0, bottom: 0, start: 'unknown', vertical: 'unknown', samples: 0, confidence: 0 },
  slowShapes: [],
  weakMechanics: [],
  tempo: { style: 'unknown', misreadRate: 0, thinkMs: 0, longRatio: 0, confidence: 0 },
  assists: { habitual: 0, confidence: 0 },
  flow: 'flow',
});
const habits = (o: { [K in keyof PlayerHabits]?: Partial<PlayerHabits[K]> | PlayerHabits[K] }): PlayerHabits => {
  const b = blank();
  return {
    ...b,
    ...o,
    scan: { ...b.scan, ...(o.scan as object) },
    tempo: { ...b.tempo, ...(o.tempo as object) },
    assists: { ...b.assists, ...(o.assists as object) },
  } as PlayerHabits;
};
/** a skill whose deviation gives this confidence */
// (+1e-9 at a boundary below: confidence round-trips through dev in floating point)
const devFor = (conf: number) => SKILL.devStart - conf * (SKILL.devStart - SKILL.devMin);
const stat = (r: number, conf: number, n = 6): MechanicStat => ({ n, score: 0.7, quits: 0, replays: 0, r, dev: devFor(conf) });
const texts = (h: PlayerHabits, a = defaultAnalytics()) => insightsFrom(h, a).map((i) => i.text);

describe('habit sentences', () => {
  it('scan region: edges, centre, top, bottom, and both together', () => {
    expect(texts(habits({ scan: { start: 'edges', confidence: 0.8 } }))).toEqual(['You begin at the edges of the board.']);
    expect(texts(habits({ scan: { start: 'centre', confidence: 0.8 } }))).toEqual(['You begin in the middle of the board.']);
    expect(texts(habits({ scan: { vertical: 'top', confidence: 0.8 } }))).toEqual(['Your eye starts near the top of the board.']);
    expect(texts(habits({ scan: { vertical: 'bottom', confidence: 0.8 } }))).toEqual(['Your eye starts near the bottom of the board.']);
    expect(texts(habits({ scan: { start: 'edges', vertical: 'top', confidence: 0.8 } }))).toEqual(['You begin at the edges of the board, mostly near the top.']);
    // no pattern is not a habit
    expect(texts(habits({ scan: { start: 'mixed', vertical: 'mixed', confidence: 1 } }))).toEqual([]);
  });

  it('slow path shape becomes the growth edge; the strongest confident shape the strength', () => {
    const a = defaultAnalytics();
    a.rating = 0.4;
    a.shapes = { straight: { r: 0.46, dev: devFor(0.8), n: 10 }, oneBend: { r: 0.41, dev: devFor(0.8), n: 10 }, twoBend: { r: 0.36, dev: devFor(0.8), n: 10 } };
    const h = habits({ slowShapes: [{ shape: 'twoBend', costRatio: 2.2, rating: 0.36, confidence: 0.8 }] });
    const out = insightsFrom(h, a);
    expect(out).toContainEqual({ kind: 'strength', key: 'shape:straight', text: 'You read straight paths fast.' });
    expect(out).toContainEqual({ kind: 'edge', key: 'shape:twoBend', text: 'Two-bend routes are your growth edge.' });
  });

  it('even shapes read as even, with no edge invented', () => {
    const a = defaultAnalytics();
    a.rating = 0.4;
    a.shapes = { straight: { r: 0.41, dev: devFor(0.8), n: 10 }, oneBend: { r: 0.4, dev: devFor(0.8), n: 10 }, twoBend: { r: 0.395, dev: devFor(0.8), n: 10 } };
    const out = insightsFrom(blank(), a);
    expect(out.map((i) => i.key)).toEqual(['shape:even']);
    expect(out[0].text).toBe('You read every path shape about equally well.');
  });

  it('mechanics: at home above the overall rating, a growth edge below it', () => {
    const a = defaultAnalytics();
    a.rating = 0.4;
    a.mech = { snow: stat(0.45, 0.8), wind: stat(0.33, 0.8) };
    const h = habits({ weakMechanics: [{ id: 'wind', rating: 0.33, gap: -0.07, confidence: 0.8 }] });
    const out = insightsFrom(h, a);
    expect(out).toContainEqual({ kind: 'strength', key: 'mech:snow', text: 'You’re at home with First snow.' });
    expect(out).toContainEqual({ kind: 'edge', key: 'mech:wind', text: 'Boards with Wind are your growth edge. The Practice room has gentle ones to try.' });
    // "at home" in words only where the mastery band says "at home" too
    a.mech = { snow: stat(0.45, MASTERY.homeConf - 0.05) };
    expect(masteryBand(a.mech.snow, a.rating)).toBe('steady');
    expect(insightsFrom(blank(), a)).toEqual([]);
    // ids the game no longer knows are skipped, never printed raw
    a.mech = { comet: stat(0.5, 1) };
    expect(texts(habits({ weakMechanics: [{ id: 'meteor', rating: 0.3, gap: -0.1, confidence: 1 }] }), a)).toEqual([]);
  });

  it('tempo speaks only at high confidence, and never about freezing', () => {
    expect(texts(habits({ tempo: { style: 'rush', confidence: INSIGHT.tempoConf } }))).toEqual([
      'You play with quick hands. A breath before the second tap saves a misread.',
    ]);
    expect(texts(habits({ tempo: { style: 'balanced', confidence: 1 } }))).toEqual(['You read before you tap, with few misreads.']);
    expect(texts(habits({ tempo: { style: 'rush', confidence: INSIGHT.tempoConf - 0.01 } }))).toEqual([]);
    expect(texts(habits({ tempo: { style: 'freeze', confidence: 1 } }))).toEqual([]);
  });

  it('assist habit, both ways', () => {
    expect(texts(habits({ assists: { habitual: 1, confidence: 0.6 } }))).toEqual(['A hint now and then is part of your rhythm, and you still clear quickly.']);
    expect(texts(habits({ assists: { habitual: 0, confidence: 0.6 } }))).toEqual(['Your quick clears mostly come without a hint.']);
  });

  it('never calls the player weak, bad or slow', () => {
    const a = defaultAnalytics();
    a.rating = 0.4;
    a.shapes = { straight: { r: 0.5, dev: devFor(1), n: 10 }, detour: { r: 0.3, dev: devFor(1), n: 10 }, edge: { r: 0.32, dev: devFor(1), n: 10 } };
    a.mech = { snow: stat(0.5, 1), knots: stat(0.3, 1) };
    const h = habits({
      scan: { start: 'centre', vertical: 'bottom', confidence: 1 },
      slowShapes: [{ shape: 'detour', costRatio: 3, rating: 0.3, confidence: 1 }],
      weakMechanics: [{ id: 'knots', rating: 0.3, gap: -0.1, confidence: 1 }],
      tempo: { style: 'rush', confidence: 1 },
      assists: { habitual: 2, confidence: 1 },
    });
    const all = insightsFrom(h, a);
    expect(all.length).toBeLessThanOrEqual(INSIGHT.max);
    for (const i of all) expect(i.text).not.toMatch(/\b(weak|bad|slow|poor|fail)/i);
  });
});

describe('low confidence gives no claim', () => {
  it('every habit below the confidence floor is silent', () => {
    const c = INSIGHT.minConf - 0.01;
    const a = defaultAnalytics();
    a.rating = 0.4;
    a.shapes = { straight: { r: 0.5, dev: devFor(c), n: 10 }, twoBend: { r: 0.3, dev: devFor(c), n: 10 }, oneBend: { r: 0.4, dev: devFor(c), n: 10 } };
    a.mech = { snow: stat(0.5, c) };
    const h = habits({
      scan: { start: 'edges', vertical: 'top', confidence: c },
      slowShapes: [{ shape: 'twoBend', costRatio: 2.5, rating: 0.3, confidence: c }],
      weakMechanics: [{ id: 'wind', rating: 0.3, gap: -0.1, confidence: c }],
      assists: { habitual: 1, confidence: c },
    });
    expect(insightsFrom(h, a)).toEqual([]);
  });

  it('a new player gets the empty state, a thin history the gentle note', () => {
    const fresh = playStyleReport(defaultAnalytics(), []);
    expect(fresh.empty).toBe(true);
    expect(fresh.insights).toEqual([]);
    const thin = playStyleReport(history({}, 2), []);
    expect(thin.empty).toBe(false);
    expect(thin.insights).toEqual([]);
    expect(thin.note).toMatch(/few more boards/);
  });

  it('a real history reads through: an edge scanner slow on two-bend routes', () => {
    const a = history({ firstTaps: [[0, 0.4], [1, 0.6], [0.5, 0]], turnMs: [1800, 2200, 7000], gapMs: 2300 }, 24);
    const keys = playInsights(a).map((i) => i.key);
    expect(keys).toContain('scan');
    expect(keys).toContain('shape:twoBend');
    expect(playStyleReport(a, []).note).toBeNull();
  });
});

describe('mastery bands', () => {
  const R = 0.4;
  it('new until played, learning while unsure or behind, at home when sure and level', () => {
    expect(masteryBand(undefined, R)).toBe('new');
    expect(masteryBand({ ...stat(0.5, 1), n: 0 }, R)).toBe('new');
    expect(masteryBand(stat(0.5, MASTERY.steadyConf - 0.01), R)).toBe('learning');
    expect(masteryBand(stat(0.5, MASTERY.steadyConf + 1e-9), R)).toBe('steady');
    expect(masteryBand(stat(R - MASTERY.gap - 0.001, 1), R)).toBe('learning');
    expect(masteryBand(stat(R - MASTERY.gap + 0.001, 1), R)).toBe('steady');
    expect(masteryBand(stat(R, MASTERY.homeConf - 0.01), R)).toBe('steady');
    expect(masteryBand(stat(R, MASTERY.homeConf + 1e-9), R)).toBe('home');
    expect(masteryBand(stat(R - 0.001, 1), R)).toBe('steady');
  });

  it('the report lists met mechanics in order, with their seal and name', () => {
    const a = defaultAnalytics();
    a.rating = R;
    a.mech = { snow: stat(0.45, 0.9) };
    expect(playStyleReport(a, ['stones', 'snow']).mastery).toEqual([
      { id: 'stones', name: 'Stones', glyph: '石', band: 'new' },
      { id: 'snow', name: 'First snow', glyph: '雪', band: 'home' },
    ]);
  });
});

describe('skill trend', () => {
  it('ingest keeps a capped trail of the rating after each rated board', () => {
    const a = history({}, 5);
    expect(a.trail).toHaveLength(5);
    expect(a.trail[4]).toBeCloseTo(a.rating, 3);
    ingest(a, rec({ mode: 'rush' }));
    expect(a.trail).toHaveLength(5);
    history({}, TRAIL_CAP + 10, a);
    expect(a.trail).toHaveLength(TRAIL_CAP);
  });

  it('old saves hydrate to an empty trail; junk entries are dropped', () => {
    expect(hydrateAnalytics({ rating: 0.4 }).trail).toEqual([]);
    expect(hydrateAnalytics({ trail: 'x' }).trail).toEqual([]);
    expect(hydrateAnalytics({ trail: [0.3, NaN, null, 'a', 0.31, Infinity, 9, -1, 0.32] }).trail).toEqual([0.3, 0.31, 1.5, 0, 0.32]);
  });

  it('downsamples to at most the chart size, finite, keeping the shape', () => {
    const a = defaultAnalytics();
    a.trail = Array.from({ length: 100 }, (_, i) => 0.3 + i / 1000);
    const s = trendSeries(a);
    expect(s.length).toBe(INSIGHT.trendPoints);
    expect(s.every(Number.isFinite)).toBe(true);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
    expect(s[0]).toBeCloseTo(0.302, 2);
    expect(s[s.length - 1]).toBeCloseTo(0.397, 2);
    // too short to draw a line
    a.trail = [0.3, 0.31, 0.32, 0.33];
    expect(trendSeries(a)).toEqual([]);
    // a save edited by hand: NaN never reaches the series
    a.trail = [0.3, NaN, 0.31, 0.32, Infinity, 0.33, 0.34] as number[];
    expect(trendSeries(a)).toEqual([0.3, 0.31, 0.32, 0.33, 0.34]);
  });

  it('the line is a finite path inside the box, flat when steady', () => {
    const d = trendLine([0.3, 0.35, 0.33, 0.4], 300, 100, 6);
    expect(d.startsWith('M')).toBe(true);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(nums.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i]).toBeGreaterThanOrEqual(0);
      expect(nums[i]).toBeLessThanOrEqual(300);
      expect(nums[i + 1]).toBeGreaterThanOrEqual(0);
      expect(nums[i + 1]).toBeLessThanOrEqual(100);
    }
    const flatLine = trendLine([0.4, 0.4, 0.4], 300, 100, 6);
    expect(flatLine).not.toMatch(/NaN|Infinity/);
    // a steady rating draws a level line across the middle
    expect(flatLine).toBe('M6 50 L150 50 L294 50');
    expect(trendLine([], 300, 100, 6)).toBe('');
  });

  it('the summary names the direction in calm words', () => {
    expect(trendSummary([0.3, 0.31, 0.33, 0.35, 0.37, 0.38], 30)).toBe('Your skill line has risen over your last 30 boards.');
    expect(trendSummary([0.4, 0.41, 0.4, 0.405, 0.4, 0.41], 12)).toBe('Your skill line has held steady over your last 12 boards.');
    expect(trendSummary([0.45, 0.44, 0.42, 0.4, 0.39, 0.38], 12)).toBe('Your skill line has eased a little over your last 12 boards. It often lifts again after a few calm boards.');
  });
});

describe('best runs', () => {
  const base = {
    stats: { pairs: 0, clears: 0, bestCombo: 0, zenBoards: 0, cleanClears: 0, fastClears: 0, bestDailyMs: 0 },
    daily: { best: 0 },
    rush: { best: 0 },
  };
  it('shows only what has happened', () => {
    expect(bestRuns(base)).toEqual([]);
  });
  it('labels and formats each record', () => {
    const runs = bestRuns({
      stats: { ...base.stats, bestCombo: 5, cleanClears: 1, fastClears: 12, bestDailyMs: 83_400 },
      daily: { best: 9 },
      rush: { best: 1450 },
    });
    expect(runs.map((r) => [r.key, r.value])).toEqual([
      ['combo', '×5'],
      ['daily', '1:23'],
      ['streak', '9 days'],
      ['clean', '1 board'],
      ['par', '12 boards'],
      ['rush', '1,450'],
    ]);
  });
});
