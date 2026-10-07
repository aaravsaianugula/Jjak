/**
 * Home-screen landscape. One ink-wash painting per season, matching the
 * chapter the player is in:
 *
 *  - spring: dawn haze, cherry groves on rolling hills, a five-storey wooden
 *    pagoda and a small hall half-veiled in blossom, a cherry bough overhead;
 *  - summer: dusk over a lotus pond, a pavilion (정자) on stone stilts with a
 *    lantern lit and its reflection, a plank bridge to the shore, fireflies;
 *  - autumn: a low red sun, geese crossing, maple-covered ridges, a temple hall
 *    with a hip-and-gable roof and a stone pagoda, a persimmon tree by the
 *    village, silver grass and a maple bough;
 *  - winter: snowy peaks under a rising moon, a village with snow on its roofs
 *    and warm paper windows, threads of smoke, a plum bough in the snow.
 *
 * Every painting is built the same way: layered ridges that lighten and cool
 * with distance (atmospheric perspective), each toned at the crest and
 * dissolving into mist below; broken dry-brush strokes along the crests;
 * texture strokes (皴) and a shaded flank on the nearer mountains; mist bands
 * between the layers; and a washi grain over everything.
 *
 * Pure SVG paths, gradients and one small tiling pattern (no filters, no
 * images), so it rasterises once and stays cheap on mid-range phones. ViewBox
 * 400×220, `xMidYMax slice`. The focal detail sits right of centre (x≈260–360)
 * because the seal, wordmark and tagline sit over the lower left, which stays
 * calm and pale.
 *
 * Ink theme: rather than filtering the whole picture, a veil (`.scene__veil`,
 * hidden on paper) dims the painting and the lights (windows, lanterns,
 * fireflies, the moon) are drawn above it so they still glow at night.
 */

type Pt = [number, number];

