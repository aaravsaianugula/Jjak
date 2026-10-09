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
/** Red-ochre posts (석간주), the dancheong green of the beam, the eaves' shaded underside. */
const POST = '#7a3a28';
const POST_LIGHT = '#a65a3e';
const DANCHEONG = '#3e6e61';
const SOFFIT = '#5a4a3c';
const BRONZE = '#9a7a3e';

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
    // Door pull (문고리): a bronze lozenge plate with a slim ring hanging from it.
    `<path d="M${ring} ${DOOR.y + 39.6}L${ring + 2.6} ${DOOR.y + 43}L${ring} ${DOOR.y + 46.4}L${ring - 2.6} ${DOOR.y + 43}Z" fill="${BRONZE}" stroke="${INK}" stroke-width=".8"/>` +
    `<ellipse cx="${ring}" cy="${DOOR.y + 48.6}" rx="2.4" ry="3" fill="none" stroke="${BRONZE}" stroke-width="1.3"/>` +
    `<ellipse cx="${ring}" cy="${DOOR.y + 48.6}" rx="2.4" ry="3" fill="none" stroke="${INK}" stroke-width=".4" opacity=".6"/>`
  );
}

/** One door leaf as its own SVG (for the swinging doors). */
function doorSvg(month: number, side: -1 | 1): string {
  const x = side < 0 ? DOOR.x : DOOR.x + DOOR.w / 2;
  return `<svg viewBox="${x} ${DOOR.y} ${DOOR.w / 2} ${DOOR.h}" preserveAspectRatio="none" aria-hidden="true">${doorPainting(month)}${doorLeaf(side)}</svg>`;
}

/**
 * Roof, posts, beam, plaque and threshold. The posts are red ochre (석간주)
 * on stone footings; the beam carries a painted dancheong band (green with red
 * rules and a bracketed end motif); the tiled roof sweeps up at both eaves
 * (처마) under a ridge with raised ends, with lit tile ribs and a pale soffit.
 */
