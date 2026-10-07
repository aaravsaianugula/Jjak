/**
 * The Market (장터 · 市) catalog: every item the reward shop shows, with its price
 * in petals. Pure data: no DOM, no save access.
 *
 * Keys are `${category}:${id}` and are stable save keys (save.market.owned).
 * Prices are tuned to the economy in docs/EXPANSION_PLAN.md: roughly 300 petals per
 * hour of play, about 12,000 petals for all cosmetics + garden, and a handful of
 * items at 60–150 so a new player can buy something in the first session.
 */
import { CARD_BACKS, DECK_STYLES } from '../art/styles';
import { GARDEN_ITEMS } from '../art/garden';
import { MONTHS } from './deck';

export type MarketCategory = 'tool' | 'deck' | 'back' | 'brush' | 'fx' | 'paper' | 'garden' | 'music';

/** How an item is obtained when it can't simply be bought. */
export type ItemSource =
  /** granted by the Flower Path at this rank (never sold for petals) */
  | { kind: 'path'; rank: number }
  /** included in the Supporter pack (IAP) */
  | { kind: 'supporter' }
  /** board paper: unlocked by collecting all four cards of this month in the Album */
  | { kind: 'album'; month: number };

export interface MarketItem {
  key: string;
  category: MarketCategory;
  id: string;
  name: string;
  ko: string;
  ja: string;
  blurb: string;
  /** petals; 0 for defaults and items that can't be bought */
  price: number;
  /** set when the item is not sold for petals */
  source?: ItemSource;
  /** the default look for its slot: always owned, never sold */
  isDefault?: boolean;
  /** key of an item that must be owned first (e.g. koi need the pond) */
  needs?: string;
  /** tools: used up, can be bought again */
  consumable?: boolean;
}

export interface MarketTab {
  id: string;
  category: MarketCategory;
  name: string;
  ko: string;
  ja: string;
  /** one line under the tab title */
  lede: string;
}

/** Tab order on the category rail. */
export const MARKET_TABS: MarketTab[] = [
  { id: 'tools', category: 'tool', name: 'Tools', ko: '도구', ja: '道具', lede: 'Help for tricky boards, and a little care for your streak.' },
  { id: 'decks', category: 'deck', name: 'Decks', ko: '화투', ja: '札', lede: 'Repaint all 48 cards.' },
  { id: 'backs', category: 'back', name: 'Card backs', ko: '뒷면', ja: '裏', lede: 'The face your cards show while they wait.' },
  { id: 'brushes', category: 'brush', name: 'Brushes', ko: '붓', ja: '筆', lede: 'The line drawn between a matched pair.' },
  { id: 'effects', category: 'fx', name: 'Effects', ko: '꽃잎', ja: '散華', lede: 'What scatters when a pair clears.' },
  { id: 'papers', category: 'paper', name: 'Papers', ko: '한지', ja: '和紙', lede: 'The paper your board is laid on.' },
  { id: 'garden', category: 'garden', name: 'Garden', ko: '정원', ja: '庭', lede: 'Things to place in your courtyard garden.' },
  { id: 'music', category: 'music', name: 'Music', ko: '음악', ja: '音楽', lede: 'Instruments for the generative music.' },
];

export const tabOf = (category: MarketCategory): MarketTab => MARKET_TABS.find((t) => t.category === category)!;

/** Flower Path exclusives (see EXPANSION_PLAN §3). */
export const PATH_EXCLUSIVES: Record<string, number> = {
  'back:moon': 25,
  'brush:gold': 40,
  'garden:crane': 55,
  'deck:gilded': 70,
  'fx:gold': 85,
  'music:moonlight': 100,
};
/** Supporter pack (IAP) exclusives. */
export const SUPPORTER_EXCLUSIVES = ['back:clouds'];

/** Tool keys (consumables). */
export const TOOL = {
  hints: 'tool:hints',
  shuffles: 'tool:shuffles',
  tea: 'tool:tea',
  card: 'tool:card',
} as const;

/** Warm tea: at most this many streak freezes held at once. */
export const MAX_STREAK_FREEZES = 2;

