/**
 * The 48-card flower deck shared by Japan (Hanafuda 花札) and Korea (Hwatu 화투).
 * Twelve suits, one per month, four cards each. Months follow the Japanese
 * order; the Korean deck swaps November and December (noted per suit).
 *
 * Card id = monthIndex * 4 + variant. Variant 0 is always a plain card so the
 * teaching levels can show identical-looking pairs.
 */

export type CardKind = 'plain' | 'ribbon' | 'animal' | 'bright';
export type RibbonStyle = 'poetry' | 'blue' | 'red';

export interface CardDef {
  kind: CardKind;
  /** English name of the card's feature */
  en: string;
  /** Kanji / Hanja shown on the medallion for animal & bright cards */
  glyph?: string;
  ko?: string;
  ja?: string;
  ribbon?: RibbonStyle;
}

export interface MonthDef {
  index: number; // 0–11
  key: string;
  en: string;
  ko: string;
  koRoman: string;
  ja: string;
  jaKana: string;
  jaRoman: string;
  /** Korean deck month number (11 & 12 are swapped vs. Japan) */
  koMonth: number;
  note: string;
  cards: [CardDef, CardDef, CardDef, CardDef];
}

const plain = (en = 'Plain'): CardDef => ({ kind: 'plain', en });

export const MONTHS: MonthDef[] = [
  {
    index: 0, key: 'pine', en: 'Pine', ko: '송학', koRoman: 'songhak', ja: '松', jaKana: 'まつ', jaRoman: 'matsu', koMonth: 1,
    note: 'Evergreen pine and the crane both stand for long life in Korea and Japan. The Korean suit name 송학 literally means "pine and crane".',
    cards: [plain(), plain(), { kind: 'ribbon', en: 'Poetry ribbon', ribbon: 'poetry' }, { kind: 'bright', en: 'Crane', glyph: '鶴', ko: '학', ja: 'つる' }],
  },
  {
    index: 1, key: 'plum', en: 'Plum blossom', ko: '매조', koRoman: 'maejo', ja: '梅', jaKana: 'うめ', jaRoman: 'ume', koMonth: 2,
    note: 'Plum blooms in late winter, ahead of most other trees. The bush warbler perched on it is a favourite pairing in classical poetry.',
    cards: [plain(), plain(), { kind: 'ribbon', en: 'Poetry ribbon', ribbon: 'poetry' }, { kind: 'animal', en: 'Bush warbler', glyph: '鶯', ko: '꾀꼬리', ja: 'うぐいす' }],
  },
  {
    index: 2, key: 'cherry', en: 'Cherry blossom', ko: '벚꽃', koRoman: 'beotkkot', ja: '桜', jaKana: 'さくら', jaRoman: 'sakura', koMonth: 3,
    note: 'Spring blossom viewing is hanami in Japan and beotkkot-nori in Korea. The bright card shows the curtain of a viewing party.',
    cards: [plain(), plain(), { kind: 'ribbon', en: 'Poetry ribbon', ribbon: 'poetry' }, { kind: 'bright', en: 'Curtain', glyph: '幕', ko: '막', ja: 'まく' }],
  },
  {
    index: 3, key: 'wisteria', en: 'Wisteria', ko: '흑싸리', koRoman: 'heukssari', ja: '藤', jaKana: 'ふじ', jaRoman: 'fuji', koMonth: 4,
    note: 'In Japan this suit is wisteria. Korean players call it 흑싸리, "black bush clover", after the dark hanging sprays.',
    cards: [plain(), plain(), { kind: 'ribbon', en: 'Red ribbon', ribbon: 'red' }, { kind: 'animal', en: 'Cuckoo', glyph: '鵑', ko: '두견새', ja: 'ほととぎす' }],
  },
  {
    index: 4, key: 'iris', en: 'Iris', ko: '난초', koRoman: 'nancho', ja: '菖蒲', jaKana: 'あやめ', jaRoman: 'ayame', koMonth: 5,
    note: 'Korean decks call this suit 난초, "orchid". The animal card shows the eight-plank bridge among irises from The Tales of Ise.',
    cards: [plain(), plain(), { kind: 'ribbon', en: 'Red ribbon', ribbon: 'red' }, { kind: 'animal', en: 'Bridge', glyph: '橋', ko: '다리', ja: 'はし' }],
  },
  {
    index: 5, key: 'peony', en: 'Peony', ko: '모란', koRoman: 'moran', ja: '牡丹', jaKana: 'ぼたん', jaRoman: 'botan', koMonth: 6,
    note: 'The peony is often called the king of flowers. Its ribbon is blue in Korean decks and purple in Japanese ones.',
    cards: [plain(), plain(), { kind: 'ribbon', en: 'Blue ribbon', ribbon: 'blue' }, { kind: 'animal', en: 'Butterflies', glyph: '蝶', ko: '나비', ja: 'ちょう' }],
  },
  {
    index: 6, key: 'clover', en: 'Bush clover', ko: '홍싸리', koRoman: 'hongssari', ja: '萩', jaKana: 'はぎ', jaRoman: 'hagi', koMonth: 7,
    note: 'Bush clover is one of the seven autumn flowers of Japanese poetry. Korean players call it 홍싸리, "red bush clover".',
    cards: [plain(), plain(), { kind: 'ribbon', en: 'Red ribbon', ribbon: 'red' }, { kind: 'animal', en: 'Boar', glyph: '猪', ko: '멧돼지', ja: 'いのしし' }],
  },
  {
    index: 7, key: 'moon', en: 'Silver grass', ko: '공산', koRoman: 'gongsan', ja: '芒', jaKana: 'すすき', jaRoman: 'susuki', koMonth: 8,
    note: 'A full moon rising over silver grass. The Korean name 공산 means "empty mountain". This is the harvest-moon season of tsukimi and Chuseok.',
    cards: [plain(), plain(), { kind: 'animal', en: 'Geese', glyph: '雁', ko: '기러기', ja: 'かり' }, { kind: 'bright', en: 'Full moon', glyph: '月', ko: '달', ja: 'つき' }],
  },
  {
    index: 8, key: 'chrysanthemum', en: 'Chrysanthemum', ko: '국화', koRoman: 'gukhwa', ja: '菊', jaKana: 'きく', jaRoman: 'kiku', koMonth: 9,
    note: 'The sake cup recalls the Chrysanthemum Festival on the ninth day of the ninth month, when petals were floated in sake for long life.',
    cards: [plain(), plain(), { kind: 'ribbon', en: 'Blue ribbon', ribbon: 'blue' }, { kind: 'animal', en: 'Sake cup', glyph: '盃', ko: '술잔', ja: 'さかずき' }],
  },
  {
    index: 9, key: 'maple', en: 'Maple', ko: '단풍', koRoman: 'danpung', ja: '紅葉', jaKana: 'もみじ', jaRoman: 'momiji', koMonth: 10,
    note: 'The deer on this card looks away. The Japanese slang "shikato" (to ignore someone) is said to come from it: the deer (shika) of the tenth (tō).',
    cards: [plain(), plain(), { kind: 'ribbon', en: 'Blue ribbon', ribbon: 'blue' }, { kind: 'animal', en: 'Deer', glyph: '鹿', ko: '사슴', ja: 'しか' }],
  },
  {
    index: 10, key: 'willow', en: 'Willow', ko: '비', koRoman: 'bi', ja: '柳', jaKana: 'やなぎ', jaRoman: 'yanagi', koMonth: 12,
    note: 'Willow in the rain. In Korea this is the 12th month, simply called 비, "rain". The bright card traditionally shows the calligrapher Ono no Michikaze.',
    cards: [plain(), { kind: 'ribbon', en: 'Red ribbon', ribbon: 'red' }, { kind: 'animal', en: 'Swallow', glyph: '燕', ko: '제비', ja: 'つばめ' }, { kind: 'bright', en: 'Rain', glyph: '雨', ko: '비', ja: 'あめ' }],
  },
  {
    index: 11, key: 'paulownia', en: 'Paulownia', ko: '오동', koRoman: 'odong', ja: '桐', jaKana: 'きり', jaRoman: 'kiri', koMonth: 11,
    note: 'Paulownia and the phoenix are a classic pairing. Korea places this suit in the 11th month, and players there jokingly nickname it 똥 (ttong).',
    cards: [plain(), plain(), plain(), { kind: 'bright', en: 'Phoenix', glyph: '鳳', ko: '봉황', ja: 'ほうおう' }],
  },
];

export const cardDef = (id: number): CardDef => MONTHS[id >> 2].cards[id & 3];
export const monthDef = (id: number): MonthDef => MONTHS[id >> 2];
export const ALL_CARD_IDS = Array.from({ length: 48 }, (_, i) => i);

export const KIND_LABEL: Record<CardKind, { en: string; ko: string; ja: string }> = {
  plain: { en: 'Plain', ko: '피', ja: 'カス' },
  ribbon: { en: 'Ribbon', ko: '띠', ja: '短冊' },
  animal: { en: 'Animal', ko: '열끗', ja: '種' },
  bright: { en: 'Bright', ko: '광', ja: '光' },
};
