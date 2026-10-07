/**
 * Garden state on top of the save: which pieces show, the daily visitor and its gift.
 * Ownership lives in `save.market.owned` (`garden:<id>`); pieces the player put away
 * are in `save.market.gardenHidden`; visitor bookkeeping is in `save.garden`.
 */
import { GARDEN_ITEMS, GARDEN_VISITORS, type GardenVisitor, placedItems, seasonOf } from '../art/garden';
import { localDateKey } from '../engine/levels';
import { persist, save } from './storage';

const key = (id: string) => `garden:${id}`;

export const isOwned = (id: string): boolean => save.market.owned.includes(key(id));
export const isHidden = (id: string): boolean => save.market.gardenHidden.includes(id);

/** Garden pieces the player owns, in catalog order. */
export function ownedPieces(): string[] {
  return GARDEN_ITEMS.filter((i) => isOwned(i.id)).map((i) => i.id);
}

/** Owned and not put away (what the scene is asked to draw). */
export function shownPieces(): string[] {
  return ownedPieces().filter((id) => !isHidden(id));
}

/** Put a piece away (hidden = true) or back in its spot. */
export function setHidden(id: string, hidden: boolean): void {
  const list = save.market.gardenHidden.filter((x) => x !== id);
  if (hidden) list.push(id);
  save.market.gardenHidden = list;
  persist();
}

/** Owned pieces the garden hasn't welcomed yet; marks them as seen. */
export function takeNewPieces(): string[] {
  const fresh = shownPieces().filter((id) => !save.garden.seen.includes(id));
  if (fresh.length) {
    save.garden.seen = [...save.garden.seen, ...fresh];
    persist();
  }
  return fresh;
}

/* ───────────── the daily visitor ───────────── */

/** Small string hash (FNV-1a) for date seeds. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Short original verses, a few per season (spring, summer, autumn, winter). Lines split on " / ". */
export const GARDEN_NOTES: string[][] = [
  [
    'Plum scent at the gate / someone came by early / and left the latch up',
    'Thin rain on the tiles / the first frog tries one note / then thinks better of it',
    'Petals on the step / the wind has been sweeping / the wrong way again',
    'New leaves, still folded / like letters no one / has dared to open',
    'A warm afternoon / even the stone lantern / seems to be dozing',
    'Mud on my feet / blossom in my hair / I took the long way round',
  ],
  [
    'Cicadas at noon / the pond holds the whole sky / and does not spill it',
    'Lotus opening / a slow yes / to the morning',
    'Under the trellis / the tea has gone cold / nobody minds',
    'Evening shower / the swing keeps going / with no one on it',
    'One firefly, then two / the dark is learning / how to count',
    'Hot stones, cool water / between them the koi / choose the shade',
  ],
  [
    'Persimmons ripen / one small lamp at a time / along the branch',
    'A red leaf on the water / the koi come up / to read it',
    'Geese overhead / the wall stays where it is / a little lonelier',
    'Clear moon, cold tea / I meant to say something / the chime said it',
    'Swept the yard at dawn / by noon the maple / had other plans',
    'Harvest wind / rattles the jar lids / soy, kimchi and a song',
  ],
  [
    'Snow on the lantern / a small white hat / it never asked for',
    'Three persimmons left / on the bare branch / kept for the birds',
    'Footprints to the pond / and back again / the ice said no',
    'Cold morning / the bell’s one note hangs / longer than usual',
    'Plum buds under snow / red ink waiting / in a closed brush',
    'Long night / the fish sleep / under a roof of glass',
  ],
];

/** One line about each visitor, shown above its verse. */
export const VISITOR_LINES: Record<string, string> = {
  magpie: 'A magpie on the wall. In Korea, that means good news is on its way.',
  heron: 'A grey heron stood so still in the shallows that the koi forgot it was there.',
  mate: 'Cranes pair for life. Yours has company today.',
  squirrel: 'A squirrel took one persimmon and politely left the rest.',
  tanuki: 'A tanuki by the lantern: a trickster in the old stories, and a kind one.',
  sparrow: 'A sparrow rang the chime by accident and flew off very pleased.',
  butterfly: 'A white butterfly over the irises, the season’s first letter.',
  whiteeye: 'A white-eye came for the plum blossom and stayed for a song.',
};

export interface VisitToday {
  visitor: GardenVisitor;
  /** petals the gift is worth (5–15) */
  petals: number;
  /** the verse, already split into lines */
  note: string[];
  /** true once today's gift has been claimed */
  claimed: boolean;
}

/**
 * Today's visitor, chosen by a date seed from what the garden can host.
 * Null when nothing in the garden supports a visitor.
 */
export function todaysVisit(d = new Date()): VisitToday | null {
  const day = localDateKey(d);
  const placed = new Set(placedItems(shownPieces()));
  const season = seasonOf(d);
  const can = GARDEN_VISITORS.filter((v) => placed.has(v.needs) && (!v.seasons || v.seasons.includes(season)));
  if (!can.length) return null;
  const h = hash(`jjak-garden-${day}`);
  const visitor = can[h % can.length];
  const verses = GARDEN_NOTES[season];
  return {
    visitor,
    petals: 5 + ((h >>> 8) % 11),
    note: verses[(h >>> 12) % verses.length].split(' / '),
    claimed: save.garden.giftDay === day,
  };
}

/** Claim today's gift once. Returns the petals added (0 if already claimed or no visitor). */
export function claimVisit(d = new Date()): number {
  const v = todaysVisit(d);
  if (!v || v.claimed) return 0;
  save.petals += v.petals;
  save.garden.giftDay = localDateKey(d);
  save.garden.gifts += 1;
  if (!save.garden.met.includes(v.visitor.id)) save.garden.met = [...save.garden.met, v.visitor.id];
  persist();
  return v.petals;
}
