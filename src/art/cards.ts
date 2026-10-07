/**
 * Original SVG card art. Every card is drawn in a 100 × 140 view box from simple
 * primitives — no scans of historical decks — and registered once as a
 * <symbol> in a hidden sprite, so a 48-card board is just <use> references.
 */
import { MONTHS, cardDef, type CardDef } from '../data/deck';

export const INK = '#2a2724';
const PAPER = '#f7f1e6';
const VERMILION = '#c4472f';
const GOLD = '#b8893b';
const RIBBON_RED = '#b23b2e';
const RIBBON_BLUE = '#2f4a6d';

interface MonthStyle {
  tint: string;
  draw: () => string;
}

const f = (n: number) => Math.round(n * 10) / 10;

/** Five (or n) rounded petals around a centre. */
function blossom(cx: number, cy: number, r: number, fill: string, center: string, opts: { n?: number; rot?: number; notch?: boolean } = {}) {
  const n = opts.n ?? 5;
  const rot = opts.rot ?? 0;
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 360) / n;
    if (opts.notch) {
      // cherry petal: teardrop with a small notch at the tip
      s += `<path transform="rotate(${f(a)} ${f(cx)} ${f(cy)})" d="M${f(cx)} ${f(cy)} C${f(cx - r * 0.75)} ${f(cy - r * 0.35)} ${f(cx - r * 0.55)} ${f(cy - r * 1.05)} ${f(cx - r * 0.12)} ${f(cy - r)} L${f(cx)} ${f(cy - r * 0.82)} L${f(cx + r * 0.12)} ${f(cy - r)} C${f(cx + r * 0.55)} ${f(cy - r * 1.05)} ${f(cx + r * 0.75)} ${f(cy - r * 0.35)} ${f(cx)} ${f(cy)}Z" fill="${fill}"/>`;
    } else {
      s += `<ellipse transform="rotate(${f(a)} ${f(cx)} ${f(cy)})" cx="${f(cx)}" cy="${f(cy - r * 0.55)}" rx="${f(r * 0.48)}" ry="${f(r * 0.55)}" fill="${fill}"/>`;
    }
  }
  s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.22)}" fill="${center}"/>`;
  return s;
}

/** Pointed leaf from (x, y) at angle (deg), length len. */
function leaf(x: number, y: number, len: number, w: number, angle: number, fill: string) {
  return `<path transform="rotate(${f(angle)} ${f(x)} ${f(y)})" d="M${f(x)} ${f(y)} Q${f(x + w)} ${f(y - len * 0.5)} ${f(x)} ${f(y - len)} Q${f(x - w)} ${f(y - len * 0.5)} ${f(x)} ${f(y)}Z" fill="${fill}"/>`;
}

