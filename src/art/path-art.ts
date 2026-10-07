/**
 * Flower Path (꽃길 · 花道) and gift-calendar objects: lacquer chests with brass
 * fittings and silk cords, a brass-bound bandaji for the weekly chest, mission
 * badges, and the small reward icons used in chips and on the gift calendar.
 * Drawn in the same light, line and palette as the Market art, and served from
 * the same lazily built sprite (see market-art.ts).
 */
import { LINE, art, blossom, cardUse, defineArt, f, glint, lantern, petalShape, taperStroke } from './market-art';

export { art as pathArt };

const P = (d: string, fill: string, more = '') => `<path d="${d}" fill="${fill}"${more}/>`;
const S = (d: string, stroke: string, w: number, more = '') =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${more}/>`;
const floor = (cx: number, cy: number, rx: number, ry: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#mka-floor)"/>`;
const BRASS = 'url(#mka-brass)';

// ── Star chests: a black-lacquer box with gold maki-e plum and a vermilion cord ──

const chestBody = () =>
  P('M7 21H41V36.6Q41 39 38.6 39H9.4Q7 39 7 36.6Z', 'url(#mka-lac-black)', ' stroke="#120e0c" stroke-width=".5"') +
  P('M8.6 22.6H11.2V37.6H9.8Q8.6 37.6 8.6 36.4Z', '#fff', ' opacity=".07"') +
  S('M8.4 22.3H39.6', '#fff', 0.5, ' opacity=".16"') +
  P(taperStroke([[9.6, 35.6], [13, 33], [17, 31.2], [22, 30.2]], 1, 0.3), '#d9b45e') +
  blossom(14.4, 32, 2.6, '#e2c071', '#9c7128', 12) +
  blossom(20.6, 29.8, 1.8, '#e8cb82', '#9c7128', 40) +
  P('M7 33H10.4V35.6H12.4V39H9.4Q7 39 7 36.6Z', BRASS) +
  P('M41 33H37.6V35.6H35.6V39H38.6Q41 39 41 36.6Z', BRASS);

const cord = (x: number, y: number, len: number) =>
  S(`M${x} ${y}C${x - 1.4} ${y + len * 0.36} ${x - 4} ${y + len * 0.5} ${x - 6} ${y + len * 0.86}`, '#c0442d', 1.3) +
  P(`M${f(x - 6)} ${f(y + len * 0.86 - 1.4)}l1.5 1.5-1.5 1.5-1.5-1.5Z`, '#e3c27a') +
  P(`M${f(x - 7.6)} ${f(y + len * 0.86 + 1.4)}h3.2l.8 5.2q-2.4 1-4.8 0Z`, 'url(#mka-silk)');

const closedLid = () =>
  P('M5.4 14.6Q5.4 9 10.6 8.6H37.4Q42.6 9 42.6 14.6V21.6H5.4Z', 'url(#mka-lac-black)', ' stroke="#120e0c" stroke-width=".5"') +
  P('M5.4 18.2H42.6V21.6H5.4Z', '#000', ' opacity=".2"') +
  S('M9.4 10.9Q24 8.7 38.6 10.9', '#fff', 0.8, ' opacity=".26"') +
  P(taperStroke([[30, 16], [33, 14.6], [37, 14.2]], 0.8, 0.3), '#d9b45e') +
  blossom(35.4, 13.8, 2.1, '#e2c071', '#9c7128', 20) +
  P('M5.4 15.2Q5.4 9 10.6 8.6H12.8V11.2H8.4V15.2Z', BRASS) +
  P('M42.6 15.2Q42.6 9 37.4 8.6H35.2V11.2H39.6V15.2Z', BRASS) +
  P('M20 19.2H28V24.8Q24 27.4 20 24.8Z', BRASS, ` stroke="${LINE}" stroke-width=".4"`) +
  S('M24 21.2V23.6', '#5a3a14', 0.9);

defineArt('chest', '0 0 48 44', () =>
  floor(24, 40.4, 21, 3.4) +
  chestBody() +
  closedLid() +
  `<circle cx="24" cy="27.6" r="1.7" fill="none" stroke="#c99a48" stroke-width="1"/>` +
  cord(24, 29.2, 7),
);

