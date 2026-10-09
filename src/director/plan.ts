/**
 * Authored layer: the level grammar and the designed difficulty curve.
 *
 * `levelPlan(n)` is a level's stable, player-independent identity: the place on
 * the Flower Road, its slot and role in the chapter's 12-slot rhythm, the board
 * shape, the set of mechanics, the wind, the goal, the festival and lucky flags,
 * a fixed par, and the designed difficulty `base`. Only the *knobs* inside that
 * identity adapt to the player's tier (stone count and layout, months, snow,
 * knots, gate and fence counts), and a mechanic in the identity never
 * disappears at any tier.
 *
 * Partner mechanics and goals come from bag randomisers that run along the whole
 * road in order, so neighbouring levels don't repeat a combination until the bag
 * empties. The road is computed once per year and cached.
 *
 * Imports note: levels.ts imports this module (journeyLevel delegates here), so
 * nothing from levels.ts or mechanics.ts may be *used* at module load time.
 */
import { type Focus, type RouteChapter, ROUTE, ROUTE_CHAPTERS, ROUTE_LEVELS_PER_CHAPTER, routeOf } from '../data/route';
import { GOAL_IDS, type GoalId } from '../engine/goals';
import { type LevelSpec, type Mechanic, type StoneLayout, MECHANIC_INTRO, maxStones } from '../engine/levels';
import { type Wind } from '../engine/moves';
import { type Rng, createRng } from '../engine/rng';

export type Role = 'tutorial' | 'open' | 'focus' | 'plain' | 'mix' | 'rest' | 'peak' | 'festival';

/** The rhythm of a chapter: open → focus → plain → focus → focus → mix → rest → focus → mix → focus → peak → festival. */
export const ROLES: Role[] = ['open', 'focus', 'plain', 'focus', 'focus', 'mix', 'rest', 'focus', 'mix', 'focus', 'peak', 'festival'];

/** The largest board: 8 rows × 7 columns (8×7 only on late peak and festival boards). */
export const MAX_ROWS = 8;
export const MAX_COLS = 7;

/** A level's stable identity. Only the board inside it adapts to the player. */
export interface LevelPlan {
  n: number;
  /** designed difficulty for this level before any player offset, 0–1 (sawtooth, rising) */
  base: number;
  /** the identity as a spec at the middle tier (tier 2): display and fallback */
  spec: LevelSpec;
  place: RouteChapter;
  /** 0-based place on the road (0–49) */
  chapter: number;
  /** 0 = the first pass, 1+ = Wanderer years */
  year: number;
  /** 0-based slot in the chapter (11 = festival) */
  slot: number;
  role: Role;
  rows: number;
  cols: number;
  /** every twist on the board, in library order (stones may be the quiet background kind) */
  mechanics: Mechanic[];
  /** the direction cards slide, or null */
  wind: Wind | null;
  goal?: GoalId;
  festival: boolean;
  lucky: boolean;
  /** seconds for the par blossom: fixed per level, the same at every tier */
  par: number;
  /** the first board that shows this mechanic (it shows it alone) */
  introduces?: Mechanic;
  /** a teaching board: identical at every tier (levels 1–6) */
  fixed: boolean;
}

/** The knobs a tier turns inside a level's identity. */
export interface Knobs {
  stones: number;
  layout: StoneLayout;
  months: number;
  snow: number;
  knots: number;
  gates: number;
  fences: number;
  /** torii twin pairs (0–2) */
  torii: number;
  /** water cells (even) */
  streams: number;
  /** sealed pairs, numbered 1…n (0–4) */
  seals: number;
  /** blots of wet ink (even) */
  ink: number;
}

export type KnobId = keyof Knobs;

