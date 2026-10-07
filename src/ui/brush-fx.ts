/**
 * Market cosmetics in motion: the brush that draws the path between a matched
 * pair, and the burst when a pair clears. Shared by the game screen (for every
 * non-default style; the default ink and blossom stay in game.ts untouched) and
 * the Market's mini demos (all styles, including the defaults).
 *
 * Performance budget (mid-range Android): transform / opacity animations only,
 * no SVG filters, at most ~30 nodes per stroke and ~10 per burst, all removed
 * when their animation ends. Reduced motion: strokes show still and briefly;
 * bursts are skipped (or drawn still for static previews).
 */
import { h } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
export interface Pt {
  x: number;
  y: number;
}

/** Ink-path timing (ms), matching the game's default brush. */
const DRAW = 210;
const LIFE = 900;

const f = (v: number) => v.toFixed(1);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mk = (tag: string, attrs: Record<string, string | number>, cls?: string) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute('class', cls);
  return e;
};

export interface StrokeOpts {
  /** card width in px (scales everything) */
  cw: number;
  /** unique id prefix for masks / gradients */
  uid: string;
  /** size of the layer, for the reveal mask */
  width: number;
  height: number;
  /** draw the finished stroke with no motion */
  still?: boolean;
  /** leave it on screen (static previews) */
  keep?: boolean;
}

interface Geo {
  P: Pt[];
  n: number;
  dirs: Pt[];
  lens: number[];
  at: number[];
  L: number;
  w: number;
}

function geometry(P: Pt[], cw: number): Geo | null {
  const n = P.length;
  if (n < 2) return null;
  const dirs: Pt[] = [];
  const lens: number[] = [];
  let L = 0;
  for (let i = 1; i < n; i++) {
    const dx = P[i].x - P[i - 1].x;
    const dy = P[i].y - P[i - 1].y;
    const d = Math.hypot(dx, dy) || 1;
    dirs.push({ x: dx / d, y: dy / d });
    lens.push(d);
    L += d;
  }
  if (L < 2) return null;
  const at = [0];
  for (let i = 0; i < lens.length; i++) at.push(at[i] + lens[i]);
  return { P, n, dirs, lens, at, L, w: Math.max(3.8, cw * 0.1) };
}

/** Point and direction at distance s along the path. */
function pointAt(g: Geo, s: number): { p: Pt; d: Pt } {
  let i = 0;
  while (i < g.lens.length - 1 && g.at[i + 1] < s) i++;
  const t = Math.min(1, Math.max(0, (s - g.at[i]) / g.lens[i]));
  return { p: { x: g.P[i].x + (g.P[i + 1].x - g.P[i].x) * t, y: g.P[i].y + (g.P[i + 1].y - g.P[i].y) * t }, d: g.dirs[i] };
}

/**
 * Draw a brush stroke along the path corners into an SVG layer.
 * brush: 'ink' | 'vermilion' | 'indigo' | 'petals' | 'firefly' | 'gold'
 */
export function brushStroke(layer: SVGElement, P: Pt[], brush: string, o: StrokeOpts): void {
  const g = geometry(P, o.cw);
  if (!g) return;
  let life = LIFE;
  let node: SVGElement;
  if (brush === 'firefly') node = fireflyStroke(g, o);
  else if (brush === 'gold') {
    node = goldStroke(g);
    life = 1050;
  } else {
    node = inkStroke(g, o);
    if (brush !== 'ink') node.classList.add(`stroke--${brush}`);
    if (brush === 'petals') node.append(petalTrail(g, o));
  }
  if (o.still) node.classList.add('is-still');
  layer.append(node);
  if (!o.keep) setTimeout(() => node.remove(), o.still ? 520 : life);
}

