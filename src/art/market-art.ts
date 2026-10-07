/**
 * Illustrations for the Market (장터 · 市) and the Flower Path: crafted objects
 * drawn in code, in one light (from the upper left), one ink line and one
 * palette of lacquer, brass, celadon, paulownia wood and silk.
 *
 * Every picture is a <symbol> in one hidden sprite that is built lazily, a
 * symbol the first time it's asked for. A thumbnail is then just
 * `<svg><use href="#mka-…"/></svg>`: two DOM nodes, however detailed the art,
 * and the tile and its detail sheet share one copy. (Same trick as the card
 * sprite and the Market's deck previews.)
 *
 * House rules (from the owner): no stipple, speckle or dotted textures and no
 * dashed outlines. Texture comes from tapered strokes, dry-brush streaks, soft
 * washes and gradients; the few particles (petals, glints) are drawn as real
 * shapes.
 *
 * Theme: the objects keep their own colours in both themes (like the cards
 * and the garden). The few things that must follow the theme read CSS custom
 * properties, which inherit into <use> instances: --mka-shadow, --mka-steam,
 * --mka-wash and, per item, --mka-ink (a brush's ink).
 */
import { rng } from './specials';

const NS = 'http://www.w3.org/2000/svg';
export const f = (n: number) => String(Math.round(n * 10) / 10);
export const LINE = '#3b2c20';
const S = (d: string, stroke: string, w: number, more = '') =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${more}/>`;
const P = (d: string, fill: string, more = '') => `<path d="${d}" fill="${fill}"${more}/>`;
/** A soft floor shadow (a radial wash that follows the theme). */
const shadow = (cx: number, cy: number, rx: number, ry: number, o = 1) =>
  `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx * 1.15)}" ry="${f(ry * 1.5)}" fill="url(#mka-floor)"${o !== 1 ? ` opacity="${o}"` : ''}/>`;
const rot = (x: number, y: number, cx: number, cy: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};

/** A tapered brush stroke along a polyline: wide at `w0`, thin at `w1`. */
export function taperStroke(pts: [number, number][], w0: number, w1: number): string {
  const n = pts.length;
  const L: string[] = [];
  const R: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    const t = i / (n - 1);
    const w = (w0 + (w1 - w0) * t) / 2;
    L.push(`${f(pts[i][0] - (dy / d) * w)} ${f(pts[i][1] + (dx / d) * w)}`);
    R.push(`${f(pts[i][0] + (dy / d) * w)} ${f(pts[i][1] - (dx / d) * w)}`);
  }
  return `M${L.join(' L')} L${R.reverse().join(' L')}Z`;
}

/** Points along a quadratic Bézier. */
const quad = (p0: [number, number], p1: [number, number], p2: [number, number], n = 8): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  });

/** A four-pointed glint (a real shape, used sparingly). */
export const glint = (x: number, y: number, r: number, o = 1) =>
  P(
    `M${f(x)} ${f(y - r)}Q${f(x + r * 0.16)} ${f(y - r * 0.16)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.16)} ${f(y + r * 0.16)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.16)} ${f(y + r * 0.16)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.16)} ${f(y - r * 0.16)} ${f(x)} ${f(y - r)}Z`,
    '#fff4cf',
    ` stroke="#c99a48" stroke-width=".35"${o !== 1 ? ` opacity="${o}"` : ''}`,
  );

/** A notched cherry/plum petal (local size ~1 = 10 units long). */
export const petalShape = (x: number, y: number, s: number, deg: number, fill = '#eba9b6', vein = '#c9687c') =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)}) scale(${f(s)})"><path d="M0 5C-3.6 3.2-4 -1.6-1.6-4.4L0-3.2 1.6-4.4C4-1.6 3.6 3.2 0 5Z" fill="${fill}"/><path d="M0 4.2C-.4 1.4-.3-1 0-3" fill="none" stroke="${vein}" stroke-width=".45" stroke-linecap="round" opacity=".55"/></g>`;

/** Five round petals around a centre, with a few drawn stamens. */
export function blossom(cx: number, cy: number, r: number, fill: string, center: string, deg = 0): string {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = ((deg + i * 72 - 90) * Math.PI) / 180;
    s += `<circle cx="${f(cx + Math.cos(a) * r * 0.56)}" cy="${f(cy + Math.sin(a) * r * 0.56)}" r="${f(r * 0.5)}" fill="${fill}"/>`;
  }
  let st = '';
  for (let i = 0; i < 5; i++) {
    const a = ((deg + i * 72 - 54) * Math.PI) / 180;
    st += `M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a) * r * 0.42)} ${f(cy + Math.sin(a) * r * 0.42)}`;
  }
  return s + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.2)}" fill="${center}"/>` + S(st, center, Math.max(0.25, r * 0.07), ' opacity=".8"');
}

/** A seven-pointed maple leaf (about 12 units across at s = 1). */
export const maple = (x: number, y: number, s: number, deg: number, fill: string, vein = '#7d2414') =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)}) scale(${f(s)})"><path d="M0-6 1.2-2.6 3.6-4.2 3-1 6-1.4 3.8 1 5 2.6 1 2.2.6 5H-.6L-1 2.2-5 2.6-3.8 1-6-1.4-3-1-3.6-4.2-1.2-2.6Z" fill="${fill}"/><path d="M0 4.6V-4.6M0 1.6 4-.8M0 1.6-4-.8" fill="none" stroke="${vein}" stroke-width=".35" opacity=".55"/></g>`;

// ── Shared gradients ────────────────────────────────────────────────

