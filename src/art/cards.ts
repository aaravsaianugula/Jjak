/**
 * Original SVG card art. Every card is drawn in a 100 × 140 view box from simple
 * primitives — no scans of historical decks — and registered once as a
 * <symbol> in a hidden sprite, so a 48-card board is just <use> references.
 *
 * Each month's flower motif is its own symbol (`motif-${m}`); the card symbols
 * reference it with <use>, so the detailed motif markup exists only once.
 */
import { foilOverlay, foilDefs } from './styles';
import { MONTHS, cardDef, isBonus, type CardDef } from '../data/deck';
import { SPECIALS, renderParts, CURTAIN_D, taper, smooth, curve, lin, blade, rng, type Pt } from './specials';
import { BONUS_TINT, bonusArt, bonusChip, bonusFrame, bonusTag } from './bonus';

export const INK = '#2a2724';
const PAPER = '#f7f1e6';
const VERMILION = '#c4472f';
const GOLD = '#b8893b';

interface MonthStyle {
  tint: string;
  draw: () => string;
}

const f = (n: number) => Math.round(n * 10) / 10;
const P = (d: string, fill: string, more = '') => `<path d="${d}" fill="${fill}"${more}/>`;
const S = (d: string, stroke: string, w: number, more = '') =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${more}/>`;
const O = (o: number) => ` opacity="${o}"`;
const C = (cx: number, cy: number, r: number, fill: string, more = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${more}/>`;
const E = (cx: number, cy: number, rx: number, ry: number, fill: string, more = '') =>
  `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${more}/>`;
const G = (t: string, inner: string) => `<g transform="${t}">${inner}</g>`;

/** A branch: dark tapered limb with a lighter ridge along one side. */
function limb(pts: Pt[], w0: number, w1: number, dark: string, light: string, shift: Pt = [0.5, -0.5]) {
  const hl = pts.map(([x, y]): Pt => [x + shift[0] * w0 * 0.22, y + shift[1] * w0 * 0.22]);
  return P(taper(pts, lin(w0, w1)), dark) + P(taper(hl, (t) => w0 * 0.3 * (1 - t) + w1 * 0.15), light, O(0.8));
}

/**
 * Five (or n) petals around a centre.
 * `notch` gives the cherry teardrop with a cleft tip; otherwise round plum petals.
 */
function blossom(
  cx: number,
  cy: number,
  r: number,
  fill: string,
  center: string,
  opts: { n?: number; rot?: number; notch?: boolean; inner?: string; edge?: string; stamen?: string; anther?: string } = {},
) {
  const n = opts.n ?? 5;
  const rot = opts.rot ?? 0;
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 360) / n;
    const t = `rotate(${f(a)} ${f(cx)} ${f(cy)})`;
    if (opts.notch) {
      const d = `M${f(cx)} ${f(cy)}C${f(cx - r * 0.78)} ${f(cy - r * 0.32)} ${f(cx - r * 0.6)} ${f(cy - r * 1.06)} ${f(cx - r * 0.13)} ${f(cy - r)}L${f(cx)} ${f(cy - r * 0.8)}L${f(cx + r * 0.13)} ${f(cy - r)}C${f(cx + r * 0.6)} ${f(cy - r * 1.06)} ${f(cx + r * 0.78)} ${f(cy - r * 0.32)} ${f(cx)} ${f(cy)}Z`;
      s += `<path transform="${t}" d="${d}" fill="${fill}"${opts.edge ? ` stroke="${opts.edge}" stroke-width=".4"` : ''}/>`;
      if (opts.inner) s += `<path transform="${t}" d="M${f(cx)} ${f(cy)}C${f(cx - r * 0.34)} ${f(cy - r * 0.16)} ${f(cx - r * 0.24)} ${f(cy - r * 0.5)} ${f(cx)} ${f(cy - r * 0.52)}C${f(cx + r * 0.24)} ${f(cy - r * 0.5)} ${f(cx + r * 0.34)} ${f(cy - r * 0.16)} ${f(cx)} ${f(cy)}Z" fill="${opts.inner}"/>`;
    } else {
      s += `<circle transform="${t}" cx="${f(cx)}" cy="${f(cy - r * 0.55)}" r="${f(r * 0.47)}" fill="${fill}"/>`;
      if (opts.inner) s += `<circle transform="${t}" cx="${f(cx)}" cy="${f(cy - r * 0.6)}" r="${f(r * 0.3)}" fill="${opts.inner}"/>`;
    }
  }
  s += C(cx, cy, r * 0.22, center);
  // stamens: fine filaments with anther dots
  let fil = '';
  let dots = '';
  const k = n * 2;
  for (let i = 0; i < k; i++) {
    const a = ((rot + (i * 360) / k + 18) * Math.PI) / 180;
    const rr = r * (i % 2 ? 0.42 : 0.52);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    fil += `M${f(cx)} ${f(cy)}L${f(x)} ${f(y)}`;
    dots += `M${f(x)} ${f(y)}h0`;
  }
  s += S(fil, opts.stamen ?? center, Math.max(0.3, r * 0.035));
  s += S(dots, opts.anther ?? '#f4d58a', Math.max(0.9, r * 0.12));
  return s;
}

/** Two-tone pointed leaf from (x, y) at angle (deg; 0 = up), with a midrib. */
function leaf(x: number, y: number, len: number, w: number, angle: number, fill: string, shade?: string, vein?: string) {
  const d = `M0 0C${f(-w * 0.95)} ${f(-len * 0.22)} ${f(-w * 0.8)} ${f(-len * 0.72)} 0 ${f(-len)}C${f(w * 0.8)} ${f(-len * 0.72)} ${f(w * 0.95)} ${f(-len * 0.22)} 0 0Z`;
  let s = P(d, fill);
  if (shade) s += P(`M0 0C${f(w * 0.95)} ${f(-len * 0.22)} ${f(w * 0.8)} ${f(-len * 0.72)} 0 ${f(-len)}Z`, shade);
  if (vein) s += S(`M0 ${f(-len * 0.08)}Q${f(w * 0.12)} ${f(-len * 0.5)} 0 ${f(-len * 0.88)}`, vein, Math.max(0.3, w * 0.1));
  return G(`translate(${f(x)} ${f(y)}) rotate(${f(angle)})`, s);
}

/** Palmate maple leaf: seven pointed lobes, a notch at the stem, a shaded half and veins. */
function mapleLeaf(cx: number, cy: number, r: number, rot: number, fill: string, shade = fill, vein = '#ffffff') {
  const pts: string[] = [];
  const half: string[] = [`${f(cx)},${f(cy)}`];
  const N = 84;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    // lobes point "up" (t = 0); the bottom of the circle is the stem notch
    const lobe = Math.pow(Math.abs(Math.cos((7 / 2) * t)), 1.6);
    const notch = Math.abs(Math.PI - t) < 0.55 ? 0.35 : 1;
    const rr = r * (0.54 + 0.46 * lobe) * notch;
    const a = t - Math.PI / 2 + (rot * Math.PI) / 180;
    const p = `${f(cx + Math.cos(a) * rr)},${f(cy + Math.sin(a) * rr)}`;
    pts.push(p);
    if (i <= N / 2) half.push(p);
  }
  let veins = '';
  for (let k = -3; k <= 3; k++) {
    const a = (k * 2 * Math.PI) / 7 - Math.PI / 2 + (rot * Math.PI) / 180;
    veins += `M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a) * r * 0.84)} ${f(cy + Math.sin(a) * r * 0.84)}`;
  }
  const sa = Math.PI / 2 + (rot * Math.PI) / 180;
  return (
    S(`M${f(cx)} ${f(cy)}L${f(cx + Math.cos(sa) * r * 1.2)} ${f(cy + Math.sin(sa) * r * 1.2)}`, '#6e3420', Math.max(0.8, r * 0.08)) +
    `<polygon points="${pts.join(' ')}" fill="${fill}"/>` +
    `<polygon points="${half.join(' ')}" fill="${shade}"/>` +
    S(veins, vein, Math.max(0.35, r * 0.04), ' stroke-opacity=".38"')
  );
}

/* ------------------------------------------------------------------ */
/* The twelve months                                                   */
/* ------------------------------------------------------------------ */

