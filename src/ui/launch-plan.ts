/**
 * Launch decisions, kept free of the DOM: the boot steps the loader's line waits
 * on, how far the line has run, how long the loader must stay up, and which
 * screen it opens onto.
 */

/** Real boot work, in the order it usually finishes: save read, card art and cosmetics applied, fonts ready, first screen built. */
export const BOOT_STEPS = ['save', 'art', 'fonts', 'screen'] as const;
export type BootStep = (typeof BOOT_STEPS)[number];

/** The loader never flashes: once its motion starts it stays at least this long. */
export const LOADER_MIN_MS = 700;
/** How long the progress line takes to glide to a new step (matches its CSS transition). */
export const LINE_SETTLE_MS = 280;

export type FirstScreen = 'home' | 'intro';

/** The first-minute metric runs from the intro's Begin tap, not from app launch. */
export const FIRST_MINUTE = {
  beginMark: 'jjak:begin',
  firstPairMark: 'jjak:first-pair',
  /** performance.measure name: Begin tap → the player's first real pair (goal: within ~20 s) */
  measure: 'jjak:begin-to-first-pair',
} as const;

/** Share of the boot steps done, 0..1. */
export function bootFraction(done: ReadonlySet<BootStep>): number {
  return BOOT_STEPS.filter((step) => done.has(step)).length / BOOT_STEPS.length;
}

/**
 * Milliseconds the loader should still stay: until it has been up for
 * LOADER_MIN_MS, and until the line has finished gliding to its last step.
 */
export function holdRemaining(t: { shownAt: number; lastStepAt: number; now: number }): number {
  return Math.max(0, LOADER_MIN_MS - (t.now - t.shownAt), LINE_SETTLE_MS - (t.now - t.lastStepAt));
}

/** A new player opens on the intro title; a returning player goes straight Home. */
export function firstScreen(save: { onboarded: boolean }): FirstScreen {
  return save.onboarded ? 'home' : 'intro';
}
