/**
 * The Garden (정원 · 庭): a small courtyard the player decorates with items
 * bought in the Market. Every item has a fixed, hand-composed spot, so the
 * garden always looks arranged, whatever the player owns.
 *
 * CONTRACT (the Market sells GARDEN_ITEMS; the Garden screen calls gardenSvg):
 *   GARDEN_ITEMS                          — catalog data; ids are stable save keys
 *   gardenSvg(season, ids, opts?)         — the full scene with those items placed
 *   gardenItemSvg(id, season?)            — one item on a paper disc (Market tiles)
 *
 * The scene is a slightly elevated three-quarter view, painted in the same
 * ink-wash language as `scene.ts`: gradients, brush ribbons and dabs, no
 * filters or images. ViewBox 360×300. We look out from under our own eaves
 * (the dark tiled edge across the top) into a swept courtyard; hills and a
 * neighbour's roof sit beyond, then the back wall, then the garden in depth.
 *
 * Placement map (ground contact point, back → front; see SPOTS):
 *   back row   bamboo (0–50, 150) · swing (70, 160) · plum (140, 150)
 *              pavilion (238, 158) · persimmon (334, 152) · onggi (316, 176)
 *   wall       stone wall with a tiled cap across the back (y 96–134)
 *   water      pond (196, 202) with an island; bridge (106→162, 206);
 *              koi circling (234, 204); fountain on the back-left bank (124, 182)
 *              deer drinking at the back bank (166, 170)
 *   middle     maple (40, 214) leaning over the pond · crane (276, 228)
 *              irises (230, 240) at the front bank · lantern (76, 254)
 *   front      stepping stones (186, 296 → 102, 216) · cat (258, 282)
 *              tea table (330, 276) under the wisteria trellis (300–366)
 *              bonsai on its stand (36, 292)
 *   overhead   paper lanterns strung from our eaves (14 → 214) · chime (300, 10)
 *   night      fireflies over the pond and irises
 *
 * Animated parts carry the `ga` class plus one `ga-*` motion class; garden.css
 * runs them only inside `.gd-scene` (Market vignettes stay still).
 */

export interface GardenItem {
  id: string;
  name: string;
  ko: string;
  ja: string;
  blurb: string;
  /** another item this one needs first (e.g. koi need the pond) */
  needs?: string;
}

export const GARDEN_ITEMS: GardenItem[] = [
  { id: 'stones', name: 'Stepping stones', ko: '디딤돌', ja: '飛び石', blurb: 'A path to walk the garden, one stone at a time.' },
  { id: 'lantern', name: 'Stone lantern', ko: '석등', ja: '石灯籠', blurb: 'Carved granite that glows softly after dusk.' },
  { id: 'pond', name: 'Lotus pond', ko: '연못', ja: '池', blurb: 'Still water that holds the sky, with a mossy island.' },
  { id: 'koi', name: 'Koi', ko: '잉어', ja: '鯉', blurb: 'Three koi circling slowly under the lotus.', needs: 'pond' },
  { id: 'bridge', name: 'Stone bridge', ko: '돌다리', ja: '石橋', blurb: 'A low arch out to the island.', needs: 'pond' },
  { id: 'bamboo', name: 'Bamboo grove', ko: '대나무', ja: '竹林', blurb: 'Rustles when the wind passes.' },
  { id: 'plum', name: 'Plum tree', ko: '매화나무', ja: '梅の木', blurb: 'The first blossom of the year, even before the snow is gone.' },
  { id: 'maple', name: 'Maple tree', ko: '단풍나무', ja: '紅葉', blurb: 'Green all summer, then crimson over the water.' },
  { id: 'persimmon', name: 'Persimmon tree', ko: '감나무', ja: '柿の木', blurb: 'Orange fruit hanging into winter, a few left for the birds.' },
  { id: 'bonsai', name: 'Pine bonsai', ko: '분재', ja: '盆栽', blurb: 'A hundred-year pine in a tray.' },
  { id: 'wisteria', name: 'Wisteria trellis', ko: '등나무', ja: '藤棚', blurb: 'Purple sprays hanging overhead in late spring.' },
  { id: 'irises', name: 'Iris bed', ko: '붓꽃', ja: '菖蒲', blurb: 'Blue irises at the water’s edge.' },
  { id: 'wall', name: 'Stone wall', ko: '돌담', ja: '石垣', blurb: 'A low wall of stacked stones under a cap of roof tiles.' },
  { id: 'onggi', name: 'Onggi jars', ko: '옹기', ja: '甕', blurb: 'Earthen jars for soy and kimchi, lids on against the rain.' },
  { id: 'pavilion', name: 'Pavilion', ko: '정자', ja: '東屋', blurb: 'A roofed seat to watch the seasons turn.' },
  { id: 'teatable', name: 'Tea table', ko: '찻상', ja: '茶卓', blurb: 'A low table set for two.' },
  { id: 'chime', name: 'Wind chime', ko: '풍경', ja: '風鈴', blurb: 'A bronze bell and a little fish. Tap it.' },
  { id: 'lanterns', name: 'Paper lanterns', ko: '등불', ja: '提灯', blurb: 'A string of warm lights under the eaves.' },
  { id: 'fountain', name: 'Bamboo fountain', ko: '물레방아', ja: 'ししおどし', blurb: 'Fills, tips and clacks.' },
  { id: 'swing', name: 'Swing', ko: '그네', ja: 'ぶらんこ', blurb: 'A rope swing, as on the fifth day of the fifth month.' },
  { id: 'cat', name: 'Sleeping cat', ko: '고양이', ja: '猫', blurb: 'Naps in the warmest spot. Try not to wake her.' },
  { id: 'crane', name: 'Crane', ko: '학', ja: '鶴', blurb: 'Stands on one leg by the water.', needs: 'pond' },
  { id: 'deer', name: 'Deer', ko: '사슴', ja: '鹿', blurb: 'A shy visitor from the hills.' },
  { id: 'fireflies', name: 'Fireflies', ko: '반딧불이', ja: '蛍', blurb: 'Tiny lights drifting after dark.' },
];

/** Daily visitors (drawn here, chosen by the garden service). */
export interface GardenVisitor {
  id: string;
  name: string;
  ko: string;
  ja: string;
  /** the item it comes for */
  needs: string;
  /** where it is, for the hint line under the scene */
  where: string;
  /** seasons it comes in (default: all) */
  seasons?: number[];
}

export const GARDEN_VISITORS: GardenVisitor[] = [
  { id: 'magpie', name: 'Magpie', ko: '까치', ja: 'カササギ', needs: 'wall', where: 'on the wall' },
  { id: 'heron', name: 'Grey heron', ko: '왜가리', ja: 'アオサギ', needs: 'pond', where: 'in the shallows' },
  { id: 'mate', name: 'A crane’s mate', ko: '짝 학', ja: 'つがいの鶴', needs: 'crane', where: 'beside the crane' },
  { id: 'squirrel', name: 'Squirrel', ko: '다람쥐', ja: 'リス', needs: 'persimmon', where: 'on the persimmon tree', seasons: [0, 1, 2] },
  { id: 'tanuki', name: 'Tanuki', ko: '너구리', ja: '狸', needs: 'lantern', where: 'by the lantern' },
  { id: 'sparrow', name: 'Sparrow', ko: '참새', ja: '雀', needs: 'chime', where: 'by the wind chime' },
  { id: 'butterfly', name: 'White butterfly', ko: '흰나비', ja: '紋白蝶', needs: 'irises', where: 'over the irises', seasons: [0, 1] },
  { id: 'whiteeye', name: 'White-eye', ko: '동박새', ja: 'メジロ', needs: 'plum', where: 'in the plum tree', seasons: [0, 2, 3] },
];

/** Season index for a date (0 spring, 1 summer, 2 autumn, 3 winter; northern hemisphere). */
export function seasonOf(d = new Date()): number {
  const m = d.getMonth();
  return m >= 2 && m <= 4 ? 0 : m >= 5 && m <= 7 ? 1 : m >= 8 && m <= 10 ? 2 : 3;
}

/** Night by the device clock: dusk to dawn. */
export function isNightNow(d = new Date()): boolean {
  const h = d.getHours();
  return h >= 19 || h < 6;
}

export interface GardenSvgOpts {
  night?: boolean;
  /** today's visitor id, if any (see GARDEN_VISITORS) */
  visitor?: string | null;
  /** a visitor that has left: draw the note it left behind instead */
  note?: string | null;
}

/* ───────────────────────── geometry helpers (as in scene.ts) ───────────────────────── */

type Pt = [number, number];
type Stop = [number, string, number?];

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
  const q = (v: number) => Math.round(v * 10) / 10;
  let [cx, cy] = [q(pts[0][0]), q(pts[0][1])];
  let d = `${move ? 'M' : 'L'}${nums([cx, cy])}c`;
  const v: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const ex = q(p2[0]);
    const ey = q(p2[1]);
    v.push(
      q(p1[0] + (p2[0] - p0[0]) / 6) - cx, q(p1[1] + (p2[1] - p0[1]) / 6) - cy,
      q(p2[0] - (p3[0] - p1[0]) / 6) - cx, q(p2[1] - (p3[1] - p1[1]) / 6) - cy,
      ex - cx, ey - cy,
    );
    cx = ex;
    cy = ey;
  }
  return d + nums(v);
}

/** Closed smooth outline through `pts`. */
function loop(pts: Pt[]): string {
  const q = (v: number) => Math.round(v * 10) / 10;
  const n = pts.length;
  let [cx, cy] = [q(pts[0][0]), q(pts[0][1])];
  const d = `M${nums([cx, cy])}c`;
  const v: number[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const ex = q(p2[0]);
    const ey = q(p2[1]);
    v.push(
      q(p1[0] + (p2[0] - p0[0]) / 6) - cx, q(p1[1] + (p2[1] - p0[1]) / 6) - cy,
      q(p2[0] - (p3[0] - p1[0]) / 6) - cx, q(p2[1] - (p3[1] - p1[1]) / 6) - cy,
      ex - cx, ey - cy,
    );
    cx = ex;
    cy = ey;
  }
  return d + nums(v) + 'Z';
}

/** Numbers for path data, as short as they go: `.5` not `0.5`, `1-2` not `1 -2`. */
function nums(v: number[]): string {
  let s = '';
  for (const x of v) {
    const t = n1(x).replace(/^(-?)0\./, '$1.');
    s += s && t[0] !== '-' && !(t[0] === '.' && /\.\d*$/.test(s)) ? ' ' + t : t;
  }
  return s;
}

const poly = (pts: Pt[]): string => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n1(x)} ${n1(y)}`).join('');

const ell = (x: number, y: number, rx: number, ry: number): string => {
  const a = `a${nums([rx, ry])} 0 1 0 `;
  return `M${nums([x - rx, y])}${a}${n1(2 * rx)} 0${a}${n1(-2 * rx)} 0`;
};

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

/** Tapered ribbon along a run of points: one brush stroke. */
function ribbon(seg: Pt[], w: number, r: () => number): string {
  const n = seg.length - 1;
  const tw = (k: number) => Math.sin((Math.PI * k) / n) ** 0.7;
  const top = seg.map(([x, y], k) => [x, y - w * 0.25 * tw(k)] as Pt);
  const bot = seg.map(([x, y], k) => [x, y + w * tw(k) * (0.7 + r() * 0.6)] as Pt).reverse();
  return smooth(top) + smooth(bot, false) + 'Z';
}

/** A narrow leaf (bamboo, iris, willow) from a base point at an angle. */
function leaf(x: number, y: number, len: number, ang: number, w: number): string {
  const a = (ang * Math.PI) / 180;
  const dx = Math.cos(a) * len;
  const dy = Math.sin(a) * len;
  const mx = dx * 0.42;
  const my = dy * 0.42;
  const px = -Math.sin(a) * w;
  const py = Math.cos(a) * w;
  const ex = Math.round(dx * 10) / 10;
  const ey = Math.round(dy * 10) / 10;
  return `M${nums([x, y])}q${nums([mx + px, my + py, ex, ey])}q${nums([mx - px - ex, my - py - ey, -ex, -ey])}z`;
}

/* ───────────────────────── painting context ───────────────────────── */

interface Pal {
  sky: Stop[];
  sun: string;
  halo: string;
  far: [string, string];
  near: [string, string];
  grove: string[];
  ground: [string, string];
  rake: string;
  moss: string[];
  hedge: string[];
  water: [string, string];
  mist: string;
  /** generic foliage greens of the season (empty in winter) */
  leaf: string[];
  bamboo: string[];
}

const PALS: Pal[] = [
  {
    // spring: blush sky, fresh green, blossom in the hills
    sky: [[0, '#ebd3d8'], [0.6, '#f5e4e0'], [1, '#f4ece0']],
    sun: '#efb2aa',
    halo: '#f4c4bb',
    far: ['#d6c1cb', '#efe4e1'],
    near: ['#bdc3a2', '#ebe6d8'],
    grove: ['#e2b4c0', '#eac4cc', '#a9b894', '#c3cca6'],
    ground: ['#e8dcc4', '#d6c4a2'],
    rake: '#c7b693',
    moss: ['#a6b886', '#b9c697', '#8fa572'],
    hedge: ['#98ad7c', '#b0c08e', '#e6bcc6'],
    water: ['#ebe4dc', '#a3b8b4'],
    mist: '#f8efea',
    leaf: ['#9cba7c', '#b6cc8f', '#86a86c'],
    bamboo: ['#8db06a', '#a8c47f', '#6f9555'],
  },
  {
    // summer: celadon sky, deep greens
    sky: [[0, '#c3d7d6'], [0.6, '#e0e6d8'], [1, '#f1e6cf']],
    sun: '#f0c477',
    halo: '#f5d496',
    far: ['#9fb7b0', '#e1e5d8'],
    near: ['#87a38f', '#d8decd'],
    grove: ['#6c917c', '#86a891', '#5c826d', '#7a9a80'],
    ground: ['#e3d8bd', '#cfbf9b'],
    rake: '#c2b28f',
    moss: ['#7f9d6b', '#97b27e', '#6b8a5c'],
    hedge: ['#6f9466', '#86a978', '#5b8156'],
    water: ['#d6e6df', '#7aa3a0'],
    mist: '#f6f1e2',
    leaf: ['#5f8a58', '#77a06a', '#4d7650'],
    bamboo: ['#5e8a4c', '#77a05e', '#4b7340'],
  },
  {
    // autumn: apricot sky, rust hills
    sky: [[0, '#eed3b8'], [0.6, '#f5e1c8'], [1, '#f6ebda']],
    sun: '#d4603d',
    halo: '#e99a6c',
    far: ['#d2b0a0', '#f0e2d1'],
    near: ['#c99673', '#efdcc6'],
    grove: ['#c4553a', '#d27a48', '#dca05c', '#a9583a'],
    ground: ['#e8d7b9', '#d3bd97'],
    rake: '#c4ad87',
    moss: ['#ab9e64', '#c0ae73', '#929058'],
    hedge: ['#b8803f', '#c9a058', '#a45a37'],
    water: ['#efe0cb', '#97aaa6'],
    mist: '#f9ecdc',
    leaf: ['#c9a24e', '#d98a3c', '#b8652e'],
    bamboo: ['#7f9450', '#9aa35a', '#6c7f45'],
  },
  {
    // winter: pewter sky, snow
    sky: [[0, '#c4cfdd'], [0.6, '#e0e4e9'], [1, '#f0eee8']],
    sun: '#fbf7ec',
    halo: '#ffffff',
    far: ['#a9b7c7', '#e6e9ec'],
    near: ['#d2d9e1', '#f1f2f1'],
    grove: ['#5d6b7e', '#748296'],
    ground: ['#f5f6f4', '#e4e9ec'],
    rake: '#c9d2dc',
    moss: [],
    hedge: ['#6c7a72', '#7f8c82'],
    water: ['#e8edf1', '#adbecb'],
    mist: '#f4f3ef',
    leaf: [],
    bamboo: ['#5f7d55', '#71906a', '#4e6a48'],
  },
];

const SNOW = '#fbfbf9';

/** The ink of every outline: a warm, near-black sumi. */
const INK = '#33271f';
/** Ink outline attributes for a filled form (a brush line of width `w`). */
const ol = (w = 0.55, op = 0.75): string =>
  ` stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${op < 1 ? ` stroke-opacity="${op}"` : ''}`;
const SNOW_SHADE = '#dfe6ee';
/** Paint attributes for snow laid along branches and caps (see snowAlong). */
const SNOW_STROKE = ` fill="${SNOW}"`;

interface C {
  p: string;
  s: number;
  night: boolean;
  pal: Pal;
  defs: Map<string, string>;
  /** markup painted above the night wash (lit windows, glows) */
  light: string[];
  has: (id: string) => boolean;
  /** painting a close-up vignette rather than the whole scene */
  vig?: boolean;
  /** in a vignette: the scene x range that shows (wide pieces skip what the disc crops) */
  view?: [number, number];
}

/** Whether scene x is inside the vignette's view (always, in the full scene). */
const seen = (c: C, x: number, pad = 6): boolean => !c.view || (x > c.view[0] - pad && x < c.view[1] + pad);

const stops = (s: Stop[]): string =>
  s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('');

/** Bounding-box linear gradient (default: top to bottom). */
function lin(c: C, key: string, s: Stop[], x2 = 0, y2 = 1): string {
  const id = c.p + key;
  if (!c.defs.has(id)) c.defs.set(id, `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`);
  return `url(#${id})`;
}

/** User-space vertical gradient. */
function linY(c: C, key: string, y1: number, y2: number, s: Stop[]): string {
  const id = c.p + key;
  if (!c.defs.has(id))
    c.defs.set(id, `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(y1)}" x2="0" y2="${n1(y2)}">${stops(s)}</linearGradient>`);
  return `url(#${id})`;
}

function rad(c: C, key: string, s: Stop[]): string {
  const id = c.p + key;
  if (!c.defs.has(id)) c.defs.set(id, `<radialGradient id="${id}">${stops(s)}</radialGradient>`);
  return `url(#${id})`;
}

/** Soft round glow (night lights, the sun's halo). */
function glow(c: C, x: number, y: number, r: number, color: string, op = 1, cls = ''): string {
  const g = rad(c, `gl${color.slice(1)}`, [
    [0, color, 0.85],
    [0.35, color, 0.35],
    [1, color, 0],
  ]);
  return `<circle${cls ? ` class="${cls}"` : ''} cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${g}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
}

/** Grey granite, lit from the upper left. */
const stoneFill = (c: C, key = 'stone', light = '#cfc8ba', dark = '#8c857a'): string =>
  lin(c, key, [
    [0, light],
    [0.55, dark],
    [1, dark],
  ], 1, 1);

/** Mix two #rrggbb colours (t = 0 → a, 1 → b). */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** A dab: centre (or left end, with a length), radius, optional horizontal length. */
type Dab = [number, number, number, number?];

/**
 * Round dabs drawn as zero-length, round-capped strokes: about a quarter of the
 * markup of elliptical arcs. Bucketed into up to three sizes; `squash` flattens
 * them (a vertical scale on the group).
 */
function dabs(list: Dab[], color: string, op = 1, squash = 1): string {
  if (!list.length) return '';
  const sorted = [...list].sort((a, b) => a[2] - b[2]);
  const k = Math.min(3, Math.ceil(sorted.length / 5));
  let out = '';
  for (let b = 0; b < k; b++) {
    const part = sorted.slice(Math.floor((b * sorted.length) / k), Math.floor(((b + 1) * sorted.length) / k));
    if (!part.length) continue;
    const w = (part.reduce((t, p) => t + p[2], 0) / part.length) * 2;
    let d = '';
    for (const [x, y, , len] of part) d += `M${n1(x)} ${n1(y / squash)}h${len ? n1(len) : 0}`;
    out += `<path d="${d}" stroke="${color}" stroke-width="${n1(w)}" stroke-linecap="round"/>`;
  }
  const attrs = (squash !== 1 ? ` transform="scale(1 ${squash})"` : '') + (op < 1 ? ` opacity="${op}"` : '');
  return attrs ? `<g${attrs}>${out}</g>` : out;
}

type Clump = [number, number, number, number];

/** A soft lobed patch around (cx, cy): the shape a loaded brush leaves when pressed and turned. */
function blob(r: () => number, cx: number, cy: number, rx: number, ry: number, k = 7): string {
  const pts: Pt[] = [];
  const ph = r() * 6.28;
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const R = 0.84 + r() * 0.26 + 0.08 * Math.sin(a * 3 + ph);
    pts.push([Math.round((cx + Math.cos(a) * rx * R) * 10) / 10, Math.round((cy + Math.sin(a) * ry * R) * 10) / 10]);
  }
  const mid = (i: number): Pt => {
    const p = pts[i % k];
    const q = pts[(i + 1) % k];
    return [Math.round(((p[0] + q[0]) / 2) * 10) / 10, Math.round(((p[1] + q[1]) / 2) * 10) / 10];
  };
  let [x0, y0] = mid(k - 1);
  const d = `M${nums([x0, y0])}q`;
  const v: number[] = [];
  for (let i = 0; i < k; i++) {
    const [px, py] = pts[i];
    const [qx, qy] = mid(i);
    v.push(px - x0, py - y0, qx - x0, qy - y0);
    x0 = qx;
    y0 = qy;
  }
  return d + nums(v) + 'z';
}

/** Dry-brush streaks: thin tapered strokes at about `ang` degrees inside clumps (texture that follows form). */
function streaks(r: () => number, clumps: Clump[], n: number, len: number, ang: number, w = 0.35, spread = 14): string {
  let d = '';
  for (let k = 0; k < n; k++) {
    const [cx, cy, rx, ry] = clumps[k % clumps.length];
    const l = len * (0.6 + r() * 0.8);
    const a = ang + (r() - 0.5) * spread;
    const x = cx + (r() - 0.5) * rx * 2 - Math.cos((a * Math.PI) / 180) * l * 0.5;
    const y = cy + (r() - 0.5) * ry * 2 - Math.sin((a * Math.PI) / 180) * l * 0.5;
    d += leaf(x, y, l, a, w * (0.7 + r() * 0.6));
  }
  return d;
}

/**
 * Moss, ground cover, a grove on a hill, a spray of leaves: soft lobed washes
 * (one per clump and colour, a little offset) with a few tapered brush strokes
 * on top. Flat clumps (`squash` < .7) get strokes lying down, like grass and moss.
 */
function scatter(r: () => number, clumps: Clump[], n: number, r0: number, r1: number, colors: string[], op = 1, squash = 0.75): string {
  if (!colors.length) return '';
  let o = '';
  colors.forEach((col, i) => {
    let d = '';
    for (const [cx, cy, rx, ry] of clumps) {
      const t = (i + 1) / (colors.length + 1);
      if (i > 0 && r() < 0.3) continue;
      d += blob(r, cx + (r() - 0.5) * rx * 0.5, cy + (r() - 0.5) * ry * 0.4, rx * (0.8 - t * 0.35) + r1, ry * (0.8 - t * 0.35) + r1 * squash, 9);
    }
    o += `<path d="${d}" fill="${col}" opacity="${n1(0.22 + 0.2 / (i + 1))}"/>`;
  });
  const strokes = colors.map(() => '');
  const m = Math.round(n / 2);
  for (let k = 0; k < m; k++) {
    const [cx, cy, rx, ry] = clumps[Math.floor(r() * clumps.length)];
    const a = r() * Math.PI * 2;
    const dd = Math.sqrt(r()) * 0.9;
    const ang = squash < 0.7 ? (r() < 0.5 ? -8 : 188) + (r() - 0.5) * 40 : r() * 360;
    strokes[Math.floor(r() * colors.length)] += leaf(cx + Math.cos(a) * rx * dd, cy + Math.sin(a) * ry * dd, (r0 + r1) * (1.1 + r() * 0.9), ang, (r0 + r1) * 0.22);
  }
  o += strokes.map((d, i) => (d ? `<path d="${d}" fill="${mix(colors[i], '#2c3324', 0.12)}"/>` : '')).join('');
  return op < 1 ? `<g opacity="${op}">${o}</g>` : o;
}

/**
 * A canopy painted in washes: a dark lobed mass per clump, a deeper shade under
 * it on the lower right, a mid tone, a lit crown toward the upper left (the light
 * in every garden picture), and tapered leaf strokes breaking the silhouette.
 */
function foliage(r: () => number, clumps: Clump[], n: number, size: number, dark: string[], light: string[], op = 1): string {
  let mass = '';
  let shade = '';
  let mid = '';
  let crown = '';
  const edge = dark.map(() => '');
  const lit = light.map(() => '');
  let tips = '';
  const per = Math.min(9, Math.max(6, Math.round((n / clumps.length) * 0.6)));
  for (const [x, y, rx, ry] of clumps) {
    mass += blob(r, x, y + ry * 0.06, rx * 1.02, ry * 0.95, 9);
    shade += blob(r, x + rx * 0.16, y + ry * 0.38, rx * 0.7, ry * 0.46, 6);
    mid += blob(r, x - rx * 0.12, y - ry * 0.16, rx * 0.7, ry * 0.6, 7);
    crown += blob(r, x - rx * 0.3, y - ry * 0.4, rx * 0.4, ry * 0.32, 5);
    // leaves fan outward from the clump's heart and break its silhouette
    for (let k = 0; k < per; k++) {
      const a = r() * Math.PI * 2;
      const d = 0.5 + r() * 0.55;
      const len = size * (1.5 + r() * 1.1);
      const ang = (a * 180) / Math.PI + (r() - 0.5) * 140;
      edge[k % edge.length] += leaf(x + Math.cos(a) * rx * d * 0.8, y + Math.sin(a) * ry * d * 0.8, len, ang, size * 0.7);
    }
    // the lit side: toward the upper left
    for (let k = 0; k < Math.ceil(per * 0.65); k++) {
      const a = Math.PI * (0.9 + r() * 0.95);
      const d = 0.25 + r() * 0.7;
      const len = size * (1.3 + r() * 1);
      const ang = (a * 180) / Math.PI + (r() - 0.5) * 150;
      const px = x - rx * 0.12 + Math.cos(a) * rx * d * 0.78;
      const py = y - ry * 0.14 + Math.sin(a) * ry * d * 0.78;
      if (k % 4 === 3) tips += leaf(px, py, len * 0.8, ang, size * 0.5);
      else lit[k % lit.length] += leaf(px, py, len, ang, size * 0.66);
    }
  }
  const deep = mix(dark[0], '#1c2420', 0.4);
  const out =
    `<path d="${mass}" fill="${dark[0]}"/>` +
    edge.map((d, i) => `<path d="${d}" fill="${dark[i]}"/>`).join('') +
    `<path d="${shade}" fill="${deep}" opacity=".38"/>` +
    `<path d="${mid}" fill="${dark[dark.length - 1]}" opacity=".55"/>` +
    `<path d="${crown}" fill="${light[0]}" opacity=".22"/>` +
    lit.map((d, i) => `<path d="${d}" fill="${light[i]}"/>`).join('') +
    `<path d="${tips}" fill="${mix(light[light.length - 1], '#fffbe8', 0.3)}" opacity=".9"/>`;
  return op < 1 ? `<g opacity="${op}">${out}</g>` : out;
}

/** Soft lobed patches in one colour (snow lying on a hedge, petals fallen in a drift). */
function scatterDabs(r: () => number, clumps: Clump[], _n: number, _r0: number, r1: number, color: string, op = 1): string {
  let d = '';
  for (const [cx, cy, rx, ry] of clumps) d += blob(r, cx, cy, rx * 0.8 + r1, ry * 0.7 + r1 * 0.4, 7);
  return `<path d="${d}" fill="${color}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
}