const MECH_ORDER: Mechanic[] = ['stones', 'leaves', 'snow', 'lucky', 'knots', 'wind', 'gates', 'fences', 'torii', 'streams', 'seals', 'ink'];
/** Partner ideas drawn from the bag (stones are the quiet background, lucky has its own slots). */
export const PARTNERS: Mechanic[] = ['leaves', 'snow', 'knots', 'wind', 'gates', 'fences', 'torii', 'streams', 'seals', 'ink'];
export const WIND_CYCLE: Wind[] = ['right', 'up', 'left'];
const slides = (m: Mechanic) => m === 'leaves' || m === 'wind';
/** Fixed things that cards can't slide against or over: snow, fences and the terrain (torii, streams). */
const staysPut = (m: Mechanic) => m === 'snow' || m === 'fences' || m === 'torii' || m === 'streams' || m === 'seals' || m === 'ink';
/** Card locks that never share a card with a seal. */
const covers = (m: Mechanic) => m === 'snow' || m === 'knots';
/**
 * Same rule as MECHANICS[*].clashes (checked by a test): sliding never meets
 * snow, fences, terrain, seals, ink or the other slide; seals never meet snow or knots.
 */
export const clashes = (a: Mechanic, b: Mechanic): boolean =>
  a !== b &&
  ((slides(a) && slides(b)) || (slides(a) && staysPut(b)) || (slides(b) && staysPut(a)) || (a === 'seals' && covers(b)) || (b === 'seals' && covers(a)));
/** Cells a tier's knobs take from the cards: stones, gates, torii (two per pair), water and ink. */
const fixedCells = (k: Pick<Knobs, 'stones' | 'gates' | 'torii' | 'streams' | 'ink'>) => k.stones + k.gates + 2 * k.torii + k.streams + k.ink;

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
/** Size classes, small to large; two shapes each so neighbours don't look alike. */
export const SIZES: [number, number][][] = [
  [[6, 4], [7, 4]], // 24–28 cards
  [[6, 5], [7, 4]], // 28–30
  [[6, 5], [6, 6]], // 30–36
  [[6, 6], [8, 5]], // 36–40
  [[8, 5], [7, 6]], // 40–42
  [[7, 6], [8, 6]], // 42–48
  [[8, 6], [8, 6]], // 48: festival boards
  [[8, 7], [8, 7]], // 56: late peak and festival boards
];
const SLOT_SIZE = [1, 1, 2, 2, 3, 3, 0, 3, 4, 4, 5, 6];

/**
 * The sawtooth inside a chapter: tension → peak → breather. The open board and
 * the rest board are clear dips, the focus and mix boards climb, the peak stands
 * well clear of everything else (the board a player remembers), and the festival
 * is a celebration: high, but a step below the peak.
 */
const SAW = [-0.12, 0, -0.06, 0.03, 0.05, 0.07, -0.15, 0.08, 0.1, 0.11, 0.22, 0.12];
const TUTORIAL_BASE = [0.03, 0.05, 0.08, 0.1, 0.12, 0.14];

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
const evenRound = (x: number) => 2 * Math.round(x / 2);
export const parFor = (pairs: number) => Math.ceil((pairs * 4.5 + 10) / 5) * 5;

/**
 * The road under the sawtooth: the smooth rise across the 50 places (no chapter
 * rhythm). The first pass climbs from 0.2 to 0.68: tier 2 starts near 0.25 and
 * ends near 0.7, tier 4 near 0.9 late. The generator reaches the top of that
 * range through the card arrangement (`arrangeOf`), never smaller cards. Wanderer
 * years carry on from the end of the first pass. A steady player's skill follows
 * this line; the sawtooth swings around it.
 */
export function roadBase(n: number): number {
  n = Math.max(1, Math.floor(n));
  const { index, year } = routeOf(n);
  const p = index / (ROUTE_CHAPTERS - 1);
  return year > 0 ? 0.6 + 0.03 * Math.min(year, 3) + 0.06 * p : 0.2 + 0.48 * p;
}

