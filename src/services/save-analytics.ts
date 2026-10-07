/**
 * On-device play analytics for the Level Director (never sent anywhere).
 * Pure data + defaults only: no imports from storage.ts (it imports this file).
 * Capped so the save stays small: ~40 recent boards, ~60 active days.
 */

/** One finished or abandoned board, as the player model sees it. */
export interface BoardRecord {
  mode: 'journey' | 'daily' | 'zen' | 'rush';
  /** journey level (0 for other modes) */
  n: number;
  /** Director tier the board was built for (-1 if none) */
  tier: number;
  /** measured board difficulty 0–1 (-1 if unknown) */
  d: number;
  /** mechanic ids on the board */
  mech: string[];
  goal?: string;
  /** play time, ms (pauses excluded) */
  ms: number;
  /** par, seconds */
  par: number;
  pairs: number;
  /** pairs made before the board ended */
  made: number;
  cleared: boolean;
  /** left mid-board ('quit') or restarted ('restart') */
  ended: 'clear' | 'quit' | 'restart';
  stars: number;
  /** ms from start to the first pair */
  firstMs: number;
  /** median ms between pairs */
  gapMs: number;
  /** same-flower taps with no legal path */
  blocked: number;
  /** different-flower taps that moved the selection */
  reselects: number;
  hints: number;
  shuffles: number;
  autoShuffles: number;
  bestCombo: number;
  fever: number;
  /** pairs by bends: [straight, one, two] */
  turns: [number, number, number];
  /** median ms spent finding a pair of each bend count (0 if none) */
  turnMs: [number, number, number];
  /**
   * The first few cells the player tapped, as [rowFraction, colFraction] in 0–1
   * (0,0 = top-left), rounded to 2 decimals. Scan pattern: edges vs centre, top vs bottom.
   */
  firstTaps: [number, number][];
  /** ms from the first tap to the hint, if a hint was used (-1 = no hint) */
  hintAfterMs: number;
  /** local date key and hour when the board started */
  date: string;
  hour: number;
}

export interface MechanicStat {
  /** boards played with it */
  n: number;
  /** rolling performance 0–1 (exponential average of board scores) */
  score: number;
  quits: number;
  /** replays of an already-cleared board that had it (a sign of enjoyment) */
  replays: number;
}

export interface AnalyticsSave {
  v: 1;
  /** skill in board-difficulty units (0–1 scale); see src/director/model.ts */
  rating: number;
  /** rating uncertainty; shrinks with play (Glicko-style) */
  dev: number;
  /** boards counted into the rating */
  boards: number;
  /** most recent first, capped */
  recent: BoardRecord[];
  mech: Record<string, MechanicStat>;
  /**
   * Tier pinned for each Journey level the player has started: char n-1 is a
   * digit 0–4, or '.' if unset. A retry or replay builds the same board.
   */
  tiers: string;
  /** failed attempts at the current uncleared level (relief after repeated struggle) */
  tries: { n: number; count: number };
  /** distinct local dates with play, most recent first, capped */
  days: string[];
  /** app sessions: count and total foreground ms */
  sessions: { count: number; ms: number };
  /** the Director's dev-panel log of the last choice (dev builds only read it) */
  last?: { n: number; tier: number; target: number; d: number; reason: string };
}

export const RECENT_CAP = 40;
export const DAYS_CAP = 60;

export const defaultAnalytics = (): AnalyticsSave => ({
  v: 1,
  rating: 0.35,
  dev: 0.25,
  boards: 0,
  recent: [],
  mech: {},
  tiers: '',
  tries: { n: 0, count: 0 },
  days: [],
  sessions: { count: 0, ms: 0 },
});

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

/** Merge a stored slice over the defaults; drop anything malformed. */
export function hydrateAnalytics(raw: unknown): AnalyticsSave {
  const base = defaultAnalytics();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AnalyticsSave>;
  const mech: Record<string, MechanicStat> = {};
  if (r.mech && typeof r.mech === 'object') {
    for (const [k, v] of Object.entries(r.mech)) {
      if (!v || typeof v !== 'object') continue;
      mech[k] = { n: num(v.n, 0, 0), score: num(v.score, 0.5, 0, 1), quits: num(v.quits, 0, 0), replays: num(v.replays, 0, 0) };
    }
  }
  return {
    ...base,
    rating: num(r.rating, base.rating, 0, 1.5),
    dev: num(r.dev, base.dev, 0.02, 0.5),
    boards: num(r.boards, 0, 0),
    recent: Array.isArray(r.recent) ? r.recent.filter((x) => x && typeof x === 'object').slice(0, RECENT_CAP) : [],
    mech,
    tiers: typeof r.tiers === 'string' ? r.tiers.replace(/[^0-4.]/g, '.') : '',
    tries: r.tries && typeof r.tries === 'object' ? { n: num(r.tries.n, 0, 0), count: num(r.tries.count, 0, 0) } : base.tries,
    days: Array.isArray(r.days) ? r.days.filter((d) => typeof d === 'string').slice(0, DAYS_CAP) : [],
    sessions: r.sessions && typeof r.sessions === 'object' ? { count: num(r.sessions.count, 0, 0), ms: num(r.sessions.ms, 0, 0) } : base.sessions,
    last: r.last && typeof r.last === 'object' ? r.last : undefined,
  };
}
