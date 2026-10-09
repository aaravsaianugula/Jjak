/**
 * The shipped level bank: levels 1–600 × 5 tiers, built offline by the search
 * (`npm run bank`, scripts/build-bank.ts) and validated before release. On the
 * device the Director only *selects* an entry, so getting a board is instant.
 *
 * Each entry is 20 characters: the winning attempt (2, base 36), the knobs
 * (stones, layout, months, snow, knots, gates, fences, torii, streams, seals, ink: 1 each, base 36), the
 * measured difficulty d × 1000 (2, base 36) and a 5-character board hash that a
 * test uses to catch a generator change that would silently stale the bank.
 *
 * Bank v2 slots also carry each board's reading features (8 characters, reading.ts)
 * and up to two **alternates**: other solver-proven boards for the same level and tier,
 * within `TAILOR.maxDGap` of its d, that read differently (key pairs elsewhere, more
 * 2-bend paths, more decoys). A slot is `entry + features` repeated, primary first; the
 * Director's challenge picks among them (tailor.ts). A 16-character slot (v1) is the
 * primary alone, with no features.
 */
import data from '../data/level-bank.json';
import { type LevelSpec } from '../engine/levels';
import { type Knobs, fallbackSpec, levelPlan, planSpec } from './plan';
import { FEATURE_KEYS, type ReadingFeatures, decodeFeatures } from './reading';

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
    b36(k.torii, 1) +
    b36(k.streams, 1) +
    b36(k.seals, 1) +
    b36(k.ink, 1) +
    b36(e.d * 1000, 2) +
    e.hash
  );
}

export function decodeEntry(s: string): BankEntry | null {
  if (!s || s.length !== 20) return null;
  const n = (a: number, b: number) => parseInt(s.slice(a, b), 36);
  const layout = LAYOUT_CODE[s[3] as keyof typeof LAYOUT_CODE];
  if (!layout) return null;
  return {
    attempt: n(0, 2),
    knobs: { stones: n(2, 3), layout, months: n(4, 5), snow: n(5, 6), knots: n(6, 7), gates: n(7, 8), fences: n(8, 9), torii: n(9, 10), streams: n(10, 11), seals: n(11, 12), ink: n(12, 13) },
    d: n(13, 15) / 1000,
    hash: s.slice(15),
  };
}

/** Characters per board in a v2 slot: the entry and its reading features. */
export const SLOT_BOARD = 16 + FEATURE_KEYS.length;

export interface BankCandidate {
  entry: BankEntry;
  /** reading features (null in a v1 slot) */
  features: ReadingFeatures | null;
}

/** A slot's boards, primary first (one 16-character entry in a v1 slot). */
export function decodeSlot(s: string): BankCandidate[] {
  if (typeof s !== 'string') return [];
  if (s.length === 16) {
    const entry = decodeEntry(s);
    return entry ? [{ entry, features: null }] : [];
  }
  const out: BankCandidate[] = [];
  if (s.length % SLOT_BOARD !== 0) return out;
  for (let i = 0; i < s.length; i += SLOT_BOARD) {
    const entry = decodeEntry(s.slice(i, i + 16));
    if (!entry) return i ? out : [];
    out.push({ entry, features: decodeFeatures(s.slice(i + 16, i + SLOT_BOARD)) });
  }
  return out;
}

export const encodeSlot = (boards: { entry: BankEntry; features: string }[]) => boards.map((b) => encodeEntry(b.entry) + b.features).join('');

const slotOf = (n: number, tier: number): string | null => {
  const t = Math.max(0, Math.min(TIERS - 1, Math.round(tier)));
  if (n < 1 || n > bank.levels) return null;
  return bank.e[(n - 1) * TIERS + t] ?? null;
};

/** The bank entry for level n at tier t, or null if the bank doesn't have one. */
export function bankEntry(n: number, tier: number): BankEntry | null {
  const s = slotOf(n, tier);
  return s ? decodeEntry(s.slice(0, 16)) : null;
}

/** Every board the bank holds for level n at tier t, the tier's own board first. */
export function bankCandidates(n: number, tier: number): BankCandidate[] {
  const s = slotOf(n, tier);
  return s ? decodeSlot(s) : [];
}

/** The seed of the bank's board for level n at tier t (attempt k). */
export const bankSeed = (n: number, tier: number, attempt: number) => `journey-${n}-t${tier}-a${attempt}`;

/** The board spec of one bank entry for level n at tier t. */
export function candidateSpec(n: number, tier: number, e: BankEntry): LevelSpec {
  const t = Math.max(0, Math.min(TIERS - 1, Math.round(tier)));
  const p = levelPlan(n);
  if (p.fixed) return { ...p.spec, tier: t, difficulty: e.d };
  return { ...planSpec(p, e.knobs, bankSeed(n, t, e.attempt), t), difficulty: e.d };
}

/** The validated board spec for level n at tier t (0 gentle … 4 hardest). */
export function bankSpec(n: number, tier: number): LevelSpec {
  const t = Math.max(0, Math.min(TIERS - 1, Math.round(tier)));
  const e = bankEntry(n, t);
  return e ? candidateSpec(n, t, e) : fallbackSpec(n, t);
}
