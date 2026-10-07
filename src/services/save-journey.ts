/**
 * Journey route: passport stamps, chapter chests, mechanic intros (owned by the Journey feature).
 * Pure data + defaults only: no imports from storage.ts (it imports this file).
 */

export interface JourneySave {
  /** schema version for this slice */
  v: 1;
}

export const defaultJourney = (): JourneySave => ({ v: 1 });

/** Merge a stored slice over the defaults so new fields appear after updates. */
export function hydrateJourney(raw: unknown): JourneySave {
  const base = defaultJourney();
  if (!raw || typeof raw !== 'object') return base;
  return { ...base, ...(raw as Partial<JourneySave>) };
}
