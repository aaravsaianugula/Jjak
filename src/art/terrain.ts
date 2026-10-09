/**
 * Art for the terrain mechanics: torii (鳥居) and streams (개울 · 小川). Shared
 * by the game board and the mini demo boards.
 *
 * A torii is drawn in card units (100 × 140) so it stands in a card's slot: two
 * posts, the top beam (kasagi) with upturned ends over a lintel, the tie beam
 * (nuki) and a plaque, with ripples where it stands in the sea, like the great
 * torii of Itsukushima. The two twin pairs differ at a glance: the first is
 * vermilion with a black cap, the second plain unpainted wood (白木, shiraki)
 * in ink outline; their plaques carry a bold one-stroke (一) or two-stroke (二)
 * mark as well, so colour is never the only cue.
 *
 * Water is drawn per board, in board pixels: a pale wash over each water cell,
 * flush where cells join so a run reads as one stream, and three brushed lines
 * that flow along the run. The waves follow board coordinates, so a line meets
 * itself across a cell edge. Colours come from CSS (`.terrain`, `.torii`), so
 * both themes work.
 */
import { isWater } from '../engine/board';

const INK = '#2a2724';
const VERMILION = '#c4442a';
const VERMILION_DARK = '#8f2f1d';
const PAPER = '#f7f1e6';

/** The plaque's mark, bold enough to read on a phone: one stroke for the first pair, two for the second. */
function plaqueMark(pair: number): string {
  const stroke = (y: number) =>
    `<path d="M35.5 ${y + 1.6}C43 ${y - 1.8} 57 ${y - 2.4} 64.5 ${y - 0.4}L64 ${y + 3.6}C56 ${y + 2} 44 ${y + 2.6} 36 ${y + 5.4}Z" fill="${INK}"/>`;
  return pair === 0 ? stroke(42.4) : stroke(36.4) + stroke(48.2);
}

/** Paint for each twin pair: vermilion with a black cap, or plain wood (白木). */
const PAINT = [
  { body: VERMILION, dark: VERMILION_DARK, shine: '#e98a6c', cap: INK, capLine: '#6a625a', foot: INK },
  { body: '#dcbc88', dark: '#b08a55', shine: '#f1dcb4', cap: '#c49a62', capLine: '#8a6638', foot: '#8a6638' },
];

/** A torii of twin pair `pair` (0 or 1) as one static SVG in card units. */
export function toriiSvg(pair: number): string {
  const p = PAINT[pair === 1 ? 1 : 0];
  // Posts lean in a little towards the top, feet in the water.
  const post = (x: number) =>
    `<path d="M${x - 4.2} 34L${x + 4.2} 34L${x + 5.8} 126L${x - 5.8} 126Z" fill="${p.body}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M${x - 1.6} 38L${x - 0.6} 122" stroke="${p.shine}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>` +
    // Foot bands (根巻).
    `<path d="M${x - 5.6} 116H${x + 5.6}L${x + 6.4} 127H${x - 6.4}Z" fill="${p.foot}"/>`;
  return (
    `<svg class="torii__art" viewBox="0 0 100 140" aria-hidden="true">` +
    // The sea it stands in: a soft wash and two brushed ripples at each foot.
    `<ellipse class="torii__sea" cx="50" cy="128" rx="48" ry="9"/>` +
    `<path class="torii__ripple" d="M10 131C16 128.6 26 128.4 36 131M64 131C74 128.4 84 128.6 90 131" fill="none" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path class="torii__ripple" d="M17 136.5C26 134.6 36 134.8 44 136.6M56 136.6C64 134.8 74 134.6 83 136.5" fill="none" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>` +
    post(26) +
    post(74) +
    // Tie beam (貫), running out past the posts.
    `<path d="M9 58H91L90 66H10Z" fill="${p.body}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    // Centre strut (額束).
    `<rect x="46.5" y="30" width="7" height="29" fill="${p.dark}" stroke="${INK}" stroke-width="1.3"/>` +
    // Lintel (島木) under the cap, both following the cap's sweep.
    `<path d="M6 21C30 27.5 70 27.5 94 21L92.5 30C70 35.5 30 35.5 7.5 30Z" fill="${p.body}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    // Cap (笠木) with upturned ends.
    `<path d="M0 10.5C8 14.4 20 17 34 18H66C80 17 92 14.4 100 10.5L98.5 18.6C88 23 74 24.6 60 24.8H40C26 24.6 12 23 1.5 18.6Z" fill="${p.cap}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M4 14.6C16 18.8 28 20.6 42 21" stroke="${p.capLine}" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/>` +
    // The plaque (額), wide enough for a bold twin mark.
    `<rect x="32" y="31" width="36" height="25" rx="1.6" fill="${PAPER}" stroke="${INK}" stroke-width="1.6"/>` +
    plaqueMark(pair) +
    `</svg>`
  );
}

