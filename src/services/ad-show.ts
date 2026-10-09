/**
 * Showing one full-screen ad (interstitial or rewarded) from start to close.
 *
 * The AdMob plugin's show calls don't mark the end of the ad: on Android the
 * interstitial call resolves as soon as the ad appears, and the rewarded call
 * resolves only when the reward is earned (never, if the player closes it early).
 * The ad's own events do: it ends when it is dismissed or fails to show, or, as a
 * backstop, when the player is back in the app and no close event came. Callers
 * preload the next ad and bring the music back only after this resolves; preloading
 * while an ad is still up loses the new one when the plugin clears its slot on close.
 */

interface Handle {
  remove: () => Promise<void>;
}

type Subscribe = (fn: () => void) => Promise<Handle>;

/** The ad's close events (and the reward, for a rewarded ad), as plugin listeners. */
export interface AdEvents {
  onDismissed: Subscribe;
  onFailedToShow: Subscribe;
  onRewarded?: Subscribe;
  /** the app is in front again after the ad covered it (the caller allows a grace period first) */
  onReturn?: Subscribe;
}

export interface AdOutcome {
  /** the ad appeared (it was prepared and didn't fail to show) */
  shown: boolean;
  /** a rewarded ad's reward was earned before it closed */
  rewarded: boolean;
}

/** Subscribe to all of them, or to none: if one registration fails, the others are removed. */
async function subscribeAll(subs: Promise<Handle>[]): Promise<Handle[]> {
  const results = await Promise.allSettled(subs);
  const handles = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) {
    await Promise.all(handles.map((h) => h.remove()));
    throw failed.reason;
  }
  return handles;
}

/** Show an ad and resolve once it has closed. Every listener is attached before the ad starts. */
export async function playFullScreenAd(show: () => Promise<unknown>, events: AdEvents): Promise<AdOutcome> {
  let rewarded = false;
  let close: (shown: boolean) => void = () => {};
  const closed = new Promise<boolean>((resolve) => (close = resolve));
  const handles = await subscribeAll([
    events.onDismissed(() => close(true)),
    events.onFailedToShow(() => close(false)),
    ...(events.onRewarded ? [events.onRewarded(() => (rewarded = true))] : []),
    ...(events.onReturn ? [events.onReturn(() => close(true))] : []),
  ]);
  try {
    // Not awaited on its own: a rewarded ad closed early never settles it. A rejection
    // (nothing prepared) means no ad will appear, so no close event will come either.
    show().catch(() => close(false));
    const shown = await closed;
    return { shown, rewarded: shown && rewarded };
  } finally {
    await Promise.all(handles.map((h) => h.remove()));
  }
}

/** One full-screen ad at a time: a request while one is up (a double tap) is refused, not stacked. */
export class FullScreenGate {
  private busy = false;

  async run<T>(play: () => Promise<T>, refused: T): Promise<T> {
    if (this.busy) return refused;
    this.busy = true;
    try {
      return await play();
    } finally {
      this.busy = false;
    }
  }
}
