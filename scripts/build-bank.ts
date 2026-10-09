/**
 * Builds the shipped level bank: levels 1–600 × 5 tiers (docs/EXPANSION_PLAN.md §C1).
 *
 *   npm run bank                     everything (≈ 10–15 min on 4 threads)
 *   npm run bank -- --from 1 --to 48 rebuild a range and merge it into the bank
 *   npm run bank -- --workers 2 --K 4
 *
 * For every level the search (src/director/search.ts) builds K candidates per
 * tier from deterministic seeds, measures them with the bot personas, rejects
 * anything a validator refuses, and picks one board per tier so d never falls
 * as the tier rises. Work is split by chapter (12 levels, in order, so novelty
 * can compare neighbours) across Node worker threads; the result is the same
 * whatever the thread count.
 *
 * Writes src/data/level-bank.json, docs/level-curve.json (before/after curve for
 * the chart) and docs/level-audit.md. Bundle with rolldown (see package.json).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { bankSeed, encodeSlot } from '../src/director/bank';
import { type Metrics, funChecks, measure } from '../src/director/metrics';
import { type LevelPlan, knobRange, levelPlan } from '../src/director/plan';
import { FEATURE_KEYS, type ReadingFeatures, encodeFeatures, featuresOf } from '../src/director/reading';
import { type Candidate, type Feature, featureOf, funScore, neighbour, searchTiers, tierTarget, tryCandidate } from '../src/director/search';
import { TAILOR } from '../src/director/tailor';
import { boardHash } from '../src/director/validate';
import { buildBoard, windOf } from '../src/engine/levels';
import { legacyJourneyLevel } from './lib/legacy-journey';
import { type CurveFile, type CurveLevel, renderAudit, withKept } from './lib/audit';

const LEVELS = 600;
const TIERS = 5;

type Task = { kind: 'chapter'; ch: number; K: number } | { kind: 'before'; from: number; to: number };

interface LevelResult {
  n: number;
  entries: string[];
  curve: Omit<CurveLevel, 'before'>;
  tried: number;
  rejected: Record<string, number>;
  repaired: boolean;
  failed?: boolean;
}

type Result = { kind: 'chapter'; ch: number; levels: LevelResult[]; ms: number } | { kind: 'before'; rows: { n: number; before: CurveLevel['before'] }[] };

const pick = (m: Metrics) => ({
  d: m.d,
  opening: m.opening,
  avgMoves: +m.avgMoves.toFixed(2),
  minMoves: m.minMoves,
  twoBend: +m.twoBend.toFixed(3),
  decoys: +m.decoys.toFixed(3),
  deadEnd: +m.deadEnd.toFixed(3),
  humanTime: +m.humanTime.toFixed(1),
  fun: +m.fun.toFixed(3),
  easyOpen: m.easyOpen,
  easySeconds: +m.easySeconds.toFixed(1),
  closingRun: +m.closingRun.toFixed(2),
  crunch: +m.crunch.toFixed(3),
  finale: +m.finale.toFixed(3),
});
/** The fun marks a board passes, as three 0/1 characters: foothold, crunch, finale. */
const funCode = (m: Metrics) => {
  const c = funChecks(m);
  return `${+c.foothold}${+c.crunch}${+c.finale}`;
};

/** Tailoring alternates per (level, tier), and how many pool boards are read to choose them. */
const ALTERNATES = 2;
const READ_AT_MOST = 8;
/** an alternate must add at least this much lean (summed over what it leans on more) */
const MIN_LEAN = 0.08;

/** A board's reading features: the solver's line only (no playouts needed). */
const readingOf = (c: Candidate): ReadingFeatures => featuresOf(c.board, measure(c.spec, c.board, { reading: true, random: 0, human: 0 }).reading!);

const MECH_KNOBS = ['stones', 'snow', 'knots', 'gates', 'fences'] as const;
/** fresh deals of the chosen knobs tried per tier, numbered from FRESH_FROM (clear of the search's attempts) */
const FRESH = 5;
const FRESH_FROM = 900;
/**
 * More deals for a tier that still has no alternate after the first FRESH: a deal's d
 * scatters widely around its knobs' typical d (often ±0.15 on the hard tiers), so the
 * search's pick tends to sit off-centre. When the first deals land mostly to one side of
 * it, these deals step one knob towards it (inside the level's ranges, as the search's
 * own neighbours do), so more of them land within the d tolerance.
 */
const MORE = 20;