const openLid = () =>
  P('M7.4 21 9.6 4.8Q24 2.6 38.4 4.8L40.6 21Z', 'url(#mka-lac-red)', ' stroke="#3a120a" stroke-width=".5"') +
  S('M9.6 4.8Q24 2.6 38.4 4.8', '#2c2420', 1.8) +
  P('M9.4 6.4 11 19.6H13L11.8 6.2Z', '#fff', ' opacity=".12"') +
  P('M6.6 19.2H41.4L41 22.2H7Z', '#3a100a');

defineArt('chest-open', '0 0 48 44', () =>
  `<circle cx="24" cy="16" r="22" fill="url(#mka-glow)" style="opacity:var(--mka-glow-o,.9)"/>` +
  floor(24, 40.4, 21, 3.4) +
  openLid() +
  `<ellipse cx="24" cy="20.6" rx="14.6" ry="1.8" fill="#ffe9b0" opacity=".95"/>` +
  chestBody() +
  `<circle cx="24" cy="24.6" r="1.7" fill="none" stroke="#c99a48" stroke-width="1"/>` +
  S('M24 26.2C23.4 30 24.8 33 24 37', '#c0442d', 1.3) +
  P('M22.4 37h3.2l.8 4.6q-2.4 1-4.8 0Z', 'url(#mka-silk)') +
  petalShape(18.6, 12, 0.55, -20) +
  petalShape(27.6, 7.6, 0.5, 30, '#f4bfca') +
  glint(32, 13.4, 2.4) +
  glint(14.6, 5.6, 1.7),
);

defineArt('chest-empty', '0 0 48 44', () =>
  floor(24, 40.4, 21, 3.4) +
  openLid() +
  `<ellipse cx="24" cy="20.6" rx="14.6" ry="1.6" fill="#5a1a10"/>` +
  chestBody() +
  `<circle cx="24" cy="24.6" r="1.7" fill="none" stroke="#c99a48" stroke-width="1"/>` +
  S('M24 26.2C23.4 30 24.8 33 24 37', '#c0442d', 1.3) +
  P('M22.4 37h3.2l.8 4.6q-2.4 1-4.8 0Z', 'url(#mka-silk)'),
);

// ── Weekly chest: a zelkova bandaji with big brass fittings ──

const bandajiBody = () =>
  P('M6 37H11V41H6.6Z', 'url(#mka-wood-dark)') +
  P('M46 37H41V41H45.4Z', 'url(#mka-wood-dark)') +
  `<rect x="4" y="9" width="44" height="29" rx="1.2" fill="url(#mka-wood)" stroke="#3e2414" stroke-width=".6"/>` +
  S('M6 14Q20 12.4 34 14.4T47 13.6M6 18.6Q22 17.4 46 19M6 27Q20 25.4 32 27.4T47 26.6M6 33.4Q24 31.8 46 33.6', '#5a3420', 0.45, ' opacity=".35"') +
  S('M4.6 22.4H47.4', '#3e2414', 0.7) +
  P('M4 33H8.8V38H5.2Q4 38 4 36.8Z', BRASS) +
  P('M48 33H43.2V38H46.8Q48 38 48 36.8Z', BRASS) +
  S('M4 17.4Q1.2 20 4 22.8M48 17.4Q50.8 20 48 22.8', '#c99a48', 1.2) +
  P('M24.8 27.6H27.2V34Q26 35.4 24.8 34Z', BRASS, ` stroke="${LINE}" stroke-width=".3"`);

const lockPlate = () =>
  `<circle cx="26" cy="22.4" r="6.4" fill="${BRASS}" stroke="${LINE}" stroke-width=".4"/>` +
  `<circle cx="26" cy="22.4" r="4.7" fill="none" stroke="#8a5f24" stroke-width=".4"/>` +
  S('M26 18.6Q28.2 22.4 26 26.2Q23.8 22.4 26 18.6ZM22.2 22.4Q26 20.2 29.8 22.4Q26 24.6 22.2 22.4Z', '#8a5f24', 0.45) +
  S('M22.4 19.6A4.6 4.6 0 0 1 27.8 18.2', '#fff6d4', 0.6, ' opacity=".7"');

const hinge = (x: number) => P(`M${x - 4} 10.6Q${x} 13.8 ${x + 4} 10.6L${x + 3.2} 15.4Q${x} 13.6 ${x - 3.2} 15.4Z`, BRASS, ` stroke="${LINE}" stroke-width=".3"`);