/** The game's ink stroke (same geometry as game.ts drawPath), so recoloured brushes match it exactly. */
function inkStroke(g: Geo, o: StrokeOpts): SVGElement {
  const { P, n, dirs, lens, at, L, w } = g;
  const cw = o.cw;
  const seed = Math.random() * 6.28;
  const nrm = (d: Pt) => ({ x: -d.y, y: d.x });
  const miter = (i: number) => {
    if (i === 0) return nrm(dirs[0]);
    if (i === n - 1) return nrm(dirs[n - 2]);
    const a = nrm(dirs[i - 1]);
    const b = nrm(dirs[i]);
    const k = 1 + a.x * b.x + a.y * b.y;
    return k < 0.2 ? b : { x: (a.x + b.x) / k, y: (a.y + b.y) / k };
  };
  const cornerBump = (s: number) => {
    let b = 0;
    for (let i = 1; i < n - 1; i++) b = Math.max(b, 1 - Math.abs(s - at[i]) / (cw * 0.35));
    return 0.16 * b;
  };
  const widthAt = (s: number) => {
    const t = s / L;
    const press = 0.62 + 0.38 * smooth(0, 0.07, t);
    const lift = 1 - 0.84 * smooth(0.66, 1, t) ** 1.25;
    const wobble = 1 + 0.07 * Math.sin(s / (cw * 0.55) + seed) + 0.04 * Math.sin(s / (cw * 0.21) + seed * 2);
    return w * press * lift * wobble * (1 + cornerBump(s));
  };
  type S = { x: number; y: number; mx: number; my: number; w: number };
  const samples: S[] = [];
  for (let i = 0; i < n - 1; i++) {
    const steps = Math.max(2, Math.ceil(lens[i] / 5));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const m = k === 0 ? miter(i) : nrm(dirs[i]);
      const s = at[i] + lens[i] * t;
      samples.push({ x: P[i].x + (P[i + 1].x - P[i].x) * t, y: P[i].y + (P[i + 1].y - P[i].y) * t, mx: m.x, my: m.y, w: widthAt(s) });
    }
  }
  const mEnd = miter(n - 1);
  samples.push({ x: P[n - 1].x, y: P[n - 1].y, mx: mEnd.x, my: mEnd.y, w: widthAt(L) });
  const side = (sg: number) => samples.map((p) => `${f(p.x + (p.mx * p.w * sg) / 2)},${f(p.y + (p.my * p.w * sg) / 2)}`);
  const left = side(1);
  const right = side(-1);
  const d0 = dirs[0];
  const dn = dirs[n - 2];
  const s0 = samples[0];
  const sn = samples[samples.length - 1];
  const body =
    `M${right[0]} Q${f(s0.x - d0.x * s0.w * 0.95)},${f(s0.y - d0.y * s0.w * 0.95)} ${left[0]} L${left.slice(1).join(' L')} ` +
    `Q${f(sn.x + dn.x * sn.w * 1.6)},${f(sn.y + dn.y * sn.w * 1.6)} ${right[right.length - 1]} L${right.slice(0, -1).reverse().join(' L')} Z`;
  const centre = P.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
  const offsetLine = (k: number) =>
    P.map((p, i) => {
      const m = miter(i);
      return `${f(p.x + m.x * w * k)},${f(p.y + m.y * w * k)}`;
    }).join(' ');

  const sid = `${o.uid}-m`;
  const root = mk('g', {}, 'stroke');
  root.style.setProperty('--len', f(L + w * 3));
  root.style.setProperty('--draw', `${DRAW}ms`);
  const mask = mk('mask', { id: sid, maskUnits: 'userSpaceOnUse', x: -40, y: -40, width: o.width + 80, height: o.height + 80 });
  mask.append(mk('polyline', { points: centre, 'stroke-width': f(w * 3.2), 'stroke-dasharray': `${f(L + w * 3)} ${f(L + w * 6)}` }, 'ink-reveal'));
  root.append(mask);
  for (const [k, cls] of [[3.8, 'ink-wash ink-wash--soft'], [2.2, 'ink-wash']] as const) {
    root.append(mk('polyline', { points: centre, 'stroke-width': f(w * k), 'stroke-dasharray': `${f(L + w * 3)} ${f(L + w * 6)}` }, cls));
  }
  [P[0], P[n - 1]].forEach((p, k) => {
    const soak = mk('circle', { cx: f(p.x), cy: f(p.y), r: f(w * 1.7) }, 'ink-soak');
    if (k) soak.style.animationDelay = `${Math.round(DRAW * 0.85)}ms`;
    root.append(soak);
  });
  const inked = mk('g', { mask: `url(#${sid})` }, 'ink-core');
  inked.append(mk('path', { d: body }, 'ink-body'));
  const dry = (from: number) => {
    const parts = [0, L * from];
    for (let s = L * from; s < L; ) {
      const d = w * (0.8 + Math.random() * 2.2);
      const gap = w * (1.2 + Math.random() * 3);
      parts.push(d, gap);
      s += d + gap;
    }
    parts.push(0, L);
    return parts.map(f).join(' ');
  };
  inked.append(mk('polyline', { points: offsetLine(0.16), 'stroke-width': f(Math.max(0.7, w * 0.09)), 'stroke-dasharray': dry(0.5 + Math.random() * 0.1) }, 'ink-dry'));
  inked.append(mk('polyline', { points: offsetLine(-0.14), 'stroke-width': f(Math.max(0.6, w * 0.07)), 'stroke-dasharray': dry(0.66 + Math.random() * 0.1) }, 'ink-dry'));
  root.append(inked);
  const dots = mk('g', {}, 'ink-dots');
  for (let i = 1; i < n - 1; i++) {
    const a = dirs[i - 1];
    const b = dirs[i];
    const ox = a.x - b.x;
    const oy = a.y - b.y;
    const ol = Math.hypot(ox, oy) || 1;
    const delay = (DRAW * at[i]) / L;
    const count = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < count; k++) {
      const dist = w * (0.95 + k * 0.55 + Math.random() * 0.4);
      const jit = (Math.random() - 0.5) * w * 0.9;
      const dot = mk(
        'circle',
        { cx: f(P[i].x + (ox / ol) * dist + (-oy / ol) * jit), cy: f(P[i].y + (oy / ol) * dist + (ox / ol) * jit), r: f(w * (0.3 - k * 0.07) * (0.8 + Math.random() * 0.4)) },
        'ink-dot',
      );
      dot.style.animationDelay = `${Math.round(delay)}ms`;
      dots.append(dot);
    }
  }
  const flick = mk('circle', { cx: f(P[n - 1].x + dn.x * w * 2.1), cy: f(P[n - 1].y + dn.y * w * 2.1), r: f(w * 0.16) }, 'ink-dot');
  flick.style.animationDelay = `${DRAW}ms`;
  dots.append(flick);
  root.append(dots);
  return root;
}

