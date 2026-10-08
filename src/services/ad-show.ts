/**
 * Showing one full-screen ad (interstitial or rewarded) from start to close.
 *
 * The AdMob plugin's show calls don't mark the end of the ad: on Android the
 * interstitial call resolves as soon as the ad appears, and the rewarded call
 * resolves only when the reward is earned (never, if the player closes it early).
 * The ad's own events do: it ends when it is dismissed or fails to show. Callers
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
}

export interface AdOutcome {
  /** the ad appeared (it was prepared and didn't fail to show) */
  shown: boolean;
  /** a rewarded ad's reward was earned before it closed */
  rewarded: boolean;
}

/** Show an ad and resolve once it has closed. Listeners are attached before the ad starts. */
export async function playFullScreenAd(show: () => Promise<unknown>, events: AdEvents): Promise<AdOutcome> {
  let rewarded = false;
  let close: (shown: boolean) => void = () => {};
  const closed = new Promise<boolean>((resolve) => (close = resolve));
  const handles = await Promise.all([
    events.onDismissed(() => close(true)),
    events.onFailedToShow(() => close(false)),
    ...(events.onRewarded ? [events.onRewarded(() => (rewarded = true))] : []),
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
