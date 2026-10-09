/**
 * On-device play telemetry for the Level Director. Nothing here is ever sent anywhere:
 * it builds one `BoardRecord` per board from the game's event bus and folds it into
 * `save.analytics` (the player model in src/director/model.ts).
 *
 * Importing this module once (main.ts does) starts tracking; `trackSessions()` (called
 * after the save has loaded) counts app sessions and foreground time from the page's
 * visibility, without the game screen knowing about any of it.
 *
 * Timing: every time is "board time", `now − session.startedAt`. The game screen
 * shifts `startedAt` forward when it pauses, so pauses are excluded for free.
 * Rush boards are not recorded (only the day counts as a day with play).
 */
import { recordAttempt } from '../director/director';
import { ingest, median, noteDay, specD } from '../director/model';
import { shapeOfPath } from '../director/skills';
import { localDateKey } from '../engine/levels';
import { mechanicsOf } from '../engine/mechanics';
import type { Session, TapResult } from '../engine/session';
import { on } from './events';
import type { BoardRecord } from './save-analytics';
import { flush, persist, save } from './storage';

/** First taps kept for the scan pattern. */
export const FIRST_TAPS = 3;
/** A quit's time is capped at this long after the last tap (the pause menu may have sat open). */
const IDLE_TAIL_MS = 30_000;
/** A blocked tap this soon after selecting the first card is a fast misread. */
export const QUICK_MISS_MS = 1000;

interface Live {
  session: Session;
  /** an already-cleared Journey level, played again */
  replay: boolean;
  date: string;
  hour: number;
  taps: [number, number][];
  /** board time of the first tap (-1 = none yet) */
  firstTapAt: number;
  /** board time of each pair, its bends and its path shape */
  pairs: { t: number; turns: number; detour: boolean; edge: boolean }[];
  /** board time of the current selection (-1 = none) */
  selectAt: number;
  /** blocked taps within QUICK_MISS_MS of the selection */
  quickMisses: number;
  hintAfterMs: number;
  /** board time of the last tap */
  lastAt: number;
}

let live: Live | null = null;

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const boardTime = (s: Session, now: number) => Math.max(0, now - s.startedAt);
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Tap results that show where the player was looking. */
const LOOKS = new Set<TapResult['kind']>(['select', 'reselect', 'match', 'mismatch', 'hidden', 'knotted']);

/** A cell as [rowFraction, colFraction], 0–1 (0,0 = top-left). */
export function cellFraction(rows: number, cols: number, cell: number): [number, number] {
  const r = Math.floor(cell / cols);
  const c = cell % cols;
  return [round2(rows > 1 ? r / (rows - 1) : 0.5), round2(cols > 1 ? c / (cols - 1) : 0.5)];
}

/** The board currently being tracked (tests and the dev panel). */
export const tracking = () => live?.session ?? null;

/**
 * Build the record for the tracked board (pure apart from reading `live`).
 * `now` is the performance clock at the moment the board ended.
 */
function buildRecord(l: Live, ended: BoardRecord['ended'], stars: number, now: number): BoardRecord {
  const s = l.session;
  const spec = s.spec;
  const ms = ended === 'clear' && s.done ? s.elapsedMs(s.finishedAt) : Math.min(boardTime(s, now), l.lastAt + IDLE_TAIL_MS);
  // Time spent finding each pair: from the previous pair (or the start) to this one.
  const finds = l.pairs.map((p, i) => ({ ms: p.t - (i ? l.pairs[i - 1].t : 0), turns: p.turns }));
  const turnMs: [number, number, number] = [0, 1, 2].map((k) =>
    Math.round(median(finds.filter((f) => f.turns === k).map((f) => f.ms))),
  ) as [number, number, number];
  const route = (pick: (i: number) => boolean): [number, number] => {
    const ms = finds.filter((_, i) => pick(i)).map((f) => f.ms);
    return [ms.length, Math.round(median(ms))];
  };
  // Pair rhythm: how uneven the gaps between pairs are (std / mean), with enough of them.
  const gaps = finds.slice(1).map((f) => f.ms);
  const mean = gaps.length ? gaps.reduce((x, y) => x + y, 0) / gaps.length : 0;
  const gapCv = gaps.length >= 3 && mean > 0 ? Math.sqrt(gaps.reduce((x, g) => x + (g - mean) ** 2, 0) / gaps.length) / mean : -1;
  return {
    mode: spec.mode,
    n: spec.mode === 'journey' ? spec.number : 0,
    tier: spec.tier ?? -1,
    d: Math.round(specD(spec) * 1000) / 1000,
    mech: mechanicsOf(spec),
    ...(spec.goal ? { goal: spec.goal } : {}),
    ms: Math.round(ms),
    par: spec.par,
    pairs: s.totalPairs,
    made: s.pairsMade,
    cleared: ended === 'clear',
    ended,
    stars,
    firstMs: l.pairs.length ? Math.round(l.pairs[0].t) : -1,
    gapMs: Math.round(median(finds.slice(1).map((f) => f.ms))),
    blocked: s.blockedTaps,
    reselects: s.reselects,
    hints: s.hintsUsed,
    shuffles: s.shufflesUsed,
    // Wind's own reshuffles are the board's doing, not the player's (as for the no-assist blossom).
    autoShuffles: Math.max(0, s.autoShuffles - s.windShuffles),
    bestCombo: s.bestCombo,
    fever: s.feverCount,
    turns: [s.turns[0], s.turns[1], s.turns[2]],
    turnMs,
    firstTaps: l.taps,
    hintAfterMs: l.hintAfterMs,
    date: l.date,
    hour: l.hour,
    detour: route((i) => l.pairs[i].detour),
    edgeRoute: route((i) => l.pairs[i].edge),
    gapCv: Math.round(gapCv * 100) / 100,
    longMs: Math.round(finds.reduce((m, f) => Math.max(m, f.ms), 0)),
    quickMisses: l.quickMisses,
  };
}