/** Snow lying along the upper side of a run of points: soft crescents on the flatter runs (fill with SNOW). */
function snowAlong(r: () => number, pts: Pt[], w: number, _gap = 4): string {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    // snow settles on the flatter runs, barely on upright ones
    const flat = Math.abs(x1 - x0) / (len || 1);
    if (flat < 0.45 || r() < 0.12) continue;
    const off = w * 0.42;
    const t0 = r() * 0.15;
    const t1 = 1 - r() * 0.15;
    const ax = x0 + (x1 - x0) * t0;
    const ay = y0 + (y1 - y0) * t0 - off;
    const bx = x0 + (x1 - x0) * t1;
    const by = y0 + (y1 - y0) * t1 - off;
    const h = (0.9 + w * 0.18) * flat * (0.8 + r() * 0.5);
    d += `M${n1(ax)} ${n1(ay + 0.4)}Q${n1((ax + bx) / 2)} ${n1((ay + by) / 2 - h * 2)} ${n1(bx)} ${n1(by + 0.4)}Q${n1((ax + bx) / 2)} ${n1((ay + by) / 2 + 0.5)} ${n1(ax)} ${n1(ay + 0.4)}Z`;
  }
  return d;
}

/** Five round plum petals (white, pink) or a cherry-like red; fill from the <use>. */
function plumDef(c: C): string {
  const id = `${c.p}fl-pl`;
  if (!c.defs.has(id)) {
    let petals = '';
    for (let i = 0; i < 5; i++) {
      const a = ((i * 72 - 90) * Math.PI) / 180;
      petals += `<circle cx="${n1(Math.cos(a) * 2.3)}" cy="${n1(Math.sin(a) * 2.3)}" r="2.2"/>`;
    }
    c.defs.set(id, `<g id="${id}">${petals}<circle r="1.1" fill="#f1d27a"/><circle r=".5" fill="#a24a4f"/></g>`);
  }
  return id;
}

/** A seven-lobed maple leaf; fill from the <use>. */
function mapleDef(c: C): string {
  const id = `${c.p}fl-mp`;
  if (!c.defs.has(id)) {
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
      pts.push([Math.cos(a - 0.22) * R * 0.62, Math.sin(a - 0.22) * R * 0.62]);
      pts.push([Math.cos(a) * R, Math.sin(a) * R]);
      pts.push([Math.cos(a + 0.22) * R * 0.62, Math.sin(a + 0.22) * R * 0.62]);
    });
    c.defs.set(id, `<path id="${id}" d="${poly(pts)}Z"/>`);
  }
  return id;
}

const use = (id: string, x: number, y: number, s: number, rot: number, fill: string, op = 1): string =>
  `<use href="#${id}" transform="translate(${n1(x)} ${n1(y)}) rotate(${Math.round(rot)}) scale(${s})" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`;

/** A soft contact shadow on the ground. */
const shadow = (x: number, y: number, rx: number, ry: number, op = 0.16): string =>
  `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="#3a2e22" opacity="${op}"/>`;

/* ───────────────────────── the courtyard (always there) ───────────────────────── */

function ridge(seed: number, base: number, peaks: [number, number, number][], wave = 4, rough = 1): Pt[] {
  const r = rng(seed);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const pts: Pt[] = [];
  for (let x = -16; x <= 376; x += 8) {
    let y = base - wave * (Math.sin(x / 47 + ph[0]) * 0.6 + Math.sin(x / 23 + ph[1]) * 0.3 + Math.sin(x / 11 + ph[2]) * 0.1);
    for (const [px, h, wd] of peaks) {
      const t = (x - px) / wd;
      y -= h * Math.exp(-t * t);
    }
    pts.push([x, y + (r() - 0.5) * rough]);
  }
  return pts;
}

function yAt(pts: Pt[], x: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[x < pts[0][0] ? 0 : pts.length - 1][1];
}

const NIGHT_SKY: Stop[] = [
  [0, '#33417a'],
  [0.55, '#4b5890'],
  [1, '#7d82a6'],
];

/** A hanok roof, seen from the front: curved eave with lifted corners, a ridge. */
function hanokRoof(x: number, y: number, w: number, h: number, fill: string): string {
  const hw = w / 2;
  return (
    `<path d="M${n1(x - hw - 4)} ${n1(y - 2.4)}Q${n1(x - hw + w * 0.12)} ${n1(y + 0.6)} ${n1(x)} ${n1(y + 0.8)}Q${n1(x + hw - w * 0.12)} ${n1(y + 0.6)} ${n1(x + hw + 4)} ${n1(y - 2.4)}` +
    `Q${n1(x + hw - w * 0.06)} ${n1(y - h * 0.35)} ${n1(x + hw * 0.62)} ${n1(y - h)}H${n1(x - hw * 0.62)}Q${n1(x - hw + w * 0.06)} ${n1(y - h * 0.35)} ${n1(x - hw - 4)} ${n1(y - 2.4)}Z` +
    `M${n1(x - hw * 0.66)} ${n1(y - h - 0.2)}Q${n1(x - hw * 0.72)} ${n1(y - h - 2.4)} ${n1(x - hw * 0.76)} ${n1(y - h - 2.6)}H${n1(x + hw * 0.76)}Q${n1(x + hw * 0.72)} ${n1(y - h - 2.4)} ${n1(x + hw * 0.66)} ${n1(y - h - 0.2)}Z" fill="${fill}"/>`
  );
}

function courtyard(c: C): string {
  const P = c.pal;
  const s = c.s;
  let o = `<rect width="360" height="300" fill="${linY(c, 'sky', 0, 132, c.night ? NIGHT_SKY : P.sky)}"/>`;
  if (!c.night) {
    o += glow(c, 214, 40, 58, P.halo, 0.55) + `<circle cx="214" cy="40" r="${s === 3 ? 10 : 12}" fill="${P.sun}" opacity=".88"/>`;
  }
  // thin cloud wisps
  const wr = rng(3 + s);
  let wd = '';
  for (const [x, y, len] of [[150, 48, 90], [232, 58, 70], [96, 30, 60], [268, 34, 50]] as const) {
    const seg: Pt[] = [];
    for (let k = 0; k <= 6; k++) seg.push([x + (len * k) / 6, y + Math.sin(k * 0.9 + x) * 0.6]);
    wd += ribbon(seg, 1.4 + wr() * 1.1, wr);
  }
  o += `<path d="${wd}" fill="${c.night ? '#8f97bd' : P.mist}" opacity="${c.night ? 0.35 : 0.7}"/>`;
  if (!c.night && s !== 3) {
    // geese in autumn, swallows in spring and summer
    const flock: [number, number][] = s === 2 ? [[104, 52], [111, 49.5], [118, 47.5], [111, 55], [118, 58], [125, 61]] : [[120, 56], [131, 50]];
    const br = rng(9 + s);
    let d = '';
    for (const [x, y] of flock) {
      const up = 1 + br() * 1.4;
      const w = s === 2 ? 2.6 : 3.4;
      d += `M${n1(x - w)} ${n1(y + up * 0.6)}Q${n1(x - w * 0.4)} ${n1(y - up * 0.6)} ${x} ${y}Q${n1(x + w * 0.45)} ${n1(y - up * 0.5)} ${n1(x + w)} ${n1(y + up * 0.7)}`;
    }
    o += `<path d="${d}" stroke="#4a3c36" stroke-width=".7" stroke-linecap="round" fill="none" opacity=".6"/>`;
  }

  // far ridge
  const far = ridge(31 + s, 98, [[46, 22, 34], [134, 12, 30], [250, 26, 44], [330, 16, 28]], 4, 1.2);
  const farTop = Math.min(...far.map((p) => p[1]));
  o += `<path d="${smooth(far)}L376 150L-16 150Z" fill="${linY(c, 'far', farTop, farTop + 40, [[0, P.far[0]], [1, P.far[1]]])}"/>`;
  {
    const r = rng(7 + s);
    let d = '';
    let i = 0;
    while (i < far.length - 2) {
      const j = Math.min(far.length - 1, i + 3 + Math.floor(r() * 7));
      if (r() > 0.2) d += ribbon(far.slice(i, j + 1), 0.9 + r() * 0.6, r);
      i = j + (r() < 0.4 ? 1 : 0);
    }
    o += `<path d="${d}" fill="${mix(P.far[0], '#5a4a48', 0.13)}" opacity=".92"/>`;
  }
  o += `<ellipse cx="180" cy="104" rx="220" ry="9" fill="${rad(c, 'mist', [[0, P.mist, 0.95], [0.6, P.mist, 0.5], [1, P.mist, 0]])}" opacity=".85"/>`;

  // near hills with groves
  const near = ridge(41 + s, 114, [[24, 10, 40], [112, 5, 30], [310, 12, 46]], 3, 1);
  const nearTop = Math.min(...near.map((p) => p[1]));
  o += `<path d="${smooth(near)}L376 150L-16 150Z" fill="${linY(c, 'near', nearTop, nearTop + 24, [[0, P.near[0]], [1, P.near[1]]])}"/>`;
  {
    const r = rng(43 + s);
    const cl: [number, number, number, number][] = [];
    for (const [cx, hw] of [[20, 26], [90, 18], [150, 14], [296, 26], [350, 22]] as const) cl.push([cx, yAt(near, cx) - 2, hw, 5]);
    o += scatter(r, cl, 120, 1.4, 3, P.grove, 0.8, 0.7);
  }

  // a neighbour's roofs beyond the wall
  const roof = c.night ? '#3e4258' : s === 3 ? '#6b7280' : '#5d5752';
  o += `<g opacity=".72">${hanokRoof(196, 116, 58, 10, roof)}${hanokRoof(250, 119, 34, 7, roof)}`;
  if (s === 3) o += `<path d="M175.3 106.2H216.7Q214 108.5 212 109.6H180Q178 108.5 175.3 106.2Z" fill="${SNOW}"/>`;
  o += `<path d="M178 117.5h36v4h-36Z" fill="${s === 3 ? '#d9dee4' : '#cdbfa8'}"/></g>`;
  if (!c.night) o += `<ellipse cx="200" cy="121" rx="190" ry="5" fill="${P.mist}" opacity=".55"/>`;

  // the hedge along the back of the courtyard
  {
    const r = rng(47 + s);
    // a clipped hedge in three washes: a dark body, a lit crown, leaf strokes along its top
    const top: Pt[] = [];
    for (let x = -14; x <= 374; x += 11) top.push([x, 118.6 + Math.sin(x / 11) * 1.2 + r() * 1.8]);
    const crown = top.map(([x, y]) => [x - 1.5, y + 1.4] as Pt);
    o += `<path d="${smooth(top)}L374 132H-14Z" fill="${P.hedge[0]}"/>`;
    o += `<path d="${smooth(crown)}L374 126Q180 124 -14 126Z" fill="${P.hedge[1]}" opacity=".85"/>`;
    let lv = '';
    let lv2 = '';
    for (const [x, y] of top) {
      lv += leaf(x + (r() - 0.5) * 6, y + 1.2, 3 + r() * 1.6, -90 + (r() - 0.5) * 120, 0.9);
      lv2 += leaf(x - 2 + r() * 3, y + 2.6, 2.2 + r(), -120 + r() * 60, 0.7);
    }
    o += `<path d="${lv}" fill="${P.hedge[0]}"/><path d="${lv2}" fill="${P.hedge[2] ?? mix(P.hedge[1], SNOW, 0.3)}" opacity=".9"/>`;
    o += `<path d="M-14 130Q180 127 374 130V132H-14Z" fill="${mix(P.hedge[0], '#1c2420', 0.4)}" opacity=".5"/>`;
    if (s === 3) o += `<path d="${smooth(top.map(([x, y]) => [x, y - 0.6] as Pt))}${smooth([...crown].reverse().map(([x, y]) => [x, y + 0.6] as Pt), false)}Z" fill="${SNOW}"/>`;
  }

  // the courtyard floor: swept earth (or snow), moss at the edges
  o += `<path d="M-10 127Q90 124 180 125T370 126V310H-10Z" fill="${linY(c, 'ground', 126, 300, [[0, mix(P.ground[0], P.mist, 0.4)], [0.25, P.ground[0]], [1, P.ground[1]]])}"/>`;
  {
    const r = rng(53 + s);
    // broad tonal washes, a pool of light in the middle, darker toward us and at the edges
    let wash = '';
    for (const [x, y, rx, ry] of [[40, 170, 60, 12], [300, 200, 70, 14], [150, 262, 90, 14], [330, 270, 50, 12], [20, 240, 40, 16]] as const) wash += blob(r, x, y, rx, ry, 9);
    o += `<path d="${wash}" fill="${mix(P.ground[1], '#5a4630', 0.25)}" opacity="${s === 3 ? 0.12 : 0.22}"/>`;
    if (!c.night) o += `<ellipse cx="190" cy="214" rx="150" ry="46" fill="${rad(c, 'gpool', [[0, '#fffaf0', s === 3 ? 0.35 : 0.3], [1, '#fffaf0', 0]])}"/>`;
    o += `<rect y="120" width="360" height="180" fill="${rad(c, 'gvig', [[0, '#ffffff', 0], [0.7, '#ffffff', 0], [1, '#5a4630', s === 3 ? 0.06 : 0.14]])}"/>`;
    // broom sweeps in little fans, finer with distance
    let sw = '';
    for (let k = 0; k < 22; k++) {
      const y = 136 + r() ** 0.8 * 160;
      const depth = (y - 126) / 174;
      const x = -10 + r() * 380;
      const w = 6 + depth * 16;
      const h = 0.8 + depth * 2.6;
      const tilt = (r() - 0.5) * 0.6;
      for (let j = 0; j < 3; j++) {
        const yy = y + j * h * 0.7;
        sw += `M${n1(x - w / 2)} ${n1(yy + tilt * w)}Q${n1(x)} ${n1(yy - h)} ${n1(x + w / 2)} ${n1(yy - tilt * w)}`;
      }
    }
    o += `<path d="${sw}" stroke="${P.rake}" stroke-width="${s === 3 ? 0.5 : 0.45}" fill="none" opacity="${s === 3 ? 0.55 : 0.6}" stroke-linecap="round"/>`;
    // dry-brush streaks lying along the ground
    const st = streaks(r, [[60, 180, 70, 30], [260, 190, 80, 30], [120, 250, 110, 30], [300, 262, 60, 20]], 26, 9, 0, 0.32, 8);
    o += `<path d="${st}" fill="${mix(P.ground[1], '#4a3a28', 0.3)}" opacity="${s === 3 ? 0.18 : 0.3}"/>`;
    // our eaves' shadow across the near ground: a scalloped edge of tile ends
    if (!c.night) {
      let sh = 'M-10 300V258';
      for (let x = -10; x <= 370; x += 8) sh += `Q${n1(x + 4)} ${n1(262.6 + (x / 360) * 4)} ${n1(x + 8)} ${n1(258 + ((x + 8) / 360) * 4)}`;
      o += `<path d="${sh}V300Z" fill="${s === 3 ? '#7f93ad' : '#5a4630'}" opacity="${s === 3 ? 0.12 : 0.1}"/>`;
    }
    // what the season leaves on the ground: plum petals in spring, leaves in autumn (a few, drawn)
    const fall = ([[['#f1cfd8', '#f8e4e8', '#e7b5c2'], 16, 1.6], [[], 0, 0], [['#c4553a', '#d98a3c', '#b8652e', '#e0ad4f'], 22, 2.6], [[], 0, 0]] as [string[], number, number][])[s];
    if (fall[1]) {
      const groups = fall[0].map(() => '');
      for (let k = 0; k < fall[1]; k++) {
        const y = 150 + r() ** 0.7 * 130;
        const depth = (y - 126) / 174;
        const x = r() < 0.5 ? r() * 110 : 250 + r() * 110;
        groups[k % groups.length] += leaf(x, y, fall[2] * (0.6 + depth), r() * 360, fall[2] * (0.25 + depth * 0.2));
      }
      o += groups.map((d, i) => `<path d="${d}" fill="${fall[0][i]}" opacity=".9"/>`).join('');
    }
  }
  if (s === 3) {
    // snow drifts in soft blue shade
    o += `<path d="M-10 160Q60 150 120 160T250 152T370 162V176Q300 166 230 172T100 170T-10 178Z" fill="${SNOW_SHADE}" opacity=".5"/>`;
    o += `<path d="M-10 250Q50 238 110 252T240 246T370 256V268Q300 258 220 262T90 262T-10 270Z" fill="${SNOW_SHADE}" opacity=".45"/>`;
  } else {
    const r = rng(59 + s);
    const cl: Clump[] = [[8, 196, 22, 26], [6, 280, 34, 22], [352, 300, 30, 18], [356, 216, 16, 22], [120, 140, 28, 4], [276, 140, 30, 4]];
    if (s === 1) cl.push([60, 150, 30, 5], [330, 160, 24, 6], [200, 290, 40, 6]);
    o += scatter(r, cl, s === 1 ? 70 : 50, 1.6, 3.4, P.moss, 0.6, 0.45);
    // grass tufts: three tapered blades each
    let d = '';
    for (let k = 0; k < (s === 1 ? 24 : 16); k++) {
      const [cx, cy, rx, ry] = cl[k % cl.length];
      const x = cx + (r() - 0.5) * rx * 1.6;
      const y = cy + (r() - 0.5) * ry * 1.4;
      const h = 3 + r() * 3 + (y - 126) / 60;
      for (let j = 0; j < 3; j++) d += leaf(x + j * 0.8, y, h * (0.7 + j * 0.15), -90 + (j - 1) * 24 + (r() - 0.5) * 16, 0.45);
    }
    o += `<path d="${d}" fill="${P.moss[2]}" opacity=".85"/>`;
  }
  o += fence(c);
  return o;
}

/** A veil of air between the back of the garden and the middle: distance, softly. */
function haze(c: C): string {
  const col = c.night ? '#3c4680' : c.pal.mist;
  const a = c.night ? 0.16 : c.s === 3 ? 0.2 : 0.26;
  return `<rect y="92" width="360" height="104" fill="${linY(c, 'haze', 92, 196, [[0, col, 0], [0.3, col, a], [0.62, col, a * 0.55], [1, col, 0]])}" pointer-events="none"/>`;
}

/** Our own eaves across the top: tile ends in a row, the corner lifting at the right. */
const eaveY = (x: number) => 11 - Math.max(0, (x - 270) / 90) ** 2 * 15 + Math.sin(x / 40) * 0.4;

function eaves(c: C): string {
  const pts: Pt[] = [];
  for (let x = -10; x <= 372; x += 6) pts.push([x, eaveY(x)]);
  let o = `<path d="M-10 -10H372${smooth([...pts].reverse(), false)}Z" fill="${c.night ? '#1e1c26' : '#2f2a28'}"/>`;
  // rafter shadow band and the round tile ends
  const ends: Dab[] = [];
  const rims: Dab[] = [];
  const cores: Dab[] = [];
  for (let x = -6; x <= 368; x += 7.2) {
    if (!seen(c, x)) continue;
    const y = eaveY(x);
    ends.push([x, y - 0.6, 2.8]);
    rims.push([x, y - 0.9, 1.65]);
    cores.push([x, y - 0.9, 1.15]);
  }
  o += dabs(ends, c.night ? '#2a2733' : '#3d3734') + dabs(rims, c.night ? '#4a4558' : '#6b625b') + dabs(cores, c.night ? '#2a2733' : '#3d3734');
  if (c.s === 3) {
    // a few icicles
    let d = '';
    const r = rng(61);
    for (let x = 20; x < 350; x += 18 + r() * 26) {
      const y = eaveY(x) + 1.6;
      const h = 3 + r() * 6;
      d += `M${n1(x - 0.9)} ${n1(y)}L${n1(x)} ${n1(y + h)}L${n1(x + 0.9)} ${n1(y)}Z`;
    }
    o += `<path d="${d}" fill="#e8f0f6" opacity=".9"/>`;
  }
  return o;
}

/** A brushwood fence (싸리 울타리) along the back, with a little twig gate. */
function fence(c: C): string {
  const r = rng(71);
  const tw = c.s === 3 ? '#8a7f74' : c.s === 2 ? '#9a7f5c' : '#8f7a5c';
  let d = '';
  for (let x = -8; x < 368; x += 1.3 + r() * 0.9) {
    if (x > 96 && x < 113) continue;
    const top = 115 + Math.sin(x / 13) * 0.8 + r() * 2.4;
    d += `M${nums([x, 131])}l${nums([(r() - 0.5) * 1.6, top - 131])}`;
  }
  let o = `<path d="${d}" stroke="${tw}" stroke-width=".55" opacity=".9"/>`;
  o += `<path d="M-8 120.4Q180 119.4 368 120.6M-8 126.4Q180 125.6 368 126.8" stroke="#6a5844" stroke-width=".9" fill="none"/>`;
  // gate posts and a woven panel, standing a little ajar
  o += `<path d="M95 132V111.6h2.2V132ZM112 132V111.6h2.2V132Z" fill="#6a5440"/>`;
  let g = '';
  for (let x = 98.6; x < 109.8; x += 1.1) g += `M${n1(x)} 130.6L${n1(x + 0.6)} ${n1(115.6 + r())}`;
  o += `<path d="M98 130.8L110 129.6V115.4L98 116.4Z" fill="${c.s === 3 ? '#cfd5da' : '#c9b48c'}" opacity=".5"/><path d="${g}" stroke="${tw}" stroke-width=".6"/>`;
  o += `<path d="M98 119.6L110 118.6M98 126L110 125" stroke="#5c4a38" stroke-width=".8"/>`;
  if (c.s === 3) o += `<path d="${snowAlong(r, [[-8, 116.6], [96, 116.2]], 1.5, 3)}${snowAlong(r, [[114, 116.4], [368, 116.8]], 1.5, 3)}"${SNOW_STROKE}/>`;
  return o + shadow(180, 132, 200, 2.4, 0.1);
}

/** The maru (wooden veranda) we sit on: its edge across the bottom, a stone step, white rubber shoes. */
function maru(c: C): string {
  const top = 284;
  let o = `<path d="M-10 ${top + 2}H370V${top + 7}H-10Z" fill="#3a2e22" opacity=".14"/>`;
  // stepping slab (댓돌) with a pair of white gomusin
  o += `<path d="M154 ${top + 2}L159 ${top - 9}H221L226 ${top + 2}Z" fill="${stoneFill(c, 'step', '#d4cdbf', '#9a9285')}"/><path d="M159 ${top - 9}H221" stroke="#ebe5d8" stroke-width=".7"/>`;
  o += `<path d="M154 ${top + 2}L159 ${top - 9}M221 ${top - 9}L226 ${top + 2}" stroke="#857d71" stroke-width=".5"/>`;
  const shoe = (x: number, y: number, rot: number) =>
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(1.45)"><path d="M-4.6 0C-5 -1.6 -4 -2.6 -2.6 -2.6C-1 -2.8 2 -2.4 3.6 -2.8C4.6 -2.4 5 -.8 4.4 0Z" fill="#f6f3ec"/>` +
    `<path d="M-3.6 -2.1C-2 -1.2 1.6 -1.2 3.1 -2.2" stroke="#aca596" stroke-width=".45" fill="none"/><path d="M3.6 -2.8C4.4 -3.7 4.9 -3.5 5.1 -2.8" stroke="#ebe7de" stroke-width=".8" fill="none"/>` +
    `<path d="M-4.4 0H4.4" stroke="#b8b1a2" stroke-width=".4"/></g>`;
  o += shoe(181, top - 3.2, -3) + shoe(197, top - 1.6, 4);
  // the floor boards, converging a little toward the courtyard
  o += `<path d="M-10 ${top}H370V310H-10Z" fill="${linY(c, 'maru', top, 300, [[0, '#a98058'], [0.3, '#93693f'], [1, '#7a5332']])}"/>`;
  let seams = '';
  for (let k = -6; k <= 6; k++) seams += `M${n1(180 + k * 30)} ${top + 1.6}L${n1(180 + k * 37)} 300`;
  o += `<path d="${seams}" stroke="#5e4028" stroke-width=".6" opacity=".55"/>`;
  o += `<path d="M-10 ${top}H370" stroke="#cfab7e" stroke-width="1.2"/><path d="M-10 ${top + 1.7}H370" stroke="#5e4028" stroke-width=".5" opacity=".5"/>`;
  o += `<path d="M20 ${top + 7}q30 -1 60 0M230 ${top + 10}q40 -1 70 .4M110 ${top + 12}q20 -.6 44 0" stroke="#c7a37a" stroke-width=".5" fill="none" opacity=".5"/>`;
  return o;
}

