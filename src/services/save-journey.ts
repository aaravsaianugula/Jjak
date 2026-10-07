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
}

export const defaultJourney = (): JourneySave => ({ v: 1, stamps: {}, luckyPairs: 0, luckyPetals: 0 });

/** Merge a stored slice over the defaults so new fields appear after updates. */
export function hydrateJourney(raw: unknown): JourneySave {
  const base = defaultJourney();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<JourneySave>;
  const stamps: Record<string, string> = {};
  if (r.stamps && typeof r.stamps === 'object') {
    for (const [k, v] of Object.entries(r.stamps)) if (typeof v === 'string') stamps[k] = v;
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return { ...base, ...r, stamps, luckyPairs: num(r.luckyPairs), luckyPetals: num(r.luckyPetals) };
}
