/**
 * Art for the board mechanics that aren't cards: gates (門) and bamboo fences.
 * Shared by the game board, the mini demo boards and the map legend.
 *
 * A gate is drawn in card units (100 × 140) so it sits in a card's slot: a small
 * hanok gate (일주문) with a tiled roof whose eaves turn up, two posts, a name
 * plaque carrying the month number, and two doors painted with the month's
 * flower (the card sprite's `#motif-N`, so it always matches the deck). For the
 * opening animation the doors are separate elements that swing on their hinges
 * while the frame lifts away (transform and opacity only).
 */
import { MONTHS } from '../data/deck';
import { MONTH_TINTS } from './cards';

const INK = '#2a2724';
const WOOD = '#6e4b30';
const WOOD_DARK = '#4a3020';
const WOOD_LIGHT = '#94683f';
const ROOF = '#3a3530';
const PAPER = '#f7f1e6';
const VERMILION = '#b4442e';

/** The doors' painted area, in card units. */
const DOOR = { x: 19, y: 44, w: 62, h: 89 };

/** The month's flower, scaled into the door area (both doors share one painting). */
function doorPainting(month: number): string {
  const s = DOOR.h / 140;
  const w = 100 * s;
  const x = DOOR.x + (DOOR.w - w) / 2;
  const tint = MONTH_TINTS[month] ?? '#ece4d2';
  return (
    `<rect x="${DOOR.x}" y="${DOOR.y}" width="${DOOR.w}" height="${DOOR.h}" fill="${tint}"/>` +
    `<use href="#motif-${month}" x="${x.toFixed(2)}" y="${DOOR.y}" width="${w.toFixed(2)}" height="${DOOR.h}"/>` +
    // A light wash so the painting reads as a door, not a card.
    `<rect x="${DOOR.x}" y="${DOOR.y}" width="${DOOR.w}" height="${DOOR.h}" fill="${PAPER}" opacity=".18"/>`
  );
}

