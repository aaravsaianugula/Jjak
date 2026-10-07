/**
 * Home-screen landscape. One ink-wash vignette per season, matching the
 * chapter the player is in: five or six ridges fading into mist, a sun or
 * moon, a small focal detail (pagoda, flooded paddies, temple, snowed-in
 * village), the season's flower reaching in from the edge, and slow drifting
 * particles (petals, fireflies, leaves, snow).
 *
 * Pure SVG paths and gradients (no filters, no images). ViewBox 400×220,
 * `xMidYMax slice`: on a tall phone only x≈72–328 shows, so the focal details
 * live there. The lower-left stays calm because the seal, wordmark and
 * tagline sit over it.
 */

type Pt = [number, number];

/** Builder: per-season id prefix, <defs> and body markup. */
interface B {
  p: string;
  defs: string[];
  g: string[];
}

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/** Small deterministic PRNG (xorshift32) so scenes are stable. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Catmull-Rom spline through `pts` as cubic Béziers. */
function smooth(pts: Pt[], move = true): string {
  let d = `${move ? 'M' : 'L'}${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d +=
      `C${n1(p1[0] + (p2[0] - p0[0]) / 6)} ${n1(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${n1(p2[0] - (p3[0] - p1[0]) / 6)} ${n1(p2[1] - (p3[1] - p1[1]) / 6)} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return d;
}

const poly = (pts: Pt[]): string => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n1(x)} ${n1(y)}`).join('');

function yAt(pts: Pt[], x: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[x < pts[0][0] ? 0 : pts.length - 1][1];
}

interface RidgeOpts {
  seed: number;
  base: number;
  /** [x, height, width] gaussian peaks for composition */
  peaks?: [number, number, number][];
  wave?: number;
  rough?: number;
  step?: number;
}

function ridge(o: RidgeOpts): Pt[] {
  const r = rng(o.seed);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const w = o.wave ?? 5;
  const step = o.step ?? 8;
  const pts: Pt[] = [];
  for (let x = -16; x <= 416; x += step) {
    let y = o.base - w * (Math.sin(x / 47 + ph[0]) * 0.6 + Math.sin(x / 23 + ph[1]) * 0.3 + Math.sin(x / 11 + ph[2]) * 0.1);
    for (const [px, h, wd] of o.peaks ?? []) {
      const t = (x - px) / wd;
      y -= h * Math.exp(-t * t);
    }
    y += (r() - 0.5) * (o.rough ?? 1.2);
    pts.push([x, y]);
  }
  return pts;
}

/* ---------- defs helpers ---------- */

type Stop = [number, string, number?];
const stops = (s: Stop[]): string =>
  s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('');

function vgrad(b: B, key: string, y1: number, y2: number, s: Stop[]): string {
  const id = b.p + key;
  b.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(y1)}" x2="0" y2="${n1(y2)}">${stops(s)}</linearGradient>`);
  return `url(#${id})`;
}

function rgrad(b: B, key: string, s: Stop[]): string {
  const id = b.p + key;
  if (!b.defs.some((d) => d.includes(`id="${id}"`))) b.defs.push(`<radialGradient id="${id}">${stops(s)}</radialGradient>`);
  return `url(#${id})`;
}

/* ---------- painting helpers ---------- */

/** A ridge filled with an ink-wash gradient: toned at the crest, dissolving into mist below. */
function hill(b: B, key: string, pts: Pt[], top: string, bottom: string, depth: number, floor = 232): void {
  const minY = Math.min(...pts.map((p) => p[1]));
  const fill = vgrad(b, key, minY, minY + depth, [
    [0, top],
    [1, bottom],
  ]);
  b.g.push(`<path d="${smooth(pts)}L416 ${floor}L-16 ${floor}Z" fill="${fill}"/>`);
}

/** Tapered ribbon along a run of points: one brush stroke. */
function ribbon(seg: Pt[], w: number, r: () => number): string {
  const n = seg.length - 1;
  const tw = (k: number) => Math.sin((Math.PI * k) / n) ** 0.7;
  const top = seg.map(([x, y], k) => [x, y - w * 0.25 * tw(k)] as Pt);
  const bot = seg.map(([x, y], k) => [x, y + w * tw(k) * (0.7 + r() * 0.6)] as Pt).reverse();
  return smooth(top) + smooth(bot, false) + 'Z';
}

/** Broken dry-brush strokes along a crest line. */
function crest(b: B, pts: Pt[], seed: number, w: number, color: string, op: number, fromX = -99): void {
  const r = rng(seed);
  let d = '';
  let i = 0;
  while (i < pts.length - 2) {
    const j = Math.min(pts.length - 1, i + 4 + Math.floor(r() * 9));
    // strokes thin out toward `fromX` so the calm side stays unlined
    const fade = Math.min(1, Math.max(0, (pts[i][0] - fromX) / 60));
    if (r() > 0.15 && fade > 0.05) d += ribbon(pts.slice(i, j + 1), w * fade * (0.55 + r() * 0.7), r);
    i = j + (r() < 0.45 ? 1 : 0);
  }
  b.g.push(`<path d="${d}" fill="${color}" opacity="${op}"/>`);
}

const ellipse = (x: number, y: number, rx: number, ry: number): string =>
  `M${n1(x - rx)} ${n1(y)}a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(2 * rx)} 0a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(-2 * rx)} 0`;

/** Scattered dabs (tree crowns, blossom clouds, "rice dots") hugging a ridge. */
function dabs(
  b: B,
  pts: Pt[],
  o: {
    x0: number;
    x1: number;
    n: number;
    seed: number;
    r0: number;
    r1: number;
    below: number;
    colors: string[];
    op: number;
    round?: boolean;
    lift?: number;
    /** [centre, half-width, dome height]: gather dabs into groves that mound above the crest */
    clumps?: [number, number, number][];
  },
): void {
  const r = rng(o.seed);
  const groups = o.colors.map(() => '');
  for (let k = 0; k < o.n; k++) {
    let x = o.x0 + r() * (o.x1 - o.x0);
    let dome = 0;
    if (o.clumps) {
      const [c, hw, h] = o.clumps[Math.floor(r() * o.clumps.length)];
      const t = (r() + r() - 1) * 1.05;
      x = c + t * hw;
      dome = h * (1 - t * t);
    }
    const rx = o.r0 + r() * (o.r1 - o.r0);
    const y = yAt(pts, x) + r() * o.below + rx * (o.lift ?? 0.2) - dome * (0.6 + r() * 0.4);
    const ry = o.round ? rx * (0.85 + r() * 0.15) : rx * (0.5 + r() * 0.25);
    groups[Math.floor(r() * o.colors.length)] += ellipse(x, y, rx, ry);
  }
  b.g.push(groups.map((d, i) => (d ? `<path d="${d}" fill="${o.colors[i]}" opacity="${o.op}"/>` : '')).join(''));
}

