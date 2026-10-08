/**
 * When Jjak asks a player to remove ads: once on first start, then at most once a
 * month while that month's festival week is on, never once ads are gone or after
 * "Don't ask again". Pure data and dates only (local calendar days): no imports from
 * storage.ts (it imports this file for the save slice).
 *
 * Only fixed-date festivals: lunar ones (Seollal, Chuseok, Dano) move every year.
 */

export interface Festival {
  id: string;
  /** English name */
  en: string;
  /** Korean name, when the festival is kept in Korea */
  ko?: string;
  /** Japanese name, when the festival is kept in Japan */
  ja?: string;
  /** 1-based month and day the festival week starts */
  month: number;
  day: number;
  /** the one character pressed into the festival's seal */
  mark: string;
}

/** A festival week: the festival's date and the six days after it. */
export const FESTIVAL_DAYS = 7;

export const FESTIVALS: readonly Festival[] = [
  { id: 'shogatsu', en: 'New Year', ja: '正月', ko: '신정', month: 1, day: 1, mark: '正' },
  { id: 'setsubun', en: 'Setsubun', ja: '節分', month: 2, day: 3, mark: '節' },
  { id: 'hinamatsuri', en: 'Hinamatsuri', ja: '雛祭り', month: 3, day: 3, mark: '雛' },
  { id: 'hanami', en: 'Hanami', ja: '花見', month: 4, day: 1, mark: '花' },
  { id: 'childrens-day', en: 'Children’s Day', ko: '어린이날', ja: 'こどもの日', month: 5, day: 5, mark: '子' },
  { id: 'haji', en: 'Summer solstice', ko: '하지', ja: '夏至', month: 6, day: 21, mark: '夏' },
  { id: 'tanabata', en: 'Tanabata', ja: '七夕', month: 7, day: 7, mark: '夕' },
  { id: 'obon', en: 'Obon', ja: 'お盆', month: 8, day: 13, mark: '盆' },
  { id: 'chubun', en: 'Autumn equinox', ko: '추분', ja: '秋分', month: 9, day: 22, mark: '秋' },
  { id: 'hangeul-day', en: 'Hangeul Day', ko: '한글날', month: 10, day: 9, mark: '글' },
  { id: 'shichigosan', en: 'Shichi-Go-San', ja: '七五三', month: 11, day: 15, mark: '七' },
  { id: 'dongji', en: 'Dongji', ko: '동지', ja: '冬至', month: 12, day: 22, mark: '冬' },
];

/** The festival whose week includes this local calendar day, if any. */
export function festivalOn(now: Date): Festival | null {
  const month = now.getMonth() + 1;
  const date = now.getDate();
  return FESTIVALS.find((f) => f.month === month && date >= f.day && date < f.day + FESTIVAL_DAYS) ?? null;
}

/** Local year and month, `YYYY-MM`. */
export function monthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** What the save remembers about asking. */
export interface AdOfferSave {
  /** the player pressed "Don't ask again" */
  never: boolean;
  /** the first-start ask has been shown */
  firstShown: boolean;
  /** `YYYY-MM` of the last ask */
  lastMonth: string | null;
}

/** Everything the schedule looks at. */
export interface OfferState extends AdOfferSave {
  /** owns Remove ads (or the Supporter pack) */
  adFree: boolean;
}

export type OfferDue = { kind: 'first'; festival?: Festival } | { kind: 'festival'; festival: Festival };

/**
 * Is an ask due today? The first start always asks (carrying the festival when its week
 * is on, so the first ask can hold the festival price); after that only during this
 * month's festival week, and only if this month hasn't been asked yet.
 */
export function offerDue(now: Date, state: OfferState): OfferDue | null {
  if (state.adFree || state.never) return null;
  const festival = festivalOn(now);
  if (!state.firstShown) return festival ? { kind: 'first', festival } : { kind: 'first' };
  if (!festival || state.lastMonth === monthKey(now)) return null;
  return { kind: 'festival', festival };
}

/** The state after an ask was shown today: any ask counts for its month. */
export function recordOffer(state: AdOfferSave, now: Date): AdOfferSave {
  return { ...state, firstShown: true, lastMonth: monthKey(now) };
}

export const defaultAdOffer = (): AdOfferSave => ({ never: false, firstShown: false, lastMonth: null });

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Read the saved slice field by field; anything missing or malformed falls back to unasked. */
export function hydrateAdOffer(raw: unknown): AdOfferSave {
  const base = defaultAdOffer();
  if (!raw || typeof raw !== 'object') return base;
  const r: { never?: unknown; firstShown?: unknown; lastMonth?: unknown } = raw;
  return {
    never: typeof r.never === 'boolean' ? r.never : base.never,
    firstShown: typeof r.firstShown === 'boolean' ? r.firstShown : base.firstShown,
    lastMonth: typeof r.lastMonth === 'string' && MONTH_KEY.test(r.lastMonth) ? r.lastMonth : base.lastMonth,
  };
}

/** A price as Google Play reported it. */
export interface PlayPrice {
  /** localized, e.g. "$2.49" */
  label: string;
  amount: number;
  currency: string;
}

/**
 * The festival price, with the regular price it's "usually", only when Play reported
 * both in the same currency and the festival one really is lower. Otherwise null: the
 * offer shows the regular price and claims no discount.
 */
export function festivalDeal(regular: PlayPrice | null, festival: PlayPrice | null): { price: string; usually: string } | null {
  if (!regular || !festival || regular.currency !== festival.currency) return null;
  const known = (n: number) => Number.isFinite(n) && n > 0;
  if (!known(regular.amount) || !known(festival.amount) || festival.amount >= regular.amount) return null;
  return { price: festival.label, usually: regular.label };
}
