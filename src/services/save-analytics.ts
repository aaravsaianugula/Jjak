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

const MODES: readonly BoardRecord['mode'][] = ['journey', 'daily', 'zen', 'rush'];
const trio = (v: unknown): [number, number, number] =>
  Array.isArray(v) && v.length === 3 ? [num(v[0], 0, 0), num(v[1], 0, 0), num(v[2], 0, 0)] : [0, 0, 0];

/** One stored record with every field coerced to its type, or null if it isn't a record at all. */
export function hydrateRecord(raw: unknown): BoardRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<BoardRecord>;
  if (!MODES.includes(r.mode as BoardRecord['mode'])) return null;
  const cleared = r.cleared === true;
  const ended = cleared ? 'clear' : r.ended === 'restart' ? 'restart' : 'quit';
  return {
    mode: r.mode as BoardRecord['mode'],
    n: num(r.n, 0, 0),
    tier: num(r.tier, -1, -1, 4),
    d: num(r.d, -1, -1, 1),
    mech: Array.isArray(r.mech) ? r.mech.filter((m): m is string => typeof m === 'string') : [],
    ...(typeof r.goal === 'string' ? { goal: r.goal } : {}),
    ms: num(r.ms, 0, 0),
    par: num(r.par, 0, 0),
    pairs: num(r.pairs, 0, 0),
    made: num(r.made, 0, 0),
    cleared,
    ended,
    stars: num(r.stars, 0, 0, 3),
    firstMs: num(r.firstMs, -1, -1),
    gapMs: num(r.gapMs, 0, 0),
    blocked: num(r.blocked, 0, 0),
    reselects: num(r.reselects, 0, 0),
    hints: num(r.hints, 0, 0),
    shuffles: num(r.shuffles, 0, 0),
    autoShuffles: num(r.autoShuffles, 0, 0),
    bestCombo: num(r.bestCombo, 0, 0),
    fever: num(r.fever, 0, 0),
    turns: trio(r.turns),
    turnMs: trio(r.turnMs),
    firstTaps: Array.isArray(r.firstTaps)
      ? r.firstTaps
          .filter((t) => Array.isArray(t) && t.length === 2)
          .slice(0, 3)
          .map((t) => [num(t[0], 0.5, 0, 1), num(t[1], 0.5, 0, 1)] as [number, number])
      : [],
    hintAfterMs: num(r.hintAfterMs, -1, -1),
    date: typeof r.date === 'string' ? r.date : '',
    hour: num(r.hour, -1, -1, 23),
  };
}

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
    recent: Array.isArray(r.recent)
      ? r.recent.map(hydrateRecord).filter((x): x is BoardRecord => x !== null).slice(0, RECENT_CAP)
      : [],
    mech,
    tiers: typeof r.tiers === 'string' ? r.tiers.replace(/[^0-4.]/g, '.') : '',
    tries: r.tries && typeof r.tries === 'object' ? { n: num(r.tries.n, 0, 0), count: num(r.tries.count, 0, 0) } : base.tries,
    days: Array.isArray(r.days) ? r.days.filter((d) => typeof d === 'string').slice(0, DAYS_CAP) : [],
    sessions: r.sessions && typeof r.sessions === 'object' ? { count: num(r.sessions.count, 0, 0), ms: num(r.sessions.ms, 0, 0) } : base.sessions,
    last:
      r.last && typeof r.last === 'object'
        ? {
            n: num(r.last.n, 0, 0),
            tier: num(r.last.tier, 2, 0, 4),
            target: num(r.last.target, 0.5, 0, 1),
            d: num(r.last.d, 0.5, -1, 1),
            reason: typeof r.last.reason === 'string' ? r.last.reason : '',
          }
        : undefined,
  };
}
