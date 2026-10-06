import { type Board } from './board';
import { generateBoard } from './generate';
import { createRng, type Rng } from './rng';

export type ModeId = 'journey' | 'daily' | 'zen';

export interface LevelSpec {
  mode: ModeId;
  /** journey level number (1-based) or daily number */
  number: number;
  seed: string;
  rows: number;
  cols: number;
  stones: number;
  /** distinct months on the board */
  months: number;
  /** false → every card of a month looks identical (teaching levels) */
  variants: boolean;
  /** seconds for the "under par" star */
  par: number;
}

export const CHAPTERS = [
  { id: 'spring', name: 'Spring', ko: '봄', ja: '春' },
  { id: 'summer', name: 'Summer', ko: '여름', ja: '夏' },
  { id: 'autumn', name: 'Autumn', ko: '가을', ja: '秋' },
  { id: 'winter', name: 'Winter', ko: '겨울', ja: '冬' },
] as const;

export const LEVELS_PER_CHAPTER = 12;

export const chapterOf = (level: number) =>
  CHAPTERS[Math.floor((level - 1) / LEVELS_PER_CHAPTER) % CHAPTERS.length];

/** Teaching levels: small boards, identical-looking cards. */
const TUTORIAL: [rows: number, cols: number, months: number][] = [
  [4, 4, 4],
  [4, 4, 6],
  [5, 4, 8],
  [6, 4, 10],
  [6, 5, 12],
];

/** Board shape for each slot of a chapter (rows × cols, portrait). */
const CHAPTER_SHAPES: [number, number][] = [
  [6, 4], [6, 5], [6, 5], [7, 4], [6, 6], [7, 6],
  [6, 6], [8, 5], [7, 6], [8, 6], [8, 6], [8, 6],
];

const parFor = (pairs: number) => Math.ceil((pairs * 4.5 + 10) / 5) * 5;

export function journeyLevel(n: number): LevelSpec {
  const seed = `journey-${n}`;
  if (n <= TUTORIAL.length) {
    const [rows, cols, months] = TUTORIAL[n - 1];
    const pairs = (rows * cols) / 2;
    return { mode: 'journey', number: n, seed, rows, cols, stones: 0, months, variants: false, par: parFor(pairs) };
  }
  const k = n - 1;
  const chapter = Math.floor(k / LEVELS_PER_CHAPTER); // 0.. (loops get harder)
  const slot = k % LEVELS_PER_CHAPTER;
  const [rows, cols] = CHAPTER_SHAPES[slot];
  let stones = 0;
  if (chapter >= 1 && slot >= 3) stones = 2;
  if (chapter >= 2 && slot >= 6) stones = 4;
  if (chapter >= 3 && slot >= 9) stones = 6;
  if (chapter >= 4) stones = Math.min(8, 2 + 2 * Math.floor(slot / 3));
  stones = Math.min(stones, maxStones(rows, cols));
  const pairs = (rows * cols - stones) / 2;
  return {
    mode: 'journey',
    number: n,
    seed,
    rows,
    cols,
    stones,
    months: Math.min(12, pairs),
    variants: true,
    par: parFor(pairs),
  };
}

/** Day 1 of the Daily Jjak. */
export const DAILY_EPOCH = '2026-10-01';

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dailyNumber(dateKey: string): number {
  const toUtc = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(dateKey) - toUtc(DAILY_EPOCH)) / 86400000) + 1;
}

export function dailyLevel(dateKey: string): LevelSpec {
  const rows = 7;
  const cols = 6;
  const stones = 2;
  const pairs = (rows * cols - stones) / 2;
  return {
    mode: 'daily',
    number: dailyNumber(dateKey),
    seed: `daily-${dateKey}`,
    rows,
    cols,
    stones,
    months: 12,
    variants: true,
    par: parFor(pairs),
  };
}

export function zenLevel(seed: string): LevelSpec {
  const rng = createRng(seed);
  const [rows, cols] = rng.pick<[number, number]>([[6, 5], [6, 6], [7, 6], [8, 5]]);
  const pairs = (rows * cols) / 2;
  return { mode: 'zen', number: 0, seed, rows, cols, stones: 0, months: 12, variants: true, par: parFor(pairs) };
}

/** Most stones a board can hold without walling itself off (kept even). */
export const maxStones = (rows: number, cols: number) => {
  const interior = Math.max(0, (rows - 2) * (cols - 2));
  const n = Math.floor(interior / 4);
  return n - (n % 2);
};

/** Pick stone cells: interior only, spread out (no two touching where possible). */
function pickStones(rows: number, cols: number, count: number, rng: Rng): number[] {
  const out: number[] = [];
  const candidates: number[] = [];
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) candidates.push(r * cols + c);
  rng.shuffle(candidates);
  const rc = (i: number) => [Math.floor(i / cols), i % cols];
  const apart = (a: number, b: number) => {
    const [ar, ac] = rc(a);
    const [br, bc] = rc(b);
    return Math.max(Math.abs(ar - br), Math.abs(ac - bc)) >= 2; // not even diagonal
  };
  const notOrthogonal = (a: number, b: number) => {
    const [ar, ac] = rc(a);
    const [br, bc] = rc(b);
    return Math.abs(ar - br) + Math.abs(ac - bc) > 1;
  };
  // Pass 1: no contact. Pass 2: diagonal contact allowed. Pass 3: anything.
  const rules = [apart, notOrthogonal, () => true];
  for (const ok of rules) {
    for (const cell of candidates) {
      if (out.length >= count) break;
      if (!out.includes(cell) && out.every((o) => ok(o, cell))) out.push(cell);
    }
  }
  return out.slice(0, count);
}

/** Choose card ids: `months` distinct months, pairs spread round-robin. */
function pickCards(spec: LevelSpec, rng: Rng, pairs: number): number[] {
  const months = rng.shuffle([...Array(12).keys()]).slice(0, spec.months);
  const pairsPerMonth = new Map<number, number>();
  for (let p = 0; p < pairs; p++) {
    const m = months[p % months.length];
    pairsPerMonth.set(m, (pairsPerMonth.get(m) ?? 0) + 1);
  }
  const cards: number[] = [];
  for (const [m, count] of pairsPerMonth) {
    const variants = spec.variants ? rng.shuffle([0, 1, 2, 3]) : [0];
    const ids: number[] = [];
    for (let i = 0; i < count * 2; i++) ids.push(m * 4 + variants[i % variants.length]);
    rng.shuffle(ids);
    cards.push(...ids);
  }
  return cards;
}

export function buildBoard(spec: LevelSpec): Board {
  const rng = createRng(spec.seed);
  const stones = pickStones(spec.rows, spec.cols, spec.stones, rng);
  const pairs = (spec.rows * spec.cols - stones.length) / 2;
  const cards = pickCards(spec, rng, pairs);
  return generateBoard({ rows: spec.rows, cols: spec.cols, stones, cards }, rng);
}
