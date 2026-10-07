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

export const MECHANICS: Record<Mechanic, MechanicDef> = {
  stones: {
    id: 'stones', name: 'Stones', native: '돌 · 石', glyph: '石', rule: 'Stones block paths. Route around them.',
    introChapter: MECHANIC_INTRO.stones, clashes: [], on: (s) => s.stones > 0, weight: 0.08,
  },
  leaves: {
    id: 'leaves', name: 'Falling leaves', native: '낙엽 · 落葉', glyph: '落', rule: 'After each pair, cards drop to fill the gaps.',
    introChapter: MECHANIC_INTRO.leaves, slides: true, clashes: ['wind', 'snow', 'fences'], on: (s) => windOf(s) === 'down', weight: 0.1,
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
    introChapter: MECHANIC_INTRO.wind, slides: true, clashes: ['leaves', 'snow', 'fences'], on: (s) => { const w = windOf(s); return !!w && w !== 'down'; }, weight: 0.14,
  },
  gates: {
    id: 'gates', name: 'Gates', native: '문 · 門', glyph: '門', rule: 'A gate opens when you pair its flower.',
    introChapter: MECHANIC_INTRO.gates, clashes: [], on: (s) => (s.gates ?? 0) > 0, weight: 0.1,
  },
  fences: {
    id: 'fences', name: 'Fences', native: '울타리 · 垣', glyph: '垣', rule: 'Paths can’t cross a bamboo fence.',
    introChapter: MECHANIC_INTRO.fences, clashes: SLIDERS, on: (s) => (s.fences ?? 0) > 0, weight: 0.12,
  },
};

export const MECHANIC_IDS = Object.keys(MECHANICS) as Mechanic[];

/** The mechanics on a spec, in library order. */
export const mechanicsOf = (spec: LevelSpec): Mechanic[] => MECHANIC_IDS.filter((m) => MECHANICS[m].on(spec));

export const clash = (a: Mechanic, b: Mechanic) => a !== b && (MECHANICS[a].clashes.includes(b) || MECHANICS[b].clashes.includes(a));