const lin = (id: string, stops: [number, string, number?][], x2 = 0, y2 = 1, x1 = 0, y1 = 0) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rad = (id: string, stops: [number, string, number?][], cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;

const DEFS =
  `<radialGradient id="mka-floor"><stop offset="0" style="stop-color:var(--mka-shadow-c,#4a3018);stop-opacity:var(--mka-shadow-a,.3)"/><stop offset=".55" style="stop-color:var(--mka-shadow-c,#4a3018);stop-opacity:calc(var(--mka-shadow-a,.3) * .7)"/><stop offset="1" style="stop-color:var(--mka-shadow-c,#4a3018)" stop-opacity="0"/></radialGradient>` +
  rad('mka-shine', [[0, '#fff', 0.5], [1, '#fff', 0]]) +
  rad('mka-pool', [[0, '#3f6a55', 0.16], [1, '#3f6a55', 0]]) +
  rad('mka-glow', [[0, '#fff1c8', 0.95], [0.32, '#f9d27e', 0.5], [1, '#f6c46a', 0]]) +
  rad('mka-lantern', [[0, '#ffe7b0'], [0.36, '#f4a062'], [0.78, '#cf4f33'], [1, '#a2341d']], 0.44, 0.42, 0.62) +
  lin('mka-beam', [[0, '#ffe6a8', 0.42], [1, '#ffe6a8', 0]], 1, 1) +
  lin('mka-brass', [[0, '#f6e4aa'], [0.45, '#cfa252'], [1, '#8a5f24']], 1, 1) +
  lin('mka-brass-v', [[0, '#f3dc9a'], [0.5, '#c99a48'], [1, '#86602a']]) +
  lin('mka-indigo', [[0, '#4a6b9e'], [1, '#22385a']]) +
  lin('mka-wood', [[0, '#c48d58'], [1, '#8a5a33']]) +
  lin('mka-wood-pale', [[0, '#e8c896'], [0.6, '#cfa36c'], [1, '#b0804c']]) +
  lin('mka-wood-dark', [[0, '#7e4f2e'], [1, '#4a2b18']]) +
  lin('mka-clay', [[0, '#c98257'], [0.55, '#9a5634'], [1, '#6a3720']], 1, 1) +
  lin('mka-celadon', [[0, '#e6f1e3'], [0.5, '#afcdb6'], [1, '#76998a']], 1, 1) +
  rad('mka-tea', [[0, '#dcc777'], [1, '#93802f']], 0.4, 0.4, 0.7) +
  lin('mka-lac-red', [[0, '#cc5a3e'], [1, '#7a2617']]) +
  lin('mka-lac-black', [[0, '#51453e'], [0.55, '#2c2420'], [1, '#191412']]) +
  rad('mka-moon', [[0, '#fffbea'], [0.7, '#f4e6bf'], [1, '#e0cc98']], 0.4, 0.36, 0.7) +
  rad('mka-night', [[0, '#4d5e8c'], [0.6, '#2d3a62'], [1, '#1b2340']], 0.62, 0.32, 0.8) +
  rad('mka-rainsky', [[0, '#e7ecee'], [1, '#a3b3be']], 0.5, 0.25, 0.85) +
  lin('mka-bamboo', [[0, '#f2dfa6'], [0.38, '#d6b26a'], [1, '#8a662c']]) +
  lin('mka-bronze', [[0, '#6e5030'], [0.38, '#c99e60'], [1, '#4f3a22']], 1, 0) +
  lin('mka-slate', [[0, '#5b5751'], [1, '#272522']]) +
  lin('mka-silk', [[0, '#dd5a3e'], [1, '#a5341f']]) +
  lin('mka-paper', [[0, '#fbf6ea'], [1, '#e8dcc3']]) +
  lin('mka-sheen', [[0, '#fff', 0.55], [0.5, '#fff', 0]], 1, 1) +
  `<linearGradient id="mka-steam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--mka-steam,#8a7f72)" stop-opacity=".75"/><stop offset="1" style="stop-color:var(--mka-steam,#8a7f72)" stop-opacity="0"/></linearGradient>`;

// ── Sprite ──────────────────────────────────────────────────────────

interface Art {
  vb: string;
  body: () => string;
}
const ARTS = new Map<string, Art>();
const built = new Set<string>();
let spriteEl: Element | null = null;

/** Register a symbol (`mka-${id}`); its markup is built on first use. */
export function defineArt(id: string, vb: string, body: () => string): void {
  ARTS.set(id, { vb, body });
}

function sprite(): Element | null {
  if (typeof document === 'undefined') return null;
  if (spriteEl?.isConnected) return spriteEl;
  built.clear();
  document.getElementById('mka-sprite')?.remove();
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'mka-sprite';
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `<defs>${DEFS}</defs>`;
  document.body.prepend(svg);
  spriteEl = svg;
  return svg;
}

/**
 * Markup for one illustration: `<svg class=cls viewBox><use/></svg>` in the
 * app, standalone markup (with the shared gradients) without a document.
 */
export function art(id: string, cls = 'mk-ill', attrs = ''): string {
  const a = ARTS.get(id);
  if (!a) return '';
  const s = sprite();
  if (!s) return `<svg class="${cls}" viewBox="${a.vb}" aria-hidden="true"${attrs}><defs>${DEFS}</defs>${a.body()}</svg>`;
  if (!built.has(id)) {
    s.insertAdjacentHTML('beforeend', `<symbol id="mka-${id}" viewBox="${a.vb}">${a.body()}</symbol>`);
    built.add(id);
  }
  return `<svg class="${cls}" viewBox="${a.vb}" aria-hidden="true"${attrs}><use href="#mka-${id}"/></svg>`;
}

/** Standalone markup (gradients inlined): for CSS data URIs and tests. */
export function artStandalone(id: string): string {
  const a = ARTS.get(id);
  return a ? `<svg xmlns="${NS}" viewBox="${a.vb}"><defs>${DEFS}</defs>${a.body()}</svg>` : '';
}

/** A card from the card sprite, centred at (x, y), w wide, turned by deg. */
export const cardUse = (card: string | number, x: number, y: number, w: number, deg = 0) => {
  const h = w * 1.4;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})"><use href="#card-${card}" x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}"/></g>`;
};

// ── Shared objects ──────────────────────────────────────────────────

/** A silk hanging lantern (hongsa-chorong), top of the cap at (x, y), 64 tall at s = 1. */
export function lantern(x: number, y: number, s: number, glow = true): string {
  const body = 'M-11 8C-15.5 16-15.5 32-11 40H11C15.5 32 15.5 16 11 8Z';
  return (
    `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">` +
    (glow ? `<circle cx="0" cy="24" r="40" fill="url(#mka-glow)" style="opacity:var(--mka-glow-o,.9)"/>` : '') +
    `<circle cx="0" cy="1.4" r="1.8" fill="url(#mka-brass)"/>` +
    P('M-7 3H7L10.5 8H-10.5Z', 'url(#mka-brass)', ` stroke="${LINE}" stroke-width=".5"`) +
    P(body, 'url(#mka-lantern)') +
    P('M-11 8H11C12.4 10.4 13.2 12 13.8 13.6H-13.8C-13.2 12-12.4 10.4-11 8Z', 'url(#mka-indigo)') +
    P('M-13.8 34.4H13.8C13.2 36 12.4 37.6 11 40H-11C-12.4 37.6-13.2 36-13.8 34.4Z', 'url(#mka-indigo)') +
    S('M-13.8 13.6H13.8M-13.8 34.4H13.8', '#e8c77e', 0.7) +
    S('M-5.6 13.6C-6.8 20-6.8 28-5.6 34.4M0 13.6V34.4M5.6 13.6C6.8 20 6.8 28 5.6 34.4', '#9a3420', 0.55, ' opacity=".4"') +
    `<ellipse cx="-1.5" cy="22" rx="5" ry="7.5" fill="#fff5d6" opacity=".38"/>` +
    S(body, LINE, 0.7) +
    P('M-9 40H9L6 44.6H-6Z', 'url(#mka-brass)', ` stroke="${LINE}" stroke-width=".5"`) +
    S('M0 44.6V48', '#b23a26', 1.1) +
    P('M-2.4 48.2H2.4L2.2 50.4H-2.2Z', '#e3c27a') +
    P('M-2.2 50.4H2.2L3.4 62Q0 63.6-3.4 62Z', 'url(#mka-silk)') +
    S('M-1.4 52.4-2 61.4M0 52.4V62M1.4 52.4 2 61.4', '#7d2414', 0.4, ' opacity=".6"') +
    `</g>`
  );
}

