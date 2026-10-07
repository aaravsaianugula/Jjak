/**
 * Card cosmetics: deck styles (how every card face is painted), card backs
 * (snow cards, dealing) and the gold-leaf foil edition overlay.
 *
 * CONTRACT (used by the Market and the Album; the art is drawn here):
 *   DECK_STYLES / CARD_BACKS  — catalog data (ids are stable save keys)
 *   applyDeckStyle(id)        — repaint the sprite / root styling for that deck
 *   applyCardBack(id)         — repaint the #card-back and #card-snow symbols
 *   foilOverlay()             — SVG markup layered over a card in a 100×140 box
 *
 * How deck styles work: the card art is drawn once in lowercase hex. A style
 * is a colour function (see palette.ts) that every colour in the markup goes
 * through when the sprite is built, plus a few overlay hooks (texture, a gold
 * edge, chip colours) written in UPPERCASE hex so the painter leaves them be.
 * "classic" is the identity: the sprite markup is exactly the unpainted art.
 */
import { CARD_PAPER, MONTH_TINTS, cardBackInner, cardInner, deckSpriteMarkup, installCardSprite, motifMarkup, spriteDefs, type CardLook } from './cards';
import { BACK_ART } from './backs';
import { clamp, hexToLch, labDist, lchToHex, mixHue, painter, hueDist, type Lch } from './palette';
import { rng } from './specials';

export interface CosmeticDef {
  id: string;
  name: string;
  ko: string;
  ja: string;
  /** one line for the Market */
  blurb: string;
}

export const DECK_STYLES: CosmeticDef[] = [
  { id: 'classic', name: 'Classic', ko: '기본', ja: '基本', blurb: 'The everyday deck: soft paper, clean ink.' },
  { id: 'sumi', name: 'Ink wash', ko: '수묵', ja: '水墨', blurb: 'Painted in shades of ink, with one touch of red.' },
  { id: 'moonlit', name: 'Moonlit', ko: '달밤', ja: '月夜', blurb: 'Indigo night paper with silver lines.' },
  { id: 'celadon', name: 'Celadon', ko: '청자', ja: '青磁', blurb: 'The jade-green glaze of Goryeo celadon.' },
  { id: 'woodblock', name: 'Woodblock', ko: '목판', ja: '木版', blurb: 'Bold printed blocks of colour, like an old print.' },
  { id: 'gilded', name: 'Gold leaf', ko: '금박', ja: '金箔', blurb: 'Every card edged and flecked with gold.' },
];

export const CARD_BACKS: CosmeticDef[] = [
  { id: 'classic', name: 'Night sky', ko: '밤하늘', ja: '夜空', blurb: 'The original indigo back.' },
  { id: 'seigaiha', name: 'Blue waves', ko: '청해파', ja: '青海波', blurb: 'Overlapping waves, a pattern for calm seas.' },
  { id: 'dancheong', name: 'Dancheong', ko: '단청', ja: '丹青', blurb: 'Painted like the eaves of a Korean temple.' },
  { id: 'asanoha', name: 'Hemp leaf', ko: '삼잎', ja: '麻の葉', blurb: 'A six-point star pattern for growing strong.' },
  { id: 'clouds', name: 'Lucky clouds', ko: '구름', ja: '瑞雲', blurb: 'Curling clouds that bring good fortune.' },
  { id: 'moon', name: 'Harvest moon', ko: '보름달', ja: '満月', blurb: 'A full moon over silver grass.' },
];

const f = (n: number) => Math.round(n * 10) / 10;

/* ================================================================== */
/* Deck styles                                                         */
/* ================================================================== */

interface DeckLook {
  /** colour function for one lowercase hex colour */
  color?: (hex: string, lch: Lch, ground: boolean) => string;
  look?: CardLook;
  /** extra gradients / patterns (ids start with `ds-`) */
  defs?: () => string;
}

let groundSet: Set<string> | null = null;
/** Paper and panel tints: the "ground" every style repaints as its paper. */
const grounds = () => (groundSet ??= new Set([CARD_PAPER, ...MONTH_TINTS]));