/** Soft mounded mass under a grove, so its dabs read as foliage rather than loose dots. */
function groveMass(b: B, pts: Pt[], clumps: [number, number, number][], color: string, op: number): void {
  const id = `${b.p}gm${color.slice(1)}`;
  b.defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`);
  let out = '';
  for (const [c, hw, h] of clumps) {
    const top: Pt[] = [];
    for (let k = 0; k <= 10; k++) {
      const t = -1 + k / 5;
      const x = c + t * hw * 1.05;
      top.push([x, yAt(pts, x) + 8 - (h * 0.85 + 6) * (1 - t * t)]);
    }
    const bot = top.map(([x]) => [x, yAt(pts, x) + 8] as Pt).reverse();
    out += `<path d="${smooth(top)}${poly(bot).replace(/^M/, 'L')}Z" fill="url(#${id})"/>`;
  }
  b.g.push(`<g opacity="${op}">${out}</g>`);
}

function mist(b: B, cx: number, cy: number, rx: number, ry: number, op: number, color = '#ffffff'): void {
  const fill = rgrad(b, `mist${color.slice(1)}`, [
    [0, color, 0.95],
    [0.55, color, 0.55],
    [1, color, 0],
  ]);
  b.g.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${op}"/>`);
}

/** Thin horizontal cloud wisps (tapered strokes). */
function wisps(b: B, list: [number, number, number][], color: string, op: number, seed: number): void {
  const r = rng(seed);
  let d = '';
  for (const [x, y, len] of list) {
    const seg: Pt[] = [];
    for (let k = 0; k <= 6; k++) seg.push([x + (len * k) / 6, y + Math.sin(k * 0.9 + x) * 0.6]);
    d += ribbon(seg, 1.6 + r() * 1.2, r);
  }
  b.g.push(`<path d="${d}" fill="${color}" opacity="${op}"/>`);
}

function disc(b: B, cx: number, cy: number, r: number, color: string, halo: string, haloR: number, haloOp: number, op = 0.9): void {
  const h = rgrad(b, 'halo', [
    [0, halo, haloOp],
    [0.35, halo, haloOp * 0.45],
    [1, halo, 0],
  ]);
  b.g.push(`<circle cx="${cx}" cy="${cy}" r="${haloR}" fill="${h}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}"/>`);
}

/** Tapered branch through `pts` (w0 at the root, w1 at the tip). */
function branch(pts: Pt[], w0: number, w1: number, angular = false): string {
  const L: Pt[] = [];
  const R: Pt[] = [];
  const n = pts.length - 1;
  pts.forEach(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)];
    const c = pts[Math.min(n, i + 1)];
    let dx = c[0] - a[0];
    let dy = c[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const w = (w0 + (w1 - w0) * (i / n)) / 2;
    L.push([x - dy * w, y + dx * w]);
    R.push([x + dy * w, y - dx * w]);
  });
  R.reverse();
  return angular ? poly(L) + poly(R).replace(/^M/, 'L') + 'Z' : smooth(L) + smooth(R, false) + 'Z';
}

/* ---------- motifs ---------- */

function pagoda(x: number, y: number, s: number, color: string, op: number): string {
  let d = 'M-7 0H7V-2H-7ZM-5.4 -2L-2.6 -27H2.6L5.4 -2Z';
  for (let i = 0; i < 5; i++) {
    const yi = -5.5 - i * 5.2;
    const w = 9.2 - i * 1.25;
    d +=
      `M${n1(-w)} ${n1(yi - 1.6)}Q${n1(-w * 0.55)} ${n1(yi + 0.3)} ${n1(-w * 0.28)} ${n1(yi - 2.4)}` +
      `H${n1(w * 0.28)}Q${n1(w * 0.55)} ${n1(yi + 0.3)} ${n1(w)} ${n1(yi - 1.6)}` +
      `Q${n1(w * 0.6)} ${n1(yi + 1.3)} 0 ${n1(yi + 1.1)}Q${n1(-w * 0.6)} ${n1(yi + 1.3)} ${n1(-w)} ${n1(yi - 1.6)}Z`;
  }
  d += 'M-.35 -27.5H.35V-38H-.35Z' + ellipse(0, -30, 1.1, 0.45) + ellipse(0, -32.2, 1, 0.4) + ellipse(0, -34.4, 0.9, 0.38);
  return `<path transform="translate(${n1(x)} ${n1(y)}) scale(${s})" d="${d}" fill="${color}" opacity="${op}"/>`;
}

function temple(x: number, y: number, s: number, roof: string, wall: string): string {
  const roofD =
    'M-23 -9.5Q-18 -7.5 -14 -7.4H14Q18 -7.5 23 -9.5Q17 -10 12.5 -12.5L9 -17Q9.5 -18.2 10.4 -18.8L-10.4 -18.8Q-9.5 -18.2 -9 -17L-12.5 -12.5Q-17 -10 -23 -9.5Z';
  return (
    `<g transform="translate(${n1(x)} ${n1(y)}) scale(${s})">` +
    `<path d="M-19 0H19V-2.2H-19Z" fill="${wall}" opacity=".9"/>` +
    `<path d="M-14 -2.2H14V-7.6H-14Z" fill="${wall}"/>` +
    `<path d="M-12 -2.2h1.2v-5.4h-1.2ZM-6 -2.2h1.2v-5.4h-1.2ZM4.8 -2.2h1.2v-5.4h-1.2ZM10.8 -2.2h1.2v-5.4h-1.2Z" fill="${roof}" opacity=".85"/>` +
    `<path d="${roofD}" fill="${roof}"/></g>`
  );
}

/** Small hanok-style house: curved roof, plaster wall, optional lit window and snow. */
function house(x: number, y: number, s: number, roof: string, wall: string, lit?: string, snow?: string): string {
  let out =
    `<g transform="translate(${n1(x)} ${n1(y)}) scale(${s})">` +
    `<path d="M-6 0H6V-3.4H-6Z" fill="${wall}"/>` +
    `<path d="M-9.5 -3.9Q-6.5 -3.2 -5.2 -4.6L-3.2 -7.8H3.2L5.2 -4.6Q6.5 -3.2 9.5 -3.9Q6 -2.7 0 -2.9Q-6 -2.7 -9.5 -3.9Z" fill="${roof}"/>`;
  if (snow) out += `<path d="M-8.6 -4.3Q-6 -4.1 -4.9 -5.4L-3.1 -8.3H3.1L4.9 -5.4Q6 -4.1 8.6 -4.3Q6 -5 4.4 -5.9L2.8 -7.4H-2.8L-4.4 -5.9Q-6 -5 -8.6 -4.3Z" fill="${snow}"/>`;
  if (lit) out += `<path d="M-3.6 -.6h2.2v-2h-2.2ZM1.6 -.6h2.2v-2h-2.2Z" fill="${lit}"/>`;
  return out + '</g>';
}

