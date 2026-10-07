import { BONUS_IDS } from '../data/deck';
import { routeOf } from '../data/route';
import { levelPlan } from '../director/plan';
import { type Board, FENCE_DOWN, FENCE_RIGHT } from './board';
import { generateBoard } from './generate';
import { type GoalId } from './goals';
import { type Wind } from './moves';
import { createRng, type Rng } from './rng';

export type ModeId = 'journey' | 'daily' | 'zen' | 'rush';

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
  /**
   * Cards slide to fill gaps after each pair. `true` or 'down' = "Falling leaves";
   * 'left' | 'right' | 'up' = "Wind". `false` = cards stay put. Read it with `windOf()`.
   */
  gravity: boolean | Wind;
  /** "First snow": this many cards start face-down until a neighbour clears */
  snow: number;
  /** "Knots" (매듭): this many cards start tied with a silk cord until a neighbour clears */
  knots?: number;
  /** the board holds the lucky bonus pair (card ids 48/49) */
  lucky?: boolean;
  /** the 12th level of a Journey chapter: a big celebration board */
  festival?: boolean;
  /** "Gates" (門): this many gate cells (even), each opened by clearing a pair of its flower */
  gates?: number;
  /** "Fences" (울타리 · 垣): this many bamboo fence segments on cell edges; paths can't cross them */
  fences?: number;
  /** how stones are laid out: spread apart (default), short lines that force long paths, or small clusters */
  layout?: StoneLayout;
  /** goal board: the third blossom is this goal instead of par */
  goal?: GoalId;
  /** Level Director: the skill tier this board was built for (0 gentle … 4 hardest) */
  tier?: number;
  /** Level Director: measured difficulty of this board, 0–1 (for the dev panel and analytics) */
  difficulty?: number;
}

export type StoneLayout = 'spread' | 'lines' | 'clusters';

/** The direction cards slide on this board, or null if they stay put. */
export const windOf = (spec: Pick<LevelSpec, 'gravity'>): Wind | null =>
  spec.gravity === true ? 'down' : spec.gravity === false ? null : spec.gravity;

const WIND_ARROW: Record<Wind, string> = { down: '↓', left: '←', right: '→', up: '↑' };
export const windArrow = (w: Wind) => WIND_ARROW[w];

/** Short name of the board's main twist, for chips and title cards ('' if none). */
export function mechanicLabel(spec: LevelSpec): string {
  const w = windOf(spec);
  if (w === 'down') return 'Falling leaves';
  if (w) return 'Wind';
  if (spec.snow) return 'First snow';
  if (spec.knots) return 'Knots';
  if (spec.gates) return 'Gates';
  if (spec.fences) return 'Fences';
  if (spec.stones) return 'Stones';
  if (spec.lucky) return 'Lucky cards';
  return '';
}

/** Every twist on the board, in reading order (intro card, map). */
export function mechanicList(spec: LevelSpec): string[] {
  const out: string[] = [];
  const w = windOf(spec);
  if (w === 'down') out.push('Falling leaves');
  else if (w) out.push(`Wind ${WIND_ARROW[w]}`);
  if (spec.snow) out.push('First snow');
  if (spec.knots) out.push('Knots');
  if (spec.gates) out.push('Gates');
  if (spec.fences) out.push('Fences');
  if (spec.stones) out.push('Stones');
  if (spec.lucky) out.push('Lucky cards');
  return out;
}

export const CHAPTERS = [
  { id: 'spring', name: 'Spring', ko: '봄', ja: '春' },
  { id: 'summer', name: 'Summer', ko: '여름', ja: '夏' },
  { id: 'autumn', name: 'Autumn', ko: '가을', ja: '秋' },
  { id: 'winter', name: 'Winter', ko: '겨울', ja: '冬' },
] as const;

export const LEVELS_PER_CHAPTER = 12;

/**
 * The season of a Journey level. Levels 1–600 keep the old cycle (chapter % 4);
 * Wanderer years follow the place's own season, since 50 places don't divide by 4.
 */
export const chapterOf = (level: number) => CHAPTERS[routeOf(level).chapter.season];

const parFor = (pairs: number) => Math.ceil((pairs * 4.5 + 10) / 5) * 5;

export type Mechanic = 'stones' | 'leaves' | 'snow' | 'lucky' | 'knots' | 'wind' | 'gates' | 'fences';
/** Chapter index (0-based) where each idea first appears on the road. */
export const MECHANIC_INTRO: Record<Mechanic, number> = { stones: 1, leaves: 2, snow: 3, lucky: 4, knots: 6, wind: 8, gates: 10, fences: 13 };

