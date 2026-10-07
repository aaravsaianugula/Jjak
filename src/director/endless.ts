/**
 * Levels past 600: the endless, personal road (EXPANSION_PLAN §C5).
 *
 * Every level past 600 is generated live for this player, with the same validators
 * as the bank, then stored in the save (`save.journey.endless`) with its seed, so a
 * retry or a restored save rebuilds the same board. The level's identity (place,
 * season, slot, festival every 12th) comes from `levelPlan(n)`; the target
 * difficulty from the Director (`targetFor`: the curve, skill, pacing and the flow
 * nudge); the tailoring from the play-style profile (`playStyle`). The generator core
 * lives in endless-core.ts (pure); this module owns the save, the worker and timing.
 *
 *   endlessSpec(n)     sync: the stored board, or the plan's own board if none yet
 *   prepareEndless(n)  async: the stored board, generating (and storing) it first if needed
 *
 * Generation runs in a Web Worker with a time budget. If Workers are unavailable,
 * fail or time out, a small main-thread search with a tight budget runs instead,
 * and as a last resort the plan's own board (solvable by construction). It never
 * fails to return a board. After an endless board is cleared, the next one is
 * prepared in the background so Continue is instant.
 *
 * Relief mirrors the bank's re-pin: after two failed attempts at an uncleared level,
 * it is generated again a step gentler (target −0.1).
 */
import { ROUTE_LEVELS } from '../data/route';
import { GOAL_IDS, type GoalId } from '../engine/goals';
import { type LevelSpec, type Mechanic } from '../engine/levels';
import { on } from '../services/events';
import { type EndlessEntry, type EndlessSave, ENDLESS_CAP } from '../services/save-journey';
import { persist, save } from '../services/storage';
import { DIRECTOR, targetFor } from './director';
import { ENDLESS, type EndlessJob, type EndlessResult, type EndlessState, endlessIdentity, makeJob, runEndlessJob, tailorFor } from './endless-core';
import { MODEL } from './model';
import { PARTNERS, levelPlan } from './plan';
import { playStyle } from './profile';
import { tierFor } from './search';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Worker round trip before the main thread takes over (a slow phone at 4× still answers in ~1.5 s). */
const WORKER_TIMEOUT_MS = 5000;
/** Relief: each re-generation after failed attempts aims this much gentler. */
const RELIEF_STEP = MODEL.tierStep;
const MAX_RELIEF = 3;

/** One generation, for the dev panel and the timing measurements. */
export interface EndlessRun {
  n: number;
  ms: number;
  src: EndlessEntry['src'];
  tried: number;
  valid: number;
  fresh: boolean;
  target: number;
  d: number;
  notes: string[];
}
const runs: EndlessRun[] = [];
/** The latest generations, newest last (dev panel, timing tests). */
export const endlessRuns = (): readonly EndlessRun[] => runs;

// ───────────────────────────── Save slice ─────────────────────────────

const slice = (): EndlessSave => save.journey.endless;

/** The stored entry for level n, if any. */
export const endlessEntry = (n: number): EndlessEntry | null => slice()?.levels[n] ?? null;

function stateOf(es: EndlessSave): EndlessState {
  const partners = (xs: string[]) => xs.filter((x): x is Mechanic => (PARTNERS as string[]).includes(x));
  return {
    bag: partners(es.bag),
    goals: es.goals.filter((g): g is GoalId => (GOAL_IDS as string[]).includes(g)),
    lastPartners: partners(es.lastPartners),
    lastGoal: es.lastGoal && (GOAL_IDS as string[]).includes(es.lastGoal) ? (es.lastGoal as GoalId) : null,
    stretch: { ...es.stretch },
  };
}

function commitState(es: EndlessSave, st: EndlessState): void {
  es.bag = st.bag.slice();
  es.goals = st.goals.slice();
  es.lastPartners = st.lastPartners.slice();
  es.lastGoal = st.lastGoal;
  es.stretch = { ...st.stretch };
}

