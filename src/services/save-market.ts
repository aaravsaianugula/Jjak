/**
 * Market (reward shop), cosmetics and garden (owned by the Market feature).
 * Pure data + defaults only: no imports from storage.ts (it imports this file).
 */

export type CosmeticSlot = 'deck' | 'back' | 'brush' | 'fx' | 'music';

export interface MarketSave {
  /** schema version for this slice */
  v: 1;
  /** owned item keys, `${category}:${id}`, e.g. 'deck:sumi', 'garden:koi' */
  owned: string[];
  /** equipped cosmetic per slot (missing = the default look) */
  equip: Partial<Record<CosmeticSlot, string>>;
  /** garden items the player owns but has put away */
  gardenHidden: string[];
  /** item keys already seen in the Market (for "new" dots) */
  seen: string[];
}

export const defaultMarket = (): MarketSave => ({ v: 1, owned: [], equip: {}, gardenHidden: [], seen: [] });

/** Merge a stored slice over the defaults so new fields appear after updates. */
export function hydrateMarket(raw: unknown): MarketSave {
  const base = defaultMarket();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<MarketSave>;
  return { ...base, ...r, equip: { ...base.equip, ...(r.equip ?? {}) } };
}