/** Builder: per-season id prefix, <defs>, body markup and the lights drawn above the night veil. */
interface B {
  p: string;
  defs: string[];
  g: string[];
  lights: string[];
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

/** Lighter smooth path: quadratic curves through the midpoints (half the bytes of `smooth`). */
function qsmooth(pts: Pt[]): string {
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) d += `Q${n1(pts[i][0])} ${n1(pts[i][1])} ${n1((pts[i][0] + pts[i + 1][0]) / 2)} ${n1((pts[i][1] + pts[i + 1][1]) / 2)}`;
  const last = pts[pts.length - 1];
  return `${d}L${n1(last[0])} ${n1(last[1])}`;
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

/** A gradient that fades one colour out downward (bounding-box units, shared per colour). */
function fadeDown(b: B, color: string, from = 0): string {
  const id = `${b.p}fd${color.slice(1)}${from ? String(from).replace('.', '') : ''}`;
  if (!b.defs.some((d) => d.includes(`id="${id}"`)))
    b.defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="${from}" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`);
  return `url(#${id})`;
}

/* ---------- painting helpers ---------- */

/** A ridge filled with an ink-wash gradient: toned at the crest, dissolving into mist below. */
function hill(b: B, key: string, pts: Pt[], top: string, bottom: string, depth: number, floor = 232, mid?: string): void {
  const minY = Math.min(...pts.map((p) => p[1]));
  const s: Stop[] = mid ? [[0, top], [0.45, mid], [1, bottom]] : [[0, top], [1, bottom]];
  const fill = vgrad(b, key, minY, minY + depth, s);
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

/**
 * Texture strokes (皴法) on a mountain face: short dry hairlines that run down
 * the slope roughly parallel to the flank, densest just under the crest.
 */
function cun(b: B, pts: Pt[], o: { seed: number; x0: number; x1: number; n: number; len: number; depth: number; color: string; op: number; w?: number }): void {
  const r = rng(o.seed);
  let d = '';
  for (let k = 0; k < o.n; k++) {
    const x = o.x0 + r() * (o.x1 - o.x0);
    const slope = (yAt(pts, x + 3) - yAt(pts, x - 3)) / 6;
    if (Math.abs(slope) < 0.08) continue;
    const down = r() ** 1.6 * o.depth;
    const y = yAt(pts, x) + 1 + down;
    const dir = slope < 0 ? -1 : 1;
    const len = o.len * (0.5 + r()) * (1 - (down / o.depth) * 0.5);
    const steep = Math.min(2.6, Math.abs(slope) * 1.5 + 0.4);
    const dx = (dir * len) / Math.hypot(1, steep);
    const dy = Math.abs(dx) * steep;
    d += `M${n1(x)} ${n1(y)}q${n1(dx * 0.5 + dir * 0.6)} ${n1(dy * 0.4)} ${n1(dx)} ${n1(dy)}`;
  }
  b.g.push(`<path d="${d}" stroke="${o.color}" stroke-width="${o.w ?? 0.5}" stroke-linecap="round" fill="none" opacity="${o.op}"/>`);
}

/**
 * The shaded flank of a peak: a wash from the crest on the far side of the
 * light, bounded by a spur line falling from the summit, fading downward.
 */
function flanks(b: B, pts: Pt[], list: [number, number, number][], color: string, op: number, side = 1): void {
  let d = '';
  for (const [px, w, depth] of list) {
    const py = yAt(pts, px);
    const top: Pt[] = [];
    for (let k = 0; k <= 8; k++) {
      const x = px + side * (w * k) / 8;
      top.push([x, yAt(pts, x)]);
    }
    const end = top[8];
    const spur: Pt[] = [
      [end[0], end[1] + depth],
      [px + side * w * 0.45, py + depth * 0.8],
      [px + side * w * 0.12, py + depth * 0.3],
      [px, py + 0.5],
    ];
    d += poly(top) + smooth(spur, false).replace(/^L[^C]*/, `L${n1(spur[0][0])} ${n1(spur[0][1])}`) + 'Z';
  }
  b.g.push(`<path d="${d}" fill="${fadeDown(b, color, 0.15)}" opacity="${op}"/>`);
}

const ellipse = (x: number, y: number, rx: number, ry: number): string =>
  `M${n1(x - rx)} ${n1(y)}a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(2 * rx)} 0a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(-2 * rx)} 0`;

/**
 * Boneless-wash foliage (沒骨): each grove is a lobed mass laid down as four
 * translucent glazes, two shadow washes, the body and a lit crown, each a
 * little smaller and higher than the last, so the edges stay soft and the
 * centre deepens the way pigment pools. Everything dissolves into the ground
 * below. `clumps` are [centre, half-width, dome height] on a ridge.
 */
function canopy(b: B, pts: Pt[], clumps: [number, number, number][], o: { seed: number; tones: [string, string, string]; op?: number; sink?: number }): void {
  const r = rng(o.seed);
  const sink = o.sink ?? 6;
  const PASSES: [tone: number, hw: number, h: number, lift: number, shift: number, op: number][] = [
    [0, 1.08, 1, 0, 0, 0.34],
    [0, 0.97, 0.95, 0.7, 0.03, 0.34],
    [1, 0.84, 0.9, 1.4, -0.05, 0.5],
    [2, 0.58, 0.78, 2.4, -0.15, 0.42],
  ];
  const layers = PASSES.map(() => '');
  let top = 999;
  let bottom = -999;
  const mass = (c: number, hw: number, h: number, lift: number): string => {
    const m = Math.max(3, Math.round(hw / 4));
    const lobe = (hw / m) * 0.9;
    const g = (x: number) => yAt(pts, x) + sink;
    const out: Pt[] = [];
    for (let i = 0; i <= 2 * m; i++) {
      const t = -1 + i / m;
      const x = c + t * hw + (i % 2 ? (r() - 0.5) * lobe * 0.6 : 0);
      const dome = (h + 3) * Math.max(0, 1 - t * t) ** 0.7;
      let y = g(x) - dome - lift;
      if (i === 0 || i === 2 * m) y = g(x) - 1 - lift * 0.3;
      else if (i % 2) y -= lobe * (0.3 + r() * 0.45);
      top = Math.min(top, y);
      out.push([x, y]);
    }
    bottom = Math.max(bottom, g(c) + 3);
    return `${qsmooth(out)}L${n1(c + hw)} ${n1(g(c + hw) + 3)}L${n1(c - hw)} ${n1(g(c - hw) + 3)}Z`;
  };
  for (const [c, hw, h] of clumps) PASSES.forEach(([, kw, kh, lift, shift], i) => (layers[i] += mass(c + shift * hw, hw * kw, h * kh, lift)));
  const key = `cn${o.seed}`;
  const fills = o.tones.map((t, i) =>
    vgrad(b, `${key}${i}`, top, bottom, [
      [i === 2 ? 0.1 : 0.45, t],
      [1, t, 0],
    ]),
  );
  b.g.push(`<g opacity="${o.op ?? 1}">${layers.map((d, i) => `<path d="${d}" fill="${fills[PASSES[i][0]]}" opacity="${PASSES[i][5]}"/>`).join('')}</g>`);
}

function mist(b: B, cx: number, cy: number, rx: number, ry: number, op: number, color = '#ffffff'): void {
  const fill = rgrad(b, `mist${color.slice(1)}`, [
    [0, color, 0.95],
    [0.55, color, 0.55],
    [1, color, 0],
  ]);
  b.g.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${op}"/>`);
}

/** A level band of mist across the whole picture (soft above and below). */
function band(b: B, y: number, h: number, color: string, op: number): void {
  const id = `${b.p}bd${color.slice(1)}`;
  if (!b.defs.some((d) => d.includes(`id="${id}"`)))
    b.defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops([[0, color, 0], [0.5, color, 1], [1, color, 0]])}</linearGradient>`);
  b.g.push(`<rect x="-8" y="${n1(y - h / 2)}" width="416" height="${n1(h)}" fill="url(#${id})" opacity="${op}"/>`);
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

function disc(b: B, cx: number, cy: number, r: number, color: string, halo: string, haloR: number, haloOp: number, op = 0.9, out = b.g): void {
  const h = rgrad(b, 'halo', [
    [0, halo, haloOp],
    [0.35, halo, haloOp * 0.45],
    [1, halo, 0],
  ]);
  out.push(`<circle cx="${cx}" cy="${cy}" r="${haloR}" fill="${h}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}"/>`);
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

/** A light hairline along the upper side of a branch, so the bark has a lit edge. */
function barkLight(pts: Pt[], w0: number, w1: number): string {
  const n = pts.length - 1;
  const top = pts.map(([x, y], i) => [x, y - (w0 + (w1 - w0) * (i / n)) * 0.28] as Pt);
  return smooth(top.slice(0, Math.max(2, n)));
}

/**
 * Washi texture: a tile of long, faint kozo fibres (light and warm), laid over
 * the whole painting at a whisper of opacity so the washes read as pigment on
 * paper. Fibres only: no specks.
 */
function grain(b: B, op: number): void {
  const r = rng(977);
  let light = '';
  let warm = '';
  for (let k = 0; k < 16; k++) {
    const x = r() * 84;
    const y = r() * 84;
    const len = 6 + r() * 14;
    const a = (r() - 0.5) * 1.2;
    const dx = Math.cos(a) * len;
    const dy = Math.sin(a) * len;
    const seg = `M${n1(x)} ${n1(y)}q${n1(dx / 2 + (r() - 0.5) * 3)} ${n1(dy / 2 + (r() - 0.5) * 3)} ${n1(dx)} ${n1(dy)}`;
    if (k % 3) light += seg;
    else warm += seg;
  }
  b.defs.push(
    `<pattern id="${b.p}grain" width="84" height="84" patternUnits="userSpaceOnUse">` +
      `<path d="${light}" stroke="#fffbf2" stroke-width=".45" stroke-linecap="round" fill="none"/>` +
      `<path d="${warm}" stroke="#8a7458" stroke-width=".3" stroke-linecap="round" fill="none" opacity=".45"/></pattern>`,
  );
  b.g.push(`<rect width="400" height="220" fill="url(#${b.p}grain)" opacity="${op}"/>`);
}

/* ---------- motifs ---------- */

/**
 * Five-storey wooden pagoda (오층목탑) in front view: a stone platform, storeys
 * that narrow as they rise, each under a roof whose eaves sag and lift at the
 * corners, shadowed under the eaves, and a bronze finial (상륜) with rings.
 */
function pagoda(x: number, y: number, s: number, c: { roof: string; body: string; shade: string; light: string }): string {
  let roofs = '';
  let bodies = '';
  let under = '';
  let lines = '';
  let yb = -3;
  for (let i = 0; i < 5; i++) {
    const bw = 6.8 - i * 0.9;
    const bh = i ? 3.6 : 4.6;
    const yr = yb - bh;
    const ew = bw + 4.6 - i * 0.25;
    bodies += `M${n1(-bw)} ${n1(yb)}H${n1(bw)}V${n1(yr)}H${n1(-bw)}Z`;
    // posts and a dark doorway on each storey
    lines += `M${n1(-bw + 0.9)} ${n1(yb)}V${n1(yr)}M${n1(bw - 0.9)} ${n1(yb)}V${n1(yr)}M-.9 ${n1(yb)}V${n1(yr + 0.9)}H.9V${n1(yb)}`;
    under += `M${n1(-ew + 1.2)} ${n1(yr - 0.6)}Q0 ${n1(yr + 1.9)} ${n1(ew - 1.2)} ${n1(yr - 0.6)}V${n1(yr - 0.1)}Q0 ${n1(yr + 2.5)} ${n1(-ew + 1.2)} ${n1(yr - 0.1)}Z`;
    roofs +=
      `M${n1(-ew)} ${n1(yr - 2)}Q${n1(-ew * 0.5)} ${n1(yr + 1.1)} 0 ${n1(yr + 0.9)}Q${n1(ew * 0.5)} ${n1(yr + 1.1)} ${n1(ew)} ${n1(yr - 2)}` +
      `Q${n1(ew * 0.66)} ${n1(yr - 1.8)} ${n1(bw * 0.62)} ${n1(yr - 3.4)}H${n1(-bw * 0.62)}Q${n1(-ew * 0.66)} ${n1(yr - 1.8)} ${n1(-ew)} ${n1(yr - 2)}Z`;
    yb = yr - 3.4;
  }
  const spire = `M-.4 ${n1(yb)}V${n1(yb - 13)}H.4V${n1(yb)}Z` + [2.2, 4.2, 6, 7.6, 9].map((k, i) => ellipse(0, yb - k, 1.5 - i * 0.16, 0.5)).join('') + ellipse(0, yb - 11.2, 0.9, 1) + ellipse(0, yb - 1, 2.2, 0.9);
  return (
    `<g transform="translate(${n1(x)} ${n1(y)}) scale(${s})">` +
    `<path d="M-11 0H11L9.6 -1.6H-9.6ZM-9 -1.6H9V-3H-9Z" fill="${c.shade}"/>` +
    `<path d="${bodies}" fill="${c.body}"/><path d="${lines}" stroke="${c.shade}" stroke-width=".55" fill="none" opacity=".75"/>` +
    `<path d="${under}" fill="${c.shade}" opacity=".7"/><path d="${roofs}" fill="${c.roof}"/>` +
    `<path d="${spire}" fill="${c.roof}"/>` +
    `<path d="${roofs.replace(/Q[^Z]*?H[^Q]*Q[^Z]*Z/g, 'Z').replace(/Z/g, '')}" stroke="${c.light}" stroke-width=".35" fill="none" opacity=".5"/>` +
    `</g>`
  );
}

/**
 * Temple hall (대웅전) with a hip-and-gable roof (팔작지붕): a stone terrace with
 * steps, six columns, lattice doors, a painted dancheong band under the eaves,
 * a sweeping roof with lifted corners, tile ribs and a ridge with raised ends.
 */
function templeHall(x: number, y: number, s: number, c: { roof: string; wall: string; wood: string; band: string; red: string; stone: string; light: string }): string {
  let ribs = '';
  for (let k = -12; k <= 12; k += 2.4) ribs += `M${n1(k * 1.55)} ${n1(-12.6)}L${n1(k)} -20.4`;
  let cols = '';
  for (const cx of [-19, -11.5, -4, 4, 11.5, 19]) cols += `M${n1(cx - 0.7)} -3.2h1.4v-8.6h-1.4Z`;
  let doors = '';
  for (const [x0, x1] of [[-10.8, -4.7], [-3.3, 3.3], [4.7, 10.8]] as Pt[]) {
    doors += `M${n1(x0)} -3.4H${n1(x1)}V-11.2H${n1(x0)}Z`;
  }
  let lattice = '';
  for (let k = -10; k <= 10; k += 1.4) lattice += `M${n1(k)} -3.6V-11`;
  lattice += 'M-10.8 -6H10.8M-10.8 -8.6H10.8';
  return (
    `<g transform="translate(${n1(x)} ${n1(y)}) scale(${s})">` +
    // terrace and steps
    `<path d="M-27 0H27L25.5 -3.2H-25.5Z" fill="${c.stone}"/><path d="M-5 0H5V1.6H-5Z" fill="${c.stone}" opacity=".8"/>` +
    `<path d="M-25 -2H25" stroke="${c.wood}" stroke-width=".35" opacity=".4"/>` +
    // walls, doors, lattice
    `<path d="M-21 -3.2H21V-12H-21Z" fill="${c.wall}"/>` +
    `<path d="${doors}" fill="${c.red}" opacity=".25"/><path d="${lattice}" stroke="${c.wood}" stroke-width=".3" opacity=".55"/>` +
    `<path d="${cols}" fill="${c.red}"/>` +
    // dancheong band and bracket shadow
    `<path d="M-22.5 -12H22.5V-13.6H-22.5Z" fill="${c.band}"/>` +
    `<path d="M-22 -12.6H22" stroke="${c.red}" stroke-width=".4" opacity=".8"/>` +
    `<path d="M-24 -13.6Q0 -11 24 -13.6V-14.6H-24Z" fill="${c.wood}" opacity=".6"/>` +
    // roof: eaves sag, corners lift, hip faces up to the gable and ridge
    `<path d="M-36 -17.4Q-30 -13.2 -18 -13.4Q0 -12.4 18 -13.4Q30 -13.2 36 -17.4Q30 -16.6 26 -18.2L19 -21.6Q15 -22.4 14.5 -24.2L13.6 -26H-13.6L-14.5 -24.2Q-15 -22.4 -19 -21.6L-26 -18.2Q-30 -16.6 -36 -17.4Z" fill="${c.roof}"/>` +
    `<path d="${ribs}" stroke="${c.light}" stroke-width=".3" opacity=".35"/>` +
    `<path d="M-36 -17.4Q-30 -13.2 -18 -13.4Q0 -12.4 18 -13.4Q30 -13.2 36 -17.4" stroke="${c.light}" stroke-width=".45" fill="none" opacity=".5"/>` +
    // ridge with raised ends (취두)
    `<path d="M-15.6 -25.6Q0 -25 15.6 -25.6L16.8 -28.4Q15.4 -27 14 -27.2H-14Q-15.4 -27 -16.8 -28.4Z" fill="${c.roof}"/>` +
    `</g>`
  );
}

/** Three-storey stone pagoda (석탑): a plinth and thin stone roofs with lifted corners. */
function stoneTower(x: number, y: number, s: number, fill: string, shade: string): string {
  let d = 'M-5 0H5V-2.4H-5ZM-3.8 -2.4H3.8V-4H-3.8Z';
  let y0 = -4;
  for (let i = 0; i < 3; i++) {
    const w = 2.6 - i * 0.45;
    const h = i ? 2 : 3.2;
    d += `M${n1(-w)} ${n1(y0)}H${n1(w)}V${n1(y0 - h)}H${n1(-w)}Z`;
    const r = w + 2.2;
    d += `M${n1(-r)} ${n1(y0 - h - 0.4)}Q0 ${n1(y0 - h + 0.5)} ${n1(r)} ${n1(y0 - h - 0.4)}L${n1(w * 0.7)} ${n1(y0 - h - 1.6)}H${n1(-w * 0.7)}Z`;
    y0 -= h + 1.6;
  }
  d += `M-.35 ${n1(y0)}h.7v-3h-.7Z`;
  return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${s})"><path d="${d}" fill="${fill}"/><path d="M1 -.2V-4M.8 -4.2V${n1(y0)}" stroke="${shade}" stroke-width="1.4" opacity=".35"/></g>`;
}

/**
 * Pavilion (정자) on stone stilts, front view: piers, a plank deck with a
 * railing, four posts, a painted beam and a hipped roof whose corners sweep up
 * to a finial. `lit` is drawn into the lights (the lantern under the roof).
 */
function pavilion(x: number, y: number, s: number, c: { roof: string; wood: string; stone: string; band: string; light: string; paper: string }): string {
  let rail = '';
  for (let k = -14; k <= 14; k += 2) rail += `M${k} -8.6V-11`;
  return (
    `<g transform="translate(${n1(x)} ${n1(y)}) scale(${s})">` +
    // stone piers into the water
    `<path d="M-14.6 0h2.4v-7h-2.4ZM-5.2 0h2.4v-7h-2.4ZM2.8 0h2.4v-7h-2.4ZM12.2 0h2.4v-7h-2.4Z" fill="${c.stone}"/>` +
    `<path d="M-14.6 -2.4h2.4M-5.2 -2.4h2.4M2.8 -2.4h2.4M12.2 -2.4h2.4" stroke="${c.light}" stroke-width=".3" opacity=".4"/>` +
    // deck
    `<path d="M-18 -7H18V-8.8H-18Z" fill="${c.wood}"/>` +
    // inside: paper screens glowing faintly
    `<path d="M-13 -9H13V-20H-13Z" fill="${c.paper}" opacity=".55"/>` +
    // railing
    `<path d="M-16 -11.2H16" stroke="${c.wood}" stroke-width=".9"/><path d="${rail}" stroke="${c.wood}" stroke-width=".5"/>` +
    // posts
    `<path d="M-15.4 -8.8h1.5v-12.4h-1.5ZM-5.6 -8.8h1.3v-12.4h-1.3ZM4.3 -8.8h1.3v-12.4h-1.3ZM13.9 -8.8h1.5v-12.4h-1.5Z" fill="${c.wood}"/>` +
    // painted beam
    `<path d="M-18 -21.2H18V-23H-18Z" fill="${c.band}"/><path d="M-17.5 -22.1H17.5" stroke="${c.light}" stroke-width=".35" opacity=".55"/>` +
    // roof: hip with sweeping corners to a peak
    `<path d="M-27 -25.6Q-20 -21.6 -10 -22.6Q0 -22 10 -22.6Q20 -21.6 27 -25.6Q21 -25.4 16 -28L4 -35.2Q1 -36.4 0 -36.6Q-1 -36.4 -4 -35.2L-16 -28Q-21 -25.4 -27 -25.6Z" fill="${c.roof}"/>` +
    `<path d="M-27 -25.6Q-20 -21.6 -10 -22.6Q0 -22 10 -22.6Q20 -21.6 27 -25.6M-16 -28L0 -36.6L16 -28" stroke="${c.light}" stroke-width=".4" fill="none" opacity=".45"/>` +
    // finial
    `<path d="M-.4 -36.4V-40H.4V-36.4Z" fill="${c.roof}"/><circle cy="-40.6" r="1" fill="${c.roof}"/>` +
    `</g>`
  );
}

/** Small hanok-style house: curved roof, plaster wall, a dark doorway; optional snow on the roof. */
function house(x: number, y: number, s: number, roof: string, wall: string, snow?: string): string {
  let out =
    `<g transform="translate(${n1(x)} ${n1(y)}) scale(${s})">` +
    `<path d="M-6 0H6V-3.6H-6Z" fill="${wall}"/><path d="M-5.6 0V-3.6M5.6 0V-3.6M-.4 0V-3.6" stroke="${roof}" stroke-width=".4" opacity=".6"/>` +
    `<path d="M-9.5 -3.9Q-6.5 -3.2 -5.2 -4.6L-3.2 -7.8H3.2L5.2 -4.6Q6.5 -3.2 9.5 -3.9Q6 -2.7 0 -2.9Q-6 -2.7 -9.5 -3.9Z" fill="${roof}"/>`;
  if (snow)
    out +=
      `<path d="M-9 -4.2Q-6.2 -4 -5 -5.3L-3.2 -8.4Q0 -9 3.2 -8.4L5 -5.3Q6.2 -4 9 -4.2Q6.4 -4.6 5 -5.7L3.4 -7.2Q0 -7.6 -3.4 -7.2L-5 -5.7Q-6.4 -4.6 -9 -4.2Z" fill="${snow}"/>` +
      `<path d="M-9.4 -3.9Q-6 -3.2 -4.6 -4.4M9.4 -3.9Q6 -3.2 4.6 -4.4" stroke="${snow}" stroke-width=".5" fill="none" opacity=".8"/>`;
  return out + '</g>';
}

/** The lit paper windows of a `house` at the same place (for the lights layer). */
const houseWindows = (x: number, y: number, s: number, lit: string): string =>
  `<path transform="translate(${n1(x)} ${n1(y)}) scale(${s})" d="M-4.2 -.7h2.3v-2.1h-2.3ZM1.4 -.7h2.3v-2.1h-2.3Z" fill="${lit}"/>`;

function conifer(x: number, y: number, h: number, color: string, snow?: string): string {
  const w = h * 0.26;
  let out = `<path d="M${n1(x)} ${n1(y - h)}L${n1(x + w * 0.6)} ${n1(y - h * 0.55)}L${n1(x + w * 0.4)} ${n1(y - h * 0.5)}L${n1(x + w)} ${n1(y)}H${n1(x - w)}L${n1(x - w * 0.4)} ${n1(y - h * 0.5)}L${n1(x - w * 0.6)} ${n1(y - h * 0.55)}Z" fill="${color}"/>`;
  if (snow)
    out += `<path d="M${n1(x)} ${n1(y - h)}L${n1(x + w * 0.36)} ${n1(y - h * 0.73)}Q${n1(x)} ${n1(y - h * 0.8)} ${n1(x - w * 0.36)} ${n1(y - h * 0.73)}ZM${n1(x - w * 0.55)} ${n1(y - h * 0.48)}Q${n1(x)} ${n1(y - h * 0.56)} ${n1(x + w * 0.55)} ${n1(y - h * 0.48)}L${n1(x + w * 0.4)} ${n1(y - h * 0.44)}Q${n1(x)} ${n1(y - h * 0.5)} ${n1(x - w * 0.4)} ${n1(y - h * 0.44)}Z" fill="${snow}"/>`;
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
    `<path id="${b.p}petal" d="M0 0C-1.6 -.5 -1.8 -2.3 -.7 -2.7Q0 -2.5 0 -2.3Q0 -2.5 .7 -2.7C1.8 -2.3 1.6 -.5 0 0Z"/>`,
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
  canopy(b, top, cl, { seed, tones: ['#d69aac', '#e8b7c3', '#f7e0e5'], sink: h * 0.1 });
}

/** Loose ink birds: a body dash and two wing strokes each, `[x, y, size]`. */
function birds(list: [number, number, number][], color: string, op: number, seed: number): string {
  const r = rng(seed);
  let d = '';
  for (const [x, y, s] of list) {
    const up = (0.6 + r() * 1.2) * s;
    d +=
      `M${n1(x - 3.4 * s)} ${n1(y + up * 0.5)}Q${n1(x - 1.6 * s)} ${n1(y - up * 0.7)} ${n1(x)} ${n1(y)}` +
      `Q${n1(x + 1.7 * s)} ${n1(y - up * 0.6)} ${n1(x + 3.6 * s)} ${n1(y + up * 0.6)}M${n1(x - 0.9 * s)} ${n1(y + 0.25 * s)}l${n1(1.9 * s)} ${n1(-0.1 * s)}`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${op}"/>`;
}

/* ---------- seasons ---------- */

function spring(b: B): void {
  b.g.push(
    `<rect width="400" height="220" fill="${vgrad(b, 'sky', 0, 150, [
      [0, '#e8d0d8'],
      [0.5, '#f4e2e0'],
      [1, '#f7eee4'],
    ])}"/>`,
  );
  disc(b, 236, 58, 18, '#eeaaa3', '#f4c4bb', 66, 0.6, 0.8);
  wisps(b, [[150, 52, 110], [206, 66, 120], [92, 38, 70], [262, 44, 60], [300, 74, 70]], '#fbf3ee', 0.75, 3);

  // 1 · far blue mountains, barely there
  const far0 = ridge({ seed: 7, base: 106, wave: 4, peaks: [[60, 10, 30], [228, 16, 34], [340, 22, 30]] });
  hill(b, 'far0', far0, '#d6c9d8', '#f2e7e6', 30);
  crest(b, far0, 8, 0.8, '#b9a9c0', 0.35);
  band(b, 110, 16, '#f8eeea', 0.9);

  // 2 · distant mountains with texture
  const far = ridge({ seed: 11, base: 116, wave: 5, peaks: [[118, 22, 38], [196, 12, 28], [300, 27, 44], [372, 14, 30]] });
  hill(b, 'far', far, '#cdb4c4', '#f3e8e4', 42, 232, '#e2d2d8');
  flanks(b, far, [[118, 34, 18], [300, 40, 22], [372, 22, 12]], '#a5899e', 0.32);
  cun(b, far, { seed: 13, x0: 80, x1: 400, n: 70, len: 6, depth: 14, color: '#9e8197', op: 0.4, w: 0.45 });
  crest(b, far, 12, 1.1, '#a98da0', 0.5);
  mist(b, 200, 120, 230, 10, 0.85, '#fbf2ec');

  // 3 · far cherry hills: clouds of blossom
  const ch = ridge({ seed: 23, base: 131, wave: 6, peaks: [[56, 8, 40], [170, 11, 50], [292, 10, 40]] });
  hill(b, 'ch', ch, '#e5c0ca', '#f4e6e3', 30);
  const groves: [number, number, number][] = [[24, 26, 6], [92, 20, 4], [158, 30, 8], [234, 22, 5], [312, 30, 9], [380, 24, 7]];
  canopy(b, ch, groves, { seed: 24, tones: ['#d9a3b3', '#e8bcc7', '#f6dee3'], op: 0.95 });
  mist(b, 130, 144, 210, 8, 0.75, '#fbf2ec');

  // 4 · the pagoda hill: pagoda and a small hall rising out of blossom haze
  const mid = ridge({ seed: 37, base: 154, wave: 4, peaks: [[290, 20, 36], [96, 5, 50]] });
  hill(b, 'mid', mid, '#c99eac', '#eedfdb', 36, 232, '#dfc1c8');
  flanks(b, mid, [[290, 36, 16]], '#9b6f82', 0.28);
  cun(b, mid, { seed: 36, x0: 200, x1: 400, n: 40, len: 5, depth: 10, color: '#8e6577', op: 0.35 });
  crest(b, mid, 38, 1.4, '#946c7d', 0.5, 150);
  const py = yAt(mid, 288) + 5;
  b.g.push(pagoda(288, py, 1, { roof: '#5e4250', body: '#b48a92', shade: '#4a3440', light: '#f6e1e4' }));
  b.g.push(
    `<g opacity=".88">${templeHall(326, yAt(mid, 326) + 6, 0.5, { roof: '#5e4250', wall: '#efe0dc', wood: '#5e4250', band: '#6c8f86', red: '#a04a4a', stone: '#b9a1a8', light: '#f6e1e4' })}</g>`,
  );
  const mg: [number, number, number][] = [[250, 16, 5], [272, 9, 2], [312, 10, 3], [346, 16, 5], [386, 18, 6]];
  canopy(b, mid, mg, { seed: 39, tones: ['#c98799', '#e0a9b7', '#f3d4db'] });
  // blossom haze around the pagoda's foot
  mist(b, 300, py + 2, 70, 7, 0.75, '#f8e6e8');
  mist(b, 236, 166, 190, 8, 0.7, '#fbf2ec');

  // 5 · near meadow (calm under the wordmark)
  const near = ridge({ seed: 41, base: 184, wave: 2.5, peaks: [[384, 24, 70], [310, 8, 34]] });
  hill(b, 'near', near, '#d9b8bd', '#f1e6e0', 46);
  crest(b, near, 42, 1.2, '#b08896', 0.42, 230);
  cun(b, near, { seed: 46, x0: 330, x1: 400, n: 18, len: 5, depth: 8, color: '#a07888', op: 0.3 });
  cherryTree(b, 322, yAt(near, 322) + 3, 20, 44);
  cherryTree(b, 358, yAt(near, 358) + 3, 26, 45);
  // fallen petals lie as a soft pink wash under the trees
  mist(b, 342, yAt(near, 342) + 6, 44, 4.5, 0.6, '#e9b6c3');

  // 6 · foreground bank
  const fg = ridge({ seed: 43, base: 207, wave: 2, peaks: [[396, 14, 50]] });
  hill(b, 'fg', fg, '#e8d4d2', '#f3ebe5', 24);

  // 7 · cherry branch from the upper right
  const ink = '#4b3a3a';
  const main: Pt[] = [[424, 4], [392, 14], [360, 20], [330, 31], [302, 44], [276, 50], [254, 49]];
  const sub: Pt[] = [[362, 20], [346, 38], [332, 56], [322, 70]];
  b.g.push(
    '<g transform="translate(-6 16)">',
    `<path d="${branch(main, 6.5, 0.6)}" fill="${ink}"/>` +
      `<path d="${branch(sub, 3, 0.5)}" fill="${ink}"/>` +
      `<path d="${branch([[304, 43], [292, 32], [282, 26]], 1.8, 0.4)}" fill="${ink}"/>` +
      `<path d="${branch([[336, 29], [330, 14], [334, 4]], 2, 0.4)}" fill="${ink}"/>` +
      `<path d="${barkLight(main, 6.5, 0.6)}${barkLight(sub, 3, 0.5)}" stroke="#8e7474" stroke-width=".5" fill="none" opacity=".6"/>`,
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
    r();
  }
  // a few petals caught in the air below the bough
  for (const [x, y, rot] of [[262, 70, 30], [300, 82, -40], [244, 92, 80], [318, 96, 10], [284, 104, -70]] as [number, number, number][])
    fl += use(b, 'petal', x, y, 1.1, rot, '#eebcc8', 0.85);
  b.g.push(fl, '</g>');

  grain(b, 0.2);
}

function summer(b: B): void {
  // dusk: blue overhead, warm apricot at the horizon
  b.g.push(
    `<rect width="400" height="220" fill="${vgrad(b, 'sky', 0, 140, [
      [0, '#a9bcca'],
      [0.45, '#d9d6cc'],
      [0.8, '#f0d2ad'],
      [1, '#f3c99c'],
    ])}"/>`,
  );
  disc(b, 238, 112, 15, '#f1b46a', '#f6cd92', 80, 0.75, 0.95);
  wisps(b, [[170, 82, 120], [230, 92, 96], [110, 70, 70], [286, 76, 70]], '#f6d6b6', 0.75, 5);
  wisps(b, [[200, 100, 70], [140, 92, 50]], '#e8a98a', 0.35, 6);

  // 1 · tall distant peaks
  const far = ridge({ seed: 5, base: 122, wave: 6, rough: 1.6, peaks: [[108, 32, 30], [168, 18, 24], [306, 36, 36], [366, 24, 28]] });
  hill(b, 'far', far, '#94a9ae', '#e4dfd2', 46, 232, '#bcc6c0');
  flanks(b, far, [[108, 28, 22], [306, 34, 26], [366, 22, 16]], '#6f8590', 0.3);
  cun(b, far, { seed: 4, x0: 60, x1: 400, n: 70, len: 7, depth: 16, color: '#6a7f88', op: 0.35, w: 0.45 });
  crest(b, far, 6, 1.3, '#6f8790', 0.5);
  mist(b, 200, 122, 236, 9, 0.85, '#f6e8d6');

  // 2 · green forested range
  const mid = ridge({ seed: 9, base: 136, wave: 5, peaks: [[58, 15, 30], [226, 10, 32], [340, 19, 30]] });
  hill(b, 'mid', mid, '#738f82', '#d2d6c4', 30, 232, '#a8b8a6');
  flanks(b, mid, [[58, 24, 12], [340, 28, 14]], '#4d6a5e', 0.3);
  canopy(b, mid, [[20, 10, 3], [44, 9, 5], [70, 12, 6], [98, 9, 3], [150, 10, 2], [188, 9, 3], [216, 12, 4], [244, 8, 3], [318, 10, 4], [344, 12, 6], [372, 9, 4], [398, 10, 3]], { seed: 10, tones: ['#4f7364', '#68897a', '#8eaa98'], op: 0.55, sink: 9 });
  crest(b, mid, 11, 1.5, '#4f6f62', 0.5);
  mist(b, 150, 141, 210, 6, 0.75, '#f6e8d6');

  // 3 · the far shore: treeline, willows, a farmhouse
  const wl = 149;
  const shore = ridge({ seed: 13, base: wl - 3, wave: 1.6, peaks: [[372, 4, 26], [118, 2.5, 20]] });
  b.g.push(
    `<rect y="${wl}" width="400" height="${220 - wl}" fill="${vgrad(b, 'water', wl, 220, [
      [0, '#efd6b8'],
      [0.25, '#e2ddcf'],
      [1, '#bccdc8'],
    ])}"/>`,
  );
  // reflections: range, sun, light
  b.defs.push(`<clipPath id="${b.p}wc"><rect y="${wl}" width="400" height="${220 - wl}"/></clipPath>`);
  b.g.push(
    `<g clip-path="url(#${b.p}wc)"><g transform="matrix(1 0 0 -1 0 ${2 * wl})" opacity=".26"><path d="${smooth(far)}L416 232L-16 232Z" fill="#7a8f94"/><path d="${smooth(mid)}L416 232L-16 232Z" fill="#577566"/></g></g>`,
  );
  let sun = '';
  for (let k = 0; k < 10; k++) {
    const w = 22 - k * 2;
    sun += `<rect x="${n1(238 - w / 2 + (k % 2) * 1.5)}" y="${n1(wl + 2 + k * 3.2)}" width="${n1(w)}" height="1.1" rx=".55" opacity="${n1(0.9 - k * 0.08)}"/>`;
  }
  b.g.push(`<g fill="#f6d39a">${sun}</g>`);
  hill(b, 'shore', shore, '#5e7d68', '#93aa94', 7, wl + 1.5);
  b.g.push(house(206, yAt(shore, 206) + 1.5, 0.75, '#3f554a', '#e3d9c2') + house(220, yAt(shore, 220) + 1.2, 0.6, '#3f554a', '#e3d9c2'));
  b.lights.push(houseWindows(206, yAt(shore, 206) + 1.5, 0.75, '#f3c46e'));
  canopy(b, shore, [[40, 22, 3], [120, 16, 2], [180, 12, 3], [250, 16, 4], [386, 22, 5]], { seed: 14, tones: ['#44634f', '#5a7d64', '#7d9c80'], sink: 2.5 });
  // weeping willows on the shore: a leaning trunk, a soft crown, and long
  // tapered strands falling from it
  const wr = rng(17);
  let trunks = '';
  let strands = '';
  const crowns: [number, number, number][] = [];
  for (const [wx, wh] of [[262, 16], [398, 18]] as Pt[]) {
    const wy = yAt(shore, wx) + 1;
    trunks += branch([[wx, wy], [wx - 1, wy - wh * 0.5], [wx + 1.5, wy - wh * 0.9]], 1.6, 0.5);
    crowns.push([wx + 1, wh * 0.55, wh * 0.25]);
    for (let k = 0; k < 9; k++) {
      const t = -1 + (2 * k) / 8;
      const sx = wx + 1 + t * wh * 0.5;
      const sy = wy - wh * (0.95 - t * t * 0.25);
      const len = wh * (0.45 + wr() * 0.3) * (1 - Math.abs(t) * 0.3);
      strands += ribbon([[sx, sy], [sx + t * 1.2, sy + len * 0.35], [sx + t * 1.8 + 0.4, sy + len * 0.7], [sx + t * 2 + 0.6, sy + len]], 0.9, wr);
    }
  }
  b.g.push(`<path d="${trunks}" fill="#3f5446"/>`);
  crowns.forEach(([x, hw, h], i) => {
    const base = yAt(shore, x) - h * 2.6;
    canopy(b, [[x - 30, base], [x + 30, base]], [[x, hw, h]], { seed: 18 + i, tones: ['#4f6e58', '#6b8c6c', '#9ab58f'], sink: 0 });
  });
  b.g.push(`<path d="${strands}" fill="#557559" opacity=".8"/>`);

  // 4 · the pavilion over the pond, its reflection and the plank bridge to the shore
  const px = 318;
  const pyw = wl + 9;
  const pc = { roof: '#384440', wood: '#5b4536', stone: '#8d8a7c', band: '#55786b', light: '#f3e2c4', paper: '#f2dcae' };
  b.g.push(
    `<g clip-path="url(#${b.p}wc)"><g transform="matrix(1 0 0 -1 0 ${n1(2 * pyw)})" opacity=".3">${pavilion(px, pyw, 1, { ...pc, light: pc.roof })}</g></g>`,
  );
  // ripples breaking the reflection
  b.g.push(`<path d="M296 ${pyw + 6}h18M320 ${pyw + 9}h22M300 ${pyw + 14}h14M326 ${pyw + 18}h18M308 ${pyw + 24}h20" stroke="#e8e1d2" stroke-width=".8" opacity=".7"/>`);
  // bridge: a low plank walk on posts, rising to the right bank
  b.g.push(
    `<path d="M333 ${pyw - 7.4}Q350 ${pyw - 10} 372 ${wl - 1}L372 ${wl + 0.6}Q350 ${pyw - 8.4} 333 ${pyw - 5.8}Z" fill="#5b4536"/>` +
      `<path d="M341 ${pyw - 7}v6.4M352 ${pyw - 8.2}v5.4M363 ${wl + 0.4}v3.4" stroke="#5b4536" stroke-width=".7"/>` +
      `<path d="M333 ${pyw - 10.4}Q350 ${pyw - 13} 372 ${wl - 3.6}" stroke="#5b4536" stroke-width=".55" fill="none"/>`,
  );
  b.g.push(pavilion(px, pyw, 1, pc));
  // lantern under the eaves
  b.lights.push(glow(b, px, pyw - 15, 14, '#f7cf7a', 0.75) + `<path d="M${px - 1.3} ${pyw - 13}h2.6v-3.6h-2.6Z" fill="#f6c768"/><path d="M${px} ${pyw - 16.6}v-4.6" stroke="#3a2c22" stroke-width=".35"/>`);

  // 5 · the lotus pond: pads in perspective, leaves on stems, blooms and buds
  b.defs.push(
    `<g id="${b.p}lotus">` +
      `<path d="M0 0C-5.4 -1 -7.6 -5 -7.4 -7.6C-4.4 -6.8 -1.8 -4.2 0 0Z" fill="#e7a3b4"/><path d="M0 0C5.4 -1 7.6 -5 7.4 -7.6C4.4 -6.8 1.8 -4.2 0 0Z" fill="#e7a3b4"/>` +
      `<path d="M0 0C-3.6 -2.4 -4.4 -7.6 -3 -10.4C-1 -8 .2 -3.6 0 0Z" fill="#f2c4cf"/><path d="M0 0C3.6 -2.4 4.4 -7.6 3 -10.4C1 -8 -.2 -3.6 0 0Z" fill="#f2c4cf"/>` +
      `<path d="M0 0C-1.8 -3 -1.8 -8.6 0 -11.6C1.8 -8.6 1.8 -3 0 0Z" fill="#f8dde3"/>` +
      `<path d="M-7.4 -7.6l.9 1.1M7.4 -7.6l-.9 1.1M-3 -10.4l.3 1.3M3 -10.4l-.3 1.3M0 -11.6v1.4" stroke="#c45d7a" stroke-width=".9" stroke-linecap="round"/>` +
      `<path d="M-2.4 -1.6Q0 -3.2 2.4 -1.6Q0 -.4 -2.4 -1.6Z" fill="#e3c35a"/></g>`,
  );
  const lr = rng(19);
  const pad = (x: number, y: number, rx: number, tone: string) => {
    const ry = rx * (0.22 + ((y - wl) / 70) * 0.22);
    const a = 1.25 + (lr() - 0.5) * 0.5;
    const x1 = x + Math.cos(a - 0.22) * rx;
    const y1 = y + Math.sin(a - 0.22) * ry;
    const x2 = x + Math.cos(a + 0.22) * rx;
    const y2 = y + Math.sin(a + 0.22) * ry;
    return [`M${n1(x)} ${n1(y)}L${n1(x1)} ${n1(y1)}A${n1(rx)} ${n1(ry)} 0 1 0 ${n1(x2)} ${n1(y2)}Z`, tone] as const;
  };
  const pads: Record<string, string> = { '#4f7556': '', '#638a68': '', '#7d9f7a': '' };
  const tones = Object.keys(pads);
  // far pads: small and flat; near pads: larger, toward the right
  // colonies of pads: [x, y, count, spread]
  const colonies: [number, number, number, number][] = [[276, 156, 5, 12], [356, 162, 6, 16], [236, 168, 4, 12], [312, 182, 5, 18], [384, 190, 4, 14], [270, 200, 4, 18]];
  for (const [cx, cy, n, sp] of colonies)
    for (let k = 0; k < n; k++) {
      const y = cy + (lr() + lr() - 1) * sp * 0.25;
      const x = cx + (lr() + lr() - 1) * sp;
      const [d, c] = pad(x, y, 2.6 + ((y - wl) / 62) * 7 * (0.7 + lr() * 0.5), tones[Math.floor(lr() * 3)]);
      pads[c] += d;
    }
  // a few lone pads drifting in the calm water on the left
  for (const [x, y, s] of [[104, 176, 3.2], [146, 168, 2.4], [60, 196, 4.4], [170, 190, 3.6]] as [number, number, number][]) {
    const [d, c] = pad(x, y, s, '#7d9f7a');
    pads[c] += d;
  }
  b.g.push(tones.map((c) => `<path d="${pads[c]}" fill="${c}" opacity=".9"/>`).join(''));
  // pads catch the light along their rims
  b.g.push(`<path d="M300 205q10 -3 22 0M346 196q8 -2.4 18 0M262 214q12 -3 26 0M372 210q9 -2 18 0" stroke="#b9cdb0" stroke-width=".6" fill="none" opacity=".7"/>`);
  // standing leaves on stems (cupped, seen edge-on) and the flowers
  let stems = '';
  let cups = '';
  const stand: [number, number, number, number][] = [
    [284, 214, 34, 1.1], [306, 214, 46, 1.3], [334, 216, 28, 1.2], [360, 218, 40, 1.4], [384, 216, 30, 1.2], [396, 214, 48, 1], [262, 200, 18, 0.8], [350, 196, 16, 0.75],
  ];
  for (const [x, by, h, s] of stand) {
    const tx = x + (lr() - 0.5) * 4;
    stems += `M${x} ${by}Q${n1(x + 1)} ${n1(by - h * 0.5)} ${n1(tx)} ${n1(by - h)}`;
    const w = 8 * s;
    cups += `M${n1(tx - w)} ${n1(by - h - 2 * s)}Q${n1(tx)} ${n1(by - h + 4 * s)} ${n1(tx + w)} ${n1(by - h - 2.4 * s)}Q${n1(tx + w * 0.4)} ${n1(by - h - 0.4 * s)} ${n1(tx)} ${n1(by - h - 0.6 * s)}Q${n1(tx - w * 0.4)} ${n1(by - h - 0.2 * s)} ${n1(tx - w)} ${n1(by - h - 2 * s)}Z`;
  }
  const flowers: [number, number, number, number][] = [[296, 214, 52, 1.25], [342, 216, 58, 1.45], [372, 214, 36, 1.05], [278, 202, 22, 0.7]];
  for (const [x, by, h] of flowers) stems += `M${x} ${by}Q${n1(x - 1)} ${n1(by - h * 0.5)} ${x} ${by - h}`;
  const buds: [number, number, number][] = [[322, 216, 48], [392, 214, 56], [256, 204, 26]];
  for (const [x, by, h] of buds) stems += `M${x} ${by}Q${n1(x + 1.4)} ${n1(by - h * 0.5)} ${n1(x + 0.6)} ${by - h}`;
  b.g.push(`<path d="${stems}" stroke="#4e6d50" stroke-width=".9" fill="none"/>`);
  b.g.push(`<path d="${cups}" fill="#5c845e"/><path d="${cups}" fill="none" stroke="#86a77f" stroke-width=".35" opacity=".6"/>`);
  let fl = '';
  for (const [x, by, h, s] of flowers) fl += use(b, 'lotus', x, by - h + 1, s, 0, '#e7a3b4');
  let bd = '';
  for (const [x, by, h] of buds) bd += `M${n1(x + 0.6)} ${by - h + 0.6}C${n1(x - 2.8)} ${by - h - 2} ${n1(x - 0.8)} ${by - h - 7} ${n1(x + 0.6)} ${by - h - 9}C${n1(x + 2)} ${by - h - 7} ${n1(x + 4)} ${by - h - 2} ${n1(x + 0.6)} ${by - h + 0.6}Z`;
  b.g.push(fl + `<path d="${bd}" fill="#eaa9b9"/><path d="${bd}" fill="none" stroke="#c45d7a" stroke-width=".4" opacity=".6"/>`);
  wisps(b, [[90, 156, 60], [150, 166, 40], [60, 182, 46], [130, 198, 70]], '#ffffff', 0.38, 16);

  // a dragonfly resting over the water
  b.g.push(`<g transform="translate(232 178) rotate(-8)"><path d="M0 0h9" stroke="#3e4a48" stroke-width=".7" stroke-linecap="round"/><path d="M2 0q1 -3.2 3.4 -3.4q-.4 2.4 -3.4 3.4ZM2 0q1 3.2 3.4 3.4q-.4 -2.4 -3.4 -3.4ZM2.4 0q-.4 -3 -2.6 -3.4q0 2.2 2.6 3.4ZM2.4 0q-.4 3 -2.6 3.4q0 -2.2 2.6 -3.4Z" fill="#dfe6e2" opacity=".75"/></g>`);

  // fireflies over the pads and the bank, each with the faint arc of its flight:
  // lights, so they glow over the night veil
  const ff: [number, number, number, number][] = [
    [272, 138, 7, 1], [334, 116, 6, -1], [216, 160, 5, 1], [358, 142, 7, -1], [296, 174, 6, 1], [382, 182, 5, -1],
  ];
  let halos = '';
  let trails = '';
  let bodies = '';
  for (const [x, y, r, dir] of ff) {
    halos += glow(b, x, y, r, '#f4e08e', 0.85);
    trails += `M${x} ${y}q${n1(-dir * r * 1.2)} ${n1(r * 0.5)} ${n1(-dir * r * 2.4)} ${n1(-r * 0.3)}`;
    bodies += `M${n1(x - dir * 0.9)} ${n1(y + 0.25)}q${n1(dir * 0.9)} -.75 ${n1(dir * 1.8)} 0q${n1(-dir * 0.9)} .5 ${n1(-dir * 1.8)} 0Z`;
  }
  b.lights.push(halos + `<path d="${trails}" stroke="#f6e7a6" stroke-width=".45" stroke-linecap="round" fill="none" opacity=".45"/><path d="${bodies}" fill="#fff6c8"/>`);

  grain(b, 0.2);
}

function autumn(b: B): void {
  b.g.push(
    `<rect width="400" height="220" fill="${vgrad(b, 'sky', 0, 140, [
      [0, '#ecd1b6'],
      [0.5, '#f5e0c6'],
      [1, '#f7ecdc'],
    ])}"/>`,
  );
  disc(b, 266, 88, 24, '#d25e3b', '#e99a6c', 86, 0.5, 0.88);
  wisps(b, [[200, 84, 120], [238, 95, 110], [150, 70, 80], [300, 60, 60]], '#f8e8d6', 0.8, 7);

  // geese crossing toward the upper left, in a loose V
  const geese: [number, number, number][] = [
    [140, 32, 1.1], [149, 28.6, 1], [158, 25.4, 1], [167, 22.6, 0.95], [176, 20, 0.9], [150, 36.4, 1], [160, 40, 0.95], [170, 43.4, 0.9], [181, 46.6, 0.85],
  ];
  b.g.push(birds(geese, '#5a463e', 0.75, 8));

  // 1 · distant ridges
  const far0 = ridge({ seed: 69, base: 110, wave: 4, peaks: [[40, 12, 30], [180, 8, 30], [360, 16, 30]] });
  hill(b, 'far0', far0, '#ddc0ad', '#f3e4d2', 26);
  band(b, 114, 14, '#f9ecdc', 0.9);
  const far = ridge({ seed: 71, base: 120, wave: 5, peaks: [[100, 16, 40], [196, 10, 28], [330, 21, 38]] });
  hill(b, 'far', far, '#c9a593', '#f2e3d1', 40, 232, '#e0c7b6');
  flanks(b, far, [[100, 30, 16], [330, 36, 18]], '#9c705f', 0.3);
  cun(b, far, { seed: 70, x0: 40, x1: 400, n: 60, len: 6, depth: 13, color: '#9a6f5c', op: 0.35, w: 0.45 });
  crest(b, far, 72, 1.1, '#a87f6c', 0.45);
  mist(b, 200, 123, 236, 9, 0.8, '#f9ecdc');

  // 2 · maple forest with the temple on its shoulder
  const mid = ridge({ seed: 73, base: 140, wave: 4, peaks: [[292, 15, 36], [78, 10, 40], [380, 6, 26]] });
  hill(b, 'mid', mid, '#bb7556', '#ecd1b8', 32, 232, '#d9a387');
  flanks(b, mid, [[78, 30, 12], [292, 34, 12]], '#8a4632', 0.25);
  const ty0 = yAt(mid, 290) + 6;
  b.g.push(templeHall(290, ty0, 0.82, { roof: '#4a3530', wall: '#efdcc4', wood: '#4a3530', band: '#4f7a6c', red: '#a8442f', stone: '#c6ab95', light: '#f6dcc4' }));
  b.g.push(stoneTower(326, yAt(mid, 326) + 4, 1.05, '#9a8476', '#5a4438'));
  const mg: [number, number, number][] = [[18, 24, 5], [78, 30, 8], [146, 22, 5], [212, 20, 4], [254, 10, 3], [336, 9, 2], [362, 22, 7], [398, 18, 6]];
  canopy(b, mid, mg.filter((_, i) => i % 3 !== 1), { seed: 74, tones: ['#a4432d', '#c65d3c', '#e49a5c'] });
  canopy(b, mid, mg.filter((_, i) => i % 3 === 1), { seed: 75, tones: ['#b8653a', '#d98a48', '#efc07a'] });
  // a few dark pines among the maples, for depth
  let pines = '';
  for (const [x, h] of [[236, 9], [244, 7], [350, 8], [372, 10]] as Pt[]) pines += conifer(x, yAt(mid, x) + 4, h, '#5a4a3c');
  b.g.push(`<g opacity=".7">${pines}</g>`);
  mist(b, 226, 153, 214, 8, 0.75, '#f9ecdc');

  // 3 · village ridge with a persimmon tree
  const vil = ridge({ seed: 79, base: 162, wave: 3, peaks: [[318, 7, 40]] });
  hill(b, 'vil', vil, '#d29e80', '#efdcc6', 30);
  crest(b, vil, 80, 1.2, '#a8735b', 0.42, 200);
  cun(b, vil, { seed: 82, x0: 260, x1: 400, n: 24, len: 5, depth: 8, color: '#9a6a52', op: 0.3 });
  b.g.push(
    house(290, yAt(vil, 290) + 2, 0.8, '#5e4036', '#f1e2cc') + house(308, yAt(vil, 308) + 2, 0.95, '#5e4036', '#f1e2cc') + house(329, yAt(vil, 329) + 2, 0.85, '#5e4036', '#f1e2cc'),
  );
  // a low stone wall in front of the houses
  b.g.push(`<path d="M280 ${n1(yAt(vil, 280) + 3)}Q310 ${n1(yAt(vil, 310) + 4.6)} 340 ${n1(yAt(vil, 340) + 3)}" stroke="#a88c78" stroke-width="1.3" fill="none" opacity=".7"/>`);
  const tx = 350;
  const ty = yAt(vil, tx) + 2;
  b.g.push(
    `<path d="${branch([[tx, ty], [tx + 1, ty - 9], [tx - 2, ty - 17], [tx - 1, ty - 24]], 2.4, 0.5)}M${tx + 1} ${ty - 9}Q${tx + 6} ${ty - 13} ${tx + 9} ${ty - 20}M${tx - 2} ${ty - 14}Q${tx - 7} ${ty - 17} ${tx - 10} ${ty - 22}M${tx + 4} ${ty - 12}L${tx + 3} ${ty - 22}" stroke="#4e3a33" stroke-width=".7" fill="#4e3a33"/>`,
  );
  const pr = rng(81);
  let ps = '';
  let hi = '';
  // a few ripe fruit hanging from the twigs, each with a lit shoulder and a dark calyx
  let cal = '';
  for (const [fx, fy] of [[-8, -21], [-4, -15], [3, -22], [7, -17], [9, -12], [-1, -19], [4, -13]] as Pt[]) {
    const x = tx + fx + (pr() - 0.5);
    const y = ty + fy + (pr() - 0.5);
    ps += ellipse(x, y, 1.6, 1.4);
    hi += `M${n1(x - 1.1)} ${n1(y - 0.2)}q.3 -1 1.3 -1.1q-.6.5 -.8 1.3Z`;
    cal += `M${n1(x - 0.8)} ${n1(y - 1.3)}h1.6`;
  }
  b.g.push(`<path d="${ps}" fill="#de7432"/><path d="${hi}" fill="#f6b56c"/><path d="${cal}" stroke="#4e3a33" stroke-width=".55" stroke-linecap="round"/>`);
  mist(b, 160, 170, 200, 7, 0.65, '#f9ecdc');

  // 4 · near field, calm on the left; silver grass on the right
  const near = ridge({ seed: 83, base: 188, wave: 2.5, peaks: [[380, 20, 64]] });
  hill(b, 'near', near, '#d9b494', '#f3e7d6', 44);
  crest(b, near, 84, 1.2, '#ab8466', 0.42, 230);
  let grass = '';
  let plumes = '';
  const gs = rng(85);
  for (let k = 0; k < 11; k++) {
    const x = 292 + k * 5.6 + gs() * 4;
    const h = 30 + gs() * 22;
    const lean = -10 - gs() * 10;
    grass += `M${n1(x)} 222Q${n1(x + lean * 0.2)} ${n1(222 - h * 0.6)} ${n1(x + lean)} ${n1(222 - h)}`;
    // feathery plume: a few drooping strokes from the tip
    const px = x + lean;
    const py = 222 - h;
    for (let j = 0; j < 4; j++) plumes += `M${n1(px)} ${n1(py + j * 1.6)}q${n1(-2 - j)} ${n1(1.4 + j * 0.5)} ${n1(-3.4 - j * 1.2)} ${n1(4.6 + j)}`;
  }
  b.g.push(`<path d="${grass}" stroke="#b39674" stroke-width=".8" fill="none" opacity=".8"/>`);
  b.g.push(`<path d="${plumes}" stroke="#efe0c6" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".85"/>`);

  // 5 · maple branch from the right
  const ink = '#4a3530';
  const main: Pt[] = [[424, 40], [392, 46], [360, 44], [332, 52], [306, 62], [284, 76]];
  b.g.push(
    '<g transform="translate(-4 8)">',
    `<path d="${branch(main, 6, 0.6)}" fill="${ink}"/>` +
      `<path d="${branch([[366, 45], [352, 30], [346, 18], [350, 8]], 2.6, 0.5)}" fill="${ink}"/>` +
      `<path d="${branch([[318, 57], [312, 44], [302, 38]], 1.6, 0.4)}" fill="${ink}"/>` +
      `<path d="${barkLight(main, 6, 0.6)}" stroke="#8a6a5c" stroke-width=".5" fill="none" opacity=".6"/>`,
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
  // two leaves falling
  ld += use(b, 'fl-mp', 262, 104, 0.8, 40, '#d4643c', 0.85) + use(b, 'fl-mp', 238, 120, 0.7, -60, '#e08a4a', 0.75);
  b.g.push(ld, '</g>');

  grain(b, 0.2);
}

function winter(b: B): void {
  // early night: slate blue overhead, pale at the snow line
  b.g.push(
    `<rect width="400" height="220" fill="${vgrad(b, 'sky', 0, 140, [
      [0, '#a9b6c9'],
      [0.55, '#d3d8e0'],
      [1, '#efebe4'],
    ])}"/>`,
  );
  // the moon is a light: it keeps its glow over the night veil
  disc(b, 146, 46, 14, '#fcf8ec', '#ffffff', 56, 0.75, 0.97, b.lights);
  b.lights.push(`<path d="${ellipse(141, 43, 3.6, 2.6)}${ellipse(150, 51, 2.6, 1.9)}${ellipse(149, 41, 1.7, 1.2)}${ellipse(140, 52, 1.2, 0.9)}" fill="#e3dcca" opacity=".55"/>`);
  wisps(b, [[104, 58, 90], [168, 66, 70], [120, 74, 60]], '#eef0f2', 0.6, 9);

  // 1 · snowy peaks: silhouette, snow caps, shadowed faces
  const base = 128;
  const pk: [number, number, number, number][] = [
    [56, 94, 40, 40], [150, 76, 48, 52], [214, 90, 38, 34], [276, 66, 54, 60], [350, 84, 42, 48],
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
  hill(b, 'peaks', sil, '#9eaec1', '#e6e8e9', 56, 232, '#c3cdd8');
  let caps = '';
  let shade = '';
  let gully = '';
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
    // snow gullies running down from the caps
    for (let k = 0; k < 4; k++) {
      const gx = sx + (r() - 0.5) * wl * 0.8;
      const gy = yAt(sil, gx) + H * 0.2;
      gully += `M${n1(gx)} ${n1(gy)}q${n1((r() - 0.5) * 3)} ${n1(H * 0.15)} ${n1((r() - 0.5) * 5)} ${n1(H * (0.25 + r() * 0.2))}`;
    }
  }
  b.g.push(`<path d="${caps}" fill="#f8f9f8" opacity=".92"/><path d="${shade}" fill="#8c9eb4" opacity=".4"/>`);
  b.g.push(`<path d="${gully}" stroke="#f6f7f8" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".55"/>`);
  cun(b, sil, { seed: 90, x0: 20, x1: 400, n: 70, len: 6, depth: 26, color: '#7f90a6', op: 0.3, w: 0.45 });
  crest(b, sil.filter((_, i) => i % 2 === 0), 92, 0.9, '#73849b', 0.38);
  mist(b, 200, 130, 246, 10, 0.9, '#f2f1ee');

  // 2 · snowy forested hills
  const mid = ridge({ seed: 93, base: 145, wave: 5, peaks: [[86, 10, 40], [244, 11, 40], [342, 8, 30]] });
  hill(b, 'mid', mid, '#e1e7ee', '#f1efea', 28);
  crest(b, mid, 94, 1.2, '#8c9bae', 0.45);
  const tr = rng(95);
  let trees = '';
  const stands: [number, number][] = [[34, 20], [96, 14], [216, 22], [300, 18], [376, 22]];
  const firs: [number, number, number][] = [];
  for (let k = 0; k < 64; k++) {
    const [c, hw] = stands[k % stands.length];
    const t = tr() + tr() - 1;
    firs.push([c + t * hw, 1 + tr() * 7, (6 + tr() * 7) * (1 - Math.abs(t) * 0.45)]);
  }
  firs.sort((a, c) => a[1] - c[1]);
  // one snowy fir drawn once (10 units tall), placed many times
  b.defs.push(`<g id="${b.p}fir">${conifer(0, 0, 10, 'inherit', '#eef2f5').replace('fill="inherit"', '')}</g>`);
  for (const [x, dy, h] of firs) trees += `<use href="#${b.p}fir" transform="translate(${n1(x)} ${n1(yAt(mid, x) + dy + 2)}) scale(${n1(h / 10)})" fill="${dy > 4 ? '#56657a' : '#6f7e92'}"/>`;
  b.g.push(`<g opacity=".78">${trees}</g>`);
  mist(b, 170, 156, 214, 7, 0.75, '#f2f1ee');

  // 3 · village ridge: snowed roofs, warm windows, threads of smoke, a gate in the wall
  const vil = ridge({ seed: 97, base: 165, wave: 2, peaks: [[300, 6, 44]] });
  hill(b, 'vil', vil, '#d9e0e8', '#f2efe9', 20);
  crest(b, vil, 98, 1, '#9aa7b6', 0.45, 200);
  const homes: [number, number][] = [[258, 0.95], [278, 1.1], [300, 1.25], [324, 1.05], [346, 1.2], [366, 0.95]];
  let hs = '';
  let gl = '';
  for (const [x, s] of homes) {
    const y = yAt(vil, x) + 2.5;
    hs += house(x, y, s, '#4f5968', '#ddd6c8', '#fbfbfa');
    gl += glow(b, x, y - 1.5 * s, 10 * s, '#f5c46a', 0.7) + houseWindows(x, y, s, '#f4c060');
  }
  // a snow-capped wall along the front of the village
  const wy = (x: number) => yAt(vil, x) + 4.6;
  const wall: Pt[] = [];
  for (let x = 254; x <= 366; x += 8) wall.push([x, wy(x)]);
  b.g.push(hs);
  b.g.push(`<path d="${smooth(wall)}" stroke="#8a8f98" stroke-width="1.5" fill="none" opacity=".75"/><path d="${smooth(wall.map(([x, y]) => [x, y - 0.9] as Pt))}" stroke="#fbfbfa" stroke-width=".9" fill="none"/>`);
  b.lights.push(gl);
  // threads of smoke: tapered washes drifting off to the left as they rise
  const smr = rng(103);
  let smoke = '';
  for (const [x, s] of [homes[1], homes[3], homes[4]]) {
    const y0 = yAt(vil, x) - 7 * s;
    const seg: Pt[] = [];
    for (let k = 0; k <= 7; k++) seg.push([x + 2 * s - k * k * 0.18 + Math.sin(k * 1.3) * 1.1, y0 - k * 3]);
    smoke += ribbon(seg, 1.5, smr);
  }
  b.g.push(`<path d="${smoke}" fill="#cfd5dd" opacity=".55"/>`);
  b.g.push(conifer(246, yAt(vil, 246) + 3, 9, '#5f6d80', '#f4f6f7') + conifer(372, yAt(vil, 372) + 3, 11, '#56647a', '#f4f6f7') + conifer(380, yAt(vil, 380) + 4, 7, '#6f7d90', '#f4f6f7'));

  // 4 · near snowfield with soft blue shadows and a footpath
  const near = ridge({ seed: 99, base: 190, wave: 2.5, peaks: [[384, 20, 64]] });
  hill(b, 'near', near, '#f5f6f5', '#efede7', 30);
  b.g.push(`<path d="M300 ${n1(yAt(near, 300) + 6)}q-30 16 -84 30" stroke="#b7c2d0" stroke-width="1.6" fill="none" opacity=".35" stroke-linecap="round"/>`);
  crest(b, near, 100, 1.1, '#9fadbe', 0.45, 230);

  // 5 · plum branch, angular, with snow along its back
  const ink = '#3e3434';
  const main: Pt[] = [[424, 12], [394, 22], [372, 30], [352, 22], [334, 32], [318, 42], [300, 36], [282, 48], [266, 60]];
  const sub: Pt[] = [[352, 22], [346, 38], [340, 52], [328, 62]];
  const twig: Pt[] = [[318, 42], [314, 26], [318, 12]];
  b.g.push(
    '<g transform="translate(-18 24)">',
    `<path d="${branch(main, 7, 0.8, true)}" fill="${ink}"/><path d="${branch(sub, 3, 0.6, true)}" fill="${ink}"/><path d="${branch(twig, 2, 0.5, true)}" fill="${ink}"/>`,
  );
  // snow lying in soft drifts along the upper side of the branch: tapered ribbons
  // that swell and thin, broken where the branch turns steeply
  const sr = rng(102);
  let snow = '';
  const lay = (pts: Pt[], w0: number, w1: number) => {
    const n = pts.length - 1;
    let run: Pt[] = [];
    const flush = () => {
      if (run.length > 2) {
        const m = run.length - 1;
        const top = run.map(([x, y], k) => [x, y - 2.1 * Math.sin((Math.PI * k) / m) ** 0.6 * (0.7 + sr() * 0.5)] as Pt);
        const bot = run.map(([x, y]) => [x, y + 0.7] as Pt).reverse();
        snow += smooth(top) + smooth(bot, false) + 'Z';
      }
      run = [];
    };
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0) * 0.9;
      if (steep) {
        flush();
        continue;
      }
      const steps = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 3));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const w = w0 + (w1 - w0) * ((i + t) / n);
        run.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - w * 0.45]);
      }
    }
    flush();
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
  }
  b.g.push(fl, '</g>');

  grain(b, 0.2);
}

