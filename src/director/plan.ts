/**
 * Authored layer: the level grammar and the designed difficulty curve.
 * PHASE-0 STUB — the Director agent replaces the body; keep the exports.
 */
import { type LevelSpec, journeyLevel } from '../engine/levels';

/** A level's stable identity. Only the board inside it adapts to the player. */
export interface LevelPlan {
  n: number;
  /** designed difficulty for this level before any player offset, 0–1 (sawtooth, rising) */
  base: number;
  /** the identity as a spec at the middle tier (tier 2): display and fallback */
  spec: LevelSpec;
}

/** Designed difficulty of level n, 0–1. */
export function designedBase(n: number): number {
  return Math.min(0.9, 0.15 + 0.6 * Math.min(1, n / 600));
}

export function levelPlan(n: number): LevelPlan {
  return { n, base: designedBase(n), spec: journeyLevel(n) };
}