function conifer(x: number, y: number, h: number, color: string, snow?: string): string {
  const w = h * 0.26;
  let out = `<path d="M${n1(x)} ${n1(y - h)}L${n1(x + w * 0.6)} ${n1(y - h * 0.55)}L${n1(x + w * 0.4)} ${n1(y - h * 0.5)}L${n1(x + w)} ${n1(y)}H${n1(x - w)}L${n1(x - w * 0.4)} ${n1(y - h * 0.5)}L${n1(x - w * 0.6)} ${n1(y - h * 0.55)}Z" fill="${color}"/>`;
  if (snow) out += `<path d="M${n1(x)} ${n1(y - h)}L${n1(x + w * 0.36)} ${n1(y - h * 0.73)}Q${n1(x)} ${n1(y - h * 0.8)} ${n1(x - w * 0.36)} ${n1(y - h * 0.73)}Z" fill="${snow}"/>`;
  return out;
}

/** Cherry petal pointing up, notched tip; fill inherits from the <use>. */
const PETAL = 'M0 0C-3.2 -1 -3.6 -4.6 -1.4 -5.4Q-.6 -5.5 0 -4.7Q.6 -5.5 1.4 -5.4C3.6 -4.6 3.2 -1 0 0Z';

function blossomDefs(b: B): void {
  let cherry = '';
  let plum = '';
  for (let i = 0; i < 5; i++) {
    cherry += `<path d="${PETAL}" transform="rotate(${i * 72})"/>`;
    const a = ((i * 72 - 90) * Math.PI) / 180;
    plum += `<circle cx="${n1(Math.cos(a) * 2.5)}" cy="${n1(Math.sin(a) * 2.5)}" r="2.35"/>`;
  }
  b.defs.push(
    `<g id="${b.p}fl-ch">${cherry}<circle r="1.1" fill="#c45d74"/><path d="M0 0L0 -2.4M0 0L2.2 -.9M0 0L1.4 1.9M0 0L-1.4 1.9M0 0L-2.2 -.9" stroke="#c96b80" stroke-width=".3" opacity=".7"/></g>`,
    `<g id="${b.p}fl-pl">${plum}<circle r="1.25" fill="#f1d27a"/><circle r=".55" fill="#9c3a3f"/></g>`,
  );
}

function mapleDef(b: B): void {
  // 7 lobes over ~250°, centre lobe longest; notches at 0.32R.
  const lobes = [-215, -175, -132, -90, -48, -5, 35];
  const lens = [0.5, 0.78, 0.95, 1, 0.95, 0.78, 0.5];
  const pts: Pt[] = [[0, 0.9]];
  lobes.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const R = 5.4 * lens[i];
    if (i > 0) {
      const m = (((deg + lobes[i - 1]) / 2) * Math.PI) / 180;
      pts.push([Math.cos(m) * 1.7, Math.sin(m) * 1.7]);
    }
    const side = 0.22;
    pts.push([Math.cos(a - side) * R * 0.62, Math.sin(a - side) * R * 0.62]);
    pts.push([Math.cos(a) * R, Math.sin(a) * R]);
    pts.push([Math.cos(a + side) * R * 0.62, Math.sin(a + side) * R * 0.62]);
  });
  const veins = lobes.map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    return `M0 0L${n1(Math.cos(a) * 4.6 * lens[i])} ${n1(Math.sin(a) * 4.6 * lens[i])}`;
  });
  b.defs.push(
    `<g id="${b.p}fl-mp"><path d="${poly(pts)}Z"/><path d="${veins.join('')}M0 0L0 3.4" stroke="#fff3e2" stroke-opacity=".35" stroke-width=".3" fill="none"/></g>`,
  );
}

const use = (b: B, id: string, x: number, y: number, s: number, rot: number, fill: string, op = 1): string =>
  `<use href="#${b.p}${id}" transform="translate(${n1(x)} ${n1(y)}) rotate(${Math.round(rot)}) scale(${s})" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`;

function iris(x: number, y: number, s: number, rot: number): string {
  return (
    `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${rot}) scale(${s})">` +
    `<path d="M0 -.6C-2.8 -3.4 -2.4 -8.4 -.6 -9.8C.6 -8.4 .9 -4 0 -.6ZM0 -.6C2.4 -3.6 3.2 -7.8 1.6 -9.4C.2 -8 -.4 -4 0 -.6Z" fill="#8a7db6"/>` +
    `<path d="M0 0C-2.6 -1.2 -6.8 .2 -7.4 3.6C-5.4 5 -2 3.2 0 0ZM0 0C2.6 -1.2 6.8 .2 7.4 3.6C5.4 5 2 3.2 0 0ZM0 0C-1.6 1.8 -1.8 5.6 0 7.4C1.8 5.6 1.6 1.8 0 0Z" fill="#5d4f92"/>` +
    `<path d="M-1.4 .8L-4.6 2.4M1.4 .8L4.6 2.4M0 1.4V4.6" stroke="#f1df9a" stroke-width=".9" stroke-linecap="round"/>` +
    `<path d="M-.2 .4C-.6 -1.6 -.8 -3 -.6 -5" stroke="#b9aedb" stroke-width=".5" fill="none"/></g>`
  );
}

function glow(b: B, x: number, y: number, r: number, color: string, op: number): string {
  const g = rgrad(b, `gl${color.slice(1)}`, [
    [0, color, 0.9],
    [0.4, color, 0.35],
    [1, color, 0],
  ]);
  return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${r}" fill="${g}" opacity="${op}"/>`;
}