/** The house post at the left edge. */
function post(c: C): string {
  const wood = c.night ? '#3e3028' : '#5a4232';
  return `<path d="M-4 -2H7V300H-4Z" fill="${wood}"/><path d="M5.4 -2V300" stroke="#8a6a50" stroke-width=".8" opacity=".8"/><path d="M-4 ${eaveY(0) + 6}H7" stroke="#2a201a" stroke-width="2" opacity=".5"/>`;
}

/* ───────────────────────── items ───────────────────────── */

function wall(c: C): string {
  const r = rng(101);
  const top = 104;
  const bot = 134;
  const mortar = c.s === 3 ? '#cfc9bd' : c.s === 2 ? '#cdb898' : '#c8b89b';
  let o = shadow(180, bot + 2, 200, 4, 0.12);
  o += `<path d="M-6 ${top}H366V${bot}H-6Z" fill="${mortar}"/>`;
  const tones = c.s === 3 ? ['#9a9a96', '#b1b0aa', '#85847f'] : ['#a19888', '#b7ad9b', '#8b8274'];
  // field stones as capsules (round-capped strokes): a shade below, the stone, a lit top, dry-brush grain
  const groups: Dab[][] = [[], [], []];
  const shade: Dab[] = [];
  const lit: Dab[] = [];
  const grain: Clump[] = [];
  const rows = [109, 117.5, 125.5, 132];
  rows.forEach((ry, ri) => {
    let x = -8 + r() * 6 + (ri % 2) * 5;
    while (x < 370) {
      const w = 8 + r() * 8;
      const h = (ri === 3 ? 2.6 : 3.4) + r() * 1;
      const cy = ry + (r() - 0.5) * 1.2;
      const x0 = x + h + 0.3;
      const len = Math.max(0, w - 2 * h - 0.6);
      const tone = Math.floor(r() * 3);
      const gr = r() < 0.5;
      if (seen(c, x0) || seen(c, x0 + len)) {
        shade.push([x0 + 0.5, cy + 0.8, h + 0.2, len]);
        groups[tone].push([x0, cy, h, len]);
        lit.push([x0 - h * 0.25, cy - h * 0.42, h * 0.42, len * 0.75]);
        if (gr) grain.push([x0 + len * 0.5, cy + h * 0.15, len * 0.4 + 1, h * 0.35]);
      }
      x += w + 0.6 + r() * 1.2;
    }
  });
  o += dabs(shade, '#5f574c', 0.4);
  o += groups.map((g, i) => dabs(g, tones[i])).join('');
  o += dabs(lit, c.s === 3 ? '#d2d2cd' : '#cfc6b4', 0.55);
  o += `<path d="${streaks(r, grain, grain.length, 4, 0, 0.3, 10)}" fill="#4e463d" opacity=".4"/>`;
  if (c.s < 2) {
    o += scatter(r, [[40, 132, 40, 2], [150, 133, 50, 2], [300, 132, 40, 2], [210, 112, 20, 3]], 40, 0.8, 1.8, c.pal.moss, 0.7, 0.6);
  }
  // tiled cap: plaster band, tiles, ridge, round tile ends
  const tile = c.s === 3 ? '#575a60' : '#4b4844';
  o += `<path d="M-6 ${top + 3}H366V${top - 1}H-6Z" fill="#e9e3d6"/>`;
  o += `<path d="M-6 ${top}L-6 ${top - 8}Q180 ${top - 9.5} 366 ${top - 8}L366 ${top}Z" fill="${tile}"/>`;
  let ribs = '';
  for (let x = -4; x < 366; x += 4.6) if (seen(c, x)) ribs += `M${nums([x, top - 0.6])}l.6-7`;
  o += `<path d="${ribs}" stroke="#36332f" stroke-width="1.1" opacity=".55"/>`;
  o += `<path d="M-6 ${top - 8.5}Q180 ${top - 10} 366 ${top - 8.5}V${top - 11}Q180 ${top - 12.5} -6 ${top - 11}Z" fill="#3c3936"/>`;
  o += `<path d="M-6 ${top - 9.2}Q180 ${top - 10.7} 366 ${top - 9.2}" stroke="#e6e0d3" stroke-width=".7" fill="none" opacity=".8"/>`;
  const ends: Dab[] = [];
  for (let x = -4; x < 366; x += 4.6) if (seen(c, x)) ends.push([x + 0.3, top + 0.2, 1.8]);
  o += dabs(ends, '#3a3734');
  o += `<path d="M-6 ${top + 2}H366V${top + 5}H-6Z" fill="#3a2e22" opacity=".14"/>`;
  if (c.s === 3) {
    const sr = rng(103);
    const pts: Pt[] = [];
    for (let x = -6; x <= 366; x += 6) pts.push([x, top - 10.5 + Math.sin(x / 9) * 0.4]);
    o += `<path d="M-6 ${top - 9}${smooth(pts, false).slice(1)}L366 ${top - 3}Q180 ${top - 5} -6 ${top - 3}Z" fill="${SNOW}"/>`;
    o += `<path d="${snowAlong(sr, [[-6, top - 2], [366, top - 2]], 2, 6)}"${SNOW_STROKE}/>`;
  }
  return o;
}

function bamboo(c: C): string {
  const r = rng(111);
  const stalks: [number, number, number, number][] = [
    [3, 3, 4.4, -14], [12, -1, 3.4, -6], [21, 4, 4.8, -16], [29, 2, 3, 6], [37, 6, 4, -10], [45, 4, 3.2, 14], [52, 8, 2.6, 34],
  ];
  const base = 150;
  const cols = c.pal.bamboo;
  const stalkCol = c.s === 2 ? ['#93a15e', '#7f9050'] : c.s === 3 ? ['#6f8a62', '#5e7856'] : ['#7d9a5e', '#69874f'];
  const groups = ['', ''];
  stalks.forEach(([x, lean, w, topY], i) => {
    let st = `<path d="${branch([[x, base], [x + lean * 0.3, (base + topY) / 2], [x + lean, topY]], w, w * 0.6)}" fill="${stalkCol[i % 2]}"${ol(0.35, 0.55)}/>`;
    // shaded right side and a thin lit edge
    st += `<path d="${branch([[x + w * 0.28, base], [x + lean * 0.3 + w * 0.24, (base + topY) / 2], [x + lean + w * 0.18, topY]], w * 0.36, w * 0.2)}" fill="#3f5a36" opacity=".35"/>`;
    st += `<path d="M${n1(x - w * 0.3)} ${base}Q${n1(x + lean * 0.3 - w * 0.26)} ${n1((base + topY) / 2)} ${n1(x + lean - w * 0.18)} ${n1(topY)}" stroke="#e4ecc8" stroke-width=".4" fill="none" opacity=".45"/>`;
    // node rings
    let nodes = '';
    for (let y = base - 10; y > topY + 6; y -= 11 + (i % 3)) {
      const t = (base - y) / (base - topY);
      const nx = x + lean * t;
      const ww = (w - w * 0.4 * t) / 2;
      nodes += `M${n1(nx - ww)} ${n1(y)}h${n1(ww * 2)}`;
    }
    st += `<path d="${nodes}" stroke="#40553a" stroke-width=".7" opacity=".55"/><path d="${nodes.replace(/M([\d.-]+) ([\d.-]+)/g, (_, a, b) => `M${a} ${n1(Number(b) - 0.9)}`)}" stroke="#d9e2bf" stroke-width=".5" opacity=".45"/>`;
    // leaf sprays
    let lv = ['', '', ''];
    for (let k = 0; k < 3; k++) {
      const y = topY + 8 + k * 22 + r() * 8;
      if (y > 112) break;
      const t = (base - y) / (base - topY);
      const nx = x + lean * t;
      const dir = r() < 0.5 ? -1 : 1;
      for (let j = 0; j < 5; j++) {
        const ang = dir > 0 ? 18 + j * 22 + r() * 10 : 162 - j * 22 - r() * 10;
        lv[Math.floor(r() * 3)] += leaf(nx, y, 8 + r() * 5, ang, 1.4 + r() * 0.5);
      }
    }
    st += lv.map((d, j) => `<path d="${d}" fill="${cols[j]}"/>`).join('');
    if (c.s === 3) {
      let sn = '';
      for (let k = 0; k < 3; k++) sn += ell(x + lean * 0.7 + (r() - 0.5) * 10, topY + 16 + k * 20 + r() * 6, 2.4 + r() * 1.5, 1 + r() * 0.5);
      st += `<path d="${sn}" fill="${SNOW}"/>`;
    }
    groups[i % 2] += st;
  });
  return (
    shadow(26, 150, 30, 3, 0.14) +
    `<g class="ga ga-sway">${groups[0]}</g><g class="ga ga-sway ga-sway--b">${groups[1]}</g>` +
    (c.s === 3 ? '' : scatter(r, [[26, 150, 26, 2.4]], 16, 1, 2.2, c.pal.moss.length ? c.pal.moss : ['#8a9a7a'], 0.8, 0.6))
  );
}