/**
 * Keep the save small: the current level, the next one and the recent window
 * (the 12 before the current level), plus the two newest others (a replay
 * further back keeps its board for a retry). At most ENDLESS_CAP entries.
 */
export function pruneEndless(es: EndlessSave, level: number): void {
  const keys = Object.keys(es.levels).map(Number);
  const inWindow = (n: number) => n >= level - ENDLESS.window && n <= level + 1;
  const others = keys.filter((n) => !inWindow(n)).sort((a, b) => es.levels[b].at - es.levels[a].at);
  for (const n of others.slice(2)) delete es.levels[n];
  const left = Object.keys(es.levels).map(Number).sort((a, b) => es.levels[b].at - es.levels[a].at);
  for (const n of left.slice(ENDLESS_CAP)) delete es.levels[n];
}

/** Stored specs of the levels before n (the freshness window), oldest first. */
function recentSpecs(es: EndlessSave, n: number): LevelSpec[] {
  const out: LevelSpec[] = [];
  for (let k = n - ENDLESS.window; k < n; k++) {
    const e = es.levels[k];
    if (e) out.push(e.spec);
  }
  return out;
}

// ───────────────────────────── Session rhythm ─────────────────────────────

/** Boards played in this app session (resets when analytics counts a new session). */
let sessionMark = { count: -1, boards: 0 };
function sessionBoards(): number {
  const c = save.analytics.sessions.count;
  if (c !== sessionMark.count) sessionMark = { count: c, boards: 0 };
  return sessionMark.boards;
}

// ───────────────────────────── Worker ─────────────────────────────

type Reply = { id: number; result?: EndlessResult | null; error?: string };
/** undefined = not started yet; null = unavailable (never retried this run) */
let worker: Worker | null | undefined;
let failures = 0;
let nextId = 1;
const waiting = new Map<number, (r: EndlessResult | null) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  try {
    const w = new Worker(new URL('./endless.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<Reply>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      if (e.data.error) console.warn('[endless] worker:', e.data.error);
      done?.(e.data.result ?? null);
    };
    w.onerror = (e) => {
      e.preventDefault?.();
      console.warn('[endless] worker failed', e.message);
      dropWorker(true);
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Stop the worker (a timeout or an error) and settle everything waiting on it. */
function dropWorker(broken: boolean): void {
  try {
    worker?.terminate();
  } catch {
    /* already gone */
  }
  failures++;
  worker = broken || failures >= 2 ? null : undefined;
  for (const done of waiting.values()) done(null);
  waiting.clear();
}

function inWorker(job: EndlessJob): Promise<EndlessResult | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      if (!waiting.has(id)) return;
      waiting.delete(id);
      console.warn(`[endless] worker timed out on level ${job.n}`);
      dropWorker(false);
      resolve(null);
    }, WORKER_TIMEOUT_MS);
    waiting.set(id, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
    try {
      w.postMessage({ id, job });
    } catch {
      waiting.delete(id);
      clearTimeout(timer);
      resolve(null);
    }
  });
}

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ───────────────────────────── Generation ─────────────────────────────

/** Generations run one at a time (each reads and advances the bags). */
let chain: Promise<unknown> = Promise.resolve();
const inflight = new Map<number, Promise<LevelSpec>>();

