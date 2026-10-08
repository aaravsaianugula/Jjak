/**
 * The ad service around full-screen ads, with the AdMob plugin faked at the native
 * boundary (as it behaves on Android: interstitial show() resolves on display, rewarded
 * show() only on the reward, prepared slots cleared on close). Pins what broke on a
 * Pixel 10a: the next ad was preloaded while one was still up and lost, music came back
 * under the ad, and a rewarded ad closed early left the board waiting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (data?: unknown) => void;
const listeners = new Map<string, Set<Listener>>();
const calls: string[] = [];
let failListener: string | null = null;
let failPrepare = 0;

const emit = (event: string) => listeners.get(event)?.forEach((fn) => fn());

const fakeAdMob = {
  requestConsentInfo: vi.fn(async () => ({ canRequestAds: true, isConsentFormAvailable: false, status: 'NOT_REQUIRED', privacyOptionsRequirementStatus: 'NOT_REQUIRED' })),
  showConsentForm: vi.fn(),
  initialize: vi.fn(async () => {}),
  addListener: vi.fn(async (event: string, fn: Listener) => {
    await Promise.resolve();
    if (event === failListener) throw new Error(`addListener(${event}) failed`);
    const set = listeners.get(event) ?? new Set<Listener>();
    set.add(fn);
    listeners.set(event, set);
    return { remove: async () => void set.delete(fn) };
  }),
  prepareInterstitial: vi.fn(async () => {
    calls.push('prepareInterstitial');
    if (failPrepare > 0) {
      failPrepare--;
      throw new Error('no fill');
    }
  }),
  prepareRewardVideoAd: vi.fn(async () => void calls.push('prepareRewarded')),
  showInterstitial: vi.fn(async () => void calls.push('showInterstitial')),
  showRewardVideoAd: vi.fn(() => {
    calls.push('showRewarded');
    return new Promise<never>(() => {});
  }),
};

vi.mock('@capacitor/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@capacitor/core')>();
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => true } };
});
vi.mock('@capacitor-community/admob', async (importOriginal) => ({ ...(await importOriginal<object>()), AdMob: fakeAdMob }));
vi.mock('../src/services/music', () => ({ music: { duck: (on: boolean) => calls.push(`duck(${on})`) } }));

const visibility = new Set<() => void>();
const fakeDocument = {
  hidden: false,
  createElement: () => ({ className: '', innerHTML: '', remove: () => {} }),
  body: { append: () => {} },
  documentElement: { style: { setProperty: () => {} } },
  addEventListener: (_type: string, fn: () => void) => void visibility.add(fn),
  removeEventListener: (_type: string, fn: () => void) => void visibility.delete(fn),
};
const setHidden = (hidden: boolean) => {
  fakeDocument.hidden = hidden;
  visibility.forEach((fn) => fn());
};

async function freshAds() {
  vi.resetModules();
  const { InterstitialAdPluginEvents, RewardAdPluginEvents } = await import('@capacitor-community/admob');
  const { ads } = await import('../src/services/ads');
  const { save, defaultSave } = await import('../src/services/storage');
  Object.assign(save, defaultSave());
  await ads.start();
  calls.length = 0;
  return { ads, save, I: InterstitialAdPluginEvents, R: RewardAdPluginEvents };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', fakeDocument);
  listeners.clear();
  visibility.clear();
  calls.length = 0;
  failListener = null;
  failPrepare = 0;
  fakeDocument.hidden = false;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Let the "Short break" card run out and pending promises settle. */
const passBreak = () => vi.advanceTimersByTimeAsync(1000);

describe('interstitials', () => {
  it('the next one is prepared, and the music comes back, only after this one closes', async () => {
    const { ads, save, I } = await freshAds();
    save.ads.clearsSinceInterstitial = 5;
    const run = ads.betweenBoards(10);
    await passBreak();
    expect(calls).toEqual(['duck(true)', 'showInterstitial']); // the ad is up: nothing else yet
    emit(I.Dismissed);
    expect(await run).toBe(true);
    expect(calls).toEqual(['duck(true)', 'showInterstitial', 'duck(false)', 'prepareInterstitial']);
    expect(save.ads.clearsSinceInterstitial).toBe(0);
    expect(save.ads.interstitialsShown).toBe(1);
  });

  it('one that fails to show leaves the counters as they were (the next clear may try again)', async () => {
    const { ads, save, I } = await freshAds();
    save.ads.clearsSinceInterstitial = 5;
    const run = ads.betweenBoards(10);
    await passBreak();
    emit(I.FailedToShow);
    expect(await run).toBe(false);
    expect(save.ads.clearsSinceInterstitial).toBe(6);
    expect(save.ads.interstitialsShown).toBe(0);
    expect(calls.at(-1)).toBe('prepareInterstitial');
  });

  it('a preload that failed at launch is retried between boards', async () => {
    failPrepare = 1;
    const { ads, save } = await freshAds(); // launch preload: no fill
    save.ads.clearsSinceInterstitial = 5;
    expect(await ads.betweenBoards(10)).toBe(false); // nothing ready: no card, no ad
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toContain('prepareInterstitial');
    expect(calls).not.toContain('showInterstitial');
  });

  it('a listener that will not register skips the ad instead of breaking the way to the next board', async () => {
    const { ads, save, I } = await freshAds();
    failListener = I.Dismissed;
    save.ads.clearsSinceInterstitial = 5;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const run = ads.betweenBoards(10);
    await passBreak();
    expect(await run).toBe(false);
    expect(calls).not.toContain('showInterstitial');
    expect(calls).toContain('duck(false)');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('rewarded ads', () => {
  it('a second one while one is up (a double tap) is refused, and the reward is paid once', async () => {
    const { ads, save, R } = await freshAds();
    const first = ads.rewarded();
    await vi.advanceTimersByTimeAsync(0);
    expect(await ads.rewarded()).toBe(false);
    expect(calls.filter((c) => c === 'showRewarded')).toHaveLength(1);
    emit(R.Rewarded);
    emit(R.Dismissed);
    expect(await first).toBe(true);
    expect(save.ads.rewardedWatched).toBe(1);
    expect(calls.slice(-2)).toEqual(['duck(false)', 'prepareRewarded']);
  });

  it('closed before the reward, it pays nothing and the board goes on', async () => {
    const { ads, save, R } = await freshAds();
    const run = ads.rewarded();
    await vi.advanceTimersByTimeAsync(0);
    emit(R.Dismissed);
    expect(await run).toBe(false);
    expect(save.ads.rewardedWatched).toBe(0);
    expect(save.ads.lastRewardedAt).toBe(0);
    expect(calls).toContain('duck(false)');
  });

  it('ends when the player is back in the app even if no close event came', async () => {
    const { ads, R } = await freshAds();
    const run = ads.rewarded();
    await vi.advanceTimersByTimeAsync(0);
    setHidden(true); // the ad covers the app
    emit(R.Rewarded);
    setHidden(false); // back in front; the close event never arrives
    await vi.advanceTimersByTimeAsync(3000);
    expect(await run).toBe(true);
  });
});
