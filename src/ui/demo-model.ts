/**
 * The DOM-free half of the demo player: demo scripts as data, a tiny board
 * notation, and a runner that steps a script through the real rules
 * (`applyPair` for what a pair does, `findPath` for the line it draws). The
 * player in demo.ts animates what this reports; tests/demos.test.ts checks
 * every script is legal and ends where it should.
 */
import { type Board, type Point, EMPTY, FENCE_DOWN, FENCE_RIGHT, STONE, WATER, gateMonth, gateOf, isCard, isGate, isTorii, monthOf, toriiOf, toriiPair } from '../engine/board';
import { type GoalId, type GoalStats } from '../engine/goals';
import { type Wind, legalMoves } from '../engine/moves';
import { findPath, pathBends } from '../engine/path';
import { type PlayState, type StepResult, applyPair, lockedOf } from '../engine/rules';
import { MAX_COMBO } from '../engine/session';

// ── Script format ───────────────────────────────────────────────────────
/**
 * One beat of a demo. Cells are board indices (row * cols + col) at the time
 * of the step, so after a slide they name where the card is now.
 */
export type DemoStep =
  /** the brush pairs two cards; the path draws and the board reacts */
  | { kind: 'pair'; a: number; b: number }
  /** the brush taps one card (a snowy or tied card shakes) */
  | { kind: 'tap'; cell: number }
  /** a same-flower pair with no legal path: shake, and the would-be path is drawn and crossed out */
  | { kind: 'blocked'; a: number; b: number }
  | { kind: 'wait'; ms: number }
  /** two or three words under the board ('' clears it) */
  | { kind: 'caption'; text: string }
  /** a soft gold ring on these cells (none clears it) */
  | { kind: 'mark'; cells: number[] };

export interface DemoScript {
  id: string;
  /**
   * Rows of space-separated tokens: a card id (0–49), `.` empty, `#` stone,
   * `G<m>` a gate of month m. Suffixes: `s` under snow, `k` tied with a knot,
   * `|` a fence on the cell's right edge, `_` a fence on its bottom edge.
   */
  grid: string[];
  wind?: Wind;
  /** a goal chip above the board, filled from the demo's own play */
  goal?: GoalId;
  /** number each bend of the path as the brush draws it (the basics) */
  bends?: boolean;
  /** show the 짝짝짝 combo stamp as pairs chain */
  combo?: boolean;
  steps: DemoStep[];
  /**
   * The pairs the player makes in "your turn", in order (either card first).
   * Defaults to the script's own pairs; 'any' asks for one legal pair of the
   * player's choosing, on the board as the demo left it.
   */
  turn?: [number, number][] | 'any';
  /** the board after every step, in the same notation (checked by the tests) */
  end: string[];
}

export const pair = (a: number, b: number): DemoStep => ({ kind: 'pair', a, b });
export const tap = (cell: number): DemoStep => ({ kind: 'tap', cell });
export const blocked = (a: number, b: number): DemoStep => ({ kind: 'blocked', a, b });
export const wait = (ms: number): DemoStep => ({ kind: 'wait', ms });
export const cap = (text: string): DemoStep => ({ kind: 'caption', text });
export const mark = (...cells: number[]): DemoStep => ({ kind: 'mark', cells });

// ── Board notation ──────────────────────────────────────────────────────
export interface DemoBoard extends PlayState {
  wind: Wind | null;
}