function swing(c: C): string {
  const wood = '#5e4636';
  const woodL = '#7d604a';
  const x = 70;
  const y = 160;
  let o = shadow(x, y, 22, 3, 0.12);
  o += `<path d="${branch([[x - 18, y], [x - 16, y - 96]], 3.6, 2.8)}" fill="${wood}"${ol(0.45, 0.7)}/><path d="${branch([[x + 18, y - 1], [x + 16, y - 96]], 3.6, 2.8)}" fill="${wood}"${ol(0.45, 0.7)}/>`;
  o += `<path d="M${x + 17.4} ${y - 2}L${x + 16.4} ${y - 94}" stroke="#3e2c22" stroke-width="1.2" opacity=".35"/>`;
  o += `<path d="M${x - 17.6} ${y}L${x - 16.4} ${y - 95}" stroke="${woodL}" stroke-width=".7" opacity=".7"/>`;
  o += `<path d="M${x - 23} ${y - 98.5}Q${x} ${y - 100} ${x + 23} ${y - 98.5}L${x + 23} ${y - 95.5}Q${x} ${y - 97} ${x - 23} ${y - 95.5}Z" fill="${wood}"${ol(0.45, 0.7)}/><path d="M${x - 22} ${y - 98.4}Q${x} ${y - 99.8} ${x + 22} ${y - 98.4}" stroke="${woodL}" stroke-width=".5" fill="none"/>`;
  o += `<path d="M${x - 9} ${y - 96.6}h4M${x + 5} ${y - 96.6}h4" stroke="#8a7350" stroke-width="2.6" stroke-linecap="round"/><path d="M${x - 8.4} ${y - 97.6}l1.4 2M${x - 6.6} ${y - 97.6}l1.4 2M${x + 5.6} ${y - 97.6}l1.4 2M${x + 7.4} ${y - 97.6}l1.4 2" stroke="#5e4a30" stroke-width=".35"/>`;
  o += `<path d="M${x - 18} ${y - 97}l3 2.4M${x - 18} ${y - 95}l3 -2.4M${x + 14} ${y - 97}l3 2.4M${x + 14} ${y - 95}l3 -2.4" stroke="#cdb68d" stroke-width=".6"/>`;
  // ropes + seat swing about the beam
  let sw = `<path d="M-7 0L-8.4 74M7 0L8.4 74" stroke="#b39a6c" stroke-width="1.15" fill="none"/>`;
  sw += `<path d="M-7.3 0L-8.7 74M6.7 0L8.1 74" stroke="#8a7350" stroke-width=".45" fill="none" opacity=".8"/>`;
  sw += `<path d="M-6.8 0L-8.2 74M7.2 0L8.6 74" stroke="#ddc89c" stroke-width=".35" fill="none" opacity=".8"/>`;
  sw += `<path d="M-9.4 70.6q1 1.6 0 2.8M7.4 70.6q1 1.6 0 2.8" stroke="#8a7350" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  sw += `<path d="M-12 73.4L12 73.4L11 76.6L-11 76.6Z" fill="${lin(c, 'seat', [[0, '#9a7a5a'], [1, '#6e5038']])}"${ol(0.45, 0.8)}/><path d="M-11 74.6q6 -.5 12 0t9 .2" stroke="#c9ab84" stroke-width=".35" fill="none" opacity=".7"/>`;
  if (c.s === 3) sw += `<path d="M-11.6 73.6Q0 71 11.6 73.6Z" fill="${SNOW}"/>`;
  o += `<g transform="translate(${x} ${y - 96})"><g class="ga ga-swing">${sw}</g></g>`;
  if (c.s === 3) o += `<path d="M${x - 23} ${y - 98.6}Q${x} ${y - 102.4} ${x + 23} ${y - 98.6}Q${x} ${y - 100.2} ${x - 23} ${y - 98.6}Z" fill="${SNOW}"/>`;
  if (c.s === 1 || c.s === 0) {
    // a little morning-glory vine on the left pole
    const r = rng(121);
    o += `<path d="M${x - 17} ${y}q2 -6 -1 -12t1 -12t-1 -10" stroke="#6f9455" stroke-width=".6" fill="none"/>`;
    o += scatter(r, [[x - 17, y - 18, 3, 14]], 10, 0.9, 1.6, ['#7aa060', '#5f8a4c'], 1, 0.8);
    if (c.s === 1) o += `<circle cx="${x - 15}" cy="${y - 22}" r="1.5" fill="#6f7fc0"/><circle cx="${x - 19}" cy="${y - 12}" r="1.3" fill="#8f78b8"/>`;
  }
  return o;
}

function plum(c: C): string {
  const r = rng(131);
  const ink = c.s === 3 ? '#3f3638' : '#46393a';
  const trunk: Pt[] = [[140, 150], [137, 134], [144, 118], [136, 102], [128, 90]];
  const limbs: [Pt[], number, number][] = [
    [[[137, 106], [120, 94], [106, 78], [96, 64]], 3.6, 0.6],
    [[[141, 114], [158, 100], [171, 92], [183, 78]], 3.4, 0.6],
    [[[128, 90], [124, 70], [130, 56]], 2.6, 0.5],
    [[[143, 120], [160, 121], [176, 113]], 2, 0.4],
    [[[112, 90], [100, 92], [86, 86]], 1.6, 0.4],
    [[[164, 97], [168, 82], [164, 70]], 1.4, 0.4],
  ];
  let o = shadow(140, 150, 22, 3, 0.14) + (c.s === 1 ? `<path d="${blob(r, 156, 154, 30, 4.4)}" fill="#3a3a26" opacity=".1"/>` : '');
  o += `<path d="${branch(trunk, 8, 3.4, true)}" fill="${ink}"/>`;
  o += limbs.map(([p, a, b]) => `<path d="${branch(p, a, b, true)}" fill="${ink}"/>`).join('');
  // knots and bark highlights; lichen on the old trunk
  if (c.s < 3) o += `<path d="${blob(r, 137.6, 128, 1.4, 3)}${blob(r, 139, 142, 1.2, 2.4)}" fill="#9aa47a" opacity=".7"/>`;
  o += `<path d="M138 140l2 -6M141 128l-2 -5M136 112l2 -4" stroke="#7a6a68" stroke-width=".7" opacity=".6"/>`;
  const tips: Pt[] = [[96, 64], [183, 78], [130, 56], [176, 113], [86, 86], [164, 70], [106, 78], [120, 94], [158, 100], [171, 92], [124, 70], [100, 92], [160, 121], [168, 82]];
  // twigs: short straight shoots
  let tw = '';
  for (const [x, y] of tips) {
    const a = -Math.PI / 2 + (r() - 0.5) * 1.6;
    tw += `M${x} ${y}l${n1(Math.cos(a) * (4 + r() * 4))} ${n1(Math.sin(a) * (4 + r() * 4))}`;
  }
  o += `<path d="${tw}" stroke="${ink}" stroke-width=".7" fill="none"/>`;
  const along = (n: number) => {
    const pts: Pt[] = [];
    for (let k = 0; k < n; k++) {
      const [p] = limbs[Math.floor(r() * limbs.length)];
      const i = Math.floor(r() * (p.length - 1));
      const t = r();
      pts.push([p[i][0] + (p[i + 1][0] - p[i][0]) * t + (r() - 0.5) * 3, p[i][1] + (p[i + 1][1] - p[i][1]) * t + (r() - 0.5) * 3]);
    }
    return pts.concat(tips.map(([x, y]) => [x + (r() - 0.5) * 2, y + (r() - 0.5) * 2] as Pt));
  };
  if (c.s === 0) {
    const fl = plumDef(c);
    const fills = ['#fbf1f2', '#f6dfe3', '#efc8d0', '#fbeaec'];
    let b = '';
    let buds = '';
    for (const [x, y] of along(36)) {
      if (r() < 0.22) buds += ell(x, y, 1.1, 1.1);
      else b += use(fl, x, y, 0.75 + r() * 0.35, r() * 72, fills[Math.floor(r() * fills.length)]);
    }
    o += b + `<path d="${buds}" fill="#d98a9d"/>`;
    // fallen petals
    o += scatterDabs(r, [[140, 154, 26, 4]], 14, 0.8, 1.2, '#f3d6dc', 0.9);
  } else if (c.s === 1) {
    const cl: [number, number, number, number][] = [[104, 76, 14, 9], [126, 64, 10, 9], [168, 86, 16, 9], [150, 104, 12, 7], [118, 92, 12, 6], [176, 110, 8, 5]];
    o += foliage(r, cl, 70, 1.8, ['#5f8a4f', '#729a5b'], ['#8ab56c', '#a3c47f']);
    o += `<path d="${along(10).map(([x, y]) => ell(x, y + 2, 1.2, 1.2)).join('')}" fill="#b9c46a"/>`;
  } else if (c.s === 2) {
    const cl: [number, number, number, number][] = [[104, 78, 12, 8], [168, 88, 14, 8], [140, 104, 12, 6], [126, 66, 8, 7]];
    o += scatter(r, cl, 34, 1, 1.8, ['#c9a85a', '#b98d4a', '#a8a050'], 0.9, 0.6);
  } else {
    const fl = plumDef(c);
    o += `<path d="${snowAlong(r, trunk, 6)}${limbs.map(([p, a]) => snowAlong(r, p, a)).join('')}"${SNOW_STROKE}/>`;
    let b = '';
    for (const [x, y] of tips.slice(0, 7)) b += use(fl, x + 1, y + 2, 0.7, r() * 72, r() < 0.5 ? '#c84b5c' : '#d6697a');
    o += b;
  }
  return o;
}

function persimmon(c: C): string {
  const r = rng(141);
  const bark = c.s === 3 ? '#4e4542' : '#54443c';
  const trunk: Pt[] = [[334, 152], [332, 130], [327, 112], [323, 94]];
  const limbs: [Pt[], number, number][] = [
    [[[326, 104], [308, 92], [292, 84], [278, 82]], 4.4, 0.8],
    [[[323, 94], [318, 72], [322, 52], [316, 32]], 4, 1],
    [[[328, 110], [346, 96], [358, 82], [370, 74]], 4.4, 1],
    [[[320, 80], [302, 62], [288, 52]], 2.6, 0.6],
    [[[320, 62], [338, 46], [350, 30]], 2.2, 0.5],
    [[[300, 88], [290, 100], [284, 108]], 1.6, 0.4],
  ];
  let o = shadow(334, 153, 24, 3.2, 0.15) + (c.s < 3 ? `<path d="${blob(r, 336, 158, 34, 5.4, 9)}" fill="#3a3a26" opacity=".1"/>` : '');
  o += `<path d="${branch(trunk, 10, 5)}" fill="${bark}"/>`;
  o += `<path d="M330 148q-2 -8 0 -16M333 128q2 -6 -1 -12" stroke="#7d6c62" stroke-width=".8" fill="none" opacity=".6"/>`;
  o += limbs.map(([p, a, b]) => `<path d="${branch(p, a, b)}" fill="${bark}"/>`).join('');
  o += `<path d="${streaks(r, [[331, 136, 2, 12], [327, 108, 1.6, 8]], 6, 7, -92, 0.4, 10)}" fill="#8f7d70" opacity=".6"/>`;
  let tw = '';
  for (const [p] of limbs) {
    const [x, y] = p[p.length - 1];
    for (let k = 0; k < 2; k++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
      tw += `M${x} ${y}q${n1(Math.cos(a) * 3)} ${n1(Math.sin(a) * 3 - 1)} ${n1(Math.cos(a) * 7)} ${n1(Math.sin(a) * 7)}`;
    }
  }
  o += `<path d="${tw}" stroke="${bark}" stroke-width=".7" fill="none"/>`;
  const cl: [number, number, number, number][] = [
    [292, 76, 18, 11], [316, 52, 18, 15], [342, 58, 20, 15], [334, 86, 22, 11], [306, 92, 14, 7], [352, 34, 12, 10], [300, 52, 10, 9], [362, 78, 10, 10],
  ];
  const fruitAt = (n: number) => {
    let f = '';
    let hi = '';
    let cx = '';
    for (let k = 0; k < n; k++) {
      const [x0, y0, rx, ry] = cl[Math.floor(r() * cl.length)];
      const x = x0 + (r() - 0.5) * rx * 1.6;
      const y = y0 + (r() - 0.2) * ry * 1.1;
      f += ell(x, y, 2.5, 2.3);
      hi += ell(x - 0.8, y - 0.7, 0.7, 0.5);
      cx += `M${n1(x - 1.4)} ${n1(y - 2)}h2.8M${n1(x)} ${n1(y - 2.8)}v1.4`;
    }
    return `<path d="${f}" fill="#e57f2a"${ol(0.35, 0.7)}/><path d="${f}" fill="${lin(c, 'fruitsh', [[0, '#000', 0], [0.55, '#000', 0], [1, '#7a2a10', 0.45]])}"/><path d="${hi}" fill="#fbd29a" opacity=".9"/><path d="${cx}" stroke="#4d5a30" stroke-width=".8" stroke-linecap="round"/>`;
  };
  if (c.s === 0) o += foliage(r, cl, 110, 2.7, ['#93b56c', '#a9c47f'], ['#c0d690', '#d3e2a6'], 0.95);
  else if (c.s === 1) o += foliage(r, cl, 140, 2.7, ['#3e6844', '#4f7a4f'], ['#6b9160', '#86a873']) + fruitAt(8).replace(/#e57f2a/, '#a9b866').replace(/#f8c37c/, '#d3dc96');
  else if (c.s === 2) o += foliage(r, cl, 120, 2.3, ['#b8502e', '#cf7a38', '#c4552f'], ['#e0ad4f', '#e8c070', '#d99a48'], 0.92) + fruitAt(24);
  else {
    o += `<path d="${snowAlong(r, trunk, 8)}${limbs.map(([p, a]) => snowAlong(r, p, a)).join('')}"${SNOW_STROKE}/>`;
    o += fruitAt(7);
  }
  return o;
}

function pavilion(c: C): string {
  const x = 238;
  const y = 158;
  const T = (dx: number, dy: number) => `${n1(x + dx)} ${n1(y + dy)}`;
  const post = '#7c4a37';
  const postD = '#5e3829';
  const wood = '#8a6a4f';
  const roof = c.s === 3 ? '#565a61' : '#4a4845';
  let o = shadow(x + 3, y + 1, 50, 5, 0.16);
  // stone plinth
  o += `<path d="M${T(-42, -6)}L${T(42, -6)}L${T(48, -13)}L${T(-36, -13)}Z" fill="${c.s === 3 ? '#eef0f0' : '#cfc6b5'}"/>`;
  o += `<path d="M${T(-42, -6)}L${T(42, -6)}L${T(42, 0)}L${T(-42, 0)}Z" fill="${stoneFill(c, 'plinth', '#b9b0a0', '#8d8476')}"${ol(0.5, 0.6)}/><path d="M${T(42, -6)}L${T(48, -13)}L${T(48, -7)}L${T(42, 0)}Z" fill="#7d7468"/>`;
  o += `<path d="M${T(-42, -3)}H${x + 42}M${T(-20, -6)}V${y}M${T(6, -6)}V${y}M${T(28, -6)}V${y}" stroke="#6e665b" stroke-width=".5" opacity=".6"/>`;
  // back posts, floor, under-floor
  o += `<path d="M${T(-30, -13)}V${y - 56}h2.6V${y - 13}ZM${T(40, -13)}V${y - 56}h2.6V${y - 13}Z" fill="${postD}"/>`;
  o += `<path d="M${T(-36, -13)}L${T(46, -13)}L${T(40, -18)}L${T(-38, -18)}Z" fill="#2f2621" opacity=".55"/>`;
  o += `<path d="M${T(-38, -21)}L${T(38, -21)}L${T(45, -29)}L${T(-31, -29)}Z" fill="#a7865f"/>`;
  o += `<path d="M${T(-38, -21)}L${T(38, -21)}L${T(38, -17)}L${T(-38, -17)}Z" fill="${wood}"/><path d="M${T(38, -21)}L${T(45, -29)}L${T(45, -25)}L${T(38, -17)}Z" fill="#6f5440"/>`;
  let boards = '';
  for (let k = 1; k < 9; k++) boards += `M${T(-38 + k * 8.4, -21)}L${T(-31 + k * 8.4, -29)}`;
  o += `<path d="${boards}" stroke="#8a6c4c" stroke-width=".45" opacity=".7"/>`;
  // stone steps
  o += `<path d="M${T(-9, -6)}h18v-6h-18Z" fill="#b2a998"/><path d="M${T(-11, 0)}h22v-4h-22Z" fill="#c8bfae"/><path d="M${T(-9, -12)}h18v-2h-18ZM${T(-11, -4)}h22v-1h-22Z" fill="#e3dccd" opacity=".7"/>`;
  // interior shadow under the roof
  o += `<path d="M${T(-34, -52)}L${T(40, -52)}L${T(44, -56)}L${T(-28, -56)}Z" fill="#2c2420" opacity=".55"/>`;
  // railing
  let bal = '';
  for (let k = 0; k <= 12; k++) {
    const bx = -36 + k * 6;
    if (bx > -9 && bx < 9) continue;
    bal += `M${T(bx, -21)}v-6`;
  }
  o += `<path d="${bal}M${T(38, -21)}l7 -8M${T(38, -27)}l7 -8" stroke="${postD}" stroke-width=".9"/>`;
  o += `<path d="M${T(-37, -27.5)}H${x - 9}M${T(9, -27.5)}H${x + 38}l7 -8" stroke="${post}" stroke-width="1.4" fill="none"/>`;
  // front posts
  o += `<path d="M${T(-35, -6)}V${y - 52}h3.4V${y - 6}ZM${T(33, -6)}V${y - 52}h3.4V${y - 6}Z" fill="${post}"${ol(0.45, 0.7)}/><path d="M${T(-33, -8)}V${y - 50}M${T(35.4, -8)}V${y - 50}" stroke="#3e2419" stroke-width=".9" opacity=".45"/>`;
  o += `<path d="M${T(-34.4, -6)}V${y - 51}M${T(33.6, -6)}V${y - 51}" stroke="#a46a52" stroke-width=".7"/>`;
  o += `<path d="M${T(-36, -6)}h5.4v-2h-5.4ZM${T(32, -6)}h5.4v-2h-5.4Z" fill="#a69d8d"/>`;
  // lintel and dancheong band
  o += `<path d="M${T(-38, -50)}H${x + 40}v-3.4H${x - 38}Z" fill="${postD}"/><path d="M${T(-38, -53.4)}H${x + 40}v-2.6H${x - 38}Z" fill="#5f7f78"/>`;
  o += `<path d="M${T(-38, -54.4)}H${x + 40}" stroke="#c07a52" stroke-width=".7"/><path d="M${T(-38, -52.4)}H${x + 40}" stroke="#e4d6b0" stroke-width=".4" opacity=".7"/>`;
  // roof: lifted corners, hip planes, ridge
  const L: Pt = [x - 62, y - 66];
  const R: Pt = [x + 66, y - 66];
  const eave = `M${n1(L[0])} ${n1(L[1])}C${T(-50, -57)} ${T(-30, -55)} ${T(2, -55)}C${T(32, -55)} ${T(54, -57)} ${n1(R[0])} ${n1(R[1])}`;
  // concave hips sweeping up to the lifted corners; the tiles catch light toward the ridge
  const roofFill = c.s === 3 ? roof : linY(c, 'proof', y - 92, y - 55, [[0, '#67635e'], [0.55, '#4d4a46'], [1, '#3b3936']]);
  o += `<path d="${eave}Q${T(40, -72)} ${T(32, -91)}L${T(-28, -91)}Q${T(-38, -72)} ${n1(L[0])} ${n1(L[1])}Z" fill="${roofFill}"${ol(0.6, 0.8)}/>`;
  // side hip (right) a shade lighter
  o += `<path d="M${n1(R[0])} ${n1(R[1])}Q${T(40, -72)} ${T(32, -91)}L${T(38, -84)}Q${T(46, -72)} ${n1(R[0])} ${n1(R[1])}Z" fill="#6d6965" opacity="${c.s === 3 ? 0 : 0.7}"/>`;
  // tile rows
  let rows = '';
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    const ex = x - 52 + t * 108;
    const ey = y - 56 - Math.abs(t - 0.5) * 3 - (t < 0.08 || t > 0.92 ? 4 : 0);
    const rx = x - 25 + t * 54;
    rows += `M${n1(ex)} ${n1(ey)}L${n1(rx)} ${y - 82}`;
  }
  o += `<path d="${rows}" stroke="#2f2d2b" stroke-width="1.2" opacity=".5"/>`;
  // gable triangle (hapgak)
  o += `<path d="M${T(-24, -82)}L${T(-14, -90)}L${T(-4, -82)}ZM${T(8, -82)}L${T(18, -90)}L${T(28, -82)}Z" fill="#6a564a" opacity=".0"/>`;
  // eave underside: rafters + dancheong
  o += `<path d="${eave}C${T(52, -55)} ${T(30, -52)} ${T(2, -52)}C${T(-30, -52)} ${T(-50, -54)} ${n1(L[0])} ${n1(L[1])}Z" fill="#6a8a84"/>`;
  let raft = '';
  for (let k = 1; k < 22; k++) {
    const t = k / 22;
    const ex = x - 58 + t * 120;
    raft += ell(ex, y - 54.2 - Math.abs(t - 0.5) ** 3 * 22, 0.6, 0.6);
  }
  o += `<path d="${raft}" fill="#e7d2a6" opacity=".85"/>`;
  // the eave's ink line, and a lacquered name board (현판) hung under it
  o += `<path d="${eave}" stroke="${INK}" stroke-width=".7" fill="none" opacity=".75"/>`;
  o += `<path d="M${T(-6, -51.6)}h12v5h-12Z" fill="#3a2a22"${ol(0.3, 0.8)}/><path d="M${T(-4.4, -49.4)}q1 -.6 2.2 .2M${T(-0.6, -50.4)}q.4 1.4 -.2 2.6M${T(2, -49.8)}q1.2 .2 2 -.4" stroke="#d9b56a" stroke-width=".4" fill="none" stroke-linecap="round" opacity=".85"/>`;
  // ridge with lifted ends
  o += `<path d="M${T(-30, -90)}Q${T(-33, -96)} ${T(-36, -97)}Q${T(-30, -93)} ${T(-24, -92.6)}H${x + 28}Q${T(34, -93)} ${T(40, -97)}Q${T(37, -96)} ${T(34, -90)}Z" fill="#33312f"${ol(0.4, 0.8)}/>`;
  o += `<path d="M${T(-27, -91.6)}H${x + 31}" stroke="#ece6d8" stroke-width=".8"/>`;
  if (c.s === 3) {
    o += `<path d="M${T(-30, -90)}L${T(34, -90)}L${T(50, -70)}Q${T(30, -66)} ${T(18, -69)}Q${T(4, -64)} ${T(-10, -68)}Q${T(-30, -64)} ${T(-46, -69)}Z" fill="${SNOW}"/>`;
    o += `<path d="M${T(-30, -92.5)}H${x + 33}" stroke="${SNOW}" stroke-width="2.4" stroke-linecap="round"/>`;
    o += `<path d="M${T(-41, -6.4)}L${T(41, -6.4)}L${T(47, -13)}L${T(-35, -13)}Z" fill="${SNOW}"/>`;
  }
  if (c.night) {
    c.light.push(
      glow(c, x + 2, y - 40, 46, '#f3b562', 0.85, 'ga ga-flicker') +
        `<path d="M${T(-36, -50)}H${x + 40}L${x + 46} ${y - 30}L${T(-36, -24)}Z" fill="#f2b25c" opacity=".12"/>` +
        `<path d="M${T(0, -50)}v4" stroke="#3a2a22" stroke-width=".5"/><path d="M${T(-2.6, -46)}h5.2l.6 6h-6.4Z" fill="#f6c36a"/><path d="M${T(-2.6, -46)}h5.2v1.2h-5.2Z" fill="#41658c"/>`,
    );
  }
  return o;
}

function onggi(c: C): string {
  const x = 316;
  const y = 176;
  let o = shadow(x, y, 34, 4, 0.16);
  // jangdokdae: a low stone platform
  o += `<path d="${ell(x, y - 6, 32, 7)}" fill="${c.s === 3 ? '#eef1f2' : '#cfc5b2'}"/>`;
  o += `<path d="M${x - 32} ${y - 6}a32 7 0 0 0 64 0v4a32 7 0 0 1 -64 0Z" fill="${stoneFill(c, 'plat', '#aea594', '#857d70')}"/>`;
  const r = rng(151);
  let st = '';
  for (let k = 0; k < 12; k++) {
    const a = Math.PI * (0.05 + (k / 11) * 0.9);
    st += ell(x - Math.cos(a) * 30, y - 3.4 + Math.sin(a) * 6.6, 2.2 + r() * 1.4, 1.5);
  }
  o += `<path d="${st}" fill="none" stroke="#6f685d" stroke-width=".4" opacity=".7"/>`;
  if (c.s < 3) o += `<path d="${blob(r, x - 26, y - 1.4, 5, 1.4)}${blob(r, x + 24, y - 0.6, 4, 1.2)}" fill="${c.pal.moss[0]}" opacity=".85"/>`;
  const jars: [number, number, number, number][] = [
    [x - 15, y - 9, 15, 19],
    [x + 3, y - 11, 17, 22],
    [x + 19, y - 8.5, 12, 15],
    [x - 6, y - 2, 11, 13],
    [x + 12, y - 1.5, 9, 10],
  ];
  const glaze = lin(c, 'glaze', [[0, '#5c3826'], [0.28, '#8a5a3b'], [0.4, '#6e4430'], [1, '#2f1b12']], 1, 0);
  for (const [jx, b, w, h] of jars) {
    const bw = w * 0.3;
    const sw = w * 0.5;
    const nw = w * 0.27;
    const d =
      `M${n1(jx - bw)} ${n1(b)}C${n1(jx - bw - w * 0.14)} ${n1(b - h * 0.25)} ${n1(jx - sw)} ${n1(b - h * 0.42)} ${n1(jx - sw)} ${n1(b - h * 0.62)}` +
      `C${n1(jx - sw)} ${n1(b - h * 0.84)} ${n1(jx - nw - w * 0.1)} ${n1(b - h * 0.93)} ${n1(jx - nw)} ${n1(b - h * 0.96)}L${n1(jx + nw)} ${n1(b - h * 0.96)}` +
      `C${n1(jx + nw + w * 0.1)} ${n1(b - h * 0.93)} ${n1(jx + sw)} ${n1(b - h * 0.84)} ${n1(jx + sw)} ${n1(b - h * 0.62)}` +
      `C${n1(jx + sw)} ${n1(b - h * 0.42)} ${n1(jx + bw + w * 0.14)} ${n1(b - h * 0.25)} ${n1(jx + bw)} ${n1(b)}Z`;
    o += `<path d="${d}" fill="${glaze}"${ol(0.5, 0.75)}/>`;
    o += `<path d="${leaf(jx - sw * 0.62, b - h * 0.22, h * 0.56, -96, w * 0.06)}" fill="#f0c89a" opacity=".42"/><path d="${leaf(jx + sw * 0.55, b - h * 0.28, h * 0.4, -84, w * 0.05)}" fill="#1c100a" opacity=".35"/>`;
    o += `<path d="M${n1(jx - nw)} ${n1(b - h * 0.95)}Q${n1(jx)} ${n1(b - h * 0.9)} ${n1(jx + nw)} ${n1(b - h * 0.95)}" stroke="#c49a6c" stroke-width=".5" fill="none" opacity=".7"/>`;
    // finger-drawn grass pattern on the shoulder
    const yy = b - h * 0.66;
    o += `<path d="M${n1(jx - sw * 0.7)} ${n1(yy)}q${n1(w * 0.08)} -${n1(h * 0.08)} ${n1(w * 0.16)} 0t${n1(w * 0.16)} 0t${n1(w * 0.16)} 0t${n1(w * 0.16)} 0" stroke="#b07d55" stroke-width=".5" fill="none" opacity=".55"/>`;
    // lid
    const ly = b - h * 0.96;
    o += `<path d="M${n1(jx - nw * 1.3)} ${n1(ly)}Q${n1(jx)} ${n1(ly - h * 0.2)} ${n1(jx + nw * 1.3)} ${n1(ly)}Q${n1(jx)} ${n1(ly + 1.2)} ${n1(jx - nw * 1.3)} ${n1(ly)}Z" fill="#4a2c1e"${ol(0.4, 0.75)}/><path d="M${n1(jx - nw * 0.9)} ${n1(ly - 0.5)}Q${n1(jx - nw * 0.3)} ${n1(ly - h * 0.14)} ${n1(jx)} ${n1(ly - h * 0.15)}" stroke="#8a5a3e" stroke-width=".5" fill="none"/>`;
    o += `<path d="${ell(jx, ly - h * 0.1, 0.9, 0.5)}" fill="#6e4430"/>`;
    if (c.s === 3) o += `<path d="M${n1(jx - nw * 1.25)} ${n1(ly - 0.4)}Q${n1(jx)} ${n1(ly - h * 0.3)} ${n1(jx + nw * 1.25)} ${n1(ly - 0.4)}Q${n1(jx)} ${n1(ly - h * 0.1)} ${n1(jx - nw * 1.25)} ${n1(ly - 0.4)}Z" fill="${SNOW}"/>`;
  }
  return o;
}

function deer(c: C): string {
  const x = 166;
  const y = 170;
  const coat = ['#a8724a', '#b0703f', '#9a6a48', '#7d6a5c'][c.s];
  const dark = ['#7a5034', '#7f4f2c', '#6f4c33', '#5c4d43'][c.s];
  const T = (dx: number, dy: number) => `${n1(x + dx)} ${n1(y + dy)}`;
  let o = shadow(x + 2, y, 15, 2.4, 0.16);
  // far legs
  o += `<path d="M${T(-6, -12)}L${T(-7.4, -1)}M${T(10, -12)}C${T(12, -8)} ${T(10.5, -5)} ${T(11.5, -0.6)}" stroke="${dark}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  // body
  o += `<path d="M${T(-11, -17)}C${T(-10, -22)} ${T(-2, -22.6)} ${T(6, -22)}C${T(12, -22)} ${T(16, -20)} ${T(15.6, -15)}C${T(15, -11.6)} ${T(12, -11)} ${T(8, -11.4)}C${T(2, -10.4)} ${T(-4, -11)} ${T(-8, -12)}C${T(-11, -13)} ${T(-11.6, -15)} ${T(-11, -17)}Z" fill="${coat}"${ol(0.45, 0.7)}/>`;
  o += `<path d="M${T(-9, -13)}C${T(-2, -11.6)} ${T(6, -11.6)} ${T(13, -12.4)}C${T(10, -14.6)} ${T(0, -14.4)} ${T(-9, -13)}Z" fill="${dark}" opacity=".4"/>`;
  o += `<path d="M${T(-8, -12.4)}C${T(-2, -11)} ${T(4, -11)} ${T(10, -11.8)}" stroke="#e8dcc6" stroke-width="1.2" fill="none" opacity=".6"/>`;
  // white rump
  o += `<path d="M${T(12.6, -20)}C${T(16.6, -19)} ${T(16.6, -14)} ${T(14, -12.6)}C${T(13, -15)} ${T(12, -17)} ${T(12.6, -20)}Z" fill="#f4eee2"/><path d="M${T(15.4, -19.6)}l1.4 2.6" stroke="#2c2622" stroke-width="1.2" stroke-linecap="round"/>`;
  // spots
  if (c.s < 3) {
    const r = rng(161);
    let sp = '';
    for (let k = 0; k < 13; k++) sp += ell(x - 6 + r() * 17, y - 20 + r() * 4.5, 0.6, 0.45);
    o += `<path d="${sp}" fill="#f6efe0" opacity="${c.s === 2 ? 0.45 : 0.85}"/>`;
  }
  // near legs
  o += `<path d="M${T(-8, -13)}L${T(-9, -0.6)}M${T(7, -12)}C${T(9.6, -8)} ${T(7.6, -5)} ${T(8.6, -0.6)}" stroke="${coat}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  o += `<path d="M${T(-9.6, -0.6)}h1.6M${T(8, -0.6)}h1.6M${T(-8, -1)}h1.4M${T(10.9, -0.8)}h1.4" stroke="#2c2622" stroke-width="1"/>`;
  // neck and head (looking toward us)
  o += `<path d="M${T(-11, -16)}C${T(-12.6, -22)} ${T(-13, -27)} ${T(-14, -31)}L${T(-9.4, -31.6)}C${T(-8.4, -26)} ${T(-6, -22)} ${T(-4, -20.4)}Z" fill="${coat}"${ol(0.4, 0.7)}/>`;
  o += `<path d="M${T(-15.6, -33.4)}C${T(-15, -36)} ${T(-9.6, -36.6)} ${T(-8.6, -33.6)}C${T(-8.6, -31)} ${T(-10.4, -28)} ${T(-12.2, -27)}C${T(-14, -28)} ${T(-15.8, -31)} ${T(-15.6, -33.4)}Z" fill="${coat}"${ol(0.4, 0.7)}/><path d="${ell(x - 12.2, y - 28.6, 1.8, 1.4)}" fill="#efe4d0" opacity=".85"/>`;
  o += `<path d="M${T(-13.2, -27.4)}C${T(-12.6, -26.6)} ${T(-11.8, -26.6)} ${T(-11.2, -27.4)}" stroke="#2c2622" stroke-width="1.4" stroke-linecap="round"/>`;
  o += `<circle cx="${n1(x - 14)}" cy="${n1(y - 32.4)}" r=".55" fill="#1f1a17"/><circle cx="${n1(x - 10)}" cy="${n1(y - 32.4)}" r=".55" fill="#1f1a17"/>`;
  // ears
  o += `<path d="M${T(-15.6, -34)}C${T(-19.6, -35)} ${T(-20.6, -33)} ${T(-19.6, -32)}C${T(-18, -32)} ${T(-16.4, -32.6)} ${T(-15.6, -34)}ZM${T(-8.6, -34)}C${T(-4.6, -35)} ${T(-3.6, -33)} ${T(-4.6, -32)}C${T(-6.2, -32)} ${T(-7.8, -32.6)} ${T(-8.6, -34)}Z" fill="${dark}"/>`;
  // antlers (in velvet in spring, gone in early winter? keep, they read as "deer")
  const ant = c.s === 0 ? '#a58466' : '#d9c8a6';
  o += `<path d="M${T(-14, -35.6)}C${T(-15.4, -39)} ${T(-17.6, -42)} ${T(-19.4, -45)}M${T(-15.6, -39.4)}l-3.6 -1M${T(-17.4, -42.4)}l-.4 -3.6M${T(-10.4, -35.6)}C${T(-9, -39)} ${T(-6.8, -42)} ${T(-5, -45)}M${T(-8.8, -39.4)}l3.6 -1M${T(-7, -42.4)}l.4 -3.6" stroke="${ant}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) scale(1.2) translate(${-x} ${-y})">${o}</g>`;
}

/* ── the pond and its company ── */

const POND: Pt[] = [
  [104, 205], [114, 189], [136, 177], [166, 171], [200, 169], [236, 171], [266, 177], [287, 190], [289, 206], [276, 221], [246, 231], [206, 234], [166, 232], [134, 225], [112, 216],
];

function pond(c: C): string {
  const s = c.s;
  const r = rng(171);
  const id = `${c.p}pondclip`;
  c.defs.set(id, `<clipPath id="${id}"><path d="${loop(POND)}"/></clipPath>`);
  const outer = POND.map(([x, y]) => [196 + (x - 196) * 1.05, 202 + (y - 202) * 1.1] as Pt);
  let o = `<path d="${loop(outer)}" fill="${s === 3 ? '#e4e8ea' : '#a89878'}" opacity="${s === 3 ? 0.9 : 0.55}"/>`;
  const water = c.night ? ['#4a5379', '#222a4a'] : c.pal.water;
  o += `<path d="${loop(POND)}" fill="${linY(c, 'water', 170, 234, [[0, water[1]], [0.18, water[0]], [1, water[1]]])}"/>`;
  o += `<g clip-path="url(#${id})">`;
  // the far bank reflected as a dark band; trees and the pavilion as soft smears
  o += `<path d="M100 172Q196 164 292 174V182Q196 175 100 182Z" fill="#3c4a48" opacity="${s === 3 ? 0.08 : 0.16}"/>`;
  if (c.has('pavilion')) o += `<path d="M204 177.4h68M208 180.6h60M212 183.8h52M218 187h40M224 190.2h28" stroke="#3c3a3a" stroke-width="2.2" stroke-linecap="round" opacity=".1"/>`;
  if (c.has('maple') && s !== 3) o += `<ellipse cx="128" cy="196" rx="26" ry="10" fill="${s === 2 ? '#c4553a' : '#5f8a58'}" opacity=".16"/>`;
  // ripples
  let rp = '';
  for (let k = 0; k < 9; k++) {
    const x0 = 120 + r() * 140;
    const y0 = 180 + r() * 46;
    rp += `M${n1(x0)} ${n1(y0)}h${n1(8 + r() * 18)}`;
  }
  o += `<path d="${rp}" stroke="${c.night ? '#8f9bd0' : '#ffffff'}" stroke-width=".6" opacity=".5" stroke-linecap="round"/>`;
  if (s === 3) {
    // thin ice: pale sheets and a few cracks
    o += `<path d="M110 200Q150 182 200 186T284 196L280 214Q240 226 196 226T116 214Z" fill="#f2f5f7" opacity=".55"/>`;
    o += `<path d="M150 200l12 4 8 -3M220 206l10 -4 14 3M240 192l-8 6" stroke="#b8c6d2" stroke-width=".5" fill="none"/>`;
  }
  o += `</g>`;
  o += `<path d="${loop(POND)}" fill="none" stroke="${s === 3 ? '#9aa6b2' : '#6e6450'}" stroke-width=".9" opacity=".45"/>`;
  // lotus pads
  if (s !== 3) {
    const padCol = s === 0 ? ['#a3bf7f', '#b9cf92'] : s === 1 ? ['#5f8f52', '#77a463'] : ['#a99a52', '#8f7f45'];
    const pads: [number, number, number][] = s === 0
      ? [[152, 186, 4], [160, 190, 3], [262, 214, 3.6], [250, 221, 2.8], [145, 222, 3]]
      : [[150, 186, 6.5], [162, 192, 5], [141, 194, 4], [262, 212, 6], [250, 221, 4.6], [272, 202, 4], [146, 220, 5], [158, 224, 3.6]];
    let pd = ['', ''];
    for (const [px, py, pr] of pads) {
      const a0 = r() * Math.PI * 2;
      const a1 = a0 + 0.5;
      const x0 = px + Math.cos(a0) * pr;
      const y0 = py + Math.sin(a0) * pr * 0.42;
      const x1 = px + Math.cos(a1) * pr;
      const y1 = py + Math.sin(a1) * pr * 0.42;
      pd[Math.floor(r() * 2)] += `M${n1(px)} ${n1(py)}L${n1(x1)} ${n1(y1)}A${n1(pr)} ${n1(pr * 0.42)} 0 1 1 ${n1(x0)} ${n1(y0)}Z`;
    }
    o += `<path d="${pd[0]}" fill="${padCol[0]}"${ol(0.3, 0.4)}/><path d="${pd[1]}" fill="${padCol[1]}"${ol(0.3, 0.4)}/>`;
    let vein = '';
    for (const [px, py, pr] of pads) for (const a of [0.6, 2, 3.4, 4.8]) vein += `M${n1(px)} ${n1(py)}l${n1(Math.cos(a) * pr * 0.8)} ${n1(Math.sin(a) * pr * 0.34)}`;
    o += `<path d="${vein}" stroke="${mix(padCol[0], '#1f2a1a', 0.3)}" stroke-width=".3" opacity=".6"/>`;
    if (s === 1) {
      // two lotus flowers and a bud
      for (const [lx, ly, ls] of [[156, 188, 1], [258, 209, 0.85]] as const) {
        o +=
          `<g transform="translate(${lx} ${ly}) scale(${ls})"><path d="M0 0C-5 -1 -7 -5 -6 -7C-3 -6 -1 -3 0 0ZM0 0C5 -1 7 -5 6 -7C3 -6 1 -3 0 0Z" fill="#e7a9b6"/>` +
          `<path d="M0 0C-3 -2 -3 -7 0 -9C3 -7 3 -2 0 0Z" fill="#f2c9d2"/><path d="M0 -.5C-1.6 -2 -1.4 -5 0 -6C1.4 -5 1.6 -2 0 -.5Z" fill="#fbe6ea"/></g>`;
      }
      o += `<path d="M266 206q.4 -6 0 -9" stroke="#6a8a52" stroke-width=".6" fill="none"/><path d="M266 197c-1.8 -1 -1.6 -4 0 -5c1.6 1 1.8 4 0 5Z" fill="#e1a0ae"/>`;
    }
    if (s === 2) o += `<path d="M150 186q1 -8 4 -12M262 212q-1 -7 -4 -10" stroke="#8a7448" stroke-width=".6" fill="none"/><circle cx="154" cy="173.6" r="1.6" fill="#8a7448"/>`;
  } else {
    o += `<path d="M152 190q1 -8 3 -12l2 2M262 212q-1 -7 -4 -10" stroke="#8b8478" stroke-width=".6" fill="none"/>`;
  }
  // the island: a mossy mound with a rock and a dwarf pine
  o += `<path d="M156 207Q160 198 178 197Q196 198 200 207Q190 212 178 212Q164 212 156 207Z" fill="${s === 3 ? '#eef1f2' : s === 2 ? '#a99a62' : '#8fa574'}"/>`;
  o += `<path d="M156 207Q178 214 200 207Q190 214 178 214Q164 214 156 207Z" fill="#5d6a58" opacity=".35"/>`;
  o += `<path d="M180 205C179 199 183 195 187 196C191 197 193 201 192 206Z" fill="${stoneFill(c)}"/>`;
  o += `<path d="${branch([[172, 206], [171, 199], [174, 194], [170, 190]], 1.6, 0.6)}" fill="#4e4038"/>`;
  o += `<path d="${ell(166, 195, 5, 2)}${ell(176, 192, 5, 1.8)}${ell(170, 188.5, 4, 1.6)}" fill="#3f5c3e"/><path d="${ell(165, 194, 3.6, 1)}${ell(175.6, 191, 3.6, 1)}${ell(169.6, 187.8, 2.8, .8)}" fill="${s === 3 ? SNOW : '#6b8a5a'}"/>`;
  // rim rocks
  const rocks: [number, number, number][] = [
    [106, 208, 5], [113, 194, 4], [126, 182, 3.6], [196, 168, 3], [244, 171, 3.4], [278, 182, 4.4], [289, 199, 5], [283, 216, 4.4], [258, 229, 4], [214, 234, 3.4], [178, 233, 4.4], [140, 228, 5], [118, 219, 4],
  ];
  let rk = '';
  let rs = '';
  for (const [rx0, ry0, rr] of rocks) {
    rk += `M${n1(rx0 - rr)} ${n1(ry0)}C${n1(rx0 - rr)} ${n1(ry0 - rr * 0.9)} ${n1(rx0 + rr * 0.8)} ${n1(ry0 - rr * 0.9)} ${n1(rx0 + rr)} ${n1(ry0)}Q${n1(rx0)} ${n1(ry0 + rr * 0.35)} ${n1(rx0 - rr)} ${n1(ry0)}Z`;
    rs += ell(rx0 - rr * 0.2, ry0 - rr * 0.5, rr * 0.55, rr * 0.22);
  }
  o += `<path d="${rk}" fill="${stoneFill(c, 'rock', '#b8b1a3', '#7d776c')}"/>`;
  o += `<path d="${rs}" fill="${s === 3 ? SNOW : s === 2 ? '#c3b383' : '#a5b386'}" opacity="${s === 3 ? 1 : 0.7}"/>`;
  if (c.night) {
    // the moon in the water
    let m = '';
    for (let k = 0; k < 7; k++) m += `<rect x="${n1(214 - (9 - k) / 2 + (k % 2))}" y="${n1(181 + k * 3)}" width="${9 - k}" height=".9" rx=".45"/>`;
    c.light.push(`<g fill="#f3eccd" opacity=".75">${m}</g>`);
  }
  return o;
}

function koi(_c: C): string {
  const body = 'M7 0C6 -2.6 1 -3.3 -3 -2.1C-6 -1.3 -8 -.5 -9 0C-8 .5 -6 1.3 -3 2.1C1 3.3 6 2.6 7 0Z';
  const tail = 'M-8.4 0L-13 -3.2Q-11.4 0 -13 3.2Z';
  const fins = `${ell(1.6, -2.8, 1.8, 0.9)}${ell(1.6, 2.8, 1.8, 0.9)}`;
  const fish = [
    { base: '#f6f1e8', fin: '#efe6d8', marks: `${ell(3, -0.4, 3.2, 1.8)}${ell(-3.4, 0.6, 2.2, 1.4)}`, mark: '#d9502f', a: 0 },
    { base: '#e8a63a', fin: '#f0c06a', marks: `${ell(4.6, 0, 1.6, 1.4)}`, mark: '#f4d488', a: 125 },
    { base: '#2d2a28', fin: '#4a4442', marks: `${ell(2.6, 0.6, 2.4, 1.4)}${ell(-3, -0.6, 1.8, 1.1)}`, mark: '#d65a33', a: 235 },
  ];
  let g = '';
  for (const f of fish) {
    const a = (f.a * Math.PI) / 180;
    const R = 29;
    g +=
      `<g transform="translate(${n1(Math.cos(a) * R)} ${n1(Math.sin(a) * R)}) rotate(${f.a + 90})">` +
      `<path d="${tail}${fins}" fill="${f.fin}" opacity=".85"/><path d="${body}" fill="${f.base}"${ol(0.3, 0.55)}/><path d="${f.marks}" fill="${f.mark}"/>` +
      `<path d="M5.6 -1.2a.6 .6 0 1 0 .01 0Z" fill="#1f1a17" opacity=".6"/><path d="M4 -1.4Q0 -2.4 -4 -1.2" stroke="#ffffff" stroke-width=".5" fill="none" opacity=".45"/></g>`;
  }
  // The tap target is the ring the koi swim on (a transparent stroke), so open
  // water in the middle and the rest of the pond still open the pond.
  return `<g transform="translate(240 206) scale(1.2 .5)" opacity=".95"><g class="ga ga-koi">${g}</g>` +
    `<circle r="29" fill="none" stroke="transparent" stroke-width="12"/></g>` +
    `<path d="M210 205h12M238 199h14M226 212h10" stroke="#ffffff" stroke-width=".5" opacity=".35"/>`;
}

function bridge(c: C): string {
  const sf = stoneFill(c, 'bridge', '#cbc3b4', '#958c7e');
  // side face with an arched opening (even-odd hole), deck on top, a stone rail
  const deck = `M104 207C114 199 124 193 133 193C142 193 152 199 162 206`;
  let o = '';
  // reflection of the arch, closing the circle in the water
  o += `<path d="M118 208Q133 226 148 208" stroke="#4d5a5c" stroke-width="2.4" fill="none" opacity=".22"/>`;
  o += `<path d="${deck}L162 209L152 209Q149 203 146 201Q133 194 120 201Q117 203 114 209L104 209Z" fill="${sf}" fill-rule="evenodd"${ol(0.5, 0.7)}/>`;
  o += `<path d="M114 209Q117 203 120 201Q133 194 146 201Q149 203 152 209" stroke="#6f685d" stroke-width=".6" fill="none"/>`;
  o += `<path d="M120 201l-1.6 -2.6M126 197.6l-.8 -3M133 196.4v-3.2M140 197.6l.8 -3M146 201l1.6 -2.6" stroke="#857d70" stroke-width=".45"/>`;
  // deck lip
  o += `<path d="${deck}" stroke="#e4ddcd" stroke-width="1.6" fill="none"/>`;
  // rail: posts + a top bar following the deck
  let posts = '';
  for (const [px, py] of [[108, 203], [117, 197.4], [126, 194], [133, 193], [140, 194], [149, 197.4], [158, 203]] as const) posts += `M${px - 0.8} ${py}h1.6v-5.4h-1.6Z`;
  o += `<path d="${posts}" fill="#a49b8c"${ol(0.3, 0.6)}/>`;
  if (c.s < 3) {
    const r = rng(251);
    o += `<path d="${blob(r, 107, 208.4, 4, 1.2)}${blob(r, 159, 208, 4, 1.2)}${blob(r, 113, 205, 2, 0.8)}" fill="${c.pal.moss[0]}" opacity=".9"/>`;
  }
  o += `<path d="M106 198C115 191 124 187.4 133 187.4C142 187.4 151 191 160 198" stroke="#6f685d" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/><path d="M106 198C115 191 124 187.4 133 187.4C142 187.4 151 191 160 198" stroke="#cfc7b6" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  if (c.s === 3) o += `<path d="M106 197.2C115 190.2 124 186.6 133 186.6C142 186.6 151 190.2 160 197.2M105 206C114 198 124 192.2 133 192.2C142 192.2 152 198 161 205" stroke="${SNOW}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  return o;
}

function maple(c: C): string {
  const r = rng(181);
  const bark = '#4d3c36';
  const trunk: Pt[] = [[40, 216], [43, 200], [50, 186], [60, 174]];
  const limbs: [Pt[], number, number][] = [
    [[[48, 190], [30, 179], [12, 172], [-6, 168]], 3.4, 0.6],
    [[[60, 174], [82, 168], [102, 163], [120, 166]], 3.4, 0.6],
    [[[56, 179], [68, 160], [64, 146], [72, 134]], 2.6, 0.5],
    [[[60, 176], [88, 182], [108, 188]], 2, 0.4],
    [[[44, 198], [28, 196], [16, 190]], 1.6, 0.4],
  ];
  let o = shadow(42, 216, 18, 2.6, 0.15) + (c.s < 3 ? `<path d="${blob(r, 74, 222, 50, 7, 10)}" fill="#3a3a26" opacity=".1"/>` : '');
  o += `<path d="${branch(trunk, 7, 3.4)}" fill="${bark}"/>`;
  o += limbs.map(([p, a, b]) => `<path d="${branch(p, a, b)}" fill="${bark}"/>`).join('');
  o += `<path d="${streaks(r, [[42, 206, 1.4, 6], [48, 190, 1.2, 4]], 4, 6, -70, 0.35, 10)}" fill="#8a7468" opacity=".7"/>`;
  const cl: [number, number, number, number][] = [
    [18, 164, 20, 10], [50, 152, 20, 12], [86, 158, 20, 11], [66, 136, 14, 10], [108, 172, 13, 8], [-2, 160, 10, 8], [36, 140, 12, 9], [28, 182, 12, 6],
  ];
  const leafCols = [
    [['#8fb067', '#a7c27a'], ['#c3d58e', '#d6a07a']],
    [['#4f7a45', '#628c50'], ['#7ea866', '#94b877']],
    [['#a8352a', '#c4452f'], ['#d4643c', '#e08a4a']],
  ];
  if (c.s < 3) {
    const [dk, lt] = leafCols[c.s];
    o += foliage(r, cl, 150, 2.1, dk, lt);
    const mp = mapleDef(c);
    let lv = '';
    for (let k = 0; k < 22; k++) {
      const [x, y, rx, ry] = cl[k % cl.length];
      const a = r() * Math.PI * 2;
      lv += use(mp, x + Math.cos(a) * rx, y + Math.sin(a) * ry * 0.9, 0.62 + r() * 0.2, 150 + r() * 60, [...dk, ...lt][Math.floor(r() * 4)]);
    }
    o += lv;
    if (c.s === 2) {
      // fallen leaves on the ground and on the water
      let fl = '';
      for (let k = 0; k < 14; k++) fl += use(mp, 10 + r() * 140, 200 + r() * 40, 0.4 + r() * 0.2, r() * 360, ['#c4452f', '#d4643c', '#e08a4a'][k % 3], 0.9);
      o += fl;
    }
  } else {
    let tw = '';
    for (const [p] of limbs) {
      const [x, y] = p[p.length - 1];
      tw += `M${x} ${y}l${n1(-3 + r() * 6)} -${n1(3 + r() * 4)}M${x} ${y}l${n1(-5 + r() * 3)} ${n1(-1 + r() * 2)}`;
    }
    o += `<path d="${tw}" stroke="${bark}" stroke-width=".6" fill="none"/>`;
    o += `<path d="${snowAlong(r, trunk, 6)}${limbs.map(([p, a]) => snowAlong(r, p, a)).join('')}"${SNOW_STROKE}/>`;
  }
  return o;
}

function fountain(c: C): string {
  const x = 124;
  const y = 182;
  const bam = c.s === 2 ? '#a8a565' : c.s === 3 ? '#8a9f72' : '#9fb06c';
  const bamD = '#6f7d46';
  let o = shadow(x, y + 1, 16, 2.4, 0.14);
  // rocks and the stone basin
  o += `<path d="M${x - 16} ${y + 1}C${x - 16} ${y - 7} ${x - 8} ${y - 8} ${x - 4} ${y - 4}C${x - 2} ${y - 6} ${x + 6} ${y - 6} ${x + 8} ${y + 1}Z" fill="${stoneFill(c, 'frock', '#bdb6a8', '#7a746a')}"${ol(0.45, 0.7)}/>`;
  if (c.s < 3) o += `<path d="${blob(rng(241), x - 12, y - 5.6, 3, 1.1)}${blob(rng(242), x + 3, y - 4.6, 2.4, 0.9)}" fill="${c.pal.moss[0]}"/>`;
  o += `<path d="${ell(x - 9, y - 3.6, 4, 1.2)}" fill="${c.night ? '#4b5890' : c.pal.water[1]}"/>`;
  // spout post + pipe and the falling thread of water
  o += `<path d="M${x - 27} ${y}V${y - 22}h2.6V${y}Z" fill="${bamD}"${ol(0.35, 0.7)}/><path d="M${x - 27} ${y - 8}h2.6M${x - 27} ${y - 15}h2.6" stroke="#4a5530" stroke-width=".5"/><path d="M${x - 27.6} ${y - 22.4}h3.8v1.4h-3.8Z" fill="#5c6a3a"/>`;
  o += `<path d="${branch([[x - 26, y - 19], [x - 16, y - 17.4]], 2, 1.8)}" fill="${bam}"${ol(0.35, 0.7)}/><path d="M${x - 21} ${y - 19.2}v2" stroke="${bamD}" stroke-width=".6"/>`;
  o += `<path d="M${x - 16} ${y - 17}q.6 3 .2 6" stroke="#e8f3f8" stroke-width=".9" fill="none" opacity=".9" stroke-linecap="round"/><path d="M${x - 16.4} ${y - 10.4}q.4 -1 1.2 -1.4M${x - 15.2} ${y - 10.6}q.8 -.4 1.6 0" stroke="#ffffff" stroke-width=".4" fill="none" opacity=".8"/>`;
  // supports with the pivot pin, and the striking stone
  o += `<path d="M${x + 3} ${y + 1}c0 -3 4 -4 6 -2s0 2 0 2Z" fill="#8f897d"/>`;
  o += `<path d="M${x - 1.6} ${y}V${y - 9}h2.2V${y}Z" fill="${bamD}"/>`;
  // the rocker: open end (left) up at rest
  const tube = `<path d="M-17 -1.8L9 -1.8Q10.4 0 9 1.8L-14.4 1.8Z" fill="${bam}"${ol(0.4, 0.75)}/><path d="M-17 -1.8L-14.4 1.8" stroke="#3b4424" stroke-width=".8"/><path d="M-6 -1.8v3.6M3 -1.8v3.6" stroke="${bamD}" stroke-width=".8"/><path d="M-16 -1.2H8" stroke="#e7efc2" stroke-width=".5" opacity=".55"/>`;
  o += `<g transform="translate(${x} ${y - 8})"><g class="ga ga-tip">${tube}</g></g>`;
  o += `<path d="M${x + 0.6} ${y}V${y - 9}h2.2V${y}Z" fill="${bam}"/><circle cx="${x}" cy="${y - 8}" r=".8" fill="#3b4424"/>`;
  o += `<rect x="${x - 28}" y="${y - 24}" width="38" height="26" fill="transparent"/>`;
  if (c.s === 3) o += `<path d="M${x - 15} ${y - 4.6}C${x - 12} ${y - 8.4} ${x - 6} ${y - 7.6} ${x - 4.4} ${y - 4.6}Q${x - 9} ${y - 6} ${x - 15} ${y - 4.6}Z" fill="${SNOW}"/>`;
  return o;
}

function crane(_c: C, x = 266, y = 228, flip = false, bow = false): string {
  const t = `translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`;
  let g = `<ellipse cx="2" cy="0" rx="10" ry="1.8" fill="#3a2e22" opacity=".14"/>`;
  // legs
  if (bow) g += `<path d="M2 -20L1 0M5 -20L7 0" stroke="#3b3a3a" stroke-width="1.1"/>`;
  else g += `<path d="M2 -20L1 0" stroke="#3b3a3a" stroke-width="1.1"/><path d="M2.6 -20L5.6 -16L2.8 -14.6" stroke="#3b3a3a" stroke-width="1" fill="none" stroke-linejoin="round"/>`;
  g += `<path d="M-1 0h4" stroke="#3b3a3a" stroke-width="1"/>`;
  // black tertials (the "tail" bustle)
  g += `<path d="M7 -28C13 -29 18 -26 21 -20C19.4 -20.6 18.6 -19.4 17.6 -18.8C17 -20 15.8 -19.6 15 -18C13 -21 10 -21 7 -22Z" fill="#262423"/><path d="M10 -26q5 0 8.6 4.4" stroke="#5a5652" stroke-width=".4" fill="none"/>`;
  // body
  g += `<path d="M-9 -27C-7 -32 4 -33 10 -29C15 -26 16 -22 12 -19C6 -17 -2 -18 -6 -21C-9 -23 -10 -25 -9 -27Z" fill="#f8f6f0"${ol(0.4, 0.6)}/>`;
  g += `<path d="M-3 -24.6q5 -1.6 10 .4M-1 -22.4q5 -1 9.6 .8M1 -27q4 -.8 7.4 .8" stroke="#c9c4b8" stroke-width=".45" fill="none" stroke-linecap="round"/>`;
  g += `<path d="M-6 -21C-2 -18 6 -17 12 -19C8 -18.6 0 -18.6 -6 -21Z" fill="#d8d4ca"/><path d="M-2 -27C2 -28 8 -27 11 -24" stroke="#cfcac0" stroke-width=".6" fill="none"/>`;
  // neck + head
  if (bow) {
    g += `<path d="M-7 -27C-12 -28 -15 -24 -17 -18" stroke="#262423" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    g += `<path d="M-17.4 -18.4C-18.6 -17 -18 -15 -16.4 -15C-15.4 -16 -15.6 -17.6 -17.4 -18.4Z" fill="#f8f6f0"/><path d="M-17 -18.6l-.4 -.9 1.4 .2Z" fill="#c83a2c"/>`;
    g += `<path d="M-17.6 -15.4L-21 -9.6L-16.8 -15Z" fill="#8a876c"/>`;
  } else {
    g += `<path d="M-7 -28C-9 -34 -7 -38 -9 -42C-10.6 -45 -11.6 -47 -11.6 -48" stroke="#262423" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    g += `<path d="M-13.4 -48.6C-13.4 -50.6 -10 -51 -9.4 -49C-9.4 -47.4 -11 -46.6 -12.6 -47Z" fill="#f8f6f0"/><path d="M-12.6 -50.4C-12.2 -51.4 -10.4 -51.4 -10 -50.4Z" fill="#c83a2c"/>`;
    g += `<path d="M-13.2 -48.8L-21 -47L-13 -47.6Z" fill="#8a876c"/><circle cx="-12" cy="-48.8" r=".35" fill="#1f1a17"/>`;
  }
  return `<g transform="${t}">${g}</g>`;
}

function irises(c: C): string {
  const x = 230;
  const y = 240;
  const s = c.s;
  const r = rng(191);
  const blades: [number, number, number][] = [
    [-12, 14, -9], [-9, 20, -4], [-6, 16, 2], [-3, 24, -2], [0, 18, 6], [3, 22, 1], [6, 15, 9], [9, 20, 4], [12, 13, 12], [15, 17, 7], [-15, 10, -12],
  ];
  const cols = s === 3 ? ['#b39a72', '#9c8460'] : s === 2 ? ['#9a9a55', '#b5a35e'] : s === 0 ? ['#7fa065', '#94b479'] : ['#4a6a51', '#6a8a6c'];
  const groups = ['', ''];
  blades.forEach(([bx, h, lean], i) => {
    const X = x + bx;
    const ty = y - h;
    groups[i % 2] +=
      `M${n1(X - 1.1)} ${y}C${n1(X - 0.7)} ${n1(y - h * 0.55)} ${n1(X + lean * 0.45 - 0.5)} ${n1(ty + h * 0.22)} ${n1(X + lean)} ${n1(ty)}` +
      `C${n1(X + lean * 0.45 + 0.6)} ${n1(ty + h * 0.24)} ${n1(X + 0.8)} ${n1(y - h * 0.55)} ${n1(X + 1.1)} ${y}Z`;
  });
  let o = shadow(x, y, 18, 2.4, 0.12);
  o += `<path d="${groups[1]}" fill="${cols[1]}"/><path d="${groups[0]}" fill="${cols[0]}"/>`;
  let rib = '';
  blades.forEach(([bx, h, lean], i) => {
    if (i % 2) rib += `M${n1(x + bx)} ${y}Q${n1(x + bx + lean * 0.2)} ${n1(y - h * 0.6)} ${n1(x + bx + lean * 0.8)} ${n1(y - h * 0.88)}`;
  });
  o += `<path d="${rib}" stroke="${mix(cols[0], '#1c2a1c', 0.35)}" stroke-width=".35" fill="none" opacity=".7"/>`;
  const iris = (fx: number, fy: number, sc: number, rot: number) =>
    `<g transform="translate(${n1(fx)} ${n1(fy)}) rotate(${rot}) scale(${sc})">` +
    `<path d="M0 -.6C-2.8 -3.4 -2.4 -8.4 -.6 -9.8C.6 -8.4 .9 -4 0 -.6ZM0 -.6C2.4 -3.6 3.2 -7.8 1.6 -9.4C.2 -8 -.4 -4 0 -.6Z" fill="#8a7db6"/>` +
    `<path d="M0 0C-2.6 -1.2 -6.8 .2 -7.4 3.6C-5.4 5 -2 3.2 0 0ZM0 0C2.6 -1.2 6.8 .2 7.4 3.6C5.4 5 2 3.2 0 0ZM0 0C-1.6 1.8 -1.8 5.6 0 7.4C1.8 5.6 1.6 1.8 0 0Z" fill="#5d4f92"${ol(0.3, 0.6)}/>` +
    `<path d="M-1.4 .8L-4.6 2.4M1.4 .8L4.6 2.4M0 1.4V4.6" stroke="#f1df9a" stroke-width=".9" stroke-linecap="round"/></g>`;
  if (s === 1) {
    o += `<path d="M${x - 4} ${y}Q${x - 4} ${y - 14} ${x - 5} ${y - 22}M${x + 6} ${y}Q${x + 6} ${y - 12} ${x + 7} ${y - 19}M${x + 13} ${y}Q${x + 13} ${y - 9} ${x + 13} ${y - 14}" stroke="#5a7a5c" stroke-width=".8" fill="none"/>`;
    o += iris(x - 5, y - 23, 0.75, -6) + iris(x + 7, y - 20, 0.8, 5) + iris(x + 13, y - 15, 0.6, 12);
  } else if (s === 0) {
    o += `<path d="M${x - 4} ${y}Q${x - 4} ${y - 14} ${x - 5} ${y - 22}M${x + 6} ${y}Q${x + 6} ${y - 12} ${x + 7} ${y - 19}" stroke="#6a8a5c" stroke-width=".8" fill="none"/>`;
    o += iris(x - 5, y - 23, 0.6, -6) + `<path d="M${x + 7} ${y - 19}c-1.6 -1 -1.6 -4 0 -6c1.6 2 1.6 5 0 6Z" fill="#6d5ea0"/>`;
  } else if (s === 2) {
    o += `<path d="M${x - 4} ${y}Q${x - 4} ${y - 12} ${x - 5} ${y - 19}M${x + 7} ${y}Q${x + 7} ${y - 10} ${x + 8} ${y - 16}" stroke="#8a7a4a" stroke-width=".8" fill="none"/>`;
    o += `<path d="${ell(x - 5, y - 21, 1.3, 2.6)}${ell(x + 8, y - 18, 1.2, 2.4)}" fill="#7a5a36"/><path d="M${x - 5} ${y - 23}v4M${x + 8} ${y - 20}v4" stroke="#b39260" stroke-width=".4"/>`;
  } else if (s === 3) {
    o += scatterDabs(r, [[x, y - 12, 10, 3], [x, y - 1, 16, 1.5]], 12, 1.2, 2.2, SNOW);
  }
  return o;
}

function lantern(c: C, x = 76, y = 254): string {
  const T = (dx: number, dy: number) => `${n1(x + dx)} ${n1(y + dy)}`;
  const sf = stoneFill(c, 'lant', '#d8d1c3', '#8f887b');
  const side = '#837b6f';
  const L = ol(0.5, 0.7);
  const r = rng(201);
  let o = shadow(x + 3, y, 15, 2.8, 0.2);
  // base slab: top face, front, a shaded right end
  o += `<path d="M${T(-11, -1)}v-3a11 3 0 0 1 22 0v3a11 3 0 0 1 -22 0Z" fill="${sf}"${L}/><path d="${ell(x, y - 4, 11, 3)}" fill="#cfc8b9"/>`;
  o += `<path d="M${T(4, -1.3)}a11 3 0 0 0 7 -2.7v3a11 3 0 0 1 -7 2.7Z" fill="${side}" opacity=".6"/>`;
  // lotus stage: a drum ringed with petals
  o += `<path d="M${T(-8, -5)}Q${T(-8, -9)} ${T(-4, -9)}H${x + 4}Q${T(8, -9)} ${T(8, -5)}Z" fill="${sf}"${L}/>`;
  o += `<path d="M${T(-6, -5.4)}q1 -2.4 2 0q1 -2.4 2 0q1 -2.4 2 0q1 -2.4 2 0q1 -2.4 2 0q1 -2.4 2 0" stroke="#6f685d" stroke-width=".45" fill="none"/>`;
  // pillar: lit left, shaded right, a carved ring
  o += `<path d="M${T(-2.8, -9)}L${T(-2.4, -25)}H${x + 2.4}L${T(2.8, -9)}Z" fill="${sf}"${L}/><path d="M${T(0.8, -9)}L${T(0.8, -25)}H${x + 2.4}L${T(2.8, -9)}Z" fill="${side}" opacity=".45"/>`;
  o += `<path d="M${T(-3.4, -16)}h6.8v-2h-6.8Z" fill="#a39b8d"${L}/>`;
  // capital (upturned lotus)
  o += `<path d="M${T(-8, -25)}Q${T(-8, -28.4)} ${T(-6, -28.6)}H${x + 6}Q${T(8, -28.4)} ${T(8, -25)}Q${T(0, -23.6)} ${T(-8, -25)}Z" fill="${sf}"${L}/>`;
  o += `<path d="M${T(-6.4, -25.6)}q.8 -2 1.6 0q.8 -2 1.6 0q.8 -2 1.6 0q.8 -2 1.6 0q.8 -2 1.6 0q.8 -2 1.6 0q.8 -2 1.6 0q.8 -2 1.6 0" stroke="#6f685d" stroke-width=".4" fill="none"/>`;
  // firebox: lit left face, shaded right face, the front with its window
  o += `<path d="M${T(-7, -28.6)}L${T(-4.6, -29)}V${y - 39}L${T(-7, -38.6)}Z" fill="#c4bcad"${L}/><path d="M${T(4.6, -29)}L${T(7, -28.6)}V${y - 38.6}L${T(4.6, -39)}Z" fill="${side}"${L}/>`;
  o += `<path d="M${T(-4.6, -28.6)}H${x + 4.6}V${y - 39}H${x - 4.6}Z" fill="${sf}"${L}/>`;
  const win = c.night ? '#2b2724' : linY(c, 'lwin', y - 37, y - 30.4, [[0, '#2b2724'], [1, '#5a3c26']]);
  o += `<path d="M${T(-2.6, -30.4)}h5.2v-6.6h-5.2Z" fill="${win}"/><path d="M${T(5.2, -30.4)}l1.2 .1v-6.4l-1.2 -.1Z" fill="#2b2724" opacity=".8"/>`;
  if (!c.night) o += `<path d="M${T(-1.4, -31)}q1.4 -2.6 2.8 0Z" fill="#e8a24c" opacity=".55"/>`;
  // roof with lifted corners, its eave in shade, and a jewel finial
  o += `<path d="M${T(-14, -38.4)}Q${T(-10, -38.8)} ${T(-7.6, -41.4)}L${T(-3.4, -45.4)}H${x + 3.4}L${T(7.6, -41.4)}Q${T(10, -38.8)} ${T(14, -38.4)}Q${T(7, -37.2)} ${T(0, -37.4)}Q${T(-7, -37.2)} ${T(-14, -38.4)}Z" fill="${sf}"${L}/>`;
  o += `<path d="M${T(1, -45.4)}H${x + 3.4}L${T(7.6, -41.4)}Q${T(10, -38.8)} ${T(14, -38.4)}Q${T(7, -37.2)} ${T(1, -37.4)}Z" fill="${side}" opacity=".4"/>`;
  o += `<path d="M${T(-14, -38.4)}Q${T(-7, -37.2)} ${T(0, -37.4)}Q${T(7, -37.2)} ${T(14, -38.4)}" stroke="#5f584e" stroke-width=".9" fill="none"/>`;
  o += `<path d="M${T(-6, -42)}L${T(-3, -44.6)}M${T(-1, -42.4)}V${y - 45}" stroke="#ece6d8" stroke-width=".45" opacity=".7"/>`;
  o += `<path d="M${T(-2.6, -45.4)}h5.2v1.2h-5.2ZM${T(-1.8, -46.6)}h3.6v1.2h-3.6Z" fill="#a39b8d"${L}/><path d="M${T(-1.8, -47.4)}C${T(-2, -49.4)} ${T(0, -51.4)} ${T(0, -52)}C${T(0, -51.4)} ${T(2, -49.4)} ${T(1.8, -47.4)}Z" fill="${sf}"${L}/>`;
  // granite: dry-brush streaks down the pillar and across the slab and roof
  o += `<path d="${streaks(r, [[x + 1, y - 17, 1.2, 6]], 4, 6, 90, 0.3, 6)}${streaks(r, [[x, y - 2.6, 7, 0.8], [x - 2, y - 33, 2, 3], [x - 3, y - 40, 5, 0.6]], 6, 4, 0, 0.28, 8)}" fill="#5d564c" opacity=".45"/>`;
  // moss and lichen on the north side, cushions of moss at the foot
  if (c.s < 3) {
    const moss = c.s === 2 ? ['#a59a62', '#bcae76'] : ['#8fa66c', '#a9bb82'];
    o += `<path d="${blob(r, x - 7, y - 39.6, 4.4, 0.9)}${blob(r, x - 1.6, y - 45.6, 1.6, 0.6)}${blob(r, x - 6.4, y - 25.8, 2.4, 0.8)}${blob(r, x - 8, y - 4.4, 3, 0.9)}" fill="${moss[1]}" opacity=".85"/>`;
    o += `<path d="${streaks(r, [[x - 2, y - 15, 0.4, 5]], 3, 3, 90, 0.4, 20)}" fill="${moss[0]}" opacity=".8"/>`;
    o += scatter(r, [[x - 10, y, 5, 1.6], [x + 9, y + 0.6, 4, 1.4]], 12, 0.8, 1.6, c.pal.moss.length ? c.pal.moss : moss, 0.9, 0.6);
  }
  if (c.s === 3) {
    o += `<path d="M${T(-13, -39)}Q${T(-8, -41)} ${T(-6, -43)}L${T(-3, -46.6)}Q${T(0, -49)} ${T(3, -46.6)}L${T(6, -43)}Q${T(8, -41)} ${T(13, -39)}Q${T(0, -40.6)} ${T(-13, -39)}Z" fill="${SNOW}"/>`;
    o += `<path d="${ell(x, y - 28.4, 7, 1)}${ell(x, y - 4.6, 10, 1.4)}${ell(x, y - 9.2, 6, 0.8)}" fill="${SNOW}"/>`;
    o += `<path d="M${T(-10, -40)}Q${T(0, -41)} ${T(10, -40)}" stroke="${SNOW_SHADE}" stroke-width=".6" fill="none"/>`;
  }
  if (c.night) {
    c.light.push(
      glow(c, x, y - 34, 30, '#f5b85c', 0.9, 'ga ga-flicker') +
        `<path d="M${T(-2.6, -30.4)}h5.2v-6.6h-5.2Z" fill="#ffd27a"/><path d="M${T(5.2, -30.4)}l1.2 .1v-6.4l-1.2 -.1Z" fill="#f2b45a"/>` +
        `<ellipse cx="${x}" cy="${y + 1}" rx="22" ry="4" fill="#f5b85c" opacity=".14"/>`,
    );
  }
  return o;
}

function stones(c: C): string {
  const list: [number, number, number, number][] = [
    [180, 274, 12, 4.3], [164, 262, 10.6, 3.9], [172, 250, 9.6, 3.5], [154, 242, 8.8, 3.2], [137, 235, 8, 2.9], [121, 228, 7.2, 2.6], [107, 221, 6.4, 2.3], [96, 213, 5.8, 2.1],
  ];
  const r = rng(211);
  let side = '';
  let top = '';
  let hi = '';
  for (const [x, y, rx, ry] of list) {
    const wob = (k: number) => 1 + Math.sin(k * 2.1 + x) * 0.08;
    const pts: Pt[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      pts.push([x + Math.cos(a) * rx * wob(k), y + Math.sin(a) * ry * wob(k + 3)]);
    }
    side += loop(pts.map(([px, py]) => [px, py + ry * 0.45] as Pt));
    top += loop(pts);
    hi += blob(r, x - rx * 0.28, y - ry * 0.3, rx * 0.46, ry * 0.3, 6);
  }
  const g = list.map(([x, y, rx, ry]) => [x + rx * 0.05, y + ry * 0.05, rx * 0.55, ry * 0.4] as Clump);
  let o = `<path d="${list.map(([x, y, rx, ry]) => ell(x + 1, y + ry * 0.9, rx * 1.1, ry * 0.7)).join('')}" fill="#3a2e22" opacity=".14"/>`;
  o += `<path d="${side}" fill="#6a6359"${ol(0.5, 0.55)}/><path d="${top}" fill="${lin(c, 'stonetop', [[0, c.s === 3 ? '#b8b5ae' : '#b5aea0'], [1, '#958e81']], 1, 1)}"${ol(0.45, 0.5)}/><path d="${hi}" fill="#e2dccf" opacity=".5"/>`;
  o += `<path d="${streaks(r, g, 10, 3.2, -4, 0.3, 14)}" fill="#5e574d" opacity=".4"/>`;
  if (c.s === 3) o += `<path d="${list.map(([x, y, rx, ry]) => blob(r, x - rx * 0.1, y - ry * 0.18, rx * 0.82, ry * 0.66, 8)).join('')}" fill="${SNOW}"/>`;
  else {
    // moss cushions hugging the near edge of each stone
    let m = '';
    for (const [x, y, rx, ry] of list) m += blob(r, x + rx * 0.35, y + ry * 1.1, rx * 0.5, 1.1, 7) + blob(r, x - rx * 0.6, y + ry * 0.9, rx * 0.3, 0.9, 6);
    const mc = c.pal.moss.length ? c.pal.moss : ['#8a9a7a', '#9aa98a', '#7a8a6a'];
    o += `<path d="${m}" fill="${mc[0]}" opacity=".85"/>`;
    let gr = '';
    for (const [x, y, rx, ry] of list) for (let k = 0; k < 2; k++) gr += leaf(x + rx * (0.1 + r() * 0.6), y + ry * 1.2, 1.6 + r() * 1.2, -90 + (r() - 0.5) * 70, 0.35);
    o += `<path d="${gr}" fill="${mc[2]}"/>`;
  }
  return o;
}

function cat(c: C): string {
  const x = 252;
  const y = 296;
  const id = `${c.p}catclip`;
  const body = `M${x - 11} ${y - 5}C${x - 11} ${y - 11} ${x - 3} ${y - 13.4} ${x + 4} ${y - 12.6}C${x + 10} ${y - 12} ${x + 12.6} ${y - 8} ${x + 12} ${y - 4}C${x + 11.4} ${y - 1.6} ${x + 6} ${y - 1} ${x} ${y - 1}C${x - 6} ${y - 1} ${x - 11} ${y - 2} ${x - 11} ${y - 5}Z`;
  c.defs.set(id, `<clipPath id="${id}"><path d="${body}"/></clipPath>`);
  let o = shadow(x, y, 17, 3, 0.15);
  // straw cushion
  o += `<path d="${ell(x, y - 1.6, 16, 4.6)}" fill="#c9b07a"/><path d="${ell(x, y - 1.6, 12, 3.4)}${ell(x, y - 1.6, 7.6, 2.2)}" fill="none" stroke="#a88f5c" stroke-width=".5"/>`;
  // body (breathes)
  let b = `<path d="${body}" fill="#f6f1e6"${ol(0.45, 0.7)}/><g clip-path="url(#${id})"><path d="${ell(x + 5, y - 9.6, 7, 4.6)}" fill="#d9853f"/><path d="${ell(x - 2, y - 12, 4.6, 2.6)}${ell(x + 10, y - 4, 2.6, 2.4)}" fill="#2e2a28"/></g>`;
  b += `<path d="M${x - 2} ${y - 4}C${x + 3} ${y - 3} ${x + 8} ${y - 4} ${x + 11} ${y - 6}" stroke="#d8cfbf" stroke-width=".6" fill="none"/>`;
  const fr = rng(261);
  b += `<path d="${streaks(fr, [[x + 1, y - 10.6, 7, 1.4]], 7, 2.6, 8, 0.28, 16)}" fill="#8a6a4a" opacity=".5"/>`;
  b += `<path d="M${x - 9} ${y - 2.4}Q${x} ${y - 0.4} ${x + 10} ${y - 3}" stroke="#d8cfbf" stroke-width=".9" fill="none" opacity=".7"/>`;
  o += `<g class="ga ga-breathe">${b}</g>`;
  // tail wrapped around the front
  o += `<path d="M${x + 11} ${y - 3}C${x + 9} ${y + 0.6} ${x - 2} ${y + 1} ${x - 9} ${y - 1.4}" stroke="#2e2a28" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${x + 11} ${y - 3}C${x + 10} ${y - 0.6} ${x + 6} ${y + 0.4} ${x + 2} ${y + 0.4}" stroke="#d9853f" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  // head tucked on the paws
  o += `<path d="${ell(x - 9.6, y - 5.4, 4.8, 4)}" fill="#f6f1e6"${ol(0.4, 0.7)}/><path d="M${x - 14} ${y - 6.6}C${x - 13} ${y - 9.6} ${x - 9} ${y - 10} ${x - 7.6} ${y - 8}C${x - 9} ${y - 7} ${x - 12} ${y - 6.4} ${x - 14} ${y - 6.6}Z" fill="#d9853f"/>`;
  o += `<g class="gd-ear"><path d="M${x - 13.4} ${y - 7.6}L${x - 13.6} ${y - 11.6}L${x - 10.6} ${y - 9.2}Z" fill="#d9853f"/></g><path d="M${x - 8.6} ${y - 9}L${x - 7} ${y - 12.6}L${x - 5.6} ${y - 8.4}Z" fill="#2e2a28"/>`;
  o += `<path d="M${x - 12.2} ${y - 5.4}q1 .9 2 0M${x - 8.4} ${y - 5.4}q1 .9 2 0" stroke="#3a322c" stroke-width=".5" fill="none"/><path d="M${x - 9.8} ${y - 3.8}l.5 .4.5 -.4Z" fill="#c98a7a"/>`;
  o += `<path d="${ell(x - 6, y - 1.6, 2, 1)}${ell(x - 12.4, y - 1.8, 1.8, 0.9)}" fill="#f6f1e6"${ol(0.35, 0.6)}/>`;
  o += `<path d="M${x - 13.4} ${y - 4}l-3 -.4M${x - 13.4} ${y - 3.4}l-3 .6M${x - 6.4} ${y - 4}l2.8 -.6M${x - 6.4} ${y - 3.4}l2.8 .4" stroke="#8a8070" stroke-width=".22" opacity=".8"/>`;
  o += `<path d="M${x - 12.9} ${y - 8.2}L${x - 13} ${y - 10.4}L${x - 11.4} ${y - 9}Z" fill="#e6a99a" opacity=".8"/>`;
  if (c.s === 3) o += `<path d="M${x - 4} ${y - 13.2}q4 -1.2 8 -.4" stroke="#ffffff" stroke-width=".7" opacity=".7" fill="none"/>`;
  return o;
}