defineArt('bandaji', '0 0 52 44', () =>
  floor(26, 40.6, 24, 3.4) +
  bandajiBody() +
  `<rect x="3" y="7.2" width="46" height="3.4" rx="1" fill="url(#mka-wood-dark)"/>` +
  S('M4.4 7.9H47.6', '#fff', 0.6, ' opacity=".22"') +
  P('M3 7.2H9.2V10.6H3.8Q3 10.6 3 9.8Z', BRASS) +
  P('M49 7.2H42.8V10.6H48.2Q49 10.6 49 9.8Z', BRASS) +
  hinge(13) +
  hinge(39) +
  lockPlate(),
);

defineArt('bandaji-open', '0 0 52 44', () =>
  `<circle cx="26" cy="8" r="22" fill="url(#mka-glow)" style="opacity:var(--mka-glow-o,.9)"/>` +
  floor(26, 40.6, 24, 3.4) +
  P('M3 9.6 7.4 1.2H44.6L49 9.6Z', 'url(#mka-wood-dark)', ' stroke="#3e2414" stroke-width=".5"') +
  P('M7.4 1.2H44.6L45.4 2.8H6.6Z', '#fff', ' opacity=".14"') +
  bandajiBody() +
  P('M4.6 9.6H47.4V11.6H4.6Z', '#2a160c') +
  `<ellipse cx="26" cy="10.4" rx="18" ry="1.4" fill="#ffe9b0" opacity=".9"/>` +
  hinge(13) +
  hinge(39) +
  lockPlate() +
  glint(16, 3.4, 2) +
  glint(37, 5, 1.6),
);

// ── Mission badges ──

defineArt('m-journey', '0 0 32 32', () =>
  `<defs><clipPath id="mka-mj"><circle cx="16" cy="16" r="14.4"/></clipPath><linearGradient id="mka-mjsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ead2"/><stop offset="1" stop-color="#e9d8b6"/></linearGradient></defs>` +
  `<circle cx="16" cy="16" r="14.4" fill="url(#mka-mjsky)"/>` +
  `<g clip-path="url(#mka-mj)">` +
  `<circle cx="21.6" cy="9.4" r="3" fill="#d9603f"/>` +
  P('M-2 22 7 10.6 12 16 17 11 26 19 34 15V34H-2Z', '#9fb4a6') +
  P('M-2 26 6 18.6 14 24 22 17.6 34 24V34H-2Z', '#6e8a7c') +
  P('M12 34C13 29 18 27.6 17 24.2 16.4 22.6 18.6 21.4 20.4 20.6 18.8 22.4 19.8 23.6 20.4 25.4 21.4 28.6 17.4 30.6 17.6 34Z', '#e6cfa4') +
  `</g>` +
  `<circle cx="16" cy="16" r="14.4" fill="none" stroke="#a88a5a" stroke-width=".8"/>`,
);

defineArt('m-daily', '0 0 32 32', () =>
  floor(16, 29, 12, 2) +
  `<rect x="6" y="6" width="20" height="21.6" rx="2" fill="url(#mka-paper)" stroke="${LINE}" stroke-width=".6"/>` +
  P('M6 8Q6 6 8 6H24Q26 6 26 8V11.4H6Z', 'url(#mka-lac-red)') +
  `<rect x="10" y="3.6" width="2" height="5" rx="1" fill="${BRASS}"/><rect x="20" y="3.6" width="2" height="5" rx="1" fill="${BRASS}"/>` +
  `<rect x="11.4" y="14.6" width="9.2" height="9.2" rx="1.6" fill="#c0442d" transform="rotate(-6 16 19.2)"/>` +
  `<rect x="12.8" y="16" width="6.4" height="6.4" rx=".8" fill="none" stroke="#fbe9dc" stroke-width=".7" transform="rotate(-6 16 19.2)"/>` +
  S('M14.6 18.6 16 20.2 17.6 17.8', '#fbe9dc', 0.8),
);

