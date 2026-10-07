/**
 * Card backs (Market cosmetics). Each returns the inner markup of a 100 × 140
 * card back. Gradients live in a <defs> inside the markup with `bk-<id>-`
 * ids; the panel clip (`card-clip`) comes from the card sprite.
 * The classic "Night sky" back is cardBackInner() in cards.ts.
 */
import { PAPER, VERMILION, rng, smooth, taper, lin, type Pt } from './specials';
import { luckyCloud } from './bonus';

const f = (n: number) => Math.round(n * 10) / 10;

/** The family frame: a dark edge, a double inner rule and diamond corners. */
function frame(line: string, edge: string, op = 0.7): string {
  const corner = (x: number, y: number) => `M${x} ${y - 1.6}L${x + 1.6} ${y}L${x} ${y + 1.6}L${x - 1.6} ${y}Z`;
  return (
    `<rect x=".4" y=".4" width="99.2" height="139.2" rx="8.6" fill="none" stroke="${edge}" stroke-opacity=".6" stroke-width=".8"/>` +
    `<rect x="4.4" y="4.4" width="91.2" height="131.2" rx="6" fill="none" stroke="${line}" stroke-opacity="${op}" stroke-width=".7"/>` +
    `<rect x="7.4" y="7.4" width="85.2" height="125.2" rx="4.4" fill="none" stroke="${line}" stroke-opacity="${f(op * 0.5)}" stroke-width=".4"/>` +
    `<path d="${corner(7.4, 7.4) + corner(92.6, 7.4) + corner(7.4, 132.6) + corner(92.6, 132.6)}" fill="${line}" opacity="${f(op + 0.05)}"/>`
  );
}

/** The vermilion 짝 seal, centred on (cx, cy), `s` wide. */
function seal(cx: number, cy: number, s: number, seed: number, rot = -5): string {
  const r = rng(seed);
  const x = cx - s / 2;
  const y = cy - s / 2;
  const k = s / 36;
  let wear = '';
  for (let i = 0; i < 12; i++) wear += `<circle cx="${f(x + 4 * k + r() * (s - 8 * k))}" cy="${f(y + 4 * k + r() * (s - 8 * k))}" r="${f((0.2 + r() * 0.5) * k)}" fill="${PAPER}" opacity="${f(0.25 + r() * 0.3)}"/>`;
  return (
    `<g transform="rotate(${rot} ${cx} ${cy})">` +
    `<rect x="${f(x + 1)}" y="${f(y + 1.2)}" width="${s}" height="${s}" rx="${f(5 * k)}" fill="#000" opacity=".25"/>` +
    `<rect x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" rx="${f(5 * k)}" fill="${VERMILION}"/>` +
    `<rect x="${f(x + 2.8 * k)}" y="${f(y + 2.8 * k)}" width="${f(s - 5.6 * k)}" height="${f(s - 5.6 * k)}" rx="${f(3 * k)}" fill="none" stroke="${PAPER}" stroke-width="${f(1.1 * k)}"/>` +
    `<text x="${cx}" y="${f(cy + 8 * k)}" text-anchor="middle" font-size="${f(19 * k)}" font-family="'Gowun Batang', serif" font-weight="700" fill="${PAPER}">짝</text>` +
    wear +
    `</g>`
  );
}

/** A round medallion behind the seal. */
const roundel = (fill: string, ring: string, r = 24) =>
  `<circle cx="50" cy="70" r="${r}" fill="${fill}"/>` +
  `<circle cx="50" cy="70" r="${r}" fill="none" stroke="${ring}" stroke-opacity=".7" stroke-width=".7"/>` +
  `<circle cx="50" cy="70" r="${f(r - 2.4)}" fill="none" stroke="${ring}" stroke-opacity=".35" stroke-width=".4"/>`;

