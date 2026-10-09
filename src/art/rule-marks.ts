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

/** A blot of wet ink in card units (static; how wet it looks comes from CSS `--wet`). */
export function inkSvg(): string {
  return (
    `<svg class="ink__art" viewBox="0 0 100 140" aria-hidden="true">` +
    // Where the ink soaks into the paper: a wider, faint copy of the shape.
    `<path class="ink__bleed" d="M47 14C70 11 92 28 91 54C95 80 86 112 63 124C46 133 18 126 10 102C2 80 6 54 13 39C20 24 32 15 47 14Z"/>` +
    // The blot itself: one brushed shape, heavier where the brush landed.
    `<path class="ink__blot" d="M49 22C68 20 84 34 83 55C87 77 80 103 62 114C48 122 27 117 19 98C12 80 15 59 21 45C27 31 37 23 49 22Z"/>` +
    // The brush's drag as it lifted, still part of the same shape.
    `<path class="ink__blot" d="M62 112C70 116 76 122 79 129C80 131.5 77.6 132.6 75.8 130.6C71.6 125.6 66 120.4 58 116Z"/>` +
    // Wet sheen: a soft light curve that goes as the ink dries.
    `<path class="ink__sheen" d="M33 44C38 35 47 31 56 32" fill="none" stroke-width="4.2" stroke-linecap="round"/>` +
    `<path class="ink__sheen" d="M27 62C27 57 28.4 53 30.4 50" fill="none" stroke-width="2.6" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** What a screen reader hears for a blot. */
export const inkLabel = (left: number) =>
  `Wet ink: blocks paths, dries after ${left} more ${left === 1 ? 'pair' : 'pairs'}`;

/** How wet a blot looks, 0–1, with `left` pairs to go (full strength at INK_MAX_LIFE). */
export const wetness = (left: number, max: number) => Math.max(0, Math.min(1, left / max));
