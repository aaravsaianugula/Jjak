/**
 * Persona tailoring simulations for the endless road (EXPANSION_PLAN §C5): the
 * play-style profile tailors gently, step by step, and the Director keeps the
 * flow target (75–85 % clean clears) while it does.
 *
 * Each comparison runs the same levels twice from the same state: once for a
 * neutral player and once for a player with the trait, which switches on part-way,
 * so the first stretch is identical by construction and the gap after it is the
 * tailoring's effect.
 */
import { describe, expect, it } from 'vitest';
import { ENDLESS, endlessIdentity, defaultEndlessState, makeJob, runEndlessJob, slowTwoBends, tailorFor } from '../src/director/endless-core';
import { targetFor } from '../src/director/director';
import { ingest, isClean } from '../src/director/model';
import { roadBase } from '../src/director/plan';
import { playStyle } from '../src/director/profile';
import { createRng } from '../src/engine/rng';
import { type LevelSpec } from '../src/engine/levels';
import { type BoardRecord } from '../src/services/save-analytics';
import { EDGE_TAPS, FAST, SLOW_TWO, historyOf, mean, road } from './endless-helpers';
import { playBoard } from './personas';

const NEUTRAL_PLAYER = playStyle(historyOf({}));
const EDGE_PLAYER = playStyle(historyOf({ firstTaps: EDGE_TAPS }));
const SLOW_TWO_PLAYER = playStyle(historyOf({ turnMs: SLOW_TWO }));
const SWITCH = 613;
const FROM = 601;
const COUNT = 60;

describe('the profiles behind the sims', () => {
  it('read as intended', () => {
    expect(NEUTRAL_PLAYER.scan.start).not.toBe('edges');
    expect(slowTwoBends(NEUTRAL_PLAYER)).toBe(false);
    expect(EDGE_PLAYER.scan.start).toBe('edges');
    expect(slowTwoBends(SLOW_TWO_PLAYER)).toBe(true);
    expect(EDGE_PLAYER.confidence).toBeGreaterThanOrEqual(ENDLESS.minConfidence);
  });

  it('stretches build up one step per level and ease off the same way', () => {
    const st = defaultEndlessState();
    const w: number[] = [];
    for (let i = 0; i < 10; i++) w.push(tailorFor(EDGE_PLAYER, st, 0).centreFirst);
    for (let i = 0; i < 3; i++) w.push(tailorFor(NEUTRAL_PLAYER, st, 0).centreFirst);
    const step = ENDLESS.centreStep;
    expect(w.map((x) => Math.round(x / step))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 7, 6, 5]);
  });
});

describe('tailoring, measured', () => {
  const neutral = road(FROM, COUNT, { style: () => NEUTRAL_PLAYER });

  it('edge-first scanners: the opening pairs move toward the centre over time', () => {
    const edge = road(FROM, COUNT, { style: (n) => (n < SWITCH ? NEUTRAL_PLAYER : EDGE_PLAYER) });
    const cf = (gs: typeof edge) => gs.map((g) => g.result!.centreFirst);
    const [a, b] = [cf(neutral), cf(edge)];
    // Identical before the switch (same inputs, same boards).
    for (let i = 0; i < SWITCH - FROM; i++) expect(b[i]).toBe(a[i]);
    // After it, the stretch builds for 8 levels; then compare the settled stretch.
    const settled = SWITCH - FROM + ENDLESS.stretchMax;
    const diff = (from: number, to: number) => mean(b.slice(from, to).map((x, i) => x - a[from + i]));
    const after = mean(b.slice(settled));
    const base = mean(a.slice(settled));
    console.log(`[endless] centre-first: neutral ${base.toFixed(3)} · edge scanner ramp +${diff(SWITCH - FROM, settled).toFixed(3)}, settled ${after.toFixed(3)} (+${diff(settled, COUNT).toFixed(3)}, +${(((after - base) / base) * 100).toFixed(0)} %)`);
    expect(after).toBeGreaterThan(base * 1.2);
    expect(after - base).toBeGreaterThan(0.02);
    // Gently: the boards stay near the Director's target.
    const gap = (gs: typeof edge) => mean(gs.slice(settled).map((g) => Math.abs(g.spec.difficulty! - g.target)));
    expect(gap(edge)).toBeLessThan(gap(neutral) + 0.04);
  });

  it('slow 2-bend readers: the 2-bend share rises a little at a time', () => {
    const slow = road(FROM, COUNT, { style: (n) => (n < SWITCH ? NEUTRAL_PLAYER : SLOW_TWO_PLAYER) });
    const tb = (gs: typeof slow) => gs.map((g) => g.result!.twoBend);
    const [a, b] = [tb(neutral), tb(slow)];
    for (let i = 0; i < SWITCH - FROM; i++) expect(b[i]).toBe(a[i]);
    const settled = SWITCH - FROM + ENDLESS.stretchMax;
    const diff = (from: number, to: number) => mean(b.slice(from, to).map((x, i) => x - a[from + i]));
    const rampDiff = diff(SWITCH - FROM, settled);
    const settledDiff = diff(settled, COUNT);
    console.log(`[endless] 2-bend share: neutral ${mean(a.slice(settled)).toFixed(3)} · slow reader ramp +${rampDiff.toFixed(3)}, settled +${settledDiff.toFixed(3)}`);
    expect(settledDiff).toBeGreaterThan(0.02);
    // A little at a time: the stretch weight climbs one step per level.
    const weights = slow.slice(SWITCH - FROM, settled).map((g) => g.tailoring.twoBend);
    for (let i = 1; i < weights.length; i++) expect(weights[i] - weights[i - 1]).toBeCloseTo(ENDLESS.twoBendStep, 6);
  });

  it('favourite mechanics come round more often, and every mechanic still appears', () => {
    const player = playStyle(historyOf({ mech: ['knots'] }));
    // Replays mark enjoyment (playing a mechanic a lot doesn't, on its own).
    const a = historyOf({});
    for (let i = 0; i < 8; i++) ingest(a, { ...BASE, mech: ['knots'] }, { replay: true });
    const liker = playStyle(a);
    expect(liker.favourites).toContain('knots');
    expect(player.favourites).not.toContain('knots');
    const count = (style: typeof liker) => {
      const st = defaultEndlessState();
      const seen: Record<string, number> = {};
      let prev: LevelSpec | undefined;
      for (let n = 601; n < 841; n++) {
        const t = tailorFor(style, st, 0);
        const p = endlessIdentity(n, t, st, prev);
        prev = p.spec;
        for (const m of p.mechanics) seen[m] = (seen[m] ?? 0) + 1;
      }
      return seen;
    };
    const plain = count(NEUTRAL_PLAYER);
    const liked = count(liker);
    console.log(`[endless] knots on ${plain.knots} of 240 boards for a neutral player, ${liked.knots} for one who replays knot boards`);
    expect(liked.knots).toBeGreaterThan(plain.knots * 1.2);
    for (const m of ['leaves', 'snow', 'knots', 'wind', 'gates', 'fences']) expect(liked[m] ?? 0, m).toBeGreaterThan(10);
  });
});