const PRICES: Record<string, number> = {
  // Tools (consumable)
  'tool:hints': 50,
  'tool:shuffles': 40,
  'tool:tea': 120,
  'tool:card': 200,
  // Decks
  'deck:sumi': 450,
  'deck:celadon': 500,
  'deck:moonlit': 520,
  'deck:woodblock': 580,
  // Card backs
  'back:seigaiha': 200,
  'back:asanoha': 250,
  'back:dancheong': 300,
  // Brushes
  'brush:vermilion': 80,
  'brush:indigo': 120,
  'brush:petals': 260,
  'brush:firefly': 300,
  // Effects
  'fx:ink': 100,
  'fx:maple': 180,
  'fx:snow': 200,
  'fx:fireflies': 280,
  'fx:cranes': 300,
  // Papers
  'paper:hanji': 60,
  'paper:snow': 90,
  'paper:celadon': 140,
  'paper:indigo': 160,
  'paper:goldfleck': 220,
  'paper:suminagashi': 260,
  // Garden: the coveted pieces (cat, koi, pond, pavilion) cost the most.
  'garden:stones': 60,
  'garden:chime': 90,
  'garden:onggi': 100,
  'garden:irises': 120,
  'garden:wall': 140,
  'garden:lantern': 150,
  'garden:teatable': 160,
  'garden:bonsai': 180,
  'garden:lanterns': 180,
  'garden:bamboo': 200,
  'garden:swing': 200,
  'garden:persimmon': 220,
  'garden:fireflies': 240,
  'garden:plum': 250,
  'garden:maple': 250,
  'garden:fountain': 260,
  'garden:bridge': 300,
  'garden:wisteria': 300,
  'garden:deer': 360,
  'garden:pond': 380,
  'garden:koi': 450,
  'garden:pavilion': 480,
  'garden:cat': 550,
  // Music
  'music:gayageum': 300,
  'music:flute': 350,
  'music:koto': 400,
};

const sourceFor = (key: string): ItemSource | undefined =>
  PATH_EXCLUSIVES[key] ? { kind: 'path', rank: PATH_EXCLUSIVES[key] } : SUPPORTER_EXCLUSIVES.includes(key) ? { kind: 'supporter' } : undefined;

type Raw = Omit<MarketItem, 'key' | 'category' | 'price' | 'source'> & { price?: number };
const make = (category: MarketCategory, raw: Raw): MarketItem => {
  const key = `${category}:${raw.id}`;
  const source = sourceFor(key);
  return { ...raw, key, category, price: raw.isDefault || source ? 0 : (raw.price ?? PRICES[key] ?? 0), ...(source ? { source } : {}) };
};

const TOOLS: Raw[] = [
  { id: 'hints', name: 'Three hints', ko: '힌트 셋', ja: 'ヒント三つ', blurb: 'Shows a pair you can make. Three of them, for the boards that stare back.', consumable: true },
  { id: 'shuffles', name: 'Three shuffles', ko: '섞기 셋', ja: '混ぜる三回', blurb: 'Deals the cards on the board into new places. Three of them.', consumable: true },
  { id: 'tea', name: 'Warm tea', ko: '따뜻한 차', ja: '温かいお茶', blurb: 'Keeps your Daily streak warm through one missed day. You can hold two cups.', consumable: true },
  { id: 'card', name: 'Album card', ko: '화투 한 장', ja: '札一枚', blurb: 'Draws one card you don’t have yet and adds it to your Album.', consumable: true },
];

const BRUSHES: Raw[] = [
  { id: 'ink', name: 'Ink', ko: '먹', ja: '墨', blurb: 'Sumi ink from a soft brush, with a little dry-brush at the tail.', isDefault: true },
  { id: 'vermilion', name: 'Vermilion', ko: '주묵', ja: '朱墨', blurb: 'The red ink teachers correct with, and seals are pressed in.' },
  { id: 'indigo', name: 'Indigo', ko: '쪽빛', ja: '藍', blurb: 'Deep indigo, like a dyer’s cloth drying in the wind.' },
  { id: 'petals', name: 'Petal trail', ko: '꽃잎 길', ja: '花道', blurb: 'A rose-ink stroke that leaves tiny petals behind it.' },
  { id: 'firefly', name: 'Firefly', ko: '반딧불', ja: '蛍火', blurb: 'A dotted line of soft lights, one after another.' },
  { id: 'gold', name: 'Gold thread', ko: '금실', ja: '金糸', blurb: 'A fine gold thread with a glint that runs along it.' },
];

const EFFECTS: Raw[] = [
  { id: 'blossom', name: 'Blossom', ko: '꽃잎', ja: '花吹雪', blurb: 'Plum petals and a few drops of ink.', isDefault: true },
  { id: 'ink', name: 'Ink splash', ko: '먹물', ja: '墨飛沫', blurb: 'A blot of ink lands, and droplets fly.' },
  { id: 'cranes', name: 'Paper cranes', ko: '종이학', ja: '折り鶴', blurb: 'Three folded cranes take off from the cleared cards.' },
  { id: 'maple', name: 'Maple leaves', ko: '단풍', ja: '紅葉', blurb: 'Red and gold leaves that spin and fall.' },
  { id: 'snow', name: 'Snowflakes', ko: '눈송이', ja: '雪の花', blurb: 'Six-pointed flakes drifting slowly away.' },
  { id: 'fireflies', name: 'Fireflies', ko: '반딧불이', ja: '蛍', blurb: 'Small lights that rise and blink out.' },
  { id: 'gold', name: 'Gold dust', ko: '금가루', ja: '金粉', blurb: 'A puff of gold leaf that glitters as it settles.' },
];