/** Seeded scatter of small gold flecks (kirikane squares and strips), as path data. */
function flecks(seed: number, n: number, zone: (r: () => number) => [number, number], size: [number, number]): string {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = zone(r);
    const s = size[0] + r() * (size[1] - size[0]);
    const a = r() * Math.PI;
    const strip = r() < 0.25;
    const w = strip ? s * 0.32 : s;
    const h = strip ? s * 1.8 : s * (0.7 + r() * 0.4);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const pts = [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ].map(([px, py]) => `${f(x + px * c - py * sn)} ${f(y + px * sn + py * c)}`);
    d += `M${pts.join('L')}Z`;
  }
  return d;
}

/** Edge-weighted position inside the panel (flecks keep off the centre). */
const edgeZone = (r: () => number): [number, number] => {
  const band = r();
  if (band < 0.36) return [7 + r() * 86, 7 + r() * 20];
  if (band < 0.72) return [7 + r() * 86, 112 + r() * 22];
  return [r() < 0.5 ? 6 + r() * 9 : 85 + r() * 9, 26 + r() * 88];
};

/** Like edgeZone, but never on the corner chip or the kanji tag. */
const clearZone = (r: () => number): [number, number] => {
  for (;;) {
    const [x, y] = edgeZone(r);
    if (x < 23 && y < 25) continue;
    if (x > 70 && y > 112) continue;
    return [x, y];
  }
};