const STYLES: MonthStyle[] = [
  // 1 · Pine: cloud-pruned needle pads on a gnarled trunk
  {
    tint: '#e3eadf',
    draw: () => {
      const bark = '#4a382d';
      const barkLt = '#7d6452';
      const pad = (cx: number, cy: number, w: number, h: number) => {
        const dome = (x: number, y: number, ww: number, hh: number) =>
          `M${f(x - ww)} ${f(y)}C${f(x - ww)} ${f(y - hh * 0.55)} ${f(x - ww * 0.62)} ${f(y - hh * 0.92)} ${f(x - ww * 0.32)} ${f(y - hh * 0.72)}C${f(x - ww * 0.18)} ${f(y - hh * 1.12)} ${f(x + ww * 0.22)} ${f(y - hh * 1.1)} ${f(x + ww * 0.34)} ${f(y - hh * 0.74)}C${f(x + ww * 0.62)} ${f(y - hh * 0.95)} ${f(x + ww)} ${f(y - hh * 0.58)} ${f(x + ww)} ${f(y)}C${f(x + ww * 0.55)} ${f(y + hh * 0.3)} ${f(x - ww * 0.55)} ${f(y + hh * 0.3)} ${f(x - ww)} ${f(y)}Z`;
        // bristle of needles around the rim
        let out = '';
        let inner = '';
        const n = Math.round(w * 1.3);
        for (let i = 0; i < n; i++) {
          const a = Math.PI + ((i + 0.5) / n) * Math.PI;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const r0 = 0.72;
          const r2 = 1.06 + (i % 3) * 0.04;
          out += `M${f(cx + ca * w * r0)} ${f(cy + sa * h * r0)}L${f(cx + ca * w * r2)} ${f(cy + sa * h * r2 - 0.4)}`;
          if (i % 2 === 0) inner += `M${f(cx + ca * w * 0.3)} ${f(cy - h * 0.18 + sa * h * 0.3)}L${f(cx + ca * w * 0.62)} ${f(cy - h * 0.18 + sa * h * 0.62)}`;
        }
        return (
          S(out, '#2b4d38', 0.6) +
          P(dome(cx, cy, w, h), '#2c5640') +
          P(dome(cx, cy - h * 0.12, w * 0.8, h * 0.74), '#3b6c4e') +
          P(dome(cx, cy - h * 0.32, w * 0.5, h * 0.46), '#4c7f5c') +
          S(inner, '#7aa883', 0.5, O(0.75)) +
          S(`M${f(cx - w * 0.82)} ${f(cy + 0.4)}C${f(cx - w * 0.4)} ${f(cy + h * 0.28)} ${f(cx + w * 0.4)} ${f(cy + h * 0.28)} ${f(cx + w * 0.82)} ${f(cy + 0.4)}`, '#1d3a29', 1.1, O(0.7))
        );
      };
      // bark scales along the trunk
      const trunk: Pt[] = [[38, 141], [43, 124], [51, 108], [46, 90], [49, 72], [54, 50]];
      let scales = '';
      smooth(trunk, 4).forEach(([x, y], i) => {
        if (i % 2 === 0 && y < 136) scales += `M${f(x - 2.2 + (i % 4))} ${f(y)}q1.4 -1.6 3 -.2`;
      });
      const cone = (x: number, y: number) =>
        E(x, y, 2, 2.8, '#7a5a3a') + S(`M${x - 1.6} ${y - 1}l3.2 1.4M${x - 1.8} ${y + 0.6}l3.4 1.2M${x + 1.6} ${y - 1.4}l-3 2.6M${x + 1.6} ${y + 0.4}l-3 2.2`, '#4a3426', 0.4);
      return (
        P('M4 124Q28 114 52 120T96 116L96 136L4 136Z', '#d4ddcc') +
        P('M4 130Q34 122 62 128T96 126L96 136L4 136Z', '#c4d1bc') +
        S('M14 127q6 -2 10 0M66 124q5 -1.6 9 0', '#b3c2aa', 0.6) +
        limb(trunk, 10.5, 4.2, bark, barkLt) +
        limb([[47, 94], [57, 90], [66, 83], [76, 79]], 4.4, 1.8, bark, barkLt) +
        limb([[49, 78], [40, 73], [30, 67]], 4, 1.6, bark, barkLt) +
        limb([[50, 109], [58, 106], [62, 103]], 3.4, 1.6, bark, barkLt) +
        S(scales, '#2f241d', 0.55, O(0.85)) +
        pad(53, 46, 31, 17) +
        pad(33, 69, 21, 12) +
        pad(73, 79, 20, 12) +
        cone(66, 86.5) +
        cone(71, 88) +
        pad(55, 106, 27, 13)
      );
    },
  },
  // 2 · Plum: an angular old branch, round crimson blossoms, buds and lichen dots
  {
    tint: '#f1e2e1',
    draw: () => {
      const bark = '#43332b';
      const barkLt = '#77604f';
      const fl = (x: number, y: number, r: number, rot: number) =>
        blossom(x, y, r, '#a63f57', '#6d2033', { rot, inner: '#bf5d71', stamen: '#f1d49a', anther: '#f7e2a6' });
      const bud = (x: number, y: number, r: number) => C(x, y, r, '#a63f57') + C(x - r * 0.3, y - r * 0.3, r * 0.45, '#c46b7e') + E(x, y + r * 0.9, r * 0.5, r * 0.35, '#4a3328');
      const moss = [[16, 120], [24, 108], [44, 92], [54, 78], [61, 64], [74, 52], [36, 88]] as Pt[];
      return (
        limb([[2, 134], [14, 122], [24, 106], [38, 98], [50, 84], [57, 66], [70, 58], [79, 44], [91, 34], [99, 30]], 7, 1.6, bark, barkLt) +
        limb([[38, 98], [32, 84], [24, 76], [20, 60]], 3.6, 1.1, bark, barkLt) +
        limb([[57, 66], [66, 72], [76, 71]], 2.4, 0.9, bark, barkLt) +
        limb([[70, 58], [64, 47], [66, 36]], 2.4, 0.9, bark, barkLt) +
        S('M24 106L15 99M79 44L87 48.5M50 84L45 78', bark, 1.1) +
        moss.map(([x, y], i) => C(x, y, i % 2 ? 0.8 : 1.1, i % 3 ? '#7d8a5c' : '#2b211b')).join('') +
        fl(20, 58, 10.5, 10) +
        fl(47, 85, 12.5, -8) +
        fl(69, 56, 11, 22) +
        fl(88, 33, 9.5, 4) +
        fl(30, 101, 9, 34) +
        fl(66, 35, 8.5, -16) +
        bud(77, 71, 2.8) + bud(15, 98, 2.4) + bud(95, 26.5, 2.2) + bud(40, 90, 2.4) + bud(58, 76, 2) + bud(26, 70, 2) +
        E(42, 121, 2.2, 1.5, '#b8546a', ' transform="rotate(20 42 121)" opacity=".8"') +
        E(62, 127, 2, 1.4, '#b8546a', ' transform="rotate(-30 62 127)" opacity=".7"') +
        E(78, 116, 1.8, 1.3, '#b8546a', ' transform="rotate(50 78 116)" opacity=".6"')
      );
    },
  },
  // 3 · Cherry: pale clouds of notched blossoms, a thin dark branch, a band of mist
  {
    tint: '#f5e7e8',
    draw: () => {
      const fl = (x: number, y: number, r: number, rot: number, light = true) =>
        blossom(x, y, r, light ? '#f2c6cd' : '#e8aab5', '#c25d73', { notch: true, rot, inner: light ? '#e7a2b0' : '#d98a99', edge: '#dc98a6', stamen: '#b5506a', anther: '#e3a04c' });
      const petal = (x: number, y: number, a: number) =>
        `<path transform="rotate(${a} ${x} ${y})" d="M${x} ${y}c-2 -1 -2.2 -4 -.5 -4.8l.5 .8l.5 -.8c1.7 .8 1.5 3.8 -.5 4.8z" fill="#eab3bd"/>`;
      // kasumi mist: stepped rounded bands
      const bar = (x0: number, x1: number, y: number, h: number) => `M${x0 + h / 2} ${y}H${x1 - h / 2}A${h / 2} ${h / 2} 0 0 1 ${x1 - h / 2} ${y + h}H${x0 + h / 2}A${h / 2} ${h / 2} 0 0 1 ${x0 + h / 2} ${y}Z`;
      return (
        P(bar(-6, 60, 103, 8) + bar(28, 108, 114, 8.4) + bar(-6, 46, 126, 8), '#eed5da') +
        P(bar(8, 40, 104.6, 4) + bar(46, 92, 115.6, 4), '#f6e6e9') +
        S('M2 103.6H56M32 114.6H104M2 126.6H42', '#fbf1f2', 0.7) +
        limb([[-2, 12], [14, 19], [28, 30], [38, 43], [44, 58]], 4.6, 1.4, '#4a3830', '#7a6153') +
        limb([[28, 30], [40, 25], [54, 22]], 2.6, 0.9, '#4a3830', '#7a6153') +
        limb([[38, 43], [52, 47], [66, 50]], 2.4, 0.9, '#4a3830', '#7a6153') +
        S('M44 58L44 66M66 50L72 52M54 22L54 30M44 58L30 40M44 58L24 84M66 50L76 84M30 40l-2 -8', '#6a4f45', 0.5, O(0.6)) +
        fl(62, 42, 7, 12, false) + fl(36, 54, 7.5, 30, false) + fl(86, 34, 6.5, 0, false) + fl(58, 88, 7, 20, false) +
        fl(30, 40, 13, 8) +
        fl(54, 30, 12, -14) +
        fl(72, 54, 14, 20) +
        fl(44, 67, 12, 0) +
        fl(22, 84, 10, 36) +
        fl(77, 84, 11, 4) +
        petal(14, 124, 30) + petal(88, 100, -40) + petal(58, 134, 70) + petal(90, 64, 10)
      );
    },
  },
  // 4 · Wisteria: a twisting vine with long tapering racemes of pea flowers
  {
    tint: '#ebe7f1',
    draw: () => {
      const raceme = (x: number, top: number, len: number, sway: number) => {
        const n = Math.round(len / 3.6);
        const at = (t: number): Pt => [x + Math.sin(t * Math.PI * 0.9) * sway, top + t * len];
        let axis = '';
        const fl: string[] = [];
        let y = 0;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const s = 6.8 * (1 - t * 0.68);
          const [ax] = at(Math.min(1, y / len));
          const side = i % 2 ? 1 : -1;
          const fx = ax + side * s * 0.4;
          const fy = top + y + 4;
          if (t < 0.78) {
            const top2 = t < 0.4 ? '#b2a5da' : '#9a8bc8';
            fl.push(
              E(fx, fy - s * 0.12, s * 0.62, s * 0.46, top2) +
                E(fx + side * s * 0.1, fy + s * 0.26, s * 0.44, s * 0.32, t < 0.4 ? '#6e5ea6' : '#5c4b8c') +
                E(fx - side * s * 0.18, fy - s * 0.28, s * 0.22, s * 0.14, '#efe9fa', O(0.6)),
            );
          } else {
            fl.push(E(fx, fy, s * 0.42, s * 0.55, '#4f4080'));
          }
          y += s * 0.8;
        }
        for (let k = 0; k <= 10; k++) {
          const [ax, ay] = at(k / 10);
          axis += `${k ? 'L' : 'M'}${f(ax)} ${f(ay)}`;
        }
        // later florets go behind earlier (upper) ones
        return S(axis, '#5a4a40', 0.8) + fl.reverse().join('');
      };
      const frond = (x: number, y: number, a: number, n: number) => {
        let s = '';
        for (let i = 0; i < n; i++) {
          const d = 3 + i * 4.4;
          s += leaf(d, -1.2, 6.4 - i * 0.3, 2.2, -64, '#5b7a52', '#4a6845', '#7f9c72') + leaf(d, 1.2, 6.4 - i * 0.3, 2.2, -116, '#6d8c62', '#5b7a52', '#93ad86');
        }
        return G(`translate(${x} ${y}) rotate(${a})`, S(`M0 0H${3 + n * 4.4}`, '#5a4a40', 0.6) + s + leaf(3 + n * 4.4, 0, 6, 2.2, 90, '#6d8c62', '#5b7a52'));
      };
      return (
        frond(14, 14, 120, 4) +
        frond(86, 15, 60, 4) +
        limb([[-2, 14], [20, 10], [40, 16], [60, 10], [80, 15], [102, 11]], 4.6, 3, '#4a3830', '#7a6153') +
        S('M8 13l2 -3M30 14l2 -3.4M50 14l2 -3.4M70 12l2 -3.4M90 13l2 -3', '#2f241d', 0.6, O(0.7)) +
        frond(50, 12, -20, 3) +
        raceme(23, 15, 74, 2.4) +
        raceme(43, 13, 104, -3) +
        raceme(63, 12, 88, 2.6) +
        raceme(82, 14, 62, -2)
      );
    },
  },
  // 5 · Iris: sword leaves, blue-violet flowers with veined falls, still water
  {
    tint: '#e5e8f2',
    draw: () => {
      const bl = (pts: Pt[], w: number, fill: string, rib: string) => P(taper(pts, (t) => w * Math.pow(1 - t, 0.75)), fill) + S(curve(pts.slice(0, -1)), rib, 0.5, O(0.7));
      const iris = (cx: number, cy: number, s: number) =>
        G(
          `translate(${cx} ${cy}) scale(${s})`,
          // sheath + standards (upright)
          P('M-2.2 5L0 14L2.2 5Z', '#3f6e4d') +
            P('M0 1C-5 -3 -8.4 -11 -5.6 -18.4C-3.4 -15.4 -1 -8 0 1Z', '#8a98d4') +
            P('M0 1C5 -3 8.4 -11 5.6 -18.4C3.4 -15.4 1 -8 0 1Z', '#7b8acb') +
            P('M0 2C-3.4 -5 -2.8 -15 0 -21C2.8 -15 3.4 -5 0 2Z', '#6676bd') +
            S('M0 -1V-17', '#a9b5e6', 0.5) +
            // falls (drooping)
            P('M0 0C-6 -3.4 -14.4 -1.4 -16.6 5.6C-17.6 11 -13.2 14.2 -9.4 11.2C-6 8.2 -3 4.4 0 2.2Z', '#3d4c98') +
            P('M0 0C6 -3.4 14.4 -1.4 16.6 5.6C17.6 11 13.2 14.2 9.4 11.2C6 8.2 3 4.4 0 2.2Z', '#35448c') +
            P('M-3 1.4C-6.2 1.2 -9.4 2.4 -10.6 4.6C-7.6 4.4 -5 3.2 -3 1.4ZM3 1.4C6.2 1.2 9.4 2.4 10.6 4.6C7.6 4.4 5 3.2 3 1.4Z', '#ecc65c') +
            S('M-5 3L-13 6.4M-5.6 4.4L-12 9.4M-4.4 5L-9 10.6M5 3L13 6.4M5.6 4.4L12 9.4M4.4 5L9 10.6', '#e8ecff', 0.35, O(0.55)) +
            P('M-2 1.6C-3.6 5 -3.4 10 -1 13.4C.4 14.4 1.6 13.6 1.8 12C2.6 8 2.4 4 1.4 1.6Z', '#4b5ca6') +
            S('M0 3.6V11', '#e8ecff', 0.35, O(0.5)),
        );
      const bud = (x: number, y: number) => P(`M${x} ${y}c-2.6 -4 -2.4 -9 0 -13c2.4 4 2.6 9 0 13z`, '#4b5ca6') + P(`M${x - 1.6} ${y}c.4 -3 1 -5 1.6 -7c.6 2 1.2 4 1.6 7z`, '#3f6e4d');
      return (
        S('M8 129Q20 126 32 129M58 132Q72 129 86 132M30 135Q44 132.6 56 135', '#bcc6de', 0.7) +
        bl([[16, 142], [17, 112], [14, 80], [20, 46]], 5.4, '#3f6e4d', '#6f9b76') +
        bl([[86, 142], [84, 110], [88, 82], [83, 50]], 5.4, '#3a6849', '#6f9b76') +
        S('M25 142C25 120 25.6 92 28 56', '#3f6e4d', 1.8) +
        S('M70 142C69 116 68.6 78 70 42', '#3f6e4d', 1.8) +
        S('M55 142C55 124 55.4 100 56 86', '#3f6e4d', 1.6) +
        S('M40 142C40 120 40 90 41 74', '#3f6e4d', 1.3) +
        bl([[30, 142], [33, 114], [39, 90], [49, 64]], 5, '#557f5a', '#86ad89') +
        bl([[60, 142], [57, 114], [62, 92], [59, 70]], 4.6, '#4a7754', '#7aa37f') +
        bl([[45, 142], [47, 122], [41, 104], [34, 92]], 4, '#6a9670', '#94b998') +
        bl([[73, 142], [75, 122], [81, 106], [93, 94]], 4.2, '#5b8a63', '#8bb390') +
        bud(41, 74) +
        iris(28, 48, 1.05) +
        iris(70, 34, 1.15) +
        iris(56, 80, 0.85)
      );
    },
  },
  // 6 · Peony: a big ruffled bloom in layered rings, divided leaves, a bud
  {
    tint: '#f3e3e0',
    draw: () => {
      const petal = (r: number, w: number) =>
        `M0 0C${f(-w * 0.9)} ${f(-r * 0.3)} ${f(-w)} ${f(-r * 0.8)} ${f(-w * 0.62)} ${f(-r * 0.95)}Q${f(-w * 0.32)} ${f(-r * 1.06)} 0 ${f(-r * 0.95)}Q${f(w * 0.32)} ${f(-r * 1.07)} ${f(w * 0.62)} ${f(-r * 0.95)}C${f(w)} ${f(-r * 0.8)} ${f(w * 0.9)} ${f(-r * 0.3)} 0 0Z`;
      const ring = (cx: number, cy: number, r: number, w: number, n: number, fill: string, edge: string, rot: number) => {
        let s = '';
        const d = petal(r, w);
        const rr = rng(Math.round(r * 10));
        let lines = '';
        for (let i = 0; i < n; i++) {
          const a = rot + (i * 360) / n + (rr() - 0.5) * 12;
          const k = 0.92 + rr() * 0.14;
          const tr = `translate(${cx} ${cy}) rotate(${f(a)}) scale(${f(1 + (rr() - 0.5) * 0.16)} ${f(k)})`;
          s += `<path transform="${tr}" d="${d}"/>`;
          lines += `<path transform="${tr}" d="M0 ${f(-r * 0.3)}L0 ${f(-r * 0.84)}M${f(-w * 0.4)} ${f(-r * 0.5)}L${f(-w * 0.3)} ${f(-r * 0.86)}"/>`;
        }
        return `<g fill="${fill}" stroke="${edge}" stroke-width=".55">${s}<g fill="none" stroke-width=".4" stroke-opacity=".7">${lines}</g></g>`;
      };
      const group = (x: number, y: number, a: number, s = 1) =>
        G(
          `translate(${x} ${y}) rotate(${a}) scale(${s})`,
          leaf(0, 0, 17, 6, -36, '#4c6b4c', '#3f5c40', '#7f9c78') + leaf(0, 0, 17, 6, 36, '#5d7d5b', '#4c6b4c', '#8daa86') + leaf(0, 0, 23, 7.4, 0, '#55744f', '#45633f', '#88a681'),
        );
      const cx = 50;
      const cy = 64;
      let stam = '';
      for (let i = 0; i < 14; i++) {
        const a = (i * 2.4) % (Math.PI * 2);
        const rr = 1.2 + (i % 4) * 0.9;
        stam += C(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.75, i % 3 ? '#f3d27a' : '#c98a2e');
      }
      return (
        S('M50 140C48 126 40 118 26 112M50 140C52 126 60 118 74 112M50 92C42 98 36 100 30 102M50 92C58 98 64 99 70 100', '#4c6b4c', 1.3) +
        group(25, 134, -40, 1.25) + group(75, 134, 40, 1.25) + group(50, 142, 0, 1.3) + group(30, 102, -70, 1.05) + group(70, 100, 70, 1.05) +
        S('M50 92C52 70 64 46 76 32', '#4c6b4c', 1.4) +
        leaf(70, 42, 9, 3.4, 40, '#5d7d5b', '#4c6b4c') +
        // bud
        C(78, 28, 6.4, '#a8333f') + P('M73 26C74 21 78 19 80.6 21C78.6 22.4 77.4 24.6 77.4 27Z', '#c4505d') +
        P('M72.6 30C74 34 78 35.4 81.4 33.4C79.6 32.6 77 32.4 75 30.6ZM84 27.4C84.6 31.4 82.6 34 80 34.8', '#4c6b4c') +
        ring(cx, cy, 28, 13.5, 8, '#9a2c3a', '#7a1f2c', 0) +
        ring(cx, cy, 21, 11, 7, '#b8404f', '#8f2c3a', 24) +
        ring(cx, cy, 14.5, 8.4, 6, '#cf5e69', '#a83f4c', 8) +
        ring(cx, cy, 8.6, 5.6, 5, '#e48690', '#c25f6b', 36) +
        C(cx, cy, 4.4, '#e3b24f') + stam
      );
    },
  },
  // 7 · Bush clover: arching sprays, trifoliate leaves, tiny magenta pea flowers
  {
    tint: '#f1e5eb',
    draw: () => {
      let leaves = '';
      let flowers = '';
      let stems = '';
      const tri = (x: number, y: number, a: number, k: number) =>
        G(
          `translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(1.15)`,
          E(0, -4.4, 1.9, 2.9, k % 2 ? '#4d6b45' : '#62824f') +
            E(-2.6, -2, 1.6, 2.4, k % 2 ? '#62824f' : '#4d6b45', ' transform="rotate(-58 -2.6 -2)"') +
            E(2.6, -2, 1.6, 2.4, '#557548', ' transform="rotate(58 2.6 -2)"') +
            S('M0 0V-6.4', '#89a777', 0.35),
        );
      const pea = (x: number, y: number) => E(x, y, 1.75, 1.4, '#a83c7a') + E(x - 0.45, y - 0.7, 1, 0.8, '#da86b0');
      const spray = (pts: Pt[], w: number, seed: number) => {
        const r = rng(seed);
        stems += P(taper(pts, lin(w, 0.5)), '#4f3a32');
        const s = smooth(pts, 8);
        for (let i = 2; i < s.length - 1; i += 3) {
          const [x, y] = s[i];
          const [x2, y2] = s[i + 1];
          const dir = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
          const side = i % 2 === 0 ? 1 : -1;
          leaves += tri(x, y, dir + 90 + side * (55 + r() * 25), i);
          if (i % 2 === 1) flowers += pea(x - side * 2, y + 1.8) + pea(x - side * 3.2, y + 4) + pea(x - side * 2.2, y + 6);
        }
        const [ex, ey] = s[s.length - 1];
        flowers += pea(ex, ey + 1) + pea(ex - 1.6, ey + 3.4) + pea(ex + 1, ey + 5.6) + pea(ex - 0.4, ey + 7.8);
      };
      spray([[99, 6], [80, 11], [60, 23], [42, 43], [30, 67], [22, 96], [20, 116]], 1.9, 1);
      spray([[99, 38], [82, 43], [66, 57], [56, 77], [50, 99], [48, 122]], 1.8, 2);
      spray([[75, 3], [66, 24], [66, 48], [72, 72], [80, 94], [84, 112]], 1.7, 3);
      spray([[99, 74], [90, 82], [86, 96], [87, 104]], 1.2, 4);
      return S('M4 132Q30 126 56 131T96 128', '#d9c3cf', 1.2) + stems + leaves + flowers;
    },
  },
  // 8 · Silver grass: the black hill, airy drooping plumes against the sky
  {
    tint: '#ece4d2',
    draw: () => {
      const r = rng(8);
      let blades = '';
      let under = '';
      let fibres = '';
      let rach = '';
      for (let i = 0; i < 9; i++) {
        const x = 9 + i * 10.4 + (r() - 0.5) * 3;
        const base = 92 - Math.sin(i * 0.9) * 6;
        const h = 32 + ((i * 37) % 22);
        const lean = 6 + (i % 3) * 4;
        const tx = x + lean;
        const ty = base - h;
        blades += P(taper([[x, base + 4], [x + 1, base - h * 0.6], [tx, ty]], lin(1.6, 0.4)), '#8a8170');
        // plume: a nodding rachis with fine silky branches falling from it
        const len = 14 + r() * 4;
        const dx = 4 + r() * 3;
        const core: Pt[] = [[tx, ty], [tx + dx * 0.6, ty + len * 0.35], [tx + dx, ty + len]];
        rach += curve(core, 4);
        smooth(core, 4).forEach(([px, py], k) => {
          if (k === 0) return;
          const l = 5 + (1 - k / 8) * 3 + r() * 1.5;
          for (const sd of [-1, 1]) {
            const seg = `M${f(px)} ${f(py)}q${f(sd * l * 0.45)} ${f(l * 0.15)} ${f(sd * l * 0.55 + 0.6)} ${f(l * 0.8)}`;
            under += seg;
            fibres += seg;
          }
        });
      }
      // a few long arching leaves
      const arch = (pts: Pt[]) => P(taper(pts, blade(2.2, 0.2)), '#6f6757');
      // neat tufts along the ridge, in a slightly lighter ink
      let tufts = '';
      const ridge: Pt[] = [[4, 94], [22, 82], [42, 86], [62, 90], [76, 79], [87, 73], [96, 77]];
      smooth(ridge, 6).forEach(([x, y], k) => {
        if (k % 2) return;
        tufts += `M${f(x - 1.4)} ${f(y + 6)}q.4 -2.6 -.6 -4.6M${f(x)} ${f(y + 6)}q.2 -3 1 -5.4M${f(x + 1.4)} ${f(y + 6)}q.2 -2 1.6 -3.6`;
      });
      return (
        blades +
        arch([[20, 96], [24, 74], [36, 64], [44, 66]]) +
        arch([[74, 90], [70, 66], [58, 56], [52, 58]]) +
        S(under, '#bfae88', 1.3, O(0.55)) +
        S(fibres, '#f5eedc', 0.6) +
        S(rach, '#a89772', 0.6) +
        P('M4 94Q22 80 42 85Q62 90 76 79Q87 72 96 77L96 136L4 136Z', '#2e2b2a') +
        S('M4 94.6Q22 80.6 42 85.6Q62 90.6 76 79.6Q87 72.6 96 77.6', '#4c4640', 1.4) +
        S(tufts, '#4f4943', 0.6) +
        P('M4 116Q36 104 66 112T96 108L96 136L4 136Z', '#252220') +
        S('M8 112Q30 104 56 109M60 118Q76 113 92 115', '#3c3733', 0.8)
      );
    },
  },
  // 9 · Chrysanthemum: many-petalled golden kiku (and one pale), lobed leaves
  {
    tint: '#f4ebd8',
    draw: () => {
      const mum = (cx: number, cy: number, r: number, pal: string[]) => {
        let s = C(cx, cy, r * 0.98, pal[0], O(0.35));
        const rings: [number, number, number, number, string][] = [
          [26, 0.62, 0.15, 0.4, pal[0]],
          [22, 0.52, 0.14, 0.34, pal[1]],
          [16, 0.38, 0.13, 0.27, pal[2]],
          [11, 0.24, 0.12, 0.2, pal[3]],
        ];
        s += `<g stroke="${pal[4]}" stroke-width=".3" stroke-opacity=".55">`;
        rings.forEach(([n, dist, rx, ry, fill], k) => {
          s += `<g fill="${fill}">`;
          for (let i = 0; i < n; i++) {
            const a = (i * 360) / n + k * 7;
            s += `<ellipse transform="rotate(${f(a)} ${cx} ${cy})" cx="${cx}" cy="${f(cy - r * dist)}" rx="${f(r * rx * 0.62)}" ry="${f(r * ry)}"/>`;
          }
          s += '</g>';
        });
        return s + '</g>' + C(cx, cy, r * 0.11, pal[4]);
      };
      const gold = ['#b8771f', '#d29433', '#e6b24f', '#f3d17f', '#9a5f17'];
      const pale = ['#c9b78c', '#e3d6b4', '#f0e7cd', '#faf4e2', '#a89466'];
      const lobed = (cx: number, cy: number, R: number, rot: number) => {
        const half: Pt[] = [[0, 0], [0.24, -0.1], [0.36, -0.27], [0.2, -0.35], [0.4, -0.5], [0.2, -0.62], [0.3, -0.78], [0.1, -0.9], [0, -1]];
        const L = R * 2;
        const side = (k: number) => half.map(([x, y]): Pt => [x * L * k, y * L]);
        const right = smooth(side(1), 3);
        const left = smooth(side(-1), 3).reverse();
        const pt = ([x, y]: Pt) => `${f(x)} ${f(y)}`;
        const d = `M${right.map(pt).join('L')}L${left.map(pt).join('L')}Z`;
        const dr = `M${right.map(pt).join('L')}Z`;
        const v = `M0 0L0 ${f(-L * 0.92)}M0 ${f(-L * 0.2)}L${f(L * 0.26)} ${f(-L * 0.4)}M0 ${f(-L * 0.2)}L${f(-L * 0.26)} ${f(-L * 0.4)}M0 ${f(-L * 0.48)}L${f(L * 0.2)} ${f(-L * 0.68)}M0 ${f(-L * 0.48)}L${f(-L * 0.2)} ${f(-L * 0.68)}`;
        return G(`translate(${cx} ${cy}) rotate(${rot})`, P(d, '#52734b') + P(dr, '#41613c') + S(v, '#86a578', 0.5, O(0.85)));
      };
      return (
        S('M30 142C32 116 30 98 34 80M67 142C64 114 70 92 67 56M74 142C75 124 72 110 72 100', '#4b6b45', 2.6) +
        lobed(31, 122, 10, -58) + lobed(68, 116, 10, 52) + lobed(66, 134, 9, -40) + lobed(33, 98, 8.5, 44) + lobed(73, 128, 8, 70) +
        mum(34, 70, 24, gold) + mum(68, 42, 22, gold) + mum(73, 96, 14, pale)
      );
    },
  },
  // 10 · Maple: a dark branch of veined, two-tone leaves in autumn reds and ochre
  {
    tint: '#f4e2d8',
    draw: () => {
      const red = ['#b5382a', '#93291f'];
      const ver = ['#cf5a32', '#a9432a'];
      const ora = ['#dd8a3e', '#b96c2c'];
      const och = ['#cf9f42', '#ae8131'];
      const L = (x: number, y: number, r: number, a: number, c: string[]) => mapleLeaf(x, y, r, a, c[0], c[1]);
      return (
        limb([[100, 13], [80, 18], [62, 30], [48, 44], [38, 62], [30, 82], [22, 104], [10, 124]], 3.8, 1.2, '#43302a', '#77584a') +
        S('M62 30L58 22M48 44L60 48M38 62L28 58M30 82L40 84M22 104L32 108M80 18L84 26', '#43302a', 0.9) +
        L(77, 30, 15, 10, red) +
        L(53, 47, 16.5, -12, ver) +
        L(26, 64, 14, 24, red) +
        L(62, 77, 13, -30, ora) +
        L(41, 99, 15, 14, ver) +
        L(18, 115, 11, -20, red) +
        L(81, 107, 12, 30, och) +
        L(86, 58, 8, 50, ver) +
        L(66, 128, 7, 140, ora)
      );
    },
  },
  // 11 · Willow: rain falling through hanging strands, a dark stream below
  {
    tint: '#e1e7e6',
    draw: () => {
      const r = rng(11);
      let rain = '';
      let rain2 = '';
      for (let i = 0; i < 34; i++) {
        const x = 2 + r() * 100;
        const y = 4 + r() * 110;
        const l = 10 + r() * 16;
        const seg = `M${f(x)} ${f(y)}l${f(-l * 0.28)} ${f(l)}`;
        if (i % 3) rain += seg;
        else rain2 += seg;
      }
      const strand = (x: number, y: number, len: number, bend: number, seed: number) => {
        const rr = rng(seed);
        const pts: Pt[] = [[x, y], [x + bend * 0.35, y + len * 0.35], [x + bend * 0.75, y + len * 0.7], [x + bend, y + len]];
        let s = P(taper(pts, lin(1.4, 0.4)), '#5d7d4c');
        smooth(pts, 6).forEach(([px, py], k) => {
          if (k < 2) return;
          const side = k % 2 ? 1 : -1;
          s += leaf(px, py, 6.8 + rr() * 1.6, 1.6, 180 + side * (22 + rr() * 12) + bend * 0.6, k % 3 ? '#7ea567' : '#56804a', k % 3 ? '#6b9356' : undefined);
        });
        return s;
      };
      return (
        S(rain, '#8a9ca8', 0.55, O(0.8)) +
        S(rain2, '#a9b8c1', 0.9, O(0.6)) +
        limb([[30, -2], [38, 14], [42, 32], [38, 50], [32, 66], [28, 84]], 6, 2.2, '#3f3a33', '#6c665c') +
        limb([[40, 26], [52, 21], [66, 22]], 2.4, 1, '#3f3a33', '#6c665c') +
        strand(36, 6, 76, -10, 1) +
        strand(44, 14, 84, 10, 2) +
        strand(52, 22, 94, 14, 3) +
        strand(64, 22, 70, 18, 4) +
        strand(40, 40, 72, -8, 5) +
        strand(34, 62, 56, -12, 6) +
        strand(30, 80, 40, 6, 7) +
        P('M4 124Q30 116 56 124T96 121L96 136L4 136Z', '#4c5a5f') +
        S('M12 129h12M40 131h16M66 127.6h14M24 133.4h10', '#8a9ca8', 0.6) +
        E(30, 128.6, 2.4, 0.8, 'none', ' stroke="#a9b8c1" stroke-width=".4"') +
        E(74, 130, 3, 1, 'none', ' stroke="#a9b8c1" stroke-width=".4"')
      );
    },
  },
  // 12 · Paulownia: the kiri crest (五七桐) as a plant. Three broad heart-shaped
  // leaves fan out below; three upright stalks carry 5, 7 and 5 trefoil florets.
  {
    tint: '#efdfb4',
    draw: () => {
      const stalk = '#6b5636';
      // one floret: a lavender bell with a three-lobed mouth, on a brown calyx
      const floret = (x: number, y: number, a: number, s: number) =>
        G(
          `translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(${f(s)})`,
          P('M-1.5 -1C-2.3 -3.6 -3.9 -5.6 -4.1 -7.7C-4.2 -9.5 -2.8 -10.2 -1.7 -9.4C-1.3 -11 1.3 -11 1.7 -9.4C2.8 -10.2 4.2 -9.5 4.1 -7.7C3.9 -5.6 2.3 -3.6 1.5 -1Z', '#a88bc8') +
            P('M0 -1.2C1.4 -3.6 2.6 -6 2.8 -8.4C3.4 -9.8 4.3 -9.2 4.1 -7.7C3.9 -5.6 2.3 -3.6 1.5 -1Z', '#7f5f9e') +
            P('M-1.2 -8.6C-.8 -9.9 .8 -9.9 1.2 -8.6C.9 -7.4 -.9 -7.4 -1.2 -8.6Z', '#f3e8f6', O(0.85)) +
            S('M0 -2.4V-6.6', '#e9dcf0', 0.4, O(0.6)) +
            E(0, -0.4, 1.7, 1.5, '#8a6a3c') +
            E(-0.5, -0.8, 0.7, 0.5, '#b08d58', O(0.8)),
        );
      // a stalk with its florets: one at the tip and pairs below it
      const raceme = (x: number, base: number, top: number, pairs: number, bend: number, sz: number) => {
        const pts: Pt[] = [[x + bend, base], [x + bend * 0.35, base - (base - top) * 0.45], [x, top]];
        let s = P(taper(pts, lin(1.9, 0.9)), stalk);
        const fl: string[] = [floret(x, top + 1, 0, sz * 1.05)];
        for (let k = 0; k < pairs; k++) {
          const y = top + 7.4 + k * 8.4;
          const side = k % 2 ? 1 : -1;
          s += S(`M${x} ${f(y + 1.6)}l-3.4 -1.6M${x} ${f(y + 1.6)}l3.4 -1.6`, stalk, 0.7);
          fl.push(floret(x - 3.6, y, -42 + side * 4, sz), floret(x + 3.6, y, 42 + side * 4, sz));
        }
        return s + fl.reverse().join('');
      };
      // a broad heart-shaped leaf hanging from (0,0), tip pointing down, with palmate veins
      const leafD = (() => {
        const half: Pt[] = [[0, 3], [3, -1.6], [8, -2.4], [13.4, 1], [16, 7.4], [15.4, 14], [12.6, 19.6], [8.4, 25], [4, 30], [0, 35]];
        const R = smooth(half, 4);
        const pt = ([px, py]: Pt) => `${f(px)} ${f(py)}`;
        return {
          full: `M${R.map(pt).join('L')}L${R.slice().reverse().map(([px, py]) => pt([-px, py])).join('L')}Z`,
          right: `M${R.map(pt).join('L')}Z`,
        };
      })();
      const veins =
        'M0 2.6Q.4 18 0 33' +
        'M0 4Q6 2 11.6 3.4M0 5.4Q8 8 13.4 11.6M0 8Q6.4 15 9.6 21.4M0 13Q3.6 20 5 26.6' +
        'M0 4Q-6 2 -11.6 3.4M0 5.4Q-8 8 -13.4 11.6M0 8Q-6.4 15 -9.6 21.4M0 13Q-3.6 20 -5 26.6' +
        'M6 3.2l1.4 2.4M10 6.4l.4 3M8 14.6l2.4 .6M-6 3.2l-1.4 2.4M-10 6.4l-.4 3M-8 14.6l-2.4 .6';
      const kiri = (x: number, y: number, a: number, s: number, fill: string, shade: string) =>
        G(`translate(${x} ${y}) rotate(${a}) scale(${s})`, P(leafD.full, fill) + P(leafD.right, shade) + S(veins, '#93ad7c', 0.45, O(0.85)) + S('M0 3L0 -2', '#4a5a2e', 1));
      return (
        // stalks rise from behind the leaves
        raceme(26.6, 88, 32, 2, 15, 1.12) +
        raceme(73.4, 88, 34, 2, -14, 1.12) +
        raceme(50, 90, 19, 3, 0, 1.12) +
        // the three leaves: the two side ones first, the centre one in front
        kiri(47, 84, 60, 1.22, '#4c6d41', '#3c5a33') +
        kiri(53, 84, -58, 1.22, '#4c6d41', '#3c5a33') +
        kiri(50, 86, 2, 1.3, '#56784a', '#44633b') +
        E(50, 86, 2.4, 1.7, '#4a5a2e')
      );
    },
  },
];