/* ---------- 청해파 · Seigaiha: overlapping fans of concentric waves ---------- */
function seigaiha(): string {
  const R = 10;
  const blues = ['#2c5285', '#335c91'];
  let s = '';
  for (let row = 0; row < 31; row++) {
    const y = row * 5 + 1;
    const off = row % 2 ? R : 0;
    let fan = '';
    let rings = '';
    let edge = '';
    for (let col = -1; col < 6; col++) {
      const x = col * R * 2 + off;
      fan += `M${f(x - R)} ${y}a${R} ${R} 0 0 1 ${2 * R} 0Z`;
      edge += `M${f(x - R + 0.5)} ${y}a${R - 0.5} ${R - 0.5} 0 0 1 ${f(2 * R - 1)} 0`;
      for (const k of [2.6, 4.9, 7.1]) rings += `M${f(x - R + k)} ${y}a${f(R - k)} ${f(R - k)} 0 0 1 ${f(2 * (R - k))} 0`;
    }
    s += `<path d="${fan}" fill="${blues[row % 2]}"/>`;
    s += `<path d="${edge}" fill="none" stroke="#f3efe4" stroke-width="1.05"/>`;
    s += `<path d="${rings}" fill="none" stroke="#e7ebec" stroke-width=".72"/>`;
  }
  return (
    `<defs><radialGradient id="bk-sei-glow" cx=".5" cy=".5" r=".72"><stop offset=".55" stop-color="#0d1a33" stop-opacity="0"/><stop offset="1" stop-color="#0d1a33" stop-opacity=".38"/></radialGradient></defs>` +
    `<rect width="100" height="140" rx="9" fill="#2c5285"/>` +
    `<g clip-path="url(#card-clip)">${s}<rect x="4" y="4" width="92" height="132" fill="url(#bk-sei-glow)"/></g>` +
    frame('#f3efe4', '#0e1a30', 0.8) +
    roundel('#f3efe4', '#2c5285', 23.5) +
    `<circle cx="50" cy="70" r="19.6" fill="none" stroke="#2c5285" stroke-opacity=".3" stroke-width=".5" stroke-dasharray="1 1.6"/>` +
    seal(50, 70, 27, 11)
  );
}

/* ---------- 단청 · Dancheong: temple colour bands and lotus medallions ---------- */
const DC = {
  green: '#2f6e5f',
  greenLt: '#4f9a7e',
  red: '#8a2f24',
  ver: '#c4472f',
  pink: '#eba596',
  navy: '#1f2f52',
  blue: '#2f5f9a',
  sky: '#86abd2',
  yellow: '#e8b84a',
  white: '#f6efe0',
  ink: '#1e1b19',
};

/** A petal pointing up from (0,0), length l and half-width w. */
const petalD = (l: number, w: number) => `M0 0C${f(-w)} ${f(-l * 0.25)} ${f(-w * 0.9)} ${f(-l * 0.8)} 0 ${f(-l)}C${f(w * 0.9)} ${f(-l * 0.8)} ${f(w)} ${f(-l * 0.25)} 0 0Z`;

/** A ring of graded petals (the 휘 bands of dancheong). */
function petalRing(cx: number, cy: number, n: number, r0: number, l: number, w: number, cols: string[], a0 = 0, a1 = 360): string {
  let s = '';
  const span = a1 - a0;
  const full = span >= 360;
  const count = full ? n : n + 1;
  cols.forEach((c, k) => {
    const sc = 1 - k * (0.8 / cols.length);
    let d = '';
    for (let i = 0; i < count; i++) {
      const a = a0 + (span * i) / (full ? n : n);
      const ar = (a * Math.PI) / 180;
      const x = cx + Math.sin(ar) * r0;
      const y = cy - Math.cos(ar) * r0;
      d += `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(${f(sc)})" d="${petalD(l, w)}"/>`;
    }
    s += `<g fill="${c}"${k === 0 ? ` stroke="${DC.ink}" stroke-width=".35"` : ''}>${d}</g>`;
  });
  return s;
}