function teatable(c: C): string {
  const x = 320;
  const y = 276;
  const T = (dx: number, dy: number) => `${n1(x + dx)} ${n1(y + dy)}`;
  let o = shadow(x, y + 1, 30, 4, 0.14);
  // floor cushions (bangseok)
  o += `<path d="M${T(-30, -2)}q0 -4 6 -4.4h10q5 .4 5 4.4q0 3 -5 3.4h-10q-6 -.4 -6 -3.4Z" fill="#4f5d7a"${ol(0.4, 0.6)}/><path d="M${T(-26, -3)}h12" stroke="#c9a85c" stroke-width=".5"/>`;
  o += `<path d="M${T(16, -6)}q0 -3.6 5 -4h9q5 .4 5 4q0 3 -5 3.2h-9q-5 -.2 -5 -3.2Z" fill="#9a5a40"${ol(0.4, 0.6)}/><path d="M${T(19, -7)}h12" stroke="#e1c48a" stroke-width=".5"/>`;
  // soban: round top, dog-leg legs
  const wood = '#7a4f34';
  o += `<path d="M${T(-9, -9)}C${T(-12, -5)} ${T(-10, -2)} ${T(-11, 0)}M${T(9, -9)}C${T(12, -5)} ${T(10, -2)} ${T(11, 0)}M${T(-5, -10)}C${T(-6, -6)} ${T(-5, -3)} ${T(-6, -1.4)}M${T(5, -10)}C${T(6, -6)} ${T(5, -3)} ${T(6, -1.4)}" stroke="${wood}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  o += `<path d="M${T(-11, -9.2)}h22v-1.8h-22Z" fill="#5f3c27"/>`;
  o += `<path d="M${T(-15, -11.6)}a15 4.4 0 0 0 30 0v-1.8a15 4.4 0 0 1 -30 0Z" fill="#5f3c27"/><path d="${ell(x, y - 13.4, 15, 4.4)}" fill="${lin(c, 'soban', [[0, '#a8744e'], [1, '#7a4f34']], 1, 1)}"${ol(0.45, 0.75)}/>`;
  o += `<path d="M${T(-11, -14.6)}q8 -1.6 16 -.4M${T(-6, -11.6)}q9 .6 15 -1.2" stroke="#c99a6c" stroke-width=".35" fill="none" opacity=".7"/>`;
  // tea set: celadon pot, two cups
  const cel = '#a8c0ad';
  o += `<path d="M${T(-8, -15.4)}C${T(-9, -20)} ${T(-1, -20.6)} ${T(-1.6, -15.4)}Q${T(-4.8, -14.2)} ${T(-8, -15.4)}Z" fill="${lin(c, 'celadon', [[0, '#c6d9c8'], [0.6, '#a8c0ad'], [1, '#86a290']], 1, 0)}"${ol(0.35, 0.7)}/>`;
  o += `<path d="M${T(-8.6, -17)}L${T(-11.6, -19.6)}L${T(-11, -20)}L${T(-7.8, -18)}Z" fill="${cel}"/><path d="M${T(-1.8, -18.6)}q2.6 -.4 2 2.4" stroke="#8aa592" stroke-width=".8" fill="none"/>`;
  o += `<path d="${ell(x - 4.8, y - 19.4, 2, 0.6)}" fill="#c3d5c6"/><circle cx="${x - 4.8}" cy="${y - 20.3}" r=".7" fill="#8aa592"/>`;
  o += `<path d="M${T(-6.6, -17.6)}q1.8 -.6 3.4 0" stroke="#e8f0e8" stroke-width=".5" fill="none"/>`;
  for (const [cx, cy] of [[4, -14.6], [8.4, -13]] as const) {
    o += `<path d="M${T(cx - 1.8, cy - 2.4)}h3.6l-.5 2.4h-2.6Z" fill="#c7d6c9"/><path d="${ell(x + cx, y + cy - 2.4, 1.8, 0.5)}" fill="#b49a62"/>`;
  }
  // steam
  o += `<path class="ga ga-steam" d="M${T(-11.4, -21)}c-1.4 -2 1 -3.4 -.4 -5.6s1 -3.4 0 -5M${T(5.4, -18)}c-1 -1.6 .8 -2.6 -.2 -4.4s.8 -2.4 0 -3.6" stroke="#ffffff" stroke-width=".7" fill="none" opacity=".75" stroke-linecap="round"/>`;
  if (c.s === 3) o += `<path d="M${T(-29, -6)}q9 -2.4 18 0Z" fill="${SNOW}"/>`;
  return o;
}

function wisteria(c: C): string {
  const s = c.s;
  const r = rng(221);
  const wood = '#76604c';
  const woodD = '#54443a';
  const woodL = '#a08a72';
  // a pergola in three-quarter view: back posts, back beam, rafters, front beam, front posts
  const FB: [Pt, Pt] = [[282, 201], [356, 196]];
  const BB: [Pt, Pt] = [[296, 186], [366, 182]];
  let o = shadow(322, 292, 40, 4, 0.1);
  o += `<path d="M305 264V188h2.6v76ZM355 260V184h2.6v76Z" fill="${woodD}"/>`;
  o += `<path d="M${BB[0][0]} ${BB[0][1]}L${BB[1][0]} ${BB[1][1]}V${BB[1][1] + 3.2}L${BB[0][0]} ${BB[0][1] + 3.2}Z" fill="${woodD}"/>`;
  // vines twisting up the back-left post and along the top
  o += `<path d="M307 262C303 248 311 236 306 222S310 200 305 190M305 190C318 186 330 192 342 186S360 184 368 182" stroke="#5d4a3c" stroke-width="1.1" fill="none"/>`;
  let raft = '';
  for (let k = 0; k < 8; k++) {
    const t = k / 7;
    const fx = FB[0][0] + 4 + t * (FB[1][0] - FB[0][0] - 8);
    const fy = FB[0][1] + (FB[1][1] - FB[0][1]) * ((fx - FB[0][0]) / (FB[1][0] - FB[0][0]));
    raft += `M${n1(fx - 2)} ${n1(fy + 2.4)}L${n1(fx + 15)} ${n1(fy - 18)}`;
  }
  o += `<path d="${raft}" stroke="${wood}" stroke-width="1.8" stroke-linecap="round"/><path d="${raft}" stroke="${woodL}" stroke-width=".5" opacity=".6" transform="translate(-.5 -.4)"/>`;
  // foliage across the top
  const top: [number, number, number, number][] = [[300, 193, 12, 4], [322, 190, 14, 5], [344, 187, 14, 5], [362, 184, 8, 4]];
  if (s === 0) o += scatter(r, top, 44, 1.2, 2, ['#9cba7c', '#b6cc8f'], 0.95, 0.6);
  else if (s === 1) o += foliage(r, top, 70, 1.8, ['#4f7a4f', '#5f8a58'], ['#77a06a', '#8fb47a']);
  else if (s === 2) o += scatter(r, top, 60, 1.2, 2.2, ['#d4b04e', '#c99a3e', '#e0c46a', '#b98a3a'], 0.95, 0.6);
  // front beam
  o += `<path d="M${FB[0][0]} ${FB[0][1]}L${FB[1][0]} ${FB[1][1]}V${FB[1][1] + 3.6}L${FB[0][0]} ${FB[0][1] + 3.6}Z" fill="${wood}"${ol(0.45, 0.7)}/><path d="M${FB[0][0]} ${FB[0][1]}L${FB[1][0]} ${FB[1][1]}" stroke="${woodL}" stroke-width=".6"/>`;
  // hanging sprays (spring) or leaves and pods
  const sprays: [number, number, number][] = [];
  for (let k = 0; k < 15; k++) {
    const t = (k + r() * 0.6) / 15;
    const front = k % 3 !== 1;
    const [a0, a1] = front ? FB : BB;
    const sx = a0[0] + 3 + t * (a1[0] - a0[0] - 6);
    const sy = a0[1] + (a1[1] - a0[1]) * t + (front ? 3.2 : 2.6);
    sprays.push([sx, sy, (front ? 15 : 10) + r() * 11]);
  }
  if (s === 0) {
    // racemes: pale open florets at the top, deeper buds toward the tip; each floret a little capsule
    const groups: Dab[][][] = [[[], [], []], [[], [], []]];
    let lv = '';
    sprays.forEach(([sx, sy, len], i) => {
      const g = groups[i % 2];
      const n = Math.round(len / 1.7);
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const w = 2.7 * (1 - t * 0.75);
        const yy = sy + 1 + t * len;
        const xx = sx + Math.sin(t * 2.4 + i) * 0.9;
        const rr = 0.95 - t * 0.3;
        const l = Math.max(0, w - rr * 2);
        g[t < 0.34 ? 0 : t < 0.68 ? 1 : 2].push([xx - w * 0.5 - (k % 2) * 0.4, yy + (k % 2) * 0.5, rr, l]);
      }
      lv += leaf(sx, sy, 6, 30 + r() * 30, 1.4) + leaf(sx, sy, 6, 130 + r() * 30, 1.4);
    });
    o += `<path d="${lv}" fill="#9cba7c"/>`;
    const pc = ['#d2c4ea', '#a893d0', '#7a62ab'];
    o += groups
      .map((g, gi) => `<g class="ga ga-spray${gi ? ' ga-spray--b' : ''}">${g.map((d, j) => dabs(d, j ? pc[j] : pc[0])).join('')}${dabs(g[0].map(([x, y, rr, l]) => [x - 0.2, y - 0.4, rr * 0.45, l] as Dab), '#f1eaf8', 0.7)}</g>`)
      .join('');
    o += scatterDabs(r, [[322, 288, 30, 4]], 16, 0.8, 1.3, '#b9a6db', 0.8);
  } else if (s === 1 || s === 2) {
    // drooping compound leaves and a few velvet pods
    const lc = s === 1 ? ['#5f8a58', '#77a06a'] : ['#d4b04e', '#c99a3e'];
    const lv = ['', ''];
    let pods = '';
    sprays.forEach(([sx, sy, len], i) => {
      if (i % 3 === 0) pods += `M${n1(sx)} ${n1(sy)}q-1.4 ${n1(len * 0.4)} .6 ${n1(len * 0.62)}`;
      else for (let k = 0; k < 4; k++) lv[k % 2] += leaf(sx + (k % 2 ? 1 : -1) * 0.6, sy + k * 2.4, 4.6, 95 + (k % 2 ? -40 : 40), 1.2);
    });
    o += `<g class="ga ga-spray">${lv.map((d, j) => `<path d="${d}" fill="${lc[j]}"/>`).join('')}<path d="${pods}" stroke="${s === 1 ? '#7d9a5c' : '#8a6a44'}" stroke-width="1.7" fill="none" stroke-linecap="round"/></g>`;
  } else {
    o += `<path d="M${FB[0][0]} ${FB[0][1] - 0.4}L${FB[1][0]} ${FB[1][1] - 0.4}" stroke="${SNOW}" stroke-width="2.2" stroke-linecap="round"/><path d="M${BB[0][0]} ${BB[0][1] - 0.4}L${BB[1][0]} ${BB[1][1] - 0.4}" stroke="${SNOW}" stroke-width="1.6" stroke-linecap="round"/>`;
    o += `<path d="${raft}" stroke="${SNOW}" stroke-width=".9" stroke-linecap="round" transform="translate(0 -1.2)"/>`;
    o += `<path d="M300 192c8 -4 10 2 16 -2s8 -6 14 -3 10 0 14 -4 8 -2 14 -4M296 196c-2 6 3 10 1 16" stroke="#5d4a3c" stroke-width=".9" fill="none"/>`;
  }
  // front posts
  o += `<path d="M287 298V202h3.8v96ZM346 292V198h3.8v94Z" fill="${wood}"${ol(0.45, 0.7)}/><path d="M287.7 298V203M346.7 292V199" stroke="${woodL}" stroke-width=".7"/>`;
  o += `<path d="M290 296C294 286 286 280 290 270S286 256 290 246" stroke="#5d4a3c" stroke-width=".9" fill="none"/>`;
  return o;
}

function bonsai(c: C): string {
  const x = 34;
  const y = 297;
  const T = (dx: number, dy: number) => `${n1(x + dx)} ${n1(y + dy)}`;
  let o = shadow(x, y, 20, 3, 0.18);
  // stand
  o += `<path d="M${T(-14, -9)}C${T(-14, -4)} ${T(-15, -2)} ${T(-17, 0)}H${x - 13}C${T(-12, -3)} ${T(-11.4, -6)} ${T(-11.4, -9)}ZM${T(14, -9)}C${T(14, -4)} ${T(15, -2)} ${T(17, 0)}H${x + 13}C${T(12, -3)} ${T(11.4, -6)} ${T(11.4, -9)}Z" fill="#3e2c22"${ol(0.4, 0.6)}/>`;
  o += `<path d="M${T(-18, -9)}h36v-2.6h-36Z" fill="#4a3426"/><path d="M${T(-18, -11.6)}h36" stroke="#7a5a44" stroke-width=".6"/>`;
  // tray
  o += `<path d="M${T(-15, -11.6)}L${T(-13.4, -16.4)}H${x + 13.4}L${T(15, -11.6)}Z" fill="${lin(c, 'tray', [[0, '#7d90a2'], [0.5, '#5d6f80'], [1, '#43525f']], 1, 0)}"${ol(0.45, 0.7)}/><path d="M${T(-12, -14.4)}h6M${T(4, -14.4)}h7" stroke="#a9b8c4" stroke-width=".4" opacity=".6"/><path d="M${T(-14.6, -16.4)}h29.2v-1h-29.2Z" fill="#7c8e9e"/>`;
  o += `<path d="${ell(x, y - 17.2, 14, 1.6)}" fill="${c.s === 3 ? SNOW : '#6f8a52'}"/>`;
  o += `<path d="M${T(7, -17)}c0 -2 3 -3 5 -1l.4 1Z" fill="#8f897d"/>`;
  // trunk
  o += `<path d="${branch([[x - 3, y - 17], [x - 6, y - 24], [x + 2, y - 31], [x - 4, y - 39], [x + 1, y - 46]], 4.2, 1.4)}" fill="#5e4a3c"${ol(0.4, 0.6)}/>`;
  o += `<path d="M${T(-4.4, -19)}q-1.6 -3 -.6 -5.4M${T(-1, -28)}q1.6 -1.6 1.4 -3.6M${T(-3, -37)}q.4 -2 1.6 -3.2" stroke="#9c8470" stroke-width=".45" fill="none" opacity=".7"/>`;
  o += `<path d="${branch([[x - 1, y - 29], [x - 10, y - 30], [x - 15, y - 28]], 1.6, 0.6)}${branch([[x - 2, y - 36], [x + 8, y - 37], [x + 13, y - 35]], 1.6, 0.6)}" fill="#5e4a3c"/>`;
  // foliage pads
  const pads: [number, number, number, number][] = [[-14, -30, 7.6, 3.2], [11, -37, 8, 3.4], [-6, -42, 6.4, 2.8], [2, -49, 5.6, 2.6]];
  let dk = '';
  let lt = '';
  let sn = '';
  const r = rng(231);
  for (const [px, py, rx, ry] of pads) {
    dk += `M${n1(x + px - rx)} ${n1(y + py + ry * 0.4)}C${n1(x + px - rx)} ${n1(y + py - ry)} ${n1(x + px + rx)} ${n1(y + py - ry * 1.2)} ${n1(x + px + rx)} ${n1(y + py + ry * 0.4)}Z`;
    for (let k = 0; k < 9; k++) {
      const t = (k + 0.5) / 9;
      const nx = x + px - rx * 0.85 + t * rx * 1.7;
      const ny = y + py - ry * 0.25 - Math.sin(t * Math.PI) * ry * 0.7;
      lt += leaf(nx, ny + 0.6, 2.2 + r() * 1.2, -90 + (t - 0.5) * 110 + (r() - 0.5) * 20, 0.42);
    }
    sn += `M${n1(x + px - rx * 0.9)} ${n1(y + py - ry * 0.2)}C${n1(x + px - rx * 0.8)} ${n1(y + py - ry * 1.3)} ${n1(x + px + rx * 0.8)} ${n1(y + py - ry * 1.4)} ${n1(x + px + rx * 0.9)} ${n1(y + py - ry * 0.2)}Q${n1(x + px)} ${n1(y + py - ry * 0.7)} ${n1(x + px - rx * 0.9)} ${n1(y + py - ry * 0.2)}Z`;
  }
  o += `<path d="${dk}" fill="#3a5638"${ol(0.4, 0.5)}/><path d="${lt}" fill="#6f9060"/><path d="${dk}" fill="${lin(c, 'padsh', [[0, '#000', 0], [0.6, '#000', 0], [1, '#14201a', 0.35]])}"/>`;
  if (c.s === 3) o += `<path d="${sn}" fill="${SNOW}"/>`;
  return o;
}

function chime(c: C): string {
  const x = 300;
  const y = eaveY(300) + 0.6;
  const bronze = lin(c, 'bronze', [[0, '#9a8a5c'], [0.32, '#6f6a48'], [0.62, '#4f5a48'], [1, '#353d34']], 1, 0);
  const patina = '#86a892';
  const L = ol(0.4, 0.8);
  let g = `<path d="M-1.2 .2a1.2 1.2 0 1 0 2.4 0" stroke="#3a3330" stroke-width=".45" fill="none"/><path d="M0 1V9" stroke="#3a3330" stroke-width=".5"/>`;
  // the bell: a crown, shoulders, a flared lip
  g += `<path d="M-1 8.6h2v1.4h-2Z" fill="#4f5848"${L}/>`;
  g += `<path d="M-1.8 10Q0 9 1.8 10Q2.8 11 2.9 14Q3.1 17 4.2 18.6H-4.2Q-3.1 17 -2.9 14Q-2.8 11 -1.8 10Z" fill="${bronze}"${L}/>`;
  // verdigris running down from the shoulders, a lit stripe, two cast bands
  g += `<path d="M-1.4 10.6Q-1.8 13 -1.2 15.6M.6 10.2Q1.2 12.6 .8 14.4M1.9 11.2Q2.4 14 2.6 16.6" stroke="${patina}" stroke-width=".7" fill="none" stroke-linecap="round" opacity=".75"/>`;
  g += `<path d="M-1.9 11.4Q-2.2 14 -2.6 16.6" stroke="#e8dcae" stroke-width=".5" fill="none" stroke-linecap="round" opacity=".7"/>`;
  g += `<path d="M-2.6 13h5.2M-3.4 17h6.8" stroke="#2f362e" stroke-width=".4" opacity=".7"/>`;
  g += `<path d="M-4.2 18.6h8.4l-.3 .9h-7.8Z" fill="#3a4238"/>`;
  // the clapper inside the mouth, the cord on down to the fish
  g += `<path d="M0 17.4V21.6" stroke="#3a3330" stroke-width=".4"/><path d="M-.9 19.6h1.8l-.4 1.6h-1Z" fill="#2e2a26"/>`;
  g += `<path d="M0 21.6V23.2" stroke="#3a3330" stroke-width=".35"/>`;
  // the fish: body, a forked tail, fins, gill line, eye, scale strokes, a patina bloom
  g += `<path d="M-4.8 25.4C-3.2 23.2 2 23 3.4 25C4.4 24.1 5.4 23.4 6.2 23.3C5.7 24.5 5.7 26.1 6.2 27.3C5.4 27.2 4.4 26.6 3.4 25.7C2 27.6 -3.2 27.6 -4.8 25.4Z" fill="${bronze}"${L}/>`;
  g += `<path d="M-1 23.7l1.4 -1.3.4 1.4ZM-.6 27.1l1.2 1 .3 -1.3Z" fill="#4f5848"/>`;
  g += `<path d="M-2.6 24.4q.8 1 0 2.1M-.4 24.4q.6 1 0 2M1.4 24.5q.5 .9 0 1.8" stroke="#2f362e" stroke-width=".3" fill="none" opacity=".7"/>`;
  g += `<path d="M-1.6 24.2Q.6 23.8 2.6 24.8" stroke="${patina}" stroke-width=".5" fill="none" opacity=".7"/>`;
  g += `<circle cx="-3.3" cy="25.1" r=".45" fill="#1f1d1a"/><circle cx="-3.45" cy="24.95" r=".14" fill="#e8dcae"/>`;
  return `<g transform="translate(${x} ${n1(y)})"><g class="ga ga-chime">${g}</g><rect x="-8" y="0" width="16" height="30" fill="transparent"/></g>`;
}

const LANTERN_STRING = { x0: 14, y0: eaveY(14) + 0.8, cx: 114, cy: 64, x1: 214, y1: eaveY(214) + 0.8 };

function lanternsString(c: C): string {
  const { x0, y0, cx, cy, x1, y1 } = LANTERN_STRING;
  const at = (t: number): Pt => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  let o = `<path d="M${n1(x0)} ${n1(y0)}Q${cx} ${cy} ${n1(x1)} ${n1(y1)}" stroke="#3a302a" stroke-width=".6" fill="none"/>`;
  const ts = [0.14, 0.31, 0.5, 0.69, 0.86];
  let lit = '';
  ts.forEach((t, i) => {
    const [lx, ly0] = at(t);
    const drop = 3 + (i % 2) * 2;
    const ly = ly0 + drop;
    const red = i % 2 === 0;
    const bodyD = red ? '#9e3f2e' : '#d7c6a2';
    const L = `<path d="M${n1(lx)} ${n1(ly0)}v${drop}" stroke="#3a302a" stroke-width=".5"/>` +
      `<path d="M${n1(lx - 2.4)} ${n1(ly)}h4.8v1.4h-4.8ZM${n1(lx - 2.4)} ${n1(ly + 10.4)}h4.8v1.4h-4.8Z" fill="#2c2622"/>`;
    const bodyD_ = `M${n1(lx - 2.2)} ${n1(ly + 1.4)}C${n1(lx - 5)} ${n1(ly + 3)} ${n1(lx - 5)} ${n1(ly + 8.8)} ${n1(lx - 2.2)} ${n1(ly + 10.4)}H${n1(lx + 2.2)}C${n1(lx + 5)} ${n1(ly + 8.8)} ${n1(lx + 5)} ${n1(ly + 3)} ${n1(lx + 2.2)} ${n1(ly + 1.4)}Z`;
    const ribs = `M${n1(lx - 3.9)} ${n1(ly + 4)}h7.8M${n1(lx - 4.3)} ${n1(ly + 6)}h8.6M${n1(lx - 3.9)} ${n1(ly + 8)}h7.8`;
    const inner = rad(c, red ? 'plr' : 'plw', red ? [[0, '#f29a6a'], [0.55, '#d4643f'], [1, '#9e3f2e']] : [[0, '#fff6dc'], [0.6, '#f1e3c0'], [1, '#cdb88e']]);
    o += L + `<path d="${bodyD_}" fill="${inner}"${ol(0.4, 0.7)}/><path d="${ribs}M${n1(lx - 2.2)} ${n1(ly + 2.6)}q-2 3.4 0 6.6M${n1(lx + 2.2)} ${n1(ly + 2.6)}q2 3.4 0 6.6M${n1(lx)} ${n1(ly + 1.4)}v9" stroke="${bodyD}" stroke-width=".35" fill="none" opacity=".8"/>`;
    o += `<path d="M${n1(lx - 1.6)} ${n1(ly + 2.4)}q-1.6 3.6 0 7" stroke="#ffffff" stroke-width=".7" fill="none" opacity=".4" stroke-linecap="round"/>`;
    if (red) o += `<path d="M${n1(lx - 1)} ${n1(ly + 5)}h2M${n1(lx - 0.6)} ${n1(ly + 6.6)}h1.4" stroke="#2c2622" stroke-width=".5" opacity=".7"/>`;
    o += `<path d="M${n1(lx)} ${n1(ly + 11.8)}v1.2" stroke="#2c2622" stroke-width=".5"/><path d="M${n1(lx - 0.7)} ${n1(ly + 13)}h1.4l.3 3.4h-2Z" fill="${red ? '#d4a24a' : '#c0443a'}"/>`;
    o += `<circle cx="${n1(lx)}" cy="${n1(ly + 6)}" r="8" fill="transparent"/>`;
    if (c.night) {
      lit += glow(c, lx, ly + 6, 15, red ? '#f08a4c' : '#f6c46a', 0.8, 'ga ga-flicker') + `<path d="${bodyD_}" fill="${red ? '#f19a62' : '#fbe0a0'}"/><path d="${ribs}" stroke="${red ? '#c4553e' : '#d9a85a'}" stroke-width=".45"/>`;
    }
  });
  if (lit) c.light.push(lit);
  return o;
}

function fireflies(c: C): string {
  if (!c.night) return '';
  const summer = c.s === 1;
  const pts: Pt[] = [[214, 218], [240, 226], [252, 212], [196, 196], [140, 214], [96, 226], [274, 238], [226, 246], [168, 190], [28, 120], [44, 96], [120, 240], [292, 206], [60, 200]];
  const col = summer ? '#e4f08a' : '#f7d89a';
  let o = '';
  pts.forEach(([x, y], i) => {
    o += `<g class="ga ga-fly" style="animation-delay:-${(((i * 7) % 30) / 15).toFixed(4)}s">${glow(c, x, y, summer ? 6 : 5, col, 0.9)}<circle cx="${x}" cy="${y}" r="${summer ? 0.9 : 0.7}" fill="${summer ? '#f9fcd2' : '#fff1cf'}"/></g>`;
  });
  c.light.push(`<g class="gd-flies">${o}</g>`);
  return '';
}

/* ───────────────────────── visitors ───────────────────────── */

function visitorArt(c: C, id: string): string {
  switch (id) {
    case 'magpie': {
      // on the wall cap between the swing posts, tail out to the right
      const x = 72;
      const y = 94;
      return (
        `<g transform="translate(${x} ${y})"><path d="M5 -3L18 -1.4L18.4 .4L5 -1Z" fill="#2f4a5c"/>` +
        `<path d="M-6 -5C-6 -9 -1 -10 3 -8C6 -7 7 -4 5 -2C2 0 -4 0 -6 -5Z" fill="#1f1d1c"${ol(0.3, 0.65)}/><path d="M-2 -3.6C0 -6.2 4 -6.2 5 -3.6C3 -1.6 0 -1.6 -2 -3.6Z" fill="#f4f1ea"/>` +
        `<path d="${ell(-6.6, -8, 3, 2.8)}" fill="#1f1d1c"${ol(0.3, 0.65)}/><path d="M-9.4 -8.4L-12.6 -7.6L-9.4 -7.2Z" fill="#1f1d1c"${ol(0.3, 0.65)}/><circle cx="-7.4" cy="-8.6" r=".45" fill="#e8e2d4"/>` +
        `<path d="M-1 -1L-1.6 1.6M1.6 -1L1.4 1.6" stroke="#2a2724" stroke-width=".6"/><path d="M1 -6.4q2 -.4 3.4 1M.4 -5.2q2 -.2 3.6 1.2" stroke="#3d6a80" stroke-width=".6" fill="none"/><path d="M7 -2.2L17.6 -.8" stroke="#5a8aa0" stroke-width=".4" opacity=".7"/></g>`
      );
    }
    case 'heron': {
      const x = 140;
      const y = 224;
      return (
        `<g transform="translate(${x} ${y}) scale(1.2)"><ellipse cx="0" cy=".4" rx="7" ry="1.2" fill="none" stroke="#ffffff" stroke-width=".5" opacity=".7"/>` +
        `<path d="M-1 -12L-1.6 0M1.6 -12L2 0" stroke="#6f6656" stroke-width=".8"/>` +
        `<path d="M-6 -15C-5 -20 4 -21 8 -16C9 -13 6 -11.6 3 -11.6C-1 -11.6 -5 -12 -6 -15Z" fill="#7f898f"${ol(0.3, 0.65)}/><path d="M1 -18.6C5 -18.6 8 -16 9 -13.6" stroke="#3f4548" stroke-width="1.1" fill="none"/>` +
        `<path d="M-4.6 -17C-6 -22 -4 -25 -6 -29" stroke="#eef0ee" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M-5.2 -19.6C-6 -22 -5 -24 -5.6 -26" stroke="#3f4548" stroke-width=".4" fill="none" opacity=".6"/>` +
        `<path d="${ell(-6.4, -29.6, 2.2, 1.6)}" fill="#f4f5f2"${ol(0.3, 0.65)}/><path d="M-6 -31C-4 -31.6 -2 -31 -.4 -29.6" stroke="#1f1d1c" stroke-width=".8" fill="none" stroke-linecap="round"/>` +
        `<path d="M-8.4 -29.8L-14.6 -28.6L-8.4 -28.8Z" fill="#d1aa3e"/><circle cx="-6.8" cy="-30" r=".4" fill="#1f1d1c"${ol(0.3, 0.65)}/></g>`
      );
    }
    case 'mate':
      return `<ellipse cx="249" cy="216.4" rx="7" ry="1.4" fill="none" stroke="#ffffff" stroke-width=".5" opacity=".6"/>` + crane(c, 246, 216, true, true);
    case 'squirrel': {
      // clinging to the trunk, head up, a persimmon in its paws
      const x = 326;
      const y = 122;
      return (
        `<g transform="translate(${x} ${y}) rotate(72)"><path d="M3 -2C9 -3 11 -9 8 -13C6 -15 4 -13 5 -11C6 -9 4 -6 2 -5Z" fill="#a8643a"${ol(0.3, 0.65)}/>` +
        `<path d="M-4 -1C-5 -5 -3 -8 0 -8C3 -8 4 -5 3 -1Z" fill="#b8784a"${ol(0.3, 0.65)}/><path d="M-2.6 -6.6v5.2M-.6 -7.4v6" stroke="#4a3426" stroke-width=".45"/>` +
        `<path d="${ell(-3.2, -9, 2.6, 2.2)}" fill="#b8784a"${ol(0.3, 0.65)}/><path d="M-4.6 -10.6l.2 -1.8 1.2 1.2Z" fill="#a8643a"${ol(0.3, 0.65)}/><circle cx="-4.2" cy="-9.2" r=".4" fill="#1f1a17"/>` +
        `<path d="M4 -3.4q4.2-1.4 4.6-6.4M5.4 -4q2.4-2.6 1.6-6.4" stroke="#d9a070" stroke-width=".35" fill="none" opacity=".8"/><circle cx="-5.6" cy="-6.4" r="1.4" fill="#e57f2a"${ol(0.25, 0.6)}/></g>`
      );
    }
    case 'tanuki': {
      const x = 98;
      const y = 256;
      return (
        `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="0" rx="8" ry="1.6" fill="#3a2e22" opacity=".15"/>` +
        `<path d="M4 -2C9 -1 10 -5 7 -6" stroke="#5a4636" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M7.6 -2.4l1.2 .8M8.6 -4.2l1.2 .2" stroke="#2e2622" stroke-width=".6"/>` +
        `<path d="M-5 0C-6 -6 -4 -10 0 -10C4 -10 6 -6 5 0Z" fill="#8a6f55"${ol(0.3, 0.65)}/><path d="M-3 -1C-3 -4 -1 -6 0 -6C1 -6 3 -4 3 -1Z" fill="#c8b394"/>` +
        `<path d="${ell(0, -12, 4.4, 3.6)}" fill="#8a6f55"${ol(0.3, 0.65)}/><path d="M-4 -12.4C-3 -14 -1 -13.6 0 -12C1 -13.6 3 -14 4 -12.4C3 -10.6 1 -10.6 0 -11.4C-1 -10.6 -3 -10.6 -4 -12.4Z" fill="#2e2622"/>` +
        `<path d="M-3.6 -14.6l-.6 -2.4 2 1.4ZM3.6 -14.6l.6 -2.4 -2 1.4Z" fill="#5a4636"/><path d="M-1 -10.2h2l-1 1Z" fill="#1f1a17"/><circle cx="-1.8" cy="-12.2" r=".4" fill="#e8dcc6"/><circle cx="1.8" cy="-12.2" r=".4" fill="#e8dcc6"/></g>`
      );
    }
    case 'sparrow': {
      const x = 308;
      const y = eaveY(308) + 1.2;
      return (
        `<g transform="translate(${x} ${n1(y)})"><path d="M-3 3.6C-3 1 0 -.4 3 1C5 2 6 4 5 5.4C3 6.4 -1 6.2 -3 3.6Z" fill="#8a6a4a"${ol(0.3, 0.65)}/>` +
        `<path d="M4 4L8.6 6L8 6.8L4 5.4Z" fill="#6a5038"/><path d="M-1 4.6C1 5.6 3 5.6 4 4.8" stroke="#e4d8c4" stroke-width=".8" fill="none"/>` +
        `<path d="${ell(-3.4, 2.4, 2.4, 2.1)}" fill="#7a4e34"${ol(0.3, 0.65)}/><path d="M-4.6 3.4C-4 4.4 -2.6 4.4 -2 3.6" stroke="#f1ebe0" stroke-width=".9" fill="none"/><circle cx="-4.2" cy="4.4" r=".5" fill="#2a2420"/>` +
        `<path d="M-5.6 2.2L-7.2 2.6L-5.6 3Z" fill="#3a302a"/><circle cx="-4" cy="1.9" r=".35" fill="#1f1a17"/><path d="M-1 6.4v1.6M1 6.4v1.6" stroke="#5a4636" stroke-width=".5"/></g>`
      );
    }
    case 'butterfly': {
      const x = 242;
      const y = 214;
      return (
        `<g transform="translate(${x} ${y})"><g class="ga ga-flutter"><path d="M0 0C-3 -5 -7 -5 -6.4 -2C-6 0 -3 .6 0 0ZM0 0C-2 2 -5 4 -4.6 1.6" fill="#f8f6ee" stroke="#c9c4b6" stroke-width=".3"/>` +
        `<path d="M0 0C3 -5 7 -5 6.4 -2C6 0 3 .6 0 0ZM0 0C2 2 5 4 4.6 1.6" fill="#f8f6ee" stroke="#c9c4b6" stroke-width=".3"/><circle cx="-4" cy="-2.6" r=".55" fill="#3a3530"/><circle cx="4" cy="-2.6" r=".55" fill="#3a3530"/></g>` +
        `<path d="M0 -1.8V1.6M0 -1.8l-1 -1.6M0 -1.8l1 -1.6" stroke="#3a3530" stroke-width=".45" fill="none"/></g>`
      );
    }
    case 'whiteeye': {
      const x = 116;
      const y = 92;
      return (
        `<g transform="translate(${x} ${y})"><path d="M-3 -1C-3 -4 1 -5.4 4 -3.6C6 -2.4 6 0 4 1C1 2 -2 1.4 -3 -1Z" fill="#9aa83f"${ol(0.3, 0.65)}/>` +
        `<path d="M4 -1L8 0.4L7.6 1.2L3.6 .4Z" fill="#7a8634"/><path d="M-1 .6C1 1.6 3 1.4 4 .6" stroke="#e4dcb8" stroke-width=".9" fill="none"/>` +
        `<path d="${ell(-3, -3.4, 2.4, 2.1)}" fill="#a9b648"${ol(0.3, 0.65)}/><circle cx="-3.4" cy="-3.6" r="1" fill="#fbfaf2"/><circle cx="-3.4" cy="-3.6" r=".45" fill="#1f1a17"/>` +
        `<path d="M-5.2 -3.4L-7 -3L-5.2 -2.6Z" fill="#3a302a"/><path d="M-1 1.8v1.4M.8 1.8v1.4" stroke="#4a3e34" stroke-width=".45"/></g>`
      );
    }
  }
  return '';
}

