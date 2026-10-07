/**
 * The shipped level bank: levels 1–600 × 5 tiers, built offline by the search
 * (`npm run bank`, scripts/build-bank.ts) and validated before release. On the
 * device the Director only *selects* an entry, so getting a board is instant.
 *
 * Each entry is 16 characters: the winning attempt (2, base 36), the knobs
 * (stones, layout, months, snow, knots, gates, fences: 1 each, base 36), the
 * measured difficulty d × 1000 (2, base 36) and a 5-character board hash that a
 * test uses to catch a generator change that would silently stale the bank.
 */
import data from '../data/level-bank.json';
import { type LevelSpec } from '../engine/levels';
import { type Knobs, fallbackSpec, levelPlan, planSpec } from './plan';

export const TIERS = 5;

export interface BankEntry {
  attempt: number;
  knobs: Knobs;
  /** measured difficulty, 0–1 */
  d: number;
  /** short hash of the board a player sees (see validate.boardHash) */
  hash: string;
}

interface BankFile {
  v: number;
  levels: number;
  tiers: number;
  e: string[];
}

const bank = data as BankFile;
export const BANK_LEVELS = bank.levels;

const LAYOUT_CODE = { s: 'spread', l: 'lines', c: 'clusters' } as const;

export function encodeEntry(e: BankEntry): string {
  const k = e.knobs;
  const b36 = (x: number, w: number) => Math.max(0, Math.round(x)).toString(36).padStart(w, '0');
  return (
    b36(e.attempt, 2) +
    b36(k.stones, 1) +
    k.layout[0] +
    b36(k.months, 1) +
    b36(k.snow, 1) +
    b36(k.knots, 1) +
    b36(k.gates, 1) +
    b36(k.fences, 1) +
    b36(e.d * 1000, 2) +
    e.hash
  );
}

export function decodeEntry(s: string): BankEntry | null {
  if (!s || s.length !== 16) return null;
  const n = (a: number, b: number) => parseInt(s.slice(a, b), 36);
  const layout = LAYOUT_CODE[s[3] as keyof typeof LAYOUT_CODE];
  if (!layout) return null;
  return {
    attempt: n(0, 2),
    knobs: { stones: n(2, 3), layout, months: n(4, 5), snow: n(5, 6), knots: n(6, 7), gates: n(7, 8), fences: n(8, 9) },
    d: n(9, 11) / 1000,
    hash: s.slice(11),
  };
}

/** The bank entry for level n at tier t, or null if the bank doesn't have one. */
export function bankEntry(n: number, tier: number): BankEntry | null {
  const t = Math.max(0, Math.min(TIERS - 1, Math.round(tier)));
  if (n < 1 || n > bank.levels) return null;
  return decodeEntry(bank.e[(n - 1) * TIERS + t]);
}

/** The seed of the bank's board for level n at tier t (attempt k). */
export const bankSeed = (n: number, tier: number, attempt: number) => `journey-${n}-t${tier}-a${attempt}`;

/** The validated board spec for level n at tier t (0 gentle … 4 hardest). */
export function bankSpec(n: number, tier: number): LevelSpec {
  const t = Math.max(0, Math.min(TIERS - 1, Math.round(tier)));
  const e = bankEntry(n, t);
  if (!e) return fallbackSpec(n, t);
  const p = levelPlan(n);
  if (p.fixed) return { ...p.spec, tier: t, difficulty: e.d };
  return { ...planSpec(p, e.knobs, bankSeed(n, t, e.attempt), t), difficulty: e.d };
}
