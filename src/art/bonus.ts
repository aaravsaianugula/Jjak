/**
 * The two lucky bonus cards (보너스패), ids 48 and 49.
 *
 * They sit outside the twelve months, so they get their own family look: warm
 * gold paper, a vermilion-and-gold frame with cloud-curl corner fittings, lucky
 * clouds along the bottom and a 福 corner chip where a month number would be.
 *   48 · Lucky double: a magpie (까치, the bearer of good news) on a persimmon
 *        branch with two ripe fruit, under a 福 seal.
 *   49 · Lucky triple: a red silk treasure knot (매듭) with a tassel, strung
 *        with three gold coins.
 * Everything is drawn in the same 100 × 140 box, with the same halo pass as the
 * other special cards (see specials.ts).
 */
import { INK, PAPER, VERMILION, GOLD, renderParts, taper, lin, circ, ell, rng, type Part, type Pt } from './specials';

export const BONUS_TINT = '#f3e7cb';

const f = (n: number) => Math.round(n * 10) / 10;

const GOLD_LT = '#e9c56f';
const GOLD_MID = '#d4a548';
const GOLD_DK = '#9c7430';
const RED_DK = '#7a2219';

/* ---------- shared pieces ---------- */

/** A lucky cloud (서운 · 瑞雲): three or four round heads with spirals and a trailing tail. */
export function luckyCloud(x: number, y: number, s: number, flip: 1 | -1, fill: string, line: string, lw = 0.7): string {
  const lobes: [number, number, number][] = [
    [0, 0, 5],
    [-6.6, 1.8, 3.6],
    [6.2, 1.4, 4],
    [2.4, -4.6, 3.4],
  ];
  // tail: a tapering curl trailing off to the right
  const tail = taper(
    [
      [8, 3.4],
      [14, 4.6],
      [20, 3.2],
      [24, 0.8],
    ],
    lin(4.2, 0.6),
    5,
  );
  let outline = `<path d="${tail}" fill="${line}" stroke="${line}" stroke-width="${f(lw * 2)}" stroke-linejoin="round"/>`;
  let body = `<path d="${tail}" fill="${fill}"/>`;
  for (const [cx, cy, r] of lobes) {
    outline += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${line}" stroke="${line}" stroke-width="${f(lw * 2)}"/>`;
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
  }
  // a spiral inside each head
  let spir = '';
  for (const [cx, cy, r] of lobes) {
    const pts: Pt[] = [];
    const turns = 1.15;
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      const a = -Math.PI / 2 + t * turns * Math.PI * 2;
      const rr = r * 0.68 * t + 0.15;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    spir += 'M' + pts.map(([px, py]) => `${f(px)} ${f(py)}`).join('L');
  }
  spir += 'M10 4.6Q15 6.2 19.6 4.2';
  return (
    `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * flip)} ${f(s)})">` +
    outline +
    body +
    `<path d="${spir}" fill="none" stroke="${line}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>`
  );
}

/** Old round coin (엽전) with a square hole: gold, a rim, four little marks. */
function coin(cx: number, cy: number, r: number, rot = 0): Part[] {
  const h = r * 0.36;
  const sq = `M${f(cx - h)} ${f(cy - h)}H${f(cx + h)}V${f(cy + h)}H${f(cx - h)}Z`;
  const t = rot ? `rotate(${rot} ${cx} ${cy})` : undefined;
  const marks: string[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 - Math.PI / 2;
    const mx = cx + Math.cos(a) * r * 0.66;
    const my = cy + Math.sin(a) * r * 0.66;
    // a tiny two-stroke "character"
    marks.push(`M${f(mx - r * 0.13)} ${f(my - r * 0.08)}H${f(mx + r * 0.13)}M${f(mx)} ${f(my - r * 0.16)}V${f(my + r * 0.16)}`);
  }
  return [
    { d: circ(cx, cy, r), fill: GOLD_DK, t, halo: 3.2 },
    { d: circ(cx - r * 0.06, cy - r * 0.06, r * 0.9), fill: GOLD_MID, t, noHalo: true },
    { d: `M${f(cx - r * 0.86)} ${f(cy - r * 0.1)}A${f(r * 0.86)} ${f(r * 0.86)} 0 0 1 ${f(cx + r * 0.1)} ${f(cy - r * 0.86)}`, stroke: '#f6dc96', sw: r * 0.1, t, noHalo: true, opacity: 0.85 },
    { d: circ(cx, cy, r * 0.8), stroke: GOLD_DK, sw: r * 0.07, t, noHalo: true, opacity: 0.8 },
    { d: marks.join(''), stroke: GOLD_DK, sw: r * 0.09, t, noHalo: true, opacity: 0.9 },
    { d: sq, fill: GOLD_DK, t, noHalo: true },
    { d: `M${f(cx - h + 0.5)} ${f(cy - h + 0.5)}H${f(cx + h - 0.5)}V${f(cy + h - 0.5)}H${f(cx - h + 0.5)}Z`, fill: '#5c4219', t, noHalo: true },
  ];
}