function rosette(cx: number, cy: number, R: number, withSeal: boolean): string {
  const k = R / 26;
  return (
    petalRing(cx, cy, 16, 13 * k, 13.4 * k, 4.6 * k, [DC.red, DC.ver, DC.pink, DC.white]) +
    petalRing(cx, cy, 8, 7 * k, 10 * k, 4.8 * k, [DC.navy, DC.blue, DC.sky, DC.white], 22.5) +
    `<circle cx="${cx}" cy="${cy}" r="${f(10.6 * k)}" fill="${DC.green}" stroke="${DC.ink}" stroke-width=".35"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${f(9.2 * k)}" fill="none" stroke="${DC.white}" stroke-width="${f(0.9 * k)}" stroke-dasharray="${f(0.9 * k)} ${f(1.5 * k)}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${f(7.6 * k)}" fill="${DC.yellow}" stroke="${DC.ink}" stroke-width=".35"/>` +
    (withSeal ? '' : `<circle cx="${cx}" cy="${cy}" r="${f(3.4 * k)}" fill="${DC.ver}"/><circle cx="${cx}" cy="${cy}" r="${f(1.4 * k)}" fill="${DC.white}"/>`)
  );
}

function dancheong(): string {
  const bands: [number, number, string][] = [
    [4, 9.4, DC.red],
    [9.4, 10.4, DC.white],
    [10.4, 13.2, DC.navy],
    [13.2, 16, DC.blue],
    [16, 18.8, DC.sky],
    [18.8, 19.8, DC.white],
    [19.8, 22.2, DC.ver],
    [22.2, 23, DC.ink],
  ];
  let top = '';
  let bot = '';
  for (const [a, b, c] of bands) {
    top += `<rect x="0" y="${a}" width="100" height="${f(b - a)}" fill="${c}"/>`;
    bot += `<rect x="0" y="${f(140 - b)}" width="100" height="${f(b - a)}" fill="${c}"/>`;
  }
  // a comb of little white "teeth" (빗살) along the inner edge of the bands
  let comb = '';
  for (let x = 6; x < 96; x += 3) comb += `M${x} 23V25.4M${x} 117V114.6`;
  // half rosettes hanging from the bands, and small side rosettes
  const half = (x: number, y: number, flip: boolean) =>
    `<g transform="translate(${x} ${y})${flip ? ' scale(1 -1)' : ''}">` +
    petalRing(0, 0, 6, 3.4, 8.6, 3.6, [DC.red, DC.ver, DC.pink, DC.white], 98, 262) +
    `<path d="M-5.6 0A5.6 5.6 0 0 0 5.6 0Z" fill="${DC.yellow}" stroke="${DC.ink}" stroke-width=".35"/>` +
    `<path d="M-2.4 0A2.4 2.4 0 0 0 2.4 0Z" fill="${DC.ver}"/>` +
    `</g>`;
  return (
    `<rect width="100" height="140" rx="9" fill="${DC.green}"/>` +
    `<g clip-path="url(#card-clip)">` +
    `<rect x="0" y="0" width="100" height="140" fill="${DC.green}"/>` +
    // faint lattice of the green ground (뇌록 brushwork)
    `<path d="M4 46H96M4 94H96" stroke="${DC.greenLt}" stroke-width=".5" stroke-opacity=".6"/>` +
    top +
    bot +
    `<path d="${comb}" stroke="${DC.white}" stroke-width=".8"/>` +
    half(18, 23, false) +
    half(50, 23, false) +
    half(82, 23, false) +
    half(18, 117, true) +
    half(50, 117, true) +
    half(82, 117, true) +
    rosette(13, 70, 9.6, false) +
    rosette(87, 70, 9.6, false) +
    `</g>` +
    rosette(50, 70, 27, true) +
    frame(DC.white, '#10261f', 0.75) +
    seal(50, 70, 15.4, 7, 0)
  );
}