/** A small cherry tree: ink trunk, two forks, a mounded cloud of blossom. */
function cherryTree(b: B, x: number, y: number, h: number, seed: number): void {
  b.g.push(
    `<path d="${branch([[x, y], [x - 1, y - h * 0.45], [x + 1, y - h * 0.8]], h * 0.12, h * 0.04)}${branch([[x - 1, y - h * 0.45], [x - h * 0.35, y - h * 0.75]], h * 0.06, h * 0.02)}${branch([[x, y - h * 0.55], [x + h * 0.35, y - h * 0.8]], h * 0.05, h * 0.02)}" fill="#5a4448"/>`,
  );
  const top: Pt[] = [[x - h, y - h * 0.62], [x + h, y - h * 0.62]];
  const cl: [number, number, number][] = [[x, h * 0.62, h * 0.32], [x - h * 0.32, h * 0.32, h * 0.12], [x + h * 0.34, h * 0.32, h * 0.12]];
  dabs(b, top, { x0: 0, x1: 0, n: 40, seed, r0: h * 0.08, r1: h * 0.17, below: h * 0.12, colors: ['#e6aebd', '#eec2cc', '#dc9db0'], op: 0.95, round: true, clumps: cl });
  dabs(b, top, { x0: 0, x1: 0, n: 22, seed: seed + 1, r0: h * 0.05, r1: h * 0.1, below: h * 0.05, colors: ['#f8e0e6', '#fbecef'], op: 0.9, round: true, lift: -1, clumps: cl });
}

/* ---------- seasons ---------- */

function spring(b: B): void {
  b.g.push(
    `<rect width="400" height="220" fill="${vgrad(b, 'sky', 0, 150, [
      [0, '#efd6da'],
      [0.55, '#f6e5e1'],
      [1, '#f6eee3'],
    ])}"/>`,
  );
  disc(b, 236, 62, 19, '#efb2aa', '#f4c4bb', 64, 0.6, 0.82);
  wisps(b, [[150, 56, 110], [206, 70, 120], [92, 40, 70], [262, 48, 60]], '#fbf3ee', 0.75, 3);

  // 1 · distant mountains
  const far = ridge({ seed: 11, base: 114, wave: 5, peaks: [[118, 22, 38], [196, 12, 28], [300, 27, 44], [372, 14, 30]] });
  hill(b, 'far', far, '#d8c2cc', '#f3e8e4', 42);
  crest(b, far, 12, 1.1, '#bea2b1', 0.45);
  mist(b, 200, 118, 230, 10, 0.85, '#fbf2ec');

  // 2 · far cherry hills: clouds of blossom
  const ch = ridge({ seed: 23, base: 130, wave: 6, peaks: [[56, 8, 40], [170, 11, 50], [292, 10, 40]] });
  hill(b, 'ch', ch, '#e7c4cd', '#f4e6e3', 30);
  const groves: [number, number, number][] = [[24, 26, 6], [92, 20, 4], [158, 30, 8], [234, 22, 5], [302, 32, 10], [374, 26, 7]];
  groveMass(b, ch, groves, '#e2b4c0', 0.9);
  dabs(b, ch, { x0: 0, x1: 0, n: 300, seed: 24, r0: 1.6, r1: 3.8, below: 7, colors: ['#eac0ca', '#e2afbd', '#f2d6dc', '#d9a5b4'], op: 0.9, round: true, clumps: groves });
  dabs(b, ch, { x0: 0, x1: 0, n: 120, seed: 25, r0: 1, r1: 2.2, below: 4, colors: ['#f4dce1', '#f7e5e8'], op: 0.8, round: true, lift: -0.8, clumps: groves });
  mist(b, 130, 142, 210, 8, 0.75, '#fbf2ec');

  // 3 · pagoda hill
  const mid = ridge({ seed: 37, base: 152, wave: 4, peaks: [[268, 19, 34], [96, 5, 50]] });
  hill(b, 'mid', mid, '#cfa5b1', '#eedfdb', 36);
  crest(b, mid, 38, 1.4, '#a37b8b', 0.45, 150);
  b.g.push(pagoda(270, yAt(mid, 270) + 4, 0.95, '#8e6577', 0.72));
  const mg: [number, number, number][] = [[238, 16, 5], [298, 20, 7], [338, 14, 4], [384, 18, 5]];
  groveMass(b, mid, mg, '#d9a0b0', 0.9);
  dabs(b, mid, { x0: 0, x1: 0, n: 130, seed: 39, r0: 1.6, r1: 3.6, below: 6, colors: ['#dea0b1', '#e9b9c5', '#d091a3'], op: 0.92, round: true, lift: 0.6, clumps: mg });
  dabs(b, mid, { x0: 0, x1: 0, n: 50, seed: 40, r0: 1, r1: 2, below: 3, colors: ['#f2d3da', '#eec8d1'], op: 0.85, round: true, lift: -0.4, clumps: mg });
  mist(b, 236, 162, 190, 8, 0.7, '#fbf2ec');

  // 4 · near meadow (calm under the wordmark)
  const near = ridge({ seed: 41, base: 182, wave: 2.5, peaks: [[384, 24, 70], [310, 8, 34]] });
  hill(b, 'near', near, '#dcbcc0', '#f1e6e0', 46);
  crest(b, near, 42, 1.2, '#b88f9b', 0.4, 230);
  cherryTree(b, 322, yAt(near, 322) + 3, 20, 44);
  cherryTree(b, 356, yAt(near, 356) + 3, 26, 45);

  // 5 · foreground bank
  const fg = ridge({ seed: 43, base: 206, wave: 2, peaks: [[396, 14, 50]] });
  hill(b, 'fg', fg, '#ead8d5', '#f3ebe5', 24);

  // 6 · cherry branch from the upper right
  const ink = '#4b3a3a';
  b.g.push(
    '<g transform="translate(-6 16)">',
    `<path d="${branch([[424, 4], [392, 14], [360, 20], [330, 31], [302, 44], [276, 50], [254, 49]], 6.5, 0.6)}" fill="${ink}"/>` +
      `<path d="${branch([[362, 20], [346, 38], [332, 56], [322, 70]], 3, 0.5)}" fill="${ink}"/>` +
      `<path d="${branch([[304, 43], [292, 32], [282, 26]], 1.8, 0.4)}" fill="${ink}"/>` +
      `<path d="${branch([[336, 29], [330, 14], [334, 4]], 2, 0.4)}" fill="${ink}"/>`,
  );
  blossomDefs(b);
  const r = rng(51);
  const cl: [number, number, number][] = [
    [256, 49, 1.05], [266, 53, 1.2], [282, 26, 1], [290, 34, 1.15], [300, 47, 1.3], [312, 40, 1.05], [322, 70, 1.15], [330, 58, 1.25],
    [342, 44, 1.05], [334, 14, 1.1], [328, 6, 0.95], [348, 26, 1.2], [372, 22, 1.1], [384, 10, 1.25], [398, 14, 1.05], [274, 46, 0.85],
  ];
  const fills = ['#f6d3da', '#efbcc8', '#fbe8ec', '#eab0bf'];
  let fl = '';
  for (const [x, y, s] of cl) {
    fl += use(b, 'fl-ch', x + (r() - 0.5) * 3, y + (r() - 0.5) * 3, s, r() * 72, fills[Math.floor(r() * fills.length)]);
    if (r() < 0.5) fl += `<circle cx="${n1(x + 4 + r() * 3)}" cy="${n1(y + 3 + r() * 3)}" r="1.3" fill="#d98a9d"/>`;
  }
  b.g.push(fl, '</g>');
}

