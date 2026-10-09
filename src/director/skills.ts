/**
 * Skill ratings by path shape and by mechanic (EXPANSION_PLAN §C1, player model).
 *
 * Each skill has a Glicko-style rating in board-difficulty units with a deviation:
 * the deviation shrinks with evidence and grows with time away, so `skillConfidence`
 * says how much to trust it. Mechanic ratings read the board's score on boards with
 * that mechanic. Path-shape ratings read the board's score shifted by how long that
 * shape took to find against the player's own pace on the same board:
 *
 *   score(shape) = p − relScale · ln(ms(shape) / typical find)      (clamped 0–1)
 *
 * so a player who takes three times as long on 2-bend paths rates clearly lower on
 * them, while a slow-but-even reader keeps even shape ratings. Pure; no DOM.
 */
import type { Point } from '../engine/board';
import { type BoardRecord, type PathShape, PATH_SHAPES, SKILL_DEV_START, type SkillRating } from '../services/save-analytics';

export { PATH_SHAPES, type PathShape };

export const SKILL = {
  devStart: SKILL_DEV_START,
  devMin: 0.05,
  devMax: 0.3,
  /** dev shrinks by this per full-weight observation */
  devDecay: 0.92,
  k: 0.5,
  maxStep: 0.06,
  /** score lost per e-fold of extra find time */
  relScale: 0.3,
  /** pairs of a shape on one board for a full-weight observation */
  fullPairs: 4,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface PairShape {
  bends: 0 | 1 | 2;
  /** the path wasted steps: longer than the straight-line (Manhattan) distance */
  detour: boolean;
  /** the path ran round the outside of the board */
  edge: boolean;
}

/** Classify a matched pair's path (corner points as `findPath` returns them). */
export function shapeOfPath(path: readonly Point[], rows: number, cols: number): PairShape {
  const a = path[0];
  const b = path[path.length - 1];
  let length = 0;
  let edge = false;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p.r < 0 || p.c < 0 || p.r >= rows || p.c >= cols) edge = true;
    if (i) length += Math.abs(p.r - path[i - 1].r) + Math.abs(p.c - path[i - 1].c);
  }
  const bends = clamp(path.length - 2, 0, 2) as 0 | 1 | 2;
  return { bends, detour: length > Math.abs(a.r - b.r) + Math.abs(a.c - b.c), edge };
}

/** 0–1: how far the deviation has come down from a fresh skill's. */
export const skillConfidence = (s: Pick<SkillRating, 'dev'>) => clamp((SKILL.devStart - s.dev) / (SKILL.devStart - SKILL.devMin), 0, 1);

export const newSkill = (r: number): SkillRating => ({ r, dev: SKILL.devStart, n: 0 });

/** One Elo/Glicko step: `e` is the expected score at the skill's rating on this board. */
export function stepSkill(s: Pick<SkillRating, 'r' | 'dev'>, p: number, e: number, w: number): void {
  if (w <= 0) return;
  s.r = clamp(s.r + clamp(SKILL.k * s.dev * w * (p - e), -SKILL.maxStep, SKILL.maxStep), 0, 1.5);
  s.dev = Math.max(SKILL.devMin, s.dev * Math.pow(SKILL.devDecay, w));
}

/** Grow a skill's deviation after `days` away (the same rule as the overall rating). */
export function ageSkill(s: Pick<SkillRating, 'dev'>, idle: number, days: number): void {
  if (days > 0) s.dev = Math.min(SKILL.devMax, Math.sqrt(s.dev * s.dev + idle * idle * days));
}

/** Per-shape evidence on one board: pairs of that shape and the median ms to find one. */
export function shapeEvidence(r: BoardRecord): Partial<Record<PathShape, [number, number]>> {
  const out: Partial<Record<PathShape, [number, number]>> = {};
  const bendKeys: PathShape[] = ['straight', 'oneBend', 'twoBend'];
  bendKeys.forEach((k, i) => {
    if (r.turns[i] > 0 && r.turnMs[i] > 0) out[k] = [r.turns[i], r.turnMs[i]];
  });
  if (r.detour && r.detour[0] > 0 && r.detour[1] > 0) out.detour = r.detour;
  if (r.edgeRoute && r.edgeRoute[0] > 0 && r.edgeRoute[1] > 0) out.edge = r.edgeRoute;
  return out;
}

/**
 * The per-shape scores of one board (score and observation weight), or {} when the
 * board says nothing about pace (no typical find time, or not cleared far enough).
 */
export function shapeScores(r: BoardRecord, p: number): Partial<Record<PathShape, { score: number; weight: number }>> {
  const typical = r.gapMs > 0 ? r.gapMs : 0;
  if (!typical || r.made < 4) return {};
  const out: Partial<Record<PathShape, { score: number; weight: number }>> = {};
  const ev = shapeEvidence(r);
  for (const k of PATH_SHAPES) {
    const e = ev[k];
    if (!e) continue;
    const score = clamp(p - SKILL.relScale * Math.log(e[1] / typical), 0, 1);
    out[k] = { score, weight: clamp(e[0] / SKILL.fullPairs, 0, 1) };
  }
  return out;
}
