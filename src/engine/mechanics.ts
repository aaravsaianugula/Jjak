/**
 * The mechanic library: every twist the Flower Road can put on a board, as data.
 * The Level Director reads this to decide what may appear where; the UI reads
 * it for names, glyphs and the animated intro (src/ui/demos.ts, keyed by id).
 *
 * Adding a mechanic = one entry here + its engine hook (rules.ts / levels.ts) +
 * a demo script. The Director, bots, validators and map pick it up from here.
 */
import { type LevelSpec, type Mechanic, MECHANIC_INTRO, windOf } from './levels';

export interface MechanicDef {
  id: Mechanic;
  name: string;
  /** Korean · Japanese */
  native: string;
  /** one kanji for the map's level grid */
  glyph: string;
  /** one short line: the rule */
  rule: string;
  /** 0-based route chapter where it first appears (see MECHANIC_INTRO) */
  introChapter: number;
  /** cards move after each pair */
  slides?: boolean;
  /** never on the same board as these */
  clashes: Mechanic[];
  /** is it on this spec? */
  on(spec: LevelSpec): boolean;
  /**
   * Difficulty this mechanic adds at full strength, roughly in "share of the
   * scale" (the Director's measured metrics capture the rest).
   */
  weight: number;
}

const SLIDERS: Mechanic[] = ['leaves', 'wind'];
/**
 * Torii and streams are terrain: fixed cells cards can't slide over or into, so
 * they never share a board with sliding. Snow, knots, gates and fences mix
 * freely with them (all four only ever open space or close fixed edges, and the
 * generator and solver respect every one).
 */
const TERRAIN_CLASHES: Mechanic[] = SLIDERS;
/**
 * Seals are a rule about order, proven by the construction order, which sliding
 * scrambles; and a card already covered by snow or tied by a knot carries one
 * lock already, so seals keep to their own cards. Gates, fences and terrain mix.
 */
const SEAL_CLASHES: Mechanic[] = [...SLIDERS, 'snow', 'knots'];
/**
 * Wet ink sits on a cell like terrain until it dries (cards can't slide into
 * it), so it never meets sliding. It mixes with everything else: drying only
 * ever opens space.
 */
const INK_CLASHES: Mechanic[] = SLIDERS;

export const MECHANICS: Record<Mechanic, MechanicDef> = {
  stones: {
    id: 'stones', name: 'Stones', native: '돌 · 石', glyph: '石', rule: 'Stones block paths. Route around them.',
    introChapter: MECHANIC_INTRO.stones, clashes: [], on: (s) => s.stones > 0, weight: 0.08,
  },
  leaves: {
    id: 'leaves', name: 'Falling leaves', native: '낙엽 · 落葉', glyph: '落', rule: 'After each pair, cards drop to fill the gaps.',
    introChapter: MECHANIC_INTRO.leaves, slides: true, clashes: ['wind', 'snow', 'fences', 'torii', 'streams'], on: (s) => windOf(s) === 'down', weight: 0.1,
  },
  snow: {
    id: 'snow', name: 'First snow', native: '첫눈 · 初雪', glyph: '雪', rule: 'Snowy cards turn over when a neighbour clears.',
    introChapter: MECHANIC_INTRO.snow, clashes: SLIDERS, on: (s) => s.snow > 0, weight: 0.12,
  },
  lucky: {
    id: 'lucky', name: 'Lucky cards', native: '보너스패 · おまけ札', glyph: '福', rule: 'A bonus pair hides here. Pair it for petals.',
    introChapter: MECHANIC_INTRO.lucky, clashes: [], on: (s) => !!s.lucky, weight: 0,
  },
  knots: {
    id: 'knots', name: 'Knots', native: '매듭 · 結び', glyph: '結', rule: 'A tied card frees itself when a neighbour clears.',
    introChapter: MECHANIC_INTRO.knots, clashes: [], on: (s) => (s.knots ?? 0) > 0, weight: 0.1,
  },
  wind: {
    id: 'wind', name: 'Wind', native: '바람 · 風', glyph: '風', rule: 'After each pair, cards drift with the wind.',
    introChapter: MECHANIC_INTRO.wind, slides: true, clashes: ['leaves', 'snow', 'fences', 'torii', 'streams'], on: (s) => { const w = windOf(s); return !!w && w !== 'down'; }, weight: 0.14,
  },
  gates: {
    id: 'gates', name: 'Gates', native: '문 · 門', glyph: '門', rule: 'A gate opens when you pair its flower.',
    introChapter: MECHANIC_INTRO.gates, clashes: [], on: (s) => (s.gates ?? 0) > 0, weight: 0.1,
  },
  fences: {
    id: 'fences', name: 'Fences', native: '울타리 · 垣', glyph: '垣', rule: 'Paths can’t cross a bamboo fence.',
    introChapter: MECHANIC_INTRO.fences, clashes: SLIDERS, on: (s) => (s.fences ?? 0) > 0, weight: 0.12,
  },
  torii: {
    id: 'torii', name: 'Torii', native: '토리이 · 鳥居', glyph: '鳥', rule: 'Into one torii, out of its twin, same way on.',
    introChapter: MECHANIC_INTRO.torii, clashes: TERRAIN_CLASHES, on: (s) => (s.torii ?? 0) > 0, weight: 0.12,
  },
  streams: {
    id: 'streams', name: 'Streams', native: '개울 · 小川', glyph: '川', rule: 'Paths cross water straight. No turning on it.',
    introChapter: MECHANIC_INTRO.streams, clashes: TERRAIN_CLASHES, on: (s) => (s.streams ?? 0) > 0, weight: 0.1,
  },
  seals: {
    id: 'seals', name: 'Seals', native: '도장 · 印', glyph: '印', rule: 'Sealed pairs go in order: 1, then 2, then 3.',
    introChapter: MECHANIC_INTRO.seals, clashes: SEAL_CLASHES, on: (s) => (s.seals ?? 0) > 0, weight: 0.1,
  },
  ink: {
    id: 'ink', name: 'Wet ink', native: '먹 · 墨', glyph: '墨', rule: 'Wet ink blocks paths. It dries as you pair.',
    introChapter: MECHANIC_INTRO.ink, clashes: INK_CLASHES, on: (s) => (s.ink ?? 0) > 0, weight: 0.08,
  },
};

export const MECHANIC_IDS = Object.keys(MECHANICS) as Mechanic[];

/** The mechanics on a spec, in library order. */
export const mechanicsOf = (spec: LevelSpec): Mechanic[] => MECHANIC_IDS.filter((m) => MECHANICS[m].on(spec));

export const clash = (a: Mechanic, b: Mechanic) => a !== b && (MECHANICS[a].clashes.includes(b) || MECHANICS[b].clashes.includes(a));