/** Rounded star used for maple leaves. */
function mapleLeaf(cx: number, cy: number, r: number, rot: number, fill: string) {
  const pts: string[] = [];
  const lobes = 5;
  for (let i = 0; i < lobes * 2; i++) {
    const a = ((rot + (i * 180) / lobes - 90) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${f(cx + Math.cos(a) * rr)},${f(cy + Math.sin(a) * rr)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + Math.cos(((rot + 90) * Math.PI) / 180) * r * 0.9)}" y2="${f(cy + Math.sin(((rot + 90) * Math.PI) / 180) * r * 0.9)}" stroke="${fill}" stroke-width="1.6" stroke-linecap="round"/>`;
}

const STYLES: MonthStyle[] = [
  // 1 · Pine
  {
    tint: '#e3eadf',
    draw: () => {
      const g = '#3d6a4f';
      const g2 = '#557f63';
      const tier = (cx: number, cy: number, w: number) =>
        `<path d="M${cx - w} ${cy + 6} Q${cx - w * 0.8} ${cy - 9} ${cx - w * 0.35} ${cy - 5} Q${cx - w * 0.1} ${cy - 15} ${cx + w * 0.3} ${cy - 7} Q${cx + w * 0.8} ${cy - 12} ${cx + w} ${cy + 6} Z" fill="${g}"/>` +
        `<path d="M${cx - w * 0.7} ${cy} Q${cx} ${cy - 8} ${cx + w * 0.7} ${cy}" stroke="${g2}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
      return (
        `<path d="M44 134 C40 112 54 100 48 84 C44 72 52 60 50 46" stroke="#5a4334" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<path d="M49 92 C60 88 66 80 74 78" stroke="#5a4334" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
        tier(50, 44, 30) + tier(70, 76, 20) + tier(36, 66, 22) + tier(52, 104, 30)
      );
    },
  },
  // 2 · Plum
  {
    tint: '#f1e2e1',
    draw: () => {
      const c = '#a6435a';
      return (
        `<path d="M8 128 C26 112 30 96 46 88 C58 82 60 64 74 54 C82 48 86 36 92 28" stroke="#4a3830" stroke-width="5" fill="none" stroke-linecap="round"/>` +
        `<path d="M46 88 C40 74 30 70 22 58" stroke="#4a3830" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        blossom(24, 56, 11, c, '#f4d9a8', { rot: 10 }) +
        blossom(60, 70, 13, c, '#f4d9a8', { rot: -8 }) +
        blossom(84, 40, 10, c, '#f4d9a8', { rot: 20 }) +
        blossom(36, 100, 10, c, '#f4d9a8', { rot: 30 }) +
        `<circle cx="72" cy="88" r="4" fill="${c}"/><circle cx="16" cy="76" r="3.5" fill="${c}"/><circle cx="92" cy="22" r="3" fill="${c}"/>`
      );
    },
  },
  // 3 · Cherry
  {
    tint: '#f5e7e8',
    draw: () => {
      const p = '#e3a5b0';
      const p2 = '#d4848f';
      return (
        `<path d="M8 104 Q30 96 50 104 T92 104 L92 118 Q70 110 50 118 T8 118Z" fill="#ead2d5"/>` +
        `<path d="M10 20 C30 30 40 40 48 60" stroke="#4a3830" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        blossom(30, 40, 13, p, p2, { notch: true, rot: 8 }) +
        blossom(54, 30, 12, p, p2, { notch: true, rot: -14 }) +
        blossom(72, 52, 14, p, p2, { notch: true, rot: 20 }) +
        blossom(44, 66, 12, p, p2, { notch: true, rot: 0 }) +
        blossom(22, 84, 10, p, p2, { notch: true, rot: 36 }) +
        blossom(76, 84, 11, p, p2, { notch: true, rot: 4 })
      );
    },
  },
  // 4 · Wisteria
  {
    tint: '#ebe7f1',
    draw: () => {
      const a = '#6f5f9c';
      const b = '#9a8cc3';
      const raceme = (x: number, top: number, len: number) => {
        let s = `<path d="M${x} ${top} q2 ${len * 0.5} -1 ${len}" stroke="#4a3830" stroke-width="1.2" fill="none"/>`;
        const n = Math.floor(len / 8);
        for (let i = 0; i < n; i++) {
          const t = i / n;
          const w = 7.5 * (1 - t * 0.6);
          const y = top + 6 + i * 8;
          s += `<ellipse cx="${f(x - w * 0.45)}" cy="${f(y)}" rx="${f(w * 0.55)}" ry="3.6" fill="${i % 2 ? a : b}"/>`;
          s += `<ellipse cx="${f(x + w * 0.45)}" cy="${f(y + 3)}" rx="${f(w * 0.55)}" ry="3.6" fill="${i % 2 ? b : a}"/>`;
        }
        return s;
      };
      return (
        `<path d="M4 16 Q50 6 96 18" stroke="#4a3830" stroke-width="4" fill="none" stroke-linecap="round"/>` +
        leaf(20, 18, 16, 5, 200, '#5b7a52') + leaf(76, 18, 16, 5, 160, '#5b7a52') + leaf(48, 14, 14, 4, 190, '#6d8c62') +
        raceme(28, 16, 84) + raceme(52, 14, 104) + raceme(76, 18, 72)
      );
    },
  },
  // 5 · Iris
  {
    tint: '#e5e8f2',
    draw: () => {
      const g = '#4b7a58';
      const iris = (cx: number, cy: number, s: number) =>
        `<path d="M${cx} ${cy} C${cx - 14 * s} ${cy - 2 * s} ${cx - 16 * s} ${cy + 12 * s} ${cx - 6 * s} ${cy + 14 * s} C${cx - 3 * s} ${cy + 8 * s} ${cx - 2 * s} ${cy + 4 * s} ${cx} ${cy}Z" fill="#4a5ca0"/>` +
        `<path d="M${cx} ${cy} C${cx + 14 * s} ${cy - 2 * s} ${cx + 16 * s} ${cy + 12 * s} ${cx + 6 * s} ${cy + 14 * s} C${cx + 3 * s} ${cy + 8 * s} ${cx + 2 * s} ${cy + 4 * s} ${cx} ${cy}Z" fill="#4a5ca0"/>` +
        `<path d="M${cx} ${cy + 2 * s} C${cx - 6 * s} ${cy - 10 * s} ${cx - 2 * s} ${cy - 18 * s} ${cx} ${cy - 20 * s} C${cx + 2 * s} ${cy - 18 * s} ${cx + 6 * s} ${cy - 10 * s} ${cx} ${cy + 2 * s}Z" fill="#6f80bf"/>` +
        `<path d="M${cx - 5 * s} ${cy + 5 * s} l3 2 M${cx + 5 * s} ${cy + 5 * s} l-3 2" stroke="#e8c45a" stroke-width="1.8" stroke-linecap="round"/>`;
      return (
        `<path d="M20 136 C22 100 18 70 24 40" stroke="${g}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
        `<path d="M36 136 C38 104 40 80 52 56" stroke="${g}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
        `<path d="M64 136 C62 104 66 84 60 64" stroke="${g}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
        `<path d="M80 136 C78 110 84 84 82 52" stroke="${g}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
        `<path d="M50 136 C50 116 46 100 40 86" stroke="#6d9a74" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        iris(28, 44, 1.05) + iris(70, 30, 1.15) + iris(56, 74, 0.9)
      );
    },
  },
  // 6 · Peony
  {
    tint: '#f3e3e0',
    draw: () => {
      const ring = (cx: number, cy: number, r: number, n: number, fill: string, rot: number) => {
        let s = '';
        for (let i = 0; i < n; i++) {
          const a = ((rot + (i * 360) / n) * Math.PI) / 180;
          s += `<circle cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r)}" r="${f(r * 0.62)}" fill="${fill}"/>`;
        }
        return s;
      };
      return (
        leaf(22, 128, 34, 11, -30, '#4c6b4c') + leaf(78, 128, 34, 11, 30, '#4c6b4c') + leaf(50, 136, 30, 10, 0, '#5d7d5b') +
        leaf(30, 96, 22, 8, -70, '#5d7d5b') + leaf(72, 96, 22, 8, 70, '#4c6b4c') +
        ring(50, 66, 24, 9, '#a8333f', 0) + ring(50, 66, 15, 7, '#c4505d', 20) + ring(50, 66, 7, 5, '#de7a84', 40) +
        `<circle cx="50" cy="66" r="4" fill="#f0c66e"/>`
      );
    },
  },
  // 7 · Bush clover
  {
    tint: '#f1e5eb',
    draw: () => {
      const stem = (d: string) => `<path d="${d}" stroke="#4a3830" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
      const sprig = (pts: [number, number][]) =>
        pts.map(([x, y], i) => (i % 3 === 0 ? `<circle cx="${x}" cy="${y}" r="3.2" fill="#a24f7e"/>` : leaf(x, y, 8, 3, i * 47, i % 2 ? '#5f7d4f' : '#3f5d3a'))).join('');
      return (
        stem('M92 10 C60 20 30 50 18 110') + stem('M96 40 C70 46 50 70 44 126') + stem('M70 8 C58 40 70 80 86 120') +
        sprig([[78, 16], [70, 20], [62, 24], [52, 32], [44, 40], [38, 50], [32, 60], [27, 72], [23, 84], [20, 98]]) +
        sprig([[84, 44], [74, 50], [66, 58], [58, 68], [52, 80], [48, 92], [46, 106], [45, 118]]) +
        sprig([[66, 24], [64, 36], [64, 50], [66, 64], [70, 78], [76, 92], [80, 104]])
      );
    },
  },
  // 8 · Silver grass & moon
  {
    tint: '#ece4d2',
    draw: () => {
      let s = '';
      for (let i = 0; i < 8; i++) {
        const x = 12 + i * 11;
        const base = 90 - Math.sin(i * 0.9) * 6;
        const h = 30 + ((i * 37) % 22);
        const lean = 6 + (i % 3) * 4;
        const tx = x + lean;
        const ty = base - h;
        s += `<path d="M${x} ${f(base)} Q${x + 1} ${f(base - h * 0.6)} ${tx} ${f(ty)}" stroke="#8c8371" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
        s += `<path transform="rotate(${f(18 + lean)} ${tx} ${f(ty)})" d="M${tx} ${f(ty)} q-3 7 0 15 q3 -8 0 -15Z" fill="#e8dcc0" stroke="#b9ab8c" stroke-width="0.6"/>`;
      }
      s += `<path d="M4 94 Q36 76 64 84 T96 82 L96 136 L4 136Z" fill="#2e2b2a"/>`;
      s += `<path d="M4 108 Q40 96 96 104" stroke="#45403c" stroke-width="1.2" fill="none"/>`;
      return s;
    },
  },
  // 9 · Chrysanthemum
  {
    tint: '#f4ebd8',
    draw: () => {
      const mum = (cx: number, cy: number, r: number) => {
        let s = '';
        for (let i = 0; i < 16; i++) {
          s += `<ellipse transform="rotate(${i * 22.5} ${cx} ${cy})" cx="${cx}" cy="${f(cy - r * 0.6)}" rx="${f(r * 0.17)}" ry="${f(r * 0.45)}" fill="#c78a2a"/>`;
        }
        for (let i = 0; i < 12; i++) {
          s += `<ellipse transform="rotate(${i * 30 + 15} ${cx} ${cy})" cx="${cx}" cy="${f(cy - r * 0.35)}" rx="${f(r * 0.13)}" ry="${f(r * 0.3)}" fill="#dfa944"/>`;
        }
        return s + `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.18)}" fill="#8a5a1c"/>`;
      };
      return (
        `<path d="M30 136 C32 110 30 96 34 78 M66 136 C64 112 70 90 66 54" stroke="#4b6b45" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        leaf(33, 112, 16, 6, -60, '#4b6b45') + leaf(65, 104, 16, 6, 60, '#4b6b45') + leaf(66, 128, 16, 6, -50, '#5d7d55') +
        mum(34, 70, 24) + mum(68, 42, 22) + mum(72, 96, 14)
      );
    },
  },
  // 10 · Maple
  {
    tint: '#f4e2d8',
    draw: () => {
      const a = '#be4b2d';
      const b = '#d77349';
      return (
        `<path d="M96 16 C70 22 52 40 40 60 C30 78 26 100 10 120" stroke="#4a3830" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        mapleLeaf(76, 30, 15, 10, a) + mapleLeaf(52, 46, 16, -12, b) + mapleLeaf(28, 66, 14, 24, a) +
        mapleLeaf(62, 76, 13, -30, a) + mapleLeaf(40, 98, 15, 14, b) + mapleLeaf(18, 114, 11, -20, a) + mapleLeaf(80, 106, 12, 30, b)
      );
    },
  },
  // 11 · Willow & rain
  {
    tint: '#e1e7e6',
    draw: () => {
      let s = '';
      for (let i = 0; i < 10; i++) s += `<line x1="${8 + i * 10}" y1="${10 + (i % 3) * 8}" x2="${0 + i * 10}" y2="${40 + (i % 3) * 8}" stroke="#93a3ad" stroke-width="1" />`;
      s += `<path d="M40 6 C52 30 46 60 34 90" stroke="#4a3830" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      const strand = (x: number, y: number, len: number, bend: number) =>
        `<path d="M${x} ${y} q${bend} ${len * 0.5} ${bend * 0.4} ${len}" stroke="#6b8a59" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
        [0.3, 0.5, 0.7, 0.9].map((t) => leaf(x + bend * t * 0.7, y + len * t, 7, 2.6, 180 + bend, '#7e9c69')).join('');
      return s + strand(44, 14, 80, 10) + strand(50, 24, 92, 14) + strand(40, 40, 70, -8) + strand(56, 36, 60, 18) + strand(36, 60, 56, -12) +
        `<path d="M4 126 Q30 118 56 126 T96 124 L96 136 L4 136Z" fill="#4c5a5f"/>`;
    },
  },
  // 12 · Paulownia
  {
    tint: '#efdfb4',
    draw: () => {
      const spike = (x: number, top: number, n: number) => {
        let s = `<path d="M${x} 104 L${x} ${top}" stroke="#5d4a66" stroke-width="1.6"/>`;
        for (let i = 0; i < n; i++) {
          const y = top + i * 7;
          s += `<ellipse cx="${x - 4}" cy="${y}" rx="3.4" ry="2.8" fill="#a66d8f"/><ellipse cx="${x + 4}" cy="${y + 3}" rx="3.4" ry="2.8" fill="#c48aa8"/>`;
        }
        return s;
      };
      const heart = (cx: number, cy: number, s: number, rot: number) =>
        `<path transform="rotate(${rot} ${cx} ${cy})" d="M${cx} ${cy + 14 * s} C${cx - 22 * s} ${cy} ${cx - 14 * s} ${cy - 16 * s} ${cx} ${cy - 6 * s} C${cx + 14 * s} ${cy - 16 * s} ${cx + 22 * s} ${cy} ${cx} ${cy + 14 * s}Z" fill="#3f5f3d"/>` +
        `<path transform="rotate(${rot} ${cx} ${cy})" d="M${cx} ${cy + 12 * s} L${cx} ${cy - 4 * s}" stroke="#7f9c72" stroke-width="1.2"/>`;
      return spike(30, 46, 7) + spike(50, 28, 10) + spike(70, 46, 7) + heart(28, 112, 1, -24) + heart(72, 112, 1, 24) + heart(50, 118, 1.05, 0);
    },
  },
];

