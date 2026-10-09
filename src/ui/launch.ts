import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { type BootStep, bootFraction, holdRemaining } from './launch-plan';
import { wait } from './dom';
import { reducedMotion } from './motion';

/** The seal's face in the loader; the native splash hides only once this glyph can draw. */
const SEAL_FONT = "700 64px 'Gowun Batang'";
/**
 * The native splash fades over the loader this long when hidden (the SplashScreen
 * plugin's launchFadeOutDuration default); the loader's motion starts after it.
 */
const NATIVE_SPLASH_FADE_MS = 200;
/** The loader's cross-fade out (launch.css: launch-out / rm-out). */
const LEAVE_MS = 360;
const LEAVE_REDUCED_MS = 160;

export interface Loader {
  /** a real boot step finished: the line advances */
  done(step: BootStep): void;
  /** boot is finished: hold for the minimum time, then cross-fade into the screen beneath */
  finish(): Promise<void>;
}

let markGone: () => void = () => {};
/** Resolves once the loader has cross-faded away and the first screen is fully in view. */
export const loaderGone = new Promise<void>((resolve) => (markGone = resolve));

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

/**
 * Take over the loader painted by index.html. The native splash is hidden as
 * soon as the seal can draw (on Android the WebView draws nothing until then),
 * then the motion starts: the seal is pressed, the brush stroke and the wordmark
 * follow, and the line moves only as boot steps really finish.
 */
export function takeOverLoader(): Loader {
  const el = document.getElementById('launch');
  const fill = el?.querySelector<HTMLElement>('.launch__line i');
  if (!el || !fill) throw new Error('index.html must contain the #launch loader with its .launch__line');
  const finished = new Set<BootStep>();
  let lastStepAt = performance.now();

  const shown = (async (): Promise<number> => {
    await document.fonts.load(SEAL_FONT, '짝');
    if (Capacitor.isNativePlatform()) {
      await SplashScreen.hide();
      await wait(NATIVE_SPLASH_FADE_MS);
    }
    await nextFrame();
    el.classList.add('is-on');
    return performance.now();
  })();

  return {
    done(step) {
      finished.add(step);
      lastStepAt = performance.now();
      const fraction = bootFraction(finished);
      fill.style.transform = `scaleX(${fraction})`;
      el.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    },
    async finish() {
      const shownAt = await shown;
      await wait(holdRemaining({ shownAt, lastStepAt, now: performance.now() }));
      document.documentElement.removeAttribute('data-launching');
      el.classList.add('is-leaving');
      await wait(reducedMotion() ? LEAVE_REDUCED_MS : LEAVE_MS);
      el.remove();
      markGone();
    },
  };
}