defineArt('m-rush', '0 0 32 32', () =>
  floor(16, 29.6, 11, 2) +
  `<rect x="7" y="3.4" width="18" height="3" rx="1" fill="url(#mka-wood-dark)"/>` +
  `<rect x="7" y="25.8" width="18" height="3" rx="1" fill="url(#mka-wood-dark)"/>` +
  P('M10.6 6.4H21.4C21.4 11 17.4 13.6 16.6 16 17.4 18.4 21.4 21 21.4 25.8H10.6C10.6 21 14.6 18.4 15.4 16 14.6 13.6 10.6 11 10.6 6.4Z', '#e8f0f2', ' opacity=".85" stroke="#7d8f96" stroke-width=".5"') +
  P('M12.6 8.6H19.4C19 10.8 17 12.4 16 13.8 15 12.4 13 10.8 12.6 8.6Z', '#d9b45e') +
  P('M11.4 25.6C11.8 22.6 14 21.2 16 20.4 18 21.2 20.2 22.6 20.6 25.6Z', '#d9b45e') +
  S('M16 14.4V20.8', '#d9b45e', 0.6) +
  S('M12 8Q12.4 11 14.6 13', '#fff', 0.7, ' opacity=".6"') +
  `<rect x="8" y="6.2" width="1.6" height="19.8" rx=".8" fill="url(#mka-wood)"/><rect x="22.4" y="6.2" width="1.6" height="19.8" rx=".8" fill="url(#mka-wood)"/>`,
);

defineArt('m-zen', '0 0 32 32', () => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 22; i++) {
    const a = ((-60 + (i / 22) * 320) * Math.PI) / 180;
    pts.push([16 + Math.cos(a) * 12.4, 16 + Math.sin(a) * 12.4]);
  }
  return (
    P(taperStroke(pts, 3.4, 0.5), '#2f2a26', ' style="fill:var(--ink,#2f2a26)" opacity=".85"') +
    floor(16, 24.4, 8, 1.4) +
    `<ellipse cx="16" cy="22.4" rx="6.2" ry="2.6" fill="#8d8a84"/>` +
    `<ellipse cx="16.4" cy="18.4" rx="4.6" ry="2.2" fill="#a3a09a"/>` +
    `<ellipse cx="15.8" cy="15" rx="3.2" ry="1.7" fill="#b9b6ae"/>` +
    S('M11.4 21.4Q14 20.4 17 20.6M13.2 17.6Q15 16.8 17 17M13.6 14.4Q15 13.8 16.4 14', '#fff', 0.6, ' opacity=".45"') +
    P('M16 13.4C15 11.6 15.6 10 17 9.4 17.2 11 17 12.4 16 13.4Z', '#6d9466')
  );
});

// ── Small reward icons (chips, gift calendar) ──

defineArt('i-hint', '0 0 24 24', () => lantern(12, 0.8, 0.34));
defineArt('i-shuffle', '0 0 24 24', () =>
  P(taperStroke([[3.6, 7.4], [8, 3.2], [13, 2], [19.6, 4.6]], 1.4, 0.3), '#c99a48') + cardUse('back', 9, 14.4, 10.4, -16) + cardUse('back', 15.2, 13.4, 10.4, 12),
);
defineArt('i-tea', '0 0 24 24', () =>
  S('M10 9C8.6 7 11 5.6 9.8 3.2M13.6 9C12.4 6.6 14.6 5.4 13.4 2.6', 'url(#mka-steam)', 1.1) +
  P('M3.6 11.6C3.8 16.6 7.4 20.6 12 20.6S20.2 16.6 20.4 11.6Z', 'url(#mka-celadon)', ` stroke="${LINE}" stroke-width=".7"`) +
  `<ellipse cx="12" cy="11.6" rx="8.4" ry="2.4" fill="#d3e5d3" stroke="${LINE}" stroke-width=".6"/>` +
  `<ellipse cx="12" cy="11.9" rx="7" ry="1.7" fill="url(#mka-tea)"/>` +
  S('M5.6 13.4C6.2 15.8 7.4 17.4 9 18.4', '#fff', 0.9, ' opacity=".5"'),
);
defineArt('i-card', '0 0 24 24', () =>
  `<circle cx="12" cy="12" r="11" fill="url(#mka-glow)" style="opacity:var(--mka-glow-o,.9)"/>` +
  cardUse(31, 12, 12.4, 13.6, 6) +
  glint(19.6, 4.6, 2.2),
);
const PETAL = 'M12 21c-4.5-2.6-7-6.3-7-10.2C5 6.6 8.2 3 12 3s7 3.6 7 7.8c0 3.9-2.5 7.6-7 10.2z';
const petal = (x: number, y: number, s: number, deg: number, fill = '#d98a98') =>
  `<g transform="translate(${x} ${y}) rotate(${deg}) scale(${s}) translate(-12 -12)"><path d="${PETAL}" fill="${fill}"/><path d="M12 21c-1.2-3.4-1.4-7-.2-11.2.3 4.1 1 7.6.2 11.2z" fill="#c4677a" opacity=".6"/><path d="M8 7.6C9 5.6 10.6 4.6 12 4.4" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".45"/></g>`;
