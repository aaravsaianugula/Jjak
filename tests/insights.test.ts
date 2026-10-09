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
import { type Mechanic } from '../src/engine/levels';
import { SKILL } from '../src/director/skills';
import { type AnalyticsSave, type BoardRecord, type MechanicStat, type SkillRating, TRAIL_CAP, defaultAnalytics, hydrateAnalytics } from '../src/services/save-analytics';

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
const MET: Mechanic[] = ['stones', 'leaves', 'snow', 'lucky', 'wind', 'knots'];
const texts = (h: PlayerHabits, a = defaultAnalytics(), met: readonly Mechanic[] = MET) => insightsFrom(h, a, met).map((i) => i.text);
const keys = (h: PlayerHabits, a: AnalyticsSave, met: readonly Mechanic[] = MET) => insightsFrom(h, a, met).map((i) => i.key);
/** a skill rating at this confidence */
const sk = (r: number, conf: number, n = 12): SkillRating => ({ r, dev: devFor(conf), n });
/** the gap two skills at this confidence need before one is named over the other */
const sig = (conf: number) => INSIGHT.zShape * Math.sqrt(2) * devFor(conf);
/** recent boards (quick, clean clears) that featured these mechanics */
const withRecent = (a: AnalyticsSave, mech: string[], count = INSIGHT.recentWindow) => {
  a.recent = Array.from({ length: count }, (_, i) => rec({ n: 60 - i, mech }));
  return a;
};
const C = 0.9;

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

  it('tempo speaks only at high confidence, in words that match what is measured, never about freezing', () => {
    expect(texts(habits({ tempo: { style: 'rush', misreadRate: 0.3, confidence: INSIGHT.tempoConf } }))).toEqual([
      'You play with quick hands. A breath before the second tap saves a misread.',
    ]);
    // a misread rate under 0.2 per pair: more than half the pairs had no blocked tap at all
    expect(texts(habits({ tempo: { style: 'balanced', misreadRate: 0.1, confidence: 1 } }))).toEqual(['Most of your pairs come without a misread.']);
    expect(texts(habits({ tempo: { style: 'freeze', misreadRate: 0.1, confidence: 1 } }))).toEqual(['Most of your pairs come without a misread.']);
    expect(texts(habits({ tempo: { style: 'rush', misreadRate: 0.3, confidence: INSIGHT.tempoConf - 0.01 } }))).toEqual([]);
    expect(texts(habits({ tempo: { style: 'balanced', misreadRate: 0.1, confidence: INSIGHT.tempoConf - 0.01 } }))).toEqual([]);
  });

  it('assists: hints and shuffles on quick clears, read over the same window as their confidence', () => {
    const quick = (assisted: number, total: number, o: Partial<BoardRecord> = { hints: 1 }) => {
      const a = defaultAnalytics();
      a.recent = Array.from({ length: total }, (_, i) => rec({ n: 60 - i, ...(i < assisted ? o : {}) }));
      return texts(blank(), a);
    };
    expect(quick(6, 10)).toEqual(['You take a hint or shuffle on many of your quick clears.']);
    expect(quick(6, 10, { shuffles: 1 })).toEqual(['You take a hint or shuffle on many of your quick clears.']);
    expect(quick(2, 10)).toEqual(['Most of your quick clears come with no hint or shuffle.']);
    // in between says nothing
    expect(quick(4, 10)).toEqual([]);
    // too few quick clears in the window
    expect(quick(0, INSIGHT.assistMin - 1)).toEqual([]);
    expect(quick(0, INSIGHT.assistMin)).toEqual(['Most of your quick clears come with no hint or shuffle.']);
    // only the most recent window counts: older assisted boards fall out of it
    const a = defaultAnalytics();
    a.recent = [
      ...Array.from({ length: INSIGHT.assistWindow }, (_, i) => rec({ n: 90 - i })),
      ...Array.from({ length: 15 }, (_, i) => rec({ n: 60 - i, hints: 2 })),
    ];
    expect(texts(blank(), a)).toEqual(['Most of your quick clears come with no hint or shuffle.']);
    // boards well over par are not quick clears
    const slow = defaultAnalytics();
    slow.recent = Array.from({ length: 10 }, (_, i) => rec({ n: 60 - i, ms: 120_000 }));
    expect(texts(blank(), slow)).toEqual([]);
  });
});

