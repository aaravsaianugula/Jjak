/**
 * Art for the rule mechanics: ordered seals (도장 · 印) and wet ink (먹 · 墨).
 * Shared by the game board and the mini demo boards.
 *
 * A seal is a small square vermilion impression for a card's corner, its
 * numeral carved out so the paper shows through (白文, the way a name seal is
 * cut). The square's edge is a little uneven, like a stamp pressed by hand.
 *
 * A blot of wet ink is drawn in card units (100 × 140) so it sits in a card's
 * slot: one solid brushed shape, a soft bleed where the ink soaks into the
 * paper around it, and a wet sheen. It dries by fading (CSS `--wet`, 0–1), in
 * as many steps as it has pairs left. Colours come from CSS, so both themes work.
 */

/** Carved numerals 1–9 as strokes in a 20 × 20 box. */
const DIGITS: Record<number, string> = {
  1: 'M7.4 6.6L10.4 4.2V15.8M7.2 15.8H13.4',
  2: 'M6.2 7.4C6.6 4.4 13.8 3.8 13.8 7.6C13.8 10.4 7.6 12.6 6.2 15.8H14',
  3: 'M6.4 4.6H13.6L9.4 9.2C12.6 8.8 14.4 10.6 14 13C13.4 16.4 8 16.6 6.2 14.4',
  4: 'M12.2 15.8V4.2L5.4 12.4H14.8',
  5: 'M13.4 4.4H7.4L6.8 9.6C9.2 8 13.8 8.6 13.8 12.2C13.8 16 8.4 16.6 6.2 14.6',
  6: 'M12.8 4.6C8.6 5 6.2 8.6 6.2 12C6.2 14.4 7.8 15.9 10 15.9C12.4 15.9 13.8 14.2 13.8 12.2C13.8 10 12.2 8.8 10.2 8.8C8.4 8.8 7 9.8 6.4 11',
  7: 'M6 4.6H14L9.2 15.8',
  8: 'M10 9.6C7.4 9.6 6.6 8.2 6.6 7C6.6 5.4 8 4.2 10 4.2S13.4 5.4 13.4 7C13.4 8.2 12.6 9.6 10 9.6C7.2 9.6 6.2 11.2 6.2 12.8C6.2 14.6 7.8 15.9 10 15.9S13.8 14.6 13.8 12.8C13.8 11.2 12.8 9.6 10 9.6Z',
  9: 'M13.6 9C13 10.4 11.8 11.2 10 11.2C7.8 11.2 6.2 9.8 6.2 7.8C6.2 5.6 7.8 4.2 10 4.2C12.4 4.2 13.8 6 13.8 8.4C13.8 12 11.4 15.4 7.2 15.8',
};

/** A seal impression with numeral n (1–9), in a 20 × 20 viewBox. */
export function sealSvg(n: number): string {
  const digit = DIGITS[Math.max(1, Math.min(9, n))];
  return (
    `<svg class="seal__art" viewBox="0 0 20 20" aria-hidden="true">` +
    // The stamp: a square with a hand-pressed edge, then the carved border line.
    `<path class="seal__stamp" d="M1.6 2.2C5 1.4 14.6 1.2 18.2 1.8C18.8 6 18.9 13.6 18.3 18.1C13.8 18.8 6.2 18.9 1.8 18.3C1.1 14 1 6.4 1.6 2.2Z"/>` +
    `<path class="seal__cut" d="M3.2 3.4C7 3 13.4 2.9 16.7 3.3C17 7.2 17.1 12.8 16.7 16.6C12.8 17 7.2 17.1 3.3 16.7C2.9 12.8 2.8 7.2 3.2 3.4Z" fill="none" stroke-width=".7"/>` +
    `<path class="seal__digit" d="${digit}" fill="none" stroke-width="2.3" stroke-linecap="square" stroke-linejoin="miter"/>` +
    `</svg>`
  );
}

/** What a screen reader hears for a sealed card, after its face. */
export const sealLabel = (n: number, waiting: boolean, first: number) =>
  waiting ? `seal ${n}, waits for seal ${first}` : `seal ${n}, its turn now`;

