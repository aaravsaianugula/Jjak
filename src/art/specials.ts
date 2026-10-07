/**
 * Illustrations for the 14 special cards (animals, objects and brights).
 *
 * Each illustration is a list of parts drawn twice: first as a fat paper-coloured
 * "halo" so the figure separates cleanly from the flowers behind it (the
 * printed-card look), then in colour. Everything sits in the card's 100 × 140
 * view box and is built from paths only, so the halo can reuse the same `d`.
 */

export const INK = '#2a2724';
export const PAPER = '#f7f1e6';
export const VERMILION = '#c4472f';
export const GOLD = '#b8893b';

export interface Part {
  d: string;
  fill?: string;
  stroke?: string;
  sw?: number;
  /** transform applied to this part */
  t?: string;
  /** skip in the halo pass (fine details) */
  noHalo?: boolean;
  /** extra halo width (default 5) */
  halo?: number;
  opacity?: number;
}

export interface Special {
  /** drawn behind the flower motif (skies, suns, water) */
  back?: string;
  parts: Part[];
  /** drawn on top without a halo (text, sparkles, clipped detail) */
  front?: string;
  /** kanji tag shown in the corner */
  glyph: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/* ---------- geometry helpers (shared with cards.ts) ---------- */

export type Pt = [number, number];

/** Sample a Catmull-Rom spline through the points. */
export function smooth(pts: Pt[], seg = 6): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (j: 0 | 1) =>
        0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([c(0), c(1)]);
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/** Width profile helpers for `taper`. */
export const lin = (a: number, b: number) => (t: number) => a + (b - a) * t;
/** Pointed at both ends, widest at `peak`. */
export const blade = (w: number, peak = 0.35) => (t: number) =>
  w * (t < peak ? Math.sin((t / peak) * (Math.PI / 2)) : Math.cos(((t - peak) / (1 - peak)) * (Math.PI / 2)));

/** A brush-like filled stroke along a smooth curve with a varying width. */
export function taper(pts: Pt[], wf: (t: number) => number, seg = 6): string {
  const s = smooth(pts, seg);
  const n = s.length;
  const L: string[] = [];
  const R: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)];
    const b = s[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const w = Math.max(0, wf(i / (n - 1))) / 2;
    L.push(`${r1(s[i][0] - dy * w)} ${r1(s[i][1] + dx * w)}`);
    R.push(`${r1(s[i][0] + dy * w)} ${r1(s[i][1] - dx * w)}`);
  }
  return `M${L.join('L')}L${R.reverse().join('L')}Z`;
}

/** Polyline through smoothed points (for thin strokes). */
export const curve = (pts: Pt[], seg = 6) =>
  'M' + smooth(pts, seg).map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L');

/** Circle as a path so it can join the halo pass. */
export const circ = (cx: number, cy: number, r: number) =>
  `M${r1(cx - r)} ${r1(cy)}a${r} ${r} 0 1 0 ${r1(2 * r)} 0a${r} ${r} 0 1 0 ${r1(-2 * r)} 0Z`;
/** Ellipse as a path. */
export const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${r1(cx - rx)} ${r1(cy)}a${rx} ${ry} 0 1 0 ${r1(2 * rx)} 0a${rx} ${ry} 0 1 0 ${r1(-2 * rx)} 0Z`;

/** Tiny deterministic PRNG so "random" detail is stable between builds. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function partSvg(p: Part, halo: boolean): string {
  const t = p.t ? ` transform="${p.t}"` : '';
  if (halo) {
    if (p.noHalo) return '';
    const w = (p.sw ?? 0) + (p.halo ?? 5);
    return `<path${t} d="${p.d}" fill="${p.fill && p.fill !== 'none' ? PAPER : 'none'}" stroke="${PAPER}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const op = p.opacity != null ? ` opacity="${p.opacity}"` : '';
  const stroke = p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 1}" stroke-linecap="round" stroke-linejoin="round"` : '';
  return `<path${t} d="${p.d}" fill="${p.fill ?? 'none'}"${stroke}${op}/>`;
}

export function renderParts(parts: Part[]): string {
  return parts.map((p) => partSvg(p, true)).join('') + parts.map((p) => partSvg(p, false)).join('');
}

/* ---------- small building blocks ---------- */

