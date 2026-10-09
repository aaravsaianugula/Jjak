/**
 * When Jjak asks a player to remove ads: once on first start, then at most once a
 * month while a festival week is on, never within 14 days of the last ask, never once
 * ads are gone or after "Don't ask again". Pure data and dates only (local calendar days):
 * no imports from storage.ts (it imports this file for the save slice).
 *
 * The calendar: twelve fixed-date festivals, plus Korea's lunar festivals from a verified
 * date table (src/services/lunar-festivals.ts) while it lasts; after it ends the fixed
 * festivals run alone. The rules (docs/MONETIZATION.md §4a):
 *  - A week asks for the month it starts in. A week that runs into the next month (Chuseok
 *    from 30 September) is one ask for its first month; its tail never asks again.
 *  - Seollal and Chuseok (major) take their month from a fixed festival: a fixed festival
 *    whose month holds a major week's start never asks (it still shows, with its price).
 *  - Daeboreum, Dano and Chilseok (minor) are peers of the fixed festivals: whichever
 *    festival week the player meets first carries the month's one ask.
 *  - On days where two weeks overlap, the sheet shows (and the ask carries) the major
 *    festival, else the minor one, else the one that started last.
 */
import { lunarFestivalsIn } from './lunar-festivals';

/** fixed: the same date every year; major/minor: lunar, from the date table. */
export type FestivalRank = 'fixed' | 'major' | 'minor';

export interface Festival {
  id: string;
  /** English name */
  en: string;
  /** Korean name, when the festival is kept in Korea */
  ko?: string;
  /** Japanese name, when the festival is kept in Japan */
  ja?: string;
  /** 1-based month and day of the festival (this year's, for a lunar festival) */
  month: number;
  day: number;
  /** the one character pressed into the festival's seal */
  mark: string;
  rank: FestivalRank;
  /** the week starts the day before the festival (Seollal's eve) */
  eve?: boolean;
}

/** A festival week: seven days, from the festival date (or its eve) on. */
export const FESTIVAL_DAYS = 7;

/** Days a new ask waits after the last one. */
export const ASK_SPACING_DAYS = 14;

export const FESTIVALS: readonly Festival[] = [
  { id: 'shogatsu', en: 'New Year', ja: '正月', ko: '신정', month: 1, day: 1, mark: '正', rank: 'fixed' },
  { id: 'setsubun', en: 'Setsubun', ja: '節分', month: 2, day: 3, mark: '節', rank: 'fixed' },
  { id: 'hinamatsuri', en: 'Hinamatsuri', ja: '雛祭り', month: 3, day: 3, mark: '雛', rank: 'fixed' },
  { id: 'hanami', en: 'Hanami', ja: '花見', month: 4, day: 1, mark: '花', rank: 'fixed' },
  { id: 'childrens-day', en: 'Children’s Day', ko: '어린이날', ja: 'こどもの日', month: 5, day: 5, mark: '子', rank: 'fixed' },
  { id: 'haji', en: 'Summer solstice', ko: '하지', ja: '夏至', month: 6, day: 21, mark: '夏', rank: 'fixed' },
  { id: 'tanabata', en: 'Tanabata', ja: '七夕', month: 7, day: 7, mark: '夕', rank: 'fixed' },
  { id: 'obon', en: 'Obon', ja: 'お盆', month: 8, day: 13, mark: '盆', rank: 'fixed' },
  { id: 'chubun', en: 'Autumn equinox', ko: '추분', ja: '秋分', month: 9, day: 22, mark: '秋', rank: 'fixed' },
  { id: 'hangeul-day', en: 'Hangeul Day', ko: '한글날', month: 10, day: 9, mark: '글', rank: 'fixed' },
  { id: 'shichigosan', en: 'Shichi-Go-San', ja: '七五三', month: 11, day: 15, mark: '七', rank: 'fixed' },
  { id: 'dongji', en: 'Dongji', ko: '동지', ja: '冬至', month: 12, day: 22, mark: '冬', rank: 'fixed' },
];

/** A calendar day as a whole number (days since 1970-01-01), free of time zones and DST. */
const dayNum = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d) / 86_400_000;
const today = (now: Date): number => dayNum(now.getFullYear(), now.getMonth() + 1, now.getDate());
const pad = (n: number): string => String(n).padStart(2, '0');