/** Symbols drawn once and cached. */
const motifCache = new Map<number, string>();
const motif = (m: number) => {
  if (!motifCache.has(m)) motifCache.set(m, STYLES[m].draw());
  return motifCache.get(m)!;
};

/** Tanzaku slip: folded over at the top, a hairline border, a paper edge and a soft shadow. */
function ribbon(def: CardDef, month: number): string {
  const blue = def.ribbon === 'blue';
  const poetry = def.ribbon === 'poetry';
  const fold = blue ? '#1d3048' : '#7a2219';
  const outline = 'M40 58L60 58L60 118L50 113.4L40 118Z';
  let s =
    `<g transform="rotate(-10 50 86)">` +
    S('M50 58C49 54 51.4 51 50 47', '#c9a24a', 0.7) +
    P(outline, '#000', ' opacity=".16" transform="translate(1.8 2)"') +
    `<path d="${outline}" fill="${PAPER}" stroke="${PAPER}" stroke-width="2.6" stroke-linejoin="round"/>` +
    P(outline, blue ? 'url(#rib-blue)' : 'url(#rib-red)') +
    // folded flap at the top, the crease and its shadow
    P('M40 58L60 58L60 63.6L40 63.6Z', fold) +
    P('M40 63.6L60 63.6L60 65.4L40 65.4Z', '#000', O(0.14)) +
    S('M40.6 63.6H59.4', '#fff', 0.4, O(0.35)) +
    `<path d="M42.3 67.4H57.7V114.6L50 111L42.3 114.6Z" fill="none" stroke="${poetry ? '#e6c36c' : PAPER}" stroke-opacity="${poetry ? 0.75 : 0.4}" stroke-width=".45"/>`;
  if (poetry) {
    const text = month === 2 ? ['み', 'よ', 'し', 'の'] : ['あ', 'か', 'よ', 'ろ', 'し'];
    const y0 = text.length === 4 ? 76.6 : 74.6;
    text.forEach((ch, i) => {
      s += `<text x="50" y="${f(y0 + i * 9)}" text-anchor="middle" font-size="8.4" font-family="'Zen Old Mincho', serif" font-weight="600" fill="${PAPER}">${ch}</text>`;
    });
  }
  return s + '</g>';
}

