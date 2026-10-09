/**
 * Habit personas on real boards (EXPANSION_PLAN §C1): edge-scanner, centre-scanner,
 * bend-blind, rusher and hinter play the bank's real boards through the real rules,
 * the Director and the player model. Shows that each settles into the flow band
 * without ping-pong, gets harder boards later on the road, that the model reads each
 * habit, and that the hinter is not trapped on the gentlest tier.
 */
import { describe, expect, it } from 'vitest';
import { playerHabits } from '../src/director/profile';
import { type AnalyticsSave, defaultAnalytics } from '../src/services/save-analytics';
import { HABIT_PERSONAS, type HabitStep, type Style, simulateHabits } from './personas';

const SEEDS = ['h1', 'h2', 'h3'];
const BOARDS = 320;
/** boards before the band is judged (the model starts knowing nothing) */
const WARMUP = 60;
/** the settled stretch the tier-change counts are read from */
const LAST = 100;
/**
 * Ping-pong bound: A-B-A-B runs (tier t, t±1, t, t±1 on four boards in a row) in the
 * last 100 boards. A single A-B-A is a breath the pacing takes on purpose (relief after
 * a miss, a breather after each chapter's peak and festival, a stretch after an easy
 * streak): about one board in five at an 80 % clean rate. An A-B-A-B needs two such
 * breaths exactly two boards apart, which happens by chance about 100 × 0.2 × 0.2 ≈ 4
 * times per 100 boards. The bound, 8, is twice that; a controller that oscillates
 * (flipping tiers on measurement noise, say) scores 25+.
 */
const PING_PONG_MAX = 8;

interface Run {
  log: HabitStep[];
  a: AnalyticsSave;
}

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);

const ms: Record<string, number> = {};
function runs(style: Style): Run[] {
  const t0 = performance.now();
  const out = SEEDS.map((s) => {
    const a = defaultAnalytics();
    return { log: simulateHabits(HABIT_PERSONAS[style], `${style}-${s}`, BOARDS, a), a };
  });
  ms[style] = performance.now() - t0;
  return out;
}

function stats(rs: Run[], hinter: boolean) {
  const late = rs.flatMap((r) => r.log.slice(WARMUP));
  const clean = mean(late.map((s) => Number(hinter ? s.cleanForHabit : s.clean)));
  const strict = mean(late.map((s) => Number(s.clean)));
  const changes: number[] = [];
  const breaths: number[] = [];
  const pingPong: number[] = [];
  const settledTier: number[] = [];
  const early: number[] = [];
  const lateD: number[] = [];
  for (const { log } of rs) {
    const tail = log.slice(-LAST);
    changes.push(tail.filter((s, i) => i > 0 && s.tier !== tail[i - 1].tier).length);
    breaths.push(tail.filter((s, i) => i > 1 && s.tier === tail[i - 2].tier && s.tier !== tail[i - 1].tier).length);
    pingPong.push(tail.filter((s, i) => i > 2 && s.tier === tail[i - 2].tier && tail[i - 1].tier === tail[i - 3].tier && s.tier !== tail[i - 1].tier).length);
    settledTier.push(mean(tail.map((s) => s.tier)));
    early.push(mean(log.filter((s) => s.n > 6 && s.n <= 60).map((s) => s.d)));
    const top = log[log.length - 1].n;
    lateD.push(mean(log.filter((s) => s.n > top - 60).map((s) => s.d)));
  }
  return { clean, strict, changes, breaths, pingPong, settledTier, early, lateD, reached: rs.map((r) => r.log[r.log.length - 1].n) };
}

const STYLES: Style[] = ['edge', 'centre', 'bendBlind', 'rusher', 'hinter'];
const RUNS = Object.fromEntries(STYLES.map((s) => [s, runs(s)])) as Record<Style, Run[]>;
const STATS = Object.fromEntries(STYLES.map((s) => [s, stats(RUNS[s], s === 'hinter')])) as Record<Style, ReturnType<typeof stats>>;