/** Local year and month, `YYYY-MM`. */
export function monthKey(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Local calendar day, `YYYY-MM-DD`. */
export function dayKey(now: Date): string {
  return `${monthKey(now)}-${pad(now.getDate())}`;
}

interface FestivalWeek {
  festival: Festival;
  /** first and last day (dayNum) */
  first: number;
  last: number;
  /** `YYYY-MM` the week's ask counts for: the month it starts in */
  month: string;
  /** a major lunar week starts in the same month, so this (fixed) week never asks */
  quiet: boolean;
}

/** Every festival week of a year, fixed and lunar. */
function weeksOf(year: number): FestivalWeek[] {
  const weeks = [...FESTIVALS, ...lunarFestivalsIn(year)].map((festival) => {
    const first = dayNum(year, festival.month, festival.day) - (festival.eve ? 1 : 0);
    const start = new Date(first * 86_400_000);
    const month = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`;
    return { festival, first, last: first + FESTIVAL_DAYS - 1, month, quiet: false };
  });
  const majorMonths = new Set(weeks.filter((w) => w.festival.rank === 'major').map((w) => w.month));
  for (const w of weeks) w.quiet = w.festival.rank === 'fixed' && majorMonths.has(w.month);
  return weeks;
}

const RANK_ORDER: Record<FestivalRank, number> = { major: 0, minor: 1, fixed: 2 };

/** The weeks on today, the one to show first (see the overlap rule above). */
function weeksOn(now: Date): FestivalWeek[] {
  const t = today(now);
  const y = now.getFullYear();
  return [...weeksOf(y - 1), ...weeksOf(y)]
    .filter((w) => w.first <= t && t <= w.last)
    .sort((a, b) => RANK_ORDER[a.festival.rank] - RANK_ORDER[b.festival.rank] || b.first - a.first);
}

/** The festival whose week includes this local calendar day, if any. */
export function festivalOn(now: Date): Festival | null {
  return weeksOn(now)[0]?.festival ?? null;
}

/** What the save remembers about asking. */
export interface AdOfferSave {
  /** the player pressed "Don't ask again" */
  never: boolean;
  /** the first-start ask has been shown */
  firstShown: boolean;
  /** `YYYY-MM` the last ask counted for */
  lastMonth: string | null;
  /** `YYYY-MM-DD` of the last ask */
  lastAsk: string | null;
}

/** Everything the schedule looks at. */
export interface OfferState extends AdOfferSave {
  /** owns Remove ads (or the Supporter pack) */
  adFree: boolean;
}

/** An ask that is due; `month` is the `YYYY-MM` it counts for. */
export type OfferDue = { kind: 'first'; festival?: Festival; month: string } | { kind: 'festival'; festival: Festival; month: string };

/** `YYYY-MM-DD` as a day number, or null when it isn't a real date. */
function parseDay(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const n = dayNum(y, mo, d);
  const back = new Date(n * 86_400_000);
  return back.getUTCFullYear() === y && back.getUTCMonth() + 1 === mo && back.getUTCDate() === d ? n : null;
}

/**
 * Is an ask due today? The first start always asks (carrying the festival when a week
 * is on, so the first ask can hold the festival price, and counting for that week's
 * month). After that only inside a festival week that may ask (not a quiet one), whose
 * month hasn't been asked yet, and at least 14 days after the last ask.
 */
export function offerDue(now: Date, state: OfferState): OfferDue | null {
  if (state.adFree || state.never) return null;
  const on = weeksOn(now);
  if (!state.firstShown) {
    const shown = on[0];
    return shown ? { kind: 'first', festival: shown.festival, month: shown.month } : { kind: 'first', month: monthKey(now) };
  }
  const last = state.lastAsk ? parseDay(state.lastAsk) : null;
  if (last !== null && today(now) - last < ASK_SPACING_DAYS) return null;
  const week = on.find((w) => !w.quiet && !(state.lastMonth && state.lastMonth >= w.month));
  return week ? { kind: 'festival', festival: week.festival, month: week.month } : null;
}

/**
 * The state after an ask was shown today: it counts for the month the ask was due for
 * (never moving the remembered month backwards), and today starts the 14-day spacing.
 */
export function recordOffer(state: AdOfferSave, now: Date, due: OfferDue): AdOfferSave {
  const lastMonth = state.lastMonth && state.lastMonth > due.month ? state.lastMonth : due.month;
  return { ...state, firstShown: true, lastMonth, lastAsk: dayKey(now) };
}

export const defaultAdOffer = (): AdOfferSave => ({ never: false, firstShown: false, lastMonth: null, lastAsk: null });

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}

/**
 * Read the saved slice field by field; anything missing or malformed falls back to unasked.
 * A save from before the ask date was kept (only `lastMonth`) assumes the ask was on that
 * month's last day: never earlier than it really was, so the 14-day spacing still holds.
 */
export function hydrateAdOffer(raw: unknown): AdOfferSave {
  const base = defaultAdOffer();
  if (!raw || typeof raw !== 'object') return base;
  const r: { never?: unknown; firstShown?: unknown; lastMonth?: unknown; lastAsk?: unknown } = raw;
  const lastMonth = typeof r.lastMonth === 'string' && MONTH_KEY.test(r.lastMonth) ? r.lastMonth : base.lastMonth;
  const lastAsk = typeof r.lastAsk === 'string' && parseDay(r.lastAsk) !== null ? r.lastAsk : lastMonth ? monthEnd(lastMonth) : base.lastAsk;
  return {
    never: typeof r.never === 'boolean' ? r.never : base.never,
    firstShown: typeof r.firstShown === 'boolean' ? r.firstShown : base.firstShown,
    lastMonth,
    lastAsk,
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