function summer(b: B): void {
  b.g.push(
    `<rect width="400" height="220" fill="${vgrad(b, 'sky', 0, 140, [
      [0, '#c4d7d6'],
      [0.55, '#e4e4d6'],
      [1, '#f3dcc2'],
    ])}"/>`,
  );
  disc(b, 252, 98, 16, '#f0c477', '#f5d496', 72, 0.65, 0.92);
  wisps(b, [[180, 74, 120], [236, 84, 90], [110, 62, 70]], '#f6dcc4', 0.7, 5);

  // 1 · tall distant peaks
  const far = ridge({ seed: 5, base: 120, wave: 6, rough: 1.6, peaks: [[108, 32, 30], [168, 18, 24], [298, 36, 36], [360, 24, 28]] });
  hill(b, 'far', far, '#9fb7b0', '#e2e4d7', 46);
  crest(b, far, 6, 1.3, '#7c978f', 0.5);
  mist(b, 200, 118, 236, 9, 0.85, '#f8efe0');

  // 2 · green forested range
  const mid = ridge({ seed: 9, base: 133, wave: 5, peaks: [[58, 15, 30], [226, 13, 32], [336, 19, 30]] });
  hill(b, 'mid', mid, '#7f9f8b', '#d2dac8', 30);
  dabs(b, mid, { x0: -12, x1: 412, n: 260, seed: 10, r0: 0.7, r1: 1.6, below: 12, colors: ['#6c917c', '#86a891', '#5c826d'], op: 0.3 });
  crest(b, mid, 11, 1.5, '#5a7c68', 0.5);
  mist(b, 150, 138, 210, 6, 0.75, '#f8efe0');

  // 3 · treeline and farmhouses at the water's edge
  const shore = ridge({ seed: 13, base: 145, wave: 1.6, peaks: [[300, 4, 26], [118, 2.5, 20]] });
  const wl = 146;
  b.g.push(
    `<rect y="${wl}" width="400" height="${220 - wl}" fill="${vgrad(b, 'water', wl, 220, [
      [0, '#f2e1ca'],
      [0.3, '#e6e5da'],
      [1, '#cddcd7'],
    ])}"/>`,
  );
  // reflections: range, sun, light
  b.defs.push(`<clipPath id="${b.p}wc"><rect y="${wl}" width="400" height="${220 - wl}"/></clipPath>`);
  b.g.push(
    `<g clip-path="url(#${b.p}wc)"><g transform="matrix(1 0 0 -1 0 ${2 * wl})" opacity=".28"><path d="${smooth(far)}L416 232L-16 232Z" fill="#7e9a90"/><path d="${smooth(mid)}L416 232L-16 232Z" fill="#5f8270"/></g></g>`,
  );
  let sun = '';
  for (let k = 0; k < 9; k++) {
    const w = 20 - k * 2;
    sun += `<rect x="${n1(252 - w / 2 + (k % 2) * 1.5)}" y="${n1(wl + 3 + k * 3.4)}" width="${n1(w)}" height="1.1" rx=".55" opacity="${n1(0.9 - k * 0.08)}"/>`;
  }
  b.g.push(`<g fill="#f5d898">${sun}</g>`);
  hill(b, 'shore', shore, '#6a8a74', '#9fb49e', 7, wl + 1.5);
  b.g.push(house(228, yAt(shore, 228) + 1.5, 0.8, '#4c6355', '#e6e0cc') + house(243, yAt(shore, 243) + 1.2, 0.65, '#4c6355', '#e6e0cc'));
  dabs(b, shore, { x0: 0, x1: 0, n: 110, seed: 14, r0: 1.1, r1: 2.4, below: 1, colors: ['#5f826c', '#6f9179', '#557661'], op: 0.8, lift: -0.2, clumps: [[40, 22, 3], [120, 16, 2], [214, 18, 3], [272, 16, 4], [330, 26, 5], [392, 20, 3]] });

  // 4 · flooded paddies: dikes in perspective, seedling rows, glints
  let dk = '';
  const rows = [151, 156, 163, 172, 184, 199, 216];
  rows.forEach((y, i) => {
    dk += `<path d="M-10 ${y + 1}Q120 ${y - 1.5 - i * 0.4} 230 ${y}T410 ${y - 1 - i * 0.3}" stroke="#8aa592" stroke-width="${n1(0.4 + i * 0.18)}" fill="none" opacity="${n1(0.18 + i * 0.04)}"/>`;
  });
  dk += `<path d="M262 ${wl + 1}Q290 180 336 222" stroke="#8aa592" stroke-width=".7" fill="none" opacity=".25"/>`;
  b.g.push(dk);
  const r = rng(15);
  let ticks = '';
  for (let i = 1; i < rows.length - 1; i++) {
    const y0 = rows[i] + 1.5;
    const gap = 2 + i * 1.2;
    for (let x = 268 + i * 4; x < 380; x += gap + r() * 1.2) ticks += `M${n1(x)} ${n1(y0 + r())}v${n1(-0.8 - i * 0.35)}`;
  }
  b.g.push(`<path d="${ticks}" stroke="#6f906f" stroke-width=".55" opacity=".55" fill="none"/>`);
  wisps(b, [[90, 152, 60], [196, 160, 40], [60, 176, 46], [150, 190, 70], [300, 168, 30]], '#ffffff', 0.4, 16);

  // 5 · iris bank, foreground right
  b.g.push(`<path d="M248 222Q262 200 292 196T352 188T420 186V222Z" fill="${vgrad(b, 'bank', 186, 222, [[0, '#7d987f'], [1, '#a9bba6']])}"/>`);
  let leaves = '';
  const blades: [number, number, number][] = [
    [285, 156, -8], [288, 128, 3], [294, 164, -12], [300, 116, -2], [306, 140, 10], [312, 124, -6], [318, 152, 20], [324, 110, 4], [330, 136, -10], [338, 122, 8], [346, 150, 24], [352, 166, 30],
  ];
  let back = '';
  blades.forEach(([x, ty, lean], i) => {
    // sword leaves: straight at the root, bending outward near the tip
    const h = 222 - ty;
    const d =
      `M${n1(x - 1.9)} 222C${n1(x - 1.2)} ${n1(222 - h * 0.55)} ${n1(x + lean * 0.45 - 0.8)} ${n1(ty + h * 0.22)} ${n1(x + lean)} ${ty}` +
      `C${n1(x + lean * 0.45 + 1)} ${n1(ty + h * 0.24)} ${n1(x + 1.4)} ${n1(222 - h * 0.55)} ${n1(x + 1.9)} 222Z`;
    if (i % 3 === 1) back += d;
    else leaves += d;
  });
  b.g.push(`<path d="${back}" fill="#6a8a6c"/><path d="${leaves}" fill="#4a6a51"/>`);
  b.g.push(`<path d="M297 222Q298 180 298 152M318 222Q317 170 316 136M335 222Q336 184 338 160" stroke="#5a7a5c" stroke-width="1.3" fill="none"/>`);
  b.g.push(iris(298, 150, 1.55, -6) + iris(316, 134, 1.75, 4) + iris(338, 158, 1.4, 10));
  b.g.push(`<path d="M290 166C288 160 289 154 292 151C293 156 293 161 290 166Z" fill="#6d5ea0"/>`);

  // fireflies resting above the paddies
  b.g.push(
    glow(b, 274, 140, 8, '#f7e39a', 0.9) + glow(b, 328, 108, 7, '#f7e39a', 0.8) + glow(b, 214, 154, 6, '#f7e39a', 0.7) + glow(b, 352, 136, 8, '#f7e39a', 0.85) +
      `<g fill="#fbf0b8"><circle cx="274" cy="140" r=".9"/><circle cx="328" cy="108" r=".8"/><circle cx="214" cy="154" r=".7"/><circle cx="352" cy="136" r=".9"/></g>`,
  );
}