const TOKEN = /^(#|\.|~|T[01]|G\d{1,2}|\d{1,2})([sk|_]*)$/;

export function parseGrid(grid: string[], wind: Wind | null = null): DemoBoard {
  const rows = grid.map((r) => r.trim().split(/\s+/));
  const cols = rows[0].length;
  const cells: number[] = [];
  const walls = new Uint8Array(rows.length * cols);
  const hidden = new Set<number>();
  const knots = new Set<number>();
  let fenced = false;
  rows.forEach((row, r) => {
    if (row.length !== cols) throw new Error(`demo grid row ${r} has ${row.length} cells, expected ${cols}`);
    row.forEach((tok, c) => {
      const m = TOKEN.exec(tok);
      if (!m) throw new Error(`bad demo token "${tok}"`);
      const i = r * cols + c;
      const [, v, mods] = m;
      cells.push(v === '.' ? EMPTY : v === '#' ? STONE : v === '~' ? WATER : v[0] === 'T' ? toriiOf(Number(v.slice(1))) : v[0] === 'G' ? gateOf(Number(v.slice(1))) : Number(v));
      if (mods.includes('s')) hidden.add(i);
      if (mods.includes('k')) knots.add(i);
      if (mods.includes('|')) (walls[i] |= FENCE_RIGHT), (fenced = true);
      if (mods.includes('_')) (walls[i] |= FENCE_DOWN), (fenced = true);
    });
  });
  const board: Board = { rows: rows.length, cols, cells, ...(fenced ? { walls } : {}) };
  return { board, hidden, knots, wind };
}

/** The board back in grid notation (fences included), for tests and debugging. */
export function gridOf(st: PlayState): string[] {
  const { rows, cols, cells, walls } = st.board;
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const v = cells[i];
      let t = v === EMPTY ? '.' : v === STONE ? '#' : v === WATER ? '~' : isTorii(v) ? `T${toriiPair(v)}` : isGate(v) ? `G${gateMonth(v)}` : String(v);
      if (st.hidden.has(i)) t += 's';
      if (st.knots.has(i)) t += 'k';
      if (walls && walls[i] & FENCE_RIGHT) t += '|';
      if (walls && walls[i] & FENCE_DOWN) t += '_';
      row.push(t);
    }
    out.push(row.join(' '));
  }
  return out;
}

// ── Paths that don't exist ──────────────────────────────────────────────
/** A would-be path: through an obstacle ('block'), or around with three bends ('bends'). */
export interface Ghost {
  pts: Point[];
  why: 'bends' | 'block';
}

const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

/**
 * The line a blocked pair *would* take: first straight through whatever is in
 * the way (a stone, a gate, a fence), else the shortest path with three bends.
 * Corner points in board space, like findPath. Null when neither exists.
 */
export function ghostPath(b: Board, from: number, to: number): Ghost | null {
  const through = route(b, from, to, 2, true);
  if (through) return { pts: through, why: 'block' };
  const long = route(b, from, to, 3, false);
  return long ? { pts: long, why: 'bends' } : null;
}

