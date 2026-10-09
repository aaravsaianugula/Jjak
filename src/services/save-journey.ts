import { GOAL_IDS } from '../engine/goals';

/**
 * Journey route: passport stamps, chapter chests, mechanic intros (owned by the Journey feature).
 * Pure data + defaults only: no imports from storage.ts (it imports this file).
 */
import type { LevelSpec } from '../engine/levels';

/** One generated endless level (past 600): its full spec, seed included, so a retry or a restored save rebuilds the same board. */
export interface EndlessEntry {
  spec: LevelSpec;
  /** the Director's target difficulty it was made for, and its offset from the designed curve */
  target: number;
  offset: number;
  /** relief re-generations after failed attempts (0 = the first board) */
  relief: number;
  /** where it was made: the worker, the main-thread search, the bank's board for the same place (the last resort), or (older saves) the plan's own board */
  src: 'worker' | 'main' | 'plan' | 'bank';
  /** generation order (for the cap) */
  at: number;
}

/** The endless road's per-player state (EXPANSION_PLAN §C5); see src/director/endless.ts. */
export interface EndlessSave {
  /** generated levels by number: the current one, the next, the recent window (capped) */
  levels: Record<string, EndlessEntry>;
  /** partner-mechanic and goal bags, carried from level to level */
  bag: string[];
  goals: string[];
  lastPartners: string[];
  lastGoal: string | null;
  /** tailoring stretch counters (0–8) */
  stretch: { centre: number; twoBend: number };
  /** generation counter */
  seq: number;
}

/** Most endless levels kept in the save (window of 12 + current + next + a couple of replays). */
export const ENDLESS_CAP = 16;

export const defaultEndless = (): EndlessSave => ({ levels: {}, bag: [], goals: [], lastPartners: [], lastGoal: null, stretch: { centre: 0, twoBend: 0 }, seq: 0 });

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
  /** levels past 600, generated for this player */
  endless: EndlessSave;
}

export const defaultJourney = (): JourneySave => ({ v: 1, stamps: {}, luckyPairs: 0, luckyPetals: 0, yearStamps: {}, revealed: false, endless: defaultEndless() });

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
    endless: hydrateEndless(r.endless),
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 32) : []);

/** A stored endless spec, if it is one the game can build (else null: the level is generated again). */
function endlessSpec(raw: unknown, n: number): LevelSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<LevelSpec>;
  const ints = [s.rows, s.cols, s.stones, s.months, s.par, s.snow];
  if (s.mode !== 'journey' || s.number !== n || typeof s.seed !== 'string' || !ints.every(isNum)) return null;
  if (s.rows! < 2 || s.rows! > 8 || s.cols! < 2 || s.cols! > 7 || s.months! < 1 || s.months! > 12) return null;
  const g = s.gravity;
  if (!(typeof g === 'boolean' || g === 'down' || g === 'left' || g === 'right' || g === 'up')) return null;
  for (const k of ['knots', 'gates', 'fences', 'tier', 'difficulty'] as const) if (s[k] != null && !isNum(s[k])) return null;
  // A goal or stone layout from another build (or a damaged save) would break the screens that name it.
  if (s.goal != null && !(GOAL_IDS as string[]).includes(s.goal)) return null;
  if (s.layout != null && !['spread', 'lines', 'clusters'].includes(s.layout)) return null;
  return { ...(s as LevelSpec), variants: s.variants !== false };
}

/** Merge the stored endless slice over the defaults; drop malformed entries and keep the newest ENDLESS_CAP. */
export function hydrateEndless(raw: unknown): EndlessSave {
  const base = defaultEndless();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<EndlessSave>;
  const levels: Record<string, EndlessEntry> = {};
  const kept: [string, EndlessEntry][] = [];
  if (r.levels && typeof r.levels === 'object') {
    for (const [k, v] of Object.entries(r.levels)) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 601 || !v || typeof v !== 'object') continue;
      const e = v as Partial<EndlessEntry>;
      const spec = endlessSpec(e.spec, n);
      if (!spec) continue;
      kept.push([k, {
        spec,
        target: isNum(e.target) ? e.target : spec.difficulty ?? 0.5,
        offset: isNum(e.offset) ? e.offset : 0,
        relief: isNum(e.relief) ? Math.max(0, Math.round(e.relief)) : 0,
        src: e.src === 'main' || e.src === 'plan' || e.src === 'bank' ? e.src : 'worker',
        at: isNum(e.at) ? e.at : 0,
      }]);
    }
  }
  kept.sort((a, b) => b[1].at - a[1].at || Number(b[0]) - Number(a[0]));
  for (const [k, e] of kept.slice(0, ENDLESS_CAP)) levels[k] = e;
  const st = r.stretch && typeof r.stretch === 'object' ? r.stretch : base.stretch;
  const step = (v: unknown) => (isNum(v) ? Math.max(0, Math.min(8, Math.round(v))) : 0);
  return {
    levels,
    bag: strings(r.bag),
    goals: strings(r.goals),
    lastPartners: strings(r.lastPartners),
    lastGoal: typeof r.lastGoal === 'string' ? r.lastGoal : null,
    stretch: { centre: step(st.centre), twoBend: step(st.twoBend) },
    // Never behind an entry it numbered (the cap keeps the newest by it).
    seq: Math.max(0, isNum(r.seq) ? r.seq : 0, ...kept.map(([, e]) => e.at)),
  };
}