function frameMarkup(month: number): string {
  const n = String(month + 1);
  const pw = n.length > 1 ? 24 : 19;
  // Roof surface: eaves that sag in the middle and lift at the corners.
  const roof = 'M-1 19C6 21.6 12 22.6 19 22.6H81C88 22.6 94 21.6 101 19C95 16.8 90 13.6 87 9.6H13C10 13.6 5 16.8 -1 19Z';
  // Soffit: the underside of the eaves, rafters in shadow.
  const soffit = 'M-1 19C6 21.6 12 22.6 19 22.6H81C88 22.6 94 21.6 101 19L97.6 25.4C92 27.2 86 28 80 28H20C14 28 8 27.2 2.4 25.4Z';
  const ridge = 'M11 10.4H89L91.6 6.2C89.6 7.6 87.6 8 85.4 7.8H14.6C12.4 8 10.4 7.6 8.4 6.2Z';
  let ribs = '';
  let lit = '';
  for (let x = 17; x <= 83; x += 5.5) {
    const lean = (x - 50) * 0.06;
    ribs += `M${(x + lean).toFixed(1)} 11V${(22 - Math.abs(x - 50) * 0.004).toFixed(1)}`;
    lit += `M${(x + lean + 1.4).toFixed(1)} 11.6V21`;
  }
  const post = (x: number) =>
    `<rect x="${x}" y="27" width="10" height="107" fill="${POST}" stroke="${INK}" stroke-width="1.8"/>` +
    `<path d="M${x + 2.8} 44V130" stroke="${POST_LIGHT}" stroke-width="1.6" opacity=".7"/>` +
    `<path d="M${x + 8} 44V130" stroke="${INK}" stroke-width="1" opacity=".3"/>` +
    // footing stone, wider than the post, with a lit top
    `<path d="M${x - 3} 138.4V133.4Q${x + 5} 130.8 ${x + 13} 133.4V138.4Z" fill="#9a9284" stroke="${INK}" stroke-width="1.4"/>` +
    `<path d="M${x - 1.6} 133.6Q${x + 5} 131.8 ${x + 11.6} 133.6" stroke="#cfc8ba" stroke-width=".9" fill="none"/>`;
  return (
    // Contact shadow.
    `<ellipse cx="50" cy="137" rx="47" ry="3.2" fill="#000" opacity=".16"/>` +
    post(9) +
    post(81) +
    // Threshold (문지방).
    `<rect x="18" y="131.5" width="64" height="4.5" fill="${WOOD_DARK}" stroke="${INK}" stroke-width="1.4"/>` +
    // Beam (보) with a dancheong band: green ground, red rules, a lit centre line, bracketed ends.
    `<rect x="5" y="28" width="90" height="14" fill="${DANCHEONG}" stroke="${INK}" stroke-width="1.8"/>` +
    `<path d="M6 30.6H94M6 39.4H94" stroke="${VERMILION}" stroke-width="1.5"/>` +
    `<path d="M6 35H94" stroke="#9cc4b4" stroke-width=".9" opacity=".8"/>` +
    `<path d="M6 30.6H18L22.5 35L18 39.4H6ZM94 30.6H82L77.5 35L82 39.4H94Z" fill="${VERMILION}" opacity=".85"/>` +
    `<path d="M8.5 35H17M91.5 35H83" stroke="#f3e2c4" stroke-width="1.1" stroke-linecap="round"/>` +
    // Roof: soffit, tiles, ribs, eave line, ridge.
    `<path d="${soffit}" fill="${SOFFIT}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M4 23.6C10 25.6 15 26.2 20 26.2H80C85 26.2 90 25.6 96 23.6" stroke="${WOOD_LIGHT}" stroke-width="1" fill="none" opacity=".6"/>` +
    `<path class="gate__roof" d="${roof}" fill="${ROOF}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="${ribs}" stroke="#211e1b" stroke-width="1.5" opacity=".7"/>` +
    `<path d="${lit}" stroke="#8a847a" stroke-width=".9" opacity=".75"/>` +
    `<path d="M-1 19C6 21.6 12 22.6 19 22.6H81C88 22.6 94 21.6 101 19" stroke="#8f887e" stroke-width="1.1" fill="none"/>` +
    `<path class="gate__roof" d="${ridge}" fill="${ROOF}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M14.6 8.6H85.4" stroke="#8f887e" stroke-width=".9"/>` +
    // Name plaque (현판) with the month number.
    `<rect x="${50 - pw / 2}" y="25" width="${pw}" height="19" rx="2" fill="${PAPER}" stroke="${INK}" stroke-width="1.8"/>` +
    `<rect x="${50 - pw / 2 + 2}" y="27" width="${pw - 4}" height="15" rx="1" fill="none" stroke="${VERMILION}" stroke-width=".9" opacity=".8"/>` +
    `<text x="50" y="39.6" text-anchor="middle" font-size="13" font-weight="700" font-family="'Gowun Batang', serif" fill="${INK}">${n}</text>`
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
 * a soft shadow, a rounded bamboo pole shaded across its thickness (lit on top,
 * deeper below), a long highlight, and two swollen nodes, each a darker ring
 * with a lit lip. Runs of segments join post to post.
 */
export function fenceSegment(x1: number, y1: number, x2: number, y2: number, t: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const f = (v: number) => v.toFixed(1);
  const h = t / 2;
  const node = (u: number) =>
    `<rect class="fence__node" x="${f(len * u - t * 0.16)}" y="${f(-h - t * 0.08)}" width="${f(t * 0.32)}" height="${f(t * 1.16)}" rx="${f(t * 0.16)}"/>` +
    `<path class="fence__node-lip" d="M${f(len * u + t * 0.2)} ${f(-h * 0.7)}V${f(h * 0.5)}"/>`;
  return (
    `<g class="fence" transform="translate(${f(x1)} ${f(y1)}) rotate(${f(ang)})">` +
    `<rect class="fence__shade" x="0" y="${f(-h + t * 0.35)}" width="${f(len)}" height="${f(t)}" rx="${f(h)}"/>` +
    `<rect class="fence__pole" x="0" y="${f(-h)}" width="${f(len)}" height="${f(t)}" rx="${f(h)}"/>` +
    `<path class="fence__hi" d="M${f(t)} ${f(-h * 0.42)}H${f(len * 0.31)}M${f(len * 0.37)} ${f(-h * 0.42)}H${f(len * 0.63)}M${f(len * 0.69)} ${f(-h * 0.42)}H${f(len - t)}"/>` +
    node(0.34) +
    node(0.66) +
    `</g>`
  );
}

/** A fence post: the cut top of a bamboo stake, its hollow in shadow and a lit rim on the near side. */
export function fencePost(x: number, y: number, t: number): string {
  const f = (v: number) => v.toFixed(1);
  const r = t * 0.72;
  return (
    `<g class="fence-post"><circle class="fence-post__stake" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>` +
    `<circle class="fence-post__hollow" cx="${f(x + r * 0.08)}" cy="${f(y + r * 0.1)}" r="${f(r * 0.42)}"/>` +
    `<path d="M${f(x - r * 0.72)} ${f(y + r * 0.2)}A${f(r * 0.75)} ${f(r * 0.75)} 0 0 1 ${f(x + r * 0.2)} ${f(y - r * 0.72)}"/></g>`
  );
}

/** Shared gradients for the fence layer (inlined once per board). */
const FENCE_DEFS =
  '<defs><linearGradient id="fence-bamboo" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#ece0a4"/><stop offset=".4" stop-color="#cdb96e"/><stop offset=".85" stop-color="#9f8b48"/><stop offset="1" stop-color="#8a7840"/>' +
  '</linearGradient><radialGradient id="fence-stake" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#b58a5a"/><stop offset="1" stop-color="#6e4b30"/></radialGradient></defs>';

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
  return poles ? FENCE_DEFS + poles + stakes : '';
}