const LOOKS: Record<string, DeckLook> = {
  classic: {},

  // 수묵 · Ink wash: everything in warm ink greys; vermilion stays.
  sumi: {
    color: (_hex, [L, C, h], ground) => {
      if (ground) return lchToHex(clamp(L + 0.012, 0, 0.975), Math.min(C * 0.45, 0.011), h);
      if (C > 0.09 && h > 19 && h < 52) return lchToHex(clamp(L, 0.36, 0.72), C * 0.95, mixHue(h, 33, 0.4));
      const Ln = clamp(0.52 + (L - 0.52) * 1.16, 0.16, 0.975);
      return lchToHex(Ln, 0.007, 72);
    },
    defs: () =>
      '<radialGradient id="ds-sumi-wash" cx=".18" cy=".92" r=".9"><stop offset="0" stop-color="#4A4640" stop-opacity=".16"/><stop offset=".55" stop-color="#4A4640" stop-opacity=".04"/><stop offset="1" stop-color="#4A4640" stop-opacity="0"/></radialGradient>',
    look: {
      under: () => '<rect x="4" y="4" width="92" height="132" rx="6" fill="url(#ds-sumi-wash)"/>',
      chip: { paper: '#F7F3EB', ink: '#1E1C1A', edge: '#8F8A80' },
    },
  },

  // 달밤 · Moonlit: indigo night paper; the art lifted into silver.
  moonlit: {
    color: (hex, [L, C, h], ground) => {
      if (hex === CARD_PAPER) return '#1b2140';
      if (ground) return lchToHex(0.285 + (L - 0.93) * 0.8, 0.034 + C * 0.45, mixHue(h, 274, 0.72));
      // Near-black ink (the hills of Silver grass, a magpie's coat) stays a night
      // silhouette, a shade deeper than the paper; everything else lifts to silver.
      if (L < 0.34 && C < 0.04) return lchToHex(0.1 + L * 0.2, 0.03, 272);
      return lchToHex(clamp(0.47 + L * 0.51, 0, 0.985), C * 0.4, mixHue(h, 258, 0.14));
    },
    defs: () =>
      '<radialGradient id="ds-moon-glow" cx=".72" cy=".08" r=".85"><stop offset="0" stop-color="#C9D0EE" stop-opacity=".22"/><stop offset=".6" stop-color="#C9D0EE" stop-opacity="0"/></radialGradient>',
    look: {
      under: (id) => {
        const r = rng(id * 7 + 3);
        let d = '';
        for (let i = 0; i < 9; i++) d += `M${f(8 + r() * 84)} ${f(8 + r() * 60)}h.01`;
        return `<rect x="4" y="4" width="92" height="132" rx="6" fill="url(#ds-moon-glow)"/><path d="${d}" stroke="#E6E8F4" stroke-width=".8" stroke-linecap="round" opacity=".55"/>`;
      },
      over: () => '<rect x="5.6" y="5.6" width="88.8" height="128.8" rx="5" fill="none" stroke="#B9C0DD" stroke-opacity=".38" stroke-width=".35"/>',
      chip: { paper: '#141A33', ink: '#EEEBF6', edge: '#8E96BC' },
    },
  },

  // 청자 · Celadon: jade glaze, black-and-white inlay, copper-red for reds, crackle.
  celadon: {
    color: (hex, [L, C, h], ground) => {
      if (hex === CARD_PAPER) return '#e3ebe1';
      if (ground) return lchToHex(0.855 + (L - 0.93) * 0.6, 0.042, mixHue(h, 168, 0.82));
      if (C > 0.1 && (h < 50 || h > 335)) return lchToHex(clamp(L * 0.94, 0.32, 0.66), Math.min(C, 0.14) * 0.82, 30);
      if (L > 0.88) return lchToHex(0.95 + (L - 0.88) * 0.3, 0.012, 105);
      const Ln = clamp(0.27 + (L - 0.2) * 1.0, 0.24, 0.92);
      return lchToHex(Ln, 0.022 + 0.055 * Math.sin(Math.PI * clamp(Ln)), 175 - (Ln - 0.6) * 26);
    },
    defs: () => {
      const r = rng(31);
      let d = '';
      // crazing: short wandering polylines, mostly meeting at shallow angles
      for (let i = 0; i < 26; i++) {
        let x = r() * 60;
        let y = r() * 60;
        let a = r() * Math.PI * 2;
        d += `M${f(x)} ${f(y)}`;
        for (let k = 0; k < 4; k++) {
          a += (r() - 0.5) * 1.2;
          const l = 3 + r() * 7;
          x += Math.cos(a) * l;
          y += Math.sin(a) * l;
          d += `L${f(x)} ${f(y)}`;
        }
      }
      return (
        `<pattern id="ds-crackle" width="60" height="60" patternUnits="userSpaceOnUse"><path d="${d}" fill="none" stroke="#2C463C" stroke-opacity=".2" stroke-width=".28" stroke-linejoin="round"/></pattern>` +
        '<radialGradient id="ds-glaze" cx=".28" cy=".14" r=".9"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".3"/><stop offset=".35" stop-color="#FFFFFF" stop-opacity=".05"/><stop offset=".8" stop-color="#2E5A4C" stop-opacity="0"/><stop offset="1" stop-color="#2E5A4C" stop-opacity=".2"/></radialGradient>'
      );
    },
    look: {
      over: () => '<rect x="4" y="4" width="92" height="132" rx="6" fill="url(#ds-crackle)"/><rect x="4" y="4" width="92" height="132" rx="6" fill="url(#ds-glaze)"/>',
      chip: { paper: '#EEF3EC', ink: '#203A31', edge: '#5E8274' },
    },
  },

  // 목판 · Woodblock: a limited palette of printing inks, a bokashi sky band, wood grain.
  woodblock: (() => {
    const inks = [
      '#1f1c1a', '#203a66', '#2e6e98', '#93b8cf', '#cc4428', '#a3243f', '#ee9fa8', '#dc9a2e', '#efcc5c',
      '#244a33', '#5b8c3e', '#ccd4b8', '#c3ccd4', '#6a4fa6', '#ad97dc', '#6b4529', '#bd8a52', '#8a8478', '#f7ecd2',
    ].map((x) => [x, hexToLch(x)] as [string, Lch]);
    // near-greys print in the neutral inks only, so a grey never turns blue or brown
    const neutrals = ['#1f1c1a', '#4a4541', '#8a8478', '#bdb5a5', '#f7ecd2'].map((x) => [x, hexToLch(x)] as [string, Lch]);
    return {
      color: (hex: string, lch: Lch, ground: boolean) => {
        if (hex === CARD_PAPER) return '#f6ecd6';
        // printing paper: one warm cream, with only a breath of the month's tint
        if (ground) return lchToHex(0.935, 0.03, mixHue(lch[2], 82, 0.7));
        let best = inks[0][0];
        let bd = Infinity;
        for (const [x, q] of lch[1] < 0.035 ? neutrals : inks) {
          const d = labDist(lch, q, 1.25) + (lch[1] > 0.05 && q[1] > 0.05 ? hueDist(lch[2], q[2]) / 1800 : 0);
          if (d < bd) {
            bd = d;
            best = x;
          }
        }
        return best;
      },
      defs: () => {
        let d = '';
        for (let y = 2; y < 64; y += 2.6) {
          d += `M0 ${f(y)}`;
          for (let x = 8; x <= 64; x += 8) d += `Q${x - 4} ${f(y + Math.sin(x * 0.21 + y) * 0.9)} ${x} ${f(y + Math.sin(x * 0.13 + y * 0.7) * 0.5)}`;
        }
        return (
          `<pattern id="ds-grain" width="64" height="64" patternUnits="userSpaceOnUse"><path d="${d}" fill="none" stroke="#5A4630" stroke-opacity=".13" stroke-width=".4"/></pattern>` +
          '<linearGradient id="ds-bokashi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E3F73" stop-opacity=".78"/><stop offset=".07" stop-color="#2A5A92" stop-opacity=".5"/><stop offset=".2" stop-color="#2A5A92" stop-opacity="0"/></linearGradient>' +
          '<linearGradient id="ds-bokashi-low" x1="0" y1="0" x2="0" y2="1"><stop offset=".86" stop-color="#7A5A36" stop-opacity="0"/><stop offset="1" stop-color="#7A5A36" stop-opacity=".22"/></linearGradient>'
        );
      },
      look: {
        under: () => '<rect x="4" y="4" width="92" height="132" rx="6" fill="url(#ds-bokashi)"/><rect x="4" y="4" width="92" height="132" rx="6" fill="url(#ds-bokashi-low)"/>',
        over: () => '<rect x="4" y="4" width="92" height="132" rx="6" fill="url(#ds-grain)"/><rect x="4.5" y="4.5" width="91" height="131" rx="5.6" fill="none" stroke="#211E1B" stroke-width=".9"/>',
        chip: { paper: '#F4E9D2', ink: '#211E1B', edge: '#211E1B' },
      },
    } as DeckLook;
  })(),

  // 금박 · Gold leaf: the art as it is, on gold-dusted paper with a gilded edge.
  gilded: {
    color: (hex, [L, C, h], ground) => {
      if (hex === CARD_PAPER) return '#f6ebcf';
      if (ground) return lchToHex(L - 0.012, C * 0.35 + 0.036, mixHue(h, 86, 0.8));
      return hex;
    },
    defs: () =>
      '<linearGradient id="ds-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8C6526"/><stop offset=".22" stop-color="#E8C877"/><stop offset=".4" stop-color="#B88A3A"/><stop offset=".56" stop-color="#F7E4A6"/><stop offset=".74" stop-color="#A87D32"/><stop offset="1" stop-color="#DCB666"/></linearGradient>' +
      '<linearGradient id="ds-gold-mist" x1="0" y1="0" x2="1" y2=".3"><stop offset="0" stop-color="#D6AE55" stop-opacity=".25"/><stop offset=".3" stop-color="#E8C877" stop-opacity=".85"/><stop offset=".55" stop-color="#C99A3E" stop-opacity=".75"/><stop offset=".8" stop-color="#F0D891" stop-opacity=".85"/><stop offset="1" stop-color="#C99A3E" stop-opacity=".3"/></linearGradient>',
    look: {
      under: (id) => {
        // suyari-gasumi: long rounded bars of gold mist, plus scattered flecks
        const bar = (x0: number, x1: number, y: number, hh: number) => `M${x0 + hh / 2} ${y}H${x1 - hh / 2}A${hh / 2} ${hh / 2} 0 0 1 ${x1 - hh / 2} ${y + hh}H${x0 + hh / 2}A${hh / 2} ${hh / 2} 0 0 1 ${x0 + hh / 2} ${y}Z`;
        const fl = flecks(100 + id, 18, clearZone, [0.8, 2.2]);
        return `<g clip-path="url(#card-clip)"><path d="${bar(-4, 58, 6, 6) + bar(30, 104, 14.6, 5) + bar(-4, 46, 123, 6) + bar(54, 104, 130.4, 5)}" fill="url(#ds-gold-mist)"/><path d="${fl}" fill="url(#ds-gold)" opacity=".95"/></g>`;
      },
      over: () =>
        '<rect x="1.7" y="1.7" width="96.6" height="136.6" rx="7.7" fill="none" stroke="url(#ds-gold)" stroke-width="2.4"/>' +
        '<rect x="4.3" y="4.3" width="91.4" height="131.4" rx="5.8" fill="none" stroke="#B88A3A" stroke-opacity=".8" stroke-width=".5"/>',
      chip: { paper: '#FBF4E2', ink: '#2A2724', edge: '#B88A3A' },
    },
  },
};

