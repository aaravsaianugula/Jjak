/**
 * Garden: visitors, layout choices (owned by the Garden feature).
 * Pure data + defaults only: no imports from storage.ts (it imports this file).
 */

export interface GardenSave {
  /** schema version for this slice */
  v: 1;
}

export const defaultGarden = (): GardenSave => ({ v: 1 });

/** Merge a stored slice over the defaults so new fields appear after updates. */
export function hydrateGarden(raw: unknown): GardenSave {
  const base = defaultGarden();
  if (!raw || typeof raw !== 'object') return base;
  return { ...base, ...(raw as Partial<GardenSave>) };
}
