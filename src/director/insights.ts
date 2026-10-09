/**
 * "Your play style": plain-language insights, a skill trend and per-mechanic mastery,
 * all read on the device from the player model (model.ts, skills.ts, profile.ts).
 * Pure: no DOM, no writes, nothing leaves the phone.
 *
 * A sentence appears only when its evidence clears a confidence floor; with thin
 * evidence the screen says "play a few more boards" instead of guessing. Wording is
 * encouraging: strengths, habits and a "growth edge", never weak, bad or slow.
 *
 * Tempo is read only at high confidence and only as quick hands or few misreads:
 * a record's longest find still includes the opening think time, so "freeze" is
 * never claimed here.
 */
import { type Mechanic } from '../engine/levels';
import { MECHANICS } from '../engine/mechanics';
import { formatTime } from '../engine/session';
import { type AnalyticsSave, type MechanicStat, PATH_SHAPES, type PathShape } from '../services/save-analytics';
import { HABITS, type PlayerHabits, playerHabits } from './profile';
import { skillConfidence } from './skills';

export const INSIGHT = {
  /** confidence (0–1) a habit or rating needs before it is put into words */
  minConf: 0.5,
  /** tempo needs more: it is the noisiest read */
  tempoConf: 0.8,
  /** boards a path shape needs before its rating counts */
  shapeMin: HABITS.shapeMin,
  /** spread (d units) between the best and least shape before either is named */
  shapeSpread: 0.03,
  /** rating above the overall (d units) that makes an "at home" mechanic a named strength */
  mechGap: 0.03,
  /** most sentences shown at once */
  max: 5,
  /** points on the trend line, and the fewest worth drawing */
  trendPoints: 24,
  trendMin: 5,
  /** change (d units) between the first and last third that reads as risen or eased */
  trendMove: 0.02,
};

export const MASTERY = {
  /** confidence for "steady" and for "at home" */
  steadyConf: 0.4,
  homeConf: 0.7,
  /** rating below the overall (d units) that keeps a mechanic at "learning" */
  gap: HABITS.weakGap,
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
const mechName = (id: string): string | null => (id in MECHANICS ? MECHANICS[id as Mechanic].name : null);

function shapeInsights(h: PlayerHabits, a: AnalyticsSave): Insight[] {
  const sure = PATH_SHAPES.flatMap((k) => {
    const s = a.shapes[k];
    return s && s.n >= INSIGHT.shapeMin && skillConfidence(s) >= INSIGHT.minConf ? [{ k, r: s.r }] : [];
  }).sort((x, y) => y.r - x.r);
  const slow = h.slowShapes.find((s) => s.confidence >= INSIGHT.minConf);
  const spread = sure.length >= 2 ? sure[0].r - sure[sure.length - 1].r : 0;
  const edge = slow?.shape ?? (spread >= INSIGHT.shapeSpread ? sure[sure.length - 1].k : undefined);
  const out: Insight[] = [];
  if (spread >= INSIGHT.shapeSpread && sure[0].k !== edge) {
    out.push({ kind: 'strength', key: `shape:${sure[0].k}`, text: `You read ${SHAPE_LABEL[sure[0].k]} fast.` });
  } else if (!edge && sure.length >= 3) {
    out.push({ kind: 'strength', key: 'shape:even', text: 'You read every path shape about equally well.' });
  }
  if (edge) out.push({ kind: 'edge', key: `shape:${edge}`, text: `${cap(SHAPE_LABEL[edge])} are your growth edge.` });
  return out;
}

function mechInsights(h: PlayerHabits, a: AnalyticsSave): Insight[] {
  const out: Insight[] = [];
  const best = Object.entries(a.mech)
    // Named only where its mastery band reads "at home" too, so the two never disagree.
    .filter(([id, st]) => mechName(id) && st.n >= 3 && masteryBand(st, a.rating) === 'home' && st.r >= a.rating + INSIGHT.mechGap)
    .sort(([, x], [, y]) => y.r - x.r)[0];
  if (best) out.push({ kind: 'strength', key: `mech:${best[0]}`, text: `You’re at home with ${mechName(best[0])}.` });
  const edge = h.weakMechanics.find((m) => mechName(m.id) && m.confidence >= INSIGHT.minConf);
  if (edge) out.push({ kind: 'edge', key: `mech:${edge.id}`, text: `Boards with ${mechName(edge.id)} are your growth edge. The Practice room has gentle ones to try.` });
  return out;
}

function habitInsights(h: PlayerHabits): Insight[] {
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
    if (h.tempo.style === 'rush') out.push({ kind: 'habit', key: 'tempo', text: 'You play with quick hands. A breath before the second tap saves a misread.' });
    if (h.tempo.style === 'balanced') out.push({ kind: 'habit', key: 'tempo', text: 'You read before you tap, with few misreads.' });
  }
  if (h.assists.confidence >= INSIGHT.minConf) {
    out.push({
      kind: 'habit',
      key: 'assists',
      text: h.assists.habitual >= 1 ? 'A hint now and then is part of your rhythm, and you still clear quickly.' : 'Your quick clears mostly come without a hint.',
    });
  }
  return out;
}

