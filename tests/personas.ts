/**
 * Synthetic players for the Director's persona simulations (tests/model.test.ts).
 *
 * A persona has a true skill θ(n, played) in board-difficulty units. On a board whose
 * real difficulty is d (the measured d plus a little measurement noise):
 *   P(clean clear) = σ((θ − d) / 0.08 + ln 4)      80 % when the board sits at their skill
 *   otherwise they either quit (more likely the harder the board) or clear with 1–2 hints
 *   (sometimes a shuffle) and well over par. Clean clears take
 *   par · exp(N(ln 0.9 − 1.5 (θ − d), 0.2)), with a few misreads on boards near their limit.
 */
import { createRng, type Rng } from '../src/engine/rng';
import { decide, recordAttempt, tierD } from '../src/director/director';
import { ingest, isClean } from '../src/director/model';
import { roadBase } from '../src/director/plan';
import { type AnalyticsSave, type BoardRecord, defaultAnalytics } from '../src/services/save-analytics';

export interface Persona {
  name: string;
  /** true skill at level n after `played` boards */
  skill(n: number, played: number): number;
}

export const PERSONAS: Record<string, Persona> = {
  steady: { name: 'steady', skill: (n) => roadBase(n) },
  strong: { name: 'strong', skill: (n) => roadBase(n) + 0.12 },
  weak: { name: 'weak', skill: (n) => roadBase(n) - 0.12 },
  learner: { name: 'learner', skill: (n, p) => roadBase(n) - 0.15 + 0.27 * Math.min(1, p / 200) },
  expert: { name: 'expert', skill: (n) => roadBase(n) + 0.35 },
  novice: { name: 'novice', skill: (n) => roadBase(n) - 0.3 },
};

const sigma = (x: number) => 1 / (1 + Math.exp(-x));
const gauss = (rng: Rng) => {
  const u = Math.max(1e-9, rng.next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
};

export const PAIRS = 24;
export const PAR = 90;

/** One board played by a persona of skill θ on a board of real difficulty d. */
export function playBoard(rng: Rng, theta: number, d: number, n: number, tier: number, measured: number): BoardRecord {
  const gap = theta - d;
  const base: BoardRecord = {
    mode: 'journey', n, tier, d: measured, mech: n % 3 === 0 ? ['stones'] : n % 3 === 1 ? ['snow'] : [], ms: 0, par: PAR, pairs: PAIRS,
    made: PAIRS, cleared: true, ended: 'clear', stars: 3, firstMs: 3000, gapMs: 2500, blocked: 0, reselects: 0, hints: 0, shuffles: 0,
    autoShuffles: 0, bestCombo: 3, fever: 0, turns: [8, 10, 6], turnMs: [1500, 2500, 4000], firstTaps: [], hintAfterMs: -1,
    date: '2026-10-07', hour: 20,
  };
  const pClean = sigma(gap / 0.08 + Math.log(4));
  if (rng.next() < pClean) {
    const r = Math.exp(Math.log(0.9) - 1.5 * gap + 0.2 * gauss(rng));
    const blocked = Math.round(PAIRS * Math.max(0, 0.08 - 0.3 * gap) * 2 * rng.next());
    return { ...base, ms: r * PAR * 1000, blocked, stars: r <= 1 ? 3 : 2 };
  }
  const pQuit = Math.min(0.8, Math.max(0.1, 0.35 - 2 * gap));
  if (rng.next() < pQuit) {
    const made = Math.round(PAIRS * (0.2 + 0.5 * rng.next()));
    return { ...base, cleared: false, ended: rng.next() < 0.5 ? 'quit' : 'restart', made, ms: 60_000 * (0.5 + rng.next()), stars: 0, blocked: 3 };
  }
  const r = Math.exp(Math.log(1.4) - gap + 0.25 * gauss(rng));
  return { ...base, ms: r * PAR * 1000, hints: 1 + Number(rng.next() < 0.4), shuffles: Number(rng.next() < 0.2), blocked: 4, stars: 1 };
}

export interface SimStep {
  n: number;
  tier: number;
  reason: string;
  d: number;
  theta: number;
  rating: number;
  clean: boolean;
  cleared: boolean;
}

/**
 * A persona plays `boards` Journey boards from level 1, through the real Director
 * (`decide`) and model (`ingest`): quits retry the same level (pinned tier, relief
 * re-pin after two failures), clears move on.
 */
export function simulate(p: Persona, seed: string, boards = 300, a: AnalyticsSave = defaultAnalytics()): SimStep[] {
  const rng = createRng(seed);
  const stars: Record<number, number> = {};
  const log: SimStep[] = [];
  let n = 1;
  for (let played = 0; played < boards; played++) {
    const wasCleared = !!stars[n];
    const choice = decide(a, n, wasCleared);
    const measured = tierD(n, choice.tier);
    const real = measured + 0.03 * gauss(rng);
    const theta = p.skill(n, played);
    const rec = playBoard(rng, theta, real, n, choice.tier, measured);
    ingest(a, rec, { replay: wasCleared });
    recordAttempt(a, n, rec.ended, wasCleared);
    log.push({ n, tier: choice.tier, reason: choice.reason, d: measured, theta, rating: a.rating, clean: isClean(rec), cleared: rec.cleared });
    if (rec.cleared) {
      stars[n] = 1;
      n++;
    }
  }
  return log;
}