const PETAL_D = 'M0,-5 C3.2,-3.6 3.4,1.8 0,5 C-3.4,1.8 -3.2,-3.6 0,-5 Z';

/** Tiny petals left behind along the stroke, popping in as the brush passes. */
function petalTrail(g: Geo, o: StrokeOpts): SVGElement {
  const wrap = mk('g', {}, 'bx-trail');
  const count = Math.max(3, Math.min(9, Math.round(g.L / (o.cw * 0.62))));
  const size = Math.max(0.75, g.w / 5.2);
  for (let k = 0; k < count; k++) {
    const s = g.L * ((k + 0.5) / count);
    const { p, d } = pointAt(g, s);
    const side = k % 2 ? 1 : -1;
    const off = g.w * (1.05 + Math.random() * 0.5) * side;
    const x = p.x - d.y * off;
    const y = p.y + d.x * off;
    const at = mk('g', { transform: `translate(${f(x)},${f(y)}) rotate(${Math.round(Math.random() * 360)}) scale(${f(size)})` });
    const petal = mk('path', { d: PETAL_D }, `bx-petal bx-petal--${k % 3}`);
    petal.style.animationDelay = `${Math.round((DRAW * s) / g.L)}ms`;
    petal.style.setProperty('--dx', `${f(-d.y * side * 3 + 1)}px`);
    petal.style.setProperty('--dy', `${f(d.x * side * 3 + 4)}px`);
    at.append(petal);
    wrap.append(at);
  }
  return wrap;
}

/** A dotted line of soft lights that come on one after another, then blink out. */
function fireflyStroke(g: Geo, o: StrokeOpts): SVGElement {
  const root = mk('g', {}, 'stroke bx-firefly');
  const grad = mk('radialGradient', { id: `${o.uid}-ff` });
  for (const [off, cls] of [[0, 'bx-ff-0'], [0.32, 'bx-ff-1'], [1, 'bx-ff-2']] as const) grad.append(mk('stop', { offset: off }, cls));
  root.append(grad);
  const gap = Math.max(g.w * 2.3, g.L / 26);
  const count = Math.max(2, Math.floor(g.L / gap));
  for (let k = 0; k <= count; k++) {
    const s = (g.L * k) / count;
    const { p } = pointAt(g, s);
    const big = k % 3 === 0;
    const dot = mk('circle', { cx: f(p.x), cy: f(p.y), r: f(g.w * (big ? 1.35 : 1.0)), fill: `url(#${o.uid}-ff)` }, 'bx-ff');
    dot.style.animationDelay = `${Math.round((DRAW * 1.4 * s) / g.L)}ms`;
    root.append(dot);
  }
  return root;
}

