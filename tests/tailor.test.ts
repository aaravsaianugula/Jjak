/**
 * Tailoring inside the tier (EXPANSION_PLAN §C1, Part 1B): the bank keeps a few
 * pre-measured alternates per (level, tier), each with its reading features, and the
 * Director's ChallengeRequest picks the one that leans on the player's blind spot.
 */
import { describe, expect, it } from 'vitest';
import { TIERS, bankCandidates, bankEntry, bankSpec, candidateSpec } from '../src/director/bank';
import { type ChallengeRequest, plainChallenge } from '../src/director/challenge';
import { measure } from '../src/director/metrics';
import { type BoardReading } from '../src/director/metrics';
import { knobRange, levelPlan } from '../src/director/plan';
import { FEATURE_KEYS, type ReadingFeatures, decodeFeatures, encodeFeatures, featuresOf } from '../src/director/reading';
import { TAILOR, chooseCandidate, leanOf, tailoredSpec } from '../src/director/tailor';
import { boardHash, validate } from '../src/director/validate';
import { buildBoard } from '../src/engine/levels';
import { pinTier } from '../src/director/director';
import { pinChallenge } from '../src/director/challenge';
import { playLevel } from '../src/director/index';
import { defaultAnalytics } from '../src/services/save-analytics';
import { save } from '../src/services/storage';

const flat = (v: number): ReadingFeatures => Object.fromEntries(FEATURE_KEYS.map((k) => [k, v])) as unknown as ReadingFeatures;
const req = (focus: ChallengeRequest['focus'], weight: number, emphasis: ChallengeRequest['emphasis']): ChallengeRequest => ({
  n: 150, tier: 2, focus, emphasis, weight, rotationKey: `150:2:${focus}`, why: 'test',
});
const pair = (a: number, b: number, o: Partial<BoardReading['pairs'][number]> = {}): BoardReading['pairs'][number] => ({
  a, b, bends: 0, length: 1, edge: false, detour: false, legalBefore: 5, opens: 0, strands: false, critical: false, ...o,
});

describe('reading features', () => {
  // 4 × 4: cells 5, 6, 9, 10 are the inside; everything else is the rim.
  const board = { rows: 4, cols: 4, cells: new Array(16).fill(0) };

  it('places the key pairs (critical, stranding or one of at most two legal) and all the pairs by region', () => {
    const reading: BoardReading = {
      pairs: [
        pair(5, 6, { critical: true, legalBefore: 3 }), // inside, top half
        pair(9, 10, { legalBefore: 2 }), // inside, bottom half (scarce)
        pair(0, 3, { strands: true }), // rim, top
        pair(12, 13), // not key
        pair(1, 2, { bends: 2, detour: true, edge: true }),
      ],
      decoys: [{ a: 0, b: 15 }, { a: 4, b: 7 }],
      opening: { footholds: [], row: 0.5, col: 0.5 },
    };
    const f = featuresOf(board, reading);
    // key pairs: 2 of 3 inside, 2 of 3 in the top half; all pairs: 2 of 5 inside, 3 of 5 on top
    expect(f.keyCentre).toBeCloseTo((2 / 3 + 2 / 5) / 2, 6);
    expect(f.keyRim).toBeCloseTo((1 / 3 + 3 / 5) / 2, 6);
    expect(f.keyTop).toBeCloseTo((2 / 3 + 3 / 5) / 2, 6);
    expect(f.keyBottom).toBeCloseTo((1 / 3 + 2 / 5) / 2, 6);
    expect(f.twoBend).toBeCloseTo(1 / 5, 6);
    expect(f.detour).toBeCloseTo(1 / 5, 6);
    expect(f.edge).toBeCloseTo(1 / 5, 6);
    expect(f.decoys).toBeCloseTo(2 / (2 * 5), 6);
  });

  it('a board with no key pairs leans only by where its pairs sit, at half strength', () => {
    const f = featuresOf(board, { pairs: [pair(5, 6), pair(0, 1)], decoys: [], opening: { footholds: [], row: 0.5, col: 0.5 } });
    expect([f.keyCentre, f.keyRim, f.keyTop, f.keyBottom]).toEqual([0.25, 0.25, 0.5, 0]);
  });

  it('round-trips through the bank code, and refuses malformed codes', () => {
    const f = featuresOf(board, {
      pairs: [pair(5, 6, { critical: true }), pair(0, 3, { bends: 2 })],
      decoys: [{ a: 0, b: 15 }],
      opening: { footholds: [], row: 0.5, col: 0.5 },
    });
    const s = encodeFeatures(f);
    expect(s).toHaveLength(FEATURE_KEYS.length);
    const g = decodeFeatures(s)!;
    for (const k of FEATURE_KEYS) expect(Math.abs(g[k] - f[k])).toBeLessThanOrEqual(1 / 70 + 1e-9);
    expect(decodeFeatures('zz')).toBeNull();
    expect(decodeFeatures('!!!!!!!!')).toBeNull();
  });
});