/** What a screen reader hears for a torii. */
export const toriiLabel = (pair: number) => `Torii, pair ${pair + 1}: a path into it comes out of its twin`;

/**
 * Every water cell of a board as SVG markup in board pixels: (x0, y0) is cell
 * (0, 0)'s top-left corner, `cw`/`ch` the cell size. Empty if there's no water.
 */
export function waterMarkup(cells: readonly number[], rows: number, cols: number, x0: number, y0: number, cw: number, ch: number): string {
  const wet = (r: number, c: number) => r >= 0 && c >= 0 && r < rows && c < cols && isWater(cells[r * cols + c]);
  const inset = Math.max(2, cw * 0.06);
  const f = (v: number) => v.toFixed(1);
  let wash = '';
  let lines = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!wet(r, c)) continue;
      const L = wet(r, c - 1);
      const R = wet(r, c + 1);
      const U = wet(r - 1, c);
      const D = wet(r + 1, c);
      // Flush to a wet neighbour, a little in from a dry one.
      const xa = x0 + c * cw + (L ? 0 : inset);
      const xb = x0 + (c + 1) * cw - (R ? 0 : inset);
      const ya = y0 + r * ch + (U ? 0 : inset);
      const yb = y0 + (r + 1) * ch - (D ? 0 : inset);
      const rad = Math.min(cw, ch) * 0.18;
      const lonely = !L && !R && !U && !D;
      wash += `<rect class="water__wash" x="${f(xa)}" y="${f(ya)}" width="${f(xb - xa)}" height="${f(yb - ya)}" rx="${lonely ? f(rad) : '0'}"/>`;
      // Lines flow along the run: across a row run, down a column run.
      const vertical = (U || D) && !(L || R);
      const len = vertical ? ch : cw;
      const across = vertical ? cw : ch;
      const amp = across * 0.035;
      const wave = len * 0.9;
      for (let k = 0; k < 3; k++) {
        const off = across * (0.3 + 0.2 * k) + (k === 1 ? across * 0.02 : 0);
        // Absolute position along the run, so neighbours' lines meet.
        const startOpen = vertical ? U : L;
        const endOpen = vertical ? D : R;
        const s0 = (vertical ? y0 + r * ch : x0 + c * cw) + (startOpen ? 0 : len * (0.16 + 0.05 * k));
        const s1 = (vertical ? y0 + (r + 1) * ch : x0 + (c + 1) * cw) - (endOpen ? 0 : len * (0.2 - 0.04 * k));
        const base = (vertical ? x0 + c * cw : y0 + r * ch) + off;
        const pts: string[] = [];
        const steps = 8;
        for (let i = 0; i <= steps; i++) {
          const s = s0 + ((s1 - s0) * i) / steps;
          const o = base + amp * Math.sin((s / wave) * Math.PI * 2 + k * 1.7);
          pts.push(vertical ? `${f(o)} ${f(s)}` : `${f(s)} ${f(o)}`);
        }
        lines += `<path class="water__line water__line--${k}" d="M${pts.join('L')}" fill="none" stroke-width="${f(Math.max(1, across * (k === 1 ? 0.04 : 0.028)))}"/>`;
      }
    }
  }
  return wash ? `<g class="water">${wash}${lines}</g>` : '';
}
