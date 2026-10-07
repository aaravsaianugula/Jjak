/**
 * Garden: visitors, layout choices (owned by the Garden feature).
 * Pure data + defaults only: no imports from storage.ts (it imports this file).
 * Which pieces are owned or put away lives in `save.market` (owned, gardenHidden).
 */

export interface GardenSave {
  /** schema version for this slice */
  v: 1;
  /** local date key (YYYY-MM-DD) of the last daily-visitor gift claimed */
  giftDay: string | null;
  /** visitor ids the player has met at least once */
  met: string[];
  /** total visitor gifts claimed (lifetime) */
  gifts: number;
  /** garden pieces already welcomed into the scene (new ones get a soft hello) */
  seen: string[];
}

export const defaultGarden = (): GardenSave => ({ v: 1, giftDay: null, met: [], gifts: 0, seen: [] });

/** Merge a stored slice over the defaults so new fields appear after updates. */
export function hydrateGarden(raw: unknown): GardenSave {
  const base = defaultGarden();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<GardenSave>;
  return {
    ...base,
    ...r,
    giftDay: typeof r.giftDay === 'string' ? r.giftDay : null,
    met: Array.isArray(r.met) ? r.met.filter((x) => typeof x === 'string') : [],
    gifts: typeof r.gifts === 'number' ? r.gifts : 0,
    seen: Array.isArray(r.seen) ? r.seen.filter((x) => typeof x === 'string') : [],
  };
}
