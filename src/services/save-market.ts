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
  /** petals spent in the Market, all time (for missions and seals) */
  spent: number;
}

export const defaultMarket = (): MarketSave => ({ v: 1, owned: [], equip: {}, gardenHidden: [], seen: [], spent: 0 });

/** Merge a stored slice over the defaults so new fields appear after updates. */
export function hydrateMarket(raw: unknown): MarketSave {
  const base = defaultMarket();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<MarketSave>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    ...base,
    ...r,
    owned: list(r.owned),
    gardenHidden: list(r.gardenHidden),
    seen: list(r.seen),
    spent: typeof r.spent === 'number' && r.spent >= 0 ? r.spent : 0,
    equip: { ...base.equip, ...(r.equip && typeof r.equip === 'object' ? r.equip : {}) },
  };
}