/** Small corner tag naming a special card in kanji (vermilion = bright, gold = animal). */
function glyphTag(glyph: string, bright: boolean, look?: CardLook): string {
  const ring = bright ? VERMILION : GOLD;
  if (look?.chip) {
    const c = look.chip;
    return (
      `<rect x="73.6" y="115.6" width="20" height="19" rx="4.5" fill="#000" opacity=".16"/>` +
      `<rect x="73" y="115" width="20" height="19" rx="4.5" fill="${c.paper}"/>` +
      `<rect x="74.4" y="116.4" width="17.2" height="16.2" rx="3.4" fill="none" stroke="${ring}" stroke-width="1.1"/>` +
      `<text x="83" y="128.6" text-anchor="middle" font-size="11" font-family="'Zen Old Mincho', serif" font-weight="600" fill="${c.ink}">${glyph}</text>`
    );
  }
  return (
    `<rect x="73.6" y="115.6" width="20" height="19" rx="4.5" fill="#000" opacity=".12"/>` +
    `<rect x="73" y="115" width="20" height="19" rx="4.5" fill="${PAPER}"/>` +
    `<rect x="74.4" y="116.4" width="17.2" height="16.2" rx="3.4" fill="none" stroke="${ring}" stroke-width="1.1"/>` +
    `<rect x="75.9" y="117.9" width="14.2" height="13.2" rx="2.4" fill="none" stroke="${ring}" stroke-opacity=".45" stroke-width=".35"/>` +
    `<text x="83" y="128.6" text-anchor="middle" font-size="11" font-family="'Zen Old Mincho', serif" font-weight="600" fill="${INK}">${glyph}</text>`
  );
}