interface Built {
  paint: (s: string) => string;
  look?: CardLook;
  defs: string;
}
const built = new Map<string, Built>();
function buildLook(id: string): Built {
  let b = built.get(id);
  if (!b) {
    const L = LOOKS[id] ?? LOOKS.classic;
    const color = L.color;
    const g = grounds();
    b = { paint: color ? painter((hex) => color(hex, hexToLch(hex), g.has(hex))) : (s) => s, look: L.look, defs: L.defs ? L.defs() : '' };
    built.set(id, b);
  }
  return b;
}

const deckCache = new Map<string, string>();
let currentDeck = 'classic';

/** The deck part of the sprite for a style (cached). */
export function deckMarkup(id: string): string {
  const key = LOOKS[id] ? id : 'classic';
  let s = deckCache.get(key);
  if (s === undefined) {
    const b = buildLook(key);
    s = deckSpriteMarkup(b.paint, b.look, b.defs);
    deckCache.set(key, s);
  }
  return s;
}

/** Repaint card faces for a deck style. Unknown ids fall back to classic. */
export function applyDeckStyle(id: string): void {
  const key = LOOKS[id] ? id : 'classic';
  document.documentElement.dataset.deck = key;
  let sprite = document.getElementById('card-sprite');
  if (!sprite) {
    installCardSprite();
    sprite = document.getElementById('card-sprite');
    if (!sprite) return;
  }
  if (key === currentDeck) return;
  const back = sprite.querySelector('#card-back');
  if (!back) return;
  // the deck part is every node before the back symbol (defs, motifs, faces)
  while (sprite.firstChild && sprite.firstChild !== back) sprite.removeChild(sprite.firstChild);
  back.insertAdjacentHTML('beforebegin', deckMarkup(key));
  currentDeck = key;
}

