/**
 * The bank builder's alternates (scripts/lib/leans.ts) and the Director's tailoring
 * (src/director/tailor.ts) must read the same leans: an alternate the builder keeps for
 * a mechanic is one a `mech:<id>` request can find, and a mechanic the Director can ask
 * for is one the builder credits.
 */
import { describe, expect, it } from 'vitest';
import { MIN_LEAN, leanVector, pickAlternates } from '../scripts/lib/leans';
import { BANK_LEVELS, type BankEntry, TIERS, bankCandidates, decodeSlot, encodeSlot } from '../src/director/bank';
import { type ChallengeRequest } from '../src/director/challenge';
import { type Knobs, type LevelPlan, knobRange, levelPlan } from '../src/director/plan';
import { FEATURE_KEYS, type ReadingFeatures, encodeFeatures } from '../src/director/reading';
import { MECH_KNOBS, chooseCandidate, leanOf } from '../src/director/tailor';
import { FOCI } from '../src/services/save-analytics';

const flat = (v: number): ReadingFeatures => Object.fromEntries(FEATURE_KEYS.map((k) => [k, v])) as unknown as ReadingFeatures;

/** Every knob at the bottom of the level's range. */
function lowKnobs(plan: LevelPlan): Knobs {
  const r = knobRange(plan);
  return {
    stones: r.stones[0], layout: 'spread', months: r.months[0], snow: r.snow[0], knots: r.knots[0], gates: r.gates[0],
    fences: r.fences[0], torii: r.torii[0], streams: r.streams[0], seals: r.seals[0], ink: r.ink[0],
  };
}

/** The first non-fixed Journey level carrying mechanic m with room for its count to vary. */
function levelWith(m: string): LevelPlan {
  for (let n = 1; n <= 600; n++) {
    const p = levelPlan(n);
    if (p.fixed || !(p.mechanics as string[]).includes(m)) continue;
    const [lo, hi] = knobRange(p)[m as keyof ReturnType<typeof knobRange>] as [number, number];
    if (hi > lo) return p;
  }
  throw new Error(`no level with a varying ${m} count`);
}

/** The mechanics a player can be asked to lean on that the board carries as a count. */
const countedFoci = FOCI.filter((f) => f.startsWith('mech:'))
  .map((f) => f.slice(5))
  .filter((id) => typeof lowKnobs(levelPlan(1))[id as keyof Knobs] === 'number');

const mechReq = (n: number, id: string): ChallengeRequest => ({
  n, tier: 2, focus: `mech:${id}` as ChallengeRequest['focus'], emphasis: { kind: 'mechanic', id: id as never }, weight: 1,
  rotationKey: `${n}:2:mech:${id}`, why: 'test',
});
const gainOver = (top: number[], v: number[]) => v.reduce((s, x, i) => s + Math.max(0, x - top[i]), 0);