/** What a board leans on, as one vector: its reading features and its mechanic counts within the level's range. */
function leanVector(plan: LevelPlan, c: Candidate, f: ReadingFeatures): number[] {
  const range = knobRange(plan);
  const mech = MECH_KNOBS.map((k) => {
    const [lo, hi] = range[k] as [number, number];
    return hi > lo ? (c.knobs[k] - lo) / (hi - lo) : 0;
  });
  return [...FEATURE_KEYS.map((k) => f[k]), ...mech];
}

const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * The bank slot for one tier: its board and its features, then up to ALTERNATES other
 * valid boards from the same search or fresh deals (within the d tolerance, as fun, with
 * a foothold) that each lean clearly more on something the boards before them don't
 * (greedy). Also returns how many alternates the slot holds.
 */
function slotFor(plan: LevelPlan, tier: number, pick: Candidate, searched: readonly Candidate[]): { slot: string; alts: number } {
  const hash = (c: Candidate) => boardHash(c.spec, c.board);
  const f0 = readingOf(pick);
  const primary = { entry: { attempt: pick.attempt, knobs: pick.knobs, d: pick.metrics.d, hash: hash(pick) }, features: encodeFeatures(f0) };
  if (plan.fixed) return { slot: encodeSlot([primary]), alts: 0 };
  const pickHash = primary.entry.hash;
  const near = (c: Candidate) => Math.abs(c.metrics.d - pick.metrics.d) <= TAILOR.maxDGap && c.metrics.easyOpen >= 1 && funScore(c.metrics) >= funScore(pick.metrics) - 0.1;
  const read = new Map<string, { c: Candidate; f: ReadingFeatures; v: number[] }>();
  const readOf = (c: Candidate, h: string) => {
    let r = read.get(h);
    if (!r) {
      const f = readingOf(c);
      r = { c, f, v: leanVector(plan, c, f) };
      read.set(h, r);
    }
    return r;
  };
  // The search's own pool, plus fresh deals (same identity and counts, a different deal).
  const pool = [...searched];
  const deal = (attempt: number, knobs: Candidate['knobs']): Candidate | null => {
    const c = tryCandidate(plan, knobs, bankSeed(plan.n, tier, attempt), tier);
    if (!c.verdict.ok) return null;
    const v = { ...c, attempt, fitness: 0, feature: [] };
    pool.push(v);
    return v;
  };
  const choose = () => {
    const seen = new Set([pickHash]);
    const cands = pool
      .filter((c) => c !== pick && near(c))
      .map((c) => ({ c, h: hash(c) }))
      .filter(({ h }) => {
        if (seen.has(h)) return false;
        seen.add(h);
        return true;
      })
      .sort((a, b) => Math.abs(a.c.metrics.d - pick.metrics.d) - Math.abs(b.c.metrics.d - pick.metrics.d))
      .slice(0, READ_AT_MOST)
      .map(({ c, h }) => readOf(c, h));
    const boards = [primary];
    let top = leanVector(plan, pick, f0);
    for (let k = 0; k < ALTERNATES && cands.length; k++) {
      const gain = (v: number[]) => v.reduce((s, x, i) => s + Math.max(0, x - top[i]), 0);
      cands.sort((a, b) => gain(b.v) - gain(a.v));
      const best = cands.shift()!;
      if (gain(best.v) < MIN_LEAN) break;
      boards.push({ entry: { attempt: best.c.attempt, knobs: best.c.knobs, d: best.c.metrics.d, hash: hash(best.c) }, features: encodeFeatures(best.f) });
      top = top.map((x, i) => Math.max(x, best.v[i]));
    }
    return boards;
  };
  const gaps: number[] = [];
  for (let k = 0; k < FRESH; k++) {
    const c = deal(FRESH_FROM + k, pick.knobs);
    if (c) gaps.push(c.metrics.d - pick.metrics.d);
  }
  let boards = choose();
  // Still nothing to choose from: deal more, stepping a knob towards the pick when the
  // first deals mostly missed it on one side.
  const lean = median(gaps);
  const dir: 0 | 1 | -1 = lean > TAILOR.maxDGap ? -1 : lean < -TAILOR.maxDGap ? 1 : 0;
  for (let k = 0; boards.length < 2 && k < MORE; k++) {
    const knobs = dir ? neighbour(plan, pick.knobs, dir, k) ?? pick.knobs : pick.knobs;
    const c = deal(FRESH_FROM + FRESH + k, knobs);
    if (c && near(c)) boards = choose();
  }
  return { slot: encodeSlot(boards), alts: boards.length - 1 };
}