/**
 * Journey level n (1-based): the level's identity at the middle tier. The
 * grammar (places, the 12-slot rhythm, mechanics, goals, the curve) lives in
 * the Level Director's plan (src/director/plan.ts); the board a player actually
 * gets comes from the Director (`playLevel`), which fills the same identity in
 * at their tier. Deterministic: the same n always gives the same spec and board.
 */
export function journeyLevel(n: number): LevelSpec {
  return levelPlan(n).spec;
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

/** Snow covers roughly a fifth of the cards. */
const snowCount = (pairs: number) => Math.max(2, Math.round(pairs * 0.4));

/** Each weekday has its own flavour, so the Daily never feels the same twice. */
export const DAILY_THEMES = [
  { name: 'Sunday garden', rows: 8, cols: 6, stones: 0, gravity: false, snow: false },
  { name: 'Stone Monday', rows: 7, cols: 6, stones: 4, gravity: false, snow: false },
  { name: 'Snowy Tuesday', rows: 7, cols: 6, stones: 0, gravity: false, snow: true },
  { name: 'Leaf-fall Wednesday', rows: 7, cols: 6, stones: 0, gravity: true, snow: false },
  { name: 'Thursday stones', rows: 8, cols: 6, stones: 4, gravity: false, snow: false },
  { name: 'Falling Friday', rows: 7, cols: 6, stones: 2, gravity: true, snow: false },
  { name: 'Saturday frost', rows: 8, cols: 5, stones: 2, gravity: false, snow: true },
] as const;

export const dailyTheme = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return DAILY_THEMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

export function dailyLevel(dateKey: string): LevelSpec {
  const t = dailyTheme(dateKey);
  const pairs = (t.rows * t.cols - t.stones) / 2;
  return {
    mode: 'daily',
    number: dailyNumber(dateKey),
    seed: `daily-${dateKey}`,
    rows: t.rows,
    cols: t.cols,
    stones: t.stones,
    months: 12,
    variants: true,
    par: parFor(pairs) + (t.gravity || t.snow ? 10 : 0),
    gravity: t.gravity,
    snow: t.snow ? snowCount(pairs) : 0,
  };
}

export function zenLevel(seed: string): LevelSpec {
  const rng = createRng(seed);
  const [rows, cols] = rng.pick<[number, number]>([[6, 5], [6, 6], [7, 6], [8, 5]]);
  const pairs = (rows * cols) / 2;
  return { mode: 'zen', number: 0, seed, rows, cols, stones: 0, months: 12, variants: true, par: parFor(pairs), gravity: false, snow: 0 };
}

/**
 * Rush: a run of quick boards against the clock. Boards grow a little as the
 * run goes on and pick up stones, so long runs stay tense.
 */
export const RUSH = {
  startMs: 60_000,
  perPairMs: 1000,
  perComboPairMs: 2000, // pairs made at ×3 or more
  boardClearMs: 8000,
  continueMs: 20_000,
  boardClearBonus: 1000,
};

export function rushLevel(runSeed: string, round: number): LevelSpec {
  const shapes: [number, number][] = [[5, 4], [6, 4], [6, 5], [6, 6], [7, 6]];
  const [rows, cols] = shapes[Math.min(round, shapes.length - 1)];
  const stones = round >= 3 ? 2 : 0;
  const pairs = (rows * cols - stones) / 2;
  return {
    mode: 'rush',
    number: round + 1,
    seed: `${runSeed}-r${round}`,
    rows,
    cols,
    stones,
    months: Math.min(12, pairs),
    variants: round >= 1,
    par: parFor(pairs),
    gravity: false,
    snow: 0,
  };
}

/** Most stones a board can hold without walling itself off (kept even). */
export const maxStones = (rows: number, cols: number) => {
  const interior = Math.max(0, (rows - 2) * (cols - 2));
  const n = Math.floor(interior / 4);
  return n - (n % 2);
};

/**
 * Pick stone cells, interior only. 'spread' keeps them apart (no two touching
 * where possible); 'lines' lays short straight walls that force long paths;
 * 'clusters' groups them in little piles with open lanes between.
 */
export function pickStones(rows: number, cols: number, count: number, rng: Rng, layout: StoneLayout = 'spread'): number[] {
  if (layout !== 'spread' && count > 0) return pickStonesShaped(rows, cols, count, rng, layout);
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

function pickStonesShaped(rows: number, cols: number, count: number, rng: Rng, layout: 'lines' | 'clusters'): number[] {
  const out = new Set<number>();
  const inside = (r: number, c: number) => r >= 1 && c >= 1 && r < rows - 1 && c < cols - 1;
  for (let guard = 0; out.size < count && guard < 200; guard++) {
    const r = 1 + rng.int(Math.max(1, rows - 2));
    const c = 1 + rng.int(Math.max(1, cols - 2));
    if (!inside(r, c)) continue;
    const cells: number[] = [r * cols + c];
    if (layout === 'lines') {
      // A wall of two, along a row or a column.
      const [dr, dc] = rng.next() < 0.5 ? [0, 1] : [1, 0];
      if (inside(r + dr, c + dc)) cells.push((r + dr) * cols + c + dc);
    } else {
      // A pile of two, diagonal, so paths still slip past.
      const [dr, dc] = rng.pick([[1, 1], [1, -1]] as const);
      if (inside(r + dr, c + dc)) cells.push((r + dr) * cols + c + dc);
    }
    if (cells.length < 2 || cells.some((x) => out.has(x))) continue;
    // Keep one free cell around every pile so no region is sealed off.
    const near = (x: number) => [x - 1, x + 1, x - cols, x + cols].some((n) => out.has(n));
    if (cells.some(near) && guard < 150) continue;
    for (const x of cells) if (out.size < count) out.add(x);
  }
  const list = [...out];
  return list.length % 2 ? list.slice(0, -1) : list;
}

/**
 * Gates (門): even count, interior cells that aren't stones, apart from each
 * other. Months are assigned after the cards are known (see buildBoard).
 */
export function pickGateCells(rows: number, cols: number, count: number, rng: Rng, blocked: ReadonlySet<number>): number[] {
  const cand: number[] = [];
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) if (!blocked.has(r * cols + c)) cand.push(r * cols + c);
  rng.shuffle(cand);
  const out: number[] = [];
  const touches = (i: number) => [i - 1, i + 1, i - cols, i + cols].some((n) => out.includes(n) || blocked.has(n));
  for (const loose of [false, true]) {
    for (const i of cand) {
      if (out.length >= count) break;
      if (!out.includes(i) && (loose || !touches(i))) out.push(i);
    }
  }
  const n = Math.min(out.length, count);
  return out.slice(0, n - (n % 2));
}

/**
 * Fences (울타리 · 垣): bamboo fences on the edges between two cells, laid as
 * short straight runs (one to three segments) so they read as real fences and
 * force a detour rather than a one-cell nudge. Runs favour the board's inside
 * (a fence on the rim is easy to walk round through the outer lane), never
 * touch a stone (a fence there would change nothing), and keep every cell open
 * on at least two sides, counting fences, stones and gates, so nothing is
 * sealed in. `count` is the number of segments.
 */
export function pickFences(rows: number, cols: number, count: number, rng: Rng, blocked: ReadonlySet<number>): Uint8Array {
  const walls = new Uint8Array(rows * cols);
  // Closed sides of each cell (blocked neighbours on the board, then fences too).
  const sides = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c > 0 && blocked.has(i - 1)) sides[i]++;
      if (c < cols - 1 && blocked.has(i + 1)) sides[i]++;
      if (r > 0 && blocked.has(i - cols)) sides[i]++;
      if (r < rows - 1 && blocked.has(i + cols)) sides[i]++;
    }
  }
  const touched = new Set<number>();
  const depth = (i: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return Math.min(r, c, rows - 1 - r, cols - 1 - c);
  };
  // A run starts on an edge: [cell, vertical?]. Vertical = a fence on the cell's right edge.
  const starts: { i: number; v: boolean; key: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c < cols - 1) starts.push({ i, v: true, key: Math.min(depth(i), depth(i + 1)) + rng.next() * 1.6 });
      if (r < rows - 1) starts.push({ i, v: false, key: Math.min(depth(i), depth(i + cols)) + rng.next() * 1.6 });
    }
  }
  starts.sort((a, b) => b.key - a.key);
  const ok = (i: number, j: number, bit: number, apart: boolean) =>
    !blocked.has(i) && !blocked.has(j) && !(walls[i] & bit) && sides[i] < 2 && sides[j] < 2 && (!apart || (!touched.has(i) && !touched.has(j)));
  let placed = 0;
  for (const apart of [true, false]) {
    for (const s of starts) {
      if (placed >= count) break;
      const len = Math.min(count - placed, rng.pick([1, 2, 2, 3]));
      // Extend the run along its line: down a column boundary, or along a row boundary.
      const run: [number, number, number][] = [];
      for (let k = 0; k < len; k++) {
        const i = s.v ? s.i + k * cols : s.i + k;
        const r = Math.floor(i / cols);
        const c = i % cols;
        if (s.v ? r >= rows || c >= cols - 1 : c >= cols || r >= rows - 1 || Math.floor(i / cols) !== Math.floor(s.i / cols)) break;
        const j = s.v ? i + 1 : i + cols;
        const bit = s.v ? FENCE_RIGHT : FENCE_DOWN;
        if (!ok(i, j, bit, apart)) break;
        run.push([i, j, bit]);
      }
      if (!run.length) continue;
      for (const [i, j, bit] of run) {
        walls[i] |= bit;
        sides[i]++;
        sides[j]++;
        touched.add(i).add(j);
        placed++;
      }
    }
  }
  return walls;
}