/** Paper card with its tinted panel (shared by faces and the snow card). */
const cardBase = (tint: string) =>
  `<rect width="100" height="140" rx="9" fill="${PAPER}"/>` +
  `<rect x=".4" y=".4" width="99.2" height="139.2" rx="8.6" fill="none" stroke="#8a7458" stroke-opacity=".28" stroke-width=".7"/>` +
  `<rect x="4" y="4" width="92" height="132" rx="6" fill="${tint}"/>` +
  `<rect x="4" y="4" width="92" height="132" rx="6" fill="url(#card-fiber)"/>`;

/** Printed finish: sheen, soft vignette, a double rule and tiny registration ticks. */
const cardFinish =
  `<rect x="4" y="4" width="92" height="132" rx="6" fill="url(#card-vig)"/>` +
  `<rect x="4" y="4" width="92" height="132" rx="6" fill="url(#card-sheen)"/>` +
  `<rect x="4.3" y="4.3" width="91.4" height="131.4" rx="5.7" fill="none" stroke="${INK}" stroke-opacity=".2" stroke-width=".6"/>` +
  `<rect x="2.1" y="2.1" width="95.8" height="135.8" rx="7.4" fill="none" stroke="#a58a63" stroke-opacity=".4" stroke-width=".35"/>` +
  `<path d="M48.6 2.1L50 .9L51.4 2.1L50 3.3ZM48.6 137.9L50 136.7L51.4 137.9L50 139.1Z" fill="${VERMILION}" opacity=".42"/>`;

