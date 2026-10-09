/**
 * A frozen copy of the pre-Director Journey grammar (journeyLevel at commit 37923b2).
 * The audit measures these boards with today's metrics to draw the "before" curve.
 * Do not edit: it is a historical reference, not game code.
 */
import { type Focus, ROUTE, routeOf } from '../../src/data/route';
import { type LevelSpec, type Mechanic, MECHANIC_INTRO, maxStones } from '../../src/engine/levels';
import { type Wind } from '../../src/engine/moves';

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

const POOL: Mechanic[] = ['stones', 'leaves', 'snow', 'knots', 'wind', 'gates', 'fences'];
const WIND_CYCLE: Wind[] = ['right', 'up', 'left'];
const slides = (m: Mechanic) => m === 'leaves' || m === 'wind';
/** Falling leaves and wind never share a board, and neither shares one with snow. */
const clashes = (a: Mechanic, b: Mechanic) =>
  a !== b && ((slides(a) && slides(b)) || (slides(a) && (b === 'snow' || b === 'fences')) || (slides(b) && (a === 'snow' || a === 'fences')));

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
export function legacyJourneyLevel(n: number): LevelSpec {
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
  const gates = has('gates') ? Math.min(6, evenRound(2 + 3 * t)) : 0;
  const fences = has('fences') ? Math.round(4 + 6 * t) : 0;
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
    ...(gates ? { gates } : {}),
    ...(fences ? { fences } : {}),
  };
}
