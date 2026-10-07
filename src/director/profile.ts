/**
 * The play-style profile (EXPANSION_PLAN §C5): how this player reads a board, read
 * from `save.analytics`. The endless road uses it to **tailor, not trap**: place some
 * key pairs where they don't look first, raise the 2-bend share a little at a time if
 * 2-bend pairs slow them, lean towards mechanics they enjoy (the bag still guarantees
 * variety), and match board length to their sessions.
 *
 * Every field has a neutral default, so `playStyle()` is safe on a brand-new save;
 * `confidence` (0–1) says how much there is behind it. Pure: reads, never writes.
 */
import { MECHANIC_IDS } from '../engine/mechanics';
import { type AnalyticsSave, type BoardRecord } from '../services/save-analytics';
import { save } from '../services/storage';
import { assistsOf, engagement, isClean, median, parRatio, proficiency } from './model';

export interface ScanPattern {
  /** share of first taps on the outer ring of the board (0–1; 0.5 with no data) */
  edge: number;
  /** share of first taps in the top half (0–1; 0.5 with no data) */
  top: number;
  /** share of first taps in the left half (0–1; 0.5 with no data) */
  left: number;
  /** where they look first: 'edges' (≥ 0.65 edge), 'centre' (≤ 0.35), else 'mixed' */
  start: 'edges' | 'centre' | 'mixed';
  /** 'top' (≥ 0.65 top), 'bottom' (≤ 0.35), else 'mixed' */
  vertical: 'top' | 'bottom' | 'mixed';
  /** first taps seen */
  samples: number;
}

export interface BendProfile {
  /** median ms to find a pair by bend count [straight, one, two] (0 = no data) */
  ms: [number, number, number];
  /** share of pairs made that took two bends (0–1) */
  twoShare: number;
  /** how much slower 2-bend pairs are than straight ones (ms[2] / ms[0]; 1 with no data) */
  twoBendCost: number;
  /** the bend count that slows them most (null with too little data) */
  slowest: 0 | 1 | 2 | null;
}

export interface SpeedProfile {
  /** median ms between pairs (0 = no data) */
  gapMs: number;
  /** median time to the first pair (ms; 0 = no data) */
  firstMs: number;
  /** median time / par over clears (1 with no data) */
  parRatio: number;
  /** blocked taps per pair (misreads) */
  blockedRate: number;
  /** reselects per pair */
  reselectRate: number;
  /**
   * 'fast-loose': quick but many misreads; 'careful': slower than par but few misreads;
   * 'quick': fast and accurate; 'steady' otherwise (and with no data).
   */
  style: 'fast-loose' | 'careful' | 'quick' | 'steady';
}

export interface MechanicTaste {
  id: string;
  /** boards played with it */
  n: number;
  /** rolling score 0–1 */
  score: number;
  /** score vs their usual, about −0.5…0.5 (negative = a blind spot) */
  proficiency: number;
  /** −1…1: replays and quick retries (+) vs quits (−) per board */
  enjoyment: number;
}

export interface AssistHabit {
  /** hints per board */
  hintRate: number;
  /** player shuffles per board */
  shuffleRate: number;
  /** share of clears with no assist */
  cleanShare: number;
  /** median ms from the first tap to the first hint (-1 = never) */
  firstHintMs: number;
  habit: 'never' | 'sometimes' | 'often';
}

export interface SessionRhythm {
  /** app sessions counted */
  count: number;
  /** mean foreground minutes per session (0 = no data) */
  avgMinutes: number;
  /** 'short' (< 6 min), 'long' (≥ 20 min), else 'medium' */
  length: 'short' | 'medium' | 'long';
  /** most common local hour boards start (-1 = no data) */
  hour: number;
  /** distinct days with play (capped history) */
  days: number;
  /** boards that fit a typical session (median board time vs session length; 3 with no data) */
  boardsPerSession: number;
}

