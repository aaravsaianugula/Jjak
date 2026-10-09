/**
 * Reading features of a board (EXPANSION_PLAN §C1, Part 1B): a few numbers, 0–1, that
 * say what a board asks of a reader, from the board reading in metrics.ts (the solver's
 * proven line, pair by pair). They are measured offline for every bank board and its
 * alternates, and stored with them (8 characters), so tailoring on the device is a
 * lookup, never a measurement.
 *
 *   keyCentre  pairs with both cards inside the rim (where a rim scanner looks last)
 *   keyRim     pairs with a card on the rim (where a centre scanner looks last)
 *   keyTop     pairs in the top half; keyBottom in the bottom half
 *              each the mean of two shares: of the key pairs, and of all the line's pairs
 *              (the key ones are what must be found; the rest is where the reading goes)
 *   twoBend    share of the line's pairs that take two bends
 *   detour     share that are long detours; edge: share that run along or around the rim
 *   decoys     same-flower pairs with no path at the start, per pair, halved (0–1)
 *
 * A **key pair** is one the board turns on: critical (it must come before every other
 * legal pair), stranding (a tempting wrong match of its flower dead-ends), or one of at
 * most two legal pairs at that point (it has to be found). Pure; no DOM.
 */
import { type Board } from '../engine/board';
import { type BoardReading } from './metrics';

export const FEATURE_KEYS = ['keyCentre', 'keyRim', 'keyTop', 'keyBottom', 'twoBend', 'detour', 'edge', 'decoys'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type ReadingFeatures = Record<FeatureKey, number>;

/** legal pairs at or under this make a pair one the player has to find */
const SCARCE = 2;

const share = <T>(xs: readonly T[], f: (x: T) => boolean) => (xs.length ? xs.filter(f).length / xs.length : 0);

export function featuresOf(board: Pick<Board, 'rows' | 'cols'>, reading: BoardReading): ReadingFeatures {
  const { rows, cols } = board;
  const onRim = (i: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
  };
  const midRow = (p: { a: number; b: number }) => (rows > 1 ? (Math.floor(p.a / cols) + Math.floor(p.b / cols)) / 2 / (rows - 1) : 0.5);
  const key = reading.pairs.filter((p) => p.critical || p.strands || p.legalBefore <= SCARCE);
  const pairs = reading.pairs;
  const both = (f: (p: { a: number; b: number }) => boolean) => 0.5 * share(key, f) + 0.5 * share(pairs, f);
  return {
    keyCentre: both((p) => !onRim(p.a) && !onRim(p.b)),
    keyRim: both((p) => onRim(p.a) || onRim(p.b)),
    keyTop: both((p) => midRow(p) < 0.5),
    keyBottom: both((p) => midRow(p) > 0.5),
    twoBend: share(pairs, (p) => p.bends === 2),
    detour: share(pairs, (p) => p.detour),
    edge: share(pairs, (p) => p.edge),
    decoys: pairs.length ? Math.min(1, reading.decoys.length / (2 * pairs.length)) : 0,
  };
}

/** One base-36 digit per feature, in FEATURE_KEYS order (value × 35, rounded). */
export function encodeFeatures(f: ReadingFeatures): string {
  return FEATURE_KEYS.map((k) => Math.round(Math.min(1, Math.max(0, f[k])) * 35).toString(36)).join('');
}

export function decodeFeatures(s: string): ReadingFeatures | null {
  if (typeof s !== 'string' || s.length !== FEATURE_KEYS.length || !/^[0-9a-z]+$/.test(s)) return null;
  const out = {} as ReadingFeatures;
  FEATURE_KEYS.forEach((k, i) => (out[k] = parseInt(s[i], 36) / 35));
  return out;
}