/** Crescent: disc (cx, cy, r) minus disc (ox, oy, r2), built from the two arcs. */
function crescent(cx: number, cy: number, r: number, ox: number, oy: number, r2: number): string {
  const dx = ox - cx;
  const dy = oy - cy;
  const d = Math.hypot(dx, dy);
  const a = (r * r - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const px = cx + (a * dx) / d;
  const py = cy + (a * dy) / d;
  const p1 = `${r1(px + (h * dy) / d)} ${r1(py - (h * dx) / d)}`;
  const p2 = `${r1(px - (h * dy) / d)} ${r1(py + (h * dx) / d)}`;
  return `M${p1}A${r} ${r} 0 1 0 ${p2}A${r2} ${r2} 0 0 1 ${p1}Z`;
}

/** Apply a transform to a whole group of parts. */
const move = (parts: Part[], t: string): Part[] => parts.map((p) => ({ ...p, t: p.t ? `${t} ${p.t}` : t }));

/** Bird eye: dark pupil, optional ring, a catch-light. */
const eye = (x: number, y: number, r: number, ring?: string): Part[] => [
  ...(ring ? [{ d: circ(x, y, r * 1.55), fill: ring, noHalo: true }] : []),
  { d: circ(x, y, r), fill: INK, noHalo: true },
  { d: circ(x + r * 0.35, y - r * 0.35, r * 0.34), fill: '#fff', noHalo: true, opacity: 0.9 },
];

/** Butterfly centred on (0,0), body vertical; place with a transform. */
function butterfly(wing: string, edge: string, spot: string, t: string): Part[] {
  const fore = 'M-.6 -1C-5 -12 -17 -20 -23 -13.5C-25.5 -7.5 -20 .5 -1.5 1Z';
  const hind = 'M-.8 1C-4.5 6 -10.5 15.5 -16 13.5C-19.5 10.5 -15.5 4 -1.5 1Z';
  const half = (m: string): Part[] => [
    { d: fore, fill: edge, t: `${t}${m}` },
    { d: fore, fill: wing, t: `${t}${m} translate(-1.2 -.4) scale(.8)`, noHalo: true },
    { d: hind, fill: edge, t: `${t}${m}`, opacity: 0.96 },
    { d: hind, fill: wing, t: `${t}${m} translate(-.6 .5) scale(.76)`, noHalo: true, opacity: 0.94 },
    { d: 'M-1 -.5L-17 -14.5M-1 -.3L-21 -9M-1 0L-18 -1.5M-1 1.5L-12 10M-1 1.2L-15 6', stroke: edge, sw: 0.4, t: `${t}${m}`, noHalo: true, opacity: 0.55 },
    { d: `${circ(-21, -12, 1.2)}${circ(-22.6, -8, 1)}${circ(-20.5, -4.2, 0.9)}${circ(-14.5, 12, 0.9)}`, fill: spot, t: `${t}${m}`, noHalo: true },
    { d: circ(-12.5, -7.5, 2.4), fill: spot, t: `${t}${m}`, noHalo: true },
    { d: circ(-12.5, -7.5, 1.1), fill: edge, t: `${t}${m}`, noHalo: true },
  ];
  return [
    ...half(''),
    ...half(' scale(-1 1)'),
    { d: 'M0 -7C1.7 -7 1.8 9 0 10C-1.8 9 -1.7 -7 0 -7Z', fill: INK, t },
    { d: 'M-1.3 -1H1.3M-1.3 2.2H1.3M-1.2 5.2H1.2', stroke: '#6b625a', sw: 0.35, t, noHalo: true },
    { d: circ(0, -7.6, 1.5), fill: INK, t },
    { d: 'M-.4 -8.6C-2 -12 -4 -14.5 -6.6 -15.6M.4 -8.6C2 -12 4 -14.5 6.6 -15.6', stroke: INK, sw: 0.6, t, noHalo: true },
    { d: `${circ(-6.8, -15.7, 0.8)}${circ(6.8, -15.7, 0.8)}`, fill: INK, t, noHalo: true },
  ];
}

/** Greylag goose in flight, facing right, centred on (0,0). Wing up or level. */
const goose = (t: string, up = true): Part[] => [
  { d: 'M-1 1C0 5 2 8.6 5.6 11.4C4.4 7 4.2 4 4.4 1Z', fill: '#3a3633', t },
  { d: 'M-12.6 .6C-8 -2.8 2 -3.2 8.4 -1.1C4.4 2.8 -6 3.8 -12.6 .6Z', fill: '#5d5751', t },
  { d: 'M-10.6 1.8C-4 3.4 3 2.8 7.4 .2C3.4 3.2 -4 4.4 -10.6 1.8Z', fill: '#a49b8f', t, noHalo: true },
  { d: 'M7.4 -1.7C10.4 -2.6 13.4 -3.2 16.4 -3.4L16.8 -1.8C13.4 -1.3 10.4 -.4 8 .7Z', fill: '#3a3633', t },
  { d: ell(17.4, -2.7, 2.1, 1.55), fill: '#3a3633', t },
  { d: 'M19.2 -3.3L22.8 -2.5L19.2 -1.6Z', fill: '#d39a52', t },
  { d: 'M19 -3.6L19.1 -1.5', stroke: '#f0e8d6', sw: 0.6, t, noHalo: true },
  { d: circ(17.8, -3.1, 0.42), fill: '#f0e8d6', t, noHalo: true },
  { d: 'M-12.6 .6L-16.2 -.8L-15.4 2.2Z', fill: '#3a3633', t },
  { d: ell(-11, 1.8, 1.9, 1), fill: '#f0e8d6', t, noHalo: true },
  ...(up
    ? [
        { d: 'M-2 -1.6C-4 -8 -7 -14 -11.6 -19.6C-7 -18.6 -2.6 -16.4 .6 -13.2C1.8 -9 2.4 -5.4 2.8 -1.6Z', fill: '#6c665f', t },
        { d: 'M-11.6 -19.6C-7 -18.6 -2.6 -16.4 .6 -13.2L-1.4 -12C-3.6 -14 -6.6 -16 -9.4 -17Z', fill: '#34302d', t, noHalo: true },
        { d: 'M-1 -3L-6 -14.6M.8 -3.4L-2.4 -13.4', stroke: '#45403c', sw: 0.45, t, noHalo: true, opacity: 0.8 },
      ]
    : [
        { d: 'M-1 -1.6C-6 -4.6 -12 -6.4 -19.6 -6.2C-14.6 -3.4 -8.6 -.4 -2.6 .8Z', fill: '#6c665f', t },
        { d: 'M-19.6 -6.2C-16.4 -4.4 -13.4 -2.8 -10.6 -1.6L-10 -3.4C-13 -4.8 -16.2 -5.8 -19.6 -6.2Z', fill: '#34302d', t, noHalo: true },
        { d: 'M-3 -1L-14.6 -4.6M-4 -2.4L-13 -5.4', stroke: '#45403c', sw: 0.45, t, noHalo: true, opacity: 0.8 },
      ]),
];

/** A long tail plume: slim at the root, widening, barbed edges and a tear-drop eye at its tip. */
function plume(pts: Pt[], w: number, fill: string, rib: string, eyeC: [string, string]): Part[] {
  const sm = smooth(pts, 6);
  const n = sm.length;
  const [ex, ey] = sm[n - 1];
  const [px, py] = sm[n - 3];
  const ang = (Math.atan2(ey - py, ex - px) * 180) / Math.PI - 90;
  let barbs = '';
  for (let i = 3; i < n - 2; i += 2) {
    const [x0, y0] = sm[i - 1];
    const [x1, y1] = sm[i];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const ww = w * (0.3 + 0.7 * (i / n)) * 0.5;
    for (const sd of [-1, 1]) barbs += `M${r1(x1 - (dy / l) * ww * sd)} ${r1(y1 + (dx / l) * ww * sd)}l${r1((-dy / l) * 1.1 * sd - (dx / l) * 1.5)} ${r1((dx / l) * 1.1 * sd - (dy / l) * 1.5)}`;
  }
  const tear = 'M0 -1C2 -.6 2.2 2 0 3C-2.2 2 -2 -.6 0 -1Z';
  return [
    { d: taper(pts, (t) => w * (0.25 + 0.75 * Math.pow(t, 0.7))), fill, halo: 3.6 },
    { d: barbs, stroke: fill, sw: 0.5, noHalo: true, opacity: 0.85 },
    { d: curve(pts.slice(0, -1).concat([[ex, ey]])), stroke: rib, sw: 0.45, noHalo: true, opacity: 0.85 },
    // the eye-spot: a light tear ringed in the plume colour, with a small soft centre
    { d: tear, fill: eyeC[0], t: `translate(${r1(ex)} ${r1(ey)}) rotate(${r1(ang)}) scale(${r1(w * 0.46)})`, noHalo: true },
    { d: tear, fill: eyeC[1], t: `translate(${r1(ex)} ${r1(ey + 0.3)}) rotate(${r1(ang)}) scale(${r1(w * 0.2)})`, noHalo: true, opacity: 0.8 },
  ];
}

/** Fan of tapered feathers from a root point. */
function featherFan(cx: number, cy: number, a0: number, a1: number, n: number, len: (i: number) => number, w: number, fills: string[], bend = 0.12): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
    const L = len(i);
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const pts: Pt[] = [
      [cx, cy],
      [cx + Math.cos(a) * L * 0.5 + nx * L * bend, cy + Math.sin(a) * L * 0.5 + ny * L * bend],
      [cx + Math.cos(a) * L, cy + Math.sin(a) * L],
    ];
    out.push({ d: taper(pts, (t) => w * Math.sin(Math.PI * (0.18 + 0.82 * t)) ** 0.5 * (1 - t * 0.25)), fill: fills[i % fills.length], halo: 3 });
  }
  return out;
}