const BASE: BoardRecord = {
  mode: 'journey', n: 610, tier: 2, d: 0.55, mech: [], ms: 80_000, par: 90, pairs: 24, made: 24, cleared: true, ended: 'clear',
  stars: 3, firstMs: 3000, gapMs: 2500, blocked: 1, reselects: 0, hints: 0, shuffles: 0, autoShuffles: 0, bestCombo: 3, fever: 0,
  turns: [8, 10, 6], turnMs: [1800, 2000, 2200], firstTaps: [[0.4, 0.5], [0.6, 0.4], [0.5, 0.5]], hintAfterMs: -1, date: '2026-10-07', hour: 20,
};

describe('flow under tailoring', () => {
  it('a steady player stretched on both blind spots still clears 75–85 % of boards cleanly', () => {
    // Settled on the first pass: rating near the road, an edge scanner slow on 2-bend pairs.
    const a = historyOf({ firstTaps: EDGE_TAPS, turnMs: SLOW_TWO, d: roadBase(600), n: 600 }, 30);
    a.rating = roadBase(600);
    a.dev = 0.08;
    const rng = createRng('endless-flow');
    const st = defaultEndlessState();
    const recent: LevelSpec[] = [];
    const stars: Record<number, number> = {};
    const clean: boolean[] = [];
    const gaps: number[] = [];
    let n = 601;
    let fails = 0;
    let spec: LevelSpec | null = null;
    let target = 0;
    for (let played = 0; played < 170; played++) {
      if (!spec) {
        const style = playStyle(a);
        const t = tailorFor(style, st, 0);
        const plan = endlessIdentity(n, t, st, recent[recent.length - 1]);
        target = Math.min(0.95, Math.max(0.05, targetFor(a, n).target - 0.1 * Math.floor(fails / 2)));
        const r = runEndlessJob(makeJob(n, plan, target, t, recent, { size: FAST }), () => 0);
        spec = r!.spec;
      }
      const d = spec.difficulty!;
      const theta = roadBase(n);
      const rec = playBoard(rng, theta, d + 0.03 * (rng.next() - 0.5) * 2, n, spec.tier ?? 2, d);
      rec.firstTaps = EDGE_TAPS;
      rec.turnMs = SLOW_TWO;
      ingest(a, rec, { replay: !!stars[n] });
      if (played >= 20) {
        clean.push(isClean(rec));
        gaps.push(d - target);
      }
      if (rec.cleared) {
        stars[n] = 1;
        recent.push(spec);
        if (recent.length > ENDLESS.window) recent.shift();
        n++;
        fails = 0;
        spec = null;
      } else if (++fails % 2 === 0) spec = null; // two failed tries: made again, gentler
    }
    const rate = clean.filter(Boolean).length / clean.length;
    console.log(`[endless] flow: ${clean.length} boards, clean-clear rate ${(rate * 100).toFixed(1)} %, d − target ${mean(gaps).toFixed(3)} (mean), stretch ${JSON.stringify(st.stretch)}, reached level ${n}`);
    expect(st.stretch.centre).toBe(ENDLESS.stretchMax);
    expect(st.stretch.twoBend).toBe(ENDLESS.stretchMax);
    expect(rate).toBeGreaterThanOrEqual(0.72);
    expect(rate).toBeLessThanOrEqual(0.88);
  });
});