function autumn(b: B): void {
  b.g.push(
    `<rect width="400" height="220" fill="${vgrad(b, 'sky', 0, 140, [
      [0, '#efd6bc'],
      [0.5, '#f5e1c8'],
      [1, '#f7ecdc'],
    ])}"/>`,
  );
  disc(b, 264, 96, 25, '#d4603d', '#e99a6c', 84, 0.5, 0.88);
  wisps(b, [[200, 90, 120], [236, 101, 110], [150, 76, 80]], '#f8e8d6', 0.8, 7);

  // geese crossing toward the upper left
  const geese: [number, number][] = [[140, 30], [149, 27], [158, 24.5], [167, 22], [149, 34], [158, 37.5], [167, 41], [176, 44.5]];
  const gr = rng(8);
  let gd = '';
  for (const [x, y] of geese) {
    const up = 1 + gr() * 1.6;
    gd += `M${x - 3.2} ${n1(y + up * 0.6)}Q${x - 1.4} ${n1(y - up * 0.6)} ${x} ${y}Q${x + 1.6} ${n1(y - up * 0.5)} ${x + 3.4} ${n1(y + up * 0.7)}`;
  }
  b.g.push(`<path d="${gd}" stroke="#5a463e" stroke-width=".85" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".75"/>`);

  // 1 · distant ridges
  const far = ridge({ seed: 71, base: 118, wave: 5, peaks: [[100, 16, 40], [196, 10, 28], [330, 21, 38]] });
  hill(b, 'far', far, '#d2b0a0', '#f2e3d1', 40);
  crest(b, far, 72, 1.1, '#b48d7b', 0.42);
  mist(b, 200, 121, 236, 9, 0.8, '#f9ecdc');

  // 2 · maple forest with the temple on its shoulder
  const mid = ridge({ seed: 73, base: 138, wave: 4, peaks: [[232, 15, 34], [78, 10, 40], [360, 7, 30]] });
  hill(b, 'mid', mid, '#c07a5b', '#ecd1b8', 32);
  b.g.push(temple(232, yAt(mid, 232) + 5, 0.9, '#5d3e34', '#efdcc4'));
  const mg: [number, number, number][] = [[18, 24, 5], [78, 30, 8], [146, 22, 5], [210, 10, 3], [256, 12, 4], [292, 24, 7], [346, 30, 9], [398, 22, 6]];
  const reds = ['#c4553a', '#d27a48', '#b8452f', '#dca05c', '#a9583a'];
  groveMass(b, mid, mg, '#bf6446', 0.85);
  dabs(b, mid, { x0: 0, x1: 0, n: 300, seed: 74, r0: 1.5, r1: 3.4, below: 6, colors: reds, op: 0.88, round: true, clumps: mg });
  dabs(b, mid, { x0: 0, x1: 0, n: 120, seed: 75, r0: 0.9, r1: 2, below: 3, colors: ['#e8a35e', '#efbd78', '#e08a4a'], op: 0.8, round: true, lift: -0.8, clumps: mg });
  mist(b, 226, 150, 214, 8, 0.75, '#f9ecdc');

  // 3 · village ridge with a persimmon tree
  const vil = ridge({ seed: 79, base: 160, wave: 3, peaks: [[300, 7, 40]] });
  hill(b, 'vil', vil, '#d6a283', '#efdcc6', 30);
  crest(b, vil, 80, 1.2, '#b17b62', 0.4, 200);
  b.g.push(
    house(272, yAt(vil, 272) + 2, 0.8, '#6e4a3d', '#f1e2cc') + house(290, yAt(vil, 290) + 2, 0.95, '#6e4a3d', '#f1e2cc') + house(311, yAt(vil, 311) + 2, 0.85, '#6e4a3d', '#f1e2cc'),
  );
  const tx = 330;
  const ty = yAt(vil, tx) + 2;
  b.g.push(
    `<path d="${branch([[tx, ty], [tx + 1, ty - 9], [tx - 2, ty - 17], [tx - 1, ty - 24]], 2.4, 0.5)}M${tx + 1} ${ty - 9}Q${tx + 6} ${ty - 13} ${tx + 9} ${ty - 20}M${tx - 2} ${ty - 14}Q${tx - 7} ${ty - 17} ${tx - 10} ${ty - 22}M${tx + 4} ${ty - 12}L${tx + 3} ${ty - 22}" stroke="#4e3a33" stroke-width=".7" fill="#4e3a33"/>`,
  );
  const pr = rng(81);
  let ps = '';
  for (let k = 0; k < 14; k++) ps += ellipse(tx - 10 + pr() * 20, ty - 25 + pr() * 13, 1.2, 1.1);
  b.g.push(`<path d="${ps}" fill="#e2803a"/>`);
  mist(b, 160, 168, 200, 7, 0.65, '#f9ecdc');

  // 4 · near field, calm on the left; silver grass on the right
  const near = ridge({ seed: 83, base: 186, wave: 2.5, peaks: [[380, 20, 64]] });
  hill(b, 'near', near, '#dcb898', '#f3e7d6', 44);
  crest(b, near, 84, 1.2, '#b48c6d', 0.4, 230);
  let grass = '';
  const gs = rng(85);
  for (let k = 0; k < 9; k++) {
    const x = 296 + k * 6 + gs() * 4;
    const h = 30 + gs() * 22;
    const lean = -10 - gs() * 10;
    grass += `M${n1(x)} 222Q${n1(x + lean * 0.2)} ${n1(222 - h * 0.6)} ${n1(x + lean)} ${n1(222 - h)}`;
  }
  b.g.push(`<path d="${grass}" stroke="#b79a78" stroke-width=".8" fill="none" opacity=".8"/>`);
  let plumes = '';
  for (let k = 0; k < 9; k++) {
    const x = 296 + k * 6 + gs() * 4;
    const h = 30 + gs() * 22;
    plumes += ellipse(x - 12 - gs() * 4, 222 - h + 4, 1.4, 4.4);
  }
  b.g.push(`<path d="${plumes}" fill="#efe0c8" opacity=".85"/>`);

  // 5 · maple branch from the right
  const ink = '#4a3530';
  b.g.push(
    '<g transform="translate(-4 8)">',
    `<path d="${branch([[424, 40], [392, 46], [360, 44], [332, 52], [306, 62], [284, 76]], 6, 0.6)}" fill="${ink}"/>` +
      `<path d="${branch([[366, 45], [352, 30], [346, 18], [350, 8]], 2.6, 0.5)}" fill="${ink}"/>` +
      `<path d="${branch([[318, 57], [312, 44], [302, 38]], 1.6, 0.4)}" fill="${ink}"/>`,
  );
  mapleDef(b);
  const lr = rng(87);
  const lv: [number, number, number][] = [
    [286, 80, 1.3], [296, 72, 1.1], [302, 38, 1.2], [312, 48, 1], [318, 66, 1.4], [334, 58, 1.2], [344, 18, 1.15], [348, 34, 1.3], [350, 8, 1],
    [358, 52, 1.25], [376, 52, 1.4], [384, 40, 1.1], [402, 50, 1.3], [272, 86, 0.9],
  ];
  const lf = ['#c4452f', '#d4643c', '#b83a2a', '#e08a4a', '#cc5534'];
  let ld = '';
  for (const [x, y, s] of lv) ld += use(b, 'fl-mp', x, y + 3, s, 150 + lr() * 60, lf[Math.floor(lr() * lf.length)]);
  b.g.push(ld, '</g>');
}