/* ---------- the 14 illustrations ---------- */

/** Curtain swag outline (shared with the clip path in the sprite defs). */
export const CURTAIN_D = 'M7 99L93 99L93 127Q80 136.5 64.5 129.5Q50 137 35.5 129.5Q20 136.5 7 127Z';

export const SPECIALS: Record<number, Special> = {
  // 1 · Pine — Crane (bright)
  3: {
    glyph: '鶴',
    back: `<circle cx="64" cy="40" r="27" fill="${VERMILION}" opacity=".12"/><circle cx="64" cy="40" r="23" fill="url(#sun-red)"/><circle cx="64" cy="40" r="20.6" fill="none" stroke="#e98a6c" stroke-opacity=".35" stroke-width=".5"/>`,
    parts: [
      // legs
      { d: 'M51 110L49.6 121L50.4 131.5M49.8 131.5L45 133M50.4 131.5L54 133.4M61 110L62.6 121L61.6 131M61.6 131L57.6 132.6M61.6 131L65.6 132.8', stroke: '#3a3532', sw: 1.15 },
      { d: `${ell(49.8, 121, 0.9, 1.3)}${ell(62.5, 121, 0.9, 1.3)}`, fill: '#3a3532', noHalo: true },
      // black tertial bustle over the tail
      { d: 'M64 87C74 84 85 89 91 101C87 99 83 98.5 80 99.5C85 104 87 110 86.5 117C82 110 77 106 72 104.5C74 109 74 113 72 117C68 110 64 105 60 102Z', fill: INK },
      { d: 'M72 92C78 94 83 98 86 103M70 97C75 101 79 106 81.5 111M66 100C69 104 70.5 108 71 112', stroke: '#5b5552', sw: 0.5, noHalo: true },
      // body
      { d: 'M34 98C35.5 86 49 79.5 63 81.5C74 83 80 91 78 99.5C75.5 107.5 62 112.5 49 111C40.5 110 34.5 105 34 98Z', fill: '#fbf8f1' },
      { d: 'M37.5 104C45 110.5 62 112 74 105.5C69 110 59 113 48.5 112C42.5 111.3 39.3 108.4 37.5 104Z', fill: '#ddd6c8', noHalo: true },
      { d: 'M47 89C55 84.5 65 85 71.5 90.5M45 95C54 91 65 91.5 74 97M48 101C56 98.5 64 99 70 102', stroke: '#d3cbbc', sw: 0.6, noHalo: true },
      // neck: black, with a white nape line
      { d: taper([[47, 93], [40.5, 86], [35.4, 77], [35, 67.6], [38.4, 58.4]], lin(6.4, 3.4)), fill: INK },
      { d: curve([[40.6, 62.2], [38.2, 67.6], [38.2, 74], [40.6, 80]]), stroke: '#fbf8f1', sw: 0.75, noHalo: true },
      // head
      ...move([
      { d: 'M33.5 58.2C33.2 54.2 36 51.5 39.4 51.8C42.6 52.1 44 55 43.2 57.8C42.4 60.4 39.6 61.6 37 61C35 60.5 33.7 59.6 33.5 58.2Z', fill: '#fbf8f1' },
      { d: 'M36 53.4C37.4 51.6 40.6 51.4 42.2 53.4C40.4 54 38 54.1 36 53.4Z', fill: VERMILION, noHalo: true },
      { d: 'M33.6 58.6C34.6 60.6 36.6 61.4 39 61.2C38 59.6 36.6 58.6 33.6 58.6Z', fill: INK, noHalo: true },
      { d: 'M34.2 56.1L20.5 60.6L34 58.4Z', fill: '#b9a46a' },
      { d: 'M34 57.3L22.5 60', stroke: '#8a7a48', sw: 0.35, noHalo: true },
      ...eye(37.3, 56.4, 0.75),
      ], 'translate(38.4 56.4) scale(1.14) translate(-38.4 -56.4)'),
    ],
  },
  // 2 · Plum — Bush warbler
  7: {
    glyph: '鶯',
    parts: [
      { d: 'M40 74C52 71 66 72.5 79 69.5C83 68.6 86 66 88 63', stroke: '#4a3830', sw: 2.2 },
      { d: 'M71 71.2C73 74 76 75 78.6 74.6', stroke: '#4a3830', sw: 1.2 },
      { d: circ(79.4, 74.4, 1.8), fill: '#a63f57' },
      // tail
      { d: 'M52 60C46 63.5 40 67.5 32.5 71.5L35.2 67.6L30.8 66.4C37 62 44 57.6 50 54.6Z', fill: '#5c672c' },
      { d: 'M48 59L36 67.4M46.5 57.4L34.5 66', stroke: '#7d8843', sw: 0.45, noHalo: true },
      // body
      { d: 'M47.6 58C47.8 48 58 42 68 44C76 45.6 80.4 53 77.2 60C73.2 67.4 59 69.5 47.6 58Z', fill: '#86904a' },
      { d: 'M51.6 61C58.6 67.2 70 66.4 76 60.2C69 58.8 60 58.8 51.6 61Z', fill: '#d8cf8e', noHalo: true },
      { d: 'M60 61.6C62 62.6 64 62.8 66 62.6M57 60C59 61 61 61.3 63 61.2', stroke: '#bdb373', sw: 0.4, noHalo: true },
      // wing
      { d: 'M53.4 51C60.6 46.6 69.4 49.6 72.6 57C66.2 58.4 58.6 57.2 53.4 51Z', fill: '#65702f', noHalo: true },
      { d: 'M57.6 51.6C61.6 50.6 66 51.8 69.2 55M59.6 54.4C62.8 54.2 66 55.2 68.4 57', stroke: '#a7b064', sw: 0.5, noHalo: true },
      { d: 'M54 51.6L49 58', stroke: '#4c5524', sw: 0.5, noHalo: true },
      // head
      { d: circ(72, 45, 7.2), fill: '#86904a' },
      { d: 'M65.6 41.6C67.6 37.6 75.6 37 78.6 41.4C74.4 40.2 70 40.4 65.6 41.6Z', fill: '#737d3a', noHalo: true },
      { d: 'M69.4 41.8C72.6 40.6 76.6 40.8 79.6 43', stroke: '#e3dba0', sw: 0.75, noHalo: true },
      { d: circ(74.4, 44.8, 2.25), fill: '#f4efdc', noHalo: true },
      ...eye(74.6, 44.8, 1.25),
      { d: 'M78.8 45.1L85.6 46.7L78.8 48.6Z', fill: '#4a3f2a' },
      { d: 'M78.9 46.8L83.4 46.9', stroke: '#2a2318', sw: 0.35, noHalo: true },
      // feet
      { d: 'M60 66L59.3 70.8M58 71L61 71.2M66 66L66.6 70.4M65.2 70.6L68.2 70.4', stroke: '#5a4a35', sw: 0.9, noHalo: true },
    ],
  },
  // 3 · Cherry — Curtain (bright)
  11: {
    glyph: '幕',
    back: `<circle cx="70" cy="30" r="20" fill="${VERMILION}" opacity=".1"/><circle cx="70" cy="30" r="16" fill="url(#sun-red)" opacity=".95"/>`,
    parts: [
      // cords and tassels
      { d: 'M6 97.6C5 104 6 110 4.6 116M94 97.6C95 104 94 110 95.4 116', stroke: '#c9a24a', sw: 0.9 },
      { d: 'M3.4 115.4L5.8 115.4L6.6 122.6L2.6 122.6Z', fill: '#c9a24a' },
      { d: 'M94.2 115.4L96.6 115.4L97.4 122.6L93.4 122.6Z', fill: '#c9a24a' },
      // curtain body (red); white bands + folds go in `front`, clipped
      { d: CURTAIN_D, fill: '#a7342b', halo: 6 },
      // rod
      { d: 'M3 97.6L97 97.6', stroke: '#3f2f27', sw: 2.6 },
      { d: `${circ(3.6, 97.6, 2.2)}${circ(96.4, 97.6, 2.2)}`, fill: '#c9a24a' },
    ],
    front: (() => {
      let s = `<g clip-path="url(#curtain-clip)">`;
      // kōhaku bands that sway with the drape
      for (const x of [17.5, 39.5, 61.5, 83.5]) {
        s += `<path d="M${x - 5} 98C${x - 4.2} 110 ${x - 6} 120 ${x - 5} 140L${x + 5} 140C${x + 6} 120 ${x + 4.2} 110 ${x + 5} 98Z" fill="#f3e6dc"/>`;
      }
      // fold shadows and highlights
      for (let i = 0; i < 9; i++) {
        const x = 11 + i * 10;
        s += `<path d="M${x} 104C${x + 1.2} 114 ${x - 1} 122 ${x + 0.6} 136" fill="none" stroke="#3a0e09" stroke-opacity=".16" stroke-width="2.4"/>`;
        s += `<path d="M${x + 3.4} 104C${x + 4.4} 114 ${x + 2.6} 122 ${x + 4} 136" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1"/>`;
      }
      // heading band with cord loops
      s += `<rect x="0" y="99" width="100" height="4.4" fill="#7f251c"/>`;
      // a gold cord laced along the heading, dipping between the hanging points
      let cord = 'M0 100.4';
      for (let x = 0; x < 100; x += 8) cord += `Q${x + 4} 102.8 ${x + 8} 100.4`;
      s += `<path d="${cord}" fill="none" stroke="#c9a24a" stroke-width=".6"/>`;
      s += `<path d="M0 103.4H100" stroke="#c9a24a" stroke-width=".4" stroke-opacity=".8"/>`;
      s += `</g>`;
      // crest: cherry blossom in a ring
      s += `<circle cx="50" cy="117.4" r="8.4" fill="${PAPER}"/><circle cx="50" cy="117.4" r="7.4" fill="none" stroke="#a7342b" stroke-width=".8"/>`;
      for (let i = 0; i < 5; i++) {
        s += `<path transform="rotate(${i * 72} 50 117.4)" d="M50 117.4C47.6 116.2 47.4 112.8 49.2 112L50 112.9L50.8 112C52.6 112.8 52.4 116.2 50 117.4Z" fill="#c9566a"/>`;
      }
      return s + `<circle cx="50" cy="117.4" r="1.2" fill="#f2d79c"/>`;
    })(),
  },
  // 4 · Wisteria — Cuckoo under a crescent
  15: {
    glyph: '鵑',
    back: `<circle cx="78" cy="56" r="18" fill="#f3e3a8" opacity=".35"/>`,
    parts: [
      { d: crescent(78, 56, 12.5, 84, 51.5, 10.4), fill: '#e2b84e', halo: 3.6 },
      { d: crescent(78, 56, 10.6, 82.6, 52.4, 9.6), fill: '#efd27c', noHalo: true },
      ...move([
      // raised far wing
      { d: 'M45.6 105.4C47.6 94 58 84 74.6 77.6C68.6 87.6 62.6 96.6 56 106.4Z', fill: '#3a404c' },
      { d: 'M50 102C55 94 61 87 70 81.4M53 104C58 97 63 91 71 84.8', stroke: '#5c6474', sw: 0.5, noHalo: true },
      // long graduated tail with white tips
      { d: 'M37 110C29 109.6 20.6 111.4 12 115.6C18 116.8 24 116 28.6 115C22.6 118.8 18 122 13.6 126.4C22 124 30 119.4 38.4 113.6Z', fill: '#3c4350' },
      { d: `${circ(13.6, 115.6, 0.8)}${circ(14.4, 125.6, 0.8)}${circ(19.6, 113.4, 0.6)}${circ(19.4, 121.6, 0.6)}`, fill: '#e2ddd0', noHalo: true },
      // body + barred belly
      { d: 'M34 110.4C40 104 54 101.6 64.4 104.6C60.6 110.4 50 115.4 38 114.6Z', fill: '#4b5260' },
      { d: 'M38 113.4C46 115.6 56 113.6 62.4 109.4C60.6 113.6 52.4 117.6 42.4 117.4C40.4 116.6 39 115.4 38 113.4Z', fill: '#e2ddd0', noHalo: true },
      { d: 'M43 114.6L44 117M46.4 114.6L47.4 117.2M50 114L51 116.6M53.4 113.2L54.4 115.6M56.8 112L57.6 114.4M60 110.6L60.8 112.6', stroke: '#4b5260', sw: 0.5, noHalo: true },
      // near wing
      { d: 'M44 111.6C40 120 32 126 21.6 128.4C29.6 121.4 35.6 115.4 40 110Z', fill: '#353b46' },
      { d: 'M40.6 114C36 120 31 123.6 25.6 125.6', stroke: '#5c6474', sw: 0.45, noHalo: true },
      // head
      { d: circ(65.6, 104.2, 4.7), fill: '#4b5260' },
      { d: 'M69.8 103L75.6 104.4L69.8 106Z', fill: '#2f2b28' },
      { d: 'M69.8 105.4L72 105.1', stroke: '#c9a24a', sw: 0.6, noHalo: true },
      ...eye(66.8, 103.2, 0.75, '#e8c45a'),
      ], 'translate(2 4) scale(.92)'),
    ],
  },
  // 5 · Iris — Eight-plank bridge
  19: {
    glyph: '橋',
    back:
      `<path d="M4 102C24 98 40 104 60 100C76 97 88 101 96 99L96 136L4 136Z" fill="#d3dbe8"/>` +
      `<path d="M8 112Q20 109.5 32 112M54 108Q66 105.5 78 108M14 124Q28 121 42 124M62 120Q76 117 90 120M30 132Q44 129 58 132" fill="none" stroke="#a9b8cf" stroke-width=".8" stroke-linecap="round"/>`,
    parts: (() => {
      const segs: [Pt, Pt][] = [
        [[1, 108], [40, 97.5]],
        [[40, 97.5], [67, 111.5]],
        [[67, 111.5], [99, 101]],
      ];
      const out: Part[] = [];
      const posts: Part[] = [];
      for (const [a, b] of segs) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const at = (p: Pt, oy: number) => `${r1(p[0])} ${r1(p[1] + oy)}`;
        // plank deck seen from above at an angle, then its front face
        out.push({ d: `M${at(a, 2.4)}L${at(b, 2.4)}L${at(b, 6)}L${at(a, 6)}Z`, fill: '#6e5038' });
        out.push({ d: `M${at(a, -2.4)}L${at(b, -2.4)}L${at(b, 2.4)}L${at(a, 2.4)}Z`, fill: '#b38f66' });
        out.push({ d: `M${at(a, 0)}L${at(b, 0)}`, stroke: '#7f6145', sw: 0.5, noHalo: true });
        out.push({ d: `M${at(a, -1.2)}L${at(b, -1.2)}M${at(a, 1.2)}L${at(b, 1.2)}`, stroke: '#cfae80', sw: 0.35, noHalo: true, opacity: 0.8 });
        out.push({ d: `M${at(a, -2.4)}L${at(b, -2.4)}`, stroke: '#d9bd92', sw: 0.5, noHalo: true });
        for (const k of [0.15, 0.5, 0.85]) {
          const x = a[0] + dx * k;
          const y = a[1] + dy * k + 6;
          posts.push({ d: `M${r1(x)} ${r1(y - 1)}L${r1(x)} ${r1(y + 8)}`, stroke: '#3f2f27', sw: 1.6, halo: 2.4 });
          if (k === 0.5) posts.push({ d: `M${r1(x - 2)} ${r1(y + 9.8)}Q${r1(x)} ${r1(y + 9)} ${r1(x + 2)} ${r1(y + 9.8)}`, stroke: '#8fa4c0', sw: 0.6, noHalo: true });
        }
      }
      return [...posts, ...out];
    })(),
  },
  // 6 · Peony — Butterflies
  23: {
    glyph: '蝶',
    parts: [...butterfly('#4a679a', '#2a3d62', '#f2e6c8', 'translate(30 32) rotate(-14) scale(.94)'), ...butterfly('#dba548', '#9c6a22', '#fbefd5', 'translate(78 25) rotate(22) scale(.8)')],
  },
  // 7 · Bush clover — Boar
  27: {
    glyph: '猪',
    parts: [
      // far legs
      { d: 'M33 116L32 129.6L36.6 129.6L38.4 117ZM70 116L71.6 129L76 129L75 115Z', fill: '#2a211c' },
      // body
      { d: 'M14 110C12.4 98 22 88.4 37 86.4C48 85 57 82 66 85.6C72.6 88.2 76.6 93.4 80.4 98L88.6 102.6C91.6 104.6 91.4 109 88.2 111L82.4 112C78.4 118.6 70 121.4 60 121.4L32 122C22 122 14.8 118 14 110Z', fill: '#4a3a30' },
      // bristly mane along the back
      { d: 'M19 95L21.6 90.4L24 93.4L26.6 88L29.4 91.4L32.2 86L35 89.4L38.2 84.2L41 87.6L44.6 82.6L47.4 86.2L51 81.6L53.6 85.4L57.2 81.4L59.6 85.4L63 82.6L64.6 86.6L68.2 84.8', stroke: '#2a211c', sw: 1.4 },
      // flank light and belly shade
      { d: 'M24 101C33 92.4 50 89.6 64 91.6C55 95.2 40 97.8 27 105Z', fill: '#6b5545', noHalo: true },
      { d: 'M20 115C30 120 52 121 70 118C62 121.4 40 122.6 28 121C23 120.2 21 118 20 115Z', fill: '#2f2520', noHalo: true },
      { d: 'M30 99L33 103M37 96L40 100.4M44 94L47 98.6M51 93L53.6 97.4M58 92.6L60 96.6M34 107L37 111M42 105L45 109.4M50 104L53 108.6M58 103L60.6 107.4M66 100L68 104', stroke: '#2f2520', sw: 0.55, noHalo: true, opacity: 0.75 },
      // near legs (front + hind), sturdy, with hooves
      { d: 'M24 113C22.6 119 22 124 22 130L28 130.4C28.6 125 29.6 120 31.4 116Z', fill: '#3d3029' },
      { d: 'M60 116C61 121 62 125.6 62 130.6L67.4 130.6C67.4 125.6 67.6 120.6 68.6 115.6Z', fill: '#3d3029' },
      { d: 'M21.8 129.2L28.2 129.6L28.2 131.6L21.6 131.4ZM61.8 129.6L67.6 129.6L67.6 131.6L61.6 131.6Z', fill: '#1d1714', noHalo: true },
      // head detail: ear, eye, snout, tusk
      { d: 'M69 91.6L72.4 83.4L76.6 93Z', fill: '#3a2d25' },
      { d: 'M71 90.4L72.6 86L74.6 91Z', fill: '#7a6252', noHalo: true },
      { d: ell(89.4, 106.6, 1.5, 2.8), fill: '#6b5545', noHalo: true },
      { d: `${circ(89.6, 105.6, 0.45)}${circ(89.6, 107.8, 0.45)}`, fill: '#1d1714', noHalo: true },
      { d: 'M83.8 109.6C86 109 88 106.4 87.6 103', stroke: PAPER, sw: 1.4, noHalo: true },
      { d: 'M80 99.6C82 98.4 84 98.6 85.4 99.6', stroke: '#2f2520', sw: 0.6, noHalo: true },
      { d: circ(77.6, 99.8, 1.55), fill: '#c9b8a0', noHalo: true },
      ...eye(77.6, 99.8, 0.9),
      // curly tail
      { d: 'M15 104C10.4 101 7.6 104 9.6 107C11.6 109.4 9.4 111.6 7 110.4', stroke: '#4a3a30', sw: 1.4 },
    ],
  },
  // 8 · Silver grass — Geese
  30: {
    glyph: '雁',
    parts: [...goose('translate(22 44) rotate(-10) scale(1)', true), ...goose('translate(49 30) rotate(-10) scale(1.12)', false), ...goose('translate(76 40) rotate(-10) scale(.95)', true)],
  },
  // 8 · Silver grass — Full moon (bright)
  31: {
    glyph: '月',
    back:
      `<rect x="4" y="4" width="92" height="132" rx="6" fill="url(#sky-moon)"/>` +
      `<circle cx="50" cy="45" r="35" fill="#e59a78" opacity=".22"/><circle cx="50" cy="45" r="31" fill="#eaa785" opacity=".35"/>` +
      `<circle cx="50" cy="45" r="27.5" fill="url(#moon-face)"/>` +
      `<path d="M38 36c4-3 9-2 11 1s-1 6-5 6-8-4-6-7zM55 50c3-2 8-1 9 2s-2 5-5 5-6-4-4-7zM57 31c2-1 5 0 5 2s-2 3-4 2-3-3-1-4z" fill="#e6d4a8" opacity=".55"/>` +
      `<circle cx="50" cy="45" r="27.5" fill="none" stroke="#fffaf0" stroke-opacity=".6" stroke-width=".6"/>`,
    parts: [],
  },
  // 9 · Chrysanthemum — Sake cup
  35: {
    glyph: '盃',
    parts: [
      // foot
      { d: 'M41 111L59 111L56.4 121.4C54.6 123.6 45.4 123.6 43.6 121.4Z', fill: '#8f2a20' },
      { d: ell(50, 121.8, 8.2, 1.9), fill: '#7a2219' },
      { d: ell(50, 121.8, 8.2, 1.9), stroke: GOLD, sw: 0.5, noHalo: true },
      // bowl
      { d: 'M23.6 97C24.6 114 75.4 114 76.4 97Z', fill: '#b23b2e' },
      { d: 'M27.4 100.6C30 108 40 111.2 50 111.4C42 109 33 105.6 27.4 100.6Z', fill: '#d26a58', noHalo: true, opacity: 0.6 },
      { d: 'M30 108.6C40 112.6 60 112.6 70 108.6', stroke: GOLD, sw: 0.5, noHalo: true },
      // rim + sake surface
      { d: ell(50, 97, 26.4, 7.2), fill: '#c4472f' },
      { d: ell(50, 97.4, 23, 5.2), fill: '#8f2a20', noHalo: true },
      { d: ell(50, 98.2, 21, 4.1), fill: '#efe2c0', noHalo: true },
      { d: 'M36 97.6C42 96.4 50 96.6 56 98', stroke: '#fffaf0', sw: 0.6, noHalo: true, opacity: 0.85 },
      { d: 'M58 98.6C60.4 97.4 63.6 97.4 65 98.6C63 99.6 60.4 99.8 58 98.6Z', fill: '#e2a840', noHalo: true },
      { d: ell(50, 97, 26.4, 7.2), stroke: GOLD, sw: 1, noHalo: true },
    ],
    front: `<text x="50" y="109" text-anchor="middle" font-size="8.6" font-family="'Zen Old Mincho', serif" font-weight="600" fill="#e8c46a">寿</text>`,
  },
  // 10 · Maple — Deer looking back over its shoulder
  39: {
    glyph: '鹿',
    parts: [
      // far legs
      { d: 'M35 106C34 113 34.6 121 33.4 130.6M69.6 104C71 113 72 121 74.6 130', stroke: '#7a5230', sw: 2.1 },
      // body
      { d: 'M27.6 99.6C27 91.6 36 87.6 48 88.6C58 89.4 65.6 87.6 72 91.4C76.4 94.4 76.6 102 72.4 106C68.6 109 64 108.4 60 108.4C52 110 42 110 36 108.4C31 107 28 104 27.6 99.6Z', fill: '#b5793f' },
      { d: 'M36 106.4C44 109.4 56 109.4 64 106.4C60 110 46 111 38 109.4Z', fill: '#ecd6b0', noHalo: true },
      { d: 'M32 95C40 91 52 91 62 92.6', stroke: '#9a6230', sw: 1.2, noHalo: true, opacity: 0.6 },
      // white rump and short tail
      { d: 'M28.4 95.6C25 94 22.6 96 23.2 99.6C25 101.2 27.2 100.8 28.6 99.4Z', fill: PAPER },
      { d: 'M23.6 96.2C22.4 95.4 21.6 95.8 21.6 97', stroke: '#3a2a1c', sw: 0.9, noHalo: true },
      // dappled spots
      { d: [[37, 95.6], [43, 93.8], [49, 93.6], [55, 94.2], [61, 94.6], [40, 99.8], [46, 98.4], [52, 98.6], [58, 99], [44, 103], [50, 103], [36, 102]].map(([x, y]) => circ(x, y, 1.15)).join(''), fill: '#f3e2c4', noHalo: true },
      // near legs: slender, with a hock bend and dark hooves
      { d: 'M33 104C35.6 110 38.4 114 36.6 120.6L37.4 130.6M64.6 106.4L66.4 118.6L69.6 130.4', stroke: '#a26a35', sw: 2.5 },
      { d: 'M36.2 129.4L38.8 129.6L38.8 131.8L36 131.6ZM68.4 129.4L71 129L71.6 131.2L68.8 131.6Z', fill: '#3a2a1c', noHalo: true },
      // neck rising from the chest and leaning back over the body
      { d: 'M64.6 95.4C63 87.4 61 80.4 58.4 74L65.8 71C68.8 78 72.4 86 75.2 94.4Z', fill: '#b5793f' },
      { d: 'M65.6 93C63.6 86 61.8 80 60 75', stroke: '#ecd6b0', sw: 1.4, noHalo: true },
      // head turned to look back: muzzle points to the rear, tipped up
      { d: 'M66.2 71.6C66.4 66 62.6 61.6 56.6 61C52.6 60.6 49.4 61.2 48.8 63.2C49.4 65.8 53.4 67.6 56.8 68.6C59.8 69.6 62.6 72.8 66.2 71.6Z', fill: '#a86f38' },
      { d: 'M49.2 63.6C51.2 65.8 54.4 67.2 57.4 68', stroke: '#ecd6b0', sw: 0.9, noHalo: true },
      { d: circ(49.4, 62.6, 1.05), fill: '#2a1f18', noHalo: true },
      // ears swept back
      { d: 'M62.6 63.4C64.6 59.4 68.6 57.4 72.2 57.6C70 60.8 66.8 63.6 63.6 65.6Z', fill: '#a86f38' },
      { d: 'M64.2 63.2C65.8 60.8 68.2 59.4 70.2 59C68.6 61 66.6 62.8 64.8 64Z', fill: '#ecd6b0', noHalo: true },
      // antlers
      { d: 'M59.6 61.6C58 55.2 55.2 50.2 51.2 46.6M56.8 54.6L52.4 53.8M54.8 50.8L54 45.8M62.6 61.2C63 54.2 65.8 49.2 69.8 45.4M64.8 53L69 53.2M67 48.8L66.4 43.6', stroke: '#5a3c22', sw: 1.3 },
      ...eye(56.2, 63.8, 0.95),
    ],
  },
  // 11 · Willow — Swallow
  42: {
    glyph: '燕',
    parts: [
      // forked tail streamers
      { d: 'M43 93C36 90.4 28 86.4 18.6 83.4C26.6 88 33 91.4 38.4 94.2C32 96.4 25.4 100.4 18.4 105.4C27.6 101.6 35.4 98.2 43 96.4Z', fill: '#1f283d' },
      // upper wing (raised, sickle shaped)
      { d: 'M51.6 90.4C55.6 78 68 67.8 87 61.6C75 71.6 66.6 81.6 60 92.6Z', fill: '#2d3854' },
      { d: 'M56.6 87C61.4 79 68.6 72.4 79.6 66.6M58.4 89.6C63.4 82.6 69.4 77 78 72', stroke: '#4d5c80', sw: 0.5, noHalo: true },
      // body
      { d: 'M40 94.4C48 88 62 87 70.6 91.2C64.6 96.4 52 99.4 40 94.4Z', fill: '#26304a' },
      { d: 'M46 91.6C52 89.4 60 89 66 90.4', stroke: '#5a6b94', sw: 0.6, noHalo: true, opacity: 0.8 },
      { d: 'M46 96.2C54 99.2 62 97.6 67.4 94.2C62.4 99.4 54 101.4 46 96.2Z', fill: '#f4efe4', noHalo: true },
      // lower wing
      { d: 'M50 95.2C46 104.4 38 110.4 25.4 114.6C35.6 106.4 42 100.4 46 95.2Z', fill: '#1f283d' },
      { d: 'M46.4 98.6C42 104.6 36.4 108.6 30.6 111.4', stroke: '#4d5c80', sw: 0.45, noHalo: true },
      // head
      { d: circ(70, 90.6, 4.3), fill: '#26304a' },
      { d: 'M68.6 92.6C69.6 95 71.6 95.6 73.6 94.6C73.2 93.4 72.6 92.6 71.6 92.2Z', fill: '#b23b2e', noHalo: true },
      { d: 'M72 87.6C73 87.2 74 87.6 74.2 88.4', stroke: '#b23b2e', sw: 0.7, noHalo: true },
      { d: 'M73.8 89.6L78.2 90.6L73.8 91.8Z', fill: INK },
      ...eye(71.4, 89.6, 0.7),
    ],
  },
  // 11 · Willow — Rain (bright): the umbrella poet and the frog
  43: {
    glyph: '雨',
    back: `<rect x="4" y="4" width="92" height="132" fill="url(#sky-storm)"/><circle cx="74" cy="27" r="19" fill="${VERMILION}" opacity=".1"/><circle cx="74" cy="27" r="15" fill="url(#sun-red)" opacity=".9"/>`,
    parts: [
      // umbrella shaft (behind the figure)
      { d: 'M46 61L46 100', stroke: '#4a3830', sw: 1.2 },
      // robe: wide court robe in indigo, white underlayer at the hem
      { d: 'M38 92C42 89.6 51 89.6 55 92L64.6 125.6C58 129 38 130.2 29.6 126.6Z', fill: '#3f4a6a', halo: 6 },
      { d: 'M30.4 126C40 129.6 56 129 64 125L64.8 128.2C56 131.6 40 132.2 30.6 129.2Z', fill: '#e8e0cf', noHalo: true },
      { d: 'M38.6 98C37 108 35.4 116 33.4 125M45 96L43.8 127.6M52.6 97C55 108 57.4 116 59.6 126', stroke: '#2b3450', sw: 0.6, noHalo: true },
      { d: 'M40 106.6C46 108.4 52 108 57.6 106', stroke: '#b23b2e', sw: 1.4, noHalo: true },
      // big hanging sleeve lifting the umbrella
      { d: 'M49 94.4C56.6 95 62 100.4 62.6 108.6C62.8 112.6 60.2 114.4 56.8 113.4C53.4 112.4 50.6 106 49 101Z', fill: '#34405e' },
      { d: 'M56.8 113.4C59 113.8 61.6 112.8 62.4 110.4', stroke: '#b23b2e', sw: 0.9, noHalo: true },
      { d: circ(47.2, 99.4, 1.8), fill: '#efdcc0' },
      // feet
      { d: `${ell(39, 130.6, 2.6, 1.2)}${ell(56.6, 130.4, 2.6, 1.2)}`, fill: INK },
      // head: face in profile, black court cap (eboshi)
      { d: 'M45.4 89.4C45 86.4 46.8 84.4 49.2 84.6C51.6 84.8 52.8 86.6 52.6 88.4L53.6 89.4L52.4 89.8C52 91.4 50.6 92.4 48.6 92.2C46.8 92 45.6 90.8 45.4 89.4Z', fill: '#efdcc0' },
      { d: 'M45 87.4C44.6 82 46.6 78 50.6 75.6C51.2 79 51.8 82.6 51.8 85.6C49.4 85.2 47 86 45 87.4Z', fill: INK },
      { d: 'M45.4 89C46.4 91.6 48 92.6 49.6 92.4L48 93.6C46.4 93.2 45.4 91.4 45.4 89Z', fill: '#2a2724', noHalo: true },
      { d: circ(50.6, 87.6, 0.45), fill: INK, noHalo: true },
      ...move([
      // the umbrella: oiled paper, ribs, an indigo janome ring
      { d: 'M15.6 86.6C22.6 73.4 34.6 65.6 46 65.6C57.4 65.6 69.4 73.4 76.4 86.6Q70.6 83.8 64.6 86.6Q58.6 83.8 52.6 86.6Q46.6 83.8 40.6 86.6Q34.6 83.8 28.6 86.6Q22.6 83.8 15.6 86.6Z', fill: '#d6a94c', halo: 5.5 },
      { d: 'M46 65.6C57.4 65.6 69.4 73.4 76.4 86.6Q70.6 83.8 64.6 86.6Q58.6 83.8 52.6 86.6C52.4 78 50 70 46 65.6Z', fill: '#bd8f3a', noHalo: true },
      { d: 'M23.4 79.4C30 72.6 38 69.6 46 69.6C54 69.6 62 72.6 68.6 79.4', stroke: '#3f4a6a', sw: 2.2, noHalo: true },
      { d: 'M46 65.6L16 86.6M46 65.6L28.6 86.6M46 65.6L40.6 86.6M46 65.6L52.6 86.6M46 65.6L64.6 86.6M46 65.6L76 86.6', stroke: '#8e6c28', sw: 0.45, noHalo: true },
      { d: ell(46, 65.2, 1.7, 1.1), fill: INK, noHalo: true },
      ], 'translate(0 -5)'),
      ...move([
      // the frog, leaping up at a willow strand
      { d: 'M74.4 126.4C71.6 120.6 75.4 114 81.6 113.6C87 113.8 89.6 119.4 87.6 124.6C85.6 129 77.4 130.4 74.4 126.4Z', fill: '#5f8a4a' },
      { d: 'M77.4 125.4C77 121.2 79.8 118 83 118.8C85.2 120.6 84.6 125.8 81.4 127.2Z', fill: '#b3cb87', noHalo: true },
      { d: 'M75.4 125C70.6 125.6 68 129.6 71.6 131.6L78 131.4M84.8 116.6L88.6 108.4M88.6 108.4L87.4 106.6M88.6 108.4L90.4 107.2M80 115L81 108', stroke: '#4f7a3e', sw: 1.6 },
      { d: `${circ(79.6, 114.2, 1.7)}${circ(84.6, 115, 1.7)}`, fill: '#5f8a4a' },
      ...eye(79.6, 114, 0.75),
      ...eye(84.6, 114.8, 0.75),
      { d: 'M77 121.6C78 120.4 79.6 120 80.6 120.6M76.6 124.6C77.6 123.6 79 123.2 80 123.8', stroke: '#3f6a32', sw: 0.45, noHalo: true },
      ], 'translate(-61 -1) translate(80 122) scale(-1 1) translate(-80 -122)'),
    ],
  },
  // 12 · Paulownia — Phoenix (bright)
  47: {
    glyph: '鳳',
    back: `<rect x="4" y="4" width="92" height="132" fill="url(#sky-red)"/>`,
    parts: [
      // far wing: a fan of gold and green feathers sweeping up and right
      ...featherFan(60, 40, -78, -28, 6, (i) => 28 - i * 2, 5.4, ['#d9a441', '#c58f30'], -0.1),
      ...featherFan(60, 40, -70, -36, 4, (i) => 16 - i, 5, ['#3f6a50', '#4f7d5f'], -0.08),
      // long tail plumes
      ...plume([[52, 52], [40, 56], [27, 60], [15, 68], [9, 80], [12, 90]], 4.6, '#3f6a50', '#86b08f', ['#e2bd62', '#4f7d5f']),
      ...plume([[52, 54], [42, 64], [30, 74], [20, 88], [18, 102], [24, 110]], 4.8, '#d9a441', '#f3d58c', ['#f3e3b4', '#c4472f']),
      ...plume([[54, 55], [48, 70], [40, 86], [34, 102], [36, 116], [44, 122]], 4.6, '#2f4a6d', '#6f8db8', ['#c9d6ea', '#d9a441']),
      ...plume([[56, 55], [57, 68], [54, 82], [52, 96], [56, 106]], 4, VERMILION, '#ec9a7e', ['#f3d58c', '#a8352a']),
      // near wing: big fan sweeping up and left, coverts on top
      ...featherFan(55, 44, -168, -100, 8, (i) => 30 - Math.abs(i - 2) * 1.6, 6, ['#d9a441', '#e2b55a'], 0.1),
      ...featherFan(55, 44, -160, -108, 6, (i) => 18 - Math.abs(i - 2), 5.6, [VERMILION, '#d65a3e'], 0.08),
      ...featherFan(55, 44, -150, -115, 4, () => 9.5, 5.2, ['#3f6a50', '#2f4a6d'], 0.05),
      // body with scaled breast
      { d: 'M46.6 50.4C44.6 41.6 53.6 35.6 62 38C66.6 40 66.4 46.6 62.4 50.6C58 55 51 55.6 46.6 50.4Z', fill: VERMILION },
      { d: 'M53 41C54.6 42.4 56.4 42.4 58 41M51 45C52.6 46.4 54.6 46.4 56.2 45M55 46.4C56.6 47.8 58.6 47.8 60.2 46.4M49.4 49C51 50.4 53 50.4 54.6 49M54 50.6C55.6 52 57.6 52 59.2 50.6', stroke: '#f3d58c', sw: 0.55, noHalo: true },
      // neck and head
      { d: 'M59.4 40.6C61.4 34.6 66 30 70.6 28.4L74.6 30.6C71.4 33.6 68 38.4 64.6 44.4Z', fill: '#c4472f' },
      { d: 'M62 39C64 34.6 67.4 31.6 71 30', stroke: '#f3d58c', sw: 0.6, noHalo: true },
      { d: circ(72.4, 27.4, 4.5), fill: '#c4472f' },
      { d: 'M76.2 25.8L82 27.6L76.2 29.6Z', fill: '#e8c46a' },
      { d: 'M74 30.8C75 33.6 74.4 36 72.6 37.4C72.2 35 72.4 32.6 74 30.8Z', fill: '#3f6a50' },
      // crest plumes
      { d: 'M70.6 23.6C68.4 18.6 69 14 72.4 11.4M72.6 23.2C72.6 18.4 74.6 14.6 78.6 13M68.6 24.6C65.4 21.4 64.6 17.4 66.2 14', stroke: '#e8c46a', sw: 1.1 },
      { d: `${circ(72.4, 11.4, 1.3)}${circ(78.6, 13, 1.3)}${circ(66.2, 14, 1.1)}`, fill: '#e8c46a' },
      ...eye(73.4, 26.4, 0.95, '#f3d58c'),
    ],
  },
};