/**
 * The sentences these habits and ratings support: strengths first, then habits, then
 * growth edges; at most `INSIGHT.max`, keeping strengths and edges over habits.
 */
export function insightsFrom(h: PlayerHabits, a: AnalyticsSave): Insight[] {
  const shaped = [...shapeInsights(h, a), ...mechInsights(h, a)];
  const strengths = shaped.filter((i) => i.kind === 'strength');
  const edges = shaped.filter((i) => i.kind === 'edge');
  const habits = habitInsights(h).slice(0, Math.max(0, INSIGHT.max - strengths.length - edges.length));
  return [...strengths, ...habits, ...edges].slice(0, INSIGHT.max);
}

export const playInsights = (a: AnalyticsSave): Insight[] => insightsFrom(playerHabits(a), a);

// ───────────────────────────── Mastery ─────────────────────────────

export type MasteryBand = 'new' | 'learning' | 'steady' | 'home';

/** A calm band from a mechanic's rating against the overall one, and how sure it is. */
export function masteryBand(st: MechanicStat | undefined, overall: number): MasteryBand {
  if (!st || st.n === 0) return 'new';
  const conf = skillConfidence(st);
  const gap = st.r - overall;
  if (conf < MASTERY.steadyConf || gap < -MASTERY.gap) return 'learning';
  if (conf >= MASTERY.homeConf && gap >= 0) return 'home';
  return 'steady';
}

// ───────────────────────────── Trend ─────────────────────────────

/** The rating trail, finite only, averaged down to at most `points` (empty if too short to draw). */
export function trendSeries(a: AnalyticsSave, points = INSIGHT.trendPoints): number[] {
  const xs = (Array.isArray(a.trail) ? a.trail : []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (xs.length < INSIGHT.trendMin) return [];
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

/** One calm sentence on the line's direction (also its text alternative). */
export function trendSummary(series: readonly number[], boards: number): string {
  const third = Math.max(1, Math.floor(series.length / 3));
  const mean = (xs: readonly number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const move = mean(series.slice(-third)) - mean(series.slice(0, third));
  const over = `over your last ${boards} boards`;
  if (move >= INSIGHT.trendMove) return `Your skill line has risen ${over}.`;
  if (move <= -INSIGHT.trendMove) return `Your skill line has eased a little ${over}. It often lifts again after a few calm boards.`;
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
  const insights = empty ? [] : playInsights(a);
  const trend = trendSeries(a);
  return {
    empty,
    insights,
    note: insights.length ? null : 'Play a few more boards and your play style will come into focus here.',
    trend,
    trendText: trend.length ? trendSummary(trend, a.trail.length) : '',
    mastery: met.map((id) => ({ id, name: MECHANICS[id].name, glyph: MECHANICS[id].glyph, band: masteryBand(a.mech[id], a.rating) })),
  };
}
