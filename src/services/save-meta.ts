/**
 * Long-term progression: Flower Path rank, missions, streak freezes, foil cards (owned by the progression feature).
 * Pure data + defaults only: no imports from storage.ts (it imports this file).
 */

/** One of today's three missions. */
export interface MissionState {
  /** template id from MISSIONS in src/data/meta.ts */
  id: string;
  /** progress toward the target (a running total, or a best for single-run missions) */
  n: number;
  done: boolean;
  claimed: boolean;
  /** the free daily reroll has been used on this slot */
  rerolled: boolean;
}

export interface MetaSave {
  /** schema version for this slice */
  v: 1;
  /** lifetime Flower Path XP */
  xp: number;
  /** highest rank whose reward has been claimed (rank 1 has none) */
  claimed: number;
  /** today's missions; regenerated when `date` is not today */
  missions: { date: string | null; list: MissionState[] };
  /** weekly chest: Monday date key, missions completed this week, opened? */
  week: { key: string | null; count: number; claimed: boolean };
  /** opened star chests, `${chapter}-${12|24|36}` (chapter is 0-based) */
  chests: string[];
  /** card ids that have their gold-leaf (foil) edition */
  foil: number[];
  /** bonus (lucky) card ids collected by pairing them: 48, 49 */
  bonus: number[];
  /** owns the Supporter pack (its one-time gifts were granted) */
  supporter: boolean;
  /** consumable purchase tokens already credited (so a retry never double-grants) */
  iapTokens: string[];
  /** Warm tea cups used to keep the streak, waiting to be announced once */
  teaNotice: number;
  stats: {
    /** daily missions completed */
    missions: number;
    /** weekly chests opened */
    weeks: number;
    /** 36-blossom chests opened */
    fullChests: number;
    /** Warm tea cups used */
    teaUsed: number;
  };
}

export const defaultMeta = (): MetaSave => ({
  v: 1,
  xp: 0,
  claimed: 1,
  missions: { date: null, list: [] },
  week: { key: null, count: 0, claimed: false },
  chests: [],
  foil: [],
  bonus: [],
  supporter: false,
  iapTokens: [],
  teaNotice: 0,
  stats: { missions: 0, weeks: 0, fullChests: 0, teaUsed: 0 },
});

/** Merge a stored slice over the defaults so new fields appear after updates. */
export function hydrateMeta(raw: unknown): MetaSave {
  const base = defaultMeta();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<MetaSave>;
  const arr = <T>(v: T[] | undefined, d: T[]) => (Array.isArray(v) ? v : d);
  return {
    ...base,
    ...r,
    missions: { ...base.missions, ...(r.missions ?? {}), list: arr(r.missions?.list, []) },
    week: { ...base.week, ...(r.week ?? {}) },
    chests: arr(r.chests, base.chests),
    foil: arr(r.foil, base.foil),
    bonus: arr(r.bonus, base.bonus),
    iapTokens: arr(r.iapTokens, base.iapTokens),
    stats: { ...base.stats, ...(r.stats ?? {}) },
  };
}
