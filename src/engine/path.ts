import { type Board, type Point, EMPTY, pointOf } from './board';

/**
 * Shisen-sho connection rule: a path of at most 3 straight segments (≤ 2 turns)
 * through empty cells. The path may travel one cell outside the board edge.
 *
 * Coordinates in the returned path are in *board* space and may be -1 or
 * rows/cols when the path runs through the outer margin.
 */

const MAX_TURNS = 2;
const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

/**
 * Returns the corner points of the best path (fewest turns, then shortest),
 * including both endpoints, or null if the two cells cannot be connected.
 * `passable` lets the generator treat not-yet-placed cells as empty.
 */
export function findPath(
  b: Board,
  from: number,
  to: number,
  passable: (cellValue: number, index: number) => boolean = (v) => v === EMPTY,
): Point[] | null {
  if (from === to) return null;
  const H = b.rows + 2;
  const W = b.cols + 2;
  const a = pointOf(b, from);
  const t = pointOf(b, to);
  const sr = a.r + 1;
  const sc = a.c + 1;
  const tr = t.r + 1;
  const tc = t.c + 1;

  const open = (r: number, c: number): boolean => {
    if (r < 0 || c < 0 || r >= H || c >= W) return false;
    if (r === tr && c === tc) return true;
    if (r === 0 || c === 0 || r === H - 1 || c === W - 1) return true; // outer margin
    const i = (r - 1) * b.cols + (c - 1);
    return passable(b.cells[i], i);
  };

  // State = (cell, dir). cost = turns * 1000 + length (turns dominate).
  const S = H * W * 4;
  const best = new Int32Array(S).fill(0x7fffffff);
  const turnsAt = new Int8Array(S);
  const parent = new Int32Array(S).fill(-1);
  // Small graphs (≤ 12×10×4 states): a simple bucket queue by cost is plenty.
  const queue: { s: number; cost: number }[] = [];

  for (let d = 0; d < 4; d++) {
    const r = sr + DR[d];
    const c = sc + DC[d];
    if (!open(r, c)) continue;
    const s = (r * W + c) * 4 + d;
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
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((d + 2) & 3)) continue; // no reversing
      const nt = turns + (nd === d ? 0 : 1);
      if (nt > MAX_TURNS) continue;
      const nr = r + DR[nd];
      const nc = c + DC[nd];
      if (!open(nr, nc)) continue;
      const ns = (nr * W + nc) * 4 + nd;
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

  // Reconstruct, keeping only corners.
  const cellsRev: { r: number; c: number; d: number }[] = [];
  for (let s = goal; s >= 0; s = parent[s]) {
    const cell = s >> 2;
    cellsRev.push({ r: Math.floor(cell / W), c: cell % W, d: s & 3 });
  }
  cellsRev.reverse();
  const pts: Point[] = [{ r: a.r, c: a.c }];
  for (let i = 0; i < cellsRev.length - 1; i++) {
    if (cellsRev[i].d !== cellsRev[i + 1].d) pts.push({ r: cellsRev[i].r - 1, c: cellsRev[i].c - 1 });
  }
  pts.push({ r: t.r, c: t.c });
  return pts;
}

export const canConnect = (b: Board, i: number, j: number): boolean => findPath(b, i, j) !== null;

/**
 * All board cells reachable from `from` with ≤ 2 turns. Empty cells are reached
 * by passing through; blocked cells are reached only as an endpoint (the ray
 * stops there). One sweep replaces many findPath calls in the generator/hints.
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
  // seen[cell*2 + axis] — axis 0 vertical, 1 horizontal. A cell visited on an
  // axis with fewer segments used never needs revisiting on that axis.
  const seen = new Uint8Array(H * W * 2);
  let frontier: { r: number; c: number; axis: number }[] = [{ r: startR, c: startC, axis: -1 }];

  for (let seg = 0; seg <= MAX_TURNS && frontier.length; seg++) {
    const next: { r: number; c: number; axis: number }[] = [];
    for (const f of frontier) {
      for (let d = 0; d < 4; d++) {
        const axis = d & 1;
        if (axis === f.axis) continue; // must turn (or first segment)
        let r = f.r + DR[d];
        let c = f.c + DC[d];
        while (r >= 0 && c >= 0 && r < H && c < W) {
          const margin = r === 0 || c === 0 || r === H - 1 || c === W - 1;
          if (!margin) {
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
          r += DR[d];
          c += DC[d];
        }
      }
    }
    frontier = next;
  }
  return out;
}