/**
 * Per-deck-style hooks (see styles.ts). Colours written here should be
 * UPPERCASE hex: the deck-style painter only rewrites lowercase hex, so these
 * stay exactly as given.
 */
export interface CardLook {
  /** drawn over the paper panel, under the art */
  under?: (id: number) => string;
  /** drawn over the art and the printed finish, under the corner chip */
  over?: (id: number) => string;
  /** colours for the corner chip and the kanji tag */
  chip?: { paper: string; ink: string; edge: string };
}

/** Full SVG markup (inner) for one card id. */
export function cardInner(id: number, look?: CardLook): string {
  if (isBonus(id)) return bonusInner(id, look);
  const month = id >> 2;
  const variant = id & 3;
  const def = cardDef(id);
  const style = STYLES[month];
  const special = SPECIALS[id];
  let bg = cardBase(style.tint);
  if (look?.under) bg += look.under(id);
  if (special?.back) bg += `<g clip-path="url(#card-clip)">${special.back}</g>`;

  // A second plain card is the mirror image, so pairs aren't pixel-identical.
  const plainAlt = def.kind === 'plain' && variant > 0;
  const use = `<use href="#motif-${month}" width="100" height="140"/>`;
  const art = plainAlt
    ? `<g clip-path="url(#card-clip)"><g transform="translate(100 0) scale(-1 1)">${use}</g></g>`
    : `<g clip-path="url(#card-clip)">${use}</g>`;

  let over = '';
  if (def.kind === 'ribbon') over = ribbon(def, month);
  if (special) {
    over += `<g clip-path="url(#card-clip)">${renderParts(special.parts)}${special.front ?? ''}</g>`;
    over += glyphTag(special.glyph, def.kind === 'bright', look);
  }

  const chipW = month + 1 >= 10 ? 19 : 13.4;
  const ch = look?.chip;
  const num = ch
    ? `<rect x="6.6" y="7.6" width="${chipW}" height="15" rx="3.8" fill="#000" opacity=".14"/>` +
      `<rect x="6" y="7" width="${chipW}" height="15" rx="3.8" fill="${ch.paper}"/>` +
      `<rect x="6.9" y="7.9" width="${f(chipW - 1.8)}" height="13.2" rx="3" fill="none" stroke="${ch.edge}" stroke-width=".45"/>` +
      `<text x="${f(6 + chipW / 2)}" y="18.5" text-anchor="middle" font-size="11" font-family="'Gowun Batang', serif" font-weight="700" fill="${ch.ink}">${month + 1}</text>`
    : `<rect x="6.6" y="7.6" width="${chipW}" height="15" rx="3.8" fill="#000" opacity=".08"/>` +
      `<rect x="6" y="7" width="${chipW}" height="15" rx="3.8" fill="${PAPER}" opacity=".94"/>` +
      `<rect x="6.9" y="7.9" width="${f(chipW - 1.8)}" height="13.2" rx="3" fill="none" stroke="${INK}" stroke-opacity=".16" stroke-width=".4"/>` +
      `<text x="${f(6 + chipW / 2)}" y="18.5" text-anchor="middle" font-size="11" font-family="'Gowun Batang', serif" font-weight="700" fill="${INK}" opacity="0.74">${month + 1}</text>`;
  return bg + art + over + cardFinish + (look?.over ? look.over(id) : '') + num;
}

