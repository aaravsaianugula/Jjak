import { describe, expect, it, vi } from 'vitest';
import { ROUTE_LEVELS, routeOf } from '../src/data/route';
import { TIERS, bankEntry, bankSpec, decodeEntry, encodeEntry } from '../src/director/bank';
import { initialState, playout, proveClear } from '../src/director/bots';
import { levelPlan as indexPlan, playLevel } from '../src/director/index';
import { foldD, measure } from '../src/director/metrics';
import { MAX_COLS, MAX_ROWS, clashes, designedBase, fallbackSpec, levelPlan, planSpec, tierKnobs } from '../src/director/plan';
import { chooseMonotone, searchLevel, tierTarget } from '../src/director/search';
import { boardHash, validate } from '../src/director/validate';
import { GOAL_IDS } from '../src/engine/goals';
import { buildBoard, dailyLevel, journeyLevel, rushLevel, windOf, zenLevel } from '../src/engine/levels';
import { MECHANIC_IDS, clash, mechanicsOf } from '../src/engine/mechanics';
import { hashSeed } from '../src/engine/rng';

const N = ROUTE_LEVELS; // 600

describe('level plan (the stable identity)', () => {
  it('is deterministic and player-independent: a fresh module computes the same road', async () => {
    const a = Array.from({ length: 700 }, (_, i) => levelPlan(i + 1));
    vi.resetModules();
    const fresh = await import('../src/director/plan');
    for (let n = 1; n <= 700; n++) {
      const b = fresh.levelPlan(n);
      const pa = a[n - 1];
      expect(JSON.stringify({ ...b, place: b.place.id }), `level ${n}`).toBe(JSON.stringify({ ...pa, place: pa.place.id }));
    }
    expect(indexPlan(123)).toEqual(levelPlan(123));
  });

  it('journeyLevel is the identity at the middle tier', () => {
    for (const n of [1, 6, 7, 26, 122, 158, 300, 599, 600, 650]) expect(journeyLevel(n)).toEqual(levelPlan(n).spec);
  });

  it('keeps the teaching levels 1–6 fixed at every tier', () => {
    for (let n = 1; n <= 6; n++) {
      const p = levelPlan(n);
      expect(p.fixed).toBe(true);
      for (let t = 0; t < TIERS; t++) {
        const s = bankSpec(n, t);
        expect({ ...s, tier: undefined, difficulty: undefined }).toEqual({ ...p.spec, tier: undefined, difficulty: undefined });
        expect(buildBoard(s).cells).toEqual(buildBoard(p.spec).cells);
      }
    }
  });

  it('boards stay phone-sized: at most 8 rows × 7 columns, and 7 columns only on late peaks and festivals', () => {
    for (let n = 1; n <= 700; n++) {
      const p = levelPlan(n);
      expect(p.rows).toBeLessThanOrEqual(MAX_ROWS);
      expect(p.cols).toBeLessThanOrEqual(MAX_COLS);
      if (p.cols === 7) {
        expect(['peak', 'festival']).toContain(p.role);
        expect(p.year > 0 || p.chapter >= 19).toBe(true);
      }
    }
  });

  it('introduces each mechanic alone, and never earlier than its chapter', () => {
    const intro = new Map<string, number>();
    for (let n = 1; n <= N; n++) {
      const p = levelPlan(n);
      for (const m of p.mechanics) if (!intro.has(m)) intro.set(m, n);
      if (p.introduces) {
        expect(p.mechanics).toEqual([p.introduces]);
        expect(p.goal).toBeUndefined();
        expect(p.slot).toBe(1);
      }
    }
    for (const [m, n] of intro) {
      const p = levelPlan(n);
      expect(p.introduces === m || p.slot === 0 || m === 'stones', `${m} first at ${n}`).toBe(true);
    }
  });

  it('never puts clashing mechanics on one board, and agrees with the mechanic library', () => {
    for (const a of MECHANIC_IDS) for (const b of MECHANIC_IDS) expect(clashes(a, b), `${a}/${b}`).toBe(clash(a, b));
    for (let n = 1; n <= 700; n++) {
      const ms = levelPlan(n).mechanics;
      for (const a of ms) for (const b of ms) expect(clash(a, b), `level ${n}`).toBe(false);
    }
  });

  it('goals: from the sixth place, about one level in four, rotating all four, never on an intro board', () => {
    let goals = 0;
    let from6 = 0;
    const counts = new Map<string, number>();
    let lastGoal = '';
    let repeats = 0;
    for (let n = 1; n <= N; n++) {
      const p = levelPlan(n);
      if (p.chapter < 5) expect(p.goal, `level ${n}`).toBeUndefined();
      else from6++;
      if (!p.goal) continue;
      goals++;
      counts.set(p.goal, (counts.get(p.goal) ?? 0) + 1);
      if (p.goal === lastGoal) repeats++;
      lastGoal = p.goal;
      expect(p.introduces).toBeUndefined();
      expect(p.slot).not.toBe(0);
    }
    expect(goals / from6).toBeGreaterThan(0.22);
    expect(goals / from6).toBeLessThan(0.28);
    for (const g of GOAL_IDS) expect(counts.get(g)! / goals).toBeGreaterThan(0.18);
    expect(repeats).toBe(0);
    expect([...Array(50).keys()].filter((ch) => levelPlan(ch * 12 + 12).goal).length).toBeGreaterThan(5);
  });

  it('the bag keeps neighbouring combinations fresh', () => {
    let same = 0;
    let pairs = 0;
    for (let n = 8; n <= N; n++) {
      const key = (k: number) => levelPlan(k).mechanics.filter((m) => m !== 'stones' && m !== 'lucky');
      const a = key(n - 1);
      const b = key(n);
      if (a.length < 2 || b.length < 2) continue;
      pairs++;
      if (a.join() === b.join()) same++;
    }
    expect(pairs).toBeGreaterThan(50);
    expect(same / pairs).toBeLessThan(0.1);
  });

  it('designed base: a sawtooth in every chapter on a road that rises, and higher than the old plateau', () => {
    for (let ch = 1; ch < 50; ch++) {
      const b = (s: number) => designedBase(ch * 12 + s + 1);
      expect(b(6)).toBeLessThan(b(10)); // rest < peak
      expect(b(0)).toBeLessThan(b(10)); // open < peak
      expect(b(11)).toBeLessThan(b(10)); // the festival celebrates below the peak
      expect(b(9)).toBeGreaterThan(b(2));
    }
    const mean = (from: number) => Array.from({ length: 48 }, (_, i) => designedBase(from + i)).reduce((a, x) => a + x, 0) / 48;
    expect(mean(553)).toBeGreaterThan(mean(13) + 0.25);
    expect(designedBase(599)).toBeGreaterThan(0.7);
    // Wanderer years start above the end of the first pass's average.
    expect(mean(601 + 12)).toBeGreaterThan(mean(13));
  });

  it('par is fixed per level: the same at every tier', () => {
    for (let n = 1; n <= N; n += 7) for (let t = 0; t < TIERS; t++) expect(bankSpec(n, t).par).toBe(levelPlan(n).par);
  });
});