/** A celadon tea bowl; rim centre (cx, y), rim half-width w. */
function teaBowl(cx: number, y: number, w: number, tea = true): string {
  const k = w / 15;
  const d = `M${f(cx - w)} ${f(y)}C${f(cx - w + 0.5 * k)} ${f(y + 12 * k)} ${f(cx - 8 * k)} ${f(y + 20 * k)} ${f(cx)} ${f(y + 20 * k)}C${f(cx + 8 * k)} ${f(y + 20 * k)} ${f(cx + w - 0.5 * k)} ${f(y + 12 * k)} ${f(cx + w)} ${f(y)}Z`;
  return (
    P(`M${f(cx - 5 * k)} ${f(y + 19.6 * k)}h${f(10 * k)}l${f(-0.7 * k)} ${f(2.6 * k)}h${f(-8.6 * k)}z`, '#86a892', ` stroke="${LINE}" stroke-width=".5"`) +
    P(d, 'url(#mka-celadon)', ` stroke="${LINE}" stroke-width=".7"`) +
    S(`M${f(cx - 10 * k)} ${f(y + 6 * k)}l${f(3 * k)} ${f(2 * k)}l${f(-1 * k)} ${f(3 * k)}M${f(cx + 4 * k)} ${f(y + 8 * k)}l${f(2.5 * k)} ${f(-1.5 * k)}l${f(1.6 * k)} ${f(2.6 * k)}M${f(cx - 4 * k)} ${f(y + 14 * k)}l${f(2 * k)} ${f(1.4 * k)}`, '#567a66', 0.4, ' opacity=".45"') +
    S(`M${f(cx - w + 3 * k)} ${f(y + 3 * k)}C${f(cx - w + 3.5 * k)} ${f(y + 8 * k)} ${f(cx - w + 6 * k)} ${f(y + 13 * k)} ${f(cx - w + 9 * k)} ${f(y + 16 * k)}`, '#fff', 1.4 * k, ' opacity=".5"') +
    `<ellipse cx="${f(cx)}" cy="${f(y)}" rx="${f(w)}" ry="${f(4 * k)}" fill="#d3e5d3" stroke="${LINE}" stroke-width=".7"/>` +
    (tea
      ? `<ellipse cx="${f(cx)}" cy="${f(y + 0.6 * k)}" rx="${f(w - 2.2 * k)}" ry="${f(3 * k)}" fill="url(#mka-tea)"/><ellipse cx="${f(cx - 4 * k)}" cy="${f(y)}" rx="${f(4 * k)}" ry="${f(0.8 * k)}" fill="#fff" opacity=".5"/>`
      : `<ellipse cx="${f(cx)}" cy="${f(y + 0.8 * k)}" rx="${f(w - 2.6 * k)}" ry="${f(2.6 * k)}" fill="#a9c4b0" opacity=".7"/>`)
  );
}

// ── Tools ───────────────────────────────────────────────────────────

defineArt('tool-hints', '0 0 140 110', () => {
  const card = (id: number, x: number, y: number, deg: number) =>
    `<g transform="translate(${x} ${y}) rotate(${deg})"><rect x="-13.4" y="-18.4" width="26.8" height="36.8" rx="2.6" fill="none" stroke="#f6c46a" stroke-width="4" opacity=".32"/><use href="#card-${id}" x="-12.5" y="-17.5" width="25" height="35"/><rect x="-11.5" y="-16.1" width="23" height="32.2" rx="1.5" fill="none" stroke="#f3d68e" stroke-width="1.1"/></g>`;
  return (
    `<ellipse cx="96" cy="90" rx="42" ry="8" fill="url(#mka-glow)" style="opacity:calc(var(--mka-glow-o,.9) * .8)"/>` +
    shadow(96, 89.5, 30, 2.8) +
    card(10, 83, 70, -9) +
    card(11, 108, 68, 8) +
    S('M42 0V6.4', '#5a4632', 0.8) +
    lantern(42, 5.5, 0.9) +
    glint(74, 44, 3.4) +
    glint(97, 37, 4.2) +
    glint(120, 47, 3)
  );
});

defineArt('tool-shuffles', '0 0 140 110', () => {
  const stack = (x: number, y: number, deg: number, dir: number) =>
    `<g transform="translate(${x} ${y}) rotate(${deg})">${[3, 2, 1, 0].map((k) => `<use href="#card-back" x="${f(-11 + dir * k * 1.5)}" y="${f(-15.4 + k * 1.1)}" width="22" height="30.8"/>`).join('')}</g>`;
  const p0: [number, number] = [36, 62];
  const p1: [number, number] = [70, 6];
  const p2: [number, number] = [104, 62];
  let fly = '';
  for (const t of [0.15, 0.33, 0.5, 0.67, 0.85]) {
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    fly += cardUse('back', x, y, 19, ((Math.atan2(dy, dx) * 180) / Math.PI) * 0.55);
  }
  return (
    shadow(70, 95, 54, 4.2) +
    P(taperStroke(quad([26, 70], [70, -6], [114, 70], 14), 10, 2), 'var(--mka-wash,rgba(60,40,20,.1))', ' style="fill:var(--mka-wash,rgba(60,40,20,.1))"') +
    P(taperStroke(quad([32, 78], [70, 16], [108, 78], 12), 1.4, 0.3), 'none', ' style="fill:var(--mka-steam,#8a7f72)" opacity=".45"') +
    stack(30, 78, -12, -1) +
    stack(110, 78, 12, 1) +
    fly
  );
});

defineArt('tool-tea', '0 0 140 110', () => {
  const steam = (d: string, w: number) => S(d, 'url(#mka-steam)', w);
  return (
    `<ellipse cx="70" cy="90.5" rx="60" ry="11" fill="url(#mka-wood-dark)"/>` +
    `<ellipse cx="70" cy="87" rx="60" ry="10.5" fill="url(#mka-wood)"/>` +
    S('M16 86Q70 78 124 86M22 90.5Q70 84.5 118 90.5M40 94Q70 90 100 94', '#6e4426', 0.45, ' opacity=".35"') +
    `<ellipse cx="70" cy="86.6" rx="56" ry="9" fill="none" stroke="#f3d1a0" stroke-width=".6" opacity=".45"/>` +
    shadow(42, 86, 20, 3.4) +
    shadow(84, 86.5, 15, 2.8) +
    shadow(113, 84.5, 10, 2.2) +
    // teapot
    P('M26 62 13 55 14.6 52.4 27.6 58.6Z', 'url(#mka-wood-dark)', ` stroke="${LINE}" stroke-width=".5"`) +
    P('M58 66C63 64 66 58 70 52L72.6 53.6C70 60 66 68 60 73Z', 'url(#mka-clay)', ` stroke="${LINE}" stroke-width=".6"`) +
    P('M24 70C22 58 30 50 42 50S62 58 60 70C58 80 50 85 42 85S26 80 24 70Z', 'url(#mka-clay)', ` stroke="${LINE}" stroke-width=".7"`) +
    S('M27 71Q42 75.5 58 71', '#5a2e1a', 0.5, ' opacity=".4"') +
    P('M31.5 51.6Q42 45 52.5 51.6Z', 'url(#mka-clay)', ` stroke="${LINE}" stroke-width=".55"`) +
    `<ellipse cx="42" cy="46.6" rx="2.6" ry="1.8" fill="url(#mka-wood-dark)"/>` +
    S('M31 52.4Q42 55 53 52.4', LINE, 0.5) +
    S('M29.6 61C30.6 56 34 53.4 38.6 52.8', '#fff', 1.5, ' opacity=".42"') +
    // cups
    teaBowl(113, 70, 10, false) +
    teaBowl(84, 64, 15) +
    steam('M80 58C76 52 84 48 80 40C77 34 82 30 80 23', 1.7) +
    steam('M86.5 58.5C83.5 50.5 90.5 46 87.5 38C85.6 33 88.4 29 86.6 22', 1.5) +
    steam('M91.5 59.5C89.5 54.5 93.5 51 91.5 46', 1.2)
  );
});

