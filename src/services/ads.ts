/**
 * AdMob wrapper with the game's fair-ads policy built in.
 *
 *  • Consent first (Google UMP), then SDK init — ads are never requested
 *    when UMP says we can't.
 *  • Audience is 13+ (not Families); ads are capped at PG content.
 *  • Interstitials only between boards, rate-limited by AD_POLICY.
 *  • On the web (dev / demo) every call is a harmless stub.
 */
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
} from '@capacitor-community/admob';
import { AD_POLICY, AD_UNITS, ADS_TEST_MODE } from '../config';
import { persist, save } from './storage';

const native = Capacitor.isNativePlatform();

/**
 * Jjak's Play Console target audience is 13+, so it is not in the Families
 * programme: no age gate, no child-directed tagging. Ads are capped at
 * Parental Guidance so they stay in keeping with an "Everyone"-rated game
 * played by teens.
 */
const AD_PROFILE = {
  child: false,
  underConsent: false,
  rating: MaxAdContentRating.ParentalGuidance,
};

class AdService {
  private ready = false;
  private starting: Promise<void> | null = null;
  private bannerVisible = false;
  private interstitialLoaded = false;
  private rewardedLoaded = false;
  privacyOptionsRequired = false;
  /** Set by the UI to show a placeholder strip on the web demo. */
  onWebBanner: ((visible: boolean) => void) | null = null;

  /** Request consent + initialise. Safe to call repeatedly. */
  start(): Promise<void> {
    if (!native) return Promise.resolve();
    this.starting ??= this.doStart().catch((e) => {
      console.warn('ads: start failed', e);
      this.starting = null;
    });
    return this.starting;
  }

  private async doStart() {
    const p = AD_PROFILE;
    let info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: p.underConsent });
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
      info = await AdMob.showConsentForm();
    }
    this.privacyOptionsRequired = String(info.privacyOptionsRequirementStatus) === 'REQUIRED';
    if (!info.canRequestAds) return;

    await AdMob.initialize({
      tagForChildDirectedTreatment: p.child,
      tagForUnderAgeOfConsent: p.underConsent,
      maxAdContentRating: p.rating,
      initializeForTesting: ADS_TEST_MODE,
    });
    await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
      document.documentElement.style.setProperty('--banner-h', `${size.height}px`);
    });
    this.ready = true;
    void this.preloadInterstitial();
    void this.preloadRewarded();
  }

  /** Personalisation is decided by the user's UMP consent, not by us. */
  private readonly npa = false;

  async showBanner(): Promise<void> {
    if (!native) {
      this.onWebBanner?.(true);
      return;
    }
    if (!this.ready || this.bannerVisible) return;
    this.bannerVisible = true;
    try {
      await AdMob.showBanner({
        adId: AD_UNITS.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        npa: this.npa,
        isTesting: ADS_TEST_MODE,
      });
    } catch {
      this.bannerVisible = false;
    }
  }

  async hideBanner(): Promise<void> {
    if (!native) {
      this.onWebBanner?.(false);
      return;
    }
    if (!this.bannerVisible) return;
    this.bannerVisible = false;
    document.documentElement.style.setProperty('--banner-h', '0px');
    try {
      await AdMob.removeBanner();
    } catch {
      /* already gone */
    }
  }

  private async preloadInterstitial() {
    if (!this.ready || this.interstitialLoaded) return;
    try {
      await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial, npa: this.npa, isTesting: ADS_TEST_MODE });
      this.interstitialLoaded = true;
    } catch {
      this.interstitialLoaded = false;
    }
  }

  private async preloadRewarded() {
    if (!this.ready || this.rewardedLoaded) return;
    try {
      await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded, npa: this.npa, isTesting: ADS_TEST_MODE });
      this.rewardedLoaded = true;
    } catch {
      this.rewardedLoaded = false;
    }
  }

  /**
   * Called after a board is cleared, *before* the next one starts.
   * Shows an interstitial only when the fair-ads policy allows it.
   */
  async betweenBoards(journeyLevelCleared: number | null): Promise<void> {
    save.ads.clearsSinceInterstitial++;
    persist();
    if (journeyLevelCleared != null && journeyLevelCleared < AD_POLICY.firstInterstitialAfterLevel) return;
    if (save.ads.clearsSinceInterstitial < AD_POLICY.interstitialEveryClears) return;
    if (Date.now() - save.ads.lastInterstitialAt < AD_POLICY.interstitialMinSeconds * 1000) return;
    if (!native || !this.ready || !this.interstitialLoaded) return;
    try {
      this.interstitialLoaded = false;
      await AdMob.showInterstitial();
      save.ads.clearsSinceInterstitial = 0;
      save.ads.lastInterstitialAt = Date.now();
      persist();
    } catch {
      /* no fill — skip silently */
    } finally {
      void this.preloadInterstitial();
    }
  }

  /** Is a rewarded ad worth offering right now? (Always true on web for the demo.) */
  get rewardedAvailable(): boolean {
    return !native || (this.ready && this.rewardedLoaded);
  }

  /** Show a rewarded ad. Resolves true only if the reward was earned. */
  async rewarded(): Promise<boolean> {
    if (!native) return webRewardStub();
    if (!this.ready) return false;
    if (!this.rewardedLoaded) await this.preloadRewarded();
    if (!this.rewardedLoaded) return false;
    try {
      this.rewardedLoaded = false;
      const item = await AdMob.showRewardVideoAd();
      return !!item && item.amount >= 0;
    } catch {
      return false;
    } finally {
      void this.preloadRewarded();
    }
  }

  async showPrivacyOptions(): Promise<void> {
    if (!native) return;
    try {
      await AdMob.showPrivacyOptionsForm();
    } catch {
      /* not required in this region */
    }
  }
}

/** Web preview: a short, honest stand-in so the reward flow can be tried. */
function webRewardStub(): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'ad-stub';
    el.innerHTML = '<div><p class="ad-stub__label">Rewarded ad</p><p>On Android a short video ad plays here.</p></div>';
    document.body.append(el);
    setTimeout(() => {
      el.remove();
      resolve(true);
    }, 1400);
  });
}

export const ads = new AdService();