/* ---------- 麻の葉 · Asanoha: the hemp-leaf star lattice ---------- */
function asanoha(): string {
  const a = 13;
  const h = (a * Math.sqrt(3)) / 2;
  let lines = '';
  let light = '';
  const P = ([x, y]: Pt) => `${f(x)} ${f(y)}`;
  for (let j = -1; j < 15; j++) {
    for (let i = -1; i < 10; i++) {
      const ox = j % 2 ? a / 2 : 0;
      const x0 = i * a + ox - 2;
      const y0 = j * h + 2;
      // up-pointing and down-pointing triangles of this cell
      const tris: Pt[][] = [
        [[x0, y0 + h], [x0 + a, y0 + h], [x0 + a / 2, y0]],
        [[x0 + a / 2, y0], [x0 + a * 1.5, y0], [x0 + a, y0 + h]],
      ];
      for (const t of tris) {
        const c: Pt = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3];
        lines += `M${P(t[0])}L${P(t[1])}L${P(t[2])}Z`;
        for (const v of t) lines += `M${P(v)}L${P(c)}`;
        light += `M${P(t[0])}L${P(c)}L${P(t[2])}Z`;
      }
    }
  }
  return (
    `<defs><radialGradient id="bk-asa-glow" cx=".5" cy=".5" r=".72"><stop offset="0" stop-color="#8a3a4a" stop-opacity=".35"/><stop offset=".6" stop-color="#4a1824" stop-opacity="0"/><stop offset="1" stop-color="#1e0a10" stop-opacity=".5"/></radialGradient></defs>` +
    `<rect width="100" height="140" rx="9" fill="#561f2c"/>` +
    `<g clip-path="url(#card-clip)">` +
    `<path d="${light}" fill="#68283a"/>` +
    `<path d="${lines}" fill="none" stroke="#d2ad66" stroke-width=".55" stroke-linejoin="round"/>` +
    `<rect x="4" y="4" width="92" height="132" fill="url(#bk-asa-glow)"/>` +
    `</g>` +
    frame('#d2ad66', '#1e0a10', 0.85) +
    roundel('#4a1824', '#d2ad66', 23.5) +
    seal(50, 70, 28, 13)
  );
}

/* ---------- 瑞雲 · Lucky clouds: gold maki-e clouds on black lacquer ---------- */
function clouds(): string {
  const r = rng(21);
  let dust = '';
  for (let i = 0; i < 150; i++) dust += `M${f(4 + r() * 92)} ${f(4 + r() * 132)}h.01`;
  const gold = 'url(#bk-cl-gold)';
  const cl = (x: number, y: number, s: number, fl: 1 | -1, red = false) => luckyCloud(x, y, s, fl, red ? '#a8352a' : gold, red ? '#d8b25a' : '#7a5a24', 0.5);
  return (
    `<defs>` +
    `<linearGradient id="bk-cl-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d488"/><stop offset=".55" stop-color="#d0a24a"/><stop offset="1" stop-color="#a87a30"/></linearGradient>` +
    `<radialGradient id="bk-cl-glow" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#4a3424" stop-opacity=".55"/><stop offset=".7" stop-color="#1d1a19" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></radialGradient>` +
    `</defs>` +
    `<rect width="100" height="140" rx="9" fill="#1d1a19"/>` +
    `<g clip-path="url(#card-clip)">` +
    `<rect x="4" y="4" width="92" height="132" fill="url(#bk-cl-glow)"/>` +
    `<path d="${dust}" stroke="#d0a24a" stroke-width=".7" stroke-linecap="round" opacity=".45"/>` +
    cl(18, 24, 1.25, 1) +
    cl(80, 40, 0.95, -1) +
    cl(66, 14, 0.62, -1, true) +
    cl(12, 98, 0.92, 1, true) +
    cl(20, 62, 0.7, 1) +
    cl(82, 104, 1.3, -1) +
    cl(34, 128, 0.85, 1) +
    `</g>` +
    frame('#d0a24a', '#000', 0.8) +
    roundel('#1d1a19', '#d0a24a', 22) +
    seal(50, 70, 26, 17)
  );
}

