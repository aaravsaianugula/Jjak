/**
 * Journey route: passport stamps, chapter chests, mechanic intros (owned by the Journey feature).
 * Pure data + defaults only: no imports from storage.ts (it imports this file).
 */

export interface JourneySave {
  /** schema version for this slice */
  v: 1;
  /**
   * Passport stamps: route chapter id (see src/data/route.ts) → local date key
   * ('YYYY-MM-DD') of the first clear of that place's 12th level.
   */
  stamps: Record<string, string>;
  /** lucky bonus pairs (cards 48/49) made on cleared boards, lifetime */
  luckyPairs: number;
  /** petals earned from lucky pairs, lifetime */
  luckyPetals: number;
  /**
   * Past level 600 (the endless road): stamps per place and year, keyed
   * `${chapterId}@${year}` (year ≥ 1), date of the festival clear.
   */
  yearStamps: Record<string, string>;
  /** the "road goes on" moment after level 600 has been shown */
  revealed: boolean;
}

export const defaultJourney = (): JourneySave => ({ v: 1, stamps: {}, luckyPairs: 0, luckyPetals: 0, yearStamps: {}, revealed: false });

/** Merge a stored slice over the defaults so new fields appear after updates. */
export function hydrateJourney(raw: unknown): JourneySave {
  const base = defaultJourney();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<JourneySave>;
  const dates = (o: unknown) => {
    const out: Record<string, string> = {};
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (typeof v === 'string') out[k] = v;
    return out;
  };
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    ...base,
    ...r,
    stamps: dates(r.stamps),
    yearStamps: dates(r.yearStamps),
    revealed: r.revealed === true,
    luckyPairs: num(r.luckyPairs),
    luckyPetals: num(r.luckyPetals),
  };
}