function winter(b: B): void {
  b.g.push(
    `<rect width="400" height="220" fill="${vgrad(b, 'sky', 0, 140, [
      [0, '#c9d3df'],
      [0.55, '#e2e5e8'],
      [1, '#f2eee6'],
    ])}"/>`,
  );
  disc(b, 140, 50, 13, '#fbf7ec', '#ffffff', 48, 0.7, 0.96);
  b.g.push(`<path d="${ellipse(136, 47, 3.4, 2.4)}${ellipse(144, 54, 2.4, 1.8)}${ellipse(143, 45, 1.6, 1.2)}" fill="#e7e0cf" opacity=".55"/>`);
  b.g.push(`<g fill="#ffffff" opacity=".85"><circle cx="210" cy="26" r=".7"/><circle cx="96" cy="70" r=".6"/><circle cx="246" cy="44" r=".5"/><circle cx="182" cy="18" r=".5"/><circle cx="280" cy="22" r=".6"/></g>`);
  wisps(b, [[104, 62, 90], [168, 70, 70]], '#f4f4f2', 0.6, 9);

  // 1 · snowy peaks: silhouette, snow caps, shadowed faces
  const base = 128;
  const pk: [number, number, number, number][] = [
    [56, 94, 40, 40], [150, 76, 48, 52], [214, 90, 38, 34], [270, 66, 54, 60], [344, 84, 42, 48],
  ];
  const r = rng(91);
  const sil: Pt[] = [];
  for (let x = -16; x <= 416; x += 3) {
    let y = base + 2 * Math.sin(x / 19);
    for (const [sx, sy, wl, wr] of pk) {
      const w = x < sx ? wl : wr;
      const t = Math.max(0, 1 - Math.abs(x - sx) / w);
      y = Math.min(y, base - (base - sy) * t ** 1.25);
    }
    sil.push([x, y + (r() - 0.5) * 0.9]);
  }
  hill(b, 'peaks', sil, '#a9b7c7', '#e6e8e9', 56);
  let caps = '';
  let shade = '';
  for (const [sx, sy, wl, wr] of pk) {
    const H = base - sy;
    const xl = sx - wl * 0.55;
    const xr = sx + wr * 0.55;
    const top = sil.filter(([x]) => x >= xl && x <= xr);
    const low: Pt[] = [];
    for (let k = top.length - 1; k >= 0; k--) {
      const [x, y] = top[k];
      const t = 1 - Math.abs(x - sx) / ((x < sx ? wl : wr) * 0.55);
      low.push([x, y + H * 0.34 * t * (0.6 + r() * 0.7)]);
    }
    caps += poly(top) + poly(low).replace(/^M/, 'L') + 'Z';
    const right = top.filter(([x]) => x >= sx);
    const lowR = low.filter(([x]) => x >= sx + 2);
    if (right.length > 1 && lowR.length) shade += poly(right) + poly(lowR).replace(/^M/, 'L') + `L${n1(sx + 1)} ${n1(sy + H * 0.2)}Z`;
  }
  b.g.push(`<path d="${caps}" fill="#f8f9f8" opacity=".92"/><path d="${shade}" fill="#9aabbe" opacity=".38"/>`);
  crest(b, sil, 92, 0.9, '#7f90a6', 0.35);
  mist(b, 200, 128, 246, 10, 0.9, '#f4f2ee');

  // 2 · snowy forested hills
  const mid = ridge({ seed: 93, base: 143, wave: 5, peaks: [[86, 10, 40], [244, 11, 40], [342, 8, 30]] });
  hill(b, 'mid', mid, '#e4e9ee', '#f1efea', 28);
  crest(b, mid, 94, 1.2, '#95a3b4', 0.45);
  const tr = rng(95);
  let trees = '';
  const stands: [number, number][] = [[34, 20], [96, 14], [226, 24], [300, 18], [366, 22]];
  const firs: [number, number, number][] = [];
  for (let k = 0; k < 110; k++) {
    const [c, hw] = stands[k % stands.length];
    const t = tr() + tr() - 1;
    firs.push([c + t * hw, 1 + tr() * 7, (6 + tr() * 7) * (1 - Math.abs(t) * 0.45)]);
  }
  firs.sort((a, c) => a[1] - c[1]);
  for (const [x, dy, h] of firs) trees += conifer(x, yAt(mid, x) + dy + 2, h, dy > 4 ? '#5d6b7e' : '#748296', '#eef2f5');
  b.g.push(`<g opacity=".78">${trees}</g>`);
  mist(b, 170, 154, 214, 7, 0.75, '#f4f2ee');

  // 3 · village ridge: snowed roofs, lit windows, a thread of smoke
  const vil = ridge({ seed: 97, base: 163, wave: 2, peaks: [[284, 6, 40]] });
  hill(b, 'vil', vil, '#dde3ea', '#f2efe9', 20);
  crest(b, vil, 98, 1, '#a4b0be', 0.45, 200);
  const homes: [number, number][] = [[250, 0.85], [268, 1], [289, 0.9], [312, 1.05]];
  let hs = '';
  let gl = '';
  for (const [x, s] of homes) {
    const y = yAt(vil, x) + 2.5;
    gl += glow(b, x, y - 1.5 * s, 11 * s, '#f5c46a', 0.75);
    hs += house(x, y, s, '#596372', '#e7e1d4', '#f2c065', '#fbfbfa');
  }
  b.g.push(gl + hs);
  const cy = yAt(vil, 289) - 6;
  b.g.push(`<path d="M290 ${n1(cy)}c-2 -5 3 -8 0 -13s2 -9 -1 -14" stroke="#c3cad3" stroke-width="1.1" fill="none" opacity=".6" stroke-linecap="round"/>`);
  b.g.push(conifer(232, yAt(vil, 232) + 3, 9, '#5f6d80', '#f4f6f7') + conifer(330, yAt(vil, 330) + 3, 11, '#56647a', '#f4f6f7') + conifer(338, yAt(vil, 338) + 4, 7, '#6f7d90', '#f4f6f7'));

  // 4 · near snowfield with soft blue shadows
  const near = ridge({ seed: 99, base: 188, wave: 2.5, peaks: [[384, 20, 64]] });
  hill(b, 'near', near, '#f5f6f5', '#efede7', 30);
  crest(b, near, 100, 1.1, '#a9b6c4', 0.45, 230);

  // 5 · plum branch, angular, with snow along its back
  const ink = '#3e3434';
  const main: Pt[] = [[424, 12], [394, 22], [372, 30], [352, 22], [334, 32], [318, 42], [300, 36], [282, 48], [266, 60]];
  const sub: Pt[] = [[352, 22], [346, 38], [340, 52], [328, 62]];
  const twig: Pt[] = [[318, 42], [314, 26], [318, 12]];
  b.g.push(
    '<g transform="translate(-18 24)">',
    `<path d="${branch(main, 7, 0.8, true)}" fill="${ink}"/><path d="${branch(sub, 3, 0.6, true)}" fill="${ink}"/><path d="${branch(twig, 2, 0.5, true)}" fill="${ink}"/>`,
  );
  // snow lying in soft clumps along the upper side of the branch
  const sr = rng(102);
  let snow = '';
  const lay = (pts: Pt[], w0: number, w1: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const steps = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 4);
      for (let k = 0; k < steps; k++) {
        if (sr() < 0.3) continue;
        const t = (k + 0.5) / steps;
        const w = w0 + (w1 - w0) * ((i + t) / (pts.length - 1));
        snow += ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - w * 0.42, 1.6 + sr() * 1.6, 0.7 + sr() * 0.5);
      }
    }
  };
  lay(main.slice(0, 8), 7, 1.4);
  lay(sub.slice(0, 3), 3, 1.2);
  b.g.push(`<path d="${snow}" fill="#fbfbfa"/>`);
  blossomDefs(b);
  const fr = rng(101);
  const bl: [number, number, number][] = [
    [268, 58, 1.05], [284, 46, 1.2], [300, 34, 1], [304, 42, 0.8], [318, 12, 1], [314, 26, 1.1], [326, 40, 1.2], [328, 62, 1.15], [342, 50, 1.1], [348, 36, 0.9],
    [356, 26, 1.2], [376, 32, 1.05], [396, 24, 1.15], [406, 14, 1],
  ];
  const fills = ['#c84b5c', '#d6697a', '#b93b4f', '#f2dfe0'];
  let fl = '';
  for (const [x, y, s] of bl) {
    fl += use(b, 'fl-pl', x + (fr() - 0.5) * 2, y + (fr() - 0.5) * 2, s, fr() * 72, fills[Math.floor(fr() * fills.length)]);
    if (fr() < 0.55) fl += `<circle cx="${n1(x - 4 + fr() * 8)}" cy="${n1(y + 3 + fr() * 3)}" r="1.25" fill="#a8364a"/>`;
  }
  b.g.push(fl, '</g>');
}