describe('path shapes: named only on a gap clearly beyond the ratings’ own uncertainty', () => {
  const base = () => {
    const a = defaultAnalytics();
    a.rating = 0.4;
    return a;
  };
  const slow = (shape: string, conf = C) => ({ shape: shape as never, costRatio: 2, rating: 0.3, confidence: conf });

  it('a slow shape rated clearly lower is the growth edge; a clearly higher one, not slow, the strength', () => {
    const a = base();
    a.shapes = { straight: sk(0.4 + sig(C) + 0.001, C), oneBend: sk(0.4, C), twoBend: sk(0.4 - 0.001, C) };
    const out = insightsFrom(habits({ slowShapes: [slow('twoBend')] }), a, MET);
    expect(out).toContainEqual({ kind: 'strength', key: 'shape:straight', text: 'You read straight paths fast.' });
    expect(out).toContainEqual({ kind: 'edge', key: 'shape:twoBend', text: 'Two-bend routes are your growth edge.' });
  });

  it('a strength stands out from the typical shape, not just from the growth edge', () => {
    const a = base();
    // straight and one-bend read alike, two-bend clearly lower: which of the two leads is noise
    a.shapes = { straight: sk(0.4 + sig(C) + 0.002, C), oneBend: sk(0.4 + sig(C), C), twoBend: sk(0.4, C) };
    expect(keys(habits({ slowShapes: [slow('twoBend')] }), a)).toEqual(['shape:twoBend']);
  });

  it('noise-level spreads name nothing', () => {
    const a = base();
    a.shapes = { straight: sk(0.4 + sig(C) - 0.001, C), oneBend: sk(0.42, C), twoBend: sk(0.4, C) };
    expect(keys(habits({ slowShapes: [slow('twoBend')] }), a)).toEqual([]);
  });

  it('the edge needs both signals: a long find time and a clearly lower rating', () => {
    const a = base();
    a.shapes = { straight: sk(0.4 + sig(C) + 0.001, C), twoBend: sk(0.4, C) };
    // lower rating, but no long find time: only the strength is said
    expect(keys(blank(), a)).toEqual(['shape:straight']);
    // a long find time, but the rating isn't clearly lower: nothing
    a.shapes = { straight: sk(0.43, C), twoBend: sk(0.4, C) };
    expect(keys(habits({ slowShapes: [slow('twoBend')] }), a)).toEqual([]);
    // a long find time read with too little confidence: no edge
    a.shapes = { straight: sk(0.4 + sig(C) + 0.001, C), twoBend: sk(0.4, C) };
    expect(keys(habits({ slowShapes: [slow('twoBend', INSIGHT.compareConf - 0.01)] }), a)).toEqual(['shape:straight']);
  });

  it('never "You read X fast" while X itself takes long to find', () => {
    const a = base();
    a.shapes = { straight: sk(0.4 + sig(C) + 0.001, C), twoBend: sk(0.4, C) };
    // straight is rated highest yet its own finds run long (at any confidence): no strength
    const out = keys(habits({ slowShapes: [slow('twoBend'), { shape: 'straight', costRatio: 1.4, rating: 0.5, confidence: 0.2 }] }), a);
    expect(out).not.toContain('shape:straight');
    expect(out).toEqual(['shape:twoBend']);
  });

  it('"about equally well" needs all five shapes well measured and a spread well inside their deviations', () => {
    const a = base();
    const all = (r: (i: number) => number, n = INSIGHT.evenMin, conf = INSIGHT.evenConf) =>
      Object.fromEntries(['straight', 'oneBend', 'twoBend', 'detour', 'edge'].map((k, i) => [k, sk(r(i), conf, n)]));
    a.shapes = all((i) => 0.4 + i * 0.002);
    expect(keys(blank(), a)).toEqual(['shape:even']);
    expect(insightsFrom(blank(), a, MET)[0].text).toBe('You read every path shape about equally well.');
    // four shapes are not every shape
    delete a.shapes.edge;
    expect(keys(blank(), a)).toEqual([]);
    // too few boards each, or too unsure
    a.shapes = all((i) => 0.4 + i * 0.002, INSIGHT.evenMin - 1);
    expect(keys(blank(), a)).toEqual([]);
    a.shapes = all((i) => 0.4 + i * 0.002, INSIGHT.evenMin, INSIGHT.evenConf - 0.01);
    expect(keys(blank(), a)).toEqual([]);
    // a spread as wide as the deviations is not "equal", and not a named gap either
    const sd = Math.sqrt(2) * devFor(INSIGHT.evenConf);
    a.shapes = all((i) => 0.4 + (i === 0 ? sd : 0));
    expect(keys(blank(), a)).toEqual([]);
    // any shape with long finds rules it out
    a.shapes = all(() => 0.4);
    expect(keys(habits({ slowShapes: [slow('detour', 0.1)] }), a)).toEqual([]);
  });

  it('below the comparison confidence nothing is compared', () => {
    const c = INSIGHT.compareConf - 0.01;
    const a = base();
    a.shapes = { straight: sk(0.8, c), twoBend: sk(0.2, c) };
    expect(keys(habits({ slowShapes: [slow('twoBend', 1)] }), a)).toEqual([]);
  });
});

