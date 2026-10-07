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
  opacity?: number;
}

export interface Special {
  /** drawn behind the flower motif (skies, suns) */
  back?: string;
  parts: Part[];
  /** drawn on top without a halo (text, sparkles) */
  front?: string;
  /** kanji tag shown in the corner */
  glyph: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Circle as a path so it can join the halo pass. */
export const circ = (cx: number, cy: number, r: number) =>
  `M${r1(cx - r)} ${r1(cy)}a${r} ${r} 0 1 0 ${r1(2 * r)} 0a${r} ${r} 0 1 0 ${r1(-2 * r)} 0Z`;
/** Ellipse as a path. */
export const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${r1(cx - rx)} ${r1(cy)}a${rx} ${ry} 0 1 0 ${r1(2 * rx)} 0a${rx} ${ry} 0 1 0 ${r1(-2 * rx)} 0Z`;

function partSvg(p: Part, halo: boolean): string {
  const t = p.t ? ` transform="${p.t}"` : '';
  if (halo) {
    if (p.noHalo) return '';
    const w = (p.sw ?? 0) + 5;
    return `<path${t} d="${p.d}" fill="${p.fill && p.fill !== 'none' ? PAPER : 'none'}" stroke="${PAPER}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const op = p.opacity != null ? ` opacity="${p.opacity}"` : '';
  const stroke = p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 1}" stroke-linecap="round" stroke-linejoin="round"` : '';
  return `<path${t} d="${p.d}" fill="${p.fill ?? 'none'}"${stroke}${op}/>`;
}

export function renderParts(parts: Part[]): string {
  return parts.map((p) => partSvg(p, true)).join('') + parts.map((p) => partSvg(p, false)).join('');
}

/** Butterfly centred on (0,0); place with a transform. */
function butterfly(wing: string, spot: string, t: string): Part[] {
  const ul = 'M0 0C-5 -13 -19 -17 -21 -7C-22 1 -9 3 0 0Z';
  const ll = 'M0 1C-3 7 -11 15 -16 12C-19 8 -10 3 0 1Z';
  return [
    { d: ul, fill: wing, t },
    { d: ll, fill: wing, t, opacity: 0.92 },
    { d: ul, fill: wing, t: `${t} scale(-1 1)` },
    { d: ll, fill: wing, t: `${t} scale(-1 1)`, opacity: 0.92 },
    { d: circ(-12, -7, 2.6), fill: spot, t, noHalo: true },
    { d: circ(12, -7, 2.6), fill: spot, t, noHalo: true },
    { d: 'M0 -6C1.6 -6 1.6 9 0 9C-1.6 9 -1.6 -6 0 -6Z', fill: INK, t },
    { d: 'M0 -5C-2 -10 -4 -12 -6 -13M0 -5C2 -10 4 -12 6 -13', stroke: INK, sw: 0.8, t, noHalo: true },
  ];
}

/** Goose in flight centred on (0,0). */
const goose = (t: string): Part[] => [
  { d: 'M-13 1C-9 -5 -4 -6 0 -1C4 -6 9 -5 13 1C8 -1 4 0 1 3L-1 3C-4 0 -8 -1 -13 1Z', fill: '#3b3735', t },
  { d: 'M0 -1C1 -4 3 -6 6 -7L7 -5C4 -4 2 -2 1 1Z', fill: '#3b3735', t },
];