function finish(session: Session, ended: BoardRecord['ended'], stars: number): void {
  const l = live;
  if (!l || l.session !== session) return;
  live = null;
  const a = save.analytics;
  const rec = buildRecord(l, ended, stars, clock());
  ingest(a, rec, { replay: l.replay });
  if (rec.mode === 'journey') recordAttempt(a, rec.n, ended, l.replay);
  persist();
}

on('start', ({ session }) => {
  const now = new Date();
  const date = localDateKey(now);
  if (session.spec.mode === 'rush') {
    live = null;
    noteDay(save.analytics, date);
    persist();
    return;
  }
  const spec = session.spec;
  live = {
    session,
    replay: spec.mode === 'journey' && (save.stars[spec.number] ?? 0) > 0,
    date,
    hour: now.getHours(),
    taps: [],
    firstTapAt: -1,
    pairs: [],
    selectAt: -1,
    quickMisses: 0,
    hintAfterMs: -1,
    lastAt: 0,
  };
});

on('tap', ({ session, cell, result, now }) => {
  const l = live;
  if (!l || l.session !== session || !LOOKS.has(result.kind)) return;
  const t = boardTime(session, now);
  if (l.firstTapAt < 0) l.firstTapAt = t;
  l.lastAt = t;
  if (l.taps.length < FIRST_TAPS) l.taps.push(cellFraction(session.board.rows, session.board.cols, cell));
  if (result.kind === 'select' || result.kind === 'reselect') l.selectAt = t;
  else if (result.kind === 'mismatch') {
    if (result.reason === 'path' && l.selectAt >= 0 && t - l.selectAt < QUICK_MISS_MS) l.quickMisses++;
    l.selectAt = -1;
  } else if (result.kind === 'match') {
    const shape = shapeOfPath(result.path, session.board.rows, session.board.cols);
    l.pairs.push({ t, turns: result.turns, detour: shape.detour, edge: shape.edge });
    l.selectAt = -1;
  }
});

on('tool', ({ kind }) => {
  const l = live;
  if (!l || kind !== 'hint' || l.hintAfterMs >= 0) return;
  l.hintAfterMs = Math.round(Math.max(0, boardTime(l.session, clock()) - Math.max(0, l.firstTapAt)));
});

on('clear', ({ session, summary }) => finish(session, 'clear', summary.stars));
on('leave', ({ session, reason }) => finish(session, reason, 0));

// ───────────────────────────── App sessions ─────────────────────────────

/** Coming back after this long away starts a new app session. */
export const SESSION_GAP_MS = 10 * 60_000;
/** One foreground stretch never counts for more than this (a device left on). */
const MAX_SPAN_MS = 4 * 3_600_000;

let sessionsOn = false;

/**
 * Count app sessions and foreground time (call once, after the save has loaded).
 * A session starts at launch and whenever the app returns after SESSION_GAP_MS away.
 */
export function trackSessions(): void {
  if (sessionsOn || typeof document === 'undefined') return;
  sessionsOn = true;
  let visibleSince = document.hidden ? -1 : Date.now();
  let hiddenAt = document.hidden ? Date.now() : -1;
  save.analytics.sessions.count++;
  persist();
  const away = () => {
    if (visibleSince < 0) return;
    save.analytics.sessions.ms += Math.min(MAX_SPAN_MS, Math.max(0, Date.now() - visibleSince));
    visibleSince = -1;
    hiddenAt = Date.now();
    void flush();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      away();
      return;
    }
    const t = Date.now();
    if (hiddenAt >= 0 && t - hiddenAt >= SESSION_GAP_MS) save.analytics.sessions.count++;
    visibleSince = t;
    hiddenAt = -1;
    persist();
  });
  window.addEventListener('pagehide', away);
}