const PAINT = [spring, summer, autumn, winter];
const cache = new Map<number, string>();

export function sceneSvg(season: number): string {
  const k = ((season % 4) + 4) % 4;
  let svg = cache.get(k);
  if (!svg) {
    const b: B = { p: `sc${k}-`, defs: [], g: [], lights: [] };
    PAINT[k](b);
    // Night veil: deeper at the foot so the wordmark keeps its contrast in the ink theme.
    const veil = vgrad(b, 'veil', 0, 220, [
      [0, '#121116', 0.5],
      [0.6, '#16140f', 0.56],
      [1, '#1c1b19', 0.7],
    ]);
    svg =
      `<svg class="scene__art" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>${b.defs.join('')}</defs>` +
      `${b.g.join('')}<rect class="scene__veil" width="400" height="220" fill="${veil}"/>${b.lights.join('')}</svg>`;
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

/**
 * Drifting particles as positioned spans, drawn in CSS as real shapes (a
 * notched petal, a maple leaf, a six-armed snow crystal, a firefly's glow) and
 * animated with transform and opacity only. Few of them, varied in size.
 */
export function sceneParticles(season: number, count = 9): string {
  const kind = PARTICLE[((season % 4) + 4) % 4];
  const tints = TINTS[kind];
  let out = '';
  for (let i = 0; i < count; i++) {
    // deterministic spread so the layout is stable between renders
    const x = (i * 37 + 11) % 100;
    const delay = ((i * 1.9) % 10).toFixed(1);
    const dur = (10 + ((i * 2.3) % 7)).toFixed(1);
    let size = 7 + ((i * 3) % 5);
    let extra = '';
    if (tints) extra += `;background:${tints[i % tints.length]}`;
    if (kind === 'leaf') size += 2;
    if (kind === 'snow') size = 5 + ((i * 5) % 5);
    if (kind === 'firefly') extra += `;top:${38 + ((i * 23) % 40)}%`;
    out += `<span class="pt pt--${kind}" style="left:${x}%;--d:${delay}s;--t:${dur}s;--s:${size}px${extra}"></span>`;
  }
  return out;
}
