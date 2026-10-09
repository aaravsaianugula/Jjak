import { type Board, type Point, EMPTY, FENCE_DOWN, FENCE_RIGHT, TORII, WATER, isTerrain, isTorii, pointOf } from './board';

/**
 * Shisen-sho connection rule: a path of at most 3 straight segments (≤ 2 turns)
 * through empty cells. The path may travel one cell outside the board edge.
 *
 * Coordinates in the returned path are in *board* space and may be -1 or
 * rows/cols when the path runs through the outer margin.
 *
 * Terrain (fixed cells that never hold a card):
 * - Water (개울 · 小川): a path may cross it, but only straight on. It may run
 *   along a stream as well as across one; it just never bends on a water cell.
 * - Torii (鳥居): a path that steps into a torii, from any side, comes out of
 *   its twin (same mark) heading the same way. The jump costs no bend, and the
 *   ≤ 2-bend rule still counts every real bend on the whole path. The path
 *   can't bend on either torii, so the cell past the twin must be open (a free
 *   cell, water, the outer lane, or the partner card itself). A path never ends
 *   on a torii: no card sits there and stepping in always jumps.
 */

const MAX_TURNS = 2;
const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

/**
 * A fence between padded cell (r, c) and its neighbour in direction d? Only
 * edges between two board cells can carry a fence; the outer lane never does.
 */
function fenceAt(b: Board, r: number, c: number, d: number): boolean {
  const w = b.walls!;
  const nr = r + DR[d];
  const nc = c + DC[d];
  if (r < 1 || c < 1 || r > b.rows || c > b.cols || nr < 1 || nc < 1 || nr > b.rows || nc > b.cols) return false;
  // Look the fence up on the upper / left cell of the two.
  const ur = Math.min(r, nr) - 1;
  const uc = Math.min(c, nc) - 1;
  return (w[ur * b.cols + uc] & (d === 1 || d === 3 ? FENCE_RIGHT : FENCE_DOWN)) !== 0;
}

/** No torii here. */
const PLAIN = -1;
/** A torii whose twin is missing: it leads nowhere, so it blocks. */
const NO_TWIN = -2;

/**
 * The board's terrain on the padded grid (null when there is none): for each
 * padded cell, the padded index of a torii's twin (else PLAIN / NO_TWIN), and
 * whether a path must go straight on there (water and torii).
 */
interface Terrain {
  twin: Int32Array | null;
  straight: Uint8Array | null;
}

function terrainOf(b: Board, W: number): Terrain {
  let twin: Int32Array | null = null;
  let straight: Uint8Array | null = null;
  const first: number[] = [];
  for (let i = 0; i < b.cells.length; i++) {
    const v = b.cells[i];
    if (v !== WATER && !isTorii(v)) continue;
    const p = (Math.floor(i / b.cols) + 1) * W + (i % b.cols) + 1;
    if (!straight) straight = new Uint8Array((b.rows + 2) * W);
    straight[p] = 1;
    if (v === WATER) continue;
    if (!twin) twin = new Int32Array((b.rows + 2) * W).fill(PLAIN);
    const k = TORII - v;
    if (first[k] === undefined) {
      first[k] = p;
      twin[p] = NO_TWIN;
    } else {
      twin[p] = first[k];
      twin[first[k]] = p;
    }
  }
  return { twin, straight };
}

/** Bends in a path from findPath: its corners, not counting torii jumps. */
export function pathBends(pts: readonly Point[]): number {
  let jumps = 0;
  for (const p of pts) if (p.jump) jumps++;
  return Math.max(0, pts.length - 2 - 2 * jumps);
}

/**
 * Returns the corner points of the best path (fewest turns, then shortest),
 * including both endpoints, or null if the two cells cannot be connected.
 * A torii jump adds two points: the torii stepped into, then its twin (marked
 * `jump`). `passable` lets the generator treat not-yet-placed cells as empty.
 */
