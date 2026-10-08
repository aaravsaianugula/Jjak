/**
 * Everything you must change before release lives here.
 * See docs/PLAY_STORE_RELEASE.md → "AdMob".
 */

/**
 * Google's public **test** ad units. They always fill and never earn money.
 * Replace with your own units from https://admob.google.com before release
 * (and replace the app ID in android/app/src/main/res/values/strings.xml).
 */
export const AD_UNITS = {
  banner: 'ca-app-pub-3940256099942544/9214589741',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

/** true while AD_UNITS above are Google's test IDs. */
export const ADS_TEST_MODE = AD_UNITS.banner.startsWith('ca-app-pub-3940256099942544');

/** Fair-ads policy (see docs/GAME_DESIGN.md §6). */
export const AD_POLICY = {
  /** no interstitials until the player has cleared this many Journey levels */
  firstInterstitialAfterLevel: 5,
  /** at most one interstitial every N completed boards */
  interstitialEveryClears: 3,
  /** and never more often than this */
  interstitialMinSeconds: 150,
  /** banners only on these screens — never over the board */
  bannerScreens: ['home', 'album'] as string[],
  /** watching a rewarded ad earns this long without interstitials */
  rewardedGraceMinutes: 6,
  /** shown before an interstitial so it never arrives unannounced */
  adBreakNoticeMs: 900,
  /** at most one gentle "remove ads" mention per day, after this many interstitials */
  upsellAfterInterstitials: 3,
};

/**
 * One-time "Remove ads" purchase (Google Play Billing, managed product).
 * Create a product with this id in Play Console → Monetize → In-app products.
 * It removes interstitials and banners; rewarded ads stay available because the
 * player chooses them.
 */
export const IAP = {
  removeAds: 'jjak_remove_ads',
  fallbackPrice: '$2.99',
  /**
   * Petal pouches: **consumable** in-app products (consumed after the petals are
   * credited, so they can be bought again). Prices come from Play (`priceString`);
   * the fallbacks are only shown while Play hasn't answered. See docs/MONETIZATION.md §4b.
   */
  pouches: [
    { id: 'jjak_petals_small', name: 'Small pouch', petals: 600, fallbackPrice: '$0.99' },
    { id: 'jjak_petals_medium', name: 'Pouch of petals', petals: 1600, fallbackPrice: '$2.49' },
    { id: 'jjak_petals_large', name: 'Large pouch', petals: 4000, fallbackPrice: '$4.99' },
  ],
  /** Supporter pack: **non-consumable**. Remove ads + 1,500 petals once + the Clouds card back + a Supporter seal. */
  supporter: 'jjak_supporter',
  supporterPetals: 1500,
  supporterFallbackPrice: '$4.99',
};

export const ECONOMY = {
  startHints: 5,
  startShuffles: 5,
  hintCost: 20,
  shuffleCost: 15,
  petalsPerStar: 5,
  dailyPetals: 15,
  zenPetals: 3,
  /** every Nth Journey level (first clear) hangs a lantern gift */
  lanternEvery: 4,
  /** a lantern's own petals, before the hint's or shuffle's worth it alternates (src/services/progress.ts lanternGift) */
  lanternPetals: 15,
  /** Rush: petals per this many points, capped */
  rushPointsPerPetal: 800,
  rushPetalCap: 25,
};

/**
 * 7-day gift calendar. Missing a day never resets it: it simply waits.
 * Hints and shuffles come only from a rewarded ad or the petal price, so the
 * days that once held a tool hold that tool's price in petals instead.
 */
export const GIFTS: { petals: number; card?: boolean; label: string }[] = [
  { petals: 10, label: '10 petals' },
  { petals: ECONOMY.hintCost, label: `${ECONOMY.hintCost} petals` },
  { petals: 15, label: '15 petals' },
  { petals: ECONOMY.shuffleCost, label: `${ECONOMY.shuffleCost} petals` },
  { petals: 20, label: '20 petals' },
  { petals: ECONOMY.hintCost + ECONOMY.shuffleCost, label: `${ECONOMY.hintCost + ECONOMY.shuffleCost} petals` },
  { card: true, petals: 10, label: 'Album card' },
];

/** Public URLs (host the privacy policy from docs/privacy-policy.html, e.g. on GitHub Pages). */
export const LINKS = {
  privacy: 'https://aaravsaianugula.github.io/Jjak/privacy-policy.html',
  store: 'https://play.google.com/store/apps/details?id=com.jjak.puzzle',
};

export const APP_VERSION = '1.0.0';
