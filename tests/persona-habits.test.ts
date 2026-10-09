/**
 * Habit personas on real boards (EXPANSION_PLAN §C1): edge-scanner, centre-scanner,
 * bend-blind, rusher and hinter play the bank's real boards through the real rules,
 * the Director and the player model.
 *
 * Every claim is checked against a control so it depends on the policy: each persona sits
 * off the road by a skill offset (personas.ts `HABIT_OFFSET`), so the designed tier alone
 * (`fixedTier`, no Director) lands each of them outside the 75–85 % band; the Director must
 * bring them in. "Later is harder" is checked together with the chapter sawtooth (peaks
 * served harder than rests), which a policy that just chases the rating would flatten.
 */
import { describe, expect, it } from 'vitest';
import { playerHabits } from '../src/director/profile';
import { levelPlan, roadBase } from '../src/director/plan';
import { type AnalyticsSave, defaultAnalytics } from '../src/services/save-analytics';
import { HABIT_PERSONAS, type HabitStep, PERSONAS, type Style, fixedTier, isHinter, simulate, simulateHabits } from './personas';

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
/**
 * Tier changes the policy itself makes between two plain 'skill' boards (its aim
 * relative to the curve moved by ≥ 0.03), per 100 boards. The other tier changes are
 * the pacing's breaths (relief, breather, stretch and the step back) and the bank's
 * uneven tier ladders: a level's five boards are measured, not spaced 0.1 apart (level
 * 207's tiers 2 and 3 measure 0.304 and 0.305; level 208's 0.334 and 0.492), so the
 * same aim lands on a different tier number while the served d barely moves.
 */
const POLICY_CHANGES_MAX = 12;
const AIM_MOVE = 0.03;

interface Run {
  log: HabitStep[];
  a: AnalyticsSave;
}

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);
const PACE = new Set(['relief', 'ease', 'breather', 'stretch', 'relief-repin']);

const ms: Record<string, number> = {};
function runs(style: Style, control = false): Run[] {
  const t0 = performance.now();
  const out = SEEDS.map((s) => {
    const a = defaultAnalytics();
    return { log: simulateHabits(HABIT_PERSONAS[style], `${style}-${s}`, BOARDS, a, control ? fixedTier : undefined), a };
  });
  ms[style] = (ms[style] ?? 0) + performance.now() - t0;
  return out;
}

function stats(rs: Run[], hinter: boolean) {
  const late = rs.flatMap((r) => r.log.slice(WARMUP));
  const clean = mean(late.map((s) => (hinter ? s.credit : Number(s.clean))));
  const strict = mean(late.map((s) => Number(s.clean)));
  const changes: number[] = [];
  const paced: number[] = [];
  const policy: number[] = [];
  const pingPong: number[] = [];
  const settledTier: number[] = [];
  const early: number[] = [];
  const lateD: number[] = [];
  const saw: number[] = [];
  for (const { log } of rs) {
    const tail = log.slice(-LAST);
    const moved = tail.map((s, i) => i > 0 && s.tier !== tail[i - 1].tier);
    changes.push(moved.filter(Boolean).length);
    paced.push(tail.filter((s, i) => moved[i] && (PACE.has(s.reason) || PACE.has(tail[i - 1].reason))).length);
    policy.push(
      tail.filter((s, i) => {
        const p = tail[i - 1];
        return moved[i] && s.reason === 'skill' && p.reason === 'skill' && Math.abs(s.target - s.base - (p.target - p.base)) >= AIM_MOVE;
      }).length,
    );
    pingPong.push(tail.filter((s, i) => i > 2 && s.tier === tail[i - 2].tier && tail[i - 1].tier === tail[i - 3].tier && s.tier !== tail[i - 1].tier).length);
    settledTier.push(mean(tail.map((s) => s.tier)));
    early.push(mean(log.filter((s) => s.n > 6 && s.n <= 60).map((s) => s.d)));
    const top = log[log.length - 1].n;
    lateD.push(mean(log.filter((s) => s.n > top - 60).map((s) => s.d)));
    // the chapter sawtooth as served: peak boards vs rest boards, relative to the road
    const settled = log.slice(WARMUP);
    const rel = (role: string) => mean(settled.filter((s) => levelPlan(s.n).role === role).map((s) => s.d - roadBase(s.n)));
    saw.push(rel('peak') - rel('rest'));
  }
  return { clean, strict, changes, paced, policy, pingPong, settledTier, early, lateD, saw, reached: rs.map((r) => r.log[r.log.length - 1].n) };
}

const STYLES: Style[] = ['edge', 'centre', 'bendBlind', 'rusher', 'hinter'];
const RUNS = Object.fromEntries(STYLES.map((s) => [s, runs(s)])) as Record<Style, Run[]>;
const STATS = Object.fromEntries(STYLES.map((s) => [s, stats(RUNS[s], isHinter(s))])) as Record<Style, ReturnType<typeof stats>>;
const CONTROL = Object.fromEntries(STYLES.map((s) => [s, stats(runs(s, true), isHinter(s))])) as Record<Style, ReturnType<typeof stats>>;
const LATE = runs('lateHinter');

const inBand = (v: number) => v >= 0.75 && v <= 0.85;