describe('mechanics: clearly above or below the overall rating, met and recently played', () => {
  const S = () => INSIGHT.zMech * Math.sqrt(devFor(C) ** 2 + devFor(C) ** 2);
  const setup = (above: number, below: number) => {
    const a = defaultAnalytics();
    a.rating = 0.4;
    a.dev = devFor(C);
    a.mech = { snow: stat(0.4 + above, C, 10), wind: stat(0.4 - below, C, 10) };
    return withRecent(a, ['snow', 'wind']);
  };

  it('names the strength and the growth edge past the combined deviation', () => {
    const out = insightsFrom(blank(), setup(S() + 0.001, S() + 0.001), MET);
    expect(out).toContainEqual({ kind: 'strength', key: 'mech:snow', text: 'You’re at home with First snow.' });
    expect(out).toContainEqual({ kind: 'edge', key: 'mech:wind', text: 'Boards with Wind are your growth edge. The Practice room has gentle ones to try.' });
    // the sentence and the band agree
    expect(masteryBand(setup(S() + 0.001, 0).mech.snow, 0.4, devFor(C))).toBe('home');
    expect(masteryBand(setup(0, S() + 0.001).mech.wind, 0.4, devFor(C))).toBe('learning');
  });

  it('noise-level gaps name nothing', () => {
    expect(keys(blank(), setup(S() - 0.001, S() - 0.001)).filter((x) => x.startsWith('mech:'))).toEqual([]);
  });

  it('a stale mechanic is never the growth edge', () => {
    const a = setup(0, S() + 0.05);
    withRecent(a, ['snow']);
    a.recent[3].mech = ['wind']; // once in the window is not enough
    expect(keys(blank(), a)).not.toContain('mech:wind');
    a.recent[9].mech = ['wind'];
    expect(keys(blank(), a)).toContain('mech:wind');
    // boards older than the window don't count
    withRecent(a, ['snow'], INSIGHT.recentWindow);
    a.recent.push(rec({ mech: ['wind'] }), rec({ mech: ['wind'] }), rec({ mech: ['wind'] }));
    expect(keys(blank(), a)).not.toContain('mech:wind');
  });

  it('only mechanics met on the road are named (the Practice room has them)', () => {
    const k = keys(blank(), setup(S() + 0.01, S() + 0.01), ['stones', 'leaves']);
    expect(k.filter((x) => x.startsWith('mech:'))).toEqual([]);
  });

  it('too unsure or too few boards: nothing', () => {
    const a = setup(S() + 0.08, S() + 0.08);
    a.mech.snow.dev = devFor(INSIGHT.compareConf - 0.01);
    a.mech.wind.n = INSIGHT.mechMin - 1;
    expect(keys(blank(), a).filter((x) => x.startsWith('mech:'))).toEqual([]);
  });

  it('prototype names are never read as mechanics', () => {
    const a = setup(0, 0);
    a.mech = { constructor: stat(0.9, 1, 20), toString: stat(0.1, 1, 20) };
    withRecent(a, ['constructor', 'toString']);
    const odd = ['constructor', 'toString'] as unknown as Mechanic[];
    expect(keys(blank(), a, odd).filter((x) => x.startsWith('mech:'))).toEqual([]);
  });
});

describe('wording', () => {
  it('never calls the player weak, bad or slow', () => {
    const a = defaultAnalytics();
    a.rating = 0.4;
    a.dev = devFor(1);
    a.shapes = { straight: sk(0.7, 1), detour: sk(0.3, 1), edge: sk(0.32, 1) };
    a.mech = { snow: stat(0.7, 1, 10), knots: stat(0.1, 1, 10) };
    withRecent(a, ['snow', 'knots']);
    const h = habits({
      scan: { start: 'centre', vertical: 'bottom', confidence: 1 },
      slowShapes: [{ shape: 'detour', costRatio: 3, rating: 0.3, confidence: 1 }],
      tempo: { style: 'rush', misreadRate: 0.4, confidence: 1 },
    });
    const all = insightsFrom(h, a, MET);
    expect(all.map((i) => i.key)).toEqual(expect.arrayContaining(['shape:straight', 'mech:snow', 'shape:detour', 'mech:knots']));
    expect(all.length).toBeLessThanOrEqual(INSIGHT.max);
    for (const i of all) expect(i.text).not.toMatch(/\b(weak|bad|slow|poor|fail)/i);
  });
});