defineArt('i-petal1', '0 0 24 24', () => petal(12, 12, 0.9, 0));
defineArt('i-petal2', '0 0 24 24', () => petal(9, 13, 0.72, -22, '#e3a5b0') + petal(15, 11.6, 0.76, 16));
defineArt('i-petal3', '0 0 24 24', () => petal(7.6, 14, 0.64, -34, '#e3a5b0') + petal(16.4, 14, 0.64, 32, '#e3a5b0') + petal(12, 10.6, 0.72, 0));
defineArt('i-hintshuffle', '0 0 24 24', () => cardUse('back', 16, 14, 9.6, 12) + lantern(7.6, 1.6, 0.3));

/** The lantern gift on the result sheet: a lit lantern against dusk (also a CSS data URI). */
defineArt('lantern-gift', '0 0 40 40', () =>
  `<circle cx="20" cy="20" r="19.4" fill="url(#mka-night)"/>` + `<circle cx="20" cy="20" r="18.6" fill="none" stroke="#c99a48" stroke-width=".8"/>` + lantern(20, 4.2, 0.48),
);

// ── Chest openings (inline, so each part can move: the lid lifts away, the light
// comes up inside, the contents rise). Classes are animated in meta.css. ──

defineArt('chest-reveal', '0 0 48 44', () =>
  `<g class="ca-glow"><circle cx="24" cy="16" r="22" fill="url(#mka-glow)" style="opacity:var(--mka-glow-o,.9)"/></g>` +
  floor(24, 40.4, 21, 3.4) +
  `<g class="ca-open">${openLid()}<ellipse cx="24" cy="20.6" rx="14.6" ry="1.8" fill="#ffe9b0" opacity=".95"/></g>` +
  chestBody() +
  `<circle cx="24" cy="24.6" r="1.7" fill="none" stroke="#c99a48" stroke-width="1"/>` +
  S('M24 26.2C23.4 30 24.8 33 24 37', '#c0442d', 1.3) +
  P('M22.4 37h3.2l.8 4.6q-2.4 1-4.8 0Z', 'url(#mka-silk)') +
  `<g class="ca-closed">${closedLid()}</g>` +
  `<g class="ca-rise">${petalShape(18.6, 12, 0.55, -20)}${petalShape(27.6, 7.6, 0.5, 30, '#f4bfca')}${glint(32, 13.4, 2.4)}${glint(14.6, 5.6, 1.7)}</g>`,
);

defineArt('bandaji-reveal', '0 0 52 44', () =>
  `<g class="ca-glow"><circle cx="26" cy="8" r="22" fill="url(#mka-glow)" style="opacity:var(--mka-glow-o,.9)"/></g>` +
  floor(26, 40.6, 24, 3.4) +
  `<g class="ca-open">${P('M3 9.6 7.4 1.2H44.6L49 9.6Z', 'url(#mka-wood-dark)', ' stroke="#3e2414" stroke-width=".5"')}${P('M7.4 1.2H44.6L45.4 2.8H6.6Z', '#fff', ' opacity=".14"')}</g>` +
  bandajiBody() +
  `<g class="ca-open">${P('M4.6 9.6H47.4V11.6H4.6Z', '#2a160c')}<ellipse cx="26" cy="10.4" rx="18" ry="1.4" fill="#ffe9b0" opacity=".9"/></g>` +
  hinge(13) +
  hinge(39) +
  lockPlate() +
  `<g class="ca-closed"><rect x="3" y="7.2" width="46" height="3.4" rx="1" fill="url(#mka-wood-dark)"/>${S('M4.4 7.9H47.6', '#fff', 0.6, ' opacity=".22"')}${P('M3 7.2H9.2V10.6H3.8Q3 10.6 3 9.8Z', BRASS)}${P('M49 7.2H42.8V10.6H48.2Q49 10.6 49 9.8Z', BRASS)}</g>` +
  `<g class="ca-rise">${glint(16, 3.4, 2)}${glint(37, 5, 1.6)}${petalShape(26, 3, 0.5, 15)}</g>`,
);