/** A fine gold thread with a glint running along it and a spark at each turn. */
function goldStroke(g: Geo): SVGElement {
  const root = mk('g', {}, 'stroke bx-gold');
  const pts = g.P.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
  const len = g.L + 4;
  root.style.setProperty('--len', f(len));
  root.append(mk('polyline', { points: pts, 'stroke-width': f(Math.max(2.2, g.w * 0.5)), 'stroke-dasharray': `${f(len)} ${f(len)}` }, 'bx-gold-glow'));
  root.append(mk('polyline', { points: pts, 'stroke-width': f(Math.max(1.3, g.w * 0.26)), 'stroke-dasharray': `${f(len)} ${f(len)}` }, 'bx-gold-line'));
  const glint = mk('polyline', { points: pts, 'stroke-width': f(Math.max(1, g.w * 0.2)), 'stroke-dasharray': `${f(g.w * 3)} ${f(len * 2)}` }, 'bx-gold-glint');
  glint.style.setProperty('--glint', f(g.w * 3));
  root.append(glint);
  const sparks = [g.P[0], ...g.P.slice(1, -1), g.P[g.n - 1]];
  sparks.forEach((p, i) => {
    const s = Math.max(3, g.w * 0.95);
    const at = mk('g', { transform: `translate(${f(p.x)},${f(p.y)})` });
    const star = mk('path', { d: `M0,${f(-s)} L${f(s * 0.22)},${f(-s * 0.22)} L${f(s)},0 L${f(s * 0.22)},${f(s * 0.22)} L0,${f(s)} L${f(-s * 0.22)},${f(s * 0.22)} L${f(-s)},0 L${f(-s * 0.22)},${f(-s * 0.22)} Z` }, 'bx-gold-spark');
    star.style.animationDelay = `${Math.round((DRAW * 1.3 * (i === 0 ? 0 : g.at[Math.min(i, g.n - 1)])) / g.L)}ms`;
    at.append(star);
    root.append(at);
  });
  return root;
}

// ── Bursts ──────────────────────────────────────────────────────────

const CRANE =
  '<svg viewBox="0 0 32 24" aria-hidden="true"><path class="c-wing" d="M15 13 L3 2 L13 10 Z"/><path class="c-wing c-wing--far" d="M17 12 L27 1 L19 10.5 Z"/><path d="M6 15 L15 11 L25 12 L30 6 L28.5 12.5 L22 16 L13 16.5 Z"/><path d="M6 15 L1 13 L5.5 16.5 Z"/></svg>';
const MAPLE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l1.6 4.3 2.6-1.4-.7 4.6 3.9-2.3-.8 3 3.4.7-3.6 3.4 1.2 1.6-5.4-.5.2 3.6h-1.8l-.6-3.6-5.4.5 1.2-1.6-3.6-3.4 3.4-.7-.8-3 3.9 2.3-.7-4.6 2.6 1.4z"/><path d="M12 14.5v8" fill="none" stroke-width="1.1"/></svg>';
const FLAKE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="1.5" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M12 5.5l-2-2M12 5.5l2-2M12 18.5l-2 2M12 18.5l2 2M5.9 8.6l-2.7.7M5.9 8.6l-.7-2.7M18.1 15.4l2.7-.7M18.1 15.4l.7 2.7M5.9 15.4l-.7 2.7M5.9 15.4l-2.7-.7M18.1 8.6l.7-2.7M18.1 8.6l2.7.7"/></g></svg>';

export interface BurstOpts {
  cw: number;
  /** draw the particles part-way through their flight, with no motion (tile previews) */
  still?: boolean;
  /** fixed seed for the particle layout (still previews), instead of Math.random */
  seed?: number;
}

/**
 * A burst of particles from (x, y) inside `host` (which must be positioned).
 * fx: 'blossom' | 'ink' | 'cranes' | 'maple' | 'snow' | 'fireflies' | 'gold'
 * Returns the created nodes (they remove themselves unless `still`).
 */
