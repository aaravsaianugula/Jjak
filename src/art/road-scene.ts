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

/** A mountain ridge across the frame, closed down to the bottom. */
function ridge(base: number, amp: number, seed: number, peaks: number[], rough = 1): string {
  const r = rng(seed);
  const pts: Pt[] = [];
  for (let x = -30; x <= 390; x += 12) {
    let y = base;
    for (const p of peaks) y -= amp * Math.exp(-(((x - p) / (46 + 30 * r())) ** 2));
    y += Math.sin(x / 37 + seed) * 5 * rough + (r() - 0.5) * 7 * rough;
    pts.push([x, y]);
  }
  return `${smoothPath(pts)}L390 660L-30 660Z`;
}

/** The ridge's top line only (for a brushed edge drawn over the wash). */
function ridgeLine(base: number, amp: number, seed: number, peaks: number[], rough = 1): string {
  const d = ridge(base, amp, seed, peaks, rough);
  return d.slice(0, d.indexOf('L390 660'));
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

/** The road's centre line from the viewer (t = 0) to the horizon (t = 1). */
const ROAD: Pt[] = [
  [52, 700],
  [92, 610],
  [168, 552],
  [136, 486],
  [196, 440],
  [238, 402],
  [222, 366],
  [246, 336],
  [258, 312],
];

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

const ROAD_LINE = catmull(ROAD);

/** Width of the road at a point along it: wide at the viewer, a thread at the horizon. */
const roadWidth = (t: number) => 2 + 78 * (1 - t) ** 1.9;

/** Offset a sampled centre line to both sides by the road width. */
function roadEdges(): { left: Pt[]; right: Pt[] } {
  const n = ROAD_LINE.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = ROAD_LINE[Math.max(0, i - 1)];
    const b = ROAD_LINE[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = roadWidth(i / (n - 1)) / 2;
    left.push([ROAD_LINE[i][0] + nx * w, ROAD_LINE[i][1] + ny * w]);
    right.push([ROAD_LINE[i][0] - nx * w, ROAD_LINE[i][1] - ny * w]);
  }
  return { left, right };
}

const poly = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('');

/** Point at fraction t along the sampled road. */
const along = (t: number): Pt => ROAD_LINE[Math.round(t * (ROAD_LINE.length - 1))];

/**
 * The scene as one <svg>. `uid` keeps gradient and mask ids unique on the page.
 * The road's start (t = 0) sits under the last passport stamp, bottom left.
 */
export function roadSceneSvg(uid = 'rv'): string {
  const r = rng(7);
  const { left, right } = roadEdges();
  const ribbon = `${poly(left)}${poly(right.slice().reverse()).replace('M', 'L')}Z`;
  const centre = smoothPath(ROAD_LINE.filter((_, i) => i % 3 === 0 || i === ROAD_LINE.length - 1));

  // Brushed edges of the road: two thin ink lines, a little broken.
  const edge = (pts: Pt[], cls: string) => `<path class="${cls}" d="${smoothPath(pts.filter((_, i) => i % 2 === 0))}"/>`;

  // Pines along the middle ridge and a pair in the foreground.
  let pines = '';
  for (const [x, y, s, lean] of [
    [34, 436, 1.25, -0.5],
    [58, 446, 0.95, 0.4],
    [292, 418, 1.1, 0.6],
    [318, 428, 1.35, -0.3],
    [342, 440, 0.9, 0.2],
    [12, 560, 2.1, 0.5],
  ] as [number, number, number, number][]) pines += pine(x, y, s, lean, Math.round(x * 7 + y));

  // Waypoints beside the road: places walked (filled) until the stamp, then new country (outlines).
  let marks = '';
  for (const [t, side, done] of [
    [0.04, 1, true],
    [0.12, -1, true],
    [0.33, 1, false],
    [0.46, -1, false],
    [0.6, 1, false],
    [0.72, -1, false],
  ] as [number, number, boolean][]) {
    const [x, y] = along(t);
    const off = (roadWidth(t) / 2 + 9 * (1 - t) + 3) * side;
    const s = 1 - t * 0.75;
    marks += `<g class="rv-mark${done ? ' is-done' : ''}" style="--rv-at:${Math.round(900 + t * 1500)}ms"><ellipse cx="${f(x + off)}" cy="${f(y)}" rx="${f(5.5 * s)}" ry="${f(3.6 * s)}"/></g>`;
  }

  // Grass strokes on the foreground slope.
  let grass = '';
  for (let k = 0; k < 26; k++) {
    const x = 160 + r() * 210;
    const y = 520 + r() * 120;
    const hgt = 6 + r() * 10;
    const lean = (r() - 0.3) * 6;
    grass += `<path d="M${f(x)} ${f(y)}q${f(lean * 0.4)} ${f(-hgt * 0.6)} ${f(lean)} ${f(-hgt)}"/>`;
  }

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
    <linearGradient id="${uid}-road" x1="0" y1="1" x2="0.3" y2="0">
      <stop offset="0" stop-color="var(--rv-road)"/>
      <stop offset="1" stop-color="var(--rv-road-far)"/>
    </linearGradient>
    <mask id="${uid}-draw" maskUnits="userSpaceOnUse" x="-40" y="-40" width="440" height="760">
      <path class="rv-draw" d="${centre}" pathLength="1"/>
    </mask>
  </defs>
  <rect class="rv-sky" x="-40" y="-40" width="440" height="760" fill="url(#${uid}-sky)"/>
  <g class="rv-sunwrap"><circle class="rv-glow" cx="262" cy="292" r="120" fill="url(#${uid}-sun)"/><circle class="rv-sun" cx="262" cy="276" r="21"/></g>
  <g class="rv-cranes">${crane(118, 186, 0.9, 0)}${crane(146, 204, 0.7, 180)}${crane(96, 210, 0.6, 320)}</g>
  <path class="rv-layer rv-layer--1" d="${ridge(318, 62, 11, [70, 196, 330], 0.6)}"/>
  <path class="rv-layer rv-layer--2" d="${ridge(352, 74, 23, [20, 150, 300], 0.8)}"/>
  <rect class="rv-mist rv-mist--1" x="-40" y="286" width="440" height="130" fill="url(#${uid}-mist)"/>
  <path class="rv-layer rv-layer--3" d="${ridge(420, 52, 37, [-10, 120, 360], 1)}"/>
  <path class="rv-ink rv-ink--3" d="${ridgeLine(420, 52, 37, [-10, 120, 360], 1)}"/>
  ${pines}
  <rect class="rv-mist rv-mist--2" x="-40" y="398" width="440" height="110" fill="url(#${uid}-mist)"/>
  <path class="rv-layer rv-layer--4" d="${ridge(502, 30, 51, [300, 380], 1.1)}"/>
  <path class="rv-ink rv-ink--4" d="${ridgeLine(502, 30, 51, [300, 380], 1.1)}"/>
  <g class="rv-grass">${grass}</g>
  <g class="rv-road" mask="url(#${uid}-draw)">
    <path class="rv-road__ribbon" d="${ribbon}" fill="url(#${uid}-road)"/>
    ${edge(left, 'rv-road__edge')}${edge(right, 'rv-road__edge rv-road__edge--far')}
  </g>
  <g class="rv-marks">${marks}</g>
</svg>`;
}