/** Symbols drawn once and cached. */
const motifCache = new Map<number, string>();
const motif = (m: number) => {
  if (!motifCache.has(m)) motifCache.set(m, STYLES[m].draw());
  return motifCache.get(m)!;
};

function ribbon(def: CardDef, month: number): string {
  const color = def.ribbon === 'blue' ? RIBBON_BLUE : RIBBON_RED;
  let s = `<g transform="rotate(-10 50 86)"><rect x="40" y="56" width="20" height="62" rx="2" fill="${color}" stroke="${PAPER}" stroke-width="1.5"/>`;
  if (def.ribbon === 'poetry') {
    const text = month === 2 ? ['み', 'よ', 'し', 'の'] : ['あ', 'か', 'よ', 'ろ', 'し'];
    text.forEach((ch, i) => {
      s += `<text x="50" y="${70 + i * 11}" text-anchor="middle" font-size="9.5" font-family="'Zen Old Mincho', serif" fill="${PAPER}">${ch}</text>`;
    });
  }
  return s + '</g>';
}

function medallion(glyph: string, cx: number, cy: number, r: number, fill: string, ink: string): string {
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r - 2.2}" fill="none" stroke="${PAPER}" stroke-width="0.9" opacity="0.8"/>` +
    `<text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-size="${f(r * 1.05)}" font-family="'Zen Old Mincho', serif" font-weight="600" fill="${ink}">${glyph}</text>`
  );
}