describe('tier knobs', () => {
  it('a mechanic in the identity never disappears at any tier, and knobs rise with the tier', () => {
    for (let n = 7; n <= 700; n++) {
      const p = levelPlan(n);
      let prev = tierKnobs(p, 0);
      for (let t = 0; t < TIERS; t++) {
        const k = tierKnobs(p, t);
        const spec = planSpec(p, k, 'x', t);
        expect(mechanicsOf(spec), `level ${n} tier ${t}`).toEqual(p.mechanics);
        expect(windOf(spec)).toBe(p.wind);
        if (t > 0) for (const key of ['stones', 'months', 'snow', 'knots', 'gates', 'fences', 'torii', 'streams', 'seals', 'ink'] as const) expect(k[key], `${n} t${t} ${key}`).toBeGreaterThanOrEqual(prev[key]);
        prev = k;
        expect(k.stones % 2).toBe(0);
        expect((p.rows * p.cols - k.stones - k.gates) % 2).toBe(0);
      }
    }
  });

  it('d rises with the knobs (tier 0 → tier 4, averaged over seeds)', () => {
    const levels = [9, 40, 98, 133, 170, 230, 290, 350, 410, 470, 530, 590];
    let rises = 0;
    for (const n of levels) {
      const p = levelPlan(n);
      const avg = (t: number) => {
        let s = 0;
        for (let a = 0; a < 3; a++) {
          const spec = planSpec(p, tierKnobs(p, t), `mono-${n}-${a}`, t);
          s += measure(spec, buildBoard(spec), { random: 8, human: 4 }).d;
        }
        return s / 3;
      };
      if (avg(4) > avg(0)) rises++;
    }
    expect(rises).toBeGreaterThanOrEqual(levels.length - 1);
  });
});