/** Gold-and-vermilion frame with cloud-curl corner fittings, shared by both cards. */
export function bonusFrame(): string {
  const bracket =
    'M9.6 23V12.6Q9.6 9.6 12.6 9.6H23' +
    'M23 9.6c2.8 0 3.6 2.8 1.8 3.6c-1.3 .5-2.1-.7-1.3-1.5' +
    'M9.6 23c0 2.8 2.8 3.6 3.6 1.8c.5-1.3-.7-2.1-1.5-1.3';
  const corners = ['', 'translate(100 0) scale(-1 1)', 'translate(0 140) scale(1 -1)', 'translate(100 140) scale(-1 -1)']
    .map((t) => `<path${t ? ` transform="${t}"` : ''} d="${bracket}" fill="none" stroke="${GOLD}" stroke-width=".9" stroke-linecap="round"/>`)
    .join('');
  const pip = (x: number, y: number) => `M${x} ${y - 1.5}L${x + 1.5} ${y}L${x} ${y + 1.5}L${x - 1.5} ${y}Z`;
  return (
    `<rect x="6.6" y="6.6" width="86.8" height="126.8" rx="4.6" fill="none" stroke="${VERMILION}" stroke-width="1.15"/>` +
    `<rect x="8.2" y="8.2" width="83.6" height="123.6" rx="3.4" fill="none" stroke="${GOLD}" stroke-opacity=".75" stroke-width=".45"/>` +
    corners +
    `<path d="${pip(50, 6.6)}${pip(50, 133.4)}${pip(6.6, 70)}${pip(93.4, 70)}" fill="${GOLD}"/>`
  );
}

/** Gold mist behind the art (kasumi): two soft tapered bands of gold wash, no specks. */
function goldDust(seed: number): string {
  const r = rng(seed);
  let d = '';
  for (const y0 of [22 + r() * 10, 98 + r() * 14]) {
    const x0 = 4 + r() * 10;
    const len = 46 + r() * 30;
    const w = 3.2 + r() * 1.6;
    d += `M${f(x0)} ${f(y0)}C${f(x0 + len * 0.3)} ${f(y0 - w)} ${f(x0 + len * 0.7)} ${f(y0 - w * 0.8)} ${f(x0 + len)} ${f(y0 - 0.4)}C${f(x0 + len * 0.7)} ${f(y0 + w * 0.5)} ${f(x0 + len * 0.3)} ${f(y0 + w * 0.6)} ${f(x0)} ${f(y0)}Z`;
  }
  return `<path d="${d}" fill="${GOLD_MID}" opacity=".22"/>`;
}

/** The 福 chip in the top-left corner (where a month number would be). */
export function bonusChip(paper = PAPER, ink = VERMILION, ring = GOLD): string {
  return (
    `<rect x="6.6" y="7.6" width="14.6" height="15" rx="3.8" fill="#000" opacity=".08"/>` +
    `<rect x="6" y="7" width="14.6" height="15" rx="3.8" fill="${paper}"/>` +
    `<rect x="6.9" y="7.9" width="12.8" height="13.2" rx="3" fill="none" stroke="${ring}" stroke-width=".7"/>` +
    `<text x="13.3" y="18.4" text-anchor="middle" font-size="10" font-family="'Zen Old Mincho', serif" font-weight="600" fill="${ink}">福</text>`
  );
}