/* ───────────────────────── composition ───────────────────────── */

type Painter = (c: C) => string;

/** Fixed spots, back to front. `box` frames the item for its Market vignette. */
export const GARDEN_SPOTS: Record<string, { z: number; at: [number, number]; box: [number, number, number, number]; paint: Painter }> = {
  pond: { z: 1, at: [196, 202], box: [128, 160, 120, 80], paint: pond },
  stones: { z: 2, at: [180, 274], box: [88, 206, 104, 76], paint: stones },
  koi: { z: 3, at: [240, 206], box: [200, 186, 80, 40], paint: koi },
  bridge: { z: 4, at: [133, 206], box: [100, 180, 66, 36], paint: bridge },
  wall: { z: 10, at: [180, 120], box: [150, 84, 80, 56], paint: wall },
  bamboo: { z: 12, at: [26, 150], box: [-4, 4, 62, 150], paint: bamboo },
  swing: { z: 14, at: [70, 160], box: [38, 58, 64, 106], paint: swing },
  plum: { z: 16, at: [140, 150], box: [78, 46, 118, 110], paint: plum },
  persimmon: { z: 18, at: [334, 152], box: [266, 22, 108, 136], paint: persimmon },
  pavilion: { z: 20, at: [238, 158], box: [172, 58, 136, 106], paint: pavilion },
  onggi: { z: 22, at: [316, 176], box: [280, 144, 72, 36], paint: onggi },
  deer: { z: 24, at: [166, 170], box: [140, 120, 50, 54], paint: deer },
  maple: { z: 26, at: [40, 214], box: [-2, 124, 128, 96], paint: maple },
  fountain: { z: 28, at: [124, 182], box: [96, 156, 42, 30], paint: fountain },
  crane: { z: 40, at: [266, 228], box: [240, 172, 50, 60], paint: (c) => crane(c) },
  irises: { z: 42, at: [230, 240], box: [206, 210, 48, 34], paint: irises },
  lantern: { z: 44, at: [76, 254], box: [56, 198, 42, 60], paint: (c) => lantern(c) },
  cat: { z: 53, at: [252, 296], box: [232, 274, 40, 26], paint: cat },
  teatable: { z: 48, at: [320, 276], box: [286, 250, 72, 32], paint: teatable },
  wisteria: { z: 50, at: [318, 296], box: [278, 178, 92, 122], paint: wisteria },
  bonsai: { z: 52, at: [34, 297], box: [10, 240, 48, 60], paint: bonsai },
  chime: { z: 60, at: [300, 10], box: [288, 4, 24, 30], paint: chime },
  lanterns: { z: 62, at: [114, 30], box: [62, 8, 104, 56], paint: lanternsString },
  fireflies: { z: 70, at: [214, 218], box: [180, 180, 100, 80], paint: fireflies },
};