/* ================================================================== */
/* Card backs                                                          */
/* ================================================================== */

const backCache = new Map<string, string>();
/** Inner markup of a card back (ids inside are `bk-<id>-…`). */
export function backMarkup(id: string): string {
  const key = BACK_ART[id] ? id : 'classic';
  let s = backCache.get(key);
  if (s === undefined) {
    s = key === 'classic' ? cardBackInner() : BACK_ART[key]();
    backCache.set(key, s);
  }
  return s;
}

let currentBack = 'classic';
/**
 * Repaint the #card-back symbol. The snow card (#card-snow) is drawn as a
 * snow-covered face, not from the back, so it stays as it is: a pale, clearly
 * "covered" card whatever the back.
 */
export function applyCardBack(id: string): void {
  const key = BACK_ART[id] ? id : 'classic';
  document.documentElement.dataset.cardBack = key;
  if (!document.getElementById('card-sprite')) installCardSprite();
  if (key === currentBack) return;
  const sym = document.getElementById('card-back');
  if (!sym) return;
  sym.innerHTML = backMarkup(key);
  currentBack = key;
}

/* ================================================================== */
/* Gold-leaf foil                                                      */
/* ================================================================== */

/** Shared defs for the foil overlay, installed once in the card sprite. */
export function foilDefs(): string {
  return (
    '<linearGradient id="foil-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6424"/><stop offset=".2" stop-color="#e9c873"/><stop offset=".36" stop-color="#b48636"/><stop offset=".52" stop-color="#f8e6a8"/><stop offset=".7" stop-color="#a77b30"/><stop offset=".86" stop-color="#e3c071"/><stop offset="1" stop-color="#9a7230"/></linearGradient>' +
    '<linearGradient id="foil-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbebb4"/><stop offset=".45" stop-color="#ddb35a"/><stop offset="1" stop-color="#a97d2e"/></linearGradient>' +
    '<linearGradient id="foil-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6dc" stop-opacity="0"/><stop offset=".5" stop-color="#fff6dc" stop-opacity=".5"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></linearGradient>' +
    '<radialGradient id="foil-warm" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#d9b45a" stop-opacity="0"/><stop offset="1" stop-color="#c99a3e" stop-opacity=".26"/></radialGradient>' +
    '<clipPath id="foil-clip"><rect width="100" height="140" rx="9"/></clipPath>'
  );
}