export const SPECIALS: Record<number, Special> = {
  // 1 · Pine — Crane (bright)
  3: {
    glyph: '鶴',
    back: `<circle cx="66" cy="38" r="23" fill="${VERMILION}"/>`,
    parts: [
      { d: 'M66 93C76 92 85 99 88 108C80 106 72 104 66 101Z', fill: INK },
      { d: 'M38 101C37 87 51 80 64 84C75 87 78 98 71 104C63 111 45 111 38 101Z', fill: '#fbf8f1' },
      { d: 'M48 93C56 85 68 86 73 95C65 97 56 99 48 97Z', fill: '#e2ddd1' },
      { d: 'M47 93C40 81 30 73 36 60', stroke: INK, sw: 4.2 },
      { d: circ(37, 58, 4.4), fill: '#fbf8f1' },
      { d: circ(38.4, 54.6, 2.2), fill: VERMILION, noHalo: true },
      { d: 'M34 58L23 62L33.5 60.5Z', fill: '#c9a24a' },
      { d: circ(36, 57.4, 0.9), fill: INK, noHalo: true },
      { d: 'M52 109L50 129M50 129L46 131M58 109L61 129M61 129L65 131', stroke: INK, sw: 1.4 },
    ],
  },
  // 2 · Plum — Bush warbler
  7: {
    glyph: '鶯',
    parts: [
      { d: 'M51 59L36 67L40 61L33 61L50 54Z', fill: '#66702f' },
      { d: 'M50 60C50 50 60 44 70 46C78 48 80 56 76 62C70 68 56 68 50 60Z', fill: '#848d48' },
      { d: 'M54 62C60 67 70 65 75 60C68 58 59 58 54 62Z', fill: '#cfc584' },
      { d: 'M57 52C63 49 70 53 72 58C66 58 60 57 57 52Z', fill: '#646e33' },
      { d: circ(72, 46, 7), fill: '#848d48' },
      { d: circ(74, 45, 2.3), fill: PAPER, noHalo: true },
      { d: circ(74.4, 45, 1.3), fill: INK, noHalo: true },
      { d: 'M78.5 45.5L85 47L78.5 49Z', fill: '#4a3f2a' },
      { d: 'M60 66L58 71M66 66L66 71', stroke: '#4a3f2a', sw: 1.2, noHalo: true },
    ],
  },
  // 3 · Cherry — Curtain (bright)
  11: {
    glyph: '幕',
    back: `<circle cx="70" cy="30" r="16" fill="${VERMILION}" opacity=".9"/>`,
    parts: [
      { d: 'M8 106L92 106L92 110L8 110Z', fill: '#4a3830' },
      { d: 'M10 110L90 110L90 130Q70 138 50 130Q30 138 10 130Z', fill: '#a7342b' },
      ...[18, 34, 50, 66, 82].map((x): Part => ({ d: `M${x - 3} 110L${x + 3} 110L${x + 3} ${x === 50 ? 130 : 133}L${x - 3} ${x === 50 ? 130 : 133}Z`, fill: '#f3e6dc', noHalo: true })),
      { d: circ(50, 119, 7.5), fill: PAPER, noHalo: true },
      { d: 'M6 104L10 112M94 104L90 112', stroke: '#4a3830', sw: 2 },
    ],
    front: (() => {
      let s = '';
      for (let i = 0; i < 5; i++) s += `<ellipse transform="rotate(${i * 72} 50 119)" cx="50" cy="115.4" rx="2.3" ry="2.8" fill="#d4848f"/>`;
      return s + `<circle cx="50" cy="119" r="1.3" fill="#b5677a"/>`;
    })(),
  },
  // 4 · Wisteria — Cuckoo under a crescent
  15: {
    glyph: '鵑',
    parts: [
      { d: 'M80 88A12 12 0 1 0 80 112A9 9 0 1 1 80 88Z', fill: '#f0d98c' },
      { d: 'M30 110L17 105L20 112Z', fill: '#3e4450' },
      { d: 'M30 110C40 104 54 104 62 108C56 112 42 114 30 110Z', fill: '#4b5260' },
      { d: 'M36 111C44 113 52 112 58 110C54 114 44 116 36 111Z', fill: '#d9d4c7' },
      { d: 'M44 106C46 94 58 86 72 83C63 94 57 102 51 108Z', fill: '#3e4450' },
      { d: 'M41 110C37 118 30 124 21 126C29 118 34 112 38 109Z', fill: '#353b46' },
      { d: circ(62.5, 107, 4.6), fill: '#4b5260' },
      { d: 'M66.5 106L71 107L66.5 108.6Z', fill: '#c9a24a' },
      { d: circ(63.6, 106, 1), fill: '#f0d98c', noHalo: true },
    ],
  },
  // 5 · Iris — Eight-plank bridge
  19: {
    glyph: '橋',
    parts: [
      { d: 'M4 120Q20 116 36 120M60 126Q76 122 96 126', stroke: '#8fa9c4', sw: 1.4 },
      { d: 'M4 104L40 96L42 104L6 112Z', fill: '#8a6a4a' },
      { d: 'M40 96L66 110L64 118L42 104Z', fill: '#7a5c3f' },
      { d: 'M66 110L96 100L96 108L64 118Z', fill: '#8a6a4a' },
      { d: 'M4 104L40 96L40.6 98.2L4.6 106.2Z', fill: '#b08d64', noHalo: true },
      { d: 'M66 110L96 100L96 102.4L66.4 112.4Z', fill: '#b08d64', noHalo: true },
      { d: 'M12 110L12 122M34 104L34 116M52 112L52 124M78 112L78 124M92 108L92 120', stroke: '#4a3830', sw: 2 },
    ],
  },
  // 6 · Peony — Butterflies
  23: {
    glyph: '蝶',
    parts: [...butterfly('#3f5a8a', '#f2e6c8', 'translate(25 30) rotate(-18)'), ...butterfly('#d29a3a', '#fbefd5', 'translate(78 26) rotate(22) scale(.82)')],
  },
  // 7 · Bush clover — Boar
  27: {
    glyph: '猪',
    parts: [
      { d: 'M26 118L24 130L29 130L31 119ZM38 120L37 131L42 131L43 120ZM62 120L62 131L67 131L67 119ZM72 117L74 129L79 129L77 116Z', fill: '#2f2621' },
      { d: 'M16 112C16 96 32 87 50 87C64 87 75 93 80 101L89 105C92 109 88 114 83 112L79 112C75 120 63 122 51 121L30 121C21 121 16 117 16 112Z', fill: '#4a3a30' },
      { d: 'M22 100C30 92 42 89 54 89C64 89 72 93 77 99', stroke: '#7a6555', sw: 2.4, noHalo: true },
      { d: 'M84 109C87 107 89 104 88 101', stroke: PAPER, sw: 1.6, noHalo: true },
      { d: circ(76, 101, 1.3), fill: PAPER, noHalo: true },
      { d: 'M70 92L74 85L77 94Z', fill: '#3a2d25' },
      { d: 'M17 106C12 104 9 106 8 110', stroke: '#4a3a30', sw: 2 },
    ],
  },
  // 8 · Silver grass — Geese
  30: { glyph: '雁', parts: [...goose('translate(26 30) scale(1.25)'), ...goose('translate(50 20) scale(1.4)'), ...goose('translate(74 32) scale(1.15)')] },
  // 8 · Silver grass — Full moon (bright)
  31: {
    glyph: '月',
    back: `<rect x="4" y="4" width="92" height="132" rx="6" fill="#c9583e"/><circle cx="50" cy="44" r="31" fill="#d8735a" opacity=".55"/><circle cx="50" cy="44" r="27" fill="#f3ead2"/><circle cx="58" cy="38" r="4" fill="#ebe0c2"/><circle cx="42" cy="52" r="3" fill="#ebe0c2"/>`,
    parts: [],
  },
  // 9 · Chrysanthemum — Sake cup
  35: {
    glyph: '盃',
    parts: [
      { d: 'M42 112L58 112L55 121L45 121Z', fill: '#8f2a20' },
      { d: 'M26 98C28 113 72 113 74 98Z', fill: '#b23b2e' },
      { d: ell(50, 98, 24, 6.5), fill: '#c4472f' },
      { d: ell(50, 98, 20.5, 4.6), fill: '#d9604a', noHalo: true },
      { d: ell(50, 98, 24, 6.5), stroke: GOLD, sw: 1, noHalo: true },
    ],
    front: `<text x="50" y="110" text-anchor="middle" font-size="9" font-family="'Zen Old Mincho', serif" font-weight="600" fill="#e8c46a">寿</text>`,
  },
  // 10 · Maple — Deer looking away
  39: {
    glyph: '鹿',
    parts: [
      { d: 'M34 108L32 130M42 110L41 131M60 110L62 131M68 107L71 129', stroke: '#6e4a2a', sw: 2.4 },
      { d: 'M28 104C28 94 40 90 56 90C68 90 74 96 74 104C74 108 70 110 64 110L36 110C30 110 28 108 28 104Z', fill: '#b0763f' },
      { d: 'M28 101C24 99 22 101 23 104C25 104 27 104 28 103Z', fill: PAPER },
      { d: 'M66 95C70 85 72 79 70 73L64 74C64 81 62 87 60 93Z', fill: '#b0763f' },
      { d: 'M67 67C63 64 55 66 52 70C56 75 63 75 67 72Z', fill: '#a56c38' },
      { d: 'M66 66L71 61L69 68Z', fill: '#a56c38' },
      { d: 'M64 65C64 58 60 54 56 52M61 58L56 58M64 65C66 58 70 54 72 50M69 55L74 56', stroke: '#5a3c22', sw: 1.4 },
      { d: circ(57, 69, 0.9), fill: INK, noHalo: true },
      ...[[38, 97], [46, 95], [54, 98], [44, 102], [60, 96], [36, 101]].map(([x, y]): Part => ({ d: circ(x, y, 1.3), fill: '#f1dcc0', noHalo: true })),
    ],
  },
  // 11 · Willow — Swallow
  42: {
    glyph: '燕',
    parts: [
      { d: 'M44 92L27 85L34 92L27 99Z', fill: '#26304a' },
      { d: 'M44 92C52 88 62 88 68 92C62 96 52 98 44 92Z', fill: '#26304a' },
      { d: 'M48 94C54 97 60 96 65 94C60 98 53 99 48 94Z', fill: '#f4efe4', noHalo: true },
      { d: 'M54 90C56 77 66 69 82 64C72 75 66 84 60 92Z', fill: '#2d3854' },
      { d: 'M52 94C48 104 40 110 29 113C37 104 43 98 48 94Z', fill: '#1f283d' },
      { d: circ(68, 91, 4.2), fill: '#26304a' },
      { d: 'M69 93.6C70 95 71.5 95.5 73 95', stroke: VERMILION, sw: 1.6, noHalo: true },
      { d: 'M72 90L76.5 91L72 92.2Z', fill: INK },
    ],
  },
  // 11 · Willow — Rain (bright): the umbrella poet and the frog
  43: {
    glyph: '雨',
    back: `<rect x="4" y="4" width="92" height="132" fill="url(#sky-storm)"/><circle cx="72" cy="28" r="17" fill="${VERMILION}" opacity=".88"/>`,
    parts: [
      { d: 'M42 92L60 92L68 128L34 128Z', fill: '#3f4a6a' },
      { d: 'M47 92L51 104L55 92Z', fill: '#e8e0cf', noHalo: true },
      { d: 'M38 100L44 114L40 116Z', fill: '#34405e' },
      { d: 'M51 72L51 112', stroke: '#4a3830', sw: 1.6 },
      { d: 'M22 90Q51 62 80 90Q72 86 65 90Q58 86 51 90Q44 86 37 90Q30 86 22 90Z', fill: '#d9b04a' },
      { d: 'M51 72L28 88M51 72L40 89M51 72L62 89M51 72L74 88', stroke: '#9b7a2c', sw: 0.8, noHalo: true },
      { d: ell(80, 126, 6, 4), fill: '#5f8a4a' },
      { d: `${circ(77, 122.5, 1.8)}${circ(83, 122.5, 1.8)}`, fill: '#5f8a4a' },
      { d: `${circ(77, 122.3, 0.8)}${circ(83, 122.3, 0.8)}`, fill: INK, noHalo: true },
    ],
  },
  // 12 · Paulownia — Phoenix (bright)
  47: {
    glyph: '鳳',
    back: `<rect x="4" y="4" width="92" height="132" fill="url(#sky-red)"/>`,
    parts: [
      { d: 'M48 54C36 62 22 70 10 70C18 64 30 58 44 52Z', fill: '#3f6a50' },
      { d: 'M50 56C42 68 32 78 18 84C26 74 36 64 46 54Z', fill: '#d9a441' },
      { d: 'M52 58C48 72 42 82 32 90C36 78 42 66 48 56Z', fill: '#2f4a6d' },
      { d: `${circ(12, 69, 3)}${circ(20, 83, 3)}${circ(33, 89, 3)}`, fill: '#f3ead2', noHalo: true },
      { d: 'M50 44C40 30 28 22 14 22C22 32 34 42 46 50Z', fill: '#d9a441' },
      { d: 'M48 42C42 34 34 29 24 27C30 34 38 40 46 46Z', fill: '#3f6a50', noHalo: true },
      { d: 'M46 50C46 40 56 34 62 38C66 42 62 52 54 56Z', fill: '#c4472f' },
      { d: 'M56 40C64 30 76 26 88 26C80 34 70 42 60 46Z', fill: '#d9a441' },
      { d: circ(63, 34, 5), fill: '#c4472f' },
      { d: 'M67 33L73 34.5L67 36Z', fill: '#e8c46a' },
      { d: 'M61 30C59 24 60 20 63 17M63 30C63 25 65 21 68 19', stroke: '#e8c46a', sw: 1.2, noHalo: true },
      { d: circ(64, 33, 1), fill: INK, noHalo: true },
    ],
  },
};