async function generate(n: number, relief: number): Promise<LevelSpec> {
  const es = slice();
  const state = stateOf(es);
  const style = playStyle(save.analytics);
  const tailoring = tailorFor(style, state, sessionBoards());
  const prev = es.levels[n - 1]?.spec ?? null;
  const plan = endlessIdentity(n, tailoring, state, prev);
  const parts = targetFor(save.analytics, n);
  let offset = parts.target - plan.base + (tailoring.sessionPeak ? ENDLESS.peakLift : 0);
  const before = es.levels[n - 1];
  // Smooth steps from the board before (as the bank's ±1 tier), deeper only for deep relief.
  if (before && !relief) offset = clamp(offset, before.offset - (parts.pacing <= -DIRECTOR.deepRelief ? 0.2 : 0.1), before.offset + 0.1);
  let target = clamp(plan.base + offset, 0.05, 0.95);
  const old = es.levels[n];
  if (relief && old) target = Math.max(0.05, Math.min(target, old.target - RELIEF_STEP));
  const job = makeJob(n, plan, target, tailoring, recentSpecs(es, n), { seedPrefix: `endless-${n}${relief ? `-r${relief}` : ''}` });

  const t0 = clock();
  let src: EndlessEntry['src'] = 'worker';
  let result = await inWorker(job);
  if (!result) {
    src = 'main';
    // Let the UI paint (the "preparing the road" line) before a short main-thread search.
    await new Promise((r) => setTimeout(r, 0));
    try {
      result = runEndlessJob({ ...job, ...ENDLESS.quick }, clock);
    } catch (err) {
      console.warn('[endless] main-thread search failed', err);
      result = null;
    }
  }
  let spec: LevelSpec;
  if (result) {
    spec = result.spec;
    commitState(es, state);
  } else {
    src = 'plan';
    spec = { ...levelPlan(n).spec, tier: tierFor(levelPlan(n).base, target) };
  }
  const ms = Math.round(clock() - t0);
  es.seq++;
  es.levels[n] = { spec, target, offset: target - plan.base, relief, src, at: es.seq };
  pruneEndless(es, Math.max(save.level, n));
  save.analytics.last = {
    n,
    tier: spec.tier ?? 2,
    target,
    d: spec.difficulty ?? target,
    reason: `endless ${src}${tailoring.notes.length ? ` · ${tailoring.notes.join(', ')}` : ''}`,
  };
  runs.push({ n, ms, src, tried: result?.tried ?? 0, valid: result?.valid ?? 0, fresh: result?.fresh ?? false, target, d: spec.difficulty ?? -1, notes: tailoring.notes });
  if (runs.length > 50) runs.shift();
  persist();
  return spec;
}

/** The stored (or fallback) spec for endless level n. Sync. */
export function endlessSpec(n: number): LevelSpec {
  return endlessEntry(n)?.spec ?? levelPlan(n).spec;
}

/** After two failed attempts at an uncleared level, it is made again a step gentler. */
function wantsRelief(n: number, e: EndlessEntry): boolean {
  const a = save.analytics;
  return (save.stars[n] ?? 0) === 0 && a.tries.n === n && a.tries.count >= DIRECTOR.reliefAfterTries && e.relief < MAX_RELIEF;
}

/** Generate (in a worker) and store endless level n if needed. Never rejects. */
export function prepareEndless(n: number): Promise<LevelSpec> {
  n = Math.floor(n);
  if (n <= ROUTE_LEVELS) return Promise.resolve(levelPlan(n).spec);
  const busy = inflight.get(n);
  if (busy) return busy;
  const e = endlessEntry(n);
  if (e && !wantsRelief(n, e)) return Promise.resolve(e.spec);
  const relief = e ? e.relief + 1 : 0;
  if (e) {
    // Two failed tries: the same place and idea, a step gentler. The count starts again.
    save.analytics.tries = { n, count: 0 };
  }
  const p = chain
    .then(() => generate(n, relief))
    .catch((err) => {
      console.warn('[endless] generation failed', err);
      return endlessSpec(n);
    })
    .finally(() => inflight.delete(n));
  chain = p;
  inflight.set(n, p);
  return p;
}

/** Is level n ready to play without waiting? */
export const endlessReady = (n: number) => n <= ROUTE_LEVELS || (!!endlessEntry(n) && !inflight.has(n));

// ───────────────────────────── Events ─────────────────────────────

on('leave', () => {
  sessionBoards();
  sessionMark.boards++;
});

on('clear', ({ session }) => {
  sessionBoards();
  sessionMark.boards++;
  const sp = session.spec;
  if (sp.mode !== 'journey') return;
  const next = sp.number + 1;
  // Prepare the next endless board in the background (after the other clear
  // handlers have folded this board into the model), so Continue is instant.
  if (next > ROUTE_LEVELS && next <= save.level && !endlessEntry(next)) setTimeout(() => void prepareEndless(next), 50);
});
