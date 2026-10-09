/**
 * When the game asks a player to remove ads: once on first start, then at most once a
 * month, during that month's festival week, never after "Don't ask again" or once ads
 * are gone. A festival price is only called a discount when Play's own prices show one.
 * Dates are the device's local calendar day.
 */
import { describe, expect, it } from 'vitest';
import {
  FESTIVALS,
  FESTIVAL_DAYS,
  type AdOfferSave,
  type OfferState,
  defaultAdOffer,
  festivalDeal,
  festivalOn,
  hydrateAdOffer,
  monthKey,
  offerDue,
  recordOffer,
} from '../src/services/ad-offer';

/** A local date (month is 1-based), at noon unless an hour is given. */
const day = (y: number, m: number, d: number, hour = 12): Date => new Date(y, m - 1, d, hour);
const fresh = (over: Partial<OfferState> = {}): OfferState => ({ adFree: false, never: false, firstShown: false, lastMonth: null, lastAsk: null, ...over });
const asked = (lastMonth: string, over: Partial<OfferState> = {}): OfferState => fresh({ firstShown: true, lastMonth, ...over });

describe('festival calendar', () => {
  it('has one fixed-date festival per month, in calendar order, each with a native name and a seal mark', () => {
    expect(FESTIVALS.map((f) => f.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(FESTIVALS.map((f) => [f.en, f.day])).toEqual([
      ['New Year', 1],
      ['Setsubun', 3],
      ['Hinamatsuri', 3],
      ['Hanami', 1],
      ['Children’s Day', 5],
      ['Summer solstice', 21],
      ['Tanabata', 7],
      ['Obon', 13],
      ['Autumn equinox', 22],
      ['Hangeul Day', 9],
      ['Shichi-Go-San', 15],
      ['Dongji', 22],
    ]);
    for (const f of FESTIVALS) {
      expect(f.ko ?? f.ja, f.en).toBeTruthy();
      expect([...f.mark]).toHaveLength(1);
    }
    expect(new Set(FESTIVALS.map((f) => f.id)).size).toBe(FESTIVALS.length);
  });

  it('every window is seven days and stays inside its month, even in a short February', () => {
    expect(FESTIVAL_DAYS).toBe(7);
    for (const f of FESTIVALS) expect(f.day + FESTIVAL_DAYS - 1).toBeLessThanOrEqual(28);
  });

  it('a window runs from the festival date through the sixth day after it', () => {
    // 2028: no lunar festival week near these dates.
    expect(festivalOn(day(2028, 8, 12))).toBeNull();
    expect(festivalOn(day(2028, 8, 13))?.en).toBe('Obon');
    expect(festivalOn(day(2028, 8, 19))?.en).toBe('Obon');
    expect(festivalOn(day(2028, 8, 20))).toBeNull();
    expect(festivalOn(day(2028, 4, 1))?.en).toBe('Hanami');
    expect(festivalOn(day(2028, 4, 7))?.en).toBe('Hanami');
    expect(festivalOn(day(2028, 4, 8))).toBeNull();
    expect(festivalOn(day(2028, 3, 31))).toBeNull();
  });

  it('uses the local calendar day: the first minute and the last minute of a day count', () => {
    expect(festivalOn(new Date(2027, 0, 1, 0, 0, 0))?.en).toBe('New Year');
    expect(festivalOn(new Date(2027, 0, 7, 23, 59, 59))?.en).toBe('New Year');
    expect(festivalOn(new Date(2027, 0, 8, 0, 0, 0))).toBeNull();
    expect(festivalOn(new Date(2026, 11, 31, 23, 59, 59))).toBeNull();
  });

  it('leap days fall outside every fixed window', () => {
    // 2036: Seollal and Daeboreum are over by February 17.
    expect(festivalOn(day(2036, 2, 29))).toBeNull();
    expect(festivalOn(day(2036, 2, 9))?.en).toBe('Setsubun');
    expect(festivalOn(day(2036, 2, 10))).toBeNull();
  });

  it('keys months by local year and month', () => {
    expect(monthKey(day(2026, 1, 5))).toBe('2026-01');
    expect(monthKey(day(2026, 12, 31))).toBe('2026-12');
    expect(monthKey(new Date(2027, 0, 1, 0, 0, 0))).toBe('2027-01');
  });
});

describe('when the offer is due', () => {
  it('asks once on first start, outside any festival', () => {
    expect(offerDue(day(2026, 10, 2), fresh())).toEqual({ kind: 'first', month: '2026-10' });
  });

  it('carries the festival on a first start inside its week, so the first ask can hold the festival price', () => {
    expect(offerDue(day(2026, 7, 9), fresh())).toEqual({ kind: 'first', festival: FESTIVALS[6], month: '2026-07' });
  });

  it('never asks a player who owns Remove ads or said "Don’t ask again"', () => {
    expect(offerDue(day(2026, 10, 2), fresh({ adFree: true }))).toBeNull();
    expect(offerDue(day(2026, 10, 2), fresh({ never: true }))).toBeNull();
    expect(offerDue(day(2026, 10, 9), asked('2026-09', { adFree: true }))).toBeNull();
    expect(offerDue(day(2026, 10, 9), asked('2026-09', { never: true }))).toBeNull();
  });

  it('after the first ask, asks only inside this month’s festival week', () => {
    expect(offerDue(day(2026, 10, 8), asked('2026-09'))).toBeNull();
    expect(offerDue(day(2026, 10, 9), asked('2026-09'))).toEqual({ kind: 'festival', festival: FESTIVALS[9], month: '2026-10' });
    expect(offerDue(day(2026, 10, 15), asked('2026-09'))).toEqual({ kind: 'festival', festival: FESTIVALS[9], month: '2026-10' });
    expect(offerDue(day(2026, 10, 16), asked('2026-09'))).toBeNull();
  });

  it('asks at most once a month', () => {
    expect(offerDue(day(2026, 10, 12), asked('2026-10'))).toBeNull();
  });

  it('a first start and a festival in the same month make one ask', () => {
    const now = day(2026, 10, 3);
    const first = offerDue(now, fresh());
    expect(first).toEqual({ kind: 'first', month: '2026-10' });
    const after = recordOffer(defaultAdOffer(), now, first!);
    expect(offerDue(day(2026, 10, 10), { adFree: false, ...after })).toBeNull();
    // A first ask inside the festival week also counts for that week.
    const inside = recordOffer(defaultAdOffer(), day(2026, 10, 9), offerDue(day(2026, 10, 9), fresh())!);
    expect(offerDue(day(2026, 10, 11), { adFree: false, ...inside })).toBeNull();
  });

  it('a month that was skipped entirely does not stop the next one', () => {
    expect(offerDue(day(2026, 12, 22), asked('2026-08'))).toEqual({ kind: 'festival', festival: FESTIVALS[11], month: '2026-12' });
  });

  it('crosses the year: asked in December, asked again in the New Year week once two weeks have passed', () => {
    const dec = recordOffer({ ...defaultAdOffer(), firstShown: true, lastMonth: '2026-11' }, day(2026, 12, 23), {
      kind: 'festival',
      festival: FESTIVALS[11],
      month: '2026-12',
    });
    expect(dec.lastMonth).toBe('2026-12');
    expect(offerDue(new Date(2027, 0, 1, 0, 5), { adFree: false, ...dec })).toBeNull();
    expect(offerDue(new Date(2027, 0, 6, 0, 5), { adFree: false, ...dec })).toEqual({ kind: 'festival', festival: FESTIVALS[0], month: '2027-01' });
  });

  it('the same month a year later is a new month', () => {
    expect(offerDue(day(2027, 10, 9), asked('2026-10'))).toEqual({ kind: 'festival', festival: FESTIVALS[9], month: '2027-10' });
  });
});

describe('lunar festival weeks', () => {
  it('Seollal’s week runs from its eve; the others’ from the day itself', () => {
    expect(festivalOn(day(2026, 2, 15))).toBeNull();
    expect(festivalOn(day(2026, 2, 16))?.id).toBe('seollal');
    expect(festivalOn(day(2026, 2, 16))).toMatchObject({ month: 2, day: 17 });
    expect(festivalOn(day(2026, 2, 22))?.id).toBe('seollal');
    expect(festivalOn(day(2026, 2, 23))).toBeNull();
    expect(festivalOn(day(2028, 5, 27))).toBeNull();
    expect(festivalOn(day(2028, 5, 28))?.id).toBe('dano');
    expect(festivalOn(day(2028, 6, 3))?.id).toBe('dano');
    expect(festivalOn(day(2028, 6, 4))).toBeNull();
  });

  it('a lunar festival is shown over a fixed one on the days their weeks overlap', () => {
    expect(festivalOn(day(2026, 9, 24))?.id).toBe('chubun');
    expect(festivalOn(day(2026, 9, 25))?.id).toBe('chuseok');
    expect(festivalOn(day(2026, 9, 28))?.id).toBe('chuseok');
    expect(festivalOn(day(2026, 3, 3))?.id).toBe('daeboreum');
  });

  it('Seollal and Chuseok take the month from a fixed festival: the fixed one shows but never asks', () => {
    // Autumn equinox week (Sep 22–28) and Chuseok (from Sep 25) share September 2026.
    expect(festivalOn(day(2026, 9, 22))?.id).toBe('chubun');
    expect(offerDue(day(2026, 9, 22), asked('2026-08'))).toBeNull();
    expect(offerDue(day(2026, 9, 25), asked('2026-08'))).toMatchObject({ kind: 'festival', month: '2026-09', festival: { id: 'chuseok' } });
    // Setsubun (Feb 3–9) and Seollal (eve Feb 16) share February 2026.
    expect(festivalOn(day(2026, 2, 5))?.id).toBe('setsubun');
    expect(offerDue(day(2026, 2, 5), asked('2026-01'))).toBeNull();
    // Seollal from its eve in January 2028 quiets the New Year week, not February's.
    expect(offerDue(day(2028, 1, 3), asked('2027-12'))).toBeNull();
    expect(offerDue(day(2028, 1, 26), asked('2027-12'))).toMatchObject({ month: '2028-01', festival: { id: 'seollal' } });
    expect(offerDue(day(2028, 2, 5), asked('2028-01'))).toMatchObject({ month: '2028-02', festival: { id: 'setsubun' } });
  });

  it('a minor lunar festival is a peer: the first festival week the player meets carries the month’s one ask', () => {
    // May 2028: Children’s Day (May 5–11) and Dano (from May 28).
    expect(offerDue(day(2028, 5, 6), asked('2028-04'))).toMatchObject({ month: '2028-05', festival: { id: 'childrens-day' } });
    expect(offerDue(day(2028, 5, 29), asked('2028-05'))).toBeNull();
    expect(offerDue(day(2028, 5, 29), asked('2028-04'))).toMatchObject({ month: '2028-05', festival: { id: 'dano' } });
    // Hinamatsuri and Daeboreum share March 3–9, 2026: one ask, under the festival shown.
    expect(offerDue(day(2026, 3, 4), asked('2026-02'))).toMatchObject({ month: '2026-03', festival: { id: 'daeboreum' } });
    expect(offerDue(day(2026, 3, 8), asked('2026-03'))).toBeNull();
  });

  it('a week that crosses into the next month asks once, for the month it starts in', () => {
    // Chuseok 2026 runs Sep 25 – Oct 1.
    expect(offerDue(day(2026, 10, 1), asked('2026-08'))).toMatchObject({ month: '2026-09', festival: { id: 'chuseok' } });
    // Asked in September (more than two weeks before): its October tail never asks again.
    expect(offerDue(day(2026, 10, 1), asked('2026-09', { lastAsk: '2026-09-02' }))).toBeNull();
    // A first start on its tail counts for September too.
    expect(offerDue(day(2026, 10, 1), fresh())).toMatchObject({ kind: 'first', month: '2026-09', festival: { id: 'chuseok' } });
  });

  it('never asks within 14 days of the last ask, even in a new month', () => {
    const due = offerDue(day(2026, 10, 1), asked('2026-08'))!;
    const tail = recordOffer({ ...defaultAdOffer(), firstShown: true, lastMonth: '2026-08' }, day(2026, 10, 1), due);
    expect(tail).toMatchObject({ lastMonth: '2026-09', lastAsk: '2026-10-01' });
    expect(offerDue(day(2026, 10, 9), { adFree: false, ...tail })).toBeNull();
    expect(offerDue(day(2026, 10, 14), { adFree: false, ...tail })).toBeNull();
    expect(offerDue(day(2026, 10, 15), { adFree: false, ...tail })).toMatchObject({ month: '2026-10', festival: { id: 'hangeul-day' } });
  });

  it('after the table ends (and before it starts) the fixed calendar runs alone', () => {
    expect(festivalOn(day(2046, 9, 22))?.id).toBe('chubun');
    expect(offerDue(day(2046, 9, 22), asked('2046-08'))).toMatchObject({ month: '2046-09', festival: { id: 'chubun' } });
    expect(offerDue(day(2046, 2, 5), asked('2046-01'))).toMatchObject({ festival: { id: 'setsubun' } });
    expect(offerDue(day(2025, 9, 22), asked('2025-08'))).toMatchObject({ festival: { id: 'chubun' } });
  });
});

describe('recording an ask', () => {
  it('marks the first ask done and remembers the ask’s month and day, keeping "Don’t ask again" as it was', () => {
    const s: AdOfferSave = defaultAdOffer();
    expect(recordOffer(s, day(2026, 7, 7), { kind: 'first', festival: FESTIVALS[6], month: '2026-07' })).toEqual({
      never: false,
      firstShown: true,
      lastMonth: '2026-07',
      lastAsk: '2026-07-07',
    });
    expect(s).toEqual(defaultAdOffer());
  });
});

describe('saved offer state', () => {
  it('starts unasked', () => {
    expect(defaultAdOffer()).toEqual({ never: false, firstShown: false, lastMonth: null, lastAsk: null });
  });

  it('a save from before this feature (or a damaged one) loads as unasked', () => {
    expect(hydrateAdOffer(undefined)).toEqual(defaultAdOffer());
    expect(hydrateAdOffer(null)).toEqual(defaultAdOffer());
    expect(hydrateAdOffer('nope')).toEqual(defaultAdOffer());
    expect(hydrateAdOffer({ never: 'yes', firstShown: 1, lastMonth: 202610, lastAsk: 5 })).toEqual(defaultAdOffer());
    expect(hydrateAdOffer({ lastMonth: '10/2026' })).toEqual(defaultAdOffer());
  });

  it('keeps what was saved, field by field', () => {
    expect(hydrateAdOffer({ never: true })).toEqual({ never: true, firstShown: false, lastMonth: null, lastAsk: null });
    const saved = { never: false, firstShown: true, lastMonth: '2026-10', lastAsk: '2026-10-09' };
    expect(hydrateAdOffer(saved)).toEqual(saved);
  });

  it('a save that only knows the month of its last ask assumes the month’s last day, so spacing holds', () => {
    expect(hydrateAdOffer({ firstShown: true, lastMonth: '2026-09' })).toMatchObject({ lastAsk: '2026-09-30' });
    expect(hydrateAdOffer({ firstShown: true, lastMonth: '2028-02' })).toMatchObject({ lastAsk: '2028-02-29' });
    expect(hydrateAdOffer({ firstShown: true, lastMonth: '2026-09', lastAsk: '2026-02-30' })).toMatchObject({ lastAsk: '2026-09-30' });
    expect(hydrateAdOffer({ firstShown: true, lastMonth: '2026-09', lastAsk: '2026-9-1' })).toMatchObject({ lastAsk: '2026-09-30' });
    const old = hydrateAdOffer({ never: false, firstShown: true, lastMonth: '2026-09' });
    expect(offerDue(day(2026, 10, 13), { adFree: false, ...old })).toBeNull();
    expect(offerDue(day(2026, 10, 14), { adFree: false, ...old })).toMatchObject({ festival: { id: 'hangeul-day' } });
  });
});

describe('festival price', () => {
  const regular = { label: '$2.99', amount: 2.99, currency: 'USD' };
  const festival = { label: '$2.49', amount: 2.49, currency: 'USD' };

  it('is a discount only when Play gave both prices and the festival one is lower', () => {
    expect(festivalDeal(regular, festival)).toEqual({ price: '$2.49', usually: '$2.99' });
  });

  it('makes no claim when either price is unknown', () => {
    expect(festivalDeal(null, festival)).toBeNull();
    expect(festivalDeal(regular, null)).toBeNull();
    expect(festivalDeal(null, null)).toBeNull();
  });

  it('makes no claim when the festival price is not lower, or the currencies differ', () => {
    expect(festivalDeal(regular, { ...festival, amount: 2.99, label: '$2.99' })).toBeNull();
    expect(festivalDeal(regular, { ...festival, amount: 3.49, label: '$3.49' })).toBeNull();
    expect(festivalDeal(regular, { label: '€2.49', amount: 2.49, currency: 'EUR' })).toBeNull();
  });

  it('makes no claim from a zero or missing amount', () => {
    expect(festivalDeal(regular, { ...festival, amount: 0 })).toBeNull();
    expect(festivalDeal({ ...regular, amount: Number.NaN }, festival)).toBeNull();
  });
});