/** Visitor spots (for hit areas and the hint). */
export const VISITOR_SPOTS: Record<string, [number, number]> = {
  magpie: [70, 88],
  heron: [136, 204],
  mate: [252, 202],
  squirrel: [326, 118],
  tanuki: [98, 246],
  sparrow: [306, 16],
  butterfly: [242, 212],
  whiteeye: [116, 90],
};

/** Depth of each visitor among the pieces (see GARDEN_SPOTS z). */
const VISITOR_Z: Record<string, number> = { magpie: 15, heron: 41, mate: 41, squirrel: 19, tanuki: 45, sparrow: 61, butterfly: 43, whiteeye: 17 };

/** Where a visitor's note lies once it has gone. */
const NOTE_SPOTS: Record<string, [number, number, number]> = {
  magpie: [76, 97, -8],
  heron: [124, 231, 10],
  mate: [250, 236, -6],
  squirrel: [312, 154, 8],
  tanuki: [100, 258, -10],
  sparrow: [300, 0, 0],
  butterfly: [246, 246, 6],
  whiteeye: [128, 154, -6],
};

function noteArt(id: string): string {
  const [x, y, rot] = NOTE_SPOTS[id] ?? [180, 260, 0];
  if (id === 'sparrow') {
    // a poem strip (tanzaku) tied under the chime's fish
    const cy = eaveY(300) + 28;
    return (
      `<g transform="translate(300 ${n1(cy)})"><g class="ga ga-chime"><path d="M0 0v3" stroke="#3a3330" stroke-width=".35"/><path d="M-2 3h4v13h-4Z" fill="#f4ecdb"/><path d="M-1 5.6h2M-1 7.4h2M-1 9.2h1.4" stroke="#6a5a4a" stroke-width=".35"/><circle cx="0" cy="13.6" r=".8" fill="#c0442d"/></g></g>` +
      `<circle cx="300" cy="${n1(cy + 6)}" r="10" fill="transparent"/>`
    );
  }
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse cx=".6" cy="2.6" rx="5" ry="1.2" fill="#3a2e22" opacity=".14"/>` +
    `<path d="M-4.6 -2.6h9.2v5.2h-9.2Z" fill="#f6efe0"/><path d="M-4.6 -2.6l4.6 3 4.6 -3" stroke="#c9bba0" stroke-width=".5" fill="none"/><circle cx="0" cy=".6" r="1.1" fill="#c0442d"/></g>` +
    `<circle cx="${x}" cy="${y}" r="10" fill="transparent"/>`
  );
}

const byId = new Map(GARDEN_ITEMS.map((i) => [i.id, i]));

/** Items that would actually render (owned, not hidden, needs met). */
export function placedItems(items: readonly string[]): string[] {
  const set = new Set(items.filter((id) => byId.has(id)));
  return [...set].filter((id) => {
    const need = byId.get(id)!.needs;
    return !need || set.has(need);
  });
}

let seq = 0;

function visitorGroup(c: C, id: string): string {
  const [x, y] = VISITOR_SPOTS[id] ?? [180, 200];
  return (
    `<g class="gv" data-visitor="${id}"><circle class="ga gv-ring" cx="${x}" cy="${y}" r="9" fill="none" stroke="#fffaf0" stroke-width=".8"/>` +
    `${visitorArt(c, id)}<circle cx="${x}" cy="${y}" r="12" fill="transparent"/></g>`
  );
}

function context(prefix: string, season: number, night: boolean, has: (id: string) => boolean): C {
  const s = ((season % 4) + 4) % 4;
  return { p: prefix, s, night, pal: PALS[s], defs: new Map(), light: [], has };
}

/** Full garden scene (viewBox 0 0 360 300). */
export function gardenSvg(season: number, items: readonly string[], opts: GardenSvgOpts = {}): string {
  const placed = placedItems(items);
  const set = new Set(placed);
  const c = context(`g${++seq}-`, season, !!opts.night, (id) => set.has(id));
  const body: string[] = [courtyard(c)];
  // one depth-sorted list: pieces, today's visitor (or its note), the maru and the house post
  const layers: [number, () => string][] = placed.map((id) => [
    GARDEN_SPOTS[id].z,
    () => {
      const art = GARDEN_SPOTS[id].paint(c);
      return art ? `<g class="gi" data-item="${id}">${art}</g>` : '';
    },
  ]);
  const visitor = opts.visitor && GARDEN_VISITORS.some((v) => v.id === opts.visitor && set.has(v.needs)) ? opts.visitor : null;
  if (visitor) layers.push([VISITOR_Z[visitor] ?? 90, () => visitorGroup(c, visitor)]);
  const note = !visitor && opts.note && GARDEN_VISITORS.some((v) => v.id === opts.note && set.has(v.needs)) ? opts.note : null;
  if (note) layers.push([note === 'sparrow' ? 61 : (VISITOR_Z[note] ?? 90), () => `<g class="gv gv--note" data-note="${note}">${noteArt(note)}</g>`]);
  layers.push([51, () => maru(c)], [58.5, () => post(c)], [25, () => haze(c)]);
  layers.sort((x, y) => x[0] - y[0]);
  for (const [, paint] of layers) body.push(paint());
  body.push(eaves(c));
  if (c.night) {
    body.push(`<rect width="360" height="300" fill="${linY(c, 'nightwash', 0, 300, [[0, '#0f1a4a', 0.46], [0.45, '#0c1644', 0.6], [1, '#08113a', 0.7]])}" pointer-events="none"/>`);
    body.push(`<rect width="360" height="300" fill="${rad(c, 'nightrim', [[0, '#060c2c', 0], [0.55, '#060c2c', 0], [1, '#060c2c', 0.42]])}" pointer-events="none"/>`);
    // moonlight lying across the middle of the courtyard and on the pond
    c.light.unshift(`<ellipse cx="200" cy="208" rx="150" ry="44" fill="${rad(c, 'moonpool', [[0, '#c4ceff', 0.16], [1, '#c4ceff', 0]])}"/>`);
    let stars = '';
    const r = rng(77);
    for (let k = 0; k < 14; k++) stars += ell(186 + r() * 90, 18 + r() * 44, 0.45, 0.45);
    c.light.unshift(
      `<path d="${stars}" fill="#f4f0dc" opacity=".8"/>` + glow(c, 214, 38, 50, '#c8cbe8', 0.5) + `<circle cx="214" cy="38" r="9.5" fill="#f6f0d8"/><path d="${ell(211, 36, 2.4, 1.6)}${ell(217, 41, 1.6, 1.2)}" fill="#e2dac0" opacity=".6"/>`,
    );
  }
  const light = c.light.length ? `<g class="gd-light" pointer-events="none">${c.light.join('')}</g>` : '';
  return `<svg class="garden-art" viewBox="0 0 360 300" role="img" aria-label="Your garden"><defs>${[...c.defs.values()].join('')}</defs>${body.join('')}${light}</svg>`;
}

/* ───────────────────────── vignettes (Market tiles, the piece sheet, visitor notes) ───────────────────────── */

/**
 * What lies behind a piece in its vignette: open ground (most pieces), water
 * (koi, the bridge), a bank with water behind (irises, the crane), our eaves
 * overhead (the chime, the paper lanterns), the veranda boards (things on the
 * maru) or a summer night (fireflies).
 */
type Ground = 'earth' | 'water' | 'bank' | 'eave' | 'maru' | 'night';

/** Framing in scene units: centre, visible width across the disc, horizon y, ground. */
const VIGNETTE: Record<string, [number, number, number, number, Ground]> = {
  stones: [140, 240, 112, 206, 'earth'],
  lantern: [77, 229, 64, 236, 'earth'],
  pond: [196, 200, 196, 166, 'earth'],
  koi: [240, 206, 92, 0, 'water'],
  bridge: [136, 202, 84, 168, 'earth'],
  bamboo: [27, 84, 156, 138, 'earth'],
  plum: [136, 100, 124, 140, 'earth'],
  maple: [54, 176, 140, 200, 'earth'],
  persimmon: [320, 92, 136, 146, 'earth'],
  bonsai: [34, 270, 64, 282, 'maru'],
  wisteria: [323, 240, 104, 214, 'earth'],
  irises: [229, 226, 52, 222, 'bank'],
  wall: [180, 112, 64, 132, 'earth'],
  onggi: [316, 160, 76, 160, 'earth'],
  pavilion: [240, 112, 138, 150, 'earth'],
  teatable: [320, 264, 72, 256, 'earth'],
  chime: [300, 26, 44, 0, 'eave'],
  lanterns: [114, 50, 104, 0, 'eave'],
  fountain: [114, 170, 52, 175, 'earth'],
  swing: [70, 110, 112, 150, 'earth'],
  cat: [252, 286, 44, 280, 'maru'],
  crane: [262, 204, 62, 212, 'bank'],
  deer: [163, 148, 58, 160, 'earth'],
  fireflies: [0, 0, 1, 0, 'night'],
};

/** Visitors: framing as above, around where each sits with its host. */
const VISITOR_VIGNETTE: Record<string, [number, number, number, number, Ground]> = {
  magpie: [76, 100, 50, 132, 'earth'],
  heron: [136, 206, 56, 0, 'water'],
  mate: [258, 202, 76, 212, 'bank'],
  squirrel: [326, 112, 50, 146, 'earth'],
  tanuki: [86, 236, 56, 238, 'earth'],
  sparrow: [303, 26, 44, 0, 'eave'],
  butterfly: [236, 224, 50, 222, 'bank'],
  whiteeye: [118, 90, 50, 140, 'earth'],
};

/** Season colours for the vignette ground cover. */
const COVER: [string[], string[]][] = [
  [['#a9bd88', '#bccb98', '#93ab76'], ['#f2cfd8', '#f8e2e6']],
  [['#7fa067', '#95b47a', '#6a8d58'], ['#e9e2a8']],
  [['#b7a368', '#a99a5c'], ['#c4553a', '#d98a3c', '#e0ad4f', '#b8652e']],
  [['#e3e9ef', '#d6dee8'], ['#ffffff']],
];

/** A painted backdrop in the 120 × 120 vignette space, horizon at `hy`. */
function backdrop(c: C, kind: Ground, hy0: number): string {
  const hy = Math.max(-10, Math.min(118, hy0));
  const P = c.pal;
  const s = c.s;
  const r = rng(301 + s * 7 + kind.length);
  if (kind === 'night') {
    let o = `<rect width="120" height="120" fill="${linY(c, 'vn', 0, 120, [[0, '#1d2550'], [0.6, '#2c3768'], [1, '#3a4472']])}"/>`;
    o += glow(c, 84, 30, 26, '#c8cbe8', 0.55) + `<circle cx="84" cy="30" r="7" fill="#f4eed6"/><path d="${ell(82, 28.6, 1.8, 1.2)}${ell(86.4, 32, 1.2, 0.9)}" fill="#e0d8bc" opacity=".6"/>`;
    o += dabs(Array.from({ length: 12 }, () => [10 + r() * 100, 8 + r() * 50, 0.35] as Dab), '#f4f0dc', 0.8);
    const far = ridgeV(r, 78, 6, 0.9);
    o += `<path d="${far}V120H-4Z" fill="#323c6a"/><path d="${ridgeV(r, 88, 5, 0.7)}V120H-4Z" fill="#26305a"/>`;
    return o;
  }
  const sky = linY(c, 'vsky', 0, Math.max(30, hy), P.sky);
  let o = `<rect width="120" height="120" fill="${sky}"/>`;
  if (kind === 'eave') {
    // under our eaves: deep shade at the top, the sky and far hills beyond
    o += glow(c, 88, 70, 30, P.halo, 0.5) + `<circle cx="88" cy="70" r="6.5" fill="${P.sun}" opacity=".85"/>`;
    o += `<path d="${ridgeV(r, 98, 7, 1)}V120H-4Z" fill="${P.far[0]}" opacity=".75"/><path d="${ridgeV(r, 108, 5, 0.8)}V120H-4Z" fill="${P.near[0]}" opacity=".8"/>`;
    o += `<rect y="96" width="120" height="24" fill="${rad(c, 'vmist', [[0, P.mist, 0.9], [1, P.mist, 0]])}" opacity=".8"/>`;
    return o;
  }
  // sun and its halo, high on the right; a thin cloud
  if (hy > 26) {
    o += glow(c, 90, Math.min(28, hy * 0.45), 26, P.halo, 0.6) + `<circle cx="90" cy="${n1(Math.min(28, hy * 0.45))}" r="${s === 3 ? 5.5 : 6.5}" fill="${P.sun}" opacity=".85"/>`;
    const seg: Pt[] = [];
    for (let k = 0; k <= 5; k++) seg.push([18 + k * 9, Math.min(36, hy * 0.5) + Math.sin(k) * 0.6]);
    o += `<path d="${ribbon(seg, 1.6, r)}" fill="${P.mist}" opacity=".85"/>`;
  }
  // far and near hills sinking into mist at the horizon
  if (hy > 14 && kind !== 'water') {
    o += `<path d="${ridgeV(r, hy - 13, 7, 1)}V${n1(hy + 4)}H-4Z" fill="${linY(c, 'vfar', hy - 22, hy, [[0, P.far[0]], [1, P.far[1]]])}"/>`;
    o += `<path d="${ridgeV(r, hy - 5, 4, 0.8)}V${n1(hy + 4)}H-4Z" fill="${linY(c, 'vnear', hy - 10, hy, [[0, P.near[0]], [1, P.near[1]]])}"/>`;
    if (s < 3) o += scatter(r, [[20, hy - 6, 22, 3], [96, hy - 5, 24, 3]], 30, 1, 2, P.grove, 0.7, 0.7);
    o += `<rect y="${n1(hy - 7)}" width="120" height="12" fill="${linY(c, 'vhz', hy - 7, hy + 5, [[0, P.mist, 0], [0.7, P.mist, 0.85], [1, P.mist, 0.4]])}"/>`;
  }
  const water = (y0: number) => {
    const wt = linY(c, 'vwater', y0, 120, [[0, P.water[0]], [0.35, mix(P.water[0], P.water[1], 0.55)], [1, P.water[1]]]);
    let w = `<rect y="${n1(y0)}" width="120" height="${n1(120 - y0)}" fill="${wt}"/>`;
    let rp = '';
    for (let k = 0; k < 14; k++) {
      const y = y0 + 4 + (k / 14) * (116 - y0);
      const x = 6 + r() * 96;
      rp += `M${n1(x)} ${n1(y)}h${n1(6 + r() * 14 * (0.5 + (y - y0) / 120))}`;
    }
    w += `<path d="${rp}" stroke="#ffffff" stroke-width=".7" stroke-linecap="round" opacity=".5"/>`;
    w += `<path d="${rp}" stroke="${mix(P.water[1], '#22323a', 0.4)}" stroke-width=".5" stroke-linecap="round" opacity=".25" transform="translate(3 1.6)"/>`;
    if (s === 3) w += `<path d="M0 ${n1(y0 + 10)}Q40 ${n1(y0 + 4)} 70 ${n1(y0 + 12)}T120 ${n1(y0 + 8)}V${n1(y0 + 22)}Q80 ${n1(y0 + 28)} 40 ${n1(y0 + 20)}T0 ${n1(y0 + 26)}Z" fill="#f4f7f8" opacity=".5"/>`;
    return w;
  };
  if (kind === 'water') return o + water(0);
  if (kind === 'bank') {
    // the far bank, then open water down to a strip of near bank
    o += `<rect y="${n1(hy - 2)}" width="120" height="4" fill="${s === 3 ? '#e4e8ea' : mix(P.ground[1], '#6b6450', 0.25)}"/>`;
    o += water(hy + 1.5);
    const by = hy + (120 - hy) * 0.58;
    o += `<path d="M-4 ${n1(by + 4)}Q30 ${n1(by - 2)} 60 ${n1(by + 1)}T124 ${n1(by - 1)}V124H-4Z" fill="${linY(c, 'vbank', by - 2, 120, [[0, P.ground[0]], [1, P.ground[1]]])}"/>`;
    o += `<path d="M-4 ${n1(by + 4)}Q30 ${n1(by - 2)} 60 ${n1(by + 1)}T124 ${n1(by - 1)}" stroke="${mix(P.ground[1], '#4a4030', 0.35)}" stroke-width=".8" fill="none" opacity=".45"/>`;
    o += cover(c, r, by + 2, 0.6);
    return o;
  }
  if (kind === 'maru') {
    // the veranda's boards, the courtyard beyond them
    o += `<rect y="${n1(hy - 1)}" width="120" height="${n1(121 - hy)}" fill="${linY(c, 'vyard', hy - 1, hy + 16, [[0, P.ground[0]], [1, P.ground[1]]])}"/>`;
    const fy = Math.min(112, hy + 16);
    o += `<rect y="${n1(fy)}" width="120" height="${n1(120 - fy)}" fill="${linY(c, 'vmaru', fy, 120, [[0, '#ad855c'], [0.4, '#946a40'], [1, '#7a5332']])}"/>`;
    let seams = '';
    for (let k = -4; k <= 4; k++) seams += `M${n1(60 + k * 16)} ${n1(fy + 1)}L${n1(60 + k * 24)} 120`;
    o += `<path d="${seams}" stroke="#5e4028" stroke-width=".7" opacity=".5"/><path d="M0 ${n1(fy)}H120" stroke="#d6b386" stroke-width="1.4"/>`;
    o += `<path d="M10 ${n1(fy + 9)}q20 -1 36 0M66 ${n1(fy + 15)}q22 -1 40 .4M30 ${n1(fy + 24)}q14 -.6 30 0" stroke="#c7a37a" stroke-width=".6" fill="none" opacity=".5"/>`;
    return o;
  }
  // open ground: a gradient plane, broom sweeps, pebbles and what the season leaves
  o += `<rect y="${n1(hy - 1)}" width="120" height="${n1(121 - hy)}" fill="${linY(c, 'vground', hy - 1, 120, [[0, P.ground[0]], [1, mix(P.ground[1], '#6a5638', 0.18)]])}"/>`;
  let sw = '';
  for (let k = 0; k < 9; k++) {
    const y = hy + 6 + r() * (114 - hy);
    const x = r() * 120;
    const w = 8 + ((y - hy) / 120) * 18;
    for (let j = 0; j < 3; j++) sw += `M${n1(x - w / 2)} ${n1(y + j * 1.6)}q${n1(w / 2)} -2 ${n1(w)} 0`;
  }
  o += `<path d="${sw}" stroke="${P.rake}" stroke-width=".55" fill="none" opacity=".55" stroke-linecap="round"/>`;
  o += cover(c, r, hy + 4, 1);
  return o;
}

/** A ridge line across the vignette (as path data, open at the bottom). */
function ridgeV(r: () => number, base: number, amp: number, rough: number): string {
  const ph = r() * 6;
  const pk = 20 + r() * 80;
  const pts: Pt[] = [];
  for (let x = -4; x <= 124; x += 8) pts.push([x, base - amp * Math.exp(-(((x - pk) / 26) ** 2)) - Math.sin(x / 13 + ph) * rough * 1.6]);
  return smooth(pts) + 'L124 130';
}

/** Ground cover of the season, from `y0` down. */
function cover(c: C, r: () => number, y0: number, amt: number): string {
  const [base, accent] = COVER[c.s];
  const h = 120 - y0;
  if (h <= 2) return '';
  const cl: Clump[] = [[12, y0 + h * 0.7, 20, h * 0.28], [108, y0 + h * 0.6, 18, h * 0.3], [60, y0 + h * 0.92, 46, h * 0.1]];
  let o = c.s === 3 ? '' : scatter(r, cl, Math.round(30 * amt), 0.9, 2.2, base, 0.8, 0.5);
  // a few fallen things, drawn: petals, leaves, nothing in summer and winter
  if (c.s === 0 || c.s === 2) {
    const g = accent.map(() => '');
    for (let k = 0; k < Math.round((c.s === 2 ? 9 : 6) * amt); k++) {
      const x = 8 + r() * 104;
      const y = y0 + 4 + r() * (h - 8);
      const sz = (c.s === 2 ? 2.6 : 1.8) * (0.7 + (y - y0) / h * 0.6);
      g[k % g.length] += leaf(x, y, sz, r() * 360, sz * 0.38);
    }
    o += g.map((d, i) => (d ? `<path d="${d}" fill="${accent[i]}" opacity=".9"/>` : '')).join('');
  }
  if (c.s < 3) {
    let d = '';
    for (let k = 0; k < Math.round(8 * amt); k++) {
      const [cx, cy, rx, ry] = cl[k % 2];
      const x = cx + (r() - 0.5) * rx * 1.6;
      const y = cy + (r() - 0.5) * ry;
      for (let j = 0; j < 3; j++) d += leaf(x + j * 0.9, y, 3.2 + r() * 2.4, -90 + (j - 1) * 22 + (r() - 0.5) * 14, 0.5);
    }
    o += `<path d="${d}" fill="${base[base.length - 1]}" opacity=".9"/>`;
  } else {
    // snow: drifts in a soft blue shade
    o += `<path d="M-4 ${n1(y0 + h * 0.35)}Q30 ${n1(y0 + h * 0.2)} 60 ${n1(y0 + h * 0.36)}T124 ${n1(y0 + h * 0.3)}V${n1(y0 + h * 0.46)}Q90 ${n1(y0 + h * 0.4)} 56 ${n1(y0 + h * 0.5)}T-4 ${n1(y0 + h * 0.5)}Z" fill="${SNOW_SHADE}" opacity=".6"/>`;
  }
  return o;
}

/** The disc around a vignette: a drop shadow, the clip, an edge darkening, a paper rim. */
function disc(c: C, inner: string): string {
  const clip = `${c.p}disc`;
  const rim = rad(c, 'vrim', [[0, '#3a2a1c', 0], [0.78, '#3a2a1c', 0], [1, '#3a2a1c', 0.2]]);
  return (
    `<svg class="garden-item-art" viewBox="0 0 120 120" aria-hidden="true"><defs><clipPath id="${clip}"><circle cx="60" cy="60" r="54"/></clipPath>${[...c.defs.values()].join('')}</defs>` +
    `<circle cx="60" cy="61.6" r="55" fill="#2a1e14" opacity=".1"/><g clip-path="url(#${clip})">${inner}<circle cx="60" cy="60" r="54" fill="${rim}"/></g>` +
    `<circle cx="60" cy="60" r="53.4" fill="none" stroke="#fffaf0" stroke-opacity=".55" stroke-width="1.2"/><circle cx="60" cy="60" r="54.3" fill="none" stroke="#3a2a1c" stroke-opacity=".32" stroke-width=".7"/></svg>`
  );
}

/** Scene art placed in the vignette: centre (fx, fy) scaled so `w` scene units span the disc. */
function frame(art: string, fx: number, fy: number, w: number): string {
  const k = Math.round((108 / w) * 100) / 100;
  return `<g transform="translate(60 60) scale(${k}) translate(${n1(-fx)} ${n1(-fy)})">${art}</g>`;
}

const horizon = (fy: number, w: number, hz: number): number => 60 + (hz - fy) * (108 / w);

/** A visitor on its own paper disc (for its note), with a little of what it came for. */
export function gardenVisitorSvg(id: string, season = seasonOf(), items: readonly string[] = []): string {
  const v = GARDEN_VISITORS.find((x) => x.id === id);
  const at = VISITOR_SPOTS[id];
  if (!v || !at) return '';
  const set = new Set([...items, v.needs, ...(byId.get(v.needs)?.needs ? [byId.get(v.needs)!.needs!] : [])]);
  const c = context(`gv${++seq}-`, season, false, (x) => set.has(x));
  c.vig = true;
  const host = GARDEN_SPOTS[v.needs];
  let art = '';
  if (set.has('pond') && v.needs !== 'pond' && (id === 'mate' || id === 'heron' || id === 'butterfly')) art += pond(c);
  const [fx, fy, w, hz, kind] = VISITOR_VIGNETTE[id] ?? [at[0], at[1], 50, at[1] + 10, 'earth' as Ground];
  c.view = [fx - w / 2, fx + w / 2];
  if (kind === 'eave') art += eaves(c);
  art += host.paint(c);
  art += visitorArt(c, id);
  return disc(c, backdrop(c, kind, horizon(fy, w, hz)) + frame(art, fx, fy, w));
}

/** One item on its own (viewBox 0 0 120 120) on a painted disc, for Market tiles and the piece sheet. */
export function gardenItemSvg(id: string, season = seasonOf()): string {
  const spot = GARDEN_SPOTS[id];
  if (!spot) return `<svg class="garden-item-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="#e9dfcc"/></svg>`;
  const s = ((season % 4) + 4) % 4;
  const set = new Set([id, ...(byId.get(id)?.needs ? [byId.get(id)!.needs!] : [])]);
  const night = id === 'fireflies';
  const c = context(`gi${++seq}-`, night ? 1 : s, night, (x) => set.has(x));
  c.vig = true;
  const [fx, fy, w, hz, kind] = VIGNETTE[id];
  c.view = [fx - w / 2, fx + w / 2];
  if (night) return disc(c, backdrop(c, 'night', 90) + fireflyVignette(c));
  let art = '';
  if (set.has('pond') && id !== 'pond' && kind !== 'water' && kind !== 'bank') art += pond(c);
  if (kind === 'eave') art += eaves(c);
  art += spot.paint(c);
  art += c.light.join('');
  return disc(c, backdrop(c, kind, horizon(fy, w, hz)) + frame(art, fx, fy, w));
}