export function burstFx(host: HTMLElement, x: number, y: number, fx: string, o: BurstOpts): HTMLElement[] {
  const cw = o.cw;
  const out: HTMLElement[] = [];
  const add = (cls: string, size: number, vars: Record<string, string>, html = '', delay = 0) => {
    const p = h('i', { class: `fxb ${cls}${o.still ? ' fxb--still' : ''}`, 'aria-hidden': 'true', html });
    p.style.left = `${f(x - size / 2)}px`;
    p.style.top = `${f(y - size / 2)}px`;
    p.style.width = `${f(size)}px`;
    p.style.height = `${f(size)}px`;
    for (const [k, v] of Object.entries(vars)) p.style.setProperty(k, v);
    if (delay) p.style.animationDelay = `${delay}ms`;
    host.append(p);
    out.push(p);
  };
  let sd = (o.seed ?? 0) >>> 0;
  const rand =
    o.seed == null
      ? Math.random
      : () => {
          sd = (sd * 1664525 + 1013904223) >>> 0;
          return sd / 4294967296;
        };
  const rnd = (a: number, b: number) => a + rand() * (b - a);
  const px = (v: number) => `${f(v)}px`;
  let life = 800;

  if (fx === 'blossom') {
    // The game's default burst (same numbers as game.ts petals()).
    const colors = ['#e3a5b0', '#d98a98', '#c4472f', '#e6c27a', '#f2d4da'];
    for (let k = 0; k < 7; k++) {
      const ink = k >= 5;
      const a = (k / 7) * Math.PI * 2 + rand() * 0.8;
      const d = cw * (ink ? 0.35 + rand() * 0.3 : 0.55 + rand() * 0.55);
      add(ink ? 'fxb--bink' : 'fxb--petal', ink ? 5 : 10, { '--dx': px(Math.cos(a) * d), '--dy': px(Math.sin(a) * d - cw * 0.1), '--rot': `${Math.round((rand() - 0.5) * 540)}deg`, ...(ink ? {} : { background: colors[k % colors.length] }) });
    }
  } else if (fx === 'ink') {
    add('fxb--blot', cw * 0.62, { '--rot': `${Math.round(rnd(0, 360))}deg` });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rnd(-0.4, 0.4);
      const d = cw * rnd(0.45, 0.85);
      add('fxb--drop', rnd(3, 6.5), { '--dx': px(Math.cos(a) * d), '--dy': px(Math.sin(a) * d) }, '', 40);
    }
  } else if (fx === 'cranes') {
    life = 1150;
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k - 1) * 0.85 + rnd(-0.15, 0.15);
      const d = cw * rnd(0.8, 1.15);
      add(`fxb--crane fxb--c${k}`, cw * 0.5, { '--dx': px(Math.cos(a) * d), '--dy': px(Math.sin(a) * d), '--rot': `${Math.round((k - 1) * 14)}deg`, '--flip': k === 0 ? '-1' : '1' }, CRANE, k * 60);
    }
  } else if (fx === 'maple') {
    life = 1050;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + rnd(-0.4, 0.4);
      const d = cw * rnd(0.45, 0.8);
      add(`fxb--maple fxb--m${k % 4}`, cw * rnd(0.26, 0.34), { '--dx': px(Math.cos(a) * d), '--dy': px(Math.sin(a) * d - cw * 0.25), '--fall': px(cw * rnd(0.45, 0.7)), '--rot': `${Math.round(rnd(200, 420) * (k % 2 ? 1 : -1))}deg` }, MAPLE);
    }
  } else if (fx === 'snow') {
    life = 1150;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rnd(-0.3, 0.3);
      const d = cw * rnd(0.4, 0.75);
      add('fxb--flake', cw * rnd(0.2, 0.3), { '--dx': px(Math.cos(a) * d), '--dy': px(Math.sin(a) * d * 0.7 + cw * 0.18), '--rot': `${Math.round(rnd(60, 150) * (k % 2 ? 1 : -1))}deg` }, FLAKE, k * 25);
    }
  } else if (fx === 'fireflies') {
    life = 1300;
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + rnd(-1.4, 1.4);
      const d = cw * rnd(0.5, 0.95);
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;
      add('fxb--fly', cw * 0.3, { '--dx1': px(dx * 0.45 + rnd(-8, 8)), '--dy1': px(dy * 0.4), '--dx': px(dx), '--dy': px(dy) }, '', k * 70);
    }
  } else if (fx === 'gold') {
    add('fxb--puff', cw * 1.1, {});
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + rnd(-0.3, 0.3);
      const d = cw * rnd(0.35, 0.85);
      add(`fxb--spark${k % 3 === 0 ? ' fxb--spark-big' : ''}`, k % 3 === 0 ? 10 : 6, { '--dx': px(Math.cos(a) * d), '--dy': px(Math.sin(a) * d - cw * 0.08), '--rot': `${Math.round(rnd(-90, 90))}deg` }, '', Math.round(rnd(0, 90)));
    }
  }
  if (!o.still) setTimeout(() => out.forEach((p) => p.remove()), life + 160);
  return out;
}