/** Board papers sold in the Market (painted in CSS: see market.css `.paper--*`). */
const PAPERS: Raw[] = [
  { id: 'plain', name: 'Plain hanji', ko: '한지', ja: '韓紙', blurb: 'The everyday paper.', isDefault: true },
  { id: 'hanji', name: 'Hanji fibre', ko: '닥종이', ja: '楮紙', blurb: 'Mulberry paper with long fibres you can see.' },
  { id: 'snow', name: 'Snow paper', ko: '설화지', ja: '雪紙', blurb: 'Cool white paper with a few flakes pressed in.' },
  { id: 'celadon', name: 'Celadon', ko: '청자', ja: '青磁', blurb: 'The soft green of a Goryeo glaze, with a fine crackle.' },
  { id: 'indigo', name: 'Indigo night', ko: '쪽빛 밤', ja: '藍夜', blurb: 'Indigo-dyed paper, deep as a summer night.' },
  { id: 'goldfleck', name: 'Gold-fleck washi', ko: '금박지', ja: '金砂子', blurb: 'Washi scattered with flakes of gold leaf.' },
  { id: 'suminagashi', name: 'Ink-marbled', ko: '먹 마블', ja: '墨流し', blurb: 'Suminagashi: ink floated on water, then lifted onto paper.' },
];

const MUSIC: Raw[] = [
  { id: 'default', name: 'Seasons', ko: '사계', ja: '四季', blurb: 'The plucked music that changes with the seasons.', isDefault: true },
  { id: 'gayageum', name: 'Gayageum', ko: '가야금', ja: '伽倻琴', blurb: 'A twelve-string zither, with notes that bend and sigh.' },
  { id: 'koto', name: 'Koto rain', ko: '고토와 비', ja: '琴と雨', blurb: 'Koto in the old miyako-bushi scale, with soft rain outside.' },
  { id: 'flute', name: 'Bamboo flute', ko: '대금', ja: '尺八', blurb: 'A breathy bamboo flute playing long, slow notes.' },
  { id: 'moonlight', name: 'Moonlight', ko: '달빛', ja: '月光', blurb: 'Bell tones, high and far apart, for the end of the path.' },
];

export const MARKET_ITEMS: MarketItem[] = [
  ...TOOLS.map((r) => make('tool', r)),
  ...DECK_STYLES.map((d) => make('deck', { id: d.id, name: d.name, ko: d.ko, ja: d.ja, blurb: d.blurb, isDefault: d.id === 'classic' })),
  ...CARD_BACKS.map((b) => make('back', { id: b.id, name: b.name, ko: b.ko, ja: b.ja, blurb: b.blurb, isDefault: b.id === 'classic' })),
  ...BRUSHES.map((r) => make('brush', r)),
  ...EFFECTS.map((r) => make('fx', r)),
  ...PAPERS.map((r) => make('paper', r)),
  // The twelve flower papers: unlocked in the Album, never sold.
  ...MONTHS.map((m) => {
    const it = make('paper', { id: String(m.index), name: `${m.en} paper`, ko: m.ko, ja: m.ja, blurb: `Collect all four ${m.en.toLowerCase()} cards in the Album to unlock it.` });
    return { ...it, source: { kind: 'album', month: m.index } as ItemSource };
  }),
  ...GARDEN_ITEMS.map((g) => make('garden', { id: g.id, name: g.name, ko: g.ko, ja: g.ja, blurb: g.blurb, ...(g.needs ? { needs: `garden:${g.needs}` } : {}) })),
  ...MUSIC.map((r) => make('music', r)),
];

const BY_KEY = new Map(MARKET_ITEMS.map((it) => [it.key, it]));
export const itemByKey = (key: string): MarketItem | undefined => BY_KEY.get(key);
export const itemsIn = (category: MarketCategory): MarketItem[] => MARKET_ITEMS.filter((it) => it.category === category);

/** Ids of the papers sold in the Market (painted in CSS). */
export const MARKET_PAPER_IDS = PAPERS.filter((p) => !p.isDefault).map((p) => p.id);

/** Sum of every cosmetic + garden price (tools excluded): the long-term sink. */
export const cosmeticsTotal = (): number => MARKET_ITEMS.filter((it) => it.category !== 'tool').reduce((n, it) => n + it.price, 0);
