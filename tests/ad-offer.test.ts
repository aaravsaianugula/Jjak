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
const fresh = (over: Partial<OfferState> = {}): OfferState => ({ adFree: false, never: false, firstShown: false, lastMonth: null, ...over });
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
    expect(festivalOn(day(2026, 8, 12))).toBeNull();
    expect(festivalOn(day(2026, 8, 13))?.en).toBe('Obon');
    expect(festivalOn(day(2026, 8, 19))?.en).toBe('Obon');
    expect(festivalOn(day(2026, 8, 20))).toBeNull();
    expect(festivalOn(day(2026, 4, 1))?.en).toBe('Hanami');
    expect(festivalOn(day(2026, 4, 7))?.en).toBe('Hanami');
    expect(festivalOn(day(2026, 4, 8))).toBeNull();
    expect(festivalOn(day(2026, 3, 31))).toBeNull();
  });

  it('uses the local calendar day: the first minute and the last minute of a day count', () => {
    expect(festivalOn(new Date(2027, 0, 1, 0, 0, 0))?.en).toBe('New Year');
    expect(festivalOn(new Date(2027, 0, 7, 23, 59, 59))?.en).toBe('New Year');
    expect(festivalOn(new Date(2027, 0, 8, 0, 0, 0))).toBeNull();
    expect(festivalOn(new Date(2026, 11, 31, 23, 59, 59))).toBeNull();
  });

  it('leap days fall outside every window', () => {
    expect(festivalOn(day(2028, 2, 29))).toBeNull();
    expect(festivalOn(day(2028, 2, 9))?.en).toBe('Setsubun');
    expect(festivalOn(day(2028, 2, 10))).toBeNull();
  });

  it('keys months by local year and month', () => {
    expect(monthKey(day(2026, 1, 5))).toBe('2026-01');
    expect(monthKey(day(2026, 12, 31))).toBe('2026-12');
    expect(monthKey(new Date(2027, 0, 1, 0, 0, 0))).toBe('2027-01');
  });
});

describe('when the offer is due', () => {
  it('asks once on first start, outside any festival', () => {
    expect(offerDue(day(2026, 10, 1), fresh())).toEqual({ kind: 'first' });
  });

  it('carries the festival on a first start inside its week, so the first ask can hold the festival price', () => {
    expect(offerDue(day(2026, 7, 9), fresh())).toEqual({ kind: 'first', festival: FESTIVALS[6] });
  });

  it('never asks a player who owns Remove ads or said "Don’t ask again"', () => {
    expect(offerDue(day(2026, 10, 1), fresh({ adFree: true }))).toBeNull();
    expect(offerDue(day(2026, 10, 1), fresh({ never: true }))).toBeNull();
    expect(offerDue(day(2026, 10, 9), asked('2026-09', { adFree: true }))).toBeNull();
    expect(offerDue(day(2026, 10, 9), asked('2026-09', { never: true }))).toBeNull();
  });

  it('after the first ask, asks only inside this month’s festival week', () => {
    expect(offerDue(day(2026, 10, 8), asked('2026-09'))).toBeNull();
    expect(offerDue(day(2026, 10, 9), asked('2026-09'))).toEqual({ kind: 'festival', festival: FESTIVALS[9] });
    expect(offerDue(day(2026, 10, 15), asked('2026-09'))).toEqual({ kind: 'festival', festival: FESTIVALS[9] });
    expect(offerDue(day(2026, 10, 16), asked('2026-09'))).toBeNull();
  });

  it('asks at most once a month', () => {
    expect(offerDue(day(2026, 10, 12), asked('2026-10'))).toBeNull();
  });

  it('a first start and a festival in the same month make one ask', () => {
    const now = day(2026, 10, 3);
    expect(offerDue(now, fresh())).toEqual({ kind: 'first' });
    const after = recordOffer(defaultAdOffer(), now);
    expect(offerDue(day(2026, 10, 10), { adFree: false, ...after })).toBeNull();
    // A first ask inside the festival week also counts for that week.
    const inside = recordOffer(defaultAdOffer(), day(2026, 10, 9));
    expect(offerDue(day(2026, 10, 11), { adFree: false, ...inside })).toBeNull();
  });

  it('a month that was skipped entirely does not stop the next one', () => {
    expect(offerDue(day(2026, 12, 22), asked('2026-08'))).toEqual({ kind: 'festival', festival: FESTIVALS[11] });
  });

  it('crosses the year: asked in December, asked again for the New Year', () => {
    const dec = recordOffer({ never: false, firstShown: true, lastMonth: '2026-11' }, day(2026, 12, 23));
    expect(dec.lastMonth).toBe('2026-12');
    expect(offerDue(new Date(2027, 0, 1, 0, 5), { adFree: false, ...dec })).toEqual({ kind: 'festival', festival: FESTIVALS[0] });
  });

  it('the same month a year later is a new month', () => {
    expect(offerDue(day(2027, 10, 9), asked('2026-10'))).toEqual({ kind: 'festival', festival: FESTIVALS[9] });
  });
});

describe('recording an ask', () => {
  it('marks the first ask done and remembers the month, keeping "Don’t ask again" as it was', () => {
    const s: AdOfferSave = { never: false, firstShown: false, lastMonth: null };
    expect(recordOffer(s, day(2026, 7, 7))).toEqual({ never: false, firstShown: true, lastMonth: '2026-07' });
    expect(s).toEqual({ never: false, firstShown: false, lastMonth: null });
  });
});

describe('saved offer state', () => {
  it('starts unasked', () => {
    expect(defaultAdOffer()).toEqual({ never: false, firstShown: false, lastMonth: null });
  });

  it('a save from before this feature (or a damaged one) loads as unasked', () => {
    expect(hydrateAdOffer(undefined)).toEqual(defaultAdOffer());
    expect(hydrateAdOffer(null)).toEqual(defaultAdOffer());
    expect(hydrateAdOffer('nope')).toEqual(defaultAdOffer());
    expect(hydrateAdOffer({ never: 'yes', firstShown: 1, lastMonth: 202610 })).toEqual(defaultAdOffer());
    expect(hydrateAdOffer({ lastMonth: '10/2026' })).toEqual(defaultAdOffer());
  });

  it('keeps what was saved, field by field', () => {
    expect(hydrateAdOffer({ never: true })).toEqual({ never: true, firstShown: false, lastMonth: null });
    expect(hydrateAdOffer({ never: false, firstShown: true, lastMonth: '2026-10' })).toEqual({ never: false, firstShown: true, lastMonth: '2026-10' });
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