describe('the builder stores the leans tailoring reads', () => {
  it('one list of mechanic counts: every counted mechanic focus, and the builder’s lean vector covers it', () => {
    expect([...MECH_KNOBS].sort()).toEqual([...countedFoci].sort());
    const plan = levelWith('seals');
    expect(leanVector(plan, lowKnobs(plan), flat(0.3))).toHaveLength(FEATURE_KEYS.length + MECH_KNOBS.length);
  });

  it.each(countedFoci)('%s: more of it is a lean for the builder and for the Director alike', (m) => {
    const plan = levelWith(m);
    const lo = lowKnobs(plan);
    const hi = { ...lo, [m]: (knobRange(plan)[m as keyof ReturnType<typeof knobRange>] as [number, number])[1] };
    expect(gainOver(leanVector(plan, lo, flat(0.3)), leanVector(plan, hi, flat(0.3)))).toBeGreaterThanOrEqual(MIN_LEAN);
    const e = { kind: 'mechanic', id: m } as const;
    expect(leanOf(flat(0.3), e as never, hi, plan)!).toBeGreaterThan(leanOf(flat(0.3), e as never, lo, plan)!);
  });

  describe('a mech:seals request on a seals level, through the bank code', () => {
    const plan = levelWith('seals');
    const [sLo, sHi] = knobRange(plan).seals;
    const primary = { knobs: lowKnobs(plan), d: 0.4, f: flat(0.3) };
    const moreSeals = { knobs: { ...primary.knobs, seals: sHi }, d: 0.41, f: flat(0.3) };
    const moreDecoys = { knobs: { ...primary.knobs, seals: sLo }, d: 0.39, f: { ...flat(0.3), decoys: 0.6 } };
    type Board = typeof primary;
    /** What the builder keeps and stores for a slot, read back as the Director reads it. */
    const stored = (pool: Board[]) => {
      const kept = pickAlternates(leanVector(plan, primary.knobs, primary.f), pool.map((b) => ({ b, v: leanVector(plan, b.knobs, b.f) })));
      const entry = (b: Board, i: number): BankEntry => ({ attempt: i, knobs: b.knobs, d: b.d, hash: `h${i}`.padEnd(5, '0') });
      const slot = encodeSlot([primary, ...kept.map((k) => k.b)].map((b, i) => ({ entry: entry(b, i), features: encodeFeatures(b.f) })));
      return decodeSlot(slot).map((c) => ({ d: c.entry.d, features: c.features, knobs: c.entry.knobs }));
    };

    it('serves the alternate with more seals when the builder had one', () => {
      const cands = stored([moreDecoys, moreSeals]);
      const i = chooseCandidate(cands, mechReq(plan.n, 'seals'), plan);
      expect(i).toBeGreaterThan(0);
      expect(cands[i].knobs.seals).toBe(sHi);
    });

    it('keeps only a clear lean over the boards kept before it, at most two', () => {
      const top = leanVector(plan, primary.knobs, primary.f);
      const at = (b: Board) => ({ b, v: leanVector(plan, b.knobs, b.f) });
      const faint = { ...primary, f: { ...flat(0.3), decoys: 0.3 + MIN_LEAN / 2 } };
      expect(pickAlternates(top, [at(faint)])).toHaveLength(0);
      const clear = { ...primary, f: { ...flat(0.3), decoys: 0.3 + MIN_LEAN * 1.25 } };
      expect(pickAlternates(top, [at(clear)])).toHaveLength(1);
      // a second board with more seals adds nothing once one is kept
      expect(pickAlternates(top, [at(moreSeals), at({ ...moreSeals, d: 0.405 })]).map((k) => k.b)).toEqual([moreSeals]);
      const edgy = { ...primary, f: { ...flat(0.3), edge: 0.7 } };
      expect(pickAlternates(top, [at(moreSeals), at(moreDecoys), at(edgy)])).toHaveLength(2);
    });

    it('serves the plain board when no alternate has more seals', () => {
      const cands = stored([moreDecoys]);
      expect(cands).toHaveLength(2);
      expect(chooseCandidate(cands, mechReq(plan.n, 'seals'), plan)).toBe(0);
    });
  });
});

describe('the shipped bank leans on the newer mechanics', () => {
  it.each(['torii', 'streams', 'seals', 'ink'])('%s: some slot on a level carrying it serves a board with more of it', (m) => {
    let served = 0;
    for (let n = 1; n <= BANK_LEVELS; n++) {
      const plan = levelPlan(n);
      if (!(plan.mechanics as string[]).includes(m)) continue;
      for (let t = 0; t < TIERS; t++) {
        const cands = bankCandidates(n, t);
        if (cands.length < 2) continue;
        const i = chooseCandidate(cands.map((c) => ({ d: c.entry.d, features: c.features, knobs: c.entry.knobs })), mechReq(n, m), plan);
        if (i > 0 && cands[i].entry.knobs[m as keyof Knobs] > cands[0].entry.knobs[m as keyof Knobs]) served++;
      }
    }
    expect(served).toBeGreaterThan(0);
  });
});