describe('habit personas on real boards', () => {
  it('prints the table', () => {
    for (const s of STYLES) {
      const r = STATS[s];
      console.log(
        `[habits] ${s.padEnd(9)} clean ${(r.clean * 100).toFixed(1)}% (strict ${(r.strict * 100).toFixed(1)}%)  ` +
          `settled tier ${r.settledTier.map((t) => t.toFixed(2)).join('/')}  changes/${LAST} ${r.changes.join('/')}  A-B-A ${r.breaths.join('/')}  A-B-A-B ${r.pingPong.join('/')}  ` +
          `d early ${mean(r.early).toFixed(3)} → late ${mean(r.lateD).toFixed(3)}  reached ${r.reached.join('/')}  ${(ms[s] / 1000).toFixed(1)} s`,
      );
    }
  });

  for (const s of STYLES) {
    it(`${s}: settles in the 75–85 % clean band without ping-pong, and later chapters serve harder boards`, () => {
      const r = STATS[s];
      expect(r.clean).toBeGreaterThanOrEqual(0.75);
      expect(r.clean).toBeLessThanOrEqual(0.85);
      for (const p of r.pingPong) expect(p).toBeLessThanOrEqual(PING_PONG_MAX);
      // every tier move is one step (smooth), checked over the whole run
      for (const { log } of RUNS[s]) for (let i = 1; i < log.length; i++) expect(Math.abs(log[i].tier - log[i - 1].tier)).toBeLessThanOrEqual(1);
      r.early.forEach((e, i) => expect(r.lateD[i]).toBeGreaterThan(e + 0.05));
    });
  }

  it('the model reads each habit', () => {
    const h = (s: Style) => RUNS[s].map((r) => playerHabits(r.a));
    for (const x of h('edge')) expect(x.scan.start).toBe('edges');
    for (const x of h('centre')) expect(x.scan.start).toBe('centre');
    // detours and rim routes always take two bends, so they show up slow alongside
    for (const x of h('bendBlind')) {
      expect(x.slowShapes.map((s) => s.shape)).toContain('twoBend');
      expect(x.slowShapes.map((s) => s.shape)).not.toContain('straight');
      expect(x.slowShapes.map((s) => s.shape)).not.toContain('oneBend');
    }
    for (const r of RUNS.bendBlind) expect(r.a.shapes.twoBend!.r).toBeLessThan(r.a.shapes.straight!.r - 0.05);
    for (const x of h('rusher')) expect(x.tempo.style).toBe('rush');
    for (const x of h('hinter')) expect(x.assists.habitual).toBeGreaterThanOrEqual(1);
    for (const s of ['edge', 'centre', 'bendBlind', 'hinter'] as Style[]) for (const x of h(s)) expect(x.tempo.style, s).not.toBe('rush');
  });

  it('challenges rotate: the same focus never runs on two new boards in a row', () => {
    for (const s of STYLES) {
      for (const { log } of RUNS[s]) {
        const fresh = log.filter((x) => x.reason !== 'pinned' && x.reason !== 'relief-repin');
        const foci = fresh.map((x) => x.focus);
        for (let i = 1; i < foci.length; i++) if (foci[i] !== 'none') expect(foci[i]).not.toBe(foci[i - 1]);
        expect(foci.filter((f) => f !== 'none').length, s).toBeGreaterThan(fresh.length * 0.2);
      }
    }
  });

  it('the hinter is not pinned to the gentlest tier, and its ratings rise as it learns', () => {
    for (const { log, a } of RUNS.hinter) {
      const tail = log.slice(-LAST);
      expect(tail.filter((s) => s.tier === 0).length / tail.length).toBeLessThan(0.25);
      const early = mean(log.slice(WARMUP, WARMUP + 40).map((s) => s.rating));
      const late = mean(log.slice(-40).map((s) => s.rating));
      expect(late).toBeGreaterThan(early + 0.1);
      for (const k of ['straight', 'oneBend', 'twoBend'] as const) expect(a.shapes[k]!.r).toBeGreaterThan(early);
    }
  });
});