describe('habit personas on real boards', () => {
  it('prints the table', () => {
    for (const s of STYLES) {
      const r = STATS[s];
      const c = CONTROL[s];
      console.log(
        `[habits] ${s.padEnd(9)} clean ${(r.clean * 100).toFixed(1)}% (strict ${(r.strict * 100).toFixed(1)}%)  no-Director ${(c.clean * 100).toFixed(1)}%  ` +
          `settled tier ${r.settledTier.map((t) => t.toFixed(2)).join('/')}  changes/${LAST} ${r.changes.join('/')} (paced ${r.paced.join('/')}, policy ${r.policy.join('/')})  A-B-A-B ${r.pingPong.join('/')}  ` +
          `d early ${mean(r.early).toFixed(3)} → late ${mean(r.lateD).toFixed(3)}  peak−rest ${mean(r.saw).toFixed(3)} (no-Director ${mean(c.saw).toFixed(3)})  reached ${r.reached.join('/')}  ${(ms[s] / 1000).toFixed(1)} s`,
      );
    }
  });

  for (const s of STYLES) {
    it(`${s}: the Director brings it into the 75–85 % clean band (the designed tier alone does not), without ping-pong`, () => {
      const r = STATS[s];
      expect(r.clean).toBeGreaterThanOrEqual(0.75);
      expect(r.clean).toBeLessThanOrEqual(0.85);
      expect(inBand(CONTROL[s].clean), `no-Director clean ${CONTROL[s].clean}`).toBe(false);
      for (const p of r.pingPong) expect(p).toBeLessThanOrEqual(PING_PONG_MAX);
      for (const p of r.policy) expect(p).toBeLessThanOrEqual(POLICY_CHANGES_MAX);
      // every tier move is one step (smooth), checked over the whole run
      for (const { log } of RUNS[s]) for (let i = 1; i < log.length; i++) expect(Math.abs(log[i].tier - log[i - 1].tier)).toBeLessThanOrEqual(1);
    });

    it(`${s}: later chapters serve harder boards, and each chapter keeps its peaks and rests`, () => {
      const r = STATS[s];
      r.early.forEach((e, i) => expect(r.lateD[i]).toBeGreaterThan(e + 0.05));
      for (const v of r.saw) expect(v).toBeGreaterThan(0.08);
    });
  }

  it('the hinter: its strict (no assist at all) clean rate has a floor too', () => {
    // It takes its usual hint on ~80 % of boards, so strict clean ≈ 0.2 × its real clear
    // rate; 0.13 means at least ~65 % of boards would clear with no help.
    expect(STATS.hinter.strict).toBeGreaterThanOrEqual(0.13);
  });

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

  it('a stretch board only ever follows three clears with no assist at all (a hint never reads as boredom)', () => {
    for (const s of STYLES)
      for (const { log } of RUNS[s])
        log.forEach((x, i) => {
          if (x.reason === 'stretch') expect(log.slice(Math.max(0, i - 3), i).filter((p) => p.clean).length, `${s} board ${i}`).toBe(3);
        });
    // the hinter's clean streaks are rare but real: it still gets the odd stretch board
    expect(RUNS.hinter.some(({ log }) => log.some((x) => x.reason === 'stretch'))).toBe(true);
  });

  it('a strong player who hints late (15–25 s in) is eased, not pinned to the gentlest tier', () => {
    const tail = LATE.flatMap(({ log }) => log.slice(-LAST));
    const settled = RUNS.edge.flatMap(({ log }) => log.slice(-LAST));
    console.log(
      `[habits] lateHinter clean credit ${(stats(LATE, true).clean * 100).toFixed(1)}%  tier-0 share ${mean(tail.map((s) => Number(s.tier === 0))).toFixed(2)}  ` +
        `served d − road ${mean(tail.map((s) => s.d - roadBase(s.n))).toFixed(3)} (edge, same skill, no hints: ${mean(settled.map((s) => s.d - roadBase(s.n))).toFixed(3)})  ` +
        `rating − road ${mean(LATE.map(({ log }) => log[log.length - 1].rating - roadBase(log[log.length - 1].n))).toFixed(3)}`,
    );
    for (const { log } of LATE) {
      const t = log.slice(-LAST);
      expect(t.filter((s) => s.tier === 0).length / t.length).toBeLessThan(0.1);
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

describe('hints never buy harder boards', () => {
  // The same player and the same luck (hints draw from their own stream), taking a hint
  // on none, half or every one of the boards it clears cleanly anyway.
  const HINT_SEEDS = Array.from({ length: 40 }, (_, i) => `hint-${i}`);
  const served = (who: string, rate: number) =>
    mean(HINT_SEEDS.flatMap((seed) => simulate(PERSONAS[who], seed, 260, defaultAnalytics(), { freeHints: rate }).slice(WARMUP).map((s) => s.d)));

  for (const who of ['steady', 'strong', 'weak']) {
    it(`${who}: served difficulty is non-increasing in the hint rate`, () => {
      const D = [0, 0.5, 1].map((rate) => served(who, rate));
      console.log(`[hints] ${who} served d at hint rate 0 / 0.5 / 1: ${D.map((d) => d.toFixed(4)).join(' / ')}`);
      expect(D[1]).toBeLessThanOrEqual(D[0]);
      expect(D[2]).toBeLessThanOrEqual(D[1]);
    });
  }
});