export function findPath(
  b: Board,
  from: number,
  to: number,
  passable: (cellValue: number, index: number) => boolean = (v) => v === EMPTY,
): Point[] | null {
  // Only cards are ever joined: a path never starts or ends on terrain.
  if (from === to || isTerrain(b.cells[from]) || isTerrain(b.cells[to])) return null;
  const H = b.rows + 2;
  const W = b.cols + 2;
  const a = pointOf(b, from);
  const t = pointOf(b, to);
  const sr = a.r + 1;
  const sc = a.c + 1;
  const tr = t.r + 1;
  const tc = t.c + 1;
  const { twin, straight } = terrainOf(b, W);
  const walls = !!b.walls;

  /**
   * The padded cell a step from (r, c) in direction d lands on, after any torii
   * jump, or -1 if the step is fenced, off the grid or blocked.
   */
  const stepTo = (r: number, c: number, d: number): number => {
    if (walls && fenceAt(b, r, c, d)) return -1;
    const nr = r + DR[d];
    const nc = c + DC[d];
    if (nr < 0 || nc < 0 || nr >= H || nc >= W) return -1;
    const p = nr * W + nc;
    if (nr === tr && nc === tc) return p;
    if (nr === 0 || nc === 0 || nr === H - 1 || nc === W - 1) return p; // outer margin
    if (twin && twin[p] !== PLAIN) return twin[p] === NO_TWIN ? -1 : twin[p]; // out of the twin
    if (straight && straight[p]) return p; // water
    const i = (nr - 1) * b.cols + (nc - 1);
    return passable(b.cells[i], i) ? p : -1;
  };

  // State = (cell, dir). cost = turns * 1000 + length (turns dominate).
  const S = H * W * 4;
  const best = new Int32Array(S).fill(0x7fffffff);
  const turnsAt = new Int8Array(S);
  const parent = new Int32Array(S).fill(-1);
  // Small graphs (≤ 12×10×4 states): a simple bucket queue by cost is plenty.
  const queue: { s: number; cost: number }[] = [];

  for (let d = 0; d < 4; d++) {
    const p = stepTo(sr, sc, d);
    if (p < 0) continue;
    const s = p * 4 + d;
    best[s] = 1;
    turnsAt[s] = 0;
    queue.push({ s, cost: 1 });
  }

  let goal = -1;
  while (queue.length) {
    // pop min
    let mi = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].cost < queue[mi].cost) mi = i;
    const { s, cost } = queue[mi];
    queue[mi] = queue[queue.length - 1];
    queue.pop();
    if (cost !== best[s]) continue;

    const cell = s >> 2;
    const d = s & 3;
    const r = Math.floor(cell / W);
    const c = cell % W;
    if (r === tr && c === tc) {
      goal = s;
      break;
    }
    const turns = turnsAt[s];
    const onlyStraight = straight !== null && straight[cell] === 1;
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((d + 2) & 3)) continue; // no reversing
      if (onlyStraight && nd !== d) continue; // never bend on water or a torii
      const nt = turns + (nd === d ? 0 : 1);
      if (nt > MAX_TURNS) continue;
      const p = stepTo(r, c, nd);
      if (p < 0) continue;
      const ns = p * 4 + nd;
      const ncost = nt * 1000 + (cost % 1000) + 1;
      if (ncost < best[ns]) {
        best[ns] = ncost;
        turnsAt[ns] = nt;
        parent[ns] = s;
        queue.push({ s: ns, cost: ncost });
      }
    }
  }
  if (goal < 0) return null;

  // Reconstruct, keeping only corners and torii jumps.
  const seq: { r: number; c: number; d: number }[] = [];
  for (let s = goal; s >= 0; s = parent[s]) {
    const cell = s >> 2;
    seq.push({ r: Math.floor(cell / W), c: cell % W, d: s & 3 });
  }
  seq.push({ r: sr, c: sc, d: seq[seq.length - 1].d });
  seq.reverse();
  const pts: Point[] = [{ r: a.r, c: a.c }];
  for (let i = 0; i < seq.length - 1; i++) {
    const here = seq[i];
    const next = seq[i + 1];
    if (here.d !== next.d) pts.push({ r: here.r - 1, c: here.c - 1 });
    // A step that didn't land next door went through a torii.
    const er = here.r + DR[next.d];
    const ec = here.c + DC[next.d];
    if (er !== next.r || ec !== next.c) {
      pts.push({ r: er - 1, c: ec - 1 });
      pts.push({ r: next.r - 1, c: next.c - 1, jump: true });
    }
  }
  pts.push({ r: t.r, c: t.c });
  return pts;
}

export const canConnect = (b: Board, i: number, j: number): boolean => findPath(b, i, j) !== null;

/**
 * All board cells reachable from `from` with ≤ 2 turns. Empty cells are reached
 * by passing through; blocked cells are reached only as an endpoint (the ray
 * stops there). Water and torii are passed through (a ray jumps from a torii to
 * its twin) but are never reached and never a corner. One sweep replaces many
 * findPath calls in the generator/hints.
 */
export function reachable(
  b: Board,
  from: number,
  passable: (cellValue: number, index: number) => boolean = (v) => v === EMPTY,
): Set<number> {
  const H = b.rows + 2;
  const W = b.cols + 2;
  const out = new Set<number>();
  const a = pointOf(b, from);
  const startR = a.r + 1;
  const startC = a.c + 1;
  const { twin, straight } = terrainOf(b, W);
  // seen[cell*2 + axis] — axis 0 vertical, 1 horizontal. A cell visited on an
  // axis with fewer segments used never needs revisiting on that axis.
  const seen = new Uint8Array(H * W * 2);
  let frontier: { r: number; c: number; axis: number }[] = [{ r: startR, c: startC, axis: -1 }];
  const walls = !!b.walls;
  // A ray between two twins on one line can come round forever; a straight
  // run never needs more steps than there are cells.
  const maxSteps = H * W;

  for (let seg = 0; seg <= MAX_TURNS && frontier.length; seg++) {
    const next: { r: number; c: number; axis: number }[] = [];
    for (const f of frontier) {
      for (let d = 0; d < 4; d++) {
        const axis = d & 1;
        if (axis === f.axis) continue; // must turn (or first segment)
        let r = f.r;
        let c = f.c;
        for (let steps = 0; steps < maxSteps; steps++) {
          if (walls && fenceAt(b, r, c, d)) break;
          r += DR[d];
          c += DC[d];
          if (r < 0 || c < 0 || r >= H || c >= W) break;
          const margin = r === 0 || c === 0 || r === H - 1 || c === W - 1;
          if (!margin) {
            const p = r * W + c;
            if (twin && twin[p] !== PLAIN) {
              if (twin[p] === NO_TWIN) break;
              // Out of the twin, still heading d; no corner on a torii.
              r = Math.floor(twin[p] / W);
              c = twin[p] % W;
              continue;
            }
            if (straight && straight[p]) continue; // water: straight on, never a corner
            const i = (r - 1) * b.cols + (c - 1);
            if (i === from) break;
            if (!passable(b.cells[i], i)) {
              out.add(i);
              break;
            }
            out.add(i);
          }
          const key = (r * W + c) * 2 + axis;
          if (!seen[key]) {
            seen[key] = 1;
            next.push({ r, c, axis });
          }
        }
      }
    }
    frontier = next;
  }
  return out;
}