defineArt('tool-card', '0 0 140 110', () => {
  let rays = '';
  for (let i = 0; i < 9; i++) {
    const a = ((-170 + i * 20) * Math.PI) / 180;
    rays += P(taperStroke([[72 + Math.cos(a) * 20, 38 + Math.sin(a) * 20], [72 + Math.cos(a) * 36, 38 + Math.sin(a) * 36]], 2.2, 0.2), '#e9c46a', ' opacity=".4"');
  }
  const back = (deg: number) => `<g transform="translate(72 94) rotate(${deg})"><use href="#card-back" x="-14" y="-50" width="28" height="39.2"/></g>`;
  return (
    `<circle cx="72" cy="40" r="34" fill="url(#mka-glow)" style="opacity:var(--mka-glow-o,.9)"/>` +
    rays +
    shadow(72, 99, 54, 4) +
    // the album, lying shut
    P('M20 84 30 97V100L20 87Z', '#1c2f4c') +
    P('M30 97 124 91V94L30 100Z', '#efe4cc', ` stroke="${LINE}" stroke-width=".45"`) +
    S('M32 98.4 122 92.7', '#c8b896', 0.35) +
    P('M20 84 114 79 124 91 30 97Z', 'url(#mka-indigo)', ` stroke="${LINE}" stroke-width=".6"`) +
    S('M23.5 84.6 112.6 79.9', '#8fa6c8', 0.5, ' opacity=".5"') +
    P('M20 84 25 83.7 22.6 87.2Z', 'url(#mka-brass)') +
    P('M124 91 119 91.3 121.4 87.8Z', 'url(#mka-brass)') +
    P('M30 97 29.2 92.4 33.6 96.8Z', 'url(#mka-brass)') +
    P('M114 79 110.6 79.3 116.2 81.8Z', 'url(#mka-brass)') +
    back(-30) +
    back(-15) +
    back(30) +
    back(15) +
    `<g transform="translate(72 84) rotate(2)"><rect x="-15.6" y="-56.2" width="31.2" height="42.2" rx="3" fill="none" stroke="#f6c46a" stroke-width="4" opacity=".35"/><use href="#card-31" x="-15" y="-56" width="30" height="42"/><rect x="-13.8" y="-54.3" width="27.6" height="38.6" rx="1.8" fill="none" stroke="#e8c77e" stroke-width="1"/></g>` +
    glint(46, 30, 3.4) +
    glint(101, 22, 4) +
    glint(104, 50, 2.6)
  );
});

// ── Music ───────────────────────────────────────────────────────────