/** Designed difficulty of level n, 0–1: a sawtooth in each chapter on a road that rises. */
export function designedBase(n: number): number {
  n = Math.max(1, Math.floor(n));
  if (n <= TUTORIAL_BASE.length) return TUTORIAL_BASE[n - 1];
  const { index, year, slot } = routeOf(n);
  const p = index / (ROUTE_CHAPTERS - 1);
  const amp = 0.6 + 0.4 * Math.min(1, p + year);
  return Math.round(clamp(roadBase(n) + SAW[slot] * amp, 0.03, 0.97) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// The road: identities for one year, computed in order (the bags need order).

interface Identity {
  n: number;
  chapter: number;
  year: number;
  slot: number;
  role: Role;
  rows: number;
  cols: number;
  mechanics: Mechanic[];
  wind: Wind | null;
  goal?: GoalId;
  festival: boolean;
  introduces?: Mechanic;
  fixed: boolean;
  tutorialMonths?: number;
}

/** A bag randomiser: every item once (shuffled) before any repeats. */
class Bag<T> {
  private items: T[] = [];
  constructor(private rng: Rng, private refill: () => T[]) {}
  /** Add a newly available item at a random place in what's left. */
  add(x: T) {
    this.items.splice(this.rng.int(this.items.length + 1), 0, x);
  }
  /** Next item passing `ok`, preferring ones not in `avoid`. Refills when needed. */
  draw(ok: (x: T) => boolean, avoid: readonly T[] = []): T | null {
    for (const strict of [true, false]) {
      for (let pass = 0; pass < 2; pass++) {
        const i = this.items.findIndex((x) => ok(x) && (!strict || !avoid.includes(x)));
        if (i >= 0) return this.items.splice(i, 1)[0];
        // Refill with what isn't already waiting: an item that keeps clashing
        // must not pile up copies and bury every idea behind it.
        this.items.push(...this.rng.shuffle(this.refill().filter((x) => !this.items.includes(x))));
      }
    }
    return null;
  }
}

const cache = new Map<number, Identity[]>();

function road(year: number): Identity[] {
  const hit = cache.get(year);
  if (hit) return hit;
  const rng = createRng(`flower-road-${year}`);
  const known = (m: Mechanic, ch: number) => year > 0 || ch >= MECHANIC_INTRO[m];
  let pool: Mechanic[] = [];
  const partners = new Bag<Mechanic>(rng, () => pool.slice());
  const goals = new Bag<GoalId>(rng, () => GOAL_IDS.slice());
  let lastPartners: Mechanic[] = [];
  let lastGoal: GoalId | null = null;
  const out: Identity[] = [];

  for (let ch = 0; ch < ROUTE_CHAPTERS; ch++) {
    const place = ROUTE[ch];
    const nowKnown = PARTNERS.filter((m) => known(m, ch));
    for (const m of nowKnown) if (!pool.includes(m)) {
      pool.push(m);
      partners.add(m);
    }
    const focus: Focus = year > 0 && place.focus === 'basics' ? 'mix' : place.focus;
    const focusMech: Mechanic | null = focus === 'basics' || focus === 'mix' ? null : focus;
    const introChapter = year === 0 && !!focusMech && ch === MECHANIC_INTRO[focusMech];
    const mid = year > 0 || ch >= 12;
    const late = year > 0 || ch >= 20;
    const goalSlots = goalSlotsFor(rng, year, ch, introChapter);

    for (let slot = 0; slot < ROUTE_LEVELS_PER_CHAPTER; slot++) {
      const n = (year * ROUTE_CHAPTERS + ch) * ROUTE_LEVELS_PER_CHAPTER + slot + 1;
      const role = ROLES[slot];
      const festival = role === 'festival';
      if (year === 0 && n <= TUTORIAL.length) {
        const [rows, cols, months] = TUTORIAL[n - 1];
        out.push({ n, chapter: ch, year, slot, role: 'tutorial', rows, cols, mechanics: [], wind: null, festival, fixed: true, tutorialMonths: months });
        continue;
      }
      if (year === 0 && ch === 0) {
        // Gyeongju: just the cards, growing to a full deck. Level 6 brings in the four looks of each flower.
        const [rows, cols] = CHAPTER_SHAPES[slot];
        out.push({ n, chapter: ch, year, slot, role: n === 6 ? 'tutorial' : role, rows, cols, mechanics: [], wind: null, festival, fixed: n === 6 });
        continue;
      }

      const used: Mechanic[] = [];
      const draw = (set: Mechanic[]): Mechanic | null => {
        const m = partners.draw((x) => !set.includes(x) && !set.some((y) => clashes(x, y)), lastPartners);
        if (m) used.push(m);
        return m;
      };
      const add = (set: Mechanic[], m: Mechanic | null) => {
        if (m && !set.includes(m) && !set.some((y) => clashes(m, y))) set.push(m);
      };
      /** The chapter's idea as a set: a mix chapter draws two partners; a lucky chapter pairs lucky with one. */
      const focusSet = (): Mechanic[] => {
        const s: Mechanic[] = [];
        if (focus === 'mix') {
          add(s, draw(s));
          add(s, draw(s));
        } else if (focusMech === 'lucky') {
          s.push('lucky');
          add(s, draw(s));
        } else if (focusMech) s.push(focusMech);
        return s;
      };

      let set: Mechanic[] = [];
      const introBoard = introChapter && slot === 1;
      if (introBoard) set = [focusMech!];
      else if (role === 'open') {
        if (!introChapter) set = focus === 'mix' ? [draw([])].filter((m): m is Mechanic => !!m) : focusMech ? [focusMech] : [];
      } else if (role === 'focus') {
        set = focusSet();
        if (mid && !introChapter && focus !== 'mix' && (slot === 7 || slot === 9)) add(set, draw(set));
      } else if (role === 'mix') {
        add(set, draw(focusMech ? [focusMech] : []));
        if (late && focusMech && focusMech !== 'lucky') add(set, focusMech);
      } else if (role === 'peak') {
        set = focusSet();
        add(set, draw(set));
        if (late && set.length < 3) add(set, draw(set));
      } else if (role === 'festival') {
        set = focus === 'mix' ? [draw([])].filter((m): m is Mechanic => !!m) : focusMech && focusMech !== 'lucky' ? [focusMech] : [];
        if (late) add(set, draw(set));
      }
      // Lucky cards: on festival boards and every other rest board once known.
      if (known('lucky', ch) && !introBoard && !set.includes('lucky') && (festival || (role === 'rest' && (ch + year) % 2 === 1))) set.push('lucky');
      // Stones: the idea itself in stone chapters, a quiet background on busy slots elsewhere.
      if (known('stones', ch) && !introBoard && role !== 'open' && role !== 'rest' && !set.includes('stones')) set.push('stones');
      if (used.length) lastPartners = used;

      const wind: Wind | null = set.includes('leaves') ? 'down' : set.includes('wind') ? WIND_CYCLE[(ch + slot + year) % 3] : null;
      const shift = year > 0 || ch >= 12 ? 2 : ch >= 4 ? 1 : 0;
      let size = Math.min(6, SLOT_SIZE[slot] + shift);
      if ((role === 'peak' || festival) && (year > 0 || ch >= 19)) size = 7;
      const [rows, cols] = SIZES[size][(ch + slot) % 2];

      let goal: GoalId | undefined;
      if (goalSlots.includes(slot) && !introBoard) {
        goal = goals.draw(() => true, lastGoal ? [lastGoal] : []) ?? undefined;
        if (goal) lastGoal = goal;
      }
      out.push({
        n, chapter: ch, year, slot, role, rows, cols,
        mechanics: MECH_ORDER.filter((m) => set.includes(m)),
        wind, goal, festival, fixed: false,
        ...(introBoard ? { introduces: focusMech! } : {}),
      });
    }
  }
  cache.set(year, out);
  return out;
}

/**
 * Goal boards: from the sixth place on (chapter index 5), three slots in each
 * chapter (about one level in four), never the open board or the board that
 * introduces a mechanic; a festival carries one now and then.
 */
function goalSlotsFor(rng: Rng, year: number, ch: number, introChapter: boolean): number[] {
  if (year === 0 && ch < 5) return [];
  const eligible = [2, 3, 4, 5, 6, 7, 8, 9, 10].filter((s) => !(introChapter && s <= 2));
  const picked = rng.shuffle(eligible.slice()).slice(0, 3);
  if (rng.int(3) === 0) picked[2] = 11; // about one festival in three
  return picked.sort((a, b) => a - b);
}

function identityOf(n: number): Identity {
  n = Math.max(1, Math.floor(n));
  const per = ROUTE_CHAPTERS * ROUTE_LEVELS_PER_CHAPTER;
  const year = Math.floor((n - 1) / per);
  return road(year)[(n - 1) % per];
}

// ---------------------------------------------------------------------------
// Knobs: how each tier fills the identity in.

/** How far up its legal ranges a tier pushes the knobs, 0–1: the road's progress plus a step per tier. */
export const intensity = (base: number, tier: number) => clamp(-0.05 + 1.1 * base + 0.16 * (tier - 2), 0, 1);

/**
 * How tricky the card arrangement is for tier t of a level, 0–1 (0 = the classic
 * placement): partners placed far apart (long, two-bend reads), look-alike cards
 * of one flower side by side (decoys and tempting wrong matches), and from 0.6
 * the rim filled first so the opening moves sit inside the board. It follows the
 * knobs' intensity, so it rises along the road and with the tier. Teaching boards
 * keep the classic placement.
 */
export function arrangeOf(p: Pick<LevelPlan, 'base' | 'fixed' | 'role'>, tier: number): number {
  if (p.fixed || p.role === 'tutorial') return 0;
  return Math.round(clamp((intensity(p.base, tier) - 0.25) / 0.6, 0, 1) * 20) / 20;
}

/** Gentle tiers use fewer flowers (more partners for every card); the top tiers use all twelve. */
const MONTH_DROP = [4, 2, 1, 0, 0];
export const LAYOUTS: StoneLayout[] = ['clusters', 'spread', 'lines'];

export interface KnobRange {
  stones: [number, number];
  months: [number, number];
  snow: [number, number];
  knots: [number, number];
  gates: [number, number];
  fences: [number, number];
  torii: [number, number];
  streams: [number, number];
  seals: [number, number];
  ink: [number, number];
  layouts: StoneLayout[];
}

const has = (p: Pick<LevelPlan, 'mechanics'>, m: Mechanic) => p.mechanics.includes(m);
/** Snow and knots both sit on walled-in cards: with knots on the board, snow leaves them room. */
const snowShare = (p: Pick<LevelPlan, 'mechanics'>) => (has(p, 'knots') ? 0.25 : 0.5);

/** Legal ranges of every knob for this identity. A mechanic in the identity keeps a minimum of 2 (fences 3). */
export function knobRange(p: LevelPlan): KnobRange {
  const cells = p.rows * p.cols;
  const maxS = maxStones(p.rows, p.cols);
  // Snow and knots sit on cards walled in by other cards: keep the inside mostly cards.
  const covered = has(p, 'snow') || has(p, 'knots');
  const stones: [number, number] = has(p, 'stones') ? [Math.min(2, maxS), covered ? Math.min(has(p, 'gates') ? 2 : 4, maxS) : maxS] : [0, 0];
  const gates: [number, number] = has(p, 'gates') ? [2, cells >= 40 && !covered ? 6 : 4] : [0, 0];
  // One twin pair, two on roomy boards; streams of 2–3 cells, two runs on roomy boards.
  const torii: [number, number] = has(p, 'torii') ? [1, cells >= 36 ? 2 : 1] : [0, 0];
  const streams: [number, number] = has(p, 'streams') ? [2, cells >= 40 && !covered ? 6 : 4] : [0, 0];
  // Two to four sealed pairs; two blots of ink, four on roomy boards.
  const seals: [number, number] = has(p, 'seals') ? [2, cells >= 36 ? 4 : 3] : [0, 0];
  const ink: [number, number] = has(p, 'ink') ? [2, cells >= 40 ? 4 : 2] : [0, 0];
  const lo = { stones: stones[0], gates: gates[0], torii: torii[0], streams: streams[0], ink: ink[0] };
  const hi = { stones: stones[1], gates: gates[1], torii: torii[1], streams: streams[1], ink: ink[1] };
  const pairsHi = (cells - fixedCells(lo)) / 2;
  const flower = (pairs: number) => (p.lucky ? pairs - 1 : pairs);
  const monthsHi = Math.min(12, flower((cells - fixedCells(hi)) / 2));
  const monthsLo = p.fixed ? monthsHi : Math.max(Math.ceil(monthsHi * 0.6), monthsHi - MONTH_DROP[0]);
  return {
    stones,
    months: [monthsLo, monthsHi],
    snow: has(p, 'snow') ? [2, Math.max(2, Math.round(pairsHi * snowShare(p)))] : [0, 0],
    knots: has(p, 'knots') ? [2, Math.max(2, Math.round(pairsHi * 0.32))] : [0, 0],
    gates,
    fences: has(p, 'fences') ? [3, cells >= 48 ? 14 : 11] : [0, 0],
    torii,
    streams,
    seals,
    ink,
    layouts: has(p, 'stones') ? LAYOUTS : ['spread'],
  };
}

/**
 * The knobs for tier t (0 gentle … 4 hardest): monotone in t, inside the legal
 * ranges. The stone layout is left to the search (it changes the look more than
 * the difficulty), so here it is always 'spread'.
 */
export function tierKnobs(p: LevelPlan, tier: number): Knobs {
  const t = clamp(Math.round(tier), 0, 4);
  const r = knobRange(p);
  if (p.fixed) return { stones: 0, layout: 'spread', months: r.months[1], snow: 0, knots: 0, gates: 0, fences: 0, torii: 0, streams: 0, seals: 0, ink: 0 };
  const x = intensity(p.base, t);
  const lerp = ([lo, hi]: [number, number], f = x) => lo + (hi - lo) * f;
  // Background stones climb more slowly than stones that are the place's idea (or a peak's).
  const feature = p.place.focus === 'stones' || p.role === 'peak';
  const stones = has(p, 'stones') ? clamp(evenRound(lerp(r.stones, feature ? x : 0.75 * x)), r.stones[0], r.stones[1] - (r.stones[1] % 2)) : 0;
  const gates = has(p, 'gates') ? clamp(evenRound(lerp(r.gates)), 2, r.gates[1]) : 0;
  const torii = has(p, 'torii') ? clamp(Math.round(lerp(r.torii)), r.torii[0], r.torii[1]) : 0;
  const streams = has(p, 'streams') ? clamp(evenRound(lerp(r.streams)), r.streams[0], r.streams[1]) : 0;
  const seals = has(p, 'seals') ? clamp(Math.round(lerp(r.seals)), r.seals[0], r.seals[1]) : 0;
  // Blots take cells from the cards, and the cover counts below scale with the
  // pairs: a fixed count keeps those rising with the tier (the search may add more).
  const ink = has(p, 'ink') ? r.ink[0] : 0;
  const pairs = (p.rows * p.cols - fixedCells({ stones, gates, torii, streams, ink })) / 2;
  const monthsHi = Math.min(12, p.lucky ? pairs - 1 : pairs);
  const months = clamp(monthsHi - MONTH_DROP[t], Math.min(r.months[0], monthsHi), monthsHi);
  return {
    stones,
    layout: 'spread',
    months,
    snow: has(p, 'snow') ? Math.round(lerp([2, Math.max(2, Math.round(pairs * snowShare(p)))])) : 0,
    knots: has(p, 'knots') ? Math.round(lerp([2, Math.max(2, Math.round(pairs * 0.32))])) : 0,
    gates,
    fences: has(p, 'fences') ? Math.round(lerp(r.fences)) : 0,
    torii,
    streams,
    seals,
    ink,
  };
}

/** Clamp knobs into the identity's legal ranges (used by the hill-climb). */
export function clampKnobs(p: LevelPlan, k: Knobs): Knobs {
  const r = knobRange(p);
  const even = (x: number) => x - (x % 2);
  const stones = clamp(even(k.stones), r.stones[0], even(r.stones[1]));
  const gates = clamp(even(k.gates), r.gates[0], r.gates[1]);
  const torii = clamp(k.torii, r.torii[0], r.torii[1]);
  const streams = clamp(even(k.streams), r.streams[0], r.streams[1]);
  const ink = clamp(even(k.ink), r.ink[0], r.ink[1]);
  const pairs = (p.rows * p.cols - fixedCells({ stones, gates, torii, streams, ink })) / 2;
  const monthsHi = Math.min(12, p.lucky ? pairs - 1 : pairs);
  return {
    stones,
    layout: r.layouts.includes(k.layout) ? k.layout : 'spread',
    months: clamp(k.months, Math.min(r.months[0], monthsHi), monthsHi),
    snow: has(p, 'snow') ? clamp(k.snow, 2, Math.max(2, Math.round(pairs * snowShare(p)))) : 0,
    knots: has(p, 'knots') ? clamp(k.knots, 2, Math.max(2, Math.round(pairs * 0.32))) : 0,
    gates,
    fences: clamp(k.fences, r.fences[0], r.fences[1]),
    torii,
    streams,
    seals: clamp(k.seals, r.seals[0], r.seals[1]),
    ink,
  };
}

/** The board spec for an identity with these knobs. */
export function planSpec(p: LevelPlan, k: Knobs, seed: string, tier?: number): LevelSpec {
  const arrange = arrangeOf(p, tier ?? 2);
  return {
    mode: 'journey',
    number: p.n,
    seed,
    rows: p.rows,
    cols: p.cols,
    stones: k.stones,
    months: k.months,
    variants: p.role !== 'tutorial' || p.n === 6,
    par: p.par,
    gravity: p.wind ?? false,
    snow: k.snow,
    knots: k.knots,
    lucky: p.lucky,
    festival: p.festival,
    ...(k.gates ? { gates: k.gates } : {}),
    ...(k.fences ? { fences: k.fences } : {}),
    ...(k.torii ? { torii: k.torii } : {}),
    ...(k.streams ? { streams: k.streams } : {}),
    ...(k.seals ? { seals: k.seals } : {}),
    ...(k.ink ? { ink: k.ink } : {}),
    ...(k.stones && k.layout !== 'spread' ? { layout: k.layout } : {}),
    ...(p.goal ? { goal: p.goal } : {}),
    ...(tier != null ? { tier } : {}),
    ...(arrange ? { arrange } : {}),
  };
}

/** Par from the identity: the middle tier's pair count, the moving/covered extras, festival room. */
export function parOf(id: Pick<Identity, 'mechanics' | 'wind' | 'festival' | 'year'>, pairs: number): number {
  const m = id.mechanics;
  // Moving and covered cards cost time; so does reading a jump, a stream, the seals' order or wet ink.
  const reads = (['torii', 'streams', 'seals', 'ink'] as Mechanic[]).filter((x) => m.includes(x)).length * 5;
  const extra = Math.min(20, (id.wind ? 10 : 0) + (m.includes('snow') ? 10 : 0) + (m.includes('knots') ? 10 : 0) + reads) + (id.festival ? 15 : 0);
  return Math.max(parFor(pairs), parFor(pairs) + extra - 5 * Math.min(id.year, 2));
}

const planCache = new Map<number, LevelPlan>();

export function levelPlan(n: number): LevelPlan {
  n = Math.max(1, Math.floor(n));
  const hit = planCache.get(n);
  if (hit) return hit;
  const id = identityOf(n);
  const plan: LevelPlan = {
    n,
    base: designedBase(n),
    spec: undefined as unknown as LevelSpec,
    place: ROUTE[id.chapter],
    chapter: id.chapter,
    year: id.year,
    slot: id.slot,
    role: id.role,
    rows: id.rows,
    cols: id.cols,
    mechanics: id.mechanics,
    wind: id.wind,
    ...(id.goal ? { goal: id.goal } : {}),
    festival: id.festival,
    lucky: id.mechanics.includes('lucky'),
    par: 0,
    ...(id.introduces ? { introduces: id.introduces } : {}),
    fixed: id.fixed,
  };
  if (id.tutorialMonths != null) {
    // Levels 1–5: the teaching boards, exactly as before.
    const pairs = (id.rows * id.cols) / 2;
    plan.par = parFor(pairs);
    plan.spec = { mode: 'journey', number: n, seed: `journey-${n}`, rows: id.rows, cols: id.cols, stones: 0, months: id.tutorialMonths, variants: false, par: plan.par, gravity: false, snow: 0 };
  } else {
    const k2 = tierKnobs(plan, 2);
    plan.par = parOf(id, (id.rows * id.cols - fixedCells(k2)) / 2);
    plan.spec = planSpec(plan, k2, `journey-${n}`);
  }
  planCache.set(n, plan);
  return plan;
}

/** Tier knobs as a spec with the plan's own seed (the bank's fallback). */
export function fallbackSpec(n: number, tier: number): LevelSpec {
  const p = levelPlan(n);
  if (p.fixed) return { ...p.spec, tier };
  return planSpec(p, tierKnobs(p, tier), p.spec.seed, tier);
}
