import { BONUS_IDS } from '../data/deck';
import { type Focus, ROUTE, routeOf } from '../data/route';
import { type Board } from './board';
import { generateBoard } from './generate';
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
}

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

/** Teaching levels: small boards, identical-looking cards. */
const TUTORIAL: [rows: number, cols: number, months: number][] = [
  [4, 4, 4],
  [4, 4, 6],
  [5, 4, 8],
  [6, 4, 10],
  [6, 5, 12],
];

/** Board shape for each slot of the first chapter (rows × cols, portrait). */
const CHAPTER_SHAPES: [number, number][] = [
  [6, 4], [6, 5], [6, 5], [7, 4], [6, 6], [7, 6],
  [6, 6], [8, 5], [7, 6], [8, 6], [8, 6], [8, 6],
];

const parFor = (pairs: number) => Math.ceil((pairs * 4.5 + 10) / 5) * 5;

/**
 * Board sizes from small to the largest a phone shows comfortably (8×6). Each
 * tier has two shapes so neighbouring levels don't look alike.
 */
const TIERS: [number, number][][] = [
  [[6, 4], [7, 4]], // 24–28 cards
  [[6, 5], [7, 4]], // 28–30
  [[6, 5], [6, 6]], // 30–36
  [[6, 6], [8, 5]], // 36–40
  [[8, 5], [7, 6]], // 40–42
  [[7, 6], [8, 6]], // 42–48
  [[8, 6], [8, 6]], // 48: festival boards
];

/**
 * The rhythm of a chapter: a warm-up, the chapter's idea, a breather in the
 * middle, a peak, and the festival board to close.
 */
type Role = 'open' | 'focus' | 'plain' | 'mix' | 'rest' | 'peak' | 'festival';
const ROLES: Role[] = ['open', 'focus', 'plain', 'focus', 'focus', 'mix', 'rest', 'focus', 'mix', 'focus', 'peak', 'festival'];
const SLOT_TIER = [1, 1, 2, 2, 3, 3, 0, 3, 4, 4, 5, 6];

export type Mechanic = 'stones' | 'leaves' | 'snow' | 'lucky' | 'knots' | 'wind';
/** Chapter index (0-based) where each idea first appears on the road. */
export const MECHANIC_INTRO: Record<Mechanic, number> = { stones: 1, leaves: 2, snow: 3, lucky: 4, knots: 6, wind: 8 };
const POOL: Mechanic[] = ['stones', 'leaves', 'snow', 'knots', 'wind'];
const WIND_CYCLE: Wind[] = ['right', 'up', 'left'];
const slides = (m: Mechanic) => m === 'leaves' || m === 'wind';
/** Falling leaves and wind never share a board, and neither shares one with snow. */
const clashes = (a: Mechanic, b: Mechanic) =>
  a !== b && ((slides(a) && slides(b)) || (slides(a) && b === 'snow') || (slides(b) && a === 'snow'));

/** Snow covers a quarter to a half of the pairs' worth of cards; knots fewer. */
const snowFor = (pairs: number, t: number) => Math.max(2, Math.round(pairs * Math.min(0.5, 0.25 + 0.2 * t)));
const knotsFor = (pairs: number, t: number) => Math.max(2, Math.round(pairs * Math.min(0.3, 0.1 + 0.12 * t)));
const evenRound = (x: number) => 2 * Math.round(x / 2);

/**
 * Journey level n (1-based). Levels 1–5 teach, level 6 brings in the four
 * different-looking cards of each flower, and from there the Flower Road runs
 * through 50 places of 12 levels (600 in all). Each chapter features one idea
 * (`ROUTE[i].focus`); new ideas arrive one at a time, then mix. Past level 600
 * the road repeats as Wanderer years with fuller boards and a tighter par.
 * Deterministic: the same n always gives the same spec and board.
 */