/** Corner tag with 二 / 三, ringed in vermilion and gold. */
export function bonusTag(glyph: string, paper = PAPER, ink = INK): string {
  return (
    `<rect x="73.6" y="115.6" width="20" height="19" rx="4.5" fill="#000" opacity=".12"/>` +
    `<rect x="73" y="115" width="20" height="19" rx="4.5" fill="${paper}"/>` +
    `<rect x="74.4" y="116.4" width="17.2" height="16.2" rx="3.4" fill="none" stroke="${VERMILION}" stroke-width="1.1"/>` +
    `<rect x="75.9" y="117.9" width="14.2" height="13.2" rx="2.4" fill="none" stroke="${GOLD}" stroke-width=".45"/>` +
    `<text x="83" y="128.6" text-anchor="middle" font-size="11" font-family="'Zen Old Mincho', serif" font-weight="600" fill="${ink}">${glyph}</text>`
  );
}

/** A soft gold disc behind the figure. */
const halo = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="${GOLD_LT}" opacity=".16"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GOLD_LT}" opacity=".32"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r - 1.4}" fill="none" stroke="${GOLD}" stroke-opacity=".45" stroke-width=".5"/>`;

/* ---------- 48 · magpie on a persimmon branch ---------- */

function persimmon(cx: number, cy: number, r: number): Part[] {
  // squat, square-shouldered fruit under a broad flat four-lobed calyx
  const P = (x: number, y: number) => `${f(cx + x * r)} ${f(cy + y * r)}`;
  const body = `M${P(0, -0.6)}C${P(0.7, -0.66)} ${P(1.12, -0.42)} ${P(1.1, 0.06)}C${P(1.08, 0.56)} ${P(0.62, 0.86)} ${P(0, 0.86)}C${P(-0.62, 0.86)} ${P(-1.08, 0.56)} ${P(-1.1, 0.06)}C${P(-1.12, -0.42)} ${P(-0.7, -0.66)} ${P(0, -0.6)}Z`;
  const shade = `M${P(0.2, -0.6)}C${P(0.8, -0.6)} ${P(1.12, -0.36)} ${P(1.1, 0.06)}C${P(1.08, 0.56)} ${P(0.62, 0.86)} ${P(0, 0.86)}C${P(-0.4, 0.86)} ${P(-0.7, 0.74)} ${P(-0.88, 0.56)}C${P(-0.1, 0.7)} ${P(0.62, 0.36)} ${P(0.2, -0.6)}Z`;
  const calyx = `M${P(-0.78, -0.5)}Q${P(-0.6, -0.86)} ${P(-0.22, -0.64)}Q${P(0, -0.84)} ${P(0.22, -0.64)}Q${P(0.6, -0.86)} ${P(0.78, -0.5)}Q${P(0.4, -0.4)} ${P(0, -0.5)}Q${P(-0.4, -0.4)} ${P(-0.78, -0.5)}Z`;
  return [
    { d: body, fill: '#e98b2e' },
    { d: shade, fill: '#cc6a1e', noHalo: true, opacity: 0.85 },
    { d: `M${P(-0.34, -0.5)}Q${P(-0.46, 0.2)} ${P(-0.2, 0.8)}M${P(0.38, -0.5)}Q${P(0.5, 0.2)} ${P(0.24, 0.8)}`, stroke: '#c35f1a', sw: 0.45, noHalo: true, opacity: 0.55 },
    { d: ell(cx - r * 0.5, cy - r * 0.12, r * 0.18, r * 0.3), fill: '#fbc477', t: `rotate(20 ${f(cx - r * 0.5)} ${f(cy - r * 0.12)})`, noHalo: true, opacity: 0.9 },
    { d: calyx, fill: '#646233' },
    { d: `M${P(-0.6, -0.56)}Q${P(-0.3, -0.5)} ${P(0, -0.56)}Q${P(0.3, -0.5)} ${P(0.6, -0.56)}`, stroke: '#3f3d1d', sw: 0.4, noHalo: true, opacity: 0.8 },
    { d: `M${P(0, -0.6)}V${f(cy - r)}`, stroke: '#4a3a2c', sw: 1.1 },
  ];
}

function persimmonLeaf(x: number, y: number, len: number, w: number, a: number, fill: string, shade: string, vein: string): Part[] {
  const d = `M0 0C${f(-w)} ${f(-len * 0.2)} ${f(-w * 0.9)} ${f(-len * 0.74)} 0 ${f(-len)}C${f(w * 0.9)} ${f(-len * 0.74)} ${f(w)} ${f(-len * 0.2)} 0 0Z`;
  const half = `M0 0C${f(w)} ${f(-len * 0.2)} ${f(w * 0.9)} ${f(-len * 0.74)} 0 ${f(-len)}Z`;
  let v = `M0 ${f(-len * 0.04)}V${f(-len * 0.92)}`;
  for (const t of [0.28, 0.48, 0.66]) v += `M0 ${f(-len * t)}l${f(-w * 0.62)} ${f(-len * 0.12)}M0 ${f(-len * t)}l${f(w * 0.62)} ${f(-len * 0.12)}`;
  const t = `translate(${f(x)} ${f(y)}) rotate(${a})`;
  return [
    { d, fill, t, halo: 2.6 },
    { d: half, fill: shade, t, noHalo: true },
    { d: v, stroke: vein, sw: 0.4, t, noHalo: true, opacity: 0.8 },
  ];
}

/** Scale a group of parts about a point. */
const grow = (parts: Part[], k = 1.2, ox = 57, oy = 91): Part[] => {
  const t = `translate(${ox} ${oy}) scale(${k}) translate(${-ox} ${-oy})`;
  return parts.map((p) => ({ ...p, t: p.t ? `${t} ${p.t}` : t }));
};

function magpieParts(): Part[] {
  const black = '#1f2228';
  const sheen = '#3d5c86';
  const white = '#fbf8f1';
  const branch: Pt[] = [[-2, 101], [14, 97.5], [30, 94.5], [46, 92.6], [62, 90.4], [78, 86], [92, 79.6], [102, 75]];
  return [
    // branch + twigs
    { d: taper(branch, lin(5.6, 2.2)), fill: '#4a382d', halo: 3.4 },
    { d: taper([[30, 94.5], [24, 86], [21, 78], [22.4, 71]], lin(2.2, 0.8)), fill: '#4a382d', halo: 3 },
    { d: taper([[78, 86], [84, 92], [88, 95.4]], lin(1.8, 0.7)), fill: '#4a382d', halo: 2.6 },
    { d: taper(branch.map(([x, y]): Pt => [x + 0.4, y - 1.2]), lin(1.6, 0.5)), fill: '#7a6150', noHalo: true, opacity: 0.8 },
    // leaves: one green, two turned in autumn
    ...persimmonLeaf(22.4, 72, 13, 4.6, -40, '#6d8a45', '#587538', '#a5bd7b'),
    ...persimmonLeaf(22, 76, 12, 4.2, 38, '#c98a3c', '#b0722c', '#f0c27c'),
    ...persimmonLeaf(46, 92.6, 15, 5.2, 214, '#d08a3a', '#b8722b', '#f0c27c'),
    // the two persimmons (a lucky double)
    ...persimmon(24.6, 105.4, 7),
    ...persimmon(39.6, 103.4, 6.3),
    // ---- magpie: perched, facing left, long tail sweeping down to the right
    ...grow([
    // tail (graduated: a long dark outer pair and a shorter sheened centre)
    { d: taper([[66, 81], [76, 88], [86, 96], [95.6, 104]], lin(6.4, 4.6)), fill: '#1c2a2e', halo: 4 },
    { d: taper([[66, 81], [76, 88.4], [86.4, 96.2], [95.6, 104]], lin(2.4, 1.2)), fill: '#3c6e6a', noHalo: true, opacity: 0.85 },
    { d: 'M71 86.4L74.4 87.2M77 90.8L80.6 91.6M83 95.2L86.8 96.2M88.6 99.4L92.4 100.4', stroke: '#13191c', sw: 0.4, noHalo: true, opacity: 0.7 },
    // body
    { d: 'M38.2 70.6C40.4 64.6 49 63.8 56.4 66.8C64.6 70.2 71.6 76 72.8 81.4C70.4 84.8 63.4 85.6 56.2 84.4C47.4 83 39.8 79 38.2 70.6Z', fill: black },
    // white belly and flank
    { d: 'M47.6 78.2C52.6 76.2 60.6 76.8 67.6 80.6C68.6 82 67.4 83.6 64.6 84.4C58.6 85.6 51.4 84.6 47.6 78.2Z', fill: white, noHalo: true },
    { d: 'M53 81.6C56.6 82.6 60.6 82.8 64.6 82.2', stroke: '#d9d3c4', sw: 0.5, noHalo: true },
    // wing, folded, with a blue sheen and the white scapular stripe
    { d: 'M47.4 70.4C55.4 66.6 66.4 70.4 75.4 80.6C68 81.8 59.4 80.4 52.6 76.6C49.8 75 48.2 72.8 47.4 70.4Z', fill: '#262c38', noHalo: true },
    { d: 'M53.4 74C59.4 74.6 66 77 71.4 80.4M55.4 76.4C60.6 77.6 65 79 69 80.8', stroke: sheen, sw: 0.55, noHalo: true, opacity: 0.9 },
    { d: 'M47.8 69.8C53.4 67.4 60.6 68 66.6 71.6C61.4 72.4 54.6 72.4 47.8 69.8Z', fill: white, noHalo: true },
    { d: 'M66.6 79.4C69.6 80.4 72.4 80.8 75 80.6', stroke: white, sw: 0.6, noHalo: true, opacity: 0.7 },
    // head
    { d: circ(41.4, 66.2, 6.2), fill: black },
    { d: 'M36.8 63.2C37.8 60.6 40.4 59.6 43 60.2', stroke: '#4a5266', sw: 0.6, noHalo: true, opacity: 0.8 },
    { d: 'M35.8 64.6L28.4 67L35.8 68.6Z', fill: '#16181c' },
    { d: 'M35.6 66.7L30.4 67', stroke: '#4a5266', sw: 0.35, noHalo: true },
    { d: circ(39.4, 65, 1.05), fill: '#0e0f12', noHalo: true },
    { d: circ(39.75, 64.65, 0.36), fill: '#fff', noHalo: true, opacity: 0.9 },
    // legs gripping the branch
    { d: 'M53.4 84.4L52.8 91.2M52.8 91.2L50.4 92.8M52.8 91.2L54.8 92.6M59.6 84.8L60.2 90.6M60.2 90.6L58 92M60.2 90.6L62.4 91.6', stroke: '#2a2724', sw: 0.95, noHalo: true },
    ]),
  ];
}

/** Vermilion square seal with 복 (paper-coloured, with a little ink wear). */
function fuSeal(x: number, y: number, s: number, rot: number): string {
  const r = rng(48);
  let wear = '';
  // ink wear: two dry streaks where the vermilion didn't take
  for (let i = 0; i < 2; i++) {
    const sx = x + 1.6 + r() * (s * 0.4);
    const sy = y + 2 + r() * (s - 4);
    const l = s * (0.3 + r() * 0.25);
    wear += `<path d="M${f(sx)} ${f(sy)}q${f(l / 2)} -.5 ${f(l)} 0q${f(-l / 2)} .35 ${f(-l)} 0Z" fill="${PAPER}" opacity=".4"/>`;
  }
  const c = x + s / 2;
  return (
    `<g transform="rotate(${rot} ${f(c)} ${f(y + s / 2)})">` +
    `<rect x="${f(x - 1.2)}" y="${f(y - 1.2)}" width="${f(s + 2.4)}" height="${f(s + 2.4)}" rx="2.4" fill="${PAPER}" opacity=".85"/>` +
    `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="1.6" fill="${VERMILION}"/>` +
    `<rect x="${f(x + 1.2)}" y="${f(y + 1.2)}" width="${f(s - 2.4)}" height="${f(s - 2.4)}" rx=".9" fill="none" stroke="${PAPER}" stroke-width=".55"/>` +
    `<text x="${f(c)}" y="${f(y + s * 0.74)}" text-anchor="middle" font-size="${f(s * 0.62)}" font-family="'Gowun Batang', serif" font-weight="700" fill="${PAPER}">복</text>` +
    wear +
    `</g>`
  );
}

/* ---------- 49 · treasure knot and three coins ---------- */

/** A woven endless knot (반장매듭), drawn in a rotated square lattice. */
function knot(cx: number, cy: number, s: number, w: number): string {
  const L = s * 1.62;
  const silk = VERMILION;
  const edge = RED_DK;
  const hi = '#ec9479';
  const strand = (d: string) =>
    `<path d="${d}" fill="none" stroke="${edge}" stroke-width="${f(w + 1.1)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${silk}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${hi}" stroke-width="${f(w * 0.22)}" stroke-linecap="round" stroke-opacity=".7"/>`;
  const k = 1.15;
  const S = (n: number) => f(n * s);
  // ears on each side and two big corner loops (top + bottom once rotated)
  let loops = '';
  loops += `M${f(L)} ${S(-1)}C${f(L + k * s)} ${S(-1)} ${f(L + k * s)} 0 ${f(L)} 0`;
  loops += `M${f(-L)} 0C${f(-L - k * s)} 0 ${f(-L - k * s)} ${S(1)} ${f(-L)} ${S(1)}`;
  loops += `M${S(-1)} ${f(L)}C${S(-1)} ${f(L + k * s)} 0 ${f(L + k * s)} 0 ${f(L)}`;
  loops += `M0 ${f(-L)}C0 ${f(-L - k * s)} ${S(1)} ${f(-L - k * s)} ${S(1)} ${f(-L)}`;
  loops += `M${f(L)} ${S(1)}C${f(L + 1.5 * s)} ${S(1)} ${S(1)} ${f(L + 1.5 * s)} ${S(1)} ${f(L)}`;
  loops += `M${f(-L)} ${S(-1)}C${f(-L - 1.5 * s)} ${S(-1)} ${S(-1)} ${f(-L - 1.5 * s)} ${S(-1)} ${f(-L)}`;
  let u = '';
  let v = '';
  for (const o of [-1, 0, 1]) {
    u += `M${f(-L)} ${S(o)}H${f(L)}`;
    v += `M${S(o)} ${f(-L)}V${f(L)}`;
  }
  // weave: at alternate crossings the horizontal strand passes over again
  let over = '';
  for (const i of [-1, 0, 1]) {
    for (const j of [-1, 0, 1]) {
      if ((i + j + 2) % 2) continue;
      const x = i * s;
      const y = j * s;
      const hl = w / 2 + 0.9;
      over += `<rect x="${f(x - hl)}" y="${f(y - w / 2)}" width="${f(hl * 2)}" height="${w}" fill="${silk}"/>`;
      over += `<path d="M${f(x - hl)} ${f(y - w / 2 - 0.27)}H${f(x + hl)}M${f(x - hl)} ${f(y + w / 2 + 0.27)}H${f(x + hl)}" stroke="${edge}" stroke-width=".55"/>`;
      over += `<path d="M${f(x - hl)} ${f(y)}H${f(x + hl)}" stroke="${hi}" stroke-opacity=".7" stroke-width="${f(w * 0.22)}"/>`;
    }
  }
  return `<g transform="translate(${cx} ${cy}) rotate(45)">${strand(loops)}${strand(u)}${strand(v)}${over}</g>`;
}

function tassel(cx: number, top: number, len: number): string {
  const r = rng(49);
  let threads = '';
  let lights = '';
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const x0 = cx - 3.4 + t * 6.8;
    const x1 = cx - 7.6 + t * 15.2 + (r() - 0.5) * 1.2;
    const y1 = top + len - Math.abs(t - 0.5) * 3 + r() * 1.6;
    const seg = `M${f(x0)} ${f(top)}C${f(x0)} ${f(top + len * 0.4)} ${f(x1)} ${f(top + len * 0.6)} ${f(x1)} ${f(y1)}`;
    if (i % 3 === 1) lights += seg;
    else threads += seg;
  }
  const outline = `M${f(cx - 3.8)} ${top}C${f(cx - 4)} ${f(top + len * 0.4)} ${f(cx - 8.4)} ${f(top + len * 0.6)} ${f(cx - 8.4)} ${f(top + len)}Q${cx} ${f(top + len + 3)} ${f(cx + 8.4)} ${f(top + len)}C${f(cx + 8.4)} ${f(top + len * 0.6)} ${f(cx + 4)} ${f(top + len * 0.4)} ${f(cx + 3.8)} ${top}Z`;
  return (
    `<path d="${outline}" fill="${PAPER}" stroke="${PAPER}" stroke-width="4.4" stroke-linejoin="round"/>` +
    `<path d="${outline}" fill="#a8352a"/>` +
    `<path d="${threads}" fill="none" stroke="#7f241b" stroke-width=".55" stroke-linecap="round"/>` +
    `<path d="${lights}" fill="none" stroke="#e57a5e" stroke-width=".5" stroke-linecap="round" stroke-opacity=".8"/>` +
    // gold binding band near the top
    `<rect x="${f(cx - 4.6)}" y="${f(top + 4.6)}" width="9.2" height="2.6" rx="1" fill="${GOLD_MID}"/>` +
    `<path d="M${f(cx - 4.4)} ${f(top + 5.8)}H${f(cx + 4.4)}" stroke="${GOLD_DK}" stroke-width=".4"/>`
  );
}

function knotParts(): { back: string; art: string } {
  // the cord: hangs from a loop at the top, through three coins, into the knot
  const cord = (d: string, w = 2) =>
    `<path d="${d}" fill="none" stroke="${PAPER}" stroke-width="${f(w + 3.6)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${RED_DK}" stroke-width="${f(w + 0.9)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${VERMILION}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#ec9479" stroke-width=".45" stroke-linecap="round" stroke-opacity=".7" transform="translate(-.35 -.35)"/>`;
  const top = 'M50 13.6V40';
  const loop = 'M50 13.6C45.6 13.4 44.4 8.8 47 6.6C48.6 5.4 51.4 5.4 53 6.6C55.6 8.8 54.4 13.4 50 13.6';
  // side cords that carry the outer coins
  const swagL = 'M50 25.6C42 26 35 29.4 30.4 35.6';
  const swagR = 'M50 25.6C58 26 65 29.4 69.6 35.6';
  const coins = renderParts([...coin(29.4, 39.4, 7, -8), ...coin(70.6, 39.4, 7, 8), ...coin(50, 25.6, 7.6)]);
  // gold bead between knot and tassel
  const bead = renderParts([
    { d: ell(50, 86.6, 3.4, 2.8), fill: GOLD_MID, halo: 2.6 },
    { d: 'M47 85.4C48.4 84 51.6 84 53 85.4', stroke: '#f6dc96', sw: 0.6, noHalo: true },
    { d: 'M46.8 87.6H53.2', stroke: GOLD_DK, sw: 0.45, noHalo: true },
  ]);
  return {
    back: halo(50, 60, 25),
    art:
      cord(loop, 1.6) +
      cord(swagL, 1.4) +
      cord(swagR, 1.4) +
      cord(top) +
      cord('M50 78V86', 2) +
      coins +
      `<path d="M50 34.4V40" stroke="${RED_DK}" stroke-width="2.9" stroke-linecap="round"/><path d="M50 34.4V40" stroke="${VERMILION}" stroke-width="2" stroke-linecap="round"/>` +
      knot(50, 60.4, 6.2, 2.7) +
      tassel(50, 88.6, 30) +
      bead,
  };
}

/* ---------- assembly ---------- */

export interface BonusArt {
  /** drawn behind the art, clipped to the panel */
  back: string;
  /** the main illustration, clipped to the panel */
  art: string;
  /** frame and seal, drawn over the art */
  front: string;
  /** glyph for the corner tag (二 / 三) */
  tag: string;
}

export function bonusArt(id: number): BonusArt {
  const clouds = (list: [number, number, number, 1 | -1][]) => list.map(([x, y, s, fl]) => luckyCloud(x, y, s, fl, '#f6ead0', '#c9a24a', 0.62)).join('');
  if (id % 2 === 0) {
    return {
      back: goldDust(48) + halo(54, 62, 25) + clouds([[32, 126.4, 0.8, 1], [61, 130, 0.66, -1], [26, 30, 0.6, 1]]),
      art: renderParts(magpieParts()),
      front: fuSeal(71, 12.6, 13, 4),
      tag: '二',
    };
  }
  const k = knotParts();
  return {
    back: goldDust(49) + k.back + clouds([[17, 112, 0.84, 1], [84, 96, 0.72, -1], [22, 129, 0.6, 1]]),
    art: k.art,
    front: '',
    tag: '三',
  };
}