/** Seasons: a folding fan painted with the four seasons. */
defineArt('music-default', '0 0 140 110', () => {
  const cx = 70;
  const cy = 99;
  const pt = (r: number, deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  const sector = (r1: number, r2: number, a1: number, a2: number) => {
    const [x1, y1] = pt(r2, a1);
    const [x2, y2] = pt(r2, a2);
    const [x3, y3] = pt(r1, a2);
    const [x4, y4] = pt(r1, a1);
    return `M${f(x1)} ${f(y1)}A${r2} ${r2} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r1} ${r1} 0 0 0 ${f(x4)} ${f(y4)}Z`;
  };
  const A0 = -152;
  const A1 = -28;
  const R = 72;
  const r = 29;
  const tints = ['#f8e2e5', '#e3ede0', '#f7e1ca', '#e6edf2'];
  let leaf = '';
  for (let i = 0; i < 4; i++) leaf += P(sector(r, R, A0 + i * 31, A0 + (i + 1) * 31), tints[i]);
  // soft washes where the seasons meet
  for (let i = 1; i < 4; i++) leaf += P(sector(r, R, A0 + i * 31 - 4, A0 + i * 31 + 4), '#fff', ' opacity=".35"');
  // pleats
  let pleats = '';
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = A0 + ((A1 - A0) * i) / n;
    if (i % 2) pleats += P(sector(r, R, a, a + (A1 - A0) / n), '#6b4a2a', ' opacity=".05"');
  }
  // sticks
  let sticks = '';
  for (let i = 0; i <= n; i++) {
    const a = A0 + ((A1 - A0) * i) / n;
    const [x0, y0] = pt(6, a);
    const [x1, y1] = pt(r + 1, a);
    sticks += S(`M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`, '#c9a66a', 1.7) + S(`M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`, '#e9d39e', 0.5);
  }
  const guard = (a: number) => {
    const [x0, y0] = pt(4, a);
    const [x1, y1] = pt(R + 1, a);
    return P(taperStroke([[x0, y0], [x1, y1]], 3.4, 2.2), 'url(#mka-wood-dark)');
  };
  const clip = `<clipPath id="mka-fanclip"><path d="${sector(r, R, A0, A1)}"/></clipPath>`;
  // spring: plum branch
  const spring =
    P(taperStroke([[8, 76], [16, 68], [24, 61], [31, 55], [38, 49], [44, 44]], 3.2, 0.8), '#4a3426') +
    P(taperStroke([[24, 61], [22, 54], [24, 48]], 1.4, 0.5), '#4a3426') +
    blossom(25, 63.5, 4.2, '#f2a7b5', '#b93a55', 10) +
    blossom(34, 52.6, 3.6, '#f6bcc7', '#b93a55', 40) +
    blossom(22, 50, 2.8, '#f2a7b5', '#b93a55', 70) +
    `<ellipse cx="41.4" cy="45.6" rx="1.6" ry="1.2" fill="#e88a9c"/>`;
  // summer: irises
  const iris = (x: number, y: number, s: number) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="-2.8" rx="1.5" ry="3.2" fill="#8475c4"/><ellipse cx="-2.6" cy=".8" rx="1.5" ry="3" transform="rotate(-55 -2.6 .8)" fill="#5d4f9c"/><ellipse cx="2.6" cy=".8" rx="1.5" ry="3" transform="rotate(55 2.6 .8)" fill="#5d4f9c"/><path d="M-2.4 .6-1 1.4M2.4.6 1 1.4" stroke="#e9c45a" stroke-width=".7" stroke-linecap="round"/></g>`;
  const summer =
    P(taperStroke([[52, 72], [50, 58], [47, 44]], 2.4, 0.3), '#5f8a5a') +
    P(taperStroke([[56, 72], [57, 58], [60, 46]], 2.2, 0.3), '#4f7a4c') +
    P(taperStroke([[60, 72], [63, 62], [68, 54]], 2, 0.3), '#6d9466') +
    S('M54 72Q53 60 51 50', '#4f7a4c', 0.7) +
    iris(50.6, 46, 1.25) +
    iris(61.6, 49.4, 1.05);
  // autumn: maple
  const autumn =
    S('M74 62Q82 54 96 50', '#6e3a22', 0.8) +
    maple(80.5, 45, 1.25, -15, '#c8452c') +
    maple(93, 49.6, 1.05, 22, '#e07a2f') +
    maple(86, 58.6, 0.85, 40, '#d9a03a', '#8a5a14');
  // winter: pine under snow
  const needles = (x: number, y: number, s: number) => {
    let d = '';
    for (let k = 0; k < 9; k++) {
      const a = ((-160 + k * 20) * Math.PI) / 180;
      d += `M${f(x)} ${f(y)}l${f(Math.cos(a) * 5 * s)} ${f(Math.sin(a) * 5 * s)}`;
    }
    return S(d, '#2f5a44', 0.8) + `<path d="M${f(x - 5 * s)} ${f(y - 1.6 * s)}Q${f(x)} ${f(y - 5.4 * s)} ${f(x + 5 * s)} ${f(y - 1.6 * s)}Q${f(x)} ${f(y - 3.2 * s)} ${f(x - 5 * s)} ${f(y - 1.6 * s)}Z" fill="#fff" stroke="#b9c8d4" stroke-width=".3"/>`;
  };
  const winter =
    P(taperStroke([[130, 74], [120, 66], [110, 58], [101, 52]], 2.8, 0.8), '#4a3426') +
    needles(104, 54, 1) +
    needles(113, 61, 1.15) +
    needles(122, 68, 1);
  const [gx0, gy0] = pt(R, A0);
  const [gx1, gy1] = pt(R, A1);
  return (
    `<defs>${clip}</defs>` +
    shadow(70, 101, 58, 5) +
    sticks +
    leaf +
    pleats +
    `<g clip-path="url(#mka-fanclip)">${spring}${summer}${autumn}${winter}</g>` +
    S(`M${f(gx0)} ${f(gy0)}A${R} ${R} 0 0 1 ${f(gx1)} ${f(gy1)}`, '#8a6a44', 0.8) +
    S(sector(r, R, A0, A1), '#8a6a44', 0.5, ' opacity=".6"') +
    guard(A0) +
    guard(A1) +
    `<circle cx="70" cy="99" r="2.6" fill="url(#mka-brass)" stroke="${LINE}" stroke-width=".4"/>` +
    S('M71 101C74 104.4 79 104.6 83 102.6', '#b23a26', 1.1) +
    P('M83 102 85.6 101.6 86.2 104.2 83.6 104.6Z', '#e3c27a') +
    P('M84 104.4 86.2 104 87.8 108.6H84Z', 'url(#mka-silk)') +
    petalShape(18, 28, 0.7, -30) +
    petalShape(30, 20, 0.55, 40, '#f4bfca') +
    maple(116, 24, 0.6, 30, '#d3602e')
  );
});

/** Gayageum: the twelve-string zither, under a plum branch. */
defineArt('music-gayageum', '0 0 140 110', () => {
  const C: [number, number] = [70, 62];
  const deg = -11;
  const K = 1.5; // the body is drawn flat and stretched to its true width
  let strings = '';
  let bridges = '';
  for (let i = 0; i < 12; i++) {
    const y = 53.4 + i * 1.1;
    const x = 46 + i * 4.6;
    bridges += P(`M${f(x - 2.2)} ${f(y + 0.9)}L${f(x - 0.3)} ${f(y - 1.5)}H${f(x + 0.3)}L${f(x + 2.2)} ${f(y + 0.9)}Z`, '#f8f0de', ' stroke="#6e5034" stroke-width=".3"') + P(`M${f(x + 0.3)} ${f(y - 1.5)}L${f(x + 2.2)} ${f(y + 0.9)}H${f(x + 0.6)}Z`, '#cbb48c');
    strings += S(`M10 ${f(y)}H121`, '#f6ead0', 0.38);
  }
  // string tails hang from the head end
  let tails = '';
  for (let i = 0; i < 6; i++) {
    const [x, y] = rot(123 + i * 1.6, C[1] + (67.6 - C[1]) * K, C[0], C[1], deg);
    tails += S(`M${f(x)} ${f(y)}c${f(-1 - i * 0.2)} 4 ${f(1)} 7 ${f(-0.6)} ${f(10 + (i % 3) * 2)}`, i % 2 ? '#efe1bd' : '#e3d2a4', 0.7);
  }
  const plum =
    P(taperStroke([[0, 6], [10, 10], [19, 17], [26, 26]], 3, 0.8), '#3d2c22') +
    P(taperStroke([[10, 10], [14, 4], [21, 1]], 1.4, 0.4), '#3d2c22') +
    blossom(18, 15, 3.4, '#d9534a', '#7a1c14', 15) +
    blossom(25, 24.6, 2.8, '#e0675c', '#7a1c14', 50) +
    blossom(14.4, 4.6, 2.4, '#d9534a', '#7a1c14', 0) +
    `<ellipse cx="27.4" cy="28.6" rx="1.2" ry="1.5" fill="#c9413a"/>`;
  return (
    plum +
    S('M100 18Q108 12 116 18M96 26Q108 16 120 26M92 34Q108 20 124 34', '#c99a48', 0.7, ' opacity=".45"') +
    shadow(72, 90, 58, 4.4) +
    tails +
    `<g transform="rotate(${deg} ${C[0]} ${C[1]}) translate(0 ${C[1]}) scale(1 ${K}) translate(0 ${-C[1]})">` +
    P('M8 66Q8 69 10 72H120V67Z', '#7a4c2a') +
    S('M11 69.6H119', '#e2bd70', 0.45, ' opacity=".7"') +
    P('M8 52Q5.6 59 8 67H121V52Z', 'url(#mka-wood-pale)', ` stroke="${LINE}" stroke-width=".7"`) +
    S('M20 55.2Q60 54.4 116 55.6M24 63.4Q70 64.2 114 62.8', '#a87a48', 0.4, ' opacity=".35"') +
    P('M13.2 52.4H15V66.6H13.2Z', '#5a3a22') +
    bridges +
    strings +
    P('M121 51 127 49.6C131 49 133.6 50.6 133.6 54V65C133.6 68.4 131 70 127 69.4L121 68Z', 'url(#mka-wood-dark)', ` stroke="${LINE}" stroke-width=".6"`) +
    S('M128.6 51.6c2.6-.6 3.6 2.2 1.2 2.8M128.6 67.6c2.6.6 3.6-2.2 1.2-2.8', '#e3c27a', 0.7) +
    S('M9 53.4Q7.4 59 9 65.6', '#fff', 0.8, ' opacity=".35"') +
    `</g>`
  );
});

/** Koto rain: a koto before a round window, rain and bamboo outside. */
defineArt('music-koto', '0 0 140 110', () => {
  const r = rng(29);
  let rain = '';
  for (let i = 0; i < 16; i++) {
    const x = 70 + r() * 66;
    const y = 2 + r() * 56;
    const l = 6 + r() * 6;
    rain += `M${f(x)} ${f(y)}l${f(-l * 0.3)} ${f(l)}`;
  }
  const leaf = (x: number, y: number, deg: number, s: number) =>
    `<g transform="translate(${x} ${y}) rotate(${deg}) scale(${s})"><path d="M0 0C3 -1.6 9 -1.6 14 0C9 1.6 3 1.6 0 0Z" fill="#6d8a7c"/></g>`;
  const C: [number, number] = [70, 84];
  let strings = '';
  let ji = '';
  for (let i = 0; i < 13; i++) {
    const y = 76.8 + i * 0.72;
    const x = 30 + i * 5.6 + (i % 2) * 1.5;
    ji += P(`M${f(x - 1.9)} ${f(y + 1.7)}L${f(x - 0.7)} ${f(y - 2.6)}H${f(x + 0.7)}L${f(x + 1.9)} ${f(y + 1.7)}Z`, '#fbf7ea', ' stroke="#7a6a4c" stroke-width=".3"') + P(`M${f(x + 0.7)} ${f(y - 2.6)}L${f(x + 1.9)} ${f(y + 1.7)}H${f(x + 0.9)}Z`, '#d6c8a6');
    strings += S(`M12 ${f(y)}H117`, '#f7f0dc', 0.32);
  }
  return (
    `<defs><clipPath id="mka-window"><circle cx="100" cy="35" r="29"/></clipPath></defs>` +
    `<circle cx="100" cy="35" r="29" fill="url(#mka-rainsky)"/>` +
    `<g clip-path="url(#mka-window)">` +
    P('M84 4H86.6L87.2 70H84.6Z', '#7d958a', ' opacity=".8"') +
    P('M112 0H114.2L114.8 70H112.4Z', '#8ea398', ' opacity=".65"') +
    S('M84 22H86.8M84.4 44H87M112 16H114.4M112.4 40H114.6', '#5d7568', 0.7, ' opacity=".7"') +
    leaf(86.6, 22, -24, 1) +
    leaf(86.6, 23, 14, 0.8) +
    leaf(114.4, 16, -150, 0.9) +
    leaf(112.4, 40, 196, 1) +
    S(rain, '#5e7686', 0.55, ' opacity=".6"') +
    `<ellipse cx="100" cy="64" rx="30" ry="4" fill="#8fa2ae" opacity=".5"/>` +
    `</g>` +
    `<circle cx="100" cy="35" r="29" fill="none" stroke="url(#mka-wood-dark)" stroke-width="3.4"/>` +
    `<circle cx="100" cy="35" r="27.2" fill="none" stroke="#f1dfbd" stroke-width=".5" opacity=".6"/>` +
    S('M73 30A27 27 0 0 1 98 8.2', '#fff', 0.9, ' opacity=".4"') +
    shadow(70, 98, 62, 5) +
    `<g transform="rotate(-9 ${C[0]} ${C[1]})">` +
    P('M4 86H136V90Q136 92 134 92H6Q4 92 4 90Z', '#6e4426') +
    P('M4 77Q4 75 6 75H134Q136 75 136 77V86H4Z', 'url(#mka-wood)', ` stroke="${LINE}" stroke-width=".7"`) +
    S('M6 76.4H134', '#f2c992', 0.6, ' opacity=".5"') +
    P('M4 77Q4 75 6 75H12V86H4Z', '#3b2a1e') +
    S('M12 75.4V85.6', '#d9b26a', 0.6) +
    P('M117 75H134Q136 75 136 77V86H117Z', '#8e2f24') +
    S('M119 76 135 85M123 75.4 135 82.4M117.6 79 131 86M117.6 83 125 86', '#e3c27a', 0.4, ' opacity=".75"') +
    S('M117 75.4V85.6', '#e3c27a', 0.6) +
    ji +
    strings +
    `</g>`
  );
});

/** Bamboo flute: a daegeum with its membrane hole, a knotted tassel and bamboo leaves. */
defineArt('music-flute', '0 0 140 110', () => {
  const C: [number, number] = [70, 58];
  const deg = -24;
  const leaf = (x: number, y: number, a: number, s: number, c: string) =>
    `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M0 0C4-2.2 12-2.4 20 0C12 2.4 4 2.2 0 0Z" fill="${c}"/></g>`;
  const holes = [66, 72, 78, 86, 92, 98].map((x) => `<ellipse cx="${x}" cy="55.4" rx="1.5" ry="1.15" fill="#3a2a18"/>`).join('');
  const node = (x: number) => P(`M${x - 1} 50.6H${x + 1.4}V59.4H${x - 1}Z`, '#b8904a') + S(`M${x + 0.2} 50.8V59.2`, '#6e4f22', 0.5);
  const bind = (x0: number, x1: number) => {
    let d = '';
    for (let x = x0; x <= x1; x += 0.9) d += `M${f(x)} 51V59`;
    return S(d, '#a3301f', 0.45);
  };
  const [tx, ty] = rot(124, 59, C[0], C[1], deg);
  return (
    leaf(4, 20, -18, 1.1, '#9fb3a3') +
    leaf(10, 14, -48, 0.9, '#8aa492') +
    leaf(6, 30, 8, 0.85, '#b3c3b4') +
    P(taperStroke([[0, 26], [10, 20], [22, 12]], 1.2, 0.4), '#8aa492') +
    shadow(70, 96, 54, 4) +
    `<g transform="rotate(${deg} ${C[0]} ${C[1]})">` +
    `<rect x="10" y="51" width="120" height="8.4" rx="4.2" fill="url(#mka-bamboo)" stroke="${LINE}" stroke-width=".65"/>` +
    S('M14 52.6H126', '#fff6d4', 0.9, ' opacity=".55"') +
    node(30) +
    node(58) +
    node(112) +
    bind(13, 17) +
    bind(122, 126) +
    `<ellipse cx="22" cy="55.2" rx="1.9" ry="1.5" fill="#2e2012"/>` +
    `<ellipse cx="42" cy="55.2" rx="2.6" ry="1.9" fill="#efe3c3" stroke="#6e4f22" stroke-width=".4"/>` +
    S('M40.4 54.4Q42 56 43.6 54.6', '#c9b585', 0.35) +
    holes +
    `<ellipse cx="129.4" cy="55.2" rx="1.2" ry="3.6" fill="#7a5a28" stroke="${LINE}" stroke-width=".4"/>` +
    `</g>` +
    S(`M${f(tx)} ${f(ty)}C${f(tx + 1.6)} ${f(ty + 5)} ${f(tx - 1)} ${f(ty + 9)} ${f(tx)} ${f(ty + 13)}`, '#2f4a6d', 1) +
    // a small maedeup knot, then the tassel
    P(`M${f(tx)} ${f(ty + 12)}l2.6 2.6-2.6 2.6-2.6-2.6Z`, '#c0442d', ` stroke="#7d2414" stroke-width=".4"`) +
    S(`M${f(tx - 1.2)} ${f(ty + 14.6)}h2.4`, '#e3c27a', 0.6) +
    P(`M${f(tx - 1.6)} ${f(ty + 17.4)}h3.2l1.6 13q-3.2 1.6-6.4 0Z`, 'url(#mka-silk)') +
    S(`M${f(tx - 0.8)} ${f(ty + 19)}l-.8 11M${f(tx + 0.8)} ${f(ty + 19)}l.8 11`, '#7d2414', 0.4, ' opacity=".55"')
  );
});