describe('choosing among a level’s pre-measured boards', () => {
  const base = { d: 0.4 };
  const cands = [
    { ...base, features: { ...flat(0.3), keyCentre: 0.2, twoBend: 0.3 } },
    { ...base, d: 0.41, features: { ...flat(0.3), keyCentre: 0.7, twoBend: 0.3 } },
    { ...base, d: 0.39, features: { ...flat(0.3), keyCentre: 0.3, twoBend: 0.6 } },
    { ...base, d: 0.48, features: { ...flat(0.3), keyCentre: 0.95, twoBend: 0.9 } },
  ];

  it('a plain request is the primary board', () => {
    expect(chooseCandidate(cands, plainChallenge(150, 2, 'x'))).toBe(0);
  });

  it('leans on the blind spot: 2-bend paths for a bend-blind reader, decoys for a rusher', () => {
    expect(chooseCandidate(cands, req('shape:twoBend', 0.6, { kind: 'shape', shape: 'twoBend' }))).toBe(2);
    const decoyed = [cands[0], { ...cands[1], features: { ...cands[1].features, decoys: 0.6 } }];
    expect(chooseCandidate(decoyed, req('decoys', 0.6, { kind: 'decoys' }))).toBe(1);
  });

  it('a scan-region request is served the tier’s own board (no measured effect yet)', () => {
    expect(chooseCandidate(cands, req('region:centre', 0.9, { kind: 'region', region: 'centre' }))).toBe(0);
    expect(chooseCandidate(cands, req('region:edges', 0.9, { kind: 'region', region: 'edges' }))).toBe(0);
  });

  it('never trades the tier away: a board farther than the d tolerance is never picked', () => {
    expect(Math.abs(cands[3].d - cands[0].d)).toBeGreaterThan(TAILOR.maxDGap);
    for (const f of ['region:centre', 'shape:twoBend'] as const) {
      const e = f === 'region:centre' ? ({ kind: 'region', region: 'centre' } as const) : ({ kind: 'shape', shape: 'twoBend' } as const);
      expect(chooseCandidate(cands, req(f, 0.9, e))).not.toBe(3);
    }
  });

  it('a small lean needs a strong request; a focus with no board feature stays plain', () => {
    const near = [cands[0], { ...cands[1], features: { ...cands[1].features, twoBend: 0.4 } }];
    expect(chooseCandidate(near, req('shape:twoBend', 0.3, { kind: 'shape', shape: 'twoBend' }))).toBe(0);
    expect(chooseCandidate(near, req('shape:twoBend', 0.9, { kind: 'shape', shape: 'twoBend' }))).toBe(1);
    expect(chooseCandidate(cands, req('shape:straight', 0.9, { kind: 'shape', shape: 'straight' }))).toBe(0);
    expect(chooseCandidate([{ d: 0.4, features: null }, cands[2]], req('shape:twoBend', 0.9, { kind: 'shape', shape: 'twoBend' }))).toBe(0);
  });

  it('a weaker mechanic is leaned on through its own count, inside the level’s range', () => {
    const n = (() => {
      for (let k = 100; k < 600; k++) if ((levelPlan(k).mechanics as string[]).includes('stones') && !levelPlan(k).fixed) return k;
      throw new Error('no stones level');
    })();
    const r = knobRange(levelPlan(n)).stones;
    const lo = leanOf(flat(0.3), { kind: 'mechanic', id: 'stones' }, { stones: r[0] } as never, levelPlan(n));
    const hi = leanOf(flat(0.3), { kind: 'mechanic', id: 'stones' }, { stones: r[1] } as never, levelPlan(n));
    expect(hi).toBeGreaterThan(lo!);
    // a mechanic the level doesn't have is never leaned on
    expect(leanOf(flat(0.3), { kind: 'mechanic', id: 'wind' }, { stones: r[1] } as never, levelPlan(n))).toBeNull();
  });
});