let foilStatic: string | null = null;
let foilCount = 0;
/**
 * Gold-leaf overlay for foil editions (100×140 box): a gilded frame, sparse
 * kirikane flecks and sunago dust, two glints and a slow diagonal sheen
 * (animated in cards-extra.css). It references the `foil-*` defs in the card
 * sprite, so it never adds ids of its own and can be repeated freely.
 */
export function foilOverlay(): string {
  if (!foilStatic) {
    const r = rng(404);
    let dust = '';
    // sunago: two soft drifts of gold dust, top-right and bottom-left
    for (let i = 0; i < 70; i++) {
      const top = i % 2 === 0;
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 26;
      const x = (top ? 78 : 22) + Math.cos(a) * d * 1.2;
      const y = (top ? 14 : 126) + Math.sin(a) * d * 0.5;
      if (x < 5 || x > 95 || y < 5 || y > 135 || (x < 23 && y < 25) || (x > 70 && y > 112)) continue;
      dust += `M${f(x)} ${f(y)}h.01`;
    }
    const leaf = flecks(405, 22, clearZone, [1, 2.6]);
    const corner = 'M6.8 15.4V9.8Q6.8 6.8 9.8 6.8H15.4M9.4 13.4V11.2Q9.4 9.4 11.2 9.4H13.4';
    // two corner fittings on the diagonal that the chip and the tag leave free
    const corners = ['translate(100 0) scale(-1 1)', 'translate(0 140) scale(1 -1)']
      .map((t) => `<path${t ? ` transform="${t}"` : ''} d="${corner}"/>`)
      .join('');
    const star = (x: number, y: number, s: number) => `M${x} ${f(y - s)}Q${x} ${y} ${f(x + s * 0.7)} ${y}Q${x} ${y} ${x} ${f(y + s)}Q${x} ${y} ${f(x - s * 0.7)} ${y}Q${x} ${y} ${x} ${f(y - s)}Z`;
    foilStatic =
      '<rect width="100" height="140" rx="9" fill="url(#foil-warm)"/>' +
      `<path d="${dust}" stroke="#e2bd62" stroke-width=".75" stroke-linecap="round" opacity=".7"/>` +
      `<path d="${leaf}" fill="url(#foil-leaf)" opacity=".92"/>` +
      '<rect x="1.6" y="1.6" width="96.8" height="136.8" rx="7.8" fill="none" stroke="#5c4113" stroke-opacity=".35" stroke-width="3.2"/>' +
      '<rect x="1.6" y="1.6" width="96.8" height="136.8" rx="7.8" fill="none" stroke="url(#foil-gold)" stroke-width="2.5"/>' +
      '<rect x="4.25" y="4.25" width="91.5" height="131.5" rx="5.9" fill="none" stroke="url(#foil-gold)" stroke-width=".75"/>' +
      `<g fill="none" stroke="url(#foil-gold)" stroke-width=".6" stroke-linecap="round">${corners}</g>` +
      `<path class="foil-glint" d="${star(84, 22, 3.2) + star(14, 118, 2.6)}" fill="#fff8e2"/>`;
  }
  const k = foilCount++;
  // each overlay starts its sheen at a different point so a page of foil cards doesn't pulse in step
  const delay = (-((k * 2.3) % 9)).toFixed(1);
  return (
    `<g class="foil" aria-hidden="true">` +
    foilStatic +
    `<g clip-path="url(#foil-clip)"><path class="foil-sheen" style="animation-delay:${delay}s" d="M-34 -6L-6 -6L-48 146L-76 146Z" fill="url(#foil-sheen)"/></g>` +
    `</g>`
  );
}

/* ================================================================== */
/* Standalone previews (Market)                                        */
/* ================================================================== */