/** Moonlight: a wind bell under a temple eave, against a full moon. */
defineArt('music-moonlight', '0 0 140 110', () => {
  let rafters = '';
  for (let i = 0; i < 6; i++) {
    const x = 4 + i * 8.4;
    const y = 15 - i * 0.6 - (i > 3 ? (i - 3) * 1.4 : 0);
    rafters += `<circle cx="${f(x)}" cy="${f(y)}" r="2.5" fill="#3f7a64" stroke="#23463a" stroke-width=".4"/><circle cx="${f(x)}" cy="${f(y)}" r="1.3" fill="#d9634a"/>`;
  }
  return (
    `<defs><clipPath id="mka-nightclip"><circle cx="80" cy="52" r="48"/></clipPath></defs>` +
    `<circle cx="80" cy="52" r="48" fill="url(#mka-night)"/>` +
    `<g clip-path="url(#mka-nightclip)">` +
    `<circle cx="96" cy="38" r="28" fill="url(#mka-glow)" opacity=".5"/>` +
    `<circle cx="96" cy="38" r="17" fill="url(#mka-moon)"/>` +
    `<path d="M88 33c2-2 5-1.6 5.6.8M97 44c1.6 1.4 4.6 1 5-1" fill="none" stroke="#d8c493" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>` +
    P('M30 82C44 74 58 78 66 72C74 66 90 70 100 64C112 58 126 64 132 60V104H30Z', '#202a48', ' opacity=".55"') +
    P('M70 58C78 52 92 56 100 52S118 50 124 54C116 56 106 58 98 60S80 62 70 58Z', '#c9d0e6', ' opacity=".28"') +
    P('M44 70C52 66 60 68 66 66C60 70 52 72 44 70Z', '#c9d0e6', ' opacity=".22"') +
    glint(122, 22, 1.8, 0.8) +
    glint(62, 30, 1.4, 0.7) +
    `</g>` +
    // the eave corner
    P('M0 0H40C48 0 54 2 60 8C56 8 52 10 48 12C34 16 16 18 0 19Z', '#3a3330') +
    P('M0 0H38C46 0 52 2 58 7.4C53 6.8 46 6.4 38 6.6C24 7 12 8.6 0 10Z', '#57504a') +
    S('M0 10C12 8.6 24 7 38 6.6C46 6.4 53 6.8 58 7.4', '#8a8178', 0.6) +
    rafters +
    S('M52 12.2V22', '#5a4632', 0.8) +
    // bell, clapper and fish wind-plate
    `<circle cx="52" cy="22.4" r="1.4" fill="none" stroke="url(#mka-brass)" stroke-width=".9"/>` +
    P('M46.4 36C46.4 28 48.4 24 52 24S57.6 28 57.6 36L59 38.4H45Z', 'url(#mka-bronze)', ` stroke="${LINE}" stroke-width=".55"`) +
    S('M47 30.6H57M46.4 34H57.6', '#e3c27a', 0.45, ' opacity=".7"') +
    S('M52 38.4V45', '#5a4632', 0.6) +
    `<g transform="rotate(8 52 46)">${P('M52 45C56 46.6 58 50 57.4 54C56.6 52.6 55 52 54 53L52 59 50 53C49 52 47.4 52.6 46.6 54C46 50 48 46.6 52 45Z', 'url(#mka-bronze)', ` stroke="${LINE}" stroke-width=".5"`)}<circle cx="50.6" cy="48.6" r=".7" fill="#2a2018"/>${S('M49 51.4Q52 50.4 55 51.4', '#e3c27a', 0.4, ' opacity=".6"')}</g>` +
    S('M40 28Q37 31 40 34M64 28Q67 31 64 34', '#e9c46a', 0.7, ' opacity=".7"')
  );
});