/** Frame, studs and ring pull of one door leaf (side -1 = left, 1 = right). */
function doorLeaf(side: -1 | 1): string {
  const x0 = side < 0 ? DOOR.x : DOOR.x + DOOR.w / 2;
  const w = DOOR.w / 2;
  const ring = side < 0 ? x0 + w - 5 : x0 + 5;
  const hinge = side < 0 ? x0 + 0.5 : x0 + w - 8.5;
  return (
    `<rect x="${x0 + 1}" y="${DOOR.y + 1}" width="${w - 2}" height="${DOOR.h - 2}" fill="none" stroke="${WOOD_DARK}" stroke-width="2.6"/>` +
    // A lower rail with a wooden kick panel.
    `<rect x="${x0 + 1}" y="${DOOR.y + DOOR.h - 18}" width="${w - 2}" height="17" fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="2"/>` +
    `<path d="M${x0 + 5} ${DOOR.y + DOOR.h - 13}h${w - 10}" stroke="${WOOD_LIGHT}" stroke-width="1.1" opacity=".7"/>` +
    // Iron hinge straps.
    `<path d="M${hinge} ${DOOR.y + 10}h8M${hinge} ${DOOR.y + DOOR.h - 26}h8" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
    // Ring pull.
    `<circle cx="${ring}" cy="${DOOR.y + 47}" r="3.6" fill="none" stroke="${INK}" stroke-width="1.6"/>` +
    `<circle cx="${ring}" cy="${DOOR.y + 43.6}" r="1.3" fill="${INK}"/>`
  );
}

/** One door leaf as its own SVG (for the swinging doors). */
function doorSvg(month: number, side: -1 | 1): string {
  const x = side < 0 ? DOOR.x : DOOR.x + DOOR.w / 2;
  return `<svg viewBox="${x} ${DOOR.y} ${DOOR.w / 2} ${DOOR.h}" preserveAspectRatio="none" aria-hidden="true">${doorPainting(month)}${doorLeaf(side)}</svg>`;
}

/** Roof, posts, beam, plaque and threshold. */
function frameMarkup(month: number): string {
  const n = String(month + 1);
  const pw = n.length > 1 ? 24 : 19;
  // Roof: a tiled hip with eaves that lift at both ends (처마).
  const roof = 'M1 21C7 21 11 18 14 12L86 12C89 18 93 21 99 21L94 26H6Z';
  let tiles = '';
  for (let x = 20; x <= 80; x += 6) tiles += `M${x} 13.5V24`;
  return (
    // Contact shadow.
    `<ellipse cx="50" cy="136.5" rx="46" ry="3" fill="#000" opacity=".16"/>` +
    // Posts (기둥) on stone footings.
    `<rect x="9" y="24" width="10" height="110" fill="${WOOD}" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="81" y="24" width="10" height="110" fill="${WOOD}" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M12 30V130M84 30V130" stroke="${WOOD_LIGHT}" stroke-width="1.4" opacity=".75"/>` +
    `<rect x="6" y="131" width="16" height="7" rx="1.5" fill="#8c857a" stroke="${INK}" stroke-width="1.6"/>` +
    `<rect x="78" y="131" width="16" height="7" rx="1.5" fill="#8c857a" stroke="${INK}" stroke-width="1.6"/>` +
    // Threshold (문지방).
    `<rect x="18" y="131.5" width="64" height="4.5" fill="${WOOD_DARK}" stroke="${INK}" stroke-width="1.4"/>` +
    // Beam (보) under the roof, with a thin painted band.
    `<rect x="5" y="25" width="90" height="17" fill="${WOOD}" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M7 29.5H93" stroke="${VERMILION}" stroke-width="1.3" opacity=".7"/>` +
    `<path d="M7 38H93" stroke="${WOOD_LIGHT}" stroke-width="1.2" opacity=".7"/>` +
    // Roof and tiles.
    `<path class="gate__roof" d="${roof}" fill="${ROOF}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="${tiles}" stroke="#5c564e" stroke-width="1.6"/>` +
    `<path d="M14 12H86" stroke="#6c665d" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M1 21C7 21 11 18 14 12M99 21C93 21 89 18 86 12" fill="none" stroke="#6c665d" stroke-width="1.2"/>` +
    // Name plaque (현판) with the month number.
    `<rect x="${50 - pw / 2}" y="24" width="${pw}" height="19" rx="2" fill="${PAPER}" stroke="${INK}" stroke-width="1.8"/>` +
    `<rect x="${50 - pw / 2 + 2}" y="26" width="${pw - 4}" height="15" rx="1" fill="none" stroke="${VERMILION}" stroke-width=".9" opacity=".8"/>` +
    `<text x="50" y="38.6" text-anchor="middle" font-size="13" font-weight="700" font-family="'Gowun Batang', serif" fill="${INK}">${n}</text>`
  );
}

/** A closed gate as one static SVG (map legend, demo boards, still frames). */
export function gateSvg(month: number): string {
  return `<svg class="gate__art" viewBox="0 0 100 140" aria-hidden="true">${doorPainting(month)}${doorLeaf(-1)}${doorLeaf(1)}${frameMarkup(month)}</svg>`;
}

/**
 * A closed gate as layered markup for the board: two door leaves that can swing
 * open (`.gate__door--l/--r`) under a frame that can lift away (`.gate__frame`).
 * Wrap it in an element with class `gate`; add `is-open` to play the opening.
 */
