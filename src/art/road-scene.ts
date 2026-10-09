/**
 * The landscape for "The road goes on": an ink-wash view in a 360 × 640 frame.
 * Layered ridges recede into mist, pines stand on the middle ridge, a sun warms
 * the gap where the road meets the sky, and the road itself is a tapered ribbon
 * that runs from the viewer's feet (where the last passport stamp sits) up
 * through the hills to the horizon. Waypoint stones along the near road are the
 * places already visited; past the last stamp they are only outlines.
 *
 * Colours come from CSS custom properties (--rv-*) so both themes work, and
 * every layer carries a class the reveal's CSS animates (transform/opacity, plus
 * one mask stroke for the road drawing itself).
 */

type Pt = [number, number];

/** Small deterministic RNG so the scene is the same every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (v: number) => v.toFixed(1);

/** A smooth path through points (quadratic curves through midpoints). */
function smoothPath(pts: Pt[]): string {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(mx)} ${f(my)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${f(last[0])} ${f(last[1])}`;
}

/** The top line of a mountain ridge across the frame (deterministic per seed). */
function ridgePts(base: number, amp: number, seed: number, peaks: number[], rough = 1): Pt[] {
  const r = rng(seed);
  const pts: Pt[] = [];
  for (let x = -30; x <= 390; x += 12) {
    let y = base;
    for (const p of peaks) y -= amp * Math.exp(-(((x - p) / (46 + 30 * r())) ** 2));
    y += Math.sin(x / 37 + seed) * 5 * rough + (r() - 0.5) * 7 * rough;
    pts.push([x, y]);
  }
  return pts;
}

/** A mountain ridge across the frame, closed down below the bottom edge. */
function ridge(base: number, amp: number, seed: number, peaks: number[], rough = 1): string {
  return `${smoothPath(ridgePts(base, amp, seed, peaks, rough))}L390 760L-30 760Z`;
}

/** The ridge's top line only (for a brushed edge drawn over the wash). */
function ridgeLine(base: number, amp: number, seed: number, peaks: number[], rough = 1): string {
  return smoothPath(ridgePts(base, amp, seed, peaks, rough));
}

/** Height of a ridge's top line at x (straight-line interpolation of its points). */
function ridgeY(pts: Pt[], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= x) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * A pine in the Korean ink manner: a leaning, slightly crooked trunk with side
 * branches, each ending in a flat clump of needles made of a few overlapping
 * ovals (darker underside, lighter crown), so it reads as foliage, not discs.
 */
function pine(x: number, y: number, s: number, lean: number, seed: number): string {
  const r = rng(seed);
  const top: Pt = [x + lean * 9 * s, y - 36 * s];
  const mid: Pt = [x + lean * 2 * s + (r() - 0.5) * 3 * s, y - 18 * s];
  let trunk = `<path class="rv-pine__trunk" d="M${f(x)} ${f(y)}Q${f(mid[0])} ${f(mid[1])} ${f(top[0])} ${f(top[1])}" stroke-width="${f(2.4 * s)}"/>`;
  let clumps = '';
  const tiers = [0.34, 0.58, 0.8, 1];
  tiers.forEach((t, k) => {
    const bx = x + (top[0] - x) * t;
    const by = y + (top[1] - y) * t;
    const side = k % 2 ? -1 : 1;
    const reach = (14 - k * 2.6) * s;
    const ex = bx + side * reach * (0.6 + 0.4 * r());
    const ey = by - 2 * s;
    trunk += `<path class="rv-pine__branch" d="M${f(bx)} ${f(by)}Q${f((bx + ex) / 2)} ${f(by + 1.5 * s)} ${f(ex)} ${f(ey)}" stroke-width="${f(1.2 * s)}"/>`;
    const w = (11 - k * 1.8) * s;
    for (let j = 0; j < 3; j++) {
      const cx = ex - side * j * w * 0.55 + (r() - 0.5) * 2 * s;
      const cy = ey + (r() - 0.5) * 1.5 * s;
      clumps += `<ellipse cx="${f(cx)}" cy="${f(cy + 1.2 * s)}" rx="${f(w * (0.7 + 0.3 * r()))}" ry="${f(2.9 * s)}"/>`;
      clumps += `<ellipse class="rv-pine__crown" cx="${f(cx + side * 0.6 * s)}" cy="${f(cy - 0.8 * s)}" rx="${f(w * 0.55)}" ry="${f(1.7 * s)}"/>`;
    }
  });
  return `<g class="rv-pine">${trunk}${clumps}</g>`;
}

function catmull(pts: Pt[], steps = 14): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const poly = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('');
const closed = (a: Pt[], b: Pt[]) => `${poly(a)}${poly(b.slice().reverse()).replace('M', 'L')}Z`;

/** Width of the road at depth t (0 = the viewer's feet, 1 = the horizon). */
const roadWidth = (t: number) => 2 + 80 * (1 - t) ** 1.9;

/** A sampled stretch of road: centre points, the depth at each, and unit normals. */
interface Stretch {
  c: Pt[];
  t: number[];
  n: Pt[];
}

function stretch(pts: Pt[], t0: number, t1: number, steps = 16): Stretch {
  const c = catmull(pts, steps);
  // Depth follows arc length, so perspective stays smooth across uneven control points.
  const len = [0];
  for (let i = 1; i < c.length; i++) len.push(len[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
  const total = len[len.length - 1] || 1;
  const t = len.map((l) => t0 + (t1 - t0) * (l / total));
  const n = c.map((_, i) => {
    const a = c[Math.max(0, i - 1)];
    const b = c[Math.min(c.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l] as Pt;
  });
  return { c, t, n };
}

/** Points offset from the centre by `k` × half the road width (k = ±1 at the edges). */
const offset = (s: Stretch, k: number, extra = (_t: number) => 0): Pt[] =>
  s.c.map((p, i) => {
    const w = (roadWidth(s.t[i]) / 2) * k + extra(s.t[i]) * Math.sign(k || 1);
    return [p[0] + s.n[i][0] * w, p[1] + s.n[i][1] * w];
  });

/**
 * Paint a stretch of road as an ink-wash path: a darker verge wash, the packed
 * earth with a lighter crown, a shaded verge and long dry-brush strokes that
 * follow the road (painted, never stippled), tapered brush edges, and grass
 * along the verges.
 */
function paintRoad(s: Stretch, uid: string, seed: number, detail: number): string {
  const r = rng(seed);
  const L = (k: number) => offset(s, k);
  let out = '';
  // Soft verge wash just outside the road, then the road in three tones.
  out += `<path class="rv-road__verge" d="${closed(offset(s, 1, (t) => 3 + 7 * (1 - t)), offset(s, -1, (t) => 3 + 7 * (1 - t)))}"/>`;
  out += `<path class="rv-road__base" d="${closed(L(1), L(-1))}" fill="url(#${uid}-road)"/>`;
  out += `<path class="rv-road__packed" d="${closed(L(0.74), L(-0.74))}"/>`;
  out += `<path class="rv-road__crown" d="${closed(L(0.32), L(-0.26))}"/>`;
  // Dry-brush texture: long tapered strokes that follow the road, darker toward one
  // verge (the road's shaded side) and a few pale ones on the crown, the way a
  // path is painted in ink, never stippled.
  const streak = (k: number, from: number, to: number, weight: number, cls: string) => {
    const idx: number[] = [];
    for (let i = 0; i < s.c.length; i++) if (s.t[i] >= from && s.t[i] <= to) idx.push(i);
    if (idx.length < 4) return '';
    const a: Pt[] = [];
    const b: Pt[] = [];
    idx.forEach((i, j) => {
      const u = j / (idx.length - 1);
      const t = s.t[i];
      const half = roadWidth(t) / 2;
      const w = weight * Math.sin(Math.PI * u) ** 0.7 * (0.25 + 1.6 * (1 - t) ** 1.4) * (0.8 + 0.2 * Math.sin(j * 1.7 + seed));
      const off = half * k;
      a.push([s.c[i][0] + s.n[i][0] * (off + w / 2), s.c[i][1] + s.n[i][1] * (off + w / 2)]);
      b.push([s.c[i][0] + s.n[i][0] * (off - w / 2), s.c[i][1] + s.n[i][1] * (off - w / 2)]);
    });
    return `<path class="${cls}" d="${closed(a, b)}"/>`;
  };
  // The shaded verge: a broad, soft wash along the inside of one edge.
  out += streak(0.62, 0, 0.98, 7 * detail + 1, 'rv-road__shade');
  let brush = '';
  const count = Math.round(5 + 5 * detail);
  for (let q = 0; q < count; q++) {
    const k = -0.75 + 1.5 * r();
    const from = r() * 0.35;
    const to = Math.min(0.97, from + 0.25 + r() * 0.5);
    brush += streak(k, from, to, 0.6 + 1.3 * r(), k > 0.2 ? 'rv-road__dry' : 'rv-road__dry rv-road__dry--soft');
  }
  for (let q = 0; q < 3; q++) brush += streak(-0.2 + 0.3 * r(), 0.02 + 0.1 * q, 0.5 + 0.15 * q, 1.4, 'rv-road__glint');
  out += `<g class="rv-road__brush">${brush}</g>`;
  // Tapered brush edges: thick near the viewer, a hair at the horizon, breathing as they go.
  for (const side of [1, -1]) {
    const outer = offset(s, side);
    const inner = s.c.map((p, i) => {
      const t = s.t[i];
      const bw = (0.6 + 2.6 * (1 - t) ** 1.3) * (0.75 + 0.35 * Math.sin(i * 0.9 + seed + side));
      const w = roadWidth(t) / 2 - bw;
      return [p[0] + s.n[i][0] * w * side, p[1] + s.n[i][1] * w * side] as Pt;
    });
    out += `<path class="rv-road__edge" d="${closed(outer, inner)}"/>`;
  }
  // Grass tufts along both verges, sized by depth.
  let tufts = '';
  for (let i = 2; i < s.c.length - 2; i += 2) {
    const t = s.t[i];
    if (t > 0.85) break;
    const sc = 0.35 + 1.4 * (1 - t) ** 1.6;
    for (const side of [1, -1]) {
      if (r() > 0.55 * detail + 0.15) continue;
      const w = roadWidth(t) / 2 + (1 + 4 * r()) * sc;
      const x = s.c[i][0] + s.n[i][0] * w * side;
      const y = s.c[i][1] + s.n[i][1] * w * side;
      {
        const hgt = (5 + 6 * r()) * sc;
        tufts += `<path d="M${f(x)} ${f(y)}q${f(-1.2 * sc)} ${f(-hgt * 0.6)} ${f(-3 * sc)} ${f(-hgt)}M${f(x + 1 * sc)} ${f(y)}q${f(0.2 * sc)} ${f(-hgt * 0.7)} ${f(0.6 * sc)} ${f(-hgt * 1.15)}M${f(x + 2 * sc)} ${f(y)}q${f(1.4 * sc)} ${f(-hgt * 0.5)} ${f(3.4 * sc)} ${f(-hgt * 0.85)}"/>`;
      }
    }
  }
  out += `<g class="rv-road__tufts">${tufts}</g>`;
  return out;
}

/**
 * A wanderer in a straw hat with a staff and a bundle, walking away up the
 * road: the player, seen from behind. Drawn at (x, y) = feet, `s` = scale.
 */
function wanderer(x: number, y: number, s: number): string {
  return `<g class="rv-walker" transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">
    <ellipse class="rv-walker__shadow" cx="1" cy="0.6" rx="7" ry="1.6"/>
    <path class="rv-walker__staff" d="M6.5 0.5L9.5 -27"/>
    <path class="rv-walker__robe" d="M-4.6 0L-3.6 -14Q0 -17.5 3.6 -14L4.8 0Q2.6 0.9 0 0.6Q-2.4 0.9 -4.6 0Z"/>
    <path class="rv-walker__sash" d="M-3.7 -8.4Q0 -7.2 3.8 -8.6"/>
    <path class="rv-walker__bundle" d="M-5.6 -15.6Q-8.4 -12.4 -6.6 -9.4Q-3.8 -8.6 -2.6 -11.2Q-2.8 -14.6 -5.6 -15.6Z"/>
    <path class="rv-walker__head" d="M-1.9 -16.4Q0 -19.4 1.9 -16.4Q1.2 -15.2 0 -15.2Q-1.2 -15.2 -1.9 -16.4Z"/>
    <path class="rv-walker__hat" d="M-7.6 -18.2Q0 -26.5 7.6 -18.2Q3.8 -16.9 0 -17Q-3.8 -16.9 -7.6 -18.2Z"/>
    <path class="rv-walker__hatline" d="M-5 -19.4Q0 -18.2 5 -19.4"/>
  </g>`;
}

/** A one-pillar-pair gateway (일주문) with a curved tiled roof, at the pass. */
function gateway(x: number, y: number, s: number): string {
  return `<g class="rv-gate" transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">
    <path d="M-6.2 0V-11M6.2 0V-11" class="rv-gate__posts"/>
    <path d="M-8 -11H8" class="rv-gate__beam"/>
    <path d="M-12.5 -12.2Q-9 -11.6 -7 -14.2Q0 -17.6 7 -14.2Q9 -11.6 12.5 -12.2Q10.2 -15.8 7.4 -16.8Q0 -20.4 -7.4 -16.8Q-10.2 -15.8 -12.5 -12.2Z" class="rv-gate__roof"/>
  </g>`;
}

/** Tiny far-off trees standing along a ridge line. */
function treeLine(pts: Pt[], x0: number, x1: number, seed: number, s: number): string {
  const r = rng(seed);
  let out = '';
  for (let x = x0; x < x1; x += 4 + r() * 7) {
    const y = ridgeY(pts, x) + 1.5;
    const hgt = (3 + r() * 4) * s;
    out += `<path d="M${f(x)} ${f(y)}L${f(x - hgt * 0.3)} ${f(y)}L${f(x)} ${f(y - hgt)}L${f(x + hgt * 0.3)} ${f(y)}Z"/>`;
  }
  return `<g class="rv-trees">${out}</g>`;
}

/**
 * The scene as one <svg>. `uid` keeps gradient, mask and clip ids unique on the page.
 * The near road starts at the viewer's feet (bottom left, under the last stamp)
 * and climbs to the crest of the middle ridge, where it drops out of sight; it
 * reappears on the far hillside and runs up to the pass under the sun.
 */
export function roadSceneSvg(uid = 'rv'): string {
  const r = rng(7);
  const R3: [number, number, number, number[], number] = [420, 52, 37, [-10, 120, 360], 1];
  const r3 = ridgePts(...R3);
  // The crest where the road goes over the middle ridge.
  const crestX = 226;
  const crestY = ridgeY(r3, crestX);
  const nearPts: Pt[] = [
    [52, 712],
    [92, 616],
    [170, 556],
    [136, 492],
    [192, crestY + 34],
    [crestX + 2, crestY + 2],
    [crestX + 8, crestY - 14],
  ];
  const farPts: Pt[] = [
    [crestX + 6, crestY + 10],
    [crestX - 4, crestY - 26],
    [crestX + 18, crestY - 58],
    [252, 326],
    [259, 311],
  ];
  const near = stretch(nearPts, 0, 0.6);
  const far = stretch(farPts, 0.64, 1, 12);
  const drawLine = `${smoothPath(near.c.filter((_, i) => i % 3 === 0))}L${f(far.c[0][0])} ${f(far.c[0][1])}${smoothPath(far.c.filter((_, i) => i % 3 === 0)).replace('M', 'L')}`;

  // Pines along the middle ridge and one leaning in close.
  let pines = '';
  for (const [x, y, s, lean] of [
    [34, ridgeY(r3, 34) + 14, 1.25, -0.5],
    [60, ridgeY(r3, 60) + 22, 0.95, 0.4],
    [292, ridgeY(r3, 292) + 12, 1.1, 0.6],
    [318, ridgeY(r3, 318) + 16, 1.35, -0.3],
    [344, ridgeY(r3, 344) + 24, 0.9, 0.2],
    [10, 566, 2.1, 0.5],
  ] as [number, number, number, number][]) pines += pine(x, y, s, lean, Math.round(x * 7 + y));

  // Waypoints beside the road: places walked (inked) up to the stamp, then new country (outlines).
  let marks = '';
  const mark = (s: Stretch, i: number, side: number, done: boolean) => {
    const t = s.t[i];
    const [x, y] = s.c[i];
    const off = roadWidth(t) / 2 + 4 + 8 * (1 - t);
    const sc = 0.3 + 0.9 * (1 - t);
    // A small stone marker: a rounded post on a base.
    marks += `<g class="rv-mark${done ? ' is-done' : ''}" style="--rv-at:${Math.round(1000 + t * 1700)}ms" transform="translate(${f(x + s.n[i][0] * off * side)} ${f(y + s.n[i][1] * off * side)}) scale(${f(sc)})"><path d="M-3.4 0.6L-2.6 -9Q0 -11.6 2.6 -9L3.4 0.6Z"/><ellipse cx="0" cy="0.8" rx="5" ry="1.6"/></g>`;
  };
  mark(near, 4, 1, true);
  mark(near, 14, -1, true);
  mark(near, Math.round(near.c.length * 0.62), 1, false);
  mark(near, Math.round(near.c.length * 0.86), -1, false);
  mark(far, Math.round(far.c.length * 0.35), 1, false);
  mark(far, Math.round(far.c.length * 0.68), -1, false);

  // Grass strokes on the foreground slope, kept off the road.
  let grass = '';
  for (let k = 0; k < 34; k++) {
    const x = 170 + r() * 200;
    const y = 520 + r() * 130;
    const hgt = 6 + r() * 11;
    const lean = (r() - 0.3) * 6;
    grass += `<path d="M${f(x)} ${f(y)}q${f(lean * 0.4)} ${f(-hgt * 0.6)} ${f(lean)} ${f(-hgt)}"/>`;
  }

  // The wanderer, a little way up the near road.
  const wi = Math.round(near.c.length * 0.8);
  const walker = wanderer(near.c[wi][0] + near.n[wi][0] * roadWidth(near.t[wi]) * 0.12, near.c[wi][1], 0.6 + 1.1 * (1 - near.t[wi]) ** 1.5);
  const endAt = far.c[far.c.length - 4];
  const R2: [number, number, number, number[], number] = [352, 74, 23, [20, 150, 300], 0.8];
  const r2 = ridgePts(...R2);

  // Cranes, far off, flying toward the gap in the hills.
  const crane = (x: number, y: number, s: number, d: number) =>
    `<g class="rv-crane" style="--rv-d:${d}ms" transform="translate(${x} ${y}) scale(${s})"><path d="M-12 1Q-6 -6 0 0Q6 -6 12 1" /><path class="rv-crane__body" d="M-3 0.4L3.5 -0.2"/></g>`;

  return `<svg class="rv-land" viewBox="0 0 360 640" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--rv-sky-top)"/>
      <stop offset="0.55" stop-color="var(--rv-sky-low)"/>
      <stop offset="1" stop-color="var(--rv-sky-low)"/>
    </linearGradient>
    <radialGradient id="${uid}-sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="var(--rv-sun)" stop-opacity="0.95"/>
      <stop offset="0.28" stop-color="var(--rv-sun)" stop-opacity="0.55"/>
      <stop offset="1" stop-color="var(--rv-sun)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${uid}-mist" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--rv-mist)" stop-opacity="0"/>
      <stop offset="0.55" stop-color="var(--rv-mist)" stop-opacity="0.85"/>
      <stop offset="1" stop-color="var(--rv-mist)" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${uid}-road" gradientUnits="userSpaceOnUse" x1="0" y1="640" x2="0" y2="300">
      <stop offset="0" stop-color="var(--rv-road)"/>
      <stop offset="1" stop-color="var(--rv-road-far)"/>
    </linearGradient>
    <clipPath id="${uid}-near"><path d="${ridge(...R3)}"/></clipPath>
    <mask id="${uid}-draw" maskUnits="userSpaceOnUse" x="-40" y="-40" width="440" height="800">
      <path class="rv-draw" d="${drawLine}" pathLength="1"/>
    </mask>
  </defs>
  <rect class="rv-sky" x="-40" y="-40" width="440" height="800" fill="url(#${uid}-sky)"/>
  <g class="rv-sunwrap"><circle class="rv-glow" cx="262" cy="292" r="120" fill="url(#${uid}-sun)"/><circle class="rv-sun" cx="262" cy="276" r="21"/></g>
  <g class="rv-cranes">${crane(112, 232, 0.9, 0)}${crane(140, 248, 0.7, 180)}${crane(90, 256, 0.6, 320)}</g>
  <path class="rv-layer rv-layer--1" d="${ridge(318, 62, 11, [70, 196, 330], 0.6)}"/>
  <path class="rv-layer rv-layer--2" d="${ridge(...R2)}"/>
  ${treeLine(r2, 0, 200, 61, 0.8)}${treeLine(r2, 286, 360, 67, 0.8)}
  <rect class="rv-mist rv-mist--1" x="-40" y="286" width="440" height="130" fill="url(#${uid}-mist)"/>
  <g class="rv-road rv-road--far" mask="url(#${uid}-draw)">${paintRoad(far, uid, 19, 0.4)}</g>
  ${gateway(endAt[0], endAt[1] + 1, 0.55)}
  <path class="rv-layer rv-layer--3" d="${ridge(...R3)}"/>
  <path class="rv-ink rv-ink--3" d="${ridgeLine(...R3)}"/>
  ${pines}
  <rect class="rv-mist rv-mist--2" x="-40" y="398" width="440" height="110" fill="url(#${uid}-mist)"/>
  <path class="rv-layer rv-layer--4" d="${ridge(502, 30, 51, [300, 380], 1.1)}"/>
  <path class="rv-ink rv-ink--4" d="${ridgeLine(502, 30, 51, [300, 380], 1.1)}"/>
  <g class="rv-grass">${grass}</g>
  <g class="rv-road rv-road--near" mask="url(#${uid}-draw)"><g clip-path="url(#${uid}-near)">${paintRoad(near, uid, 5, 1)}</g></g>
  <g class="rv-marks">${marks}</g>
  ${walker}
</svg>`;
}