/** The two lucky bonus cards (48, 49): see bonus.ts. */
function bonusInner(id: number, look?: CardLook): string {
  const b = bonusArt(id);
  const ch = look?.chip;
  return (
    cardBase(BONUS_TINT) +
    (look?.under ? look.under(id) : '') +
    `<g clip-path="url(#card-clip)">${b.back}${b.art}</g>` +
    bonusFrame() +
    b.front +
    (ch ? bonusTag(b.tag, ch.paper, ch.ink) : bonusTag(b.tag)) +
    cardFinish +
    (look?.over ? look.over(id) : '') +
    (ch ? bonusChip(ch.paper, '#C4472F', ch.edge) : bonusChip())
  );
}

/** A card under snow (First snow levels): pale sky, soft drifts, one crystal. */
export function cardSnowInner(): string {
  const r = rng(77);
  let crystal = '';
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    crystal += `M50 54L${f(50 + ca * 15)} ${f(54 + sa * 15)}`;
    for (const [d, l] of [[6, 4], [10, 3]] as const) {
      const bx = 50 + ca * d;
      const by = 54 + sa * d;
      for (const s of [-1, 1]) {
        const b = a + (s * Math.PI) / 3;
        crystal += `M${f(bx)} ${f(by)}L${f(bx + Math.cos(b) * l)} ${f(by + Math.sin(b) * l)}`;
      }
    }
  }
  let hex = '';
  for (let k = 0; k <= 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI / 2;
    hex += `${k ? 'L' : 'M'}${f(50 + Math.cos(a) * 3)} ${f(54 + Math.sin(a) * 3)}`;
  }
  let flakes = '';
  for (let i = 0; i < 26; i++) flakes += C(6 + r() * 88, 8 + r() * 86, 0.5 + r() * 1.1, '#ffffff', O(0.6 + r() * 0.4));
  return (
    cardBase('#e6edf2') +
    `<g clip-path="url(#card-clip)">` +
    `<rect x="4" y="4" width="92" height="132" fill="url(#snow-sky)"/>` +
    P('M4 92Q26 82 46 88T96 84L96 136L4 136Z', '#dbe4ec') +
    flakes +
    P('M4 100Q30 88 52 98T96 94L96 136L4 136Z', '#f6f9fb') +
    S('M4 100Q30 88 52 98T96 94', '#ffffff', 1) +
    P('M30 106Q52 100 70 108Q60 106 50 108Q40 106 30 106Z', '#d4dfe8', O(0.8)) +
    P('M4 118Q36 106 64 116T96 114L96 136L4 136Z', '#ffffff') +
    P('M4 136L4 126Q30 120 48 128Q30 126 4 136Z', '#dde6ee', O(0.7)) +
    C(50, 54, 24, 'url(#snow-glow)') +
    S(crystal, '#93a9bc', 1.1) +
    S(hex, '#93a9bc', 0.6) +
    C(50, 54, 1, '#93a9bc') +
    `</g>` +
    cardFinish
  );
}

/** Panel tint per month (index 12 = the bonus cards). Also the board-paper watermark tints. */
export const MONTH_TINTS = [...STYLES.map((st) => st.tint), BONUS_TINT];
/** Paper colour of every card face. */
export const CARD_PAPER = PAPER;

