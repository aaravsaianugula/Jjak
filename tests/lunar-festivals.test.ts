/**
 * The lunar festivals' Gregorian dates, 2026–2045, as published by KASI (Korea Astronomy
 * and Space Science Institute) and cross-checked against a second source (see the table's
 * comment in src/services/lunar-festivals.ts). Every date is pinned here: a change to the
 * table must change this test too, deliberately.
 */
import { describe, expect, it } from 'vitest';
import { LUNAR_FIRST_YEAR, LUNAR_LAST_YEAR, lunarFestivalsIn } from '../src/services/lunar-festivals';

/** year, then Seollal, Jeongwol Daeboreum, Dano, Chilseok, Chuseok (lunar 1/1, 1/15, 5/5, 7/7, 8/15) */
const PINNED: readonly (readonly [number, string, string, string, string, string])[] = [
  [2026, '2026-02-17', '2026-03-03', '2026-06-19', '2026-08-19', '2026-09-25'],
  [2027, '2027-02-07', '2027-02-21', '2027-06-09', '2027-08-08', '2027-09-15'],
  [2028, '2028-01-27', '2028-02-10', '2028-05-28', '2028-08-26', '2028-10-03'],
  [2029, '2029-02-13', '2029-02-27', '2029-06-16', '2029-08-16', '2029-09-22'],
  [2030, '2030-02-03', '2030-02-17', '2030-06-05', '2030-08-05', '2030-09-12'],
  [2031, '2031-01-23', '2031-02-06', '2031-06-24', '2031-08-24', '2031-10-01'],
  [2032, '2032-02-11', '2032-02-25', '2032-06-12', '2032-08-12', '2032-09-19'],
  [2033, '2033-01-31', '2033-02-14', '2033-06-01', '2033-08-01', '2033-09-08'],
  [2034, '2034-02-19', '2034-03-05', '2034-06-20', '2034-08-20', '2034-09-27'],
  [2035, '2035-02-08', '2035-02-22', '2035-06-10', '2035-08-10', '2035-09-16'],
  [2036, '2036-01-28', '2036-02-11', '2036-05-30', '2036-08-28', '2036-10-04'],
  [2037, '2037-02-15', '2037-03-01', '2037-06-18', '2037-08-17', '2037-09-24'],
  [2038, '2038-02-04', '2038-02-18', '2038-06-07', '2038-08-07', '2038-09-13'],
  [2039, '2039-01-24', '2039-02-07', '2039-05-27', '2039-08-26', '2039-10-02'],
  [2040, '2040-02-12', '2040-02-26', '2040-06-14', '2040-08-14', '2040-09-21'],
  [2041, '2041-02-01', '2041-02-15', '2041-06-03', '2041-08-03', '2041-09-10'],
  [2042, '2042-01-22', '2042-02-05', '2042-06-22', '2042-08-22', '2042-09-28'],
  [2043, '2043-02-10', '2043-02-24', '2043-06-11', '2043-08-11', '2043-09-17'],
  [2044, '2044-01-30', '2044-02-13', '2044-05-31', '2044-07-31', '2044-10-05'],
  [2045, '2045-02-17', '2045-03-03', '2045-06-19', '2045-08-19', '2045-09-25'],
];

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dayNum = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86_400_000;

describe('lunar festival dates', () => {
  it('covers 2026–2045, every year', () => {
    expect([LUNAR_FIRST_YEAR, LUNAR_LAST_YEAR]).toEqual([2026, 2045]);
    expect(PINNED.map((r) => r[0])).toEqual(Array.from({ length: 20 }, (_, i) => 2026 + i));
  });

  it('pins every date in the table', () => {
    for (const [y, ...dates] of PINNED) {
      const got = lunarFestivalsIn(y).map((f) => [f.id, iso(y, f.month, f.day)]);
      expect(got, String(y)).toEqual([
        ['seollal', dates[0]],
        ['daeboreum', dates[1]],
        ['dano', dates[2]],
        ['chilseok', dates[3]],
        ['chuseok', dates[4]],
      ]);
    }
  });

  it('Daeboreum is the fifteenth day of the same lunar month as Seollal', () => {
    for (const [y, seollal, daeboreum] of PINNED) expect(dayNum(daeboreum) - dayNum(seollal), String(y)).toBe(14);
  });

  it('knows no lunar dates outside the table: it never computes or guesses one', () => {
    expect(lunarFestivalsIn(LUNAR_FIRST_YEAR - 1)).toEqual([]);
    expect(lunarFestivalsIn(LUNAR_LAST_YEAR + 1)).toEqual([]);
    expect(lunarFestivalsIn(2100)).toEqual([]);
  });

  it('names each festival in Korean, pairs Chuseok with Tsukimi, and gives each a one-character seal', () => {
    const fs = lunarFestivalsIn(2026);
    for (const f of fs) {
      expect(f.ko, f.id).toBeTruthy();
      expect([...f.mark], f.id).toHaveLength(1);
    }
    const byId = Object.fromEntries(fs.map((f) => [f.id, f]));
    expect(byId.chuseok.ja).toContain('お月見');
    expect(byId.seollal.ja).toBeUndefined();
    expect(fs.filter((f) => f.rank === 'major').map((f) => f.id)).toEqual(['seollal', 'chuseok']);
    expect(fs.filter((f) => f.rank === 'minor').map((f) => f.id)).toEqual(['daeboreum', 'dano', 'chilseok']);
  });

  // A reminder, not a rule: two years before the table runs out this fails, so the next
  // years can be added from KASI in time. Extend the table (and PINNED), never this check.
  it('the table still has two years ahead of today', () => {
    expect(new Date().getFullYear()).toBeLessThanOrEqual(LUNAR_LAST_YEAR - 2);
  });
});