export interface PlayStyle {
  /** boards in the history this was read from */
  boards: number;
  /** 0–1: how much data is behind it (20 boards = full) */
  confidence: number;
  rating: number;
  dev: number;
  scan: ScanPattern;
  bends: BendProfile;
  speed: SpeedProfile;
  /** per mechanic, in library order (only those seen) */
  mechanics: MechanicTaste[];
  /** enjoyed mechanics, best first (enjoyment > 0.15 or replayed) */
  favourites: string[];
  /** mechanics that score clearly below their usual (stretch these gently) */
  blindSpots: string[];
  assists: AssistHabit;
  session: SessionRhythm;
  mood: 'struggling' | 'flow' | 'cruising';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const share = (xs: readonly boolean[], fallback: number) => (xs.length ? xs.filter(Boolean).length / xs.length : fallback);

function scanOf(rs: BoardRecord[]): ScanPattern {
  const taps = rs.flatMap((r) => r.firstTaps ?? []).filter((t) => Array.isArray(t) && t.length === 2);
  const edge = share(taps.map(([r, c]) => r <= 0.01 || r >= 0.99 || c <= 0.01 || c >= 0.99), 0.5);
  const top = share(taps.map(([r]) => r < 0.5), 0.5);
  const left = share(taps.map(([, c]) => c < 0.5), 0.5);
  return {
    edge, top, left, samples: taps.length,
    start: taps.length < 6 ? 'mixed' : edge >= 0.65 ? 'edges' : edge <= 0.35 ? 'centre' : 'mixed',
    vertical: taps.length < 6 ? 'mixed' : top >= 0.65 ? 'top' : top <= 0.35 ? 'bottom' : 'mixed',
  };
}

function bendsOf(rs: BoardRecord[]): BendProfile {
  const ms = [0, 1, 2].map((k) => Math.round(median(rs.map((r) => r.turnMs?.[k] ?? 0).filter((v) => v > 0)))) as [number, number, number];
  const tot = [0, 0, 0];
  for (const r of rs) for (let k = 0; k < 3; k++) tot[k] += r.turns?.[k] ?? 0;
  const all = tot[0] + tot[1] + tot[2];
  const known = ms.filter((v) => v > 0).length;
  const slowest = known >= 2 ? (ms.indexOf(Math.max(...ms)) as 0 | 1 | 2) : null;
  return { ms, twoShare: all ? tot[2] / all : 0, twoBendCost: ms[0] > 0 && ms[2] > 0 ? ms[2] / ms[0] : 1, slowest };
}

function speedOf(rs: BoardRecord[]): SpeedProfile {
  const clears = rs.filter((r) => r.cleared);
  const made = rs.reduce((s, r) => s + r.made, 0);
  const gapMs = Math.round(median(rs.map((r) => r.gapMs).filter((v) => v > 0)));
  const firstMs = Math.round(median(rs.map((r) => r.firstMs).filter((v) => v > 0)));
  const ratio = clears.length ? median(clears.map(parRatio)) : 1;
  const blockedRate = made ? rs.reduce((s, r) => s + r.blocked, 0) / made : 0;
  const reselectRate = made ? rs.reduce((s, r) => s + r.reselects, 0) / made : 0;
  const style: SpeedProfile['style'] = !clears.length
    ? 'steady'
    : ratio < 0.85 && blockedRate >= 0.12 ? 'fast-loose'
    : ratio < 0.85 ? 'quick'
    : ratio > 1.15 && blockedRate < 0.08 ? 'careful'
    : 'steady';
  return { gapMs, firstMs, parRatio: ratio, blockedRate, reselectRate, style };
}

function tastesOf(a: AnalyticsSave, rs: BoardRecord[]): MechanicTaste[] {
  const out: MechanicTaste[] = [];
  const ids = [...MECHANIC_IDS, ...Object.keys(a.mech).filter((k) => !(MECHANIC_IDS as string[]).includes(k))];
  for (const id of ids) {
    const st = a.mech[id];
    if (!st || st.n === 0) continue;
    // Restarts are quick retries ("one more go"): a sign of engagement, unlike a quit.
    const restarts = rs.filter((r) => r.ended === 'restart' && r.mech.includes(id)).length;
    const enjoyment = clamp((st.replays + 0.5 * restarts - st.quits) / Math.max(3, st.n), -1, 1);
    const p = proficiency(a, id);
    out.push({ id, n: st.n, score: st.score, proficiency: p.relative, enjoyment });
  }
  return out;
}

function assistsOfRecords(rs: BoardRecord[]): AssistHabit {
  const hintRate = rs.length ? rs.reduce((s, r) => s + r.hints, 0) / rs.length : 0;
  const shuffleRate = rs.length ? rs.reduce((s, r) => s + r.shuffles, 0) / rs.length : 0;
  const clears = rs.filter((r) => r.cleared);
  const cleanShare = share(clears.map(isClean), 1);
  const firsts = rs.map((r) => r.hintAfterMs).filter((v) => v >= 0);
  const assisted = share(rs.map((r) => assistsOf(r) > 0), 0);
  return {
    hintRate, shuffleRate, cleanShare,
    firstHintMs: firsts.length ? Math.round(median(firsts)) : -1,
    habit: assisted === 0 ? 'never' : assisted >= 0.4 ? 'often' : 'sometimes',
  };
}

function rhythmOf(a: AnalyticsSave, rs: BoardRecord[]): SessionRhythm {
  const { count, ms } = a.sessions;
  const avgMinutes = count ? ms / count / 60_000 : 0;
  const hours = new Array(24).fill(0);
  for (const r of rs) if (r.hour >= 0 && r.hour < 24) hours[r.hour]++;
  const hour = rs.length ? hours.indexOf(Math.max(...hours)) : -1;
  const boardMs = median(rs.map((r) => r.ms).filter((v) => v > 0));
  return {
    count, avgMinutes, hour, days: a.days.length,
    length: !count || !ms ? 'medium' : avgMinutes < 6 ? 'short' : avgMinutes >= 20 ? 'long' : 'medium',
    boardsPerSession: boardMs > 0 && avgMinutes > 0 ? Math.max(1, Math.round((avgMinutes * 60_000) / boardMs)) : 3,
  };
}

/** The player's play style, from the on-device history (defaults with no data). */
export function playStyle(a: AnalyticsSave = save.analytics): PlayStyle {
  const rs = a.recent.filter((r) => r && r.mode !== 'rush');
  const mechanics = tastesOf(a, rs);
  return {
    boards: rs.length,
    confidence: clamp(rs.length / 20, 0, 1),
    rating: a.rating,
    dev: a.dev,
    scan: scanOf(rs),
    bends: bendsOf(rs),
    speed: speedOf(rs),
    mechanics,
    favourites: mechanics
      .filter((m) => m.enjoyment > 0.15)
      .sort((x, y) => y.enjoyment - x.enjoyment)
      .map((m) => m.id),
    blindSpots: mechanics
      .filter((m) => m.n >= 3 && m.proficiency <= -0.08)
      .sort((x, y) => x.proficiency - y.proficiency)
      .map((m) => m.id),
    assists: assistsOfRecords(rs),
    session: rhythmOf(a, rs),
    mood: engagement(a).mood,
  };
}
