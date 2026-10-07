/**
 * Levels past 600: generated live for this player (C5).
 * PHASE-0 STUB — the endless-road agent replaces the body; keep the exports.
 */
import { type LevelSpec, journeyLevel } from '../engine/levels';

/** The stored (or fallback) spec for endless level n. Sync. */
export function endlessSpec(n: number): LevelSpec {
  return journeyLevel(n);
}

/** Generate (in a worker) and store endless level n if needed. */
export async function prepareEndless(n: number): Promise<LevelSpec> {
  return endlessSpec(n);
}