const PAINT = [spring, summer, autumn, winter];
const cache = new Map<number, string>();

export function sceneSvg(season: number): string {
  const k = ((season % 4) + 4) % 4;
  let svg = cache.get(k);
  if (!svg) {
    const b: B = { p: `sc${k}-`, defs: [], g: [] };
    PAINT[k](b);
    svg = `<svg class="scene__art" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>${b.defs.join('')}</defs>${b.g.join('')}</svg>`;
    cache.set(k, svg);
  }
  return svg;
}

/* ---------- particles ---------- */

const PARTICLE: ('petal' | 'firefly' | 'leaf' | 'snow')[] = ['petal', 'firefly', 'leaf', 'snow'];
const TINTS: Record<string, string[]> = {
  petal: ['#f2c3cc', '#e8a9b8', '#f7dde2', '#eab3bd'],
  leaf: ['#c9643c', '#b8452f', '#d99a4e', '#a9583a', '#cf7a3f'],
};

/** Drifting particles as positioned spans (animated in CSS). */
export function sceneParticles(season: number, count = 14): string {
  const kind = PARTICLE[((season % 4) + 4) % 4];
  const tints = TINTS[kind];
  let out = '';
  for (let i = 0; i < count; i++) {
    // deterministic spread so the layout is stable between renders
    const x = (i * 37) % 100;
    const delay = ((i * 1.7) % 9).toFixed(1);
    const dur = (9 + ((i * 2.3) % 7)).toFixed(1);
    let size = 5 + ((i * 3) % 5);
    let extra = '';
    if (tints) extra += `;background:${tints[i % tints.length]}`;
    if (kind === 'snow') size = 2 + ((i * 5) % 5);
    if (kind === 'firefly') extra += `;top:${38 + ((i * 23) % 40)}%`;
    out += `<span class="pt pt--${kind}" style="left:${x}%;--d:${delay}s;--t:${dur}s;--s:${size}px${extra}"></span>`;
  }
  return out;
}
