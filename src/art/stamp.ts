/**
 * Passport stamps (도장 · 印) for the Flower Road, drawn in code: four seal
 * shapes (round, square, gourd, tall rectangle), six inks, the place name in
 * Hanja/Kanji and Hangul, and the date it was earned. Ink edges are roughened
 * by one shared SVG filter (installed once by `installStampDefs`).
 */
import { type RouteChapter, SEASON_NAMES } from '../data/route';

export type StampShape = 'round' | 'square' | 'gourd' | 'rect';
const SHAPES: StampShape[] = ['round', 'square', 'rect', 'gourd'];

/** Seal inks: vermilion leads; the others are the colours of real stamp pads. */
const INKS = ['#b9372a', '#2f4f7d', '#9c2c3e', '#36694a', '#b9372a', '#6a4a86', '#8a5a26'];

export const stampShape = (index: number): StampShape => SHAPES[(index + Math.floor(index / 4)) % 4];
export const stampInk = (index: number): string => INKS[(index * 3) % INKS.length];
/** A small, steady tilt per stamp so a page of them looks hand-pressed. */
export const stampTilt = (index: number): number => ((index * 37) % 13) - 6;

const FILTER_ID = 'jj-stamp-ink';

/** Shared defs (ink-bleed filter). Safe to call more than once. */
export function installStampDefs(): void {
  if (typeof document === 'undefined' || document.getElementById('stamp-defs')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.id = 'stamp-defs';
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  // Rough the edges a touch, then let the paper show through in soft patches.
  svg.innerHTML = `<defs><filter id="${FILTER_ID}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="grain"/>
    <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="rough"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.13" numOctaves="2" seed="11" result="blot"/>
    <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.1 0 0 0 2.2" result="wear"/>
    <feComposite in="rough" in2="wear" operator="in"/>
  </filter></defs>`;
  document.body.prepend(svg);
}

const DIGITS = /\d{4}-\d{2}-\d{2}/;
/** '2026-10-07' → '2026.10.07' */
export const stampDate = (key: string) => (DIGITS.test(key) ? key.replace(/-/g, '.') : key);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const JA = `font-family="'Zen Old Mincho','Noto Serif JP','Noto Serif CJK JP',serif" font-weight="700"`;
const KO = `font-family="'Gowun Batang','Noto Serif KR',serif" font-weight="700"`;
const SANS = `font-family="'Gowun Dodum',system-ui,sans-serif" font-weight="700"`;

/** `fill` as an attribute, or as a style when it is a CSS variable (attributes can't read those). */
const paint = (fill: string) => (fill.startsWith('var(') ? `style="fill:${fill}"` : `fill="${fill}"`);

function text(x: number, y: number, size: number, body: string, font: string, fill: string, extra = ''): string {
  return `<text x="${x}" y="${y}" font-size="${size.toFixed(1)}" text-anchor="middle" dominant-baseline="central" ${font} ${paint(fill)} ${extra}>${esc(body)}</text>`;
}

/** Glyphs in a row (centred at y), sized to fit `width`. */
function row(chars: string[], y: number, width: number, max: number, fill: string): string {
  const size = Math.min(max, width / chars.length);
  return text(60, y, size, chars.join(''), JA, fill, chars.length > 1 ? `letter-spacing="${(size * 0.04).toFixed(1)}"` : '');
}

/** Glyphs stacked top to bottom (traditional seal reading), centred on x = 60. */
function column(chars: string[], top: number, height: number, max: number, fill: string): string {
  const size = Math.min(max, height / chars.length);
  return chars.map((ch, i) => text(60, top + size * (i + 0.5), size, ch, JA, fill)).join('');
}

/** A 2×2 block, read right column first, top to bottom. */
function block(chars: string[], cx: number, cy: number, size: number, fill: string): string {
  const pos = [
    [cx + size / 2, cy - size / 2],
    [cx + size / 2, cy + size / 2],
    [cx - size / 2, cy - size / 2],
    [cx - size / 2, cy + size / 2],
  ];
  return chars.map((ch, i) => text(pos[i][0], pos[i][1], size * 0.92, ch, JA, fill)).join('');
}

export interface StampOptions {
  /** extra class on the <svg> */
  cls?: string;
  /** accessible label; omitted → aria-hidden */
  label?: string;
}

/**
 * The stamp for route chapter `index` (0–49). `date` null draws the empty,
 * dashed outline shown before it is earned.
 */
export function stampSvg(c: RouteChapter, index: number, date: string | null, opts: StampOptions = {}): string {
  const shape = stampShape(index);
  const earned = date != null;
  const ink = earned ? stampInk(index) : 'currentColor';
  const hole = 'var(--stamp-hole, #faf6ee)';
  const chars = [...c.ja.replace(/\s+/g, '')];
  const season = SEASON_NAMES[c.season].ja;
  const d = earned ? stampDate(date) : '';
  const line = earned ? '' : 'stroke-dasharray="5 4"';
  let body = '';

  if (shape === 'round') {
    // 朱文: red lines and red characters on the paper.
    body =
      `<circle cx="60" cy="60" r="53" fill="none" stroke="${ink}" stroke-width="${earned ? 4.2 : 2}" ${line}/>` +
      (earned
        ? `<circle cx="60" cy="60" r="46.5" fill="none" stroke="${ink}" stroke-width="1.2"/>` +
          text(60, 27, 12, season, JA, ink) +
          row(chars, 57, chars.length > 3 ? 70 : 66, 30, ink) +
          text(60, 80, 11, c.ko, KO, ink) +
          `<path d="M34 89H86" stroke="${ink}" stroke-width="1"/>` +
          text(60, 97, 7.4, d, SANS, ink, 'letter-spacing=".4"')
        : row(chars, 58, 64, 28, ink));
  } else if (shape === 'square') {
    // 白文: an inked square with the characters cut out of it.
    body = earned
      ? `<rect x="9" y="9" width="102" height="102" rx="9" fill="${ink}"/>` +
        `<rect x="15.5" y="15.5" width="89" height="89" rx="5" fill="none" stroke-width="1.3" style="stroke:${hole}"/>` +
        (chars.length === 4 ? block(chars, 60, 50, 26, hole) : row(chars, 50, 78, 32, hole)) +
        text(60, 80, 11.5, c.ko, KO, hole) +
        text(60, 96, 7.4, d, SANS, hole, 'letter-spacing=".4"')
      : `<rect x="9" y="9" width="102" height="102" rx="9" fill="none" stroke="${ink}" stroke-width="2" ${line}/>` +
        (chars.length === 4 ? block(chars, 60, 60, 26, ink) : row(chars, 60, 74, 30, ink));
  } else if (shape === 'rect') {
    // A tall name seal: characters read top to bottom.
    body =
      `<rect x="27" y="4" width="66" height="112" rx="6" fill="none" stroke="${ink}" stroke-width="${earned ? 3.8 : 2}" ${line}/>` +
      (earned
        ? `<rect x="32.5" y="9.5" width="55" height="101" rx="3" fill="none" stroke="${ink}" stroke-width="1.1"/>` +
          column(chars, 14, 66, 24, ink) +
          `<path d="M40 84H80" stroke="${ink}" stroke-width="1"/>` +
          text(60, 93, chars.length > 3 || c.ko.length > 4 ? 8 : 9.5, c.ko, KO, ink) +
          text(60, 104, 6.6, d, SANS, ink, 'letter-spacing=".3"')
        : column(chars, 14, 90, 24, ink));
  } else {
    // Gourd (瓢簞印): the season in the small bulb, the place in the large one.
    const gourd = 'M60 6a21 21 0 0 1 13.6 37A35 35 0 1 1 46.4 43 21 21 0 0 1 60 6Z';
    body = earned
      ? `<path d="${gourd}" fill="${ink}"/>` +
        text(60, 27, 18, season, JA, hole) +
        (chars.length === 4 ? block(chars, 60, 72, 19, hole) : row(chars, 72, 54, 26, hole)) +
        text(60, 96, 8.5, c.ko, KO, hole) +
        text(60, 106, 6, d, SANS, hole)
      : `<path d="${gourd}" fill="none" stroke="${ink}" stroke-width="2" ${line}/>` +
        (chars.length === 4 ? block(chars, 60, 76, 19, ink) : row(chars, 76, 52, 24, ink));
  }

  const a11y = opts.label ? `role="img" aria-label="${esc(opts.label)}"` : 'aria-hidden="true"';
  const filter = earned ? ` filter="url(#${FILTER_ID})"` : '';
  return `<svg class="stamp-art stamp-art--${shape}${earned ? '' : ' is-empty'}${opts.cls ? ` ${opts.cls}` : ''}" viewBox="0 0 120 120" ${a11y}><g${filter}>${body}</g></svg>`;
}