// ── Brushes: inkstone and brush ─────────────────────────────────────

/** An inkstone with a brush resting on it; the ink reads --mka-ink. */
defineArt('inkstone', '0 0 64 30', () => {
  const ink = 'style="fill:var(--mka-ink,#2a2724)"';
  const brush = taperStroke([[36.2, 17.4], [60.4, 4.6]], 3, 2.6);
  return (
    shadow(30, 26.6, 28, 2.8) +
    `<rect x="4" y="8" width="40" height="18" rx="4" fill="url(#mka-slate)" stroke="#1d1b19" stroke-width=".5"/>` +
    `<rect x="7" y="10.6" width="34" height="12.8" rx="3" fill="#3a3734" stroke="#6e6961" stroke-width=".5"/>` +
    `<ellipse cx="13" cy="17" rx="4.4" ry="4" ${ink}/>` +
    `<ellipse cx="28.6" cy="17" rx="10" ry="4.6" ${ink} opacity=".5"/>` +
    S('M10.6 15.2Q12.4 14 14.6 14.8M24 15Q28 13.8 32 14.6', '#fff', 0.7, ' opacity=".35"') +
    S('M9 9.4Q11 7.6 13 9.4Q15 7.6 17 9.4', '#8a847c', 0.55) +
    S('M6 9.6Q24 8.4 42 9.6', '#8a847c', 0.4, ' opacity=".6"') +
    // the brush
    P(brush, 'url(#mka-bamboo)', ` stroke="${LINE}" stroke-width=".4"`) +
    S('M44 13.6 46.4 12.4M52 9.4 54.4 8.2', '#8a662c', 0.6) +
    S('M37.6 15.8 59.6 4.2', '#fff6d4', 0.5, ' opacity=".6"') +
    `<circle cx="60.6" cy="4.5" r="1.6" fill="#4a2b18"/>` +
    S('M61.6 3.6q2.4-2.4.6-3.6', '#a3301f', 0.6) +
    P(taperStroke([[34.4, 18.3], [37.4, 16.7]], 3.6, 3.4), '#2c2018') +
    P('M34.6 16.4C31 17 26.4 19.6 23.4 22.8C27.8 21.8 32.2 20.6 35.4 19.6Z', '#efe4c9', ` stroke="${LINE}" stroke-width=".35"`) +
    P('M29.4 18.6C27 19.8 24.8 21.2 23.4 22.8C26.2 22.2 28.8 21.4 31 20.6Z', '', ` ${ink}`)
  );
});