function runChapter(ch: number, K: number): LevelResult[] {
  const out: LevelResult[] = [];
  const recentByTier: Feature[][] = [[], [], [], [], []];
  let prevFeature: Feature | null = null;
  for (let s = 0; s < 12; s++) {
    const n = ch * 12 + s + 1;
    const plan = levelPlan(n);
    const r = searchTiers(plan, { K, climb: 3, recentByTier });
    const mech = plan.mechanics.join('+');
    const curveBase = {
      n,
      ch,
      slot: plan.slot,
      role: plan.role,
      shape: `${plan.rows}x${plan.cols}`,
      mech,
      goal: plan.goal ?? '',
      base: plan.base,
      target: [0, 1, 2, 3, 4].map((t) => +tierTarget(plan.base, t).toFixed(3)),
    };
    if (!r) {
      out.push({ n, entries: [], curve: { ...curveBase, after: [], t2: null, sim: 0 }, tried: 0, rejected: {}, repaired: false, failed: true });
      continue;
    }
    const slots = r.picks.map((c, t) => slotFor(plan, t, c, r.pools[t]));
    const entries = slots.map((s) => s.slot);
    r.picks.forEach((c, t) => {
      recentByTier[t].push(c.feature);
      if (recentByTier[t].length > 3) recentByTier[t].shift();
    });
    const f2 = featureOf(r.picks[2].spec, r.picks[2].metrics.d);
    const sim = prevFeature ? +Math.sqrt(f2.reduce((a, x, i) => a + (x - prevFeature![i]) ** 2, 0)).toFixed(3) : 1;
    prevFeature = f2;
    out.push({
      n,
      entries,
      curve: {
        ...curveBase,
        after: r.picks.map((c) => c.metrics.d),
        knobs: r.picks.map((c) => `${c.knobs.stones}${c.knobs.layout[0]} m${c.knobs.months}${c.knobs.snow ? ` sn${c.knobs.snow}` : ''}${c.knobs.knots ? ` k${c.knobs.knots}` : ''}${c.knobs.gates ? ` g${c.knobs.gates}` : ''}${c.knobs.fences ? ` f${c.knobs.fences}` : ''}`),
        t2: pick(r.picks[2].metrics),
        fun: r.picks.map((c) => funCode(c.metrics)),
        funShape: r.picks.map((c) => [+c.metrics.easySeconds.toFixed(1), +c.metrics.crunch.toFixed(2), +c.metrics.closingRun.toFixed(1)]),
        sim,
        alts: slots.map((s) => s.alts),
      },
      tried: r.tried,
      rejected: r.rejected,
      repaired: r.repaired,
    });
  }
  return out;
}

function runBefore(from: number, to: number) {
  const rows: { n: number; before: CurveLevel['before'] }[] = [];
  for (let n = from; n <= to; n++) {
    const spec = legacyJourneyLevel(n);
    const m = measure(spec, buildBoard(spec));
    rows.push({ n, before: { ...pick(m), solved: m.solved, shape: `${spec.rows}x${spec.cols}`, wind: windOf(spec) ?? '' } });
  }
  return rows;
}

if (!isMainThread) {
  parentPort!.on('message', (task: Task | null) => {
    if (!task) process.exit(0);
    if (task.kind === 'chapter') {
      const t0 = Date.now();
      const levels = runChapter(task.ch, task.K);
      parentPort!.postMessage({ kind: 'chapter', ch: task.ch, levels, ms: Date.now() - t0 } satisfies Result);
    } else parentPort!.postMessage({ kind: 'before', rows: runBefore(task.from, task.to) } satisfies Result);
  });
  void workerData;
} else {
  main();
}

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
}