/** Fireflies over iris leaves and reeds on a summer night. */
function fireflyVignette(c: C): string {
  const r = rng(91);
  let o = '';
  // reeds and iris blades in silhouette, a few leaves catching the moon
  let back = '';
  let front = '';
  for (let x = -4; x < 124; x += 2.6 + r() * 2) {
    const h = 14 + r() * 22;
    const lean = (r() - 0.5) * 10;
    const d = `M${n1(x - 0.9)} 122Q${n1(x + lean * 0.3)} ${n1(122 - h * 0.6)} ${n1(x + lean)} ${n1(122 - h)}Q${n1(x + lean * 0.3 + 0.8)} ${n1(122 - h * 0.6)} ${n1(x + 0.9)} 122Z`;
    if (r() < 0.5) back += d;
    else front += d;
  }
  o += `<path d="${back}" fill="#2f4446"/>`;
  // a pale pool of water behind the reeds, the moon in it
  o += `<path d="M-4 96Q60 90 124 96V104H-4Z" fill="#3c4a78" opacity=".8"/><path d="M80 94.6h8M81.6 96.6h5M82.6 98.6h3" stroke="#f3eccd" stroke-width=".7" stroke-linecap="round" opacity=".7"/>`;
  o += `<path d="${front}" fill="#1f3032"/>`;
  o += `<path d="M30 122Q31 104 27 92M70 122Q69 108 73 98" stroke="#2a3c3c" stroke-width="1" fill="none"/>`;
  o += `<path d="M26.4 92c-2-1-2.4-4-1-6 2 .6 2.6 3.6 1 6ZM73.6 98c1.6-1.6 1.6-4.4 0-6-1.4 1.6-1.6 4.4 0 6Z" fill="#3d3a66"/>`;
  for (const [x, y, g] of [[22, 52, 1], [40, 70, 0.8], [58, 46, 1], [70, 64, 0.9], [88, 54, 0.7], [50, 84, 1], [94, 76, 0.8], [30, 86, 0.6], [80, 90, 0.7], [64, 30, 0.5], [16, 72, 0.6]] as const) {
    o += glow(c, x, y, 7 * g, '#e4f08a', 0.85) + `<circle cx="${x}" cy="${y}" r="${n1(0.6 + g * 0.5)}" fill="#f9fcd2"/>`;
  }
  return o;
}
