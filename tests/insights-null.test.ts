/**
 * Null model for "Your play style": players whose skill is the same on every path
 * shape and every mechanic, with ordinary board-to-board jitter. Any sentence that
 * compares shapes or mechanics is then a false claim, and must stay rare.
 */
import { describe, expect, it } from 'vitest';
import { type Insight, playInsights, trendSeries, trendSummary } from '../src/director/insights';
import { ingest } from '../src/director/model';
import { designedBase } from '../src/director/plan';
import { type Mechanic } from '../src/engine/levels';
import { type AnalyticsSave, type BoardRecord, defaultAnalytics } from '../src/services/save-analytics';

const PLAYERS = 300;
/** the bound on players given any false comparison claim */
const FALSE_CLAIM_BOUND = 0.05;
const MET: Mechanic[] = ['stones', 'leaves', 'snow', 'wind'];

/** mulberry32: a small seeded generator, so the sim is the same on every run */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const logn = (r: () => number, s: number) => Math.exp(s * gauss(r));

/** One board for a player whose skill doesn't depend on shape or mechanic. */
/** `twoBend` scales the two-bend find time; `wind` makes boards with Wind harder (more quits, slower). */
function nullBoard(r: () => number, n: number, pace: number, real: { twoBend?: number; wind?: boolean } = {}): BoardRecord {
  const mech = MET.filter(() => r() < 0.45);
  const hard = !!real.wind && mech.includes('wind');
  const cleared = r() > (hard ? 0.3 : 0.08);
  const gap = Math.round(2500 * pace * logn(r, 0.2));
  const find = () => Math.round(gap * logn(r, 0.3));
  const hints = r() < 0.15 ? 1 : 0;
  const pairs = 24;
  return {
    mode: 'journey', n, tier: 2, d: Math.max(0, designedBase(n) + 0.03 * gauss(r)),
    mech,
    ms: Math.round(90_000 * pace * (hard ? 1.5 : 1) * logn(r, 0.25)), par: 90, pairs, made: cleared ? pairs : 6 + Math.floor(r() * 14), cleared,
    ended: cleared ? 'clear' : 'quit', stars: cleared ? 2 : 0, firstMs: 3000, gapMs: gap,
    blocked: Math.floor(r() * 4), reselects: 1, hints, shuffles: 0, autoShuffles: 0, bestCombo: 3, fever: 0,
    turns: [6 + Math.floor(r() * 5), 6 + Math.floor(r() * 5), 3 + Math.floor(r() * 5)], turnMs: [find(), find(), Math.round(find() * (real.twoBend ?? 1))],
    firstTaps: [[r(), r()], [r(), r()], [r(), r()]], hintAfterMs: hints ? 20_000 : -1, date: '2026-10-07', hour: 20,
    detour: [1 + Math.floor(r() * 4), find()], edgeRoute: [1 + Math.floor(r() * 4), find()], gapCv: 0.4, longMs: 0, quickMisses: 0,
  };
}

function nullPlayers(boards: number, real: { twoBend?: number; wind?: boolean } = {}): AnalyticsSave[] {
  const out: AnalyticsSave[] = [];
  for (let p = 0; p < PLAYERS; p++) {
    const r = rng(1000 + p);
    const pace = 0.8 + 0.4 * r();
    const a = defaultAnalytics();
    for (let i = 0; i < boards; i++) ingest(a, nullBoard(r, 20 + i, pace, real));
    out.push(a);
  }
  return out;
}

const comparison = (i: Insight) => i.key.startsWith('shape:') || i.key.startsWith('mech:');
const rate = (ps: AnalyticsSave[], pick: (xs: Insight[]) => boolean) => ps.filter((a) => pick(playInsights(a, MET))).length / ps.length;

describe('null model: identical skill everywhere', () => {
  for (const boards of [12, 20, 40]) {
    it(`false shape and mechanic claims stay under ${FALSE_CLAIM_BOUND * 100} % at ${boards} boards`, () => {
      const ps = nullPlayers(boards);
      const shapes = rate(ps, (xs) => xs.some((i) => i.key.startsWith('shape:') && i.key !== 'shape:even'));
      const mechs = rate(ps, (xs) => xs.some((i) => i.key.startsWith('mech:')));
      const any = rate(ps, (xs) => xs.some((i) => comparison(i) && i.key !== 'shape:even'));
      console.log(`null model, ${boards} boards: shape claims ${(shapes * 100).toFixed(1)} %, mechanic claims ${(mechs * 100).toFixed(1)} %, any ${(any * 100).toFixed(1)} %`);
      expect(any).toBeLessThan(FALSE_CLAIM_BOUND);
    });
  }

  it('"about equally well" needs every shape measured: never at 12 boards', () => {
    const even = rate(nullPlayers(12), (xs) => xs.some((i) => i.key === 'shape:even'));
    const even40 = rate(nullPlayers(40), (xs) => xs.some((i) => i.key === 'shape:even'));
    console.log(`null model: "even" ${(even * 100).toFixed(1)} % at 12 boards, ${(even40 * 100).toFixed(1)} % at 40 (true there: skill is the same on every shape)`);
    expect(even).toBe(0);
  });

  it('the trend line rarely claims a direction from noise once the rating has settled', () => {
    // Boards 41–80 at a fixed difficulty near the player's level: nothing to learn, only noise.
    let claims = 0;
    for (let p = 0; p < PLAYERS; p++) {
      const r = rng(5000 + p);
      const a = defaultAnalytics();
      for (let i = 0; i < 80; i++) ingest(a, { ...nullBoard(r, 40, 1), d: designedBase(40) });
      const tail = { ...a, trail: a.trail.slice(-40) };
      if (!/held steady/.test(trendSummary(trendSeries(tail), 40, a.dev))) claims++;
    }
    console.log(`null model, settled trend: direction claimed ${((claims / PLAYERS) * 100).toFixed(1)} %`);
    expect(claims / PLAYERS).toBeLessThan(FALSE_CLAIM_BOUND);
  });

  // The bounds above would be trivial if nothing were ever said: real differences still show.
  it('power: a real two-bend gap and a real Wind gap are still named', () => {
    const ps = nullPlayers(40, { twoBend: 2.5, wind: true });
    const shape = rate(ps, (xs) => xs.some((i) => i.key === 'shape:twoBend'));
    const wind = rate(ps, (xs) => xs.some((i) => i.key === 'mech:wind'));
    const wrong = rate(ps, (xs) => xs.some((i) => i.kind === 'edge' && i.key !== 'shape:twoBend' && i.key !== 'mech:wind'));
    // strengths here would be noise picks among the shapes read alike
    const shapeStrength = rate(ps, (xs) => xs.some((i) => i.kind === 'strength' && i.key.startsWith('shape:')));
    console.log(`real gaps, 40 boards: two-bend edge named ${(shape * 100).toFixed(1)} %, Wind edge named ${(wind * 100).toFixed(1)} %, a wrong edge ${(wrong * 100).toFixed(1)} %, a shape strength ${(shapeStrength * 100).toFixed(1)} %`);
    expect(shape).toBeGreaterThan(0.5);
    // Per-mechanic ratings separate slowly (a mechanic is on about half the boards), so a
    // real Wind gap is named for a minority by 40 boards; it must not be never.
    expect(wind).toBeGreaterThan(0.1);
    expect(wrong).toBeLessThan(FALSE_CLAIM_BOUND);
    expect(shapeStrength).toBeLessThan(FALSE_CLAIM_BOUND);
  });
});
