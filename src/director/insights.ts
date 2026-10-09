/**
 * "Your play style": plain-language insights, a skill trend and per-mechanic mastery,
 * all read on the device from the player model (model.ts, skills.ts, profile.ts).
 * Pure: no DOM, no writes, nothing leaves the phone.
 *
 * A sentence appears only when its evidence clears a confidence floor; with thin
 * evidence the screen says "play a few more boards" instead of guessing. Wording is
 * encouraging: strengths, habits and a "growth edge", never weak, bad or slow.
 *
 * Comparisons (one path shape over another, a mechanic against the overall rating)
 * are named only when the gap clears z times the two ratings' combined deviation,
 * σ = √(dev_a² + dev_b²), at a higher confidence floor; tests/insights-null.test.ts
 * holds false claims under 5 % for players whose skill is the same everywhere.
 *
 * Tempo is read only at high confidence and only as a misread rate: a record's
 * longest find still includes the opening think time, so "freeze" is never claimed.
 */
import { type Mechanic } from '../engine/levels';
import { MECHANICS } from '../engine/mechanics';
import { formatTime } from '../engine/session';
import { type AnalyticsSave, type BoardRecord, type MechanicStat, PATH_SHAPES, type PathShape, type SkillRating } from '../services/save-analytics';
import { parRatio } from './model';
import { HABITS, type PlayerHabits, playerHabits } from './profile';
import { skillConfidence } from './skills';

export const INSIGHT = {
  /** confidence (0–1) a habit needs before it is put into words */
  minConf: 0.5,
  /** confidence a rating needs before it is compared with another */
  compareConf: 0.7,
  /**
   * A named gap must clear z · √(dev_a² + dev_b²): between path shapes, and between a
   * mechanic and the overall rating (which shares its boards, so the combined deviation
   * overstates the noise there; tests/insights-null.test.ts measures both).
   */
  zShape: 1.5,
  zMech: 1,
  /** tempo needs more: it is the noisiest read */
  tempoConf: 0.8,
  /** boards a path shape needs before its rating is compared */
  shapeMin: 6,
  /** "about equally well": every shape on this many boards, at this confidence */
  evenMin: 15,
  evenConf: 0.9,
  /** boards a mechanic needs before it is named */
  mechMin: 5,
  /** a mechanic named as a growth edge was on at least `recentMin` of the last `recentWindow` boards */
  recentWindow: 15,
  recentMin: 2,
  /** quick clears (at or under 1.05 × par) read for the assist habit: window, fewest, and full confidence */
  assistWindow: 20,
  assistMin: 5,
  assistFull: 10,
  /** share of quick clears with a hint or shuffle: "many" at or over, "most come with none" at or under */
  assistMany: 0.5,
  assistFew: 0.2,
  /** most sentences shown at once */
  max: 5,
  /** points on the trend line, and the fewest rated boards worth drawing */
  trendPoints: 24,
  trendDraw: 8,
  /** boards before the line's direction is put into words */
  trendClaim: 12,
  /** the move (d units, first third to last third) that reads as risen or eased: the larger of trendMove and trendZ · dev */
  trendMove: 0.05,
  trendZ: 1.5,
};

export const MASTERY = {
  /** confidence for "steady" and for "at home" */
  steadyConf: 0.4,
  homeConf: 0.7,
  /** "at home" lies within this many combined deviations of the overall rating (or above it) */
  homeWithin: 0.5,
};

export type InsightKind = 'strength' | 'habit' | 'edge';
export interface Insight {
  kind: InsightKind;
  /** stable id: 'shape:twoBend', 'mech:wind', 'scan', 'tempo', 'assists', 'shape:even' */
  key: string;
  text: string;
}