export function gateInner(month: number): string {
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
  const box = (x: number) => `left:${pct(x, 100)};top:${pct(DOOR.y, 140)};width:${pct(DOOR.w / 2, 100)};height:${pct(DOOR.h, 140)}`;
  return (
    `<span class="gate__dark" style="left:${pct(DOOR.x, 100)};top:${pct(DOOR.y, 140)};width:${pct(DOOR.w, 100)};height:${pct(DOOR.h, 140)}"></span>` +
    `<span class="gate__door gate__door--l" style="${box(DOOR.x)}">${doorSvg(month, -1)}</span>` +
    `<span class="gate__door gate__door--r" style="${box(DOOR.x + DOOR.w / 2)}">${doorSvg(month, 1)}</span>` +
    `<svg class="gate__frame" viewBox="0 0 100 140" aria-hidden="true">${frameMarkup(month)}</svg>`
  );
}

/** "Gate, opens with Pine (1)" */
export const gateLabel = (month: number) => `Gate, opens with ${MONTHS[month]?.en ?? 'its flower'} (${month + 1})`;

// ── Fences ──────────────────────────────────────────────────────────────

/**
 * One bamboo fence segment from (x1, y1) to (x2, y2) in board pixels, `t` thick:
 * a pale bamboo pole with ink outline, two nodes, a highlight, and a dark post
 * with a twine lashing at each end. Runs of segments join post to post.
 */
export function fenceSegment(x1: number, y1: number, x2: number, y2: number, t: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const f = (v: number) => v.toFixed(1);
  const h = t / 2;
  const node = (u: number) => `M${f(len * u)} ${f(-h)}V${f(h)}`;
  return (
    `<g class="fence" transform="translate(${f(x1)} ${f(y1)}) rotate(${f(ang)})">` +
    `<rect class="fence__shade" x="0" y="${f(-h + t * 0.35)}" width="${f(len)}" height="${f(t)}" rx="${f(h)}"/>` +
    `<rect class="fence__pole" x="0" y="${f(-h)}" width="${f(len)}" height="${f(t)}" rx="${f(h)}"/>` +
    `<path class="fence__hi" d="M${f(t)} ${f(-h * 0.35)}H${f(len - t)}"/>` +
    `<path class="fence__node" d="${node(0.34)}${node(0.66)}"/>` +
    `</g>`
  );
}

/** A fence post (the lashed stake where segments meet). */
export function fencePost(x: number, y: number, t: number): string {
  const f = (v: number) => v.toFixed(1);
  const r = t * 0.7;
  return `<g class="fence-post"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/><path d="M${f(x - r * 0.75)} ${f(y - r * 0.25)}L${f(x + r * 0.75)} ${f(y + r * 0.25)}M${f(x - r * 0.75)} ${f(y + r * 0.35)}L${f(x + r * 0.75)} ${f(y + r * 0.95)}"/></g>`;
}

/**
 * All of a board's fences as SVG markup, in board pixels. `cell(r, c)` gives a
 * cell's top-left corner; `cw`/`ch` the cell size. Posts are shared where
 * segments meet, so a run reads as one fence.
 */
export function fencesMarkup(
  walls: Uint8Array,
  rows: number,
  cols: number,
  x0: number,
  y0: number,
  cw: number,
  ch: number,
): string {
  const t = Math.max(5, Math.min(10, cw * 0.15));
  let poles = '';
  const posts = new Map<string, [number, number]>();
  const post = (x: number, y: number) => posts.set(`${Math.round(x)},${Math.round(y)}`, [x, y]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const w = walls[r * cols + c];
      if (!w) continue;
      if (w & 1) {
        const x = x0 + (c + 1) * cw;
        const ya = y0 + r * ch;
        const yb = y0 + (r + 1) * ch;
        poles += fenceSegment(x, ya, x, yb, t);
        post(x, ya);
        post(x, yb);
      }
      if (w & 2) {
        const y = y0 + (r + 1) * ch;
        const xa = x0 + c * cw;
        const xb = x0 + (c + 1) * cw;
        poles += fenceSegment(xa, y, xb, y, t);
        post(xa, y);
        post(xb, y);
      }
    }
  }
  let stakes = '';
  for (const [x, y] of posts.values()) stakes += fencePost(x, y, t);
  return poles + stakes;
}