/** Back of a card (album locked state): indigo seigaiha with a vermilion 짝 seal. */
export function cardBackInner(): string {
  // Seigaiha (청해파 · 青海波): rows of fans, each lower row overlapping the one above.
  let fans = '';
  let arcs = '';
  let arcs2 = '';
  const R = 9;
  for (let row = 0; row < 34; row++) {
    const y = row * 4.5 + 2;
    const off = row % 2 ? R : 0;
    let rf = '';
    let ra = '';
    let rb = '';
    for (let col = -1; col < 7; col++) {
      const x = col * R * 2 + off;
      rf += `M${f(x - R)} ${f(y)}a${R} ${R} 0 0 1 ${2 * R} 0Z`;
      ra += `M${f(x - R + 0.4)} ${f(y)}a${R - 0.4} ${R - 0.4} 0 0 1 ${f(2 * R - 0.8)} 0`;
      for (const k of [2.6, 5]) rb += `M${f(x - R + k)} ${f(y)}a${R - k} ${R - k} 0 0 1 ${f(2 * (R - k))} 0`;
    }
    fans += P(rf, '#28334f');
    arcs += S(ra, '#53648f', 0.7);
    arcs2 += S(rb, '#3e4d74', 0.6);
    // interleave so lower rows cover the rows above
    fans += arcs + arcs2;
    arcs = '';
    arcs2 = '';
  }
  // ink-wear specks inside the seal
  const r = rng(5);
  let wear = '';
  for (let i = 0; i < 14; i++) wear += C(36 + r() * 28, 56 + r() * 28, 0.2 + r() * 0.5, PAPER, O(0.25 + r() * 0.3));
  const corner = (x: number, y: number) => `M${x} ${y - 1.6}L${x + 1.6} ${y}L${x} ${y + 1.6}L${x - 1.6} ${y}Z`;
  return (
    `<rect width="100" height="140" rx="9" fill="#28334f"/>` +
    `<g clip-path="url(#card-clip)">${fans}<rect x="4" y="4" width="92" height="132" fill="url(#back-glow)"/></g>` +
    `<rect x=".4" y=".4" width="99.2" height="139.2" rx="8.6" fill="none" stroke="#11182a" stroke-opacity=".6" stroke-width=".8"/>` +
    `<rect x="4.4" y="4.4" width="91.2" height="131.2" rx="6" fill="none" stroke="#c9a96a" stroke-opacity=".7" stroke-width=".7"/>` +
    `<rect x="7.4" y="7.4" width="85.2" height="125.2" rx="4.4" fill="none" stroke="#c9a96a" stroke-opacity=".35" stroke-width=".4"/>` +
    P(corner(7.4, 7.4) + corner(92.6, 7.4) + corner(7.4, 132.6) + corner(92.6, 132.6), '#c9a96a', O(0.75)) +
    `<circle cx="50" cy="70" r="26" fill="#222c45"/>` +
    `<circle cx="50" cy="70" r="26" fill="none" stroke="#c9a96a" stroke-opacity=".55" stroke-width=".6"/>` +
    `<circle cx="50" cy="70" r="23.6" fill="none" stroke="#c9a96a" stroke-opacity=".25" stroke-width=".4"/>` +
    `<g transform="rotate(-5 50 70)">` +
    `<rect x="33" y="53" width="36" height="36" rx="5" fill="#000" opacity=".25" transform="translate(.8 1.2)"/>` +
    `<rect x="32" y="52" width="36" height="36" rx="5" fill="${VERMILION}"/>` +
    `<rect x="34.8" y="54.8" width="30.4" height="30.4" rx="3" fill="none" stroke="${PAPER}" stroke-width="1.1"/>` +
    `<text x="50" y="78" text-anchor="middle" font-size="19" font-family="'Gowun Batang', serif" font-weight="700" fill="${PAPER}">짝</text>` +
    wear +
    `</g>`
  );
}

/** Shared gradients, patterns and clip paths for every card symbol. */
export function spriteDefs(): string {
  const r = rng(3);
  let fib = '';
  for (let i = 0; i < 6; i++) {
    const x = r() * 48;
    const y = r() * 48;
    const a = r() * Math.PI;
    const l = 4 + r() * 8;
    fib += `M${f(x)} ${f(y)}q${f(Math.cos(a) * l * 0.5 + 1)} ${f(Math.sin(a) * l * 0.5 - 1)} ${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}`;
  }
  let specks = '';
  for (let i = 0; i < 7; i++) specks += `M${f(r() * 48)} ${f(r() * 48)}h.01`;
  return (
    '<defs>' +
    '<clipPath id="card-clip"><rect x="4" y="4" width="92" height="132" rx="6"/></clipPath>' +
    `<clipPath id="curtain-clip"><path d="${CURTAIN_D}"/></clipPath>` +
    `<pattern id="card-fiber" width="48" height="48" patternUnits="userSpaceOnUse"><path d="${fib}" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width=".3"/><path d="${specks}" stroke="#8a7458" stroke-opacity=".22" stroke-width=".7" stroke-linecap="round"/></pattern>` +
    '<linearGradient id="card-sheen" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#5a4630" stop-opacity=".07"/></linearGradient>' +
    '<radialGradient id="card-vig" cx=".5" cy=".46" r=".72"><stop offset=".62" stop-color="#5a4630" stop-opacity="0"/><stop offset="1" stop-color="#5a4630" stop-opacity=".13"/></radialGradient>' +
    '<linearGradient id="rib-red" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c24a3b"/><stop offset=".6" stop-color="#b23b2e"/><stop offset="1" stop-color="#912f22"/></linearGradient>' +
    '<linearGradient id="rib-blue" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3d5d86"/><stop offset=".6" stop-color="#2f4a6d"/><stop offset="1" stop-color="#223754"/></linearGradient>' +
    '<radialGradient id="sun-red" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#d9603f"/><stop offset=".7" stop-color="#c84a32"/><stop offset="1" stop-color="#b73f2a"/></radialGradient>' +
    '<radialGradient id="moon-face" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#fdf8e8"/><stop offset=".7" stop-color="#f3e8cb"/><stop offset="1" stop-color="#e8d8af"/></radialGradient>' +
    '<linearGradient id="sky-moon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6402c"/><stop offset=".6" stop-color="#cc5a3e"/><stop offset="1" stop-color="#d77050"/></linearGradient>' +
    '<linearGradient id="sky-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4472f" stop-opacity=".95"/><stop offset=".42" stop-color="#d0583e" stop-opacity=".75"/><stop offset=".62" stop-color="#d0583e" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="sky-storm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f5a66" stop-opacity=".55"/><stop offset=".55" stop-color="#55606a" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="snow-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9e3eb"/><stop offset="1" stop-color="#eef3f6"/></linearGradient>' +
    '<radialGradient id="snow-glow"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="back-glow" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#4a5d8f" stop-opacity=".35"/><stop offset=".6" stop-color="#28334f" stop-opacity="0"/><stop offset="1" stop-color="#0d1322" stop-opacity=".45"/></radialGradient>' +
    '</defs>'
  );
}

const SNOW_DEFS = /<(linearGradient|radialGradient) id="snow-(?:sky|glow)".*?<\/\1>/g;

/** The month motif markup (unpainted, cached). */
export const motifMarkup = motif;

/** Every card id that has a face: the 48 month cards and the two lucky cards. */
export const FACE_IDS = Array.from({ length: 50 }, (_, i) => i);

/**
 * The deck part of the sprite: shared defs, the 12 motifs and the 50 faces.
 * `paint` recolours markup (identity for the classic deck); `extraDefs` are
 * style-specific gradients/patterns, appended unpainted.
 */
export function deckSpriteMarkup(paint: (s: string) => string = (s) => s, look?: CardLook, extraDefs = ''): string {
  const defs = spriteDefs();
  let painted = paint(defs);
  // the snow card keeps its own winter colours in every deck, so "covered" always reads the same
  if (painted !== defs) for (const m of defs.matchAll(SNOW_DEFS)) painted = painted.replace(paint(m[0]), m[0]);
  let inner = painted + (extraDefs ? `<defs>${extraDefs}</defs>` : '');
  for (let m = 0; m < 12; m++) inner += `<symbol id="motif-${m}" viewBox="0 0 100 140">${paint(motif(m))}</symbol>`;
  for (const id of FACE_IDS) inner += `<symbol id="card-${id}" viewBox="0 0 100 140">${paint(cardInner(id, look))}</symbol>`;
  return inner;
}

/** Inject the sprite into the document once. */
export function installCardSprite(): void {
  if (document.getElementById('card-sprite')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.id = 'card-sprite';
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  let inner = deckSpriteMarkup();
  inner += `<symbol id="card-back" viewBox="0 0 100 140">${cardBackInner()}</symbol>`;
  inner += `<symbol id="card-snow" viewBox="0 0 100 140">${cardSnowInner()}</symbol>`;
  inner += `<defs id="foil-defs">${foilDefs()}</defs>`;
  svg.innerHTML = inner;
  document.body.prepend(svg);
}

export interface CardSvgOptions {
  /** gold-leaf (foil) edition: adds the gilding overlay (see src/art/styles.ts) */
  foil?: boolean;
}

export const cardSvg = (id: number | 'back' | 'snow', cls = 'card-art', opts: CardSvgOptions = {}) =>
  `<svg class="${cls}${opts.foil ? ' is-foil' : ''}" viewBox="0 0 100 140" aria-hidden="true"><use href="#card-${id}"/>${opts.foil ? foilOverlay() : ''}</svg>`;

export const monthName = (id: number) => (id >= 48 ? 'Bonus' : MONTHS[id >> 2].en);