export function journeyLevel(n: number): LevelSpec {
  n = Math.max(1, Math.floor(n));
  const seed = `journey-${n}`;
  if (n <= TUTORIAL.length) {
    const [rows, cols, months] = TUTORIAL[n - 1];
    const pairs = (rows * cols) / 2;
    return { mode: 'journey', number: n, seed, rows, cols, stones: 0, months, variants: false, par: parFor(pairs), gravity: false, snow: 0 };
  }
  const pos = routeOf(n);
  const { slot, year } = pos;
  const ch = pos.index;
  const role = ROLES[slot];
  const festival = role === 'festival';

  if (year === 0 && ch === 0) {
    // Chapter 1 (Gyeongju): just the cards, growing to a full deck.
    const [rows, cols] = CHAPTER_SHAPES[slot];
    const pairs = (rows * cols) / 2;
    return {
      mode: 'journey', number: n, seed, rows, cols, stones: 0, months: Math.min(12, pairs), variants: true,
      par: parFor(pairs) + (festival ? 15 : 0), gravity: false, snow: 0, festival,
    };
  }

  const known = (m: Mechanic) => year > 0 || ch >= MECHANIC_INTRO[m];
  const pool = POOL.filter(known);
  const focus: Focus = year > 0 && pos.chapter.focus === 'basics' ? 'mix' : pos.chapter.focus;
  const introducing = year === 0 && focus !== 'mix' && focus !== 'basics' && ch === MECHANIC_INTRO[focus];

  /** A known idea that fits beside `with`, rotating through the pool by slot. */
  const other = (k: number, with_: Mechanic[]): Mechanic | null => {
    const list = pool.filter((m) => !with_.includes(m) && !with_.some((x) => clashes(x, m)));
    return list.length ? list[(ch * 5 + slot * 7 + k) % list.length] : null;
  };
  const focusSet = (): Mechanic[] => {
    if (focus === 'basics') return [];
    if (focus === 'mix') {
      const a = other(0, []);
      const b = a ? other(1, [a]) : null;
      return [a, b].filter((m): m is Mechanic => !!m);
    }
    if (focus === 'lucky') {
      const b = other(2, []);
      return b ? ['lucky', b] : ['lucky'];
    }
    return [focus];
  };

  let set: Mechanic[] = [];
  let bump = 0;
  if (role === 'open') {
    set = introducing ? [] : focusSet().slice(0, 1);
    bump = -0.15;
  } else if (role === 'focus') set = focusSet();
  else if (role === 'mix') {
    const m = other(4, focusSet()) ?? focusSet()[0];
    if (m) set = [m];
  } else if (role === 'peak') {
    set = focusSet();
    const extra = other(5, set);
    if (extra && set.length < 2) set.push(extra);
    bump = 0.2;
  } else if (role === 'festival') {
    set = focusSet().slice(0, 1);
    bump = -0.1;
  }
  if (known('lucky') && !set.includes('lucky') && (festival || (role === 'rest' && (ch + year) % 2 === 1))) set.push('lucky');
  const has = (m: Mechanic) => set.includes(m);

  const progress = year > 0 ? 1 + 0.2 * Math.min(year, 3) : ch / (ROUTE.length - 1);
  const t = Math.max(0, progress + bump);
  const shift = year > 0 || ch >= 12 ? 2 : ch >= 4 ? 1 : 0;
  const tier = TIERS[Math.min(TIERS.length - 1, SLOT_TIER[slot] + shift)];
  const [rows, cols] = tier[(ch + slot) % 2];

  // Stones: the idea itself in stone chapters, a quiet background elsewhere.
  const max = maxStones(rows, cols);
  let f = has('stones') ? 0.6 + 0.4 * t : known('stones') && role !== 'rest' && role !== 'open' ? 0.15 + 0.45 * t : 0;
  if (has('snow') || has('knots')) f *= 0.6; // leave room for covered and tied cards
  let stones = Math.min(max, evenRound(max * f));
  if (has('stones')) stones = Math.min(max, Math.max(2, stones));
  const pairs = (rows * cols - stones) / 2;

  const wind: Wind | null = has('leaves') ? 'down' : has('wind') ? WIND_CYCLE[(ch + slot + year) % 3] : null;
  const snow = has('snow') ? snowFor(pairs, t) : 0;
  const knots = has('knots') ? knotsFor(pairs, t) : 0;
  // Sliding, snow and knots each slow you down; festival boards get extra room.
  const extra = Math.min(20, (wind ? 10 : 0) + (snow ? 10 : 0) + (knots ? 10 : 0)) + (festival ? 15 : 0);
  const par = Math.max(parFor(pairs), parFor(pairs) + extra - 5 * Math.min(year, 2));
  return {
    mode: 'journey',
    number: n,
    seed,
    rows,
    cols,
    stones,
    months: Math.min(12, pairs),
    variants: true,
    par,
    gravity: wind ?? false,
    snow,
    knots,
    lucky: has('lucky'),
    festival,
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
  const stones = pickStones(spec.rows, spec.cols, spec.stones, rng);
  const pairs = (spec.rows * spec.cols - stones.length) / 2;
  const cards = pickCards(spec, rng, pairs);
  return generateBoard({ rows: spec.rows, cols: spec.cols, stones, cards }, rng);
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