/** Full SVG markup (inner) for one card id. */
export function cardInner(id: number): string {
  const month = id >> 2;
  const variant = id & 3;
  const def = cardDef(id);
  const style = STYLES[month];
  let bg = `<rect width="100" height="140" rx="9" fill="${PAPER}"/><rect x="4" y="4" width="92" height="132" rx="6" fill="${style.tint}"/>`;

  // Bright cards get a sky disc behind the motif (moon is pale on a warm sky).
  if (def.kind === 'bright') {
    if (month === 7) bg += `<rect x="4" y="4" width="92" height="132" rx="6" fill="#c9583e"/><circle cx="50" cy="44" r="27" fill="#f3ead2"/>`;
    else bg += `<circle cx="66" cy="36" r="24" fill="${VERMILION}" opacity="0.92"/>`;
  }

  // A second plain card is the mirror image, so pairs aren't pixel-identical.
  const plainAlt = def.kind === 'plain' && variant > 0;
  const art = plainAlt
    ? `<g clip-path="url(#card-clip)"><g transform="translate(100 0) scale(-1 1)">${motif(month)}</g></g>`
    : `<g clip-path="url(#card-clip)">${motif(month)}</g>`;

  let over = '';
  if (def.kind === 'ribbon') over = ribbon(def, month);
  if (def.kind === 'animal' && def.glyph) over = medallion(def.glyph, 76, 26, 13, GOLD, PAPER);
  if (def.kind === 'bright' && def.glyph) {
    over = month === 7 ? medallion(def.glyph, 50, 44, 11, VERMILION, PAPER) : medallion(def.glyph, 66, 36, 12, PAPER, VERMILION);
  }

  const chipW = month + 1 >= 10 ? 19 : 13;
  const num = `<rect x="6" y="7" width="${chipW}" height="15" rx="4" fill="${PAPER}" opacity="0.85"/><text x="${6 + chipW / 2}" y="18.5" text-anchor="middle" font-size="11" font-family="'Gowun Batang', serif" font-weight="700" fill="${INK}" opacity="0.62">${month + 1}</text>`;
  return bg + art + over + num;
}