/* ---------- 보름달 · Harvest moon: a full moon over silver grass ---------- */
function moon(): string {
  const r = rng(8);
  let stars = '';
  for (let i = 0; i < 18; i++) {
    const x = 8 + r() * 84;
    const y = 8 + r() * 70;
    if (Math.hypot(x - 50, y - 50) < 34) continue;
    stars += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.25 + r() * 0.45)}" fill="#e8e6f2" opacity="${f(0.35 + r() * 0.5)}"/>`;
  }
  // silver grass: blades and nodding plumes, as on the August cards
  let blades = '';
  let fibres = '';
  let rach = '';
  for (let i = 0; i < 8; i++) {
    const x = 8 + i * 12 + (r() - 0.5) * 4;
    const base = 112 - Math.sin(i * 1.1) * 4;
    const hgt = 26 + ((i * 29) % 16);
    const tx = x + 5 + (i % 3) * 3;
    const ty = base - hgt;
    blades += `<path d="${taper([[x, base + 4], [x + 1, base - hgt * 0.6], [tx, ty]], lin(1.4, 0.35))}"/>`;
    const len = 12 + r() * 4;
    const dx = 3.6 + r() * 2.4;
    const core: Pt[] = [[tx, ty], [tx + dx * 0.6, ty + len * 0.35], [tx + dx, ty + len]];
    rach += 'M' + smooth(core, 4).map(([px, py]) => `${f(px)} ${f(py)}`).join('L');
    smooth(core, 4).forEach(([px, py], k) => {
      if (k === 0) return;
      const l = 4.4 + (1 - k / 8) * 3 + r() * 1.4;
      for (const sd of [-1, 1]) fibres += `M${f(px)} ${f(py)}q${f(sd * l * 0.45)} ${f(l * 0.15)} ${f(sd * l * 0.55 + 0.6)} ${f(l * 0.8)}`;
    });
  }
  return (
    `<defs>` +
    `<linearGradient id="bk-mo-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a33"/><stop offset=".65" stop-color="#262c50"/><stop offset="1" stop-color="#323862"/></linearGradient>` +
    `<radialGradient id="bk-mo-face" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#fdf8e8"/><stop offset=".7" stop-color="#f0e4c4"/><stop offset="1" stop-color="#e2d0a2"/></radialGradient>` +
    `<radialGradient id="bk-mo-halo"><stop offset=".55" stop-color="#f4e8c8" stop-opacity=".22"/><stop offset="1" stop-color="#f4e8c8" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<rect width="100" height="140" rx="9" fill="#141a33"/>` +
    `<g clip-path="url(#card-clip)">` +
    `<rect x="4" y="4" width="92" height="132" fill="url(#bk-mo-sky)"/>` +
    stars +
    `<circle cx="50" cy="52" r="44" fill="url(#bk-mo-halo)"/>` +
    `<circle cx="50" cy="52" r="26" fill="url(#bk-mo-face)"/>` +
    `<path d="M38 43c4-3 9-2 11 1s-1 6-5 6-8-4-6-7zM55 57c3-2 8-1 9 2s-2 5-5 5-6-4-4-7zM57 38c2-1 5 0 5 2s-2 3-4 2-3-3-1-4z" fill="#e2cf9e" opacity=".5"/>` +
    `<circle cx="50" cy="52" r="26" fill="none" stroke="#fffaf0" stroke-opacity=".6" stroke-width=".6"/>` +
    `<g fill="#7d84a6">${blades}</g>` +
    `<path d="${fibres}" fill="none" stroke="#c9cee2" stroke-width=".55" stroke-linecap="round" opacity=".9"/>` +
    `<path d="${rach}" fill="none" stroke="#9aa1c0" stroke-width=".55"/>` +
    `<path d="M4 112Q24 101 44 107Q64 113 78 103Q88 97 96 101L96 136L4 136Z" fill="#0f1326"/>` +
    `<path d="M4 112.6Q24 101.6 44 107.6Q64 113.6 78 103.6Q88 97.6 96 101.6" fill="none" stroke="#3a4170" stroke-width="1"/>` +
    `</g>` +
    frame('#c3c8de', '#05070f', 0.75) +
    seal(50, 122, 14, 23, -3)
  );
}

export const BACK_ART: Record<string, () => string> = { seigaiha, dancheong, asanoha, clouds, moon };
