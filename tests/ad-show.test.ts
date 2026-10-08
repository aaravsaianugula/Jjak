/**
 * Full-screen ads (interstitial, rewarded) end when the ad closes, not when the plugin's
 * show call settles: on Android the interstitial call resolves as soon as the ad appears,
 * and the rewarded call resolves only when the reward is earned (never, if the player
 * closes it early). Preloading or un-ducking the music before the close loses the next
 * ad and plays music under this one; waiting on the show call alone can hang forever.
 */
import { describe, expect, it } from 'vitest';
import { type AdEvents, playFullScreenAd } from '../src/services/ad-show';

/** A fake plugin: listeners by event, and handles that report removal. */
function fakeAd() {
  const listeners = new Map<string, Set<() => void>>();
  let removed = 0;
  const on = (name: string) => async (fn: () => void) => {
    const set = listeners.get(name) ?? new Set<() => void>();
    set.add(fn);
    listeners.set(name, set);
    return {
      remove: async () => {
        set.delete(fn);
        removed++;
      },
    };
  };
  const emit = (name: string) => listeners.get(name)?.forEach((fn) => fn());
  const events: AdEvents = { onDismissed: on('dismissed'), onFailedToShow: on('failed'), onRewarded: on('reward') };
  const live = () => [...listeners.values()].reduce((n, s) => n + s.size, 0);
  return { events, emit, live, removed: () => removed };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const settled = async <T>(p: Promise<T>): Promise<boolean> => {
  let done = false;
  void p.then(() => (done = true));
  await tick();
  return done;
};

describe('playFullScreenAd', () => {
  it('an interstitial ends at its close, not when show() resolves', async () => {
    const ad = fakeAd();
    const run = playFullScreenAd(() => Promise.resolve(), ad.events);
    expect(await settled(run)).toBe(false); // show() resolved on display; the ad is still up
    ad.emit('dismissed');
    expect(await run).toEqual({ shown: true, rewarded: false });
    expect(ad.live()).toBe(0);
  });

  it('a rewarded ad closed early ends unrewarded even though show() never settles', async () => {
    const ad = fakeAd();
    const run = playFullScreenAd(() => new Promise<never>(() => {}), ad.events);
    await tick();
    ad.emit('dismissed');
    expect(await run).toEqual({ shown: true, rewarded: false });
    expect(ad.live()).toBe(0);
  });

  it('a rewarded ad watched to the reward ends rewarded, at its close', async () => {
    const ad = fakeAd();
    let resolveShow: () => void = () => {};
    const run = playFullScreenAd(() => new Promise<void>((r) => (resolveShow = r)), ad.events);
    await tick();
    ad.emit('reward');
    resolveShow(); // the plugin resolves show() at the reward, mid-ad
    expect(await settled(run)).toBe(false);
    ad.emit('dismissed');
    expect(await run).toEqual({ shown: true, rewarded: true });
  });

  it('an ad that was not prepared ends at once, not shown', async () => {
    const ad = fakeAd();
    const run = playFullScreenAd(() => Promise.reject(new Error('No Interstitial can be shown')), ad.events);
    expect(await run).toEqual({ shown: false, rewarded: false });
    expect(ad.live()).toBe(0);
  });

  it('an ad that fails to show ends, not shown', async () => {
    const ad = fakeAd();
    const run = playFullScreenAd(() => Promise.resolve(), ad.events);
    await tick();
    ad.emit('failed');
    expect(await run).toEqual({ shown: false, rewarded: false });
    expect(ad.live()).toBe(0);
  });

  it('listens before showing, so a close that comes at once is not missed', async () => {
    const ad = fakeAd();
    const run = playFullScreenAd(async () => {
      ad.emit('dismissed');
    }, ad.events);
    expect(await run).toEqual({ shown: true, rewarded: false });
    expect(ad.removed()).toBe(3);
  });
});
