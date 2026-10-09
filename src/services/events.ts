/**
 * A tiny typed event bus so features (missions, Flower Path, Market…) can react
 * to play without the game screen knowing about each of them.
 * The game screen emits; services subscribe once at startup. Practice boards are
 * never delivered (see emit), so practice can't change progression.
 */
import type { Session, TapResult } from '../engine/session';
import type { ModeId } from '../engine/levels';
import type { ClearSummary } from './progress';

export interface GameEvents {
  /** a pair was made (any mode) */
  pair: { mode: ModeId; cards: [number, number]; combo: number; fever: boolean; yaku: string[]; session: Session };
  /** a Journey / Daily / Zen board was cleared and recorded */
  clear: { session: Session; summary: ClearSummary };
  /**
   * a Rush run ended and was recorded. `extends` is set when a "Keep going"
   * continuation ended: the score already recorded for this run, so listeners
   * add only the difference and don't count a new run.
   */
  rush: { score: number; rounds: number; pairs: number; bestCombo: number; extends?: number };
  /** the player used a hint or a shuffle */
  tool: { kind: 'hint' | 'shuffle'; mode: ModeId };
  /** a board started (after any intro) */
  start: { session: Session };
  /** every tap on a board card, with what the session made of it (analytics) */
  tap: { session: Session; cell: number; result: TapResult; now: number };
  /** a board was abandoned before it was cleared */
  leave: { session: Session; reason: 'quit' | 'restart' };
}

type Handler<K extends keyof GameEvents> = (e: GameEvents[K]) => void;
const handlers: { [K in keyof GameEvents]?: Handler<K>[] } = {};

export function on<K extends keyof GameEvents>(kind: K, fn: Handler<K>): () => void {
  const list = (handlers[kind] ??= []) as Handler<K>[];
  list.push(fn);
  return () => list.splice(list.indexOf(fn), 1);
}

/** A Practice room board: nothing listening (progress, missions, the skill model) may count it. */
function isPractice(e: object): boolean {
  if ('mode' in e && e.mode === 'practice') return true;
  return 'session' in e && (e.session as Session).spec.mode === 'practice';
}

export function emit<K extends keyof GameEvents>(kind: K, e: GameEvents[K]): void {
  if (isPractice(e)) return;
  for (const fn of (handlers[kind] ?? []) as Handler<K>[]) {
    try {
      fn(e);
    } catch (err) {
      console.error(`[events] ${kind} handler failed`, err);
    }
  }
}