/**
 * A closed outline around (cx, cy) in polar form: `r(θ)` gives the radius at
 * each angle. Smoothed through the midpoints, so the edge is one continuous
 * brushed line (ragged, never broken into dots).
 */
function polarPath(cx: number, cy: number, r: (t: number) => number, n = 96): string {
  const pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    const rr = r(t);
    pts.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]);
  }
  const f = (v: number) => v.toFixed(1);
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  let d = `M${f(m0[0])} ${f(m0[1])}`;
  for (let k = 0; k < n; k++) {
    const m = mid(pts[k], pts[(k + 1) % n]);
    d += `Q${f(pts[k][0])} ${f(pts[k][1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `${d}Z`;
}

/** A soft bump of `h` around angle `at` (radians), `w` wide. */
const lobe = (t: number, at: number, w: number, h: number) => {
  const dt = Math.atan2(Math.sin(t - at), Math.cos(t - at));
  return h * Math.exp(-((dt / w) ** 2));
};

/**
 * The blot's silhouette: heavy where the brush landed (upper left), a drag
 * pulled out towards the lower right as it lifted, a smaller pooled lobe to
 * the left, and a ragged edge where the ink caught the paper's fibres.
 * `grow` widens it for the bleed rings around it.
 */
const blotRadius = (grow: number, rag: number) => (t: number) =>
  30 * (1 + grow) +
  4.5 * Math.sin(2 * t + 0.6) +
  3 * Math.sin(3 * t + 2.2) +
  lobe(t, 0.95, 0.32, 26) + // the drag, down and to the right
  lobe(t, 2.75, 0.38, 9) + // pooled lobe, left
  lobe(t, -1.35, 0.3, 6) + // a swell at the top
  rag * (1.6 * Math.sin(13 * t + 0.4) + 1.1 * Math.sin(23 * t + 1.9) + 0.7 * Math.sin(37 * t + 0.2));

const BLOT = polarPath(46, 64, blotRadius(0, 1));
/** Where the ink soaked into the hanji: two feathered rings, wider and calmer. */
const BLEED_NEAR = polarPath(46, 64, blotRadius(0.12, 1.4));
const BLEED_FAR = polarPath(47, 65, blotRadius(0.26, 0.8));
/** A torn square of paper under the blot (seen on the dark theme). */
const PATCH = polarPath(50, 70, (t) => {
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return Math.min(46 / Math.max(c, 1e-3), 62 / Math.max(s, 1e-3)) * 0.98 + 1.2 * Math.sin(19 * t + 0.7) + 0.8 * Math.sin(31 * t);
}, 160);

/**
 * A blot of wet ink in card units (static). How wet it looks comes from CSS
 * `--wet` (1 freshly laid … near 0 almost dry): the deep ink layer thins over a
 * paler dried-ink layer of the same shape, the feathered edge goes matte, and
 * the wet sheen goes first. It stays one solid shape throughout.
 */
export function inkSvg(): string {
  return (
    `<svg class="ink__art" viewBox="0 0 100 140" aria-hidden="true">` +
    `<path class="ink__patch" d="${PATCH}"/>` +
    `<path class="ink__bleed ink__bleed--far" d="${BLEED_FAR}"/>` +
    `<path class="ink__bleed" d="${BLEED_NEAR}"/>` +
    `<path class="ink__dry" d="${BLOT}"/>` +
    `<path class="ink__wet" d="${BLOT}"/>` +
    // Wet sheen: a small light crescent where the pooled ink catches the light.
    `<path class="ink__sheen" d="M30 50C33 42 40 37.5 48 37C42 40.5 37.5 45.5 35 52.5C33.4 53.6 30.6 52.6 30 50Z"/>` +
    `</svg>`
  );
}

/** What a screen reader hears for a blot. */
export const inkLabel = (left: number) =>
  `Wet ink: blocks paths, dries after ${left} more ${left === 1 ? 'pair' : 'pairs'}`;

/** How wet a blot looks, 0–1, with `left` pairs to go (full strength at INK_MAX_LIFE). */
export const wetness = (left: number, max: number) => Math.max(0, Math.min(1, left / max));