const SHAPE_LABEL: Record<PathShape, string> = {
  straight: 'straight paths',
  oneBend: 'one-bend paths',
  twoBend: 'two-bend routes',
  detour: 'paths that double back',
  edge: 'routes around the outside',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const mechName = (id: string): string | null => (Object.hasOwn(MECHANICS, id) ? MECHANICS[id as Mechanic].name : null);
/** the combined deviation of two ratings */
const sigma = (x: number, y: number) => Math.sqrt(x * x + y * y);
/** x is clearly above y: by at least z combined deviations */
const clearlyAbove = (x: Pick<SkillRating, 'r' | 'dev'>, y: Pick<SkillRating, 'r' | 'dev'>, z: number) => x.r - y.r >= z * sigma(x.dev, y.dev);

function shapeInsights(h: PlayerHabits, a: AnalyticsSave): Insight[] {
  const sure = PATH_SHAPES.flatMap((k) => {
    const s = a.shapes[k];
    return s && s.n >= INSIGHT.shapeMin && skillConfidence(s) >= INSIGHT.compareConf ? [{ k, ...s }] : [];
  }).sort((x, y) => y.r - x.r);
  const out: Insight[] = [];
  // Long finds at any confidence rule a shape out of "fast" and out of "equally well".
  const longFinds = new Set(h.slowShapes.map((s) => s.shape));
  const top = sure[0];
  // The edge needs both signals: long finds (read with confidence) and a rating clearly below the best shape's.
  const edge = top && h.slowShapes.find((s) => s.confidence >= INSIGHT.compareConf && sure.some((x) => x.k === s.shape && clearlyAbove(top, x, INSIGHT.zShape)))?.shape;
  const low = sure[sure.length - 1];
  // A strength stands out from the typical shape (the others' median), not merely from the edge:
  // among shapes read equally well, which one sits on top is noise.
  const typical = sure[1 + Math.floor((sure.length - 2) / 2)];
  if (top && sure.length >= 2 && clearlyAbove(top, typical, INSIGHT.zShape) && !longFinds.has(top.k) && top.k !== edge) {
    out.push({ kind: 'strength', key: `shape:${top.k}`, text: `You read ${SHAPE_LABEL[top.k]} fast.` });
  } else if (
    !edge &&
    !longFinds.size &&
    PATH_SHAPES.every((k) => {
      const s = a.shapes[k];
      return s && s.n >= INSIGHT.evenMin && skillConfidence(s) >= INSIGHT.evenConf;
    }) &&
    // "well inside": the whole spread under one combined deviation
    top.r - low.r < sigma(top.dev, low.dev)
  ) {
    out.push({ kind: 'strength', key: 'shape:even', text: 'You read every path shape about equally well.' });
  }
  if (edge) out.push({ kind: 'edge', key: `shape:${edge}`, text: `${cap(SHAPE_LABEL[edge])} are your growth edge.` });
  return out;
}

/** boards among the most recent `recentWindow` (Rush aside) that featured this mechanic */
const recentBoardsWith = (a: AnalyticsSave, id: string) =>
  a.recent.filter((r) => r.mode !== 'rush').slice(0, INSIGHT.recentWindow).filter((r) => r.mech.includes(id)).length;

function mechInsights(a: AnalyticsSave, met: readonly Mechanic[]): Insight[] {
  const overall = { r: a.rating, dev: a.dev };
  const sure = met.flatMap((id) => {
    const st = Object.hasOwn(a.mech, id) ? a.mech[id] : undefined;
    return mechName(id) && st && st.n >= INSIGHT.mechMin && skillConfidence(st) >= INSIGHT.compareConf ? [{ id, st }] : [];
  });
  const out: Insight[] = [];
  // Named only where its mastery band reads "at home" too, so the two never disagree.
  const best = sure
    .filter(({ st }) => clearlyAbove(st, overall, INSIGHT.zMech) && masteryBand(st, a.rating, a.dev) === 'home')
    .sort((x, y) => y.st.r - x.st.r)[0];
  if (best) out.push({ kind: 'strength', key: `mech:${best.id}`, text: `You’re at home with ${mechName(best.id)}.` });
  // A growth edge is current: played lately, so a rating frozen since early boards can't be one.
  const edge = sure
    .filter(({ id, st }) => clearlyAbove(overall, st, INSIGHT.zMech) && recentBoardsWith(a, id) >= INSIGHT.recentMin)
    .sort((x, y) => x.st.r - y.st.r)[0];
  if (edge) out.push({ kind: 'edge', key: `mech:${edge.id}`, text: `Boards with ${mechName(edge.id)} are your growth edge. The Practice room has gentle ones to try.` });
  return out;
}

/** quick clears (at or under 1.05 × par) in the assist window, most recent first */
const quickClears = (a: AnalyticsSave): BoardRecord[] =>
  a.recent.filter((r) => r.mode !== 'rush' && r.cleared && parRatio(r) <= 1.05).slice(0, INSIGHT.assistWindow);

function habitInsights(h: PlayerHabits, a: AnalyticsSave): Insight[] {
  const out: Insight[] = [];
  if (h.scan.confidence >= INSIGHT.minConf) {
    const start = h.scan.start === 'edges' ? 'at the edges' : h.scan.start === 'centre' ? 'in the middle' : null;
    const vert = h.scan.vertical === 'top' ? 'near the top' : h.scan.vertical === 'bottom' ? 'near the bottom' : null;
    const text = start && vert ? `You begin ${start} of the board, mostly ${vert}.`
      : start ? `You begin ${start} of the board.`
      : vert ? `Your eye starts ${vert} of the board.`
      : null;
    if (text) out.push({ kind: 'habit', key: 'scan', text });
  }
  if (h.tempo.confidence >= INSIGHT.tempoConf) {
    // Misreads per pair (quick misses + half the other blocked taps) under 0.2 means
    // blocked taps under 0.4 per pair, so most pairs had none.
    if (h.tempo.misreadRate >= HABITS.rushRate) out.push({ kind: 'habit', key: 'tempo', text: 'You play with quick hands. A breath before the second tap saves a misread.' });
    else out.push({ kind: 'habit', key: 'tempo', text: 'Most of your pairs come without a misread.' });
  }
  const quick = quickClears(a);
  if (quick.length >= INSIGHT.assistMin && Math.min(1, quick.length / INSIGHT.assistFull) >= INSIGHT.minConf) {
    const share = quick.filter((r) => r.hints + r.shuffles > 0).length / quick.length;
    if (share >= INSIGHT.assistMany) out.push({ kind: 'habit', key: 'assists', text: 'You take a hint or shuffle on many of your quick clears.' });
    else if (share <= INSIGHT.assistFew) out.push({ kind: 'habit', key: 'assists', text: 'Most of your quick clears come with no hint or shuffle.' });
  }
  return out;
}

/**
 * The sentences these habits and ratings support, naming only mechanics in `met`:
 * strengths first, then habits, then growth edges; at most `INSIGHT.max`, keeping
 * strengths and edges over habits.
 */
export function insightsFrom(h: PlayerHabits, a: AnalyticsSave, met: readonly Mechanic[]): Insight[] {
  const shaped = [...shapeInsights(h, a), ...mechInsights(a, met)];
  const strengths = shaped.filter((i) => i.kind === 'strength');
  const edges = shaped.filter((i) => i.kind === 'edge');
  const habits = habitInsights(h, a).slice(0, Math.max(0, INSIGHT.max - strengths.length - edges.length));
  return [...strengths, ...habits, ...edges].slice(0, INSIGHT.max);
}

export const playInsights = (a: AnalyticsSave, met: readonly Mechanic[]): Insight[] => insightsFrom(playerHabits(a), a, met);

// ───────────────────────────── Mastery ─────────────────────────────

export type MasteryBand = 'new' | 'learning' | 'steady' | 'home';

/**
 * A calm band from a mechanic's rating against the overall one (with its deviation),
 * and how sure it is: "learning" while unsure or clearly behind (`zMech` combined
 * deviations), "at home" when sure and within `homeWithin` of them, "steady" between.
 */
export function masteryBand(st: MechanicStat | undefined, overall: number, overallDev: number): MasteryBand {
  if (!st || st.n === 0) return 'new';
  const conf = skillConfidence(st);
  const behind = overall - st.r;
  const sd = sigma(st.dev, overallDev);
  if (conf < MASTERY.steadyConf || behind >= INSIGHT.zMech * sd) return 'learning';
  if (conf >= MASTERY.homeConf && behind < MASTERY.homeWithin * sd) return 'home';
  return 'steady';
}

// ───────────────────────────── Trend ─────────────────────────────

/** The rating trail, finite only, averaged down to at most `points` (empty if too short to draw). */
export function trendSeries(a: AnalyticsSave, points = INSIGHT.trendPoints): number[] {
  const xs = (Array.isArray(a.trail) ? a.trail : []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (xs.length < INSIGHT.trendDraw) return [];
  if (xs.length <= points) return xs;
  return Array.from({ length: points }, (_, i) => {
    const part = xs.slice(Math.floor((i * xs.length) / points), Math.floor(((i + 1) * xs.length) / points));
    return part.reduce((s, v) => s + v, 0) / part.length;
  });
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * An SVG path through the series inside a w × h box with `pad` inset. The vertical
 * scale spans at least 0.1 rating units, so small wobbles stay small.
 */
export function trendLine(series: readonly number[], w: number, h: number, pad: number): string {
  if (series.length < 2) return '';
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const span = Math.max(hi - lo, 0.1);
  const mid = (lo + hi) / 2;
  const x = (i: number) => pad + ((w - 2 * pad) * i) / (series.length - 1);
  const y = (v: number) => h / 2 - ((v - mid) / span) * (h - 2 * pad);
  return series.map((v, i) => `${i ? 'L' : 'M'}${r1(x(i))} ${r1(y(v))}`).join(' ');
}

/**
 * One calm sentence on the line (also its text alternative). A direction is named only
 * after `trendClaim` boards and a move past the noise: the larger of `trendMove` and
 * `trendZ` times the rating's current deviation.
 */
export function trendSummary(series: readonly number[], boards: number, dev: number): string {
  const over = `over your last ${boards} boards`;
  if (boards < INSIGHT.trendClaim) return `Your skill line ${over}.`;
  const third = Math.max(1, Math.floor(series.length / 3));
  const mean = (xs: readonly number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const move = mean(series.slice(-third)) - mean(series.slice(0, third));
  const noise = Math.max(INSIGHT.trendMove, INSIGHT.trendZ * dev);
  if (move >= noise) return `Your skill line has risen ${over}.`;
  if (move <= -noise) return `Your skill line has eased a little ${over}.`;
  return `Your skill line has held steady ${over}.`;
}

// ───────────────────────────── Best runs ─────────────────────────────

export interface BestRun {
  key: 'combo' | 'daily' | 'streak' | 'clean' | 'par' | 'rush';
  label: string;
  value: string;
  sub: string;
}
export interface RecordsIn {
  stats: { bestCombo: number; cleanClears: number; fastClears: number; bestDailyMs: number };
  daily: { best: number };
  rush: { best: number };
}

const plural = (n: number, one: string) => `${n.toLocaleString('en-US')} ${one}${n === 1 ? '' : 's'}`;

/** The records the save already keeps, only those that have happened. */
export function bestRuns(s: RecordsIn): BestRun[] {
  const out: BestRun[] = [];
  if (s.stats.bestCombo > 0) out.push({ key: 'combo', label: 'Best combo', value: `×${s.stats.bestCombo}`, sub: 'pairs in quick succession' });
  if (s.stats.bestDailyMs > 0) out.push({ key: 'daily', label: 'Fastest Daily', value: formatTime(s.stats.bestDailyMs), sub: 'the board for everyone' });
  if (s.daily.best > 0) out.push({ key: 'streak', label: 'Longest streak', value: plural(s.daily.best, 'day'), sub: 'Dailies in a row' });
  if (s.stats.cleanClears > 0) out.push({ key: 'clean', label: 'Clean reads', value: plural(s.stats.cleanClears, 'board'), sub: 'cleared with no hint or shuffle' });
  if (s.stats.fastClears > 0) out.push({ key: 'par', label: 'Under par', value: plural(s.stats.fastClears, 'board'), sub: 'cleared inside par time' });
  if (s.rush.best > 0) out.push({ key: 'rush', label: 'Best Rush', value: s.rush.best.toLocaleString('en-US'), sub: 'points in one run' });
  return out;
}

// ───────────────────────────── The report ─────────────────────────────

export interface MasteryRow {
  id: Mechanic;
  name: string;
  glyph: string;
  band: MasteryBand;
}
export interface PlayStyleReport {
  /** nothing played into the model yet */
  empty: boolean;
  insights: Insight[];
  /** the gentle "play a few more boards" line when nothing can be said yet */
  note: string | null;
  /** downsampled rating trail (empty when too short to draw) and its sentence */
  trend: number[];
  trendText: string;
  mastery: MasteryRow[];
}

/** Everything the screen shows from the model, for the mechanics this player has met. */
export function playStyleReport(a: AnalyticsSave, met: readonly Mechanic[]): PlayStyleReport {
  const rated = a.recent.filter((r) => r && r.mode !== 'rush').length;
  const empty = a.boards === 0 && rated === 0;
  const insights = empty ? [] : playInsights(a, met);
  const trend = trendSeries(a);
  return {
    empty,
    insights,
    note: insights.length ? null : 'Play a few more boards and your play style will come into focus here.',
    trend,
    trendText: trend.length ? trendSummary(trend, a.trail.length, a.dev) : '',
    mastery: met.map((id) => ({ id, name: MECHANICS[id].name, glyph: MECHANICS[id].glyph, band: masteryBand(Object.hasOwn(a.mech, id) ? a.mech[id] : undefined, a.rating, a.dev) })),
  };
}