let uid = 0;
const ID_RX = /(id="|url\(#|href="#)/g;
/** Prefix every id (and reference) with a placeholder, filled per call. */
const scope = (svg: string) => svg.replace(ID_RX, '$1§');
const instance = (tpl: string) => {
  const p = `pv${(++uid).toString(36)}-`;
  return tpl.replace(/§/g, p);
};

const previewCache = new Map<string, string>();
/** Standalone markup (fresh ids per call): used where there's no document to hold a sprite. */
function standalonePreview(id: number, style: string): string {
  const key = `${style}:${id}`;
  let tpl = previewCache.get(key);
  if (tpl === undefined) {
    const b = buildLook(style);
    const month = id >> 2;
    const motif = id < 48 ? `<symbol id="motif-${month}" viewBox="0 0 100 140">${b.paint(motifMarkup(month))}</symbol>` : '';
    tpl = scope(
      `<svg class="card-art" viewBox="0 0 100 140" aria-hidden="true"><defs>${b.paint(spriteDefs().replace(/^<defs>|<\/defs>$/g, ''))}${b.defs}${motif}</defs>${b.paint(cardInner(id, b.look))}</svg>`,
    );
    previewCache.set(key, tpl);
  }
  return instance(tpl);
}

/**
 * The preview sprite: a hidden <svg> holding, per deck style, the painted
 * defs, motifs and faces that previews have asked for (ids `pv-<style>-…`).
 * Previews are then a two-node `<use>`: the motifs (10–40 KB each) are parsed
 * once instead of once per preview. Built lazily, one symbol at a time.
 */
const PV_SPRITE = 'pv-sprite';
const pvHave = new Set<string>();
function previewSprite(): Element | null {
  if (typeof document === 'undefined' || !document.body) return null;
  const found = document.getElementById(PV_SPRITE);
  if (found) return found;
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.id = PV_SPRITE;
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.prepend(sprite);
  pvHave.clear();
  return sprite;
}

/** Make sure the preview sprite holds card `id` in `style`; false if there's no document. */
function ensurePreview(id: number, style: string): boolean {
  const sprite = previewSprite();
  if (!sprite) return false;
  const want = [style, id < 48 ? `${style}:m${id >> 2}` : '', `${style}:c${id}`].filter((k) => k && !pvHave.has(k));
  if (!want.length) return true;
  const b = buildLook(style);
  let markup = '';
  for (const k of want) {
    if (k === style) markup += `<defs>${b.paint(spriteDefs().replace(/^<defs>|<\/defs>$/g, ''))}${b.defs}</defs>`;
    else if (k.includes(':m')) markup += `<symbol id="motif-${id >> 2}" viewBox="0 0 100 140">${b.paint(motifMarkup(id >> 2))}</symbol>`;
    else markup += `<symbol id="card-${id}" viewBox="0 0 100 140">${b.paint(cardInner(id, b.look))}</symbol>`;
    pvHave.add(k);
  }
  sprite.insertAdjacentHTML('beforeend', markup.replace(ID_RX, `$1pv-${style}-`));
  return true;
}

/**
 * Preview of one card painted in any deck style (for the Market), independent
 * of the deck currently installed in the card sprite. In the app it's a `<use>`
 * of the preview sprite; without a document it's standalone markup with fresh ids.
 */
export function cardPreviewSvg(id: number, styleId: string): string {
  const style = LOOKS[styleId] ? styleId : 'classic';
  if (!ensurePreview(id, style)) return standalonePreview(id, style);
  return `<svg class="card-art" viewBox="0 0 100 140" aria-hidden="true"><use href="#pv-${style}-card-${id}"/></svg>`;
}

const backPreviewCache = new Map<string, string>();
/** Standalone preview of a card back (for the Market). */
export function cardBackPreviewSvg(backId: string): string {
  const key = BACK_ART[backId] ? backId : 'classic';
  let tpl = backPreviewCache.get(key);
  if (tpl === undefined) {
    const defs = spriteDefs().match(/<clipPath id="card-clip">.*?<\/clipPath>|<radialGradient id="back-glow".*?<\/radialGradient>/g)?.join('') ?? '';
    tpl = scope(`<svg class="card-art" viewBox="0 0 100 140" aria-hidden="true"><defs>${defs}</defs>${backMarkup(key)}</svg>`);
    backPreviewCache.set(key, tpl);
  }
  return instance(tpl);
}