/** BFS over (cell, direction, turns) on the padded board. */
function route(b: Board, from: number, to: number, maxTurns: number, ignoreBlocks: boolean): Point[] | null {
  const H = b.rows + 2;
  const W = b.cols + 2;
  const sr = Math.floor(from / b.cols) + 1;
  const sc = (from % b.cols) + 1;
  const tr = Math.floor(to / b.cols) + 1;
  const tc = (to % b.cols) + 1;
  const free = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= H || c >= W) return false;
    if (r === tr && c === tc) return true;
    if (r === 0 || c === 0 || r === H - 1 || c === W - 1) return true;
    const v = b.cells[(r - 1) * b.cols + (c - 1)];
    return v === EMPTY || (ignoreBlocks && !isCard(v));
  };
  type Node = { r: number; c: number; d: number; t: number; prev: Node | null };
  let frontier: Node[] = [{ r: sr, c: sc, d: -1, t: -1, prev: null }];
  const seen = new Set<string>();
  while (frontier.length) {
    const next: Node[] = [];
    for (const n of frontier) {
      for (let d = 0; d < 4; d++) {
        if (n.d >= 0 && d === ((n.d + 2) & 3)) continue;
        const t = n.d === d ? n.t : n.t + 1;
        if (t > maxTurns) continue;
        const r = n.r + DR[d];
        const c = n.c + DC[d];
        if (!free(r, c)) continue;
        const key = `${r},${c},${d},${t}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const node: Node = { r, c, d, t, prev: n };
        if (r === tr && c === tc) {
          // Keep only the corners, back in board space.
          const chain: Node[] = [];
          for (let k: Node | null = node; k; k = k.prev) chain.unshift(k);
          const pts: Point[] = [{ r: sr - 1, c: sc - 1 }];
          for (let k = 1; k < chain.length - 1; k++) if (chain[k].d !== chain[k + 1].d) pts.push({ r: chain[k].r - 1, c: chain[k].c - 1 });
          pts.push({ r: tr - 1, c: tc - 1 });
          return pts;
        }
        next.push(node);
      }
    }
    frontier = next;
  }
  return null;
}

// ── Running a script ────────────────────────────────────────────────────
export type DemoEvent =
  | { kind: 'pair'; a: number; b: number; cards: [number, number]; path: Point[]; turns: number; combo: number; lucky: boolean; fever: boolean; res: StepResult }
  | { kind: 'tap'; cell: number; locked: 'snow' | 'knot' | null }
  | { kind: 'blocked'; a: number; b: number; ghost: Ghost | null }
  | { kind: 'wait'; ms: number }
  | { kind: 'caption'; text: string }
  | { kind: 'mark'; cells: number[] };

/** Why a pair can't be made right now (null: it can). */
export function pairProblem(st: PlayState, a: number, b: number): 'locked' | 'month' | 'path' | null {
  const { cells } = st.board;
  if (a === b || !isCard(cells[a]) || !isCard(cells[b])) return 'month';
  if (st.hidden.has(a) || st.hidden.has(b) || st.knots.has(a) || st.knots.has(b)) return 'locked';
  if (monthOf(cells[a]) !== monthOf(cells[b])) return 'month';
  return findPath(st.board, a, b) ? null : 'path';
}

/**
 * One play of a script on its own board. `step()` applies a beat through the
 * real rules and says what happened; illegal beats throw (a script bug).
 */
export class DemoRun implements GoalStats {
  readonly state: DemoBoard;
  bestCombo = 0;
  blockedTaps = 0;
  feverCount = 0;
  straightPairs = 0;
  pairsMade = 0;
  /** the current combo; any wait longer than the game's combo window breaks it */
  combo = 0;

  constructor(readonly script: DemoScript) {
    this.state = parseGrid(script.grid, script.wind ?? null);
  }

  get pairsTotal(): number {
    return this.script.steps.filter((s) => s.kind === 'pair').length;
  }

  step(s: DemoStep): DemoEvent {
    const st = this.state;
    switch (s.kind) {
      case 'pair':
        return this.pairUp(s.a, s.b);
      case 'tap': {
        const locked = st.hidden.has(s.cell) ? 'snow' : st.knots.has(s.cell) ? 'knot' : null;
        if (!isCard(st.board.cells[s.cell])) throw new Error(`${this.script.id}: tap on an empty cell ${s.cell}`);
        return { kind: 'tap', cell: s.cell, locked };
      }
      case 'blocked': {
        if (pairProblem(st, s.a, s.b) !== 'path') throw new Error(`${this.script.id}: blocked(${s.a}, ${s.b}) is not a same-flower pair without a path`);
        this.blockedTaps++;
        return { kind: 'blocked', a: s.a, b: s.b, ghost: ghostPath(st.board, s.a, s.b) };
      }
      case 'wait':
        if (s.ms > 4000) this.combo = 0;
        return { kind: 'wait', ms: s.ms };
      case 'caption':
        return { kind: 'caption', text: s.text };
      case 'mark':
        return { kind: 'mark', cells: s.cells };
    }
  }

  /** Make a pair (from the script or from the player). Throws if it isn't legal. */
  pairUp(a: number, b: number): Extract<DemoEvent, { kind: 'pair' }> {
    const st = this.state;
    const why = pairProblem(st, a, b);
    if (why) throw new Error(`${this.script.id}: pair(${a}, ${b}) is illegal (${why})`);
    const path = findPath(st.board, a, b)!;
    const cards: [number, number] = [st.board.cells[a], st.board.cells[b]];
    const turns = Math.min(2, pathBends(path));
    const res = applyPair(st, a, b, st.wind);
    this.pairsMade++;
    if (turns === 0) this.straightPairs++;
    this.combo = Math.min(MAX_COMBO, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const fever = this.combo >= MAX_COMBO;
    if (fever && this.feverCount === 0) this.feverCount = 1;
    return { kind: 'pair', a, b, cards, path, turns, combo: this.combo, lucky: monthOf(cards[0]) === 12, fever, res };
  }
}

/** The pairs the player is asked to make in "your turn" (empty for 'any'). */
export const turnPairs = (s: DemoScript): [number, number][] =>
  s.turn === 'any' ? [] : (s.turn ?? s.steps.flatMap((x) => (x.kind === 'pair' ? [[x.a, x.b] as [number, number]] : [])));

/** Run a whole script; returns the run (for its end state and stats). */
export function runScript(s: DemoScript): DemoRun {
  const run = new DemoRun(s);
  for (const step of s.steps) run.step(step);
  return run;
}

/**
 * Play the "your turn" half: the listed pairs on a fresh board, or for 'any',
 * every legal first pair on the board the demo left (returns one run per choice).
 */
export function runTurn(s: DemoScript): DemoRun[] {
  if (s.turn === 'any') {
    const after = runScript(s);
    return legalMoves(after.state.board, lockedOf(after.state)).map(([a, b]) => {
      const run = runScript(s);
      run.pairUp(a, b);
      return run;
    });
  }
  const run = new DemoRun(s);
  for (const [a, b] of turnPairs(s)) run.pairUp(a, b);
  return [run];
}

/** Turn a script authored for a rightward wind to blow another way (left: mirror, up: transpose). */
export function orient(s: DemoScript, dir: Exclude<Wind, 'down'>): DemoScript {
  if (dir === 'right') return s;
  const rows = s.grid.map((r) => r.trim().split(/\s+/));
  const R = rows.length;
  const C = rows[0].length;
  if (/[|_]/.test(s.grid.join(''))) throw new Error('orient() does not move fences');
  // Index maps: left mirrors columns; up maps column c → row (C-1-c), row r → column r.
  const map =
    dir === 'left'
      ? (i: number) => Math.floor(i / C) * C + (C - 1 - (i % C))
      : (i: number) => (C - 1 - (i % C)) * R + Math.floor(i / C);
  const grid =
    dir === 'left'
      ? rows.map((r) => [...r].reverse().join(' '))
      : Array.from({ length: C }, (_, nr) => Array.from({ length: R }, (_, nc) => rows[nc][C - 1 - nr]).join(' '));
  const endRows = s.end.map((r) => r.trim().split(/\s+/));
  const end =
    dir === 'left'
      ? endRows.map((r) => [...r].reverse().join(' '))
      : Array.from({ length: C }, (_, nr) => Array.from({ length: R }, (_, nc) => endRows[nc][C - 1 - nr]).join(' '));
  const steps = s.steps.map((x): DemoStep => {
    if (x.kind === 'pair' || x.kind === 'blocked') return { ...x, a: map(x.a), b: map(x.b) };
    if (x.kind === 'tap') return { ...x, cell: map(x.cell) };
    if (x.kind === 'mark') return { ...x, cells: x.cells.map(map) };
    return x;
  });
  const turn = s.turn === 'any' || !s.turn ? s.turn : s.turn.map(([a, b]): [number, number] => [map(a), map(b)]);
  return { ...s, id: `${s.id}-${dir}`, grid, end, steps, wind: dir, turn };
}
