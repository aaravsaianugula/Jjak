/**
 * The kind of challenge inside a tier (EXPANSION_PLAN §C1, Director). The tier stays
 * the main control; a `ChallengeRequest` only says what to lean on *inside* it, for
 * the search's fitness to read: a path shape that slows this player, a mechanic that
 * trails their usual, decoy pairs for a player who rushes, or key pairs where they
 * don't look first.
 *
 * Calm by design:
 *  - no emphasis on teaching, rest, relief, breather or eased boards, nor while the
 *    player is struggling or frozen;
 *  - rotation: a blind spot leaned on for either of the last two levels is skipped, so
 *    it's never the same trick board after board (`save.analytics.emphases` keeps the
 *    record; detours, rim routes and 2-bend paths count as one blind spot);
 *  - a retry of a pinned level keeps its focus (the same board).
 * Pure apart from `noteChallenge`, which writes the record.
 */
import { type AnalyticsSave, EMPHASES_CAP, type PathShape } from '../services/save-analytics';
import { levelPlan } from './plan';
import { playerHabits } from './profile';

export type Emphasis =
  | { kind: 'none' }
  | { kind: 'shape'; shape: PathShape }
  | { kind: 'mechanic'; id: string }
  | { kind: 'decoys' }
  | { kind: 'region'; region: 'centre' | 'edges' | 'top' | 'bottom' };

export interface ChallengeRequest {
  /** the Journey level */
  n: number;
  /** the tier the policy chose (the challenge never changes it) */
  tier: number;
  /** stable id of the emphasis: 'none', 'shape:twoBend', 'mech:wind', 'decoys', 'region:centre' */
  focus: string;
  emphasis: Emphasis;
  /** 0–1: how far to lean inside the tier (0 = the plain tier board) */
  weight: number;
  /** deterministic per level, tier and focus: a seed for the search, stable across retries */
  rotationKey: string;
  /** why this focus (dev panel) */
  why: string;
}

export const CHALLENGE = {
  /** new boards a focus must wait before it can return */
  gap: 2,
  /** least confidence in a habit before it can be leaned on */
  minConfidence: 0.3,
  maxWeight: 0.8,
};

export const focusOf = (e: Emphasis): string =>
  e.kind === 'none' ? 'none'
  : e.kind === 'shape' ? `shape:${e.shape}`
  : e.kind === 'mechanic' ? `mech:${e.id}`
  : e.kind === 'region' ? `region:${e.region}`
  : 'decoys';

/**
 * The blind spot behind a focus, for rotation: detours and rim routes always take two
 * bends, so a 2-bend, detour or rim-route emphasis all lean on the same reading.
 */
export function familyOf(focus: string): string {
  if (focus === 'shape:twoBend' || focus === 'shape:detour' || focus === 'shape:edge') return 'bends2';
  return focus.startsWith('region:') ? 'region' : focus;
}