/** A card under snow (First snow levels): pale, soft drifts, a faint flake. */
export function cardSnowInner(): string {
  const flake = (cx: number, cy: number, r: number, o: number) => {
    let d = '';
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      d += `M${cx} ${cy} L${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)} `;
    }
    return `<path d="${d}" stroke="#9fb3c4" stroke-width="1.3" stroke-linecap="round" opacity="${o}"/>`;
  };
  return (
    `<rect width="100" height="140" rx="9" fill="${PAPER}"/>` +
    `<rect x="4" y="4" width="92" height="132" rx="6" fill="#e9eef2"/>` +
    `<path d="M4 96 Q30 84 52 94 T96 90 L96 136 L4 136Z" fill="#f7f9fb"/>` +
    `<path d="M4 116 Q36 104 64 114 T96 112 L96 136 L4 136Z" fill="#ffffff"/>` +
    flake(50, 52, 15, 0.9) + flake(24, 26, 6, 0.5) + flake(78, 74, 7, 0.5) + flake(30, 82, 4, 0.4)
  );
}

/** Large faint flower used as the watermark on board papers. */
export const MONTH_TINTS = STYLES.map((st) => st.tint);

/** Back of a card (album locked state). */
export function cardBackInner(): string {
  let pattern = '';
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 5; c++) {
      const x = 14 + c * 18 + (r % 2) * 9;
      const y = 16 + r * 18;
      pattern += `<circle cx="${x}" cy="${y}" r="5.5" fill="none" stroke="#4a5a7a" stroke-width="1"/>`;
    }
  return (
    `<rect width="100" height="140" rx="9" fill="#2d3850"/>` +
    `<rect x="5" y="5" width="90" height="130" rx="6" fill="none" stroke="#56688c" stroke-width="1"/>` +
    pattern +
    `<rect x="32" y="52" width="36" height="36" rx="5" fill="${VERMILION}"/>` +
    `<rect x="35" y="55" width="30" height="30" rx="3" fill="none" stroke="${PAPER}" stroke-width="1"/>` +
    `<text x="50" y="78" text-anchor="middle" font-size="19" font-family="'Gowun Batang', serif" font-weight="700" fill="${PAPER}">짝</text>`
  );
}

/** Inject the sprite into the document once. */
export function installCardSprite(): void {
  if (document.getElementById('card-sprite')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.id = 'card-sprite';
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  let inner = '<defs><clipPath id="card-clip"><rect x="4" y="4" width="92" height="132" rx="6"/></clipPath></defs>';
  for (let id = 0; id < 48; id++) inner += `<symbol id="card-${id}" viewBox="0 0 100 140">${cardInner(id)}</symbol>`;
  inner += `<symbol id="card-back" viewBox="0 0 100 140">${cardBackInner()}</symbol>`;
  inner += `<symbol id="card-snow" viewBox="0 0 100 140">${cardSnowInner()}</symbol>`;
  for (let m = 0; m < 12; m++) inner += `<symbol id="motif-${m}" viewBox="0 0 100 140">${motif(m)}</symbol>`;
  svg.innerHTML = inner;
  document.body.prepend(svg);
}

export const cardSvg = (id: number | 'back' | 'snow', cls = 'card-art') =>
  `<svg class="${cls}" viewBox="0 0 100 140" aria-hidden="true"><use href="#card-${id}"/></svg>`;

export const monthName = (id: number) => MONTHS[id >> 2].en;
