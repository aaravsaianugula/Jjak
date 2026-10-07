/**
 * A tiny typed event bus so features (missions, Flower Path, Market…) can react
 * to play without the game screen knowing about each of them.
 * The game screen emits; services subscribe once at startup.
 */
import type { Session, TapResult } from '../engine/session';
import type { ModeId } from '../engine/levels';
import type { ClearSummary } from './progress';

export interface GameEvents {
  /** a pair was made (any mode) */
  pair: { mode: ModeId; cards: [number, number]; combo: number; fever: boolean; yaku: string[]; session: Session };
  /** a Journey / Daily / Zen board was cleared and recorded */
  clear: { session: Session; summary: ClearSummary };
  /** a Rush run ended and was recorded */
  rush: { score: number; rounds: number; pairs: number; bestCombo: number };
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

export function emit<K extends keyof GameEvents>(kind: K, e: GameEvents[K]): void {
  for (const fn of (handlers[kind] ?? []) as Handler<K>[]) {
    try {
      fn(e);
    } catch (err) {
      console.error(`[events] ${kind} handler failed`, err);
    }
  }
}