/** Choose card ids: `months` distinct months, pairs spread round-robin. */
function pickCards(spec: LevelSpec, rng: Rng, pairs: number): number[] {
  const months = rng.shuffle([...Array(12).keys()]).slice(0, spec.months);
  const pairsPerMonth = new Map<number, number>();
  // Lucky boards trade one flower pair for the two bonus cards (month 12).
  const flowerPairs = spec.lucky && pairs > 1 ? pairs - 1 : pairs;
  for (let p = 0; p < flowerPairs; p++) {
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
  if (flowerPairs < pairs) cards.push(...BONUS_IDS);
  return cards;
}

export function buildBoard(spec: LevelSpec): Board {
  const rng = createRng(spec.seed);
  const stones = pickStones(spec.rows, spec.cols, spec.stones, rng, spec.layout);
  // Gates and fences draw from the stream only when the board has them, so
  // every older board (and the worldwide Daily) stays exactly the same.
  const gateCells = spec.gates ? pickGateCells(spec.rows, spec.cols, spec.gates, rng, new Set(stones)) : [];
  const pairs = (spec.rows * spec.cols - stones.length - gateCells.length) / 2;
  const cards = pickCards(spec, rng, pairs);
  let gates: { cell: number; month: number }[] | undefined;
  if (gateCells.length) {
    // Each gate shows a flower on the board, a different one where possible.
    const months = rng.shuffle([...new Set(cards.map((id) => id >> 2).filter((m) => m < 12))]);
    gates = gateCells.map((cell, k) => ({ cell, month: months[k % months.length] }));
  }
  const walls = spec.fences ? pickFences(spec.rows, spec.cols, spec.fences, rng, new Set([...stones, ...gateCells])) : undefined;
  return generateBoard({ rows: spec.rows, cols: spec.cols, stones, gates, walls, cards }, rng);
}

/**
 * Choose which cards start under snow: cards fully surrounded by other cards
 * (so they could never be the very first pair anyway), deterministic per seed.
 */
export function pickSnow(b: Board, count: number, seed: string): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  const rng = createRng(`${seed}-snow`);
  const candidates: number[] = [];
  for (let r = 1; r < b.rows - 1; r++) {
    for (let c = 1; c < b.cols - 1; c++) {
      const i = r * b.cols + c;
      const around = [i - 1, i + 1, i - b.cols, i + b.cols];
      if (b.cells[i] >= 0 && around.every((n) => b.cells[n] >= 0)) candidates.push(i);
    }
  }
  for (const i of rng.shuffle(candidates)) {
    if (out.size >= count) break;
    out.add(i);
  }
  return out;
}

/**
 * Choose which cards start tied with a silk cord (매듭). Like snow: only cards
 * walled in by other cards on all four sides, so no knot is loose at the start.
 * Knots are kept apart where possible so each can be untied on its own.
 */
export function pickKnots(b: Board, count: number, seed: string, avoid: ReadonlySet<number> = new Set()): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  const rng = createRng(`${seed}-knots`);
  const candidates: number[] = [];
  for (let r = 1; r < b.rows - 1; r++) {
    for (let c = 1; c < b.cols - 1; c++) {
      const i = r * b.cols + c;
      const around = [i - 1, i + 1, i - b.cols, i + b.cols];
      if (b.cells[i] >= 0 && !avoid.has(i) && around.every((n) => b.cells[n] >= 0)) candidates.push(i);
    }
  }
  rng.shuffle(candidates);
  const touches = (i: number) => [i - 1, i + 1, i - b.cols, i + b.cols].some((n) => out.has(n));
  for (const loose of [false, true]) {
    for (const i of candidates) {
      if (out.size >= count) break;
      if (!out.has(i) && (loose || !touches(i))) out.add(i);
    }
  }
  return out;
}
