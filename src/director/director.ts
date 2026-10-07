/**
 * The adjustment policy (Hunicke's Hamlet) and pacing (L4D's Director).
 * PHASE-0 STUB — the player-model agent replaces the body; keep the exports.
 */

export interface TierChoice {
  tier: number;
  /** target difficulty 0–1 */
  target: number;
  /** why (dev panel): e.g. 'pinned', 'skill', 'relief', 'stretch' */
  reason: string;
}

/** Which tier this player gets for Journey level n (pins it on first call). */
export function chooseTier(_n: number): TierChoice {
  return { tier: 2, target: 0.5, reason: 'default' };
}