describe('bots, metrics and validators', () => {
  it('every persona plays through the real rules; the solver proof replays', () => {
    const spec = fallbackSpec(250, 2);
    const board = buildBoard(spec);
    const st = initialState(spec, board);
    for (const bot of ['greedy', 'random', 'lookahead', 'lookahead2', 'human'] as const) {
      const p = playout(st, windOf(spec), bot, 'seed');
      expect(p.pairs).toBeGreaterThan(0);
      expect(p.pairs).toBeLessThanOrEqual(p.total);
    }
    const proof = proveClear(st, windOf(spec));
    expect(proof.moves).not.toBeNull();
    expect(proof.moves!.length).toBe(p2(board));
  });

  it('d is in [0, 1] and grows with scarcity, traps and twists', () => {
    const easy = { humanTime: 20, avgRatio: 1.2, minRatio: 0.8, twoBend: 0.2, decoys: 0.2, deadEnd: 0, humanStuck: 0, mechLoad: 0 };
    const hard = { humanTime: 140, avgRatio: 0.25, minRatio: 0.05, twoBend: 0.65, decoys: 0.7, deadEnd: 0.7, humanStuck: 1, mechLoad: 1 };
    expect(foldD(easy)).toBe(0);
    expect(foldD(hard)).toBe(1);
    expect(foldD({ ...easy, deadEnd: 0.5, mechLoad: 0.6, humanTime: 90 })).toBeGreaterThan(foldD(easy));
  });

  it('validators reject a board that fails a gate', () => {
    const spec = fallbackSpec(158, 2); // fences
    const board = buildBoard(spec);
    const m = measure(spec, board);
    const plan = levelPlan(158);
    expect(validate(spec, board, { ...m, solved: false }, { plan }).reasons).toContain('unsolved');
    expect(validate({ ...spec, rows: 9 }, board, m, { plan }).reasons).toContain('size');
    expect(validate(spec, board, { ...m, opening: 0 }, { plan }).reasons).toContain('foothold');
    expect(validate(spec, board, { ...m, deadEnd: 1 }, { plan, tier: 0 }).reasons).toContain('dead-ends');
    expect(validate({ ...spec, fences: 0 }, board, m, { plan }).reasons).toContain('missing:fences');
    const other = buildBoard({ ...spec, seed: 'another' });
    expect(validate(spec, other, m, { plan }).reasons).toContain('nondeterministic');
    expect(validate(spec, board, m, { plan, elapsedMs: 9000, timeBudgetMs: 100 }).reasons).toContain('time');
  });

  it('the monotone tier pick never lets d fall', () => {
    const c = (d: number, fitness: number) => ({ metrics: { d }, fitness }) as never;
    const picks = chooseMonotone([[c(0.3, 1), c(0.1, 0)], [c(0.2, 0.5), c(0.35, 0)], [c(0.4, 0)]]);
    expect(picks!.map((x: { metrics: { d: number } }) => x.metrics.d)).toEqual([0.3, 0.35, 0.4]);
    expect(chooseMonotone([[c(0.5, 0)], [c(0.2, 0)]])).toBeNull();
  });
});

const p2 = (b: { cells: number[] }) => b.cells.filter((v) => v >= 0).length / 2;