export function emphasisOf(focus: string): Emphasis {
  const [kind, v] = focus.split(':');
  if (kind === 'shape' && v) return { kind: 'shape', shape: v as PathShape };
  if (kind === 'mech' && v) return { kind: 'mechanic', id: v };
  if (kind === 'region' && (v === 'centre' || v === 'edges' || v === 'top' || v === 'bottom')) return { kind: 'region', region: v };
  if (kind === 'decoys') return { kind: 'decoys' };
  return { kind: 'none' };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const request = (n: number, tier: number, emphasis: Emphasis, need: number, why: string): ChallengeRequest => {
  const focus = focusOf(emphasis);
  const weight = focus === 'none' ? 0 : Math.round(clamp(0.3 + 0.5 * need, 0, CHALLENGE.maxWeight) * 100) / 100;
  return { n, tier, focus, emphasis, weight, rotationKey: `${n}:${tier}:${focus}`, why };
};

/** A plain board: the tier as designed, nothing leaned on. */
export const plainChallenge = (n: number, tier: number, why: string) => request(n, tier, { kind: 'none' }, 0, why);

/** Candidate emphases for level n from the player's habits, most needed first. */
export function candidates(a: AnalyticsSave, n: number): { emphasis: Emphasis; need: number; why: string }[] {
  const h = playerHabits(a);
  const out: { emphasis: Emphasis; need: number; why: string }[] = [];
  const ok = (c: number) => c >= CHALLENGE.minConfidence;
  for (const s of h.slowShapes) {
    if (ok(s.confidence)) out.push({ emphasis: { kind: 'shape', shape: s.shape }, need: clamp((s.costRatio - 1) / 2, 0, 1) * s.confidence, why: `slow on ${s.shape} paths (×${s.costRatio.toFixed(1)})` });
  }
  const onBoard = levelPlan(n).mechanics as string[];
  for (const m of h.weakMechanics) {
    if (ok(m.confidence) && onBoard.includes(m.id)) out.push({ emphasis: { kind: 'mechanic', id: m.id }, need: clamp(-m.gap / 0.15, 0, 1) * m.confidence, why: `${m.id} trails their usual` });
  }
  if (ok(h.scan.confidence)) {
    if (h.scan.start === 'edges') out.push({ emphasis: { kind: 'region', region: 'centre' }, need: clamp((h.scan.edge - 0.5) * 2, 0, 1) * h.scan.confidence, why: 'looks at the rim first' });
    else if (h.scan.start === 'centre') out.push({ emphasis: { kind: 'region', region: 'edges' }, need: clamp((h.scan.centre - 0.5) * 2, 0, 1) * h.scan.confidence, why: 'looks at the centre first' });
    if (h.scan.vertical === 'top') out.push({ emphasis: { kind: 'region', region: 'bottom' }, need: clamp((h.scan.top - 0.5) * 2, 0, 1) * h.scan.confidence * 0.8, why: 'looks at the top first' });
    else if (h.scan.vertical === 'bottom') out.push({ emphasis: { kind: 'region', region: 'top' }, need: clamp((h.scan.bottom - 0.5) * 2, 0, 1) * h.scan.confidence * 0.8, why: 'looks at the bottom first' });
  }
  if (h.tempo.style === 'rush' && ok(h.tempo.confidence)) out.push({ emphasis: { kind: 'decoys' }, need: clamp(h.tempo.misreadRate / 0.4, 0, 1) * h.tempo.confidence, why: 'rushes into blocked pairs' });
  return out.sort((x, y) => y.need - x.need);
}

/**
 * The challenge for a newly pinned level n at `tier`. `calm` (teaching, rest, relief,
 * breather, struggling or frozen) gives a plain board.
 */
export function planChallenge(a: AnalyticsSave, n: number, tier: number, calm: string | null): ChallengeRequest {
  if (calm) return plainChallenge(n, tier, calm);
  // Every blind spot the last `gap` levels were given (a re-pinned level has two entries).
  const levels = new Set<number>();
  const recent = new Set<string>();
  for (const e of a.emphases) {
    if (!levels.has(e.n) && levels.size === CHALLENGE.gap) break;
    levels.add(e.n);
    recent.add(familyOf(e.focus));
  }
  const pick = candidates(a, n).find((c) => c.need > 0 && !recent.has(familyOf(focusOf(c.emphasis))));
  return pick ? request(n, tier, pick.emphasis, pick.need, pick.why) : plainChallenge(n, tier, 'nothing due');
}

/** The challenge a pinned level was given (a retry is the same board), or a plain one. */
export function pinnedChallenge(a: AnalyticsSave, n: number, tier: number): ChallengeRequest {
  const e = a.emphases.find((x) => x.n === n);
  if (!e || e.focus === 'none') return plainChallenge(n, tier, 'pinned');
  const focus = focusOf(emphasisOf(e.focus));
  return { n, tier, focus, emphasis: emphasisOf(e.focus), weight: e.w, rotationKey: `${n}:${tier}:${focus}`, why: 'pinned' };
}

/** Record a level's challenge (a log, most recent first, capped; a level's latest entry is its board's). */
export function noteChallenge(a: AnalyticsSave, ch: ChallengeRequest): void {
  a.emphases = [{ n: ch.n, focus: ch.focus, w: ch.weight }, ...a.emphases].slice(0, EMPHASES_CAP);
}