function main() {
  // npm runs scripts from the package root (don't derive it from this file: node_modules may be a link).
  const root = process.cwd();
  const bankPath = resolve(root, 'src/data/level-bank.json');
  const curvePath = resolve(root, 'docs/level-curve.json');
  const auditPath = resolve(root, 'docs/level-audit.md');
  const from = arg('from', 1);
  const to = arg('to', LEVELS);
  const K = arg('K', 6);
  const nWorkers = Math.max(1, Math.min(arg('workers', 4), cpus().length));
  const skipBefore = process.argv.includes('--no-before');
  const t0 = Date.now();

  // Merge into what's there (a partial rebuild keeps the other levels).
  const entries: string[] = new Array(LEVELS * TIERS).fill('');
  if (existsSync(bankPath)) {
    const old = JSON.parse(readFileSync(bankPath, 'utf8'));
    if (old.levels === LEVELS && Array.isArray(old.e)) old.e.forEach((s: string, i: number) => (entries[i] = s));
  }
  let curve: CurveFile = { version: 1, K, levels: [] };
  if (existsSync(curvePath)) {
    try {
      curve = JSON.parse(readFileSync(curvePath, 'utf8'));
    } catch {
      /* rebuild it */
    }
  }
  const byN = new Map<number, CurveLevel>(curve.levels.map((l) => [l.n, l]));

  const tasks: Task[] = [];
  const firstCh = Math.floor((from - 1) / 12);
  const lastCh = Math.floor((to - 1) / 12);
  // Heavy late chapters first so the threads finish together.
  for (let ch = lastCh; ch >= firstCh; ch--) tasks.push({ kind: 'chapter', ch, K });
  if (!skipBefore) for (let a = 1; a <= LEVELS; a += 50) tasks.push({ kind: 'before', from: a, to: Math.min(LEVELS, a + 49) });

  const stats = { tried: 0, rejected: {} as Record<string, number>, repaired: 0, failed: [] as number[], chapterMs: 0 };
  let done = 0;
  const total = tasks.length;
  const workers: Worker[] = [];
  const self = fileURLToPath(import.meta.url);

  const finish = () => {
    for (const w of workers) w.postMessage(null);
    const missing = entries.filter((e) => !e).length;
    const lines = [];
    for (let n = 1; n <= LEVELS; n++) lines.push('    ' + entries.slice((n - 1) * TIERS, n * TIERS).map((e) => JSON.stringify(e)).join(', '));
    const json = `{\n  "v": 2,\n  "levels": ${LEVELS},\n  "tiers": ${TIERS},\n  "e": [\n${lines.join(',\n')}\n  ]\n}\n`;
    writeFileSync(bankPath, json);
    curve.K = K;
    curve.levels = [...byN.values()].sort((a, b) => a.n - b.n);
    curve.build = {
      seconds: Math.round((Date.now() - t0) / 1000),
      workers: nWorkers,
      tried: stats.tried,
      rejected: stats.rejected,
      repaired: stats.repaired,
      failed: stats.failed,
      bankBytes: Buffer.byteLength(json),
    };
    writeFileSync(curvePath, JSON.stringify(curve) + '\n');
    writeFileSync(auditPath, withKept(renderAudit(curve), existsSync(auditPath) ? readFileSync(auditPath, 'utf8') : null));
    console.log(`bank: ${LEVELS * TIERS - missing}/${LEVELS * TIERS} entries, ${Buffer.byteLength(json)} bytes, ${stats.tried} boards tried, ${stats.repaired} levels repaired, failed: [${stats.failed.join(', ')}], ${curve.build.seconds}s`);
    if (stats.failed.length || missing) process.exitCode = 1;
  };

  const onResult = (w: Worker, r: Result) => {
    done++;
    if (r.kind === 'chapter') {
      for (const l of r.levels) {
        stats.tried += l.tried;
        if (l.repaired) stats.repaired++;
        for (const [k, v] of Object.entries(l.rejected)) stats.rejected[k] = (stats.rejected[k] ?? 0) + v;
        if (l.failed) {
          stats.failed.push(l.n);
          continue;
        }
        if (l.n < from || l.n > to) continue;
        l.entries.forEach((e, t) => (entries[(l.n - 1) * TIERS + t] = e));
        const prev = byN.get(l.n);
        byN.set(l.n, { ...l.curve, before: prev?.before ?? null } as CurveLevel);
      }
      process.stdout.write(`  chapter ${r.ch + 1} in ${(r.ms / 1000).toFixed(1)}s (${done}/${total})\n`);
    } else {
      for (const row of r.rows) {
        const prev = byN.get(row.n);
        byN.set(row.n, { ...(prev ?? ({ n: row.n } as CurveLevel)), before: row.before });
      }
      process.stdout.write(`  before-curve block (${done}/${total})\n`);
    }
    const next = tasks.shift();
    if (next) w.postMessage(next);
    else if (done === total) finish();
  };

  console.log(`building levels ${from}–${to} × ${TIERS} tiers, K=${K}, ${nWorkers} threads, ${tasks.length} tasks`);
  for (let i = 0; i < nWorkers; i++) {
    const w = new Worker(self);
    workers.push(w);
    w.on('message', (r: Result) => onResult(w, r));
    w.on('error', (e) => {
      console.error(e);
      process.exit(1);
    });
    const task = tasks.shift();
    if (task) w.postMessage(task);
  }
}