describe('the level bank', () => {
  it('has an entry for every level and tier, and entries round-trip', () => {
    for (let n = 1; n <= N; n++) {
      for (let t = 0; t < TIERS; t++) {
        const e = bankEntry(n, t);
        expect(e, `level ${n} tier ${t}`).not.toBeNull();
        expect(decodeEntry(encodeEntry(e!))).toEqual(e);
      }
    }
  });

  it('d never falls as the tier rises (≥ 95 % of levels), and the curve rises across the road', () => {
    let mono = 0;
    for (let n = 1; n <= N; n++) {
      const d = [0, 1, 2, 3, 4].map((t) => bankEntry(n, t)!.d);
      if (d.every((x, t) => t === 0 || x >= d[t - 1])) mono++;
    }
    expect(mono / N).toBeGreaterThanOrEqual(0.95);
    const mean = (from: number, t: number) => Array.from({ length: 48 }, (_, i) => bankEntry(from + i, t)!.d).reduce((a, x) => a + x, 0) / 48;
    for (let t = 0; t < TIERS; t++) expect(mean(553, t)).toBeGreaterThan(mean(13, t) + 0.15);
  });

  it('rebuilds every board exactly (hash check of all 3000 entries)', () => {
    const bad: string[] = [];
    for (let n = 1; n <= N; n++) {
      for (let t = 0; t < TIERS; t++) {
        const spec = bankSpec(n, t);
        if (boardHash(spec, buildBoard(spec)) !== bankEntry(n, t)!.hash) bad.push(`${n}/${t}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('a sample of entries passes every validator and re-measures to the stored d', () => {
    for (let k = 0; k < 120; k++) {
      const n = 1 + ((k * 197) % N);
      const t = k % TIERS;
      const spec = bankSpec(n, t);
      const board = buildBoard(spec);
      const m = measure(spec, board);
      const v = validate(spec, board, m, { tier: t, plan: levelPlan(n) });
      expect(v.reasons, `level ${n} tier ${t}`).toEqual([]);
      expect(m.d).toBeCloseTo(bankEntry(n, t)!.d, 3);
    }
  });

  it('the Director hands out bank boards for 1–600', () => {
    for (const n of [1, 7, 100, 333, 600]) {
      const s = playLevel(n);
      expect(s.number).toBe(n);
      expect(s.tier).toBeTypeOf('number');
      expect(s.difficulty).toBeTypeOf('number');
      expect(mechanicsOf(s)).toEqual(levelPlan(n).mechanics);
    }
  });
});

describe('other modes are untouched', () => {
  // Hashes of spec + board captured before the Director work (commit 37923b2).
  const BEFORE: Record<string, number> = {
    'daily-2026-10-01': 1584148698, 'daily-2026-10-04': 545355731, 'daily-2026-10-05': 3910180201, 'daily-2026-10-06': 3858199714,
    'daily-2026-10-07': 940346241, 'daily-2026-10-08': 862204061, 'daily-2026-10-09': 4156291421, 'daily-2026-10-10': 2597228333,
    'daily-2027-02-14': 467542548, 'daily-2028-06-30': 3473789974,
    'rush-0': 3182628050, 'rush-1': 1279090486, 'rush-2': 3011126488, 'rush-3': 1838236037, 'rush-5': 3889432936,
    'zen-1': 2895160141, 'zen-abc': 2406010910,
  };
  const h = (s: Parameters<typeof buildBoard>[0]) => hashSeed(JSON.stringify(s) + '|' + buildBoard(s).cells.join(','));

  it('Daily, Rush and Zen specs and boards are byte-identical', () => {
    for (const [key, want] of Object.entries(BEFORE)) {
      let got: number;
      if (key.startsWith('daily-')) got = h(dailyLevel(key.slice(6)));
      else if (key.startsWith('rush-')) got = h(rushLevel('run-x', Number(key.slice(5))));
      else got = h(zenLevel(key));
      expect(got, key).toBe(want);
    }
  });
});

describe('beyond 600 (the endless road builds on this)', () => {
  it('plans 601–700 work, and a small search finds a valid board for each', () => {
    for (let n = 601; n <= 700; n++) {
      const p = levelPlan(n);
      expect(routeOf(n).year).toBe(1);
      const r = searchLevel(p, { target: tierTarget(p.base, 2) }, { K: 1, climb: 0, maxAttempts: 8, measure: { random: 6, human: 3 }, seedPrefix: `endless-${n}` });
      expect(r.best, `level ${n}: ${JSON.stringify(r.rejected)}`).not.toBeNull();
      expect(r.best!.verdict.ok).toBe(true);
      expect(r.best!.spec.seed.startsWith(`endless-${n}-`)).toBe(true);
    }
  });
});