describe('low confidence gives no claim', () => {
  it('every habit below its confidence floor is silent', () => {
    const c = INSIGHT.minConf - 0.01;
    const a = defaultAnalytics();
    a.rating = 0.4;
    a.shapes = { straight: sk(0.9, c), twoBend: sk(0.1, c), oneBend: sk(0.4, c) };
    a.mech = { snow: stat(0.9, c) };
    const h = habits({
      scan: { start: 'edges', vertical: 'top', confidence: c },
      slowShapes: [{ shape: 'twoBend', costRatio: 2.5, rating: 0.3, confidence: c }],
      tempo: { style: 'rush', misreadRate: 0.5, confidence: INSIGHT.tempoConf - 0.01 },
    });
    expect(insightsFrom(h, a, MET)).toEqual([]);
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

  it('a real history reads through: an edge scanner much slower on two-bend routes', () => {
    const a = history({ firstTaps: [[0, 0.4], [1, 0.6], [0.5, 0]], turnMs: [1800, 2200, 7000], gapMs: 2300 }, 40);
    const k = playInsights(a, MET).map((i) => i.key);
    expect(k).toContain('scan');
    expect(k).toContain('shape:twoBend');
    expect(playStyleReport(a, []).note).toBeNull();
  });
});

describe('mastery bands', () => {
  const R = 0.4;
  const D = devFor(C);
  /** the deviation a mechanic at confidence c and the overall rating share */
  const sd = (c: number) => Math.sqrt(devFor(c) ** 2 + D ** 2);
  it('new until played, learning while unsure or clearly behind, at home when sure and within its deviation', () => {
    expect(masteryBand(undefined, R, D)).toBe('new');
    expect(masteryBand({ ...stat(0.5, 1), n: 0 }, R, D)).toBe('new');
    expect(masteryBand(stat(0.5, MASTERY.steadyConf - 0.01), R, D)).toBe('learning');
    expect(masteryBand(stat(0.5, MASTERY.steadyConf + 1e-9), R, D)).toBe('steady');
    expect(masteryBand(stat(R - INSIGHT.zMech * sd(1) - 0.001, 1), R, D)).toBe('learning');
    expect(masteryBand(stat(R - INSIGHT.zMech * sd(1) + 0.001, 1), R, D)).toBe('steady');
    expect(masteryBand(stat(R - MASTERY.homeWithin * sd(1) - 0.001, 1), R, D)).toBe('steady');
    expect(masteryBand(stat(R - MASTERY.homeWithin * sd(1) + 0.001, 1), R, D)).toBe('home');
    expect(masteryBand(stat(R, MASTERY.homeConf - 0.01), R, D)).toBe('steady');
    expect(masteryBand(stat(R, MASTERY.homeConf + 1e-9), R, D)).toBe('home');
  });

  it('the report lists met mechanics in order, with their seal and name', () => {
    const a = defaultAnalytics();
    a.rating = R;
    a.dev = D;
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
    a.trail = Array.from({ length: INSIGHT.trendDraw - 1 }, (_, i) => 0.3 + i / 100);
    expect(trendSeries(a)).toEqual([]);
    // a save edited by hand: NaN never reaches the series
    a.trail = [0.3, NaN, 0.31, 0.32, Infinity, 0.33, 0.34, 0.35, 0.36, 0.37] as number[];
    expect(trendSeries(a)).toEqual([0.3, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.37]);
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

  it('the summary names a direction only past the noise, and only with enough boards', () => {
    const rise = (move: number) => [0.3, 0.3, 0.3 + move / 2, 0.3 + move / 2, 0.3 + move, 0.3 + move];
    const dev = 0.05; // the rating's floor: the move threshold is the larger of trendMove and trendZ · dev
    const t = Math.max(INSIGHT.trendMove, INSIGHT.trendZ * dev);
    expect(trendSummary(rise(t + 0.001), 30, dev)).toBe('Your skill line has risen over your last 30 boards.');
    expect(trendSummary(rise(t - 0.001), 30, dev)).toBe('Your skill line has held steady over your last 30 boards.');
    expect(trendSummary(rise(-t - 0.001), 30, dev)).toBe('Your skill line has eased a little over your last 30 boards.');
    // an unsure rating needs a bigger move
    expect(trendSummary(rise(t + 0.001), 30, 0.2)).toBe('Your skill line has held steady over your last 30 boards.');
    // too few boards to say which way: the line is described, not read
    expect(trendSummary(rise(0.3), INSIGHT.trendClaim - 1, dev)).toBe(`Your skill line over your last ${INSIGHT.trendClaim - 1} boards.`);
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