// ── Papers: close-up detail on the swatch ───────────────────────────

/** Long fibres as fine tapered strokes. */
function fibres(seed: number, n: number, color: string, op: number, w = 0.7): string {
  const r = rng(seed);
  let o = '';
  for (let i = 0; i < n; i++) {
    const x = r() * 130 - 5;
    const y = r() * 100 - 5;
    const a = r() * Math.PI;
    const l = 14 + r() * 26;
    const bend = (r() - 0.5) * 10;
    const pts = quad([x, y], [x + Math.cos(a) * l * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * l * 0.5 + Math.cos(a) * bend], [x + Math.cos(a) * l, y + Math.sin(a) * l], 6);
    o += P(taperStroke(pts, w * (0.6 + r() * 0.8), 0.1), color, ` opacity="${f(op * (0.5 + r() * 0.5))}"`);
  }
  return o;
}

const PAPER_DETAIL: Record<string, () => string> = {
  plain: () => fibres(11, 6, 'var(--mka-fibre,#8a6a3c)', 0.35, 0.5).replace(/fill="var\(([^)]*)\)"/g, 'style="fill:var($1)"'),
  hanji: () =>
    (fibres(12, 16, 'X', 0.55, 0.9) + fibres(13, 8, 'X', 0.4, 1.4)).replace(/fill="X"/g, 'style="fill:var(--mka-fibre,#8a6a3c)"'),
  snow: () => {
    const flake = (x: number, y: number, s: number, deg: number) => {
      let d = '';
      for (let k = 0; k < 6; k++) {
        const a = ((deg + k * 60) * Math.PI) / 180;
        const c = Math.cos(a);
        const si = Math.sin(a);
        d += `M${f(x)} ${f(y)}l${f(c * 6 * s)} ${f(si * 6 * s)}`;
        const bx = x + c * 3.6 * s;
        const by = y + si * 3.6 * s;
        for (const side of [-1, 1]) {
          const b = a + side * 0.75;
          d += `M${f(bx)} ${f(by)}l${f(Math.cos(b) * 2 * s)} ${f(Math.sin(b) * 2 * s)}`;
        }
      }
      return S(d, 'var(--mk-flake,#8ea7c0)', 0.55 * s, ' style="stroke:var(--mk-flake,#8ea7c0)" opacity=".55"');
    };
    return flake(28, 26, 1.3, 10) + flake(92, 62, 1, 25) + flake(70, 18, 0.7, 0);
  },
  celadon: () => {
    const r = rng(21);
    let d = '';
    for (let i = 0; i < 9; i++) {
      let x = r() * 120;
      let y = r() * 90;
      d += `M${f(x)} ${f(y)}`;
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 24;
        y += (r() - 0.5) * 18;
        d += `L${f(x)} ${f(y)}`;
      }
    }
    return (
      `<ellipse cx="34" cy="22" rx="50" ry="30" fill="url(#mka-shine)" style="opacity:calc(var(--mka-glow-o,.9) - .3)"/>` +
      `<ellipse cx="100" cy="82" rx="58" ry="34" fill="url(#mka-pool)"/>` +
      S(d, '#3f6a55', 0.5, ' opacity=".35"')
    );
  },
  indigo: () =>
    `<ellipse cx="20" cy="70" rx="40" ry="24" fill="#16223a" opacity=".22"/>` +
    `<ellipse cx="96" cy="14" rx="36" ry="18" fill="#7f97c0" opacity=".16"/>` +
    S('M-4 40C20 34 40 46 64 40S104 30 124 38', '#d7e0f0', 1.2, ' opacity=".12"') +
    `<path d="M101 18a8 8 0 1 0 6 13 6.6 6.6 0 1 1-6-13Z" fill="#f6efd9" opacity=".75"/>` +
    glint(30, 22, 2.2, 0.75) +
    glint(70, 12, 1.6, 0.6),
  goldfleck: () => {
    const leaf = (x: number, y: number, s: number, deg: number) =>
      `<g transform="translate(${x} ${y}) rotate(${deg}) scale(${s})"><path d="M-5-3.4 1.6-5.2 5.6-1 3.4 4.4-3.2 4.6-6 .6Z" fill="#d6ad55"/><path d="M-5-3.4 1.6-5.2 1 .2Z" fill="#f4dc98"/><path d="M1 .2 5.6-1 3.4 4.4Z" fill="#b8893b"/></g>`;
    return leaf(26, 24, 1.3, 15) + leaf(84, 18, 0.9, -30) + leaf(98, 64, 1.2, 50) + leaf(44, 70, 0.8, 80);
  },
  suminagashi: () => {
    let o = '';
    for (let i = 0; i < 5; i++) o += S(`M${-6} ${30 + i * 7}C20 ${18 + i * 7} 46 ${44 + i * 6} 72 ${30 + i * 7}S112 ${16 + i * 8} 128 ${28 + i * 7}`, 'var(--ink,#2a2724)', 0.6 + (i % 2) * 0.5, ' style="stroke:var(--ink,#2a2724)" opacity=".16"');
    return o;
  },
};
for (const [id, body] of Object.entries(PAPER_DETAIL)) defineArt(`paper-${id}`, '0 0 120 90', body);

/** A brass paperweight bar (munjin) that holds a swatch down. */
defineArt('weight', '0 0 60 12', () =>
  shadow(30, 10.2, 28, 1.6, 0.9) +
  P('M26 3.6Q30-.4 34 3.6Z', 'url(#mka-brass)', ` stroke="${LINE}" stroke-width=".35"`) +
  `<rect x="2" y="3.2" width="56" height="5.6" rx="1.8" fill="url(#mka-brass-v)" stroke="${LINE}" stroke-width=".4"/>` +
  S('M4 4.6H56', '#fff7d6', 0.6, ' opacity=".7"') +
  S('M10 6.4Q14 5.4 18 6.4M42 6.4Q46 5.4 50 6.4', '#8a5f24', 0.4, ' opacity=".7"'),
);

/** A sheet edge like torn hanji (deckle): an irregular polygon clip for CSS. */
export function deckle(seed: number): string {
  const r = rng(seed);
  const pts: string[] = [];
  const j = () => (r() - 0.5) * 1.6;
  const n = 14;
  for (let i = 0; i < n; i++) pts.push(`${f((i / n) * 100)}% ${f(0.9 + j())}%`);
  for (let i = 0; i < n; i++) pts.push(`${f(99.1 + j())}% ${f((i / n) * 100)}%`);
  for (let i = n; i > 0; i--) pts.push(`${f((i / n) * 100)}% ${f(99.1 + j())}%`);
  for (let i = n; i > 0; i--) pts.push(`${f(0.9 + j())}% ${f((i / n) * 100)}%`);
  return `polygon(${pts.join(',')})`;
}