describe('the bank’s alternates', () => {
  const N = 600;

  it('every alternate rebuilds exactly (hash), sits within the d tolerance of its tier’s board, and carries features', () => {
    const bad: string[] = [];
    let alternates = 0;
    for (let n = 1; n <= N; n++) {
      for (let t = 0; t < TIERS; t++) {
        const cs = bankCandidates(n, t);
        expect(cs[0].entry).toEqual(bankEntry(n, t));
        for (const c of cs.slice(1)) {
          alternates++;
          const spec = candidateSpec(n, t, c.entry);
          if (boardHash(spec, buildBoard(spec)) !== c.entry.hash) bad.push(`${n}/${t}/${c.entry.attempt}`);
          expect(Math.abs(c.entry.d - cs[0].entry.d)).toBeLessThanOrEqual(TAILOR.maxDGap + 1e-9);
          expect(c.features).not.toBeNull();
          expect(c.entry.hash).not.toBe(cs[0].entry.hash);
        }
      }
    }
    expect(bad).toEqual([]);
    // most tiers past the teaching levels have something to choose from
    expect(alternates).toBeGreaterThan(0.8 * (N - 6) * TIERS);
  });

  it('a sample of alternates passes every validator (solver-proven, a real foothold) and re-measures to its d', () => {
    let checked = 0;
    for (let k = 0; k < 400 && checked < 60; k++) {
      const n = 7 + ((k * 197) % (N - 6));
      const t = k % TIERS;
      const alt = bankCandidates(n, t)[1];
      if (!alt) continue;
      checked++;
      const spec = candidateSpec(n, t, alt.entry);
      const board = buildBoard(spec);
      const m = measure(spec, board);
      expect(validate(spec, board, m, { tier: t, plan: levelPlan(n) }).reasons, `level ${n} tier ${t}`).toEqual([]);
      expect(m.d).toBeCloseTo(alt.entry.d, 3);
    }
    expect(checked).toBeGreaterThanOrEqual(50);
  });

  it('playLevel serves the pinned challenge’s pick, and the same board on a replay many levels later', () => {
    const centre = (n: number, t: number) => ({ ...req('shape:twoBend', 0.8, { kind: 'shape', shape: 'twoBend' }), n, tier: t, rotationKey: `${n}:${t}:shape:twoBend` });
    let found: { n: number; t: number } | null = null;
    for (let n = 150; n < 400 && !found; n++) for (let t = 1; t < 4 && !found; t++) if (tailoredSpec(n, t, centre(n, t)).seed !== bankSpec(n, t).seed) found = { n, t };
    expect(found).not.toBeNull();
    const { n, t } = found!;
    save.analytics = defaultAnalytics();
    pinTier(save.analytics, n, t);
    pinChallenge(save.analytics, centre(n, t));
    save.stars[n] = 1;
    const first = playLevel(n);
    expect(first.seed).toBe(tailoredSpec(n, t, centre(n, t)).seed);
    expect(first.seed).not.toBe(bankSpec(n, t).seed);
    for (let m = 420; m < 450; m++) playLevel(m);
    expect(playLevel(n)).toEqual(first);
  });

  it('a plain request serves the tier’s own board; a request is deterministic (a retry is the same board)', () => {
    for (const n of [7, 100, 333, 600]) {
      for (let t = 0; t < TIERS; t++) {
        expect(tailoredSpec(n, t, plainChallenge(n, t, 'x'))).toEqual(bankSpec(n, t));
        const ch = { ...req('shape:twoBend', 0.8, { kind: 'shape', shape: 'twoBend' }), n, tier: t };
        expect(tailoredSpec(n, t, ch)).toEqual(tailoredSpec(n, t, ch));
      }
    }
  });
});
