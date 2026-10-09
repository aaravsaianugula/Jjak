/**
 * Korea's lunisolar festivals for the Remove-ads festival calendar (src/services/ad-offer.ts):
 * their Gregorian dates, read from a table, never computed.
 *
 * Sources (checked 2026-10-08; every one of the 100 dates agreed in both, no discrepancies):
 *  1. KASI, Korea Astronomy and Space Science Institute (한국천문연구원), the official Korean
 *     lunar calendar: the lunar→solar converter at https://astro.kasi.re.kr/life/pageView/8
 *     (its data endpoint https://astro.kasi.re.kr/life/lunc?yyyy=…&mm=…&dd=…, regular month,
 *     평달). The Seollal eves were also read back through https://astro.kasi.re.kr/life/solc
 *     (each is lunar 12/29 or 12/30 of the year before).
 *  2. The `korean-lunar-calendar` package 0.4.0 (PyPI, KASI-based table, independent
 *     transcription): every date, from the lunar date.
 *  3. Seollal and Chuseok also match the South Korean public holidays in the `holidays`
 *     package 0.106 (PyPI), years 2026–2045.
 *
 * Extend the table only the same way (two sources per date), and pin the new rows in
 * tests/lunar-festivals.test.ts; a test there starts failing two years before the table ends.
 */
import type { Festival } from './ad-offer';

export const LUNAR_FIRST_YEAR = 2026;
export const LUNAR_LAST_YEAR = 2045;

type LunarId = 'seollal' | 'daeboreum' | 'dano' | 'chilseok' | 'chuseok';

/** Gregorian `MM-DD` of lunar 1/1, 1/15, 5/5, 7/7 and 8/15 (regular months), by year. */
const DATES: Readonly<Record<number, Readonly<Record<LunarId, string>>>> = {
  2026: { seollal: '02-17', daeboreum: '03-03', dano: '06-19', chilseok: '08-19', chuseok: '09-25' },
  2027: { seollal: '02-07', daeboreum: '02-21', dano: '06-09', chilseok: '08-08', chuseok: '09-15' },
  2028: { seollal: '01-27', daeboreum: '02-10', dano: '05-28', chilseok: '08-26', chuseok: '10-03' },
  2029: { seollal: '02-13', daeboreum: '02-27', dano: '06-16', chilseok: '08-16', chuseok: '09-22' },
  2030: { seollal: '02-03', daeboreum: '02-17', dano: '06-05', chilseok: '08-05', chuseok: '09-12' },
  2031: { seollal: '01-23', daeboreum: '02-06', dano: '06-24', chilseok: '08-24', chuseok: '10-01' },
  2032: { seollal: '02-11', daeboreum: '02-25', dano: '06-12', chilseok: '08-12', chuseok: '09-19' },
  2033: { seollal: '01-31', daeboreum: '02-14', dano: '06-01', chilseok: '08-01', chuseok: '09-08' },
  2034: { seollal: '02-19', daeboreum: '03-05', dano: '06-20', chilseok: '08-20', chuseok: '09-27' },
  2035: { seollal: '02-08', daeboreum: '02-22', dano: '06-10', chilseok: '08-10', chuseok: '09-16' },
  2036: { seollal: '01-28', daeboreum: '02-11', dano: '05-30', chilseok: '08-28', chuseok: '10-04' },
  2037: { seollal: '02-15', daeboreum: '03-01', dano: '06-18', chilseok: '08-17', chuseok: '09-24' },
  2038: { seollal: '02-04', daeboreum: '02-18', dano: '06-07', chilseok: '08-07', chuseok: '09-13' },
  2039: { seollal: '01-24', daeboreum: '02-07', dano: '05-27', chilseok: '08-26', chuseok: '10-02' },
  2040: { seollal: '02-12', daeboreum: '02-26', dano: '06-14', chilseok: '08-14', chuseok: '09-21' },
  2041: { seollal: '02-01', daeboreum: '02-15', dano: '06-03', chilseok: '08-03', chuseok: '09-10' },
  2042: { seollal: '01-22', daeboreum: '02-05', dano: '06-22', chilseok: '08-22', chuseok: '09-28' },
  2043: { seollal: '02-10', daeboreum: '02-24', dano: '06-11', chilseok: '08-11', chuseok: '09-17' },
  2044: { seollal: '01-30', daeboreum: '02-13', dano: '05-31', chilseok: '07-31', chuseok: '10-05' },
  2045: { seollal: '02-17', daeboreum: '03-03', dano: '06-19', chilseok: '08-19', chuseok: '09-25' },
};

/**
 * The festivals, in calendar order. Seollal and Chuseok are the major ones (they take
 * their month's ask from a fixed festival); the rest are peers of the fixed festivals.
 * Japanese names only where Japan keeps the same night: Tsukimi (お月見, 十五夜) is
 * Chuseok's full moon. Seollal isn't kept in Japan as such; Japan moved Tango no Sekku to
 * 5 May (the fixed Children's Day week) and keeps Tanabata on 7 July (the fixed July
 * week), so Dano and Chilseok here are Korea's lunar days, separate weeks from those.
 */
const LUNAR: readonly (Omit<Festival, 'month' | 'day'> & { id: LunarId })[] = [
  { id: 'seollal', en: 'Seollal', ko: '설날', mark: '설', rank: 'major', eve: true },
  { id: 'daeboreum', en: 'Jeongwol Daeboreum', ko: '정월대보름', mark: '望', rank: 'minor' },
  { id: 'dano', en: 'Dano', ko: '단오', mark: '端', rank: 'minor' },
  { id: 'chilseok', en: 'Chilseok', ko: '칠석', mark: '星', rank: 'minor' },
  { id: 'chuseok', en: 'Chuseok · Tsukimi', ko: '추석', ja: 'お月見 · 十五夜', mark: '月', rank: 'major' },
];

/** This year's lunar festivals with their dates, or none outside the table. */
export function lunarFestivalsIn(year: number): Festival[] {
  const dates = DATES[year];
  if (!dates) return [];
  return LUNAR.map((f) => {
    const [month, day] = dates[f.id].split('-').map(Number);
    return { ...f, month, day };
  });
}
