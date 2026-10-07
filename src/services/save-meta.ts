/**
 * Long-term progression: Flower Path rank, missions, streak freezes, foil cards (owned by the progression feature).
 * Pure data + defaults only: no imports from storage.ts (it imports this file).
 */

export interface MetaSave {
  /** schema version for this slice */
  v: 1;
}

export const defaultMeta = (): MetaSave => ({ v: 1 });

/** Merge a stored slice over the defaults so new fields appear after updates. */
export function hydrateMeta(raw: unknown): MetaSave {
  const base = defaultMeta();
  if (!raw || typeof raw !== 'object') return base;
  return { ...base, ...(raw as Partial<MetaSave>) };
}
