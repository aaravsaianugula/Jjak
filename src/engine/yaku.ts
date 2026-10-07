/**
 * Yaku (役 · 약): the classic card sets of Japanese Koi-Koi and Korean Go-Stop.
 * In Jjak they're a bonus for *clearing* the set's cards within one board —
 * a little discovery for players who learn the deck. Nothing is ever wagered.
 */
export interface Yaku {
  id: string;
  en: string;
  native: string;
  cards: number[];
  bonus: number;
}

export const YAKU: Yaku[] = [
  { id: 'hongdan', en: 'Red poetry ribbons', native: '홍단 · 赤短', cards: [2, 6, 10], bonus: 500 },
  { id: 'cheongdan', en: 'Blue ribbons', native: '청단 · 青短', cards: [22, 34, 38], bonus: 500 },
  { id: 'chodan', en: 'Plain red ribbons', native: '초단 · 草短', cards: [14, 18, 26], bonus: 500 },
  { id: 'godori', en: 'Godori · five birds', native: '고도리', cards: [7, 15, 30], bonus: 700 },
  { id: 'inoshikacho', en: 'Boar, deer, butterfly', native: '猪鹿蝶', cards: [27, 39, 23], bonus: 700 },
  { id: 'tsukimi', en: 'Moon-viewing sake', native: '月見酒', cards: [31, 35], bonus: 400 },
  { id: 'hanami', en: 'Blossom-viewing sake', native: '花見酒', cards: [11, 35], bonus: 400 },
  { id: 'sangwang', en: 'Three brights', native: '삼광 · 三光', cards: [3, 11, 31], bonus: 900 },
  { id: 'ogwang', en: 'Five brights', native: '오광 · 五光', cards: [3, 11, 31, 43, 47], bonus: 2000 },
];

/** Yaku newly completed by `cleared` that weren't already in `done`. */
export function newYaku(cleared: ReadonlySet<number>, done: ReadonlySet<string>): Yaku[] {
  return YAKU.filter((y) => !done.has(y.id) && y.cards.every((c) => cleared.has(c)));
}

/** Sets that this board could still complete (all cards present at the start). */
export function possibleYaku(cardIds: readonly number[]): Yaku[] {
  const have = new Set(cardIds);
  return YAKU.filter((y) => y.cards.every((c) => have.has(c)));
}
